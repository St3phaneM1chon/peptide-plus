/**
 * Voicemail Engine — Recording, Storage, Transcription
 *
 * Features:
 * - Per-extension greeting (TTS or custom audio)
 * - Recording via Telnyx (WAV format)
 * - Auto-transcription on recording saved
 * - Prisma Voicemail record creation
 * - CRM linking (match caller to existing client)
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';
import { sendPushToUser, sendPushToStaff } from '@/lib/apns';
import { VoipStateMap } from './voip-state';

// Track active voicemail recordings — Redis-backed
const activeVoicemails = new VoipStateMap<{
  extensionId: string;
  callerNumber: string;
  callerName?: string;
  language?: string; // Language from IVR/PhoneNumber for transcription hint
}>('voip:voicemail:');

/**
 * Start voicemail recording for a call.
 * Target can be an extension number or extension ID.
 */
export async function startVoicemail(
  callControlId: string,
  target: string,
  callerInfo?: { from?: string; callerName?: string; language?: string }
): Promise<void> {
  // Find the extension
  const extension = await prisma.sipExtension.findFirst({
    where: {
      OR: [
        { id: target },
        { extension: target },
      ],
    },
    include: {
      user: { select: { name: true } },
    },
  });

  const extensionId = extension?.id || target;
  const agentName = extension?.user?.name || 'notre équipe';

  // Determine language from caller info or default to FR
  const lang = callerInfo?.language || 'fr-CA';
  const isFrench = lang.startsWith('fr');

  // Play voicemail greeting in detected language
  const greeting = isFrench
    ? `Vous avez joint la boîte vocale de ${agentName}. `
      + `Veuillez laisser votre message après le bip. `
      + `Appuyez sur la touche dièse lorsque vous avez terminé.`
    : `You have reached the voicemail of ${agentName}. `
      + `Please leave your message after the tone. `
      + `Press the pound key when you are finished.`;

  await telnyx.speakText(callControlId, greeting, { language: lang });

  // Track the voicemail (including language for transcription hint)
  activeVoicemails.set(callControlId, {
    extensionId,
    callerNumber: callerInfo?.from || 'unknown',
    callerName: callerInfo?.callerName,
    language: callerInfo?.language,
  });

  // Start recording (single channel for voicemail)
  await telnyx.startRecording(callControlId, {
    channels: 'single',
    format: 'wav',
  });

  logger.info('[Voicemail] Recording started', {
    callControlId,
    extensionId,
    callerNumber: callerInfo?.from,
  });
}

/**
 * Handle voicemail recording saved event.
 * Creates Voicemail record and triggers transcription.
 */
export async function handleVoicemailSaved(
  callControlId: string,
  recordingUrls: { mp3?: string; wav?: string },
  durationSec?: number
): Promise<void> {
  const vmInfo = activeVoicemails.get(callControlId);
  if (!vmInfo) return;

  const blobUrl = recordingUrls.wav || recordingUrls.mp3;

  // Try to match caller to existing client
  const client = vmInfo.callerNumber !== 'unknown'
    ? await prisma.user.findFirst({
        where: {
          OR: [
            { phone: vmInfo.callerNumber },
            { phone: vmInfo.callerNumber.replace(/^\+1/, '') },
          ],
        },
        select: { id: true },
      })
    : null;

  // Create voicemail record
  const voicemail = await prisma.voicemail.create({
    data: {
      extensionId: vmInfo.extensionId,
      callerNumber: vmInfo.callerNumber,
      callerName: vmInfo.callerName,
      blobUrl,
      durationSec,
      isRead: false,
      isArchived: false,
      ...(client ? { clientId: client.id } : {}),
    },
  });

  logger.info('[Voicemail] Saved', {
    voicemailId: voicemail.id,
    extensionId: vmInfo.extensionId,
    callerNumber: vmInfo.callerNumber,
    duration: durationSec,
  });

  // Send push notification to extension owner + all staff
  sendVoicemailNotification(vmInfo, durationSec).catch(err => {
    logger.error('[Voicemail] Push notification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Trigger transcription in background (will send updated push when done)
  // Pass through the language from IVR/PhoneNumber for Whisper hint
  if (blobUrl) {
    transcribeVoicemail(voicemail.id, blobUrl, vmInfo.language).catch(err => {
      logger.error('[Voicemail] Transcription failed', {
        voicemailId: voicemail.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Cleanup
  activeVoicemails.delete(callControlId);
}

/**
 * Transcribe a voicemail recording using OpenAI Whisper.
 * Downloads the audio, transcribes via Whisper, updates the Voicemail record.
 */
async function transcribeVoicemail(voicemailId: string, audioUrl: string, language?: string): Promise<void> {
  logger.info('[Voicemail] Starting Whisper transcription', { voicemailId, audioUrl, language });

  try {
    // Lazy-load OpenAI to avoid top-level init (KB-PP-BUILD-002)
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    if (!process.env.OPENAI_API_KEY) {
      logger.warn('[Voicemail] OPENAI_API_KEY not configured, skipping transcription', { voicemailId });
      return;
    }

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download voicemail audio: ${audioResponse.status}`);
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Create a File-like object for Whisper API
    const audioFile = new File([audioBuffer], 'voicemail.wav', { type: 'audio/wav' });

    // Transcribe with Whisper.
    // If a language is known (from IVR/PhoneNumber config), pass it as a hint.
    // Otherwise let Whisper auto-detect — handles both FR (Montreal) and EN (Toronto).
    const whisperParams: { file: File; model: string; response_format: 'text'; language?: string } = {
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text',
    };

    if (language) {
      // Extract ISO 639-1 code from locale (e.g. "fr-CA" → "fr", "en-CA" → "en")
      whisperParams.language = language.split('-')[0];
    }

    const transcription = await openai.audio.transcriptions.create(whisperParams);

    const transcriptText = typeof transcription === 'string'
      ? transcription
      : (transcription as { text?: string }).text ?? '';

    if (!transcriptText.trim()) {
      logger.info('[Voicemail] Empty transcription (silence or noise)', { voicemailId });
      return;
    }

    // Update the Voicemail record with transcription
    await prisma.voicemail.update({
      where: { id: voicemailId },
      data: { transcription: transcriptText },
    });

    logger.info('[Voicemail] Transcription completed', {
      voicemailId,
      textLength: transcriptText.length,
      preview: transcriptText.substring(0, 100),
    });
  } catch (error) {
    logger.error('[Voicemail] Whisper transcription failed', {
      voicemailId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-critical: voicemail is still saved without transcription
  }
}

/**
 * Send push notification for a new voicemail.
 */
async function sendVoicemailNotification(
  vmInfo: { extensionId: string; callerNumber: string; callerName?: string },
  durationSec?: number
): Promise<void> {
  const callerDisplay = vmInfo.callerName || vmInfo.callerNumber;
  const durationDisplay = durationSec
    ? `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`
    : '';

  // Find the extension owner
  const extension = await prisma.sipExtension.findUnique({
    where: { id: vmInfo.extensionId },
    select: { userId: true },
  });

  const payload = {
    title: 'Nouveau message vocal',
    body: `${callerDisplay}${durationDisplay ? ` (${durationDisplay})` : ''}`,
    category: 'CALL',
    sound: 'Courriel.caf',
    data: {
      type: 'voicemail',
      callerNumber: vmInfo.callerNumber,
      callerName: vmInfo.callerName || '',
    },
  };

  // Push to extension owner specifically
  if (extension?.userId) {
    await sendPushToUser(extension.userId, payload);
  }

  // Also notify all staff (small team, everyone should know)
  await sendPushToStaff(payload);
}

/**
 * Mark a voicemail as read.
 */
export async function markVoicemailRead(voicemailId: string): Promise<void> {
  await prisma.voicemail.update({
    where: { id: voicemailId },
    data: { isRead: true },
  });
}

/**
 * Archive a voicemail.
 */
export async function archiveVoicemail(voicemailId: string): Promise<void> {
  await prisma.voicemail.update({
    where: { id: voicemailId },
    data: { isArchived: true },
  });
}

/**
 * Get unread voicemail count for an extension.
 */
export async function getUnreadCount(extensionId: string): Promise<number> {
  return prisma.voicemail.count({
    where: {
      extensionId,
      isRead: false,
      isArchived: false,
    },
  });
}

/**
 * Check if a call is currently recording a voicemail.
 */
export function isVoicemailActive(callControlId: string): boolean {
  return activeVoicemails.has(callControlId);
}

/**
 * Cleanup voicemail state on hangup.
 */
export function cleanupVoicemail(callControlId: string): void {
  activeVoicemails.delete(callControlId);
}

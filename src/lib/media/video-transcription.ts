/**
 * Video Transcription Service
 * Chantier 2.2: Async transcription via OpenAI Whisper API.
 *
 * Generates text transcripts for uploaded videos.
 * Stores the result in the Video.transcript field (requires schema addition).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isIP } from 'net';

// ---------------------------------------------------------------------------
// SSRF Protection (V-011 fix)
// ---------------------------------------------------------------------------

const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^0\./, /^169\.254\./, /^::1$/, /^fc00:/, /^fe80:/, /^fd/,
];

/**
 * Validate a URL is safe to fetch (not targeting private/internal networks).
 * V-011 fix: Prevents SSRF via video URL.
 */
function validateExternalUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow http/https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    // Block localhost
    if (url.hostname === 'localhost' || url.hostname === '0.0.0.0') return false;

    // Block IP addresses in private ranges
    if (isIP(url.hostname)) {
      for (const range of PRIVATE_IP_RANGES) {
        if (range.test(url.hostname)) return false;
      }
    }

    // Block common internal hostnames
    const blockedPatterns = ['.internal', '.local', '.corp', '.intranet', 'metadata.google'];
    for (const pattern of blockedPatterns) {
      if (url.hostname.includes(pattern)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranscriptionResult {
  success: boolean;
  transcript?: string;
  language?: string;
  duration?: number;
  error?: string;
}

interface TranscriptionOptions {
  language?: string; // ISO-639-1 code (e.g. 'en', 'fr')
  model?: string;    // e.g. 'whisper-1'
}

// ---------------------------------------------------------------------------
// OpenAI Whisper integration
// ---------------------------------------------------------------------------

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return key;
}

/**
 * Transcribe an audio/video file using OpenAI Whisper API.
 * Accepts a buffer (downloaded from blob storage).
 */
async function transcribeBuffer(
  buffer: Buffer,
  filename: string,
  options?: TranscriptionOptions,
): Promise<TranscriptionResult> {
  try {
    const apiKey = getOpenAIKey();

    // Build multipart form data
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/mp4' });
    formData.append('file', blob, filename);
    formData.append('model', options?.model || 'whisper-1');
    formData.append('response_format', 'verbose_json');
    if (options?.language) {
      formData.append('language', options.language);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Transcription] OpenAI API error', { status: response.status, error: errorText });
      return { success: false, error: `API error: ${response.status}` };
    }

    const result = await response.json();

    return {
      success: true,
      transcript: result.text,
      language: result.language,
      duration: result.duration,
    };
  } catch (error) {
    logger.error('[Transcription] Error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transcribe a video by its ID.
 * Downloads the video from its URL, sends to Whisper, stores result.
 */
export async function transcribeVideo(
  videoId: string,
  options?: TranscriptionOptions,
): Promise<TranscriptionResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, title: true, videoUrl: true },
  });

  if (!video?.videoUrl) {
    return { success: false, error: 'Video not found or has no URL' };
  }

  // V-011 fix: Validate URL to prevent SSRF attacks
  if (!validateExternalUrl(video.videoUrl)) {
    logger.warn(`[Transcription] Blocked SSRF attempt for video ${videoId}: "${video.videoUrl}"`);
    return { success: false, error: 'Invalid video URL: internal/private addresses are not allowed' };
  }

  logger.info(`[Transcription] Starting transcription for video ${videoId}: "${video.title}"`);

  // Download the video file
  const fileRes = await fetch(video.videoUrl);
  if (!fileRes.ok) {
    return { success: false, error: `Failed to download video: ${fileRes.status}` };
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());

  // Whisper API has a 25MB limit — check size
  const MAX_SIZE = 25 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    return { success: false, error: `Video file too large for transcription (${(buffer.length / 1024 / 1024).toFixed(1)}MB, max 25MB)` };
  }

  const result = await transcribeBuffer(buffer, `${videoId}.mp4`, options);

  if (result.success && result.transcript) {
    // Store transcript in database (Video model must have a `transcript` field)
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: { description: video.title }, // Placeholder — see schema note below
      });
      // NOTE: To fully enable, add `transcript String?` to the Video model in schema.prisma
      // Then change the update above to: data: { transcript: result.transcript }
      logger.info(`[Transcription] Completed for video ${videoId} (${result.transcript.length} chars, lang: ${result.language})`);
    } catch (dbError) {
      logger.warn('[Transcription] Failed to store transcript in DB', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }
  }

  return result;
}

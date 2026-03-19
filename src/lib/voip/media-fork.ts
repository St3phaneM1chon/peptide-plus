/**
 * Telnyx Media Fork — Bidirectional Audio Streaming
 *
 * Enables real-time audio access via WebSocket:
 * - Fork inbound audio (caller voice) to external processing
 * - Inject synthesized audio back into the call
 * - Used by Voice AI Engine for STT→LLM→TTS pipeline
 *
 * Telnyx Media Fork sends raw audio frames (μ-law 8kHz mono) via WebSocket.
 * Audio can also be played back via the playAudioUrl API.
 */

import { logger } from '@/lib/logger';
import { telnyxFetch } from '@/lib/telnyx';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MediaForkConfig {
  /** Target WebSocket URL to receive audio frames */
  targetUrl: string;
  /** Audio stream type: 'raw' (PCM) or 'decrypted' */
  streamType?: 'raw' | 'decrypted';
  /** Fork both RX (caller) and TX (our side) audio */
  rxUrl?: string;
  txUrl?: string;
}

export interface MediaForkSession {
  callControlId: string;
  streamUrl: string;
  isActive: boolean;
  startedAt: Date;
}

// Active media fork sessions
const activeForks = new Map<string, MediaForkSession>();

// ── Media Fork Control ───────────────────────────────────────────────────────

/**
 * Start streaming audio from a call via Media Fork.
 * The caller's audio will be sent to the targetUrl WebSocket.
 */
export async function startMediaFork(
  callControlId: string,
  config: MediaForkConfig
): Promise<void> {
  try {
    await telnyxFetch(`/calls/${callControlId}/actions/fork_start`, {
      method: 'POST',
      body: {
        target: config.targetUrl,
        stream_type: config.streamType || 'raw',
        ...(config.rxUrl ? { rx: config.rxUrl } : {}),
        ...(config.txUrl ? { tx: config.txUrl } : {}),
      },
    });

    activeForks.set(callControlId, {
      callControlId,
      streamUrl: config.targetUrl,
      isActive: true,
      startedAt: new Date(),
    });

    logger.info('[MediaFork] Started', {
      callControlId,
      targetUrl: config.targetUrl.replace(/\/[^/]+$/, '/***'),
    });
  } catch (err) {
    logger.error('[MediaFork] Failed to start', {
      callControlId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Stop streaming audio from a call.
 */
export async function stopMediaFork(callControlId: string): Promise<void> {
  try {
    await telnyxFetch(`/calls/${callControlId}/actions/fork_stop`, {
      method: 'POST',
      body: {},
    });

    activeForks.delete(callControlId);

    logger.info('[MediaFork] Stopped', { callControlId });
  } catch (err) {
    logger.warn('[MediaFork] Failed to stop (call may have ended)', {
      callControlId,
      error: err instanceof Error ? err.message : String(err),
    });
    activeForks.delete(callControlId);
  }
}

/**
 * Play audio from a URL on the call.
 * Used to inject synthesized TTS audio back to the caller.
 */
export async function playAudioUrl(
  callControlId: string,
  audioUrl: string,
  options?: {
    loop?: number;
    overlay?: boolean;
    targetLegs?: 'self' | 'opposite' | 'both';
    clientState?: string;
  }
): Promise<void> {
  try {
    await telnyxFetch(`/calls/${callControlId}/actions/playback_start`, {
      method: 'POST',
      body: {
        audio_url: audioUrl,
        ...(options?.loop ? { loop: options.loop } : {}),
        ...(options?.overlay !== undefined ? { overlay: options.overlay } : {}),
        ...(options?.targetLegs ? { target_legs: options.targetLegs } : {}),
        ...(options?.clientState ? { client_state: options.clientState } : {}),
      },
    });

    logger.debug('[MediaFork] Playing audio', {
      callControlId,
      audioUrl: audioUrl.substring(0, 80),
    });
  } catch (err) {
    logger.error('[MediaFork] Failed to play audio', {
      callControlId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Stop audio playback on the call.
 */
export async function stopPlayback(callControlId: string): Promise<void> {
  try {
    await telnyxFetch(`/calls/${callControlId}/actions/playback_stop`, {
      method: 'POST',
      body: {},
    });
  } catch {
    // Non-critical — playback may have already ended
  }
}

/**
 * Send DTMF tones on the call (useful for navigating external IVRs).
 */
export async function sendDtmf(
  callControlId: string,
  digits: string,
  options?: { durationMs?: number }
): Promise<void> {
  await telnyxFetch(`/calls/${callControlId}/actions/send_dtmf`, {
    method: 'POST',
    body: {
      digits,
      duration_millis: options?.durationMs || 250,
    },
  });
}

// ── Session Management ───────────────────────────────────────────────────────

/**
 * Check if a media fork is active for a call.
 */
export function isMediaForkActive(callControlId: string): boolean {
  return activeForks.has(callControlId);
}

/**
 * Get the active media fork session for a call.
 */
export function getMediaForkSession(callControlId: string): MediaForkSession | undefined {
  return activeForks.get(callControlId);
}

/**
 * Cleanup media fork state (called on hangup).
 */
export function cleanupMediaFork(callControlId: string): void {
  activeForks.delete(callControlId);
}

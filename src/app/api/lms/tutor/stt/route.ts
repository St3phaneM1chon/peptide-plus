export const dynamic = 'force-dynamic';

/**
 * POST /api/lms/tutor/stt — Speech-to-Text for Aurelia Tutor
 * =============================================================================
 * Accepts an audio blob (FormData), sends it to Deepgram Nova-2 API
 * for transcription, and returns the transcribed text.
 *
 * Body: FormData with field "audio" (audio/webm, audio/wav, audio/mp3, etc.)
 *
 * Auth: Required (withUserGuard)
 * Rate limit: 10 req/min (speech transcription is resource-intensive)
 * CSRF: Required (POST mutation)
 *
 * Returns: { text: "transcribed text", confidence: 0.95, duration: 3.2 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

/** Maximum audio file size: 25 MB */
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

/** Allowed MIME types for audio */
const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/flac',
]);

// ---------------------------------------------------------------------------
// Deepgram Response Types
// ---------------------------------------------------------------------------

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramResult {
  channels: DeepgramChannel[];
}

interface DeepgramResponse {
  results: DeepgramResult;
  metadata: {
    duration: number;
    channels: number;
    models: string[];
  };
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  // Verify Deepgram API key is configured
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    logger.error('[STT] DEEPGRAM_API_KEY not configured');
    return NextResponse.json(
      { error: 'Service de transcription non configuré.' },
      { status: 503 }
    );
  }

  // Parse FormData
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Invalid form data. Send audio as FormData with field "audio".' },
      { status: 400 }
    );
  }

  const audioFile = formData.get('audio');
  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json(
      { error: 'Missing "audio" field in FormData.' },
      { status: 400 }
    );
  }

  // Validate file size
  if (audioFile.size > MAX_AUDIO_SIZE) {
    return NextResponse.json(
      { error: `Audio file too large. Maximum: ${MAX_AUDIO_SIZE / 1024 / 1024} MB.` },
      { status: 413 }
    );
  }

  if (audioFile.size === 0) {
    return NextResponse.json(
      { error: 'Audio file is empty.' },
      { status: 400 }
    );
  }

  // Validate MIME type (lenient: accept if type is provided and recognized)
  const mimeType = audioFile.type;
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    logger.warn('[STT] Unrecognized MIME type, proceeding anyway', { mimeType });
  }

  try {
    // Read audio bytes
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Build Deepgram request URL with query parameters
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'fr',          // French for Quebec insurance students
      smart_format: 'true',    // Punctuation, capitalization
      punctuate: 'true',
      diarize: 'false',        // Single speaker
      utterances: 'false',
    });

    const deepgramUrl = `${DEEPGRAM_API_URL}?${params.toString()}`;

    // FIX P4-10: AbortController with 60s timeout to prevent hanging requests
    const sttAbort = new AbortController();
    const sttTimeout = setTimeout(() => sttAbort.abort(), 60_000);

    // Send to Deepgram
    let deepgramResponse: Response;
    try {
      deepgramResponse = await fetch(deepgramUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': mimeType || 'audio/webm',
        },
        body: audioBuffer,
        signal: sttAbort.signal,
      });
    } finally {
      clearTimeout(sttTimeout);
    }

    if (!deepgramResponse.ok) {
      const errorBody = await deepgramResponse.text().catch(() => 'Unknown error');
      logger.error('[STT] Deepgram API error', {
        status: deepgramResponse.status,
        body: errorBody.slice(0, 500),
        userId: session.user.id,
      });

      if (deepgramResponse.status === 401 || deepgramResponse.status === 403) {
        return NextResponse.json(
          { error: 'Service de transcription: clé API invalide.' },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: 'Erreur lors de la transcription. Réessayez.' },
        { status: 502 }
      );
    }

    const data = (await deepgramResponse.json()) as DeepgramResponse;

    // Extract transcript from the first channel, first alternative
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const duration = data.metadata?.duration || 0;

    if (!transcript.trim()) {
      return NextResponse.json({
        text: '',
        confidence: 0,
        duration,
        warning: 'Aucune parole détectée dans l\'audio.',
      });
    }

    return NextResponse.json({
      text: transcript.trim(),
      confidence: Math.round(confidence * 100) / 100,
      duration: Math.round(duration * 100) / 100,
    });
  } catch (error) {
    // FIX P4-10: Distinguish timeout from other errors
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('[STT] Deepgram request timed out (60s)', { userId: session.user.id });
      return NextResponse.json(
        { error: 'Le service de transcription a expiré. Réessayez avec un fichier plus court.' },
        { status: 504 }
      );
    }

    logger.error('[STT] Transcription failed', {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Erreur interne lors de la transcription.' },
      { status: 500 }
    );
  }
}, { rateLimit: 10 });

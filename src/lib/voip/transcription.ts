/**
 * Call Transcription Service
 * Handles transcription of call recordings via Whisper (OpenAI API or local).
 * Creates AI summaries, sentiment analysis, and action item extraction.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptionResult {
  id: string;
  callLogId: string;
  fullText: string;
  summary: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  keywords: string[];
  actionItems: string | null;
}

// ---------------------------------------------------------------------------
// OpenAI client (lazy singleton per KB-PP-BUILD-002)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _openai: any = null;

function getOpenAI() {
  if (_openai) return _openai;
  // Dynamic require to avoid top-level crash
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { default: OpenAI } = require('openai');
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

/**
 * Transcribe a call recording and store results.
 */
export async function transcribeRecording(
  recordingId: string
): Promise<TranscriptionResult | null> {
  const recording = await prisma.callRecording.findUnique({
    where: { id: recordingId },
    include: {
      callLog: { select: { id: true } },
    },
  });

  if (!recording || !recording.blobUrl) {
    logger.warn(`[Transcription] Recording ${recordingId} not found or no blob URL`);
    return null;
  }

  // Check if already transcribed
  const existing = await prisma.callTranscription.findUnique({
    where: { recordingId },
  });
  if (existing) {
    return {
      id: existing.id,
      callLogId: existing.callLogId,
      fullText: existing.fullText,
      summary: existing.summary,
      sentiment: existing.sentiment,
      sentimentScore: existing.sentimentScore,
      keywords: existing.keywords,
      actionItems: existing.actionItems,
    };
  }

  try {
    // Step 1: Download audio from blob
    const audioResponse = await fetch(recording.blobUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    // Step 2: Transcribe via OpenAI Whisper
    const openai = getOpenAI();
    const audioFile = new File([audioBuffer], `recording.${recording.format}`, {
      type: recording.format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
    });

    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'text',
    });

    const fullText = typeof transcriptionResponse === 'string'
      ? transcriptionResponse
      : transcriptionResponse.text || '';

    if (!fullText.trim()) {
      logger.warn(`[Transcription] Empty transcription for ${recordingId}`);
      return null;
    }

    // Step 3: AI analysis (summary, sentiment, keywords, action items)
    const analysis = await analyzeTranscription(fullText);

    // Step 4: Store in DB
    const transcription = await prisma.callTranscription.create({
      data: {
        callLogId: recording.callLogId,
        recordingId: recording.id,
        fullText,
        summary: analysis.summary,
        actionItems: analysis.actionItems ? JSON.stringify(analysis.actionItems) : null,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        keywords: analysis.keywords,
        language: analysis.language || 'fr',
        engine: 'openai',
        model: 'whisper-1',
        confidence: analysis.confidence,
      },
    });

    // Mark recording as transcribed
    await prisma.callRecording.update({
      where: { id: recordingId },
      data: { isTranscribed: true },
    });

    logger.info(`[Transcription] Completed for recording ${recordingId}`);

    return {
      id: transcription.id,
      callLogId: transcription.callLogId,
      fullText: transcription.fullText,
      summary: transcription.summary,
      sentiment: transcription.sentiment,
      sentimentScore: transcription.sentimentScore,
      keywords: transcription.keywords,
      actionItems: transcription.actionItems,
    };
  } catch (error) {
    logger.error(`[Transcription] Failed for recording ${recordingId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI Analysis
// ---------------------------------------------------------------------------

interface AnalysisResult {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  keywords: string[];
  actionItems: string[] | null;
  language: string;
  confidence: number;
}

async function analyzeTranscription(text: string): Promise<AnalysisResult> {
  try {
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a call analysis assistant. Analyze the following call transcription and return a JSON object with:
- "summary": A 2-3 sentence summary of the call
- "sentiment": "positive", "neutral", or "negative"
- "sentimentScore": 0.0 to 1.0 (0=very negative, 1=very positive)
- "keywords": Array of 3-7 key topics/words
- "actionItems": Array of action items (or null if none)
- "language": ISO language code detected
- "confidence": 0.0 to 1.0 confidence in the analysis

Respond ONLY with valid JSON, no markdown.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      summary: parsed.summary || '',
      sentiment: parsed.sentiment || 'neutral',
      sentimentScore: parsed.sentimentScore ?? 0.5,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : null,
      language: parsed.language || 'fr',
      confidence: parsed.confidence ?? 0.7,
    };
  } catch (error) {
    logger.warn('[Transcription] AI analysis failed, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      summary: '',
      sentiment: 'neutral',
      sentimentScore: 0.5,
      keywords: [],
      actionItems: null,
      language: 'fr',
      confidence: 0,
    };
  }
}

/**
 * Process all recordings that need transcription.
 */
export async function processPendingTranscriptions(
  limit: number = 5
): Promise<number> {
  const pending = await prisma.callRecording.findMany({
    where: {
      isUploaded: true,
      isTranscribed: false,
      blobUrl: { not: null },
    },
    select: { id: true },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  let processed = 0;
  for (const rec of pending) {
    const result = await transcribeRecording(rec.id);
    if (result) processed++;
  }

  return processed;
}

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
        callLogId: recording.callLogId!,
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
 * Transcribe a video recording by extracting audio from the blob URL.
 * Video recordings are stored the same way as audio recordings in CallRecording.
 */
export async function transcribeVideoRecording(
  recordingId: string
): Promise<TranscriptionResult | null> {
  // Video recordings are stored as CallRecording with format = 'webm' or 'mp4'
  // The Whisper API can process audio tracks from video files directly
  return transcribeRecording(recordingId);
}

// ---------------------------------------------------------------------------
// Post-Call Summary
// ---------------------------------------------------------------------------

export interface CallSummaryOptions {
  includeActionItems?: boolean;
  includeSentiment?: boolean;
  language?: string;
}

export interface CallSummaryResult {
  summary: string;
  actionItems: string[];
  keyTopics: string[];
  sentiment: string;
  nextSteps: string[];
}

/**
 * Generate a structured AI summary from a full call transcription.
 *
 * Uses OpenAI GPT to produce:
 * - A concise summary of the call
 * - Extracted action items (tasks, follow-ups)
 * - Key topics discussed
 * - Overall sentiment assessment
 * - Recommended next steps
 *
 * Can optionally save the summary to a CrmActivity record if the call
 * is linked to a customer in the CRM.
 *
 * @param transcription - The full text transcription of the call
 * @param options - Configuration for summary generation
 * @returns Structured summary with action items, topics, sentiment, and next steps
 */
export async function generateCallSummary(
  transcription: string,
  options?: CallSummaryOptions
): Promise<CallSummaryResult> {
  const includeActionItems = options?.includeActionItems ?? true;
  const includeSentiment = options?.includeSentiment ?? true;
  const language = options?.language ?? 'fr';

  if (!transcription.trim()) {
    return {
      summary: '',
      actionItems: [],
      keyTopics: [],
      sentiment: 'neutral',
      nextSteps: [],
    };
  }

  // Build the prompt based on options
  const sections = [
    '"summary": A 2-4 sentence summary of the call in ' + language,
    '"keyTopics": Array of 3-7 key topics discussed',
  ];

  if (includeActionItems) {
    sections.push('"actionItems": Array of specific action items identified (tasks, promises, commitments)');
  }

  if (includeSentiment) {
    sections.push('"sentiment": Overall call sentiment - "positive", "neutral", or "negative"');
  }

  sections.push('"nextSteps": Array of recommended follow-up actions based on the conversation');

  const systemPrompt = `You are a call analysis assistant. Analyze the following call transcription and return a JSON object with:
${sections.map((s) => '- ' + s).join('\n')}

Be specific and actionable. Extract concrete details, not generic observations.
Respond ONLY with valid JSON, no markdown fences.`;

  try {
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcription },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const result: CallSummaryResult = {
      summary: parsed.summary || '',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
      sentiment: parsed.sentiment || 'neutral',
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    };

    logger.info('[Transcription] Call summary generated', {
      topicCount: result.keyTopics.length,
      actionItemCount: result.actionItems.length,
      sentiment: result.sentiment,
    });

    return result;
  } catch (error) {
    logger.warn('[Transcription] Call summary generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      summary: '',
      actionItems: [],
      keyTopics: [],
      sentiment: 'neutral',
      nextSteps: [],
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

/**
 * Transcription Pipeline
 * Processes call/conference recordings: extract audio → transcribe → AI analysis
 * Uses OpenAI Whisper for transcription and GPT-4o-mini for summarization.
 * Lazy-init pattern (KB-PP-BUILD-002)
 */

import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TranscriptionInput {
  recordingId: string;
  audioUrl: string;
  language?: string;
}

export interface TranscriptionResult {
  fullText: string;
  summary: string | null;
  actionItems: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  keywords: string[];
  language: string;
  engine: string;
  model: string;
  confidence: number | null;
}

// ─── Lazy OpenAI client ─────────────────────────────────────────────────────

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return key;
}

// ─── Pipeline Steps ─────────────────────────────────────────────────────────

/**
 * Step 1: Transcribe audio using OpenAI Whisper API
 */
async function transcribeAudio(
  audioUrl: string,
  language?: string
): Promise<{ text: string; language: string; confidence: number }> {
  const apiKey = getOpenAIKey();

  // Fetch audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
  }

  const audioBlob = await audioResponse.blob();
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  if (language) {
    formData.append('language', language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${errBody}`);
  }

  const result = await response.json();

  return {
    text: result.text || '',
    language: result.language || language || 'unknown',
    confidence: result.segments
      ? result.segments.reduce((sum: number, s: { avg_logprob: number }) => sum + Math.exp(s.avg_logprob), 0) / result.segments.length
      : 0.85,
  };
}

/**
 * Step 2: AI analysis (summary, sentiment, action items, keywords)
 */
async function analyzeTranscription(
  fullText: string,
  language: string
): Promise<{
  summary: string;
  actionItems: string[];
  sentiment: string;
  sentimentScore: number;
  keywords: string[];
}> {
  const apiKey = getOpenAIKey();

  const systemPrompt = `You are an AI assistant that analyzes call transcriptions.
Given a call transcription, provide:
1. A concise summary (2-3 sentences)
2. Action items extracted from the conversation (list)
3. Overall sentiment: "positive", "neutral", or "negative"
4. Sentiment score: 0.0 (very negative) to 1.0 (very positive)
5. Key topics/keywords (5-10 words)

Respond in JSON format:
{
  "summary": "...",
  "actionItems": ["item1", "item2"],
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0.75,
  "keywords": ["topic1", "topic2"]
}

The transcription language is: ${language}. Respond in the same language.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullText.slice(0, 8000) }, // Limit to ~8k chars
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    logger.warn('[transcription-pipeline] GPT analysis failed, returning defaults');
    return {
      summary: '',
      actionItems: [],
      sentiment: 'neutral',
      sentimentScore: 0.5,
      keywords: [],
    };
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || '',
      actionItems: parsed.actionItems || [],
      sentiment: parsed.sentiment || 'neutral',
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : 0.5,
      keywords: parsed.keywords || [],
    };
  } catch {
    logger.warn('[transcription-pipeline] Failed to parse GPT response');
    return {
      summary: content || '',
      actionItems: [],
      sentiment: 'neutral',
      sentimentScore: 0.5,
      keywords: [],
    };
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Run the full transcription pipeline:
 * audio URL → Whisper transcription → GPT-4o-mini analysis
 */
export async function runTranscriptionPipeline(
  input: TranscriptionInput
): Promise<TranscriptionResult> {
  logger.info('[transcription-pipeline] Starting', { recordingId: input.recordingId });

  // Step 1: Transcribe
  const transcription = await transcribeAudio(input.audioUrl, input.language);

  if (!transcription.text.trim()) {
    logger.warn('[transcription-pipeline] Empty transcription', { recordingId: input.recordingId });
    return {
      fullText: '',
      summary: null,
      actionItems: null,
      sentiment: null,
      sentimentScore: null,
      keywords: [],
      language: transcription.language,
      engine: 'whisper',
      model: 'whisper-1',
      confidence: transcription.confidence,
    };
  }

  // Step 2: Analyze
  const analysis = await analyzeTranscription(transcription.text, transcription.language);

  logger.info('[transcription-pipeline] Complete', {
    recordingId: input.recordingId,
    textLength: transcription.text.length,
    sentiment: analysis.sentiment,
  });

  return {
    fullText: transcription.text,
    summary: analysis.summary || null,
    actionItems: analysis.actionItems.length > 0 ? JSON.stringify(analysis.actionItems) : null,
    sentiment: analysis.sentiment,
    sentimentScore: analysis.sentimentScore,
    keywords: analysis.keywords,
    language: transcription.language,
    engine: 'whisper',
    model: 'whisper-1',
    confidence: transcription.confidence,
  };
}

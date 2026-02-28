/**
 * Video Highlights Extraction Service
 * Chantier 4.1: Analyze video transcripts to extract key moments.
 *
 * Uses AI (OpenAI) to identify highlights from a transcript,
 * returning timestamps and summaries for clip extraction.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoHighlight {
  id: string;
  videoId: string;
  title: string;
  summary: string;
  startTime: number; // seconds
  endTime: number;   // seconds
  confidence: number; // 0-1
  tags: string[];
}

interface HighlightExtractionResult {
  success: boolean;
  highlights?: VideoHighlight[];
  error?: string;
}

// ---------------------------------------------------------------------------
// AI-powered highlight extraction
// ---------------------------------------------------------------------------

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return key;
}

/**
 * Extract highlights from a video transcript using AI.
 */
export async function extractHighlights(
  videoId: string,
  transcript: string,
  options?: { maxHighlights?: number; minDuration?: number },
): Promise<HighlightExtractionResult> {
  const maxHighlights = options?.maxHighlights || 5;
  const minDuration = options?.minDuration || 15; // seconds

  if (!transcript || transcript.length < 100) {
    return { success: false, error: 'Transcript too short for highlight extraction' };
  }

  try {
    const apiKey = getOpenAIKey();

    const prompt = `Analyze this video transcript and identify the ${maxHighlights} most important/interesting moments.

For each highlight, provide:
- title: A short descriptive title (max 80 chars)
- summary: Brief explanation of why this is a highlight (max 200 chars)
- startTime: Estimated start time in seconds (based on word position in transcript)
- endTime: Estimated end time in seconds (at least ${minDuration}s duration)
- confidence: How confident you are this is a true highlight (0.0 to 1.0)
- tags: 2-3 relevant tags

Return a JSON array of highlights sorted by importance. Example:
[{"title":"Key Finding","summary":"Important research result","startTime":120,"endTime":180,"confidence":0.9,"tags":["research","results"]}]

TRANSCRIPT:
${transcript.slice(0, 15000)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a video content analyst. Return only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      return { success: false, error: `OpenAI API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'No response from AI' };
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { success: false, error: 'Failed to parse AI response as JSON' };
    }

    const rawHighlights = JSON.parse(jsonMatch[0]);
    const { randomUUID } = await import('crypto');

    const highlights: VideoHighlight[] = rawHighlights.map((h: {
      title: string;
      summary: string;
      startTime: number;
      endTime: number;
      confidence: number;
      tags: string[];
    }) => ({
      id: randomUUID(),
      videoId,
      title: String(h.title || '').slice(0, 80),
      summary: String(h.summary || '').slice(0, 200),
      startTime: Math.max(0, Number(h.startTime) || 0),
      endTime: Math.max(Number(h.startTime) + minDuration, Number(h.endTime) || 0),
      confidence: Math.min(1, Math.max(0, Number(h.confidence) || 0.5)),
      tags: Array.isArray(h.tags) ? h.tags.map(String).slice(0, 5) : [],
    }));

    logger.info(`[VideoHighlights] Extracted ${highlights.length} highlights for video ${videoId}`);

    return { success: true, highlights };
  } catch (error) {
    logger.error('[VideoHighlights] Extraction error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get highlights for a video. First checks if a transcript exists.
 */
export async function getVideoHighlights(videoId: string): Promise<HighlightExtractionResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, title: true, description: true },
  });

  if (!video) {
    return { success: false, error: 'Video not found' };
  }

  // Use description as a proxy for transcript (until transcript field is added)
  const text = video.description || '';
  if (text.length < 100) {
    return { success: false, error: 'No transcript available. Transcribe the video first.' };
  }

  return extractHighlights(videoId, text);
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processPendingTranscriptions } from '@/lib/voip/transcription';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/voip-transcriptions
 * Cron job to transcribe uploaded call recordings via OpenAI Whisper + GPT-4o-mini.
 *
 * Runs every 30 minutes. Picks uploaded but untranscribed recordings,
 * sends to Whisper for STT, then GPT-4o-mini for summary/sentiment/action items.
 *
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    );
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Skip if OpenAI not configured (transcription won't work)
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      skipped: true,
      reason: 'OPENAI_API_KEY not configured',
    });
  }

  return withJobLock('voip-transcriptions', async () => {
    try {
      const transcribed = await processPendingTranscriptions(5);

      logger.info('[Cron] voip-transcriptions completed', { transcribed });

      return NextResponse.json({
        success: true,
        transcribed,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Cron] voip-transcriptions failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Transcription processing failed' },
        { status: 500 }
      );
    }
  }, { maxDurationMs: 10 * 60 * 1000 }); // 10 min timeout (Whisper can be slow)
}

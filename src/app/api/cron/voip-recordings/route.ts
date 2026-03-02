export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processPendingRecordings } from '@/lib/voip/recording-upload';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/voip-recordings
 * Cron job to upload pending call recordings from PBX to Azure Blob Storage.
 *
 * Runs every 15 minutes. Fetches recordings from FusionPBX local storage,
 * uploads to Azure Blob, updates CallRecording records.
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

  return withJobLock('voip-recordings-upload', async () => {
    try {
      const uploaded = await processPendingRecordings(20);

      logger.info('[Cron] voip-recordings completed', { uploaded });

      return NextResponse.json({
        success: true,
        uploaded,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Cron] voip-recordings failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Recording processing failed' },
        { status: 500 }
      );
    }
  }, { maxDurationMs: 3 * 60 * 1000 }); // 3 min timeout
}

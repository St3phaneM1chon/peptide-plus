export const dynamic = 'force-dynamic';

/**
 * Social Scheduler Cron Endpoint
 * POST - Process all scheduled posts that are due
 *
 * Can be called by Vercel Cron, Azure Timer, or manually.
 * Optionally secured with a CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processScheduledPosts } from '@/lib/social/social-scheduler-cron';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Optional: verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await processScheduledPosts();
    return NextResponse.json(result);
  } catch (error) {
    logger.error('[SocialCron] Error:', error);
    return NextResponse.json({ error: 'Cron processing failed' }, { status: 500 });
  }
}

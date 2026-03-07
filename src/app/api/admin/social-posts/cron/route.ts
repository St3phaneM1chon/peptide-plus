export const dynamic = 'force-dynamic';

/**
 * Social Scheduler Cron Endpoint
 * POST - Process all scheduled posts that are due
 *
 * Can be called by Vercel Cron, Azure Timer, or manually by an admin.
 * Auth: Accepts EITHER a valid admin session (OWNER/EMPLOYEE) OR the CRON_SECRET Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { processScheduledPosts } from '@/lib/social/social-scheduler-cron';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // Allow cron secret OR admin session
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCronAuth) {
    const session = await auth();
    if (!session?.user?.id || !['OWNER', 'EMPLOYEE'].includes((session.user as any).role)) {
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

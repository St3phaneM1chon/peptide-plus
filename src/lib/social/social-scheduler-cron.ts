/**
 * Social Scheduler Cron
 * Processes scheduled posts that are due for publication.
 */

import { prisma } from '@/lib/db';
import { publishPost } from './social-publisher';
import { logger } from '@/lib/logger';

/**
 * Find all posts with status=scheduled AND scheduledAt <= now,
 * and publish each one.
 */
export async function processScheduledPosts(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date();

  const duePosts = await prisma.socialPost.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50, // process max 50 per cron run
  });

  let succeeded = 0;
  let failed = 0;

  for (const post of duePosts) {
    try {
      const result = await publishPost(post.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        logger.warn(`[SocialCron] Post ${post.id} failed: ${result.error}`);
      }
    } catch (error) {
      failed++;
      logger.error(`[SocialCron] Post ${post.id} unexpected error:`, error);
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unexpected error',
        },
      });
    }
  }

  logger.info(`[SocialCron] Processed ${duePosts.length} posts: ${succeeded} succeeded, ${failed} failed`);

  return { processed: duePosts.length, succeeded, failed };
}

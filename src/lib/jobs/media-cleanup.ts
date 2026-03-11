/**
 * MEDIA CLEANUP JOB PROCESSOR
 *
 * BullMQ job processor that performs the same logic as the existing
 * POST /api/cron/media-cleanup route:
 *
 * 1. Delete stale reviews-pending uploads (older than 24h)
 * 2. Find and delete orphan media files (older than 30 days)
 *
 * The existing cron route continues to work — this processor runs
 * the same logic but is triggered by BullMQ instead of an HTTP call.
 */

import type { Job } from 'bullmq';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';

/**
 * Process a media-cleanup job.
 *
 * Job data (optional):
 *   - dryRun: boolean — if true, only report what would be deleted
 *   - maxOrphans: number — limit on orphan files to process per run (default 50)
 *   - maxStalePending: number — limit on stale pending files per run (default 50)
 */
export async function processMediaCleanup(job: Job): Promise<void> {
  const dryRun = job.data?.dryRun === true;
  const maxOrphans = job.data?.maxOrphans ?? 50;
  const maxStalePending = job.data?.maxStalePending ?? 50;

  const startTime = Date.now();

  logger.info('[media-cleanup-job] Starting', {
    jobId: job.id,
    dryRun,
    maxOrphans,
    maxStalePending,
  });

  // -------------------------------------------------------------------------
  // 1. Clean up stale reviews-pending uploads (older than 24 hours)
  // -------------------------------------------------------------------------
  const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stalePending = await prisma.media.findMany({
    where: {
      folder: 'reviews-pending',
      createdAt: { lt: staleCutoff },
    },
    select: { id: true, url: true, size: true },
    take: maxStalePending,
  });

  let stalePendingBytesFreed = 0;
  let stalePendingDeleted = 0;

  if (!dryRun && stalePending.length > 0) {
    // Delete from storage first, collect IDs of successfully deleted files
    const successfullyDeletedIds: string[] = [];
    const storageDeleteResults = await Promise.allSettled(
      stalePending.map(async (media) => {
        await storage.delete(media.url);
        return media;
      })
    );

    for (const result of storageDeleteResults) {
      if (result.status === 'fulfilled') {
        successfullyDeletedIds.push(result.value.id);
        stalePendingBytesFreed += result.value.size;
      } else {
        logger.warn('[media-cleanup-job] Failed to delete stale pending media from storage', {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    // Batch delete all successfully removed media records
    if (successfullyDeletedIds.length > 0) {
      const { count } = await prisma.media.deleteMany({
        where: { id: { in: successfullyDeletedIds } },
      });
      stalePendingDeleted = count;
    }
  }

  // Report progress (BullMQ feature)
  await job.updateProgress(50);

  // -------------------------------------------------------------------------
  // 2. Find and clean up orphan media (older than 30 days)
  // -------------------------------------------------------------------------
  const orphans = await storage.findOrphanMedia(30, maxOrphans);
  const orphanBytesFreed = orphans.reduce((sum, o) => sum + o.size, 0);
  let orphansDeleted = 0;

  if (!dryRun && orphans.length > 0) {
    const orphanIds = orphans.map((o) => o.id);
    orphansDeleted = await storage.cleanupOrphanMedia(orphanIds);
  }

  await job.updateProgress(100);

  const duration = Date.now() - startTime;

  const result = {
    dryRun,
    duration: `${duration}ms`,
    stalePendingReviews: {
      found: stalePending.length,
      deleted: stalePendingDeleted,
      bytesFreed: stalePendingBytesFreed,
    },
    orphanMedia: {
      found: orphans.length,
      deleted: orphansDeleted,
      bytesFreed: orphanBytesFreed,
    },
    totalBytesFreed: stalePendingBytesFreed + orphanBytesFreed,
    totalMBFreed: ((stalePendingBytesFreed + orphanBytesFreed) / (1024 * 1024)).toFixed(2),
  };

  logger.info('[media-cleanup-job] Completed', {
    jobId: job.id,
    ...result,
  });

  // Store result on the job for later retrieval via admin API
  await job.updateData({ ...job.data, result });
}

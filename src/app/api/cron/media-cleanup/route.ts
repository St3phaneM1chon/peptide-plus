export const dynamic = 'force-dynamic';

/**
 * MEDIA CLEANUP CRON JOB (IMP-005)
 *
 * POST /api/cron/media-cleanup - Find and delete orphan media files
 * GET  /api/cron/media-cleanup - Health check / dry-run stats
 *
 * Orphan media: files in storage that are not referenced by any Product,
 * HeroSlide, Article, or other content entity, and are older than 30 days.
 *
 * Also cleans up 'reviews-pending' uploads older than 24 hours that were
 * never linked to a completed review.
 *
 * Authentication: Requires CRON_SECRET in Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET - Dry run / health check
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find orphan media (dry run)
    const orphans = await storage.findOrphanMedia(30, 100);

    // Find stale reviews-pending uploads (older than 24 hours)
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stalePending = await prisma.media.count({
      where: {
        folder: 'reviews-pending',
        createdAt: { lt: staleCutoff },
      },
    });

    // Total storage stats
    const totalStats = await prisma.media.aggregate({
      _sum: { size: true },
      _count: true,
    });

    return NextResponse.json({
      status: 'ok',
      dryRun: true,
      orphanMedia: {
        count: orphans.length,
        totalSizeBytes: orphans.reduce((sum, o) => sum + o.size, 0),
        sample: orphans.slice(0, 5).map(o => ({ id: o.id, url: o.url, size: o.size })),
      },
      stalePendingReviews: stalePending,
      totalStorage: {
        fileCount: totalStats._count,
        totalSizeBytes: totalStats._sum.size || 0,
        totalSizeMB: ((totalStats._sum.size || 0) / (1024 * 1024)).toFixed(1),
      },
    });
  } catch (error) {
    logger.error('Media cleanup GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to check orphan media' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST - Execute cleanup
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startTime = Date.now();

    // 1. Clean up stale reviews-pending uploads (older than 24 hours)
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stalePending = await prisma.media.findMany({
      where: {
        folder: 'reviews-pending',
        createdAt: { lt: staleCutoff },
      },
      select: { id: true, url: true, size: true },
      take: 50,
    });

    let stalePendingDeleted = 0;
    let stalePendingBytesFreed = 0;
    for (const media of stalePending) {
      try {
        await storage.delete(media.url);
        await prisma.media.delete({ where: { id: media.id } });
        stalePendingDeleted++;
        stalePendingBytesFreed += media.size;
      } catch (err) {
        logger.warn(`Failed to cleanup stale pending media ${media.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2. Find and clean up orphan media (older than 30 days)
    const orphans = await storage.findOrphanMedia(30, 50);
    const orphanIds = orphans.map(o => o.id);
    const orphanBytesFreed = orphans.reduce((sum, o) => sum + o.size, 0);
    const orphansDeleted = await storage.cleanupOrphanMedia(orphanIds);

    const duration = Date.now() - startTime;

    const result = {
      success: true,
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

    logger.info('Media cleanup completed', result);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Media cleanup POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to cleanup media' }, { status: 500 });
  }
}

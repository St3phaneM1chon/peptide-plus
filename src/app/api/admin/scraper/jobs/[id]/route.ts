export const dynamic = 'force-dynamic';

/**
 * Scraper Job Detail API
 * GET    /api/admin/scraper/jobs/[id] — Get job status/progress
 * DELETE /api/admin/scraper/jobs/[id] — Cancel a running job
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { cancelJob } from '../route';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const job = await prisma.scrapeJob.findUnique({
      where: { id },
      include: {
        prospectList: { select: { id: true, name: true, totalCount: true } },
      },
    });

    if (!job) {
      return apiError('Job not found', 'NOT_FOUND', { status: 404, request });
    }

    return apiSuccess(job, { request });
  } catch (error) {
    logger.error('[Scraper Job GET] Error fetching scrape job', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch scrape job', 'INTERNAL_ERROR', { status: 500, request });
  }
}, { rateLimit: 60 });

export const DELETE = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const job = await prisma.scrapeJob.findUnique({ where: { id } });
    if (!job) {
      return apiError('Job not found', 'NOT_FOUND', { status: 404, request });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return apiError('Cannot cancel a finished job', 'VALIDATION_ERROR', { status: 400, request });
    }

    // Abort the running scraper (real cancellation)
    cancelJob(id);

    await prisma.scrapeJob.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    return apiNoContent({ request });
  } catch (error) {
    logger.error('[Scraper Job DELETE] Error cancelling scrape job', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to cancel scrape job', 'INTERNAL_ERROR', { status: 500, request });
  }
}, { rateLimit: 10 });

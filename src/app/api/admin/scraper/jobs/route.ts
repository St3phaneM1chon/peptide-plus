export const dynamic = 'force-dynamic';

/**
 * Scraper Jobs API
 * POST /api/admin/scraper/jobs  — Create a new scrape job
 * GET  /api/admin/scraper/jobs  — List all jobs (paginated)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiPaginated, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Global map of active job AbortControllers for real cancellation
const activeJobControllers = new Map<string, AbortController>();

/** Get AbortSignal for a job, or undefined if not tracked */
export function getJobSignal(jobId: string): AbortSignal | undefined {
  return activeJobControllers.get(jobId)?.signal;
}

/** Cancel an active job by aborting its controller */
export function cancelJob(jobId: string): boolean {
  const controller = activeJobControllers.get(jobId);
  if (controller) {
    controller.abort();
    activeJobControllers.delete(jobId);
    return true;
  }
  return false;
}

const createJobSchema = z.object({
  query: z.string().min(1).max(500).trim(),
  engine: z.enum(['playwright', 'places_api']).optional().default('playwright'),
  region: z.object({
    type: z.enum(['circle', 'rectangle', 'polygon']),
    center: z.object({ lat: z.number(), lng: z.number() }).optional(),
    radius: z.number().optional(),
    bounds: z.object({
      north: z.number(), south: z.number(),
      east: z.number(), west: z.number(),
    }).optional(),
    path: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  }).optional().nullable(),
  maxResults: z.number().int().min(1).max(500).optional().default(100),
  crawlWebsites: z.boolean().optional().default(true),
  prospectListId: z.string().optional().nullable(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const data = parsed.data;

  // Get current user ID for createdById
  const { auth } = await import('@/lib/auth-config');
  const session = await auth();
  const userId = session?.user?.id;

  // Check concurrent job limit (max 3 running)
  const runningCount = await prisma.scrapeJob.count({ where: { status: 'running' } });
  if (runningCount >= 3) {
    return apiError(
      'Too many concurrent scrape jobs. Max 3 allowed.',
      'RATE_LIMIT',
      { status: 429, details: { running: runningCount, max: 3 }, request },
    );
  }

  // Verify prospect list exists if provided
  if (data.prospectListId) {
    const list = await prisma.prospectList.findUnique({ where: { id: data.prospectListId } });
    if (!list) {
      return apiError('Prospect list not found', 'NOT_FOUND', { status: 404, request });
    }
  }

  const job = await prisma.scrapeJob.create({
    data: {
      query: data.query,
      engine: data.engine,
      region: data.region as object ?? undefined,
      prospectListId: data.prospectListId ?? undefined,
      createdById: userId ?? undefined,
      status: 'pending',
    },
  });

  // Register AbortController for real cancellation
  const controller = new AbortController();
  activeJobControllers.set(job.id, controller);

  // Start the scrape in background (non-blocking)
  runScrapeJob(job.id, data, controller.signal).catch((err) => {
    logger.error('Background scrape job failed', { jobId: job.id, error: err instanceof Error ? err.message : String(err) });
  }).finally(() => {
    activeJobControllers.delete(job.id);
  });

  return apiSuccess(job, { status: 201, request });
}, { rateLimit: 10 });

export const GET = withAdminGuard(async (request: NextRequest) => {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const status = url.searchParams.get('status');

  // Auto-recover stale jobs: mark "running" jobs older than 30 min as "failed"
  const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);
  await prisma.scrapeJob.updateMany({
    where: { status: 'running', startedAt: { lt: staleThreshold } },
    data: { status: 'failed', errorLog: 'Timed out (stale job recovery)', completedAt: new Date() },
  });

  const where = status ? { status } : {};
  const [jobs, total] = await Promise.all([
    prisma.scrapeJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        prospectList: { select: { id: true, name: true } },
      },
    }),
    prisma.scrapeJob.count({ where }),
  ]);

  return apiPaginated(jobs, page, pageSize, total, { request });
}, { rateLimit: 30 });

// ---------------------------------------------------------------------------
// Background job execution
// ---------------------------------------------------------------------------

async function runScrapeJob(
  jobId: string,
  params: z.infer<typeof createJobSchema>,
  signal: AbortSignal,
) {
  try {
    // Check abort before starting
    if (signal.aborted) return;

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date(), progress: 5 },
    });

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { progress: 10 },
    });

    if (signal.aborted) {
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: { status: 'cancelled', completedAt: new Date() },
      });
      return;
    }

    // Phase 1: Scrape
    let results: Awaited<ReturnType<typeof import('@/lib/scraper/google-maps-playwright').scrapeGoogleMaps>>;

    if (params.engine === 'places_api') {
      const { searchGoogleMaps } = await import('@/lib/scraper/google-maps-standalone');
      results = await searchGoogleMaps({
        query: params.query,
        latitude: params.region?.center?.lat,
        longitude: params.region?.center?.lng,
        radius: params.region?.radius,
        maxResults: params.maxResults,
        crawlWebsites: params.crawlWebsites,
      });
    } else {
      const { scrapeGoogleMaps } = await import('@/lib/scraper/google-maps-playwright');
      results = await scrapeGoogleMaps({
        query: params.query,
        latitude: params.region?.center?.lat,
        longitude: params.region?.center?.lng,
        maxResults: params.maxResults,
        crawlWebsites: params.crawlWebsites,
      });
    }

    if (signal.aborted) {
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: { status: 'cancelled', totalFound: results.length, completedAt: new Date() },
      });
      return;
    }

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { totalFound: results.length, progress: 70 },
    });

    // Phase 2: Import to CRM if prospect list specified
    let imported = 0;
    let dupes = 0;
    if (params.prospectListId) {
      const { scrapePlacesToProspects } = await import('@/lib/crm/google-maps-scraper');
      const result = await scrapePlacesToProspects(params.prospectListId, {
        query: params.query,
        maxResults: params.maxResults,
        crawlWebsites: params.crawlWebsites,
        latitude: params.region?.center?.lat,
        longitude: params.region?.center?.lng,
      }, results);
      imported = result.added;
      dupes = result.duplicates;
    }

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        totalFound: results.length,
        totalImported: imported,
        totalDupes: dupes,
        progress: 100,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    if (signal.aborted) {
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: { status: 'cancelled', completedAt: new Date() },
      }).catch(() => {});
      return;
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Scrape job failed', { jobId, error: errorMessage });
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorLog: errorMessage,
        completedAt: new Date(),
      },
    }).catch(() => {});
  }
}

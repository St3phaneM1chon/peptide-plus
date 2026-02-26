export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import {
  executeBatchJob,
  createBatchJobSchema,
  BATCH_TYPES,
  BATCH_STATUSES,
  MAX_BATCH_SIZE,
  type BatchType,
} from '@/lib/accounting/batch-operations.service';

// ---------------------------------------------------------------------------
// GET /api/accounting/batch - List batch jobs with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 100);

    // Build where clause
    const where: Prisma.BatchJobWhereInput = {};

    if (type && BATCH_TYPES.includes(type as BatchType)) {
      where.type = type;
    }
    if (status && (BATCH_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [jobs, totalCount] = await Promise.all([
      prisma.batchJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          totalItems: true,
          processedItems: true,
          successItems: true,
          failedItems: true,
          createdBy: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      prisma.batchJob.count({ where }),
    ]);

    // Stats
    const [statusCounts, typeCounts] = await Promise.all([
      prisma.batchJob.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.batchJob.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
    ]);

    const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id]));
    const byType = Object.fromEntries(typeCounts.map((t) => [t.type, t._count.id]));

    return apiPaginated(
      jobs.map((j) => ({
        ...j,
        startedAt: j.startedAt?.toISOString() || null,
        completedAt: j.completedAt?.toISOString() || null,
        createdAt: j.createdAt.toISOString(),
      })),
      page,
      limit,
      totalCount,
      {
        request,
        headers: {
          'X-Batch-Stats': JSON.stringify({ byStatus, byType }),
        },
      }
    );
  } catch (error) {
    logger.error('Error listing batch jobs', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la récupération des jobs batch', 'INTERNAL_ERROR', { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/batch - Create and execute a batch job
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createBatchJobSchema.safeParse(body);

    if (!parsed.success) {
      const errorDetails = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return apiError(`Données invalides: ${errorDetails}`, 'VALIDATION_ERROR', { status: 400 });
    }

    const { type, items } = parsed.data;

    if (items.length > MAX_BATCH_SIZE) {
      return apiError(
        `Maximum ${MAX_BATCH_SIZE} éléments par lot (reçu: ${items.length})`,
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    logger.info('Starting batch job', {
      type,
      itemCount: items.length,
      user: session.user?.email,
    });

    const summary = await executeBatchJob(
      type as BatchType,
      items,
      session.user?.email || null
    );

    return apiSuccess(summary, { status: 201 });
  } catch (error) {
    logger.error('Error executing batch job', { error: error instanceof Error ? error.message : String(error) });
    return apiError(
      error instanceof Error ? error.message : 'Erreur lors de l\'exécution du job batch',
      'INTERNAL_ERROR',
      { status: 500 }
    );
  }
});

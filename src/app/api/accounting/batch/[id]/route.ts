export const dynamic = 'force-dynamic';

import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// GET /api/accounting/batch/[id] - Batch job details with results
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;

    if (!id || typeof id !== 'string') {
      return apiError('ID requis', 'VALIDATION_ERROR', { status: 400 });
    }

    const job = await prisma.batchJob.findUnique({
      where: { id },
    });

    if (!job) {
      return apiError('Job batch introuvable', 'NOT_FOUND', { status: 404 });
    }

    // Parse JSON fields
    let resultData = null;
    let errorLog = null;
    let inputData = null;

    try {
      if (job.resultData) resultData = JSON.parse(job.resultData);
    } catch { /* ignore parse errors */ }

    try {
      if (job.errorLog) errorLog = JSON.parse(job.errorLog);
    } catch { /* ignore parse errors */ }

    try {
      if (job.inputData) inputData = JSON.parse(job.inputData);
    } catch { /* ignore parse errors */ }

    return apiSuccess({
      id: job.id,
      type: job.type,
      status: job.status,
      totalItems: job.totalItems,
      processedItems: job.processedItems,
      successItems: job.successItems,
      failedItems: job.failedItems,
      inputData,
      resultData,
      errorLog,
      createdBy: job.createdBy,
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      durationMs: job.startedAt && job.completedAt
        ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
        : null,
    });
  } catch (error) {
    logger.error('Error fetching batch job details', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la récupération des détails du job', 'INTERNAL_ERROR', { status: 500 });
  }
});

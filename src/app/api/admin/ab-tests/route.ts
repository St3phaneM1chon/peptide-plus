export const dynamic = 'force-dynamic';

/**
 * Admin A/B Tests API
 * GET    - List all A/B tests
 * POST   - Create a new A/B test
 * PUT    - Update an A/B test
 * DELETE - Delete an A/B test
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const variantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.string(),
  trafficPercent: z.number().min(0).max(100),
});

const createTestSchema = z.object({
  name: z.string().min(1).max(200),
  pageUrl: z.string().min(1).max(500),
  variants: z.array(variantSchema).min(2).max(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).strict();

const updateTestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional(),
  variants: z.array(variantSchema).min(2).max(10).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  winnerId: z.string().nullable().optional(),
}).strict();

const deleteSchema = z.object({
  id: z.string().min(1),
}).strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function computeMetrics(testId: string) {
  const impressions = await prisma.abTestImpression.groupBy({
    by: ['variantId'],
    where: { testId },
    _count: { id: true },
  });

  const conversions = await prisma.abTestImpression.groupBy({
    by: ['variantId'],
    where: { testId, converted: true },
    _count: { id: true },
  });

  const metrics: Record<string, { impressions: number; conversions: number; conversionRate: number }> = {};

  for (const imp of impressions) {
    const conv = conversions.find(c => c.variantId === imp.variantId);
    const impCount = imp._count.id;
    const convCount = conv?._count.id || 0;
    metrics[imp.variantId] = {
      impressions: impCount,
      conversions: convCount,
      conversionRate: impCount > 0 ? Math.round((convCount / impCount) * 10000) / 100 : 0,
    };
  }

  return metrics;
}

// ---------------------------------------------------------------------------
// GET /api/admin/ab-tests
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const where = status ? { status } : {};

    const [tests, total] = await Promise.all([
      prisma.abTest.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.abTest.count({ where }),
    ]);

    // Compute live metrics for running tests
    const testsWithMetrics = await Promise.all(
      tests.map(async (test) => {
        if (test.status === 'running' || test.status === 'completed') {
          const metrics = await computeMetrics(test.id);
          return { ...test, metrics };
        }
        return test;
      })
    );

    return NextResponse.json({ tests: testsWithMetrics, total, page, limit });
  } catch (error) {
    logger.error('AB tests GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/ab-tests - Create
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, pageUrl, variants, startDate, endDate } = parsed.data;

    // Validate traffic percentages sum to 100
    const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (totalTraffic !== 100) {
      return NextResponse.json({ error: 'Variant traffic percentages must sum to 100' }, { status: 400 });
    }

    const test = await prisma.abTest.create({
      data: {
        name,
        pageUrl,
        variants: JSON.parse(JSON.stringify(variants)),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    await logAdminAction({
      adminUserId: session?.user?.id || 'system',
      action: 'AB_TEST_CREATE',
      targetType: 'AbTest',
      targetId: test.id,
      metadata: { name, pageUrl, variantCount: variants.length },
      ipAddress: getClientIpFromRequest(request),
    });

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    logger.error('AB tests POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/ab-tests - Update
// ---------------------------------------------------------------------------
export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = updateTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { id, variants, startDate, endDate, ...rest } = parsed.data;

    const existing = await prisma.abTest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Validate traffic percentages if variants are updated
    if (variants) {
      const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
      if (totalTraffic !== 100) {
        return NextResponse.json({ error: 'Variant traffic percentages must sum to 100' }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...rest };
    if (variants) updateData.variants = JSON.parse(JSON.stringify(variants));
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    // When starting a test, set startDate if not already set
    if (rest.status === 'running' && !existing.startDate && !startDate) {
      updateData.startDate = new Date();
    }

    // When completing a test, compute final metrics
    if (rest.status === 'completed') {
      const metrics = await computeMetrics(id);
      updateData.metrics = metrics;
      if (!updateData.endDate) updateData.endDate = new Date();
    }

    const test = await prisma.abTest.update({ where: { id }, data: updateData });

    await logAdminAction({
      adminUserId: session?.user?.id || 'system',
      action: 'AB_TEST_UPDATE',
      targetType: 'AbTest',
      targetId: id,
      metadata: { status: rest.status },
      ipAddress: getClientIpFromRequest(request),
    });

    return NextResponse.json({ test });
  } catch (error) {
    logger.error('AB tests PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/ab-tests
// ---------------------------------------------------------------------------
export const DELETE = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { id } = parsed.data;

    const existing = await prisma.abTest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    // Cascade delete via Prisma relation handles impressions
    await prisma.abTest.delete({ where: { id } });

    await logAdminAction({
      adminUserId: session?.user?.id || 'system',
      action: 'AB_TEST_DELETE',
      targetType: 'AbTest',
      targetId: id,
      metadata: { name: existing.name },
      ipAddress: getClientIpFromRequest(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('AB tests DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

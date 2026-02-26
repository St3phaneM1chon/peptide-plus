export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  budget: z.number().min(0).optional().nullable(),
  budgetAmount: z.number().min(0).optional().nullable(),
  defaultRate: z.number().min(0).optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'ARCHIVED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// Helper to extract route param id from URL
function extractId(request: NextRequest): string {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  return segments[segments.length - 1];
}

// ---------------------------------------------------------------------------
// GET /api/accounting/time-tracking/projects/[id]
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);

    const project = await prisma.timeProject.findFirst({
      where: { id, deletedAt: null },
    });

    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    // Get hours used
    const agg = await prisma.timeEntry.aggregate({
      where: { projectName: project.name, deletedAt: null },
      _sum: { hoursWorked: true },
      _count: true,
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        description: project.description,
        clientName: project.clientName,
        budget: project.budget ? Number(project.budget) : null,
        budgetAmount: project.budgetAmount ? Number(project.budgetAmount) : null,
        defaultRate: project.defaultRate ? Number(project.defaultRate) : null,
        status: project.status,
        startDate: project.startDate?.toISOString().split('T')[0] ?? null,
        endDate: project.endDate?.toISOString().split('T')[0] ?? null,
        hoursUsed: Math.round((Number(agg._sum.hoursWorked) || 0) * 100) / 100,
        entryCount: agg._count,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching time project', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation du projet' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/time-tracking/projects/[id]
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);
    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.timeProject.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const data = parsed.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.clientName !== undefined) updateData.clientName = data.clientName;
    if (data.budget !== undefined) updateData.budget = data.budget;
    if (data.budgetAmount !== undefined) updateData.budgetAmount = data.budgetAmount;
    if (data.defaultRate !== undefined) updateData.defaultRate = data.defaultRate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    const updated = await prisma.timeProject.update({
      where: { id },
      data: updateData,
    });

    logger.info('Time project updated', { projectId: id, changes: Object.keys(updateData) });

    return NextResponse.json({
      success: true,
      project: {
        id: updated.id,
        name: updated.name,
        code: updated.code,
        description: updated.description,
        clientName: updated.clientName,
        budget: updated.budget ? Number(updated.budget) : null,
        budgetAmount: updated.budgetAmount ? Number(updated.budgetAmount) : null,
        defaultRate: updated.defaultRate ? Number(updated.defaultRate) : null,
        status: updated.status,
        startDate: updated.startDate?.toISOString().split('T')[0] ?? null,
        endDate: updated.endDate?.toISOString().split('T')[0] ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error updating time project', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour du projet' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/time-tracking/projects/[id]
// Soft delete
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    const id = extractId(request);

    const existing = await prisma.timeProject.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    await prisma.timeProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Time project deleted (soft)', { projectId: id, code: existing.code });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting time project', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du projet' },
      { status: 500 }
    );
  }
});

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createMilestoneSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  amount: z.number().min(0).optional().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('PENDING'),
  sortOrder: z.number().int().min(0).optional().default(0),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  amount: z.number().min(0).optional().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapMilestoneToJson(m: Record<string, unknown>) {
  return {
    ...m,
    amount: m.amount ? Number(m.amount) : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/accounting/project-costing/[id]/milestones
// List milestones for a project
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    const project = await prisma.costProject.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });

    const totalAmount = milestones.reduce((sum, m) => sum + (m.amount ? Number(m.amount) : 0), 0);
    const completedAmount = milestones
      .filter((m) => m.status === 'COMPLETED')
      .reduce((sum, m) => sum + (m.amount ? Number(m.amount) : 0), 0);

    return NextResponse.json({
      milestones: milestones.map(mapMilestoneToJson),
      summary: {
        total: milestones.length,
        pending: milestones.filter((m) => m.status === 'PENDING').length,
        inProgress: milestones.filter((m) => m.status === 'IN_PROGRESS').length,
        completed: milestones.filter((m) => m.status === 'COMPLETED').length,
        cancelled: milestones.filter((m) => m.status === 'CANCELLED').length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        completedAmount: Math.round(completedAmount * 100) / 100,
      },
    });
  } catch (error) {
    logger.error('Get project milestones error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des jalons' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/project-costing/[id]/milestones
// Create milestone
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    const project = await prisma.costProject.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createMilestoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId,
        name: data.name,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        amount: data.amount ?? null,
        status: data.status,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    logger.info('Project milestone created', {
      milestoneId: milestone.id,
      projectId,
      name: milestone.name,
    });

    return NextResponse.json(
      { success: true, milestone: mapMilestoneToJson(milestone) },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create project milestone error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation du jalon' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/project-costing/[id]/milestones
// Update a milestone (milestone ID passed in body)
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    const body = await request.json();
    const milestoneId = body.milestoneId;
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId requis' }, { status: 400 });
    }

    const parsed = updateMilestoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Jalon non trouve' }, { status: 404 });
    }

    const data = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    // Set completedAt when status changes to COMPLETED
    if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      updateData.completedAt = new Date();
    }
    if (data.status && data.status !== 'COMPLETED') {
      updateData.completedAt = null;
    }

    const milestone = await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: updateData,
    });

    logger.info('Project milestone updated', {
      milestoneId: milestone.id,
      projectId,
    });

    return NextResponse.json({ success: true, milestone: mapMilestoneToJson(milestone) });
  } catch (error) {
    logger.error('Update project milestone error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour du jalon' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/project-costing/[id]/milestones
// Delete a milestone (milestone ID in query param)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId requis' }, { status: 400 });
    }

    const existing = await prisma.projectMilestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Jalon non trouve' }, { status: 404 });
    }

    await prisma.projectMilestone.delete({
      where: { id: milestoneId },
    });

    logger.info('Project milestone deleted', {
      milestoneId,
      projectId,
    });

    return NextResponse.json({ success: true, message: 'Jalon supprime' });
  } catch (error) {
    logger.error('Delete project milestone error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du jalon' },
      { status: 500 }
    );
  }
});

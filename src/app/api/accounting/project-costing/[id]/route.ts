export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  clientEmail: z.string().email().optional().nullable(),
  projectManager: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budgetHours: z.number().min(0).optional().nullable(),
  budgetAmount: z.number().min(0).optional().nullable(),
  billingMethod: z.enum(['FIXED', 'TIME_AND_MATERIALS', 'RETAINER']).optional(),
  fixedPrice: z.number().min(0).optional().nullable(),
  retainerAmount: z.number().min(0).optional().nullable(),
  retainerPeriod: z.enum(['MONTHLY', 'QUARTERLY']).optional().nullable(),
  defaultRate: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapProjectToJson(p: Record<string, unknown>) {
  return {
    ...p,
    budgetHours: p.budgetHours ? Number(p.budgetHours) : null,
    budgetAmount: p.budgetAmount ? Number(p.budgetAmount) : null,
    fixedPrice: p.fixedPrice ? Number(p.fixedPrice) : null,
    retainerAmount: p.retainerAmount ? Number(p.retainerAmount) : null,
    defaultRate: p.defaultRate ? Number(p.defaultRate) : null,
  };
}

function mapCostEntryToJson(e: Record<string, unknown>) {
  return {
    ...e,
    quantity: Number(e.quantity),
    unitCost: Number(e.unitCost),
    totalCost: Number(e.totalCost),
    billableAmount: Number(e.billableAmount),
  };
}

function mapMilestoneToJson(m: Record<string, unknown>) {
  return {
    ...m,
    amount: m.amount ? Number(m.amount) : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/accounting/project-costing/[id]
// Full project with costs, milestones, and budget analysis
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const project = await prisma.costProject.findFirst({
      where: { id, deletedAt: null },
      include: {
        costEntries: { orderBy: { date: 'desc' } },
        milestones: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    // Calculate budget analysis
    const totalCost = project.costEntries.reduce((sum, e) => sum + Number(e.totalCost), 0);
    const totalBillable = project.costEntries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + Number(e.billableAmount), 0);
    const totalBilled = project.costEntries
      .filter((e) => e.invoiceId)
      .reduce((sum, e) => sum + Number(e.billableAmount), 0);

    // Costs by type
    const costsByType: Record<string, number> = {};
    for (const entry of project.costEntries) {
      costsByType[entry.type] = (costsByType[entry.type] || 0) + Number(entry.totalCost);
    }

    // Labor hours
    const laborEntries = project.costEntries.filter((e) => e.type === 'LABOR');
    const totalHours = laborEntries.reduce((sum, e) => sum + Number(e.quantity), 0);
    const budgetHours = project.budgetHours ? Number(project.budgetHours) : 0;
    const budgetAmount = project.budgetAmount ? Number(project.budgetAmount) : 0;
    const budgetUsedPct = budgetAmount > 0 ? Math.round((totalCost / budgetAmount) * 100) : 0;
    const hoursUsedPct = budgetHours > 0 ? Math.round((totalHours / budgetHours) * 100) : 0;

    // Revenue
    let revenue = 0;
    if (project.billingMethod === 'FIXED' && project.fixedPrice) {
      revenue = Number(project.fixedPrice);
    } else if (project.billingMethod === 'TIME_AND_MATERIALS') {
      revenue = totalBillable;
    } else if (project.billingMethod === 'RETAINER' && project.retainerAmount) {
      revenue = Number(project.retainerAmount);
    }

    const profitability = revenue > 0
      ? Math.round(((revenue - totalCost) / revenue) * 10000) / 100
      : 0;

    const { costEntries, milestones, ...projectData } = project;

    return NextResponse.json({
      project: mapProjectToJson(projectData),
      costEntries: costEntries.map(mapCostEntryToJson),
      milestones: milestones.map(mapMilestoneToJson),
      budgetAnalysis: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalBillable: Math.round(totalBillable * 100) / 100,
        totalBilled: Math.round(totalBilled * 100) / 100,
        unbilledAmount: Math.round((totalBillable - totalBilled) * 100) / 100,
        budgetAmount,
        budgetUsedPct,
        budgetHours,
        totalHours: Math.round(totalHours * 100) / 100,
        hoursUsedPct,
        revenue: Math.round(revenue * 100) / 100,
        profitability,
        costsByType,
      },
    });
  } catch (error) {
    logger.error('Get cost project detail error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation du projet' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/project-costing/[id]
// Update project
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.costProject.findFirst({
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
    if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail;
    if (data.projectManager !== undefined) updateData.projectManager = data.projectManager;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.billingMethod !== undefined) updateData.billingMethod = data.billingMethod;
    if (data.budgetHours !== undefined) updateData.budgetHours = data.budgetHours;
    if (data.budgetAmount !== undefined) updateData.budgetAmount = data.budgetAmount;
    if (data.fixedPrice !== undefined) updateData.fixedPrice = data.fixedPrice;
    if (data.retainerAmount !== undefined) updateData.retainerAmount = data.retainerAmount;
    if (data.retainerPeriod !== undefined) updateData.retainerPeriod = data.retainerPeriod;
    if (data.defaultRate !== undefined) updateData.defaultRate = data.defaultRate;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    }

    const project = await prisma.costProject.update({
      where: { id },
      data: updateData,
    });

    logger.info('Cost project updated', {
      projectId: project.id,
      code: project.code,
    });

    return NextResponse.json({ success: true, project: mapProjectToJson(project) });
  } catch (error) {
    logger.error('Update cost project error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour du projet' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/project-costing/[id]
// Soft delete
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.costProject.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    await prisma.costProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Cost project soft-deleted', {
      projectId: id,
      code: existing.code,
    });

    return NextResponse.json({ success: true, message: 'Projet supprime' });
  } catch (error) {
    logger.error('Delete cost project error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du projet' },
      { status: 500 }
    );
  }
});

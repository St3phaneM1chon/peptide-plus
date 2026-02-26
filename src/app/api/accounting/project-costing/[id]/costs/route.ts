export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createCostEntrySchema = z.object({
  type: z.enum(['LABOR', 'EXPENSE', 'MATERIAL', 'SUBCONTRACTOR', 'OVERHEAD']),
  description: z.string().min(1, 'La description est requise'),
  date: z.string().optional(),
  quantity: z.number().min(0).default(1),
  unitCost: z.number().min(0),
  billableAmount: z.number().min(0).optional().default(0),
  isBillable: z.boolean().optional().default(true),
  employeeId: z.string().optional().nullable(),
  employeeName: z.string().optional().nullable(),
  timeEntryId: z.string().optional().nullable(),
  expenseId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCostEntryToJson(e: Record<string, unknown>) {
  return {
    ...e,
    quantity: Number(e.quantity),
    unitCost: Number(e.unitCost),
    totalCost: Number(e.totalCost),
    billableAmount: Number(e.billableAmount),
  };
}

// ---------------------------------------------------------------------------
// GET /api/accounting/project-costing/[id]/costs
// List cost entries for a project
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    // Verify project exists
    const project = await prisma.costProject.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const type = searchParams.get('type');
    const isBillable = searchParams.get('isBillable');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const employeeId = searchParams.get('employeeId');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { projectId };

    if (type) where.type = type;
    if (employeeId) where.employeeId = employeeId;
    if (isBillable === 'true') where.isBillable = true;
    if (isBillable === 'false') where.isBillable = false;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const [entries, total] = await Promise.all([
      prisma.projectCostEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.projectCostEntry.count({ where }),
    ]);

    // Summary totals
    const allEntries = await prisma.projectCostEntry.findMany({
      where: { projectId },
      select: { totalCost: true, billableAmount: true, isBillable: true, invoiceId: true, type: true },
    });

    const totalCost = allEntries.reduce((sum, e) => sum + Number(e.totalCost), 0);
    const totalBillable = allEntries.filter((e) => e.isBillable).reduce((sum, e) => sum + Number(e.billableAmount), 0);
    const totalBilled = allEntries.filter((e) => e.invoiceId).reduce((sum, e) => sum + Number(e.billableAmount), 0);

    return NextResponse.json({
      entries: entries.map(mapCostEntryToJson),
      summary: {
        totalCost: Math.round(totalCost * 100) / 100,
        totalBillable: Math.round(totalBillable * 100) / 100,
        totalBilled: Math.round(totalBilled * 100) / 100,
        unbilledAmount: Math.round((totalBillable - totalBilled) * 100) / 100,
        entryCount: allEntries.length,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get project cost entries error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des couts' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/project-costing/[id]/costs
// Add cost entry (manual or linked to time/expense)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    // Verify project exists and is active
    const project = await prisma.costProject.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createCostEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const totalCost = Math.round(data.quantity * data.unitCost * 100) / 100;

    // If linked to a time entry, verify it exists
    if (data.timeEntryId) {
      const timeEntry = await prisma.timeEntry.findFirst({
        where: { id: data.timeEntryId, deletedAt: null },
      });
      if (!timeEntry) {
        return NextResponse.json(
          { error: 'Entree de temps non trouvee' },
          { status: 404 }
        );
      }
    }

    // If linked to an expense, verify it exists
    if (data.expenseId) {
      const expense = await prisma.expense.findFirst({
        where: { id: data.expenseId, deletedAt: null },
      });
      if (!expense) {
        return NextResponse.json(
          { error: 'Depense non trouvee' },
          { status: 404 }
        );
      }
    }

    const entry = await prisma.projectCostEntry.create({
      data: {
        projectId,
        type: data.type,
        description: data.description,
        date: data.date ? new Date(data.date) : new Date(),
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost,
        billableAmount: data.billableAmount ?? 0,
        isBillable: data.isBillable,
        employeeId: data.employeeId || null,
        employeeName: data.employeeName || null,
        timeEntryId: data.timeEntryId || null,
        expenseId: data.expenseId || null,
        notes: data.notes || null,
      },
    });

    logger.info('Project cost entry created', {
      entryId: entry.id,
      projectId,
      type: entry.type,
      totalCost: Number(entry.totalCost),
    });

    return NextResponse.json(
      { success: true, entry: mapCostEntryToJson(entry) },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create project cost entry error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation du cout' },
      { status: 500 }
    );
  }
});

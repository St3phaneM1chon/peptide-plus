export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createPayrollRunSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  notes: z.string().max(2000).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll
// List payroll runs with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = { deletedAt: null };

    if (status) {
      where.status = status;
    }
    if (dateFrom) {
      where.periodStart = { ...(where.periodStart as object || {}), gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.periodEnd = { ...(where.periodEnd as object || {}), lte: new Date(dateTo) };
    }

    const [runs, total] = await Promise.all([
      prisma.payrollRun.findMany({
        where,
        include: {
          entries: {
            select: { id: true, employeeId: true, grossPay: true, netPay: true },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payrollRun.count({ where }),
    ]);

    const mapped = runs.map((r) => ({
      id: r.id,
      runDate: r.runDate.toISOString().split('T')[0],
      periodStart: r.periodStart.toISOString().split('T')[0],
      periodEnd: r.periodEnd.toISOString().split('T')[0],
      payDate: r.payDate.toISOString().split('T')[0],
      status: r.status,
      totalGross: Number(r.totalGross),
      totalDeductions: Number(r.totalDeductions),
      totalNet: Number(r.totalNet),
      totalEmployerCost: Number(r.totalEmployerCost),
      employeeCount: r.entries.length,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({
      runs: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching payroll runs', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des cycles de paie' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/payroll
// Create a new payroll run (DRAFT)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createPayrollRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd, payDate, notes } = parsed.data;

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const pay = new Date(payDate);

    if (end <= start) {
      return NextResponse.json(
        { error: 'La date de fin doit etre apres la date de debut' },
        { status: 400 }
      );
    }
    if (pay < end) {
      return NextResponse.json(
        { error: 'La date de paiement doit etre egale ou apres la fin de periode' },
        { status: 400 }
      );
    }

    // Check for overlapping payroll runs
    const overlapping = await prisma.payrollRun.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { periodStart: { lte: end }, periodEnd: { gte: start } },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: `Un cycle de paie existant chevauche cette periode (${overlapping.id})` },
        { status: 409 }
      );
    }

    const run = await prisma.payrollRun.create({
      data: {
        runDate: new Date(),
        periodStart: start,
        periodEnd: end,
        payDate: pay,
        status: 'DRAFT',
        notes: notes || null,
      },
    });

    logger.info('Payroll run created', {
      payrollRunId: run.id,
      periodStart,
      periodEnd,
      payDate,
    });

    return NextResponse.json(
      {
        success: true,
        run: {
          id: run.id,
          runDate: run.runDate.toISOString().split('T')[0],
          periodStart: run.periodStart.toISOString().split('T')[0],
          periodEnd: run.periodEnd.toISOString().split('T')[0],
          payDate: run.payDate.toISOString().split('T')[0],
          status: run.status,
          totalGross: 0,
          totalDeductions: 0,
          totalNet: 0,
          totalEmployerCost: 0,
          employeeCount: 0,
          notes: run.notes,
          createdAt: run.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating payroll run', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation du cycle de paie' },
      { status: 500 }
    );
  }
});

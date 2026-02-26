export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updatePayrollRunSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll/[id]
// Get a single payroll run with its entries
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                province: true,
                payFrequency: true,
                employmentType: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run || run.deletedAt) {
      return NextResponse.json({ error: 'Cycle de paie non trouve' }, { status: 404 });
    }

    return NextResponse.json({
      run: {
        id: run.id,
        runDate: run.runDate.toISOString().split('T')[0],
        periodStart: run.periodStart.toISOString().split('T')[0],
        periodEnd: run.periodEnd.toISOString().split('T')[0],
        payDate: run.payDate.toISOString().split('T')[0],
        status: run.status,
        totalGross: Number(run.totalGross),
        totalDeductions: Number(run.totalDeductions),
        totalNet: Number(run.totalNet),
        totalEmployerCost: Number(run.totalEmployerCost),
        journalEntryId: run.journalEntryId,
        approvedBy: run.approvedBy,
        approvedAt: run.approvedAt?.toISOString() ?? null,
        notes: run.notes,
        createdAt: run.createdAt.toISOString(),
        entries: run.entries.map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          employee: e.employee,
          hoursWorked: Number(e.hoursWorked),
          overtimeHours: Number(e.overtimeHours),
          grossPay: Number(e.grossPay),
          cppContribution: Number(e.cppContribution),
          eiPremium: Number(e.eiPremium),
          federalTax: Number(e.federalTax),
          provincialTax: Number(e.provincialTax),
          qpipPremium: Number(e.qpipPremium),
          employerCpp: Number(e.employerCpp),
          employerEi: Number(e.employerEi),
          employerQpip: Number(e.employerQpip),
          employerHst: Number(e.employerHst),
          employerWcb: Number(e.employerWcb),
          vacationPay: Number(e.vacationPay),
          otherDeductions: Number(e.otherDeductions),
          otherBenefits: Number(e.otherBenefits),
          otherDeductionsDesc: e.otherDeductionsDesc,
          otherBenefitsDesc: e.otherBenefitsDesc,
          totalDeductions: Number(e.totalDeductions),
          netPay: Number(e.netPay),
          totalEmployerCost: Number(e.totalEmployerCost),
          notes: e.notes,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching payroll run', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation du cycle de paie' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/payroll/[id]
// Update a payroll run (only DRAFT status)
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.payrollRun.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Cycle de paie non trouve' }, { status: 404 });
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seuls les cycles en brouillon peuvent etre modifies' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = updatePayrollRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.periodStart) data.periodStart = new Date(parsed.data.periodStart);
    if (parsed.data.periodEnd) data.periodEnd = new Date(parsed.data.periodEnd);
    if (parsed.data.payDate) data.payDate = new Date(parsed.data.payDate);
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

    const updated = await prisma.payrollRun.update({
      where: { id },
      data,
    });

    logger.info('Payroll run updated', { payrollRunId: id });

    return NextResponse.json({
      success: true,
      run: {
        id: updated.id,
        periodStart: updated.periodStart.toISOString().split('T')[0],
        periodEnd: updated.periodEnd.toISOString().split('T')[0],
        payDate: updated.payDate.toISOString().split('T')[0],
        status: updated.status,
        notes: updated.notes,
      },
    });
  } catch (error) {
    logger.error('Error updating payroll run', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour du cycle de paie' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/payroll/[id]
// Soft-delete a payroll run (only DRAFT status)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.payrollRun.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Cycle de paie non trouve' }, { status: 404 });
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seuls les cycles en brouillon peuvent etre supprimes' },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.payrollEntry.deleteMany({ where: { payrollRunId: id } }),
      prisma.payrollRun.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);

    logger.info('Payroll run deleted', { payrollRunId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting payroll run', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du cycle de paie' },
      { status: 500 }
    );
  }
});

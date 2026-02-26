export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { calculatePayrollRun } from '@/lib/accounting/payroll.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// POST /api/accounting/payroll/[id]/calculate
// Calculate all entries in a payroll run
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const run = await calculatePayrollRun(id);

    logger.info('Payroll run calculated via API', {
      payrollRunId: id,
      employeeCount: run.entries.length,
      totalGross: Number(run.totalGross),
      totalNet: Number(run.totalNet),
    });

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        totalGross: Number(run.totalGross),
        totalDeductions: Number(run.totalDeductions),
        totalNet: Number(run.totalNet),
        totalEmployerCost: Number(run.totalEmployerCost),
        employeeCount: run.entries.length,
        entries: run.entries.map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          employee: {
            firstName: e.employee.firstName,
            lastName: e.employee.lastName,
          },
          grossPay: Number(e.grossPay),
          totalDeductions: Number(e.totalDeductions),
          netPay: Number(e.netPay),
          totalEmployerCost: Number(e.totalEmployerCost),
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error calculating payroll run', { error: message });

    // Return specific error messages for known conditions
    if (message.includes('not found') || message.includes('No active employees')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes('Cannot calculate')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Erreur lors du calcul du cycle de paie' },
      { status: 500 }
    );
  }
});

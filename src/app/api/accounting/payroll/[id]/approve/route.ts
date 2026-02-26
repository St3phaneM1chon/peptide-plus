export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { approvePayrollRun, generatePayStubs } from '@/lib/accounting/payroll.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// POST /api/accounting/payroll/[id]/approve
// Approve a payroll run and generate pay stubs
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const approvedBy = session?.user?.email || session?.user?.name || 'unknown';

    // Approve the run
    const run = await approvePayrollRun(id, approvedBy);

    // Generate pay stubs automatically after approval
    let payStubCount = 0;
    try {
      const stubs = await generatePayStubs(id);
      payStubCount = stubs.length;
    } catch (stubError) {
      logger.warn('Pay stubs generation failed after approval', {
        payrollRunId: id,
        error: stubError instanceof Error ? stubError.message : String(stubError),
      });
    }

    logger.info('Payroll run approved via API', {
      payrollRunId: id,
      approvedBy,
      payStubCount,
    });

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        approvedBy: run.approvedBy,
        approvedAt: run.approvedAt?.toISOString() ?? null,
        totalGross: Number(run.totalGross),
        totalNet: Number(run.totalNet),
      },
      payStubsGenerated: payStubCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error approving payroll run', { error: message });

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('Cannot approve')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Erreur lors de l\'approbation du cycle de paie' },
      { status: 500 }
    );
  }
});

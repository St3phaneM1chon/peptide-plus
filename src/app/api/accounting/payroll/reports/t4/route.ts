export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { generateT4Data, generateRL1Data, getPayrollSummary } from '@/lib/accounting/payroll.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll/reports/t4
// Generate T4 and RL-1 reports for employees
//
// Query params:
//   - year: Tax year (default: current year)
//   - employeeId: Specific employee (optional; if omitted, all employees)
//   - type: 't4' | 'rl1' | 'summary' (default: 't4')
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const employeeId = searchParams.get('employeeId');
    const reportType = searchParams.get('type') || 't4';

    // Summary report
    if (reportType === 'summary') {
      const periodStart = new Date(year, 0, 1);
      const periodEnd = new Date(year + 1, 0, 1);
      const summary = await getPayrollSummary(periodStart, periodEnd);
      return NextResponse.json({ type: 'summary', year, summary });
    }

    // T4 or RL-1 for specific employee
    if (employeeId) {
      try {
        if (reportType === 'rl1') {
          const rl1 = await generateRL1Data(employeeId, year);
          return NextResponse.json({ type: 'rl1', year, data: rl1 });
        } else {
          const t4 = await generateT4Data(employeeId, year);
          return NextResponse.json({ type: 't4', year, data: t4 });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    // Generate T4 for all employees
    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        hireDate: { lte: new Date(year + 1, 0, 1) },
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: new Date(year, 0, 1) } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const results = [];
    const errors = [];

    for (const emp of employees) {
      try {
        if (reportType === 'rl1') {
          if (emp.province === 'QC') {
            const rl1 = await generateRL1Data(emp.id, year);
            results.push(rl1);
          }
        } else {
          const t4 = await generateT4Data(emp.id, year);
          results.push(t4);
        }
      } catch (err) {
        errors.push({
          employeeId: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('T4/RL-1 report generated', {
      type: reportType,
      year,
      count: results.length,
      errors: errors.length,
    });

    return NextResponse.json({
      type: reportType,
      year,
      count: results.length,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error generating T4/RL-1 report', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du rapport T4/RL-1' },
      { status: 500 }
    );
  }
});

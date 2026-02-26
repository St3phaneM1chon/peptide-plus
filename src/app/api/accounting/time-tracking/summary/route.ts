export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/accounting/time-tracking/summary
// Summary report by employee/project/period
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get('groupBy') || 'employee'; // employee, project, category
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const employeeId = searchParams.get('employeeId');
    const projectName = searchParams.get('projectName');
    const status = searchParams.get('status');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };

    if (employeeId) where.employeeId = employeeId;
    if (projectName) where.projectName = projectName;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Aggregate totals
    let totalHours = 0;
    let billableHours = 0;
    let billableAmount = 0;
    let nonBillableHours = 0;
    const statusCounts: Record<string, number> = {};

    // Group data
    const groups: Record<string, {
      key: string;
      totalHours: number;
      billableHours: number;
      billableAmount: number;
      entryCount: number;
    }> = {};

    for (const entry of entries) {
      const hours = Number(entry.hoursWorked);
      totalHours += hours;

      // Status counts
      statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;

      if (entry.isBillable) {
        billableHours += hours;
        const rate = entry.billableRate ? Number(entry.billableRate) : 0;
        billableAmount += hours * rate;
      } else {
        nonBillableHours += hours;
      }

      // Grouping
      let groupKey = '';
      switch (groupBy) {
        case 'employee':
          groupKey = entry.userName || 'Non assigne';
          break;
        case 'project':
          groupKey = entry.projectName || 'Sans projet';
          break;
        case 'category':
          groupKey = entry.taskCategory || 'Non categorise';
          break;
        default:
          groupKey = entry.userName || 'Non assigne';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          totalHours: 0,
          billableHours: 0,
          billableAmount: 0,
          entryCount: 0,
        };
      }

      groups[groupKey].totalHours += hours;
      groups[groupKey].entryCount += 1;
      if (entry.isBillable) {
        groups[groupKey].billableHours += hours;
        const rate = entry.billableRate ? Number(entry.billableRate) : 0;
        groups[groupKey].billableAmount += hours * rate;
      }
    }

    // Round values
    const roundHours = (h: number) => Math.round(h * 100) / 100;
    const roundAmount = (a: number) => Math.round(a * 100) / 100;

    const groupedData = Object.values(groups)
      .map((g) => ({
        ...g,
        totalHours: roundHours(g.totalHours),
        billableHours: roundHours(g.billableHours),
        billableAmount: roundAmount(g.billableAmount),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);

    return NextResponse.json({
      summary: {
        totalEntries: entries.length,
        totalHours: roundHours(totalHours),
        billableHours: roundHours(billableHours),
        nonBillableHours: roundHours(nonBillableHours),
        billableAmount: roundAmount(billableAmount),
        statusCounts,
      },
      groupBy,
      groups: groupedData,
    });
  } catch (error) {
    logger.error('Error generating time tracking summary', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la generation du resume' },
      { status: 500 }
    );
  }
});

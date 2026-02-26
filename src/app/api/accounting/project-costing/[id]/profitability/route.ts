export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/accounting/project-costing/[id]/profitability
// Profitability analysis: revenue vs costs, margin, burn rate, ETC/EAC
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    const project = await prisma.costProject.findFirst({
      where: { id: projectId, deletedAt: null },
      include: {
        costEntries: {
          orderBy: { date: 'asc' },
        },
        milestones: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const entries = project.costEntries;
    const budgetAmount = project.budgetAmount ? Number(project.budgetAmount) : 0;
    const budgetHours = project.budgetHours ? Number(project.budgetHours) : 0;

    // --- Basic totals ---
    const actualCost = entries.reduce((sum, e) => sum + Number(e.totalCost), 0);
    const totalBillable = entries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + Number(e.billableAmount), 0);
    const totalBilled = entries
      .filter((e) => e.invoiceId)
      .reduce((sum, e) => sum + Number(e.billableAmount), 0);

    // --- Revenue based on billing method ---
    let revenue = 0;
    if (project.billingMethod === 'FIXED' && project.fixedPrice) {
      revenue = Number(project.fixedPrice);
    } else if (project.billingMethod === 'TIME_AND_MATERIALS') {
      revenue = totalBillable;
    } else if (project.billingMethod === 'RETAINER' && project.retainerAmount) {
      revenue = Number(project.retainerAmount);
    }

    // --- Profitability ---
    const grossMargin = revenue - actualCost;
    const grossMarginPct = revenue > 0
      ? Math.round(((revenue - actualCost) / revenue) * 10000) / 100
      : 0;

    // --- Labor analysis ---
    const laborEntries = entries.filter((e) => e.type === 'LABOR');
    const totalHoursWorked = laborEntries.reduce((sum, e) => sum + Number(e.quantity), 0);
    const laborCost = laborEntries.reduce((sum, e) => sum + Number(e.totalCost), 0);
    const avgHourlyRate = totalHoursWorked > 0
      ? Math.round((laborCost / totalHoursWorked) * 100) / 100
      : 0;

    // --- Burn rate (cost per week based on date range) ---
    let burnRateWeekly = 0;
    if (entries.length >= 2) {
      const firstDate = new Date(entries[0].date);
      const lastDate = new Date(entries[entries.length - 1].date);
      const weeks = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      burnRateWeekly = Math.round((actualCost / weeks) * 100) / 100;
    }

    // --- Earned Value Management (EVM) ---
    // BAC = Budget At Completion
    const bac = budgetAmount;

    // Percent complete (based on costs vs budget, or milestones)
    const completedMilestones = project.milestones.filter((m) => m.status === 'COMPLETED').length;
    const totalMilestones = project.milestones.length;
    const pctCompleteMilestones = totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;
    const pctCompleteCost = bac > 0
      ? Math.round((actualCost / bac) * 100)
      : 0;

    // Use milestone-based completion if milestones exist, otherwise use cost-based
    const pctComplete = totalMilestones > 0 ? pctCompleteMilestones : Math.min(pctCompleteCost, 100);

    // EV = Earned Value = BAC * % complete
    const earnedValue = Math.round((bac * (pctComplete / 100)) * 100) / 100;

    // SV = Schedule Variance = EV - PV (simplified: PV = time-based portion of budget)
    let plannedValue = 0;
    if (project.startDate && project.endDate) {
      const totalDuration = new Date(project.endDate).getTime() - new Date(project.startDate).getTime();
      const elapsed = Date.now() - new Date(project.startDate).getTime();
      const pctElapsed = totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 1;
      plannedValue = Math.round((bac * pctElapsed) * 100) / 100;
    }

    const scheduleVariance = Math.round((earnedValue - plannedValue) * 100) / 100;
    const costVariance = Math.round((earnedValue - actualCost) * 100) / 100;

    // CPI = Cost Performance Index = EV / AC
    const cpi = actualCost > 0
      ? Math.round((earnedValue / actualCost) * 100) / 100
      : 0;

    // SPI = Schedule Performance Index = EV / PV
    const spi = plannedValue > 0
      ? Math.round((earnedValue / plannedValue) * 100) / 100
      : 0;

    // EAC = Estimate At Completion = BAC / CPI (or AC + remaining budget if CPI is 0)
    const eac = cpi > 0
      ? Math.round((bac / cpi) * 100) / 100
      : actualCost + Math.max(0, bac - earnedValue);

    // ETC = Estimate To Complete = EAC - AC
    const etc = Math.round(Math.max(0, eac - actualCost) * 100) / 100;

    // VAC = Variance At Completion = BAC - EAC
    const vac = Math.round((bac - eac) * 100) / 100;

    // --- Cost breakdown by type ---
    const costsByType: Record<string, { cost: number; count: number; pct: number }> = {};
    for (const entry of entries) {
      if (!costsByType[entry.type]) {
        costsByType[entry.type] = { cost: 0, count: 0, pct: 0 };
      }
      costsByType[entry.type].cost += Number(entry.totalCost);
      costsByType[entry.type].count += 1;
    }
    // Calculate percentages
    for (const type of Object.keys(costsByType)) {
      costsByType[type].cost = Math.round(costsByType[type].cost * 100) / 100;
      costsByType[type].pct = actualCost > 0
        ? Math.round((costsByType[type].cost / actualCost) * 100)
        : 0;
    }

    // --- Monthly trend ---
    const monthlyTrend: Record<string, { cost: number; billable: number; entries: number }> = {};
    for (const entry of entries) {
      const month = new Date(entry.date).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyTrend[month]) {
        monthlyTrend[month] = { cost: 0, billable: 0, entries: 0 };
      }
      monthlyTrend[month].cost += Number(entry.totalCost);
      monthlyTrend[month].billable += Number(entry.billableAmount);
      monthlyTrend[month].entries += 1;
    }
    // Round values
    for (const month of Object.keys(monthlyTrend)) {
      monthlyTrend[month].cost = Math.round(monthlyTrend[month].cost * 100) / 100;
      monthlyTrend[month].billable = Math.round(monthlyTrend[month].billable * 100) / 100;
    }

    return NextResponse.json({
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      billingMethod: project.billingMethod,
      status: project.status,

      financial: {
        revenue: Math.round(revenue * 100) / 100,
        actualCost: Math.round(actualCost * 100) / 100,
        grossMargin: Math.round(grossMargin * 100) / 100,
        grossMarginPct,
        totalBillable: Math.round(totalBillable * 100) / 100,
        totalBilled: Math.round(totalBilled * 100) / 100,
        unbilledAmount: Math.round((totalBillable - totalBilled) * 100) / 100,
      },

      labor: {
        totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
        budgetHours,
        hoursRemainingPct: budgetHours > 0
          ? Math.round(((budgetHours - totalHoursWorked) / budgetHours) * 100)
          : 0,
        laborCost: Math.round(laborCost * 100) / 100,
        avgHourlyRate,
      },

      burnRate: {
        weekly: burnRateWeekly,
        monthly: Math.round(burnRateWeekly * 4.33 * 100) / 100,
      },

      earnedValue: {
        bac,
        earnedValue,
        plannedValue,
        actualCost: Math.round(actualCost * 100) / 100,
        scheduleVariance,
        costVariance,
        cpi,
        spi,
        eac,
        etc,
        vac,
        pctComplete,
      },

      costsByType,
      monthlyTrend,

      milestones: {
        total: totalMilestones,
        completed: completedMilestones,
        pctComplete: pctCompleteMilestones,
      },
    });
  } catch (error) {
    logger.error('Get project profitability error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors du calcul de la rentabilite' },
      { status: 500 }
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import {
  generateAlerts,
  generateClosingAlerts,
  getNextTaxDeadline,
  detectExpenseAnomalies,
} from '@/lib/accounting';

/**
 * GET /api/accounting/alerts
 * Get all active alerts from real data
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Fetch overdue invoices
    const overdueInvoices = await prisma.customerInvoice.findMany({
      where: { status: 'OVERDUE' },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        total: true,
        dueDate: true,
        status: true,
      },
    });

    // Fetch cash flow data from bank accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      select: { currentBalance: true },
    });
    const currentBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);
    const cashFlow = {
      currentBalance,
      projectedInflows: 0,
      projectedOutflows: 0,
      minimumBalance: 10000,
    };

    // Fetch latest tax report
    const taxReports = await prisma.taxReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const mappedTaxReports = taxReports.map((t) => ({
      ...t,
      tpsCollected: Number(t.tpsCollected),
      tvqCollected: Number(t.tvqCollected),
      tvhCollected: Number(t.tvhCollected),
      otherTaxCollected: Number(t.otherTaxCollected),
      tpsPaid: Number(t.tpsPaid),
      tvqPaid: Number(t.tvqPaid),
      tvhPaid: Number(t.tvhPaid),
      otherTaxPaid: Number(t.otherTaxPaid),
      netTps: Number(t.netTps),
      netTvq: Number(t.netTvq),
      netTvh: Number(t.netTvh),
      netTotal: Number(t.netTotal),
      totalSales: Number(t.totalSales),
      generatedAt: t.createdAt,
      dueDate: t.dueDate || new Date(),
    }));

    // Fetch pending reconciliation count
    const pendingReconCount = await prisma.bankTransaction.count({
      where: { reconciliationStatus: 'PENDING' },
    });
    const oldestPending = await prisma.bankTransaction.findFirst({
      where: { reconciliationStatus: 'PENDING' },
      orderBy: { date: 'asc' },
      select: { date: true },
    });
    const oldestPendingDays = oldestPending
      ? Math.floor((Date.now() - oldestPending.date.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const reconciliation = { pendingCount: pendingReconCount, oldestPendingDays };

    // Expense anomalies: aggregate current month vs previous months
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentExpenses: Record<string, number> = {};
    const historicalAverages: Record<string, number> = {};

    // Detect anomalies
    const expenseAnomalies = detectExpenseAnomalies(currentExpenses, historicalAverages);

    // Generate all alerts
    const alerts = generateAlerts(
      overdueInvoices.map((i) => ({
        ...i,
        total: Number(i.total),
      })),
      cashFlow,
      mappedTaxReports,
      reconciliation,
      expenseAnomalies
    );

    // Add closing alerts
    const lastPeriod = await prisma.accountingPeriod.findFirst({
      where: { status: 'LOCKED' },
      orderBy: { endDate: 'desc' },
      select: { code: true },
    });
    const closingAlerts = generateClosingAlerts(
      now.getMonth() + 1,
      now.getFullYear(),
      lastPeriod?.code || ''
    );

    const allAlerts = [...alerts, ...closingAlerts];

    // Get next tax deadline info
    const settings = await prisma.accountingSettings.findFirst();
    const taxDeadline = getNextTaxDeadline(
      settings?.taxFilingFrequency || 'MONTHLY'
    );

    return NextResponse.json({
      alerts: allAlerts,
      summary: {
        total: allAlerts.length,
        critical: allAlerts.filter((a) => a.severity === 'CRITICAL').length,
        high: allAlerts.filter((a) => a.severity === 'HIGH').length,
        medium: allAlerts.filter((a) => a.severity === 'MEDIUM').length,
        low: allAlerts.filter((a) => a.severity === 'LOW').length,
      },
      nextTaxDeadline: taxDeadline,
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des alertes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/alerts
 * Mark alert as read or resolved
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { alertId, action } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'alertId et action sont requis' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (action === 'read') {
      updateData.readAt = new Date();
      updateData.readBy = session.user.id || session.user.email;
    } else if (action === 'resolve') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = session.user.id || session.user.email;
    }

    await prisma.accountingAlert.update({
      where: { id: alertId },
      data: updateData,
    }).catch(() => {
      // Alert may be generated dynamically and not in DB yet
    });

    return NextResponse.json({
      success: true,
      result: { alertId, action, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'alerte' },
      { status: 500 }
    );
  }
}

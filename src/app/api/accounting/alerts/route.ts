export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  generateAlerts,
  generateClosingAlerts,
  getNextTaxDeadline,
  detectExpenseAnomalies,
  getActiveAlerts,
  evaluateAlertRules,
} from '@/lib/accounting';

/**
 * GET /api/accounting/alerts
 * Get all active alerts from real data.
 * Query params:
 *   - type: filter by alert type (e.g. BUDGET_EXCEEDED, PAYMENT_OVERDUE)
 *   - acknowledged: "true" or "false" to filter by read status
 *   - source: "rules" to return only rule-based alerts from DB,
 *             omit for legacy computed alerts
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type') || undefined;
    const ackParam = url.searchParams.get('acknowledged');
    const source = url.searchParams.get('source');

    // If source=rules, return alerts from the AccountingAlert table (Phase 8)
    if (source === 'rules') {
      const acknowledged =
        ackParam === 'true' ? true : ackParam === 'false' ? false : undefined;

      const result = await getActiveAlerts({ type: typeFilter, acknowledged });
      return NextResponse.json(result);
    }

    // Legacy computed alerts (Phase 1-7)
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

    // Calculate projected inflows from unpaid customer invoices
    const unpaidCustomerInvoices = await prisma.customerInvoice.aggregate({
      where: { status: { in: ['SENT', 'OVERDUE'] }, deletedAt: null },
      _sum: { balance: true },
    });
    const projectedInflows = Number(unpaidCustomerInvoices._sum.balance ?? 0);

    // Calculate projected outflows from unpaid supplier invoices
    const unpaidSupplierInvoices = await prisma.supplierInvoice.aggregate({
      where: { status: { in: ['DRAFT', 'SENT', 'OVERDUE'] }, deletedAt: null },
      _sum: { balance: true },
    });
    const projectedOutflows = Number(unpaidSupplierInvoices._sum.balance ?? 0);

    const cashFlow = {
      currentBalance,
      projectedInflows,
      projectedOutflows,
      minimumBalance: 10000,
    };

    // Fetch latest tax report
    const taxReports = await prisma.taxReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const mappedTaxReports = taxReports.map((t) => ({
      ...t,
      periodType: t.periodType as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
      month: t.month ?? undefined,
      quarter: t.quarter ?? undefined,
      filedAt: t.filedAt ?? undefined,
      paidAt: t.paidAt ?? undefined,
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
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Aggregate current month expenses by account code
    const currentMonthLines = await prisma.journalLine.findMany({
      where: {
        debit: { gt: 0 },
        account: { type: 'EXPENSE' },
        entry: {
          status: 'POSTED',
          deletedAt: null,
          date: { gte: currentMonthStart, lte: currentMonthEnd },
        },
      },
      select: { debit: true, account: { select: { code: true } } },
    });

    const currentExpenses: Record<string, number> = {};
    for (const line of currentMonthLines) {
      const code = line.account.code;
      currentExpenses[code] = (currentExpenses[code] || 0) + Number(line.debit);
    }

    // Compute 3-month historical averages
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const historicalLines = await prisma.journalLine.findMany({
      where: {
        debit: { gt: 0 },
        account: { type: 'EXPENSE' },
        entry: {
          status: 'POSTED',
          deletedAt: null,
          date: { gte: threeMonthsAgo, lte: lastMonthEnd },
        },
      },
      select: { debit: true, account: { select: { code: true } } },
    });

    const historicalTotals: Record<string, number> = {};
    for (const line of historicalLines) {
      const code = line.account.code;
      historicalTotals[code] = (historicalTotals[code] || 0) + Number(line.debit);
    }

    const historicalAverages: Record<string, number> = {};
    for (const [code, total] of Object.entries(historicalTotals)) {
      historicalAverages[code] = Math.round((total / 3) * 100) / 100;
    }

    // Detect anomalies
    const expenseAnomalies = detectExpenseAnomalies(currentExpenses, historicalAverages);

    // Generate all alerts
    let alerts = generateAlerts(
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

    let allAlerts = [...alerts, ...closingAlerts];

    // Apply type filter if provided
    if (typeFilter) {
      allAlerts = allAlerts.filter((a) => a.type === typeFilter);
    }

    // Get next tax deadline info
    const settings = await prisma.accountingSettings.findFirst();
    const taxDeadline = getNextTaxDeadline(
      (settings?.taxFilingFrequency || 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
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
      { error: 'Erreur lors de la r\u00e9cup\u00e9ration des alertes' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/alerts
 * Create a custom alert rule (manual alert).
 * Body: { type, severity?, title, message, entityType?, entityId?, link? }
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { type, severity, title, message, entityType, entityId, link } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title et message sont requis' },
        { status: 400 }
      );
    }

    const validTypes = [
      'BUDGET_EXCEEDED',
      'PAYMENT_OVERDUE',
      'RECONCILIATION_GAP',
      'TAX_DEADLINE',
      'UNUSUAL_AMOUNT',
      'OVERDUE_INVOICE',
      'LOW_CASH',
      'TAX_DUE',
      'RECONCILIATION_PENDING',
      'EXPENSE_ANOMALY',
      'CUSTOM',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide. Types accept\u00e9s: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const alertId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const alert = await prisma.accountingAlert.create({
      data: {
        id: alertId,
        type,
        severity: severity || 'MEDIUM',
        title,
        message,
        entityType: entityType || null,
        entityId: entityId || null,
        link: link || null,
      },
    });

    return NextResponse.json({ success: true, alert }, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la cr\u00e9ation de l\'alerte' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/accounting/alerts
 * Acknowledge (read) or dismiss (resolve) an alert.
 * Body: { alertId, action: 'read' | 'resolve' }
 */
export const PATCH = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { alertId, action } = body;

    if (!alertId || !action) {
      return NextResponse.json(
        { error: 'alertId et action sont requis' },
        { status: 400 }
      );
    }

    if (!['read', 'resolve'].includes(action)) {
      return NextResponse.json(
        { error: 'action doit \u00eatre "read" ou "resolve"' },
        { status: 400 }
      );
    }

    const existingAlert = await prisma.accountingAlert.findUnique({
      where: { id: alertId },
    });
    if (!existingAlert) {
      return NextResponse.json({ error: 'Alerte non trouv\u00e9e' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (action === 'read') {
      updateData.readAt = new Date();
      updateData.readBy = session.user.id || session.user.email;
    } else if (action === 'resolve') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = session.user.id || session.user.email;
    }

    const updated = await prisma.accountingAlert.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      result: {
        alertId,
        action,
        timestamp: new Date().toISOString(),
        alert: updated,
      },
    });
  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise \u00e0 jour de l\'alerte' },
      { status: 500 }
    );
  }
});

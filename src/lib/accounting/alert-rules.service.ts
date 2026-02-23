/**
 * Alert Rules Service - Phase 8: Automation
 * Automated evaluation of accounting alert rules against live data.
 *
 * Rule types:
 *   BUDGET_EXCEEDED     - Budget utilization > 90%
 *   PAYMENT_OVERDUE     - Customer invoices overdue > 30 days
 *   RECONCILIATION_GAP  - Unreconciled bank transactions > 7 days old
 *   TAX_DEADLINE        - Tax filing due within 14 days
 *   UNUSUAL_AMOUNT      - Expense > 3x historical average
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertRuleType =
  | 'BUDGET_EXCEEDED'
  | 'PAYMENT_OVERDUE'
  | 'RECONCILIATION_GAP'
  | 'TAX_DEADLINE'
  | 'UNUSUAL_AMOUNT';

export interface AlertRuleResult {
  ruleType: AlertRuleType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUDGET_UTILIZATION_THRESHOLD = 0.9; // 90 %
const OVERDUE_DAYS_THRESHOLD = 30;
const RECONCILIATION_GAP_DAYS = 7;
const TAX_DEADLINE_WARNING_DAYS = 14;
const UNUSUAL_AMOUNT_MULTIPLIER = 3; // 3x average

/** Map month index (0-11) to BudgetLine field name */
const MONTH_FIELD_MAP: Record<number, string> = {
  0: 'january',
  1: 'february',
  2: 'march',
  3: 'april',
  4: 'may',
  5: 'june',
  6: 'july',
  7: 'august',
  8: 'september',
  9: 'october',
  10: 'november',
  11: 'december',
};

// ---------------------------------------------------------------------------
// Individual Rule Evaluators
// ---------------------------------------------------------------------------

/**
 * BUDGET_EXCEEDED - Check each active budget line for > 90 % utilization
 * in the current month.
 */
async function evaluateBudgetExceeded(): Promise<AlertRuleResult[]> {
  const alerts: AlertRuleResult[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const monthField = MONTH_FIELD_MAP[now.getMonth()];
  if (!monthField) return alerts;

  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  // Active budgets for the current year
  const budgets = await prisma.budget.findMany({
    where: { year, isActive: true },
    include: { lines: true },
  });

  for (const budget of budgets) {
    for (const line of budget.lines) {
      const budgetedAmount = Number((line as Record<string, unknown>)[monthField] ?? 0);
      if (budgetedAmount <= 0) continue;

      // Sum actual expense debits for this account code in the current month
      const accountMatch = await prisma.chartOfAccount.findUnique({
        where: { code: line.accountCode },
        select: { id: true },
      });
      if (!accountMatch) continue;

      const aggregate = await prisma.journalLine.aggregate({
        where: {
          accountId: accountMatch.id,
          debit: { gt: 0 },
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { gte: monthStart, lte: monthEnd },
          },
        },
        _sum: { debit: true },
      });

      const actual = Number(aggregate._sum.debit ?? 0);
      const utilization = actual / budgetedAmount;

      if (utilization >= BUDGET_UTILIZATION_THRESHOLD) {
        const pct = Math.round(utilization * 100);
        alerts.push({
          ruleType: 'BUDGET_EXCEEDED',
          severity: utilization >= 1.2 ? 'CRITICAL' : utilization >= 1.0 ? 'HIGH' : 'MEDIUM',
          title: `Budget depass\u00e9: ${line.accountName}`,
          message: `Utilisation ${pct}% du budget mensuel (${actual.toFixed(2)}$ / ${budgetedAmount.toFixed(2)}$)`,
          entityType: 'BUDGET',
          entityId: budget.id,
          link: '/admin/comptabilite/budgets',
          metadata: { accountCode: line.accountCode, utilization, actual, budgeted: budgetedAmount },
        });
      }
    }
  }

  return alerts;
}

/**
 * PAYMENT_OVERDUE - Customer invoices overdue > 30 days
 */
async function evaluatePaymentOverdue(): Promise<AlertRuleResult[]> {
  const alerts: AlertRuleResult[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS_THRESHOLD);

  const overdueInvoices = await prisma.customerInvoice.findMany({
    where: {
      status: { in: ['SENT', 'OVERDUE'] },
      dueDate: { lt: cutoff },
      deletedAt: null,
    },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      total: true,
      balance: true,
      dueDate: true,
    },
    orderBy: { dueDate: 'asc' },
  });

  for (const inv of overdueInvoices) {
    const daysPast = Math.floor(
      (Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    alerts.push({
      ruleType: 'PAYMENT_OVERDUE',
      severity: daysPast > 90 ? 'CRITICAL' : daysPast > 60 ? 'HIGH' : 'MEDIUM',
      title: `Facture en retard: ${inv.invoiceNumber}`,
      message: `${inv.customerName} - Solde ${Number(inv.balance).toFixed(2)}$ en retard de ${daysPast} jours`,
      entityType: 'CUSTOMER_INVOICE',
      entityId: inv.id,
      link: `/admin/comptabilite/factures-clients?id=${inv.id}`,
      metadata: { daysPast, balance: Number(inv.balance), total: Number(inv.total) },
    });
  }

  return alerts;
}

/**
 * RECONCILIATION_GAP - Unreconciled bank transactions older than 7 days
 */
async function evaluateReconciliationGap(): Promise<AlertRuleResult[]> {
  const alerts: AlertRuleResult[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECONCILIATION_GAP_DAYS);

  const unreconciledCount = await prisma.bankTransaction.count({
    where: {
      reconciliationStatus: 'PENDING',
      date: { lt: cutoff },
      deletedAt: null,
    },
  });

  if (unreconciledCount > 0) {
    const oldest = await prisma.bankTransaction.findFirst({
      where: {
        reconciliationStatus: 'PENDING',
        date: { lt: cutoff },
        deletedAt: null,
      },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    const oldestDays = oldest
      ? Math.floor((Date.now() - oldest.date.getTime()) / (1000 * 60 * 60 * 24))
      : RECONCILIATION_GAP_DAYS;

    alerts.push({
      ruleType: 'RECONCILIATION_GAP',
      severity: oldestDays > 30 ? 'HIGH' : 'MEDIUM',
      title: 'Transactions non rapproch\u00e9es',
      message: `${unreconciledCount} transaction(s) bancaire(s) non rapproch\u00e9e(s) depuis plus de ${RECONCILIATION_GAP_DAYS} jours. La plus ancienne: ${oldestDays} jours.`,
      link: '/admin/comptabilite/rapprochement',
      metadata: { count: unreconciledCount, oldestDays },
    });
  }

  return alerts;
}

/**
 * TAX_DEADLINE - Tax reports due within 14 days
 */
async function evaluateTaxDeadline(): Promise<AlertRuleResult[]> {
  const alerts: AlertRuleResult[] = [];
  const now = new Date();
  const deadlineHorizon = new Date();
  deadlineHorizon.setDate(deadlineHorizon.getDate() + TAX_DEADLINE_WARNING_DAYS);

  const pendingReports = await prisma.taxReport.findMany({
    where: {
      status: { in: ['DRAFT', 'GENERATED'] },
      dueDate: { lte: deadlineHorizon },
    },
    orderBy: { dueDate: 'asc' },
  });

  for (const report of pendingReports) {
    const dueDate = new Date(report.dueDate!);
    const daysLeft = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    alerts.push({
      ruleType: 'TAX_DEADLINE',
      severity: daysLeft < 0 ? 'CRITICAL' : daysLeft <= 3 ? 'HIGH' : daysLeft <= 7 ? 'MEDIUM' : 'LOW',
      title: `\u00c9ch\u00e9ance fiscale: ${report.period}`,
      message: daysLeft < 0
        ? `EN RETARD de ${Math.abs(daysLeft)} jour(s)! Montant net: ${Number(report.netTotal).toFixed(2)}$`
        : `\u00c9ch\u00e9ance dans ${daysLeft} jour(s) (${dueDate.toLocaleDateString('fr-CA')}). Montant: ${Number(report.netTotal).toFixed(2)}$`,
      entityType: 'TAX_REPORT',
      entityId: report.id,
      link: '/admin/comptabilite/rapports',
      metadata: { daysLeft, netTotal: Number(report.netTotal) },
    });
  }

  return alerts;
}

/**
 * UNUSUAL_AMOUNT - Expense > 3x the 3-month historical average
 */
async function evaluateUnusualAmount(): Promise<AlertRuleResult[]> {
  const alerts: AlertRuleResult[] = [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Current month expense totals by account
  const currentLines = await prisma.journalLine.findMany({
    where: {
      debit: { gt: 0 },
      account: { type: 'EXPENSE' },
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
    },
    select: { debit: true, account: { select: { code: true, name: true } } },
  });

  const currentByAccount: Record<string, { total: number; name: string }> = {};
  for (const line of currentLines) {
    const code = line.account.code;
    if (!currentByAccount[code]) {
      currentByAccount[code] = { total: 0, name: line.account.name };
    }
    currentByAccount[code].total += Number(line.debit);
  }

  // Historical 3-month average
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

  const histTotals: Record<string, number> = {};
  for (const line of historicalLines) {
    histTotals[line.account.code] = (histTotals[line.account.code] || 0) + Number(line.debit);
  }

  for (const [code, info] of Object.entries(currentByAccount)) {
    const avgMonthly = (histTotals[code] || 0) / 3;
    if (avgMonthly <= 0) continue;

    if (info.total > avgMonthly * UNUSUAL_AMOUNT_MULTIPLIER) {
      const multiplier = Math.round((info.total / avgMonthly) * 10) / 10;
      alerts.push({
        ruleType: 'UNUSUAL_AMOUNT',
        severity: multiplier >= 5 ? 'HIGH' : 'MEDIUM',
        title: `Montant inhabituel: ${info.name}`,
        message: `${info.total.toFixed(2)}$ ce mois (${multiplier}x la moyenne de ${avgMonthly.toFixed(2)}$/mois)`,
        link: '/admin/comptabilite/rapports',
        metadata: { accountCode: code, currentAmount: info.total, averageAmount: avgMonthly, multiplier },
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate all alert rules and persist new alerts to the database.
 * Returns the list of newly created alerts.
 */
export async function evaluateAlertRules(): Promise<{
  evaluated: number;
  alertsCreated: number;
  alerts: AlertRuleResult[];
}> {
  const allAlerts: AlertRuleResult[] = [];

  // Run all evaluators concurrently
  const [budgetAlerts, overdueAlerts, reconAlerts, taxAlerts, unusualAlerts] =
    await Promise.all([
      evaluateBudgetExceeded(),
      evaluatePaymentOverdue(),
      evaluateReconciliationGap(),
      evaluateTaxDeadline(),
      evaluateUnusualAmount(),
    ]);

  allAlerts.push(...budgetAlerts, ...overdueAlerts, ...reconAlerts, ...taxAlerts, ...unusualAlerts);

  // Persist new alerts to AccountingAlert table
  let created = 0;
  for (const alert of allAlerts) {
    // FIX (F036): Use SHA-256 hash for deterministic alertId to prevent
    // collisions when titles are long (previously truncated to 255 chars)
    const rawId = `auto-${alert.ruleType}-${alert.entityId || alert.title}`;
    // Use a simple hash to stay within 255 chars and guarantee uniqueness
    const encoder = new TextEncoder();
    const data = encoder.encode(rawId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const alertId = `auto-${alert.ruleType}-${hashHex}`.substring(0, 255);

    // FIX (F035): Use upsert directly without findUnique to avoid race condition
    // where two concurrent evaluations could both create the same alert
    try {
      await prisma.accountingAlert.upsert({
        where: { id: alertId },
        create: {
          id: alertId,
          type: alert.ruleType,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          entityType: alert.entityType || null,
          entityId: alert.entityId || null,
          link: alert.link || null,
        },
        update: {
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          // Only reset resolved state if it was previously resolved
          resolvedAt: null,
          resolvedBy: null,
        },
      });
      created++;
    } catch (error) {
      // Ignore unique constraint violations from concurrent writes
      console.warn('Alert upsert warning:', error instanceof Error ? error.message : String(error));
    }
  }

  return {
    evaluated: 5,
    alertsCreated: created,
    alerts: allAlerts,
  };
}

/**
 * Get all active (unacknowledged / unresolved) alerts from the database.
 */
// FIX: F097 - Added limit/offset pagination parameters
export async function getActiveAlerts(options?: {
  type?: string;
  acknowledged?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    link: string | null;
    readAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const where: Record<string, unknown> = {
    resolvedAt: null,
  };

  if (options?.type) {
    where.type = options.type;
  }

  if (options?.acknowledged === true) {
    where.readAt = { not: null };
  } else if (options?.acknowledged === false) {
    where.readAt = null;
  }

  // FIX: F097 - Add pagination limit to prevent loading unbounded alert lists
  const take = options?.limit ?? 100;
  const skip = options?.offset ?? 0;

  const [alerts, total] = await Promise.all([
    prisma.accountingAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.accountingAlert.count({ where }),
  ]);

  return {
    alerts,
    total,
  };
}

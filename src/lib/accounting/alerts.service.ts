/**
 * Accounting Alerts Service
 * Intelligent notifications for financial events
 *
 * FIX: F060 - This service overlaps with alert-rules.service.ts (DB-persisted rules).
 * TODO: Consolidate alert logic. This file handles in-memory alert generation from data;
 * alert-rules.service.ts handles user-configured DB-based alert rules. Eventually merge
 * or clearly separate responsibilities (this = built-in alerts, rules = custom alerts).
 */

import { Alert, TaxReport } from './types';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  dueDate: Date;
  status: string;
  daysPastDue?: number;
}

interface CashFlowData {
  currentBalance: number;
  projectedInflows: number;
  projectedOutflows: number;
  minimumBalance: number;
}

interface ReconciliationData {
  pendingCount: number;
  oldestPendingDays: number;
}

interface ExpenseData {
  category: string;
  amount: number;
  average: number;
  percentageAboveAverage: number;
}

/**
 * Generate all active alerts for the accounting dashboard
 */
export function generateAlerts(
  overdueInvoices: Invoice[],
  cashFlow: CashFlowData,
  taxReports: TaxReport[],
  reconciliation: ReconciliationData,
  expenseAnomalies: ExpenseData[]
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  // Overdue invoice alerts
  for (const invoice of overdueInvoices) {
    if (invoice.status === 'OVERDUE' || (invoice.dueDate < now && invoice.status !== 'PAID')) {
      const daysPastDue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let severity: Alert['severity'] = 'LOW';
      if (daysPastDue > 60) severity = 'CRITICAL';
      else if (daysPastDue > 30) severity = 'HIGH';
      else if (daysPastDue > 14) severity = 'MEDIUM';

      alerts.push({
        id: `overdue-${invoice.id}`,
        type: 'OVERDUE_INVOICE',
        severity,
        title: `Facture en retard: ${invoice.invoiceNumber}`,
        message: `${invoice.customerName} - ${invoice.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} en retard de ${daysPastDue} jours`,
        link: `/admin/comptabilite/factures-clients?id=${invoice.id}`,
        createdAt: now,
      });
    }
  }

  // Low cash alert
  const projectedBalance = cashFlow.currentBalance + cashFlow.projectedInflows - cashFlow.projectedOutflows;
  if (projectedBalance < cashFlow.minimumBalance) {
    const daysUntilCritical = Math.floor(
      (cashFlow.currentBalance - cashFlow.minimumBalance) / 
      ((cashFlow.projectedOutflows - cashFlow.projectedInflows) / 30)
    );

    alerts.push({
      id: `low-cash-${now.getTime()}`,
      type: 'LOW_CASH',
      severity: projectedBalance < 0 ? 'CRITICAL' : projectedBalance < cashFlow.minimumBalance * 0.5 ? 'HIGH' : 'MEDIUM',
      title: 'Alerte de trésorerie',
      message: `Solde projeté (${projectedBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}) sous le seuil minimum. ${daysUntilCritical > 0 ? `Critique dans ~${daysUntilCritical} jours.` : ''}`,
      link: '/admin/comptabilite/banques',
      createdAt: now,
    });
  }

  // Tax due alerts
  for (const report of taxReports) {
    if (report.status !== 'PAID') {
      const dueDate = new Date(report.dueDate);
      const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue <= 14) {
        let severity: Alert['severity'] = 'LOW';
        if (daysUntilDue < 0) severity = 'CRITICAL';
        else if (daysUntilDue <= 3) severity = 'HIGH';
        else if (daysUntilDue <= 7) severity = 'MEDIUM';

        alerts.push({
          id: `tax-due-${report.id}`,
          type: 'TAX_DUE',
          severity,
          title: `Déclaration TPS/TVQ ${report.period}`,
          message: daysUntilDue < 0 
            ? `EN RETARD de ${Math.abs(daysUntilDue)} jours! Montant: ${report.netTotal.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}`
            : `Échéance dans ${daysUntilDue} jours (${dueDate.toLocaleDateString('fr-CA')}). Montant: ${report.netTotal.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}`,
          link: '/admin/comptabilite/rapports',
          createdAt: now,
        });
      }
    }
  }

  // Reconciliation pending alerts
  if (reconciliation.pendingCount > 0 && reconciliation.oldestPendingDays > 7) {
    alerts.push({
      id: `reconciliation-${now.getTime()}`,
      type: 'RECONCILIATION_PENDING',
      severity: reconciliation.oldestPendingDays > 30 ? 'HIGH' : 'MEDIUM',
      title: 'Rapprochement bancaire en attente',
      message: `${reconciliation.pendingCount} transaction(s) non rapprochée(s). La plus ancienne date de ${reconciliation.oldestPendingDays} jours.`,
      link: '/admin/comptabilite/rapprochement',
      createdAt: now,
    });
  }

  // Expense anomaly alerts
  for (const expense of expenseAnomalies) {
    if (expense.percentageAboveAverage > 50) {
      alerts.push({
        id: `expense-anomaly-${expense.category}-${now.getTime()}`,
        type: 'EXPENSE_ANOMALY',
        severity: expense.percentageAboveAverage > 100 ? 'HIGH' : 'MEDIUM',
        title: `Dépense inhabituelle: ${expense.category}`,
        message: `${expense.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })} ce mois (+${expense.percentageAboveAverage.toFixed(0)}% vs moyenne)`,
        link: '/admin/comptabilite/rapports',
        createdAt: now,
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

/**
 * Check for month-end closing tasks
 */
export function generateClosingAlerts(
  currentMonth: number,
  currentYear: number,
  lastClosedPeriod: string | null
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const dayOfMonth = now.getDate();

  // If we're past the 5th of the month and previous month isn't closed
  if (dayOfMonth > 5) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    if (lastClosedPeriod !== prevPeriod) {
      alerts.push({
        id: `closing-${prevPeriod}`,
        // F068 FIX: Use RECONCILIATION_PENDING as closest match for period closing
        type: 'RECONCILIATION_PENDING' as const,
        severity: dayOfMonth > 15 ? 'HIGH' : 'MEDIUM',
        title: `Clôture de période en attente`,
        message: `La période ${getMonthName(prevMonth)} ${prevYear} n'est pas encore clôturée.`,
        link: '/admin/comptabilite/cloture',
        createdAt: now,
      });
    }
  }

  return alerts;
}

/**
 * Generate payment reminder alerts for customers
 */
export function generatePaymentReminders(invoices: Invoice[]): {
  toSend: { invoiceId: string; type: 'REMINDER' | 'FINAL_NOTICE' | 'COLLECTION'; daysPastDue: number }[];
} {
  const now = new Date();
  const toSend: { invoiceId: string; type: 'REMINDER' | 'FINAL_NOTICE' | 'COLLECTION'; daysPastDue: number }[] = [];

  for (const invoice of invoices) {
    if (invoice.status === 'PAID') continue;

    const dueDate = new Date(invoice.dueDate);
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // First reminder at 7 days overdue
    if (daysPastDue >= 7 && daysPastDue < 14) {
      toSend.push({ invoiceId: invoice.id, type: 'REMINDER', daysPastDue });
    }
    // Second reminder at 14 days
    else if (daysPastDue >= 14 && daysPastDue < 30) {
      toSend.push({ invoiceId: invoice.id, type: 'REMINDER', daysPastDue });
    }
    // Final notice at 30 days
    else if (daysPastDue >= 30 && daysPastDue < 60) {
      toSend.push({ invoiceId: invoice.id, type: 'FINAL_NOTICE', daysPastDue });
    }
    // Collection notice at 60+ days
    else if (daysPastDue >= 60) {
      toSend.push({ invoiceId: invoice.id, type: 'COLLECTION', daysPastDue });
    }
  }

  return { toSend };
}

/**
 * Detect expense anomalies by comparing to historical averages
 */
export function detectExpenseAnomalies(
  currentExpenses: Record<string, number>,
  historicalAverages: Record<string, number>,
  threshold: number = 0.5 // 50% above average triggers alert
): ExpenseData[] {
  const anomalies: ExpenseData[] = [];

  for (const [category, amount] of Object.entries(currentExpenses)) {
    const average = historicalAverages[category] || 0;
    
    if (average > 0) {
      const percentageAbove = ((amount - average) / average) * 100;
      
      if (percentageAbove > threshold * 100) {
        anomalies.push({
          category,
          amount,
          average,
          percentageAboveAverage: percentageAbove,
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.percentageAboveAverage - a.percentageAboveAverage);
}

/**
 * Calculate days until next tax deadline
 */
export function getNextTaxDeadline(
  filingFrequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
): { deadline: Date; daysRemaining: number; period: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  let deadline: Date;
  let period: string;

  switch (filingFrequency) {
    case 'MONTHLY':
      // Due by end of following month
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      deadline = new Date(nextMonthYear, nextMonth, 0); // Last day of next month
      period = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      break;
      
    case 'QUARTERLY':
      const currentQuarter = Math.ceil(currentMonth / 3);
      const quarterEndMonth = currentQuarter * 3;
      // FIX: F065 - Q4 year boundary: when quarterEndMonth=12, dueMonth rolls to 1 and
      // dueYear increments. new Date(year+1, 1, 0) correctly gives Jan 31 of next year.
      const dueMonth = quarterEndMonth === 12 ? 1 : quarterEndMonth + 1;
      const dueYear = quarterEndMonth === 12 ? currentYear + 1 : currentYear;
      deadline = new Date(dueYear, dueMonth, 0);
      period = `Q${currentQuarter} ${currentYear}`;
      break;
      
    case 'ANNUAL':
      // Due by April 30 of following year
      deadline = new Date(currentYear + 1, 3, 30);
      period = `${currentYear}`;
      break;
  }

  const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return { deadline, daysRemaining, period };
}

function getMonthName(month: number): string {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return months[month - 1];
}

/**
 * Get alert icon and color based on type and severity
 */
export function getAlertStyle(alert: Alert): { icon: string; bgColor: string; textColor: string; borderColor: string } {
  const severityStyles = {
    CRITICAL: { bgColor: 'bg-red-50', textColor: 'text-red-800', borderColor: 'border-red-200' },
    HIGH: { bgColor: 'bg-orange-50', textColor: 'text-orange-800', borderColor: 'border-orange-200' },
    MEDIUM: { bgColor: 'bg-yellow-50', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
    LOW: { bgColor: 'bg-blue-50', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
  };

  // F077 FIX: Use icon names instead of emojis for cross-platform consistency
  const typeIcons: Record<string, string> = {
    OVERDUE_INVOICE: 'alert-circle',
    LOW_CASH: 'trending-down',
    TAX_DUE: 'file-text',
    RECONCILIATION_PENDING: 'refresh-cw',
    PERIOD_CLOSE_PENDING: 'calendar-check',
    EXPENSE_ANOMALY: 'bar-chart-2',
  };

  return {
    icon: typeIcons[alert.type] || 'info',
    ...severityStyles[alert.severity],
  };
}

/**
 * Custom Report Engine Service
 *
 * Executes configurable financial reports using Prisma aggregations.
 * Supports 9 report types: Income Statement, Balance Sheet, Cash Flow,
 * AR/AP Aging, Tax Summary, Journal Detail, Trial Balance, and Custom.
 *
 * Phase 3-6 - Custom Reports Builder
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportType =
  | 'INCOME_STATEMENT'
  | 'BALANCE_SHEET'
  | 'CASH_FLOW'
  | 'AR_AGING'
  | 'AP_AGING'
  | 'TAX_SUMMARY'
  | 'JOURNAL_DETAIL'
  | 'TRIAL_BALANCE'
  | 'CUSTOM';

export interface Filter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: string | number | string[] | number[];
}

export interface ReportConfig {
  type: ReportType;
  dateFrom?: string;
  dateTo?: string;
  columns: string[];
  filters: Filter[];
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  compareWith?: 'previous_period' | 'previous_year' | 'budget';
  showTotals?: boolean;
  showPercentages?: boolean;
}

export interface ColumnDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
  sortable: boolean;
  defaultVisible: boolean;
}

export interface FilterDef {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];
}

export interface ReportResultRow {
  [key: string]: string | number | null | undefined;
}

export interface ReportResult {
  columns: ColumnDef[];
  rows: ReportResultRow[];
  totals?: Record<string, number>;
  percentages?: Record<string, number>;
  metadata: {
    type: ReportType;
    dateFrom?: string;
    dateTo?: string;
    generatedAt: string;
    rowCount: number;
    executionTimeMs: number;
  };
  comparison?: {
    label: string;
    rows: ReportResultRow[];
    totals?: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROWS = 10_000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Column Definitions per Report Type
// ---------------------------------------------------------------------------

const COLUMN_DEFS: Record<ReportType, ColumnDef[]> = {
  INCOME_STATEMENT: [
    { key: 'accountCode', label: 'Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountType', label: 'Type', type: 'string', sortable: true, defaultVisible: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'netAmount', label: 'Net Amount', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'percentage', label: '% of Revenue', type: 'number', sortable: true, defaultVisible: false },
  ],
  BALANCE_SHEET: [
    { key: 'accountCode', label: 'Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountType', label: 'Type', type: 'string', sortable: true, defaultVisible: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'normalBalance', label: 'Normal Balance', type: 'string', sortable: false, defaultVisible: false },
  ],
  CASH_FLOW: [
    { key: 'period', label: 'Period', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountCode', label: 'Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account', type: 'string', sortable: true, defaultVisible: true },
    { key: 'inflow', label: 'Inflow', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'outflow', label: 'Outflow', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'netCashFlow', label: 'Net Cash Flow', type: 'currency', sortable: true, defaultVisible: true },
  ],
  AR_AGING: [
    { key: 'customerName', label: 'Customer', type: 'string', sortable: true, defaultVisible: true },
    { key: 'invoiceNumber', label: 'Invoice #', type: 'string', sortable: true, defaultVisible: true },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date', sortable: true, defaultVisible: true },
    { key: 'dueDate', label: 'Due Date', type: 'date', sortable: true, defaultVisible: true },
    { key: 'total', label: 'Total', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'current', label: 'Current', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'days30', label: '1-30 Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'days60', label: '31-60 Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'days90', label: '61-90 Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'over90', label: '90+ Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'status', label: 'Status', type: 'string', sortable: true, defaultVisible: true },
  ],
  AP_AGING: [
    { key: 'supplierName', label: 'Supplier', type: 'string', sortable: true, defaultVisible: true },
    { key: 'invoiceNumber', label: 'Invoice #', type: 'string', sortable: true, defaultVisible: true },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'date', sortable: true, defaultVisible: true },
    { key: 'dueDate', label: 'Due Date', type: 'date', sortable: true, defaultVisible: true },
    { key: 'total', label: 'Total', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'current', label: 'Current', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'days30', label: '1-30 Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'days60', label: '31-60 Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'days90', label: '61-90 Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'over90', label: '90+ Days', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'status', label: 'Status', type: 'string', sortable: true, defaultVisible: true },
  ],
  TAX_SUMMARY: [
    { key: 'accountCode', label: 'Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account', type: 'string', sortable: true, defaultVisible: true },
    { key: 'taxType', label: 'Tax Type', type: 'string', sortable: true, defaultVisible: true },
    { key: 'collected', label: 'Collected', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'paid', label: 'Paid', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'netTax', label: 'Net Tax', type: 'currency', sortable: true, defaultVisible: true },
  ],
  JOURNAL_DETAIL: [
    { key: 'entryNumber', label: 'Entry #', type: 'string', sortable: true, defaultVisible: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true, defaultVisible: true },
    { key: 'entryDescription', label: 'Entry Description', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountCode', label: 'Account Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account Name', type: 'string', sortable: true, defaultVisible: true },
    { key: 'lineDescription', label: 'Line Description', type: 'string', sortable: false, defaultVisible: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'entryType', label: 'Type', type: 'string', sortable: true, defaultVisible: false },
    { key: 'status', label: 'Status', type: 'string', sortable: true, defaultVisible: true },
    { key: 'reference', label: 'Reference', type: 'string', sortable: true, defaultVisible: false },
    { key: 'costCenter', label: 'Cost Center', type: 'string', sortable: true, defaultVisible: false },
    { key: 'projectCode', label: 'Project Code', type: 'string', sortable: true, defaultVisible: false },
  ],
  TRIAL_BALANCE: [
    { key: 'accountCode', label: 'Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountType', label: 'Type', type: 'string', sortable: true, defaultVisible: true },
    { key: 'debitTotal', label: 'Debit Total', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'creditTotal', label: 'Credit Total', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true, defaultVisible: true },
  ],
  CUSTOM: [
    { key: 'accountCode', label: 'Code', type: 'string', sortable: true, defaultVisible: true },
    { key: 'accountName', label: 'Account', type: 'string', sortable: true, defaultVisible: true },
    { key: 'debit', label: 'Debit', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'credit', label: 'Credit', type: 'currency', sortable: true, defaultVisible: true },
    { key: 'balance', label: 'Balance', type: 'currency', sortable: true, defaultVisible: true },
  ],
};

// ---------------------------------------------------------------------------
// Filter Definitions per Report Type
// ---------------------------------------------------------------------------

const FILTER_DEFS: Record<ReportType, FilterDef[]> = {
  INCOME_STATEMENT: [
    { field: 'accountType', label: 'Account Type', type: 'select', options: [
      { label: 'Revenue', value: 'REVENUE' }, { label: 'Expense', value: 'EXPENSE' },
    ]},
    { field: 'accountCode', label: 'Account Code', type: 'string' },
    { field: 'costCenter', label: 'Cost Center', type: 'string' },
    { field: 'minAmount', label: 'Minimum Amount', type: 'number' },
  ],
  BALANCE_SHEET: [
    { field: 'accountType', label: 'Account Type', type: 'select', options: [
      { label: 'Asset', value: 'ASSET' }, { label: 'Liability', value: 'LIABILITY' }, { label: 'Equity', value: 'EQUITY' },
    ]},
    { field: 'accountCode', label: 'Account Code', type: 'string' },
    { field: 'isActive', label: 'Active Only', type: 'select', options: [
      { label: 'Yes', value: 'true' }, { label: 'No', value: 'false' },
    ]},
  ],
  CASH_FLOW: [
    { field: 'accountCode', label: 'Account Code', type: 'string' },
    { field: 'groupByPeriod', label: 'Group By', type: 'select', options: [
      { label: 'Month', value: 'month' }, { label: 'Quarter', value: 'quarter' }, { label: 'Year', value: 'year' },
    ]},
  ],
  AR_AGING: [
    { field: 'customerName', label: 'Customer', type: 'string' },
    { field: 'status', label: 'Status', type: 'select', options: [
      { label: 'Draft', value: 'DRAFT' }, { label: 'Sent', value: 'SENT' },
      { label: 'Paid', value: 'PAID' }, { label: 'Overdue', value: 'OVERDUE' },
      { label: 'Partial', value: 'PARTIAL' }, { label: 'Void', value: 'VOID' },
    ]},
    { field: 'minBalance', label: 'Minimum Balance', type: 'number' },
  ],
  AP_AGING: [
    { field: 'supplierName', label: 'Supplier', type: 'string' },
    { field: 'status', label: 'Status', type: 'select', options: [
      { label: 'Draft', value: 'DRAFT' }, { label: 'Sent', value: 'SENT' },
      { label: 'Paid', value: 'PAID' }, { label: 'Overdue', value: 'OVERDUE' },
      { label: 'Partial', value: 'PARTIAL' }, { label: 'Void', value: 'VOID' },
    ]},
    { field: 'minBalance', label: 'Minimum Balance', type: 'number' },
  ],
  TAX_SUMMARY: [
    { field: 'taxType', label: 'Tax Type', type: 'select', options: [
      { label: 'TPS/GST', value: 'TPS' }, { label: 'TVQ/QST', value: 'TVQ' },
      { label: 'TVH/HST', value: 'TVH' }, { label: 'PST', value: 'PST' },
    ]},
    { field: 'accountCode', label: 'Account Code', type: 'string' },
  ],
  JOURNAL_DETAIL: [
    { field: 'entryType', label: 'Entry Type', type: 'select', options: [
      { label: 'Manual', value: 'MANUAL' }, { label: 'Auto Sale', value: 'AUTO_SALE' },
      { label: 'Auto Refund', value: 'AUTO_REFUND' }, { label: 'Recurring', value: 'RECURRING' },
      { label: 'Adjustment', value: 'ADJUSTMENT' }, { label: 'Closing', value: 'CLOSING' },
    ]},
    { field: 'status', label: 'Status', type: 'select', options: [
      { label: 'Draft', value: 'DRAFT' }, { label: 'Posted', value: 'POSTED' }, { label: 'Voided', value: 'VOIDED' },
    ]},
    { field: 'accountCode', label: 'Account Code', type: 'string' },
    { field: 'reference', label: 'Reference', type: 'string' },
    { field: 'costCenter', label: 'Cost Center', type: 'string' },
    { field: 'projectCode', label: 'Project Code', type: 'string' },
    { field: 'minAmount', label: 'Minimum Amount', type: 'number' },
  ],
  TRIAL_BALANCE: [
    { field: 'accountType', label: 'Account Type', type: 'select', options: [
      { label: 'Asset', value: 'ASSET' }, { label: 'Liability', value: 'LIABILITY' },
      { label: 'Equity', value: 'EQUITY' }, { label: 'Revenue', value: 'REVENUE' },
      { label: 'Expense', value: 'EXPENSE' },
    ]},
    { field: 'accountCode', label: 'Account Code', type: 'string' },
    { field: 'isActive', label: 'Active Only', type: 'select', options: [
      { label: 'Yes', value: 'true' }, { label: 'No', value: 'false' },
    ]},
    { field: 'showZeroBalances', label: 'Show Zero Balances', type: 'select', options: [
      { label: 'Yes', value: 'true' }, { label: 'No', value: 'false' },
    ]},
  ],
  CUSTOM: [
    { field: 'accountType', label: 'Account Type', type: 'select', options: [
      { label: 'Asset', value: 'ASSET' }, { label: 'Liability', value: 'LIABILITY' },
      { label: 'Equity', value: 'EQUITY' }, { label: 'Revenue', value: 'REVENUE' },
      { label: 'Expense', value: 'EXPENSE' },
    ]},
    { field: 'accountCode', label: 'Account Code', type: 'string' },
    { field: 'costCenter', label: 'Cost Center', type: 'string' },
    { field: 'projectCode', label: 'Project Code', type: 'string' },
  ],
};

// ---------------------------------------------------------------------------
// Report Execution Helpers
// ---------------------------------------------------------------------------

/** Build journal entry date filter from config date range */
function buildDateFilter(config: ReportConfig): { gte?: Date; lte?: Date } | undefined {
  if (!config.dateFrom && !config.dateTo) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (config.dateFrom) filter.gte = new Date(config.dateFrom);
  if (config.dateTo) filter.lte = new Date(config.dateTo);
  return filter;
}

/** Extract a filter value by field name from the config filters array */
function getFilterValue(filters: Filter[], field: string): string | number | string[] | number[] | undefined {
  const f = filters.find((fi) => fi.field === field);
  return f?.value;
}

/** Compute aging bucket for an invoice based on days overdue */
function computeAgingBuckets(dueDate: Date, balance: number, today: Date) {
  const diffMs = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return {
    current: diffDays <= 0 ? balance : 0,
    days30: diffDays > 0 && diffDays <= 30 ? balance : 0,
    days60: diffDays > 31 && diffDays <= 60 ? balance : 0,
    days90: diffDays > 61 && diffDays <= 90 ? balance : 0,
    over90: diffDays > 90 ? balance : 0,
  };
}

/** Get period label from date for cash flow grouping */
function getPeriodLabel(date: Date, groupBy: string): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  switch (groupBy) {
    case 'quarter': {
      const quarter = Math.floor(month / 3) + 1;
      return `Q${quarter} ${year}`;
    }
    case 'year':
      return `${year}`;
    case 'month':
    default:
      return `${year}-${String(month + 1).padStart(2, '0')}`;
  }
}

/** Calculate the comparison date range for previous period / year */
function getComparisonDateRange(config: ReportConfig): { dateFrom: string; dateTo: string; label: string } | null {
  if (!config.compareWith || !config.dateFrom || !config.dateTo) return null;

  const from = new Date(config.dateFrom);
  const to = new Date(config.dateTo);
  const durationMs = to.getTime() - from.getTime();

  if (config.compareWith === 'previous_year') {
    const compFrom = new Date(from);
    compFrom.setFullYear(compFrom.getFullYear() - 1);
    const compTo = new Date(to);
    compTo.setFullYear(compTo.getFullYear() - 1);
    return {
      dateFrom: compFrom.toISOString().slice(0, 10),
      dateTo: compTo.toISOString().slice(0, 10),
      label: `Previous Year (${compFrom.toISOString().slice(0, 10)} - ${compTo.toISOString().slice(0, 10)})`,
    };
  }

  if (config.compareWith === 'previous_period') {
    const compTo = new Date(from.getTime() - 1);
    const compFrom = new Date(compTo.getTime() - durationMs);
    return {
      dateFrom: compFrom.toISOString().slice(0, 10),
      dateTo: compTo.toISOString().slice(0, 10),
      label: `Previous Period (${compFrom.toISOString().slice(0, 10)} - ${compTo.toISOString().slice(0, 10)})`,
    };
  }

  // Budget comparison: use same dates but data from budget
  return null;
}

// ---------------------------------------------------------------------------
// Report Executors
// ---------------------------------------------------------------------------

async function executeIncomeStatement(config: ReportConfig): Promise<ReportResult> {
  const dateFilter = buildDateFilter(config);
  const accountTypeFilter = getFilterValue(config.filters, 'accountType') as string | undefined;
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;
  const costCenterFilter = getFilterValue(config.filters, 'costCenter') as string | undefined;
  const minAmount = getFilterValue(config.filters, 'minAmount') as number | undefined;

  const entryWhere: Prisma.JournalEntryWhereInput = {
    status: 'POSTED',
    deletedAt: null,
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  const entries = await prisma.journalEntry.findMany({
    where: entryWhere,
    include: {
      lines: {
        where: {
          ...(accountCodeFilter ? { account: { code: { startsWith: accountCodeFilter } } } : {}),
          ...(costCenterFilter ? { costCenter: costCenterFilter } : {}),
        },
        include: { account: { select: { code: true, name: true, type: true } } },
      },
    },
    take: MAX_ROWS,
  });

  // Aggregate by account
  const accountMap = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      const acctType = line.account.type;
      // Income statement: only revenue and expense accounts
      if (acctType !== 'REVENUE' && acctType !== 'EXPENSE') continue;
      if (accountTypeFilter && acctType !== accountTypeFilter) continue;

      const key = line.account.code;
      const existing = accountMap.get(key) || { code: line.account.code, name: line.account.name, type: acctType, debit: 0, credit: 0 };
      existing.debit += Number(line.debit);
      existing.credit += Number(line.credit);
      accountMap.set(key, existing);
    }
  }

  let totalRevenue = 0;
  const rows: ReportResultRow[] = [];

  for (const acct of accountMap.values()) {
    const netAmount = acct.type === 'REVENUE'
      ? acct.credit - acct.debit
      : acct.debit - acct.credit;

    if (minAmount && Math.abs(netAmount) < minAmount) continue;
    if (acct.type === 'REVENUE') totalRevenue += netAmount;

    rows.push({
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.type,
      debit: Math.round(acct.debit * 100) / 100,
      credit: Math.round(acct.credit * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    });
  }

  // Add percentages
  if (config.showPercentages && totalRevenue > 0) {
    for (const row of rows) {
      row.percentage = Math.round(((row.netAmount as number) / totalRevenue) * 10000) / 100;
    }
  }

  // Sort
  sortRows(rows, config.orderBy);

  // Totals
  const totals = config.showTotals ? computeTotals(rows, ['debit', 'credit', 'netAmount']) : undefined;

  const selectedColumns = filterColumns(COLUMN_DEFS.INCOME_STATEMENT, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'INCOME_STATEMENT',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0, // filled by caller
    },
  };
}

async function executeBalanceSheet(config: ReportConfig): Promise<ReportResult> {
  const accountTypeFilter = getFilterValue(config.filters, 'accountType') as string | undefined;
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;
  const isActiveFilter = getFilterValue(config.filters, 'isActive') as string | undefined;

  const asOfDate = config.dateTo ? new Date(config.dateTo) : new Date();

  const accountWhere: Prisma.ChartOfAccountWhereInput = {
    ...(isActiveFilter !== 'false' ? { isActive: true } : {}),
    ...(accountTypeFilter ? { type: accountTypeFilter as Prisma.EnumAccountTypeFilter } : {
      type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
    }),
    ...(accountCodeFilter ? { code: { startsWith: accountCodeFilter } } : {}),
  };

  const accounts = await prisma.chartOfAccount.findMany({
    where: accountWhere,
    include: {
      journalLines: {
        where: {
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { lte: asOfDate },
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: 'asc' },
    take: MAX_ROWS,
  });

  const rows: ReportResultRow[] = [];

  for (const acct of accounts) {
    const balance = acct.journalLines.reduce(
      (sum, l) => sum + Number(l.debit) - Number(l.credit),
      0,
    );
    // For liability and equity, negate to show positive
    const displayBalance = (acct.type === 'LIABILITY' || acct.type === 'EQUITY')
      ? -balance
      : balance;

    rows.push({
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.type,
      balance: Math.round(displayBalance * 100) / 100,
      normalBalance: acct.normalBalance,
    });
  }

  sortRows(rows, config.orderBy);

  const totals = config.showTotals ? computeTotals(rows, ['balance']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.BALANCE_SHEET, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'BALANCE_SHEET',
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeCashFlow(config: ReportConfig): Promise<ReportResult> {
  const dateFilter = buildDateFilter(config);
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;
  const groupByPeriod = (getFilterValue(config.filters, 'groupByPeriod') as string) || 'month';

  // Cash accounts start with '10' (cash and bank)
  const entries = await prisma.journalEntry.findMany({
    where: {
      status: 'POSTED',
      deletedAt: null,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      lines: {
        where: {
          account: {
            code: { startsWith: accountCodeFilter || '10' },
          },
        },
        include: { account: { select: { code: true, name: true } } },
      },
    },
    take: MAX_ROWS,
  });

  // Group by period and account
  const periodMap = new Map<string, Map<string, { code: string; name: string; inflow: number; outflow: number }>>();

  for (const entry of entries) {
    const period = getPeriodLabel(entry.date, groupByPeriod);
    if (!periodMap.has(period)) periodMap.set(period, new Map());
    const acctMap = periodMap.get(period)!;

    for (const line of entry.lines) {
      const key = line.account.code;
      const existing = acctMap.get(key) || { code: line.account.code, name: line.account.name, inflow: 0, outflow: 0 };
      existing.inflow += Number(line.debit);
      existing.outflow += Number(line.credit);
      acctMap.set(key, existing);
    }
  }

  const rows: ReportResultRow[] = [];
  for (const [period, acctMap] of periodMap) {
    for (const acct of acctMap.values()) {
      rows.push({
        period,
        accountCode: acct.code,
        accountName: acct.name,
        inflow: Math.round(acct.inflow * 100) / 100,
        outflow: Math.round(acct.outflow * 100) / 100,
        netCashFlow: Math.round((acct.inflow - acct.outflow) * 100) / 100,
      });
    }
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['inflow', 'outflow', 'netCashFlow']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.CASH_FLOW, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'CASH_FLOW',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeArAging(config: ReportConfig): Promise<ReportResult> {
  const customerNameFilter = getFilterValue(config.filters, 'customerName') as string | undefined;
  const statusFilter = getFilterValue(config.filters, 'status') as string | undefined;
  const minBalanceFilter = getFilterValue(config.filters, 'minBalance') as number | undefined;

  const where: Prisma.CustomerInvoiceWhereInput = {
    deletedAt: null,
    ...(customerNameFilter ? { customerName: { contains: customerNameFilter, mode: 'insensitive' as Prisma.QueryMode } } : {}),
    ...(statusFilter ? { status: statusFilter as Prisma.EnumInvoiceStatusFilter } : {}),
    ...(config.dateFrom || config.dateTo ? {
      invoiceDate: {
        ...(config.dateFrom ? { gte: new Date(config.dateFrom) } : {}),
        ...(config.dateTo ? { lte: new Date(config.dateTo) } : {}),
      },
    } : {}),
  };

  const invoices = await prisma.customerInvoice.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    take: MAX_ROWS,
  });

  const today = new Date();
  const rows: ReportResultRow[] = [];

  for (const inv of invoices) {
    const balance = Number(inv.balance);
    if (balance <= 0) continue;
    if (minBalanceFilter && balance < minBalanceFilter) continue;

    const aging = computeAgingBuckets(inv.dueDate, balance, today);

    rows.push({
      customerName: inv.customerName,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
      dueDate: inv.dueDate.toISOString().slice(0, 10),
      total: Math.round(Number(inv.total) * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      current: aging.current,
      days30: aging.days30,
      days60: aging.days60,
      days90: aging.days90,
      over90: aging.over90,
      status: inv.status,
    });
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['total', 'balance', 'current', 'days30', 'days60', 'days90', 'over90']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.AR_AGING, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'AR_AGING',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeApAging(config: ReportConfig): Promise<ReportResult> {
  const supplierNameFilter = getFilterValue(config.filters, 'supplierName') as string | undefined;
  const statusFilter = getFilterValue(config.filters, 'status') as string | undefined;
  const minBalanceFilter = getFilterValue(config.filters, 'minBalance') as number | undefined;

  const where: Prisma.SupplierInvoiceWhereInput = {
    deletedAt: null,
    ...(supplierNameFilter ? { supplierName: { contains: supplierNameFilter, mode: 'insensitive' as Prisma.QueryMode } } : {}),
    ...(statusFilter ? { status: statusFilter as Prisma.EnumInvoiceStatusFilter } : {}),
    ...(config.dateFrom || config.dateTo ? {
      invoiceDate: {
        ...(config.dateFrom ? { gte: new Date(config.dateFrom) } : {}),
        ...(config.dateTo ? { lte: new Date(config.dateTo) } : {}),
      },
    } : {}),
  };

  const invoices = await prisma.supplierInvoice.findMany({
    where,
    orderBy: { dueDate: 'asc' },
    take: MAX_ROWS,
  });

  const today = new Date();
  const rows: ReportResultRow[] = [];

  for (const inv of invoices) {
    const balance = Number(inv.balance);
    if (balance <= 0) continue;
    if (minBalanceFilter && balance < minBalanceFilter) continue;

    const aging = computeAgingBuckets(inv.dueDate, balance, today);

    rows.push({
      supplierName: inv.supplierName,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
      dueDate: inv.dueDate.toISOString().slice(0, 10),
      total: Math.round(Number(inv.total) * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      current: aging.current,
      days30: aging.days30,
      days60: aging.days60,
      days90: aging.days90,
      over90: aging.over90,
      status: inv.status,
    });
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['total', 'balance', 'current', 'days30', 'days60', 'days90', 'over90']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.AP_AGING, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'AP_AGING',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeTaxSummary(config: ReportConfig): Promise<ReportResult> {
  const dateFilter = buildDateFilter(config);
  const taxTypeFilter = getFilterValue(config.filters, 'taxType') as string | undefined;
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;

  // Tax accounts: 2110 (TPS), 2120 (TVQ), 2130 (TVH), 2140 (PST)
  const entries = await prisma.journalEntry.findMany({
    where: {
      status: 'POSTED',
      deletedAt: null,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      lines: {
        where: {
          account: {
            code: accountCodeFilter
              ? { startsWith: accountCodeFilter }
              : { startsWith: '21' },
          },
        },
        include: { account: { select: { code: true, name: true } } },
      },
    },
    take: MAX_ROWS,
  });

  const accountMap = new Map<string, { code: string; name: string; taxType: string; collected: number; paid: number }>();

  for (const entry of entries) {
    for (const line of entry.lines) {
      const code = line.account.code;
      let taxType = 'OTHER';
      if (code.startsWith('211')) taxType = 'TPS';
      else if (code.startsWith('212')) taxType = 'TVQ';
      else if (code.startsWith('213')) taxType = 'TVH';
      else if (code.startsWith('214')) taxType = 'PST';

      if (taxTypeFilter && taxType !== taxTypeFilter) continue;

      const key = code;
      const existing = accountMap.get(key) || { code, name: line.account.name, taxType, collected: 0, paid: 0 };
      existing.collected += Number(line.credit);
      existing.paid += Number(line.debit);
      accountMap.set(key, existing);
    }
  }

  const rows: ReportResultRow[] = [];
  for (const acct of accountMap.values()) {
    rows.push({
      accountCode: acct.code,
      accountName: acct.name,
      taxType: acct.taxType,
      collected: Math.round(acct.collected * 100) / 100,
      paid: Math.round(acct.paid * 100) / 100,
      netTax: Math.round((acct.collected - acct.paid) * 100) / 100,
    });
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['collected', 'paid', 'netTax']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.TAX_SUMMARY, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'TAX_SUMMARY',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeJournalDetail(config: ReportConfig): Promise<ReportResult> {
  const dateFilter = buildDateFilter(config);
  const entryTypeFilter = getFilterValue(config.filters, 'entryType') as string | undefined;
  const statusFilter = getFilterValue(config.filters, 'status') as string | undefined;
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;
  const referenceFilter = getFilterValue(config.filters, 'reference') as string | undefined;
  const costCenterFilter = getFilterValue(config.filters, 'costCenter') as string | undefined;
  const projectCodeFilter = getFilterValue(config.filters, 'projectCode') as string | undefined;
  const minAmount = getFilterValue(config.filters, 'minAmount') as number | undefined;

  const entryWhere: Prisma.JournalEntryWhereInput = {
    deletedAt: null,
    ...(dateFilter ? { date: dateFilter } : {}),
    ...(entryTypeFilter ? { type: entryTypeFilter as Prisma.EnumJournalEntryTypeFilter } : {}),
    ...(statusFilter ? { status: statusFilter as Prisma.EnumJournalEntryStatusFilter } : {}),
    ...(referenceFilter ? { reference: { contains: referenceFilter, mode: 'insensitive' as Prisma.QueryMode } } : {}),
  };

  const entries = await prisma.journalEntry.findMany({
    where: entryWhere,
    include: {
      lines: {
        where: {
          ...(accountCodeFilter ? { account: { code: { startsWith: accountCodeFilter } } } : {}),
          ...(costCenterFilter ? { costCenter: costCenterFilter } : {}),
          ...(projectCodeFilter ? { projectCode: projectCodeFilter } : {}),
        },
        include: { account: { select: { code: true, name: true } } },
      },
    },
    orderBy: { date: 'desc' },
    take: MAX_ROWS,
  });

  const rows: ReportResultRow[] = [];

  for (const entry of entries) {
    for (const line of entry.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      if (minAmount && Math.max(debit, credit) < minAmount) continue;

      rows.push({
        entryNumber: entry.entryNumber,
        date: entry.date.toISOString().slice(0, 10),
        entryDescription: entry.description,
        accountCode: line.account.code,
        accountName: line.account.name,
        lineDescription: line.description || '',
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        entryType: entry.type,
        status: entry.status,
        reference: entry.reference || '',
        costCenter: line.costCenter || '',
        projectCode: line.projectCode || '',
      });
    }
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['debit', 'credit']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.JOURNAL_DETAIL, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'JOURNAL_DETAIL',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeTrialBalance(config: ReportConfig): Promise<ReportResult> {
  const accountTypeFilter = getFilterValue(config.filters, 'accountType') as string | undefined;
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;
  const isActiveFilter = getFilterValue(config.filters, 'isActive') as string | undefined;
  const showZeroBalances = getFilterValue(config.filters, 'showZeroBalances') === 'true';

  const asOfDate = config.dateTo ? new Date(config.dateTo) : new Date();

  const accountWhere: Prisma.ChartOfAccountWhereInput = {
    ...(isActiveFilter !== 'false' ? { isActive: true } : {}),
    ...(accountTypeFilter ? { type: accountTypeFilter as Prisma.EnumAccountTypeFilter } : {}),
    ...(accountCodeFilter ? { code: { startsWith: accountCodeFilter } } : {}),
  };

  const accounts = await prisma.chartOfAccount.findMany({
    where: accountWhere,
    include: {
      journalLines: {
        where: {
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { lte: asOfDate },
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: 'asc' },
    take: MAX_ROWS,
  });

  const rows: ReportResultRow[] = [];

  for (const acct of accounts) {
    const debitTotal = acct.journalLines.reduce((s, l) => s + Number(l.debit), 0);
    const creditTotal = acct.journalLines.reduce((s, l) => s + Number(l.credit), 0);
    const balance = debitTotal - creditTotal;

    if (!showZeroBalances && debitTotal === 0 && creditTotal === 0) continue;

    rows.push({
      accountCode: acct.code,
      accountName: acct.name,
      accountType: acct.type,
      debitTotal: Math.round(debitTotal * 100) / 100,
      creditTotal: Math.round(creditTotal * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['debitTotal', 'creditTotal', 'balance']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.TRIAL_BALANCE, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'TRIAL_BALANCE',
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

async function executeCustomReport(config: ReportConfig): Promise<ReportResult> {
  // Custom reports use journal entries with flexible filtering
  const dateFilter = buildDateFilter(config);
  const accountTypeFilter = getFilterValue(config.filters, 'accountType') as string | undefined;
  const accountCodeFilter = getFilterValue(config.filters, 'accountCode') as string | undefined;
  const costCenterFilter = getFilterValue(config.filters, 'costCenter') as string | undefined;
  const projectCodeFilter = getFilterValue(config.filters, 'projectCode') as string | undefined;

  const entries = await prisma.journalEntry.findMany({
    where: {
      status: 'POSTED',
      deletedAt: null,
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    include: {
      lines: {
        where: {
          ...(accountCodeFilter ? { account: { code: { startsWith: accountCodeFilter } } } : {}),
          ...(accountTypeFilter ? { account: { type: accountTypeFilter as Prisma.EnumAccountTypeFilter } } : {}),
          ...(costCenterFilter ? { costCenter: costCenterFilter } : {}),
          ...(projectCodeFilter ? { projectCode: projectCodeFilter } : {}),
        },
        include: { account: { select: { code: true, name: true, type: true } } },
      },
    },
    take: MAX_ROWS,
  });

  // If groupBy is specified, aggregate; otherwise show detail
  const groupByFields = config.groupBy || [];
  const rows: ReportResultRow[] = [];

  if (groupByFields.length > 0 && groupByFields.includes('accountCode')) {
    // Aggregate by account
    const accountMap = new Map<string, { code: string; name: string; debit: number; credit: number }>();
    for (const entry of entries) {
      for (const line of entry.lines) {
        const key = line.account.code;
        const existing = accountMap.get(key) || { code: line.account.code, name: line.account.name, debit: 0, credit: 0 };
        existing.debit += Number(line.debit);
        existing.credit += Number(line.credit);
        accountMap.set(key, existing);
      }
    }
    for (const acct of accountMap.values()) {
      rows.push({
        accountCode: acct.code,
        accountName: acct.name,
        debit: Math.round(acct.debit * 100) / 100,
        credit: Math.round(acct.credit * 100) / 100,
        balance: Math.round((acct.debit - acct.credit) * 100) / 100,
      });
    }
  } else {
    // Detail view
    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push({
          accountCode: line.account.code,
          accountName: line.account.name,
          debit: Math.round(Number(line.debit) * 100) / 100,
          credit: Math.round(Number(line.credit) * 100) / 100,
          balance: Math.round((Number(line.debit) - Number(line.credit)) * 100) / 100,
        });
      }
    }
  }

  sortRows(rows, config.orderBy);
  const totals = config.showTotals ? computeTotals(rows, ['debit', 'credit', 'balance']) : undefined;
  const selectedColumns = filterColumns(COLUMN_DEFS.CUSTOM, config.columns);

  return {
    columns: selectedColumns,
    rows: rows.slice(0, MAX_ROWS),
    totals,
    metadata: {
      type: 'CUSTOM',
      dateFrom: config.dateFrom,
      dateTo: config.dateTo,
      generatedAt: new Date().toISOString(),
      rowCount: rows.length,
      executionTimeMs: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function sortRows(rows: ReportResultRow[], orderBy?: { field: string; direction: 'asc' | 'desc' }[]) {
  if (!orderBy?.length) return;

  rows.sort((a, b) => {
    for (const { field, direction } of orderBy) {
      const va = a[field];
      const vb = b[field];
      if (va === vb) continue;
      if (va == null) return direction === 'asc' ? -1 : 1;
      if (vb == null) return direction === 'asc' ? 1 : -1;
      const cmp = va < vb ? -1 : 1;
      return direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

function computeTotals(rows: ReportResultRow[], numericFields: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const field of numericFields) {
    totals[field] = Math.round(
      rows.reduce((s, r) => s + (typeof r[field] === 'number' ? (r[field] as number) : 0), 0) * 100,
    ) / 100;
  }
  return totals;
}

function filterColumns(allColumns: ColumnDef[], selectedKeys: string[]): ColumnDef[] {
  if (!selectedKeys.length) return allColumns.filter((c) => c.defaultVisible);
  return allColumns.filter((c) => selectedKeys.includes(c.key));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a report based on configuration.
 */
export async function executeReport(config: ReportConfig): Promise<ReportResult> {
  const startTime = Date.now();

  let result: ReportResult;

  switch (config.type) {
    case 'INCOME_STATEMENT':
      result = await executeIncomeStatement(config);
      break;
    case 'BALANCE_SHEET':
      result = await executeBalanceSheet(config);
      break;
    case 'CASH_FLOW':
      result = await executeCashFlow(config);
      break;
    case 'AR_AGING':
      result = await executeArAging(config);
      break;
    case 'AP_AGING':
      result = await executeApAging(config);
      break;
    case 'TAX_SUMMARY':
      result = await executeTaxSummary(config);
      break;
    case 'JOURNAL_DETAIL':
      result = await executeJournalDetail(config);
      break;
    case 'TRIAL_BALANCE':
      result = await executeTrialBalance(config);
      break;
    case 'CUSTOM':
      result = await executeCustomReport(config);
      break;
    default:
      throw new Error(`Unknown report type: ${config.type}`);
  }

  result.metadata.executionTimeMs = Date.now() - startTime;

  // Handle comparison if requested
  if (config.compareWith && config.compareWith !== 'budget') {
    const compRange = getComparisonDateRange(config);
    if (compRange) {
      const compConfig: ReportConfig = {
        ...config,
        dateFrom: compRange.dateFrom,
        dateTo: compRange.dateTo,
        compareWith: undefined,
      };
      try {
        const compResult = await executeReport(compConfig);
        result.comparison = {
          label: compRange.label,
          rows: compResult.rows,
          totals: compResult.totals,
        };
      } catch (err) {
        logger.warn('Failed to generate comparison report', { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  return result;
}

/**
 * Get available columns for a report type.
 */
export function getAvailableColumns(reportType: string): ColumnDef[] {
  return COLUMN_DEFS[reportType as ReportType] || COLUMN_DEFS.CUSTOM;
}

/**
 * Get available filters for a report type.
 */
export function getAvailableFilters(reportType: string): FilterDef[] {
  return FILTER_DEFS[reportType as ReportType] || FILTER_DEFS.CUSTOM;
}

/**
 * Export report results to CSV format.
 */
export function exportToCSV(result: ReportResult): string {
  const columns = result.columns;
  const headerRow = columns.map((c) => escapeCSV(c.label)).join(',');
  const dataRows = result.rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (val == null) return '';
      if (typeof val === 'number') return String(val);
      return escapeCSV(String(val));
    }).join(','),
  );

  const parts = [headerRow, ...dataRows];

  // Add totals row if available
  if (result.totals) {
    const totalsRow = columns.map((c) => {
      if (result.totals && c.key in result.totals) return String(result.totals[c.key]);
      if (c === columns[0]) return 'TOTALS';
      return '';
    }).join(',');
    parts.push(totalsRow);
  }

  return parts.join('\n');
}

/**
 * Export report results to PDF-ready HTML.
 */
export function exportToPDF(result: ReportResult): string {
  const columns = result.columns;
  const headerCells = columns.map((c) => `<th style="border:1px solid #ddd;padding:8px;background:#f4f4f4;text-align:${c.type === 'currency' || c.type === 'number' ? 'right' : 'left'}">${escapeHTML(c.label)}</th>`).join('');

  const dataRows = result.rows.map((row) => {
    const cells = columns.map((c) => {
      const val = row[c.key];
      const align = c.type === 'currency' || c.type === 'number' ? 'right' : 'left';
      if (val == null) return `<td style="border:1px solid #ddd;padding:6px;text-align:${align}"></td>`;
      if (c.type === 'currency') {
        const num = Number(val);
        const formatted = num.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
        return `<td style="border:1px solid #ddd;padding:6px;text-align:right">${formatted}</td>`;
      }
      return `<td style="border:1px solid #ddd;padding:6px;text-align:${align}">${escapeHTML(String(val))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('\n');

  let totalsRow = '';
  if (result.totals) {
    const cells = columns.map((c) => {
      if (result.totals && c.key in result.totals) {
        const num = result.totals[c.key];
        const formatted = num.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
        return `<td style="border:1px solid #ddd;padding:8px;font-weight:bold;text-align:right;background:#f9f9f9">${formatted}</td>`;
      }
      if (c === columns[0]) return `<td style="border:1px solid #ddd;padding:8px;font-weight:bold;background:#f9f9f9">TOTALS</td>`;
      return `<td style="border:1px solid #ddd;padding:8px;background:#f9f9f9"></td>`;
    }).join('');
    totalsRow = `<tr>${cells}</tr>`;
  }

  const meta = result.metadata;
  const dateRange = meta.dateFrom && meta.dateTo
    ? `${meta.dateFrom} to ${meta.dateTo}`
    : meta.dateTo
      ? `As of ${meta.dateTo}`
      : 'All dates';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Report - ${escapeHTML(meta.type)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #666; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHTML(meta.type.replace(/_/g, ' '))}</h1>
  <div class="meta">
    <span>Period: ${escapeHTML(dateRange)}</span> |
    <span>Generated: ${escapeHTML(meta.generatedAt)}</span> |
    <span>Rows: ${meta.rowCount}</span>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${dataRows}${totalsRow}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Check if cached report data is still valid.
 */
export function isCacheValid(lastRunAt: Date | null): boolean {
  if (!lastRunAt) return false;
  return (Date.now() - lastRunAt.getTime()) < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// String Helpers
// ---------------------------------------------------------------------------

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  config: ReportConfig;
}

export const BUILT_IN_TEMPLATES: ReportTemplate[] = [
  {
    id: 'tpl-income-ytd',
    name: 'Income Statement - Year to Date',
    description: 'Revenue and expenses for the current year',
    type: 'INCOME_STATEMENT',
    config: {
      type: 'INCOME_STATEMENT',
      dateFrom: `${new Date().getFullYear()}-01-01`,
      dateTo: new Date().toISOString().slice(0, 10),
      columns: ['accountCode', 'accountName', 'accountType', 'debit', 'credit', 'netAmount'],
      filters: [],
      showTotals: true,
      showPercentages: true,
      orderBy: [{ field: 'accountCode', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-balance-current',
    name: 'Balance Sheet - Current',
    description: 'Assets, liabilities and equity as of today',
    type: 'BALANCE_SHEET',
    config: {
      type: 'BALANCE_SHEET',
      dateTo: new Date().toISOString().slice(0, 10),
      columns: ['accountCode', 'accountName', 'accountType', 'balance'],
      filters: [],
      showTotals: true,
      orderBy: [{ field: 'accountCode', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-trial-balance',
    name: 'Trial Balance',
    description: 'All accounts with debit/credit totals',
    type: 'TRIAL_BALANCE',
    config: {
      type: 'TRIAL_BALANCE',
      dateTo: new Date().toISOString().slice(0, 10),
      columns: ['accountCode', 'accountName', 'accountType', 'debitTotal', 'creditTotal', 'balance'],
      filters: [],
      showTotals: true,
      orderBy: [{ field: 'accountCode', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-ar-aging',
    name: 'Accounts Receivable Aging',
    description: 'Customer invoices grouped by aging buckets',
    type: 'AR_AGING',
    config: {
      type: 'AR_AGING',
      columns: ['customerName', 'invoiceNumber', 'dueDate', 'balance', 'current', 'days30', 'days60', 'days90', 'over90'],
      filters: [],
      showTotals: true,
      orderBy: [{ field: 'dueDate', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-ap-aging',
    name: 'Accounts Payable Aging',
    description: 'Supplier invoices grouped by aging buckets',
    type: 'AP_AGING',
    config: {
      type: 'AP_AGING',
      columns: ['supplierName', 'invoiceNumber', 'dueDate', 'balance', 'current', 'days30', 'days60', 'days90', 'over90'],
      filters: [],
      showTotals: true,
      orderBy: [{ field: 'dueDate', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-cash-flow-monthly',
    name: 'Cash Flow - Monthly',
    description: 'Cash inflows and outflows by month',
    type: 'CASH_FLOW',
    config: {
      type: 'CASH_FLOW',
      dateFrom: `${new Date().getFullYear()}-01-01`,
      dateTo: new Date().toISOString().slice(0, 10),
      columns: ['period', 'accountName', 'inflow', 'outflow', 'netCashFlow'],
      filters: [{ field: 'groupByPeriod', operator: 'eq', value: 'month' }],
      showTotals: true,
      orderBy: [{ field: 'period', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-tax-summary',
    name: 'Tax Summary',
    description: 'GST/QST/HST collected vs paid',
    type: 'TAX_SUMMARY',
    config: {
      type: 'TAX_SUMMARY',
      dateFrom: `${new Date().getFullYear()}-01-01`,
      dateTo: new Date().toISOString().slice(0, 10),
      columns: ['accountCode', 'accountName', 'taxType', 'collected', 'paid', 'netTax'],
      filters: [],
      showTotals: true,
      orderBy: [{ field: 'accountCode', direction: 'asc' }],
    },
  },
  {
    id: 'tpl-journal-detail',
    name: 'Journal Detail - Posted',
    description: 'All posted journal entries with line details',
    type: 'JOURNAL_DETAIL',
    config: {
      type: 'JOURNAL_DETAIL',
      dateFrom: `${new Date().getFullYear()}-01-01`,
      dateTo: new Date().toISOString().slice(0, 10),
      columns: ['entryNumber', 'date', 'entryDescription', 'accountCode', 'accountName', 'debit', 'credit', 'status'],
      filters: [{ field: 'status', operator: 'eq', value: 'POSTED' }],
      showTotals: true,
      orderBy: [{ field: 'date', direction: 'desc' }],
    },
  },
];

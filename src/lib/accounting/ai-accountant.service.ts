/**
 * AI Conversational Accountant Service
 *
 * Rule-based NLP system that parses natural language accounting questions,
 * routes to appropriate Prisma queries, and returns structured answers
 * with optional chart data. No external AI API calls -- pure keyword
 * matching and pattern recognition.
 *
 * Supported intents (15+):
 *   revenue, expenses, profit, cash_balance, overdue_invoices,
 *   top_customers, recent_transactions, burn_rate, runway,
 *   tax_summary, aging, kpi, comparison_periods, bank_balance,
 *   budget_vs_actual, top_expenses, accounts_payable, accounts_receivable
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentType =
  | 'revenue'
  | 'expenses'
  | 'profit'
  | 'cash_balance'
  | 'overdue_invoices'
  | 'top_customers'
  | 'recent_transactions'
  | 'burn_rate'
  | 'runway'
  | 'tax_summary'
  | 'aging'
  | 'kpi'
  | 'comparison_periods'
  | 'bank_balance'
  | 'budget_vs_actual'
  | 'top_expenses'
  | 'accounts_payable'
  | 'accounts_receivable'
  | 'unknown';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: ChatResponseData;
}

export interface ChatResponseData {
  intent: IntentType;
  answer: string;
  value?: number;
  currency?: string;
  period?: { start: string; end: string };
  table?: {
    headers: string[];
    rows: (string | number)[][];
  };
  chartData?: {
    type: 'bar' | 'line' | 'pie';
    labels: string[];
    values: number[];
    label: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivityAt: Date;
}

// ---------------------------------------------------------------------------
// Intent Pattern Definitions
// ---------------------------------------------------------------------------

interface IntentPattern {
  intent: IntentType;
  keywords: string[];
  patterns: RegExp[];
  /** Higher weight = higher priority when multiple intents match */
  weight: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'revenue',
    keywords: ['revenue', 'revenus', 'sales', 'ventes', 'income', 'chiffre d\'affaires', 'ca', 'turnover', 'recettes'],
    patterns: [
      /(?:what|how much|combien|quel).*(revenue|sales|ventes|revenus|recettes|chiffre)/i,
      /(?:revenue|sales|ventes|revenus|chiffre d'affaires).*(month|year|week|period|mois|ann[eé]e|semaine|p[eé]riode)/i,
      /(?:total|monthly|annual|mensuel).*(revenue|sales|ventes|revenus)/i,
    ],
    weight: 10,
  },
  {
    intent: 'expenses',
    keywords: ['expenses', 'depenses', 'd\u00e9penses', 'costs', 'co\u00fbts', 'couts', 'spending', 'charges'],
    patterns: [
      /(?:what|how much|combien|quel).*(expense|depense|d[eé]pense|co[uû]t|cost|charge)/i,
      /(?:expense|depense|d[eé]pense|co[uû]t|cost|charge).*(month|year|total|mois|ann[eé]e)/i,
      /(?:total|monthly|annual|mensuel).*(expense|depense|d[eé]pense|charge)/i,
    ],
    weight: 10,
  },
  {
    intent: 'profit',
    keywords: ['profit', 'b\u00e9n\u00e9fice', 'benefice', 'net income', 'resultat', 'r\u00e9sultat', 'margin', 'marge', 'bottom line'],
    patterns: [
      /(?:what|how much|combien|quel).*(profit|b[eé]n[eé]fice|resultat|r[eé]sultat|margin|marge)/i,
      /(?:net income|revenu net|profit net)/i,
      /(?:am i|are we|est-ce).*(profitable|rentable)/i,
    ],
    weight: 12,
  },
  {
    intent: 'cash_balance',
    keywords: ['cash', 'tr\u00e9sorerie', 'tresorerie', 'bank balance', 'solde', 'liquid', 'liquidit\u00e9'],
    patterns: [
      /(?:how much|combien).*(cash|tr[eé]sorerie|bank|banque|solde)/i,
      /(?:cash|tr[eé]sorerie).*(balance|solde|available|disponible)/i,
      /(?:solde|balance).*(caisse|bank|banque|cash)/i,
    ],
    weight: 11,
  },
  {
    intent: 'overdue_invoices',
    keywords: ['overdue', 'en retard', 'past due', 'impay\u00e9', 'impaye', 'unpaid', 'late', 'souffrance'],
    patterns: [
      /(?:overdue|en retard|past due|impay[eé]|unpaid|late).*(invoice|facture)/i,
      /(?:invoice|facture).*(overdue|en retard|past due|impay[eé]|unpaid|late)/i,
      /(?:which|what|quelles?|combien).*(overdue|en retard|impay[eé]|unpaid)/i,
    ],
    weight: 13,
  },
  {
    intent: 'top_customers',
    keywords: ['top customers', 'meilleurs clients', 'biggest', 'plus gros', 'best customers', 'principaux clients'],
    patterns: [
      /(?:top|meilleur|biggest|plus gros|principal|best).*(customer|client)/i,
      /(?:customer|client).*(top|meilleur|biggest|revenue|most|plus)/i,
      /(?:who|qui).*(best|biggest|top|meilleur|plus gros).*(customer|client)/i,
    ],
    weight: 10,
  },
  {
    intent: 'recent_transactions',
    keywords: ['recent', 'r\u00e9centes', 'recentes', 'latest', 'derni\u00e8res', 'dernieres', 'last entries', 'transactions'],
    patterns: [
      /(?:recent|latest|last|derni[eè]re|r[eé]cent).*(transaction|entry|entries|[eé]criture|op[eé]ration)/i,
      /(?:show|montre|affiche).*(transaction|entry|entries|[eé]criture)/i,
      /(?:what|quelles?).*(recent|last|derni[eè]re).*(transaction|entry|entries)/i,
    ],
    weight: 8,
  },
  {
    intent: 'burn_rate',
    keywords: ['burn rate', 'taux de combustion', 'monthly burn', 'spending rate', 'rythme de d\u00e9penses'],
    patterns: [
      /burn\s*rate/i,
      /(?:monthly|mensuel).*(burn|spending|d[eé]pense)/i,
      /(?:rythme|taux).*(d[eé]pense|combustion)/i,
    ],
    weight: 11,
  },
  {
    intent: 'runway',
    keywords: ['runway', 'piste', 'how long', 'combien de temps', 'months left', 'mois restants', 'survive'],
    patterns: [
      /runway/i,
      /(?:how long|combien de temps).*(cash|tr[eé]sorerie|last|survive|money|argent|durer)/i,
      /(?:months?|mois).*(left|remaining|restant)/i,
    ],
    weight: 12,
  },
  {
    intent: 'tax_summary',
    keywords: ['tax', 'taxes', 'tps', 'tvq', 'tvh', 'gst', 'hst', 'pst', 'imp\u00f4t', 'impot', 'fiscal'],
    patterns: [
      /(?:tax|tps|tvq|tvh|gst|hst|pst|imp[oô]t|fiscal)/i,
      /(?:how much|combien).*(tax|tps|tvq|imp[oô]t|owe|due|dois)/i,
      /(?:tax|tps|tvq).*(summary|sommaire|total|owed|due)/i,
    ],
    weight: 10,
  },
  {
    intent: 'aging',
    keywords: ['aging', 'vieillissement', 'age', '\u00e2ge', 'receivable aging', 'payable aging'],
    patterns: [
      /(?:aging|vieillissement|[aâ]ge).*(receivable|payable|cr[eé]ance|dette|report)/i,
      /(?:accounts?\s*receivable|comptes?\s*client|cr[eé]ance).*(aging|age|old|vieux)/i,
      /(?:ar|ap)\s*aging/i,
    ],
    weight: 10,
  },
  {
    intent: 'kpi',
    keywords: ['kpi', 'performance', 'indicator', 'indicateur', 'ratio', 'metrics', 'm\u00e9triques', 'dashboard'],
    patterns: [
      /kpi/i,
      /(?:key|principal).*(performance|indicator|indicateur)/i,
      /(?:financial|financier).*(ratio|metric|m[eé]trique)/i,
      /(?:show|montre|what).*(kpi|metric|indicator|ratio|performance)/i,
    ],
    weight: 9,
  },
  {
    intent: 'comparison_periods',
    keywords: ['compare', 'comparer', 'comparison', 'comparaison', 'vs', 'versus', 'difference', 'growth', 'croissance'],
    patterns: [
      /(?:compare|comparer|comparison|comparaison).*(month|year|period|mois|ann[eé]e|p[eé]riode)/i,
      /(?:this month|ce mois).*(vs|versus|compared|compar[eé]|last|dernier)/i,
      /(?:growth|croissance|evolution|[eé]volution)/i,
    ],
    weight: 10,
  },
  {
    intent: 'bank_balance',
    keywords: ['bank balance', 'solde bancaire', 'account balance', 'solde compte', 'bank', 'banque'],
    patterns: [
      /(?:bank|banque|bancaire).*(balance|solde)/i,
      /(?:balance|solde).*(bank|banque|compte)/i,
      /(?:how much|combien).*(bank|banque)/i,
    ],
    weight: 11,
  },
  {
    intent: 'budget_vs_actual',
    keywords: ['budget', 'actual', 'r\u00e9el', 'reel', 'variance', '\u00e9cart', 'ecart', 'budget vs'],
    patterns: [
      /budget\s*(?:vs|versus|compared|compar[eé]|actual|r[eé]el)/i,
      /(?:actual|r[eé]el)\s*(?:vs|versus)\s*budget/i,
      /(?:over|under|d[eé]pass)\s*budget/i,
      /(?:variance|[eé]cart)\s*(?:budget|budg[eé]taire)/i,
    ],
    weight: 12,
  },
  {
    intent: 'top_expenses',
    keywords: ['top expenses', 'biggest expenses', 'plus grosses d\u00e9penses', 'where spending', 'categories'],
    patterns: [
      /(?:top|biggest|largest|plus gross|principal).*(expense|depense|d[eé]pense|cost|co[uû]t)/i,
      /(?:where|o[uù]).*(money|argent|spending|d[eé]pens)/i,
      /(?:expense|depense|d[eé]pense).*(breakdown|categories|r[eé]partition|ventilation)/i,
    ],
    weight: 10,
  },
  {
    intent: 'accounts_payable',
    keywords: ['accounts payable', 'payables', 'fournisseurs', 'ap', 'a payer', '\u00e0 payer', 'supplier', 'vendor'],
    patterns: [
      /(?:accounts?\s*payable|comptes?\s*(?:fournisseur|à payer)|ap\b)/i,
      /(?:how much|combien).*(owe|dois|supplier|fournisseur|pay|payer)/i,
      /(?:supplier|fournisseur|vendor).*(owe|balance|solde|outstanding)/i,
    ],
    weight: 10,
  },
  {
    intent: 'accounts_receivable',
    keywords: ['accounts receivable', 'receivables', 'cr\u00e9ances', 'creances', 'ar', 'clients', '\u00e0 recevoir', 'owed to us'],
    patterns: [
      /(?:accounts?\s*receivable|comptes?\s*(?:client|[àa] recevoir)|ar\b)/i,
      /(?:how much|combien).*(owed|d[uû]|client|receivable|cr[eé]ance)/i,
      /(?:customer|client).*(owe|balance|solde|outstanding|d[uû])/i,
    ],
    weight: 10,
  },
];

// ---------------------------------------------------------------------------
// Date Parsing Helpers
// ---------------------------------------------------------------------------

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

function parseDateRange(text: string): DateRange {
  const now = new Date();
  const lower = text.toLowerCase();

  // "this year" / "cette ann\u00e9e"
  if (/this\s*year|cette\s*ann[eé]e|year\s*to\s*date|ytd|annuel/i.test(lower)) {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: now,
      label: `${now.getFullYear()} YTD`,
    };
  }

  // "last year" / "l'an dernier" / "ann\u00e9e derni\u00e8re"
  if (/last\s*year|l'an\s*dernier|ann[eé]e\s*derni[eè]re|previous\s*year/i.test(lower)) {
    return {
      start: new Date(now.getFullYear() - 1, 0, 1),
      end: new Date(now.getFullYear() - 1, 11, 31),
      label: `${now.getFullYear() - 1}`,
    };
  }

  // "last month" / "mois dernier"
  if (/last\s*month|mois\s*dernier|mois\s*pr[eé]c[eé]dent|previous\s*month/i.test(lower)) {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      start: lastMonth,
      end: new Date(now.getFullYear(), now.getMonth(), 0),
      label: lastMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
    };
  }

  // "last quarter" / "trimestre dernier"
  if (/last\s*quarter|trimestre\s*dernier|previous\s*quarter/i.test(lower)) {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const prevQuarterStart = currentQuarter === 0
      ? new Date(now.getFullYear() - 1, 9, 1)
      : new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    const prevQuarterEnd = currentQuarter === 0
      ? new Date(now.getFullYear() - 1, 11, 31)
      : new Date(now.getFullYear(), currentQuarter * 3, 0);
    return {
      start: prevQuarterStart,
      end: prevQuarterEnd,
      label: `Q${currentQuarter === 0 ? 4 : currentQuarter} ${currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear()}`,
    };
  }

  // "this quarter" / "ce trimestre"
  if (/this\s*quarter|ce\s*trimestre|current\s*quarter/i.test(lower)) {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), currentQuarter * 3, 1),
      end: now,
      label: `Q${currentQuarter + 1} ${now.getFullYear()}`,
    };
  }

  // "last week" / "semaine derni\u00e8re"
  if (/last\s*week|semaine\s*derni[eè]re|previous\s*week/i.test(lower)) {
    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
    return {
      start: lastWeekStart,
      end: lastWeekEnd,
      label: 'Last week',
    };
  }

  // "this week" / "cette semaine"
  if (/this\s*week|cette\s*semaine/i.test(lower)) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return {
      start: weekStart,
      end: now,
      label: 'This week',
    };
  }

  // "today" / "aujourd'hui"
  if (/today|aujourd'?hui/i.test(lower)) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      start: today,
      end: now,
      label: 'Today',
    };
  }

  // "last N months" / "N derniers mois"
  const monthsMatch = lower.match(/(?:last|dernier)\s*(\d+)\s*(?:month|mois)/i);
  if (monthsMatch) {
    const n = parseInt(monthsMatch[1], 10);
    return {
      start: new Date(now.getFullYear(), now.getMonth() - n, 1),
      end: now,
      label: `Last ${n} months`,
    };
  }

  // Default: this month / "ce mois"
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: now,
    label: now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
  };
}

// ---------------------------------------------------------------------------
// Intent Classification
// ---------------------------------------------------------------------------

function classifyIntent(text: string): IntentType {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const textNormalized = text.toLowerCase();

  let bestIntent: IntentType = 'unknown';
  let bestScore = 0;

  for (const pattern of INTENT_PATTERNS) {
    let score = 0;

    // Keyword matching
    for (const kw of pattern.keywords) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(kwNorm) || textNormalized.includes(kw)) {
        score += pattern.weight;
      }
    }

    // Regex pattern matching (higher score)
    for (const regex of pattern.patterns) {
      if (regex.test(text) || regex.test(textNormalized)) {
        score += pattern.weight * 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = pattern.intent;
    }
  }

  return bestIntent;
}

// ---------------------------------------------------------------------------
// Currency Formatter
// ---------------------------------------------------------------------------

function formatCAD(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Query Handlers
// ---------------------------------------------------------------------------

async function handleRevenue(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);

  const result = await prisma.journalLine.aggregate({
    where: {
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { gte: range.start, lte: range.end },
      },
      account: { type: 'REVENUE', isActive: true },
    },
    _sum: { credit: true, debit: true },
  });

  const revenue = round2(Number(result._sum.credit ?? 0) - Number(result._sum.debit ?? 0));

  return {
    intent: 'revenue',
    answer: `Total revenue for ${range.label}: ${formatCAD(revenue)}.`,
    value: revenue,
    currency: 'CAD',
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
  };
}

async function handleExpenses(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);

  const result = await prisma.journalLine.aggregate({
    where: {
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { gte: range.start, lte: range.end },
      },
      account: { type: 'EXPENSE', isActive: true },
    },
    _sum: { debit: true, credit: true },
  });

  const expenses = round2(Number(result._sum.debit ?? 0) - Number(result._sum.credit ?? 0));

  return {
    intent: 'expenses',
    answer: `Total expenses for ${range.label}: ${formatCAD(expenses)}.`,
    value: expenses,
    currency: 'CAD',
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
  };
}

async function handleProfit(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);

  const [revResult, expResult] = await Promise.all([
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
        account: { type: 'REVENUE', isActive: true },
      },
      _sum: { credit: true, debit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
        account: { type: 'EXPENSE', isActive: true },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const revenue = round2(Number(revResult._sum.credit ?? 0) - Number(revResult._sum.debit ?? 0));
  const expenses = round2(Number(expResult._sum.debit ?? 0) - Number(expResult._sum.credit ?? 0));
  const profit = round2(revenue - expenses);
  const margin = revenue !== 0 ? round2((profit / revenue) * 100) : 0;

  return {
    intent: 'profit',
    answer: `Net profit for ${range.label}: ${formatCAD(profit)} (margin: ${margin}%). Revenue: ${formatCAD(revenue)}, Expenses: ${formatCAD(expenses)}.`,
    value: profit,
    currency: 'CAD',
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    chartData: {
      type: 'bar',
      labels: ['Revenue', 'Expenses', 'Profit'],
      values: [revenue, expenses, profit],
      label: `P&L - ${range.label}`,
    },
    metadata: { revenue, expenses, margin },
  };
}

async function handleCashBalance(): Promise<ChatResponseData> {
  const result = await prisma.journalLine.aggregate({
    where: {
      entry: { status: 'POSTED', deletedAt: null },
      account: { type: 'ASSET', isActive: true, code: { startsWith: '10' } },
    },
    _sum: { debit: true, credit: true },
  });

  const cash = round2(Number(result._sum.debit ?? 0) - Number(result._sum.credit ?? 0));

  return {
    intent: 'cash_balance',
    answer: `Current cash balance: ${formatCAD(cash)}.`,
    value: cash,
    currency: 'CAD',
  };
}

async function handleOverdueInvoices(): Promise<ChatResponseData> {
  const now = new Date();

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      status: { in: ['SENT', 'OVERDUE'] },
      dueDate: { lt: now },
      balance: { gt: 0 },
      deletedAt: null,
    },
    select: {
      invoiceNumber: true,
      customerName: true,
      total: true,
      balance: true,
      dueDate: true,
    },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });

  const totalOverdue = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);
  const count = invoices.length;

  const table = {
    headers: ['Invoice #', 'Customer', 'Balance', 'Due Date', 'Days Overdue'],
    rows: invoices.map((inv) => {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return [
        inv.invoiceNumber,
        inv.customerName,
        formatCAD(Number(inv.balance)),
        new Date(inv.dueDate).toISOString().split('T')[0],
        daysOverdue,
      ] as (string | number)[];
    }),
  };

  return {
    intent: 'overdue_invoices',
    answer: `${count} overdue invoice${count !== 1 ? 's' : ''} totaling ${formatCAD(totalOverdue)}.`,
    value: totalOverdue,
    currency: 'CAD',
    table,
    metadata: { count },
  };
}

async function handleTopCustomers(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);

  const customers = await prisma.customerInvoice.groupBy({
    by: ['customerName'],
    where: {
      invoiceDate: { gte: range.start, lte: range.end },
      status: { not: 'VOID' },
      deletedAt: null,
    },
    _sum: { total: true },
    _count: { id: true },
    orderBy: { _sum: { total: 'desc' } },
    take: 10,
  });

  const table = {
    headers: ['Customer', 'Total Revenue', 'Invoices'],
    rows: customers.map((c) => [
      c.customerName,
      formatCAD(Number(c._sum?.total ?? 0)),
      (c._count as Record<string, number>)?.id ?? 0,
    ] as (string | number)[]),
  };

  const chartData = {
    type: 'bar' as const,
    labels: customers.map((c) => c.customerName),
    values: customers.map((c) => round2(Number(c._sum?.total ?? 0))),
    label: `Top Customers - ${range.label}`,
  };

  return {
    intent: 'top_customers',
    answer: `Top ${customers.length} customers for ${range.label}:`,
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    table,
    chartData,
  };
}

async function handleRecentTransactions(): Promise<ChatResponseData> {
  const entries = await prisma.journalEntry.findMany({
    where: { status: 'POSTED', deletedAt: null },
    orderBy: { date: 'desc' },
    take: 15,
    select: {
      entryNumber: true,
      date: true,
      description: true,
      type: true,
      lines: {
        select: { debit: true, credit: true },
      },
    },
  });

  const table = {
    headers: ['Entry #', 'Date', 'Description', 'Type', 'Amount'],
    rows: entries.map((e) => {
      const totalDebit = e.lines.reduce((s, l) => s + Number(l.debit), 0);
      return [
        e.entryNumber,
        new Date(e.date).toISOString().split('T')[0],
        e.description.length > 60 ? e.description.substring(0, 57) + '...' : e.description,
        e.type,
        formatCAD(totalDebit),
      ] as (string | number)[];
    }),
  };

  return {
    intent: 'recent_transactions',
    answer: `Last ${entries.length} posted journal entries:`,
    table,
  };
}

async function handleBurnRate(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);
  const periodDays = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)));

  const result = await prisma.journalLine.aggregate({
    where: {
      entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
      account: { type: 'EXPENSE', isActive: true },
    },
    _sum: { debit: true, credit: true },
  });

  const totalExpenses = round2(Number(result._sum.debit ?? 0) - Number(result._sum.credit ?? 0));
  const monthlyBurn = round2((totalExpenses / periodDays) * 30);
  const dailyBurn = round2(totalExpenses / periodDays);

  return {
    intent: 'burn_rate',
    answer: `Monthly burn rate: ${formatCAD(monthlyBurn)} (${formatCAD(dailyBurn)}/day). Based on ${formatCAD(totalExpenses)} over ${periodDays} days in ${range.label}.`,
    value: monthlyBurn,
    currency: 'CAD',
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    metadata: { totalExpenses, periodDays, dailyBurn },
  };
}

async function handleRunway(): Promise<ChatResponseData> {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const [cashResult, expResult] = await Promise.all([
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null },
        account: { type: 'ASSET', isActive: true, code: { startsWith: '10' } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: threeMonthsAgo, lte: now } },
        account: { type: 'EXPENSE', isActive: true },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const cash = round2(Number(cashResult._sum.debit ?? 0) - Number(cashResult._sum.credit ?? 0));
  const totalExpenses = round2(Number(expResult._sum.debit ?? 0) - Number(expResult._sum.credit ?? 0));
  const periodDays = Math.max(1, Math.round((now.getTime() - threeMonthsAgo.getTime()) / (1000 * 60 * 60 * 24)));
  const monthlyBurn = round2((totalExpenses / periodDays) * 30);
  const runwayMonths = monthlyBurn > 0 ? round2(cash / monthlyBurn) : 0;

  const answer = monthlyBurn > 0
    ? `Cash runway: approximately ${runwayMonths} months. Cash: ${formatCAD(cash)}, avg monthly burn: ${formatCAD(monthlyBurn)}.`
    : `No significant expenses recorded. Current cash: ${formatCAD(cash)}.`;

  return {
    intent: 'runway',
    answer,
    value: runwayMonths,
    currency: 'CAD',
    metadata: { cash, monthlyBurn },
  };
}

async function handleTaxSummary(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      invoiceDate: { gte: range.start, lte: range.end },
      status: { not: 'VOID' },
      deletedAt: null,
    },
    select: { taxTps: true, taxTvq: true, taxTvh: true },
  });

  const supplierInvoices = await prisma.supplierInvoice.findMany({
    where: {
      invoiceDate: { gte: range.start, lte: range.end },
      status: { not: 'VOID' },
      deletedAt: null,
    },
    select: { taxTps: true, taxTvq: true },
  });

  const tpsCollected = invoices.reduce((s, i) => s + Number(i.taxTps), 0);
  const tvqCollected = invoices.reduce((s, i) => s + Number(i.taxTvq), 0);
  const tvhCollected = invoices.reduce((s, i) => s + Number(i.taxTvh), 0);

  const tpsPaid = supplierInvoices.reduce((s, i) => s + Number(i.taxTps), 0);
  const tvqPaid = supplierInvoices.reduce((s, i) => s + Number(i.taxTvq), 0);

  const netTps = round2(tpsCollected - tpsPaid);
  const netTvq = round2(tvqCollected - tvqPaid);
  const netTotal = round2(netTps + netTvq + tvhCollected);

  const table = {
    headers: ['Tax', 'Collected', 'ITC/ITR', 'Net Owing'],
    rows: [
      ['TPS/GST', formatCAD(tpsCollected), formatCAD(tpsPaid), formatCAD(netTps)],
      ['TVQ/QST', formatCAD(tvqCollected), formatCAD(tvqPaid), formatCAD(netTvq)],
      ['TVH/HST', formatCAD(tvhCollected), '$0.00', formatCAD(tvhCollected)],
      ['Total', formatCAD(tpsCollected + tvqCollected + tvhCollected), formatCAD(tpsPaid + tvqPaid), formatCAD(netTotal)],
    ] as (string | number)[][],
  };

  return {
    intent: 'tax_summary',
    answer: `Tax summary for ${range.label}: Net owing ${formatCAD(netTotal)} (TPS: ${formatCAD(netTps)}, TVQ: ${formatCAD(netTvq)}).`,
    value: netTotal,
    currency: 'CAD',
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    table,
  };
}

async function handleAging(): Promise<ChatResponseData> {
  const now = new Date();

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      balance: { gt: 0 },
      status: { in: ['SENT', 'OVERDUE'] },
      deletedAt: null,
    },
    select: {
      invoiceNumber: true,
      customerName: true,
      balance: true,
      dueDate: true,
      invoiceDate: true,
    },
  });

  const buckets = [
    { label: 'Current', min: -9999, max: 0, total: 0, count: 0 },
    { label: '1-30 days', min: 1, max: 30, total: 0, count: 0 },
    { label: '31-60 days', min: 31, max: 60, total: 0, count: 0 },
    { label: '61-90 days', min: 61, max: 90, total: 0, count: 0 },
    { label: '90+ days', min: 91, max: 9999, total: 0, count: 0 },
  ];

  for (const inv of invoices) {
    const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    for (const bucket of buckets) {
      if (daysOverdue >= bucket.min && daysOverdue <= bucket.max) {
        bucket.total += Number(inv.balance);
        bucket.count++;
        break;
      }
    }
  }

  const totalOutstanding = buckets.reduce((s, b) => s + b.total, 0);

  const table = {
    headers: ['Aging Bucket', 'Count', 'Amount', '% of Total'],
    rows: buckets.map((b) => [
      b.label,
      b.count,
      formatCAD(b.total),
      totalOutstanding > 0 ? `${round2((b.total / totalOutstanding) * 100)}%` : '0%',
    ] as (string | number)[]),
  };

  const chartData = {
    type: 'bar' as const,
    labels: buckets.map((b) => b.label),
    values: buckets.map((b) => round2(b.total)),
    label: 'AR Aging',
  };

  return {
    intent: 'aging',
    answer: `Accounts receivable aging: ${formatCAD(round2(totalOutstanding))} outstanding across ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}.`,
    value: round2(totalOutstanding),
    currency: 'CAD',
    table,
    chartData,
  };
}

async function handleKPI(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);
  const periodDays = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)));

  // Fetch all balances in parallel
  const [revResult, expResult, cashResult, arResult, apResult] = await Promise.all([
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
        account: { type: 'REVENUE', isActive: true },
      },
      _sum: { credit: true, debit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
        account: { type: 'EXPENSE', isActive: true },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null },
        account: { type: 'ASSET', isActive: true, code: { startsWith: '10' } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null },
        account: { type: 'ASSET', isActive: true, code: { startsWith: '11' } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null },
        account: { type: 'LIABILITY', isActive: true, code: { startsWith: '20' } },
      },
      _sum: { credit: true, debit: true },
    }),
  ]);

  const revenue = round2(Number(revResult._sum.credit ?? 0) - Number(revResult._sum.debit ?? 0));
  const expenses = round2(Number(expResult._sum.debit ?? 0) - Number(expResult._sum.credit ?? 0));
  const profit = round2(revenue - expenses);
  const netMargin = revenue !== 0 ? round2((profit / revenue) * 100) : 0;
  const cash = round2(Number(cashResult._sum.debit ?? 0) - Number(cashResult._sum.credit ?? 0));
  const receivables = round2(Number(arResult._sum.debit ?? 0) - Number(arResult._sum.credit ?? 0));
  const payables = round2(Number(apResult._sum.credit ?? 0) - Number(apResult._sum.debit ?? 0));
  const monthlyBurn = round2((expenses / periodDays) * 30);
  const runwayMonths = monthlyBurn > 0 ? round2(cash / monthlyBurn) : 0;
  const dso = revenue > 0 ? round2((receivables / revenue) * periodDays) : 0;
  const dpo = expenses > 0 ? round2((payables / expenses) * periodDays) : 0;

  const table = {
    headers: ['KPI', 'Value'],
    rows: [
      ['Revenue', formatCAD(revenue)],
      ['Expenses', formatCAD(expenses)],
      ['Net Profit', formatCAD(profit)],
      ['Net Margin', `${netMargin}%`],
      ['Cash Balance', formatCAD(cash)],
      ['Monthly Burn Rate', formatCAD(monthlyBurn)],
      ['Runway (months)', String(runwayMonths)],
      ['Accounts Receivable', formatCAD(receivables)],
      ['Accounts Payable', formatCAD(payables)],
      ['DSO (days)', String(dso)],
      ['DPO (days)', String(dpo)],
    ] as (string | number)[][],
  };

  return {
    intent: 'kpi',
    answer: `Financial KPIs for ${range.label}: Revenue ${formatCAD(revenue)}, Profit ${formatCAD(profit)} (${netMargin}% margin), Cash ${formatCAD(cash)}, Runway ${runwayMonths} months.`,
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    table,
    metadata: { revenue, expenses, profit, netMargin, cash, monthlyBurn, runwayMonths, receivables, payables, dso, dpo },
  };
}

async function handleComparisonPeriods(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);
  const durationMs = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  const [curRev, curExp, prevRev, prevExp] = await Promise.all([
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
        account: { type: 'REVENUE', isActive: true },
      },
      _sum: { credit: true, debit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
        account: { type: 'EXPENSE', isActive: true },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: prevStart, lte: prevEnd } },
        account: { type: 'REVENUE', isActive: true },
      },
      _sum: { credit: true, debit: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: prevStart, lte: prevEnd } },
        account: { type: 'EXPENSE', isActive: true },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);

  const currentRevenue = round2(Number(curRev._sum.credit ?? 0) - Number(curRev._sum.debit ?? 0));
  const currentExpenses = round2(Number(curExp._sum.debit ?? 0) - Number(curExp._sum.credit ?? 0));
  const currentProfit = round2(currentRevenue - currentExpenses);
  const previousRevenue = round2(Number(prevRev._sum.credit ?? 0) - Number(prevRev._sum.debit ?? 0));
  const previousExpenses = round2(Number(prevExp._sum.debit ?? 0) - Number(prevExp._sum.credit ?? 0));
  const previousProfit = round2(previousRevenue - previousExpenses);

  const revGrowth = previousRevenue !== 0 ? round2(((currentRevenue - previousRevenue) / previousRevenue) * 100) : 0;
  const expGrowth = previousExpenses !== 0 ? round2(((currentExpenses - previousExpenses) / previousExpenses) * 100) : 0;
  const profitGrowth = previousProfit !== 0 ? round2(((currentProfit - previousProfit) / Math.abs(previousProfit)) * 100) : 0;

  const table = {
    headers: ['Metric', 'Current Period', 'Previous Period', 'Change (%)'],
    rows: [
      ['Revenue', formatCAD(currentRevenue), formatCAD(previousRevenue), `${revGrowth > 0 ? '+' : ''}${revGrowth}%`],
      ['Expenses', formatCAD(currentExpenses), formatCAD(previousExpenses), `${expGrowth > 0 ? '+' : ''}${expGrowth}%`],
      ['Profit', formatCAD(currentProfit), formatCAD(previousProfit), `${profitGrowth > 0 ? '+' : ''}${profitGrowth}%`],
    ] as (string | number)[][],
  };

  const chartData = {
    type: 'bar' as const,
    labels: ['Revenue', 'Expenses', 'Profit'],
    values: [currentRevenue, currentExpenses, currentProfit],
    label: `Current vs Previous - ${range.label}`,
  };

  return {
    intent: 'comparison_periods',
    answer: `Period comparison for ${range.label}: Revenue ${revGrowth > 0 ? '+' : ''}${revGrowth}%, Expenses ${expGrowth > 0 ? '+' : ''}${expGrowth}%, Profit ${profitGrowth > 0 ? '+' : ''}${profitGrowth}%.`,
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    table,
    chartData,
    metadata: { currentRevenue, currentExpenses, currentProfit, previousRevenue, previousExpenses, previousProfit },
  };
}

async function handleBankBalance(): Promise<ChatResponseData> {
  const accounts = await prisma.bankAccount.findMany({
    where: { isActive: true },
    select: {
      name: true,
      institution: true,
      currency: true,
      currentBalance: true,
      type: true,
    },
    orderBy: { currentBalance: 'desc' },
  });

  const totalBalance = accounts.reduce((s, a) => s + Number(a.currentBalance), 0);

  const table = {
    headers: ['Account', 'Institution', 'Type', 'Currency', 'Balance'],
    rows: accounts.map((a) => [
      a.name,
      a.institution,
      a.type,
      a.currency,
      formatCAD(Number(a.currentBalance)),
    ] as (string | number)[]),
  };

  return {
    intent: 'bank_balance',
    answer: `Total bank balance across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}: ${formatCAD(round2(totalBalance))}.`,
    value: round2(totalBalance),
    currency: 'CAD',
    table,
  };
}

async function handleBudgetVsActual(_text: string): Promise<ChatResponseData> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ] as const;

  // Get active budget for current year
  const budget = await prisma.budget.findFirst({
    where: { year: currentYear, isActive: true },
    include: { lines: true },
  });

  if (!budget) {
    return {
      intent: 'budget_vs_actual',
      answer: `No active budget found for ${currentYear}. Create a budget first to compare actual vs planned spending.`,
    };
  }

  // Calculate current month actuals from journal entries
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = now;

  const actualExpenses = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      entry: { status: 'POSTED', deletedAt: null, date: { gte: monthStart, lte: monthEnd } },
      account: { type: 'EXPENSE', isActive: true },
    },
    _sum: { debit: true, credit: true },
  });

  // Map account IDs to codes
  const accountIds = actualExpenses.map((a) => a.accountId);
  const accounts = await prisma.chartOfAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true },
  });

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Build comparison
  const rows: (string | number)[][] = [];
  let totalBudgeted = 0;
  let totalActual = 0;

  const monthField = monthNames[currentMonth];

  for (const line of budget.lines) {
    const budgeted = Number(line[monthField]);
    const matchingActuals = actualExpenses.filter((a) => {
      const acc = accountMap.get(a.accountId);
      return acc && acc.code === line.accountCode;
    });

    const actual = matchingActuals.reduce(
      (s, a) => s + Number(a._sum.debit ?? 0) - Number(a._sum.credit ?? 0),
      0,
    );

    if (budgeted > 0 || actual > 0) {
      const variance = round2(actual - budgeted);
      const variancePct = budgeted !== 0 ? round2((variance / budgeted) * 100) : 0;

      rows.push([
        `${line.accountCode} - ${line.accountName}`,
        formatCAD(budgeted),
        formatCAD(actual),
        formatCAD(variance),
        `${variancePct > 0 ? '+' : ''}${variancePct}%`,
      ]);

      totalBudgeted += budgeted;
      totalActual += actual;
    }
  }

  const totalVariance = round2(totalActual - totalBudgeted);
  const totalVariancePct = totalBudgeted !== 0 ? round2((totalVariance / totalBudgeted) * 100) : 0;

  rows.push(['TOTAL', formatCAD(totalBudgeted), formatCAD(totalActual), formatCAD(totalVariance), `${totalVariancePct > 0 ? '+' : ''}${totalVariancePct}%`]);

  const overUnder = totalVariance > 0 ? 'over' : totalVariance < 0 ? 'under' : 'on';

  return {
    intent: 'budget_vs_actual',
    answer: `Budget vs Actual for ${monthNames[currentMonth].charAt(0).toUpperCase() + monthNames[currentMonth].slice(1)} ${currentYear}: ${overUnder} budget by ${formatCAD(Math.abs(totalVariance))} (${totalVariancePct > 0 ? '+' : ''}${totalVariancePct}%). Budgeted: ${formatCAD(totalBudgeted)}, Actual: ${formatCAD(totalActual)}.`,
    value: totalVariance,
    currency: 'CAD',
    table: { headers: ['Account', 'Budget', 'Actual', 'Variance', 'Var %'], rows },
    chartData: {
      type: 'bar',
      labels: ['Budgeted', 'Actual', 'Variance'],
      values: [totalBudgeted, totalActual, totalVariance],
      label: `Budget vs Actual - ${monthNames[currentMonth]} ${currentYear}`,
    },
    metadata: { totalBudgeted, totalActual, totalVariance, totalVariancePct },
  };
}

async function handleTopExpenses(text: string): Promise<ChatResponseData> {
  const range = parseDateRange(text);

  const expenses = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      entry: { status: 'POSTED', deletedAt: null, date: { gte: range.start, lte: range.end } },
      account: { type: 'EXPENSE', isActive: true },
    },
    _sum: { debit: true, credit: true },
    orderBy: { _sum: { debit: 'desc' } },
    take: 10,
  });

  const accountIds = expenses.map((e) => e.accountId);
  const accounts = await prisma.chartOfAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, name: true },
  });

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const totalExpenses = expenses.reduce((s, e) => s + Number(e._sum.debit ?? 0) - Number(e._sum.credit ?? 0), 0);

  const rows = expenses.map((e) => {
    const acc = accountMap.get(e.accountId);
    const amount = round2(Number(e._sum.debit ?? 0) - Number(e._sum.credit ?? 0));
    const pct = totalExpenses > 0 ? round2((amount / totalExpenses) * 100) : 0;
    return [
      acc ? `${acc.code} - ${acc.name}` : e.accountId,
      formatCAD(amount),
      `${pct}%`,
    ] as (string | number)[];
  });

  const chartData = {
    type: 'pie' as const,
    labels: expenses.map((e) => {
      const acc = accountMap.get(e.accountId);
      return acc ? acc.name : 'Unknown';
    }),
    values: expenses.map((e) => round2(Number(e._sum.debit ?? 0) - Number(e._sum.credit ?? 0))),
    label: `Top Expenses - ${range.label}`,
  };

  return {
    intent: 'top_expenses',
    answer: `Top expense categories for ${range.label} (total: ${formatCAD(round2(totalExpenses))}):`,
    value: round2(totalExpenses),
    currency: 'CAD',
    period: { start: range.start.toISOString().split('T')[0], end: range.end.toISOString().split('T')[0] },
    table: { headers: ['Account', 'Amount', '% of Total'], rows },
    chartData,
  };
}

async function handleAccountsPayable(): Promise<ChatResponseData> {
  const invoices = await prisma.supplierInvoice.findMany({
    where: {
      balance: { gt: 0 },
      status: { in: ['DRAFT', 'SENT', 'OVERDUE'] },
      deletedAt: null,
    },
    select: {
      invoiceNumber: true,
      supplierName: true,
      total: true,
      balance: true,
      dueDate: true,
    },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });

  const totalAP = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const now = new Date();

  const table = {
    headers: ['Invoice #', 'Supplier', 'Balance', 'Due Date', 'Status'],
    rows: invoices.map((i) => {
      const daysUntilDue = Math.floor((new Date(i.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntilDue < 0 ? `Overdue ${Math.abs(daysUntilDue)}d` : daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue}d`;
      return [
        i.invoiceNumber,
        i.supplierName,
        formatCAD(Number(i.balance)),
        new Date(i.dueDate).toISOString().split('T')[0],
        status,
      ] as (string | number)[];
    }),
  };

  return {
    intent: 'accounts_payable',
    answer: `Accounts payable: ${formatCAD(round2(totalAP))} across ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}.`,
    value: round2(totalAP),
    currency: 'CAD',
    table,
    metadata: { count: invoices.length },
  };
}

async function handleAccountsReceivable(): Promise<ChatResponseData> {
  const invoices = await prisma.customerInvoice.findMany({
    where: {
      balance: { gt: 0 },
      status: { in: ['SENT', 'OVERDUE'] },
      deletedAt: null,
    },
    select: {
      invoiceNumber: true,
      customerName: true,
      total: true,
      balance: true,
      dueDate: true,
    },
    orderBy: { dueDate: 'asc' },
    take: 20,
  });

  const totalAR = invoices.reduce((s, i) => s + Number(i.balance), 0);
  const now = new Date();

  const table = {
    headers: ['Invoice #', 'Customer', 'Balance', 'Due Date', 'Status'],
    rows: invoices.map((i) => {
      const daysUntilDue = Math.floor((new Date(i.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntilDue < 0 ? `Overdue ${Math.abs(daysUntilDue)}d` : daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue}d`;
      return [
        i.invoiceNumber,
        i.customerName,
        formatCAD(Number(i.balance)),
        new Date(i.dueDate).toISOString().split('T')[0],
        status,
      ] as (string | number)[];
    }),
  };

  return {
    intent: 'accounts_receivable',
    answer: `Accounts receivable: ${formatCAD(round2(totalAR))} across ${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}.`,
    value: round2(totalAR),
    currency: 'CAD',
    table,
    metadata: { count: invoices.length },
  };
}

// ---------------------------------------------------------------------------
// Unknown Intent Handler
// ---------------------------------------------------------------------------

function handleUnknown(): ChatResponseData {
  return {
    intent: 'unknown',
    answer: 'I didn\'t understand your question. You can ask me about revenue, expenses, profit, cash balance, overdue invoices, top customers, recent transactions, burn rate, runway, taxes, aging reports, KPIs, period comparisons, bank balance, budget vs actual, top expenses, accounts payable, or accounts receivable.',
  };
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Process a natural language accounting question and return structured data.
 */
export async function processAccountingQuestion(question: string): Promise<ChatResponseData> {
  const intent = classifyIntent(question);

  logger.info('[AI Accountant] Processing question', { intent, question: question.substring(0, 100) });

  try {
    switch (intent) {
      case 'revenue':
        return await handleRevenue(question);
      case 'expenses':
        return await handleExpenses(question);
      case 'profit':
        return await handleProfit(question);
      case 'cash_balance':
        return await handleCashBalance();
      case 'overdue_invoices':
        return await handleOverdueInvoices();
      case 'top_customers':
        return await handleTopCustomers(question);
      case 'recent_transactions':
        return await handleRecentTransactions();
      case 'burn_rate':
        return await handleBurnRate(question);
      case 'runway':
        return await handleRunway();
      case 'tax_summary':
        return await handleTaxSummary(question);
      case 'aging':
        return await handleAging();
      case 'kpi':
        return await handleKPI(question);
      case 'comparison_periods':
        return await handleComparisonPeriods(question);
      case 'bank_balance':
        return await handleBankBalance();
      case 'budget_vs_actual':
        return await handleBudgetVsActual(question);
      case 'top_expenses':
        return await handleTopExpenses(question);
      case 'accounts_payable':
        return await handleAccountsPayable();
      case 'accounts_receivable':
        return await handleAccountsReceivable();
      default:
        return handleUnknown();
    }
  } catch (error) {
    logger.error('[AI Accountant] Query failed', {
      intent,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      intent,
      answer: `Sorry, I encountered an error while processing your question. Please try again. (${error instanceof Error ? error.message : 'Unknown error'})`,
    };
  }
}

// ---------------------------------------------------------------------------
// Session Management (in-memory with TTL)
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const sessions = new Map<string, ChatSession>();

/** Clean up expired sessions (called on every access) */
function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

/** Get or create a chat session */
export function getOrCreateSession(sessionId: string): ChatSession {
  cleanupSessions();

  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    sessions.set(sessionId, session);
  }

  session.lastActivityAt = new Date();
  return session;
}

/** Get session if it exists */
export function getSession(sessionId: string): ChatSession | undefined {
  cleanupSessions();
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivityAt = new Date();
  }
  return session;
}

/** Add a message to a session */
export function addMessage(session: ChatSession, message: ChatMessage): void {
  session.messages.push(message);
  session.lastActivityAt = new Date();
}

/** Clear a session's messages */
export function clearSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.messages = [];
    session.lastActivityAt = new Date();
  }
}

/** Generate a unique message ID */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Financial Report Templates Service
 * Generates structured data for balance sheet, income statement, and cash flow statement.
 *
 * Phase 10 - Advanced Features
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BalanceSheetData {
  asOfDate: string;
  assets: {
    current: ReportLineItem[];
    nonCurrent: ReportLineItem[];
    totalCurrent: number;
    totalNonCurrent: number;
    totalAssets: number;
  };
  liabilities: {
    current: ReportLineItem[];
    nonCurrent: ReportLineItem[];
    totalCurrent: number;
    totalNonCurrent: number;
    totalLiabilities: number;
  };
  equity: {
    lines: ReportLineItem[];
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export interface IncomeStatementData {
  startDate: string;
  endDate: string;
  revenue: {
    lines: ReportLineItem[];
    totalRevenue: number;
  };
  cogs: {
    lines: ReportLineItem[];
    totalCOGS: number;
  };
  grossProfit: number;
  operatingExpenses: {
    categories: ReportCategory[];
    totalOperatingExpenses: number;
  };
  operatingIncome: number;
  otherIncomeExpense: {
    lines: ReportLineItem[];
    totalOther: number;
  };
  netIncome: number;
}

export interface CashFlowStatementData {
  startDate: string;
  endDate: string;
  operatingActivities: {
    netIncome: number;
    adjustments: ReportLineItem[];
    totalOperating: number;
  };
  investingActivities: {
    lines: ReportLineItem[];
    totalInvesting: number;
  };
  financingActivities: {
    lines: ReportLineItem[];
    totalFinancing: number;
  };
  netChangeInCash: number;
  beginningCashBalance: number;
  endingCashBalance: number;
}

export interface ReportLineItem {
  code: string;
  name: string;
  amount: number;
}

export interface ReportCategory {
  name: string;
  lines: ReportLineItem[];
  subtotal: number;
}

// ---------------------------------------------------------------------------
// Expense category mapping (by account code prefix)
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES: Record<string, string> = {
  '60': 'Expédition',
  '61': 'Frais de traitement',
  '62': 'Marketing',
  '63': 'Technologie',
  '67': 'Services professionnels',
  '68': 'Amortissement',
  '69': "Pertes d'inventaire",
};

function getExpenseCategoryName(code: string): string {
  const prefix2 = code.substring(0, 2);
  return EXPENSE_CATEGORIES[prefix2] || 'Autres dépenses';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

/**
 * Generate a structured balance sheet as of a specific date.
 */
export async function generateBalanceSheet(date: Date): Promise<BalanceSheetData> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
    include: {
      journalLines: {
        where: {
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { lte: date },
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  const currentAssets: ReportLineItem[] = [];
  const nonCurrentAssets: ReportLineItem[] = [];
  const currentLiabilities: ReportLineItem[] = [];
  const nonCurrentLiabilities: ReportLineItem[] = [];
  const equityLines: ReportLineItem[] = [];

  let periodRevenue = 0;
  let periodExpenses = 0;

  for (const acct of accounts) {
    const rawBalance = acct.journalLines.reduce(
      (sum, line) => sum + Number(line.debit) - Number(line.credit),
      0,
    );

    if (Math.abs(rawBalance) < 0.01) continue;

    const code = acct.code;
    const item: ReportLineItem = { code, name: acct.name, amount: 0 };

    switch (acct.type) {
      case 'ASSET':
        item.amount = round2(rawBalance);
        if (parseInt(code) < 1500) {
          currentAssets.push(item);
        } else {
          nonCurrentAssets.push(item);
        }
        break;

      case 'LIABILITY':
        item.amount = round2(-rawBalance);
        if (parseInt(code) < 2500) {
          currentLiabilities.push(item);
        } else {
          nonCurrentLiabilities.push(item);
        }
        break;

      case 'EQUITY':
        item.amount = round2(-rawBalance);
        equityLines.push(item);
        break;

      case 'REVENUE':
        periodRevenue += -rawBalance;
        break;

      case 'EXPENSE':
        periodExpenses += rawBalance;
        break;
    }
  }

  // Add net income as retained earnings for the period
  const netIncome = round2(periodRevenue - periodExpenses);
  if (Math.abs(netIncome) >= 0.01) {
    equityLines.push({
      code: '3999',
      name: 'Résultat net de la période',
      amount: netIncome,
    });
  }

  const totalCurrentAssets = round2(currentAssets.reduce((s, i) => s + i.amount, 0));
  const totalNonCurrentAssets = round2(nonCurrentAssets.reduce((s, i) => s + i.amount, 0));
  const totalAssets = round2(totalCurrentAssets + totalNonCurrentAssets);

  const totalCurrentLiab = round2(currentLiabilities.reduce((s, i) => s + i.amount, 0));
  const totalNonCurrentLiab = round2(nonCurrentLiabilities.reduce((s, i) => s + i.amount, 0));
  const totalLiabilities = round2(totalCurrentLiab + totalNonCurrentLiab);

  const totalEquity = round2(equityLines.reduce((s, i) => s + i.amount, 0));

  return {
    asOfDate: date.toISOString().split('T')[0],
    assets: {
      current: currentAssets,
      nonCurrent: nonCurrentAssets,
      totalCurrent: totalCurrentAssets,
      totalNonCurrent: totalNonCurrentAssets,
      totalAssets,
    },
    liabilities: {
      current: currentLiabilities,
      nonCurrent: nonCurrentLiabilities,
      totalCurrent: totalCurrentLiab,
      totalNonCurrent: totalNonCurrentLiab,
      totalLiabilities,
    },
    equity: {
      lines: equityLines,
      totalEquity,
    },
    totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
  };
}

// ---------------------------------------------------------------------------
// Income Statement (P&L)
// ---------------------------------------------------------------------------

/**
 * Generate a structured income statement for a period.
 */
export async function generateIncomeStatement(
  startDate: Date,
  endDate: Date,
): Promise<IncomeStatementData> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      isActive: true,
      type: { in: ['REVENUE', 'EXPENSE'] },
    },
    include: {
      journalLines: {
        where: {
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { gte: startDate, lte: endDate },
          },
        },
        select: { debit: true, credit: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  const revenueLines: ReportLineItem[] = [];
  const cogsLines: ReportLineItem[] = [];
  const otherLines: ReportLineItem[] = [];
  const expensesByCategory: Record<string, ReportLineItem[]> = {};

  for (const acct of accounts) {
    const rawBalance = acct.journalLines.reduce(
      (sum, line) => sum + Number(line.debit) - Number(line.credit),
      0,
    );

    if (Math.abs(rawBalance) < 0.01) continue;

    const code = acct.code;

    if (code.startsWith('4')) {
      // Revenue (credit-normal, show as positive)
      revenueLines.push({ code, name: acct.name, amount: round2(-rawBalance) });
    } else if (code.startsWith('5')) {
      // COGS (debit-normal)
      cogsLines.push({ code, name: acct.name, amount: round2(rawBalance) });
    } else if (code.startsWith('6')) {
      // Operating expenses grouped by category
      const category = getExpenseCategoryName(code);
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = [];
      }
      expensesByCategory[category].push({ code, name: acct.name, amount: round2(rawBalance) });
    } else if (code.startsWith('7') || code.startsWith('8')) {
      // Other income/expense
      const amount = acct.type === 'REVENUE' ? round2(-rawBalance) : round2(rawBalance);
      otherLines.push({ code, name: acct.name, amount });
    }
  }

  const totalRevenue = round2(revenueLines.reduce((s, i) => s + i.amount, 0));
  const totalCOGS = round2(cogsLines.reduce((s, i) => s + i.amount, 0));
  const grossProfit = round2(totalRevenue - totalCOGS);

  const categories: ReportCategory[] = Object.entries(expensesByCategory).map(
    ([name, lines]) => ({
      name,
      lines,
      subtotal: round2(lines.reduce((s, i) => s + i.amount, 0)),
    }),
  );

  const totalOperatingExpenses = round2(categories.reduce((s, c) => s + c.subtotal, 0));
  const operatingIncome = round2(grossProfit - totalOperatingExpenses);
  const totalOther = round2(otherLines.reduce((s, i) => s + i.amount, 0));
  const netIncome = round2(operatingIncome - totalOther);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    revenue: { lines: revenueLines, totalRevenue },
    cogs: { lines: cogsLines, totalCOGS },
    grossProfit,
    operatingExpenses: { categories, totalOperatingExpenses },
    operatingIncome,
    otherIncomeExpense: { lines: otherLines, totalOther },
    netIncome,
  };
}

// ---------------------------------------------------------------------------
// Cash Flow Statement (Indirect Method)
// ---------------------------------------------------------------------------

/**
 * Calculate the net change in balance for accounts matching a code prefix
 * between two dates. Returns debit-normal result (debit - credit).
 */
async function getAccountBalanceChange(
  codePrefix: string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { code: { startsWith: codePrefix }, isActive: true },
    select: { id: true },
  });

  if (accounts.length === 0) return 0;
  const accountIds = accounts.map((a) => a.id);

  const result = await prisma.journalLine.aggregate({
    where: {
      accountId: { in: accountIds },
      entry: {
        status: 'POSTED',
        deletedAt: null,
        date: { gte: startDate, lte: endDate },
      },
    },
    _sum: { debit: true, credit: true },
  });

  return Number(result._sum.debit ?? 0) - Number(result._sum.credit ?? 0);
}

/**
 * Generate a structured cash flow statement for a period (indirect method).
 */
export async function generateCashFlowStatement(
  startDate: Date,
  endDate: Date,
): Promise<CashFlowStatementData> {
  // 1. Get net income from the income statement
  const incomeStmt = await generateIncomeStatement(startDate, endDate);
  const netIncome = incomeStmt.netIncome;

  // 2. Calculate beginning and ending cash balances
  const cashAccountCodes = ['1010', '1020', '1030', '1040'];

  const cashAccounts = await prisma.chartOfAccount.findMany({
    where: { code: { in: cashAccountCodes }, isActive: true },
    select: { id: true },
  });

  const cashAccountIds = cashAccounts.map((a) => a.id);

  // Beginning balance: sum of cash accounts up to startDate
  const beginningLines = await prisma.journalLine.aggregate({
    where: {
      accountId: { in: cashAccountIds },
      entry: { status: 'POSTED', deletedAt: null, date: { lt: startDate } },
    },
    _sum: { debit: true, credit: true },
  });
  const beginningCashBalance = round2(
    Number(beginningLines._sum.debit ?? 0) - Number(beginningLines._sum.credit ?? 0),
  );

  // Ending balance: sum of cash accounts up to endDate
  const endingLines = await prisma.journalLine.aggregate({
    where: {
      accountId: { in: cashAccountIds },
      entry: { status: 'POSTED', deletedAt: null, date: { lte: endDate } },
    },
    _sum: { debit: true, credit: true },
  });
  const endingCashBalance = round2(
    Number(endingLines._sum.debit ?? 0) - Number(endingLines._sum.credit ?? 0),
  );

  // 3. Operating activities adjustments
  const adjustments: ReportLineItem[] = [];

  // Depreciation (non-cash expense) - add back
  const depreciationAcct = await prisma.chartOfAccount.findFirst({
    where: { code: '6800', isActive: true },
    include: {
      journalLines: {
        where: {
          entry: { status: 'POSTED', deletedAt: null, date: { gte: startDate, lte: endDate } },
        },
        select: { debit: true, credit: true },
      },
    },
  });
  if (depreciationAcct) {
    const depreciation = depreciationAcct.journalLines.reduce(
      (s, l) => s + Number(l.debit) - Number(l.credit),
      0,
    );
    if (Math.abs(depreciation) >= 0.01) {
      adjustments.push({ code: '6800', name: 'Amortissement (ajout)', amount: round2(depreciation) });
    }
  }

  // Changes in accounts receivable (decrease = cash inflow)
  const arChange = await getAccountBalanceChange('11', startDate, endDate);
  if (Math.abs(arChange) >= 0.01) {
    adjustments.push({
      code: '11xx',
      name: 'Variation des comptes débiteurs',
      amount: round2(-arChange),
    });
  }

  // Changes in inventory
  const inventoryChange = await getAccountBalanceChange('12', startDate, endDate);
  if (Math.abs(inventoryChange) >= 0.01) {
    adjustments.push({
      code: '12xx',
      name: 'Variation des stocks',
      amount: round2(-inventoryChange),
    });
  }

  // Changes in prepaid expenses
  const prepaidChange = await getAccountBalanceChange('13', startDate, endDate);
  if (Math.abs(prepaidChange) >= 0.01) {
    adjustments.push({
      code: '13xx',
      name: "Variation des charges payées d'avance",
      amount: round2(-prepaidChange),
    });
  }

  // Changes in accounts payable
  const apChange = await getAccountBalanceChange('20', startDate, endDate);
  if (Math.abs(apChange) >= 0.01) {
    adjustments.push({
      code: '20xx',
      name: 'Variation des comptes fournisseurs',
      amount: round2(-apChange),
    });
  }

  // Changes in tax payable
  const taxChange = await getAccountBalanceChange('21', startDate, endDate);
  if (Math.abs(taxChange) >= 0.01) {
    adjustments.push({
      code: '21xx',
      name: 'Variation des taxes à payer',
      amount: round2(-taxChange),
    });
  }

  const adjustmentsTotal = round2(adjustments.reduce((s, i) => s + i.amount, 0));
  const totalOperating = round2(netIncome + adjustmentsTotal);

  // 4. Investing activities
  const investingLines: ReportLineItem[] = [];
  const equipmentChange = await getAccountBalanceChange('15', startDate, endDate);
  if (Math.abs(equipmentChange) >= 0.01) {
    investingLines.push({
      code: '15xx',
      name: "Acquisition d'équipement",
      amount: round2(-equipmentChange),
    });
  }
  const totalInvesting = round2(investingLines.reduce((s, i) => s + i.amount, 0));

  // 5. Financing activities
  const financingLines: ReportLineItem[] = [];
  const equityChange = await getAccountBalanceChange('30', startDate, endDate);
  if (Math.abs(equityChange) >= 0.01) {
    financingLines.push({
      code: '30xx',
      name: 'Apport en capital',
      amount: round2(-equityChange),
    });
  }
  const deferredRevChange = await getAccountBalanceChange('23', startDate, endDate);
  if (Math.abs(deferredRevChange) >= 0.01) {
    financingLines.push({
      code: '23xx',
      name: 'Variation des revenus reportés',
      amount: round2(-deferredRevChange),
    });
  }
  const totalFinancing = round2(financingLines.reduce((s, i) => s + i.amount, 0));

  const netChangeInCash = round2(totalOperating + totalInvesting + totalFinancing);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    operatingActivities: {
      netIncome,
      adjustments,
      totalOperating,
    },
    investingActivities: {
      lines: investingLines,
      totalInvesting,
    },
    financingActivities: {
      lines: financingLines,
      totalFinancing,
    },
    netChangeInCash,
    beginningCashBalance,
    endingCashBalance,
  };
}

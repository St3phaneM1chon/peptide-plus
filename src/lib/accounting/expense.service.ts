/**
 * Expense Service
 * Manages expenses by department/cost center, budget comparisons
 */

import { prisma } from '@/lib/db';

export const DEPARTMENTS = {
  OPS: 'Opérations',
  MKT: 'Marketing',
  TECH: 'Technologie',
  ADMIN: 'Administration',
  FULFIL: 'Fulfillment / Expédition',
  RD: 'Recherche & Développement',
} as const;

export type DepartmentCode = keyof typeof DEPARTMENTS;

/**
 * Create an expense entry with cost center
 */
export async function createExpenseEntry(data: {
  description: string;
  accountCode: string;
  amount: number;
  date: Date;
  department: DepartmentCode;
  reference?: string;
  createdBy: string;
}): Promise<string> {
  // Find the expense account
  const expenseAccount = await prisma.chartOfAccount.findUnique({
    where: { code: data.accountCode },
    select: { id: true, type: true },
  });
  if (!expenseAccount) throw new Error(`Account not found: ${data.accountCode}`);
  if (expenseAccount.type !== 'EXPENSE') throw new Error(`Account ${data.accountCode} is not an expense account`);

  // Find the bank/payment account (default to main bank)
  const bankAccount = await prisma.chartOfAccount.findUnique({
    where: { code: '1010' },
    select: { id: true },
  });
  if (!bankAccount) throw new Error('Main bank account (1010) not found');

  // Generate entry number inside a transaction to prevent race conditions
  const year = new Date().getFullYear();
  const prefix = `JV-${year}-`;

  const entry = await prisma.$transaction(async (tx) => {
    const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
      SELECT MAX("entryNumber") as max_num
      FROM "JournalEntry"
      WHERE "entryNumber" LIKE ${prefix + '%'}
      FOR UPDATE
    `;

    let nextNum = 1;
    if (maxRow?.max_num) {
      const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const entryNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

    return tx.journalEntry.create({
      data: {
        entryNumber,
        date: data.date,
        description: data.description,
        type: 'MANUAL',
        status: 'POSTED',
        reference: data.reference,
        createdBy: data.createdBy,
        postedBy: data.createdBy,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: expenseAccount.id,
              description: data.description,
              debit: data.amount,
              credit: 0,
              costCenter: data.department,
            },
            {
              accountId: bankAccount.id,
              description: data.description,
              debit: 0,
              credit: data.amount,
            },
          ],
        },
      },
    });
  });

  return entry.id;
}

/**
 * Get expenses grouped by department for a period
 */
export async function getExpensesByDepartment(
  from: Date,
  to: Date
): Promise<Record<string, { department: string; label: string; total: number; count: number }>> {
  const lines = await prisma.journalLine.findMany({
    where: {
      costCenter: { not: null },
      debit: { gt: 0 },
      entry: {
        date: { gte: from, lte: to },
        status: 'POSTED',
      },
      account: { type: 'EXPENSE' },
    },
    select: {
      costCenter: true,
      debit: true,
    },
  });

  const result: Record<string, { department: string; label: string; total: number; count: number }> = {};

  // Initialize all departments
  for (const [code, label] of Object.entries(DEPARTMENTS)) {
    result[code] = { department: code, label, total: 0, count: 0 };
  }

  for (const line of lines) {
    const dept = line.costCenter || 'ADMIN';
    if (!result[dept]) {
      result[dept] = { department: dept, label: dept, total: 0, count: 0 };
    }
    result[dept].total += Number(line.debit);
    result[dept].count++;
  }

  // Round totals
  for (const key of Object.keys(result)) {
    result[key].total = Math.round(result[key].total * 100) / 100;
  }

  return result;
}

/**
 * Get department budget vs actual comparison
 */
export async function getDepartmentBudgetVsActual(
  department: DepartmentCode,
  year: number,
  month?: number
): Promise<{
  department: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
}> {
  // Get budget for this department
  const budget = await prisma.budget.findFirst({
    where: { year, isActive: true },
    include: { lines: true },
  });

  let budgeted = 0;
  if (budget) {
    const monthFields = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ] as const;

    for (const line of budget.lines) {
      if (line.type === 'EXPENSE') {
        if (month) {
          budgeted += Number(line[monthFields[month - 1]]);
        } else {
          budgeted += Number(line.total);
        }
      }
    }
  }

  // Get actual expenses
  let from: Date;
  let to: Date;
  if (month) {
    from = new Date(year, month - 1, 1);
    to = new Date(year, month, 0, 23, 59, 59);
  } else {
    from = new Date(year, 0, 1);
    to = new Date(year, 11, 31, 23, 59, 59);
  }

  const actualResult = await prisma.journalLine.aggregate({
    where: {
      costCenter: department,
      debit: { gt: 0 },
      entry: {
        date: { gte: from, lte: to },
        status: 'POSTED',
      },
      account: { type: 'EXPENSE' },
    },
    _sum: { debit: true },
  });

  const actual = Math.round(Number(actualResult._sum.debit || 0) * 100) / 100;
  budgeted = Math.round(budgeted * 100) / 100;
  const variance = Math.round((budgeted - actual) * 100) / 100;
  const variancePercent = budgeted > 0 ? Math.round((variance / budgeted) * 10000) / 100 : 0;

  return {
    department,
    budgeted,
    actual,
    variance,
    variancePercent,
  };
}

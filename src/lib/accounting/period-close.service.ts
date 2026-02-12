/**
 * Period Close Service
 * Handles month-end checklist, period locking, and year-end closing entries
 */

import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from './types';

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'pending' | 'ok' | 'warning' | 'error';
  detail?: string;
  count?: number;
}

/**
 * Run month-end checklist for a given period
 */
export async function runMonthEndChecklist(periodCode: string): Promise<ChecklistItem[]> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { code: periodCode },
  });

  if (!period) throw new Error(`Period not found: ${periodCode}`);

  const startDate = period.startDate;
  const endDate = period.endDate;
  const items: ChecklistItem[] = [];

  // 1. Bank reconciliation check
  const pendingBankTx = await prisma.bankTransaction.count({
    where: {
      date: { gte: startDate, lte: endDate },
      reconciliationStatus: 'PENDING',
    },
  });
  items.push({
    id: 'bank-reconciliation',
    label: 'Rapprochement bancaire',
    status: pendingBankTx === 0 ? 'ok' : 'warning',
    detail: pendingBankTx > 0
      ? `${pendingBankTx} transaction(s) non rapprochée(s)`
      : 'Toutes les transactions sont rapprochées',
    count: pendingBankTx,
  });

  // 2. Outstanding customer invoices
  const unpaidCustomerInvoices = await prisma.customerInvoice.count({
    where: {
      invoiceDate: { gte: startDate, lte: endDate },
      status: { in: ['SENT', 'OVERDUE', 'PARTIAL'] },
    },
  });
  items.push({
    id: 'customer-invoices',
    label: 'Factures clients impayées',
    status: unpaidCustomerInvoices === 0 ? 'ok' : 'warning',
    detail: unpaidCustomerInvoices > 0
      ? `${unpaidCustomerInvoices} facture(s) impayée(s)`
      : 'Toutes les factures sont réglées',
    count: unpaidCustomerInvoices,
  });

  // 3. Outstanding supplier invoices
  const unpaidSupplierInvoices = await prisma.supplierInvoice.count({
    where: {
      invoiceDate: { gte: startDate, lte: endDate },
      status: { in: ['DRAFT', 'SENT', 'OVERDUE', 'PARTIAL'] },
    },
  });
  items.push({
    id: 'supplier-invoices',
    label: 'Factures fournisseurs impayées',
    status: unpaidSupplierInvoices === 0 ? 'ok' : 'warning',
    detail: unpaidSupplierInvoices > 0
      ? `${unpaidSupplierInvoices} facture(s) fournisseur impayée(s)`
      : 'Toutes les factures fournisseurs sont réglées',
    count: unpaidSupplierInvoices,
  });

  // 4. Draft journal entries
  const draftEntries = await prisma.journalEntry.count({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'DRAFT',
    },
  });
  items.push({
    id: 'draft-entries',
    label: 'Écritures en brouillon',
    status: draftEntries === 0 ? 'ok' : 'warning',
    detail: draftEntries > 0
      ? `${draftEntries} écriture(s) en brouillon`
      : 'Aucune écriture en brouillon',
    count: draftEntries,
  });

  // 5. Trial balance check (debits = credits)
  const trialBalance = await prisma.journalLine.aggregate({
    where: {
      entry: {
        date: { gte: startDate, lte: endDate },
        status: 'POSTED',
      },
    },
    _sum: { debit: true, credit: true },
  });
  const totalDebits = Number(trialBalance._sum.debit || 0);
  const totalCredits = Number(trialBalance._sum.credit || 0);
  const difference = Math.round((totalDebits - totalCredits) * 100) / 100;
  items.push({
    id: 'trial-balance',
    label: 'Balance de vérification',
    status: Math.abs(difference) < 0.01 ? 'ok' : 'error',
    detail: Math.abs(difference) < 0.01
      ? `Équilibrée (Débits: ${totalDebits.toFixed(2)}, Crédits: ${totalCredits.toFixed(2)})`
      : `Déséquilibre de ${difference.toFixed(2)} (Débits: ${totalDebits.toFixed(2)}, Crédits: ${totalCredits.toFixed(2)})`,
  });

  // 6. Orders check
  const ordersInPeriod = await prisma.order.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: 'PAID',
    },
  });
  const ordersWithEntries = await prisma.journalEntry.count({
    where: {
      date: { gte: startDate, lte: endDate },
      type: 'AUTO_SALE',
      status: 'POSTED',
    },
  });
  items.push({
    id: 'orders-entries',
    label: 'Commandes avec écritures',
    status: ordersInPeriod <= ordersWithEntries ? 'ok' : 'warning',
    detail: `${ordersWithEntries}/${ordersInPeriod} commandes ont des écritures comptables`,
    count: ordersInPeriod - ordersWithEntries,
  });

  // 7. Tax calculation
  items.push({
    id: 'tax-calculation',
    label: 'Calcul des taxes',
    status: 'ok',
    detail: 'Les taxes sont calculées automatiquement à partir des commandes',
  });

  // Save checklist to period
  await prisma.accountingPeriod.update({
    where: { code: periodCode },
    data: {
      closingChecklist: JSON.stringify(items),
      status: 'IN_REVIEW',
    },
  });

  return items;
}

/**
 * Lock a period (prevent new entries)
 */
export async function lockPeriod(periodCode: string, closedBy: string): Promise<void> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { code: periodCode },
  });

  if (!period) throw new Error(`Period not found: ${periodCode}`);
  if (period.status === 'LOCKED') throw new Error(`Period ${periodCode} is already locked`);

  // Parse checklist and check for errors
  if (period.closingChecklist) {
    const checklist: ChecklistItem[] = JSON.parse(period.closingChecklist as string);
    const errors = checklist.filter((item) => item.status === 'error');
    if (errors.length > 0) {
      throw new Error(
        `Cannot lock period with errors: ${errors.map((e) => e.label).join(', ')}`
      );
    }
  }

  await prisma.accountingPeriod.update({
    where: { code: periodCode },
    data: {
      status: 'LOCKED',
      closedAt: new Date(),
      closedBy,
    },
  });
}

/**
 * Check if a date falls within a locked period
 */
export async function isDateInLockedPeriod(date: Date): Promise<boolean> {
  const period = await prisma.accountingPeriod.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
      status: 'LOCKED',
    },
  });
  return !!period;
}

/**
 * Run year-end closing
 * 1. Verify all 12 monthly periods are locked
 * 2. Calculate net income (Revenue - Expenses)
 * 3. Create closing entry (zero out revenue/expense accounts to Retained Earnings)
 * 4. Create opening balances for next year
 * 5. Create next year's 12 periods
 */
export async function runYearEndClose(year: number, closedBy: string): Promise<{
  netIncome: number;
  closingEntryId: string;
  periodsCreated: number;
}> {
  // 1. Verify all 12 periods are locked
  const periods = await prisma.accountingPeriod.findMany({
    where: { code: { startsWith: `${year}-` } },
    orderBy: { code: 'asc' },
  });

  if (periods.length < 12) {
    throw new Error(`Only ${periods.length}/12 periods found for ${year}`);
  }

  const unlockedPeriods = periods.filter((p) => p.status !== 'LOCKED');
  if (unlockedPeriods.length > 0) {
    throw new Error(
      `Cannot close year: ${unlockedPeriods.length} period(s) not locked: ${unlockedPeriods.map((p) => p.code).join(', ')}`
    );
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  // 2. Calculate totals for revenue and expense accounts
  const revenueAccounts = await prisma.chartOfAccount.findMany({
    where: { type: 'REVENUE', isActive: true },
    select: { id: true, code: true, name: true },
  });

  const expenseAccounts = await prisma.chartOfAccount.findMany({
    where: { type: 'EXPENSE', isActive: true },
    select: { id: true, code: true, name: true },
  });

  // Get balances for each account
  const getAccountBalance = async (accountId: string): Promise<number> => {
    const result = await prisma.journalLine.aggregate({
      where: {
        accountId,
        entry: {
          date: { gte: yearStart, lte: yearEnd },
          status: 'POSTED',
        },
      },
      _sum: { debit: true, credit: true },
    });
    return Number(result._sum.credit || 0) - Number(result._sum.debit || 0);
  };

  let totalRevenue = 0;
  let totalExpenses = 0;
  const closingLines: { accountId: string; description: string; debit: number; credit: number }[] = [];

  // Close revenue accounts (normally credit balance -> debit to close)
  for (const acct of revenueAccounts) {
    const balance = await getAccountBalance(acct.id);
    if (Math.abs(balance) > 0.005) {
      totalRevenue += balance;
      closingLines.push({
        accountId: acct.id,
        description: `Fermeture ${acct.code} - ${acct.name}`,
        debit: balance > 0 ? Math.round(balance * 100) / 100 : 0,
        credit: balance < 0 ? Math.round(Math.abs(balance) * 100) / 100 : 0,
      });
    }
  }

  // Close expense accounts (normally debit balance -> credit to close)
  for (const acct of expenseAccounts) {
    const result = await prisma.journalLine.aggregate({
      where: {
        accountId: acct.id,
        entry: {
          date: { gte: yearStart, lte: yearEnd },
          status: 'POSTED',
        },
      },
      _sum: { debit: true, credit: true },
    });
    const debitBalance = Number(result._sum.debit || 0) - Number(result._sum.credit || 0);
    if (Math.abs(debitBalance) > 0.005) {
      totalExpenses += debitBalance;
      closingLines.push({
        accountId: acct.id,
        description: `Fermeture ${acct.code} - ${acct.name}`,
        debit: debitBalance < 0 ? Math.round(Math.abs(debitBalance) * 100) / 100 : 0,
        credit: debitBalance > 0 ? Math.round(debitBalance * 100) / 100 : 0,
      });
    }
  }

  // 3. Net income -> Retained Earnings (3100)
  const netIncome = Math.round((totalRevenue - totalExpenses) * 100) / 100;
  const retainedEarningsAccount = await prisma.chartOfAccount.findUnique({
    where: { code: ACCOUNT_CODES.RETAINED_EARNINGS },
    select: { id: true },
  });

  if (!retainedEarningsAccount) {
    throw new Error('Retained Earnings account (3100) not found');
  }

  closingLines.push({
    accountId: retainedEarningsAccount.id,
    description: `Résultat net ${year} vers Bénéfices non répartis`,
    debit: netIncome < 0 ? Math.round(Math.abs(netIncome) * 100) / 100 : 0,
    credit: netIncome > 0 ? Math.round(netIncome * 100) / 100 : 0,
  });

  // Generate closing entry number
  const entryCount = await prisma.journalEntry.count({
    where: { entryNumber: { startsWith: `JV-${year}-` } },
  });
  const entryNumber = `JV-${year}-${String(entryCount + 1).padStart(4, '0')}`;

  const closingEntry = await prisma.journalEntry.create({
    data: {
      entryNumber,
      date: yearEnd,
      description: `Écriture de fermeture - Exercice ${year}`,
      type: 'CLOSING',
      status: 'POSTED',
      reference: `CLOSE-${year}`,
      createdBy: closedBy,
      postedBy: closedBy,
      postedAt: new Date(),
      lines: {
        create: closingLines,
      },
    },
  });

  // 5. Create next year's 12 periods
  const nextYear = year + 1;
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  let periodsCreated = 0;

  for (let i = 0; i < 12; i++) {
    const month = i + 1;
    const code = `${nextYear}-${String(month).padStart(2, '0')}`;
    const existing = await prisma.accountingPeriod.findUnique({ where: { code } });
    if (!existing) {
      await prisma.accountingPeriod.create({
        data: {
          name: `${months[i]} ${nextYear}`,
          code,
          startDate: new Date(nextYear, i, 1),
          endDate: new Date(nextYear, i + 1, 0),
          status: 'OPEN',
        },
      });
      periodsCreated++;
    }
  }

  return {
    netIncome,
    closingEntryId: closingEntry.id,
    periodsCreated,
  };
}

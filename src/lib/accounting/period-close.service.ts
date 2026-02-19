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

  // #90 Audit: Verify ALL journal entries in the period are posted before locking.
  // Draft entries would become permanently inaccessible once the period is locked,
  // so we must ensure they are either posted or voided first.
  const draftCount = await prisma.journalEntry.count({
    where: {
      date: { gte: period.startDate, lte: period.endDate },
      status: 'DRAFT',
      deletedAt: null,
    },
  });
  if (draftCount > 0) {
    throw new Error(
      `Impossible de verrouiller la période: ${draftCount} écriture(s) en brouillon. ` +
      `Toutes les écritures doivent être comptabilisées ou annulées avant le verrouillage.`
    );
  }

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
 * #100 Rollback (reopen) a locked period.
 * This allows correcting entries when a period was locked prematurely.
 * Only OWNER role should call this (enforced at the API route level).
 */
export async function reopenPeriod(
  periodCode: string,
  reopenedBy: string,
  reason: string
): Promise<void> {
  const period = await prisma.accountingPeriod.findUnique({
    where: { code: periodCode },
  });

  if (!period) throw new Error(`Period not found: ${periodCode}`);
  if (period.status !== 'LOCKED') {
    throw new Error(`Period ${periodCode} is not locked (current status: ${period.status})`);
  }

  // #100 Log the reopen action for audit trail before making the change
  console.info('Period reopen:', {
    periodCode,
    reopenedBy,
    reason,
    previouslyClosedBy: period.closedBy,
    previouslyClosedAt: period.closedAt?.toISOString(),
    reopenedAt: new Date().toISOString(),
  });

  // NOTE: We intentionally preserve the original closedAt/closedBy values
  // for audit trail purposes. The reopen event is tracked in the log above.
  // TODO: Add reopenedAt/reopenedBy fields to the AccountingPeriod schema
  // (separate migration task) to formally track reopen events in the DB.
  // For now, the console.info log above serves as the audit trail.
  await prisma.accountingPeriod.update({
    where: { code: periodCode },
    data: {
      status: 'OPEN',
      // Keep closedAt and closedBy for audit trail - do NOT nullify them.
      // The status change to 'OPEN' indicates the period was reopened,
      // while closedAt/closedBy preserve who originally closed it and when.
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

  // Get all account balances in a single query instead of N+1 individual queries
  const allAccountIds = [...revenueAccounts, ...expenseAccounts].map((a) => a.id);
  const accountBalances = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: allAccountIds },
      entry: {
        date: { gte: yearStart, lte: yearEnd },
        status: 'POSTED',
      },
    },
    _sum: { debit: true, credit: true },
  });

  const balanceMap = new Map(
    accountBalances.map((b) => [b.accountId, {
      debit: Number(b._sum.debit || 0),
      credit: Number(b._sum.credit || 0),
    }])
  );

  let totalRevenue = 0;
  let totalExpenses = 0;
  const closingLines: { accountId: string; description: string; debit: number; credit: number }[] = [];

  // Close revenue accounts (normally credit balance -> debit to close)
  for (const acct of revenueAccounts) {
    const bal = balanceMap.get(acct.id);
    const balance = bal ? bal.credit - bal.debit : 0;
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
    const bal = balanceMap.get(acct.id);
    const debitBalance = bal ? bal.debit - bal.credit : 0;
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

  // Wrap closing entry creation + fiscal year + period creation in a single
  // atomic transaction. If any step fails, everything is rolled back to
  // prevent inconsistent state (e.g., closing entry created but periods missing).
  const result = await prisma.$transaction(async (tx) => {
    // Generate closing entry number using MAX() FOR UPDATE for safe numbering
    const prefix = `JV-${year}-`;
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

    const closingEntry = await tx.journalEntry.create({
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
    // #88 Error Recovery: Batch 12 period creations into createMany for efficiency
    const nextYear = year + 1;
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];

    // Check which periods already exist in a single query
    const existingPeriods = await tx.accountingPeriod.findMany({
      where: { code: { startsWith: `${nextYear}-` } },
      select: { code: true },
    });
    const existingCodes = new Set(existingPeriods.map((p) => p.code));

    // Build list of new periods to create
    const newPeriods = [];
    for (let i = 0; i < 12; i++) {
      const month = i + 1;
      const code = `${nextYear}-${String(month).padStart(2, '0')}`;
      if (!existingCodes.has(code)) {
        newPeriods.push({
          name: `${monthNames[i]} ${nextYear}`,
          code,
          startDate: new Date(nextYear, i, 1),
          endDate: new Date(nextYear, i + 1, 0),
          status: 'OPEN',
        });
      }
    }

    let periodsCreated = 0;
    if (newPeriods.length > 0) {
      const createResult = await tx.accountingPeriod.createMany({
        data: newPeriods,
        skipDuplicates: true,
      });
      periodsCreated = createResult.count;
    }

    return {
      netIncome,
      closingEntryId: closingEntry.id,
      periodsCreated,
    };
  });

  return result;
}

/**
 * #100 Rollback a year-end close.
 * This voids the closing entry and reopens all 12 periods for the year.
 * Use with extreme caution - should only be performed by OWNER with valid reason.
 */
export async function rollbackYearEndClose(
  year: number,
  rolledBackBy: string,
  reason: string
): Promise<{
  closingEntryVoided: boolean;
  periodsReopened: number;
}> {
  // Wrap everything in a single atomic transaction to prevent inconsistent state
  // (e.g., closing entry voided but periods still locked if one update fails).
  const result = await prisma.$transaction(async (tx) => {
    // 1. Find and void the closing entry
    const closingEntry = await tx.journalEntry.findFirst({
      where: {
        reference: `CLOSE-${year}`,
        type: 'CLOSING',
        status: 'POSTED',
        deletedAt: null,
      },
    });

    let closingEntryVoided = false;
    if (closingEntry) {
      await tx.journalEntry.update({
        where: { id: closingEntry.id },
        data: {
          status: 'VOIDED',
          voidedBy: rolledBackBy,
          voidedAt: new Date(),
          voidReason: `Annulation clôture ${year}: ${reason}`,
        },
      });
      closingEntryVoided = true;
    }

    // 2. Reopen all 12 periods for the year using updateMany for atomicity
    // instead of individual updates in a loop
    const periodsResult = await tx.accountingPeriod.updateMany({
      where: {
        code: { startsWith: `${year}-` },
        status: 'LOCKED',
      },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedBy: null,
      },
    });

    return {
      closingEntryVoided,
      closingEntryId: closingEntry?.id,
      periodsReopened: periodsResult.count,
    };
  });

  // 3. Audit log (outside transaction - logging should not affect the rollback)
  console.info('Year-end close rollback:', {
    year,
    rolledBackBy,
    reason,
    closingEntryVoided: result.closingEntryVoided,
    closingEntryId: result.closingEntryId,
    periodsReopened: result.periodsReopened,
    rolledBackAt: new Date().toISOString(),
  });

  return {
    closingEntryVoided: result.closingEntryVoided,
    periodsReopened: result.periodsReopened,
  };
}

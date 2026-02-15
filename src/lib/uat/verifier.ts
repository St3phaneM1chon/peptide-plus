/**
 * UAT Verifier
 * 9 categories of verification for the complete accounting pipeline
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from '@/lib/accounting/types';

// =====================================================
// TYPES
// =====================================================

export interface VerificationResult {
  passed: boolean;
  checks: Record<string, boolean>;
  errorCount: number;
}

export interface TaxReportRow {
  region: string;
  salesCount: number;
  totalSales: number;
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  pstCollected: number;
  totalTaxCollected: number;
  expectedTotalTax: number;
  difference: number;
}

export interface TaxReport {
  rows: TaxReportRow[];
  totalSales: number;
  totalTaxCollected: number;
  totalExpectedTax: number;
  totalDifference: number;
}

const TAX_TOLERANCE = 0.02; // 2 cents tolerance for rounding

// =====================================================
// MAIN VERIFIER
// =====================================================

export async function verifyTestCase(testCaseId: string): Promise<VerificationResult> {
  const testCase = await prisma.uatTestCase.findUnique({
    where: { id: testCaseId },
  });

  if (!testCase || !testCase.orderId) {
    return { passed: false, checks: {}, errorCount: 1 };
  }

  const checks: Record<string, boolean> = {};
  let errorCount = 0;

  // 1. ORDER_EXISTS
  const orderCheck = await verifyOrderExists(testCase.orderId, testCaseId, testCase.scenarioCode);
  checks.orderExists = orderCheck;
  if (!orderCheck) errorCount++;

  // 2. TAX_CALCULATION
  const taxCheck = await verifyTaxCalculation(testCase.orderId, testCaseId, testCase.expectedTaxes as { tps: number; tvq: number; tvh: number; pst: number; total: number } | null);
  checks.taxCalculation = taxCheck;
  if (!taxCheck) errorCount++;

  // 3. INVENTORY_CONSUMED
  const inventoryCheck = await verifyInventoryConsumed(testCase.orderId, testCaseId);
  checks.inventoryConsumed = inventoryCheck;
  if (!inventoryCheck) errorCount++;

  // 4. COGS_ENTRY
  const cogsCheck = await verifyCOGSEntry(testCase.orderId, testCaseId);
  checks.cogsEntry = cogsCheck;
  if (!cogsCheck) errorCount++;

  // 5. SALE_ENTRY (pass currency info for tolerance on FX conversions)
  const saleCheck = await verifySaleEntry(testCase.orderId, testCaseId);
  checks.saleEntry = saleCheck;
  if (!saleCheck) errorCount++;

  // 6. JOURNAL_BALANCE
  const balanceCheck = await verifyJournalBalance(testCase.orderId, testCaseId);
  checks.journalBalance = balanceCheck;
  if (!balanceCheck) errorCount++;

  // 7. INVOICE_CREATED
  const invoiceCheck = await verifyInvoiceCreated(testCase.orderId, testCaseId);
  checks.invoiceCreated = invoiceCheck;
  if (!invoiceCheck) errorCount++;

  // 8. FEE_ENTRY (should NOT exist for AureliaPay)
  const feeCheck = await verifyNoFeeEntry(testCase.orderId, testCaseId);
  checks.noFeeEntry = feeCheck;
  if (!feeCheck) errorCount++;

  // 9. REFUND_INTEGRITY (conditional)
  const scenario = testCase.scenarioCode;
  if (scenario.includes('REFUND')) {
    const refundCheck = await verifyRefundIntegrity(testCase.orderId, testCaseId);
    checks.refundIntegrity = refundCheck;
    if (!refundCheck) errorCount++;
  }

  // Update test case with actual taxes and verifications
  const order = await prisma.order.findUnique({
    where: { id: testCase.orderId },
    select: { taxTps: true, taxTvq: true, taxTvh: true, taxPst: true, tax: true, total: true },
  });

  if (order) {
    await prisma.uatTestCase.update({
      where: { id: testCaseId },
      data: {
        actualTaxes: {
          tps: Number(order.taxTps),
          tvq: Number(order.taxTvq),
          tvh: Number(order.taxTvh),
          pst: Number(order.taxPst),
          total: Number(order.tax),
        },
        actualTotal: order.total,
        verifications: checks,
      },
    });
  }

  return {
    passed: errorCount === 0,
    checks,
    errorCount,
  };
}

// =====================================================
// VERIFICATION FUNCTIONS
// =====================================================

/** 1. ORDER_EXISTS */
async function verifyOrderExists(orderId: string, testCaseId: string, scenarioCode: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentStatus: true, paymentMethod: true },
  });

  if (!order) {
    await createError(testCaseId, 'ORDER_MISSING', 'ERROR', 'La commande n\'existe pas en DB', 'EXISTS', 'NOT_FOUND', { orderId });
    return false;
  }

  if (order.paymentMethod !== 'AURELIA_PAY') {
    await createError(testCaseId, 'ORDER_MISSING', 'WARNING', `paymentMethod incorrect: ${order.paymentMethod}`, 'AURELIA_PAY', order.paymentMethod || 'null', { orderId });
    return false;
  }

  // For refund scenarios, REFUNDED is expected
  const isRefundScenario = scenarioCode.includes('REFUND');
  const validStatuses = isRefundScenario ? ['PAID', 'REFUNDED', 'PARTIAL_REFUND'] : ['PAID'];

  if (!validStatuses.includes(order.paymentStatus)) {
    await createError(testCaseId, 'ORDER_MISSING', 'ERROR', `paymentStatus incorrect: ${order.paymentStatus}`, validStatuses.join('|'), order.paymentStatus, { orderId });
    return false;
  }

  return true;
}

/** 2. TAX_CALCULATION */
async function verifyTaxCalculation(orderId: string, testCaseId: string, expectedTaxes: { tps: number; tvq: number; tvh: number; pst: number; total: number } | null): Promise<boolean> {
  if (!expectedTaxes) return true;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { taxTps: true, taxTvq: true, taxTvh: true, taxPst: true, tax: true },
  });

  if (!order) return false;

  let passed = true;

  // Check PST
  if (expectedTaxes.pst !== undefined && expectedTaxes.pst > 0) {
    const diff = Math.abs(Number(order.taxPst) - expectedTaxes.pst);
    if (diff > TAX_TOLERANCE) {
      await createError(testCaseId, 'TAX_MISMATCH', 'ERROR',
        `PST: attendue ${expectedTaxes.pst}$, obtenue ${Number(order.taxPst)}$`,
        String(expectedTaxes.pst), String(Number(order.taxPst)),
        { orderId, taxField: 'pst' });
      passed = false;
    }
  }

  // Check TPS
  if (expectedTaxes.tps !== undefined) {
    const diff = Math.abs(Number(order.taxTps) - expectedTaxes.tps);
    if (diff > TAX_TOLERANCE) {
      await createError(testCaseId, 'TAX_MISMATCH', 'ERROR',
        `TPS: attendue ${expectedTaxes.tps}$, obtenue ${Number(order.taxTps)}$`,
        String(expectedTaxes.tps), String(Number(order.taxTps)),
        { orderId, taxField: 'tps' });
      passed = false;
    }
  }

  // Check TVQ
  if (expectedTaxes.tvq !== undefined) {
    const diff = Math.abs(Number(order.taxTvq) - expectedTaxes.tvq);
    if (diff > TAX_TOLERANCE) {
      await createError(testCaseId, 'TAX_MISMATCH', 'ERROR',
        `TVQ: attendue ${expectedTaxes.tvq}$, obtenue ${Number(order.taxTvq)}$`,
        String(expectedTaxes.tvq), String(Number(order.taxTvq)),
        { orderId, taxField: 'tvq' });
      passed = false;
    }
  }

  // Check TVH
  if (expectedTaxes.tvh !== undefined) {
    const diff = Math.abs(Number(order.taxTvh) - expectedTaxes.tvh);
    if (diff > TAX_TOLERANCE) {
      await createError(testCaseId, 'TAX_MISMATCH', 'ERROR',
        `TVH: attendue ${expectedTaxes.tvh}$, obtenue ${Number(order.taxTvh)}$`,
        String(expectedTaxes.tvh), String(Number(order.taxTvh)),
        { orderId, taxField: 'tvh' });
      passed = false;
    }
  }

  // Check total tax
  if (expectedTaxes.total !== undefined) {
    const diff = Math.abs(Number(order.tax) - expectedTaxes.total);
    if (diff > TAX_TOLERANCE) {
      await createError(testCaseId, 'TAX_MISMATCH', 'ERROR',
        `Total taxes: attendu ${expectedTaxes.total}$, obtenu ${Number(order.tax)}$`,
        String(expectedTaxes.total), String(Number(order.tax)),
        { orderId, taxField: 'total' });
      passed = false;
    }
  }

  return passed;
}

/** 3. INVENTORY_CONSUMED */
async function verifyInventoryConsumed(orderId: string, testCaseId: string): Promise<boolean> {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { orderId, type: 'SALE' },
  });

  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
  });

  if (transactions.length === 0 && orderItems.length > 0) {
    await createError(testCaseId, 'INVENTORY_ERROR', 'ERROR',
      'Aucune InventoryTransaction SALE trouvee pour la commande',
      `${orderItems.length} transactions`, '0 transactions',
      { orderId });
    return false;
  }

  // Verify quantity matches
  for (const item of orderItems) {
    const tx = transactions.find(t => t.formatId === item.formatId);
    if (!tx) {
      await createError(testCaseId, 'INVENTORY_ERROR', 'ERROR',
        `Pas de transaction inventaire pour le format ${item.formatId}`,
        'Transaction SALE', 'ABSENT',
        { orderId, formatId: item.formatId, productName: item.productName });
      return false;
    }
    if (Math.abs(tx.quantity) !== item.quantity) {
      await createError(testCaseId, 'INVENTORY_ERROR', 'ERROR',
        `Quantite inventaire incorrecte pour ${item.productName}`,
        String(item.quantity), String(Math.abs(tx.quantity)),
        { orderId, formatId: item.formatId });
      return false;
    }
  }

  return true;
}

/** 4. COGS_ENTRY */
async function verifyCOGSEntry(orderId: string, testCaseId: string): Promise<boolean> {
  const cogsEntry = await prisma.journalEntry.findFirst({
    where: {
      orderId,
      reference: { startsWith: 'COGS-' },
    },
    include: { lines: true },
  });

  if (!cogsEntry) {
    // Check if WAC is 0 (no purchases recorded) — this is a WARNING, not an ERROR
    const saleTxs = await prisma.inventoryTransaction.findMany({
      where: { orderId, type: 'SALE' },
      select: { unitCost: true },
    });
    const allWacZero = saleTxs.every(tx => Number(tx.unitCost) === 0);

    if (allWacZero) {
      await createError(testCaseId, 'COGS_ERROR', 'WARNING',
        'COGS absent car WAC = 0 (aucun achat enregistre via purchaseStock)',
        'JournalEntry COGS', 'WAC=0',
        { orderId });
      return true; // Pass — WAC=0 is expected when no purchases exist
    }

    await createError(testCaseId, 'COGS_ERROR', 'ERROR',
      'Aucune ecriture COGS trouvee malgre WAC > 0',
      'JournalEntry COGS', 'ABSENT',
      { orderId });
    return false;
  }

  // Verify accounts: Debit 5010, Credit 1210
  const cogsAccount = await prisma.chartOfAccount.findUnique({ where: { code: ACCOUNT_CODES.PURCHASES } });
  const stockAccount = await prisma.chartOfAccount.findUnique({ where: { code: ACCOUNT_CODES.INVENTORY } });

  if (cogsAccount && stockAccount) {
    const debitLine = cogsEntry.lines.find(l => l.accountId === cogsAccount.id && Number(l.debit) > 0);
    const creditLine = cogsEntry.lines.find(l => l.accountId === stockAccount.id && Number(l.credit) > 0);

    if (!debitLine) {
      await createError(testCaseId, 'COGS_ERROR', 'ERROR',
        `COGS: pas de debit sur compte 5010 (${ACCOUNT_CODES.PURCHASES})`,
        'Debit 5010', 'ABSENT',
        { orderId, entryId: cogsEntry.id });
      return false;
    }
    if (!creditLine) {
      await createError(testCaseId, 'COGS_ERROR', 'ERROR',
        `COGS: pas de credit sur compte 1210 (${ACCOUNT_CODES.INVENTORY})`,
        'Credit 1210', 'ABSENT',
        { orderId, entryId: cogsEntry.id });
      return false;
    }
  }

  return true;
}

/** 5. SALE_ENTRY */
async function verifySaleEntry(orderId: string, testCaseId: string): Promise<boolean> {
  const saleEntry = await prisma.journalEntry.findFirst({
    where: {
      orderId,
      type: 'AUTO_SALE',
      reference: { not: { startsWith: 'COGS-' } },
    },
    include: { lines: true },
  });

  if (!saleEntry) {
    await createError(testCaseId, 'JOURNAL_IMBALANCE', 'ERROR',
      'Aucune ecriture de vente (AUTO_SALE) trouvee',
      'JournalEntry AUTO_SALE', 'ABSENT',
      { orderId });
    return false;
  }

  // Verify debit side has bank account
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { total: true, exchangeRate: true },
  });

  if (order) {
    const totalDebit = saleEntry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = saleEntry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

    // For multi-currency orders, journal is in CAD (= order total × exchangeRate)
    const xRate = Number(order.exchangeRate) || 1;
    const expectedCAD = xRate === 1
      ? Number(order.total)
      : Math.round(Number(order.total) * xRate * 100) / 100;

    // Use larger tolerance for FX conversions (rounding can accumulate)
    const tolerance = xRate === 1 ? TAX_TOLERANCE : 0.05;

    // Debit should equal total (in CAD)
    if (Math.abs(totalDebit - expectedCAD) > tolerance) {
      await createError(testCaseId, 'JOURNAL_IMBALANCE', 'ERROR',
        `Debit total (${totalDebit.toFixed(2)}) != total commande en CAD (${expectedCAD.toFixed(2)})`,
        String(expectedCAD), String(totalDebit),
        { orderId, entryId: saleEntry.id, exchangeRate: xRate });
      return false;
    }

    // Credit should equal total (in CAD)
    if (Math.abs(totalCredit - expectedCAD) > tolerance) {
      await createError(testCaseId, 'JOURNAL_IMBALANCE', 'ERROR',
        `Credit total (${totalCredit.toFixed(2)}) != total commande en CAD (${expectedCAD.toFixed(2)})`,
        String(expectedCAD), String(totalCredit),
        { orderId, entryId: saleEntry.id, exchangeRate: xRate });
      return false;
    }
  }

  return true;
}

/** 6. JOURNAL_BALANCE */
async function verifyJournalBalance(orderId: string, testCaseId: string): Promise<boolean> {
  const entries = await prisma.journalEntry.findMany({
    where: { orderId },
    include: { lines: true },
  });

  let allBalanced = true;

  for (const entry of entries) {
    const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    const diff = Math.abs(totalDebit - totalCredit);

    // Allow slightly larger tolerance for FX entries (rounding at each line)
    const xRate = Number(entry.exchangeRate) || 1;
    const tolerance = xRate === 1 ? 0.01 : 0.05;

    if (diff > tolerance) {
      await createError(testCaseId, 'JOURNAL_IMBALANCE', 'ERROR',
        `Ecriture ${entry.entryNumber} desequilibree: Debit=${totalDebit.toFixed(2)}, Credit=${totalCredit.toFixed(2)}, Ecart=${diff.toFixed(2)}`,
        'Debit = Credit', `Ecart ${diff.toFixed(2)}`,
        { orderId, entryId: entry.id, entryNumber: entry.entryNumber, currency: entry.currency });
      allBalanced = false;
    }
  }

  return allBalanced;
}

/** 7. INVOICE_CREATED */
async function verifyInvoiceCreated(orderId: string, testCaseId: string): Promise<boolean> {
  const invoice = await prisma.customerInvoice.findFirst({
    where: { orderId },
  });

  if (!invoice) {
    await createError(testCaseId, 'INVOICE_MISSING', 'ERROR',
      'Aucune facture client (CustomerInvoice) trouvee',
      'CustomerInvoice', 'ABSENT',
      { orderId });
    return false;
  }

  // Verify amounts match order (invoice is in order currency, not CAD)
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { total: true, subtotal: true },
  });

  if (order) {
    const diff = Math.abs(Number(invoice.total) - Number(order.total));
    if (diff > TAX_TOLERANCE) {
      await createError(testCaseId, 'INVOICE_MISSING', 'WARNING',
        `Montant facture (${Number(invoice.total).toFixed(2)}) != total commande (${Number(order.total).toFixed(2)})`,
        String(Number(order.total)), String(Number(invoice.total)),
        { orderId, invoiceId: invoice.id });
      return false;
    }
  }

  return true;
}

/** 8. NO FEE ENTRY (AureliaPay = no Stripe/PayPal fees) */
async function verifyNoFeeEntry(orderId: string, testCaseId: string): Promise<boolean> {
  const feeEntry = await prisma.journalEntry.findFirst({
    where: {
      orderId,
      type: { in: ['AUTO_STRIPE_FEE', 'AUTO_PAYPAL_FEE'] },
    },
  });

  if (feeEntry) {
    await createError(testCaseId, 'FEE_ERROR', 'WARNING',
      `Ecriture de frais ${feeEntry.type} trouvee pour AureliaPay (ne devrait pas exister)`,
      'Aucune ecriture de frais', feeEntry.type,
      { orderId, entryId: feeEntry.id });
    return false;
  }

  return true;
}

/** 9. REFUND_INTEGRITY */
async function verifyRefundIntegrity(orderId: string, testCaseId: string): Promise<boolean> {
  let passed = true;

  // Check CreditNote exists
  const creditNote = await prisma.creditNote.findFirst({ where: { orderId } });
  if (!creditNote) {
    await createError(testCaseId, 'REFUND_ERROR', 'ERROR',
      'CreditNote non trouvee apres remboursement',
      'CreditNote', 'ABSENT',
      { orderId });
    passed = false;
  }

  // Check refund journal entry exists
  const refundEntry = await prisma.journalEntry.findFirst({
    where: { orderId, type: 'AUTO_REFUND' },
    include: { lines: true },
  });

  if (!refundEntry) {
    await createError(testCaseId, 'REFUND_ERROR', 'ERROR',
      'Ecriture de remboursement (AUTO_REFUND) non trouvee',
      'JournalEntry AUTO_REFUND', 'ABSENT',
      { orderId });
    passed = false;
  } else {
    // Verify balance
    const totalDebit = refundEntry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = refundEntry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      await createError(testCaseId, 'REFUND_ERROR', 'ERROR',
        `Ecriture remboursement desequilibree: D=${totalDebit.toFixed(2)}, C=${totalCredit.toFixed(2)}`,
        'Debit = Credit', `D=${totalDebit.toFixed(2)}, C=${totalCredit.toFixed(2)}`,
        { orderId, entryId: refundEntry.id });
      passed = false;
    }
  }

  // Check order status updated
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true },
  });
  if (order && order.paymentStatus !== 'REFUNDED' && order.paymentStatus !== 'PARTIAL_REFUND') {
    await createError(testCaseId, 'REFUND_ERROR', 'ERROR',
      `Statut paiement non mis a jour apres remboursement: ${order.paymentStatus}`,
      'REFUNDED', order.paymentStatus,
      { orderId });
    passed = false;
  }

  return passed;
}

// =====================================================
// TAX REPORT GENERATOR
// =====================================================

export async function generateTaxReport(runId: string): Promise<TaxReport> {
  const testCases = await prisma.uatTestCase.findMany({
    where: { runId, status: { in: ['PASSED', 'FAILED'] }, orderId: { not: null } },
  });

  const regionMap = new Map<string, TaxReportRow>();

  for (const tc of testCases) {
    if (!tc.orderId) continue;

    const order = await prisma.order.findUnique({
      where: { id: tc.orderId },
      select: { subtotal: true, shippingCost: true, taxTps: true, taxTvq: true, taxTvh: true, taxPst: true, tax: true, total: true, exchangeRate: true },
    });

    if (!order) continue;

    const region = tc.region;
    let row = regionMap.get(region);
    if (!row) {
      row = {
        region,
        salesCount: 0,
        totalSales: 0,
        tpsCollected: 0,
        tvqCollected: 0,
        tvhCollected: 0,
        pstCollected: 0,
        totalTaxCollected: 0,
        expectedTotalTax: 0,
        difference: 0,
      };
      regionMap.set(region, row);
    }

    row.salesCount++;
    row.totalSales += Number(order.subtotal) + Number(order.shippingCost);
    row.tpsCollected += Number(order.taxTps);
    row.tvqCollected += Number(order.taxTvq);
    row.tvhCollected += Number(order.taxTvh);
    row.pstCollected += Number(order.taxPst);
    row.totalTaxCollected += Number(order.tax);

    // Expected taxes from test case
    const expected = tc.expectedTaxes as Record<string, number> | null;
    if (expected?.total) {
      row.expectedTotalTax += expected.total;
    }
  }

  const rows = Array.from(regionMap.values()).map(row => ({
    ...row,
    totalSales: Math.round(row.totalSales * 100) / 100,
    tpsCollected: Math.round(row.tpsCollected * 100) / 100,
    tvqCollected: Math.round(row.tvqCollected * 100) / 100,
    tvhCollected: Math.round(row.tvhCollected * 100) / 100,
    pstCollected: Math.round(row.pstCollected * 100) / 100,
    totalTaxCollected: Math.round(row.totalTaxCollected * 100) / 100,
    expectedTotalTax: Math.round(row.expectedTotalTax * 100) / 100,
    difference: Math.round((row.totalTaxCollected - row.expectedTotalTax) * 100) / 100,
  }));

  return {
    rows: rows.sort((a, b) => a.region.localeCompare(b.region)),
    totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
    totalTaxCollected: rows.reduce((s, r) => s + r.totalTaxCollected, 0),
    totalExpectedTax: rows.reduce((s, r) => s + r.expectedTotalTax, 0),
    totalDifference: rows.reduce((s, r) => s + r.difference, 0),
  };
}

// =====================================================
// HELPERS
// =====================================================

async function createError(
  testCaseId: string,
  category: string,
  severity: string,
  message: string,
  expected: string | null,
  actual: string | null,
  context: Record<string, unknown>
): Promise<void> {
  await prisma.uatTestError.create({
    data: { testCaseId, category, severity, message, expected, actual, context: context as Prisma.InputJsonValue },
  });
}

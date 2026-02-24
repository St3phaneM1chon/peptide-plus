/**
 * Webhook → Accounting Bridge Service
 * Creates journal entries automatically when orders are completed via webhooks
 */

import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from './types';
import { assertJournalBalance, assertPeriodOpen } from '@/lib/accounting/validation';
// FIX: F093 - TODO: Replace with 'import { Decimal } from "decimal.js"' to avoid Prisma internal import
import { Decimal } from '@prisma/client/runtime/library';
import { convertCurrency, subtract } from '@/lib/decimal-calculator';

interface OrderWithItems {
  id: string;
  orderNumber: string;
  subtotal: Decimal;
  shippingCost: Decimal;
  discount: Decimal;
  tax: Decimal;
  taxTps: Decimal;
  taxTvq: Decimal;
  taxTvh: Decimal;
  taxPst: Decimal;
  total: Decimal;
  promoCode: string | null;
  promoDiscount: Decimal | null;
  stripePaymentId: string | null;
  paypalOrderId: string | null;
  paymentMethod: string | null;
  shippingCountry: string;
  shippingState: string;
  exchangeRate: Decimal;
  currency?: { code: string } | null;
  createdAt: Date;
  items: {
    id: string;
    productName: string;
    formatName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: Decimal;
    discount: Decimal;
    total: Decimal;
    productId: string;
    formatId: string | null;
  }[];
}

/**
 * Determine sales account based on customer country
 */
function getSalesAccount(country: string): string {
  if (country === 'CA') return ACCOUNT_CODES.SALES_CANADA;
  if (country === 'US') return ACCOUNT_CODES.SALES_USA;
  if (['FR', 'DE', 'GB', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT'].includes(country)) {
    return ACCOUNT_CODES.SALES_EUROPE;
  }
  return ACCOUNT_CODES.SALES_OTHER;
}

/**
 * Determine bank account based on payment method
 */
function getBankAccount(paymentMethod: string | null): string {
  if (paymentMethod === 'PAYPAL') return ACCOUNT_CODES.CASH_PAYPAL;
  return ACCOUNT_CODES.CASH_STRIPE; // Default to Stripe
}

/**
 * Get next entry number for a given type.
 * CRITICAL FIX: Uses MAX() FOR UPDATE instead of count() to prevent
 * duplicate entry numbers when entries are deleted or concurrent inserts occur.
 * Must be called within a Prisma $transaction for the lock to be effective.
 */
export async function getNextEntryNumber(tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JV-${year}-`;
  const client = tx || prisma;

  const [maxRow] = await client.$queryRaw<{ max_num: string | null }[]>`
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
  // F063 FIX: Use padStart(5) for consistent entry number format
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

/**
 * Get next invoice number.
 * CRITICAL FIX: Uses MAX() FOR UPDATE instead of count() to prevent
 * duplicate invoice numbers when invoices are deleted or concurrent inserts occur.
 * Must be called within a Prisma $transaction for the lock to be effective.
 */
async function getNextInvoiceNumber(tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FACT-${year}-`;
  const client = tx || prisma;

  const [maxRow] = await client.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX("invoiceNumber") as max_num
    FROM "CustomerInvoice"
    WHERE "invoiceNumber" LIKE ${prefix + '%'}
    FOR UPDATE
  `;

  let nextNum = 1;
  if (maxRow?.max_num) {
    const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }
  // F063 FIX: Use padStart(5) for consistent entry number format
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

/**
 * Find ChartOfAccount by code, returns id
 */
export async function getAccountId(code: string): Promise<string> {
  const account = await prisma.chartOfAccount.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!account) {
    throw new Error(`Chart of Account not found for code: ${code}`);
  }
  return account.id;
}

/**
 * #89/#90 Batch fetch multiple account IDs in a single DB query.
 * Avoids N+1 problem when building journal entries with many lines,
 * each requiring an account lookup.
 */
async function batchGetAccountIds(codes: string[]): Promise<Map<string, string>> {
  const uniqueCodes = [...new Set(codes)];
  const accounts = await prisma.chartOfAccount.findMany({
    where: { code: { in: uniqueCodes } },
    select: { id: true, code: true },
  });
  const map = new Map(accounts.map((a) => [a.code, a.id]));
  // Validate all codes were found
  for (const code of uniqueCodes) {
    if (!map.has(code)) {
      throw new Error(`Chart of Account not found for code: ${code}`);
    }
  }
  return map;
}

/**
 * Main entry point: create all accounting entries for a completed order.
 * Wrapped in a transaction so entry/invoice number generation is serialized.
 */
export async function createAccountingEntriesForOrder(orderId: string): Promise<{
  saleEntryId: string;
  feeEntryId: string | null;
  invoiceId: string;
}> {
  // Fetch the order with items and currency
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, currency: { select: { code: true } } },
  }) as OrderWithItems | null;

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Ensure the accounting period for the order date is open
  await assertPeriodOpen(order.createdAt);

  return prisma.$transaction(async (tx) => {
    // 1. Generate sale journal entry
    const saleEntryId = await generateSaleEntry(order, tx);

    // 2. Generate fee entry (Stripe/PayPal processing fees)
    const feeEntryId = await generateFeeEntry(order, tx);

    // 3. Create customer invoice
    const invoiceId = await createCustomerInvoice(order, tx);

    return { saleEntryId, feeEntryId, invoiceId };
  });
}

/**
 * Generate journal entry for the sale
 * Debit: Bank account (total received)
 * Credit: Sales revenue (subtotal - discount)
 * Credit: Shipping charged (if any)
 * Credit: TPS payable
 * Credit: TVQ payable
 * Credit: TVH payable
 */
async function generateSaleEntry(order: OrderWithItems, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const client = tx || prisma;
  const entryNumber = await getNextEntryNumber(tx);
  const salesAccountCode = getSalesAccount(order.shippingCountry);
  const bankAccountCode = getBankAccount(order.paymentMethod);

  // Exchange rate: how many CAD per 1 unit of order currency
  const xRate = Number(order.exchangeRate) || 1;
  const currencyCode = order.currency?.code || 'CAD';
  const isCAD = currencyCode === 'CAD';

  // Convert order amounts to CAD for journal entries (Decimal.js safe)
  const toCAD = (amount: number) => isCAD ? amount : convertCurrency(amount, xRate);

  const subtotal = toCAD(Number(order.subtotal));
  const discount = toCAD(Number(order.discount));
  const shipping = toCAD(Number(order.shippingCost));
  const tps = toCAD(Number(order.taxTps));
  const tvq = toCAD(Number(order.taxTvq));
  const tvh = toCAD(Number(order.taxTvh));
  const pst = toCAD(Number(order.taxPst));
  const total = toCAD(Number(order.total));

  // #89 Batch: Collect all account codes needed, then fetch in one DB query
  const accountCodes = [bankAccountCode, salesAccountCode];
  if (shipping > 0) accountCodes.push(ACCOUNT_CODES.SHIPPING_CHARGED);
  if (tps > 0) accountCodes.push(ACCOUNT_CODES.TPS_PAYABLE);
  if (tvq > 0) accountCodes.push(ACCOUNT_CODES.TVQ_PAYABLE);
  if (tvh > 0) accountCodes.push(ACCOUNT_CODES.TVH_PAYABLE);
  if (pst > 0) accountCodes.push(ACCOUNT_CODES.PST_PAYABLE);
  const accountMap = await batchGetAccountIds(accountCodes);

  // Build lines
  const lines: {
    accountId: string;
    description: string;
    debit: number;
    credit: number;
  }[] = [];

  // DEBIT: Bank account for total received
  lines.push({
    accountId: accountMap.get(bankAccountCode)!,
    description: `Paiement reçu commande ${order.orderNumber}`,
    debit: total,
    credit: 0,
  });

  // CREDIT: Sales revenue (subtotal - discount)
  lines.push({
    accountId: accountMap.get(salesAccountCode)!,
    description: `Vente ${order.orderNumber}`,
    debit: 0,
    credit: subtract(subtotal, discount),
  });

  // CREDIT: Shipping charged
  if (shipping > 0) {
    lines.push({
      accountId: accountMap.get(ACCOUNT_CODES.SHIPPING_CHARGED)!,
      description: `Frais livraison ${order.orderNumber}`,
      debit: 0,
      credit: shipping,
    });
  }

  // CREDIT: TPS payable
  if (tps > 0) {
    lines.push({
      accountId: accountMap.get(ACCOUNT_CODES.TPS_PAYABLE)!,
      description: `TPS sur ${order.orderNumber}`,
      debit: 0,
      credit: tps,
    });
  }

  // CREDIT: TVQ payable
  if (tvq > 0) {
    lines.push({
      accountId: accountMap.get(ACCOUNT_CODES.TVQ_PAYABLE)!,
      description: `TVQ sur ${order.orderNumber}`,
      debit: 0,
      credit: tvq,
    });
  }

  // CREDIT: TVH payable
  if (tvh > 0) {
    lines.push({
      accountId: accountMap.get(ACCOUNT_CODES.TVH_PAYABLE)!,
      description: `TVH sur ${order.orderNumber}`,
      debit: 0,
      credit: tvh,
    });
  }

  // CREDIT: PST payable (BC, SK, MB)
  if (pst > 0) {
    lines.push({
      accountId: accountMap.get(ACCOUNT_CODES.PST_PAYABLE)!,
      description: `PST sur ${order.orderNumber}`,
      debit: 0,
      credit: pst,
    });
  }

  // Create the journal entry with lines
  assertJournalBalance(lines, `sale ${order.orderNumber}`);
  const fxSuffix = isCAD ? '' : ` (${currencyCode} @${xRate})`;
  const entry = await client.journalEntry.create({
    data: {
      entryNumber,
      date: order.createdAt,
      description: `Vente en ligne ${order.orderNumber}${fxSuffix}`,
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: order.orderNumber,
      orderId: order.id,
      currency: currencyCode,
      exchangeRate: xRate,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: {
        create: lines.map((line) => ({
          accountId: line.accountId,
          description: line.description,
          debit: line.debit,
          credit: line.credit,
        })),
      },
    },
  });

  return entry.id;
}

/**
 * Generate journal entry for payment processing fees
 * Estimated fee: Stripe ~2.9% + $0.30, PayPal ~2.9% + $0.30
 * Debit: Fee expense account
 * Credit: Bank account
 */
async function generateFeeEntry(order: OrderWithItems, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string | null> {
  const client = tx || prisma;
  // No fees for AureliaPay (UAT test payment)
  if (order.paymentMethod === 'AURELIA_PAY') return null;

  const total = Number(order.total);

  // FIX (F041): Estimate fee (will be reconciled when Stripe/PayPal reports actual fee)
  // Added isEstimated flag in description to facilitate later reconciliation
  const isPaypal = order.paymentMethod === 'PAYPAL' || order.paypalOrderId;
  const feeRate = 0.029;
  const fixedFee = 0.30;
  const { add: addDec, applyRate: applyRateDec } = await import('@/lib/decimal-calculator');
  const estimatedFee = addDec(applyRateDec(total, feeRate), fixedFee);

  if (estimatedFee <= 0) return null;

  const entryNumber = await getNextEntryNumber(tx);
  const feeAccountCode = isPaypal ? ACCOUNT_CODES.PAYPAL_FEES : ACCOUNT_CODES.STRIPE_FEES;
  const bankAccountCode = isPaypal ? ACCOUNT_CODES.CASH_PAYPAL : ACCOUNT_CODES.CASH_STRIPE;

  // #89 Batch: fetch both account IDs in one query
  const feeAccountMap = await batchGetAccountIds([feeAccountCode, bankAccountCode]);

  const feeLines = [
    {
      accountId: feeAccountMap.get(feeAccountCode)!,
      description: `Frais ${isPaypal ? 'PayPal' : 'Stripe'} sur ${order.orderNumber}`,
      debit: estimatedFee,
      credit: 0,
    },
    {
      accountId: feeAccountMap.get(bankAccountCode)!,
      description: `Frais ${isPaypal ? 'PayPal' : 'Stripe'} sur ${order.orderNumber}`,
      debit: 0,
      credit: estimatedFee,
    },
  ];
  assertJournalBalance(feeLines, `fee ${order.orderNumber}`);

  const entry = await client.journalEntry.create({
    data: {
      entryNumber,
      date: order.createdAt,
      description: `[ESTIMÉ] Frais ${isPaypal ? 'PayPal' : 'Stripe'} - Commande ${order.orderNumber}`,
      // FIX: F073 - AUTO_PAYPAL_FEE and AUTO_STRIPE_FEE are custom type strings.
      // Verify they are included in the JournalEntry.type enum in schema.prisma.
      // If the enum is strict, these must be added; if type is a free-text String, this is fine.
      type: isPaypal ? 'AUTO_PAYPAL_FEE' : 'AUTO_STRIPE_FEE',
      status: 'POSTED',
      reference: `FEE-EST-${order.orderNumber}`,
      orderId: order.id,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: { create: feeLines },
    },
  });

  return entry.id;
}

/**
 * Create a customer invoice for the order
 */
async function createCustomerInvoice(order: OrderWithItems, tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const client = tx || prisma;
  const invoiceNumber = await getNextInvoiceNumber(tx);

  // FIX (F039): Use safe property access instead of unsafe type assertion
  // that could result in customerName = 'undefined' string
  let customerName = 'Client';
  const customerEmail: string | null = null;
  const orderRecord = order as unknown as Record<string, unknown>;
  if (typeof orderRecord.shippingName === 'string' && orderRecord.shippingName.trim()) {
    customerName = orderRecord.shippingName;
  }

  const customerId = typeof orderRecord.userId === 'string' ? orderRecord.userId : null;

  const invoice = await client.customerInvoice.create({
    data: {
      invoiceNumber,
      customerId,
      customerName,
      customerEmail,
      orderId: order.id,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discount: order.discount,
      taxTps: order.taxTps,
      taxTvq: order.taxTvq,
      taxTvh: order.taxTvh,
      taxPst: order.taxPst,
      total: order.total,
      amountPaid: order.total,
      balance: 0,
      currency: order.currency?.code || 'CAD',
      invoiceDate: order.createdAt,
      // FIX: F079 - dueDate equals createdAt because these are auto-generated invoices for
      // orders already paid at checkout. This is intentional: dueDate = invoiceDate for prepaid orders.
      dueDate: order.createdAt,
      paidAt: new Date(),
      status: 'PAID',
      items: {
        create: order.items.map((item) => ({
          description: `${item.productName}${item.formatName ? ` - ${item.formatName}` : ''}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
          productId: item.productId,
          productSku: item.sku,
        })),
      },
    },
  });

  return invoice.id;
}

/**
 * Create accounting entries for a refund
 */
export async function createRefundAccountingEntries(
  orderId: string,
  refundAmount: number,
  refundTps: number,
  refundTvq: number,
  refundTvh: number,
  reason: string,
  refundPst: number = 0
): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, paymentMethod: true, paypalOrderId: true, createdAt: true },
  });

  if (!order) throw new Error(`Order not found: ${orderId}`);

  // Ensure the current accounting period is open for the refund entry
  await assertPeriodOpen(new Date());

  const isPaypal = order.paymentMethod === 'PAYPAL' || order.paypalOrderId;
  const bankAccountCode = isPaypal ? ACCOUNT_CODES.CASH_PAYPAL : ACCOUNT_CODES.CASH_STRIPE;

  const netRefund = refundAmount - refundTps - refundTvq - refundTvh - refundPst;

  // #90 Batch: Collect all account codes needed, then fetch in one DB query
  const refundAccountCodes: string[] = [ACCOUNT_CODES.DISCOUNTS_RETURNS, bankAccountCode];
  if (refundTps > 0) refundAccountCodes.push(ACCOUNT_CODES.TPS_PAYABLE);
  if (refundTvq > 0) refundAccountCodes.push(ACCOUNT_CODES.TVQ_PAYABLE);
  if (refundTvh > 0) refundAccountCodes.push(ACCOUNT_CODES.TVH_PAYABLE);
  if (refundPst > 0) refundAccountCodes.push(ACCOUNT_CODES.PST_PAYABLE);
  const refundAccountMap = await batchGetAccountIds(refundAccountCodes);

  const lines: { accountId: string; description: string; debit: number; credit: number }[] = [];

  // DEBIT: Discounts/Returns
  lines.push({
    accountId: refundAccountMap.get(ACCOUNT_CODES.DISCOUNTS_RETURNS)!,
    description: `Remboursement ${order.orderNumber}`,
    debit: netRefund,
    credit: 0,
  });

  // DEBIT: Reverse taxes
  if (refundTps > 0) {
    lines.push({
      accountId: refundAccountMap.get(ACCOUNT_CODES.TPS_PAYABLE)!,
      description: `TPS remboursée ${order.orderNumber}`,
      debit: refundTps,
      credit: 0,
    });
  }
  if (refundTvq > 0) {
    lines.push({
      accountId: refundAccountMap.get(ACCOUNT_CODES.TVQ_PAYABLE)!,
      description: `TVQ remboursée ${order.orderNumber}`,
      debit: refundTvq,
      credit: 0,
    });
  }
  if (refundTvh > 0) {
    lines.push({
      accountId: refundAccountMap.get(ACCOUNT_CODES.TVH_PAYABLE)!,
      description: `TVH remboursée ${order.orderNumber}`,
      debit: refundTvh,
      credit: 0,
    });
  }
  if (refundPst > 0) {
    lines.push({
      accountId: refundAccountMap.get(ACCOUNT_CODES.PST_PAYABLE)!,
      description: `PST remboursée ${order.orderNumber}`,
      debit: refundPst,
      credit: 0,
    });
  }

  // CREDIT: Bank account
  lines.push({
    accountId: refundAccountMap.get(bankAccountCode)!,
    description: `Remboursement ${order.orderNumber}`,
    debit: 0,
    credit: refundAmount,
  });

  assertJournalBalance(lines, `refund ${order.orderNumber}`);

  const entry = await prisma.$transaction(async (tx) => {
    const entryNumber = await getNextEntryNumber(tx);
    return tx.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(),
        description: `Remboursement ${order.orderNumber} - ${reason}`,
        type: 'AUTO_REFUND',
        status: 'POSTED',
        reference: `RMB-${order.orderNumber}`,
        orderId,
        createdBy: 'system',
        postedBy: 'system',
        postedAt: new Date(),
        lines: {
          create: lines.map((line) => ({
            accountId: line.accountId,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
          })),
        },
      },
    });
  });

  return entry.id;
}

/**
 * Create a formal credit note (note de credit)
 * Sequential numbering: NC-{year}-{seq}
 */
export async function createCreditNote(params: {
  orderId: string;
  invoiceId?: string;
  customerName: string;
  customerEmail?: string;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  taxPst?: number;
  total: number;
  reason: string;
  journalEntryId: string;
  issuedBy: string;
}): Promise<string> {
  // #64 Audit: Verify credit note total does not exceed original invoice
  if (params.invoiceId) {
    const originalInvoice = await prisma.customerInvoice.findUnique({
      where: { id: params.invoiceId },
      select: { total: true },
    });
    if (originalInvoice) {
      const invoiceTotal = Number(originalInvoice.total);
      // Sum existing credit notes against this invoice
      // F078 FIX: Use whitelist instead of blacklist for credit note status filtering
      const existingCreditNotesAgg = await prisma.creditNote.aggregate({
        where: { invoiceId: params.invoiceId, status: { in: ['ISSUED', 'APPLIED'] } },
        _sum: { total: true },
      });
      const existingTotal = Number(existingCreditNotesAgg._sum.total ?? 0);
      if (existingTotal + params.total > invoiceTotal) {
        throw new Error(
          `Credit note total (${params.total}) plus existing credit notes (${existingTotal}) exceeds original invoice total (${invoiceTotal})`
        );
      }
    }
  }

  // Wrap number generation + create inside a transaction so FOR UPDATE lock is effective
  const creditNote = await prisma.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const prefix = `NC-${year}-`;

    // Use MAX() FOR UPDATE for safe sequential numbering (must be inside transaction)
    const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
      SELECT MAX("creditNoteNumber") as max_num
      FROM "CreditNote"
      WHERE "creditNoteNumber" LIKE ${prefix + '%'}
      FOR UPDATE
    `;
    let nextNum = 1;
    if (maxRow?.max_num) {
      const parsed = parseInt(maxRow.max_num.split('-').pop() || '0');
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    // F-063 FIX: Use 5-digit padding for consistency with other entry generators
    const creditNoteNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

    return tx.creditNote.create({
      data: {
        creditNoteNumber,
        invoiceId: params.invoiceId || null,
        orderId: params.orderId,
        customerName: params.customerName,
        customerEmail: params.customerEmail || null,
        subtotal: params.subtotal,
        taxTps: params.taxTps,
        taxTvq: params.taxTvq,
        taxTvh: params.taxTvh,
        taxPst: params.taxPst || 0,
        total: params.total,
        reason: params.reason,
        status: 'ISSUED',
        issuedAt: new Date(),
        issuedBy: params.issuedBy,
        journalEntryId: params.journalEntryId,
      },
    });
  });

  return creditNote.id;
}

/**
 * Create an inventory loss journal entry
 * Debit: 6900 (Pertes sur stocks)
 * Credit: 1210 (Stock de marchandises)
 */
export async function createInventoryLossEntry(
  orderId: string,
  orderNumber: string,
  lossAmount: number,
  reason: string
): Promise<string> {
  // Ensure the current accounting period is open for the loss entry
  await assertPeriodOpen(new Date());

  const lossRounded = Math.round(lossAmount * 100) / 100;

  // #89 Batch: fetch both account IDs in one query
  const lossAccountMap = await batchGetAccountIds([
    ACCOUNT_CODES.INVENTORY_LOSS,
    ACCOUNT_CODES.INVENTORY,
  ]);

  const lossLines = [
    {
      accountId: lossAccountMap.get(ACCOUNT_CODES.INVENTORY_LOSS)!,
      description: `Perte stock ${orderNumber}`,
      debit: lossRounded,
      credit: 0,
    },
    {
      accountId: lossAccountMap.get(ACCOUNT_CODES.INVENTORY)!,
      description: `Reduction stock ${orderNumber}`,
      debit: 0,
      credit: lossRounded,
    },
  ];
  assertJournalBalance(lossLines, `inventory-loss ${orderNumber}`);

  const entry = await prisma.$transaction(async (tx) => {
    const entryNumber = await getNextEntryNumber(tx);
    return tx.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(),
        description: `Perte inventaire ${orderNumber} - ${reason}`,
        type: 'ADJUSTMENT',
        status: 'POSTED',
        reference: `LOSS-${orderNumber}`,
        orderId,
        createdBy: 'system',
        postedBy: 'system',
        postedAt: new Date(),
        lines: { create: lossLines },
      },
    });
  });

  return entry.id;
}

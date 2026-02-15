/**
 * Webhook → Accounting Bridge Service
 * Creates journal entries automatically when orders are completed via webhooks
 */

import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from './types';
import { Decimal } from '@prisma/client/runtime/library';

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
 * Get next entry number for a given type
 */
export async function getNextEntryNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.journalEntry.count({
    where: {
      entryNumber: { startsWith: `JV-${year}-` },
    },
  });
  return `JV-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Get next invoice number
 */
async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.customerInvoice.count({
    where: {
      invoiceNumber: { startsWith: `FACT-${year}-` },
    },
  });
  return `FACT-${year}-${String(count + 1).padStart(4, '0')}`;
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
 * Main entry point: create all accounting entries for a completed order
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

  // 1. Generate sale journal entry
  const saleEntryId = await generateSaleEntry(order);

  // 2. Generate fee entry (Stripe/PayPal processing fees)
  const feeEntryId = await generateFeeEntry(order);

  // 3. Create customer invoice
  const invoiceId = await createCustomerInvoice(order);

  return { saleEntryId, feeEntryId, invoiceId };
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
async function generateSaleEntry(order: OrderWithItems): Promise<string> {
  const entryNumber = await getNextEntryNumber();
  const salesAccountCode = getSalesAccount(order.shippingCountry);
  const bankAccountCode = getBankAccount(order.paymentMethod);

  // Exchange rate: how many CAD per 1 unit of order currency
  const xRate = Number(order.exchangeRate) || 1;
  const currencyCode = order.currency?.code || 'CAD';
  const isCAD = currencyCode === 'CAD';

  // Convert order amounts to CAD for journal entries
  const toCAD = (amount: number) => isCAD ? amount : Math.round(amount * xRate * 100) / 100;

  const subtotal = toCAD(Number(order.subtotal));
  const discount = toCAD(Number(order.discount));
  const shipping = toCAD(Number(order.shippingCost));
  const tps = toCAD(Number(order.taxTps));
  const tvq = toCAD(Number(order.taxTvq));
  const tvh = toCAD(Number(order.taxTvh));
  const pst = toCAD(Number(order.taxPst));
  const total = toCAD(Number(order.total));

  // Build lines
  const lines: {
    accountId: string;
    description: string;
    debit: number;
    credit: number;
  }[] = [];

  // DEBIT: Bank account for total received
  lines.push({
    accountId: await getAccountId(bankAccountCode),
    description: `Paiement reçu commande ${order.orderNumber}`,
    debit: total,
    credit: 0,
  });

  // CREDIT: Sales revenue (subtotal - discount)
  lines.push({
    accountId: await getAccountId(salesAccountCode),
    description: `Vente ${order.orderNumber}`,
    debit: 0,
    credit: subtotal - discount,
  });

  // CREDIT: Shipping charged
  if (shipping > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.SHIPPING_CHARGED),
      description: `Frais livraison ${order.orderNumber}`,
      debit: 0,
      credit: shipping,
    });
  }

  // CREDIT: TPS payable
  if (tps > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.TPS_PAYABLE),
      description: `TPS sur ${order.orderNumber}`,
      debit: 0,
      credit: tps,
    });
  }

  // CREDIT: TVQ payable
  if (tvq > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.TVQ_PAYABLE),
      description: `TVQ sur ${order.orderNumber}`,
      debit: 0,
      credit: tvq,
    });
  }

  // CREDIT: TVH payable
  if (tvh > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.TVH_PAYABLE),
      description: `TVH sur ${order.orderNumber}`,
      debit: 0,
      credit: tvh,
    });
  }

  // CREDIT: PST payable (BC, SK, MB)
  if (pst > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.PST_PAYABLE),
      description: `PST sur ${order.orderNumber}`,
      debit: 0,
      credit: pst,
    });
  }

  // Create the journal entry with lines in a transaction
  const fxSuffix = isCAD ? '' : ` (${currencyCode} @${xRate})`;
  const entry = await prisma.journalEntry.create({
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
async function generateFeeEntry(order: OrderWithItems): Promise<string | null> {
  // No fees for AureliaPay (UAT test payment)
  if (order.paymentMethod === 'AURELIA_PAY') return null;

  const total = Number(order.total);

  // Estimate fee (will be reconciled when Stripe/PayPal reports actual fee)
  const isPaypal = order.paymentMethod === 'PAYPAL' || order.paypalOrderId;
  const feeRate = 0.029;
  const fixedFee = 0.30;
  const estimatedFee = Math.round((total * feeRate + fixedFee) * 100) / 100;

  if (estimatedFee <= 0) return null;

  const entryNumber = await getNextEntryNumber();
  const feeAccountCode = isPaypal ? ACCOUNT_CODES.PAYPAL_FEES : ACCOUNT_CODES.STRIPE_FEES;
  const bankAccountCode = isPaypal ? ACCOUNT_CODES.CASH_PAYPAL : ACCOUNT_CODES.CASH_STRIPE;

  const entry = await prisma.journalEntry.create({
    data: {
      entryNumber,
      date: order.createdAt,
      description: `Frais ${isPaypal ? 'PayPal' : 'Stripe'} - Commande ${order.orderNumber}`,
      type: isPaypal ? 'AUTO_PAYPAL_FEE' : 'AUTO_STRIPE_FEE',
      status: 'POSTED',
      reference: `FEE-${order.orderNumber}`,
      orderId: order.id,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: {
        create: [
          {
            accountId: await getAccountId(feeAccountCode),
            description: `Frais ${isPaypal ? 'PayPal' : 'Stripe'} sur ${order.orderNumber}`,
            debit: estimatedFee,
            credit: 0,
          },
          {
            accountId: await getAccountId(bankAccountCode),
            description: `Frais ${isPaypal ? 'PayPal' : 'Stripe'} sur ${order.orderNumber}`,
            debit: 0,
            credit: estimatedFee,
          },
        ],
      },
    },
  });

  return entry.id;
}

/**
 * Create a customer invoice for the order
 */
async function createCustomerInvoice(order: OrderWithItems): Promise<string> {
  const invoiceNumber = await getNextInvoiceNumber();

  // Get customer info
  let customerName = 'Client';
  const customerEmail: string | null = null;
  if (order.items.length > 0) {
    // The order model doesn't directly link to User, we use userId
    // For now get from shipping info
    customerName = (order as unknown as Record<string, unknown>).shippingName as string || 'Client';
  }

  const invoice = await prisma.customerInvoice.create({
    data: {
      invoiceNumber,
      customerId: (order as unknown as Record<string, unknown>).userId as string || null,
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
      dueDate: order.createdAt, // Paid immediately
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

  const isPaypal = order.paymentMethod === 'PAYPAL' || order.paypalOrderId;
  const bankAccountCode = isPaypal ? ACCOUNT_CODES.CASH_PAYPAL : ACCOUNT_CODES.CASH_STRIPE;
  const entryNumber = await getNextEntryNumber();

  const netRefund = refundAmount - refundTps - refundTvq - refundTvh - refundPst;

  const lines: { accountId: string; description: string; debit: number; credit: number }[] = [];

  // DEBIT: Discounts/Returns
  lines.push({
    accountId: await getAccountId(ACCOUNT_CODES.DISCOUNTS_RETURNS),
    description: `Remboursement ${order.orderNumber}`,
    debit: netRefund,
    credit: 0,
  });

  // DEBIT: Reverse taxes
  if (refundTps > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.TPS_PAYABLE),
      description: `TPS remboursée ${order.orderNumber}`,
      debit: refundTps,
      credit: 0,
    });
  }
  if (refundTvq > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.TVQ_PAYABLE),
      description: `TVQ remboursée ${order.orderNumber}`,
      debit: refundTvq,
      credit: 0,
    });
  }
  if (refundTvh > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.TVH_PAYABLE),
      description: `TVH remboursée ${order.orderNumber}`,
      debit: refundTvh,
      credit: 0,
    });
  }
  if (refundPst > 0) {
    lines.push({
      accountId: await getAccountId(ACCOUNT_CODES.PST_PAYABLE),
      description: `PST remboursée ${order.orderNumber}`,
      debit: refundPst,
      credit: 0,
    });
  }

  // CREDIT: Bank account
  lines.push({
    accountId: await getAccountId(bankAccountCode),
    description: `Remboursement ${order.orderNumber}`,
    debit: 0,
    credit: refundAmount,
  });

  const entry = await prisma.journalEntry.create({
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
  const year = new Date().getFullYear();
  const count = await prisma.creditNote.count({
    where: { creditNoteNumber: { startsWith: `NC-${year}-` } },
  });
  const creditNoteNumber = `NC-${year}-${String(count + 1).padStart(4, '0')}`;

  const creditNote = await prisma.creditNote.create({
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
  const entryNumber = await getNextEntryNumber();
  const lossRounded = Math.round(lossAmount * 100) / 100;

  const entry = await prisma.journalEntry.create({
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
      lines: {
        create: [
          {
            accountId: await getAccountId(ACCOUNT_CODES.INVENTORY_LOSS),
            description: `Perte stock ${orderNumber}`,
            debit: lossRounded,
            credit: 0,
          },
          {
            accountId: await getAccountId(ACCOUNT_CODES.INVENTORY),
            description: `Reduction stock ${orderNumber}`,
            debit: 0,
            credit: lossRounded,
          },
        ],
      },
    },
  });

  return entry.id;
}

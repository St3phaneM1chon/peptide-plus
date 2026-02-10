/**
 * Auto Entries Service
 * Automatically generates journal entries from orders, payments, refunds, and fees
 */

import { ACCOUNT_CODES, TAX_RATES, JournalEntry, JournalLine } from './types';

interface OrderData {
  id: string;
  orderNumber: string;
  date: Date;
  customer: {
    name: string;
    email: string;
    province?: string;
    country: string;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  shipping: number;
  discount: number;
  tps: number;
  tvq: number;
  tvh: number;
  otherTax: number;
  total: number;
  paymentMethod: 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER' | 'OTHER';
  paymentFee?: number;
  currency: string;
}

interface RefundData {
  id: string;
  orderId: string;
  orderNumber: string;
  date: Date;
  amount: number;
  tps: number;
  tvq: number;
  tvh: number;
  reason: string;
  paymentMethod: 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER';
}

interface StripePayoutData {
  id: string;
  date: Date;
  gross: number;
  fees: number;
  net: number;
  currency: string;
}

let entryCounter = 0;

function generateEntryNumber(): string {
  entryCounter++;
  const year = new Date().getFullYear();
  return `JV-${year}-${String(entryCounter).padStart(4, '0')}`;
}

/**
 * Determine which sales account to use based on customer location
 */
function getSalesAccount(country: string, _province?: string): string {
  if (country === 'CA' || country === 'Canada') {
    return ACCOUNT_CODES.SALES_CANADA;
  } else if (country === 'US' || country === 'USA' || country === 'United States') {
    return ACCOUNT_CODES.SALES_USA;
  } else if (['FR', 'DE', 'GB', 'IT', 'ES', 'NL', 'BE'].includes(country)) {
    return ACCOUNT_CODES.SALES_EUROPE;
  }
  return ACCOUNT_CODES.SALES_OTHER;
}

/**
 * Determine which bank account to credit based on payment method
 */
function getBankAccount(paymentMethod: string): string {
  switch (paymentMethod) {
    case 'STRIPE':
      return ACCOUNT_CODES.CASH_STRIPE;
    case 'PAYPAL':
      return ACCOUNT_CODES.CASH_PAYPAL;
    case 'BANK_TRANSFER':
      return ACCOUNT_CODES.CASH_BANK_MAIN;
    default:
      return ACCOUNT_CODES.CASH_BANK_MAIN;
  }
}

/**
 * Get fee expense account based on payment method
 */
function getFeeAccount(paymentMethod: string): string {
  switch (paymentMethod) {
    case 'STRIPE':
      return ACCOUNT_CODES.STRIPE_FEES;
    case 'PAYPAL':
      return ACCOUNT_CODES.PAYPAL_FEES;
    default:
      return ACCOUNT_CODES.BANK_FEES;
  }
}

/**
 * Generate journal entry for a completed sale
 */
export function generateSaleEntry(order: OrderData): JournalEntry {
  const lines: JournalLine[] = [];
  const salesAccount = getSalesAccount(order.customer.country, order.customer.province);
  const bankAccount = getBankAccount(order.paymentMethod);

  // DEBIT: Bank account for total received
  lines.push({
    id: `line-${Date.now()}-1`,
    accountCode: bankAccount,
    accountName: getAccountName(bankAccount),
    description: `Paiement reçu commande ${order.orderNumber}`,
    debit: order.total,
    credit: 0,
  });

  // CREDIT: Sales revenue (before taxes)
  lines.push({
    id: `line-${Date.now()}-2`,
    accountCode: salesAccount,
    accountName: getAccountName(salesAccount),
    description: `Vente ${order.orderNumber}`,
    debit: 0,
    credit: order.subtotal - order.discount,
  });

  // CREDIT: Shipping charged to customer
  if (order.shipping > 0) {
    lines.push({
      id: `line-${Date.now()}-3`,
      accountCode: ACCOUNT_CODES.SHIPPING_CHARGED,
      accountName: 'Frais de livraison facturés',
      description: `Frais livraison ${order.orderNumber}`,
      debit: 0,
      credit: order.shipping,
    });
  }

  // CREDIT: TPS payable
  if (order.tps > 0) {
    lines.push({
      id: `line-${Date.now()}-4`,
      accountCode: ACCOUNT_CODES.TPS_PAYABLE,
      accountName: 'TPS à payer',
      description: `TPS sur ${order.orderNumber}`,
      debit: 0,
      credit: order.tps,
    });
  }

  // CREDIT: TVQ payable
  if (order.tvq > 0) {
    lines.push({
      id: `line-${Date.now()}-5`,
      accountCode: ACCOUNT_CODES.TVQ_PAYABLE,
      accountName: 'TVQ à payer',
      description: `TVQ sur ${order.orderNumber}`,
      debit: 0,
      credit: order.tvq,
    });
  }

  // CREDIT: TVH payable (for other provinces)
  if (order.tvh > 0) {
    lines.push({
      id: `line-${Date.now()}-6`,
      accountCode: ACCOUNT_CODES.TVH_PAYABLE,
      accountName: 'TVH à payer',
      description: `TVH sur ${order.orderNumber}`,
      debit: 0,
      credit: order.tvh,
    });
  }

  // DEBIT: Discount given (contra-revenue)
  if (order.discount > 0) {
    lines.push({
      id: `line-${Date.now()}-7`,
      accountCode: ACCOUNT_CODES.DISCOUNTS_RETURNS,
      accountName: 'Remises et retours',
      description: `Rabais ${order.orderNumber}`,
      debit: order.discount,
      credit: 0,
    });
  }

  return {
    id: `entry-${Date.now()}`,
    entryNumber: generateEntryNumber(),
    date: order.date,
    description: `Vente en ligne ${order.orderNumber} - ${order.customer.name}`,
    type: 'AUTO_SALE',
    status: 'POSTED',
    reference: order.orderNumber,
    orderId: order.id,
    lines,
    createdBy: 'Système',
    createdAt: new Date(),
    postedAt: new Date(),
  };
}

/**
 * Generate journal entry for payment processing fee (Stripe, PayPal)
 */
export function generateFeeEntry(
  orderId: string,
  orderNumber: string,
  date: Date,
  fee: number,
  paymentMethod: 'STRIPE' | 'PAYPAL'
): JournalEntry {
  const feeAccount = getFeeAccount(paymentMethod);
  const bankAccount = getBankAccount(paymentMethod);

  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountCode: feeAccount,
      accountName: getAccountName(feeAccount),
      description: `Frais ${paymentMethod} sur ${orderNumber}`,
      debit: fee,
      credit: 0,
    },
    {
      id: `line-${Date.now()}-2`,
      accountCode: bankAccount,
      accountName: getAccountName(bankAccount),
      description: `Frais ${paymentMethod} sur ${orderNumber}`,
      debit: 0,
      credit: fee,
    },
  ];

  return {
    id: `entry-fee-${Date.now()}`,
    entryNumber: generateEntryNumber(),
    date,
    description: `Frais ${paymentMethod} - Commande ${orderNumber}`,
    type: paymentMethod === 'STRIPE' ? 'AUTO_STRIPE_FEE' : 'AUTO_PAYPAL_FEE',
    status: 'POSTED',
    reference: `FEE-${orderNumber}`,
    orderId,
    lines,
    createdBy: 'Système',
    createdAt: new Date(),
    postedAt: new Date(),
  };
}

/**
 * Generate journal entry for a refund
 */
export function generateRefundEntry(refund: RefundData): JournalEntry {
  const lines: JournalLine[] = [];
  const bankAccount = getBankAccount(refund.paymentMethod);

  // DEBIT: Discounts/Returns (contra-revenue)
  lines.push({
    id: `line-${Date.now()}-1`,
    accountCode: ACCOUNT_CODES.DISCOUNTS_RETURNS,
    accountName: 'Remises et retours',
    description: `Remboursement ${refund.orderNumber}`,
    debit: refund.amount - refund.tps - refund.tvq - refund.tvh,
    credit: 0,
  });

  // DEBIT: TPS payable (reverse)
  if (refund.tps > 0) {
    lines.push({
      id: `line-${Date.now()}-2`,
      accountCode: ACCOUNT_CODES.TPS_PAYABLE,
      accountName: 'TPS à payer',
      description: `TPS remboursée ${refund.orderNumber}`,
      debit: refund.tps,
      credit: 0,
    });
  }

  // DEBIT: TVQ payable (reverse)
  if (refund.tvq > 0) {
    lines.push({
      id: `line-${Date.now()}-3`,
      accountCode: ACCOUNT_CODES.TVQ_PAYABLE,
      accountName: 'TVQ à payer',
      description: `TVQ remboursée ${refund.orderNumber}`,
      debit: refund.tvq,
      credit: 0,
    });
  }

  // DEBIT: TVH payable (reverse)
  if (refund.tvh > 0) {
    lines.push({
      id: `line-${Date.now()}-4`,
      accountCode: ACCOUNT_CODES.TVH_PAYABLE,
      accountName: 'TVH à payer',
      description: `TVH remboursée ${refund.orderNumber}`,
      debit: refund.tvh,
      credit: 0,
    });
  }

  // CREDIT: Bank account
  lines.push({
    id: `line-${Date.now()}-5`,
    accountCode: bankAccount,
    accountName: getAccountName(bankAccount),
    description: `Remboursement ${refund.orderNumber}`,
    debit: 0,
    credit: refund.amount,
  });

  return {
    id: `entry-refund-${Date.now()}`,
    entryNumber: generateEntryNumber(),
    date: refund.date,
    description: `Remboursement ${refund.orderNumber} - ${refund.reason}`,
    type: 'AUTO_REFUND',
    status: 'POSTED',
    reference: `RMB-${refund.orderNumber}`,
    orderId: refund.orderId,
    lines,
    createdBy: 'Système',
    createdAt: new Date(),
    postedAt: new Date(),
  };
}

/**
 * Generate journal entry for Stripe payout to bank
 */
export function generateStripePayoutEntry(payout: StripePayoutData): JournalEntry {
  const lines: JournalLine[] = [
    // DEBIT: Main bank account
    {
      id: `line-${Date.now()}-1`,
      accountCode: ACCOUNT_CODES.CASH_BANK_MAIN,
      accountName: 'Compte bancaire principal',
      description: `Virement Stripe ${payout.id}`,
      debit: payout.net,
      credit: 0,
    },
    // CREDIT: Stripe account
    {
      id: `line-${Date.now()}-2`,
      accountCode: ACCOUNT_CODES.CASH_STRIPE,
      accountName: 'Compte Stripe',
      description: `Virement vers banque ${payout.id}`,
      debit: 0,
      credit: payout.net,
    },
  ];

  return {
    id: `entry-payout-${Date.now()}`,
    entryNumber: generateEntryNumber(),
    date: payout.date,
    description: `Virement Stripe vers banque - ${payout.net.toFixed(2)} ${payout.currency}`,
    type: 'AUTO_SALE', // Using AUTO_SALE for transfers
    status: 'POSTED',
    reference: payout.id,
    lines,
    createdBy: 'Système',
    createdAt: new Date(),
    postedAt: new Date(),
  };
}

/**
 * Generate recurring entry (e.g., monthly depreciation, subscriptions)
 */
export function generateRecurringEntry(
  description: string,
  debitAccount: string,
  creditAccount: string,
  amount: number,
  date: Date,
  reference?: string
): JournalEntry {
  const lines: JournalLine[] = [
    {
      id: `line-${Date.now()}-1`,
      accountCode: debitAccount,
      accountName: getAccountName(debitAccount),
      description,
      debit: amount,
      credit: 0,
    },
    {
      id: `line-${Date.now()}-2`,
      accountCode: creditAccount,
      accountName: getAccountName(creditAccount),
      description,
      debit: 0,
      credit: amount,
    },
  ];

  return {
    id: `entry-recurring-${Date.now()}`,
    entryNumber: generateEntryNumber(),
    date,
    description,
    type: 'RECURRING',
    status: 'POSTED',
    reference,
    lines,
    createdBy: 'Système',
    createdAt: new Date(),
    postedAt: new Date(),
  };
}

/**
 * Calculate tax breakdown from total and province
 */
export function calculateTaxes(
  subtotal: number,
  shipping: number,
  discount: number,
  province: string,
  country: string
): { tps: number; tvq: number; tvh: number; total: number } {
  const taxableAmount = subtotal + shipping - discount;
  
  // No Canadian tax for non-Canadian customers
  if (country !== 'CA' && country !== 'Canada') {
    return { tps: 0, tvq: 0, tvh: 0, total: taxableAmount };
  }

  const rates = TAX_RATES[province as keyof typeof TAX_RATES] || TAX_RATES.QC;
  
  let tps = 0;
  let tvq = 0;
  let tvh = 0;

  if ('TVH' in rates && rates.TVH) {
    // HST provinces
    tvh = taxableAmount * rates.TVH;
  } else {
    // Separate GST/PST or GST/QST
    if ('TPS' in rates) {
      tps = taxableAmount * rates.TPS;
    }
    if ('TVQ' in rates) {
      tvq = taxableAmount * rates.TVQ;
    }
    if ('PST' in rates) {
      // PST is treated like TVQ for accounting purposes
      tvq = taxableAmount * rates.PST;
    }
  }

  return {
    tps: Math.round(tps * 100) / 100,
    tvq: Math.round(tvq * 100) / 100,
    tvh: Math.round(tvh * 100) / 100,
    total: Math.round((taxableAmount + tps + tvq + tvh) * 100) / 100,
  };
}

/**
 * Validate that a journal entry is balanced
 */
export function validateEntry(entry: JournalEntry): { valid: boolean; difference: number } {
  const totalDebits = entry.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = entry.lines.reduce((sum, line) => sum + line.credit, 0);
  const difference = Math.round((totalDebits - totalCredits) * 100) / 100;
  
  return {
    valid: Math.abs(difference) < 0.01,
    difference,
  };
}

/**
 * Get account name from account code
 */
function getAccountName(code: string): string {
  const names: Record<string, string> = {
    [ACCOUNT_CODES.CASH_BANK_MAIN]: 'Compte bancaire principal (CAD)',
    [ACCOUNT_CODES.CASH_BANK_USD]: 'Compte bancaire USD',
    [ACCOUNT_CODES.CASH_PAYPAL]: 'Compte PayPal',
    [ACCOUNT_CODES.CASH_STRIPE]: 'Compte Stripe',
    [ACCOUNT_CODES.ACCOUNTS_RECEIVABLE_CA]: 'Comptes clients Canada',
    [ACCOUNT_CODES.ACCOUNTS_RECEIVABLE_US]: 'Comptes clients USA',
    [ACCOUNT_CODES.TPS_PAYABLE]: 'TPS à payer',
    [ACCOUNT_CODES.TVQ_PAYABLE]: 'TVQ à payer',
    [ACCOUNT_CODES.TVH_PAYABLE]: 'TVH à payer',
    [ACCOUNT_CODES.SALES_CANADA]: 'Ventes Canada',
    [ACCOUNT_CODES.SALES_USA]: 'Ventes USA',
    [ACCOUNT_CODES.SALES_EUROPE]: 'Ventes Europe',
    [ACCOUNT_CODES.SALES_OTHER]: 'Ventes autres pays',
    [ACCOUNT_CODES.SHIPPING_CHARGED]: 'Frais de livraison facturés',
    [ACCOUNT_CODES.DISCOUNTS_RETURNS]: 'Remises et retours',
    [ACCOUNT_CODES.STRIPE_FEES]: 'Frais Stripe',
    [ACCOUNT_CODES.PAYPAL_FEES]: 'Frais PayPal',
    [ACCOUNT_CODES.BANK_FEES]: 'Frais bancaires',
    [ACCOUNT_CODES.DEPRECIATION]: 'Amortissement',
    [ACCOUNT_CODES.ACCUMULATED_DEPRECIATION]: 'Amortissement cumulé',
  };
  
  return names[code] || `Compte ${code}`;
}

export { getAccountName };

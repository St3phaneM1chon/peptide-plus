/**
 * Client Portal Service
 *
 * Provides token-based public access to accounting data for clients.
 * Clients can view their invoices, estimates, payments, and statements
 * without needing a user account - they just need a valid portal token.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortalAccessInfo {
  id: string;
  token: string;
  email: string;
  clientName: string;
  companyName: string | null;
  expiresAt: string | null;
  isActive: boolean;
  lastAccess: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  shippingCost: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  pdfUrl: string | null;
  notes: string | null;
  paidAt: string | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }[];
}

export interface ClientEstimate {
  id: string;
  estimateNumber: string;
  status: string;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxGst: number;
  taxQst: number;
  taxTotal: number;
  total: number;
  currency: string;
  notes: string | null;
  termsConditions: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  items: {
    id: string;
    productName: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    lineTotal: number;
    sortOrder: number;
  }[];
}

export interface ClientPayment {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  paidAt: string;
  amountPaid: number;
  total: number;
  currency: string;
  status: string;
}

export interface StatementLineItem {
  id: string;
  date: string;
  type: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT';
  reference: string;
  description: string;
  status: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface ClientStatement {
  clientName: string;
  clientEmail: string;
  companyName: string | null;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  currency: string;
  lineItems: StatementLineItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (
    val &&
    typeof val === 'object' &&
    'toNumber' in val &&
    typeof (val as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Create a new portal access token for a client.
 */
export async function createPortalAccess(
  email: string,
  clientName: string,
  companyName?: string,
  expiresInDays?: number,
  createdBy?: string
): Promise<PortalAccessInfo> {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const access = await prisma.clientPortalAccess.create({
    data: {
      email: email.toLowerCase().trim(),
      clientName: clientName.trim(),
      companyName: companyName?.trim() || null,
      expiresAt,
      createdBy: createdBy || null,
    },
  });

  logger.info('Client portal access created', {
    accessId: access.id,
    email: access.email,
    clientName: access.clientName,
    expiresAt: access.expiresAt?.toISOString() || null,
    createdBy,
  });

  return {
    id: access.id,
    token: access.token,
    email: access.email,
    clientName: access.clientName,
    companyName: access.companyName,
    expiresAt: access.expiresAt?.toISOString() || null,
    isActive: access.isActive,
    lastAccess: access.lastAccess?.toISOString() || null,
    createdBy: access.createdBy,
    createdAt: access.createdAt.toISOString(),
  };
}

/**
 * Validate a portal access token and update last access timestamp.
 * Returns access info if valid, null otherwise.
 */
export async function validatePortalAccess(
  token: string
): Promise<PortalAccessInfo | null> {
  const access = await prisma.clientPortalAccess.findUnique({
    where: { token },
  });

  if (!access) return null;
  if (!access.isActive) return null;
  if (access.expiresAt && access.expiresAt < new Date()) return null;

  // Update last access timestamp
  await prisma.clientPortalAccess.update({
    where: { id: access.id },
    data: { lastAccess: new Date() },
  });

  return {
    id: access.id,
    token: access.token,
    email: access.email,
    clientName: access.clientName,
    companyName: access.companyName,
    expiresAt: access.expiresAt?.toISOString() || null,
    isActive: access.isActive,
    lastAccess: new Date().toISOString(),
    createdBy: access.createdBy,
    createdAt: access.createdAt.toISOString(),
  };
}

/**
 * Get all invoices for a client by email.
 */
export async function getClientInvoices(
  email: string
): Promise<ClientInvoice[]> {
  const normalizedEmail = email.toLowerCase().trim();

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      customerEmail: normalizedEmail,
      deletedAt: null,
      status: { notIn: ['VOID'] },
    },
    include: { items: true },
    orderBy: { invoiceDate: 'desc' },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    status: inv.status,
    subtotal: toNum(inv.subtotal),
    taxTps: toNum(inv.taxTps),
    taxTvq: toNum(inv.taxTvq),
    taxTvh: toNum(inv.taxTvh),
    shippingCost: toNum(inv.shippingCost),
    discount: toNum(inv.discount),
    total: toNum(inv.total),
    amountPaid: toNum(inv.amountPaid),
    balance: toNum(inv.balance),
    currency: inv.currency,
    pdfUrl: inv.pdfUrl,
    notes: inv.notes,
    paidAt: inv.paidAt?.toISOString() || null,
    items: inv.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: toNum(item.unitPrice),
      discount: toNum(item.discount),
      total: toNum(item.total),
    })),
  }));
}

/**
 * Get all estimates for a client by email.
 */
export async function getClientEstimates(
  email: string
): Promise<ClientEstimate[]> {
  const normalizedEmail = email.toLowerCase().trim();

  const estimates = await prisma.estimate.findMany({
    where: {
      customerEmail: normalizedEmail,
      deletedAt: null,
    },
    include: { items: true },
    orderBy: { issueDate: 'desc' },
  });

  return estimates.map((est) => ({
    id: est.id,
    estimateNumber: est.estimateNumber,
    status: est.status,
    issueDate: est.issueDate.toISOString(),
    validUntil: est.validUntil.toISOString(),
    subtotal: toNum(est.subtotal),
    discountAmount: toNum(est.discountAmount),
    discountPercent: toNum(est.discountPercent),
    taxGst: toNum(est.taxGst),
    taxQst: toNum(est.taxQst),
    taxTotal: toNum(est.taxTotal),
    total: toNum(est.total),
    currency: est.currency,
    notes: est.notes,
    termsConditions: est.termsConditions,
    acceptedAt: est.acceptedAt?.toISOString() || null,
    acceptedBy: est.acceptedBy,
    declinedAt: est.declinedAt?.toISOString() || null,
    declineReason: est.declineReason,
    items: est.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      description: item.description,
      quantity: toNum(item.quantity),
      unitPrice: toNum(item.unitPrice),
      discountPercent: toNum(item.discountPercent),
      lineTotal: toNum(item.lineTotal),
      sortOrder: item.sortOrder,
    })),
  }));
}

/**
 * Get all payments received for a client by email.
 */
export async function getClientPayments(
  email: string
): Promise<ClientPayment[]> {
  const normalizedEmail = email.toLowerCase().trim();

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      customerEmail: normalizedEmail,
      deletedAt: null,
      amountPaid: { gt: 0 },
    },
    orderBy: { paidAt: 'desc' },
  });

  return invoices
    .filter((inv) => toNum(inv.amountPaid) > 0)
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate.toISOString(),
      paidAt: (inv.paidAt || inv.updatedAt).toISOString(),
      amountPaid: toNum(inv.amountPaid),
      total: toNum(inv.total),
      currency: inv.currency,
      status: inv.status,
    }));
}

/**
 * Generate a client account statement with running balance.
 */
export async function getClientStatement(
  email: string,
  startDate: Date,
  endDate: Date,
  companyName?: string | null
): Promise<ClientStatement> {
  const normalizedEmail = email.toLowerCase().trim();

  // Set endDate to end of day
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch invoices in period
  const invoicesInPeriod = await prisma.customerInvoice.findMany({
    where: {
      customerEmail: normalizedEmail,
      deletedAt: null,
      status: { notIn: ['VOID', 'CANCELLED'] },
      invoiceDate: {
        gte: startDate,
        lte: endOfDay,
      },
    },
    orderBy: { invoiceDate: 'asc' },
  });

  // Calculate opening balance from invoices before the period
  const priorInvoices = await prisma.customerInvoice.findMany({
    where: {
      customerEmail: normalizedEmail,
      deletedAt: null,
      status: { notIn: ['VOID', 'CANCELLED'] },
      invoiceDate: { lt: startDate },
    },
    select: { balance: true },
  });

  // Prior credit notes
  const clientName =
    invoicesInPeriod[0]?.customerName ||
    (
      await prisma.customerInvoice.findFirst({
        where: { customerEmail: normalizedEmail, deletedAt: null },
        select: { customerName: true },
      })
    )?.customerName ||
    'Client';

  const priorCreditNotes = await prisma.creditNote.findMany({
    where: {
      customerName: clientName,
      deletedAt: null,
      createdAt: { lt: startDate },
      status: { notIn: ['VOID'] },
    },
    select: { total: true },
  });

  const openingBalance =
    priorInvoices.reduce((sum, inv) => sum + toNum(inv.balance), 0) -
    priorCreditNotes.reduce((sum, cn) => sum + toNum(cn.total), 0);

  // Credit notes in period
  const creditNotesInPeriod = await prisma.creditNote.findMany({
    where: {
      customerName: clientName,
      deletedAt: null,
      createdAt: {
        gte: startDate,
        lte: endOfDay,
      },
      status: { notIn: ['VOID'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build line items
  const lineItems: StatementLineItem[] = [];

  for (const inv of invoicesInPeriod) {
    lineItems.push({
      id: inv.id,
      date: inv.invoiceDate.toISOString(),
      type: 'INVOICE',
      reference: inv.invoiceNumber,
      description: `Invoice ${inv.invoiceNumber}`,
      status: inv.status,
      debit: toNum(inv.total),
      credit: 0,
      runningBalance: 0,
    });

    const amountPaid = toNum(inv.amountPaid);
    if (amountPaid > 0) {
      const paymentDate = inv.paidAt || inv.updatedAt;
      if (paymentDate >= startDate && paymentDate <= endOfDay) {
        lineItems.push({
          id: `${inv.id}-payment`,
          date: paymentDate.toISOString(),
          type: 'PAYMENT',
          reference: inv.invoiceNumber,
          description: `Payment on invoice ${inv.invoiceNumber}`,
          status: inv.status === 'PAID' ? 'COMPLETE' : 'PARTIAL',
          debit: 0,
          credit: amountPaid,
          runningBalance: 0,
        });
      }
    }
  }

  for (const cn of creditNotesInPeriod) {
    lineItems.push({
      id: cn.id,
      date: cn.createdAt.toISOString(),
      type: 'CREDIT_NOTE',
      reference: cn.creditNoteNumber,
      description: `Credit note ${cn.creditNoteNumber} - ${cn.reason}`,
      status: cn.status,
      debit: 0,
      credit: toNum(cn.total),
      runningBalance: 0,
    });
  }

  // Sort and calculate running balance
  lineItems.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = openingBalance;
  let totalDebits = 0;
  let totalCredits = 0;

  for (const item of lineItems) {
    runningBalance += item.debit - item.credit;
    item.runningBalance = roundCurrency(runningBalance);
    totalDebits += item.debit;
    totalCredits += item.credit;
  }

  return {
    clientName,
    clientEmail: normalizedEmail,
    companyName: companyName || null,
    dateFrom: startDate.toISOString(),
    dateTo: endOfDay.toISOString(),
    generatedAt: new Date().toISOString(),
    openingBalance: roundCurrency(openingBalance),
    totalDebits: roundCurrency(totalDebits),
    totalCredits: roundCurrency(totalCredits),
    closingBalance: roundCurrency(runningBalance),
    currency:
      invoicesInPeriod[0]?.currency ||
      (
        await prisma.customerInvoice.findFirst({
          where: { customerEmail: normalizedEmail },
          select: { currency: true },
        })
      )?.currency ||
      'CAD',
    lineItems,
  };
}

/**
 * Get the total outstanding balance for a client.
 */
export async function getClientOutstandingBalance(
  email: string
): Promise<{ total: number; invoiceCount: number; currency: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  const invoices = await prisma.customerInvoice.findMany({
    where: {
      customerEmail: normalizedEmail,
      deletedAt: null,
      status: { notIn: ['VOID', 'CANCELLED', 'PAID'] },
      balance: { gt: 0 },
    },
    select: { balance: true, currency: true },
  });

  const total = invoices.reduce((sum, inv) => sum + toNum(inv.balance), 0);

  return {
    total: roundCurrency(total),
    invoiceCount: invoices.length,
    currency: invoices[0]?.currency || 'CAD',
  };
}

/**
 * Revoke a portal access token.
 */
export async function revokePortalAccess(token: string): Promise<boolean> {
  const access = await prisma.clientPortalAccess.findUnique({
    where: { token },
  });

  if (!access) return false;

  await prisma.clientPortalAccess.update({
    where: { token },
    data: { isActive: false },
  });

  logger.info('Client portal access revoked', {
    accessId: access.id,
    email: access.email,
    token,
  });

  return true;
}

/**
 * List all portal accesses (for admin).
 */
export async function listPortalAccesses(): Promise<PortalAccessInfo[]> {
  const accesses = await prisma.clientPortalAccess.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return accesses.map((access) => ({
    id: access.id,
    token: access.token,
    email: access.email,
    clientName: access.clientName,
    companyName: access.companyName,
    expiresAt: access.expiresAt?.toISOString() || null,
    isActive:
      access.isActive &&
      (!access.expiresAt || access.expiresAt >= new Date()),
    lastAccess: access.lastAccess?.toISOString() || null,
    createdBy: access.createdBy,
    createdAt: access.createdAt.toISOString(),
  }));
}

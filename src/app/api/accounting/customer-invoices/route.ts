export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { createCustomerInvoiceSchema, logAuditTrail } from '@/lib/accounting';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { GST_RATE, QST_RATE } from '@/lib/tax-constants';
import { calculateTax, roundCurrency } from '@/lib/financial';

// ---------------------------------------------------------------------------
// Zod Schemas (for PUT - update invoice status)
// ---------------------------------------------------------------------------

const updateCustomerInvoiceSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  paidAt: z.string().optional().nullable(),
  amountPaid: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  adminNotes: z.string().optional().nullable(),
});

/**
 * GET /api/accounting/customer-invoices
 * List customer invoices with filters
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    // Validate date range if provided
    if (from || to) {
      const startDate = from ? new Date(from) : null;
      const endDate = to ? new Date(to) : null;

      if ((from && isNaN(startDate!.getTime())) || (to && isNaN(endDate!.getTime()))) {
        return NextResponse.json({ error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' }, { status: 400 });
      }
      if (startDate && endDate && startDate > endDate) {
        return NextResponse.json({ error: 'La date de début doit être antérieure à la date de fin' }, { status: 400 });
      }
      if (startDate && endDate) {
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        if (endDate.getTime() - startDate.getTime() > oneYearMs) {
          return NextResponse.json({ error: 'La plage de dates ne peut pas dépasser 1 an' }, { status: 400 });
        }
      }
    }

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.invoiceDate = {};
      if (from) (where.invoiceDate as Record<string, unknown>).gte = new Date(from);
      if (to) (where.invoiceDate as Record<string, unknown>).lte = new Date(to);
    }

    // #83 Audit: Sort at DB level via ORDER BY, configurable via query param
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const allowedSortFields = ['createdAt', 'invoiceDate', 'dueDate', 'total', 'customerName', 'invoiceNumber'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [invoices, total] = await Promise.all([
      prisma.customerInvoice.findMany({
        where,
        include: { items: true },
        orderBy: { [safeSortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerInvoice.count({ where }),
    ]);

    const mapped = invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      shippingCost: Number(inv.shippingCost),
      discount: Number(inv.discount),
      taxTps: Number(inv.taxTps),
      taxTvq: Number(inv.taxTvq),
      taxTvh: Number(inv.taxTvh),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balance: Number(inv.balance),
      items: inv.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        total: Number(item.total),
      })),
    }));

    return NextResponse.json({
      invoices: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get customer invoices error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures clients' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/customer-invoices
 * Create a manual customer invoice
 */
export const POST = withAdminGuard(async (request) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/customer-invoices');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // Zod validation
    const parsed = createCustomerInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }
    const { customerName, customerEmail, customerAddress, items, dueDate, notes, status: requestedStatus } = parsed.data;

    // Validation handled by Zod schema above

    // #36 Validate dueDate >= invoiceDate (today)
    const invoiceDateNow = new Date();
    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide pour dueDate' },
        { status: 400 }
      );
    }
    const invoiceDateOnly = new Date(invoiceDateNow.getFullYear(), invoiceDateNow.getMonth(), invoiceDateNow.getDate());
    const dueDateOnly = new Date(parsedDueDate.getFullYear(), parsedDueDate.getMonth(), parsedDueDate.getDate());
    if (dueDateOnly < invoiceDateOnly) {
      return NextResponse.json(
        { error: 'La date d\'échéance ne peut pas être antérieure à la date de facturation' },
        { status: 400 }
      );
    }

    // #37 Calculate subtotal from items: quantity * unitPrice - discount
    // TODO: F054 - discount is always treated as absolute amount. Add discountType field
    // ('ABSOLUTE' | 'PERCENTAGE') to CustomerInvoiceItem schema to support percentage discounts.
    const subtotal = items.reduce(
      (sum: number, item) =>
        sum + (item.quantity * item.unitPrice - (item.discount || 0)),
      0
    );

    // S10-03: Server-side tax computation. Client-sent taxTps/taxTvq are IGNORED.
    // Taxes are computed from item-level applyGst/applyQst flags and the canonical tax rates.
    let tpsBase = 0;
    let tvqBase = 0;
    for (const item of items) {
      const lineAmount = roundCurrency(item.quantity * item.unitPrice - (item.discount || 0));
      if (item.applyGst !== false) tpsBase += lineAmount;
      if (item.applyQst !== false) tvqBase += lineAmount;
    }
    const tps = calculateTax(tpsBase, GST_RATE);
    const tvq = calculateTax(tvqBase, QST_RATE);
    const tvh = 0; // HST computed separately when applicable (not QC)
    const total = roundCurrency(subtotal + tps + tvq + tvh);

    // Generate invoice number inside a transaction to prevent race conditions
    const year = new Date().getFullYear();
    const prefix = `FACT-${year}-`;

    const invoice = await prisma.$transaction(async (tx) => {
      const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
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
      const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

      return tx.customerInvoice.create({
        data: {
          invoiceNumber,
          customerName,
          customerEmail: customerEmail || null,
          customerAddress: customerAddress || null,
          subtotal,
          taxTps: tps,
          taxTvq: tvq,
          taxTvh: tvh,
          total,
          balance: total,
          invoiceDate: new Date(),
          dueDate: new Date(dueDate),
          status: requestedStatus || 'DRAFT',
          notes: notes || null,
          items: {
            create: items.map((item) => ({
              id: uuidv4(),
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.quantity * item.unitPrice - (item.discount || 0),
            })),
          },
        },
        include: { items: true },
      });
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    logger.error('Create customer invoice error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la facture' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/customer-invoices
 * Update invoice status
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/customer-invoices');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateCustomerInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, status, paidAt, amountPaid } = parsed.data;

    const existing = await prisma.customerInvoice.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Guard: PAID invoices may not have financial fields modified.
    // Only status (→ VOID), notes, and adminNotes are permitted.
    if (existing.status === 'PAID') {
      const financialFields = ['amountPaid', 'subtotal', 'taxTps', 'taxTvq', 'taxTvh', 'total', 'discount', 'shippingCost', 'dueDate', 'items'];
      const attemptedFinancialChange = financialFields.some((f) => body[f] !== undefined);
      if (attemptedFinancialChange) {
        return NextResponse.json(
          { error: "Impossible de modifier les montants d'une facture payée. Utilisez une note de crédit." },
          { status: 400 }
        );
      }
    }

    // #47 Invoice status transition validation (state machine)
    const VALID_INVOICE_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['SENT', 'VOID'],
      SENT: ['PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
      PARTIAL: ['PAID', 'OVERDUE', 'VOID'],
      OVERDUE: ['PARTIAL', 'PAID', 'VOID'],
      PAID: ['VOID'], // Only void after paid
      VOID: [], // Terminal state
    };

    const updateData: Record<string, unknown> = {};
    if (paidAt) updateData.paidAt = new Date(paidAt);
    if (amountPaid !== undefined) {
      const total = Number(existing.total);
      if (amountPaid < 0 || amountPaid > total) {
        return NextResponse.json(
          { error: `amountPaid doit être entre 0 et ${total}` },
          { status: 400 }
        );
      }
      updateData.amountPaid = amountPaid;
      updateData.balance = total - amountPaid;

      // #39 Auto-derive status from amountPaid
      if (!status) {
        if (amountPaid >= total) {
          updateData.status = 'PAID';
          updateData.paidAt = updateData.paidAt || new Date();
        } else if (amountPaid > 0) {
          updateData.status = 'PARTIAL';
        }
      }
    }

    // Apply explicit status if provided
    if (status) {
      const currentStatus = existing.status;
      const allowedTransitions = VALID_INVOICE_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(status)) {
        return NextResponse.json(
          { error: `Transition de statut invalide: ${currentStatus} -> ${status}. Transitions autorisées: ${allowedTransitions.join(', ') || 'aucune'}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    const invoice = await prisma.customerInvoice.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    // #75 Compliance: Audit logging for status changes
    if (status && status !== existing.status) {
      logger.info('AUDIT: Customer invoice status change', {
        invoiceId: id,
        invoiceNumber: existing.invoiceNumber,
        previousStatus: existing.status,
        newStatus: status,
        changedBy: session.user.id || session.user.email,
        changedAt: new Date().toISOString(),
        ...(amountPaid !== undefined && { amountPaid }),
      });

      // Phase 4 Compliance: Granular audit trail logging
      logAuditTrail({
        entityType: 'CustomerInvoice',
        entityId: id,
        action: 'STATUS_CHANGE',
        field: 'status',
        oldValue: existing.status,
        newValue: status,
        userId: session.user.id || session.user.email || 'unknown',
        userName: session.user.name || undefined,
      });
    }

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    logger.error('Update customer invoice error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la facture' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/customer-invoices
 * Soft-delete a customer invoice (audit trail preservation)
 */
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/customer-invoices');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.customerInvoice.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    if (existing.status === 'PAID') {
      return NextResponse.json(
        { error: 'Les factures payées ne peuvent pas être supprimées' },
        { status: 400 }
      );
    }

    // Soft delete: preserve audit trail
    await prisma.customerInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logAuditTrail({
      entityType: 'CustomerInvoice',
      entityId: id,
      action: 'DELETE',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: { invoiceNumber: existing.invoiceNumber },
    });

    return NextResponse.json({ success: true, message: 'Facture supprimée' });
  } catch (error) {
    logger.error('Delete customer invoice error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la facture' },
      { status: 500 }
    );
  }
});

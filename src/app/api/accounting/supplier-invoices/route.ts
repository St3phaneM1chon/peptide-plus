export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

const createSupplierInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(100),
  supplierName: z.string().min(1).max(200),
  supplierEmail: z.string().email().optional().or(z.literal('')),
  invoiceDate: z.string().min(1),
  dueDate: z.string().min(1),
  subtotal: z.number().min(0),
  taxTps: z.number().min(0).default(0),
  taxTvq: z.number().min(0).default(0),
  taxOther: z.number().min(0).default(0),
  total: z.number().min(0),
  notes: z.string().max(2000).optional(),
  supplierId: z.string().optional(),
  expenseCategory: z.string().optional(),
});

/**
 * GET /api/accounting/supplier-invoices
 * List supplier invoices with filters
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (from || to) {
      where.invoiceDate = {};
      if (from) (where.invoiceDate as Record<string, unknown>).gte = new Date(from);
      if (to) (where.invoiceDate as Record<string, unknown>).lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { supplierEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    // #84 Audit: Sort at DB level via ORDER BY, configurable via query param
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const allowedSortFields = ['createdAt', 'invoiceDate', 'dueDate', 'total', 'supplierName', 'invoiceNumber'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [invoices, total] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        orderBy: { [safeSortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplierInvoice.count({ where }),
    ]);

    const mapped = invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      taxTps: Number(inv.taxTps),
      taxTvq: Number(inv.taxTvq),
      taxOther: Number(inv.taxOther),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balance: Number(inv.balance),
    }));

    return NextResponse.json({
      invoices: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get supplier invoices error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures fournisseurs' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/supplier-invoices
 * Create a supplier invoice
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();

    const parsed = createSupplierInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      invoiceNumber, supplierName, supplierEmail,
      subtotal, taxTps, taxTvq, taxOther, total,
      invoiceDate, dueDate, expenseCategory,
    } = parsed.data;

    // #49 Validate invoiceDate <= dueDate
    const parsedInvoiceDate = new Date(invoiceDate);
    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedInvoiceDate.getTime()) || isNaN(parsedDueDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide pour invoiceDate ou dueDate' },
        { status: 400 }
      );
    }
    if (parsedInvoiceDate > parsedDueDate) {
      return NextResponse.json(
        { error: 'La date de facturation ne peut pas être postérieure à la date d\'échéance' },
        { status: 400 }
      );
    }

    // #38 Validate total equals subtotal + taxes (server-side recompute)
    const computedTotal = Number(subtotal) + Number(taxTps || 0) + Number(taxTvq || 0) + Number(taxOther || 0);
    if (Math.abs(computedTotal - Number(total)) > 0.01) {
      return NextResponse.json(
        { error: `Le total (${total}) ne correspond pas au sous-total + taxes (${computedTotal.toFixed(2)})` },
        { status: 400 }
      );
    }

    const invoice = await prisma.supplierInvoice.create({
      data: {
        invoiceNumber,
        supplierName,
        supplierEmail: supplierEmail || null,
        subtotal,
        taxTps: taxTps || 0,
        taxTvq: taxTvq || 0,
        taxOther: taxOther || 0,
        total,
        balance: total,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        expenseCategory: expenseCategory || null,
        status: 'DRAFT',
      },
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    console.error('Create supplier invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la facture fournisseur' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/supplier-invoices
 * Update a supplier invoice
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { id, status, amountPaid, paidAt } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.supplierInvoice.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    // Supplier invoice status transition validation (state machine)
    const VALID_SUPPLIER_INVOICE_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['RECEIVED', 'VOID'],
      RECEIVED: ['PARTIAL', 'PAID', 'OVERDUE', 'VOID'],
      PARTIAL: ['PAID', 'OVERDUE', 'VOID'],
      OVERDUE: ['PARTIAL', 'PAID', 'VOID'],
      PAID: ['VOID'],
      VOID: [],
    };

    const updateData: Record<string, unknown> = {};
    if (status) {
      const currentStatus = existing.status;
      const allowedTransitions = VALID_SUPPLIER_INVOICE_TRANSITIONS[currentStatus] || [];
      if (!allowedTransitions.includes(status)) {
        return NextResponse.json(
          { error: `Transition de statut invalide: ${currentStatus} -> ${status}. Transitions autorisées: ${allowedTransitions.join(', ') || 'aucune'}` },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
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
    }

    const invoice = await prisma.supplierInvoice.update({
      where: { id },
      data: updateData,
    });

    // #76 Compliance: Audit logging for PUT operations
    console.info('AUDIT: Supplier invoice updated', {
      invoiceId: id,
      invoiceNumber: existing.invoiceNumber,
      previousStatus: existing.status,
      newStatus: status || existing.status,
      updatedBy: session.user.id || session.user.email,
      updatedAt: new Date().toISOString(),
      changes: {
        ...(status && status !== existing.status && { status: { from: existing.status, to: status } }),
        ...(amountPaid !== undefined && { amountPaid }),
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Update supplier invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la facture fournisseur' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/supplier-invoices
 * Soft-delete a supplier invoice (audit trail preservation)
 */
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.supplierInvoice.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    if (existing.status === 'PAID') {
      return NextResponse.json(
        { error: 'Les factures payées ne peuvent pas être supprimées' },
        { status: 400 }
      );
    }

    // Soft delete: preserve audit trail
    await prisma.supplierInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // #76 Compliance: Audit logging for DELETE operations
    console.info('AUDIT: Supplier invoice deleted (soft)', {
      invoiceId: id,
      invoiceNumber: existing.invoiceNumber,
      supplierName: existing.supplierName,
      status: existing.status,
      deletedBy: session.user.id || session.user.email,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Facture fournisseur supprimée' });
  } catch (error) {
    console.error('Delete supplier invoice error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la facture fournisseur' },
      { status: 500 }
    );
  }
});

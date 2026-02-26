export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { assertPeriodOpen } from '@/lib/accounting/validation';
import { logger } from '@/lib/logger';
// A003 FIX: Add rate limiting and CSRF protection
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

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
    logger.error('Get supplier invoices error', { error: error instanceof Error ? error.message : String(error) });
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
    // A003 FIX: Rate limiting + CSRF validation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/supplier-invoices');
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

    const parsed = createSupplierInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }

    const {
      invoiceNumber, supplierName, supplierEmail,
      subtotal, taxTps, taxTvq, taxOther, total,
      invoiceDate, dueDate, expenseCategory,
    } = parsed.data;

    // FIX: F012 - Check for duplicate invoice number before creating.
    // The DB has a unique constraint on invoiceNumber, but catching the error
    // here gives a friendlier message than a raw Prisma unique violation.
    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: { invoiceNumber, deletedAt: null },
      select: { id: true },
    });
    if (existingInvoice) {
      return NextResponse.json(
        { error: `Une facture fournisseur avec le numéro "${invoiceNumber}" existe déjà` },
        { status: 409 }
      );
    }

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
    // FIX: F055 - Use currency-aware tolerance (0.01 for CAD/USD, 1.0 for JPY/KRW, etc.)
    // For now, use 0.02 to handle multi-currency rounding differences (e.g. JPY→CAD conversion)
    const computedTotal = Number(subtotal) + Number(taxTps || 0) + Number(taxTvq || 0) + Number(taxOther || 0);
    const tolerance = 0.02;
    if (Math.abs(computedTotal - Number(total)) > tolerance) {
      return NextResponse.json(
        { error: `Le total (${total}) ne correspond pas au sous-total + taxes (${computedTotal.toFixed(2)})` },
        { status: 400 }
      );
    }

    // IMP-A017: Check that the invoice date is not in a closed/locked accounting period
    try {
      await assertPeriodOpen(parsedInvoiceDate);
    } catch (periodError) {
      return NextResponse.json(
        { error: periodError instanceof Error ? periodError.message : 'Période comptable verrouillée' },
        { status: 400 }
      );
    }

    // A097: Generate an internal sequential reference number (separate from supplier's invoice number).
    // This provides consistent internal tracking regardless of supplier numbering conventions.
    const year = new Date(invoiceDate).getFullYear();
    const internalPrefix = `FF-${year}-`;
    let internalRef: string | undefined;
    try {
      const [maxRow] = await prisma.$queryRaw<{ max_ref: string | null }[]>`
        SELECT MAX("internalRef") as max_ref
        FROM "SupplierInvoice"
        WHERE "internalRef" LIKE ${internalPrefix + '%'}
      `;
      let nextNum = 1;
      if (maxRow?.max_ref) {
        const num = parseInt(maxRow.max_ref.split('-').pop() || '0');
        if (!isNaN(num)) nextNum = num + 1;
      }
      internalRef = `${internalPrefix}${String(nextNum).padStart(5, '0')}`;
    } catch {
      // A097: If internalRef column doesn't exist yet, skip silently.
      // The column may be added in a future migration.
      internalRef = undefined;
    }

    const createData: Record<string, unknown> = {
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
    };
    // A097: Include internal reference if the column exists
    if (internalRef) {
      createData.internalRef = internalRef;
    }

    const invoice = await prisma.supplierInvoice.create({
      data: createData as Parameters<typeof prisma.supplierInvoice.create>[0]['data'],
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    logger.error('Create supplier invoice error', { error: error instanceof Error ? error.message : String(error) });
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
    // A003 FIX: Rate limiting + CSRF validation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/supplier-invoices');
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
    const { id, status, amountPaid, paidAt, updatedAt: clientUpdatedAt } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.supplierInvoice.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json({ error: 'Facture fournisseur non trouvée' }, { status: 404 });
    }

    // A058: Optimistic locking - verify the invoice has not been modified by another user
    // since the client last fetched it. Prevents silent data loss from concurrent edits.
    if (clientUpdatedAt && existing.updatedAt.toISOString() !== clientUpdatedAt) {
      return NextResponse.json(
        { error: 'Facture modifiée par un autre utilisateur. Veuillez recharger.' },
        { status: 409 }
      );
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

    // A035: Use $transaction for atomicity when modifying financial fields (status + amountPaid + balance)
    // to prevent inconsistent state if the request is interrupted mid-update.
    const invoice = await prisma.$transaction(async (tx) => {
      return tx.supplierInvoice.update({
        where: { id },
        data: updateData,
      });
    });

    // #76 Compliance: Audit logging for PUT operations
    logger.info('AUDIT: Supplier invoice updated', {
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

    // FIX (F028): Persist audit trail to DB (not just console.info)
    logAuditTrail({
      entityType: 'SUPPLIER_INVOICE',
      entityId: id,
      action: 'UPDATE',
      field: status && status !== existing.status ? 'status' : amountPaid !== undefined ? 'amountPaid' : undefined,
      oldValue: status && status !== existing.status ? existing.status : amountPaid !== undefined ? String(Number(existing.amountPaid)) : null,
      newValue: status && status !== existing.status ? status : amountPaid !== undefined ? String(amountPaid) : null,
      userId: session.user.id || session.user.email || 'system',
      userName: session.user.name || session.user.email || undefined,
      metadata: {
        invoiceNumber: existing.invoiceNumber,
        supplierName: existing.supplierName,
      },
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    logger.error('Update supplier invoice error', { error: error instanceof Error ? error.message : String(error) });
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
    // A003 FIX: Rate limiting + CSRF validation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/supplier-invoices');
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

    // ACF-005: Check for cross-references before soft-deleting.
    // Inventory transactions and purchase orders referencing this invoice must be
    // unlinked first to avoid orphaned financial records.
    const [inventoryTxCount, purchaseOrderCount] = await Promise.all([
      prisma.inventoryTransaction.count({ where: { supplierInvoiceId: id } }),
      prisma.purchaseOrder.count({ where: { supplierInvoiceId: id } }),
    ]);
    if (inventoryTxCount > 0 || purchaseOrderCount > 0) {
      const refs: string[] = [];
      if (inventoryTxCount > 0) refs.push(`${inventoryTxCount} transaction(s) d'inventaire`);
      if (purchaseOrderCount > 0) refs.push(`${purchaseOrderCount} bon(s) de commande`);
      return NextResponse.json(
        {
          error: `Impossible de supprimer cette facture fournisseur: ${refs.join(' et ')} y font référence. Veuillez d'abord délier ces enregistrements.`,
        },
        { status: 400 }
      );
    }

    // IMP-A004: Enforce 7-year retention policy (CRA/RQ section 230(4) ITA)
    const RETENTION_YEARS = 7;
    const retentionCutoff = new Date();
    retentionCutoff.setFullYear(retentionCutoff.getFullYear() - RETENTION_YEARS);
    if (existing.invoiceDate > retentionCutoff) {
      const retentionEndDate = new Date(existing.invoiceDate);
      retentionEndDate.setFullYear(retentionEndDate.getFullYear() + RETENTION_YEARS);
      return NextResponse.json(
        {
          error: `Suppression interdite: cette facture fournisseur (${existing.invoiceNumber}) est sous la politique de retention fiscale de ${RETENTION_YEARS} ans (CRA/RQ art. 230(4) LIR). Retention jusqu'au ${retentionEndDate.toISOString().split('T')[0]}.`,
        },
        { status: 400 }
      );
    }

    // Soft delete: preserve audit trail
    await prisma.supplierInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // #76 Compliance: Audit logging for DELETE operations
    logger.info('AUDIT: Supplier invoice deleted (soft)', {
      invoiceId: id,
      invoiceNumber: existing.invoiceNumber,
      supplierName: existing.supplierName,
      status: existing.status,
      deletedBy: session.user.id || session.user.email,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Facture fournisseur supprimée' });
  } catch (error) {
    logger.error('Delete supplier invoice error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la facture fournisseur' },
      { status: 500 }
    );
  }
});

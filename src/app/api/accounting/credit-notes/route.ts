export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { roundCurrency, calculateTax } from '@/lib/financial';
import { GST_RATE, QST_RATE } from '@/lib/tax-constants';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// #65 Audit: Valid status transitions for credit notes
// DRAFT -> ISSUED, VOID
// ISSUED -> APPLIED, VOID
// APPLIED -> VOID (Only void after applied, not back to DRAFT)
// VOID -> (Terminal state)

/**
 * GET /api/accounting/credit-notes
 * List credit notes with filters
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [creditNotes, total] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.creditNote.count({ where }),
    ]);

    // Aggregate stats using DB-level aggregation instead of fetching all records
    // Filter out soft-deleted credit notes from stats as well
    const statsWhere = { deletedAt: null };
    const [totalAgg, statusGroups] = await Promise.all([
      prisma.creditNote.aggregate({
        where: statsWhere,
        _count: true,
        _sum: { total: true },
      }),
      prisma.creditNote.groupBy({
        by: ['status'],
        where: statsWhere,
        _count: true,
        _sum: { total: true },
      }),
    ]);

    const issuedGroup = statusGroups.find((g) => g.status === 'ISSUED');
    const voidGroup = statusGroups.find((g) => g.status === 'VOID');

    const stats = {
      totalCount: totalAgg._count,
      totalAmount: Number(totalAgg._sum.total ?? 0),
      issuedCount: issuedGroup?._count ?? 0,
      issuedAmount: Number(issuedGroup?._sum.total ?? 0),
      voidCount: voidGroup?._count ?? 0,
    };

    const mapped = creditNotes.map((cn) => ({
      ...cn,
      subtotal: Number(cn.subtotal),
      taxTps: Number(cn.taxTps),
      taxTvq: Number(cn.taxTvq),
      taxTvh: Number(cn.taxTvh),
      total: Number(cn.total),
    }));

    return NextResponse.json({
      creditNotes: mapped,
      stats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get credit notes error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des notes de credit' },
      { status: 500 }
    );
  }
});

// A064: Partial credit note support - create credit note for a portion of an invoice
const createCreditNoteSchema = z.object({
  invoiceId: z.string().min(1, 'invoiceId requis'),
  reason: z.string().min(1, 'Raison requise').max(500),
  // A064: Partial amount - if omitted or equal to invoice total, it's a full credit note
  amount: z.number().min(0.01, 'Montant minimum 0.01').optional(),
  // A064: Individual item amounts for partial credits
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().min(0.01),
  })).optional(),
});

/**
 * POST /api/accounting/credit-notes
 * A064: Create a credit note (full or partial) for a customer invoice.
 * Supports partial credit notes by specifying either a total amount or individual items.
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/credit-notes');
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
    const parsed = createCreditNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.errors }, { status: 400 });
    }
    const { invoiceId, reason, amount, items } = parsed.data;

    // Fetch the referenced invoice
    const invoice = await prisma.customerInvoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
      include: { items: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // A064: Calculate credit note subtotal
    let subtotal: number;
    if (items && items.length > 0) {
      // Partial: sum of individual item amounts
      subtotal = roundCurrency(items.reduce((s, item) => s + item.amount, 0));
    } else if (amount !== undefined) {
      subtotal = roundCurrency(amount);
    } else {
      // Full credit note: use invoice subtotal
      subtotal = Number(invoice.subtotal);
    }

    // Validate credit note does not exceed invoice total
    const invoiceTotal = Number(invoice.total);
    // Check existing non-void credit notes for this invoice
    const existingCredits = await prisma.creditNote.aggregate({
      where: {
        invoiceId,
        status: { in: ['DRAFT', 'ISSUED', 'APPLIED'] },
        deletedAt: null,
      },
      _sum: { total: true },
    });
    const existingCreditTotal = Number(existingCredits._sum.total ?? 0);

    // Calculate taxes proportionally on the credit amount
    const taxTps = calculateTax(subtotal, GST_RATE);
    const taxTvq = calculateTax(subtotal, QST_RATE);
    const total = roundCurrency(subtotal + taxTps + taxTvq);

    if (existingCreditTotal + total > invoiceTotal + 0.01) {
      return NextResponse.json(
        { error: `Le total des notes de crédit (${roundCurrency(existingCreditTotal + total)}) dépasse le montant de la facture (${invoiceTotal})` },
        { status: 400 }
      );
    }

    // Generate credit note number
    const year = new Date().getFullYear();
    const prefix = `NC-${year}-`;

    const creditNote = await prisma.$transaction(async (tx) => {
      const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX("creditNoteNumber") as max_num
        FROM "CreditNote"
        WHERE "creditNoteNumber" LIKE ${prefix + '%'}
        FOR UPDATE
      `;

      let nextNum = 1;
      if (maxRow?.max_num) {
        const p = parseInt(maxRow.max_num.split('-').pop() || '0');
        if (!isNaN(p)) nextNum = p + 1;
      }
      const creditNoteNumber = `${prefix}${String(nextNum).padStart(5, '0')}`;

      return tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          subtotal,
          taxTps,
          taxTvq,
          taxTvh: 0,
          total,
          reason,
          status: 'DRAFT',
        },
      });
    });

    logger.info('Credit note created:', {
      creditNoteId: creditNote.id,
      creditNoteNumber: creditNote.creditNoteNumber,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      subtotal,
      total,
      isPartial: total < invoiceTotal,
      createdBy: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      creditNote: {
        ...creditNote,
        subtotal: Number(creditNote.subtotal),
        taxTps: Number(creditNote.taxTps),
        taxTvq: Number(creditNote.taxTvq),
        taxTvh: Number(creditNote.taxTvh),
        total: Number(creditNote.total),
      },
      isPartial: total < invoiceTotal,
    }, { status: 201 });
  } catch (error) {
    logger.error('Create credit note error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la note de crédit' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/credit-notes
// Update a DRAFT credit note: status transitions, reason, and/or line items
// ---------------------------------------------------------------------------

// Valid status transitions (#65 Audit)
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'VOID'],
  ISSUED: ['APPLIED', 'VOID'],
  APPLIED: ['VOID'],
  // VOID is terminal
};

const updateCreditNoteSchema = z.object({
  id: z.string().min(1, 'id requis'),
  // Status transition (optional)
  status: z.enum(['DRAFT', 'ISSUED', 'APPLIED', 'VOID']).optional(),
  // Editable fields (only for DRAFT credit notes)
  reason: z.string().min(1).max(500).optional(),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().nullable(),
  // Line items for recalculation (only for DRAFT)
  items: z.array(z.object({
    description: z.string().min(1),
    amount: z.number().min(0.01),
  })).optional(),
  // Direct amount override (only for DRAFT, mutually exclusive with items)
  amount: z.number().min(0.01).optional(),
});

export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/credit-notes');
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
    const parsed = updateCreditNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.errors }, { status: 400 });
    }
    const { id, status: newStatus, reason, customerName, customerEmail, items, amount } = parsed.data;

    // Fetch existing credit note
    const existing = await prisma.creditNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Note de credit non trouvee' }, { status: 404 });
    }

    // ---------------------------------------------------------------------------
    // Status transition validation
    // ---------------------------------------------------------------------------
    if (newStatus && newStatus !== existing.status) {
      const allowed = VALID_STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Transition de statut invalide: ${existing.status} -> ${newStatus}. Transitions permises: ${allowed.join(', ') || 'aucune'}` },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------------------------------------
    // Line item / amount editing (only for DRAFT credit notes)
    // ---------------------------------------------------------------------------
    const hasContentEdits = items || amount !== undefined || reason || customerName || ('customerEmail' in body);
    if (hasContentEdits && existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seules les notes de credit en statut DRAFT peuvent etre modifiees. Statut actuel: ' + existing.status },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Status change
    if (newStatus && newStatus !== existing.status) {
      updateData.status = newStatus;
      if (newStatus === 'ISSUED') {
        updateData.issuedAt = new Date();
        updateData.issuedBy = session.user.id || session.user.email;
      }
      if (newStatus === 'VOID') {
        updateData.voidedAt = new Date();
        updateData.voidedBy = session.user.id || session.user.email;
      }
    }

    // Simple field updates
    if (reason) updateData.reason = reason;
    if (customerName) updateData.customerName = customerName;
    if ('customerEmail' in body) updateData.customerEmail = customerEmail ?? null;

    // Recalculate totals if items or amount changed
    if (items || amount !== undefined) {
      let subtotal: number;

      if (items && items.length > 0) {
        subtotal = roundCurrency(items.reduce((s, item) => s + item.amount, 0));
      } else if (amount !== undefined) {
        subtotal = roundCurrency(amount);
      } else {
        subtotal = Number(existing.subtotal);
      }

      // Validate against invoice total if linked to an invoice
      if (existing.invoiceId) {
        const invoice = await prisma.customerInvoice.findFirst({
          where: { id: existing.invoiceId, deletedAt: null },
        });

        if (invoice) {
          const invoiceTotal = Number(invoice.total);

          // Sum existing non-void credit notes for same invoice, excluding current one
          const existingCredits = await prisma.creditNote.aggregate({
            where: {
              invoiceId: existing.invoiceId,
              id: { not: id },
              status: { in: ['DRAFT', 'ISSUED', 'APPLIED'] },
              deletedAt: null,
            },
            _sum: { total: true },
          });
          const existingCreditTotal = Number(existingCredits._sum.total ?? 0);

          const taxTps = calculateTax(subtotal, GST_RATE);
          const taxTvq = calculateTax(subtotal, QST_RATE);
          const newTotal = roundCurrency(subtotal + taxTps + taxTvq);

          if (existingCreditTotal + newTotal > invoiceTotal + 0.01) {
            return NextResponse.json(
              { error: `Le total des notes de credit (${roundCurrency(existingCreditTotal + newTotal)}) depasse le montant de la facture (${invoiceTotal})` },
              { status: 400 }
            );
          }

          updateData.subtotal = subtotal;
          updateData.taxTps = taxTps;
          updateData.taxTvq = taxTvq;
          updateData.total = newTotal;
        } else {
          // Invoice not found (deleted?) -- still allow edit but recalculate taxes
          const taxTps = calculateTax(subtotal, GST_RATE);
          const taxTvq = calculateTax(subtotal, QST_RATE);
          updateData.subtotal = subtotal;
          updateData.taxTps = taxTps;
          updateData.taxTvq = taxTvq;
          updateData.total = roundCurrency(subtotal + taxTps + taxTvq);
        }
      } else {
        // No linked invoice -- just recalculate
        const taxTps = calculateTax(subtotal, GST_RATE);
        const taxTvq = calculateTax(subtotal, QST_RATE);
        updateData.subtotal = subtotal;
        updateData.taxTps = taxTps;
        updateData.taxTvq = taxTvq;
        updateData.total = roundCurrency(subtotal + taxTps + taxTvq);
      }
    }

    // Execute update in a transaction
    const creditNote = await prisma.$transaction(async (tx) => {
      return tx.creditNote.update({
        where: { id },
        data: updateData,
        include: {
          invoice: {
            select: { id: true, invoiceNumber: true },
          },
        },
      });
    });

    logger.info('Credit note updated', {
      creditNoteId: id,
      creditNoteNumber: creditNote.creditNoteNumber,
      updatedFields: Object.keys(updateData),
      oldStatus: existing.status,
      newStatus: creditNote.status,
      updatedBy: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      creditNote: {
        ...creditNote,
        subtotal: Number(creditNote.subtotal),
        taxTps: Number(creditNote.taxTps),
        taxTvq: Number(creditNote.taxTvq),
        taxTvh: Number(creditNote.taxTvh),
        total: Number(creditNote.total),
      },
    });
  } catch (error) {
    logger.error('Update credit note error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de la note de credit' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/credit-notes
// Soft-delete a DRAFT credit note only
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/credit-notes');
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
      return NextResponse.json({ error: 'id requis' }, { status: 400 });
    }

    // Fetch existing credit note
    const existing = await prisma.creditNote.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Note de credit non trouvee' }, { status: 404 });
    }

    // Only allow deletion of DRAFT credit notes
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Seules les notes de credit en statut DRAFT peuvent etre supprimees. Statut actuel: ${existing.status}` },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.creditNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Credit note soft-deleted', {
      creditNoteId: id,
      creditNoteNumber: existing.creditNoteNumber,
      deletedBy: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      deletedId: id,
      creditNoteNumber: existing.creditNoteNumber,
    });
  } catch (error) {
    logger.error('Delete credit note error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la note de credit' },
      { status: 500 }
    );
  }
});

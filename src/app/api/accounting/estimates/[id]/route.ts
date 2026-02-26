export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';
import { logger } from '@/lib/logger';
import { GST_RATE, QST_RATE } from '@/lib/tax-constants';
import { roundCurrency, calculateTax } from '@/lib/financial';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeEffectiveStatus(status: string, validUntil: Date): string {
  if (status === 'SENT' && new Date() > validUntil) {
    return 'EXPIRED';
  }
  return status;
}

function mapEstimateToJson(est: Record<string, unknown>) {
  return {
    ...est,
    subtotal: Number(est.subtotal),
    discountAmount: Number(est.discountAmount),
    discountPercent: Number(est.discountPercent),
    taxGst: Number(est.taxGst),
    taxQst: Number(est.taxQst),
    taxTotal: Number(est.taxTotal),
    total: Number(est.total),
    status: computeEffectiveStatus(
      est.status as string,
      est.validUntil as Date
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: Array.isArray(est.items) ? (est.items as any[]).map((item: Record<string, unknown>) => ({
      ...item,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent),
      taxRate: Number(item.taxRate),
      lineTotal: Number(item.lineTotal),
    })) : [],
  };
}

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const updateEstimateItemSchema = z.object({
  id: z.string().optional(), // existing item ID for updates
  productId: z.string().optional().nullable(),
  productName: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).default(0),
});

const updateEstimateSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  validUntil: z.string().optional(),
  items: z.array(updateEstimateItemSchema).min(1).optional(),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  termsConditions: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional(),
  // For status-only transitions (non-content changes)
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED']).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/estimates/[id] - Single estimate with items
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const estimate = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ estimate: mapEstimateToJson(estimate) });
  } catch (error) {
    logger.error('Get estimate error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du devis' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/estimates/[id] - Update estimate
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateEstimateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    const data = parsed.data;
    const effectiveStatus = computeEffectiveStatus(existing.status, existing.validUntil);

    // Content changes only allowed for DRAFT estimates
    const isContentChange = data.items || data.customerName || data.customerEmail ||
      data.customerAddress || data.customerPhone || data.validUntil ||
      data.discountPercent !== undefined || data.termsConditions !== undefined;

    if (isContentChange && effectiveStatus !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seuls les devis en brouillon peuvent être modifiés. Dupliquez le devis pour créer une nouvelle version.' },
        { status: 400 }
      );
    }

    // Status transition validation
    const VALID_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['SENT'],
      SENT: ['VIEWED', 'ACCEPTED', 'DECLINED'],
      VIEWED: ['ACCEPTED', 'DECLINED'],
      ACCEPTED: ['CONVERTED'],
      DECLINED: [],
      EXPIRED: [],
      CONVERTED: [],
    };

    if (data.status) {
      const allowedTransitions = VALID_TRANSITIONS[effectiveStatus] || [];
      if (!allowedTransitions.includes(data.status)) {
        return NextResponse.json(
          { error: `Transition de statut invalide: ${effectiveStatus} -> ${data.status}. Transitions autorisées: ${allowedTransitions.join(', ') || 'aucune'}` },
          { status: 400 }
        );
      }
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (data.customerName) updateData.customerName = data.customerName;
    if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail;
    if (data.customerAddress !== undefined) updateData.customerAddress = data.customerAddress;
    if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
    if (data.customerId !== undefined) updateData.customerId = data.customerId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
    if (data.termsConditions !== undefined) updateData.termsConditions = data.termsConditions;
    if (data.templateId !== undefined) updateData.templateId = data.templateId;
    if (data.status) updateData.status = data.status;

    if (data.validUntil) {
      const validUntilDate = new Date(data.validUntil);
      if (isNaN(validUntilDate.getTime())) {
        return NextResponse.json({ error: 'Date de validité invalide' }, { status: 400 });
      }
      updateData.validUntil = validUntilDate;
    }

    // Status-specific field updates
    if (data.status === 'SENT') {
      updateData.sentAt = new Date();
    }

    // Recalculate totals if items or discount changed
    if (data.items || data.discountPercent !== undefined) {
      const items = data.items || existing.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discountPercent: Number(i.discountPercent),
        taxRate: Number(i.taxRate),
        sortOrder: i.sortOrder,
      }));

      let subtotal = 0;
      const itemsData = items.map((item, idx) => {
        const discountMultiplier = 1 - ((item.discountPercent || 0) / 100);
        const lineTotal = roundCurrency(item.quantity * item.unitPrice * discountMultiplier);
        subtotal += lineTotal;
        return {
          productId: item.productId || null,
          productName: item.productName,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          taxRate: item.taxRate || 0,
          lineTotal,
          sortOrder: item.sortOrder ?? idx,
        };
      });
      subtotal = roundCurrency(subtotal);

      const globalDiscountPercent = data.discountPercent ?? Number(existing.discountPercent);
      const discountAmount = roundCurrency(subtotal * (globalDiscountPercent / 100));
      const afterDiscount = roundCurrency(subtotal - discountAmount);
      const taxGst = calculateTax(afterDiscount, GST_RATE);
      const taxQst = calculateTax(afterDiscount, QST_RATE);
      const taxTotal = roundCurrency(taxGst + taxQst);
      const total = roundCurrency(afterDiscount + taxTotal);

      updateData.subtotal = subtotal;
      updateData.discountAmount = discountAmount;
      updateData.discountPercent = globalDiscountPercent;
      updateData.taxGst = taxGst;
      updateData.taxQst = taxQst;
      updateData.taxTotal = taxTotal;
      updateData.total = total;

      // Replace items: delete all existing, create new
      const estimate = await prisma.$transaction(async (tx) => {
        await tx.estimateItem.deleteMany({ where: { estimateId: id } });
        return tx.estimate.update({
          where: { id },
          data: {
            ...updateData,
            items: { create: itemsData },
          },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
      });

      logAuditTrail({
        entityType: 'Estimate',
        entityId: id,
        action: 'UPDATE',
        userId: session.user.id || session.user.email || 'unknown',
        userName: session.user.name || undefined,
        metadata: { estimateNumber: existing.estimateNumber },
      });

      return NextResponse.json({ success: true, estimate: mapEstimateToJson(estimate) });
    }

    // Simple update without items change
    const estimate = await prisma.estimate.update({
      where: { id },
      data: updateData,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    if (data.status && data.status !== existing.status) {
      logAuditTrail({
        entityType: 'Estimate',
        entityId: id,
        action: 'STATUS_CHANGE',
        field: 'status',
        oldValue: existing.status,
        newValue: data.status,
        userId: session.user.id || session.user.email || 'unknown',
        userName: session.user.name || undefined,
        metadata: { estimateNumber: existing.estimateNumber },
      });
    }

    return NextResponse.json({ success: true, estimate: mapEstimateToJson(estimate) });
  } catch (error) {
    logger.error('Update estimate error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du devis' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/estimates/[id] - Soft delete (DRAFT only)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.estimate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Seuls les devis en brouillon peuvent être supprimés' },
        { status: 400 }
      );
    }

    await prisma.estimate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logAuditTrail({
      entityType: 'Estimate',
      entityId: id,
      action: 'DELETE',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: { estimateNumber: existing.estimateNumber },
    });

    return NextResponse.json({ success: true, message: 'Devis supprimé' });
  } catch (error) {
    logger.error('Delete estimate error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du devis' },
      { status: 500 }
    );
  }
});

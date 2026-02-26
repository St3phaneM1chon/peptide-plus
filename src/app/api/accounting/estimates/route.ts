export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting';
import { logger } from '@/lib/logger';
import { GST_RATE, QST_RATE } from '@/lib/tax-constants';
import { roundCurrency, calculateTax } from '@/lib/financial';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const estimateItemSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string().min(1, 'Le nom du produit est requis'),
  description: z.string().optional().nullable(),
  quantity: z.number().positive('La quantité doit être positive'),
  unitPrice: z.number().min(0, 'Le prix unitaire doit être >= 0'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  sortOrder: z.number().int().min(0).default(0),
});

const createEstimateSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1, 'Le nom du client est requis'),
  customerEmail: z.string().email('Email invalide').optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  validUntil: z.string().min(1, 'La date de validité est requise'),
  items: z.array(estimateItemSchema).min(1, 'Au moins un article est requis'),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  termsConditions: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  discountPercent: z.number().min(0).max(100).default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute effective status: if SENT and past validUntil, show as EXPIRED */
function computeEffectiveStatus(status: string, validUntil: Date): string {
  if (status === 'SENT' && new Date() > validUntil) {
    return 'EXPIRED';
  }
  return status;
}

/** Map Prisma Decimal fields to numbers for JSON serialization */
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
// GET /api/accounting/estimates - List estimates with filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const allowedSortFields = ['createdAt', 'estimateNumber', 'customerName', 'total', 'validUntil', 'status'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null };

    if (status) {
      // Handle virtual EXPIRED status: find SENT estimates past validUntil
      if (status === 'EXPIRED') {
        where.status = 'SENT';
        where.validUntil = { lt: new Date() };
      } else {
        where.status = status;
        // If filtering for SENT, exclude expired ones
        if (status === 'SENT') {
          where.validUntil = { gte: new Date() };
        }
      }
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { estimateNumber: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (from || to) {
      where.issueDate = {};
      if (from) where.issueDate.gte = new Date(from);
      if (to) where.issueDate.lte = new Date(to);
    }

    const [estimates, total] = await Promise.all([
      prisma.estimate.findMany({
        where,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { [safeSortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.estimate.count({ where }),
    ]);

    const mapped = estimates.map(mapEstimateToJson);

    return NextResponse.json({
      estimates: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get estimates error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des devis' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/estimates - Create new estimate (DRAFT)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createEstimateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate validUntil is in the future
    const validUntilDate = new Date(data.validUntil);
    if (isNaN(validUntilDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide pour la validité' },
        { status: 400 }
      );
    }

    // Calculate line totals and global totals
    let subtotal = 0;
    const itemsData = data.items.map((item, idx) => {
      const discountMultiplier = 1 - (item.discountPercent / 100);
      const lineTotal = roundCurrency(item.quantity * item.unitPrice * discountMultiplier);
      subtotal += lineTotal;
      return {
        productId: item.productId || null,
        productName: item.productName,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
        lineTotal,
        sortOrder: item.sortOrder ?? idx,
      };
    });
    subtotal = roundCurrency(subtotal);

    // Apply global discount
    const globalDiscountPercent = data.discountPercent || 0;
    const discountAmount = roundCurrency(subtotal * (globalDiscountPercent / 100));
    const afterDiscount = roundCurrency(subtotal - discountAmount);

    // Calculate taxes (GST 5% + QST 9.975%)
    const taxGst = calculateTax(afterDiscount, GST_RATE);
    const taxQst = calculateTax(afterDiscount, QST_RATE);
    const taxTotal = roundCurrency(taxGst + taxQst);
    const total = roundCurrency(afterDiscount + taxTotal);

    // Generate estimate number and viewToken inside transaction
    const year = new Date().getFullYear();
    const prefix = `EST-${year}-`;

    const estimate = await prisma.$transaction(async (tx) => {
      // Get next number with lock
      const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX("estimateNumber") as max_num
        FROM "Estimate"
        WHERE "estimateNumber" LIKE ${prefix + '%'}
        FOR UPDATE
      `;

      let nextNum = 1;
      if (maxRow?.max_num) {
        const num = parseInt(maxRow.max_num.split('-').pop() || '0');
        if (!isNaN(num)) nextNum = num + 1;
      }
      const estimateNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

      // Generate unique viewToken
      const viewToken = crypto.randomUUID().replace(/-/g, '');

      return tx.estimate.create({
        data: {
          estimateNumber,
          customerId: data.customerId || null,
          customerName: data.customerName,
          customerEmail: data.customerEmail || null,
          customerAddress: data.customerAddress || null,
          customerPhone: data.customerPhone || null,
          status: 'DRAFT',
          issueDate: new Date(),
          validUntil: validUntilDate,
          subtotal,
          discountAmount,
          discountPercent: globalDiscountPercent,
          taxGst,
          taxQst,
          taxTotal,
          total,
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
          termsConditions: data.termsConditions || null,
          templateId: data.templateId || null,
          viewToken,
          createdBy: session.user.id || session.user.email || null,
          items: {
            create: itemsData,
          },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    logAuditTrail({
      entityType: 'Estimate',
      entityId: estimate.id,
      action: 'CREATE',
      userId: session.user.id || session.user.email || 'unknown',
      userName: session.user.name || undefined,
      metadata: { estimateNumber: estimate.estimateNumber },
    });

    return NextResponse.json(
      { success: true, estimate: mapEstimateToJson(estimate) },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create estimate error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du devis' },
      { status: 500 }
    );
  }
});

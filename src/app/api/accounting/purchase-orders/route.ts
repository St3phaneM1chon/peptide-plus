export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAuditTrail } from '@/lib/accounting/audit-trail.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const purchaseOrderItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, 'Nom du produit requis'),
  description: z.string().optional().default(''),
  sku: z.string().optional(),
  quantity: z.number().min(0.01, 'Quantite doit etre > 0'),
  unitCost: z.number().min(0, 'Prix unitaire >= 0'),
  taxRate: z.number().min(0).max(100).default(0),
  lineTotal: z.number().min(0),
  notes: z.string().optional(),
});

const createPurchaseOrderSchema = z.object({
  supplierName: z.string().min(1, 'Nom du fournisseur requis').max(200),
  supplierId: z.string().optional(),
  supplierEmail: z.string().email().optional().or(z.literal('')),
  supplierAddress: z.string().max(500).optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  currency: z.string().max(3).default('CAD'),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  department: z.string().max(50).default('OPS'),
  items: z.array(purchaseOrderItemSchema).min(1, 'Au moins une ligne requise'),
});

// ---------------------------------------------------------------------------
// Tax calculation helpers (GST 5%, QST 9.975%)
// ---------------------------------------------------------------------------

function calculateTotals(items: { quantity: number; unitCost: number }[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const taxTps = Math.round(subtotal * 0.05 * 100) / 100;       // GST 5%
  const taxTvq = Math.round(subtotal * 0.09975 * 100) / 100;    // QST 9.975%
  const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;
  return { subtotal, taxTps, taxTvq, total };
}

// ---------------------------------------------------------------------------
// GET /api/accounting/purchase-orders
// List purchase orders with pagination and filters
// ---------------------------------------------------------------------------

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
      where.orderDate = {};
      if (from) (where.orderDate as Record<string, unknown>).gte = new Date(from);
      if (to) (where.orderDate as Record<string, unknown>).lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { supplierEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const allowedSortFields = ['createdAt', 'orderDate', 'expectedDate', 'total', 'supplierName', 'poNumber', 'status'];
    const safeSortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { [safeSortField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    const mapped = orders.map((po) => ({
      ...po,
      subtotal: Number(po.subtotal),
      taxTps: Number(po.taxTps),
      taxTvq: Number(po.taxTvq),
      total: Number(po.total),
      items: po.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        quantityReceived: Number(item.quantityReceived),
        unitCost: Number(item.unitCost),
        taxRate: Number(item.taxRate),
        total: Number(item.total),
      })),
    }));

    return NextResponse.json({
      orders: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get purchase orders error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des bons de commande' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/purchase-orders
// Create a new purchase order (DRAFT)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createPurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Calculate totals from items
    const totals = calculateTotals(data.items);

    // Generate PO number
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const [maxRow] = await prisma.$queryRaw<{ max_num: string | null }[]>`
      SELECT MAX("poNumber") as max_num
      FROM "PurchaseOrder"
      WHERE "poNumber" LIKE ${prefix + '%'}
    `;
    let nextNum = 1;
    if (maxRow?.max_num) {
      const num = parseInt(maxRow.max_num.split('-').pop() || '0');
      if (!isNaN(num)) nextNum = num + 1;
    }
    const poNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // Create PO with items in a transaction
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: data.supplierId || null,
          supplierName: data.supplierName,
          supplierEmail: data.supplierEmail || null,
          supplierAddress: data.supplierAddress || null,
          department: data.department,
          status: 'DRAFT',
          orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          currency: data.currency,
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
          createdBy: session?.user?.email || session?.user?.name || null,
          subtotal: totals.subtotal,
          taxTps: totals.taxTps,
          taxTvq: totals.taxTvq,
          total: totals.total,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId || null,
              productName: item.productName,
              description: item.description || '',
              sku: item.sku || null,
              quantity: item.quantity,
              unitCost: item.unitCost,
              taxRate: item.taxRate,
              total: Math.round(item.quantity * item.unitCost * 100) / 100,
              notes: item.notes || null,
            })),
          },
        },
        include: { items: true },
      });
      return po;
    });

    // Audit trail
    logAuditTrail({
      entityType: 'PURCHASE_ORDER',
      entityId: purchaseOrder.id,
      action: 'CREATE',
      userId: session?.user?.id || session?.user?.email || 'system',
      userName: session?.user?.name || undefined,
      metadata: { poNumber, supplierName: data.supplierName, total: totals.total },
    }).catch(() => { /* non-blocking */ });

    logger.info('Purchase order created', { poNumber, supplierName: data.supplierName, total: totals.total });

    return NextResponse.json({
      success: true,
      order: {
        ...purchaseOrder,
        subtotal: Number(purchaseOrder.subtotal),
        taxTps: Number(purchaseOrder.taxTps),
        taxTvq: Number(purchaseOrder.taxTvq),
        total: Number(purchaseOrder.total),
        items: purchaseOrder.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          quantityReceived: Number(item.quantityReceived),
          unitCost: Number(item.unitCost),
          taxRate: Number(item.taxRate),
          total: Number(item.total),
        })),
      },
    }, { status: 201 });
  } catch (error) {
    logger.error('Create purchase order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la creation du bon de commande' },
      { status: 500 }
    );
  }
});

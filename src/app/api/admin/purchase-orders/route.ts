export const dynamic = 'force-dynamic';

/**
 * Admin Purchase Orders API
 * GET  - List purchase orders with filters (status, supplier, department, date range, search)
 * POST - Create a new purchase order
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { TAX_RATES } from '@/lib/accounting/types';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const purchaseOrderItemSchema = z.object({
  description: z.string().min(1, 'Each item must have a description'),
  quantity: z.number().positive('Each item must have a positive quantity'),
  unitCost: z.number().min(0, 'Each item must have a non-negative unitCost'),
  productId: z.string().optional().nullable(),
  formatId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
});

const createPurchaseOrderSchema = z.object({
  supplierId: z.string().optional().nullable(),
  supplierName: z.string().min(1, 'supplierName is required'),
  supplierEmail: z.string().email().optional().nullable().or(z.literal('')),
  department: z.string().optional().default('OPS'),
  items: z.array(purchaseOrderItemSchema).min(1, 'items array is required and must not be empty'),
  notes: z.string().optional().nullable(),
  currency: z.string().optional().default('CAD'),
});

// ─── GET /api/admin/purchase-orders ─────────────────────────────────────────────
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);

    // Filters
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const supplierId = searchParams.get('supplierId');
    const supplierName = searchParams.get('supplierName');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status) {
      if (status.includes(',')) {
        where.status = { in: status.split(',') };
      } else {
        where.status = status;
      }
    }

    if (department) where.department = department;

    if (supplierId) where.supplierId = supplierId;

    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    // Search across PO number, supplier name, and notes
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Include the entire end date
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = endDate;
      }
    }

    // Build orderBy
    const validSortFields = ['createdAt', 'updatedAt', 'poNumber', 'total', 'status', 'supplierName'];
    const orderBy: Record<string, string> = {};
    orderBy[validSortFields.includes(sortBy) ? sortBy : 'createdAt'] = sortOrder;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    // Convert Decimals to numbers for JSON serialization
    const serializedOrders = orders.map((order) => ({
      ...order,
      subtotal: Number(order.subtotal),
      taxTps: Number(order.taxTps),
      taxTvq: Number(order.taxTvq),
      total: Number(order.total),
      items: order.items.map((item) => ({
        ...item,
        unitCost: Number(item.unitCost),
        total: Number(item.total),
      })),
    }));

    return NextResponse.json({
      orders: serializedOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching purchase orders', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
});

// ─── POST /api/admin/purchase-orders ────────────────────────────────────────────
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createPurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const {
      supplierId,
      supplierName,
      supplierEmail,
      department,
      items,
      notes,
      currency,
    } = parsed.data;

    // Calculate totals (pure computation, no DB needed)
    let subtotal = 0;
    const processedItems = items.map((item: Record<string, unknown>) => {
      const qty = Number(item.quantity);
      const cost = Number(item.unitCost);
      const lineTotal = Math.round(qty * cost * 100) / 100;
      subtotal += lineTotal;
      return {
        id: crypto.randomUUID(),
        description: item.description as string,
        productId: (item.productId as string) || null,
        formatId: (item.formatId as string) || null,
        sku: (item.sku as string) || null,
        quantity: qty,
        unitCost: cost,
        total: lineTotal,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    const taxTps = Math.round(subtotal * TAX_RATES.QC.TPS * 100) / 100;
    const taxTvq = Math.round(subtotal * TAX_RATES.QC.TVQ * 100) / 100;
    const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;

    // Wrap PO number generation + creation in a transaction to prevent
    // race conditions (duplicate PO numbers from concurrent requests)
    const po = await prisma.$transaction(async (tx) => {
      // Generate PO number: PO-YYYY-NNNN (inside transaction for atomicity)
      const year = new Date().getFullYear();
      const count = await tx.purchaseOrder.count({
        where: { poNumber: { startsWith: `PO-${year}-` } },
      });
      const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

      return tx.purchaseOrder.create({
        data: {
          id: crypto.randomUUID(),
          poNumber,
          supplierId: supplierId || null,
          supplierName,
          supplierEmail: supplierEmail || null,
          department,
          status: 'DRAFT',
          requestedBy: session!.user.id,
          subtotal,
          taxTps,
          taxTvq,
          total,
          currency,
          notes: notes || null,
          items: {
            create: processedItems,
          },
        },
        include: { items: true },
      });
    });

    logAdminAction({
      adminUserId: session!.user.id,
      action: 'CREATE_PURCHASE_ORDER',
      targetType: 'PurchaseOrder',
      targetId: po.id,
      newValue: { poNumber: po.poNumber, supplierName, department, itemCount: processedItems.length, total },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Serialize Decimals
    return NextResponse.json(
      {
        ...po,
        subtotal: Number(po.subtotal),
        taxTps: Number(po.taxTps),
        taxTvq: Number(po.taxTvq),
        total: Number(po.total),
        items: po.items.map((item: { unitCost: unknown; total: unknown }) => ({
          ...item,
          unitCost: Number(item.unitCost),
          total: Number(item.total),
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating purchase order', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
});

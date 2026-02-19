export const dynamic = 'force-dynamic';

/**
 * Admin Purchase Orders API
 * GET  - List purchase orders with filters (status, supplier, department, date range, search)
 * POST - Create a new purchase order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// ─── GET /api/admin/purchase-orders ─────────────────────────────────────────────
export const GET = withAdminGuard(async (request, { session }) => {
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
    console.error('Error fetching purchase orders:', error);
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
    const {
      supplierId,
      supplierName,
      supplierEmail,
      department = 'OPS',
      items,
      notes,
      currency = 'CAD',
    } = body;

    // Validation
    if (!supplierName) {
      return NextResponse.json(
        { error: 'supplierName is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (!item.description) {
        return NextResponse.json(
          { error: 'Each item must have a description' },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item must have a positive quantity' },
          { status: 400 }
        );
      }
      if (item.unitCost === undefined || item.unitCost < 0) {
        return NextResponse.json(
          { error: 'Each item must have a non-negative unitCost' },
          { status: 400 }
        );
      }
    }

    // Generate PO number: PO-YYYY-NNNN
    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count({
      where: { poNumber: { startsWith: `PO-${year}-` } },
    });
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    const processedItems = items.map((item: Record<string, unknown>) => {
      const qty = Number(item.quantity);
      const cost = Number(item.unitCost);
      const lineTotal = Math.round(qty * cost * 100) / 100;
      subtotal += lineTotal;
      return {
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
    const taxTps = Math.round(subtotal * 0.05 * 100) / 100;
    const taxTvq = Math.round(subtotal * 0.09975 * 100) / 100;
    const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;

    const po = await prisma.purchaseOrder.create({
      data: {
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

    // Serialize Decimals
    return NextResponse.json(
      {
        ...po,
        subtotal: Number(po.subtotal),
        taxTps: Number(po.taxTps),
        taxTvq: Number(po.taxTvq),
        total: Number(po.total),
        items: po.items.map((item) => ({
          ...item,
          unitCost: Number(item.unitCost),
          total: Number(item.total),
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
});

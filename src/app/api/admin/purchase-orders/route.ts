import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { purchaseStock } from '@/lib/inventory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = {};
    if (status) where.status = status;
    if (department) where.department = department;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      supplierName, supplierEmail, department = 'OPS',
      items, notes, requestedBy,
    } = body;

    if (!supplierName || !items?.length) {
      return NextResponse.json(
        { error: 'supplierName and items are required' },
        { status: 400 }
      );
    }

    // Generate PO number
    const year = new Date().getFullYear();
    const count = await prisma.purchaseOrder.count({
      where: { poNumber: { startsWith: `PO-${year}-` } },
    });
    const poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      item.total = item.quantity * item.unitCost;
      subtotal += item.total;
    }
    const taxTps = Math.round(subtotal * 0.05 * 100) / 100;
    const taxTvq = Math.round(subtotal * 0.09975 * 100) / 100;
    const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierName,
        supplierEmail,
        department,
        status: 'DRAFT',
        requestedBy,
        subtotal,
        taxTps,
        taxTvq,
        total,
        notes,
        items: {
          create: items.map((item: any) => ({
            description: item.description,
            productId: item.productId || null,
            formatId: item.formatId || null,
            sku: item.sku || null,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.total,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, approvedBy, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;

    if (status) {
      updateData.status = status;

      if (status === 'APPROVED' && approvedBy) {
        updateData.approvedBy = approvedBy;
        updateData.approvedAt = new Date();
      }

      if (status === 'ORDERED') {
        updateData.orderedAt = new Date();
      }

      // When RECEIVED, create inventory transactions
      if (status === 'RECEIVED') {
        updateData.receivedAt = new Date();

        // Purchase stock for each item that has a product/format
        const stockItems = po.items
          .filter((item) => item.productId)
          .map((item) => ({
            productId: item.productId!,
            formatId: item.formatId || undefined,
            quantity: item.quantity,
            unitCost: Number(item.unitCost),
          }));

        if (stockItems.length > 0) {
          await purchaseStock(stockItems, undefined, approvedBy);
        }

        // Update received quantities
        for (const item of po.items) {
          await prisma.purchaseOrderItem.update({
            where: { id: item.id },
            data: { receivedQty: item.quantity },
          });
        }
      }
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
  }
}

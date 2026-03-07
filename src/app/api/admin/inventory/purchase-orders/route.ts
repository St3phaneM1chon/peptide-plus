export const dynamic = 'force-dynamic';

/**
 * I-INVENTORY-9: Purchase Order Tracking API
 * Track incoming purchase orders for inventory restocking
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAdminAction } from '@/lib/admin-audit';
import crypto from 'crypto';

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    formatId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitCost: z.number().positive(),
  })).min(1),
  expectedDelivery: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

type POStatus = 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

// GET: List purchase orders
export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as POStatus | null;

  const settings = await prisma.siteSetting.findMany({
    where: {
      key: { startsWith: 'po:' },
      ...(status ? {} : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const orders = settings.map((s) => {
    try {
      const po = JSON.parse(s.value);
      if (status && po.status !== status) return null;
      return { id: s.key.replace('po:', ''), ...po };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return NextResponse.json({ purchaseOrders: orders, total: orders.length });
});

// POST: Create a purchase order
export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  const body = await request.json();
  const parsed = purchaseOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const id = `po_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const totalCost = parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  const po = {
    ...parsed.data,
    status: 'DRAFT' as POStatus,
    totalCost,
    createdBy: session.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await prisma.siteSetting.create({
    data: {
      key: `po:${id}`,
      value: JSON.stringify(po),
    },
  });

  logAdminAction({
    action: 'PURCHASE_ORDER_CREATED',
    targetType: 'INVENTORY',
    targetId: id,
    adminUserId: session.user.id,
    newValue: { totalCost, itemCount: parsed.data.items.length },
  }).catch(() => {});

  return NextResponse.json({ id, ...po }, { status: 201 });
});

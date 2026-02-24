export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Use efficient aggregate queries instead of fetching all orders
    const [totalOrders, totalSpentAgg, pendingOrders, lastOrderArr] = await Promise.all([
      db.order.count({ where: { userId: user.id } }),
      db.order.aggregate({
        where: { userId: user.id },
        _sum: { total: true },
      }),
      db.order.count({
        where: {
          userId: user.id,
          status: { in: ['PENDING', 'PROCESSING', 'SHIPPED'] },
        },
      }),
      db.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, orderNumber: true, createdAt: true, total: true, status: true },
      }),
    ]);

    const totalSpent = Number(totalSpentAgg._sum.total || 0);

    // Format last order if exists
    const lastOrderData = lastOrderArr[0];
    const lastOrder = lastOrderData
      ? {
          id: lastOrderData.orderNumber || lastOrderData.id,
          date: lastOrderData.createdAt.toISOString().split('T')[0],
          total: Number(lastOrderData.total),
          status: lastOrderData.status,
        }
      : undefined;

    return NextResponse.json({
      totalOrders,
      totalSpent,
      pendingOrders,
      lastOrder,
    });
  } catch (error) {
    logger.error('Error fetching account summary', { error: error instanceof Error ? error.message : String(error) });
    
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du résumé' },
      { status: 500 }
    );
  }
}

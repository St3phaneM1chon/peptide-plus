export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

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

    // Get all orders for stats
    const allOrders = await db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const totalOrders = allOrders.length;
    const totalSpent = allOrders.reduce((sum, order) => sum + Number(order.total), 0);
    const pendingOrders = allOrders.filter(
      order => order.status === 'PENDING' || order.status === 'PROCESSING' || order.status === 'SHIPPED'
    ).length;

    // Format last order if exists
    const lastOrder = allOrders[0]
      ? {
          id: allOrders[0].orderNumber || allOrders[0].id,
          date: allOrders[0].createdAt.toISOString().split('T')[0],
          total: Number(allOrders[0].total),
          status: allOrders[0].status,
        }
      : undefined;

    return NextResponse.json({
      totalOrders,
      totalSpent,
      pendingOrders,
      lastOrder,
    });
  } catch (error) {
    console.error('Error fetching account summary:', error);
    
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du résumé' },
      { status: 500 }
    );
  }
}

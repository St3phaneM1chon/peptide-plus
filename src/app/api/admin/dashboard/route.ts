export const dynamic = 'force-dynamic';

/**
 * Admin Dashboard Stats API
 * GET - Returns key business metrics for the admin dashboard
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      totalOrders,
      ordersToday,
      ordersThisMonth,
      pendingOrders,
      totalCustomers,
      newCustomersThisMonth,
      totalProducts,
      activeProducts,
      revenueThisMonth,
      totalReviews,
      pendingReviews,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: startOfMonth } } }),
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: startOfMonth }, paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      prisma.review.count(),
      prisma.review.count({ where: { isApproved: false } }),
    ]);

    return NextResponse.json({
      orders: {
        total: totalOrders,
        today: ordersToday,
        thisMonth: ordersThisMonth,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersThisMonth,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
      },
      revenue: {
        thisMonth: Number(revenueThisMonth._sum.total || 0),
      },
      reviews: {
        total: totalReviews,
        pending: pendingReviews,
      },
    });
  } catch (error) {
    logger.error('Admin dashboard GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const dynamic = 'force-dynamic';
/**
 * DASHBOARD ADMIN - E-Commerce (Server Component)
 * Data fetching: orders, revenue, customers, inventory
 * Rendering delegated to DashboardClient for i18n support
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import DashboardClient from './DashboardClient';

// --------------------------------------------------
// Data fetching
// --------------------------------------------------

async function getAdminData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalOrders,
    pendingOrders,
    monthlyRevenueAgg,
    totalClients,
    totalCustomers,
    totalProducts,
    lowStockFormats,
    recentOrders,
    recentUsers,
  ] = await Promise.all([
    // Total orders
    prisma.order.count(),

    // Pending orders (not yet shipped/delivered)
    prisma.order.count({
      where: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
    }),

    // F1.6+F1.12: Monthly revenue via aggregate (excludes cancelled orders)
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        paymentStatus: 'PAID',
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      _sum: { total: true },
    }),

    // Total companies (clients B2B)
    prisma.company.count(),

    // Total customers
    prisma.user.count({ where: { role: 'CUSTOMER' } }),

    // Active products
    prisma.product.count({ where: { isActive: true } }),

    // F1.7: Low stock using per-format threshold via raw SQL
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "ProductFormat"
      WHERE "trackInventory" = true
        AND "isActive" = true
        AND "stockQuantity" <= "lowStockThreshold"
    `.then(rows => Number(rows[0]?.count ?? 0)),

    // F1.13: Recent orders with item count only (not full items)
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        createdAt: true,
        shippingName: true,
        _count: { select: { items: true } },
      },
    }),

    // Recent users (only needed fields)
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { role: { in: ['CUSTOMER', 'CLIENT'] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
      },
    }),
  ]);

  const monthlyRevenue = Number(monthlyRevenueAgg._sum.total ?? 0);

  return {
    stats: {
      totalOrders,
      pendingOrders,
      monthlyRevenue,
      totalClients,
      totalCustomers,
      totalProducts,
      lowStockFormats,
    },
    recentOrders,
    recentUsers,
  };
}

// --------------------------------------------------
// Page Component
// --------------------------------------------------

export default async function AdminDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  let stats, recentOrders, recentUsers;
  try {
    ({ stats, recentOrders, recentUsers } = await getAdminData());
  } catch (error) {
    console.error('Dashboard data fetch failed:', error);
    stats = { totalOrders: 0, pendingOrders: 0, monthlyRevenue: 0, totalClients: 0, totalCustomers: 0, totalProducts: 0, lowStockFormats: 0 };
    recentOrders = [];
    recentUsers = [];
  }

  return (
    <DashboardClient
      stats={stats}
      recentOrders={JSON.parse(JSON.stringify(recentOrders))}
      recentUsers={JSON.parse(JSON.stringify(recentUsers))}
    />
  );
}

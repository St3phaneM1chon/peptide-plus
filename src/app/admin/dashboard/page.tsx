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
    monthlyOrders,
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

    // Monthly orders with revenue
    prisma.order.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        paymentStatus: 'PAID',
      },
      select: { total: true },
    }),

    // Total companies (clients B2B)
    prisma.company.count(),

    // Total customers
    prisma.user.count({ where: { role: 'CUSTOMER' } }),

    // Active products
    prisma.product.count({ where: { isActive: true } }),

    // Low stock formats (stock below threshold)
    prisma.productFormat.count({
      where: {
        trackInventory: true,
        isActive: true,
        stockQuantity: { lte: 10 },
      },
    }),

    // Recent orders (last 10)
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    }),

    // Recent users
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: { role: { in: ['CUSTOMER', 'CLIENT'] } },
    }),
  ]);

  // Calculate monthly revenue from Decimal values
  const monthlyRevenue = monthlyOrders.reduce(
    (sum, o) => sum + Number(o.total),
    0
  );

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

  const { stats, recentOrders, recentUsers } = await getAdminData();

  return (
    <DashboardClient
      stats={stats}
      recentOrders={JSON.parse(JSON.stringify(recentOrders))}
      recentUsers={JSON.parse(JSON.stringify(recentUsers))}
    />
  );
}

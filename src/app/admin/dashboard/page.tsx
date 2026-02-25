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

// G1-FLAW-04: Simple in-memory cache (5 min TTL)
let _dashCache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getAdminData() {
  const now = Date.now();
  if (_dashCache && (now - _dashCache.ts) < CACHE_TTL) return _dashCache.data as Awaited<ReturnType<typeof fetchAdminData>>;
  const data = await fetchAdminData();
  _dashCache = { data, ts: now };
  return data;
}

async function fetchAdminData() {
  const now = new Date();
  // G5-FLAW-08: Use UTC to avoid server timezone drift
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // F1.11: Wrap all queries in $transaction to share a single DB connection
  // instead of opening 9 parallel connections via Promise.all
  const [
    totalOrders,
    pendingOrders,
    monthlyRevenueAgg,
    totalClients,
    totalCustomers,
    totalProducts,
    lowStockRaw,
    recentOrders,
    recentUsers,
  ] = await prisma.$transaction([
    // Total orders
    prisma.order.count(),

    // Pending orders (not yet shipped/delivered)
    prisma.order.count({
      where: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
    }),

    // F1.6+F1.12: Monthly revenue via aggregate (excludes cancelled orders, only paid)
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: { notIn: ['CANCELLED'] },
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
      },
      _sum: { total: true },
    }),

    // F1.8: Total active companies only (clients B2B)
    prisma.company.count({ where: { isActive: true } }),

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
    `,

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

  // G1-FLAW-09: Preserve Decimal precision
  const monthlyRevenue = parseFloat(parseFloat(String(monthlyRevenueAgg._sum.total ?? 0)).toFixed(2));

  // Convert raw SQL bigint result to number
  const lowStockFormats = Number((lowStockRaw as [{ count: bigint }])[0]?.count ?? 0);

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

  let stats: Awaited<ReturnType<typeof fetchAdminData>>['stats'];
  let recentOrders: Awaited<ReturnType<typeof fetchAdminData>>['recentOrders'];
  let recentUsers: Awaited<ReturnType<typeof fetchAdminData>>['recentUsers'];
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

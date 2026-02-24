export const dynamic = 'force-dynamic';
/**
 * DASHBOARD OWNER (PROPRIETAIRE) - Server Component
 * Data fetching with PostgreSQL-compatible raw SQL.
 * Rendering delegated to OwnerDashboardClient for i18n support.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { UserRole } from '@/types';
import OwnerDashboardClient from './OwnerDashboardClient';

async function getOwnerData() {
  const now = new Date();
  // G5-FLAW-08: Use UTC to avoid server timezone drift
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));

  const [
    totalRevenue,
    monthlyRevenue,
    lastMonthRevenue,
    totalClients,
    totalCustomers,
    totalProducts,
    recentPurchases,
    topProducts,
    revenueByMonth,
  ] = await Promise.all([
    // Total revenue
    prisma.purchase.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    // Revenue this month
    prisma.purchase.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    // Revenue last month
    prisma.purchase.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
      _sum: { amount: true },
    }),
    prisma.company.count(),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.product.count({ where: { isActive: true } }),
    // Recent purchases
    prisma.purchase.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        product: true,
      },
    }),
    // Top products
    prisma.product.findMany({
      take: 5,
      orderBy: { purchaseCount: 'desc' },
      where: { isActive: true },
    }),
    // Revenue by month (last 6 months) - PostgreSQL syntax
    prisma.$queryRaw<{ month: string; total: number }[]>(
      Prisma.sql`
        SELECT
          TO_CHAR("createdAt", 'YYYY-MM') AS month,
          SUM(CAST(amount AS DOUBLE PRECISION)) AS total
        FROM "Purchase"
        WHERE status = 'COMPLETED'
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
        ORDER BY month DESC
      `
    ),
  ]);

  const monthlyGrowth = lastMonthRevenue._sum.amount
    ? ((Number(monthlyRevenue._sum.amount || 0) - Number(lastMonthRevenue._sum.amount)) /
        Number(lastMonthRevenue._sum.amount)) *
      100
    : 0;

  return {
    stats: {
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
      monthlyGrowth,
      totalClients,
      totalCustomers,
      totalProducts,
    },
    recentPurchases,
    topProducts,
    revenueByMonth,
  };
}

export default async function OwnerDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role !== UserRole.OWNER) {
    redirect('/dashboard');
  }

  let stats, recentPurchases, topProducts, revenueByMonth;
  try {
    ({ stats, recentPurchases, topProducts, revenueByMonth } = await getOwnerData());
  } catch (error) {
    console.error('Owner dashboard data fetch failed:', error);
    stats = {
      totalRevenue: 0,
      monthlyRevenue: 0,
      monthlyGrowth: 0,
      totalClients: 0,
      totalCustomers: 0,
      totalProducts: 0,
    };
    recentPurchases = [];
    topProducts = [];
    revenueByMonth = [];
  }

  return (
    <OwnerDashboardClient
      stats={stats}
      recentPurchases={JSON.parse(JSON.stringify(recentPurchases))}
      topProducts={JSON.parse(JSON.stringify(topProducts))}
      revenueByMonth={JSON.parse(JSON.stringify(revenueByMonth))}
    />
  );
}

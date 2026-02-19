export const dynamic = 'force-dynamic';
/**
 * DASHBOARD OWNER (PROPRIÉTAIRE)
 * Tout Employee + Facturation + Analytics avancés
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

async function getOwnerData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

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
    // Revenu total
    prisma.purchase.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    // Revenu ce mois
    prisma.purchase.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    // Revenu mois dernier
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
    // Achats récents
    prisma.purchase.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        product: true,
      },
    }),
    // Top produits
    prisma.product.findMany({
      take: 5,
      orderBy: { purchaseCount: 'desc' },
      where: { isActive: true },
    }),
    // Revenus par mois (6 derniers mois)
    prisma.$queryRaw`
      SELECT 
        FORMAT(createdAt, 'yyyy-MM') as month,
        SUM(CAST(amount AS FLOAT)) as total
      FROM Purchase
      WHERE status = 'COMPLETED'
        AND createdAt >= DATEADD(month, -6, GETDATE())
      GROUP BY FORMAT(createdAt, 'yyyy-MM')
      ORDER BY month DESC
    ` as Promise<{ month: string; total: number }[]>,
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

  const { stats, recentPurchases, topProducts, revenueByMonth } = await getOwnerData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Propriétaire</h1>
              <p className="text-gray-600">Vue d'ensemble complète</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/owner/facturation" className="btn-secondary">
                Facturation
              </Link>
              <Link href="/owner/analytics" className="btn-primary">
                Analytics
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats financiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <p className="text-blue-100 text-sm mb-1">Revenu Total</p>
            <p className="text-3xl font-bold">{stats.totalRevenue.toFixed(2)} $</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <p className="text-gray-500 text-sm">Ce mois</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                stats.monthlyGrowth >= 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth.toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.monthlyRevenue.toFixed(2)} $</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">Clients actifs</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
            <p className="text-sm text-gray-500">{stats.totalCustomers} étudiants</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">Formations</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            <p className="text-sm text-gray-500">actives</p>
          </div>
        </div>

        {/* Navigation admin */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <QuickAction href="/admin/clients" title="Clients" icon="building" />
          <QuickAction href="/admin/customers" title="Étudiants" icon="users" />
          <QuickAction href="/admin/produits" title="Formations" icon="book" />
          <QuickAction href="/owner/facturation" title="Factures" icon="receipt" />
          <QuickAction href="/owner/employees" title="Employés" icon="team" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Graphique revenus */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenus mensuels</h2>
            <div className="h-64 flex items-end space-x-2">
              {revenueByMonth.map((item) => {
                const maxRevenue = Math.max(...revenueByMonth.map((r) => r.total));
                const height = maxRevenue > 0 ? (item.total / maxRevenue) * 100 : 0;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-600 rounded-t-md transition-all hover:bg-blue-700"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    <p className="text-xs text-gray-500 mt-2">{item.month.slice(5)}</p>
                    <p className="text-xs font-medium">{item.total.toFixed(0)}$</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top produits */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Top Formations</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {topProducts.map((product, index) => (
                <div key={product.id} className="p-4 flex items-center">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="ms-3 flex-1">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">{product.purchaseCount} ventes</p>
                  </div>
                  <p className="font-semibold text-gray-900">{Number(product.price).toFixed(2)} $</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Achats récents */}
        <section className="mt-8 bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Transactions récentes</h2>
            <Link href="/owner/facturation" className="text-blue-600 hover:underline text-sm">
              Voir tout
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Formation</th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(purchase.createdAt).toLocaleDateString('fr-CA')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {purchase.user.name?.charAt(0) || purchase.user.email.charAt(0)}
                          </span>
                        </div>
                        <div className="ms-3">
                          <p className="text-sm font-medium text-gray-900">
                            {purchase.user.name || purchase.user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {purchase.product.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        purchase.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : purchase.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {purchase.status === 'COMPLETED' ? 'Payé' :
                         purchase.status === 'PENDING' ? 'En attente' : 'Échoué'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-end">
                      {Number(purchase.amount).toFixed(2)} $
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function QuickAction({ href, title, icon }: { href: string; title: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
    >
      <div className="w-10 h-10 mx-auto mb-2 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon === 'building' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />}
          {icon === 'users' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />}
          {icon === 'book' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />}
          {icon === 'receipt' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />}
          {icon === 'team' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />}
        </svg>
      </div>
      <span className="text-sm font-medium text-gray-900">{title}</span>
    </Link>
  );
}

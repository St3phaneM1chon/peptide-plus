'use client';

/**
 * OWNER DASHBOARD - Client Component
 * Renders the owner dashboard UI with i18n support.
 * Data is fetched by the server component (page.tsx) and passed as props.
 */

import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import {
  DollarSign,
  TrendingUp,
  Users,
  Package,
  Building2,
  GraduationCap,
  Receipt,
  UsersRound,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';

// --------------------------------------------------
// Types
// --------------------------------------------------

interface OwnerStats {
  totalRevenue: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  totalClients: number;
  totalCustomers: number;
  totalProducts: number;
}

interface RevenueMonth {
  month: string;
  total: number;
}

interface TopProduct {
  id: string;
  name: string;
  purchaseCount: number;
  price: number | string;
}

interface RecentPurchase {
  id: string;
  createdAt: string;
  status: string;
  amount: number | string;
  user: { name: string | null; email: string };
  product: { name: string };
}

interface OwnerDashboardClientProps {
  stats: OwnerStats;
  recentPurchases: RecentPurchase[];
  topProducts: TopProduct[];
  revenueByMonth: RevenueMonth[];
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function formatCurrency(amount: number, locale: string, currency: string = 'CAD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

// --------------------------------------------------
// Main Component
// --------------------------------------------------

export default function OwnerDashboardClient({
  stats,
  recentPurchases,
  topProducts,
  revenueByMonth,
}: OwnerDashboardClientProps) {
  const { t, locale } = useI18n();

  function getStatusLabel(status: string): { label: string; classes: string } {
    switch (status) {
      case 'COMPLETED':
        return { label: t('orderStatus.completed'), classes: 'bg-green-100 text-green-700' };
      case 'PENDING':
        return { label: t('orderStatus.pending'), classes: 'bg-yellow-100 text-yellow-700' };
      default:
        return { label: t('orderStatus.failed'), classes: 'bg-red-100 text-red-700' };
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('ownerDashboard.title')}</h1>
              <p className="text-gray-600">{t('ownerDashboard.subtitle')}</p>
            </div>
            <div className="flex space-x-3">
              <Link href="/admin/comptabilite/factures-clients" className="btn-secondary">
                {t('ownerDashboard.billing')}
              </Link>
              <Link href="/admin/rapports" className="btn-primary">
                {t('ownerDashboard.analytics')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <p className="text-blue-100 text-sm mb-1">{t('ownerDashboard.totalRevenue')}</p>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue, locale)}</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <p className="text-gray-500 text-sm">{t('ownerDashboard.thisMonth')}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                stats.monthlyGrowth >= 0
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth.toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.monthlyRevenue, locale)}</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">{t('ownerDashboard.activeClients')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalClients.toLocaleString(locale)}</p>
            <p className="text-sm text-gray-500">{t('ownerDashboard.students', { count: stats.totalCustomers })}</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <p className="text-gray-500 text-sm mb-1">{t('ownerDashboard.products')}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString(locale)}</p>
            <p className="text-sm text-gray-500">{t('ownerDashboard.active')}</p>
          </div>
        </div>

        {/* Admin Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <QuickAction href="/admin/clients" title={t('ownerDashboard.navClients')} icon={<Building2 className="w-5 h-5" />} />
          <QuickAction href="/admin/customers" title={t('ownerDashboard.navCustomers')} icon={<Users className="w-5 h-5" />} />
          <QuickAction href="/admin/produits" title={t('ownerDashboard.navProducts')} icon={<GraduationCap className="w-5 h-5" />} />
          <QuickAction href="/admin/comptabilite/factures-clients" title={t('ownerDashboard.navInvoices')} icon={<Receipt className="w-5 h-5" />} />
          <QuickAction href="/admin/employes" title={t('ownerDashboard.employees')} icon={<UsersRound className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue Chart */}
          <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('ownerDashboard.monthlyRevenue')}</h2>
            <div className="h-64 flex items-end space-x-2">
              {revenueByMonth.map((item) => {
                const maxRevenue = Math.max(...revenueByMonth.map((r) => r.total), 1);
                const height = maxRevenue > 0 ? (item.total / maxRevenue) * 100 : 0;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-blue-600 rounded-t-md transition-all hover:bg-blue-700"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    <p className="text-xs text-gray-500 mt-2">{item.month.slice(5)}</p>
                    <p className="text-xs font-medium">{formatCurrency(item.total, locale)}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top Products */}
          <section className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('ownerDashboard.topProducts')}</h2>
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
                    <p className="text-sm text-gray-500">
                      {t('ownerDashboard.salesCount', { count: product.purchaseCount })}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(Number(product.price), locale)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Recent Purchases */}
        <section className="mt-8 bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{t('ownerDashboard.recentTransactions')}</h2>
            <Link href="/admin/comptabilite/factures-clients" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
              {t('ownerDashboard.viewAll')}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('ownerDashboard.colDate')}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('ownerDashboard.colClient')}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('ownerDashboard.colProduct')}</th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('ownerDashboard.colStatus')}</th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('ownerDashboard.colAmount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentPurchases.map((purchase) => {
                  const statusInfo = getStatusLabel(purchase.status);
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(purchase.createdAt).toLocaleDateString(locale)}
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
                        <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.classes}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-end">
                        {formatCurrency(Number(purchase.amount), locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

// --------------------------------------------------
// QuickAction Component
// --------------------------------------------------

function QuickAction({ href, title, icon }: { href: string; title: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center group"
    >
      <div className="w-10 h-10 mx-auto mb-2 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
        {icon}
      </div>
      <span className="text-sm font-medium text-gray-900">{title}</span>
    </Link>
  );
}

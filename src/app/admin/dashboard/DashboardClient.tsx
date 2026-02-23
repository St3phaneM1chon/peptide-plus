'use client';

/**
 * DASHBOARD ADMIN - Client Component
 * Renders the dashboard UI with i18n support
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import {
  ShoppingCart,
  DollarSign,
  Users,
  Package,
  Clock,
  AlertTriangle,
  Building2,
  TrendingUp,
  ArrowUpRight,
  Eye,
  UserPlus,
  BarChart3,
  Tag,
} from 'lucide-react';

// --------------------------------------------------
// Types
// --------------------------------------------------

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  monthlyRevenue: number;
  totalClients: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockFormats: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  shippingName: string | null;
  _count: { items: number };
}

interface RecentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
}

interface DashboardClientProps {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  recentUsers: RecentUser[];
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

// --------------------------------------------------
// Main Component
// --------------------------------------------------

export default function DashboardClient({ stats, recentOrders, recentUsers }: DashboardClientProps) {
  const { t, locale } = useI18n();
  const router = useRouter();

  // ─── Ribbon Actions ────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleExportDashboard = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('refresh', handleRefresh);
  useRibbonAction('exportDashboard', handleExportDashboard);

  function getOrderStatusLabel(status: string): { label: string; classes: string } {
    switch (status) {
      case 'PENDING':
        return { label: t('admin.dashboard.orderStatus.pending'), classes: 'bg-yellow-100 text-yellow-700' };
      case 'CONFIRMED':
        return { label: t('admin.dashboard.orderStatus.confirmed'), classes: 'bg-sky-100 text-sky-700' };
      case 'PROCESSING':
        return { label: t('admin.dashboard.orderStatus.processing'), classes: 'bg-sky-100 text-sky-700' };
      case 'SHIPPED':
        return { label: t('admin.dashboard.orderStatus.shipped'), classes: 'bg-indigo-100 text-indigo-700' };
      case 'DELIVERED':
        return { label: t('admin.dashboard.orderStatus.delivered'), classes: 'bg-green-100 text-green-700' };
      case 'CANCELLED':
        return { label: t('admin.dashboard.orderStatus.cancelled'), classes: 'bg-red-100 text-red-700' };
      default:
        return { label: status, classes: 'bg-slate-100 text-slate-700' };
    }
  }

  function getPaymentStatusLabel(status: string): { label: string; classes: string } {
    switch (status) {
      case 'PAID':
        return { label: t('admin.dashboard.paymentStatus.paid'), classes: 'bg-green-100 text-green-700' };
      case 'PENDING':
        return { label: t('admin.dashboard.paymentStatus.pending'), classes: 'bg-yellow-100 text-yellow-700' };
      case 'FAILED':
        return { label: t('admin.dashboard.paymentStatus.failed'), classes: 'bg-red-100 text-red-700' };
      case 'REFUNDED':
        return { label: t('admin.dashboard.paymentStatus.refunded'), classes: 'bg-slate-100 text-slate-700' };
      default:
        return { label: status, classes: 'bg-slate-100 text-slate-700' };
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.dashboard.title')}</h1>
          <p className="text-slate-500 mt-1">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/commandes"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            {t('admin.dashboard.orders')}
          </Link>
          <Link
            href="/admin/produits/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
          >
            <Package className="w-4 h-4" />
            {t('admin.dashboard.newProduct')}
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.dashboard.totalOrders')}
          value={stats.totalOrders.toLocaleString(locale)}
          icon={<ShoppingCart className="w-5 h-5" />}
          iconBg="bg-sky-100 text-sky-600"
          href="/admin/commandes"
        />
        <StatCard
          label={t('admin.dashboard.monthlyRevenue')}
          value={formatCurrency(stats.monthlyRevenue, locale)}
          icon={<DollarSign className="w-5 h-5" />}
          iconBg="bg-green-100 text-green-600"
          href="/admin/comptabilite"
        />
        <StatCard
          label={t('admin.dashboard.pendingOrders')}
          value={stats.pendingOrders.toLocaleString(locale)}
          icon={<Clock className="w-5 h-5" />}
          iconBg="bg-yellow-100 text-yellow-600"
          href="/admin/commandes"
          alert={stats.pendingOrders > 0}
        />
        <StatCard
          label={t('admin.dashboard.stockAlerts')}
          value={stats.lowStockFormats.toLocaleString(locale)}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBg="bg-red-100 text-red-600"
          href="/admin/inventaire"
          alert={stats.lowStockFormats > 0}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('admin.dashboard.b2bClients')}
          value={stats.totalClients.toLocaleString(locale)}
          icon={<Building2 className="w-5 h-5" />}
          iconBg="bg-indigo-100 text-indigo-600"
          href="/admin/clients"
        />
        <StatCard
          label={t('admin.dashboard.customers')}
          value={stats.totalCustomers.toLocaleString(locale)}
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-violet-100 text-violet-600"
          href="/admin/clients"
        />
        <StatCard
          label={t('admin.dashboard.activeProducts')}
          value={stats.totalProducts.toLocaleString(locale)}
          icon={<Package className="w-5 h-5" />}
          iconBg="bg-teal-100 text-teal-600"
          href="/admin/produits"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction
          href="/admin/commandes"
          icon={<ShoppingCart className="w-5 h-5" />}
          title={t('admin.dashboard.ordersAction')}
        />
        <QuickAction
          href="/admin/produits"
          icon={<Package className="w-5 h-5" />}
          title={t('admin.dashboard.productsAction')}
        />
        <QuickAction
          href="/admin/inventaire"
          icon={<BarChart3 className="w-5 h-5" />}
          title={t('admin.dashboard.inventoryAction')}
        />
        <QuickAction
          href="/admin/promo-codes"
          icon={<Tag className="w-5 h-5" />}
          title={t('admin.dashboard.promoCodes')}
        />
      </div>

      {/* Recent Data Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <section className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">{t('admin.dashboard.recentOrders')}</h2>
            </div>
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
            >
              {t('admin.dashboard.viewAll')}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentOrders.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t('admin.dashboard.noOrdersYet')}
              </div>
            )}
            {recentOrders.map((order) => {
              const orderStatus = getOrderStatusLabel(order.status);
              const paymentStatus = getPaymentStatusLabel(order.paymentStatus);
              const itemCount = order._count.items;
              return (
                <div key={order.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 text-sm">
                        {order.orderNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${orderStatus.classes}`}>
                        {orderStatus.label}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm">
                      {formatCurrency(Number(order.total), locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>
                        {itemCount > 1
                          ? t('admin.dashboard.itemCountPlural', { count: itemCount })
                          : t('admin.dashboard.itemCount', { count: itemCount })
                        }
                      </span>
                      <span>{new Date(order.createdAt).toLocaleDateString(locale)}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${paymentStatus.classes}`}>
                      {paymentStatus.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Users */}
        <section className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900">{t('admin.dashboard.recentSignups')}</h2>
            </div>
            <Link
              href="/admin/clients"
              className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
            >
              {t('admin.dashboard.viewAll')}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentUsers.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                {t('admin.dashboard.noSignupsYet')}
              </div>
            )}
            {recentUsers.map((user) => (
              <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.image ? (
                      <Image src={user.image} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover" unoptimized />
                    ) : (
                      <span className="text-slate-600 font-semibold text-sm">
                        {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    user.role === 'CLIENT'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {user.role === 'CLIENT' ? t('admin.dashboard.clientB2B') : t('admin.dashboard.client')}
                  </span>
                  <Link
                    href={`/admin/clients`}
                    className="p-1 text-slate-400 hover:text-sky-600 transition-colors"
                    title={t('admin.dashboard.viewProfile')}
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// --------------------------------------------------
// StatCard Component
// --------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  iconBg,
  href,
  alert = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative bg-white rounded-xl p-5 border border-slate-200 hover:border-sky-200 hover:shadow-sm transition-all"
    >
      {alert && (
        <span className="absolute top-3 end-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      )}
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500 truncate">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
        </div>
      </div>
      <TrendingUp className="absolute bottom-3 end-3 w-4 h-4 text-slate-200 group-hover:text-sky-300 transition-colors" />
    </Link>
  );
}

// --------------------------------------------------
// QuickAction Component
// --------------------------------------------------

function QuickAction({
  href,
  icon,
  title,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl p-4 border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all flex items-center gap-3 group"
    >
      <div className="w-9 h-9 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600 group-hover:bg-sky-100 transition-colors flex-shrink-0">
        {icon}
      </div>
      <span className="font-medium text-slate-900 text-sm">{title}</span>
    </Link>
  );
}

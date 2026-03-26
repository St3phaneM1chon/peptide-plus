'use client';

/**
 * DASHBOARD ADMIN - Client Component
 * Renders the dashboard UI with i18n support
 */

import { useCallback, useState, useEffect } from 'react';
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
  Briefcase,
  BookOpen,
  Star,
  Megaphone,
  PhoneCall,
} from 'lucide-react';
import AIInsightsWidget from '@/components/admin/AIInsightsWidget';
import MorningBriefingWidget from '@/components/admin/MorningBriefingWidget';

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
  currency?: { code: string; symbol: string } | null;
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

interface LmsStats {
  courses: number;
  activeEnrollments: number;
  completions: number;
  overdueCompliance: number;
}

interface DashboardClientProps {
  stats: DashboardStats;
  lmsStats?: LmsStats;
  recentOrders: RecentOrder[];
  recentUsers: RecentUser[];
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function formatCurrency(amount: number, locale: string, currencyCode: string = 'CAD'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

// --------------------------------------------------
// Main Component
// --------------------------------------------------

interface CrossModuleData {
  modules: {
    commerce?: { ordersToday: number; revenueToday: number; pendingOrders: number };
    crm?: { openDeals: number; wonToday: number; pipelineValue: number };
    accounting?: { draftEntries: number; entriesThisMonth: number };
    loyalty?: { newMembersToday: number; pointsDistributedToday: number };
    marketing?: { activePromoCodes: number };
    telephony?: { callsToday: number; avgDurationSeconds: number };
  };
  flags: Record<string, boolean>;
}

export default function DashboardClient({ stats, lmsStats, recentOrders, recentUsers }: DashboardClientProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [crossModule, setCrossModule] = useState<CrossModuleData | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard/cross-module')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json?.data) setCrossModule(json.data); })
      .catch(() => { /* silent */ });
  }, []);

  // ─── Ribbon Actions ────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleExportDashboard = useCallback(() => {
    const headers = [
      t('admin.dashboard.metric'),
      t('admin.dashboard.value'),
    ];
    const rows = [
      [t('admin.dashboard.totalOrders'), String(stats.totalOrders)],
      [t('admin.dashboard.pendingOrders'), String(stats.pendingOrders)],
      [t('admin.dashboard.monthlyRevenue'), formatCurrency(stats.monthlyRevenue, locale)],
      [t('admin.dashboard.b2bClients'), String(stats.totalClients)],
      [t('admin.dashboard.customers'), String(stats.totalCustomers)],
      [t('admin.dashboard.activeProducts'), String(stats.totalProducts)],
      [t('admin.dashboard.stockAlerts'), String(stats.lowStockFormats)],
    ];
    // Add recent orders
    if (recentOrders.length > 0) {
      rows.push(['', '']);
      rows.push([t('admin.dashboard.recentOrders'), '']);
      rows.push([t('admin.dashboard.orderNumber'), `${t('admin.dashboard.amount')}`]);
      recentOrders.forEach(order => {
        rows.push([order.orderNumber, formatCurrency(Number(order.total), locale, order.currency?.code || 'CAD')]);
      });
    }
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `dashboard-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported'));
  }, [stats, recentOrders, locale, t]);

  useRibbonAction('refresh', handleRefresh);
  useRibbonAction('exportDashboard', handleExportDashboard);

  // F1.17: Order status labels with translated text + hardcoded fallbacks
  // so raw enum values (PENDING, CONFIRMED, etc.) never appear in the UI
  const ORDER_STATUS_CONFIG: Record<string, { i18nKey: string; fallback: string; classes: string }> = {
    PENDING:    { i18nKey: 'admin.dashboard.orderStatus.pending',    fallback: 'Pending',    classes: 'bg-yellow-500/15 text-yellow-400' },
    CONFIRMED:  { i18nKey: 'admin.dashboard.orderStatus.confirmed',  fallback: 'Confirmed',  classes: 'bg-indigo-500/15 text-indigo-400' },
    PROCESSING: { i18nKey: 'admin.dashboard.orderStatus.processing', fallback: 'Processing', classes: 'bg-indigo-500/15 text-indigo-400' },
    SHIPPED:    { i18nKey: 'admin.dashboard.orderStatus.shipped',    fallback: 'Shipped',    classes: 'bg-indigo-500/15 text-indigo-400' },
    DELIVERED:  { i18nKey: 'admin.dashboard.orderStatus.delivered',  fallback: 'Delivered',  classes: 'bg-emerald-500/15 text-emerald-400' },
    CANCELLED:  { i18nKey: 'admin.dashboard.orderStatus.cancelled',  fallback: 'Cancelled',  classes: 'bg-red-500/15 text-red-400' },
    RETURNED:   { i18nKey: 'admin.dashboard.orderStatus.returned',   fallback: 'Returned',   classes: 'bg-orange-500/15 text-orange-400' },
  };

  const PAYMENT_STATUS_CONFIG: Record<string, { i18nKey: string; fallback: string; classes: string }> = {
    PAID:                { i18nKey: 'admin.dashboard.paymentStatus.paid',                fallback: 'Paid',                classes: 'bg-emerald-500/15 text-emerald-400' },
    PENDING:             { i18nKey: 'admin.dashboard.paymentStatus.pending',             fallback: 'Pending',             classes: 'bg-yellow-500/15 text-yellow-400' },
    FAILED:              { i18nKey: 'admin.dashboard.paymentStatus.failed',              fallback: 'Failed',              classes: 'bg-red-500/15 text-red-400' },
    REFUNDED:            { i18nKey: 'admin.dashboard.paymentStatus.refunded',            fallback: 'Refunded',            classes: 'bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)]' },
    PARTIALLY_REFUNDED:  { i18nKey: 'admin.dashboard.paymentStatus.partiallyRefunded',  fallback: 'Partially Refunded',  classes: 'bg-orange-500/15 text-orange-400' },
  };

  function getOrderStatusLabel(status: string): { label: string; classes: string } {
    const cfg = ORDER_STATUS_CONFIG[status];
    if (cfg) {
      const translated = t(cfg.i18nKey);
      // If t() returns the raw key path, use the hardcoded fallback instead
      const label = translated && !translated.includes('.') ? translated : cfg.fallback;
      return { label, classes: cfg.classes };
    }
    // Unknown status: capitalize it nicely instead of showing raw enum
    return { label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), classes: 'bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)]' };
  }

  function getPaymentStatusLabel(status: string): { label: string; classes: string } {
    const cfg = PAYMENT_STATUS_CONFIG[status];
    if (cfg) {
      const translated = t(cfg.i18nKey);
      const label = translated && !translated.includes('.') ? translated : cfg.fallback;
      return { label, classes: cfg.classes };
    }
    return { label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), classes: 'bg-[var(--k-glass-thin)] text-[var(--k-text-secondary)]' };
  }

  return (
    <div className="space-y-6" role="main" aria-label={t('admin.dashboard.title')}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--k-text-primary)]">{t('admin.dashboard.title')}</h1>
          <p className="text-[var(--k-text-secondary)] mt-1">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/commandes"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--k-text-secondary)] bg-[var(--k-glass-thin)] border border-[var(--k-border-default)] rounded-lg hover:bg-[var(--k-glass-regular)] backdrop-blur-sm transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            {t('admin.dashboard.orders')}
          </Link>
          <Link
            href="/admin/produits/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#6366f1] to-[#818cf8] rounded-lg hover:opacity-90 transition-colors"
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
          iconBg="bg-indigo-500/10 text-indigo-400"
          href="/admin/commandes"
        />
        <StatCard
          label={`${t('admin.dashboard.monthlyRevenue')} (CAD)`}
          value={formatCurrency(stats.monthlyRevenue, locale, 'CAD')}
          icon={<DollarSign className="w-5 h-5" />}
          iconBg="bg-green-500/10 text-green-400"
          href="/admin/comptabilite"
        />
        <StatCard
          label={t('admin.dashboard.pendingOrders')}
          value={stats.pendingOrders.toLocaleString(locale)}
          icon={<Clock className="w-5 h-5" />}
          iconBg="bg-yellow-500/10 text-yellow-400"
          href="/admin/commandes"
          alert={stats.pendingOrders > 0}
        />
        <StatCard
          label={t('admin.dashboard.stockAlerts')}
          value={stats.lowStockFormats.toLocaleString(locale)}
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBg="bg-red-500/10 text-red-400"
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
          iconBg="bg-indigo-500/10 text-indigo-400"
          href="/admin/clients"
        />
        <StatCard
          label={t('admin.dashboard.customers')}
          value={stats.totalCustomers.toLocaleString(locale)}
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-violet-500/10 text-violet-400"
          href="/admin/clients"
        />
        <StatCard
          label={t('admin.dashboard.activeProducts')}
          value={stats.totalProducts.toLocaleString(locale)}
          icon={<Package className="w-5 h-5" />}
          iconBg="bg-indigo-500/10 text-indigo-400"
          href="/admin/produits"
        />
      </div>

      {/* AI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MorningBriefingWidget />
        <AIInsightsWidget />
      </div>

      {/* LMS Formation Widget */}
      {lmsStats && (lmsStats.courses > 0 || lmsStats.activeEnrollments > 0) && (
        <div className="rounded-xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-[var(--k-border-subtle)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2 text-[var(--k-text-primary)]">
              <BookOpen className="w-5 h-5 text-blue-400" />
              Formation continue
            </h3>
            <Link href="/admin/formation" className="text-xs text-[#818cf8] hover:underline flex items-center gap-1">
              Voir tout <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-[var(--k-text-primary)]">{lmsStats.courses}</p>
              <p className="text-xs text-[var(--k-text-tertiary)]">Cours</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--k-text-primary)]">{lmsStats.activeEnrollments}</p>
              <p className="text-xs text-[var(--k-text-tertiary)]">Inscrits</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{lmsStats.completions}</p>
              <p className="text-xs text-[var(--k-text-tertiary)]">Termines</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${lmsStats.overdueCompliance > 0 ? 'text-red-400' : 'text-[var(--k-text-primary)]'}`}>{lmsStats.overdueCompliance}</p>
              <p className="text-xs text-[var(--k-text-tertiary)]">En retard</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
        <section className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl border border-[var(--k-border-subtle)]">
          <div className="p-5 border-b border-[var(--k-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[var(--k-text-tertiary)]" />
              <h2 className="text-base font-semibold text-[var(--k-text-primary)]">{t('admin.dashboard.recentOrders')}</h2>
            </div>
            <Link
              href="/admin/commandes"
              className="inline-flex items-center gap-1 text-sm text-[#818cf8] hover:text-[#a5b4fc] font-medium"
            >
              {t('admin.dashboard.viewAll')}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--k-border-subtle)]">
            {recentOrders.length === 0 && (
              <div className="p-8 text-center text-[var(--k-text-muted)] text-sm">
                {t('admin.dashboard.noOrdersYet')}
              </div>
            )}
            {recentOrders.map((order) => {
              const orderStatus = getOrderStatusLabel(order.status);
              const paymentStatus = getPaymentStatusLabel(order.paymentStatus);
              const itemCount = order._count.items;
              return (
                <div key={order.id} className="p-4 hover:bg-[var(--k-glass-thin)] transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-medium text-[var(--k-text-primary)] text-sm truncate">
                        {order.orderNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${orderStatus.classes}`}>
                        {orderStatus.label}
                      </span>
                    </div>
                    <span className="font-semibold text-[var(--k-text-primary)] text-sm">
                      {formatCurrency(Number(order.total), locale, order.currency?.code || 'CAD')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-[var(--k-text-tertiary)]">
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
        <section className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl border border-[var(--k-border-subtle)]">
          <div className="p-5 border-b border-[var(--k-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[var(--k-text-tertiary)]" />
              <h2 className="text-base font-semibold text-[var(--k-text-primary)]">{t('admin.dashboard.recentSignups')}</h2>
            </div>
            <Link
              href="/admin/clients"
              className="inline-flex items-center gap-1 text-sm text-[#818cf8] hover:text-[#a5b4fc] font-medium"
            >
              {t('admin.dashboard.viewAll')}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-[var(--k-border-subtle)]">
            {recentUsers.length === 0 && (
              <div className="p-8 text-center text-[var(--k-text-muted)] text-sm">
                {t('admin.dashboard.noSignupsYet')}
              </div>
            )}
            {recentUsers.map((user) => (
              <div key={user.id} className="p-4 flex items-center justify-between hover:bg-[var(--k-glass-thin)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[var(--k-glass-regular)] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {user.image ? (
                      <Image src={user.image} alt={user.name ? `${user.name} avatar` : 'User avatar'} width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <span className="text-[var(--k-text-secondary)] font-semibold text-sm">
                        {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--k-text-primary)] text-sm truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-[var(--k-text-muted)]">
                      {new Date(user.createdAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    user.role === 'CLIENT'
                      ? 'bg-[#6366f1]/15 text-[#818cf8]'
                      : 'bg-[var(--k-glass-thin)] text-[var(--k-text-tertiary)]'
                  }`}>
                    {user.role === 'CLIENT' ? t('admin.dashboard.clientB2B') : t('admin.dashboard.client')}
                  </span>
                  <Link
                    href={`/admin/clients`}
                    className="p-1 text-[var(--k-text-muted)] hover:text-[#818cf8] transition-colors"
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

      {/* ── Cross-Module Widgets (Bridge #18) ───────────────────── */}
      {crossModule && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--k-text-primary)] mb-3">
            {t('admin.dashboard.crossModuleTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {crossModule.modules.crm && (
              <Link href="/admin/crm/pipeline" className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-4 border border-[var(--k-border-subtle)] hover:border-[var(--k-border-default)] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="font-medium text-[var(--k-text-primary)]">CRM</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[var(--k-text-tertiary)] truncate">{t('admin.dashboard.openDeals')}</p>
                    <p className="font-bold text-[var(--k-text-primary)]">{crossModule.modules.crm.openDeals}</p>
                  </div>
                  <div>
                    <p className="text-[var(--k-text-tertiary)] truncate">{t('admin.dashboard.pipelineValue')}</p>
                    <p className="font-bold text-emerald-400 truncate">{formatCurrency(crossModule.modules.crm.pipelineValue, locale)}</p>
                  </div>
                </div>
              </Link>
            )}

            {crossModule.modules.accounting && (
              <Link href="/admin/comptabilite/ecritures" className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-4 border border-[var(--k-border-subtle)] hover:border-[var(--k-border-default)] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="font-medium text-[var(--k-text-primary)]">{t('admin.dashboard.accounting')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[var(--k-text-tertiary)] truncate">{t('admin.dashboard.draftEntries')}</p>
                    <p className="font-bold text-[var(--k-text-primary)]">{crossModule.modules.accounting.draftEntries}</p>
                  </div>
                  <div>
                    <p className="text-[var(--k-text-tertiary)] truncate">{t('admin.dashboard.entriesThisMonth')}</p>
                    <p className="font-bold text-[var(--k-text-primary)]">{crossModule.modules.accounting.entriesThisMonth}</p>
                  </div>
                </div>
              </Link>
            )}

            {crossModule.modules.loyalty && (
              <Link href="/admin/fidelite" className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-4 border border-[var(--k-border-subtle)] hover:border-[var(--k-border-default)] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="font-medium text-[var(--k-text-primary)]">{t('admin.dashboard.loyalty')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[var(--k-text-tertiary)]">{t('admin.dashboard.newMembers')}</p>
                    <p className="font-bold text-[var(--k-text-primary)]">{crossModule.modules.loyalty.newMembersToday}</p>
                  </div>
                  <div>
                    <p className="text-[var(--k-text-tertiary)]">{t('admin.dashboard.pointsDistributed')}</p>
                    <p className="font-bold text-purple-400">{crossModule.modules.loyalty.pointsDistributedToday.toLocaleString(locale)}</p>
                  </div>
                </div>
              </Link>
            )}

            {crossModule.modules.marketing && (
              <Link href="/admin/promo-codes" className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-4 border border-[var(--k-border-subtle)] hover:border-[var(--k-border-default)] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="font-medium text-[var(--k-text-primary)]">{t('admin.dashboard.marketing')}</span>
                </div>
                <div className="text-sm">
                  <p className="text-[var(--k-text-tertiary)]">{t('admin.dashboard.activePromos')}</p>
                  <p className="font-bold text-[var(--k-text-primary)]">{crossModule.modules.marketing.activePromoCodes}</p>
                </div>
              </Link>
            )}

            {crossModule.modules.telephony && (
              <Link href="/admin/telephonie/journal" className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-4 border border-[var(--k-border-subtle)] hover:border-[var(--k-border-default)] transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                    <PhoneCall className="w-5 h-5 text-indigo-400" />
                  </div>
                  <span className="font-medium text-[var(--k-text-primary)]">{t('admin.dashboard.telephony')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[var(--k-text-tertiary)] truncate">{t('admin.dashboard.callsToday')}</p>
                    <p className="font-bold text-[var(--k-text-primary)]">{crossModule.modules.telephony.callsToday}</p>
                  </div>
                  <div>
                    <p className="text-[var(--k-text-tertiary)] truncate">{t('admin.dashboard.avgDuration')}</p>
                    <p className="font-bold text-[var(--k-text-primary)]">
                      {Math.floor(crossModule.modules.telephony.avgDurationSeconds / 60)}m {crossModule.modules.telephony.avgDurationSeconds % 60}s
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      )}
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
      className="group relative bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-5 border border-[var(--k-border-subtle)] hover:border-[var(--k-border-default)] hover:shadow-[var(--k-glow-primary)] transition-all"
    >
      {alert && (
        <span className="absolute top-3 end-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      )}
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-[var(--k-text-secondary)] truncate">{label}</p>
          <p className="text-xl font-bold text-[var(--k-text-primary)] mt-0.5">{value}</p>
        </div>
      </div>
      <TrendingUp className="absolute bottom-3 end-3 w-4 h-4 text-[var(--k-text-muted)] group-hover:text-[#818cf8] transition-colors" />
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
      className="bg-[var(--k-glass-thin)] backdrop-blur-sm rounded-xl p-4 border border-[var(--k-border-subtle)] hover:border-[#6366f1]/30 transition-all flex items-center gap-3 group"
    >
      <div className="w-9 h-9 bg-[#6366f1]/10 rounded-lg flex items-center justify-center text-[#818cf8] group-hover:bg-[#6366f1]/20 transition-colors flex-shrink-0">
        {icon}
      </div>
      <span className="font-medium text-[var(--k-text-primary)] text-sm">{title}</span>
    </Link>
  );
}

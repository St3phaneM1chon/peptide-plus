'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  Activity,
  BarChart3,
  Eye,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { RFM_SEGMENTS, type RFMSegment } from '@/lib/analytics/rfm-engine';

interface RevenueData {
  today: number;
  thisWeek: number;
  thisMonth: number;
  ordersToday: number;
}

interface AnalyticsData {
  revenue: RevenueData;
  customers: { total: number; newThisMonth: number };
  rfmDistribution: Record<string, number>;
  generatedAt: string;
}

// ── Main Component ────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t, locale } = useI18n();
  const [revenue, setRevenue] = useState<RevenueData>({ today: 0, thisWeek: 0, thisMonth: 0, ordersToday: 0 });
  const [rfmDist, setRfmDist] = useState<Record<RFMSegment, number>>({
    CHAMPIONS: 0, LOYAL: 0, POTENTIAL_LOYAL: 0, NEW_CUSTOMERS: 0, PROMISING: 0,
    NEED_ATTENTION: 0, ABOUT_TO_SLEEP: 0, AT_RISK: 0, CANT_LOSE: 0, HIBERNATING: 0, LOST: 0,
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount),
    [locale]
  );

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AnalyticsData = await res.json();
      setRevenue(data.revenue);
      setRfmDist(data.rfmDistribution as Record<RFMSegment, number>);
      setLastUpdate(new Date(data.generatedAt));
      setIsLive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      setIsLive(false);
    }
  }, []);

  // Fetch on mount + poll every 30 seconds
  useEffect(() => {
    fetchAnalytics();
    intervalRef.current = setInterval(fetchAnalytics, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAnalytics]);

  // Funnel data - these are estimates based on order data
  // Real funnel tracking requires analytics integration (GA4, Plausible, etc.)
  const funnel = {
    visitors: revenue.ordersToday > 0 ? Math.round(revenue.ordersToday / 0.02) : 0,
    productViews: revenue.ordersToday > 0 ? Math.round(revenue.ordersToday / 0.05) : 0,
    addToCart: revenue.ordersToday > 0 ? Math.round(revenue.ordersToday / 0.15) : 0,
    checkout: revenue.ordersToday > 0 ? Math.round(revenue.ordersToday / 0.5) : 0,
    purchase: revenue.ordersToday,
  };

  const funnelSteps = [
    { key: 'visitors', label: t('admin.analytics.funnelVisitors'), value: funnel.visitors, icon: Eye, color: 'bg-teal-500' },
    { key: 'productViews', label: t('admin.analytics.funnelProductViews'), value: funnel.productViews, icon: ShoppingBag, color: 'bg-indigo-500' },
    { key: 'addToCart', label: t('admin.analytics.funnelAddToCart'), value: funnel.addToCart, icon: ShoppingCart, color: 'bg-purple-500' },
    { key: 'checkout', label: t('admin.analytics.funnelCheckout'), value: funnel.checkout, icon: CreditCard, color: 'bg-amber-500' },
    { key: 'purchase', label: t('admin.analytics.funnelPurchase'), value: funnel.purchase, icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  const overallConversion = funnel.visitors > 0 ? ((funnel.purchase / funnel.visitors) * 100).toFixed(2) : '0';

  // Sort RFM segments by count descending for the chart
  const rfmEntries = (Object.entries(rfmDist) as [RFMSegment, number][]).sort((a, b) => b[1] - a[1]);
  const maxRfm = Math.max(...Object.values(rfmDist), 1);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-800">
          <span className="font-semibold">{t('common.error')}</span> &mdash; {error}
        </div>
      ) : !isLive ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
          <span className="font-semibold">{t('admin.analytics.loading') || 'Loading...'}</span>
        </div>
      ) : null}

      <PageHeader
        title={t('admin.analytics.title')}
        subtitle={t('admin.analytics.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLive ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
              <span className={`text-xs font-medium ${isLive ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isLive ? t('admin.analytics.liveIndicator') : t('admin.analytics.connecting') || 'Connecting...'}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              {t('admin.analytics.lastUpdated')}: {lastUpdate.toLocaleTimeString(locale)}
            </span>
          </div>
        }
      />

      {/* Real-time Revenue Tracker */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-slate-900">{t('admin.analytics.realtimeRevenue')}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={t('admin.analytics.revenueToday')}
            value={fmt(revenue.today)}
            icon={DollarSign}
            className="bg-emerald-50 border-emerald-200"
          />
          <StatCard
            label={t('admin.analytics.revenueThisWeek')}
            value={fmt(revenue.thisWeek)}
            icon={TrendingUp}
            className="bg-teal-50 border-teal-200"
          />
          <StatCard
            label={t('admin.analytics.revenueThisMonth')}
            value={fmt(revenue.thisMonth)}
            icon={BarChart3}
            className="bg-purple-50 border-purple-200"
          />
          <StatCard
            label={t('admin.analytics.ordersToday')}
            value={revenue.ordersToday}
            icon={ShoppingCart}
            className="bg-amber-50 border-amber-200"
          />
        </div>
      </div>

      {/* Active Users — Note: real active users requires analytics integration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-slate-900">{t('admin.analytics.activeUsers')}</h3>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
            {t('admin.analytics.requiresAnalytics') || 'Requires GA4/Plausible'}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {t('admin.analytics.connectAnalyticsProvider') || 'Connect Google Analytics or Plausible for real-time active user data.'}
        </p>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900">{t('admin.analytics.conversionFunnel')}</h3>
            {funnel.visitors === 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                {t('admin.analytics.estimatedData') || 'Estimated from orders'}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {t('admin.analytics.conversionRate')}: <span className="font-bold text-purple-700">{overallConversion}%</span>
          </div>
        </div>
        <div className="space-y-3">
          {funnelSteps.map((step, idx) => {
            const widthPercent = funnel.visitors > 0 ? (step.value / funnel.visitors) * 100 : 0;
            const dropRate = idx > 0 && funnelSteps[idx - 1].value > 0
              ? ((1 - step.value / funnelSteps[idx - 1].value) * 100).toFixed(1)
              : null;
            const StepIcon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${step.color} flex-shrink-0`}>
                  <StepIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{step.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{step.value.toLocaleString(locale)}</span>
                      {dropRate && (
                        <span className="text-[10px] text-red-500 font-medium">-{dropRate}%</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${step.color}`}
                      style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RFM Distribution */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-slate-900">{t('admin.analytics.rfmDistribution')}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6">{t('admin.analytics.rfmDistributionSubtitle')}</p>
        <div className="space-y-2.5">
          {rfmEntries.map(([segment, count]) => {
            const info = RFM_SEGMENTS[segment];
            if (!info) return null;
            const widthPercent = (count / maxRfm) * 100;
            return (
              <div key={segment} className="flex items-center gap-3">
                <div className="w-36 flex-shrink-0">
                  <span className="text-xs font-medium text-slate-700">{info.nameFr}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-6 bg-slate-50 rounded overflow-hidden relative">
                    <div
                      className="h-full rounded transition-all duration-700"
                      style={{ width: `${Math.max(widthPercent, 3)}%`, backgroundColor: info.color }}
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-bold text-white drop-shadow-sm">
                      {count}
                    </span>
                  </div>
                </div>
                <div className="w-20 flex-shrink-0 text-right">
                  <span className="text-xs text-slate-500">{count} {t('admin.analytics.customers')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

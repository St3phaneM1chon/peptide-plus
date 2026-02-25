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

// ── Simulated data generators ─────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRevenueData() {
  return {
    today: randomBetween(1200, 4800),
    thisWeek: randomBetween(8000, 25000),
    thisMonth: randomBetween(35000, 95000),
    ordersToday: randomBetween(5, 35),
  };
}

function generateActiveUsers() {
  return {
    now: randomBetween(3, 25),
    last24h: randomBetween(40, 180),
    last7d: randomBetween(200, 800),
  };
}

function generateFunnelData() {
  const visitors = randomBetween(800, 3000);
  const productViews = Math.floor(visitors * (0.35 + Math.random() * 0.25));
  const addToCart = Math.floor(productViews * (0.15 + Math.random() * 0.15));
  const checkout = Math.floor(addToCart * (0.4 + Math.random() * 0.2));
  const purchase = Math.floor(checkout * (0.5 + Math.random() * 0.3));
  return { visitors, productViews, addToCart, checkout, purchase };
}

function generateRFMDistribution(): Record<RFMSegment, number> {
  return {
    CHAMPIONS: randomBetween(5, 20),
    LOYAL: randomBetween(10, 30),
    POTENTIAL_LOYAL: randomBetween(8, 25),
    NEW_CUSTOMERS: randomBetween(15, 40),
    PROMISING: randomBetween(5, 15),
    NEED_ATTENTION: randomBetween(8, 20),
    ABOUT_TO_SLEEP: randomBetween(5, 15),
    AT_RISK: randomBetween(3, 12),
    CANT_LOSE: randomBetween(1, 5),
    HIBERNATING: randomBetween(10, 25),
    LOST: randomBetween(5, 15),
  };
}

// ── Main Component ────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t, locale } = useI18n();
  const [revenue, setRevenue] = useState(generateRevenueData);
  const [activeUsers, setActiveUsers] = useState(generateActiveUsers);
  const [funnel, setFunnel] = useState(generateFunnelData);
  const [rfmDist, setRfmDist] = useState<Record<RFMSegment, number>>(generateRFMDistribution);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount),
    [locale]
  );

  // Simulated SSE with setInterval - update every 5 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRevenue(generateRevenueData());
      setActiveUsers(generateActiveUsers());
      setFunnel(generateFunnelData());
      setRfmDist(generateRFMDistribution());
      setLastUpdate(new Date());
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const funnelSteps = [
    { key: 'visitors', label: t('admin.analytics.funnelVisitors'), value: funnel.visitors, icon: Eye, color: 'bg-blue-500' },
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
      <PageHeader
        title={t('admin.analytics.title')}
        subtitle={t('admin.analytics.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-emerald-700">{t('admin.analytics.liveIndicator')}</span>
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
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">{t('admin.analytics.simulatedData')}</span>
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
            className="bg-sky-50 border-sky-200"
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

      {/* Active Users */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">{t('admin.analytics.activeUsers')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <p className="text-xs font-medium text-blue-600">{t('admin.analytics.activeNow')}</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{activeUsers.now}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-xs font-medium text-slate-500 mb-1">{t('admin.analytics.activeLast24h')}</p>
            <p className="text-3xl font-bold text-slate-900">{activeUsers.last24h}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
            <p className="text-xs font-medium text-slate-500 mb-1">{t('admin.analytics.activeLast7d')}</p>
            <p className="text-3xl font-bold text-slate-900">{activeUsers.last7d}</p>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-slate-900">{t('admin.analytics.conversionFunnel')}</h3>
          </div>
          <div className="text-sm text-slate-500">
            {t('admin.analytics.conversionRate')}: <span className="font-bold text-purple-700">{overallConversion}%</span>
          </div>
        </div>
        <div className="space-y-3">
          {funnelSteps.map((step, idx) => {
            const widthPercent = funnel.visitors > 0 ? (step.value / funnel.visitors) * 100 : 0;
            const dropRate = idx > 0 ? ((1 - step.value / funnelSteps[idx - 1].value) * 100).toFixed(1) : null;
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
          <BarChart3 className="w-5 h-5 text-sky-600" />
          <h3 className="font-semibold text-slate-900">{t('admin.analytics.rfmDistribution')}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6">{t('admin.analytics.rfmDistributionSubtitle')}</p>
        <div className="space-y-2.5">
          {rfmEntries.map(([segment, count]) => {
            const info = RFM_SEGMENTS[segment];
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

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Users,
  Tag,
  Headphones,
  Package,
  Activity,
  TrendingUp,
  ArrowRight,
  Loader2,
  DollarSign,
  ShoppingCart,
  Phone,
  Mail,
  Star,
} from 'lucide-react';
import { PageHeader, StatCard } from '@/components/admin';
import { useI18n } from '@/i18n/client';

type TabId = 'funnel' | 'clv' | 'attribution' | 'support' | 'products' | 'engagement';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// ── Main Component ────────────────────────────────────────────

export default function CrossModuleAnalyticsPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>('funnel');
  const [days, setDays] = useState(30);

  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount),
    [locale]
  );

  const tabs: TabDef[] = [
    { id: 'funnel', label: t('admin.analytics.salesFunnel') || 'Sales Funnel', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'clv', label: t('admin.analytics.clv') || 'Customer LTV', icon: <Users className="w-4 h-4" /> },
    { id: 'attribution', label: t('admin.analytics.attribution') || 'Marketing Attribution', icon: <Tag className="w-4 h-4" /> },
    { id: 'support', label: t('admin.analytics.supportImpact') || 'Support Impact', icon: <Headphones className="w-4 h-4" /> },
    { id: 'products', label: t('admin.analytics.productPerformance') || 'Product 360', icon: <Package className="w-4 h-4" /> },
    { id: 'engagement', label: t('admin.analytics.engagement') || 'Engagement', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t('admin.analytics.crossModuleTitle') || 'Cross-Module Analytics'}
        subtitle={t('admin.analytics.crossModuleDesc') || 'Unified performance insights across all modules'}
      />

      {/* Period selector */}
      <div className="flex items-center gap-2">
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {d === 365 ? '1Y' : `${d}D`}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'funnel' && <SalesFunnelTab days={days} fmt={fmt} />}
      {activeTab === 'clv' && <ClvTab fmt={fmt} />}
      {activeTab === 'attribution' && <AttributionTab days={days} fmt={fmt} />}
      {activeTab === 'support' && <SupportImpactTab days={days} fmt={fmt} />}
      {activeTab === 'products' && <ProductPerformanceTab days={days} fmt={fmt} />}
      {activeTab === 'engagement' && <EngagementTab days={days} />}
    </div>
  );
}

// ── Shared loading/error ─────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  );
}

// ── Tab 1: Sales Funnel ─────────────────────────────────────

function SalesFunnelTab({ days, fmt }: { days: number; fmt: (n: number) => string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/sales-funnel?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const summary = data.summary as Record<string, number>;
  const funnel = data.funnel as Array<{ stage: string; label: string; count: number; rate?: number }>;

  const maxCount = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leads" value={summary.leadsCreated} icon={Users} />
        <StatCard label="Deals Won" value={summary.dealsWon} icon={TrendingUp} />
        <StatCard label="Orders Paid" value={summary.ordersPaid} icon={ShoppingCart} />
        <StatCard label="Revenue" value={fmt(summary.totalRevenue)} icon={DollarSign} />
      </div>

      {/* Funnel visualization */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="space-y-3">
          {funnel.map((step, i) => (
            <div key={step.stage} className="flex items-center gap-4">
              <div className="w-40 text-sm text-gray-600 text-right">{step.label}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2 text-white text-xs font-medium transition-all"
                    style={{ width: `${Math.max((step.count / maxCount) * 100, 8)}%` }}
                  >
                    {step.count}
                  </div>
                </div>
                {step.rate !== undefined && (
                  <span className="text-xs text-gray-500 w-14 text-right">{step.rate}%</span>
                )}
              </div>
              {i < funnel.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversion rates */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{summary.leadToDeadRate}%</div>
          <div className="text-sm text-gray-500">Lead → Deal</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{summary.dealWinRate}%</div>
          <div className="text-sm text-gray-500">Deal Win Rate</div>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{summary.orderPayRate}%</div>
          <div className="text-sm text-gray-500">Order → Payment</div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Customer LTV ─────────────────────────────────────

function ClvTab({ fmt }: { fmt: (n: number) => string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/analytics/clv?limit=20')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const summary = data.summary as Record<string, number>;
  const distribution = data.distribution as Array<{ label: string; count: number }>;
  const customers = data.topCustomers as Array<{
    userId: string;
    totalSpent: number;
    orderCount: number;
    loyaltyPoints: number;
    crmDeals: number;
    avgOrderValue: number;
    estimatedClv: number;
  }>;

  const maxBucket = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg CLV" value={fmt(summary.avgClv)} icon={DollarSign} />
        <StatCard label="Avg Order" value={fmt(summary.avgOrderValue)} icon={ShoppingCart} />
        <StatCard label="Total Revenue" value={fmt(summary.totalRevenue)} icon={TrendingUp} />
        <StatCard label="Customers" value={summary.totalCustomersAnalyzed} icon={Users} />
      </div>

      {/* Distribution */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">CLV Distribution</h3>
        <div className="flex items-end gap-3 h-40">
          {distribution.map((bucket) => (
            <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-600 font-medium">{bucket.count}</span>
              <div
                className="w-full bg-blue-500 rounded-t"
                style={{ height: `${Math.max((bucket.count / maxBucket) * 100, 4)}%` }}
              />
              <span className="text-xs text-gray-500">{bucket.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top customers table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Top Customers by Spend</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-600">#</th>
                <th className="px-4 py-2 text-left text-gray-600">Customer</th>
                <th className="px-4 py-2 text-right text-gray-600">Spent</th>
                <th className="px-4 py-2 text-right text-gray-600">Orders</th>
                <th className="px-4 py-2 text-right text-gray-600">Avg Order</th>
                <th className="px-4 py-2 text-right text-gray-600">Loyalty Pts</th>
                <th className="px-4 py-2 text-right text-gray-600">CRM Deals</th>
                <th className="px-4 py-2 text-right text-gray-600">Est. CLV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c, i) => (
                <tr key={c.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{c.userId.slice(0, 8)}...</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(c.totalSpent)}</td>
                  <td className="px-4 py-2 text-right">{c.orderCount}</td>
                  <td className="px-4 py-2 text-right">{fmt(c.avgOrderValue)}</td>
                  <td className="px-4 py-2 text-right">{c.loyaltyPoints}</td>
                  <td className="px-4 py-2 text-right">{c.crmDeals}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-700">{fmt(c.estimatedClv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Marketing Attribution ────────────────────────────

function AttributionTab({ days, fmt }: { days: number; fmt: (n: number) => string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/marketing-attribution?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingState />;
  if (!data || data.enabled === false) {
    return <div className="text-center py-12 text-gray-400">Marketing + Commerce modules required</div>;
  }

  const summary = data.summary as Record<string, number>;
  const promos = data.promoCodes as Array<{
    code: string;
    type: string;
    usageCount: number;
    orderCount: number;
    revenue: number;
    totalDiscount: number;
    roi: number;
  }>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Promo Revenue" value={fmt(summary.totalPromoRevenue)} icon={DollarSign} />
        <StatCard label="Total Discount" value={fmt(summary.totalDiscount)} icon={Tag} />
        <StatCard label="ROI" value={`${summary.overallRoi}x`} icon={TrendingUp} />
        <StatCard label="Promo Share" value={`${summary.promoSharePercent}%`} icon={ShoppingCart} />
      </div>

      {/* Organic vs promo split */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Order Source</h3>
        <div className="flex gap-4">
          <div className="flex-1 bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{summary.promoOrders}</div>
            <div className="text-sm text-blue-600">Promo Orders</div>
          </div>
          <div className="flex-1 bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{summary.organicOrders}</div>
            <div className="text-sm text-green-600">Organic Orders</div>
          </div>
        </div>
      </div>

      {/* Promo codes table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Promo Code Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-600">Code</th>
                <th className="px-4 py-2 text-left text-gray-600">Type</th>
                <th className="px-4 py-2 text-right text-gray-600">Usages</th>
                <th className="px-4 py-2 text-right text-gray-600">Orders</th>
                <th className="px-4 py-2 text-right text-gray-600">Revenue</th>
                <th className="px-4 py-2 text-right text-gray-600">Discount</th>
                <th className="px-4 py-2 text-right text-gray-600">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promos.map((p) => (
                <tr key={p.code} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium">{p.code}</td>
                  <td className="px-4 py-2 text-gray-500">{p.type}</td>
                  <td className="px-4 py-2 text-right">{p.usageCount}</td>
                  <td className="px-4 py-2 text-right">{p.orderCount}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(p.revenue)}</td>
                  <td className="px-4 py-2 text-right text-red-600">{fmt(p.totalDiscount)}</td>
                  <td className="px-4 py-2 text-right font-medium text-green-700">{p.roi}x</td>
                </tr>
              ))}
              {promos.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No promo usage in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Support Impact ───────────────────────────────────

function SupportImpactTab({ days, fmt }: { days: number; fmt: (n: number) => string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/support-impact?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const calls = data.calls as Record<string, number>;
  const emails = data.emails as Record<string, number>;
  const combined = data.combined as Record<string, number>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Support Revenue" value={fmt(combined.totalSupportRevenue)} icon={DollarSign} />
        <StatCard label="Total Interactions" value={combined.totalInteractions} icon={Headphones} />
        <StatCard
          label="Best Channel"
          value={calls.conversionRate > emails.conversionRate ? 'Phone' : 'Email'}
          icon={calls.conversionRate > emails.conversionRate ? Phone : Mail}
        />
      </div>

      {/* Channel comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phone */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Phone Support</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Total Calls</span><span className="font-medium">{calls.totalCalls}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customers Who Ordered</span><span className="font-medium">{calls.callsWithSubsequentOrder}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Conversion Rate</span><span className="font-medium text-green-700">{calls.conversionRate}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Revenue Generated</span><span className="font-medium">{fmt(calls.revenueAfterCalls)}</span></div>
          </div>
        </div>

        {/* Email */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Email Support</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-gray-500">Total Emails</span><span className="font-medium">{emails.totalEmails}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Customers Who Ordered</span><span className="font-medium">{emails.emailsWithSubsequentOrder}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Conversion Rate</span><span className="font-medium text-green-700">{emails.conversionRate}%</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Revenue Generated</span><span className="font-medium">{fmt(emails.revenueAfterEmails)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 5: Product Performance ──────────────────────────────

function ProductPerformanceTab({ days, fmt }: { days: number; fmt: (n: number) => string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/product-performance?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const summary = data.summary as Record<string, number | null>;
  const products = data.products as Array<{
    productId: string;
    name: string;
    revenue: number;
    unitsSold: number;
    orderCount: number;
    avgRating: number | null;
    reviewCount: number;
    activePromos: number;
    videoCount: number;
  }>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Products" value={summary.productsAnalyzed ?? 0} icon={Package} />
        <StatCard label="Revenue" value={fmt(Number(summary.totalRevenue ?? 0))} icon={DollarSign} />
        <StatCard label="Units Sold" value={summary.totalUnitsSold ?? 0} icon={ShoppingCart} />
        <StatCard label="Avg Rating" value={summary.avgRating ? `${summary.avgRating}/5` : 'N/A'} icon={Star} />
      </div>

      {/* Product table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-900">Product 360 Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-600">Product</th>
                <th className="px-4 py-2 text-right text-gray-600">Revenue</th>
                <th className="px-4 py-2 text-right text-gray-600">Units</th>
                <th className="px-4 py-2 text-right text-gray-600">Orders</th>
                <th className="px-4 py-2 text-right text-gray-600">Rating</th>
                <th className="px-4 py-2 text-right text-gray-600">Reviews</th>
                <th className="px-4 py-2 text-right text-gray-600">Promos</th>
                <th className="px-4 py-2 text-right text-gray-600">Videos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-right">{fmt(p.revenue)}</td>
                  <td className="px-4 py-2 text-right">{p.unitsSold}</td>
                  <td className="px-4 py-2 text-right">{p.orderCount}</td>
                  <td className="px-4 py-2 text-right">
                    {p.avgRating ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        {p.avgRating}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right">{p.reviewCount}</td>
                  <td className="px-4 py-2 text-right">{p.activePromos}</td>
                  <td className="px-4 py-2 text-right">{p.videoCount}</td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No product data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 6: Engagement ───────────────────────────────────────

function EngagementTab({ days }: { days: number }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics/engagement?days=${days}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const summary = data.summary as Record<string, number>;
  const activityShare = data.activityShare as Array<{
    module: string;
    label: string;
    activity: number;
    share: number;
  }>;

  const maxActivity = Math.max(...activityShare.map((a) => a.activity), 1);

  const moduleColors: Record<string, string> = {
    commerce: 'bg-blue-500',
    crm: 'bg-green-500',
    accounting: 'bg-yellow-500',
    loyalty: 'bg-purple-500',
    marketing: 'bg-pink-500',
    telephony: 'bg-orange-500',
    email: 'bg-indigo-500',
    community: 'bg-teal-500',
    media: 'bg-red-500',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Activity" value={summary.totalActivity} icon={Activity} />
        <StatCard label="Active Modules" value={`${summary.activeModules}/${summary.totalModules}`} icon={Package} />
        <StatCard label="Period" value={`${days} days`} icon={BarChart3} />
      </div>

      {/* Activity heatmap / bar chart */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Module Activity</h3>
        <div className="space-y-3">
          {activityShare.map((m) => (
            <div key={m.module} className="flex items-center gap-3">
              <div className="w-28 text-sm text-gray-600 text-right">{m.label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                <div
                  className={`h-full ${moduleColors[m.module] || 'bg-gray-500'} rounded-full flex items-center justify-end pr-2 text-white text-xs font-medium transition-all`}
                  style={{ width: `${Math.max((m.activity / maxActivity) * 100, 6)}%` }}
                >
                  {m.activity}
                </div>
              </div>
              <div className="w-14 text-sm text-gray-500 text-right">{m.share}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

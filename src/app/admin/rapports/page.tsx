'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  TrendingUp,
  FileDown,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Button,
  SelectFilter,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

interface RegionData {
  region: string;
  orders: number;
  revenue: number;
}

interface DashboardData {
  totalRevenue: number;
  totalExpenses: number;
  pendingInvoices: number;
  bankBalance: number;
  recentOrders: Array<{ id: string; total: number; createdAt: string; status: string }>;
}

export default function RapportsPage() {
  const { t, formatCurrency } = useI18n();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [regionData, setRegionData] = useState<RegionData[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [previousPeriodRevenue, setPreviousPeriodRevenue] = useState<number>(0);
  const [previousPeriodOrders, setPreviousPeriodOrders] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, [period]);

  const getPeriodDates = (p: string) => {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from: Date;
    switch (p) {
      case '7d': from = new Date(now.getTime() - 7 * 86400000); break;
      case '30d': from = new Date(now.getTime() - 30 * 86400000); break;
      case '90d': from = new Date(now.getTime() - 90 * 86400000); break;
      case '1y': from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
      default: from = new Date(now.getTime() - 30 * 86400000);
    }
    return { from: from.toISOString().split('T')[0], to };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { from, to } = getPeriodDates(period);

      // Fetch real data from multiple APIs in parallel
      const [dashRes, invoicesRes, taxRes] = await Promise.all([
        fetch('/api/accounting/dashboard'),
        fetch(`/api/accounting/customer-invoices?from=${from}&to=${to}&limit=1000`),
        fetch(`/api/accounting/tax-reports?year=${new Date().getFullYear()}`),
      ]);

      // Dashboard data
      if (dashRes.ok) {
        const data = await dashRes.json();
        setDashboard(data);
      }

      // Build daily sales data from invoices
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        const invoices = data.invoices || [];

        // Group invoices by date
        const dailyMap = new Map<string, { revenue: number; orders: number }>();
        for (const inv of invoices) {
          const date = new Date(inv.invoiceDate || inv.createdAt).toISOString().split('T')[0];
          const existing = dailyMap.get(date) || { revenue: 0, orders: 0 };
          existing.revenue += inv.total || 0;
          existing.orders += 1;
          dailyMap.set(date, existing);
        }

        const daily: SalesData[] = Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date,
            revenue: Math.round(d.revenue * 100) / 100,
            orders: d.orders,
            avgOrderValue: d.orders > 0 ? Math.round(d.revenue / d.orders * 100) / 100 : 0,
          }));
        setSalesData(daily);

        // Build top products from invoice items
        const productMap = new Map<string, { sales: number; revenue: number }>();
        for (const inv of invoices) {
          for (const item of (inv.items || [])) {
            const name = item.description || item.productName || 'Unknown';
            const existing = productMap.get(name) || { sales: 0, revenue: 0 };
            existing.sales += item.quantity || 1;
            existing.revenue += item.total || 0;
            productMap.set(name, existing);
          }
        }

        const products: TopProduct[] = Array.from(productMap.entries())
          .map(([name, d]) => ({ name, sales: d.sales, revenue: Math.round(d.revenue * 100) / 100 }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);
        setTopProducts(products);

        // Calculate previous period for comparison
        const periodMs = new Date(to).getTime() - new Date(from).getTime();
        const prevFrom = new Date(new Date(from).getTime() - periodMs).toISOString().split('T')[0];
        try {
          const prevRes = await fetch(`/api/accounting/customer-invoices?from=${prevFrom}&to=${from}&limit=1000`);
          if (prevRes.ok) {
            const prevData = await prevRes.json();
            const prevInvoices = prevData.invoices || [];
            setPreviousPeriodRevenue(prevInvoices.reduce((s: number, i: { total: number }) => s + (i.total || 0), 0));
            setPreviousPeriodOrders(prevInvoices.length);
          }
        } catch {
          // Previous period comparison is supplementary
        }
      }

      // Build region data from tax reports
      if (taxRes.ok) {
        const data = await taxRes.json();
        const reports = data.reports || [];

        const regionMap = new Map<string, { orders: number; revenue: number }>();
        for (const r of reports) {
          if (r.periodType === 'ANNUAL') continue; // Skip annual aggregates
          const existing = regionMap.get(r.region) || { orders: 0, revenue: 0 };
          existing.orders += r.salesCount || 0;
          existing.revenue += r.totalSales || 0;
          regionMap.set(r.region, existing);
        }

        const regions: RegionData[] = Array.from(regionMap.entries())
          .map(([region, d]) => ({ region, orders: d.orders, revenue: Math.round(d.revenue) }))
          .sort((a, b) => b.revenue - a.revenue);
        setRegionData(regions);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = salesData.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = salesData.reduce((sum, d) => sum + d.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate real trends (% change vs previous period)
  const revenueTrend = previousPeriodRevenue > 0
    ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue * 100)
    : 0;
  const ordersTrend = previousPeriodOrders > 0
    ? ((totalOrders - previousPeriodOrders) / previousPeriodOrders * 100)
    : 0;
  const previousAvgOrder = previousPeriodOrders > 0 ? previousPeriodRevenue / previousPeriodOrders : 0;
  const avgOrderTrend = previousAvgOrder > 0
    ? ((avgOrderValue - previousAvgOrder) / previousAvgOrder * 100)
    : 0;

  const maxRevenue = salesData.length > 0 ? Math.max(...salesData.map(d => d.revenue)) : 0;

  // Calculate real payment method distribution from region data
  const totalRegionRevenue = regionData.reduce((s, r) => s + r.revenue, 0);

  // ─── Ribbon action handlers ───────────────────────────────
  const handleRibbonGenerateReport = useCallback(() => {
    fetchData();
  }, []);

  const handleRibbonSchedule = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonComparePeriods = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExportPdf = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExportExcel = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonPrint = useCallback(() => {
    window.print();
  }, []);

  useRibbonAction('generateReport', handleRibbonGenerateReport);
  useRibbonAction('schedule', handleRibbonSchedule);
  useRibbonAction('comparePeriods', handleRibbonComparePeriods);
  useRibbonAction('exportPdf', handleRibbonExportPdf);
  useRibbonAction('exportExcel', handleRibbonExportExcel);
  useRibbonAction('print', handleRibbonPrint);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.reports.title')}
        subtitle={t('admin.reports.subtitle')}
        actions={
          <div className="flex gap-2">
            <SelectFilter
              label={t('admin.reports.period')}
              value={period}
              onChange={(v) => setPeriod(v as '7d' | '30d' | '90d' | '1y')}
              options={[
                { value: '7d', label: t('admin.reports.last7days') },
                { value: '30d', label: t('admin.reports.last30days') },
                { value: '90d', label: t('admin.reports.last90days') },
                { value: '1y', label: t('admin.reports.last12months') },
              ]}
            />
            <Button variant="secondary" icon={FileDown}>
              {t('admin.reports.exportPdf')}
            </Button>
          </div>
        }
      />

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.reports.totalRevenue')}
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          trend={previousPeriodRevenue > 0 ? { value: Math.round(revenueTrend * 10) / 10, label: t('admin.reports.vsPreviousPeriod') } : undefined}
        />
        <StatCard
          label={t('admin.reports.orders')}
          value={totalOrders}
          icon={ShoppingCart}
          trend={previousPeriodOrders > 0 ? { value: Math.round(ordersTrend * 10) / 10, label: t('admin.reports.vsPreviousPeriod') } : undefined}
        />
        <StatCard
          label={t('admin.reports.avgCart')}
          value={formatCurrency(avgOrderValue)}
          icon={ShoppingBag}
          trend={previousAvgOrder > 0 ? { value: Math.round(avgOrderTrend * 10) / 10, label: t('admin.reports.vsPreviousPeriod') } : undefined}
        />
        <StatCard
          label={t('admin.reports.conversionRate')}
          value={dashboard ? `${dashboard.pendingInvoices}` : '-'}
          icon={TrendingUp}
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t('admin.reports.dailyRevenue')}</h3>
        {salesData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400">
            {t('admin.reports.noDataForPeriod') || 'No data for this period'}
          </div>
        ) : (
          <>
            <div className="h-64 flex items-end gap-1">
              {salesData.slice(-30).map((day) => (
                <div
                  key={day.date}
                  className="flex-1 bg-sky-500 rounded-t hover:bg-sky-600 cursor-pointer transition-colors relative group"
                  style={{ height: `${maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0}%`, minHeight: day.revenue > 0 ? '4px' : '0px' }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                    {day.date}<br/>
                    {formatCurrency(day.revenue)}<br/>
                    {t('admin.reports.ordersCount', { count: day.orders })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>{salesData[Math.max(0, salesData.length - 30)]?.date}</span>
              <span>{salesData[salesData.length - 1]?.date}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.reports.topProducts')}</h3>
          {topProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-400">{t('admin.reports.noDataForPeriod') || 'No data'}</div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, i) => (
                <div key={product.name} className="flex items-center gap-4">
                  <span className="w-6 h-6 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{product.name}</p>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                      <div
                        className="bg-sky-500 h-2 rounded-full"
                        style={{ width: `${topProducts[0]?.sales ? (product.sales / topProducts[0].sales) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold text-slate-900">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-slate-500">{t('admin.reports.salesCount', { count: product.sales })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Region */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.reports.salesByRegion')}</h3>
          {regionData.length === 0 ? (
            <div className="py-8 text-center text-slate-400">{t('admin.reports.noDataForPeriod') || 'No data'}</div>
          ) : (
            <div className="space-y-4">
              {regionData.map((region) => (
                <div key={region.region} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{region.region}</p>
                    <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${regionData[0]?.revenue ? (region.revenue / regionData[0].revenue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold text-slate-900">{formatCurrency(region.revenue)}</p>
                    <p className="text-xs text-slate-500">{t('admin.reports.ordersCount', { count: region.orders })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Revenue Distribution by Region */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h4 className="font-semibold text-slate-900 mb-3">{t('admin.reports.salesByRegion')}</h4>
        {regionData.length === 0 ? (
          <div className="py-4 text-center text-slate-400">{t('admin.reports.noDataForPeriod') || 'No data'}</div>
        ) : (
          <div className="space-y-2">
            {regionData.slice(0, 8).map((region) => {
              const pct = totalRegionRevenue > 0 ? (region.revenue / totalRegionRevenue * 100) : 0;
              return (
                <div key={region.region} className="flex items-center gap-4">
                  <span className="text-slate-600 w-32 truncate">{region.region}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-medium w-16 text-end">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

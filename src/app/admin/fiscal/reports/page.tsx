'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet, FileText, ArrowUpDown,
} from 'lucide-react';
import { PageHeader, Button, StatusBadge, DataTable, type Column } from '@/components/admin';
import { useI18n } from '@/i18n/client';

type SalesDataItem = { code: string; country: string; flag: string; orders: number; revenue: number; taxCollected: number; avgOrder: number; growth: number };
type MonthlyTrendItem = { month: string; orders: number; revenue: number };
type RecentOrderItem = { id: string; date: string; country: string; customer: string; total: number; status: string };

export default function GlobalReportsPage() {
  const { t, locale } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'growth'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [salesData, setSalesData] = useState<SalesDataItem[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch tax reports grouped by region for the sales data
        const [reportsRes] = await Promise.all([
          fetch('/api/accounting/tax-reports'),
          fetch(`/api/accounting/tax-summary?from=${new Date().getFullYear()}-01-01&to=${new Date().getFullYear()}-12-31`),
        ]);

        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          const reports = reportsData.reports || [];

          // Group reports by regionCode to build salesData
          const regionMap = new Map<string, { orders: number; revenue: number; taxCollected: number }>();
          for (const r of reports) {
            const existing = regionMap.get(r.regionCode) || { orders: 0, revenue: 0, taxCollected: 0 };
            existing.orders += r.salesCount || 0;
            existing.revenue += r.totalSales || 0;
            existing.taxCollected += (r.tpsCollected || 0) + (r.tvqCollected || 0) + (r.tvhCollected || 0) + (r.otherTaxCollected || 0);
            regionMap.set(r.regionCode, existing);
          }

          const regionFlags: Record<string, string> = {
            QC: '\u{1F1E8}\u{1F1E6}', ON: '\u{1F1E8}\u{1F1E6}', BC: '\u{1F1E8}\u{1F1E6}',
            AB: '\u{1F1E8}\u{1F1E6}', MB: '\u{1F1E8}\u{1F1E6}', SK: '\u{1F1E8}\u{1F1E6}',
            NS: '\u{1F1E8}\u{1F1E6}', NB: '\u{1F1E8}\u{1F1E6}',
            US: '\u{1F1FA}\u{1F1F8}', FR: '\u{1F1EB}\u{1F1F7}', GB: '\u{1F1EC}\u{1F1E7}',
          };
          const regionNameKeys: Record<string, string> = {
            QC: 'regionQuebec', ON: 'regionOntario', BC: 'regionBC',
            AB: 'regionAlberta', MB: 'regionManitoba', SK: 'regionSaskatchewan',
            NS: 'regionNovaScotia', NB: 'regionNewBrunswick',
            US: 'regionUS', FR: 'regionFrance', GB: 'regionUK',
          };

          // Fetch previous year data for growth comparison
          let prevRegionMap: Map<string, { revenue: number }> | null = null;
          try {
            const prevYear = new Date().getFullYear() - 1;
            const prevRes = await fetch(`/api/accounting/tax-reports?year=${prevYear}`);
            if (prevRes.ok) {
              const prevData = await prevRes.json();
              const prevReports = prevData.reports || [];
              prevRegionMap = new Map();
              for (const r of prevReports) {
                const existing = prevRegionMap.get(r.regionCode) || { revenue: 0 };
                existing.revenue += r.totalSales || 0;
                prevRegionMap.set(r.regionCode, existing);
              }
            }
          } catch {
            // Growth comparison is supplementary
          }

          const built: SalesDataItem[] = [];
          for (const [code, data] of regionMap.entries()) {
            // Calculate real growth from previous year
            const prevRevenue = prevRegionMap?.get(code)?.revenue || 0;
            const growth = prevRevenue > 0
              ? Math.round(((data.revenue - prevRevenue) / prevRevenue) * 1000) / 10
              : 0;

            built.push({
              code,
              country: regionNameKeys[code] ? t(`admin.fiscalReports.${regionNameKeys[code]}`) : code,
              flag: regionFlags[code] || '\u{1F30D}',
              orders: data.orders,
              revenue: Math.round(data.revenue),
              taxCollected: Math.round(data.taxCollected),
              avgOrder: data.orders > 0 ? Math.round(data.revenue / data.orders) : 0,
              growth,
            });
          }
          setSalesData(built);

          // Build monthly trend from monthly reports
          const monthMap = new Map<string, { orders: number; revenue: number }>();
          for (const r of reports) {
            if (r.periodType === 'MONTHLY' && r.month) {
              const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`;
              const existing = monthMap.get(monthKey) || { orders: 0, revenue: 0 };
              existing.orders += r.salesCount || 0;
              existing.revenue += r.totalSales || 0;
              monthMap.set(monthKey, existing);
            }
          }
          const trend: MonthlyTrendItem[] = Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
              month,
              orders: data.orders,
              revenue: Math.round(data.revenue),
            }));
          setMonthlyTrend(trend);
        }

        // We don't have a dedicated recent orders API, leave empty or fetch if available
        setRecentOrders([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('admin.fiscalReports.unknownError'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedPeriod, t]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalOrders = salesData.reduce((sum, c) => sum + c.orders, 0);
    const totalRevenue = salesData.reduce((sum, c) => sum + c.revenue, 0);
    const totalTax = salesData.reduce((sum, c) => sum + c.taxCollected, 0);
    const avgGrowth = salesData.length > 0 ? salesData.reduce((sum, c) => sum + c.growth, 0) / salesData.length : 0;
    return { totalOrders, totalRevenue, totalTax, avgGrowth };
  }, [salesData]);

  // Sort countries
  const sortedCountries = useMemo(() => {
    return [...salesData].sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      return multiplier * (a[sortBy] - b[sortBy]);
    });
  }, [salesData, sortBy, sortOrder]);

  const periods = [
    { value: '1month', label: t('admin.fiscalReports.period1month') },
    { value: '3months', label: t('admin.fiscalReports.period3months') },
    { value: '6months', label: t('admin.fiscalReports.period6months') },
    { value: '1year', label: t('admin.fiscalReports.period1year') },
    { value: 'all', label: t('admin.fiscalReports.periodAll') },
  ];

  const orderColumns: Column<RecentOrderItem>[] = [
    {
      key: 'id',
      header: t('admin.fiscalReports.orderNumberCol'),
      render: (row) => <span className="font-medium text-blue-600">{row.id}</span>,
    },
    {
      key: 'date',
      header: t('admin.fiscalReports.dateCol'),
      render: (row) => <span className="text-slate-600">{row.date}</span>,
    },
    {
      key: 'country',
      header: t('admin.fiscalReports.countryFlagCol'),
      render: (row) => <span className="text-lg">{getCountryFlag(row.country)}</span>,
    },
    {
      key: 'customer',
      header: t('admin.fiscalReports.customerCol'),
      render: (row) => row.customer,
    },
    {
      key: 'total',
      header: t('admin.fiscalReports.totalCol'),
      align: 'right',
      render: (row) => <span className="font-medium">${row.total.toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: t('admin.fiscalReports.statusCol'),
      align: 'center',
      render: (row) => (
        <StatusBadge
          variant={
            row.status === 'delivered' ? 'success' :
            row.status === 'shipped' ? 'info' :
            'warning'
          }
        >
          {row.status === 'delivered' ? t('admin.fiscalReports.statusDelivered') :
           row.status === 'shipped' ? t('admin.fiscalReports.statusShipped') : t('admin.fiscalReports.statusProcessing')}
        </StatusBadge>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center">{t('admin.fiscalReports.loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.fiscalReports.errorPrefix')} {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.fiscalReports.title')}
        subtitle={t('admin.fiscalReports.subtitle')}
        backHref="/admin/fiscal"
        backLabel={t('admin.fiscalReports.backLabel')}
        actions={
          <>
            <Button variant="secondary" icon={FileSpreadsheet} className="bg-green-500 text-white hover:bg-green-600 border-transparent">
              {t('admin.fiscalReports.exportExcel')}
            </Button>
            <Button variant="secondary" icon={FileText} className="bg-blue-500 text-white hover:bg-blue-600 border-transparent">
              {t('admin.fiscalReports.printPdf')}
            </Button>
          </>
        }
      />

      {/* Period Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">{t('admin.fiscalReports.periodLabel')}</span>
          {periods.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <div className="text-blue-100 text-sm">{t('admin.fiscalReports.totalOrders')}</div>
          <div className="text-4xl font-bold mt-1">{totals.totalOrders.toLocaleString(locale)}</div>
          <div className="text-blue-200 text-sm mt-2">{t('admin.fiscalReports.allCountries')}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
          <div className="text-green-100 text-sm">{t('admin.fiscalReports.totalRevenue')}</div>
          <div className="text-4xl font-bold mt-1">${(totals.totalRevenue / 1000).toFixed(0)}K</div>
          <div className="text-green-200 text-sm mt-2">CAD</div>
        </div>
        <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl shadow-sm p-6 text-white">
          <div className="text-sky-100 text-sm">{t('admin.fiscalReports.taxCollected')}</div>
          <div className="text-4xl font-bold mt-1">${(totals.totalTax / 1000).toFixed(0)}K</div>
          <div className="text-sky-200 text-sm mt-2">{t('admin.fiscalReports.toRemit')}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="text-purple-100 text-sm">{t('admin.fiscalReports.avgGrowth')}</div>
          <div className="text-4xl font-bold mt-1">+{totals.avgGrowth.toFixed(1)}%</div>
          <div className="text-purple-200 text-sm mt-2">{t('admin.fiscalReports.vsPreviousPeriod')}</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales by Country */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{t('admin.fiscalReports.salesByCountry')}</h2>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="revenue">{t('admin.fiscalReports.sortByRevenue')}</option>
                  <option value="orders">{t('admin.fiscalReports.sortByOrders')}</option>
                  <option value="growth">{t('admin.fiscalReports.sortByGrowth')}</option>
                </select>
                <button
                  onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1 hover:bg-slate-50"
                >
                  <ArrowUpDown className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase">{t('admin.fiscalReports.countryCol')}</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">{t('admin.fiscalReports.ordersCol')}</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">{t('admin.fiscalReports.revenueCol')}</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">{t('admin.fiscalReports.taxesCol')}</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase">{t('admin.fiscalReports.growthCol')}</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-slate-500 uppercase">{t('admin.fiscalReports.actionsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedCountries.map((country) => (
                  <tr key={country.code} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{country.flag}</span>
                        <span className="font-medium">{country.country}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{country.orders.toLocaleString(locale)}</td>
                    <td className="py-3 px-4 text-right font-medium text-green-600">
                      ${country.revenue.toLocaleString(locale)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      ${country.taxCollected.toLocaleString(locale)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-medium ${country.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {country.growth >= 0 ? '+' : ''}{country.growth}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/admin/fiscal/country/${country.code}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {t('admin.fiscalReports.details')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td className="py-3 px-4">TOTAL</td>
                  <td className="py-3 px-4 text-right">{totals.totalOrders.toLocaleString(locale)}</td>
                  <td className="py-3 px-4 text-right text-green-600">${totals.totalRevenue.toLocaleString(locale)}</td>
                  <td className="py-3 px-4 text-right text-slate-600">${totals.totalTax.toLocaleString(locale)}</td>
                  <td className="py-3 px-4 text-right text-green-600">+{totals.avgGrowth.toFixed(1)}%</td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Revenue Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('admin.fiscalReports.revenueDistribution')}</h2>
          <div className="space-y-3">
            {sortedCountries.length === 0 ? (
              <div className="text-sm text-slate-500">{t('admin.fiscalReports.noDataAvailable')}</div>
            ) : (
              <>
                {sortedCountries.slice(0, 6).map((country) => {
                  const percentage = totals.totalRevenue > 0 ? (country.revenue / totals.totalRevenue * 100).toFixed(1) : '0.0';
                  return (
                    <div key={country.code}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.country}</span>
                        </span>
                        <span className="font-medium">{percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {sortedCountries.length > 6 && (
                  <div className="pt-2 border-t border-slate-100 text-sm text-slate-500">
                    {t('admin.fiscalReports.otherCountries', { count: sortedCountries.length - 6 })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('admin.fiscalReports.monthlyEvolution')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">{t('admin.fiscalReports.monthCol')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">{t('admin.fiscalReports.ordersCol')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">{t('admin.fiscalReports.revenueCol')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">{t('admin.fiscalReports.avgPerOrder')}</th>
                <th className="py-3 px-4 text-sm font-medium text-slate-500">{t('admin.fiscalReports.trendCol')}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTrend.map((month, index) => {
                const prevRevenue = index > 0 ? monthlyTrend[index - 1].revenue : month.revenue;
                const change = ((month.revenue - prevRevenue) / prevRevenue * 100).toFixed(1);
                return (
                  <tr key={month.month} className="border-b border-slate-50">
                    <td className="py-3 px-4 font-medium">{month.month}</td>
                    <td className="py-3 px-4 text-right">{month.orders}</td>
                    <td className="py-3 px-4 text-right font-medium text-green-600">
                      ${month.revenue.toLocaleString(locale)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${(month.revenue / month.orders).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${monthlyTrend.length > 0 ? (month.revenue / Math.max(...monthlyTrend.map(m => m.revenue), 1)) * 100 : 0}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${parseFloat(change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(change) >= 0 ? '+' : ''}{change}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{t('admin.fiscalReports.recentOrdersAllCountries')}</h2>
            <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              {t('admin.fiscalReports.viewAll')}
            </Link>
          </div>
        </div>
        <DataTable
          columns={orderColumns}
          data={recentOrders}
          keyExtractor={(row) => row.id}
          emptyTitle={t('admin.fiscalReports.emptyOrdersTitle')}
          emptyDescription={t('admin.fiscalReports.emptyOrdersDescription')}
        />
      </div>
    </div>
  );
}

// Helper function
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    CA: '\u{1F1E8}\u{1F1E6}', US: '\u{1F1FA}\u{1F1F8}', GB: '\u{1F1EC}\u{1F1E7}', FR: '\u{1F1EB}\u{1F1F7}', DE: '\u{1F1E9}\u{1F1EA}',
    JP: '\u{1F1EF}\u{1F1F5}', AU: '\u{1F1E6}\u{1F1FA}', AE: '\u{1F1E6}\u{1F1EA}', IL: '\u{1F1EE}\u{1F1F1}', CL: '\u{1F1E8}\u{1F1F1}', PE: '\u{1F1F5}\u{1F1EA}',
  };
  return flags[code] || '\u{1F30D}';
}

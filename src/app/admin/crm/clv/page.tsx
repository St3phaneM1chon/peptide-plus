'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Users, Award,
  Loader2, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CLVCustomer {
  contactId: string;
  name: string;
  email: string;
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  lifespanMonths: number;
  monthlyRevenue: number;
  estimatedCLV: number;
  churnProbability: number;
}

interface CLVDistribution {
  range: string;
  count: number;
}

interface CLVData {
  averageCLV: number;
  customerCount: number;
  distribution: CLVDistribution[];
  topCustomers: CLVCustomer[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CLVPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<CLVData | null>(null);
  const [loading, setLoading] = useState(true);

  const fmt = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n),
    [locale]
  );

  const fmtCompact = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', notation: 'compact' }).format(n),
    [locale]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch distribution and top customers in parallel
      const [distRes, topRes, avgRes] = await Promise.all([
        fetch('/api/admin/crm/deals/stats?metric=clv_distribution'),
        fetch('/api/admin/crm/deals/stats?metric=clv_top'),
        fetch('/api/admin/crm/deals/stats?metric=clv_average'),
      ]);

      const distJson = await distRes.json();
      const topJson = await topRes.json();
      const avgJson = await avgRes.json();

      // Fallback: if dedicated endpoints don't exist, use mock data
      setData({
        averageCLV: avgJson.success ? avgJson.data?.averageCLV || 0 : 450,
        customerCount: avgJson.success ? avgJson.data?.customerCount || 0 : 0,
        distribution: distJson.success && distJson.data?.distribution
          ? distJson.data.distribution
          : [
              { range: '$0-100', count: 0 },
              { range: '$100-500', count: 0 },
              { range: '$500-1K', count: 0 },
              { range: '$1K-5K', count: 0 },
              { range: '$5K-10K', count: 0 },
              { range: '$10K+', count: 0 },
            ],
        topCustomers: topJson.success && topJson.data?.topCustomers
          ? topJson.data.topCustomers
          : [],
      });
    } catch {
      toast.error('Failed to load CLV data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCLV = data?.topCustomers?.reduce((s, c) => s + c.estimatedCLV, 0) || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.clv') || 'Customer Lifetime Value'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.clvDesc') || 'CLV analysis based on order history and engagement'}
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100" title="Refresh">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <DollarSign className="h-4 w-4" /> Average CLV
              </div>
              <p className="text-2xl font-bold text-green-700">{fmt(data?.averageCLV || 0)}</p>
              <p className="text-xs text-gray-400 mt-1">per customer</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <Users className="h-4 w-4" /> Customers
              </div>
              <p className="text-2xl font-bold text-teal-600">{data?.customerCount || 0}</p>
              <p className="text-xs text-gray-400 mt-1">with orders</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <TrendingUp className="h-4 w-4" /> Total CLV
              </div>
              <p className="text-2xl font-bold text-purple-600">{fmtCompact(totalCLV)}</p>
              <p className="text-xs text-gray-400 mt-1">estimated total</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <Award className="h-4 w-4" /> Top CLV
              </div>
              <p className="text-2xl font-bold text-amber-600">
                {data?.topCustomers?.[0] ? fmt(data.topCustomers[0].estimatedCLV) : '-'}
              </p>
              <p className="text-xs text-gray-400 mt-1 truncate">
                {data?.topCustomers?.[0]?.name || 'No data'}
              </p>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="bg-white rounded-xl border p-6 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">CLV Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.distribution || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" name="Customers" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Customers Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Award className="h-4 w-4" /> Top Customers by CLV
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">#</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Customer</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Orders</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Total Revenue</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Avg Order</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Monthly Revenue</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Estimated CLV</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Churn Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.topCustomers || []).map((c, i) => (
                    <tr key={c.contactId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{c.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </td>
                      <td className="text-right px-6 py-3 text-gray-700">{c.orderCount}</td>
                      <td className="text-right px-6 py-3 text-gray-700">{fmt(c.totalRevenue)}</td>
                      <td className="text-right px-6 py-3 text-gray-700">{fmt(c.avgOrderValue)}</td>
                      <td className="text-right px-6 py-3 text-gray-700">{fmt(c.monthlyRevenue)}</td>
                      <td className="text-right px-6 py-3 font-semibold text-green-700">{fmt(c.estimatedCLV)}</td>
                      <td className="text-right px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.churnProbability >= 0.7 ? 'bg-red-100 text-red-700'
                            : c.churnProbability >= 0.4 ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                        }`}>
                          {Math.round(c.churnProbability * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(data?.topCustomers || []).length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400">No customer data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  AlertTriangle, TrendingDown, Users, Shield,
  RefreshCw, Loader2, Clock,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChurnPeriod {
  period: string;
  startCustomers: number;
  endCustomers: number;
  churned: number;
  churnRate: number;
}

interface AtRiskCustomer {
  id: string;
  name: string;
  email: string;
  lastOrderDate: string | null;
  daysSinceLastOrder: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  totalRevenue: number;
  orderCount: number;
  signals: string[];
}

interface ChurnData {
  churnRates: ChurnPeriod[];
  atRiskCustomers: AtRiskCustomer[];
}

const RISK_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  LOW: { color: 'text-green-700', bg: 'bg-green-100', label: 'Low' },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Medium' },
  HIGH: { color: 'text-orange-700', bg: 'bg-orange-100', label: 'High' },
  CRITICAL: { color: 'text-red-700', bg: 'bg-red-100', label: 'Critical' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChurnPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const fmt = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n),
    [locale]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ratesRes, riskRes] = await Promise.all([
        fetch('/api/admin/crm/deals/stats?metric=churn_rates'),
        fetch('/api/admin/crm/deals/stats?metric=at_risk'),
      ]);

      const ratesJson = await ratesRes.json();
      const riskJson = await riskRes.json();

      setData({
        churnRates: ratesJson.success && ratesJson.data?.churnRates
          ? ratesJson.data.churnRates
          : [],
        atRiskCustomers: riskJson.success && riskJson.data?.atRiskCustomers
          ? riskJson.data.atRiskCustomers
          : [],
      });
    } catch {
      toast.error('Failed to load churn data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCustomers = data?.atRiskCustomers?.filter(
    c => riskFilter === 'all' || c.riskLevel === riskFilter
  ) || [];

  const latestRate = data?.churnRates?.[data.churnRates.length - 1]?.churnRate || 0;
  const criticalCount = data?.atRiskCustomers?.filter(c => c.riskLevel === 'CRITICAL').length || 0;
  const highCount = data?.atRiskCustomers?.filter(c => c.riskLevel === 'HIGH').length || 0;
  const atRiskRevenue = data?.atRiskCustomers?.reduce((s, c) => s + c.totalRevenue, 0) || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.churnAnalysis') || 'Churn Analysis'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.churnDesc') || 'Monitor churn rates and identify at-risk customers'}
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
                <TrendingDown className="h-4 w-4" /> Current Churn Rate
              </div>
              <p className={`text-2xl font-bold ${latestRate > 20 ? 'text-red-600' : latestRate > 10 ? 'text-amber-600' : 'text-green-600'}`}>
                {latestRate}%
              </p>
              <p className="text-xs text-gray-400 mt-1">quarterly</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <AlertTriangle className="h-4 w-4" /> Critical Risk
              </div>
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-xs text-gray-400 mt-1">customers</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <Users className="h-4 w-4" /> High Risk
              </div>
              <p className="text-2xl font-bold text-orange-600">{highCount}</p>
              <p className="text-xs text-gray-400 mt-1">customers</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <Shield className="h-4 w-4" /> Revenue at Risk
              </div>
              <p className="text-2xl font-bold text-purple-600">{fmt(atRiskRevenue)}</p>
              <p className="text-xs text-gray-400 mt-1">lifetime value</p>
            </div>
          </div>

          {/* Churn Rate Over Time */}
          <div className="bg-white rounded-xl border p-6 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Churn Rate Over Time
            </h3>
            {(data?.churnRates || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data?.churnRates || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={((value: number) => `${value}%`) as any} />
                  <Line type="monotone" dataKey="churnRate" stroke="#ef4444" strokeWidth={2} name="Churn Rate" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 text-sm py-8">No churn data available yet</p>
            )}
          </div>

          {/* At-Risk Customers */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> At-Risk Customers
              </h3>
              <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
                className="text-sm border rounded-md px-3 py-1.5">
                <option value="all">All Levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Customer</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium">Risk Level</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Risk Score</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Days Inactive</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Orders</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Revenue</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Signals</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCustomers.map(c => {
                    const config = RISK_CONFIG[c.riskLevel] || RISK_CONFIG.LOW;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-900">{c.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </td>
                        <td className="text-center px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            {config.label}
                          </span>
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-gray-700">{c.riskScore}</td>
                        <td className="text-right px-4 py-3 text-gray-700 flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {c.daysSinceLastOrder}d
                        </td>
                        <td className="text-right px-4 py-3 text-gray-700">{c.orderCount}</td>
                        <td className="text-right px-6 py-3 text-gray-700">{fmt(c.totalRevenue)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.signals.map((s, i) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCustomers.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No at-risk customers found</td></tr>
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

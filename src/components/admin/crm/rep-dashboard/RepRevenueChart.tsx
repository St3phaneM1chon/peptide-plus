'use client';

import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/i18n/client';
import {
  DollarSign,
  TrendingUp,
  Trophy,
  Loader2,
  BarChart3,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface MonthlyRevenue {
  month: string; // e.g. "2026-01", "Jan", etc.
  revenue: number;
}

interface StatsData {
  totalRevenue?: number;
  avgDealSize?: number;
  dealsWon?: number;
  monthlyRevenue?: MonthlyRevenue[];
}

interface RepRevenueChartProps {
  agentId: string;
  period: string;
}

// ── Component ───────────────────────────────────────────────────

export default function RepRevenueChart({ agentId, period }: RepRevenueChartProps) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/crm/reps/${agentId}/stats?period=${period}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [agentId, period]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale || 'en', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  // Compute chart bars
  const maxRevenue = useMemo(() => {
    if (!data?.monthlyRevenue?.length) return 0;
    return Math.max(...data.monthlyRevenue.map((m) => m.revenue));
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center text-red-500">{error}</div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('admin.crm.revenue.title') || 'Revenue Overview'}
        </h3>
      </div>

      <div className="p-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 mb-2">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-300" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('admin.crm.revenue.totalRevenue') || 'Total Revenue'}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(data?.totalRevenue ?? 0)}
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('admin.crm.revenue.avgDealSize') || 'Avg Deal Size'}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(data?.avgDealSize ?? 0)}
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 mb-2">
              <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('admin.crm.revenue.dealsWon') || 'Deals Won'}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {data?.dealsWon ?? 0}
            </p>
          </div>
        </div>

        {/* Bar chart */}
        {data?.monthlyRevenue && data.monthlyRevenue.length > 0 ? (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {t('admin.crm.revenue.monthlyBreakdown') || 'Monthly Breakdown'}
            </p>
            <div className="flex items-end gap-2 h-40">
              {data.monthlyRevenue.map((m, idx) => {
                const heightPct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatCurrency(m.revenue)}
                    </span>
                    <div className="w-full flex items-end" style={{ height: '120px' }}>
                      <div
                        className="w-full rounded-t bg-blue-500 dark:bg-blue-400 transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-300"
                        style={{ height: `${Math.max(heightPct, 2)}%` }}
                        title={`${m.month}: ${formatCurrency(m.revenue)}`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.crm.revenue.noData') || 'No monthly data available.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

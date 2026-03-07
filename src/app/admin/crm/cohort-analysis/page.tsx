'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Users, TrendingUp, BarChart3, Download,
  Loader2, RefreshCw, Calendar, Filter,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CohortCell {
  period: number;
  value: number;
  count: number;
}

interface CohortRow {
  cohortKey: string;
  cohortSize: number;
  cells: CohortCell[];
}

interface CohortGrid {
  entity: string;
  cohortBy: string;
  metric: string;
  rows: CohortRow[];
  periodLabels: string[];
  summary: {
    totalCohorts: number;
    totalEntities: number;
    avgFirstPeriodValue: number;
    avgLastPeriodValue: number;
  };
}

type CohortMetric = 'retention' | 'revenue' | 'conversion' | 'activity';

const METRIC_OPTIONS: { value: CohortMetric; label: string; description: string }[] = [
  { value: 'retention', label: 'Retention', description: 'Customer retention by signup month' },
  { value: 'revenue', label: 'Revenue', description: 'Revenue per cohort over time' },
  { value: 'conversion', label: 'Conversion', description: 'Lead-to-deal conversion by cohort' },
  { value: 'activity', label: 'Activity', description: 'User activity by signup month' },
];

const MONTHS_OPTIONS = [6, 9, 12, 18, 24];

// ---------------------------------------------------------------------------
// Heatmap color helpers
// ---------------------------------------------------------------------------

function getHeatmapColor(value: number, metric: CohortMetric): string {
  if (metric === 'revenue') {
    // Revenue: green scale
    if (value <= 0) return 'bg-gray-50 text-gray-400';
    if (value < 100) return 'bg-green-50 text-green-700';
    if (value < 500) return 'bg-green-100 text-green-800';
    if (value < 1000) return 'bg-green-200 text-green-900';
    if (value < 5000) return 'bg-green-300 text-green-900';
    return 'bg-green-400 text-white';
  }

  // Percentage-based metrics (retention, conversion, activity)
  if (value <= 0) return 'bg-gray-50 text-gray-400';
  if (value < 10) return 'bg-teal-50 text-teal-600';
  if (value < 25) return 'bg-teal-100 text-teal-700';
  if (value < 40) return 'bg-teal-200 text-blue-800';
  if (value < 55) return 'bg-blue-300 text-blue-900';
  if (value < 70) return 'bg-blue-400 text-white';
  if (value < 85) return 'bg-teal-500 text-white';
  return 'bg-teal-600 text-white';
}

function formatCellValue(value: number, metric: CohortMetric): string {
  if (metric === 'revenue') {
    if (value === 0) return '-';
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${Math.round(value)}`;
  }
  if (value === 0) return '-';
  return `${value}%`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CohortAnalysisPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<CohortGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<CohortMetric>('retention');
  const [months, setMonths] = useState(12);

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', notation: 'compact' }).format(n),
    [locale],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/crm/deals/stats?metric=cohort_${metric}&months=${months}`,
      );
      const json = await res.json();

      if (json.success && json.data) {
        setData(json.data);
      } else {
        // Fallback: generate empty cohort structure
        setData({
          entity: metric === 'conversion' ? 'lead' : 'customer',
          cohortBy: 'created_month',
          metric,
          rows: [],
          periodLabels: Array.from({ length: Math.min(months, 12) }, (_, i) => `Month ${i}`),
          summary: { totalCohorts: 0, totalEntities: 0, avgFirstPeriodValue: 0, avgLastPeriodValue: 0 },
        });
      }
    } catch {
      toast.error('Failed to load cohort data');
    } finally {
      setLoading(false);
    }
  }, [metric, months]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = useCallback(() => {
    if (!data || data.rows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Cohort', 'Size', ...data.periodLabels];
    const rows = data.rows.map((row) => [
      row.cohortKey,
      String(row.cohortSize),
      ...row.cells.map((c) => String(c.value)),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-${metric}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Cohort data exported');
  }, [data, metric]);

  const selectedMetricInfo = METRIC_OPTIONS.find((m) => m.value === metric);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.cohortAnalysis') || 'Cohort Analysis'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {selectedMetricInfo?.description || 'Analyze customer behavior patterns over time'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Metric Selector */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex bg-white border rounded-lg overflow-hidden">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMetric(opt.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  metric === opt.value
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {MONTHS_OPTIONS.map((m) => (
              <option key={m} value={m}>
                Last {m} months
              </option>
            ))}
          </select>
        </div>
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
                <Users className="h-4 w-4" /> Cohorts
              </div>
              <p className="text-2xl font-bold text-teal-600">
                {data?.summary.totalCohorts || 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <BarChart3 className="h-4 w-4" /> Total Entities
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {data?.summary.totalEntities || 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <TrendingUp className="h-4 w-4" /> First Period Avg
              </div>
              <p className="text-2xl font-bold text-green-700">
                {metric === 'revenue'
                  ? fmt(data?.summary.avgFirstPeriodValue || 0)
                  : `${data?.summary.avgFirstPeriodValue || 0}%`}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                <TrendingUp className="h-4 w-4" /> Last Period Avg
              </div>
              <p className="text-2xl font-bold text-amber-600">
                {metric === 'revenue'
                  ? fmt(data?.summary.avgLastPeriodValue || 0)
                  : `${data?.summary.avgLastPeriodValue || 0}%`}
              </p>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {selectedMetricInfo?.label || 'Cohort'} Heatmap
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                      Cohort
                    </th>
                    <th className="text-right px-3 py-3 text-gray-500 font-medium min-w-[60px]">
                      Size
                    </th>
                    {(data?.periodLabels || []).map((label, i) => (
                      <th
                        key={i}
                        className="text-center px-2 py-3 text-gray-500 font-medium min-w-[70px]"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.rows || []).map((row) => (
                    <tr key={row.cohortKey} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white z-10">
                        {row.cohortKey}
                      </td>
                      <td className="text-right px-3 py-2 text-gray-500">
                        {row.cohortSize}
                      </td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="px-1 py-1 text-center">
                          <div
                            className={`rounded px-2 py-1.5 text-xs font-medium ${getHeatmapColor(
                              cell.value,
                              metric,
                            )}`}
                            title={`${row.cohortKey} - ${data?.periodLabels[i]}: ${cell.value}${
                              metric === 'revenue' ? '' : '%'
                            } (${cell.count} entities)`}
                          >
                            {formatCellValue(cell.value, metric)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {(data?.rows || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={(data?.periodLabels.length || 0) + 2}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        No cohort data available. Create some leads, deals, or orders to see analysis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
            <span className="font-medium">Color Scale:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gray-50 border" />
              <span>None</span>
            </div>
            {metric === 'revenue' ? (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-100" />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-300" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-400" />
                  <span>High</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-teal-100" />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-blue-300" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-teal-600" />
                  <span>High</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

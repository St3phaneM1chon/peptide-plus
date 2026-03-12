'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  BarChart3,
  TrendingUp,
  Target,
  Filter,
  Loader2,
  Users,
  DollarSign,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttributionResult {
  source: string;
  leads: number;
  deals: number;
  revenue: number;
  percentage: number;
}

interface AttributionResponse {
  model: string;
  dateRange: { start: string; end: string };
  results: AttributionResult[];
  summary: {
    totalLeads: number;
    totalDeals: number;
    totalRevenue: number;
    topSource: string | null;
  };
}

type AttributionModel = 'first_touch' | 'last_touch' | 'multi_touch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODELS: { value: AttributionModel; label: string }[] = [
  { value: 'first_touch', label: 'First Touch' },
  { value: 'last_touch', label: 'Last Touch' },
  { value: 'multi_touch', label: 'Multi-Touch (Linear)' },
];

const BAR_COLORS = [
  '#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#ede9fe',
  '#6d28d9', '#8b5cf6', '#b794f4', '#e9d5ff', '#f3e8ff',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttributionClient() {
  const { t } = useI18n();
  const defaults = getDefaultDates();

  const [model, setModel] = useState<AttributionModel>('first_touch');
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [data, setData] = useState<AttributionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAttribution = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        model,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate + 'T23:59:59').toISOString(),
      });

      const res = await fetch(`/api/admin/crm/attribution?${params}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        toast.error(json.error?.message || 'Failed to load attribution data');
      }
    } catch {
      toast.error('Failed to load attribution data');
    } finally {
      setLoading(false);
    }
  }, [model, startDate, endDate]);

  useEffect(() => {
    fetchAttribution();
  }, [fetchAttribution]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-purple-600" />
            {t('admin.crm.attribution.title') !== 'admin.crm.attribution.title'
              ? t('admin.crm.attribution.title')
              : 'Attribution Reporting'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.attribution.description') !== 'admin.crm.attribution.description'
              ? t('admin.crm.attribution.description')
              : 'Analyze marketing channel performance and ROI'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Model Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline h-4 w-4 me-1" />
              {t('admin.crm.attribution.model') !== 'admin.crm.attribution.model'
                ? t('admin.crm.attribution.model')
                : 'Attribution Model'}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as AttributionModel)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.startDate') !== 'common.startDate' ? t('common.startDate') : 'Start Date'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
            />
          </div>

          {/* End Date */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.endDate') !== 'common.endDate' ? t('common.endDate') : 'End Date'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Users className="h-4 w-4" />
              {t('admin.crm.attribution.totalLeads') !== 'admin.crm.attribution.totalLeads'
                ? t('admin.crm.attribution.totalLeads')
                : 'Total Leads'}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(data.summary.totalLeads)}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Target className="h-4 w-4" />
              {t('admin.crm.attribution.totalDeals') !== 'admin.crm.attribution.totalDeals'
                ? t('admin.crm.attribution.totalDeals')
                : 'Total Deals'}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(data.summary.totalDeals)}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <DollarSign className="h-4 w-4" />
              {t('admin.crm.attribution.totalRevenue') !== 'admin.crm.attribution.totalRevenue'
                ? t('admin.crm.attribution.totalRevenue')
                : 'Total Revenue'}
            </div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.summary.totalRevenue)}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Award className="h-4 w-4" />
              {t('admin.crm.attribution.topSource') !== 'admin.crm.attribution.topSource'
                ? t('admin.crm.attribution.topSource')
                : 'Top Source'}
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {data.summary.topSource || '-'}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          {t('admin.crm.attribution.revenueBySource') !== 'admin.crm.attribution.revenueBySource'
            ? t('admin.crm.attribution.revenueBySource')
            : 'Revenue by Source'}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : data && data.results.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.results} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="source"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Revenue']}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {data.results.map((_entry, index) => (
                  <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-400">
            No attribution data available for the selected period.
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('admin.crm.attribution.detailedBreakdown') !== 'admin.crm.attribution.detailedBreakdown'
              ? t('admin.crm.attribution.detailedBreakdown')
              : 'Detailed Breakdown'}
          </h2>
          {data && (
            <p className="text-xs text-gray-400 mt-1">
              {formatDate(data.dateRange.start)} - {formatDate(data.dateRange.end)}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.crm.attribution.source') !== 'admin.crm.attribution.source'
                      ? t('admin.crm.attribution.source')
                      : 'Source'}
                  </th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.crm.attribution.leads') !== 'admin.crm.attribution.leads'
                      ? t('admin.crm.attribution.leads')
                      : 'Leads'}
                  </th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.crm.attribution.deals') !== 'admin.crm.attribution.deals'
                      ? t('admin.crm.attribution.deals')
                      : 'Deals'}
                  </th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.crm.attribution.revenue') !== 'admin.crm.attribution.revenue'
                      ? t('admin.crm.attribution.revenue')
                      : 'Revenue'}
                  </th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.crm.attribution.share') !== 'admin.crm.attribution.share'
                      ? t('admin.crm.attribution.share')
                      : '% Share'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data && data.results.length > 0 ? (
                  data.results.map((row, index) => (
                    <tr key={row.source} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-gray-900">{row.source}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-end text-sm text-gray-700">
                        {Math.round(row.leads)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-end text-sm text-gray-700">
                        {Math.round(row.deals)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium text-green-700">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-end">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full"
                              style={{ width: `${Math.min(row.percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-700 w-12 text-end">
                            {row.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                      No data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

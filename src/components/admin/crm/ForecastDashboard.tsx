'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  TrendingUp, DollarSign, BarChart3, Users, Calendar,
  ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ForecastSummary {
  weightedPipeline: number;
  bestCase: number;
  worstCase: number;
  wonThisMonth: number;
  openDealCount: number;
}

interface ForecastMonth {
  month: string;
  totalValue: number;
  weightedValue: number;
  wonValue: number;
  dealCount: number;
}

interface ByPipelineRow {
  pipelineId: string;
  pipelineName: string;
  weighted: number;
  total: number;
  dealCount: number;
}

interface ByAgentRow {
  agentId: string;
  agentName: string;
  agentEmail: string;
  weighted: number;
  total: number;
  dealCount: number;
}

interface HistoricalMonth {
  month: string;
  wonValue: number;
  wonCount: number;
  lostCount: number;
}

interface ForecastData {
  summary: ForecastSummary;
  timeline: ForecastMonth[];
  byPipeline: ByPipelineRow[];
  byAgent: ByAgentRow[];
  historicalTrend: HistoricalMonth[];
}

type DateRange = 'month' | 'quarter' | 'year';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForecastDashboard() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('quarter');
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');

  const fmt = useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CAD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n),
    [locale]
  );

  const fmtFull = useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'CAD',
      }).format(n),
    [locale]
  );

  // Load pipelines once
  useEffect(() => {
    fetch('/api/admin/crm/pipelines')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setPipelines(json.data || []);
          const def = json.data?.find((p: { isDefault: boolean }) => p.isDefault);
          if (def) setSelectedPipeline(def.id);
        }
      })
      .catch(() => {});
  }, []);

  // Reload forecast when filters change
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ range: dateRange });
    if (selectedPipeline) params.set('pipelineId', selectedPipeline);

    fetch(`/api/admin/crm/forecast?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setData(json.data);
        } else {
          toast.error(t('admin.crm.forecast.loadError') || 'Failed to load forecast');
        }
      })
      .catch(() => toast.error(t('admin.crm.forecast.loadError') || 'Failed to load forecast'))
      .finally(() => setLoading(false));
  }, [dateRange, selectedPipeline, t]);

  // Bar chart helper
  const maxTimelineValue = data
    ? Math.max(...data.timeline.map(f => f.totalValue), 1)
    : 1;

  const maxHistoricalValue = data
    ? Math.max(...data.historicalTrend.map(h => h.wonValue), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Section Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-600" />
            {t('admin.crm.forecast.title') || 'Revenue Forecasting'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('admin.crm.forecast.subtitle') || 'Weighted pipeline value and revenue projections'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRange)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="month">{t('admin.crm.forecast.thisMonth') || 'This Month'}</option>
              <option value="quarter">{t('admin.crm.forecast.thisQuarter') || 'This Quarter'}</option>
              <option value="year">{t('admin.crm.forecast.thisYear') || 'This Year'}</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          </div>
          {/* Pipeline filter */}
          {pipelines.length > 0 && (
            <div className="relative">
              <select
                value={selectedPipeline}
                onChange={e => setSelectedPipeline(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">{t('admin.crm.forecast.allPipelines') || 'All Pipelines'}</option>
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : !data ? null : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<TrendingUp className="h-4 w-4" />}
              label={t('admin.crm.forecast.weighted') || 'Weighted Pipeline'}
              value={fmt(data.summary.weightedPipeline)}
              sub={`${data.summary.openDealCount} open deals`}
              colorClass="text-teal-700"
              bgClass="bg-teal-50"
            />
            <SummaryCard
              icon={<BarChart3 className="h-4 w-4" />}
              label={t('admin.crm.forecast.bestCase') || 'Best Case'}
              value={fmt(data.summary.bestCase)}
              sub={t('admin.crm.forecast.allOpenDeals') || 'All open deals at face value'}
              colorClass="text-green-700"
              bgClass="bg-green-50"
            />
            <SummaryCard
              icon={<DollarSign className="h-4 w-4" />}
              label={t('admin.crm.forecast.worstCase') || 'Worst Case'}
              value={fmt(data.summary.worstCase)}
              sub={t('admin.crm.forecast.highProbOnly') || 'Prob > 60%, weighted'}
              colorClass="text-orange-700"
              bgClass="bg-orange-50"
            />
            <SummaryCard
              icon={<Calendar className="h-4 w-4" />}
              label={t('admin.crm.forecast.wonThisMonth') || 'Won This Month'}
              value={fmt(data.summary.wonThisMonth)}
              sub={t('admin.crm.forecast.closedWon') || 'Closed & won'}
              colorClass="text-purple-700"
              bgClass="bg-purple-50"
            />
          </div>

          {/* Monthly Timeline Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-400" />
              {t('admin.crm.forecast.monthlyTimeline') || 'Monthly Revenue Timeline'}
            </h3>

            {data.timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">
                {t('admin.crm.forecast.noData') || 'No forecast data available'}
              </p>
            ) : (
              <>
                {/* Bar chart */}
                <div className="flex items-end gap-1 h-40 mb-3">
                  {data.timeline.map(f => {
                    const totalH = maxTimelineValue > 0 ? (f.totalValue / maxTimelineValue) * 100 : 0;
                    const weightedH = maxTimelineValue > 0 ? (f.weightedValue / maxTimelineValue) * 100 : 0;
                    const wonH = maxTimelineValue > 0 ? (f.wonValue / maxTimelineValue) * 100 : 0;
                    return (
                      <div key={f.month} className="flex-1 flex flex-col items-center group">
                        {/* Tooltip on hover */}
                        <div className="w-full relative flex items-end gap-px h-32">
                          <div
                            className="flex-1 bg-teal-100 rounded-t transition-all"
                            style={{ height: `${totalH}%` }}
                            title={`${t('admin.crm.forecast.total') || 'Total'}: ${fmtFull(f.totalValue)}`}
                          />
                          <div
                            className="flex-1 bg-teal-500 rounded-t transition-all"
                            style={{ height: `${weightedH}%` }}
                            title={`${t('admin.crm.forecast.weighted') || 'Weighted'}: ${fmtFull(f.weightedValue)}`}
                          />
                          <div
                            className="flex-1 bg-green-500 rounded-t transition-all"
                            style={{ height: `${wonH}%` }}
                            title={`${t('admin.crm.forecast.won') || 'Won'}: ${fmtFull(f.wonValue)}`}
                          />
                        </div>
                        <span className="text-xs text-gray-400 mt-1 truncate w-full text-center">{f.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-5 text-xs text-gray-500 mb-5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-teal-100 rounded-sm inline-block" />
                    {t('admin.crm.forecast.total') || 'Total'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-teal-500 rounded-sm inline-block" />
                    {t('admin.crm.forecast.weighted') || 'Weighted'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-green-500 rounded-sm inline-block" />
                    {t('admin.crm.forecast.won') || 'Won'}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2 text-left font-medium">{t('admin.crm.forecast.month') || 'Month'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.deals') || 'Deals'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.total') || 'Total'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.weighted') || 'Weighted'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.won') || 'Won'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.timeline.map(f => (
                        <tr key={f.month} className="hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{f.month}</td>
                          <td className="py-2 text-right text-gray-500">{f.dealCount}</td>
                          <td className="py-2 text-right text-gray-600">{fmt(f.totalValue)}</td>
                          <td className="py-2 text-right text-teal-600 font-medium">{fmt(f.weightedValue)}</td>
                          <td className="py-2 text-right text-green-600 font-medium">{fmt(f.wonValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Bottom row: By Pipeline + By Agent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Pipeline */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-400" />
                {t('admin.crm.forecast.byPipeline') || 'Forecast by Pipeline'}
              </h3>
              {data.byPipeline.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">{t('admin.crm.forecast.noData') || 'No data'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2 text-left font-medium">{t('admin.crm.forecast.pipeline') || 'Pipeline'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.deals') || 'Deals'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.total') || 'Total'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.weighted') || 'Weighted'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.byPipeline.map(row => (
                        <tr key={row.pipelineId} className="hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-800">{row.pipelineName}</td>
                          <td className="py-2 text-right text-gray-500">{row.dealCount}</td>
                          <td className="py-2 text-right text-gray-600">{fmt(row.total)}</td>
                          <td className="py-2 text-right text-teal-600 font-medium">{fmt(row.weighted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* By Agent */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                {t('admin.crm.forecast.byAgent') || 'Forecast by Agent'}
              </h3>
              {data.byAgent.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">{t('admin.crm.forecast.noData') || 'No data'}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-2 text-left font-medium">{t('admin.crm.forecast.agent') || 'Agent'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.deals') || 'Deals'}</th>
                        <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.weighted') || 'Weighted'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.byAgent.map(row => (
                        <tr key={row.agentId} className="hover:bg-gray-50">
                          <td className="py-2">
                            <p className="font-medium text-gray-800">{row.agentName || row.agentEmail}</p>
                            {row.agentName && (
                              <p className="text-xs text-gray-400">{row.agentEmail}</p>
                            )}
                          </td>
                          <td className="py-2 text-right text-gray-500">{row.dealCount}</td>
                          <td className="py-2 text-right text-teal-600 font-medium">{fmt(row.weighted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Historical Won/Lost Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gray-400" />
              {t('admin.crm.forecast.historicalTrend') || 'Historical Won/Lost Trend (last 6 months)'}
            </h3>

            <div className="flex items-end gap-2 h-32 mb-3">
              {data.historicalTrend.map(h => {
                const hPct = maxHistoricalValue > 0 ? (h.wonValue / maxHistoricalValue) * 100 : 0;
                return (
                  <div key={h.month} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center h-24 justify-end">
                      <div
                        className="w-full bg-green-400 rounded-t transition-all"
                        style={{ height: `${hPct}%` }}
                        title={`Won: ${fmtFull(h.wonValue)} · Lost: ${h.lostCount}`}
                      />
                    </div>
                    <span className="text-xs text-gray-400 mt-1">{h.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">{t('admin.crm.forecast.month') || 'Month'}</th>
                    <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.wonRevenue') || 'Won Revenue'}</th>
                    <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.wonDeals') || 'Won Deals'}</th>
                    <th className="pb-2 text-right font-medium">{t('admin.crm.forecast.lostDeals') || 'Lost Deals'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.historicalTrend.map(h => (
                    <tr key={h.month} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800">{h.month}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{fmt(h.wonValue)}</td>
                      <td className="py-2 text-right text-green-700">{h.wonCount}</td>
                      <td className="py-2 text-right text-red-500">{h.lostCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  sub,
  colorClass,
  bgClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 p-5 ${bgClass}`}>
      <div className={`flex items-center gap-2 text-sm mb-2 ${colorClass} opacity-80`}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

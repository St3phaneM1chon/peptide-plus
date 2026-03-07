'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Target, Clock, PieChart,
  Calendar,
} from 'lucide-react';
import ForecastDashboard from '@/components/admin/crm/ForecastDashboard';

interface PipelineStats {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  winRate: number;
  avgCycleTime: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
  dealsByStage: Array<{
    stageId: string;
    stageName: string;
    count: number;
    totalValue: number;
  }>;
}

type ActiveTab = 'pipeline' | 'forecast';

export default function AnalyticsPage() {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('pipeline');

  const fmt = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', notation: 'compact' }).format(n),
    [locale]
  );

  const fmtFull = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n),
    [locale]
  );

  useEffect(() => {
    fetch('/api/admin/crm/pipelines').then(r => r.json()).then(json => {
      if (json.success) {
        setPipelines(json.data || []);
        const def = json.data?.find((p: { isDefault: boolean }) => p.isDefault);
        if (def) setSelectedPipeline(def.id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPipeline || activeTab !== 'pipeline') return;
    setLoading(true);

    fetch(`/api/admin/crm/deals/stats?pipelineId=${selectedPipeline}`)
      .then(r => r.json())
      .then(statsJson => {
        if (statsJson.success) setStats(statsJson.data);
      })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [selectedPipeline, activeTab]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.analytics') || 'Pipeline Analytics'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.analyticsDesc') || 'Performance metrics and forecasting'}
          </p>
        </div>
        {activeTab === 'pipeline' && (
          <select
            value={selectedPipeline}
            onChange={e => setSelectedPipeline(e.target.value)}
            className="text-sm border rounded-md px-3 py-2"
          >
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            {t('admin.crm.pipelineAnalytics') || 'Pipeline Analytics'}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'forecast'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('admin.crm.revenueForecast') || 'Revenue Forecast'}
          </span>
        </button>
      </div>

      {/* Tab: Pipeline Analytics */}
      {activeTab === 'pipeline' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <DollarSign className="h-4 w-4" /> Pipeline Value
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{fmt(stats?.totalValue || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">{stats?.totalDeals || 0} deals</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <TrendingUp className="h-4 w-4" /> Weighted Value
                  </div>
                  <p className="text-2xl font-bold text-green-700">{fmt(stats?.weightedValue || 0)}</p>
                  <p className="text-xs text-gray-400 mt-1">probability-adjusted</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <Target className="h-4 w-4" /> Win Rate
                  </div>
                  <p className="text-2xl font-bold text-teal-600">{Math.round((stats?.winRate || 0) * 100)}%</p>
                  <p className="text-xs text-gray-400 mt-1">{stats?.wonCount || 0} won / {stats?.lostCount || 0} lost</p>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <Clock className="h-4 w-4" /> Avg Cycle
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{Math.round(stats?.avgCycleTime || 0)}d</p>
                  <p className="text-xs text-gray-400 mt-1">days to close</p>
                </div>
              </div>

              {/* Pipeline Funnel */}
              <div className="bg-white rounded-xl border p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <PieChart className="h-4 w-4" /> Pipeline Funnel
                </h3>
                <div className="space-y-3">
                  {stats?.dealsByStage?.map((stage) => {
                    const maxCount = Math.max(...(stats?.dealsByStage?.map(s => s.count) || [1]));
                    const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                    return (
                      <div key={stage.stageId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700">{stage.stageName}</span>
                          <span className="text-gray-500">{stage.count} deals · {fmtFull(stage.totalValue)}</span>
                        </div>
                        <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legacy simple forecast widget in pipeline tab */}
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Quick Forecast Preview
                </h3>
                <p className="text-sm text-gray-500">
                  Switch to the{' '}
                  <button
                    onClick={() => setActiveTab('forecast')}
                    className="text-teal-600 underline hover:text-teal-800"
                  >
                    Revenue Forecast tab
                  </button>
                  {' '}for the full forecasting dashboard with timeline, agent and pipeline breakdowns.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Tab: Revenue Forecast */}
      {activeTab === 'forecast' && (
        <ForecastDashboard />
      )}
    </div>
  );
}

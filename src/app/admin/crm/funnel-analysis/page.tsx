'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Filter, TrendingDown, ArrowRight, Calendar, Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
}

interface StageData {
  stageId: string;
  stageName: string;
  count: number;
  totalValue: number;
  position: number;
}

interface FunnelStage extends StageData {
  conversionRate: number;
  dropOff: number;
  dropOffRate: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUNNEL_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
];

function buildFunnel(stages: StageData[]): FunnelStage[] {
  if (stages.length === 0) return [];
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const initial = sorted[0].count || 1;

  return sorted.map((s, i) => {
    const prev = i === 0 ? initial : sorted[i - 1].count;
    const conversionRate = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
    const dropOff = i === 0 ? 0 : prev - s.count;
    const dropOffRate = prev > 0 ? Math.round((dropOff / prev) * 100) : 0;
    return {
      ...s,
      conversionRate: i === 0 ? 100 : conversionRate,
      dropOff,
      dropOffRate,
      color: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
    };
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FunnelAnalysisPage() {
  const { t, locale } = useI18n();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fmt = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', notation: 'compact' }).format(n),
    [locale]
  );

  // Fetch pipelines
  useEffect(() => {
    fetch('/api/admin/crm/pipelines')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setPipelines(json.data || []);
          const def = json.data?.find((p: Pipeline) => p.isDefault);
          if (def) setSelectedPipeline(def.id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch funnel data
  useEffect(() => {
    if (!selectedPipeline) return;
    setLoading(true);

    let url = `/api/admin/crm/deals/stats?pipelineId=${selectedPipeline}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;

    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.dealsByStage) {
          setStages(buildFunnel(json.data.dealsByStage));
        }
      })
      .catch(() => toast.error('Failed to load funnel data'))
      .finally(() => setLoading(false));
  }, [selectedPipeline, dateFrom, dateTo]);

  const totalInitial = stages.length > 0 ? stages[0].count : 0;
  const totalFinal = stages.length > 0 ? stages[stages.length - 1].count : 0;
  const overallConversion = totalInitial > 0 ? Math.round((totalFinal / totalInitial) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.funnelAnalysis') || 'Funnel Analysis'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.funnelAnalysisDesc') || 'Stage-by-stage conversion rates and drop-off analysis'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={selectedPipeline} onChange={e => setSelectedPipeline(e.target.value)}
            className="text-sm border rounded-md px-3 py-2">
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-sm border rounded-md px-3 py-2" placeholder="From" />
          <span className="text-gray-400">-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-sm border rounded-md px-3 py-2" placeholder="To" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* Overall stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Entered Pipeline</p>
              <p className="text-3xl font-bold text-teal-600">{totalInitial}</p>
            </div>
            <div className="bg-white rounded-xl border p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Reached Final Stage</p>
              <p className="text-3xl font-bold text-green-600">{totalFinal}</p>
            </div>
            <div className="bg-white rounded-xl border p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Overall Conversion</p>
              <p className="text-3xl font-bold text-purple-600">{overallConversion}%</p>
            </div>
          </div>

          {/* Visual Funnel */}
          <div className="bg-white rounded-xl border p-6 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-6">Pipeline Funnel</h3>
            <div className="space-y-1">
              {stages.map((stage, i) => {
                const widthPct = totalInitial > 0 ? Math.max(8, (stage.count / totalInitial) * 100) : 100;
                return (
                  <div key={stage.stageId} className="flex items-center gap-4">
                    <div className="w-32 text-right text-sm text-gray-600 shrink-0 truncate">
                      {stage.stageName}
                    </div>
                    <div className="flex-1">
                      <div
                        className="h-10 rounded-lg flex items-center px-4 text-white text-sm font-medium transition-all mx-auto"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: stage.color,
                          clipPath: i < stages.length - 1
                            ? 'polygon(0 0, 100% 5%, 100% 95%, 0 100%)'
                            : 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
                        }}
                      >
                        {stage.count} deals
                      </div>
                    </div>
                    <div className="w-20 text-sm text-right shrink-0">
                      <span className={i === 0 ? 'text-teal-600 font-medium' : 'text-gray-600'}>
                        {stage.conversionRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drop-off Analysis */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" /> Drop-off Analysis
            </h3>
            <div className="space-y-3">
              {stages.slice(1).map((stage, i) => (
                <div key={stage.stageId} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-500 shrink-0 truncate">{stages[i].stageName}</div>
                  <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
                  <div className="w-28 text-sm text-gray-500 shrink-0 truncate">{stage.stageName}</div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400 transition-all"
                        style={{ width: `${stage.dropOffRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm shrink-0">
                    <span className="text-red-500 font-medium">{stage.dropOff}</span>
                    <span className="text-gray-400 ml-1">({stage.dropOffRate}%)</span>
                  </div>
                  <div className="w-20 text-right text-sm text-gray-400 shrink-0">
                    {fmt(stage.totalValue)}
                  </div>
                </div>
              ))}
              {stages.length <= 1 && (
                <p className="text-center text-gray-400 text-sm py-4">
                  Not enough stages for drop-off analysis
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

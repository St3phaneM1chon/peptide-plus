'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Route, Search, Filter, RefreshCcw,
  ArrowRight, Clock, Phone, Mail,
  Calendar, FileText, CheckCircle2,
  TrendingUp, TrendingDown, BarChart3, Activity,
  GitBranch, Zap, Target, Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JourneyEvent {
  id: string;
  type: 'stage_change' | 'activity' | 'task' | 'note' | 'email' | 'call' | 'meeting';
  title: string;
  description: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface StageTimeline {
  stageName: string;
  enteredAt: string;
  exitedAt: string | null;
  durationHours: number;
}

interface DealJourney {
  dealId: string;
  dealTitle: string;
  dealValue: number;
  currency: string;
  currentStage: string;
  isWon: boolean;
  isLost: boolean;
  createdAt: string;
  closedAt: string | null;
  totalDurationDays: number;
  events: JourneyEvent[];
  stageTimeline: StageTimeline[];
  touchpointCount: number;
}

interface StageMetric {
  stageName: string;
  avgDurationHours: number;
  medianDurationHours: number;
  dropOffRate: number;
  conversionRate: number;
}

interface JourneyAnalytics {
  avgDaysToClose: number;
  avgTouchpoints: number;
  avgStageChanges: number;
  stageMetrics: StageMetric[];
  commonPaths: { path: string[]; count: number; percentage: number; avgDays: number }[];
  dropOffPoints: { stageName: string; count: number; topReasons: string[] }[];
}

interface PatternInfo {
  pattern: string;
  frequency: number;
  avgValue: number;
  examples: string[];
}

interface WinLossPattern {
  type: 'winning' | 'losing';
  patterns: PatternInfo[];
  avgTouchpoints: number;
  avgDaysToClose: number;
  topActivities: { type: string; avgCount: number }[];
  commonStageSequences: { sequence: string[]; count: number }[];
}

interface DealSearchResult {
  id: string;
  title: string;
  value: number;
  stageName: string;
  isWon: boolean;
  isLost: boolean;
}

interface PipelineOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const EVENT_ICONS: Record<string, typeof Phone> = {
  stage_change: ArrowRight,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckCircle2,
  note: FileText,
  activity: Activity,
};

const EVENT_COLORS: Record<string, string> = {
  stage_change: 'bg-teal-100 text-teal-600 border-teal-200',
  call: 'bg-green-100 text-green-600 border-green-200',
  email: 'bg-purple-100 text-purple-600 border-purple-200',
  meeting: 'bg-orange-100 text-orange-600 border-orange-200',
  task: 'bg-yellow-100 text-yellow-600 border-yellow-200',
  note: 'bg-gray-100 text-gray-600 border-gray-200',
  activity: 'bg-indigo-100 text-indigo-600 border-indigo-200',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type TabType = 'journey' | 'analytics' | 'patterns';
type EventFilter = 'all' | 'stage_change' | 'call' | 'email' | 'meeting' | 'task' | 'note';

export default function DealJourneyPage() {
  const { t } = useI18n();

  // State: search & selection
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [, setSelectedDealId] = useState<string | null>(null);

  // State: journey data
  const [journey, setJourney] = useState<DealJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);

  // State: analytics
  const [activeTab, setActiveTab] = useState<TabType>('journey');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [analytics, setAnalytics] = useState<JourneyAnalytics | null>(null);
  const [winPatterns, setWinPatterns] = useState<WinLossPattern | null>(null);
  const [losePatterns, setLosePatterns] = useState<WinLossPattern | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  // Fetch pipelines on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/crm/pipelines');
        const json = await res.json();
        if (json.success || json.data) {
          const pips = (json.data || []).map((p: { id: string; name: string }) => ({
            id: p.id, name: p.name,
          }));
          setPipelines(pips);
          if (pips.length > 0) setSelectedPipelineId(pips[0].id);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Search deals
  const searchDeals = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/crm/deals?search=${encodeURIComponent(searchQuery)}&limit=10`);
      const json = await res.json();
      if (json.success || json.data) {
        setSearchResults(
          (json.data || []).map((d: Record<string, unknown>) => ({
            id: d.id,
            title: d.title,
            value: Number(d.value || 0),
            stageName: (d.stage as Record<string, unknown>)?.name || 'Unknown',
            isWon: (d.stage as Record<string, unknown>)?.isWon === true,
            isLost: (d.stage as Record<string, unknown>)?.isLost === true,
          })),
        );
      }
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery.length >= 2) searchDeals(); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDeals]);

  // Load journey for selected deal
  const loadJourney = useCallback(async (dealId: string) => {
    setLoadingJourney(true);
    setSelectedDealId(dealId);
    setSearchResults([]);
    setSearchQuery('');
    try {
      const res = await fetch(`/api/admin/crm/deals/${dealId}/journey`);
      const json = await res.json();
      if (json.success && json.data) {
        setJourney(json.data);
      } else {
        toast.error(json.error?.message || 'Failed to load deal journey');
      }
    } catch { toast.error('Network error loading journey'); }
    finally { setLoadingJourney(false); }
  }, []);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    if (!selectedPipelineId) return;
    setLoadingAnalytics(true);
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        pipelineId: selectedPipelineId,
        start: sixMonthsAgo.toISOString(),
        end: now.toISOString(),
      });

      const [analyticsRes, winRes, loseRes] = await Promise.all([
        fetch(`/api/admin/crm/deal-journey/analytics?${params}`),
        fetch(`/api/admin/crm/deal-journey/patterns?${params}&type=winning`),
        fetch(`/api/admin/crm/deal-journey/patterns?${params}&type=losing`),
      ]);

      const [analyticsJson, winJson, loseJson] = await Promise.all([
        analyticsRes.json(),
        winRes.json(),
        loseRes.json(),
      ]);

      if (analyticsJson.success) setAnalytics(analyticsJson.data);
      if (winJson.success) setWinPatterns(winJson.data);
      if (loseJson.success) setLosePatterns(loseJson.data);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoadingAnalytics(false); }
  }, [selectedPipelineId]);

  useEffect(() => {
    if (activeTab === 'analytics' || activeTab === 'patterns') {
      loadAnalytics();
    }
  }, [activeTab, selectedPipelineId, loadAnalytics]);

  // Filter events
  const filteredEvents = journey?.events.filter(
    (e) => eventFilter === 'all' || e.type === eventFilter,
  ) || [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Route className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('admin.crm.dealJourney') || 'Deal Journey Analytics'}
            </h1>
            <p className="text-sm text-gray-500">
              {t('admin.crm.dealJourneyDesc') || 'Visualize the complete journey of deals from creation to close'}
            </p>
          </div>
        </div>
      </div>

      {/* Deal Search */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('admin.crm.searchDeal') || 'Search deals by name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {searchResults.map((deal) => (
              <button
                key={deal.id}
                onClick={() => loadJourney(deal.id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between border-b last:border-0"
              >
                <div>
                  <span className="font-medium text-gray-900">{deal.title}</span>
                  <span className="ml-2 text-sm text-gray-500">{formatCurrency(deal.value)}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  deal.isWon ? 'bg-green-100 text-green-700' :
                  deal.isLost ? 'bg-red-100 text-red-700' :
                  'bg-teal-100 text-teal-700'
                }`}>
                  {deal.stageName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(['journey', 'analytics', 'patterns'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'journey' && <GitBranch className="inline h-4 w-4 mr-1.5" />}
            {tab === 'analytics' && <BarChart3 className="inline h-4 w-4 mr-1.5" />}
            {tab === 'patterns' && <Target className="inline h-4 w-4 mr-1.5" />}
            {tab === 'journey' ? (t('admin.crm.timeline') || 'Timeline') :
             tab === 'analytics' ? (t('admin.crm.analytics') || 'Analytics') :
             (t('admin.crm.patterns') || 'Patterns')}
          </button>
        ))}
      </div>

      {/* Tab: Journey Timeline */}
      {activeTab === 'journey' && (
        <>
          {loadingJourney ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : !journey ? (
            <div className="text-center py-20 text-gray-400">
              <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg">{t('admin.crm.selectDeal') || 'Search and select a deal to view its journey'}</p>
            </div>
          ) : (
            <>
              {/* Deal Summary Card */}
              <div className="bg-white rounded-xl border p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{journey.dealTitle}</h2>
                    <p className="text-gray-500 text-sm mt-1">
                      {t('common.createdAt') || 'Created'}: {formatDate(journey.createdAt)}
                      {journey.closedAt && <> | {t('common.closedAt') || 'Closed'}: {formatDate(journey.closedAt)}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(journey.dealValue)}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      journey.isWon ? 'bg-green-100 text-green-700' :
                      journey.isLost ? 'bg-red-100 text-red-700' :
                      'bg-teal-100 text-teal-700'
                    }`}>
                      {journey.isWon ? 'Won' : journey.isLost ? 'Lost' : journey.currentStage}
                    </span>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{journey.totalDurationDays}</p>
                    <p className="text-xs text-gray-500">{t('common.days') || 'Days'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{journey.touchpointCount}</p>
                    <p className="text-xs text-gray-500">{t('admin.crm.touchpoints') || 'Touchpoints'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{journey.stageTimeline.length}</p>
                    <p className="text-xs text-gray-500">{t('admin.crm.stages') || 'Stages'}</p>
                  </div>
                </div>
              </div>

              {/* Stage Progress Bar */}
              {journey.stageTimeline.length > 0 && (
                <div className="bg-white rounded-xl border p-5 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {t('admin.crm.stageProgression') || 'Stage Progression'}
                  </h3>
                  <div className="flex gap-1">
                    {journey.stageTimeline.map((stage, idx) => (
                      <div key={idx} className="flex-1 group relative">
                        <div className={`h-8 rounded flex items-center justify-center text-xs font-medium ${
                          idx === journey.stageTimeline.length - 1
                            ? journey.isWon ? 'bg-green-500 text-white' :
                              journey.isLost ? 'bg-red-500 text-white' :
                              'bg-indigo-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {stage.stageName}
                        </div>
                        <p className="text-xs text-gray-400 text-center mt-1">
                          {formatDuration(stage.durationHours)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Event Filter */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Filter className="h-4 w-4 text-gray-400" />
                {(['all', 'stage_change', 'call', 'email', 'meeting', 'task', 'note'] as EventFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setEventFilter(f)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      eventFilter === f
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Events Timeline */}
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200" />
                {filteredEvents.map((event) => {
                  const IconComp = EVENT_ICONS[event.type] || Activity;
                  const colorClass = EVENT_COLORS[event.type] || EVENT_COLORS.activity;
                  return (
                    <div key={event.id} className="relative flex items-start gap-4 mb-4 ml-1">
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border ${colorClass}`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div className="flex-1 bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>
                          <span className="text-xs text-gray-400">{formatDate(event.timestamp)}</span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredEvents.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('admin.crm.noEvents') || 'No events matching filter'}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Tab: Analytics */}
      {activeTab === 'analytics' && (
        <>
          {/* Pipeline Selector */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">
              {t('admin.crm.pipeline') || 'Pipeline'}:
            </label>
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button onClick={loadAnalytics} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
              <RefreshCcw className="h-4 w-4" /> {t('common.refresh') || 'Refresh'}
            </button>
          </div>

          {loadingAnalytics ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : !analytics ? (
            <div className="text-center py-20 text-gray-400">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t('admin.crm.noAnalytics') || 'No analytics data available'}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {t('admin.crm.avgDaysToClose') || 'Avg Days to Close'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.avgDaysToClose}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {t('admin.crm.avgTouchpoints') || 'Avg Touchpoints'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.avgTouchpoints}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {t('admin.crm.avgStageChanges') || 'Avg Stage Changes'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analytics.avgStageChanges}</p>
                </div>
              </div>

              {/* Stage Metrics Table */}
              <div className="bg-white rounded-xl border mb-6">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-gray-900">{t('admin.crm.stageMetrics') || 'Stage Metrics'}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Stage</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Avg Duration</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Median Duration</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Conversion %</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Drop-off %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.stageMetrics.map((sm) => (
                        <tr key={sm.stageName} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{sm.stageName}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatDuration(sm.avgDurationHours)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatDuration(sm.medianDurationHours)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-green-600 font-medium">{sm.conversionRate}%</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${sm.dropOffRate > 20 ? 'text-red-600' : 'text-gray-600'}`}>
                              {sm.dropOffRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Common Paths */}
              {analytics.commonPaths.length > 0 && (
                <div className="bg-white rounded-xl border mb-6">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-900">{t('admin.crm.commonPaths') || 'Common Deal Paths'}</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {analytics.commonPaths.slice(0, 5).map((cp, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-1 flex-wrap">
                          {cp.path.map((stage, sIdx) => (
                            <span key={sIdx} className="flex items-center">
                              <span className="text-sm px-2 py-0.5 bg-gray-100 rounded">{stage}</span>
                              {sIdx < cp.path.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400 mx-1" />}
                            </span>
                          ))}
                        </div>
                        <div className="text-right whitespace-nowrap ml-4">
                          <span className="text-sm font-medium text-gray-900">{cp.count} deals</span>
                          <span className="text-xs text-gray-400 ml-2">({cp.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Tab: Patterns */}
      {activeTab === 'patterns' && (
        <>
          {/* Pipeline Selector */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">
              {t('admin.crm.pipeline') || 'Pipeline'}:
            </label>
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {loadingAnalytics ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Winning Patterns */}
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-gray-900">{t('admin.crm.winningPatterns') || 'Winning Patterns'}</h3>
                </div>
                {!winPatterns ? (
                  <div className="p-8 text-center text-gray-400">No data</div>
                ) : (
                  <div className="p-4">
                    <div className="flex gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">{t('admin.crm.avgDays') || 'Avg days'}:</span>{' '}
                        <span className="font-bold">{winPatterns.avgDaysToClose}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t('admin.crm.avgTouchpoints') || 'Touchpoints'}:</span>{' '}
                        <span className="font-bold">{winPatterns.avgTouchpoints}</span>
                      </div>
                    </div>

                    {winPatterns.patterns.map((p, idx) => (
                      <div key={idx} className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-sm font-medium text-green-800">{p.pattern}</p>
                        <p className="text-xs text-green-600 mt-1">
                          {p.frequency}% of won deals | Avg value: {formatCurrency(p.avgValue)}
                        </p>
                      </div>
                    ))}

                    {winPatterns.topActivities.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          {t('admin.crm.topActivities') || 'Top Activities'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {winPatterns.topActivities.map((a) => (
                            <span key={a.type} className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {a.type}: {a.avgCount}/deal
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Losing Patterns */}
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-gray-900">{t('admin.crm.losingPatterns') || 'Losing Patterns'}</h3>
                </div>
                {!losePatterns ? (
                  <div className="p-8 text-center text-gray-400">No data</div>
                ) : (
                  <div className="p-4">
                    <div className="flex gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">{t('admin.crm.avgDays') || 'Avg days'}:</span>{' '}
                        <span className="font-bold">{losePatterns.avgDaysToClose}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">{t('admin.crm.avgTouchpoints') || 'Touchpoints'}:</span>{' '}
                        <span className="font-bold">{losePatterns.avgTouchpoints}</span>
                      </div>
                    </div>

                    {losePatterns.patterns.map((p, idx) => (
                      <div key={idx} className="mb-3 p-3 bg-red-50 rounded-lg border border-red-100">
                        <p className="text-sm font-medium text-red-800">{p.pattern}</p>
                        <p className="text-xs text-red-600 mt-1">
                          {p.frequency}% of lost deals | Avg value: {formatCurrency(p.avgValue)}
                        </p>
                      </div>
                    ))}

                    {losePatterns.topActivities.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          {t('admin.crm.topActivities') || 'Top Activities'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {losePatterns.topActivities.map((a) => (
                            <span key={a.type} className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {a.type}: {a.avgCount}/deal
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

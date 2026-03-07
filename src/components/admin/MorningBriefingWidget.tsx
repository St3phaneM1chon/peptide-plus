'use client';

/**
 * Morning Briefing Widget
 * "What should I do next?" AI-powered daily briefing on admin dashboard.
 * Shows prioritized tasks, yesterday recap, and quick wins.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Sunrise,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  Zap,
} from 'lucide-react';

interface BriefingData {
  content: string;
  metadata?: {
    pendingOrders?: number;
    overdueDeals?: number;
    uncontactedLeads?: number;
    overdueTasks?: number;
    lowStock?: number;
  };
}

export default function MorningBriefingWidget() {
  const { t, locale } = useI18n();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const fetchBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'morning_briefing',
          context: {},
          locale,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load briefing');
      }
      const { data } = await response.json();
      setBriefing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50/60 to-white dark:from-amber-950/30 dark:to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
              <Sunrise className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('admin.dashboard.morningBriefing') || 'What should I do next?'}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {t('admin.dashboard.morningBriefingDesc') || 'AI-powered daily priorities'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!briefing && !loading && (
              <button
                onClick={fetchBriefing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Zap className="w-3 h-3" />
                {t('admin.dashboard.getBriefing') || 'Get Briefing'}
              </button>
            )}
            {briefing && (
              <button
                onClick={fetchBriefing}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors disabled:opacity-40"
                title={t('common.refresh') || 'Refresh'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            {briefing && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-5">
          {loading && !briefing && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('admin.copilot.thinking') || 'Preparing your briefing...'}
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!briefing && !loading && !error && (
            <div className="text-center py-4">
              <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {t('admin.dashboard.briefingPrompt') || 'Click "Get Briefing" to see your AI-powered daily priorities'}
              </p>
            </div>
          )}

          {briefing && (
            <div className="space-y-3">
              {/* Priority badges */}
              {briefing.metadata && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(briefing.metadata.pendingOrders ?? 0) > 0 && (
                    <PriorityBadge
                      label={t('admin.dashboard.pendingOrders') || 'Pending Orders'}
                      count={briefing.metadata.pendingOrders!}
                      color="amber"
                    />
                  )}
                  {(briefing.metadata.overdueDeals ?? 0) > 0 && (
                    <PriorityBadge
                      label={t('admin.dashboard.overdueDeals') || 'Overdue Deals'}
                      count={briefing.metadata.overdueDeals!}
                      color="red"
                    />
                  )}
                  {(briefing.metadata.uncontactedLeads ?? 0) > 0 && (
                    <PriorityBadge
                      label={t('admin.dashboard.uncontactedLeads') || 'New Leads'}
                      count={briefing.metadata.uncontactedLeads!}
                      color="teal"
                    />
                  )}
                  {(briefing.metadata.overdueTasks ?? 0) > 0 && (
                    <PriorityBadge
                      label={t('admin.dashboard.overdueTasks') || 'Overdue Tasks'}
                      count={briefing.metadata.overdueTasks!}
                      color="orange"
                    />
                  )}
                  {(briefing.metadata.lowStock ?? 0) > 0 && (
                    <PriorityBadge
                      label={t('admin.dashboard.stockAlerts') || 'Low Stock'}
                      count={briefing.metadata.lowStock!}
                      color="red"
                    />
                  )}
                </div>
              )}

              {/* AI content */}
              <div className="text-sm text-slate-700 leading-relaxed space-y-1.5">
                {briefing.content.split('\n').map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  if (/^[🎯⚡⚠️📊🌅☀️✅❌💡🔴🟡🟢]/.test(trimmed)) {
                    const emoji = trimmed.slice(0, 2);
                    const isUrgent = emoji === '🎯' || emoji === '⚠️' || emoji === '🔴';
                    return (
                      <div key={i} className={`flex gap-2 p-2.5 rounded-lg border ${
                        isUrgent ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
                      }`}>
                        <span className="flex-shrink-0 text-base leading-5">{emoji}</span>
                        <p className="text-slate-700">{formatBold(trimmed.slice(2).trim())}</p>
                      </div>
                    );
                  }

                  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    return <p key={i} className="font-semibold text-slate-900 mt-3 mb-1">{trimmed.slice(2, -2)}</p>;
                  }

                  if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                    return (
                      <div key={i} className="flex gap-1.5 ms-1">
                        <span className="text-slate-400 mt-0.5">•</span>
                        <span>{formatBold(trimmed.slice(2))}</span>
                      </div>
                    );
                  }

                  return <p key={i}>{formatBold(trimmed)}</p>;
                })}
              </div>

              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('admin.copilot.refreshing') || 'Refreshing...'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PriorityBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    teal: 'bg-teal-100 text-teal-800 border-teal-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${colors[color] || colors.amber}`}>
      <span className="font-bold">{count}</span>
      {label}
    </span>
  );
}

function formatBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

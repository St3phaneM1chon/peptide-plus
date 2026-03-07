'use client';

/**
 * AI Insights Widget for Admin Dashboard
 * Shows AI-generated business insights, anomaly detection, and trend analysis.
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

interface InsightsData {
  content: string;
  metadata?: {
    ordersToday?: number;
    revenueThisMonth?: number;
    lowStockCount?: number;
    pendingOrders?: number;
  };
}

export default function AIInsightsWidget() {
  const { t, locale } = useI18n();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ai/insights?locale=${locale}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to load insights');
      }
      const { data } = await response.json();
      setInsights(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading insights');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  // Auto-load on mount
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-teal-50/60 to-white dark:from-teal-950/30 dark:to-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('admin.dashboard.aiInsights') || 'AI Insights'}
              </h2>
              {lastUpdated && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {t('admin.dashboard.lastUpdated') || 'Updated'}{' '}
                  {lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchInsights}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors disabled:opacity-40"
              title={t('common.refresh') || 'Refresh'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-5">
          {loading && !insights && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('admin.copilot.thinking') || 'Analyzing your data...'}
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {insights && (
            <div className="space-y-3">
              {/* KPI mini-bar */}
              {insights.metadata && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {insights.metadata.ordersToday !== undefined && (
                    <MiniKPI
                      label={t('admin.dashboard.ordersToday') || 'Orders Today'}
                      value={insights.metadata.ordersToday.toString()}
                    />
                  )}
                  {insights.metadata.revenueThisMonth !== undefined && (
                    <MiniKPI
                      label={t('admin.dashboard.monthlyRevenue') || 'Revenue (month)'}
                      value={`$${Math.round(insights.metadata.revenueThisMonth).toLocaleString()}`}
                    />
                  )}
                  {insights.metadata.pendingOrders !== undefined && (
                    <MiniKPI
                      label={t('admin.dashboard.pendingOrders') || 'Pending'}
                      value={insights.metadata.pendingOrders.toString()}
                      alert={insights.metadata.pendingOrders > 5}
                    />
                  )}
                  {insights.metadata.lowStockCount !== undefined && (
                    <MiniKPI
                      label={t('admin.dashboard.stockAlerts') || 'Low Stock'}
                      value={insights.metadata.lowStockCount.toString()}
                      alert={insights.metadata.lowStockCount > 0}
                    />
                  )}
                </div>
              )}

              {/* AI-generated text */}
              <div className="text-sm text-slate-700 leading-relaxed space-y-1.5">
                {insights.content.split('\n').map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;

                  // Emoji-prefixed insight lines
                  if (/^[📈📉⚠️💡🔍✅❌🎯]/.test(trimmed)) {
                    return (
                      <div key={i} className="flex gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="flex-shrink-0 text-base leading-5">{trimmed.slice(0, 2)}</span>
                        <p className="text-slate-700">{formatBold(trimmed.slice(2).trim())}</p>
                      </div>
                    );
                  }

                  // Bold headers
                  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    return <p key={i} className="font-semibold text-slate-900 mt-2">{trimmed.slice(2, -2)}</p>;
                  }

                  // Bullet points
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

// ---------------------------------------------------------------------------
// Mini KPI
// ---------------------------------------------------------------------------

function MiniKPI({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`px-3 py-2 rounded-lg border ${alert ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
      <p className="text-[10px] text-slate-500 truncate">{label}</p>
      <p className={`text-sm font-bold ${alert ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format bold text
// ---------------------------------------------------------------------------

function formatBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

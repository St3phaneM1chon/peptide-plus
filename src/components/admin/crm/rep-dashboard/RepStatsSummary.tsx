'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import {
  PhoneCall,
  CalendarCheck,
  ShoppingCart,
  DollarSign,
  Percent,
  Zap,
  Clock,
  RefreshCw,
  TrendingUp,
  Timer,
  Headphones,
  Loader2,
  BarChart3,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface StatsData {
  callToAppointmentRatio?: number;
  callToSaleRatio?: number;
  avgDollarPerSale?: number;
  winRate?: number;
  pipelineVelocity?: number;
  avgTimeToClose?: number; // days
  retentionRate?: number;
  mrr?: number;
  totalCalls?: number;
  totalTalkTime?: number; // seconds
  avgHandleTime?: number; // seconds
}

interface RepStatsSummaryProps {
  agentId: string;
  period: string;
}

// ── Stat row config ─────────────────────────────────────────────

interface StatRowConfig {
  key: keyof StatsData;
  labelKey: string;
  fallbackLabel: string;
  icon: typeof PhoneCall;
  iconColor: string;
  format: 'percent' | 'currency' | 'number' | 'hours' | 'minutes' | 'days';
}

const STATS: StatRowConfig[] = [
  { key: 'callToAppointmentRatio', labelKey: 'admin.crm.stats.callToAppointment', fallbackLabel: 'Call to Appointment', icon: CalendarCheck, iconColor: 'text-blue-500', format: 'percent' },
  { key: 'callToSaleRatio', labelKey: 'admin.crm.stats.callToSale', fallbackLabel: 'Call to Sale', icon: ShoppingCart, iconColor: 'text-green-500', format: 'percent' },
  { key: 'avgDollarPerSale', labelKey: 'admin.crm.stats.avgPerSale', fallbackLabel: 'Avg $/Sale', icon: DollarSign, iconColor: 'text-emerald-500', format: 'currency' },
  { key: 'winRate', labelKey: 'admin.crm.stats.winRate', fallbackLabel: 'Win Rate', icon: Percent, iconColor: 'text-indigo-500', format: 'percent' },
  { key: 'pipelineVelocity', labelKey: 'admin.crm.stats.pipelineVelocity', fallbackLabel: 'Pipeline Velocity', icon: Zap, iconColor: 'text-yellow-500', format: 'currency' },
  { key: 'avgTimeToClose', labelKey: 'admin.crm.stats.avgTimeToClose', fallbackLabel: 'Avg Time to Close', icon: Clock, iconColor: 'text-primary-500', format: 'days' },
  { key: 'retentionRate', labelKey: 'admin.crm.stats.retentionRate', fallbackLabel: 'Retention Rate', icon: RefreshCw, iconColor: 'text-teal-500', format: 'percent' },
  { key: 'mrr', labelKey: 'admin.crm.stats.mrr', fallbackLabel: 'Recurring Revenue (MRR)', icon: TrendingUp, iconColor: 'text-purple-500', format: 'currency' },
  { key: 'totalCalls', labelKey: 'admin.crm.stats.totalCalls', fallbackLabel: 'Total Calls', icon: PhoneCall, iconColor: 'text-blue-500', format: 'number' },
  { key: 'totalTalkTime', labelKey: 'admin.crm.stats.totalTalkTime', fallbackLabel: 'Total Talk Time', icon: Headphones, iconColor: 'text-cyan-500', format: 'hours' },
  { key: 'avgHandleTime', labelKey: 'admin.crm.stats.avgHandleTime', fallbackLabel: 'Avg Handle Time', icon: Timer, iconColor: 'text-rose-500', format: 'minutes' },
];

// ── Component ───────────────────────────────────────────────────

export default function RepStatsSummary({ agentId, period }: RepStatsSummaryProps) {
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

  const formatValue = (val: number | undefined, format: StatRowConfig['format']): string => {
    if (val === undefined || val === null) return '-';

    switch (format) {
      case 'percent':
        return `${(val * 100).toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat(locale || 'en', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'number':
        return new Intl.NumberFormat(locale || 'en').format(val);
      case 'hours': {
        const hours = Math.floor(val / 3600);
        const mins = Math.floor((val % 3600) / 60);
        return `${hours}h ${mins}m`;
      }
      case 'minutes': {
        const totalMins = Math.floor(val / 60);
        const secs = Math.floor(val % 60);
        return `${totalMins}m ${secs}s`;
      }
      case 'days':
        return `${val.toFixed(1)} ${t('common.days') || 'days'}`;
      default:
        return String(val);
    }
  };

  // Color indicator based on value magnitude for percentage stats
  const getIndicator = (val: number | undefined, format: StatRowConfig['format']): string | null => {
    if (val === undefined || val === null) return null;
    if (format !== 'percent') return null;
    const pct = val * 100;
    if (pct >= 75) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    if (pct >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

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

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
        <BarChart3 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          {t('admin.crm.stats.noData') || 'No stats available for this period.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('admin.crm.stats.title') || 'Performance Statistics'}
        </h3>
      </div>

      {/* Stats rows */}
      <div className="divide-y divide-gray-50 dark:divide-gray-700">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          const value = data[stat.key];
          const indicator = getIndicator(value, stat.format);

          return (
            <div
              key={stat.key}
              className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${stat.iconColor}`} />
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                {t(stat.labelKey) || stat.fallbackLabel}
              </span>
              <div className="flex items-center gap-2">
                {indicator && (
                  <div className={`w-2 h-2 rounded-full ${indicator}`} />
                )}
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatValue(value, stat.format)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

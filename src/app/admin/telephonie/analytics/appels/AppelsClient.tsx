'use client';

/**
 * AppelsClient - Call volume and disposition analytics.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneForwarded, ArrowLeft, Calendar } from 'lucide-react';
import Link from 'next/link';

interface DispositionStat {
  status: string;
  count: number;
}

interface DurationStats {
  avg: number;
  min: number;
  max: number;
  total: number;
  count: number;
}

interface CallStats {
  inbound: number;
  outbound: number;
  internal: number;
  dispositions: DispositionStat[];
  duration: DurationStats;
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

type DateRange = 'today' | 'week' | 'month';

function formatSeconds(seconds: number): string {
  if (seconds === 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatHours(seconds: number): string {
  if (seconds === 0) return '-';
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `${hours}h`;
}

const STATUS_LABELS: Record<string, string> = {
  RINGING: 'Ringing',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  VOICEMAIL: 'Voicemail',
  FAILED: 'Failed',
  TRANSFERRED: 'Transferred',
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'bg-emerald-500',
  MISSED: 'bg-red-500',
  VOICEMAIL: 'bg-amber-500',
  FAILED: 'bg-gray-500',
  TRANSFERRED: 'bg-teal-500',
  IN_PROGRESS: 'bg-teal-500',
  RINGING: 'bg-purple-500',
};

export default function AppelsClient({ stats }: { stats: CallStats }) {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState<DateRange>('month');

  const getCountForRange = () => {
    switch (dateRange) {
      case 'today': return stats.todayCount;
      case 'week': return stats.weekCount;
      case 'month': return stats.monthCount;
    }
  };

  const totalDirection = stats.inbound + stats.outbound + stats.internal;
  const totalDispositions = stats.dispositions.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/telephonie/analytics"
            className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('voip.admin.callAnalytics.title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('voip.admin.callAnalytics.subtitle')}
            </p>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(['today', 'week', 'month'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateRange === range
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {range === 'today'
                  ? t('voip.admin.callAnalytics.byDay')
                  : range === 'week'
                  ? t('voip.admin.callAnalytics.byWeek')
                  : t('voip.admin.callAnalytics.byMonth')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Direction Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
              <Phone className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.callAnalytics.volume')}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{getCountForRange()}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <PhoneIncoming className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.callAnalytics.inbound')}</div>
              <div className="text-2xl font-bold text-emerald-600">{stats.inbound}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
              <PhoneOutgoing className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.callAnalytics.outbound')}</div>
              <div className="text-2xl font-bold text-teal-600">{stats.outbound}</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <PhoneForwarded className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{t('voip.admin.callAnalytics.internal')}</div>
              <div className="text-2xl font-bold text-purple-600">{stats.internal}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Duration Breakdown */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {t('voip.admin.callAnalytics.duration')}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('voip.analytics.avgDuration')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatSeconds(stats.duration.avg)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Min</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatSeconds(stats.duration.min)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Max</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatSeconds(stats.duration.max)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatHours(stats.duration.total)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">{t('voip.analytics.totalCalls')}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {stats.duration.count}
              </span>
            </div>
          </div>
        </div>

        {/* Disposition Chart */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {t('voip.admin.callAnalytics.disposition')}
          </h3>
          <div className="space-y-3">
            {stats.dispositions
              .sort((a, b) => b.count - a.count)
              .map((d) => {
                const pct = totalDispositions > 0 ? Math.round((d.count / totalDispositions) * 100) : 0;
                return (
                  <div key={d.status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">
                        {STATUS_LABELS[d.status] || d.status}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {d.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[d.status] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {stats.dispositions.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">
                No disposition data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direction Distribution Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {t('voip.admin.callAnalytics.trends')}
        </h3>
        {totalDirection > 0 ? (
          <div>
            <div className="flex h-6 rounded-full overflow-hidden">
              {stats.inbound > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(stats.inbound / totalDirection) * 100}%` }}
                />
              )}
              {stats.outbound > 0 && (
                <div
                  className="bg-teal-500 transition-all"
                  style={{ width: `${(stats.outbound / totalDirection) * 100}%` }}
                />
              )}
              {stats.internal > 0 && (
                <div
                  className="bg-purple-500 transition-all"
                  style={{ width: `${(stats.internal / totalDirection) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {t('voip.admin.callAnalytics.inbound')} ({Math.round((stats.inbound / totalDirection) * 100)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {t('voip.admin.callAnalytics.outbound')} ({Math.round((stats.outbound / totalDirection) * 100)}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {t('voip.admin.callAnalytics.internal')} ({Math.round((stats.internal / totalDirection) * 100)}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">
            No call data available for selected period
          </div>
        )}
      </div>
    </div>
  );
}

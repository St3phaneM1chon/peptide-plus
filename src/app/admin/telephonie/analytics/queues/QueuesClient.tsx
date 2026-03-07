'use client';

/**
 * QueuesClient - Queue performance analytics table.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { LayoutGrid, ArrowUpDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface QueueMetrics {
  id: string;
  name: string;
  strategy: string;
  memberCount: number;
  slaPercent: number;
  asa: number;
  abandonRate: number;
  avgWaitTime: number;
  peakHour: string;
  totalOffered: number;
  totalAnswered: number;
  totalAbandoned: number;
}

type SortField = keyof QueueMetrics;

function formatSeconds(seconds: number): string {
  if (seconds === 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function QueuesClient({ queues: initial }: { queues: QueueMetrics[] }) {
  const { t } = useI18n();
  const [queues] = useState(initial);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = [...queues].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-teal-600 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs">{label}</span>
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-teal-600' : 'text-gray-400'}`} />
      </div>
    </th>
  );

  const getSlaColor = (sla: number) => {
    if (sla >= 90) return 'text-emerald-600';
    if (sla >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getAbandonColor = (rate: number) => {
    if (rate <= 5) return 'text-emerald-600';
    if (rate <= 15) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/telephonie/analytics"
          className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('voip.admin.queueAnalytics.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('voip.admin.queueAnalytics.subtitle')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('voip.admin.queueAnalytics.totalOffered')}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {queues.reduce((sum, q) => sum + q.totalOffered, 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('voip.admin.queueAnalytics.totalAnswered')}
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {queues.reduce((sum, q) => sum + q.totalAnswered, 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('voip.admin.queueAnalytics.totalAbandoned')}
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {queues.reduce((sum, q) => sum + q.totalAbandoned, 0)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('voip.admin.queueAnalytics.avgWaitTime')}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {queues.length > 0
              ? formatSeconds(Math.round(queues.reduce((sum, q) => sum + q.avgWaitTime, 0) / queues.length))
              : '-'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <SortHeader field="name" label={t('voip.admin.queueAnalytics.queue')} />
              <SortHeader field="slaPercent" label={t('voip.admin.queueAnalytics.slaPercent')} />
              <SortHeader field="asa" label={t('voip.admin.queueAnalytics.asa')} />
              <SortHeader field="abandonRate" label={t('voip.admin.queueAnalytics.abandonRate')} />
              <SortHeader field="avgWaitTime" label={t('voip.admin.queueAnalytics.avgWaitTime')} />
              <SortHeader field="peakHour" label={t('voip.admin.queueAnalytics.peakHour')} />
              <SortHeader field="totalOffered" label={t('voip.admin.queueAnalytics.totalOffered')} />
              <SortHeader field="totalAnswered" label={t('voip.admin.queueAnalytics.totalAnswered')} />
              <SortHeader field="totalAbandoned" label={t('voip.admin.queueAnalytics.totalAbandoned')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.map((queue) => (
              <tr key={queue.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{queue.name}</div>
                    <div className="text-xs text-gray-500">
                      {queue.strategy} &middot; {queue.memberCount} agents
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 font-bold ${getSlaColor(queue.slaPercent)}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden max-w-[60px]">
                      <div
                        className={`h-full rounded-full ${
                          queue.slaPercent >= 90
                            ? 'bg-emerald-500'
                            : queue.slaPercent >= 70
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${queue.slaPercent}%` }}
                      />
                    </div>
                    {queue.slaPercent}%
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {formatSeconds(queue.asa)}
                </td>
                <td className={`px-4 py-3 font-medium ${getAbandonColor(queue.abandonRate)}`}>
                  {queue.abandonRate}%
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {formatSeconds(queue.avgWaitTime)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {queue.peakHour}
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                  {queue.totalOffered}
                </td>
                <td className="px-4 py-3 text-emerald-600 font-medium">
                  {queue.totalAnswered}
                </td>
                <td className="px-4 py-3 text-red-600 font-medium">
                  {queue.totalAbandoned}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {queues.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <LayoutGrid className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No queue data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * AgentsClient - Agent performance analytics table.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Users, ArrowUpDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface AgentMetrics {
  id: string;
  name: string;
  extension: string;
  totalCalls: number;
  answered: number;
  missed: number;
  avgHandleTime: number;
  avgTalkTime: number;
  avgWrapTime: number;
  fcr: number;
  csat: number;
  qualityScore: number;
  callsPerHour: number;
  utilization: number;
}

type SortField = keyof AgentMetrics;

function formatSeconds(seconds: number): string {
  if (seconds === 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function AgentsClient({ agents: initial }: { agents: AgentMetrics[] }) {
  const { t } = useI18n();
  const [agents] = useState(initial);
  const [sortField, setSortField] = useState<SortField>('totalCalls');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = [...agents].sort((a, b) => {
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
      className="px-3 py-3 text-left font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-teal-600 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs">{label}</span>
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-teal-600' : 'text-gray-400'}`} />
      </div>
    </th>
  );

  const getScoreColor = (val: number, high: number, mid: number) => {
    if (val >= high) return 'text-emerald-600';
    if (val >= mid) return 'text-amber-600';
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
            {t('voip.admin.agentPerformance.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('voip.admin.agentPerformance.subtitle')}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <SortHeader field="name" label={t('voip.admin.agentPerformance.agent')} />
              <SortHeader field="totalCalls" label={t('voip.admin.agentPerformance.totalCalls')} />
              <SortHeader field="answered" label={t('voip.admin.agentPerformance.answered')} />
              <SortHeader field="missed" label={t('voip.admin.agentPerformance.missed')} />
              <SortHeader field="avgHandleTime" label={t('voip.admin.agentPerformance.avgHandleTime')} />
              <SortHeader field="avgTalkTime" label={t('voip.admin.agentPerformance.avgTalkTime')} />
              <SortHeader field="avgWrapTime" label={t('voip.admin.agentPerformance.avgWrapTime')} />
              <SortHeader field="fcr" label={t('voip.admin.agentPerformance.fcr')} />
              <SortHeader field="csat" label={t('voip.admin.agentPerformance.csat')} />
              <SortHeader field="qualityScore" label={t('voip.admin.agentPerformance.qualityScore')} />
              <SortHeader field="callsPerHour" label={t('voip.admin.agentPerformance.callsPerHour')} />
              <SortHeader field="utilization" label={t('voip.admin.agentPerformance.utilization')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sorted.map((agent) => (
              <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-3 py-3">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{agent.name}</div>
                    <div className="text-xs text-gray-500">Ext. {agent.extension}</div>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-900 dark:text-white font-medium">
                  {agent.totalCalls}
                </td>
                <td className="px-3 py-3 text-emerald-600 font-medium">{agent.answered}</td>
                <td className="px-3 py-3 text-red-600 font-medium">{agent.missed}</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  {formatSeconds(agent.avgHandleTime)}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  {formatSeconds(agent.avgTalkTime)}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  {formatSeconds(agent.avgWrapTime)}
                </td>
                <td className={`px-3 py-3 font-medium ${getScoreColor(agent.fcr, 80, 60)}`}>
                  {agent.fcr > 0 ? `${agent.fcr}%` : '-'}
                </td>
                <td className={`px-3 py-3 font-medium ${getScoreColor(agent.csat, 4, 3)}`}>
                  {agent.csat > 0 ? `${agent.csat}/5` : '-'}
                </td>
                <td className={`px-3 py-3 font-medium ${getScoreColor(agent.qualityScore, 80, 60)}`}>
                  {agent.qualityScore > 0 ? `${agent.qualityScore}%` : '-'}
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                  {agent.callsPerHour > 0 ? agent.callsPerHour : '-'}
                </td>
                <td className="px-3 py-3">
                  {agent.utilization > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            agent.utilization >= 80
                              ? 'bg-emerald-500'
                              : agent.utilization >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${agent.utilization}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{agent.utilization}%</span>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {agents.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No agent data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

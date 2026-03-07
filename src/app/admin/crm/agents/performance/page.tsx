'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Users,
  Phone,
  Clock,
  TrendingUp,
  DollarSign,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

interface AgentPerformance {
  id: string;
  name: string;
  email: string;
  stats: {
    callsMade: number;
    callsAnswered: number;
    totalTalkTime: number;
    avgHandleTime: number;
    conversions: number;
    revenue: number;
    breakTime: number;
  };
  contactRate: number;
  conversionRate: number;
  rank: number;
}

export default function AgentPerformancePage() {
  const { t, locale } = useI18n();
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [sortBy, setSortBy] = useState<'conversions' | 'calls' | 'revenue' | 'contactRate'>('conversions');

  const fetchPerformance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crm/agents/performance?period=${period}`);
      const json = await res.json();
      if (json.success) setAgents(json.data || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(value);

  const sorted = [...agents].sort((a, b) => {
    switch (sortBy) {
      case 'calls': return b.stats.callsMade - a.stats.callsMade;
      case 'revenue': return b.stats.revenue - a.stats.revenue;
      case 'contactRate': return b.contactRate - a.contactRate;
      default: return b.stats.conversions - a.stats.conversions;
    }
  });

  // Summary totals
  const totals = agents.reduce((acc, a) => ({
    calls: acc.calls + a.stats.callsMade,
    connected: acc.connected + a.stats.callsAnswered,
    conversions: acc.conversions + a.stats.conversions,
    revenue: acc.revenue + a.stats.revenue,
    talkTime: acc.talkTime + a.stats.totalTalkTime,
  }), { calls: 0, connected: 0, conversions: 0, revenue: 0, talkTime: 0 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            {t('admin.crm.agentPerformance') || 'Agent Performance'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track individual and team metrics</p>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md ${period === p ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <SummaryCard icon={<Phone className="h-5 w-5 text-teal-500" />} label="Total Calls" value={totals.calls.toString()} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5 text-green-500" />} label="Connected" value={totals.connected.toString()} sub={totals.calls > 0 ? `${Math.round((totals.connected / totals.calls) * 100)}% rate` : '0%'} />
        <SummaryCard icon={<BarChart3 className="h-5 w-5 text-purple-500" />} label="Conversions" value={totals.conversions.toString()} />
        <SummaryCard icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Revenue" value={formatCurrency(totals.revenue)} />
        <SummaryCard icon={<Clock className="h-5 w-5 text-orange-500" />} label="Talk Time" value={formatDuration(totals.talkTime)} />
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Sort by:</span>
        {([
          { key: 'conversions', label: 'Conversions' },
          { key: 'calls', label: 'Calls' },
          { key: 'revenue', label: 'Revenue' },
          { key: 'contactRate', label: 'Contact Rate' },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key)}
            className={`px-2 py-1 text-xs rounded ${sortBy === s.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Agent Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No agent data for this period</p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Agent</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Calls</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Connected</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Contact Rate</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">AHT</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Conversions</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Revenue</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">Talk Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((agent, i) => {
                const TrendIcon = agent.contactRate >= 50 ? ArrowUp : agent.contactRate >= 30 ? Minus : ArrowDown;
                const trendColor = agent.contactRate >= 50 ? 'text-green-500' : agent.contactRate >= 30 ? 'text-gray-400' : 'text-red-500';

                return (
                  <tr key={agent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{agent.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{agent.email}</p>
                    </td>
                    <td className="text-center px-4 py-3 text-sm font-medium">{agent.stats.callsMade}</td>
                    <td className="text-center px-4 py-3 text-sm">{agent.stats.callsAnswered}</td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${trendColor}`}>
                        <TrendIcon className="h-3 w-3" />
                        {agent.contactRate}%
                      </span>
                    </td>
                    <td className="text-center px-4 py-3 text-sm text-gray-500">{formatDuration(Math.round(agent.stats.avgHandleTime))}</td>
                    <td className="text-center px-4 py-3 text-sm font-bold text-purple-600">{agent.stats.conversions}</td>
                    <td className="text-right px-4 py-3 text-sm font-medium text-emerald-600">{formatCurrency(agent.stats.revenue)}</td>
                    <td className="text-center px-4 py-3 text-sm text-gray-500">{formatDuration(agent.stats.totalTalkTime)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

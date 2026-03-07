'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Trophy,
  Medal,
  Phone,
  DollarSign,
  TrendingUp,
  Star,
  Crown,
  Award,
} from 'lucide-react';

interface AgentRank {
  id: string;
  name: string;
  avatar?: string;
  callsMade: number;
  conversions: number;
  revenue: number;
  contactRate: number;
  rank: number;
  badges: string[];
}

export default function LeaderboardPage() {
  const { t, locale } = useI18n();
  const [agents, setAgents] = useState<AgentRank[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [metric, setMetric] = useState<'conversions' | 'calls' | 'revenue'>('conversions');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crm/agents/performance?period=${period}`);
      const json = await res.json();
      if (json.success) {
        const ranked = (json.data || [])
          .map((a: { id: string; name: string; stats: { callsMade: number; conversions: number; revenue: number; callsAnswered: number }; contactRate: number }) => ({
            id: a.id,
            name: a.name || 'Unknown',
            callsMade: a.stats.callsMade,
            conversions: a.stats.conversions,
            revenue: a.stats.revenue,
            contactRate: a.contactRate,
            rank: 0,
            badges: getBadges(a.stats),
          }))
          .sort((a: AgentRank, b: AgentRank) => {
            switch (metric) {
              case 'calls': return b.callsMade - a.callsMade;
              case 'revenue': return b.revenue - a.revenue;
              default: return b.conversions - a.conversions;
            }
          })
          .map((a: AgentRank, i: number) => ({ ...a, rank: i + 1 }));

        setAgents(ranked);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [period, metric]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(value);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            {t('admin.crm.leaderboard') || 'Leaderboard'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.crm.topAgents') || 'Top performing agents'}</p>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md ${period === p ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p === 'today' ? (t('common.today') || 'Today') : p === 'week' ? (t('common.thisWeek') || 'This Week') : (t('common.thisMonth') || 'This Month')}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Toggle */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'conversions' as const, label: t('admin.crm.conversions') || 'Conversions', icon: <TrendingUp className="h-4 w-4" /> },
          { key: 'calls' as const, label: t('admin.crm.calls') || 'Calls', icon: <Phone className="h-4 w-4" /> },
          { key: 'revenue' as const, label: t('admin.crm.revenue') || 'Revenue', icon: <DollarSign className="h-4 w-4" /> },
        ]).map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              metric === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center text-gray-400 py-16">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{t('admin.crm.noPerformanceData') || 'No performance data for this period'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Top 3 Podium */}
          {agents.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 2nd place */}
              <PodiumCard agent={agents[1]} metric={metric} formatCurrency={formatCurrency}
                bgColor="bg-gray-50" borderColor="border-gray-200" medal={<Medal className="h-8 w-8 text-gray-400" />} />
              {/* 1st place */}
              <PodiumCard agent={agents[0]} metric={metric} formatCurrency={formatCurrency}
                bgColor="bg-yellow-50" borderColor="border-yellow-300" medal={<Crown className="h-8 w-8 text-yellow-500" />} featured />
              {/* 3rd place */}
              <PodiumCard agent={agents[2]} metric={metric} formatCurrency={formatCurrency}
                bgColor="bg-orange-50" borderColor="border-orange-200" medal={<Award className="h-8 w-8 text-orange-400" />} />
            </div>
          )}

          {/* Rest of the list */}
          {agents.slice(3).map(agent => (
            <div key={agent.id} className="flex items-center gap-4 bg-white border rounded-lg px-4 py-3 hover:bg-gray-50">
              <span className="w-8 text-center text-lg font-bold text-gray-300">{agent.rank}</span>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-400">
                {(agent.name || '?')[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{agent.name}</p>
                <div className="flex gap-1 mt-0.5">
                  {agent.badges.map(b => (
                    <span key={b} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{b}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-center">
                  <p className="font-bold text-gray-900">{agent.callsMade}</p>
                  <p className="text-xs text-gray-400">{t('admin.crm.calls') || 'Calls'}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-purple-600">{agent.conversions}</p>
                  <p className="text-xs text-gray-400">{t('admin.crm.conv') || 'Conv.'}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-emerald-600">{formatCurrency(agent.revenue)}</p>
                  <p className="text-xs text-gray-400">{t('admin.crm.revenue') || 'Revenue'}</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-teal-600">{agent.contactRate}%</p>
                  <p className="text-xs text-gray-400">{t('admin.crm.contact') || 'Contact'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PodiumCard({ agent, metric, formatCurrency, bgColor, borderColor, medal, featured }: {
  agent: AgentRank; metric: string; formatCurrency: (v: number) => string;
  bgColor: string; borderColor: string; medal: React.ReactNode; featured?: boolean;
}) {
  const mainValue = metric === 'revenue' ? formatCurrency(agent.revenue)
    : metric === 'calls' ? agent.callsMade.toString()
    : agent.conversions.toString();

  return (
    <div className={`${bgColor} border-2 ${borderColor} rounded-xl p-4 text-center ${featured ? 'transform -translate-y-2 shadow-lg' : ''}`}>
      <div className="flex justify-center mb-2">{medal}</div>
      <div className="w-12 h-12 rounded-full bg-white mx-auto mb-2 flex items-center justify-center text-xl font-bold text-gray-600 border-2 border-white shadow">
        {(agent.name || '?')[0]}
      </div>
      <p className="font-bold text-gray-900">{agent.name}</p>
      <p className={`text-2xl font-bold mt-2 ${featured ? 'text-yellow-600' : 'text-gray-700'}`}>{mainValue}</p>
      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-500">
        <span>{agent.callsMade} calls</span>
        <span>{agent.contactRate}% rate</span>
      </div>
      {agent.badges.length > 0 && (
        <div className="flex justify-center gap-1 mt-2">
          {agent.badges.slice(0, 3).map(b => (
            <span key={b} className="flex items-center gap-0.5 text-xs">
              <Star className="h-3 w-3 text-yellow-400" /> {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getBadges(stats: { callsMade: number; conversions: number; revenue: number; callsAnswered: number }): string[] {
  const badges: string[] = [];
  if (stats.callsMade >= 100) badges.push('Power Caller');
  if (stats.conversions >= 20) badges.push('Closer');
  if (stats.revenue >= 10000) badges.push('Revenue King');
  if (stats.callsAnswered > 0 && stats.callsMade > 0 && (stats.callsAnswered / stats.callsMade) >= 0.6) badges.push('Connector');
  return badges;
}

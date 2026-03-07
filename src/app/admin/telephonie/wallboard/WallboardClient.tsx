'use client';

/**
 * WallboardClient - Real-time call center wallboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Phone, Users, Clock, TrendingUp, PhoneMissed, PhoneIncoming,
  PhoneForwarded, Activity, RefreshCw,
} from 'lucide-react';

interface AgentInfo {
  id: string;
  extension: string;
  name: string;
  status: string;
  isRegistered: boolean;
}

interface QueueInfo {
  id: string;
  name: string;
  memberCount: number;
  strategy: string;
  waiting?: number;
  avgWait?: number;
}

interface WallboardData {
  callsToday: number;
  activeCalls: number;
  answeredToday: number;
  missedToday: number;
  agentsOnline: number;
  avgWaitTime: number;
  agents: AgentInfo[];
  queues: QueueInfo[];
  inQueue?: number;
  slaPercent?: number;
  abandonRate?: number;
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function WallboardClient({ initialData }: { initialData: WallboardData }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<WallboardData>(initialData);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/voip/team-presence');
      if (res.ok) {
        const presence = await res.json();
        setData((prev) => ({
          ...prev,
          agents: presence.agents || prev.agents,
          agentsOnline: (presence.agents || []).filter(
            (a: AgentInfo) => a.status === 'ONLINE' || a.status === 'BUSY'
          ).length,
        }));
      }

      // Also try refreshing dashboard stats
      const statsRes = await fetch('/api/admin/voip/dashboard');
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setData((prev) => ({
          ...prev,
          callsToday: stats.today?.total || prev.callsToday,
          answeredToday: stats.today?.answered || prev.answeredToday,
          missedToday: stats.today?.missed || prev.missedToday,
          activeCalls: stats.activeCalls || prev.activeCalls,
        }));
      }

      setLastRefresh(new Date());
    } catch {
      // Silent fail for auto-refresh
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const slaPercent = data.slaPercent ?? (data.callsToday > 0
    ? Math.round((data.answeredToday / data.callsToday) * 100)
    : 100);
  const abandonRate = data.abandonRate ?? (data.callsToday > 0
    ? Math.round((data.missedToday / data.callsToday) * 100)
    : 0);
  const inQueue = data.inQueue ?? 0;

  const getSlaColor = (sla: number) => {
    if (sla >= 90) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30';
    if (sla >= 70) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30';
    return 'text-red-600 bg-red-50 dark:bg-red-900/30';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-emerald-500';
      case 'BUSY': return 'bg-red-500';
      case 'DND': return 'bg-orange-500';
      case 'AWAY': return 'bg-amber-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'BUSY': return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'DND': return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'AWAY': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const kpiCards = [
    {
      label: t('voip.admin.wallboard.activeCalls'),
      value: data.activeCalls,
      icon: Phone,
      color: 'text-teal-600',
      bg: 'bg-teal-50 dark:bg-teal-900/30',
    },
    {
      label: t('voip.admin.wallboard.agentsOnline'),
      value: data.agentsOnline,
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    },
    {
      label: t('voip.admin.wallboard.inQueue'),
      value: inQueue,
      icon: PhoneIncoming,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-900/30',
    },
    {
      label: t('voip.admin.wallboard.avgWaitTime'),
      value: formatSeconds(data.avgWaitTime),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/30',
    },
    {
      label: t('voip.admin.wallboard.slaPercent'),
      value: `${slaPercent}%`,
      icon: TrendingUp,
      color: slaPercent >= 90 ? 'text-emerald-600' : slaPercent >= 70 ? 'text-amber-600' : 'text-red-600',
      bg: getSlaColor(slaPercent),
    },
    {
      label: t('voip.admin.wallboard.abandonRate'),
      value: `${abandonRate}%`,
      icon: PhoneMissed,
      color: abandonRate <= 5 ? 'text-emerald-600' : abandonRate <= 15 ? 'text-amber-600' : 'text-red-600',
      bg: abandonRate <= 5
        ? 'bg-emerald-50 dark:bg-emerald-900/30'
        : abandonRate <= 15
        ? 'bg-amber-50 dark:bg-amber-900/30'
        : 'bg-red-50 dark:bg-red-900/30',
    },
    {
      label: t('voip.admin.wallboard.callsToday'),
      value: data.callsToday,
      icon: PhoneForwarded,
      color: 'text-teal-600',
      bg: 'bg-teal-50 dark:bg-teal-900/30',
    },
    {
      label: t('voip.admin.wallboard.answeredToday'),
      value: data.answeredToday,
      icon: Activity,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    },
    {
      label: t('voip.admin.wallboard.missedToday'),
      value: data.missedToday,
      icon: PhoneMissed,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-900/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('voip.admin.wallboard.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('voip.admin.wallboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString(locale)}
          </span>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className={`${kpi.bg} rounded-xl p-4 text-center`}
          >
            <kpi.icon className={`w-5 h-5 mx-auto mb-1.5 ${kpi.color}`} />
            <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Status List */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('voip.admin.wallboard.agentList')}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.agents.map((agent) => (
              <div key={agent.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(agent.status)}`}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {agent.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('voip.admin.wallboard.ext')} {agent.extension}
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(agent.status)}`}>
                  {t(`voip.admin.agentStatus.${agent.status.toLowerCase()}`)}
                </span>
              </div>
            ))}
            {data.agents.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-400">
                <Users className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                {t('voip.admin.wallboard.noAgents')}
              </div>
            )}
          </div>
        </div>

        {/* Queue Status List */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('voip.admin.wallboard.queueList')}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.queues.map((queue) => (
              <div key={queue.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {queue.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {queue.memberCount} {t('voip.admin.wallboard.agentsOnline').toLowerCase()} &middot; {queue.strategy}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {queue.waiting !== undefined && queue.waiting > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                      {queue.waiting} {t('voip.admin.wallboard.inQueue').toLowerCase()}
                    </span>
                  )}
                  {queue.avgWait !== undefined && (
                    <span className="text-xs text-gray-500">
                      {formatSeconds(queue.avgWait)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {data.queues.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-400">
                <Phone className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                {t('voip.admin.wallboard.noQueues')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

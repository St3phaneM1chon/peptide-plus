'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Phone, Users, Clock,
  Activity, BarChart3, RefreshCw, Headphones,
} from 'lucide-react';

interface WallboardData {
  agentsOnline: number;
  agentsInCall: number;
  callsToday: number;
  avgTalkTime: number;
  todayStats: {
    totalCalls: number;
    answered: number;
    missed: number;
    avgDuration: number;
    totalDuration: number;
  };
  queueStats: Array<{
    queueId: string;
    name: string;
    waitingCalls: number;
  }>;
}

export default function WallboardPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<WallboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/wallboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date());
      }
    } catch {
      // Silent fail for auto-refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-950 min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.crm.wallboard') || 'Call Center Wallboard'}</h1>
          <p className="text-gray-400 text-sm mt-1">
            Last updated: {lastRefresh.toLocaleTimeString(locale)}
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-800">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Users className="h-6 w-6 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Agents Online</span>
          </div>
          <p className="text-4xl font-bold text-green-400">{data?.agentsOnline || 0}</p>
          <p className="text-sm text-gray-500 mt-1">{data?.agentsInCall || 0} in call</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-teal-500/20">
              <Phone className="h-6 w-6 text-teal-400" />
            </div>
            <span className="text-sm text-gray-400">Calls Today</span>
          </div>
          <p className="text-4xl font-bold text-teal-400">{data?.todayStats?.totalCalls || 0}</p>
          <p className="text-sm text-gray-500 mt-1">
            <span className="text-green-400">{data?.todayStats?.answered || 0}</span> answered ·{' '}
            <span className="text-red-400">{data?.todayStats?.missed || 0}</span> missed
          </p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Clock className="h-6 w-6 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Avg Talk Time</span>
          </div>
          <p className="text-4xl font-bold text-purple-400">{formatDuration(data?.avgTalkTime || 0)}</p>
          <p className="text-sm text-gray-500 mt-1">Total: {formatHours(data?.todayStats?.totalDuration || 0)}</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Activity className="h-6 w-6 text-yellow-400" />
            </div>
            <span className="text-sm text-gray-400">Answer Rate</span>
          </div>
          <p className="text-4xl font-bold text-yellow-400">
            {data?.todayStats?.totalCalls ? Math.round((data.todayStats.answered / data.todayStats.totalCalls) * 100) : 0}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Target: 80%</p>
        </div>
      </div>

      {/* Queue Status */}
      {(data?.queueStats?.length || 0) > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Queue Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data?.queueStats?.map(q => (
              <div key={q.queueId} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-5 w-5 text-gray-400" />
                    <span className="font-medium">{q.name}</span>
                  </div>
                  <span className={`text-2xl font-bold ${q.waitingCalls > 3 ? 'text-red-400' : q.waitingCalls > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {q.waitingCalls}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">waiting calls</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's call distribution (visual) */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4 text-gray-300 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Today's Distribution
        </h2>
        <div className="flex items-end gap-1 h-32">
          {/* Simple bar chart placeholder showing call volumes */}
          {Array.from({ length: 24 }, (_, i) => {
            const h = i;
            const currentHour = new Date().getHours();
            const isActive = h <= currentHour;
            // Simulated distribution (bell curve around 10-14h)
            const heightPct = isActive ? Math.max(10, 100 * Math.exp(-0.5 * Math.pow((h - 12) / 3, 2))) : 5;
            return (
              <div key={h} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-full rounded-t transition-all ${
                    h === currentHour ? 'bg-teal-500' : isActive ? 'bg-teal-500/40' : 'bg-gray-800'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
                {h % 4 === 0 && <span className="text-xs text-gray-600 mt-1">{h}h</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

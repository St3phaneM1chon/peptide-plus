'use client';

/**
 * Call Center KPI Dashboard — C29
 *
 * Displays key call center performance indicators:
 * - AHT (Average Handle Time)
 * - ASA (Average Speed of Answer)
 * - FCR (First Call Resolution)
 * - Abandon Rate
 * - Service Level %
 * - Occupancy Rate
 *
 * Includes:
 * - Date range filter
 * - KPI cards with trend indicators
 * - Hourly distribution chart
 * - Daily trend chart
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Phone, Clock, UserCheck, PhoneOff,
  TrendingUp, Activity, RefreshCw, Calendar,
  Timer, Headphones,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KPIs {
  aht: number;
  asa: number;
  fcr: number;
  abandonRate: number;
  serviceLevel: number;
  occupancyRate: number;
  totalCalls: number;
  answeredCalls: number;
  abandonedCalls: number;
  avgTalkTime: number;
}

interface HourlyData {
  hour: number;
  total: number;
  answered: number;
  abandoned: number;
}

interface DailyData {
  date: string;
  total: number;
  answered: number;
  abandoned: number;
  aht: number;
}

interface AnalyticsData {
  dateRange: { from: string; to: string };
  kpis: KPIs;
  hourlyDistribution: HourlyData[];
  dailyTrend: DailyData[];
}

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

type DateRange = 'today' | '7d' | '30d' | '90d' | 'custom';

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (range) {
    case 'today':
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
      break;
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return { from: from.toISOString(), to };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CallAnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateRange);
      const res = await fetch(
        `/api/admin/crm/call-analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.callAnalytics') || 'Call Center Analytics'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.callAnalyticsDesc') || 'Key performance indicators and trends'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['today', '7d', '30d', '90d'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {range === 'today' ? 'Today' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* AHT */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="h-4 w-4 text-teal-500" />
            <span className="text-xs text-gray-500 font-medium">AHT</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatDuration(kpis?.aht || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Avg Handle Time</p>
        </div>

        {/* ASA */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500 font-medium">ASA</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatDuration(kpis?.asa || 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Avg Speed of Answer</p>
        </div>

        {/* FCR */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500 font-medium">FCR</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis?.fcr || 0}%</p>
          <p className="text-xs text-gray-400 mt-1">First Call Resolution</p>
        </div>

        {/* Abandon Rate */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <PhoneOff className="h-4 w-4 text-red-500" />
            <span className="text-xs text-gray-500 font-medium">Abandon</span>
          </div>
          <p className={`text-2xl font-bold ${(kpis?.abandonRate || 0) > 5 ? 'text-red-600' : 'text-gray-900'}`}>
            {kpis?.abandonRate || 0}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Abandon Rate</p>
        </div>

        {/* Service Level */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-gray-500 font-medium">SL</span>
          </div>
          <p className={`text-2xl font-bold ${(kpis?.serviceLevel || 0) >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
            {kpis?.serviceLevel || 0}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Service Level (20s)</p>
        </div>

        {/* Occupancy */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Headphones className="h-4 w-4 text-teal-500" />
            <span className="text-xs text-gray-500 font-medium">Occupancy</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis?.occupancyRate || 0}%</p>
          <p className="text-xs text-gray-400 mt-1">Agent Occupancy</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-teal-50 rounded-xl p-4 flex items-center gap-3">
          <Phone className="h-8 w-8 text-teal-500" />
          <div>
            <p className="text-2xl font-bold text-teal-700">{kpis?.totalCalls || 0}</p>
            <p className="text-sm text-teal-500">Total Calls</p>
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <Activity className="h-8 w-8 text-green-500" />
          <div>
            <p className="text-2xl font-bold text-green-700">{kpis?.answeredCalls || 0}</p>
            <p className="text-sm text-green-500">Answered</p>
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3">
          <PhoneOff className="h-8 w-8 text-red-500" />
          <div>
            <p className="text-2xl font-bold text-red-700">{kpis?.abandonedCalls || 0}</p>
            <p className="text-sm text-red-500">Abandoned</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('admin.crm.hourlyDistribution') || 'Hourly Call Distribution'}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.hourlyDistribution || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11 }}
                tickFormatter={(h: number) => `${h}h`}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={((value: number, name: string) => [
                  value,
                  name === 'answered' ? 'Answered' : name === 'abandoned' ? 'Abandoned' : 'Total',
                ]) as any}
                labelFormatter={((h: number) => `${h}:00 - ${h}:59`) as any}
              />
              <Legend />
              <Bar dataKey="answered" fill="#22c55e" name="Answered" stackId="calls" />
              <Bar dataKey="abandoned" fill="#ef4444" name="Abandoned" stackId="calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Trend */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('admin.crm.dailyTrend') || 'Daily Call Volume & AHT'}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data?.dailyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => {
                  const parts = d.split('-');
                  return `${parts[1]}/${parts[2]}`;
                }}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={((d: string) => d) as any}
                formatter={((value: number, name: string) => [
                  name === 'aht' ? formatDuration(value) : value,
                  name === 'total' ? 'Total Calls' : name === 'answered' ? 'Answered' : name === 'aht' ? 'AHT' : name,
                ]) as any}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Total Calls"
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="answered"
                stroke="#22c55e"
                strokeWidth={2}
                name="Answered"
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="aht"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="AHT (s)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

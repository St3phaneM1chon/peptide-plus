'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Phone, Clock, Target, TrendingDown, Users,
  Activity, RefreshCw, BarChart3,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KPIData {
  aht: number;
  asa: number;
  fcr: number;
  serviceLevel: number;
  abandonRate: number;
  occupancy: number;
  totalCalls: number;
  answeredCalls: number;
}

interface AgentRow {
  agentId: string;
  name: string;
  totalCalls: number;
  answered: number;
  avgHandleTime: number;
  fcrRate: number;
}

interface TrendPoint {
  label: string;
  calls: number;
  answered: number;
}

interface KPIResponse {
  period: string;
  kpis: KPIData;
  agents: AgentRow[];
  trends: TrendPoint[];
}

type Period = 'today' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CallCenterKPIsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<KPIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('today');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crm/call-center-kpis?period=${period}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else toast.error(t('admin.crm.fetchError') || 'Failed to load KPIs');
    } catch {
      toast.error(t('admin.crm.fetchError') || 'Failed to load KPIs');
    } finally {
      setLoading(false);
    }
  }, [period, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatSeconds = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const kpiCards = data ? [
    { label: 'AHT', value: formatSeconds(data.kpis.aht), sub: 'Avg Handle Time', icon: Clock, color: 'blue' },
    { label: 'ASA', value: formatSeconds(data.kpis.asa), sub: 'Avg Speed Answer', icon: Phone, color: 'green' },
    { label: 'FCR', value: `${data.kpis.fcr}%`, sub: 'First Call Resolution', icon: Target, color: 'purple' },
    { label: 'Service Level', value: `${data.kpis.serviceLevel}%`, sub: 'Answered in 20s', icon: Activity, color: 'emerald' },
    { label: 'Abandon Rate', value: `${data.kpis.abandonRate}%`, sub: `${data.kpis.totalCalls - data.kpis.answeredCalls} abandoned`, icon: TrendingDown, color: 'red' },
    { label: 'Occupancy', value: `${data.kpis.occupancy}%`, sub: 'Agent utilization', icon: Users, color: 'amber' },
  ] : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.callCenterKpis') || 'Call Center KPIs'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.callCenterKpisDesc') || 'Real-time call center performance metrics'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            className="text-sm border rounded-md px-3 py-2"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button onClick={fetchData} className="p-2 rounded-lg hover:bg-gray-100" title="Refresh">
            <RefreshCw className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border p-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
                  <kpi.icon className="h-4 w-4" /> {kpi.label}
                </div>
                <p className={`text-2xl font-bold text-${kpi.color}-600`}>{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Trend Line Chart */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Call Volume Trend
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data?.trends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="calls" stroke="#3b82f6" name="Total Calls" strokeWidth={2} />
                  <Line type="monotone" dataKey="answered" stroke="#10b981" name="Answered" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Agent Comparison Bar Chart */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" /> Agent Comparison
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={(data?.agents || []).slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalCalls" fill="#3b82f6" name="Total" />
                  <Bar dataKey="answered" fill="#10b981" name="Answered" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agent Breakdown Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-sm font-semibold text-gray-700">Agent Performance Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Agent</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Total Calls</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Answered</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Avg Handle Time</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">FCR %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.agents || []).map(agent => (
                    <tr key={agent.agentId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{agent.name}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{agent.totalCalls}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{agent.answered}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{formatSeconds(agent.avgHandleTime)}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`font-medium ${agent.fcrRate >= 80 ? 'text-green-600' : agent.fcrRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {agent.fcrRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(data?.agents || []).length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No agent data for this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

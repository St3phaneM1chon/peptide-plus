'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Activity, Calendar, Download, Users, Filter,
  Phone, Mail, MessageSquare, UserCheck, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentActivity {
  agentId: string;
  name: string;
  email: string;
  CALL: number;
  EMAIL: number;
  SMS: number;
  MEETING: number;
  NOTE: number;
  STATUS_CHANGE: number;
  DEAL_CREATED: number;
  DEAL_WON: number;
  DEAL_LOST: number;
  total: number;
}

interface DailySummary {
  date: string;
  count: number;
}

interface ReportData {
  dateRange: { from: string; to: string };
  totalActivities: number;
  agents: AgentActivity[];
  dailySummary: DailySummary[];
}

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  CALL: Phone, EMAIL: Mail, SMS: MessageSquare, MEETING: UserCheck,
};

const ACTIVITY_COLORS: Record<string, string> = {
  CALL: '#3b82f6', EMAIL: '#10b981', SMS: '#f59e0b', MEETING: '#8b5cf6',
  NOTE: '#6b7280', STATUS_CHANGE: '#64748b', DEAL_CREATED: '#06b6d4',
  DEAL_WON: '#22c55e', DEAL_LOST: '#ef4444',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActivityReportsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (agentFilter) params.set('agentId', agentFilter);

      const res = await fetch(`/api/admin/crm/activity-reports?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else toast.error('Failed to load activity reports');
    } catch {
      toast.error('Failed to load activity reports');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, agentFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportCSV = () => {
    if (!data?.agents?.length) return;
    const headers = ['Agent', 'Email', 'Calls', 'Emails', 'SMS', 'Meetings', 'Notes', 'Deals Created', 'Deals Won', 'Deals Lost', 'Total'];
    const rows = data.agents.map(a =>
      [a.name, a.email, a.CALL, a.EMAIL, a.SMS, a.MEETING, a.NOTE, a.DEAL_CREATED, a.DEAL_WON, a.DEAL_LOST, a.total].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const uniqueAgents = data?.agents?.map(a => ({ id: a.agentId, name: a.name })) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.crm.activityReports') || 'Activity Reports'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.activityReportsDesc') || 'Agent activity breakdown by type and date'}
          </p>
        </div>
        <button onClick={exportCSV} disabled={!data?.agents?.length}
          className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-sm border rounded-md px-3 py-2" aria-label="Date from" />
          <span className="text-gray-400">-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-sm border rounded-md px-3 py-2" aria-label="Date to" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            className="text-sm border rounded-md px-3 py-2" aria-label="Filter by agent">
            <option value="">All Agents</option>
            {uniqueAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {data && (
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <Activity className="h-4 w-4" />
            <span>{data.totalActivities} total activities</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {(['CALL', 'EMAIL', 'SMS', 'MEETING'] as const).map(type => {
              const Icon = ACTIVITY_ICONS[type] || Activity;
              const total = data?.agents?.reduce((s, a) => s + (a[type] || 0), 0) || 0;
              return (
                <div key={type} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
                    <Icon className="h-4 w-4" /> {type}s
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                </div>
              );
            })}
          </div>

          {/* Daily Chart */}
          <div className="bg-white rounded-xl border p-6 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Daily Activity Volume
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.dailySummary || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="Activities" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Agent Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Agent Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Agent</th>
                    {Object.keys(ACTIVITY_COLORS).map(type => (
                      <th key={type} className="text-right px-3 py-3 text-gray-500 font-medium text-xs">
                        {type.replace('_', ' ')}
                      </th>
                    ))}
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.agents || []).map(agent => (
                    <tr key={agent.agentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{agent.name}</p>
                        <p className="text-xs text-gray-400">{agent.email}</p>
                      </td>
                      {Object.keys(ACTIVITY_COLORS).map(type => (
                        <td key={type} className="text-right px-3 py-3 text-gray-700">
                          {agent[type as keyof AgentActivity] || 0}
                        </td>
                      ))}
                      <td className="text-right px-4 py-3 font-semibold text-gray-900">{agent.total}</td>
                    </tr>
                  ))}
                  {(data?.agents || []).length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No activities for this period</td></tr>
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

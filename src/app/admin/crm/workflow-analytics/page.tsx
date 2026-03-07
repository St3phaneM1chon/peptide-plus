'use client';

/**
 * CRM Workflow Analytics Dashboard (I14)
 *
 * Displays workflow execution statistics: total executions, success/failure rates,
 * average duration, per-workflow breakdown, error log, and charts.
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  RefreshCcw,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  summary: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    cancelled: number;
    successRate: number;
    failureRate: number;
    avgDurationMs: number;
  };
  byWorkflow: Array<{
    workflowId: string;
    workflowName: string;
    total: number;
    completed: number;
    failed: number;
    running: number;
    avgDurationMs: number;
  }>;
  recentErrors: Array<{
    executionId: string;
    workflowId: string;
    workflowName: string;
    error: string;
    startedAt: string;
    completedAt: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

type DateRange = '7d' | '30d' | '90d' | 'all';

function getDateRange(range: DateRange): { from?: string; to?: string } {
  if (range === 'all') return {};
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const from = new Date(now.getTime() - days * 86400000);
  return { from: from.toISOString(), to: now.toISOString() };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WorkflowAnalyticsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(dateRange);
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      const res = await fetch(`/api/admin/crm/workflow-analytics${qs ? `?${qs}` : ''}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error(json.error?.message || 'Failed to load analytics');
      }
    } catch {
      toast.error('Network error loading analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const s = data?.summary ?? {
    total: 0, completed: 0, failed: 0, running: 0, cancelled: 0,
    successRate: 0, failureRate: 0, avgDurationMs: 0,
  };

  // Chart data from per-workflow breakdown
  const chartData = (data?.byWorkflow ?? []).map(w => ({
    name: w.workflowName.length > 20 ? w.workflowName.slice(0, 18) + '...' : w.workflowName,
    completed: w.completed,
    failed: w.failed,
    running: w.running,
    successRate: w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('admin.crm.workflowAnalytics') || 'Workflow Analytics'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('admin.crm.workflowAnalyticsDesc') || 'Execution statistics and performance metrics'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range filter */}
          {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateRange === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r === 'all' ? 'All Time' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
          <button
            onClick={fetchData}
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
            title="Refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {t('admin.crm.totalExecutions') || 'Total'}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.total}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {t('admin.crm.successRate') || 'Success Rate'}
                </span>
              </div>
              <p className="text-2xl font-bold text-green-600">{s.successRate}%</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.completed} completed</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {t('admin.crm.failureRate') || 'Failure Rate'}
                </span>
              </div>
              <p className="text-2xl font-bold text-red-600">{s.failureRate}%</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.failed} failed</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-teal-500" />
                <span className="text-xs font-medium text-gray-500 uppercase">
                  {t('admin.crm.avgDuration') || 'Avg Duration'}
                </span>
              </div>
              <p className="text-2xl font-bold text-teal-600">{formatDuration(s.avgDurationMs)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.running} running</p>
            </div>
          </div>

          {/* Charts */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Executions bar chart */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  {t('admin.crm.executionsByWorkflow') || 'Executions by Workflow'}
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completed" fill="#22c55e" name="Completed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="running" fill="#3b82f6" name="Running" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Success rate line chart */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  {t('admin.crm.successRateByWorkflow') || 'Success Rate by Workflow'}
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Line type="monotone" dataKey="successRate" stroke="#22c55e" strokeWidth={2} name="Success %" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-workflow breakdown table */}
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                {t('admin.crm.perWorkflowBreakdown') || 'Per-Workflow Breakdown'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-4 py-2">Workflow</th>
                    <th className="px-4 py-2 text-center">Total</th>
                    <th className="px-4 py-2 text-center">Completed</th>
                    <th className="px-4 py-2 text-center">Failed</th>
                    <th className="px-4 py-2 text-center">Running</th>
                    <th className="px-4 py-2 text-center">Success %</th>
                    <th className="px-4 py-2 text-center">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byWorkflow ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                        No workflow executions found
                      </td>
                    </tr>
                  ) : (
                    (data?.byWorkflow ?? []).map(w => (
                      <tr key={w.workflowId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800 truncate max-w-[200px]">
                          {w.workflowName}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{w.total}</td>
                        <td className="px-4 py-2.5 text-center text-green-600 font-medium">{w.completed}</td>
                        <td className="px-4 py-2.5 text-center text-red-600 font-medium">{w.failed}</td>
                        <td className="px-4 py-2.5 text-center text-teal-600">{w.running}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            w.total > 0 && (w.completed / w.total) >= 0.9
                              ? 'bg-green-100 text-green-700'
                              : w.total > 0 && (w.completed / w.total) >= 0.5
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500">
                          {formatDuration(w.avgDurationMs)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent errors */}
          {(data?.recentErrors ?? []).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-gray-700">
                  {t('admin.crm.recentErrors') || 'Recent Errors'}
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data!.recentErrors.map(err => (
                  <div key={err.executionId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{err.workflowName}</span>
                      <span className="text-xs text-gray-400">{formatDate(err.startedAt)}</span>
                    </div>
                    <p className="text-xs text-red-600 font-mono bg-red-50 px-2 py-1 rounded">
                      {err.error}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

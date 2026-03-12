'use client';

/**
 * ADMIN - Cron Monitoring Dashboard
 *
 * T4-1: Real-time monitoring of all 34 cron jobs.
 * - Table with status, schedule, last run, duration, next run
 * - Color-coded status indicators
 * - Category filtering
 * - Manual trigger button
 * - Auto-refresh every 30 seconds
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  Filter,
  Activity,
  Loader2,
  CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ─────────────────────────────────────────────────────

interface CronJobStatus {
  name: string;
  label: string;
  description: string;
  category: string;
  categoryLabel: string;
  schedule: string;
  scheduleHuman: string;
  method: string;
  status: 'ok' | 'running' | 'error' | 'overdue' | 'never_ran';
  lastRunAt: string | null;
  lastDurationMs: number;
  totalRuns: number;
  totalErrors: number;
  errorRate: number;
  avgDurationMs: number;
  isHealthy: boolean;
  expectedIntervalMs: number;
  nextRunEstimate: string | null;
}

interface CronCategory {
  key: string;
  label: string;
  count: number;
}

interface CronSummary {
  totalJobs: number;
  okCount: number;
  runningCount: number;
  errorCount: number;
  overdueCount: number;
  neverRanCount: number;
}

interface CronStatusResponse {
  jobs: CronJobStatus[];
  categories: CronCategory[];
  summary: CronSummary;
  generatedAt: string;
}

// ── Status configuration ──────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  icon: typeof CheckCircle2;
  color: string;
  bg: string;
  border: string;
  label: string;
}> = {
  ok: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    label: 'OK',
  },
  running: {
    icon: Loader2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    label: 'Running',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'Error',
  },
  overdue: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: 'Overdue',
  },
  never_ran: {
    icon: CircleDot,
    color: 'text-slate-400',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    label: 'Never Ran',
  },
};

// ── Helpers ───────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function timeAgo(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 0) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function timeUntil(isoString: string | null): string {
  if (!isoString) return '-';
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return 'Now';
  if (diff < 60000) return `in ${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
  return `in ${Math.floor(diff / 86400000)}d`;
}

// ── Component ─────────────────────────────────────────────────

export default function CronMonitoringPage() {
  const [data, setData] = useState<CronStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // ── Fetch data ──────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crons/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: CronStatusResponse = await res.json();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cron status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  // ── Manual trigger ──────────────────────────────────────────

  const triggerCron = useCallback(async (name: string, label: string) => {
    setTriggeringJob(name);
    try {
      const res = await fetch('/api/admin/crons/trigger', {
        method: 'POST',
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ name }),
      });

      const result = await res.json();

      if (result.success) {
        toast.success(`${label} triggered successfully`, {
          description: `Completed in ${formatDuration(result.durationMs)}`,
        });
        // Refresh data after trigger
        setTimeout(fetchStatus, 1000);
      } else {
        toast.error(`${label} failed`, {
          description: result.response?.error || result.response?.reason || `HTTP ${result.httpStatus}`,
        });
      }
    } catch (err) {
      toast.error(`Failed to trigger ${label}`, {
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setTriggeringJob(null);
    }
  }, [fetchStatus]);

  // ── Filtering ───────────────────────────────────────────────

  const filteredJobs = useMemo(() => {
    if (!data) return [];
    let jobs = data.jobs;

    // Category filter
    if (selectedCategory !== 'all') {
      jobs = jobs.filter(j => j.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(j =>
        j.label.toLowerCase().includes(q) ||
        j.name.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      );
    }

    return jobs;
  }, [data, selectedCategory, searchQuery]);

  // ── Render ──────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-slate-500">Loading cron status...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={fetchStatus}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-500" />
            Cron Monitoring
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time status of all {summary?.totalJobs || 34} scheduled jobs
            {lastRefresh && (
              <span className="ml-2 text-xs text-slate-400">
                Updated {timeAgo(lastRefresh.toISOString())}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Auto-refresh 30s
          </label>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard
            label="Total"
            value={summary.totalJobs}
            icon={Activity}
            color="text-slate-600"
            bg="bg-slate-50"
          />
          <SummaryCard
            label="OK"
            value={summary.okCount}
            icon={CheckCircle2}
            color="text-green-600"
            bg="bg-green-50"
          />
          <SummaryCard
            label="Running"
            value={summary.runningCount}
            icon={Loader2}
            color="text-blue-600"
            bg="bg-blue-50"
          />
          <SummaryCard
            label="Errors"
            value={summary.errorCount}
            icon={XCircle}
            color="text-red-600"
            bg="bg-red-50"
          />
          <SummaryCard
            label="Overdue"
            value={summary.overdueCount}
            icon={AlertTriangle}
            color="text-amber-600"
            bg="bg-amber-50"
          />
          <SummaryCard
            label="Never Ran"
            value={summary.neverRanCount}
            icon={CircleDot}
            color="text-slate-400"
            bg="bg-slate-50"
          />
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cron jobs..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          />
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          <CategoryPill
            label="All"
            count={data?.summary.totalJobs || 0}
            active={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
          />
          {data?.categories
            .filter(c => c.count > 0)
            .map(cat => (
              <CategoryPill
                key={cat.key}
                label={cat.label}
                count={cat.count}
                active={selectedCategory === cat.key}
                onClick={() => setSelectedCategory(cat.key)}
              />
            ))}
        </div>
      </div>

      {/* ── Cron jobs table ────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                <th className="text-start px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="text-start px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Cron Job</th>
                <th className="text-start px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden lg:table-cell">Category</th>
                <th className="text-start px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Schedule</th>
                <th className="text-start px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Last Run</th>
                <th className="text-end px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden md:table-cell">Duration</th>
                <th className="text-end px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden xl:table-cell">Runs</th>
                <th className="text-end px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden xl:table-cell">Errors</th>
                <th className="text-start px-4 py-3 font-medium text-slate-500 dark:text-slate-400 hidden lg:table-cell">Next Run</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    {searchQuery || selectedCategory !== 'all'
                      ? 'No cron jobs match the current filters.'
                      : 'No cron job data available.'
                    }
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <CronJobRow
                    key={job.name}
                    job={job}
                    isTriggering={triggeringJob === job.name}
                    onTrigger={() => triggerCron(job.name, job.label)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer note ────────────────────────────────────── */}
      <p className="text-xs text-slate-400 text-center">
        Stats are tracked via Redis (persistent) with in-memory fallback. Cron execution data resets after 7 days of inactivity.
      </p>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${bg} dark:bg-slate-800`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function CategoryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
      }`}
    >
      {label} ({count})
    </button>
  );
}

function CronJobRow({
  job,
  isTriggering,
  onTrigger,
}: {
  job: CronJobStatus;
  isTriggering: boolean;
  onTrigger: () => void;
}) {
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.never_ran;
  const StatusIcon = config.icon;

  return (
    <tr className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      {/* Status badge */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} ${config.border} border`}>
          <StatusIcon className={`w-3 h-3 ${job.status === 'running' ? 'animate-spin' : ''}`} />
          {config.label}
        </span>
      </td>

      {/* Job name + description */}
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800 dark:text-slate-200">{job.label}</div>
        <div className="text-xs text-slate-400 mt-0.5 hidden sm:block">{job.description}</div>
      </td>

      {/* Category */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-slate-500 dark:text-slate-400">{job.categoryLabel}</span>
      </td>

      {/* Schedule */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-slate-700 dark:text-slate-300">{job.scheduleHuman}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{job.schedule}</div>
      </td>

      {/* Last Run */}
      <td className="px-4 py-3">
        <div className="text-slate-700 dark:text-slate-300">{timeAgo(job.lastRunAt)}</div>
        {job.lastRunAt && (
          <div className="text-[10px] text-slate-400 mt-0.5">
            {new Date(job.lastRunAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </td>

      {/* Duration */}
      <td className="px-4 py-3 text-end hidden md:table-cell">
        <div className="flex items-center justify-end gap-1.5">
          <Timer className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 dark:text-slate-300">{formatDuration(job.lastDurationMs)}</span>
        </div>
        {job.avgDurationMs > 0 && (
          <div className="text-[10px] text-slate-400 mt-0.5">
            avg {formatDuration(job.avgDurationMs)}
          </div>
        )}
      </td>

      {/* Total Runs */}
      <td className="px-4 py-3 text-end hidden xl:table-cell">
        <span className="text-slate-600 dark:text-slate-300">{job.totalRuns.toLocaleString()}</span>
      </td>

      {/* Errors */}
      <td className="px-4 py-3 text-end hidden xl:table-cell">
        {job.totalErrors > 0 ? (
          <span className="text-red-600 font-medium">
            {job.totalErrors} ({job.errorRate}%)
          </span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>

      {/* Next Run */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-slate-500 dark:text-slate-400">{timeUntil(job.nextRunEstimate)}</span>
      </td>

      {/* Trigger button */}
      <td className="px-4 py-3 text-center">
        <button
          onClick={onTrigger}
          disabled={isTriggering || job.status === 'running'}
          title={`Trigger ${job.label} manually`}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400"
        >
          {isTriggering ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">{isTriggering ? 'Running...' : 'Run'}</span>
        </button>
      </td>
    </tr>
  );
}

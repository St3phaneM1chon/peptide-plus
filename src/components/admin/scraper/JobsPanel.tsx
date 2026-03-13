'use client';

/**
 * JobsPanel — Bottom panel showing scrape job queue with progress bars and status.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';
import type { ScrapeJobInfo } from './types';

interface JobsPanelProps {
  visible: boolean;
  onClose: () => void;
}

interface JobNotification {
  id: string;
  message: string;
  type: 'completed' | 'failed';
}

export default function JobsPanel({ visible, onClose }: JobsPanelProps) {
  const { t } = useTranslations();
  const [jobs, setJobs] = useState<ScrapeJobInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<JobNotification[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const prevStatusesRef = useRef<Record<string, string>>({});

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scraper/jobs?pageSize=10');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        const newJobs: ScrapeJobInfo[] = data.data.map((j: Record<string, unknown>) => ({
          id: j.id,
          status: j.status,
          query: j.query,
          engine: j.engine,
          totalFound: j.totalFound,
          totalImported: j.totalImported,
          totalDupes: j.totalDupes,
          errorLog: j.errorLog,
          progress: j.progress ?? 0,
          region: j.region,
          prospectListId: j.prospectListId,
          startedAt: j.startedAt,
          completedAt: j.completedAt,
          createdAt: j.createdAt,
        }));

        // Detect job status transitions (running/pending -> completed/failed)
        const prev = prevStatusesRef.current;
        const newNotifications: JobNotification[] = [];
        for (const job of newJobs) {
          const prevStatus = prev[job.id as string];
          if (
            prevStatus &&
            (prevStatus === 'running' || prevStatus === 'pending') &&
            (job.status === 'completed' || job.status === 'failed')
          ) {
            newNotifications.push({
              id: `${job.id}-${Date.now()}`,
              message:
                job.status === 'completed'
                  ? `${t('admin.scraper.jobCompleted')}: ${job.query}`
                  : `${t('admin.scraper.jobFailed')}: ${job.query}`,
              type: job.status as 'completed' | 'failed',
            });
          }
        }
        if (newNotifications.length > 0) {
          setNotifications((n) => [...n, ...newNotifications]);
        }

        // Update previous statuses map
        const statusMap: Record<string, string> = {};
        for (const job of newJobs) {
          statusMap[job.id as string] = job.status as string;
        }
        prevStatusesRef.current = statusMap;

        setJobs(newJobs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Initial fetch + polling for running jobs (only when visible)
  useEffect(() => {
    if (!visible) return;
    fetchJobs();

    const interval = setInterval(() => {
      if (jobsRef.current.some(j => j.status === 'running' || j.status === 'pending')) {
        fetchJobs();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [visible, fetchJobs]);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications((n) => n.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [notifications]);

  const handleCancel = async (jobId: string) => {
    try {
      await fetch(`/api/admin/scraper/jobs/${jobId}`, { method: 'DELETE' });
      fetchJobs();
    } catch {
      setError('Failed to cancel job');
    }
  };

  const handleRetry = async (job: ScrapeJobInfo) => {
    try {
      await fetch('/api/admin/scraper/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: job.query,
          engine: job.engine,
          region: job.region,
          prospectListId: job.prospectListId,
        }),
      });
      fetchJobs();
    } catch {
      setError('Failed to retry job');
    }
  };

  if (!visible) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-3.5 w-3.5 text-zinc-400" />;
      case 'running': return <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />;
      case 'completed': return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case 'cancelled': return <Ban className="h-3.5 w-3.5 text-zinc-500" />;
      default: return null;
    }
  };

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700/50 bg-gray-100/80 dark:bg-zinc-800/80 max-h-48 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-700/30">
        <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {t('admin.scraper.jobsPipeline')} ({jobs.length})
        </h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <div className="px-4 py-1.5 text-[10px] text-red-400 bg-red-900/20 border-b border-red-800/30">
          {error}
        </div>
      )}

      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`px-4 py-1.5 text-[10px] border-b flex items-center justify-between ${
            notif.type === 'completed'
              ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/30'
              : 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {notif.type === 'completed' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {notif.message}
          </span>
          <button
            onClick={() => setNotifications((n) => n.filter((x) => x.id !== notif.id))}
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

      {loading && jobs.length === 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        </div>
      )}

      {jobs.length === 0 && !loading && (
        <div className="text-center py-4 text-xs text-zinc-500">
          {t('admin.scraper.noJobs')}
        </div>
      )}

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
        {jobs.map(job => (
          <div key={job.id} className="px-4 py-2 flex items-center gap-3">
            {/* Status icon */}
            {statusIcon(job.status)}

            {/* Job info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-900 dark:text-white truncate">{job.query}</span>
                <span className="text-[10px] text-zinc-500 uppercase">{job.engine}</span>
              </div>

              {/* Progress bar for running jobs */}
              {(job.status === 'running' || job.status === 'pending') && (
                <div className="mt-1 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              )}

              {/* Stats for completed jobs */}
              {job.status === 'completed' && (
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {job.totalFound} {t('admin.scraper.found')} / {job.totalImported} {t('admin.scraper.imported')} / {job.totalDupes} {t('admin.scraper.dupes')}
                </div>
              )}

              {/* Error for failed jobs */}
              {job.status === 'failed' && job.errorLog && (
                <div className="text-[10px] text-red-400 mt-0.5 truncate">{job.errorLog}</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {(job.status === 'running' || job.status === 'pending') && (
                <button
                  onClick={() => handleCancel(job.id)}
                  className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  title={t('admin.scraper.cancelJob')}
                >
                  <Ban className="h-3 w-3" />
                </button>
              )}
              {job.status === 'failed' && (
                <button
                  onClick={() => handleRetry(job)}
                  className="p-1 rounded text-zinc-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                  title={t('admin.scraper.retryJob')}
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import {
  Download, RefreshCw, Loader2, CheckCircle2, XCircle, Clock,
  AlertCircle, SkipForward, Play, Video, FileCheck, Filter,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportRecord {
  id: string;
  platform: string;
  externalId: string;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingDate: string | null;
  hostEmail: string | null;
  duration: number | null;
  status: string;
  error: string | null;
  videoId: string | null;
  videoTitle: string | null;
  videoStatus: string | null;
  hasFeaturedClient: boolean;
  consentStatus: string | null;
  consentAutoCreated: boolean;
  fileSize: number | null;
  createdAt: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  teams: 'Teams',
  'google-meet': 'Meet',
  webex: 'Webex',
};

const STATUS_STYLES: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
  pending: { icon: <Clock className="h-3 w-3" />, bg: 'bg-gray-100', text: 'text-gray-700' },
  downloading: { icon: <Download className="h-3 w-3 animate-pulse" />, bg: 'bg-blue-100', text: 'text-blue-700' },
  processing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { icon: <CheckCircle2 className="h-3 w-3" />, bg: 'bg-green-100', text: 'text-green-700' },
  failed: { icon: <XCircle className="h-3 w-3" />, bg: 'bg-red-100', text: 'text-red-700' },
  skipped: { icon: <SkipForward className="h-3 w-3" />, bg: 'bg-gray-100', text: 'text-gray-500' },
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

export default function RecordingImportsPage() {
  const { t } = useI18n();
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadImports = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterStatus) params.set('status', filterStatus);

      const res = await fetch(`/api/admin/recording-imports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setImports(data.imports);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load imports:', err);
      toast.error(t('admin.recordingImports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [page, filterPlatform, filterStatus, t]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/recording-imports/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        const totalNew = data.results?.reduce((s: number, r: { newCount: number }) => s + r.newCount, 0) ?? data.newCount ?? 0;
        toast.success(t('admin.platformConnections.syncSuccess') + ` (${totalNew} new)`);
        loadImports();
      } else {
        toast.error(t('admin.platformConnections.syncError'));
      }
    } catch {
      toast.error(t('admin.platformConnections.syncError'));
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/recording-imports/${id}/import`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.recordingImports.importSuccess'));
        loadImports();
      } else {
        toast.error(data.error || t('admin.recordingImports.importError'));
      }
    } catch {
      toast.error(t('admin.recordingImports.importError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (id: string, action: 'skip' | 'retry') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/recording-imports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        loadImports();
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkImport = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading('bulk');
    try {
      const res = await fetch('/api/admin/recording-imports/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.succeeded} imported, ${data.failed} failed`);
        setSelectedIds(new Set());
        loadImports();
      }
    } catch {
      toast.error('Bulk import failed');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingIds = imports.filter((i) => i.status === 'pending').map((i) => i.id);
    if (pendingIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.recordingImports.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('admin.recordingImports.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkImport}
              disabled={actionLoading === 'bulk'}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading === 'bulk' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('admin.recordingImports.bulkImport')} ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('admin.platformConnections.syncNow')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={filterPlatform}
            onChange={(e) => { setFilterPlatform(e.target.value); setPage(1); }}
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">{t('admin.recordingImports.filterAll')} - {t('admin.recordingImports.filterPlatform')}</option>
            {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">{t('admin.recordingImports.filterAll')} - Status</option>
            {Object.keys(STATUS_STYLES).map((s) => (
              <option key={s} value={s}>{t(`admin.recordingImports.status.${s}`)}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500">
          {total} {t('admin.platformConnections.imports')}
        </span>
      </div>

      {/* Empty State */}
      {imports.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Video className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {t('admin.recordingImports.noImports')}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {t('admin.recordingImports.noImportsDesc')}
          </p>
          <Link
            href="/admin/media/connections"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('admin.platformConnections.title')}
          </Link>
        </div>
      )}

      {/* Table */}
      {imports.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={imports.filter((i) => i.status === 'pending').every((i) => selectedIds.has(i.id))}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('admin.recordingImports.filterPlatform')}
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Meeting
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Duration
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Consent
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {imports.map((imp) => {
                const statusStyle = STATUS_STYLES[imp.status] || STATUS_STYLES.pending;
                return (
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      {imp.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(imp.id)}
                          onChange={() => toggleSelect(imp.id)}
                          className="rounded border-gray-300"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {PLATFORM_LABELS[imp.platform] || imp.platform}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-sm text-gray-900">
                      {imp.meetingTitle || imp.externalId}
                      {imp.hostEmail && (
                        <div className="text-xs text-gray-500">{imp.hostEmail}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {imp.meetingDate
                        ? new Date(imp.meetingDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {imp.duration ? formatDuration(imp.duration) : '-'}
                      {imp.fileSize && (
                        <div className="text-xs text-gray-400">{formatFileSize(imp.fileSize)}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {statusStyle.icon}
                        {t(`admin.recordingImports.status.${imp.status}`)}
                      </span>
                      {imp.error && (
                        <div className="mt-1 flex items-start gap-1 text-xs text-red-600">
                          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          <span className="truncate max-w-[150px]">{imp.error}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {imp.consentAutoCreated && imp.consentStatus && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            imp.consentStatus === 'GRANTED'
                              ? 'bg-green-100 text-green-700'
                              : imp.consentStatus === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          <FileCheck className="h-3 w-3" />
                          {imp.consentStatus === 'GRANTED'
                            ? t('admin.recordingImports.consentGranted')
                            : t('admin.recordingImports.consentRequired')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {imp.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleImport(imp.id)}
                              disabled={actionLoading === imp.id}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              {actionLoading === imp.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              {t('admin.recordingImports.importAction')}
                            </button>
                            <button
                              onClick={() => handleAction(imp.id, 'skip')}
                              disabled={actionLoading === imp.id}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <SkipForward className="h-3 w-3" />
                              {t('admin.recordingImports.skipAction')}
                            </button>
                          </>
                        )}
                        {imp.status === 'failed' && (
                          <button
                            onClick={() => handleAction(imp.id, 'retry')}
                            disabled={actionLoading === imp.id}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {t('admin.recordingImports.retryAction')}
                          </button>
                        )}
                        {imp.status === 'completed' && imp.videoId && (
                          <Link
                            href={`/admin/media/videos/${imp.videoId}`}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                          >
                            <Video className="h-3 w-3" />
                            {t('admin.recordingImports.viewVideo')}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-500">
                Page {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

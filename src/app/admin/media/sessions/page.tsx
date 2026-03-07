'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  Video, Plus, RefreshCw, Search, Filter, Clock, Play,
  CheckCircle2, XCircle, ExternalLink, Copy, X, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoSessionRecord {
  id: string;
  platform: string;
  topic: string;
  contentType: string;
  status: string;
  scheduledAt: string;
  duration: number;
  startedAt: string | null;
  endedAt: string | null;
  meetingId: string | null;
  hostJoinUrl: string | null;
  clientJoinUrl: string | null;
  password: string | null;
  notes: string | null;
  client: { id: string; name: string | null; email: string } | null;
  createdBy: { id: string; name: string | null };
  video: { id: string; title: string; slug: string } | null;
}

interface PlatformConnection {
  platform: string;
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  teams: 'Teams',
  'google-meet': 'Google Meet',
  webex: 'Webex',
};

const PLATFORM_COLORS: Record<string, string> = {
  zoom: 'bg-teal-100 text-teal-700',
  teams: 'bg-purple-100 text-purple-700',
  'google-meet': 'bg-green-100 text-green-700',
  webex: 'bg-cyan-100 text-cyan-700',
};

const STATUS_STYLES: Record<string, { icon: React.ReactNode; classes: string }> = {
  SCHEDULED: { icon: <Clock className="h-3 w-3" />, classes: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { icon: <Play className="h-3 w-3" />, classes: 'bg-teal-100 text-teal-700' },
  COMPLETED: { icon: <CheckCircle2 className="h-3 w-3" />, classes: 'bg-green-100 text-green-700' },
  CANCELLED: { icon: <XCircle className="h-3 w-3" />, classes: 'bg-gray-100 text-gray-500' },
};

const CONTENT_TYPES = [
  'PODCAST', 'TRAINING', 'PERSONAL_SESSION', 'PRODUCT_DEMO',
  'TESTIMONIAL', 'FAQ_VIDEO', 'WEBINAR_RECORDING', 'TUTORIAL',
  'BRAND_STORY', 'LIVE_STREAM', 'OTHER',
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function VideoSessionsPage() {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<VideoSessionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  // ---- Fetch Sessions ----
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterPlatform) params.set('platform', filterPlatform);
      if (filterStatus) params.set('status', filterStatus);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/video-sessions?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error(t('admin.videoSessions.createError') || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [page, filterPlatform, filterStatus, searchQuery, t]);

  // ---- Fetch Connected Platforms ----
  useEffect(() => {
    fetch('/api/admin/platform-connections')
      .then((res) => res.ok ? res.json() : [])
      .then((platforms: PlatformConnection[]) => {
        setConnectedPlatforms(
          (platforms || [])
            .filter((p) => p.isEnabled && Object.keys(PLATFORM_LABELS).includes(p.platform))
            .map((p) => p.platform)
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ---- Actions ----
  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/video-sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('admin.videoSessions.cancelSuccess') || 'Session cancelled');
      loadSessions();
    } catch {
      toast.error('Failed to cancel session');
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t('admin.videoSessions.linkCopied') || 'Link copied');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title={t('admin.videoSessions.title') || 'Video Sessions'}
        subtitle={t('admin.videoSessions.subtitle') || 'Manage video sessions with clients'}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadSessions}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('admin.videoSessions.newSession') || 'New Session'}
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
        </div>
        <select
          value={filterPlatform}
          onChange={(e) => { setFilterPlatform(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="">{t('admin.videoSessions.platform') || 'Platform'}</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <option value="">{t('admin.videoSessions.status.SCHEDULED') ? 'Status' : 'Status'}</option>
          {['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
            <option key={s} value={s}>{t(`admin.videoSessions.status.${s}`) || s}</option>
          ))}
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={t('admin.videoSessions.selectClient') || 'Search...'}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total} sessions</span>
      </div>

      {/* Table */}
      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t('admin.videoSessions.noSessions') || 'No video sessions yet'}</p>
          <p className="text-gray-400 text-sm mt-1">{t('admin.videoSessions.noSessionsDesc')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">{t('admin.videoSessions.scheduledAt') || 'Date'}</th>
                  <th className="px-4 py-3">{t('admin.videoSessions.platform') || 'Platform'}</th>
                  <th className="px-4 py-3">{t('admin.videoSessions.topic') || 'Subject'}</th>
                  <th className="px-4 py-3">{t('admin.videoSessions.client') || 'Client'}</th>
                  <th className="px-4 py-3">{t('admin.videoSessions.contentType') || 'Type'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => {
                  const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.SCHEDULED;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {new Date(s.scheduledAt).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLORS[s.platform] || 'bg-gray-100 text-gray-600'}`}>
                          {PLATFORM_LABELS[s.platform] || s.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate">
                        {s.topic}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.client ? (
                          <div>
                            <div className="font-medium text-gray-800">{s.client.name || s.client.email}</div>
                            {s.client.name && (
                              <div className="text-xs text-gray-400">{s.client.email}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{s.contentType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusStyle.classes}`}>
                          {statusStyle.icon}
                          {t(`admin.videoSessions.status.${s.status}`) || s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {s.hostJoinUrl && s.status !== 'CANCELLED' && s.status !== 'COMPLETED' && (
                            <a
                              href={s.hostJoinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                              title={t('admin.videoSessions.join') || 'Join'}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          {s.clientJoinUrl && (
                            <button
                              onClick={() => copyToClipboard(s.clientJoinUrl!)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                              title={t('admin.videoSessions.copyLink') || 'Copy client link'}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {s.video && (
                            <a
                              href={`/admin/media/videos/${s.video.slug}`}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title={t('admin.videoSessions.viewRecording') || 'View Recording'}
                            >
                              <Video className="w-4 h-4" />
                            </a>
                          )}
                          {s.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleCancel(s.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title={t('admin.videoSessions.cancel') || 'Cancel'}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
              <span className="text-gray-500">
                Page {page} / {totalPages} ({total} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Session Modal */}
      {showModal && (
        <CreateSessionModal
          connectedPlatforms={connectedPlatforms}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadSessions(); }}
          t={t}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Session Modal
// ---------------------------------------------------------------------------

function CreateSessionModal({
  connectedPlatforms,
  onClose,
  onCreated,
  t,
}: {
  connectedPlatforms: string[];
  onClose: () => void;
  onCreated: () => void;
  t: (key: string) => string;
}) {
  const [platform, setPlatform] = useState('');
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState('OTHER');
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string | null; email: string } | null>(null);
  const [duration, setDuration] = useState(30);
  const [scheduledAt, setScheduledAt] = useState('');
  const [startNow, setStartNow] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Client search
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(clientSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setClientResults(data.customers || data || []);
          setShowClientDropdown(true);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timeout);
  }, [clientSearch]);

  const handleSubmit = async () => {
    if (!platform || !topic) {
      toast.error('Platform and subject are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/video-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          topic,
          contentType,
          clientId: clientId || undefined,
          scheduledAt: startNow ? undefined : scheduledAt || undefined,
          duration,
          notes: notes || undefined,
          startNow,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create session');
      }

      toast.success(t('admin.videoSessions.createSuccess') || 'Session created successfully');
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('admin.videoSessions.newSession') || 'New Session'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.videoSessions.platform') || 'Platform'} *
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{t('admin.videoSessions.selectPlatform') || 'Select a platform'}</option>
              {(connectedPlatforms.length > 0 ? connectedPlatforms : Object.keys(PLATFORM_LABELS)).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p] || p}</option>
              ))}
            </select>
            {connectedPlatforms.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No connected platforms detected — connect one in Media &gt; Connections</p>
            )}
          </div>

          {/* Client Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.videoSessions.client') || 'Client'}
            </label>
            {selectedClient ? (
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50">
                <span className="flex-1">{selectedClient.name || selectedClient.email}</span>
                <button
                  onClick={() => { setSelectedClient(null); setClientId(''); setClientSearch(''); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                onFocus={() => clientResults.length > 0 && setShowClientDropdown(true)}
                placeholder={t('admin.videoSessions.selectClient') || 'Search for a client'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            )}
            {showClientDropdown && clientResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clientResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c);
                      setClientId(c.id);
                      setClientSearch('');
                      setShowClientDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <div className="font-medium text-gray-800">{c.name || c.email}</div>
                    {c.name && <div className="text-xs text-gray-400">{c.email}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.videoSessions.topic') || 'Subject'} *
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Session topic..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.videoSessions.contentType') || 'Content Type'}
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>{ct.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.videoSessions.duration') || 'Duration'} ({t('admin.videoSessions.minutes') || 'minutes'})
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10) || 30)}
              min={5}
              max={480}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Start Now / Schedule */}
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={startNow}
                onChange={(e) => setStartNow(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              {t('admin.videoSessions.startNow') || 'Start Now'}
            </label>
          </div>

          {!startNow && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.videoSessions.scheduledAt') || 'Scheduled At'}
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.videoSessions.notes') || 'Notes'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            {t('admin.videoSessions.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !platform || !topic}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('admin.videoSessions.newSession') || 'Create Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Webhook,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Play,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageHeader, StatCard, Button } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ─────────────────────────────────────────────────────

interface WebhookEndpoint {
  id: string;
  url: string;
  name: string | null;
  active: boolean;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: unknown;
  status: number;
  response: string | null;
  duration: number | null;
  attempts: number;
  lastAttempt: string | null;
  createdAt: string;
  endpoint: WebhookEndpoint;
}

interface DeliveryStats {
  totalDeliveries: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  avgDurationMs: number;
}

interface WebhookEvent {
  event: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeColor(status: number): string {
  if (status === 0) return 'bg-amber-100 text-amber-700';
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-700';
  if (status >= 400) return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function statusLabel(status: number): string {
  if (status === 0) return 'En attente';
  return `${status}`;
}

// ── Main Component ────────────────────────────────────────────

export default function WebhooksPage() {
  const { t: _t, locale } = useI18n();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ─── Data fetching ──────────────────────────────────────────

  const fetchDeliveries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (statusFilter) params.set('status', statusFilter);
      if (eventFilter) params.set('event', eventFilter);

      const res = await fetch(`/api/admin/webhooks/deliveries?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setDeliveries(data.data || []);
      setStats(data.stats || null);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error fetching webhook deliveries:', err);
      toast.error('Erreur lors du chargement des livraisons webhook');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, eventFilter]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/webhooks/events');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // Non-critical, events list is supplementary
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ─── Actions ────────────────────────────────────────────────

  const handleReplay = useCallback(async (deliveryId: string) => {
    setReplayingId(deliveryId);
    try {
      const res = await fetch(`/api/admin/webhooks/replay/${deliveryId}`, {
        method: 'POST',
        headers: addCSRFHeader(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Replay reussi: ${data.status}`);
        fetchDeliveries();
      } else {
        toast.error(data.error || 'Echec du replay');
      }
    } catch {
      toast.error('Erreur lors du replay');
    } finally {
      setReplayingId(null);
    }
  }, [fetchDeliveries]);

  // ─── Render ─────────────────────────────────────────────────

  if (loading && deliveries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        subtitle="Livraisons, evenements et monitoring des webhooks sortants"
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => { setLoading(true); fetchDeliveries(); }}>
            Actualiser
          </Button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total livraisons" value={stats.totalDeliveries} icon={Webhook} />
          <StatCard
            label="Reussies"
            value={stats.successCount}
            icon={CheckCircle}
            className="bg-green-50 border-green-200"
          />
          <StatCard
            label="Echouees"
            value={stats.failedCount}
            icon={XCircle}
            className={stats.failedCount > 0 ? 'bg-red-50 border-red-200' : ''}
          />
          <StatCard
            label="Taux de succes"
            value={`${stats.successRate}%`}
            icon={CheckCircle}
            className={stats.successRate >= 95 ? 'bg-green-50 border-green-200' : stats.successRate >= 80 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}
          />
          <StatCard
            label="Duree moy."
            value={stats.avgDurationMs > 0 ? `${Math.round(stats.avgDurationMs)}ms` : '-'}
            icon={Clock}
          />
        </div>
      )}

      {/* Available Events */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)] p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Evenements disponibles ({events.length})
        </h3>
        {eventsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {events.map((evt) => (
              <button
                key={evt.event}
                onClick={() => {
                  setEventFilter(eventFilter === evt.event ? '' : evt.event);
                  setPage(1);
                }}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  eventFilter === evt.event
                    ? 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={evt.description}
              >
                {evt.event}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-500 font-medium">Filtrer par statut:</span>
        {[
          { value: '', label: 'Tous' },
          { value: '200', label: '2xx OK' },
          { value: '0', label: 'En attente' },
          { value: '400', label: '4xx Erreur' },
          { value: '500', label: '5xx Erreur' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
        {eventFilter && (
          <span className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium">
            {eventFilter}
            <button onClick={() => { setEventFilter(''); setPage(1); }} className="ml-1 hover:text-indigo-900">&times;</button>
          </span>
        )}
      </div>

      {/* Deliveries List */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-[var(--k-border-subtle)]">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-slate-600">Evenement</th>
                <th className="px-4 py-3 text-start font-medium text-slate-600">Endpoint</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Statut</th>
                <th className="px-4 py-3 text-end font-medium text-slate-600">Duree</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Tentatives</th>
                <th className="px-4 py-3 text-end font-medium text-slate-600">Date</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deliveries.map((d) => (
                <Fragment key={d.id}>
                  <tr
                    className="hover:bg-white/5 cursor-pointer"
                    onClick={() => setExpandedDeliveryId(expandedDeliveryId === d.id ? null : d.id)}
                  >
                    <td className="px-4 py-3">
                      <code className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                        {d.event}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 max-w-[250px]">
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-600 truncate text-xs" title={d.endpoint.url}>
                          {d.endpoint.name || d.endpoint.url}
                        </span>
                        {!d.endpoint.active && (
                          <span className="px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">inactif</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor(d.status)}`}>
                        {statusLabel(d.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-slate-500">
                      {d.duration != null ? `${d.duration}ms` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {d.attempts}
                    </td>
                    <td className="px-4 py-3 text-end text-slate-500 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReplay(d.id); }}
                          disabled={replayingId === d.id}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                          title="Rejouer"
                        >
                          {replayingId === d.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedDeliveryId(expandedDeliveryId === d.id ? null : d.id); }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                          title="Details"
                        >
                          {expandedDeliveryId === d.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedDeliveryId === d.id && (
                    <tr key={`${d.id}-detail`}>
                      <td colSpan={7} className="px-4 py-4 bg-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Payload</h4>
                            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto max-h-48">
                              {JSON.stringify(d.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Reponse</h4>
                            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto max-h-48">
                              {d.response || 'Aucune reponse'}
                            </pre>
                            <div className="mt-3 space-y-1 text-xs text-slate-500">
                              <p>Endpoint: <code className="bg-slate-100 px-1 rounded">{d.endpoint.url}</code></p>
                              <p>Derniere tentative: {d.lastAttempt ? new Date(d.lastAttempt).toLocaleString(locale) : '-'}</p>
                              <p>ID: <code className="bg-slate-100 px-1 rounded">{d.id}</code></p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {deliveries.length === 0 && !loading && (
          <div className="py-16 text-center">
            <Webhook className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Aucune livraison webhook</p>
            <p className="text-xs text-slate-400 mt-1">
              Les livraisons apparaitront ici lorsque des webhooks seront declenches.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[var(--k-border-subtle)] flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page {page} sur {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Precedent
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * WebhooksClient - Webhook management UI for external system integrations.
 * Configure webhooks with URL, event subscriptions, secrets, and test deliveries.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Webhook,
  Plus,
  Trash2,
  Pencil,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  X,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeliveryLogEntry {
  id: string;
  event: string;
  status: string;
  statusCode: number | null;
  timestamp: string;
}

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  lastDeliveryStatus: string | null;
  lastDeliveryAt: string | null;
  deliveryLog: DeliveryLogEntry[];
}

const WEBHOOK_EVENTS = [
  'call.started',
  'call.ended',
  'call.missed',
  'voicemail.new',
  'recording.ready',
  'queue.joined',
  'queue.abandoned',
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WebhooksClient({
  initialWebhooks,
}: {
  initialWebhooks: WebhookConfig[];
}) {
  const { t, locale } = useI18n();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(initialWebhooks);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Form state
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSecret, setFormSecret] = useState('');
  const [formActive, setFormActive] = useState(true);

  // ------ Helpers ------

  const resetForm = useCallback(() => {
    setFormUrl('');
    setFormEvents([]);
    setFormSecret('');
    setFormActive(true);
    setEditingId(null);
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, [resetForm]);

  const openEdit = useCallback((wh: WebhookConfig) => {
    setFormUrl(wh.url);
    setFormEvents([...wh.events]);
    setFormSecret(wh.secret);
    setFormActive(wh.active);
    setEditingId(wh.id);
    setShowModal(true);
  }, []);

  const toggleEvent = useCallback((event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }, []);

  // ------ Persist to SiteSetting via API ------

  const persistWebhooks = useCallback(
    async (updated: WebhookConfig[]) => {
      try {
        const res = await fetch('/api/admin/voip/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteSettingKey: 'voip:webhook_configs',
            siteSettingModule: 'voip',
            value: JSON.stringify(updated),
          }),
        });
        if (!res.ok) throw new Error('Failed to save');
        setWebhooks(updated);
        return true;
      } catch {
        toast.error(t('voip.enterprise.webhooks') + ': Save failed');
        return false;
      }
    },
    [t],
  );

  // ------ Save (Add / Edit) ------

  const handleSave = useCallback(async () => {
    if (!formUrl || formEvents.length === 0) {
      toast.error('URL and at least one event are required');
      return;
    }

    setSaving(true);
    try {
      let updated: WebhookConfig[];

      if (editingId) {
        // Update existing
        updated = webhooks.map((wh) =>
          wh.id === editingId
            ? { ...wh, url: formUrl, events: formEvents, secret: formSecret, active: formActive }
            : wh,
        );
      } else {
        // Add new
        const newWh: WebhookConfig = {
          id: crypto.randomUUID(),
          url: formUrl,
          events: formEvents,
          secret: formSecret || crypto.randomUUID().replace(/-/g, ''),
          active: formActive,
          lastDeliveryStatus: null,
          lastDeliveryAt: null,
          deliveryLog: [],
        };
        updated = [...webhooks, newWh];
      }

      const ok = await persistWebhooks(updated);
      if (ok) {
        toast.success(editingId ? 'Webhook updated' : 'Webhook added');
        setShowModal(false);
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  }, [formUrl, formEvents, formSecret, formActive, editingId, webhooks, persistWebhooks, resetForm]);

  // ------ Toggle active ------

  const handleToggleActive = useCallback(
    async (id: string) => {
      const updated = webhooks.map((wh) =>
        wh.id === id ? { ...wh, active: !wh.active } : wh,
      );
      await persistWebhooks(updated);
    },
    [webhooks, persistWebhooks],
  );

  // ------ Delete ------

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id);
      const updated = webhooks.filter((wh) => wh.id !== id);
      const ok = await persistWebhooks(updated);
      if (ok) {
        toast.success('Webhook deleted');
      }
      setDeleting(null);
    },
    [webhooks, persistWebhooks],
  );

  // ------ Test webhook ------

  const handleTest = useCallback(
    async (wh: WebhookConfig) => {
      setTesting(wh.id);
      try {
        const testPayload = {
          event: 'test.ping',
          timestamp: new Date().toISOString(),
          data: { message: 'Test webhook delivery from BioCycle Peptides VoIP', webhookId: wh.id },
          webhookId: wh.id,
        };

        const res = await fetch('/api/admin/voip/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'test_webhook',
            webhookUrl: wh.url,
            webhookSecret: wh.secret,
            payload: testPayload,
          }),
        });

        const result = await res.json();
        const deliveryEntry: DeliveryLogEntry = {
          id: crypto.randomUUID(),
          event: 'test.ping',
          status: res.ok ? 'success' : 'failed',
          statusCode: result.statusCode ?? (res.ok ? 200 : 500),
          timestamp: new Date().toISOString(),
        };

        const updated = webhooks.map((w) =>
          w.id === wh.id
            ? {
                ...w,
                lastDeliveryStatus: deliveryEntry.status,
                lastDeliveryAt: deliveryEntry.timestamp,
                deliveryLog: [deliveryEntry, ...w.deliveryLog].slice(0, 10),
              }
            : w,
        );
        await persistWebhooks(updated);
        toast.success(res.ok ? 'Test delivered successfully' : 'Test delivery failed');
      } catch {
        toast.error('Test delivery failed');
      } finally {
        setTesting(null);
      }
    },
    [webhooks, persistWebhooks],
  );

  // ------ Render ------

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Webhook className="w-6 h-6 text-purple-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {t('voip.enterprise.webhooks')}
            </h1>
            <p className="text-sm text-gray-500">
              {t('voip.enterprise.events')}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('voip.enterprise.addWebhook')}
        </button>
      </div>

      {/* Webhooks table */}
      {webhooks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No webhooks configured yet.</p>
          <button
            onClick={openAdd}
            className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            {t('voip.enterprise.addWebhook')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-start px-4 py-3 font-medium text-gray-600">
                  {t('voip.enterprise.webhookUrl')}
                </th>
                <th className="text-start px-4 py-3 font-medium text-gray-600">
                  {t('voip.enterprise.events')}
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Last Delivery</th>
                <th className="text-end px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((wh) => (
                <tr key={wh.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  {/* URL */}
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs truncate max-w-[240px]" title={wh.url}>
                      {wh.url}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">Secret:</span>
                      <span className="font-mono text-[10px] text-gray-500">
                        {showSecret[wh.id] ? wh.secret : '****'}
                      </span>
                      <button
                        onClick={() =>
                          setShowSecret((prev) => ({ ...prev, [wh.id]: !prev[wh.id] }))
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showSecret[wh.id] ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Events */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="inline-flex px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-medium"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(wh.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        wh.active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {wh.active ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {wh.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  {/* Last delivery */}
                  <td className="px-4 py-3 text-center">
                    {wh.lastDeliveryAt ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            wh.lastDeliveryStatus === 'success'
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {wh.lastDeliveryStatus === 'success' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {wh.lastDeliveryStatus}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(wh.lastDeliveryAt).toLocaleString(locale)}
                        </span>
                        {wh.deliveryLog.length > 0 && (
                          <button
                            onClick={() =>
                              setExpandedLog(expandedLog === wh.id ? null : wh.id)
                            }
                            className="text-[10px] text-purple-600 hover:text-purple-700 font-medium"
                          >
                            {expandedLog === wh.id ? 'Hide log' : `View log (${wh.deliveryLog.length})`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Never</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleTest(wh)}
                        disabled={testing === wh.id || !wh.active}
                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Test webhook"
                      >
                        {testing === wh.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(wh)}
                        className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        disabled={deleting === wh.id}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        {deleting === wh.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expanded delivery log */}
          {expandedLog && (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Deliveries
              </h3>
              <div className="space-y-1">
                {webhooks
                  .find((wh) => wh.id === expandedLog)
                  ?.deliveryLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-1.5 px-3 bg-white rounded border border-gray-100 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            entry.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {entry.status === 'success' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {entry.status}
                        </span>
                        <span className="text-gray-500 font-mono">{entry.event}</span>
                        {entry.statusCode && (
                          <span className="text-gray-400">HTTP {entry.statusCode}</span>
                        )}
                      </div>
                      <span className="text-gray-400">
                        {new Date(entry.timestamp).toLocaleString(locale)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Webhook' : t('voip.enterprise.addWebhook')}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('voip.enterprise.webhookUrl')}
              </label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Events multi-select */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('voip.enterprise.events')}
              </label>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formEvents.includes(event)
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>

            {/* Secret */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret (HMAC-SHA256)
              </label>
              <input
                type="text"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Active toggle */}
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setFormActive(!formActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formActive ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700">
                {formActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formUrl || formEvents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update' : 'Add Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

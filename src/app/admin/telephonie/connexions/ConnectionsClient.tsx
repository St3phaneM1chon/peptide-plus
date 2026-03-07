'use client';

/**
 * ConnectionsClient - Manage VoIP provider connections (Telnyx, VoIP.ms).
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Wifi, WifiOff, TestTube, Trash2, Save,
  CheckCircle, XCircle, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type Provider = 'telnyx' | 'voipms';

interface Connection {
  id: string;
  provider: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
  phoneNumberCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ConnectionsClient({ initialConnections }: { initialConnections: any[] }) {
  const { t } = useI18n();
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: '' as Provider,
    apiKey: '',
    apiSecret: '',
    isEnabled: true,
  });

  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/voip/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setConnections((prev) => {
        const idx = prev.findIndex((c) => c.provider === form.provider);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.connection;
          return updated;
        }
        return [...prev, data.connection];
      });
      setEditing(null);
      toast.success(t('voip.connections.saved'));
    } catch {
      toast.error(t('voip.connections.saveFailed'));
    }
  };

  const handleTest = async (provider: string) => {
    setTesting(provider);
    try {
      const res = await fetch('/api/admin/voip/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`${provider}: ${data.message}`);
      } else {
        toast.error(`${provider}: ${data.message}`);
      }
    } catch {
      toast.error(t('voip.connections.testFailed'));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(t('voip.connections.confirmDelete'))) return;
    try {
      await fetch(`/api/admin/voip/connections?provider=${provider}`, { method: 'DELETE' });
      setConnections((prev) => prev.filter((c) => c.provider !== provider));
      toast.success(t('voip.connections.deleted'));
    } catch {
      toast.error(t('voip.connections.deleteFailed'));
    }
  };

  const providers: { id: Provider; label: string; description: string }[] = [
    { id: 'telnyx', label: 'Telnyx', description: t('voip.connections.telnyxDesc') },
    { id: 'voipms', label: 'VoIP.ms', description: t('voip.connections.voipmsDesc') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('voip.connections.title')}</h1>
      </div>

      <div className="grid gap-4">
        {providers.map((prov) => {
          const conn = connections.find((c) => c.provider === prov.id);
          const isEditing = editing === prov.id;

          return (
            <div key={prov.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {conn?.isEnabled ? (
                    <Wifi className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <span className="font-semibold text-gray-900">{prov.label}</span>
                    <span className="text-sm text-gray-500 ms-2">{prov.description}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {conn && (
                    <>
                      <button
                        onClick={() => handleTest(prov.id)}
                        disabled={testing === prov.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        {testing === prov.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                        Test
                      </button>
                      <button
                        onClick={() => handleDelete(prov.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setEditing(isEditing ? null : prov.id);
                      setForm({
                        provider: prov.id,
                        apiKey: '',
                        apiSecret: '',
                        isEnabled: conn?.isEnabled ?? true,
                      });
                    }}
                    className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600"
                  >
                    {conn ? t('voip.connections.edit') : t('voip.connections.configure')}
                  </button>
                </div>
              </div>

              {/* Status */}
              {conn && !isEditing && (
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    {conn.hasApiKey ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-gray-300" />}
                    API Key
                  </div>
                  <div className="flex items-center gap-1">
                    {conn.hasApiSecret ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-gray-300" />}
                    API Secret
                  </div>
                  <div>{conn.phoneNumberCount} {t('voip.connections.numbers')}</div>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">API Key</label>
                      <input
                        type="password"
                        value={form.apiKey}
                        onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                        placeholder={conn?.hasApiKey ? '••••••••' : 'Enter API key'}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">API Secret</label>
                      <input
                        type="password"
                        value={form.apiSecret}
                        onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                        placeholder={conn?.hasApiSecret ? '••••••••' : 'Enter API secret'}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.isEnabled}
                        onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                        className="rounded"
                      />
                      {t('voip.connections.enabled')}
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                        {t('common.cancel')}
                      </button>
                      <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                        <Save className="w-3.5 h-3.5" /> {t('common.save')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

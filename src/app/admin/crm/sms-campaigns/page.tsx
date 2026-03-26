'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Plus, Play, Pause, X,
} from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface SmsCampaign {
  id: string;
  name: string;
  status: string;
  message?: string | null;
  template?: { id: string; name: string } | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  totalRecipients: number;
  sent: number;
  delivered: number;
  failed: number;
  optedOut: number;
  createdBy: { name: string | null; email: string };
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  SENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
};

const STATUS_LABELS_FR: Record<string, string> = {
  DRAFT: 'Brouillon',
  SCHEDULED: 'Planifié',
  SENDING: 'En cours',
  COMPLETED: 'Terminé',
  PAUSED: 'En pause',
};

export default function SmsCampaignsPage() {
  const { t, locale } = useI18n();
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', message: '' });
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/sms-campaigns?limit=50');
      const json = await res.json();
      if (json.success) setCampaigns(json.data || []);
    } catch { toast.error(t('admin.crm.smsLoadError')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const statusLabel = (status: string) => {
    if (locale.startsWith('fr')) return STATUS_LABELS_FR[status] || status;
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  const createCampaign = async () => {
    if (!createForm.name.trim()) { toast.error(t('admin.crm.smsNameRequired')); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/crm/sms-campaigns', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (json.success) { toast.success(t('admin.crm.smsCampaignCreated')); setShowCreate(false); fetchCampaigns(); }
      else toast.error(json.error?.message || t('common.error'));
    } catch { toast.error(t('common.networkError')); }
    finally { setCreating(false); }
  };

  const sendCampaign = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/crm/sms-campaigns/${id}/send`, { method: 'POST', headers: addCSRFHeader({}) });
      const json = await res.json();
      if (json.success) { toast.success(t('admin.crm.smsCampaignStarted')); fetchCampaigns(); }
      else toast.error(json.error?.message || t('common.error'));
    } catch { toast.error(t('common.networkError')); }
  };

  const togglePause = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/crm/sms-campaigns/${id}/pause`, { method: 'PUT', headers: addCSRFHeader({}) });
      const json = await res.json();
      if (json.success) { toast.success(t('admin.crm.smsCampaignUpdated')); fetchCampaigns(); }
      else toast.error(json.error?.message || t('common.error'));
    } catch { toast.error(t('common.networkError')); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.smsCampaigns')}</h1>
          <p className="text-sm text-gray-500 mt-1">{campaigns.length} {t('admin.crm.smsCampaignsCount')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> {t('admin.crm.smsNewCampaign')}
        </button>
      </div>

      <div className="bg-[var(--k-glass-thin)] rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColCampaign')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColStatus')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColRecipients')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColSent')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColDelivered')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColFailed')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColOptOut')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.crm.smsColActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mx-auto" />
              </td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">{t('admin.crm.smsNoCampaigns')}</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.createdBy.name || c.createdBy.email} · {new Date(c.createdAt).toLocaleDateString(locale)}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[c.status] || ''}`}>{statusLabel(c.status)}</span>
                </td>
                <td className="px-4 py-3 text-end text-sm">{c.totalRecipients}</td>
                <td className="px-4 py-3 text-end text-sm text-indigo-600">{c.sent}</td>
                <td className="px-4 py-3 text-end text-sm text-green-600">{c.delivered}</td>
                <td className="px-4 py-3 text-end text-sm text-red-600">{c.failed}</td>
                <td className="px-4 py-3 text-end text-sm text-orange-600">{c.optedOut}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <button onClick={() => sendCampaign(c.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title={t('admin.crm.smsSend')}>
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === 'SENDING' && (
                      <button onClick={() => togglePause(c.id)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600" title={t('admin.crm.smsPause')}>
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button onClick={() => togglePause(c.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title={t('admin.crm.smsResume')}>
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--k-glass-thin)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" role="dialog" aria-modal="true" aria-labelledby="sms-campaign-modal-title">
            <div className="flex items-center justify-between">
              <h2 id="sms-campaign-modal-title" className="text-lg font-semibold">{t('admin.crm.smsNewCampaign')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded" aria-label={t('common.close')}><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.crm.smsCampaignName')} *</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.crm.smsMessage')}</label>
              <textarea value={createForm.message} onChange={e => setCreateForm(f => ({ ...f, message: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" rows={4} placeholder="Hi {firstName}, ..." />
              <p className="text-xs text-gray-400 mt-1">{t('admin.crm.smsMergeFieldsHint')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
              <button onClick={createCampaign} disabled={creating} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {creating ? '...' : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

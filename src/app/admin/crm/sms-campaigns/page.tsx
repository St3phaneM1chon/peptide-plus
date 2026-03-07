'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Plus, Play, Pause, X,
} from 'lucide-react';

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
  SCHEDULED: 'bg-teal-100 text-teal-700',
  SENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  PAUSED: 'bg-orange-100 text-orange-700',
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
    } catch { toast.error('Failed to load campaigns'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const createCampaign = async () => {
    if (!createForm.name.trim()) { toast.error('Name required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/crm/sms-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (json.success) { toast.success('Campaign created'); setShowCreate(false); fetchCampaigns(); }
      else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setCreating(false); }
  };

  const sendCampaign = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/crm/sms-campaigns/${id}/send`, { method: 'POST' });
      const json = await res.json();
      if (json.success) { toast.success('Campaign started'); fetchCampaigns(); }
      else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const togglePause = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/crm/sms-campaigns/${id}/pause`, { method: 'PUT' });
      const json = await res.json();
      if (json.success) { toast.success('Campaign updated'); fetchCampaigns(); }
      else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.smsCampaigns') || 'SMS Campaigns'}</h1>
          <p className="text-sm text-gray-500 mt-1">{campaigns.length} campaigns</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700">
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Recipients</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sent</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delivered</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Failed</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opt-Out</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto" />
              </td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">No campaigns yet</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.createdBy.name || c.createdBy.email} · {new Date(c.createdAt).toLocaleDateString(locale)}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span>
                </td>
                <td className="px-4 py-3 text-right text-sm">{c.totalRecipients}</td>
                <td className="px-4 py-3 text-right text-sm text-teal-600">{c.sent}</td>
                <td className="px-4 py-3 text-right text-sm text-green-600">{c.delivered}</td>
                <td className="px-4 py-3 text-right text-sm text-red-600">{c.failed}</td>
                <td className="px-4 py-3 text-right text-sm text-orange-600">{c.optedOut}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <button onClick={() => sendCampaign(c.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Send">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === 'SENDING' && (
                      <button onClick={() => togglePause(c.id)} className="p-1.5 rounded hover:bg-yellow-50 text-yellow-600" title="Pause">
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button onClick={() => togglePause(c.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Resume">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New SMS Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Name *</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea value={createForm.message} onChange={e => setCreateForm(f => ({ ...f, message: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" rows={4} placeholder="Hi {firstName}, ..." />
              <p className="text-xs text-gray-400 mt-1">Use {'{firstName}'}, {'{companyName}'} for merge fields</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200">{t('common.cancel')}</button>
              <button onClick={createCampaign} disabled={creating} className="px-4 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50">
                {creating ? '...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

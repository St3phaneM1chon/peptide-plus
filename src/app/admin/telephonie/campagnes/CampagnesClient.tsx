'use client';

/**
 * CampagnesClient - CRUD interface for outbound dialing campaigns.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Megaphone, Plus, Pencil, Trash2, X, Check, Phone, Users, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  callerIdNumber: string;
  maxConcurrent: number;
  useAmd: boolean;
  amdTimeout: number;
  scriptTitle: string | null;
  scriptBody: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  activeDays: string[];
  totalContacts: number;
  totalCalled: number;
  totalConnected: number;
  createdAt: string;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export default function CampagnesClient({
  initialCampaigns,
}: {
  initialCampaigns: Campaign[];
}) {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    callerIdNumber: '',
    maxConcurrent: 1,
    useAmd: true,
    scriptTitle: '',
    scriptBody: '',
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'America/Montreal',
    activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return { color: 'bg-emerald-50 text-emerald-700', label: t('voip.admin.campaigns.active') };
      case 'PAUSED': return { color: 'bg-amber-50 text-amber-700', label: t('voip.admin.campaigns.paused') };
      case 'COMPLETED': return { color: 'bg-gray-100 text-gray-600', label: t('voip.admin.campaigns.completed') };
      case 'DRAFT': return { color: 'bg-teal-50 text-teal-700', label: t('voip.admin.campaigns.draft') };
      case 'ARCHIVED': return { color: 'bg-gray-100 text-gray-500', label: 'Archived' };
      default: return { color: 'bg-gray-100 text-gray-500', label: status };
    }
  };

  const openAdd = () => {
    setEditingCampaign(null);
    setForm({
      name: '', description: '', callerIdNumber: '', maxConcurrent: 1, useAmd: true,
      scriptTitle: '', scriptBody: '', startTime: '09:00', endTime: '17:00',
      timezone: 'America/Montreal', activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    });
    setShowModal(true);
  };

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description || '',
      callerIdNumber: campaign.callerIdNumber,
      maxConcurrent: campaign.maxConcurrent,
      useAmd: campaign.useAmd,
      scriptTitle: campaign.scriptTitle || '',
      scriptBody: campaign.scriptBody || '',
      startTime: campaign.startTime || '09:00',
      endTime: campaign.endTime || '17:00',
      timezone: campaign.timezone,
      activeDays: campaign.activeDays || ['mon', 'tue', 'wed', 'thu', 'fri'],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.callerIdNumber.trim()) return;
    setSaving(true);
    try {
      const method = editingCampaign ? 'PUT' : 'POST';
      const body = editingCampaign ? { id: editingCampaign.id, ...form } : form;

      const res = await fetch('/api/admin/voip/campaigns', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed');
        return;
      }
      const data = await res.json();
      if (editingCampaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === editingCampaign.id ? data.campaign : c)));
      } else {
        setCampaigns((prev) => [data.campaign, ...prev]);
      }
      toast.success(t('common.saved'));
      setShowModal(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/admin/voip/campaigns?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed');
        return;
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast.success(t('common.deleted'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      activeDays: f.activeDays.includes(day)
        ? f.activeDays.filter((d) => d !== day)
        : [...f.activeDays, day],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('voip.admin.campaigns.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('voip.admin.campaigns.subtitle')}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> {t('voip.admin.campaigns.addCampaign')}
        </button>
      </div>

      {/* Campaigns table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.name')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.status')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.contacts')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.called')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.connected')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.callerId')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.campaigns.schedule')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
              const badge = statusBadge(campaign.status);
              const connectRate = campaign.totalCalled > 0
                ? Math.round((campaign.totalConnected / campaign.totalCalled) * 100)
                : 0;
              return (
                <tr key={campaign.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{campaign.name}</div>
                    {campaign.description && (
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{campaign.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {campaign.totalContacts}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-gray-700">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      {campaign.totalCalled}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-gray-700">
                      <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                      {campaign.totalConnected}
                      {campaign.totalCalled > 0 && (
                        <span className="text-xs text-gray-400 ml-1">({connectRate}%)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs">{campaign.callerIdNumber}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {campaign.startTime && campaign.endTime
                      ? `${campaign.startTime}-${campaign.endTime}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(campaign)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(campaign.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {campaigns.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <Megaphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>{t('voip.admin.campaigns.empty')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCampaign ? t('voip.admin.campaigns.editCampaign') : t('voip.admin.campaigns.addCampaign')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name + Description */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('voip.admin.campaigns.name')}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('voip.admin.campaigns.callerId')}
                  </label>
                  <input
                    type="text"
                    value={form.callerIdNumber}
                    onChange={(e) => setForm((f) => ({ ...f, callerIdNumber: e.target.value }))}
                    placeholder="+15145551234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Max Concurrent + AMD */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('voip.admin.campaigns.maxConcurrent')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={form.maxConcurrent}
                    onChange={(e) => setForm((f) => ({ ...f, maxConcurrent: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                    <input
                      type="checkbox"
                      checked={form.useAmd}
                      onChange={(e) => setForm((f) => ({ ...f, useAmd: e.target.checked }))}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    AMD (Answering Machine Detection)
                  </label>
                </div>
              </div>

              {/* Script */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.campaigns.script')}
                </label>
                <input
                  type="text"
                  value={form.scriptTitle}
                  onChange={(e) => setForm((f) => ({ ...f, scriptTitle: e.target.value }))}
                  placeholder="Script title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <textarea
                  value={form.scriptBody}
                  onChange={(e) => setForm((f) => ({ ...f, scriptBody: e.target.value }))}
                  placeholder="Agent script content..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y"
                />
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('voip.admin.campaigns.schedule')}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Start</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Timezone</label>
                    <select
                      value={form.timezone}
                      onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="America/Montreal">America/Montreal</option>
                      <option value="America/Toronto">America/Toronto</option>
                      <option value="America/Vancouver">America/Vancouver</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Chicago">America/Chicago</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                    </select>
                  </div>
                </div>

                {/* Active days */}
                <div className="flex gap-2 mt-3">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        form.activeDays.includes(day)
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-500 border-gray-300 hover:border-teal-400'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.callerIdNumber.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

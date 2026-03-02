'use client';

/**
 * ExtensionsClient - Manage SIP extensions for agents.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Headphones, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Extension {
  id: string;
  extension: string;
  sipDomain: string;
  status: string;
  isRegistered: boolean;
  user?: { name: string | null; email: string };
}

export default function ExtensionsClient({ extensions: initial }: { extensions: Extension[] }) {
  const { t } = useI18n();
  const [extensions, setExtensions] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ userId: '', extension: '', sipUsername: '', sipPassword: '', sipDomain: 'pbx.biocyclepeptides.com' });

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/admin/voip/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed');
        return;
      }
      const { extension } = await res.json();
      setExtensions((prev) => [...prev, extension]);
      toast.success(t('common.saved'));
      setShowAdd(false);
      setForm({ userId: '', extension: '', sipUsername: '', sipPassword: '', sipDomain: 'pbx.biocyclepeptides.com' });
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await fetch(`/api/admin/voip/extensions?id=${id}`, { method: 'DELETE' });
      setExtensions((prev) => prev.filter((e) => e.id !== id));
      toast.success(t('common.deleted'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-emerald-50 text-emerald-700';
      case 'BUSY': return 'bg-red-50 text-red-700';
      case 'DND': return 'bg-orange-50 text-orange-700';
      case 'AWAY': return 'bg-amber-50 text-amber-700';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.nav.voipExtensions')}</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm"
        >
          <Plus className="w-4 h-4" /> {t('common.add')}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Extension (1001)"
              value={form.extension}
              onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              placeholder="SIP Username"
              value={form.sipUsername}
              onChange={(e) => setForm((f) => ({ ...f, sipUsername: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              placeholder="SIP Password"
              type="password"
              value={form.sipPassword}
              onChange={(e) => setForm((f) => ({ ...f, sipPassword: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              placeholder="SIP Domain"
              value={form.sipDomain}
              onChange={(e) => setForm((f) => ({ ...f, sipDomain: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              placeholder="User ID"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm col-span-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-600">{t('common.cancel')}</button>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm">{t('common.save')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {extensions.map((ext) => (
          <div key={ext.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Headphones className="w-5 h-5 text-sky-600" />
              <div>
                <div className="font-medium text-gray-900">Ext. {ext.extension}</div>
                <div className="text-xs text-gray-500">
                  {ext.user?.name || ext.user?.email || 'Unassigned'} &middot; {ext.sipDomain}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(ext.status)}`}>
                {ext.status}
              </span>
              <button onClick={() => handleDelete(ext.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {extensions.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            <Headphones className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No extensions configured
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * PhoneNumbersClient - Manage DIDs (phone numbers) and their routing.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { useI18n } from '@/i18n/client';
import { Phone, Plus, Trash2, Globe } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PhoneNumbersClient() {
  const { t } = useI18n();
  const { data, mutate } = useSWR('/api/admin/voip/phone-numbers', fetcher);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ number: '', displayName: '', country: 'CA', connectionId: '' });

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/admin/voip/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to add');
        return;
      }
      toast.success(t('common.saved'));
      setShowAdd(false);
      setForm({ number: '', displayName: '', country: 'CA', connectionId: '' });
      mutate();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await fetch(`/api/admin/voip/phone-numbers?id=${id}`, { method: 'DELETE' });
      toast.success(t('common.deleted'));
      mutate();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const numbers = data?.numbers || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.nav.voipPhoneNumbers')}</h1>
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
              placeholder="+15145551234"
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              placeholder={t('voip.connections.displayName') || 'Display Name'}
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="CA">Canada</option>
              <option value="US">United States</option>
              <option value="FR">France</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-gray-600">{t('common.cancel')}</button>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm">{t('common.save')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {numbers.map((num: { id: string; number: string; displayName?: string; country: string; isActive: boolean; connection?: { provider: string } }) => (
          <div key={num.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-sky-600" />
              <div>
                <div className="font-medium text-gray-900">{num.number}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  {num.displayName && <span>{num.displayName}</span>}
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {num.country}</span>
                  {num.connection && <span className="text-sky-600">{num.connection.provider}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${num.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {num.isActive ? t('voip.connections.enabled') : t('voip.status.offline')}
              </span>
              <button onClick={() => handleDelete(num.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {numbers.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            <Phone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            {t('voip.dashboard.noCalls')}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Bell, Wifi, HardDrive, Trash2 } from 'lucide-react';
import { getOfflineStatus, getStorageEstimate, clearCaches, requestNotificationPermission, processSyncQueue } from '@/lib/accounting/pwa.service';
import { useI18n } from '@/i18n/client';

export default function MobileSettings() {
  const [prefs, setPrefs] = useState({ overdueInvoices: true, taxReminders: true, dailySummary: false, paymentReceived: true });
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);
  const offlineStatus = getOfflineStatus();
  const { t, locale } = useI18n();

  useEffect(() => {
    fetch('/api/mobile/notifications').then(r => r.ok ? r.json() : prefs).then(setPrefs);
    getStorageEstimate().then(est => { if (est) { setStorageUsage(est.usage); setStorageQuota(est.quota); } });
  }, []);

  const togglePref = async (key: keyof typeof prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await fetch('/api/mobile/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
  };

  const handleClearCache = async () => {
    await clearCaches();
    const est = await getStorageEstimate();
    if (est) { setStorageUsage(est.usage); setStorageQuota(est.quota); }
  };

  const handleSync = async () => {
    const result = await processSyncQueue();
    alert(t('mobile.offline.syncResult').replace('{succeeded}', String(result.succeeded)).replace('{failed}', String(result.failed)));
  };

  const fmtBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  const notifItems = [
    { key: 'overdueInvoices' as const, label: t('mobile.settings.overdueInvoices') },
    { key: 'taxReminders' as const, label: t('mobile.settings.taxReminders') },
    { key: 'dailySummary' as const, label: t('mobile.settings.dailySummary') },
    { key: 'paymentReceived' as const, label: t('mobile.settings.paymentReceived') },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{t('mobile.settings.title')}</h2>

      {/* Notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2"><Bell className="w-4 h-4 text-purple-600" /><h3 className="text-sm font-semibold text-gray-700">{t('mobile.settings.notifications')}</h3></div>
        <div className="divide-y divide-gray-50">
          {notifItems.map(({ key, label }) => (
            <div key={key} className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">{label}</span>
              <button onClick={() => togglePref(key)} className={`w-10 h-6 rounded-full transition-colors ${prefs[key] ? 'bg-purple-600' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${prefs[key] ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t">
          <button onClick={() => requestNotificationPermission()} className="text-sm text-purple-600 font-medium">{t('mobile.settings.enablePush')}</button>
        </div>
      </div>

      {/* Offline Mode */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3"><Wifi className="w-4 h-4 text-purple-600" /><h3 className="text-sm font-semibold text-gray-700">{t('mobile.settings.offline')}</h3></div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">{t('mobile.settings.status')}</span><span className={offlineStatus.isOnline ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>{offlineStatus.isOnline ? t('mobile.settings.online') : t('mobile.settings.offlineStatus')}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{t('mobile.settings.pendingChanges')}</span><span className="font-medium text-gray-700">{offlineStatus.pendingCount}</span></div>
          {offlineStatus.lastSyncAt && <div className="flex justify-between"><span className="text-gray-500">{t('mobile.settings.lastSync')}</span><span className="text-gray-700">{new Date(offlineStatus.lastSyncAt).toLocaleString(locale)}</span></div>}
        </div>
        {offlineStatus.pendingCount > 0 && (
          <button onClick={handleSync} className="mt-3 w-full bg-purple-100 text-purple-700 py-2 rounded-lg text-sm font-medium">{t('mobile.settings.syncNow')}</button>
        )}
      </div>

      {/* Storage */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3"><HardDrive className="w-4 h-4 text-purple-600" /><h3 className="text-sm font-semibold text-gray-700">{t('mobile.settings.storage')}</h3></div>
        <div className="text-sm text-gray-600 mb-2">{fmtBytes(storageUsage)} / {fmtBytes(storageQuota)} {t('mobile.settings.used')}</div>
        <div className="bg-gray-200 rounded-full h-2 mb-3"><div className="bg-purple-600 rounded-full h-2" style={{ width: `${storageQuota > 0 ? (storageUsage / storageQuota * 100) : 0}%` }} /></div>
        <button onClick={handleClearCache} className="flex items-center gap-2 text-sm text-red-500 font-medium"><Trash2 className="w-4 h-4" /> {t('mobile.settings.clearCache')}</button>
      </div>
    </div>
  );
}

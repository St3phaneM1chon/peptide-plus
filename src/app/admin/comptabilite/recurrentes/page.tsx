'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface RecurringEntry {
  id: string;
  name: string;
  description: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dayOfMonth?: number;
  amount: number;
  lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
  nextRunDate: Date;
  lastRunDate?: Date;
  isActive: boolean;
  autoPost: boolean;
  totalRuns: number;
}

export default function RecurringEntriesPage() {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<RecurringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState<RecurringEntry | null>(null);
  const [, setEditingEntry] = useState<RecurringEntry | null>(null);
  const [processing, setProcessing] = useState(false);

  const frequencyLabels: Record<string, string> = {
    DAILY: t('admin.recurringEntries.freqDaily'),
    WEEKLY: t('admin.recurringEntries.freqWeekly'),
    MONTHLY: t('admin.recurringEntries.freqMonthly'),
    QUARTERLY: t('admin.recurringEntries.freqQuarterly'),
    YEARLY: t('admin.recurringEntries.freqYearly'),
  };

  const predefinedTemplates = [
    { name: t('admin.recurringEntries.tplDepreciation'), description: t('admin.recurringEntries.tplDepreciationDesc'), frequency: 'MONTHLY', amount: 125 },
    { name: t('admin.recurringEntries.tplAzure'), description: t('admin.recurringEntries.tplAzureDesc'), frequency: 'MONTHLY', amount: 185.50 },
    { name: t('admin.recurringEntries.tplOpenAI'), description: t('admin.recurringEntries.tplOpenAIDesc'), frequency: 'MONTHLY', amount: 50 },
    { name: t('admin.recurringEntries.tplDomains'), description: t('admin.recurringEntries.tplDomainsDesc'), frequency: 'YEARLY', amount: 200 },
    { name: t('admin.recurringEntries.tplInsurance'), description: t('admin.recurringEntries.tplInsuranceDesc'), frequency: 'MONTHLY', amount: 150 },
  ];

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    amount: 0,
    debitAccount: '6800',
    creditAccount: '1590',
    autoPost: true,
    startDate: new Date().toISOString().split('T')[0],
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/accounting/recurring');
      if (!response.ok) throw new Error(t('admin.recurringEntries.apiError', { status: response.status }));
      const data = await response.json();
      setEntries(data.entries || data.data || []);
    } catch (err) {
      console.error('Error loading recurring entries:', err);
      setError(t('admin.recurringEntries.loadError'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDue = async () => {
    setProcessing(true);
    try {
      const response = await fetch('/api/accounting/recurring?action=process');
      if (!response.ok) throw new Error(t('admin.recurringEntries.apiError', { status: response.status }));
      toast.success(t('admin.recurringEntries.processSuccess'));
      await loadEntries();
    } catch (err) {
      console.error('Error processing recurring entries:', err);
      toast.error(t('admin.recurringEntries.processError'));
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    try {
      const response = await fetch('/api/accounting/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !entry.isActive }),
      });
      if (!response.ok) throw new Error(t('admin.recurringEntries.apiError', { status: response.status }));
      await loadEntries();
    } catch (err) {
      console.error('Error toggling recurring entry:', err);
      // Optimistic fallback
      setEntries(prev => prev.map(e =>
        e.id === id ? { ...e, isActive: !e.isActive } : e
      ));
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        frequency: formData.frequency,
        dayOfMonth: formData.dayOfMonth,
        amount: formData.amount,
        lines: [
          { accountCode: formData.debitAccount, accountName: t('admin.recurringEntries.debitAccountName'), debit: formData.amount, credit: 0 },
          { accountCode: formData.creditAccount, accountName: t('admin.recurringEntries.creditAccountName'), debit: 0, credit: formData.amount },
        ],
        startDate: formData.startDate,
        autoPost: formData.autoPost,
      };
      const response = await fetch('/api/accounting/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(t('admin.recurringEntries.apiError', { status: response.status }));
      setShowModal(false);
      setFormData({
        name: '',
        description: '',
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        amount: 0,
        debitAccount: '6800',
        creditAccount: '1590',
        autoPost: true,
        startDate: new Date().toISOString().split('T')[0],
      });
      await loadEntries();
    } catch (err) {
      console.error('Error saving recurring entry:', err);
      toast.error(t('admin.recurringEntries.saveError'));
    }
  };

  const applyTemplate = (template: typeof predefinedTemplates[0]) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      frequency: template.frequency,
      amount: template.amount,
    }));
  };

  const getDaysUntil = (date: Date) => {
    const now = new Date();
    const diff = Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Stats
  const totalActive = entries.filter(e => e.isActive).length;
  const totalMonthly = entries.filter(e => e.isActive).reduce((sum, e) => {
    const multiplier = { DAILY: 30, WEEKLY: 4, MONTHLY: 1, QUARTERLY: 0.33, YEARLY: 0.083 };
    return sum + (e.amount * (multiplier[e.frequency] || 1));
  }, 0);
  const nextDue = entries.filter(e => e.isActive).sort((a, b) =>
    new Date(a.nextRunDate).getTime() - new Date(b.nextRunDate).getTime()
  )[0];

  if (loading) {
    return <div className="p-8 text-center">{t('admin.recurringEntries.loading')}</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadEntries} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg">{t('admin.recurringEntries.retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.recurringEntries.title')}</h1>
          <p className="text-neutral-400 mt-1">{t('admin.recurringEntries.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleProcessDue}
            disabled={processing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <><span className="animate-spin">&#9203;</span> {t('admin.recurringEntries.processing')}</>
            ) : (
              <><span>&#9654;</span> {t('admin.recurringEntries.executeNow')}</>
            )}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-2"
          >
            <span>+</span> {t('admin.recurringEntries.newRecurrence')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.recurringEntries.activeRecurrences')}</p>
          <p className="text-2xl font-bold text-white mt-1">{totalActive}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.recurringEntries.estimatedMonthlyCost')}</p>
          <p className="text-2xl font-bold text-sky-400 mt-1">{totalMonthly.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.recurringEntries.nextExecution')}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {nextDue ? t('admin.recurringEntries.daysUnit', { count: getDaysUntil(nextDue.nextRunDate) }) : '-'}
          </p>
          {nextDue && <p className="text-xs text-neutral-500">{nextDue.name}</p>}
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">{t('admin.recurringEntries.executionsThisMonth')}</p>
          <p className="text-2xl font-bold text-white mt-1">{entries.reduce((sum, e) => sum + e.totalRuns, 0)}</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-900/50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.name')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.frequency')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.amount')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.next')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.autoPost')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.status')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-neutral-400 uppercase">{t('admin.recurringEntries.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {entries.map(entry => (
              <tr key={entry.id} className={`hover:bg-neutral-700/30 ${!entry.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{entry.name}</p>
                  <p className="text-sm text-neutral-400">{entry.description}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-neutral-700 text-neutral-300 rounded text-sm">
                    {frequencyLabels[entry.frequency]}
                  </span>
                  {entry.dayOfMonth && (
                    <span className="ms-1 text-sm text-neutral-500">{t('admin.recurringEntries.theDay', { day: entry.dayOfMonth })}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end font-medium text-white">
                  {entry.amount.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}
                </td>
                <td className="px-4 py-3">
                  <p className="text-white">{new Date(entry.nextRunDate).toLocaleDateString(locale)}</p>
                  <p className="text-xs text-neutral-500">
                    {t('admin.recurringEntries.inDays', { count: getDaysUntil(entry.nextRunDate) })}
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  {entry.autoPost ? (
                    <span className="text-green-400">&#10003;</span>
                  ) : (
                    <span className="text-neutral-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(entry.id)}
                    className={`px-2 py-1 rounded text-xs ${
                      entry.isActive
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-neutral-700 text-neutral-400'
                    }`}
                  >
                    {entry.isActive ? t('admin.recurringEntries.active') : t('admin.recurringEntries.inactive')}
                  </button>
                </td>
                <td className="px-4 py-3 text-end">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowPreview(entry)}
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                      title={t('admin.recurringEntries.preview')}
                    >
                      &#128065;
                    </button>
                    <button
                      onClick={() => setEditingEntry(entry)}
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                      title={t('admin.recurringEntries.edit')}
                    >
                      &#9999;&#65039;
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(t('admin.recurringEntries.deactivateConfirm'))) return;
                        try {
                          const response = await fetch('/api/accounting/recurring', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: entry.id, active: false }),
                          });
                          if (!response.ok) throw new Error(t('admin.recurringEntries.apiError', { status: response.status }));
                          await loadEntries();
                        } catch (err) {
                          console.error('Error deactivating entry:', err);
                          toast.error(t('admin.recurringEntries.deactivateError'));
                        }
                      }}
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-red-400"
                      title={t('admin.recurringEntries.delete')}
                    >
                      &#128465;
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-700">
              <h2 className="text-xl font-bold text-white">{t('admin.recurringEntries.newRecurringEntry')}</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Templates rapides */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">{t('admin.recurringEntries.quickTemplates')}</label>
                <div className="flex flex-wrap gap-2">
                  {predefinedTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => applyTemplate(tpl)}
                      className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-sm text-neutral-300 rounded-full"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.name')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder={t('admin.recurringEntries.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.amount')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.description')}</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.frequency')}</label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    {Object.entries(frequencyLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.dayOfMonth')}</label>
                  <select
                    value={formData.dayOfMonth}
                    onChange={e => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.startDate')}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.debitAccount')}</label>
                  <select
                    value={formData.debitAccount}
                    onChange={e => setFormData(prev => ({ ...prev, debitAccount: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    <option value="6800">{t('admin.recurringEntries.opt6800')}</option>
                    <option value="6310">{t('admin.recurringEntries.opt6310')}</option>
                    <option value="6330">{t('admin.recurringEntries.opt6330')}</option>
                    <option value="6210">{t('admin.recurringEntries.opt6210')}</option>
                    <option value="6010">{t('admin.recurringEntries.opt6010')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.recurringEntries.creditAccount')}</label>
                  <select
                    value={formData.creditAccount}
                    onChange={e => setFormData(prev => ({ ...prev, creditAccount: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    <option value="1590">{t('admin.recurringEntries.opt1590')}</option>
                    <option value="1010">{t('admin.recurringEntries.opt1010')}</option>
                    <option value="2000">{t('admin.recurringEntries.opt2000')}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoPost}
                  onChange={e => setFormData(prev => ({ ...prev, autoPost: e.target.checked }))}
                  className="rounded border-neutral-600 bg-neutral-700 text-sky-500"
                />
                <span className="text-neutral-300">{t('admin.recurringEntries.autoValidate')}</span>
              </label>
            </div>

            <div className="p-6 border-t border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-neutral-400 hover:text-white"
              >
                {t('admin.recurringEntries.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.amount}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50"
              >
                {t('admin.recurringEntries.createRecurrence')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{t('admin.recurringEntries.previewTitle')}</h2>
              <button onClick={() => setShowPreview(null)} className="text-neutral-400 hover:text-white">&#10005;</button>
            </div>
            <div className="p-6">
              <h3 className="font-medium text-white mb-4">{showPreview.name}</h3>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const date = new Date(showPreview.nextRunDate);
                  if (showPreview.frequency === 'MONTHLY') date.setMonth(date.getMonth() + i);
                  else if (showPreview.frequency === 'WEEKLY') date.setDate(date.getDate() + 7 * i);
                  else if (showPreview.frequency === 'QUARTERLY') date.setMonth(date.getMonth() + 3 * i);
                  else if (showPreview.frequency === 'YEARLY') date.setFullYear(date.getFullYear() + i);

                  return (
                    <div key={i} className="flex justify-between items-center p-3 bg-neutral-700/50 rounded-lg">
                      <span className="text-neutral-300">{date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span className="font-medium text-sky-400">{showPreview.amount.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-neutral-500 mt-4">{t('admin.recurringEntries.estimatedAnnualCost', { amount: (showPreview.amount * (showPreview.frequency === 'MONTHLY' ? 12 : showPreview.frequency === 'WEEKLY' ? 52 : showPreview.frequency === 'QUARTERLY' ? 4 : 1)).toLocaleString(locale, { style: 'currency', currency: 'CAD' }) })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

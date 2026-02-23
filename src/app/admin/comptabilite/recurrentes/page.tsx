'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, DollarSign, Calendar, BarChart3 } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { sectionThemes } from '@/lib/admin/section-themes';
import { SectionCard, StatCard } from '@/components/admin';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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
  const { t, locale, formatCurrency } = useI18n();
  const theme = sectionThemes.entry;
  const [entries, setEntries] = useState<RecurringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState<RecurringEntry | null>(null);
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

  // Ribbon actions
  const handleRibbonNewEntry = useCallback(() => { handleSave(); }, [handleSave]);
  const handleRibbonDelete = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonValidate = useCallback(() => { handleProcessDue(); }, [handleProcessDue]);
  const handleRibbonCancel = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonDuplicate = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonPrint = useCallback(() => { window.print(); }, []);
  const handleRibbonExport = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);

  useRibbonAction('newEntry', handleRibbonNewEntry);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('validate', handleRibbonValidate);
  useRibbonAction('cancel', handleRibbonCancel);
  useRibbonAction('duplicate', handleRibbonDuplicate);
  useRibbonAction('print', handleRibbonPrint);
  useRibbonAction('export', handleRibbonExport);

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={loadEntries} className={`px-4 py-2 ${theme.btnPrimary} border-transparent text-white rounded-lg`}>{t('admin.recurringEntries.retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.recurringEntries.title')}</h1>
          <p className="text-slate-500 mt-1">{t('admin.recurringEntries.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleProcessDue}
            disabled={processing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> {t('admin.recurringEntries.processing')}</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> {t('admin.recurringEntries.executeNow')}</>
            )}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className={`px-4 py-2 ${theme.btnPrimary} border-transparent text-white rounded-lg flex items-center gap-2`}
          >
            <span>+</span> {t('admin.recurringEntries.newRecurrence')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label={t('admin.recurringEntries.activeRecurrences')} value={totalActive} icon={RefreshCw} theme={theme} />
        <StatCard label={t('admin.recurringEntries.estimatedMonthlyCost')} value={formatCurrency(totalMonthly)} icon={DollarSign} theme={theme} />
        <StatCard
          label={t('admin.recurringEntries.nextExecution')}
          value={nextDue ? t('admin.recurringEntries.daysUnit', { count: getDaysUntil(nextDue.nextRunDate) }) : '-'}
          icon={Calendar}
          theme={theme}
        />
        <StatCard label={t('admin.recurringEntries.executionsThisMonth')} value={entries.reduce((sum, e) => sum + e.totalRuns, 0)} icon={BarChart3} theme={theme} />
      </div>

      {/* List */}
      <SectionCard theme={theme} noPadding>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.name')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.frequency')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.amount')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.next')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.autoPost')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.status')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.recurringEntries.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(entry => (
              <tr key={entry.id} className={`hover:bg-slate-50 ${!entry.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{entry.name}</p>
                  <p className="text-sm text-slate-500">{entry.description}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">
                    {frequencyLabels[entry.frequency]}
                  </span>
                  {entry.dayOfMonth && (
                    <span className="ms-1 text-sm text-slate-400">{t('admin.recurringEntries.theDay', { day: entry.dayOfMonth })}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end font-semibold text-slate-900">
                  {formatCurrency(entry.amount)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-900">{new Date(entry.nextRunDate).toLocaleDateString(locale)}</p>
                  <p className="text-xs text-slate-400">
                    {t('admin.recurringEntries.inDays', { count: getDaysUntil(entry.nextRunDate) })}
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  {entry.autoPost ? (
                    <span className="text-emerald-600">&#10003;</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(entry.id)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      entry.isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {entry.isActive ? t('admin.recurringEntries.active') : t('admin.recurringEntries.inactive')}
                  </button>
                </td>
                <td className="px-4 py-3 text-end">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setShowPreview(entry)}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                      title={t('admin.recurringEntries.preview')}
                      aria-label={t('admin.recurringEntries.preview')}
                    >
                      &#128065;
                    </button>
                    <button
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                      title={t('admin.recurringEntries.edit')}
                      aria-label={t('admin.recurringEntries.edit')}
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
                      className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                      title={t('admin.recurringEntries.delete')}
                      aria-label={t('admin.recurringEntries.delete')}
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
      </SectionCard>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="create-modal-title" onKeyDown={(e) => e.key === 'Escape' && setShowModal(false)}>
            <div className="p-6 border-b border-slate-200">
              <h2 id="create-modal-title" className="text-xl font-bold text-slate-900">{t('admin.recurringEntries.newRecurringEntry')}</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Templates rapides */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('admin.recurringEntries.quickTemplates')}</label>
                <div className="flex flex-wrap gap-2">
                  {predefinedTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => applyTemplate(tpl)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-sm text-slate-600 rounded-full transition-colors"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.name')}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={t('admin.recurringEntries.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.amount')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.description')}</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.frequency')}</label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {Object.entries(frequencyLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.dayOfMonth')}</label>
                  <select
                    value={formData.dayOfMonth}
                    onChange={e => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.startDate')}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.debitAccount')}</label>
                  <select
                    value={formData.debitAccount}
                    onChange={e => setFormData(prev => ({ ...prev, debitAccount: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="6800">{t('admin.recurringEntries.opt6800')}</option>
                    <option value="6310">{t('admin.recurringEntries.opt6310')}</option>
                    <option value="6330">{t('admin.recurringEntries.opt6330')}</option>
                    <option value="6210">{t('admin.recurringEntries.opt6210')}</option>
                    <option value="6010">{t('admin.recurringEntries.opt6010')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.recurringEntries.creditAccount')}</label>
                  <select
                    value={formData.creditAccount}
                    onChange={e => setFormData(prev => ({ ...prev, creditAccount: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                  className="rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700">{t('admin.recurringEntries.autoValidate')}</span>
              </label>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-500 hover:text-slate-700"
              >
                {t('admin.recurringEntries.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.amount}
                className={`px-4 py-2 ${theme.btnPrimary} border-transparent text-white rounded-lg disabled:opacity-50`}
              >
                {t('admin.recurringEntries.createRecurrence')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title" onKeyDown={(e) => e.key === 'Escape' && setShowPreview(null)}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 id="preview-modal-title" className="text-xl font-bold text-slate-900">{t('admin.recurringEntries.previewTitle')}</h2>
              <button onClick={() => setShowPreview(null)} className="text-slate-400 hover:text-slate-600" aria-label="Fermer">&#10005;</button>
            </div>
            <div className="p-6">
              <h3 className="font-medium text-slate-900 mb-4">{showPreview.name}</h3>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const date = new Date(showPreview.nextRunDate);
                  if (showPreview.frequency === 'MONTHLY') date.setMonth(date.getMonth() + i);
                  else if (showPreview.frequency === 'WEEKLY') date.setDate(date.getDate() + 7 * i);
                  else if (showPreview.frequency === 'QUARTERLY') date.setMonth(date.getMonth() + 3 * i);
                  else if (showPreview.frequency === 'YEARLY') date.setFullYear(date.getFullYear() + i);

                  return (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">{date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(showPreview.amount)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-slate-500 mt-4">{t('admin.recurringEntries.estimatedAnnualCost', { amount: formatCurrency(showPreview.amount * (showPreview.frequency === 'MONTHLY' ? 12 : showPreview.frequency === 'WEEKLY' ? 52 : showPreview.frequency === 'QUARTERLY' ? 4 : 1)) })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

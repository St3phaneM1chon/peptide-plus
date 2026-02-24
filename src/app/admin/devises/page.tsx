'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Pencil, Coins, CheckCircle, Star } from 'lucide-react';
import { PageHeader, Button, Modal } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isActive: boolean;
  isDefault: boolean;
  lastUpdated: string;
}

interface CurrencyForm {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: string;
}

const emptyCurrencyForm: CurrencyForm = { code: '', name: '', symbol: '', exchangeRate: '1.0000' };

export default function DevisesPage() {
  const { t, locale } = useI18n();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [showAddCurrency, setShowAddCurrency] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [form, setForm] = useState<CurrencyForm>(emptyCurrencyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrencies();
    // Load autoUpdate setting
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(data => {
        const settings = data.settings || [];
        const autoSetting = settings.find?.((s: { key: string }) => s.key === 'currencies.autoUpdate');
        if (autoSetting) setAutoUpdate(autoSetting.value === 'true');
      })
      .catch(() => {});
  }, []);

  const fetchCurrencies = async () => {
    try {
      const res = await fetch('/api/admin/currencies');
      const data = await res.json();
      setCurrencies(data.currencies || []);
    } catch (err) {
      console.error('Error fetching currencies:', err);
      toast.error(t('common.error'));
      setCurrencies([]);
    }
    setLoading(false);
  };

  const handleAutoUpdateToggle = async () => {
    const newValue = !autoUpdate;
    setAutoUpdate(newValue);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'currencies.autoUpdate': String(newValue) }),
      });
    } catch {
      setAutoUpdate(!newValue);
    }
  };

  const toggleActive = async (id: string) => {
    const currency = currencies.find((c) => c.id === id);
    if (!currency) return;
    const newActive = !currency.isActive;
    // Optimistic update
    setCurrencies(currencies.map((c) => (c.id === id ? { ...c, isActive: newActive } : c)));
    try {
      const res = await fetch(`/api/admin/currencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        toast.error(t('admin.currencies.updateError') || 'Failed to update currency');
        setCurrencies(currencies.map((c) => (c.id === id ? { ...c, isActive: !newActive } : c)));
      }
    } catch {
      toast.error(t('admin.currencies.updateError') || 'Failed to update currency');
      setCurrencies(currencies.map((c) => (c.id === id ? { ...c, isActive: !newActive } : c)));
    }
  };

  const setDefault = async (id: string) => {
    const prev = currencies;
    // Optimistic update
    setCurrencies(
      currencies.map((c) => ({
        ...c,
        isDefault: c.id === id,
        isActive: c.id === id ? true : c.isActive,
      }))
    );
    try {
      const res = await fetch(`/api/admin/currencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        toast.error(t('admin.currencies.updateError') || 'Failed to set default');
        setCurrencies(prev);
      }
    } catch {
      toast.error(t('admin.currencies.updateError') || 'Failed to set default');
      setCurrencies(prev);
    }
  };

  const handleAddCurrency = async () => {
    if (!form.code || !form.name || !form.symbol) {
      toast.error(t('admin.currencies.fillRequired') || 'Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          name: form.name,
          symbol: form.symbol,
          exchangeRate: parseFloat(form.exchangeRate) || 1,
        }),
      });
      if (res.ok) {
        toast.success(t('admin.currencies.addSuccess') || 'Currency added');
        setShowAddCurrency(false);
        setForm(emptyCurrencyForm);
        await fetchCurrencies();
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.saveFailed'));
      }
    } catch {
      toast.error(t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditCurrency = async () => {
    if (!editingCurrency || !form.name || !form.symbol) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/currencies/${editingCurrency.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          symbol: form.symbol,
          exchangeRate: parseFloat(form.exchangeRate) || editingCurrency.exchangeRate,
        }),
      });
      if (res.ok) {
        toast.success(t('admin.currencies.updateSuccess') || 'Currency updated');
        setEditingCurrency(null);
        setForm(emptyCurrencyForm);
        await fetchCurrencies();
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.updateFailed'));
      }
    } catch {
      toast.error(t('common.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (currency: Currency) => {
    setEditingCurrency(currency);
    setForm({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      exchangeRate: currency.exchangeRate.toFixed(6),
    });
  };

  const updateExchangeRates = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/currencies/refresh', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('common.updateFailed'));
        return;
      }

      // Re-fetch currencies to get updated rates from DB
      await fetchCurrencies();

      const updatedCount = data.data?.updated?.length || 0;
      toast.success(
        updatedCount > 0
          ? `${updatedCount} ${t('admin.currencies.ratesUpdated')}`
          : t('admin.currencies.ratesUpdated')
      );
    } catch (err) {
      console.error('Error refreshing rates:', err);
      toast.error(t('common.updateFailed'));
    } finally {
      setRefreshing(false);
    }
  };

  // Ribbon action handlers
  const handleRibbonSave = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonResetDefaults = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonImportConfig = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExportConfig = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonTest = useCallback(() => {
    updateExchangeRates();
  }, []);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.currencies.title')}
        subtitle={t('admin.currencies.subtitle')}
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" icon={RefreshCw} onClick={updateExchangeRates} disabled={refreshing}>
              {refreshing ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('admin.currencies.refreshing') || 'Refreshing...'}
                </span>
              ) : (
                t('admin.currencies.refreshRates')
              )}
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setShowAddCurrency(true)}>
              {t('admin.currencies.addCurrency')}
            </Button>
          </div>
        }
      />

      {/* Auto-update setting */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{t('admin.currencies.autoUpdate')}</h3>
            <p className="text-sm text-slate-500">{t('admin.currencies.autoUpdateDescription')}</p>
          </div>
          <button
            onClick={handleAutoUpdateToggle}
            aria-label="Toggle automatic exchange rate updates"
            aria-pressed={autoUpdate}
            className={`w-12 h-6 rounded-full transition-colors relative ${autoUpdate ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${autoUpdate ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MiniStat icon={Coins} label={t('admin.currencies.totalCurrencies')} value={currencies.length} bg="bg-slate-100 text-slate-600" />
        <MiniStat icon={CheckCircle} label={t('admin.currencies.activeCurrencies')} value={currencies.filter((c) => c.isActive).length} bg="bg-emerald-100 text-emerald-600" />
        <MiniStat icon={Star} label={t('admin.currencies.defaultCurrency')} value={currencies.find((c) => c.isDefault)?.code || 'CAD'} bg="bg-sky-100 text-sky-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.currency')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.symbol')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.rateVsCAD')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.lastUpdate')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.defaultCol')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.activeCol')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.currencies.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currencies.map((currency) => (
              <tr key={currency.code} className={`hover:bg-slate-50/50 ${!currency.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">
                      {currency.code.slice(0, 2)}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{currency.code}</p>
                      <p className="text-xs text-slate-500">{currency.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-lg font-mono text-slate-700">{currency.symbol}</td>
                <td className="px-4 py-4 text-end">
                  {currency.isDefault ? (
                    <span className="text-slate-500">{t('admin.currencies.base')}</span>
                  ) : (
                    <span className="font-mono text-slate-900">{currency.exchangeRate.toFixed(4)}</span>
                  )}
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="text-sm text-slate-700">
                      {new Date(currency.lastUpdated).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(currency.lastUpdated).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <input
                    type="radio"
                    name="defaultCurrency"
                    checked={currency.isDefault}
                    onChange={() => setDefault(currency.id)}
                    aria-label={`Set ${currency.code} as default currency`}
                    className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                  />
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleActive(currency.id)}
                    disabled={currency.isDefault}
                    aria-label={`Toggle ${currency.code} active status`}
                    aria-pressed={currency.isActive}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      currency.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    } ${currency.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      currency.isActive ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(currency)}>
                    {t('admin.currencies.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conversion Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t('admin.currencies.conversionPreview')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {currencies
            .filter((c) => c.isActive && !c.isDefault)
            .map((currency) => (
              <div key={currency.code} className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{(100 * currency.exchangeRate).toFixed(2)}</p>
                <p className="text-sm text-slate-500">{currency.code}</p>
              </div>
            ))}
        </div>
      </div>

      {/* Add Currency Modal */}
      <Modal isOpen={showAddCurrency} onClose={() => { setShowAddCurrency(false); setForm(emptyCurrencyForm); }} title={t('admin.currencies.addCurrencyTitle')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.codeLabel') || 'Code (ISO 4217)'}</label>
            <input type="text" maxLength={3} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="USD" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.nameLabel') || 'Name'}</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="US Dollar" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.symbolLabel') || 'Symbol'}</label>
            <input type="text" maxLength={5} value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} placeholder="$" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.exchangeRateLabel') || 'Exchange Rate (vs CAD)'}</label>
            <input type="number" step="0.000001" min="0" value={form.exchangeRate} onChange={e => setForm({ ...form, exchangeRate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setShowAddCurrency(false); setForm(emptyCurrencyForm); }}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleAddCurrency} loading={saving}>
              {t('admin.currencies.addCurrency')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Currency Modal */}
      <Modal isOpen={!!editingCurrency} onClose={() => { setEditingCurrency(null); setForm(emptyCurrencyForm); }} title={`${t('admin.currencies.edit')} ${editingCurrency?.code || ''}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.codeLabel') || 'Code'}</label>
            <input type="text" value={form.code} disabled className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.nameLabel') || 'Name'}</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.symbolLabel') || 'Symbol'}</label>
            <input type="text" maxLength={5} value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.currencies.exchangeRateLabel') || 'Exchange Rate (vs CAD)'}</label>
            <input type="number" step="0.000001" min="0" value={form.exchangeRate} onChange={e => setForm({ ...form, exchangeRate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-sky-500 focus:border-sky-500" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setEditingCurrency(null); setForm(emptyCurrencyForm); }}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleEditCurrency} loading={saving}>
              {t('common.save') || 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; bg: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  RefreshCcw, Plus, X, ArrowRightLeft, Globe,
} from 'lucide-react';

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  fetchedAt: string;
}

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'CHF', 'AUD', 'JPY'];

export default function ExchangeRatesPage() {
  const { t, locale } = useI18n();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({ fromCurrency: 'USD', toCurrency: 'CAD', rate: '' });
  const [saving, setSaving] = useState(false);
  const [convertFrom, setConvertFrom] = useState('USD');
  const [convertTo, setConvertTo] = useState('CAD');
  const [convertAmount, setConvertAmount] = useState('100');
  const [convertResult, setConvertResult] = useState<number | null>(null);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/exchange-rates');
      const json = await res.json();
      if (json.success) setRates(json.data || []);
    } catch { toast.error('Failed to load rates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const syncRates = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/admin/crm/exchange-rates/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) { toast.success(t('admin.crm.ratesSynced') || 'Rates synced from API'); fetchRates(); }
      else toast.error(json.error?.message || 'Sync failed');
    } catch { toast.error('Network error'); }
    finally { setSyncing(false); }
  };

  const addRate = async () => {
    if (!form.rate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromCurrency: form.fromCurrency, toCurrency: form.toCurrency, rate: parseFloat(form.rate) }),
      });
      const json = await res.json();
      if (json.success) { toast.success('Rate saved'); setShowAdd(false); setForm({ fromCurrency: 'USD', toCurrency: 'CAD', rate: '' }); fetchRates(); }
      else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const doConvert = () => {
    const amount = parseFloat(convertAmount);
    if (isNaN(amount)) return;
    if (convertFrom === convertTo) { setConvertResult(amount); return; }
    const rate = rates.find(r => r.fromCurrency === convertFrom && r.toCurrency === convertTo);
    if (rate) { setConvertResult(amount * rate.rate); return; }
    const inverseRate = rates.find(r => r.fromCurrency === convertTo && r.toCurrency === convertFrom);
    if (inverseRate) { setConvertResult(amount / inverseRate.rate); return; }
    toast.error(t('admin.crm.noRateAvailable') || 'No rate available for this pair');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Globe className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.exchangeRates') || 'Exchange Rates'}</h1>
            <p className="text-sm text-gray-500">{t('admin.crm.exchangeRatesDesc') || 'Manage multi-currency exchange rates'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={syncRates} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50">
            <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing...' : (t('admin.crm.syncFromApi') || 'Sync from API')}
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700">
            <Plus className="h-4 w-4" /> {t('admin.crm.addRate') || 'Add Rate'}
          </button>
        </div>
      </div>

      {/* Currency Converter */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
          <ArrowRightLeft className="h-4 w-4" /> {t('admin.crm.currencyConverter') || 'Currency Converter'}
        </h3>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.amount') || 'Amount'}</label>
            <input type="number" value={convertAmount} onChange={e => setConvertAmount(e.target.value)}
              className="w-32 border rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.from') || 'From'}</label>
            <select value={convertFrom} onChange={e => setConvertFrom(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <ArrowRightLeft className="h-4 w-4 text-gray-400 mb-3" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.to') || 'To'}</label>
            <select value={convertTo} onChange={e => setConvertTo(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={doConvert} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700">
            {t('admin.crm.convert') || 'Convert'}
          </button>
          {convertResult !== null && (
            <div className="px-4 py-2 bg-amber-50 rounded-md">
              <span className="text-lg font-bold text-amber-700">{convertResult.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {convertTo}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rates Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
      ) : rates.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{t('admin.crm.noRates') || 'No exchange rates configured'}</p>
          <button onClick={syncRates} className="mt-2 text-sm text-amber-600 hover:underline">{t('admin.crm.syncFromApi') || 'Sync from API'}</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t('common.from') || 'From'}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t('common.to') || 'To'}</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">{t('admin.crm.rate') || 'Rate'}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t('common.source') || 'Source'}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t('admin.crm.lastUpdated') || 'Last Updated'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rates.map(rate => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rate.fromCurrency}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{rate.toCurrency}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">{Number(rate.rate).toFixed(4)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rate.source === 'api' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>{rate.source}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(rate.fetchedAt).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Rate Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('admin.crm.addRate') || 'Add Exchange Rate'}</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.from') || 'From'}</label>
                <select value={form.fromCurrency} onChange={e => setForm(f => ({ ...f, fromCurrency: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.to') || 'To'}</label>
                <select value={form.toCurrency} onChange={e => setForm(f => ({ ...f, toCurrency: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.crm.rate') || 'Rate'}</label>
              <input type="number" step="0.0001" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="1.3500" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200">{t('common.cancel') || 'Cancel'}</button>
              <button onClick={addRate} disabled={saving || !form.rate} className="px-4 py-2 text-sm text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50">
                {saving ? '...' : (t('common.save') || 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

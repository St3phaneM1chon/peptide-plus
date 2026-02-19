'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface Currency {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  rate: number;
  lastUpdated: Date;
  trend: 'UP' | 'DOWN' | 'STABLE';
  change24h: number;
}

interface ForeignAccount {
  id: string;
  accountCode: string;
  accountName: string;
  currency: string;
  balance: number;
  cadEquivalent: number;
  originalRate: number;
  currentRate: number;
  unrealizedGainLoss: number;
}

export default function CurrencyPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'rates' | 'accounts' | 'history'>('rates');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [foreignAccounts, setForeignAccounts] = useState<ForeignAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setSelectedCurrency] = useState<string | null>(null);
  // Converter state
  const [converterAmount, setConverterAmount] = useState<number>(100);
  const [converterCurrency, setConverterCurrency] = useState<string>('');
  // History tab selected currency
  const [historyCurrency, setHistoryCurrency] = useState<string>('USD');

  const tabs = [
    { id: 'rates', label: t('admin.multiCurrency.exchangeRates') },
    { id: 'accounts', label: t('admin.multiCurrency.foreignAccounts') },
    { id: 'history', label: t('admin.multiCurrency.history') },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch currencies from API
      const res = await fetch('/api/accounting/currencies');
      const json = await res.json();

      // Build a rate lookup map from fetched currencies for use in foreign accounts
      const rateMap = new Map<string, number>();

      if (json.currencies) {
        const mapped: Currency[] = json.currencies
          .filter((c: Record<string, unknown>) => (c.code as string) !== 'CAD')
          .map((c: Record<string, unknown>) => ({
            id: c.id as string,
            code: c.code as string,
            name: c.name as string,
            symbol: c.symbol as string,
            rate: Number(c.exchangeRate) || 1,
            lastUpdated: c.rateUpdatedAt ? new Date(c.rateUpdatedAt as string) : new Date(),
            // No historical rates API available — trend and change24h are placeholder values
            trend: 'STABLE' as const,
            change24h: 0,
          }));
        setCurrencies(mapped);
        mapped.forEach(c => rateMap.set(c.code, c.rate));
      }

      // Fetch foreign accounts from bank-accounts API (filter non-CAD)
      const bankRes = await fetch('/api/accounting/bank-accounts');
      const bankJson = await bankRes.json();
      if (bankJson.accounts) {
        const foreign: ForeignAccount[] = bankJson.accounts
          .filter((a: Record<string, unknown>) => (a.currency as string) !== 'CAD')
          .map((a: Record<string, unknown>) => {
            const balance = Number(a.currentBalance) || 0;
            const currencyCode = (a.currency as string) || 'USD';
            // Use the actual exchange rate from fetched currencies; fall back to 1 if not found
            const currentRate = rateMap.get(currencyCode) ?? 1;
            const cadEquivalent = balance * currentRate;
            return {
              id: a.id as string,
              accountCode: (a.accountNumber as string) || '',
              accountName: a.name as string,
              currency: currencyCode,
              balance,
              cadEquivalent,
              // originalRate: uses current rate as initial baseline (no stored historical rate available)
              originalRate: currentRate,
              currentRate,
              // unrealizedGainLoss starts at 0; recalculated on revaluation
              unrealizedGainLoss: 0,
            };
          });
        setForeignAccounts(foreign);
      }
    } catch (err) {
      console.error('Error fetching currencies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshRates = async () => {
    setRefreshing(true);
    try {
      // Re-fetch currencies from API
      const res = await fetch('/api/accounting/currencies');
      const json = await res.json();
      if (json.currencies) {
        const mapped: Currency[] = json.currencies
          .filter((c: Record<string, unknown>) => (c.code as string) !== 'CAD')
          .map((c: Record<string, unknown>) => ({
            id: c.id as string,
            code: c.code as string,
            name: c.name as string,
            symbol: c.symbol as string,
            rate: Number(c.exchangeRate) || 1,
            lastUpdated: c.rateUpdatedAt ? new Date(c.rateUpdatedAt as string) : new Date(),
            // No historical rates API available — trend and change24h are placeholder values
            trend: 'STABLE' as const,
            change24h: 0,
          }));
        setCurrencies(mapped);
      }
    } catch (err) {
      console.error('Error refreshing rates:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRevaluation = async () => {
    const confirm = window.confirm(t('admin.multiCurrency.revaluationConfirm'));
    if (!confirm) return;

    // Revaluation using current rates from currencies
    setForeignAccounts(prev => prev.map(acc => {
      const currencyData = currencies.find(c => c.code === acc.currency);
      const newRate = currencyData?.rate || acc.currentRate;
      const newCadEquivalent = acc.balance * newRate;
      const gainLoss = newCadEquivalent - (acc.balance * acc.originalRate);
      return {
        ...acc,
        currentRate: newRate,
        cadEquivalent: newCadEquivalent,
        unrealizedGainLoss: gainLoss,
      };
    }));

    toast.success(t('admin.multiCurrency.revaluationDone'));
  };

  const formatCurrency = (amount: number, currency: string = 'CAD') =>
    amount.toLocaleString(locale, { style: 'currency', currency });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'UP': return '\ud83d\udcc8';
      case 'DOWN': return '\ud83d\udcc9';
      default: return '\u27a1\ufe0f';
    }
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-slate-500';
  };

  // Calculate totals
  const totalForeignCAD = foreignAccounts.reduce((sum, a) => sum + a.cadEquivalent, 0);
  const totalUnrealizedGainLoss = foreignAccounts.reduce((sum, a) => sum + a.unrealizedGainLoss, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin.multiCurrency.title')}</h1>
          <p className="text-slate-500 mt-1">{t('admin.multiCurrency.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshRates}
            disabled={refreshing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {refreshing ? '\u23f3' : '\ud83d\udd04'} {t('admin.multiCurrency.refreshRates')}
          </button>
          <button
            onClick={handleRevaluation}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
          >
            \ud83d\udcb1 {t('admin.multiCurrency.revaluation')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.baseCurrency')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">CAD \ud83c\udde8\ud83c\udde6</p>
          <p className="text-xs text-slate-400">{t('admin.multiCurrency.canadianDollar')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.activeCurrencies')}</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{currencies.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.foreignHoldings')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalForeignCAD)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.unrealizedGainLoss')}</p>
          <p className={`text-2xl font-bold mt-1 ${totalUnrealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedGainLoss)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rates Tab */}
      {activeTab === 'rates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currencies.map(currency => (
            <div
              key={currency.code}
              className="bg-white rounded-xl p-4 border border-slate-200 hover:border-sky-500/50 cursor-pointer transition-colors"
              onClick={() => setSelectedCurrency(currency.code)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{currency.code === 'USD' ? '\ud83c\uddfa\ud83c\uddf8' : currency.code === 'EUR' ? '\ud83c\uddea\ud83c\uddfa' : currency.code === 'GBP' ? '\ud83c\uddec\ud83c\udde7' : currency.code === 'JPY' ? '\ud83c\uddef\ud83c\uddf5' : currency.code === 'CHF' ? '\ud83c\udde8\ud83c\udded' : currency.code === 'AUD' ? '\ud83c\udde6\ud83c\uddfa' : '\ud83c\uddf2\ud83c\uddfd'}</span>
                    <div>
                      <p className="font-bold text-slate-900">{currency.code}</p>
                      <p className="text-xs text-slate-500">{currency.name}</p>
                    </div>
                  </div>
                </div>
                <span className="text-xl">{getTrendIcon(currency.trend)}</span>
              </div>

              <div className="mt-4">
                <p className="text-2xl font-bold text-slate-900">
                  {currency.rate.toFixed(4)} <span className="text-sm text-slate-500">CAD</span>
                </p>
                <p className={`text-sm ${getTrendColor(currency.change24h)}`}>
                  {currency.change24h > 0 ? '+' : ''}{currency.change24h.toFixed(2)}% (24h)
                </p>
              </div>

              <p className="text-xs text-slate-400 mt-2">
                {t('admin.multiCurrency.updatedAt', { time: currency.lastUpdated.toLocaleTimeString(locale) })}
              </p>
            </div>
          ))}

          {/* Add currency card */}
          <div className="bg-white rounded-xl p-4 border border-dashed border-slate-300 flex items-center justify-center min-h-[160px]">
            <button className="text-slate-500 hover:text-slate-900 flex flex-col items-center gap-2">
              <span className="text-3xl">+</span>
              <span className="text-sm">{t('admin.multiCurrency.addCurrency')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.account')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.currency')}</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.originalBalance')}</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.cadEquivalent')}</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.originalRate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.currentRate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.multiCurrency.gainLoss')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {foreignAccounts.map(account => (
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{account.accountCode}</p>
                      <p className="text-sm text-slate-500">{account.accountName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-100 rounded text-sm text-slate-900">
                        {account.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-slate-900">
                      {account.balance.toLocaleString(locale, { minimumFractionDigits: 2 })} {account.currency}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-sky-600">
                      {formatCurrency(account.cadEquivalent)}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-slate-500">
                      {account.originalRate.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-end font-mono text-slate-900">
                      {account.currentRate.toFixed(4)}
                    </td>
                    <td className={`px-4 py-3 text-end font-mono font-medium ${account.unrealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {account.unrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(account.unrealizedGainLoss)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-end font-medium text-slate-600">{t('admin.supplierInvoices.total')}</td>
                  <td className="px-4 py-3 text-end font-bold text-sky-600">
                    {formatCurrency(totalForeignCAD)}
                  </td>
                  <td colSpan={2}></td>
                  <td className={`px-4 py-3 text-end font-bold ${totalUnrealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedGainLoss)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add account */}
          <button className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-slate-900 hover:border-slate-400">
            {t('admin.multiCurrency.addForeignAccount')}
          </button>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (() => {
        const selectedRate = currencies.find(c => c.code === historyCurrency)?.rate;
        return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex gap-4">
              <select
                value={historyCurrency}
                onChange={(e) => setHistoryCurrency(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code}>{c.code} / CAD</option>
                ))}
              </select>
              <select className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm">
                <option value="7">{t('admin.multiCurrency.last7Days')}</option>
                <option value="30">{t('admin.multiCurrency.last30Days')}</option>
                <option value="90">{t('admin.multiCurrency.last90Days')}</option>
              </select>
            </div>
          </div>

          {/* No historical data available — show current rate as reference */}
          <div className="p-6">
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 text-sm mb-4">
                {t('admin.multiCurrency.noHistoricalData')}
              </p>
              {selectedRate != null && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">{t('admin.multiCurrency.currentRate')}</p>
                  <p className="text-3xl font-bold text-sky-600">
                    {selectedRate.toFixed(4)} <span className="text-sm text-slate-500">CAD</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Stats — only current rate is available, no historical min/max/volatility */}
          <div className="grid grid-cols-4 gap-4 p-4 border-t border-slate-200">
            <div>
              <p className="text-xs text-slate-500">{t('admin.multiCurrency.average')}</p>
              <p className="font-medium text-slate-900">{selectedRate != null ? selectedRate.toFixed(4) : '\u2014'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('admin.multiCurrency.highest')}</p>
              <p className="font-medium text-slate-400">{'\u2014'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('admin.multiCurrency.lowest')}</p>
              <p className="font-medium text-slate-400">{'\u2014'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t('admin.multiCurrency.volatility')}</p>
              <p className="font-medium text-slate-400">{'\u2014'}</p>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Currency converter */}
      {(() => {
        const selectedConverterCurrency = converterCurrency || currencies[0]?.code || '';
        const converterRate = currencies.find(c => c.code === selectedConverterCurrency)?.rate ?? 0;
        const convertedAmount = converterAmount * converterRate;
        return (
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="font-medium text-slate-900 mb-4">\ud83d\udd04 {t('admin.multiCurrency.quickConverter')}</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="number"
              value={converterAmount}
              onChange={(e) => setConverterAmount(Number(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-lg"
            />
          </div>
          <select
            value={selectedConverterCurrency}
            onChange={(e) => setConverterCurrency(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          <span className="text-2xl">\u2192</span>
          <div className="flex-1 px-4 py-2 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-sky-600">
              {convertedAmount.toFixed(2)} CAD
            </p>
            <p className="text-xs text-slate-400">{t('admin.multiCurrency.rate', { rate: converterRate.toFixed(4) })}</p>
          </div>
        </div>
      </div>
        );
      })()}
    </div>
  );
}

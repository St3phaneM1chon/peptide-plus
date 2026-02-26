'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRightLeft } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { PageHeader, Button, SectionCard } from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

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
  const { t, locale, formatCurrency: _formatCAD } = useI18n();
  const [activeTab, setActiveTab] = useState<'rates' | 'accounts' | 'history'>('rates');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [foreignAccounts, setForeignAccounts] = useState<ForeignAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRevaluationConfirm, setShowRevaluationConfirm] = useState(false);
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
      // Fetch live FX rates from the new fx-rates API (includes trend data)
      const fxRes = await fetch('/api/accounting/fx-rates');
      const fxJson = await fxRes.json();

      // Build a rate lookup map from fetched currencies for use in foreign accounts
      const rateMap = new Map<string, number>();

      // Also fetch DB currencies as fallback for any currencies not in fx-rates
      const dbRes = await fetch('/api/accounting/currencies');
      const dbJson = await dbRes.json();

      if (fxJson.rates) {
        // Use live FX rates with real trend data
        const mapped: Currency[] = fxJson.rates.map(
          (r: { code: string; name: string; symbol: string; rate: number; trend: string; change24h: number; lastUpdated: string }) => ({
            code: r.code,
            name: r.name,
            symbol: r.symbol,
            rate: r.rate,
            lastUpdated: r.lastUpdated ? new Date(r.lastUpdated) : new Date(),
            trend: (r.trend as 'UP' | 'DOWN' | 'STABLE') || 'STABLE',
            change24h: r.change24h ?? 0,
          })
        );
        setCurrencies(mapped);
        mapped.forEach(c => rateMap.set(c.code, c.rate));
      } else if (dbJson.currencies) {
        // Fallback to DB currencies if fx-rates API is unavailable
        const mapped: Currency[] = dbJson.currencies
          .filter((c: Record<string, unknown>) => (c.code as string) !== 'CAD')
          .map((c: Record<string, unknown>) => ({
            id: c.id as string,
            code: c.code as string,
            name: c.name as string,
            symbol: c.symbol as string,
            rate: Number(c.exchangeRate) || 1,
            lastUpdated: c.rateUpdatedAt ? new Date(c.rateUpdatedAt as string) : new Date(),
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
      // Trigger manual FX rate sync (updates DB from live sources)
      const syncRes = await fetch('/api/accounting/fx-rates', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        toast.success(
          t('admin.multiCurrency.syncSuccess') ||
            `Taux synchronises: ${syncData.updated?.length || 0} mis a jour`
        );
      }

      // Re-fetch live rates with trend data
      const res = await fetch('/api/accounting/fx-rates');
      const json = await res.json();
      if (json.rates) {
        const mapped: Currency[] = json.rates.map(
          (r: { code: string; name: string; symbol: string; rate: number; trend: string; change24h: number; lastUpdated: string }) => ({
            code: r.code,
            name: r.name,
            symbol: r.symbol,
            rate: r.rate,
            lastUpdated: r.lastUpdated ? new Date(r.lastUpdated) : new Date(),
            trend: (r.trend as 'UP' | 'DOWN' | 'STABLE') || 'STABLE',
            change24h: r.change24h ?? 0,
          })
        );
        setCurrencies(mapped);
      }
    } catch (err) {
      console.error('Error refreshing rates:', err);
      toast.error(t('admin.multiCurrency.syncError') || 'Erreur lors de la synchronisation');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRevaluation = () => {
    setShowRevaluationConfirm(true);
  };

  const confirmRevaluation = () => {
    setShowRevaluationConfirm(false);

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

  // Ribbon actions
  const handleRibbonSave = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/currencies', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ currencies: currencies.map(c => ({ code: c.code, exchangeRate: c.rate, isActive: true })) }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('admin.multiCurrency.saveSuccess') || 'Configuration des devises sauvegardee');
    } catch {
      toast.error(t('admin.multiCurrency.saveError') || 'Erreur lors de la sauvegarde');
    }
  }, [currencies, t]);
  const handleRibbonResetDefaults = useCallback(() => {
    loadData();
    toast.success(t('admin.multiCurrency.resetDone') || 'Taux recharges depuis le serveur');
  }, [t]);
  const handleRibbonImportConfig = useCallback(() => {
    toast.info(t('admin.multiCurrency.importInfo') || 'Pour importer une configuration de devises, utilisez un fichier CSV avec les colonnes: Code, Taux.');
  }, [t]);
  const handleRibbonExportConfig = useCallback(() => {
    if (currencies.length === 0) { toast.error(t('admin.multiCurrency.noDataToExport') || 'Aucune devise a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.multiCurrency.colCode') || 'Code', t('admin.multiCurrency.colName') || 'Nom', t('admin.multiCurrency.colSymbol') || 'Symbole', t('admin.multiCurrency.colRate') || 'Taux', t('admin.multiCurrency.colTrend') || 'Tendance', t('admin.multiCurrency.colChange24h') || 'Variation 24h'];
    const rows = currencies.map(c => [c.code, c.name, c.symbol, String(c.rate), c.trend, String(c.change24h)]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `devises-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.multiCurrency.exportSuccess') || `${currencies.length} devises exportees`);
  }, [currencies, t]);
  const handleRibbonTest = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/currencies');
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(t('admin.multiCurrency.testSuccess') || `Connexion API OK - ${data.currencies?.length || 0} devises configurees`);
    } catch {
      toast.error(t('admin.multiCurrency.testError') || 'Erreur de connexion a l\'API des devises');
    }
  }, [t]);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  const theme = sectionThemes.bank;

  if (loading) {
    return <div className="flex items-center justify-center h-64" role="status" aria-label="Loading"><div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full"></div><span className="sr-only">Loading...</span></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.multiCurrency.title')}
        subtitle={t('admin.multiCurrency.subtitle')}
        theme={theme}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={handleRefreshRates} disabled={refreshing}>
              {t('admin.multiCurrency.refreshRates')}
            </Button>
            <Button variant="primary" icon={ArrowRightLeft} onClick={handleRevaluation} className={`${theme.btnPrimary} border-transparent text-white`}>
              {t('admin.multiCurrency.revaluation')}
            </Button>
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.baseCurrency')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">CAD</p>
          <p className="text-xs text-slate-400">{t('admin.multiCurrency.canadianDollar')}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.activeCurrencies')}</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{currencies.length}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.foreignHoldings')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalForeignCAD)}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.multiCurrency.unrealizedGainLoss')}</p>
          <p className={`text-2xl font-bold mt-1 ${totalUnrealizedGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedGainLoss)}
          </p>
        </SectionCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? `${theme.btnPrimary} text-white`
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
            <SectionCard
              key={currency.code}
              theme={theme}
              className="hover:border-sky-300 cursor-pointer transition-colors"
            >
              <div>
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
            </SectionCard>
          ))}

          {/* Add currency card */}
          <div className="bg-white rounded-xl p-4 border-2 border-dashed border-slate-300 flex items-center justify-center min-h-[160px]">
            <button className="text-slate-500 hover:text-slate-900 flex flex-col items-center gap-2" aria-label={t('admin.multiCurrency.addCurrency')}>
              <span className="text-3xl">+</span>
              <span className="text-sm">{t('admin.multiCurrency.addCurrency')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <SectionCard title={t('admin.multiCurrency.foreignAccounts')} theme={theme} noPadding>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.account')}</th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.currency')}</th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.originalBalance')}</th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.cadEquivalent')}</th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.originalRate')}</th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.currentRate')}</th>
                  <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.multiCurrency.gainLoss')}</th>
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
          </SectionCard>

          {/* Add account */}
          <button className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors" aria-label={t('admin.multiCurrency.addForeignAccount')}>
            + {t('admin.multiCurrency.addForeignAccount')}
          </button>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (() => {
        const selectedRate = currencies.find(c => c.code === historyCurrency)?.rate;
        return (
        <SectionCard
          title={t('admin.multiCurrency.history')}
          theme={theme}
          noPadding
          headerAction={
            <div className="flex gap-4">
              <select
                value={historyCurrency}
                onChange={(e) => setHistoryCurrency(e.target.value)}
                aria-label="Select currency for history"
                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code}>{c.code} / CAD</option>
                ))}
              </select>
              <select aria-label="Select time range for history" className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                <option value="7">{t('admin.multiCurrency.last7Days')}</option>
                <option value="30">{t('admin.multiCurrency.last30Days')}</option>
                <option value="90">{t('admin.multiCurrency.last90Days')}</option>
              </select>
            </div>
          }
        >
          {/* No historical data available -- show current rate as reference */}
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

          {/* Stats -- only current rate is available, no historical min/max/volatility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border-t border-slate-200">
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
        </SectionCard>
        );
      })()}

      {/* Currency converter */}
      {(() => {
        const selectedConverterCurrency = converterCurrency || currencies[0]?.code || '';
        const converterRate = currencies.find(c => c.code === selectedConverterCurrency)?.rate ?? 0;
        const convertedAmount = converterAmount * converterRate;
        return (
      <SectionCard title={t('admin.multiCurrency.quickConverter')} theme={theme}>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="number"
              value={converterAmount}
              onChange={(e) => setConverterAmount(Number(e.target.value) || 0)}
              aria-label="Amount to convert"
              className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <select
            value={selectedConverterCurrency}
            onChange={(e) => setConverterCurrency(e.target.value)}
            aria-label="Select currency to convert"
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          <span className="text-2xl text-slate-400">&rarr;</span>
          <div className={`flex-1 px-4 py-2 ${theme.surfaceLight} rounded-lg`}>
            <p className="text-2xl font-bold text-sky-600">
              {formatCurrency(convertedAmount)}
            </p>
            <p className="text-xs text-slate-400">{t('admin.multiCurrency.rate', { rate: converterRate.toFixed(4) })}</p>
          </div>
        </div>
      </SectionCard>
        );
      })()}

      {/* Revaluation ConfirmDialog (replaces window.confirm) */}
      <ConfirmDialog
        isOpen={showRevaluationConfirm}
        title={t('admin.multiCurrency.revaluation')}
        message={t('admin.multiCurrency.revaluationConfirm')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmRevaluation}
        onCancel={() => setShowRevaluationConfirm(false)}
        variant="warning"
      />
    </div>
  );
}

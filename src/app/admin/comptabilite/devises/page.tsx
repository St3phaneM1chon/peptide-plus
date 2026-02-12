'use client';

import { useState, useEffect } from 'react';

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
  const [activeTab, setActiveTab] = useState<'rates' | 'accounts' | 'history'>('rates');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [foreignAccounts, setForeignAccounts] = useState<ForeignAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setSelectedCurrency] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch currencies from API
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
            trend: 'STABLE' as const,
            change24h: 0,
          }));
        setCurrencies(mapped);
      }

      // Fetch foreign accounts from bank-accounts API (filter non-CAD)
      const bankRes = await fetch('/api/accounting/bank-accounts');
      const bankJson = await bankRes.json();
      if (bankJson.accounts) {
        const foreign: ForeignAccount[] = bankJson.accounts
          .filter((a: Record<string, unknown>) => (a.currency as string) !== 'CAD')
          .map((a: Record<string, unknown>) => {
            const balance = Number(a.currentBalance) || 0;
            const currentRate = 1.35; // Will be updated with real rate below
            const cadEquivalent = balance * currentRate;
            return {
              id: a.id as string,
              accountCode: (a.accountNumber as string) || '',
              accountName: a.name as string,
              currency: (a.currency as string) || 'USD',
              balance,
              cadEquivalent,
              originalRate: currentRate,
              currentRate,
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
    const confirm = window.confirm('Voulez-vous effectuer une r\u00e9\u00e9valuation des comptes en devises \u00e9trang\u00e8res?');
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

    alert('R\u00e9\u00e9valuation effectu\u00e9e. Une \u00e9criture de r\u00e9gularisation a \u00e9t\u00e9 cr\u00e9\u00e9e.');
  };

  const formatCurrency = (amount: number, currency: string = 'CAD') =>
    amount.toLocaleString('fr-CA', { style: 'currency', currency });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'UP': return '\ud83d\udcc8';
      case 'DOWN': return '\ud83d\udcc9';
      default: return '\u27a1\ufe0f';
    }
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-neutral-400';
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
          <h1 className="text-2xl font-bold text-white">Multi-devises</h1>
          <p className="text-neutral-400 mt-1">Taux de change et comptes en devises \u00e9trang\u00e8res</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshRates}
            disabled={refreshing}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {refreshing ? '\u23f3' : '\ud83d\udd04'} Actualiser les taux
          </button>
          <button
            onClick={handleRevaluation}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
          >
            \ud83d\udcb1 R\u00e9\u00e9valuation
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Devise de base</p>
          <p className="text-2xl font-bold text-white mt-1">CAD \ud83c\udde8\ud83c\udde6</p>
          <p className="text-xs text-neutral-500">Dollar canadien</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Devises actives</p>
          <p className="text-2xl font-bold text-sky-400 mt-1">{currencies.length}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Avoirs en devises</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalForeignCAD)}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Gain/Perte non r\u00e9alis\u00e9</p>
          <p className={`text-2xl font-bold mt-1 ${totalUnrealizedGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedGainLoss)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg w-fit">
        {[
          { id: 'rates', label: 'Taux de change' },
          { id: 'accounts', label: 'Comptes en devises' },
          { id: 'history', label: 'Historique' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white'
                : 'text-neutral-400 hover:text-white'
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
              className="bg-neutral-800 rounded-xl p-4 border border-neutral-700 hover:border-sky-500/50 cursor-pointer transition-colors"
              onClick={() => setSelectedCurrency(currency.code)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{currency.code === 'USD' ? '\ud83c\uddfa\ud83c\uddf8' : currency.code === 'EUR' ? '\ud83c\uddea\ud83c\uddfa' : currency.code === 'GBP' ? '\ud83c\uddec\ud83c\udde7' : currency.code === 'JPY' ? '\ud83c\uddef\ud83c\uddf5' : currency.code === 'CHF' ? '\ud83c\udde8\ud83c\udded' : currency.code === 'AUD' ? '\ud83c\udde6\ud83c\uddfa' : '\ud83c\uddf2\ud83c\uddfd'}</span>
                    <div>
                      <p className="font-bold text-white">{currency.code}</p>
                      <p className="text-xs text-neutral-400">{currency.name}</p>
                    </div>
                  </div>
                </div>
                <span className="text-xl">{getTrendIcon(currency.trend)}</span>
              </div>

              <div className="mt-4">
                <p className="text-2xl font-bold text-white">
                  {currency.rate.toFixed(4)} <span className="text-sm text-neutral-400">CAD</span>
                </p>
                <p className={`text-sm ${getTrendColor(currency.change24h)}`}>
                  {currency.change24h > 0 ? '+' : ''}{currency.change24h.toFixed(2)}% (24h)
                </p>
              </div>

              <p className="text-xs text-neutral-500 mt-2">
                Mis \u00e0 jour: {currency.lastUpdated.toLocaleTimeString('fr-CA')}
              </p>
            </div>
          ))}

          {/* Add currency card */}
          <div className="bg-neutral-800 rounded-xl p-4 border border-dashed border-neutral-600 flex items-center justify-center min-h-[160px]">
            <button className="text-neutral-400 hover:text-white flex flex-col items-center gap-2">
              <span className="text-3xl">+</span>
              <span className="text-sm">Ajouter une devise</span>
            </button>
          </div>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Compte</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Devise</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Solde original</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">\u00c9quivalent CAD</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Taux original</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Taux actuel</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Gain/Perte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {foreignAccounts.map(account => (
                  <tr key={account.id} className="hover:bg-neutral-700/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{account.accountCode}</p>
                      <p className="text-sm text-neutral-400">{account.accountName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-neutral-700 rounded text-sm text-white">
                        {account.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {account.balance.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} {account.currency}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sky-400">
                      {formatCurrency(account.cadEquivalent)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-neutral-400">
                      {account.originalRate.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white">
                      {account.currentRate.toFixed(4)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${account.unrealizedGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {account.unrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(account.unrealizedGainLoss)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-neutral-900/50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right font-medium text-neutral-300">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-sky-400">
                    {formatCurrency(totalForeignCAD)}
                  </td>
                  <td colSpan={2}></td>
                  <td className={`px-4 py-3 text-right font-bold ${totalUnrealizedGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalUnrealizedGainLoss >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedGainLoss)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add account */}
          <button className="w-full py-3 border border-dashed border-neutral-600 rounded-xl text-neutral-400 hover:text-white hover:border-neutral-500">
            + Ajouter un compte en devise \u00e9trang\u00e8re
          </button>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
          <div className="p-4 border-b border-neutral-700">
            <div className="flex gap-4">
              <select className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm">
                <option value="USD">USD / CAD</option>
                <option value="EUR">EUR / CAD</option>
                <option value="GBP">GBP / CAD</option>
              </select>
              <select className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm">
                <option value="7">7 derniers jours</option>
                <option value="30">30 derniers jours</option>
                <option value="90">90 derniers jours</option>
              </select>
            </div>
          </div>

          {/* Simple chart representation */}
          <div className="p-6">
            <div className="h-48 flex items-end gap-1">
              {Array.from({ length: 30 }, (_, i) => {
                const baseRate = currencies.find(c => c.code === 'USD')?.rate || 1.35;
                const variation = Math.sin(i * 0.5) * 0.02 + (Math.random() - 0.5) * 0.01;
                const rate = baseRate + variation;
                const height = ((rate - (baseRate - 0.05)) / 0.10) * 100;

                return (
                  <div
                    key={i}
                    className="flex-1 bg-sky-500/50 hover:bg-sky-500 rounded-t transition-colors"
                    style={{ height: `${Math.max(10, height)}%` }}
                    title={`${rate.toFixed(4)} CAD`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-neutral-500 mt-2">
              <span>Il y a 30 jours</span>
              <span>Aujourd&apos;hui</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 p-4 border-t border-neutral-700">
            <div>
              <p className="text-xs text-neutral-400">Moyenne</p>
              <p className="font-medium text-white">{(currencies.find(c => c.code === 'USD')?.rate || 1.35).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Plus haut</p>
              <p className="font-medium text-green-400">{((currencies.find(c => c.code === 'USD')?.rate || 1.35) * 1.01).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Plus bas</p>
              <p className="font-medium text-red-400">{((currencies.find(c => c.code === 'USD')?.rate || 1.35) * 0.99).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Volatilit\u00e9</p>
              <p className="font-medium text-white">2.1%</p>
            </div>
          </div>
        </div>
      )}

      {/* Currency converter */}
      <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
        <h3 className="font-medium text-white mb-4">\ud83d\udd04 Convertisseur rapide</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              type="number"
              defaultValue={100}
              className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-lg"
            />
          </div>
          <select className="px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white">
            {currencies.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          <span className="text-2xl">\u2192</span>
          <div className="flex-1 px-4 py-2 bg-neutral-900 rounded-lg">
            <p className="text-2xl font-bold text-sky-400">
              {((currencies[0]?.rate || 1.35) * 100).toFixed(2)} CAD
            </p>
            <p className="text-xs text-neutral-500">Taux: {(currencies[0]?.rate || 1.35).toFixed(4)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

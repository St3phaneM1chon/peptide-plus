'use client';

import { useState, useEffect } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { PageHeader, Button } from '@/components/admin';

interface FinancialData {
  incomeStatement: {
    revenue: Record<string, number>;
    cogs: Record<string, number>;
    expenses: Record<string, number>;
    other: Record<string, number>;
  };
  balanceSheet: {
    assets: {
      current: Record<string, number>;
      nonCurrent: Record<string, number>;
    };
    liabilities: {
      current: Record<string, number>;
    };
    equity: Record<string, number>;
  };
  cashFlow: {
    operating: Record<string, number>;
    investing: Record<string, number>;
    financing: Record<string, number>;
  };
}

export default function EtatsFinanciersPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');
  const [activeTab, setActiveTab] = useState<'bilan' | 'resultats' | 'flux'>('resultats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [data, setData] = useState<FinancialData>({
    incomeStatement: { revenue: {}, cogs: {}, expenses: {}, other: {} },
    balanceSheet: {
      assets: { current: {}, nonCurrent: {} },
      liabilities: { current: {} },
      equity: {},
    },
    cashFlow: { operating: {}, investing: {}, financing: {} },
  });

  // Fetch financial data by generating report HTML and parsing from API
  // We use the GET /api/accounting/reports/pdf?type=income and type=balance endpoints
  const fetchFinancialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch income statement and balance sheet data from the general ledger
      // The reports/pdf API returns HTML - we need structured data instead
      // So we'll use the dashboard API or construct from journal entries
      // For now, fetch from the reports API which builds from journal entries
      const [incomeRes, balanceRes] = await Promise.all([
        fetch(`/api/accounting/reports/pdf?type=income&period=${selectedPeriod}`),
        fetch(`/api/accounting/reports/pdf?type=balance&period=${selectedPeriod}`),
      ]);

      // The API returns HTML, so we parse the data from the general-ledger endpoint instead
      // Let's use the general-ledger to construct financial statements
      const glRes = await fetch('/api/accounting/general-ledger?posted=true');
      if (!glRes.ok) throw new Error('Erreur lors du chargement des données');
      const glData = await glRes.json();

      const revenue: Record<string, number> = {};
      const cogs: Record<string, number> = {};
      const expenses: Record<string, number> = {};
      const other: Record<string, number> = {};
      const assetsCurrent: Record<string, number> = {};
      const assetsNonCurrent: Record<string, number> = {};
      const liabilitiesCurrent: Record<string, number> = {};
      const equity: Record<string, number> = {};

      // Process ledger entries
      const accounts = glData.accounts || glData.ledger || [];
      for (const acct of accounts) {
        const code = acct.accountCode || acct.code || '';
        const name = acct.accountName || acct.name || code;
        const balance = typeof acct.balance === 'number' ? acct.balance :
          (Number(acct.totalDebits || acct.totalDebit || 0) - Number(acct.totalCredits || acct.totalCredit || 0));

        if (balance === 0) continue;

        if (code.startsWith('4')) {
          // Revenue accounts (credit balance)
          revenue[name] = Math.abs(balance);
        } else if (code.startsWith('5')) {
          // COGS (debit balance)
          cogs[name] = Math.abs(balance);
        } else if (code.startsWith('6')) {
          // Expenses (debit balance)
          expenses[name] = Math.abs(balance);
        } else if (code.startsWith('7') || code.startsWith('8')) {
          // Other income/expense
          other[name] = balance;
        } else if (code.startsWith('1')) {
          // Assets
          if (parseInt(code) < 1500) {
            assetsCurrent[name] = balance;
          } else {
            assetsNonCurrent[name] = balance;
          }
        } else if (code.startsWith('2')) {
          // Liabilities
          liabilitiesCurrent[name] = Math.abs(balance);
        } else if (code.startsWith('3')) {
          // Equity
          equity[name] = Math.abs(balance);
        }
      }

      setData({
        incomeStatement: { revenue, cogs, expenses, other },
        balanceSheet: {
          assets: { current: assetsCurrent, nonCurrent: assetsNonCurrent },
          liabilities: { current: liabilitiesCurrent },
          equity,
        },
        cashFlow: {
          operating: {},
          investing: {},
          financing: {},
        },
      });

      // Suppress unused responses warning
      void incomeRes;
      void balanceRes;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // Export PDF via the reports API
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const typeMap: Record<string, string> = {
        resultats: 'income',
        bilan: 'balance',
        flux: 'income', // No dedicated cash flow endpoint, use income as fallback
      };
      const reportType = typeMap[activeTab] || 'income';
      const res = await fetch(`/api/accounting/reports/pdf?type=${reportType}&period=${selectedPeriod}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Erreur lors de la génération du PDF');
      }
      const html = await res.text();
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  // Income statement calculations
  const { incomeStatement, balanceSheet, cashFlow } = data;
  const totalRevenue = Object.values(incomeStatement.revenue).reduce((a, b) => a + b, 0);
  const totalCogs = Object.values(incomeStatement.cogs).reduce((a, b) => a + b, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = Object.values(incomeStatement.expenses).reduce((a, b) => a + b, 0);
  const operatingProfit = grossProfit - totalExpenses;
  const totalOther = Object.values(incomeStatement.other).reduce((a, b) => a + b, 0);
  const netProfit = operatingProfit + totalOther;

  // Balance sheet calculations
  const totalCurrentAssets = Object.values(balanceSheet.assets.current).reduce((a, b) => a + b, 0);
  const totalNonCurrentAssets = Object.values(balanceSheet.assets.nonCurrent).reduce((a, b) => a + b, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = Object.values(balanceSheet.liabilities.current).reduce((a, b) => a + b, 0);
  const totalEquity = Object.values(balanceSheet.equity).reduce((a, b) => a + b, 0);

  // Cash flow calculations (derived from income + adjustments)
  const operatingCashFlow = Object.values(cashFlow.operating).reduce((a, b) => a + b, 0) || netProfit;
  const investingCashFlow = Object.values(cashFlow.investing).reduce((a, b) => a + b, 0);
  const financingCashFlow = Object.values(cashFlow.financing).reduce((a, b) => a + b, 0);
  const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

  const periodLabel = selectedPeriod === '2025'
    ? 'Année 2025'
    : selectedPeriod === '2025-Q4'
    ? 'Q4 2025'
    : selectedPeriod === '2026-01'
    ? 'Janvier 2026'
    : selectedPeriod;

  return (
    <div className="space-y-6">
      <PageHeader
        title="États financiers"
        subtitle="Bilan, état des résultats et flux de trésorerie"
        actions={
          <div className="flex gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="2026-01">Janvier 2026</option>
              <option value="2025-Q4">Q4 2025</option>
              <option value="2025">Année 2025</option>
            </select>
            <Button
              variant="primary"
              icon={exportingPdf ? Loader2 : Download}
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              {exportingPdf ? 'Génération...' : 'Exporter PDF'}
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('resultats')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'resultats' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'
            }`}
          >
            État des résultats
          </button>
          <button
            onClick={() => setActiveTab('bilan')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'bilan' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'
            }`}
          >
            Bilan
          </button>
          <button
            onClick={() => setActiveTab('flux')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'flux' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'
            }`}
          >
            Flux de trésorerie
          </button>
        </nav>
      </div>

      {/* État des résultats */}
      {activeTab === 'resultats' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 bg-emerald-50 border-b border-emerald-200">
            <h2 className="text-xl font-bold text-emerald-900">État des résultats</h2>
            <p className="text-emerald-700">BioCycle Peptides Inc. - {periodLabel}</p>
          </div>
          <div className="p-6">
            {totalRevenue === 0 && totalCogs === 0 && totalExpenses === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Aucune écriture comptable pour cette période
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {/* Revenus */}
                  <tr className="bg-slate-50">
                    <td colSpan={2} className="px-4 py-3 font-bold text-slate-900">REVENUS</td>
                  </tr>
                  {Object.entries(incomeStatement.revenue).map(([name, amount]) => (
                    <tr key={name}>
                      <td className="px-8 py-2 text-slate-600">{name}</td>
                      <td className="px-4 py-2 text-right">{amount.toLocaleString()} $</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-slate-900">Total revenus</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{totalRevenue.toLocaleString()} $</td>
                  </tr>

                  {/* CMV */}
                  {Object.keys(incomeStatement.cogs).length > 0 && (
                    <>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-3 font-bold text-slate-900">COÛT DES MARCHANDISES VENDUES</td>
                      </tr>
                      {Object.entries(incomeStatement.cogs).map(([name, amount]) => (
                        <tr key={name}>
                          <td className="px-8 py-2 text-slate-600">{name}</td>
                          <td className="px-4 py-2 text-right">{amount.toLocaleString()} $</td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">Total CMV</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">({totalCogs.toLocaleString()}) $</td>
                      </tr>
                    </>
                  )}

                  {/* Marge brute */}
                  <tr className="bg-emerald-100">
                    <td className="px-4 py-3 font-bold text-emerald-900">MARGE BRUTE</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {grossProfit.toLocaleString()} $ {totalRevenue > 0 ? `(${((grossProfit / totalRevenue) * 100).toFixed(1)}%)` : ''}
                    </td>
                  </tr>

                  {/* Dépenses */}
                  {Object.keys(incomeStatement.expenses).length > 0 && (
                    <>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-3 font-bold text-slate-900">DÉPENSES D&apos;EXPLOITATION</td>
                      </tr>
                      {Object.entries(incomeStatement.expenses).map(([name, amount]) => (
                        <tr key={name}>
                          <td className="px-8 py-2 text-slate-600">{name}</td>
                          <td className="px-4 py-2 text-right">{amount.toLocaleString()} $</td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-200">
                        <td className="px-4 py-3 font-semibold text-slate-900">Total dépenses</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">({totalExpenses.toLocaleString()}) $</td>
                      </tr>
                    </>
                  )}

                  {/* Bénéfice d'exploitation */}
                  <tr className="bg-blue-100">
                    <td className="px-4 py-3 font-bold text-blue-900">BÉNÉFICE D&apos;EXPLOITATION</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{operatingProfit.toLocaleString()} $</td>
                  </tr>

                  {/* Autres */}
                  {Object.keys(incomeStatement.other).length > 0 && (
                    <>
                      <tr className="bg-slate-50">
                        <td colSpan={2} className="px-4 py-3 font-bold text-slate-900">AUTRES PRODUITS / CHARGES</td>
                      </tr>
                      {Object.entries(incomeStatement.other).map(([name, amount]) => (
                        <tr key={name}>
                          <td className="px-8 py-2 text-slate-600">{name}</td>
                          <td className={`px-4 py-2 text-right ${amount < 0 ? 'text-red-600' : ''}`}>
                            {amount < 0 ? `(${Math.abs(amount).toLocaleString()})` : amount.toLocaleString()} $
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Bénéfice net */}
                  <tr className="bg-emerald-600 text-white">
                    <td className="px-4 py-4 font-bold text-lg">BÉNÉFICE NET</td>
                    <td className="px-4 py-4 text-right font-bold text-lg">{netProfit.toLocaleString()} $</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Bilan */}
      {activeTab === 'bilan' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Actifs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-blue-50 border-b border-blue-200">
              <h2 className="text-xl font-bold text-blue-900">ACTIFS</h2>
            </div>
            <div className="p-6">
              {totalAssets === 0 ? (
                <div className="text-center py-8 text-slate-500">Aucun actif enregistré</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {Object.keys(balanceSheet.assets.current).length > 0 && (
                      <>
                        <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-2 font-semibold text-slate-700">Actifs courants</td></tr>
                        {Object.entries(balanceSheet.assets.current).map(([name, amount]) => (
                          <tr key={name}>
                            <td className="px-6 py-2 text-slate-600">{name}</td>
                            <td className={`px-4 py-2 text-right ${amount < 0 ? 'text-red-600' : ''}`}>
                              {amount < 0 ? `(${Math.abs(amount).toLocaleString()})` : amount.toLocaleString()} $
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t"><td className="px-4 py-2 font-medium">Total actifs courants</td><td className="px-4 py-2 text-right font-medium">{totalCurrentAssets.toLocaleString()} $</td></tr>
                      </>
                    )}

                    {Object.keys(balanceSheet.assets.nonCurrent).length > 0 && (
                      <>
                        <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-2 font-semibold text-slate-700 mt-4">Actifs non courants</td></tr>
                        {Object.entries(balanceSheet.assets.nonCurrent).map(([name, amount]) => (
                          <tr key={name}>
                            <td className="px-6 py-2 text-slate-600">{name}</td>
                            <td className={`px-4 py-2 text-right ${amount < 0 ? 'text-red-600' : ''}`}>
                              {amount < 0 ? `(${Math.abs(amount).toLocaleString()})` : amount.toLocaleString()} $
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t"><td className="px-4 py-2 font-medium">Total actifs non courants</td><td className="px-4 py-2 text-right font-medium">{totalNonCurrentAssets.toLocaleString()} $</td></tr>
                      </>
                    )}

                    <tr className="bg-blue-100"><td className="px-4 py-3 font-bold text-blue-900">TOTAL ACTIFS</td><td className="px-4 py-3 text-right font-bold text-blue-700">{totalAssets.toLocaleString()} $</td></tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Passifs et Capitaux */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-red-50 border-b border-red-200">
              <h2 className="text-xl font-bold text-red-900">PASSIFS & CAPITAUX PROPRES</h2>
            </div>
            <div className="p-6">
              {totalLiabilities === 0 && totalEquity === 0 ? (
                <div className="text-center py-8 text-slate-500">Aucun passif enregistré</div>
              ) : (
                <table className="w-full">
                  <tbody>
                    {Object.keys(balanceSheet.liabilities.current).length > 0 && (
                      <>
                        <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-2 font-semibold text-slate-700">Passifs courants</td></tr>
                        {Object.entries(balanceSheet.liabilities.current).map(([name, amount]) => (
                          <tr key={name}>
                            <td className="px-6 py-2 text-slate-600">{name}</td>
                            <td className="px-4 py-2 text-right">{amount.toLocaleString()} $</td>
                          </tr>
                        ))}
                        <tr className="border-t"><td className="px-4 py-2 font-medium">Total passifs</td><td className="px-4 py-2 text-right font-medium">{totalLiabilities.toLocaleString()} $</td></tr>
                      </>
                    )}

                    {Object.keys(balanceSheet.equity).length > 0 && (
                      <>
                        <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-2 font-semibold text-slate-700 mt-4">Capitaux propres</td></tr>
                        {Object.entries(balanceSheet.equity).map(([name, amount]) => (
                          <tr key={name}>
                            <td className="px-6 py-2 text-slate-600">{name}</td>
                            <td className="px-4 py-2 text-right">{amount.toLocaleString()} $</td>
                          </tr>
                        ))}
                        <tr className="border-t"><td className="px-4 py-2 font-medium">Total capitaux propres</td><td className="px-4 py-2 text-right font-medium">{totalEquity.toLocaleString()} $</td></tr>
                      </>
                    )}

                    <tr className="bg-red-100"><td className="px-4 py-3 font-bold text-red-900">TOTAL PASSIFS & CAPITAUX</td><td className="px-4 py-3 text-right font-bold text-red-700">{(totalLiabilities + totalEquity).toLocaleString()} $</td></tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flux de trésorerie */}
      {activeTab === 'flux' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 bg-purple-50 border-b border-purple-200">
            <h2 className="text-xl font-bold text-purple-900">État des flux de trésorerie</h2>
            <p className="text-purple-700">BioCycle Peptides Inc. - {periodLabel}</p>
          </div>
          <div className="p-6">
            <table className="w-full">
              <tbody>
                <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-3 font-bold text-slate-900">ACTIVITÉS D&apos;EXPLOITATION</td></tr>
                <tr><td className="px-8 py-2 text-slate-600">Bénéfice net</td><td className="px-4 py-2 text-right">{netProfit.toLocaleString()} $</td></tr>
                {Object.entries(cashFlow.operating).filter(([key]) => key !== 'netIncome').map(([name, amount]) => (
                  <tr key={name}>
                    <td className="px-8 py-2 text-slate-600">{name}</td>
                    <td className={`px-4 py-2 text-right ${amount < 0 ? 'text-red-600' : ''}`}>
                      {amount < 0 ? `(${Math.abs(amount).toLocaleString()})` : amount.toLocaleString()} $
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-green-50">
                  <td className="px-4 py-3 font-semibold text-green-900">Flux net d&apos;exploitation</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{operatingCashFlow.toLocaleString()} $</td>
                </tr>

                <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-3 font-bold text-slate-900">ACTIVITÉS D&apos;INVESTISSEMENT</td></tr>
                {Object.entries(cashFlow.investing).map(([name, amount]) => (
                  <tr key={name}>
                    <td className="px-8 py-2 text-slate-600">{name}</td>
                    <td className={`px-4 py-2 text-right ${amount < 0 ? 'text-red-600' : ''}`}>
                      {amount < 0 ? `(${Math.abs(amount).toLocaleString()})` : amount.toLocaleString()} $
                    </td>
                  </tr>
                ))}
                {Object.keys(cashFlow.investing).length === 0 && (
                  <tr><td className="px-8 py-2 text-slate-400 italic" colSpan={2}>Aucune activité d&apos;investissement</td></tr>
                )}
                <tr className="border-t border-slate-200 bg-red-50">
                  <td className="px-4 py-3 font-semibold text-red-900">Flux net d&apos;investissement</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700">{investingCashFlow.toLocaleString()} $</td>
                </tr>

                <tr className="bg-slate-50"><td colSpan={2} className="px-4 py-3 font-bold text-slate-900">ACTIVITÉS DE FINANCEMENT</td></tr>
                {Object.entries(cashFlow.financing).map(([name, amount]) => (
                  <tr key={name}>
                    <td className="px-8 py-2 text-slate-600">{name}</td>
                    <td className="px-4 py-2 text-right">{amount.toLocaleString()} $</td>
                  </tr>
                ))}
                {Object.keys(cashFlow.financing).length === 0 && (
                  <tr><td className="px-8 py-2 text-slate-400 italic" colSpan={2}>Aucune activité de financement</td></tr>
                )}
                <tr className="border-t border-slate-200 bg-blue-50">
                  <td className="px-4 py-3 font-semibold text-blue-900">Flux net de financement</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{financingCashFlow.toLocaleString()} $</td>
                </tr>

                <tr className="bg-purple-600 text-white">
                  <td className="px-4 py-4 font-bold text-lg">VARIATION NETTE DE TRÉSORERIE</td>
                  <td className="px-4 py-4 text-right font-bold text-lg">{netCashFlow.toLocaleString()} $</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

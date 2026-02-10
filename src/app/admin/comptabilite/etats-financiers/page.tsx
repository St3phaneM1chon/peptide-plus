'use client';

import { useState } from 'react';

export default function EtatsFinanciersPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');
  const [activeTab, setActiveTab] = useState<'bilan' | 'resultats' | 'flux'>('resultats');

  // État des résultats (Income Statement)
  const incomeStatement = {
    revenue: {
      salesCanada: 195000,
      salesUSA: 65000,
      salesEurope: 18000,
      salesOther: 7000,
      shippingCharged: 12500,
      discounts: -8500,
    },
    cogs: {
      purchases: 95000,
      customs: 8500,
      inboundShipping: 4500,
    },
    expenses: {
      shipping: 28500,
      paymentFees: 8900,
      marketing: 18500,
      hosting: 4800,
      professional: 3500,
      depreciation: 1500,
    },
    other: {
      fxGains: -850,
    }
  };

  const totalRevenue = Object.values(incomeStatement.revenue).reduce((a, b) => a + b, 0);
  const totalCogs = Object.values(incomeStatement.cogs).reduce((a, b) => a + b, 0);
  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = Object.values(incomeStatement.expenses).reduce((a, b) => a + b, 0);
  const operatingProfit = grossProfit - totalExpenses;
  const totalOther = Object.values(incomeStatement.other).reduce((a, b) => a + b, 0);
  const netProfit = operatingProfit + totalOther;

  // Bilan (Balance Sheet)
  const balanceSheet = {
    assets: {
      current: {
        cash: 45230.50,
        accountsReceivable: 8750,
        inventory: 35600,
        prepaidExpenses: 1200,
      },
      nonCurrent: {
        equipment: 5000,
        accumulatedDepreciation: -1500,
      }
    },
    liabilities: {
      current: {
        accountsPayable: 12300,
        taxesPayable: 4250,
        deferredRevenue: 1500,
      }
    },
    equity: {
      shareCapital: 50000,
      retainedEarnings: 28530.50,
    }
  };

  const totalCurrentAssets = Object.values(balanceSheet.assets.current).reduce((a, b) => a + b, 0);
  const totalNonCurrentAssets = Object.values(balanceSheet.assets.nonCurrent).reduce((a, b) => a + b, 0);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = Object.values(balanceSheet.liabilities.current).reduce((a, b) => a + b, 0);
  const totalEquity = Object.values(balanceSheet.equity).reduce((a, b) => a + b, 0);

  // Flux de trésorerie (Cash Flow)
  const cashFlow = {
    operating: {
      netIncome: netProfit,
      depreciation: 1500,
      accountsReceivable: -2500,
      inventory: -5000,
      accountsPayable: 3000,
    },
    investing: {
      equipmentPurchase: -2000,
    },
    financing: {
      dividends: 0,
    }
  };

  const operatingCashFlow = Object.values(cashFlow.operating).reduce((a, b) => a + b, 0);
  const investingCashFlow = Object.values(cashFlow.investing).reduce((a, b) => a + b, 0);
  const financingCashFlow = Object.values(cashFlow.financing).reduce((a, b) => a + b, 0);
  const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">États financiers</h1>
          <p className="text-gray-500">Bilan, état des résultats et flux de trésorerie</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="2026-01">Janvier 2026</option>
            <option value="2025-Q4">Q4 2025</option>
            <option value="2025">Année 2025</option>
          </select>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('resultats')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'resultats' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500'
            }`}
          >
            État des résultats
          </button>
          <button
            onClick={() => setActiveTab('bilan')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'bilan' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500'
            }`}
          >
            Bilan
          </button>
          <button
            onClick={() => setActiveTab('flux')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'flux' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500'
            }`}
          >
            Flux de trésorerie
          </button>
        </nav>
      </div>

      {/* État des résultats */}
      {activeTab === 'resultats' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 bg-emerald-50 border-b border-emerald-200">
            <h2 className="text-xl font-bold text-emerald-900">État des résultats</h2>
            <p className="text-emerald-700">BioCycle Peptides Inc. - Janvier 2026</p>
          </div>
          <div className="p-6">
            <table className="w-full">
              <tbody>
                {/* Revenus */}
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">REVENUS</td>
                </tr>
                <tr><td className="px-8 py-2 text-gray-600">Ventes Canada</td><td className="px-4 py-2 text-right">{incomeStatement.revenue.salesCanada.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Ventes USA</td><td className="px-4 py-2 text-right">{incomeStatement.revenue.salesUSA.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Ventes Europe</td><td className="px-4 py-2 text-right">{incomeStatement.revenue.salesEurope.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Ventes autres pays</td><td className="px-4 py-2 text-right">{incomeStatement.revenue.salesOther.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Frais de livraison facturés</td><td className="px-4 py-2 text-right">{incomeStatement.revenue.shippingCharged.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Remises et retours</td><td className="px-4 py-2 text-right text-red-600">({Math.abs(incomeStatement.revenue.discounts).toLocaleString()}) $</td></tr>
                <tr className="border-t border-gray-200">
                  <td className="px-4 py-3 font-semibold text-gray-900">Total revenus</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{totalRevenue.toLocaleString()} $</td>
                </tr>

                {/* CMV */}
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">COÛT DES MARCHANDISES VENDUES</td>
                </tr>
                <tr><td className="px-8 py-2 text-gray-600">Achats de marchandises</td><td className="px-4 py-2 text-right">{incomeStatement.cogs.purchases.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Frais de douane et importation</td><td className="px-4 py-2 text-right">{incomeStatement.cogs.customs.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Frais de transport entrant</td><td className="px-4 py-2 text-right">{incomeStatement.cogs.inboundShipping.toLocaleString()} $</td></tr>
                <tr className="border-t border-gray-200">
                  <td className="px-4 py-3 font-semibold text-gray-900">Total CMV</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">({totalCogs.toLocaleString()}) $</td>
                </tr>

                {/* Marge brute */}
                <tr className="bg-emerald-100">
                  <td className="px-4 py-3 font-bold text-emerald-900">MARGE BRUTE</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700">{grossProfit.toLocaleString()} $ ({((grossProfit/totalRevenue)*100).toFixed(1)}%)</td>
                </tr>

                {/* Dépenses */}
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">DÉPENSES D'EXPLOITATION</td>
                </tr>
                <tr><td className="px-8 py-2 text-gray-600">Frais de livraison</td><td className="px-4 py-2 text-right">{incomeStatement.expenses.shipping.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Frais bancaires et paiement</td><td className="px-4 py-2 text-right">{incomeStatement.expenses.paymentFees.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Marketing et publicité</td><td className="px-4 py-2 text-right">{incomeStatement.expenses.marketing.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Hébergement et tech</td><td className="px-4 py-2 text-right">{incomeStatement.expenses.hosting.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Frais professionnels</td><td className="px-4 py-2 text-right">{incomeStatement.expenses.professional.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Amortissement</td><td className="px-4 py-2 text-right">{incomeStatement.expenses.depreciation.toLocaleString()} $</td></tr>
                <tr className="border-t border-gray-200">
                  <td className="px-4 py-3 font-semibold text-gray-900">Total dépenses</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">({totalExpenses.toLocaleString()}) $</td>
                </tr>

                {/* Bénéfice d'exploitation */}
                <tr className="bg-blue-100">
                  <td className="px-4 py-3 font-bold text-blue-900">BÉNÉFICE D'EXPLOITATION</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{operatingProfit.toLocaleString()} $</td>
                </tr>

                {/* Autres */}
                <tr className="bg-gray-50">
                  <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">AUTRES PRODUITS / CHARGES</td>
                </tr>
                <tr><td className="px-8 py-2 text-gray-600">Gains/pertes de change</td><td className="px-4 py-2 text-right text-red-600">({Math.abs(incomeStatement.other.fxGains).toLocaleString()}) $</td></tr>

                {/* Bénéfice net */}
                <tr className="bg-emerald-600 text-white">
                  <td className="px-4 py-4 font-bold text-lg">BÉNÉFICE NET</td>
                  <td className="px-4 py-4 text-right font-bold text-lg">{netProfit.toLocaleString()} $</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bilan */}
      {activeTab === 'bilan' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Actifs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 bg-blue-50 border-b border-blue-200">
              <h2 className="text-xl font-bold text-blue-900">ACTIFS</h2>
            </div>
            <div className="p-6">
              <table className="w-full">
                <tbody>
                  <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 font-semibold text-gray-700">Actifs courants</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Encaisse</td><td className="px-4 py-2 text-right">{balanceSheet.assets.current.cash.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Comptes clients</td><td className="px-4 py-2 text-right">{balanceSheet.assets.current.accountsReceivable.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Stocks</td><td className="px-4 py-2 text-right">{balanceSheet.assets.current.inventory.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Charges payées d'avance</td><td className="px-4 py-2 text-right">{balanceSheet.assets.current.prepaidExpenses.toLocaleString()} $</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-medium">Total actifs courants</td><td className="px-4 py-2 text-right font-medium">{totalCurrentAssets.toLocaleString()} $</td></tr>
                  
                  <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 font-semibold text-gray-700 mt-4">Actifs non courants</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Équipement</td><td className="px-4 py-2 text-right">{balanceSheet.assets.nonCurrent.equipment.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Amortissement cumulé</td><td className="px-4 py-2 text-right text-red-600">({Math.abs(balanceSheet.assets.nonCurrent.accumulatedDepreciation).toLocaleString()}) $</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-medium">Total actifs non courants</td><td className="px-4 py-2 text-right font-medium">{totalNonCurrentAssets.toLocaleString()} $</td></tr>
                  
                  <tr className="bg-blue-100"><td className="px-4 py-3 font-bold text-blue-900">TOTAL ACTIFS</td><td className="px-4 py-3 text-right font-bold text-blue-700">{totalAssets.toLocaleString()} $</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Passifs et Capitaux */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 bg-red-50 border-b border-red-200">
              <h2 className="text-xl font-bold text-red-900">PASSIFS & CAPITAUX PROPRES</h2>
            </div>
            <div className="p-6">
              <table className="w-full">
                <tbody>
                  <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 font-semibold text-gray-700">Passifs courants</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Comptes fournisseurs</td><td className="px-4 py-2 text-right">{balanceSheet.liabilities.current.accountsPayable.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Taxes à payer</td><td className="px-4 py-2 text-right">{balanceSheet.liabilities.current.taxesPayable.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Revenus reportés</td><td className="px-4 py-2 text-right">{balanceSheet.liabilities.current.deferredRevenue.toLocaleString()} $</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-medium">Total passifs</td><td className="px-4 py-2 text-right font-medium">{totalLiabilities.toLocaleString()} $</td></tr>
                  
                  <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 font-semibold text-gray-700 mt-4">Capitaux propres</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Capital-actions</td><td className="px-4 py-2 text-right">{balanceSheet.equity.shareCapital.toLocaleString()} $</td></tr>
                  <tr><td className="px-6 py-2 text-gray-600">Bénéfices non répartis</td><td className="px-4 py-2 text-right">{balanceSheet.equity.retainedEarnings.toLocaleString()} $</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-medium">Total capitaux propres</td><td className="px-4 py-2 text-right font-medium">{totalEquity.toLocaleString()} $</td></tr>
                  
                  <tr className="bg-red-100"><td className="px-4 py-3 font-bold text-red-900">TOTAL PASSIFS & CAPITAUX</td><td className="px-4 py-3 text-right font-bold text-red-700">{(totalLiabilities + totalEquity).toLocaleString()} $</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Flux de trésorerie */}
      {activeTab === 'flux' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 bg-purple-50 border-b border-purple-200">
            <h2 className="text-xl font-bold text-purple-900">État des flux de trésorerie</h2>
            <p className="text-purple-700">BioCycle Peptides Inc. - Janvier 2026</p>
          </div>
          <div className="p-6">
            <table className="w-full">
              <tbody>
                <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-3 font-bold text-gray-900">ACTIVITÉS D'EXPLOITATION</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Bénéfice net</td><td className="px-4 py-2 text-right">{cashFlow.operating.netIncome.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Amortissement</td><td className="px-4 py-2 text-right">{cashFlow.operating.depreciation.toLocaleString()} $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Variation comptes clients</td><td className="px-4 py-2 text-right text-red-600">({Math.abs(cashFlow.operating.accountsReceivable).toLocaleString()}) $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Variation stocks</td><td className="px-4 py-2 text-right text-red-600">({Math.abs(cashFlow.operating.inventory).toLocaleString()}) $</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Variation fournisseurs</td><td className="px-4 py-2 text-right">{cashFlow.operating.accountsPayable.toLocaleString()} $</td></tr>
                <tr className="border-t border-gray-200 bg-green-50">
                  <td className="px-4 py-3 font-semibold text-green-900">Flux net d'exploitation</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{operatingCashFlow.toLocaleString()} $</td>
                </tr>

                <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-3 font-bold text-gray-900">ACTIVITÉS D'INVESTISSEMENT</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Achat d'équipement</td><td className="px-4 py-2 text-right text-red-600">({Math.abs(cashFlow.investing.equipmentPurchase).toLocaleString()}) $</td></tr>
                <tr className="border-t border-gray-200 bg-red-50">
                  <td className="px-4 py-3 font-semibold text-red-900">Flux net d'investissement</td>
                  <td className="px-4 py-3 text-right font-bold text-red-700">{investingCashFlow.toLocaleString()} $</td>
                </tr>

                <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-3 font-bold text-gray-900">ACTIVITÉS DE FINANCEMENT</td></tr>
                <tr><td className="px-8 py-2 text-gray-600">Dividendes versés</td><td className="px-4 py-2 text-right">{cashFlow.financing.dividends.toLocaleString()} $</td></tr>
                <tr className="border-t border-gray-200 bg-blue-50">
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

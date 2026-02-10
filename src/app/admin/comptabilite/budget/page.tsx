'use client';

import { useState } from 'react';

interface BudgetLine {
  id: string;
  category: string;
  accountCode: string;
  budget: number;
  actual: number;
  variance: number;
  percentUsed: number;
}

export default function BudgetPage() {
  const [selectedYear, setSelectedYear] = useState('2026');

  const revenueBudget: BudgetLine[] = [
    { id: '1', category: 'Ventes Canada', accountCode: '4010', budget: 200000, actual: 195000, variance: -5000, percentUsed: 97.5 },
    { id: '2', category: 'Ventes USA', accountCode: '4020', budget: 70000, actual: 65000, variance: -5000, percentUsed: 92.9 },
    { id: '3', category: 'Ventes Europe', accountCode: '4030', budget: 20000, actual: 18000, variance: -2000, percentUsed: 90.0 },
    { id: '4', category: 'Ventes autres', accountCode: '4040', budget: 10000, actual: 7000, variance: -3000, percentUsed: 70.0 },
    { id: '5', category: 'Frais livraison facturés', accountCode: '4100', budget: 15000, actual: 12500, variance: -2500, percentUsed: 83.3 },
  ];

  const expenseBudget: BudgetLine[] = [
    { id: '1', category: 'Achats marchandises', accountCode: '5010', budget: 100000, actual: 95000, variance: 5000, percentUsed: 95.0 },
    { id: '2', category: 'Frais de livraison', accountCode: '6000', budget: 30000, actual: 28500, variance: 1500, percentUsed: 95.0 },
    { id: '3', category: 'Marketing', accountCode: '6200', budget: 25000, actual: 18500, variance: 6500, percentUsed: 74.0 },
    { id: '4', category: 'Frais paiement', accountCode: '6100', budget: 10000, actual: 8900, variance: 1100, percentUsed: 89.0 },
    { id: '5', category: 'Hébergement/Tech', accountCode: '6300', budget: 6000, actual: 4800, variance: 1200, percentUsed: 80.0 },
    { id: '6', category: 'Frais professionnels', accountCode: '6700', budget: 5000, actual: 3500, variance: 1500, percentUsed: 70.0 },
  ];

  const totalRevenueBudget = revenueBudget.reduce((sum, l) => sum + l.budget, 0);
  const totalRevenueActual = revenueBudget.reduce((sum, l) => sum + l.actual, 0);
  const totalExpenseBudget = expenseBudget.reduce((sum, l) => sum + l.budget, 0);
  const totalExpenseActual = expenseBudget.reduce((sum, l) => sum + l.actual, 0);

  const budgetedProfit = totalRevenueBudget - totalExpenseBudget;
  const actualProfit = totalRevenueActual - totalExpenseActual;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500">Planification et suivi budgétaire</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Modifier budget
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Revenus budgétés</p>
          <p className="text-2xl font-bold text-gray-900">{totalRevenueBudget.toLocaleString()} $</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(totalRevenueActual/totalRevenueBudget)*100}%` }} />
            </div>
            <span className="text-xs text-gray-500">{((totalRevenueActual/totalRevenueBudget)*100).toFixed(1)}%</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Dépenses budgétées</p>
          <p className="text-2xl font-bold text-gray-900">{totalExpenseBudget.toLocaleString()} $</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${(totalExpenseActual/totalExpenseBudget)*100}%` }} />
            </div>
            <span className="text-xs text-gray-500">{((totalExpenseActual/totalExpenseBudget)*100).toFixed(1)}%</span>
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
          <p className="text-sm text-emerald-600">Bénéfice budgété</p>
          <p className="text-2xl font-bold text-emerald-700">{budgetedProfit.toLocaleString()} $</p>
          <p className="text-xs text-emerald-600 mt-2">Marge: {((budgetedProfit/totalRevenueBudget)*100).toFixed(1)}%</p>
        </div>
        <div className={`rounded-xl p-5 border ${actualProfit >= budgetedProfit ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className={`text-sm ${actualProfit >= budgetedProfit ? 'text-green-600' : 'text-yellow-600'}`}>Bénéfice réel</p>
          <p className={`text-2xl font-bold ${actualProfit >= budgetedProfit ? 'text-green-700' : 'text-yellow-700'}`}>{actualProfit.toLocaleString()} $</p>
          <p className={`text-xs mt-2 ${actualProfit >= budgetedProfit ? 'text-green-600' : 'text-yellow-600'}`}>
            {actualProfit >= budgetedProfit ? '+' : ''}{(actualProfit - budgetedProfit).toLocaleString()} $ vs budget
          </p>
        </div>
      </div>

      {/* Revenue Budget */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-emerald-50">
          <h3 className="font-semibold text-emerald-900">Budget des revenus</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Compte</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Budget</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Réel</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Écart</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">% Atteint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {revenueBudget.map((line) => (
              <tr key={line.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{line.category}</td>
                <td className="px-4 py-3 font-mono text-sm text-gray-500">{line.accountCode}</td>
                <td className="px-4 py-3 text-right text-gray-900">{line.budget.toLocaleString()} $</td>
                <td className="px-4 py-3 text-right text-gray-900">{line.actual.toLocaleString()} $</td>
                <td className={`px-4 py-3 text-right font-medium ${line.variance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {line.variance >= 0 ? '-' : '+'}{Math.abs(line.variance).toLocaleString()} $
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${line.percentUsed >= 100 ? 'bg-green-500' : line.percentUsed >= 75 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(line.percentUsed, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12">{line.percentUsed.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-emerald-100">
            <tr>
              <td className="px-4 py-3 font-bold text-emerald-900">Total revenus</td>
              <td></td>
              <td className="px-4 py-3 text-right font-bold text-emerald-900">{totalRevenueBudget.toLocaleString()} $</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-900">{totalRevenueActual.toLocaleString()} $</td>
              <td className="px-4 py-3 text-right font-bold text-red-600">-{(totalRevenueBudget - totalRevenueActual).toLocaleString()} $</td>
              <td className="px-4 py-3 text-center font-bold text-emerald-900">{((totalRevenueActual/totalRevenueBudget)*100).toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Expense Budget */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-red-50">
          <h3 className="font-semibold text-red-900">Budget des dépenses</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Compte</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Budget</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Réel</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Écart</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">% Utilisé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {expenseBudget.map((line) => (
              <tr key={line.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{line.category}</td>
                <td className="px-4 py-3 font-mono text-sm text-gray-500">{line.accountCode}</td>
                <td className="px-4 py-3 text-right text-gray-900">{line.budget.toLocaleString()} $</td>
                <td className="px-4 py-3 text-right text-gray-900">{line.actual.toLocaleString()} $</td>
                <td className={`px-4 py-3 text-right font-medium ${line.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {line.variance >= 0 ? '+' : ''}{line.variance.toLocaleString()} $
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${line.percentUsed >= 100 ? 'bg-red-500' : line.percentUsed >= 90 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(line.percentUsed, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12">{line.percentUsed.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-red-100">
            <tr>
              <td className="px-4 py-3 font-bold text-red-900">Total dépenses</td>
              <td></td>
              <td className="px-4 py-3 text-right font-bold text-red-900">{totalExpenseBudget.toLocaleString()} $</td>
              <td className="px-4 py-3 text-right font-bold text-red-900">{totalExpenseActual.toLocaleString()} $</td>
              <td className="px-4 py-3 text-right font-bold text-green-600">+{(totalExpenseBudget - totalExpenseActual).toLocaleString()} $</td>
              <td className="px-4 py-3 text-center font-bold text-red-900">{((totalExpenseActual/totalExpenseBudget)*100).toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Tendance mensuelle Budget vs Réel</h3>
        <div className="h-48 flex items-end gap-4">
          {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'].map((month) => {
            const budgetHeight = 80 + Math.random() * 40;
            const actualHeight = budgetHeight * (0.7 + Math.random() * 0.4);
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 items-end" style={{ height: '160px' }}>
                  <div className="flex-1 bg-gray-300 rounded-t" style={{ height: `${budgetHeight}%` }} title="Budget" />
                  <div className={`flex-1 rounded-t ${actualHeight > budgetHeight ? 'bg-green-500' : 'bg-emerald-500'}`} style={{ height: `${actualHeight}%` }} title="Réel" />
                </div>
                <span className="text-xs text-gray-500">{month}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-300 rounded" />
            <span className="text-sm text-gray-600">Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded" />
            <span className="text-sm text-gray-600">Réel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

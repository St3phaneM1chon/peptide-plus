'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { PageHeader, Button } from '@/components/admin';
import { useI18n } from '@/i18n/client';

interface BudgetLine {
  id: string;
  category: string;
  accountCode: string;
  type: string;
  budget: number;
  actual: number;
  variance: number;
  percentUsed: number;
}

interface ApiBudgetLine {
  id: string;
  accountCode: string;
  accountName: string;
  type: string;
  january: number;
  february: number;
  march: number;
  april: number;
  may: number;
  june: number;
  july: number;
  august: number;
  september: number;
  october: number;
  november: number;
  december: number;
  total: number;
}

interface ApiBudget {
  id: string;
  name: string;
  year: number;
  lines: ApiBudgetLine[];
}

export default function BudgetPage() {
  const { t, locale } = useI18n();
  const [selectedYear, setSelectedYear] = useState('2026');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueBudget, setRevenueBudget] = useState<BudgetLine[]>([]);
  const [expenseBudget, setExpenseBudget] = useState<BudgetLine[]>([]);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch budgets and dashboard data in parallel for actual figures
      const [budgetRes, dashboardRes] = await Promise.all([
        fetch(`/api/accounting/budgets?year=${selectedYear}`),
        fetch('/api/accounting/dashboard'),
      ]);

      if (!budgetRes.ok) throw new Error(t('admin.budget.budgetLoadError'));

      const budgetData = await budgetRes.json();
      const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;

      const budgets: ApiBudget[] = budgetData.budgets || [];

      // Flatten all budget lines from all budgets for the selected year
      const allLines: ApiBudgetLine[] = budgets.flatMap(b => b.lines);

      // Separate revenue and expense lines
      const revenueLines = allLines.filter(l => l.type === 'REVENUE' || l.accountCode.startsWith('4'));
      const expenseLines = allLines.filter(l => l.type === 'EXPENSE' || l.accountCode.startsWith('5') || l.accountCode.startsWith('6'));

      // For actuals, we use a simplified approach: distribute the dashboard totals
      // proportionally or use the budget total as a base with a variance
      const totalRevenueActual = dashboardData?.totalRevenue || 0;
      const totalExpenseActual = dashboardData?.totalExpenses || 0;
      const totalRevenueBudgeted = revenueLines.reduce((s, l) => s + l.total, 0);
      const totalExpenseBudgeted = expenseLines.reduce((s, l) => s + l.total, 0);

      // Map revenue lines
      const mappedRevenue: BudgetLine[] = revenueLines.map(l => {
        const budget = l.total;
        // Distribute actual proportionally if we have dashboard totals
        const actual = totalRevenueBudgeted > 0
          ? Math.round((budget / totalRevenueBudgeted) * totalRevenueActual)
          : 0;
        const variance = actual - budget;
        const percentUsed = budget > 0 ? (actual / budget) * 100 : 0;
        return {
          id: l.id,
          category: l.accountName,
          accountCode: l.accountCode,
          type: l.type,
          budget,
          actual,
          variance,
          percentUsed: Math.round(percentUsed * 10) / 10,
        };
      });

      // Map expense lines
      const mappedExpense: BudgetLine[] = expenseLines.map(l => {
        const budget = l.total;
        const actual = totalExpenseBudgeted > 0
          ? Math.round((budget / totalExpenseBudgeted) * totalExpenseActual)
          : 0;
        const variance = budget - actual;
        const percentUsed = budget > 0 ? (actual / budget) * 100 : 0;
        return {
          id: l.id,
          category: l.accountName,
          accountCode: l.accountCode,
          type: l.type,
          budget,
          actual,
          variance,
          percentUsed: Math.round(percentUsed * 10) / 10,
        };
      });

      setRevenueBudget(mappedRevenue);
      setExpenseBudget(mappedExpense);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.budget.loadingError'));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, t]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const totalRevenueBudget = revenueBudget.reduce((sum, l) => sum + l.budget, 0);
  const totalRevenueActual = revenueBudget.reduce((sum, l) => sum + l.actual, 0);
  const totalExpenseBudgetVal = expenseBudget.reduce((sum, l) => sum + l.budget, 0);
  const totalExpenseActual = expenseBudget.reduce((sum, l) => sum + l.actual, 0);

  const budgetedProfit = totalRevenueBudget - totalExpenseBudgetVal;
  const actualProfit = totalRevenueActual - totalExpenseActual;

  const months = [
    t('admin.budget.monthJan'), t('admin.budget.monthFeb'), t('admin.budget.monthMar'),
    t('admin.budget.monthApr'), t('admin.budget.monthMay'), t('admin.budget.monthJun'),
    t('admin.budget.monthJul'), t('admin.budget.monthAug'), t('admin.budget.monthSep'),
    t('admin.budget.monthOct'), t('admin.budget.monthNov'), t('admin.budget.monthDec'),
  ];

  if (loading) return <div className="p-8 text-center">{t('admin.budget.loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.budget.errorPrefix')} {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.budget.title')}
        subtitle={t('admin.budget.subtitle')}
        actions={
          <div className="flex gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <Button variant="primary" icon={Pencil} className="bg-emerald-600 hover:bg-emerald-700">
              {t('admin.budget.editBudget')}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.budget.budgetedRevenue')}</p>
          <p className="text-2xl font-bold text-slate-900">{totalRevenueBudget.toLocaleString(locale)} $</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalRevenueBudget > 0 ? (totalRevenueActual/totalRevenueBudget)*100 : 0}%` }} />
            </div>
            <span className="text-xs text-slate-500">{totalRevenueBudget > 0 ? ((totalRevenueActual/totalRevenueBudget)*100).toFixed(1) : '0.0'}%</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.budget.budgetedExpenses')}</p>
          <p className="text-2xl font-bold text-slate-900">{totalExpenseBudgetVal.toLocaleString(locale)} $</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${totalExpenseBudgetVal > 0 ? (totalExpenseActual/totalExpenseBudgetVal)*100 : 0}%` }} />
            </div>
            <span className="text-xs text-slate-500">{totalExpenseBudgetVal > 0 ? ((totalExpenseActual/totalExpenseBudgetVal)*100).toFixed(1) : '0.0'}%</span>
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
          <p className="text-sm text-emerald-600">{t('admin.budget.budgetedProfit')}</p>
          <p className="text-2xl font-bold text-emerald-700">{budgetedProfit.toLocaleString(locale)} $</p>
          <p className="text-xs text-emerald-600 mt-2">{t('admin.budget.margin').replace('{value}', totalRevenueBudget > 0 ? ((budgetedProfit/totalRevenueBudget)*100).toFixed(1) : '0.0')}</p>
        </div>
        <div className={`rounded-xl p-5 border ${actualProfit >= budgetedProfit ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className={`text-sm ${actualProfit >= budgetedProfit ? 'text-green-600' : 'text-yellow-600'}`}>{t('admin.budget.actualProfit')}</p>
          <p className={`text-2xl font-bold ${actualProfit >= budgetedProfit ? 'text-green-700' : 'text-yellow-700'}`}>{actualProfit.toLocaleString(locale)} $</p>
          <p className={`text-xs mt-2 ${actualProfit >= budgetedProfit ? 'text-green-600' : 'text-yellow-600'}`}>
            {actualProfit >= budgetedProfit ? '+' : ''}{(actualProfit - budgetedProfit).toLocaleString(locale)} $ {t('admin.budget.vsBudget')}
          </p>
        </div>
      </div>

      {/* Revenue Budget */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-emerald-50">
          <h3 className="font-semibold text-emerald-900">{t('admin.budget.revenueBudgetTitle')}</h3>
        </div>
        {revenueBudget.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('admin.budget.noRevenueBudget').replace('{year}', selectedYear)}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.categoryHeader')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.accountHeader')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.budgetHeader')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.actualHeader')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.varianceHeader')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.percentAchieved')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {revenueBudget.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{line.category}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-500">{line.accountCode}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{line.budget.toLocaleString(locale)} $</td>
                  <td className="px-4 py-3 text-right text-slate-900">{line.actual.toLocaleString(locale)} $</td>
                  <td className={`px-4 py-3 text-right font-medium ${line.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {line.variance >= 0 ? '+' : ''}{line.variance.toLocaleString(locale)} $
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${line.percentUsed >= 100 ? 'bg-green-500' : line.percentUsed >= 75 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                          style={{ width: `${Math.min(line.percentUsed, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-12">{line.percentUsed.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-emerald-100">
              <tr>
                <td className="px-4 py-3 font-bold text-emerald-900">{t('admin.budget.totalRevenue')}</td>
                <td></td>
                <td className="px-4 py-3 text-right font-bold text-emerald-900">{totalRevenueBudget.toLocaleString(locale)} $</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-900">{totalRevenueActual.toLocaleString(locale)} $</td>
                <td className={`px-4 py-3 text-right font-bold ${(totalRevenueActual - totalRevenueBudget) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(totalRevenueActual - totalRevenueBudget) >= 0 ? '+' : ''}{(totalRevenueActual - totalRevenueBudget).toLocaleString(locale)} $
                </td>
                <td className="px-4 py-3 text-center font-bold text-emerald-900">{totalRevenueBudget > 0 ? ((totalRevenueActual/totalRevenueBudget)*100).toFixed(1) : '0.0'}%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Expense Budget */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-red-50">
          <h3 className="font-semibold text-red-900">{t('admin.budget.expenseBudgetTitle')}</h3>
        </div>
        {expenseBudget.length === 0 ? (
          <div className="p-8 text-center text-slate-400">{t('admin.budget.noExpenseBudget').replace('{year}', selectedYear)}</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.categoryHeader')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.accountHeader')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.budgetHeader')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.actualHeader')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.varianceHeader')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.budget.percentUsed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {expenseBudget.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{line.category}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-500">{line.accountCode}</td>
                  <td className="px-4 py-3 text-right text-slate-900">{line.budget.toLocaleString(locale)} $</td>
                  <td className="px-4 py-3 text-right text-slate-900">{line.actual.toLocaleString(locale)} $</td>
                  <td className={`px-4 py-3 text-right font-medium ${line.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {line.variance >= 0 ? '+' : ''}{line.variance.toLocaleString(locale)} $
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${line.percentUsed >= 100 ? 'bg-red-500' : line.percentUsed >= 90 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(line.percentUsed, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-12">{line.percentUsed.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-red-100">
              <tr>
                <td className="px-4 py-3 font-bold text-red-900">{t('admin.budget.totalExpenses')}</td>
                <td></td>
                <td className="px-4 py-3 text-right font-bold text-red-900">{totalExpenseBudgetVal.toLocaleString(locale)} $</td>
                <td className="px-4 py-3 text-right font-bold text-red-900">{totalExpenseActual.toLocaleString(locale)} $</td>
                <td className="px-4 py-3 text-right font-bold text-green-600">+{(totalExpenseBudgetVal - totalExpenseActual).toLocaleString(locale)} $</td>
                <td className="px-4 py-3 text-center font-bold text-red-900">{totalExpenseBudgetVal > 0 ? ((totalExpenseActual/totalExpenseBudgetVal)*100).toFixed(1) : '0.0'}%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t('admin.budget.monthlyTrend')}</h3>
        <div className="h-48 flex items-end gap-4">
          {months.map((month) => {
            // Simplified monthly trend visualization based on overall budget progress
            const budgetHeight = totalRevenueBudget > 0 ? 80 : 20;
            const actualHeight = totalRevenueActual > 0 ? budgetHeight * (totalRevenueActual / Math.max(totalRevenueBudget, 1)) : 10;
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 items-end" style={{ height: '160px' }}>
                  <div className="flex-1 bg-slate-300 rounded-t" style={{ height: `${Math.min(budgetHeight, 100)}%` }} title={t('admin.budget.budgetLegend')} />
                  <div className={`flex-1 rounded-t ${actualHeight > budgetHeight ? 'bg-green-500' : 'bg-emerald-500'}`} style={{ height: `${Math.min(actualHeight, 100)}%` }} title={t('admin.budget.actualLegend')} />
                </div>
                <span className="text-xs text-slate-500">{month}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-slate-300 rounded" />
            <span className="text-sm text-slate-600">{t('admin.budget.budgetLegend')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded" />
            <span className="text-sm text-slate-600">{t('admin.budget.actualLegend')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

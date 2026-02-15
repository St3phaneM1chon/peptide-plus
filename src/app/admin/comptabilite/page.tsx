'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Landmark,
  DollarSign,
  BarChart3,
  TrendingUp,
  Download,
  AlertTriangle,
  AlertCircle,
  Info,
  Plus,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { PageHeader, StatCard, StatusBadge, Button, SelectFilter } from '@/components/admin';
import { useI18n } from '@/i18n/client';

interface DashboardStats {
  tresorerie: number;
  tresorerieChange: number;
  caMonth: number;
  caChange: number;
  margeBrute: number;
  margeChange: number;
  beneficeNet: number;
  beneficeChange: number;
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  message: string;
  link?: string;
}

const alertIcons: Record<Alert['type'], typeof AlertTriangle> = {
  danger: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

export default function ComptabiliteDashboard() {
  const { t, locale } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<DashboardStats>({
    tresorerie: 0,
    tresorerieChange: 0,
    caMonth: 0,
    caChange: 0,
    margeBrute: 0,
    margeChange: 0,
    beneficeNet: 0,
    beneficeChange: 0,
  });

  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number; expenses: number; profit: number }[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [topExpenses, setTopExpenses] = useState<{ category: string; amount: number; percentage: number }[]>([]);

  const [cashFlow, setCashFlow] = useState({
    operating: 0,
    investing: 0,
    financing: 0,
    net: 0,
  });

  const monthNames = [
    t('admin.accounting.monthJan'), t('admin.accounting.monthFeb'), t('admin.accounting.monthMar'),
    t('admin.accounting.monthApr'), t('admin.accounting.monthMay'), t('admin.accounting.monthJun'),
    t('admin.accounting.monthJul'), t('admin.accounting.monthAug'), t('admin.accounting.monthSep'),
    t('admin.accounting.monthOct'), t('admin.accounting.monthNov'), t('admin.accounting.monthDec'),
  ];

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch(`/api/accounting/dashboard?period=${selectedPeriod}`);
        if (response.ok) {
          const data = await response.json();

          // Map API response to dashboard stats
          const totalRevenue = Number(data.totalRevenue) || 0;
          const totalExpenses = Number(data.totalExpenses) || 0;
          const bankBalance = Number(data.bankBalance) || 0;
          const profit = totalRevenue - totalExpenses;
          const margin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

          setStats({
            tresorerie: bankBalance,
            tresorerieChange: 0,
            caMonth: totalRevenue,
            caChange: 0,
            margeBrute: Math.round(margin * 10) / 10,
            margeChange: 0,
            beneficeNet: profit,
            beneficeChange: 0,
          });

          // Map recent entries to revenue data if available
          if (data.revenueData && Array.isArray(data.revenueData)) {
            setRevenueData(data.revenueData);
          } else {
            // Build a single-month bar from totals
            const currentMonth = monthNames[new Date().getMonth()];
            setRevenueData([{ month: currentMonth, revenue: totalRevenue, expenses: totalExpenses, profit }]);
          }

          // Map tasks if available
          if (data.tasks && Array.isArray(data.tasks)) {
            setTasks(data.tasks);
          }

          // Map top expenses if available
          if (data.topExpenses && Array.isArray(data.topExpenses)) {
            setTopExpenses(data.topExpenses);
          }

          // Map cash flow if available
          if (data.cashFlow) {
            setCashFlow(data.cashFlow);
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  // Fetch alerts from API
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/accounting/alerts');
        if (response.ok) {
          const data = await response.json();
          const mappedAlerts: Alert[] = data.alerts.map((alert: Record<string, string>) => ({
            id: alert.id,
            type: alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'danger' :
                  alert.severity === 'MEDIUM' ? 'warning' : 'info',
            message: alert.title + ': ' + alert.message,
            link: alert.link,
          }));
          setAlerts(mappedAlerts.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const maxRevenue = revenueData.length > 0 ? Math.max(...revenueData.map(d => d.revenue)) : 1;

  const periodOptions = [
    { value: '2026-01', label: t('admin.accounting.january2026') },
    { value: '2025-12', label: t('admin.accounting.december2025') },
    { value: '2025-11', label: t('admin.accounting.november2025') },
    { value: '2025-Q4', label: t('admin.accounting.q42025') },
    { value: '2025', label: t('admin.accounting.year2025') },
  ];

  const expenseBarColors = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-sky-500',
    'bg-pink-500',
    'bg-slate-400',
  ];

  if (loading) return <div className="p-8 text-center">{t('admin.accounting.loading')}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.accounting.dashboardTitle')}
        subtitle={t('admin.accounting.dashboardSubtitle')}
        actions={
          <>
            <SelectFilter
              label={t('admin.accounting.period')}
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
            />
            <Button variant="primary" icon={Download}>
              {t('admin.accounting.export')}
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={t('admin.accounting.treasury')}
          value={stats.tresorerie.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}
          icon={Landmark}
          trend={{ value: stats.tresorerieChange, label: t('admin.accounting.vsLastMonth') }}
        />
        <StatCard
          label={t('admin.accounting.monthlyRevenue')}
          value={stats.caMonth.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}
          icon={DollarSign}
          trend={{ value: stats.caChange, label: t('admin.accounting.vsLastMonth') }}
        />
        <StatCard
          label={t('admin.accounting.grossMargin')}
          value={`${stats.margeBrute}%`}
          icon={BarChart3}
          trend={{ value: stats.margeChange, label: t('admin.accounting.vsLastMonth') }}
        />
        <StatCard
          label={t('admin.accounting.netProfit')}
          value={stats.beneficeNet.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}
          icon={TrendingUp}
          trend={{ value: stats.beneficeChange, label: t('admin.accounting.vsLastMonth') }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.accounting.financialEvolution')}</h3>
          <div className="h-64 flex items-end gap-2">
            {revenueData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-1" style={{ height: '200px' }}>
                  <div
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                    title={`${t('admin.accounting.revenueLabel')}: ${data.revenue.toLocaleString(locale)} $`}
                  />
                  <div
                    className="w-full bg-red-400 rounded-b"
                    style={{ height: `${(data.expenses / maxRevenue) * 100}%`, marginTop: '-' + ((data.expenses / maxRevenue) * 100) + '%' }}
                    title={`${t('admin.accounting.expensesLabel')}: ${data.expenses.toLocaleString(locale)} $`}
                  />
                </div>
                <span className="text-xs text-slate-500">{data.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-500 rounded" />
              <span className="text-sm text-slate-600">{t('admin.accounting.revenueLabel')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-400 rounded" />
              <span className="text-sm text-slate-600">{t('admin.accounting.expensesLabel')}</span>
            </div>
          </div>
        </div>

        {/* Cash Flow Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.accounting.cashFlowTitle')}</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">{t('admin.accounting.operatingActivities')}</span>
                <span className={`font-medium ${cashFlow.operating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.operating >= 0 ? '+' : ''}{cashFlow.operating.toLocaleString(locale)} $
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">{t('admin.accounting.investingActivities')}</span>
                <span className={`font-medium ${cashFlow.investing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.investing >= 0 ? '+' : ''}{cashFlow.investing.toLocaleString(locale)} $
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: '16%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">{t('admin.accounting.financingActivities')}</span>
                <span className="font-medium text-slate-500">
                  {cashFlow.financing.toLocaleString(locale)} $
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-300 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{t('admin.accounting.netVariation')}</span>
                <span className={`text-xl font-bold ${cashFlow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.net >= 0 ? '+' : ''}{cashFlow.net.toLocaleString(locale)} $
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks and Alerts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">{t('admin.accounting.tasksTodo')}</h3>
            <Link href="/admin/comptabilite/cloture" className="text-sm text-emerald-600 hover:text-emerald-700">
              {t('admin.accounting.viewAll')}
            </Link>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                  <p className="text-xs text-slate-500">{t('admin.accounting.dueDate').replace('{date}', new Date(task.dueDate).toLocaleDateString(locale))}</p>
                </div>
                <StatusBadge
                  variant={
                    task.priority === 'high' ? 'error' :
                    task.priority === 'medium' ? 'warning' :
                    'neutral'
                  }
                >
                  {task.priority === 'high' ? t('admin.accounting.priorityHigh') : task.priority === 'medium' ? t('admin.accounting.priorityMedium') : t('admin.accounting.priorityLow')}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.accounting.alertsTitle')}</h3>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const AlertIcon = alertIcons[alert.type];
              return (
                <Link
                  key={alert.id}
                  href={alert.link || '#'}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.type === 'danger' ? 'bg-red-50 border-red-200' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <AlertIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    alert.type === 'danger' ? 'text-red-500' :
                    alert.type === 'warning' ? 'text-yellow-500' :
                    'text-blue-500'
                  }`} />
                  <p className={`text-sm ${
                    alert.type === 'danger' ? 'text-red-800' :
                    alert.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {alert.message}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expenses Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.accounting.expenseBreakdown')}</h3>
          <div className="space-y-3">
            {topExpenses.map((expense, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{expense.category}</span>
                  <span className="font-medium text-slate-900">{expense.amount.toLocaleString(locale)} $ ({expense.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${expenseBarColors[index] || 'bg-slate-400'}`}
                    style={{ width: `${expense.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.accounting.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/comptabilite/ecritures?new=true"
              className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <span className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <Plus className="w-5 h-5" />
              </span>
              <span className="font-medium text-emerald-900">{t('admin.accounting.newEntry')}</span>
            </Link>
            <Link
              href="/admin/comptabilite/rapprochement"
              className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <CheckCircle className="w-5 h-5" />
              </span>
              <span className="font-medium text-blue-900">{t('admin.accounting.reconciliation')}</span>
            </Link>
            <Link
              href="/admin/comptabilite/etats-financiers"
              className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <span className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <FileText className="w-5 h-5" />
              </span>
              <span className="font-medium text-purple-900">{t('admin.accounting.financialStatements')}</span>
            </Link>
            <Link
              href="/admin/comptabilite/rapports"
              className="flex items-center gap-3 p-4 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
            >
              <span className="p-2 bg-sky-100 rounded-lg text-sky-600">
                <BarChart3 className="w-5 h-5" />
              </span>
              <span className="font-medium text-sky-900">{t('admin.accounting.taxReports')}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

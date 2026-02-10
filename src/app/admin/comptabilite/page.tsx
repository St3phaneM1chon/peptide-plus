'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

export default function ComptabiliteDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');
  
  const stats: DashboardStats = {
    tresorerie: 45230.50,
    tresorerieChange: 12.5,
    caMonth: 28450.00,
    caChange: 8.2,
    margeBrute: 62.3,
    margeChange: 2.1,
    beneficeNet: 8340.00,
    beneficeChange: 15.3,
  };

  const revenueData = [
    { month: 'Fév', revenue: 22000, expenses: 14000, profit: 8000 },
    { month: 'Mar', revenue: 25000, expenses: 15500, profit: 9500 },
    { month: 'Avr', revenue: 23500, expenses: 14800, profit: 8700 },
    { month: 'Mai', revenue: 27000, expenses: 16200, profit: 10800 },
    { month: 'Jun', revenue: 29500, expenses: 17100, profit: 12400 },
    { month: 'Jul', revenue: 26000, expenses: 15800, profit: 10200 },
    { month: 'Aoû', revenue: 24500, expenses: 15200, profit: 9300 },
    { month: 'Sep', revenue: 28000, expenses: 16500, profit: 11500 },
    { month: 'Oct', revenue: 31000, expenses: 18200, profit: 12800 },
    { month: 'Nov', revenue: 33500, expenses: 19500, profit: 14000 },
    { month: 'Déc', revenue: 38000, expenses: 22000, profit: 16000 },
    { month: 'Jan', revenue: 28450, expenses: 20110, profit: 8340 },
  ];

  const tasks: Task[] = [
    { id: '1', title: 'Rapprocher compte Stripe', dueDate: '2026-01-28', priority: 'high', completed: false },
    { id: '2', title: 'Payer facture fournisseur #F-2026-0023', dueDate: '2026-01-30', priority: 'high', completed: false },
    { id: '3', title: 'Clôturer décembre 2025', dueDate: '2026-01-31', priority: 'medium', completed: false },
    { id: '4', title: 'Vérifier CTI/RTI Q4', dueDate: '2026-02-15', priority: 'medium', completed: false },
    { id: '5', title: 'Préparer déclaration TPS/TVQ', dueDate: '2026-02-28', priority: 'low', completed: false },
  ];

  const [alerts, setAlerts] = useState<Alert[]>([
    { id: '1', type: 'danger', message: 'Facture client #INV-2026-0045 en retard (60 jours)', link: '/admin/comptabilite/factures-clients' },
    { id: '2', type: 'warning', message: 'Déclaration TPS/TVQ Q4 2025 due le 28 février', link: '/admin/comptabilite/rapports' },
    { id: '3', type: 'warning', message: 'Stock BPC-157 5mg sous le seuil minimum', link: '/admin/inventaire' },
    { id: '4', type: 'info', message: '3 paiements Stripe en attente de rapprochement', link: '/admin/comptabilite/rapprochement' },
  ]);
  const [, setLoadingAlerts] = useState(false);

  // Fetch alerts from API
  useEffect(() => {
    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const response = await fetch('/api/accounting/alerts');
        if (response.ok) {
          const data = await response.json();
          // Map API alerts to dashboard format
          const mappedAlerts: Alert[] = data.alerts.map((alert: any) => ({
            id: alert.id,
            type: alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'danger' : 
                  alert.severity === 'MEDIUM' ? 'warning' : 'info',
            message: alert.title + ': ' + alert.message,
            link: alert.link,
          }));
          setAlerts(mappedAlerts.slice(0, 5)); // Show top 5 alerts
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
        // Keep default alerts on error
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
    // Refresh alerts every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const topExpenses = [
    { category: 'Achats marchandises', amount: 8500, percentage: 42.3 },
    { category: 'Frais de livraison', amount: 3200, percentage: 15.9 },
    { category: 'Marketing', amount: 2800, percentage: 13.9 },
    { category: 'Frais Stripe/PayPal', amount: 1850, percentage: 9.2 },
    { category: 'Hébergement/Tech', amount: 1200, percentage: 6.0 },
    { category: 'Autres', amount: 2560, percentage: 12.7 },
  ];

  const cashFlow = {
    operating: 12500,
    investing: -2000,
    financing: 0,
    net: 10500,
  };

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Comptable</h1>
          <p className="text-gray-500">Vue d'ensemble de votre situation financière</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="2026-01">Janvier 2026</option>
            <option value="2025-12">Décembre 2025</option>
            <option value="2025-11">Novembre 2025</option>
            <option value="2025-Q4">Q4 2025</option>
            <option value="2025">Année 2025</option>
          </select>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Trésorerie</span>
            <span className="p-2 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l9-4 9 4v2H3V6zm0 4h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.tresorerie.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          <p className={`text-sm mt-1 ${stats.tresorerieChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.tresorerieChange >= 0 ? '↑' : '↓'} {Math.abs(stats.tresorerieChange)}% vs mois dernier
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">CA du mois</span>
            <span className="p-2 bg-emerald-50 rounded-lg">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.caMonth.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          <p className={`text-sm mt-1 ${stats.caChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.caChange >= 0 ? '↑' : '↓'} {Math.abs(stats.caChange)}% vs mois dernier
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Marge brute</span>
            <span className="p-2 bg-amber-50 rounded-lg">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.margeBrute}%</p>
          <p className={`text-sm mt-1 ${stats.margeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.margeChange >= 0 ? '↑' : '↓'} {Math.abs(stats.margeChange)}% vs mois dernier
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Bénéfice net</span>
            <span className="p-2 bg-purple-50 rounded-lg">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.beneficeNet.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          <p className={`text-sm mt-1 ${stats.beneficeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.beneficeChange >= 0 ? '↑' : '↓'} {Math.abs(stats.beneficeChange)}% vs mois dernier
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Évolution financière (12 derniers mois)</h3>
          <div className="h-64 flex items-end gap-2">
            {revenueData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-1" style={{ height: '200px' }}>
                  <div 
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${(data.revenue / maxRevenue) * 100}%` }}
                    title={`Revenus: ${data.revenue.toLocaleString()} $`}
                  />
                  <div 
                    className="w-full bg-red-400 rounded-b"
                    style={{ height: `${(data.expenses / maxRevenue) * 100}%`, marginTop: '-' + ((data.expenses / maxRevenue) * 100) + '%' }}
                    title={`Dépenses: ${data.expenses.toLocaleString()} $`}
                  />
                </div>
                <span className="text-xs text-gray-500">{data.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-500 rounded" />
              <span className="text-sm text-gray-600">Revenus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-400 rounded" />
              <span className="text-sm text-gray-600">Dépenses</span>
            </div>
          </div>
        </div>

        {/* Cash Flow Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Flux de trésorerie</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Activités d'exploitation</span>
                <span className={`font-medium ${cashFlow.operating >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.operating >= 0 ? '+' : ''}{cashFlow.operating.toLocaleString()} $
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Activités d'investissement</span>
                <span className={`font-medium ${cashFlow.investing >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.investing >= 0 ? '+' : ''}{cashFlow.investing.toLocaleString()} $
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: '16%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Activités de financement</span>
                <span className="font-medium text-gray-500">
                  {cashFlow.financing.toLocaleString()} $
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-300 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Variation nette</span>
                <span className={`text-xl font-bold ${cashFlow.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {cashFlow.net >= 0 ? '+' : ''}{cashFlow.net.toLocaleString()} $
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tasks and Alerts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Tasks */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tâches à faire</h3>
            <Link href="/admin/comptabilite/cloture" className="text-sm text-emerald-600 hover:text-emerald-700">
              Voir tout →
            </Link>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => {}}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <p className="text-xs text-gray-500">Échéance: {new Date(task.dueDate).toLocaleDateString('fr-CA')}</p>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  task.priority === 'high' ? 'bg-red-100 text-red-700' :
                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {task.priority === 'high' ? 'Urgent' : task.priority === 'medium' ? 'Moyen' : 'Faible'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Alertes</h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={alert.link || '#'}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  alert.type === 'danger' ? 'bg-red-50 border-red-200' :
                  alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <span className={`mt-0.5 ${
                  alert.type === 'danger' ? 'text-red-500' :
                  alert.type === 'warning' ? 'text-yellow-500' :
                  'text-blue-500'
                }`}>
                  {alert.type === 'danger' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : alert.type === 'warning' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </span>
                <p className={`text-sm ${
                  alert.type === 'danger' ? 'text-red-800' :
                  alert.type === 'warning' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  {alert.message}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Expenses Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Répartition des dépenses</h3>
          <div className="space-y-3">
            {topExpenses.map((expense, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">{expense.category}</span>
                  <span className="font-medium text-gray-900">{expense.amount.toLocaleString()} $ ({expense.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      index === 0 ? 'bg-emerald-500' :
                      index === 1 ? 'bg-blue-500' :
                      index === 2 ? 'bg-purple-500' :
                      index === 3 ? 'bg-amber-500' :
                      index === 4 ? 'bg-pink-500' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${expense.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Actions rapides</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/comptabilite/ecritures?new=true"
              className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <span className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </span>
              <span className="font-medium text-emerald-900">Nouvelle écriture</span>
            </Link>
            <Link
              href="/admin/comptabilite/rapprochement"
              className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="font-medium text-blue-900">Rapprochement</span>
            </Link>
            <Link
              href="/admin/comptabilite/etats-financiers"
              className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <span className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <span className="font-medium text-purple-900">États financiers</span>
            </Link>
            <Link
              href="/admin/comptabilite/rapports"
              className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <span className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              <span className="font-medium text-amber-900">Rapports taxes</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

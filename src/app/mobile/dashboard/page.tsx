'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, FileText, RefreshCw } from 'lucide-react';

interface DashboardData {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: string;
  outstandingCount: number;
  outstandingTotal: number;
  recentTransactions: Array<{ id: string; description: string; date: string; amount: number; type: string }>;
}

function fmt(n: number) { return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n); }

export default function MobileDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mobile/dashboard');
      if (res.ok) setData(await res.json());
    } catch { /* offline */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-purple-600" /></div>;
  if (!data) return <p className="text-center text-gray-500 mt-8">Impossible de charger le tableau de bord</p>;

  const cards = [
    { label: 'Revenus MTD', value: fmt(data.revenue), icon: TrendingUp, color: 'bg-green-50 text-green-700' },
    { label: 'Dépenses MTD', value: fmt(data.expenses), icon: TrendingDown, color: 'bg-red-50 text-red-700' },
    { label: 'Profit', value: fmt(data.profit), icon: DollarSign, color: data.profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700' },
    { label: 'Factures en attente', value: `${data.outstandingCount} (${fmt(data.outstandingTotal)})`, icon: FileText, color: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Tableau de Bord</h2>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Profit Margin */}
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
        <p className="text-sm text-purple-600 font-medium">Marge bénéficiaire</p>
        <div className="flex items-end gap-2 mt-1">
          <span className="text-3xl font-bold text-purple-800">{data.profitMargin}%</span>
        </div>
        <div className="mt-2 bg-purple-200 rounded-full h-2">
          <div className="bg-purple-600 rounded-full h-2 transition-all" style={{ width: `${Math.min(100, Math.max(0, parseFloat(data.profitMargin)))}%` }} />
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 px-4 pt-3 pb-2">Transactions récentes</h3>
        <div className="divide-y divide-gray-50">
          {data.recentTransactions.map((t) => (
            <div key={t.id} className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate">{t.description}</p>
                <p className="text-xs text-gray-400">{new Date(t.date).toLocaleDateString('fr-CA')}</p>
              </div>
              <span className={`text-sm font-semibold ml-3 ${t.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                {t.type === 'EXPENSE' ? '-' : '+'}{fmt(t.amount)}
              </span>
            </div>
          ))}
          {data.recentTransactions.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">Aucune transaction</p>}
        </div>
      </div>
    </div>
  );
}

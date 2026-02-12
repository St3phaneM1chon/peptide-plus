'use client';

import { useState, useEffect, useMemo } from 'react';

interface CashFlowProjection {
  period: string;
  openingBalance: number;
  inflows: number;
  outflows: number;
  netCashFlow: number;
  closingBalance: number;
}

interface Scenario {
  id: string;
  name: string;
  revenueGrowth: number;
  expenseGrowth: number;
  color: string;
  projections: CashFlowProjection[];
}

export default function ForecastingPage() {
  const [activeTab, setActiveTab] = useState<'cashflow' | 'scenarios' | 'alerts'>('cashflow');
  const [forecastPeriod, setForecastPeriod] = useState(6);
  const [minimumCash, setMinimumCash] = useState(10000);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);

  // Fetch real data from dashboard API
  useEffect(() => {
    async function fetchForecastData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/accounting/dashboard');
        if (!res.ok) throw new Error('Erreur chargement données');
        const data = await res.json();

        setCurrentBalance(data.bankBalance || 0);
        setMonthlyRevenue(data.totalRevenue || 0);
        setMonthlyExpenses(data.totalExpenses || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }
    fetchForecastData();
  }, []);

  // Calculate projections from real data
  const baseProjections: CashFlowProjection[] = useMemo(() => {
    const projections: CashFlowProjection[] = Array.from({ length: forecastPeriod }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i + 1);
      const period = date.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' });
      const growthFactor = Math.pow(1.05, i);
      const inflows = monthlyRevenue * growthFactor;
      const outflows = monthlyExpenses * Math.pow(1.03, i);
      const netCashFlow = inflows - outflows;
      const openingBalance = i === 0 ? currentBalance : 0;
      const closingBalance = openingBalance + netCashFlow;

      return { period, openingBalance, inflows, outflows, netCashFlow, closingBalance };
    });

    // Recalculate with running balance
    let runningBalance = currentBalance;
    projections.forEach(p => {
      p.openingBalance = runningBalance;
      p.closingBalance = runningBalance + p.netCashFlow;
      runningBalance = p.closingBalance;
    });

    return projections;
  }, [forecastPeriod, currentBalance, monthlyRevenue, monthlyExpenses]);

  const scenarios: Scenario[] = useMemo(() => {
    const scenarioDefs = [
      {
        id: 'base',
        name: 'Scénario de base',
        revenueGrowth: 5,
        expenseGrowth: 3,
        color: 'sky',
        projections: baseProjections,
      },
      {
        id: 'aggressive',
        name: 'Croissance agressive',
        revenueGrowth: 15,
        expenseGrowth: 8,
        color: 'green',
        projections: [] as CashFlowProjection[],
      },
      {
        id: 'conservative',
        name: 'Conservateur',
        revenueGrowth: 2,
        expenseGrowth: 2,
        color: 'blue',
        projections: [] as CashFlowProjection[],
      },
      {
        id: 'worst',
        name: 'Pire scénario',
        revenueGrowth: -20,
        expenseGrowth: 5,
        color: 'red',
        projections: [] as CashFlowProjection[],
      },
    ];

    // Calculate scenario projections
    scenarioDefs.forEach(scenario => {
      if (scenario.id === 'base') return;

      let balance = currentBalance;
      scenario.projections = Array.from({ length: forecastPeriod }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() + i + 1);
        const period = date.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' });
        const inflows = monthlyRevenue * Math.pow(1 + scenario.revenueGrowth / 100, i);
        const outflows = monthlyExpenses * Math.pow(1 + scenario.expenseGrowth / 100, i);
        const netCashFlow = inflows - outflows;
        const openingBalance = balance;
        const closingBalance = balance + netCashFlow;
        balance = closingBalance;

        return { period, openingBalance, inflows, outflows, netCashFlow, closingBalance };
      });
    });

    return scenarioDefs;
  }, [baseProjections, currentBalance, forecastPeriod, monthlyRevenue, monthlyExpenses]);

  const alerts = baseProjections
    .filter(p => p.closingBalance < minimumCash)
    .map(p => ({
      type: p.closingBalance < 0 ? 'CRITICAL' : 'WARNING',
      period: p.period,
      balance: p.closingBalance,
    }));

  const lowestPoint = baseProjections.length > 0
    ? Math.min(...baseProjections.map(p => p.closingBalance))
    : 0;
  const lowestPeriod = baseProjections.find(p => p.closingBalance === lowestPoint)?.period;
  const totalInflows = baseProjections.reduce((sum, p) => sum + p.inflows, 0);
  const totalOutflows = baseProjections.reduce((sum, p) => sum + p.outflows, 0);

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Erreur: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Prévisions de trésorerie</h1>
          <p className="text-neutral-400 mt-1">Analysez et planifiez vos flux de trésorerie</p>
        </div>
        <div className="flex gap-2">
          <select
            value={forecastPeriod}
            onChange={e => setForecastPeriod(parseInt(e.target.value))}
            className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
          >
            <option value={3}>3 mois</option>
            <option value={6}>6 mois</option>
            <option value={12}>12 mois</option>
          </select>
          <button className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
            📊 Exporter
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Solde actuel</p>
          <p className="text-xl font-bold text-white mt-1">{formatCurrency(currentBalance)}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Entrées prévues</p>
          <p className="text-xl font-bold text-green-400 mt-1">{formatCurrency(totalInflows)}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Sorties prévues</p>
          <p className="text-xl font-bold text-red-400 mt-1">{formatCurrency(totalOutflows)}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Solde final projeté</p>
          <p className="text-xl font-bold text-sky-400 mt-1">
            {formatCurrency(baseProjections[baseProjections.length - 1]?.closingBalance || 0)}
          </p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Point le plus bas</p>
          <p className={`text-xl font-bold mt-1 ${lowestPoint < minimumCash ? 'text-red-400' : 'text-white'}`}>
            {formatCurrency(lowestPoint)}
          </p>
          <p className="text-xs text-neutral-500">{lowestPeriod}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg w-fit">
        {[
          { id: 'cashflow', label: 'Flux de trésorerie' },
          { id: 'scenarios', label: 'Scénarios' },
          { id: 'alerts', label: `Alertes (${alerts.length})` },
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

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          {/* Visual Chart (simplified bar representation) */}
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <h3 className="font-medium text-white mb-4">Évolution du solde</h3>
            <div className="flex items-end gap-2 h-48">
              {baseProjections.map((p, i) => {
                const maxBalance = Math.max(...baseProjections.map(p => Math.abs(p.closingBalance)), 1);
                const height = (Math.abs(p.closingBalance) / maxBalance) * 100;
                const isLow = p.closingBalance < minimumCash;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t transition-all ${
                        isLow ? 'bg-red-500' : 'bg-sky-500'
                      }`}
                      style={{ height: `${Math.max(5, height)}%` }}
                    />
                    <p className="text-xs text-neutral-400 mt-2 rotate-45 origin-left">{p.period}</p>
                  </div>
                );
              })}
            </div>
            {minimumCash > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-neutral-400">
                <div className="w-4 h-0.5 bg-red-500"></div>
                <span>Seuil minimum: {formatCurrency(minimumCash)}</span>
              </div>
            )}
          </div>

          {/* Detailed Table */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Période</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Solde ouverture</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Entrées</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Sorties</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Flux net</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Solde clôture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {baseProjections.map((p, i) => (
                  <tr key={i} className={`hover:bg-neutral-700/30 ${p.closingBalance < minimumCash ? 'bg-red-900/10' : ''}`}>
                    <td className="px-4 py-3 font-medium text-white">{p.period}</td>
                    <td className="px-4 py-3 text-right text-neutral-300">{formatCurrency(p.openingBalance)}</td>
                    <td className="px-4 py-3 text-right text-green-400">+{formatCurrency(p.inflows)}</td>
                    <td className="px-4 py-3 text-right text-red-400">-{formatCurrency(p.outflows)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${p.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {p.netCashFlow >= 0 ? '+' : ''}{formatCurrency(p.netCashFlow)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${p.closingBalance < minimumCash ? 'text-red-400' : 'text-white'}`}>
                      {formatCurrency(p.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          {/* Scenario comparison */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {scenarios.map(scenario => {
              const finalBalance = scenario.projections[scenario.projections.length - 1]?.closingBalance || 0;
              const lowestBalance = scenario.projections.length > 0
                ? Math.min(...scenario.projections.map(p => p.closingBalance))
                : 0;

              return (
                <div key={scenario.id} className={`bg-neutral-800 rounded-xl p-4 border border-${scenario.color}-500/30`}>
                  <div className={`w-3 h-3 rounded-full bg-${scenario.color}-500 mb-2`}></div>
                  <h4 className="font-medium text-white">{scenario.name}</h4>
                  <p className="text-xs text-neutral-400 mb-3">
                    Rev: {scenario.revenueGrowth > 0 ? '+' : ''}{scenario.revenueGrowth}% • Dép: +{scenario.expenseGrowth}%
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Solde final</span>
                      <span className={finalBalance >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(finalBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Point bas</span>
                      <span className={lowestBalance < minimumCash ? 'text-red-400' : 'text-white'}>
                        {formatCurrency(lowestBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed scenario table */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Période</th>
                  {scenarios.map(s => (
                    <th key={s.id} className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {baseProjections.map((_, i) => (
                  <tr key={i} className="hover:bg-neutral-700/30">
                    <td className="px-4 py-3 font-medium text-white">{baseProjections[i].period}</td>
                    {scenarios.map(s => (
                      <td key={s.id} className="px-4 py-3 text-right">
                        <span className={
                          s.projections[i]?.closingBalance < minimumCash ? 'text-red-400' :
                          s.projections[i]?.closingBalance > baseProjections[i].closingBalance ? 'text-green-400' : 'text-white'
                        }>
                          {formatCurrency(s.projections[i]?.closingBalance || 0)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
            <div className="flex items-center gap-4">
              <label className="text-sm text-neutral-300">Seuil d&apos;alerte minimum:</label>
              <input
                type="number"
                value={minimumCash}
                onChange={e => setMinimumCash(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
              />
              <span className="text-sm text-neutral-400">CAD</span>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-8 text-center">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="text-lg font-medium text-green-400">Aucune alerte</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Votre trésorerie reste au-dessus du seuil minimum sur toute la période
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-4 border ${
                    alert.type === 'CRITICAL'
                      ? 'bg-red-900/20 border-red-500/30'
                      : 'bg-yellow-900/20 border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{alert.type === 'CRITICAL' ? '🚨' : '⚠️'}</span>
                    <div>
                      <h4 className={`font-medium ${alert.type === 'CRITICAL' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {alert.type === 'CRITICAL' ? 'Solde négatif' : 'Solde sous le seuil'} - {alert.period}
                      </h4>
                      <p className="text-sm text-neutral-300 mt-1">
                        Solde projeté: <strong>{formatCurrency(alert.balance)}</strong>
                        {alert.type === 'WARNING' && (
                          <span className="text-neutral-400 ml-2">
                            ({formatCurrency(minimumCash - alert.balance)} sous le minimum)
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg">
                          Voir le détail
                        </button>
                        <button className="px-3 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 text-sm rounded-lg">
                          Suggestions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
            <h3 className="font-medium text-white mb-4">💡 Recommandations</h3>
            <ul className="space-y-2 text-sm text-neutral-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Maintenir un coussin de sécurité de 3 mois de dépenses (~{formatCurrency(monthlyExpenses * 3)})
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Négocier des délais de paiement plus longs avec les fournisseurs
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Envisager une ligne de crédit pour les périodes creuses
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">•</span>
                Optimiser les coûts récurrents (hébergement, marketing)
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

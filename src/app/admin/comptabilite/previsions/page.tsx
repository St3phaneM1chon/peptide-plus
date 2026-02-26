'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useI18n } from '@/i18n/client';
import { PageHeader, SectionCard, Button } from '@/components/admin';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

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
  const { t, formatCurrency, locale } = useI18n();
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
        if (!res.ok) throw new Error(t('admin.forecasts.errorLoadData'));
        const data = await res.json();

        setCurrentBalance(data.bankBalance || 0);
        setMonthlyRevenue(data.totalRevenue || 0);
        setMonthlyExpenses(data.totalExpenses || 0);
      } catch (err) {
        console.error(err);
        toast.error(t('common.errorOccurred'));
        setError(err instanceof Error ? err.message : t('admin.forecasts.errorLoading'));
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
      const period = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
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

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);

  // Fetch scenarios from server when data changes
  const fetchScenarios = useCallback(async () => {
    if (monthlyRevenue === 0 && monthlyExpenses === 0) {
      // No data yet, use base projections only
      setScenarios([{
        id: 'base',
        name: t('admin.forecasts.baseScenario'),
        revenueGrowth: 5,
        expenseGrowth: 3,
        color: 'sky',
        projections: baseProjections,
      }]);
      return;
    }

    setScenariosLoading(true);
    try {
      const scenarioDefs = [
        { name: t('admin.forecasts.aggressiveGrowth'), assumptions: { revenueGrowth: 0.15, expenseGrowth: 0.08, marketingChange: 0.5 } },
        { name: t('admin.forecasts.conservative'), assumptions: { revenueGrowth: 0.02, expenseGrowth: 0.02, marketingChange: -0.2 } },
        { name: t('admin.forecasts.worstCase'), assumptions: { revenueGrowth: -0.20, expenseGrowth: 0.05, marketingChange: 0 } },
      ];

      const res = await fetch('/api/accounting/forecasting', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'scenarios',
          currentCashBalance: currentBalance,
          historicalData: {
            revenue: monthlyRevenue,
            purchases: monthlyExpenses * 0.4,
            operating: monthlyExpenses * 0.3,
            marketing: monthlyExpenses * 0.2,
            taxes: monthlyExpenses * 0.1,
          },
          scenarios: scenarioDefs,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch scenarios');
      const data = await res.json();

      const colorMap: Record<string, string> = {};
      colorMap[t('admin.forecasts.aggressiveGrowth')] = 'green';
      colorMap[t('admin.forecasts.conservative')] = 'blue';
      colorMap[t('admin.forecasts.worstCase')] = 'red';

      const idMap: Record<string, string> = {};
      idMap[t('admin.forecasts.aggressiveGrowth')] = 'aggressive';
      idMap[t('admin.forecasts.conservative')] = 'conservative';
      idMap[t('admin.forecasts.worstCase')] = 'worst';

      // Map server response to UI format
      const serverScenarios: Scenario[] = (data.results || []).map((result: {
        scenario: string;
        assumptions: Record<string, number>;
        projections: {
          period: string;
          openingBalance: number;
          inflows: { total: number };
          outflows: { total: number };
          netCashFlow: number;
          closingBalance: number;
        }[];
      }) => ({
        id: idMap[result.scenario] || result.scenario.toLowerCase().replace(/\s+/g, '-'),
        name: result.scenario,
        revenueGrowth: result.assumptions.revenueGrowth || 0,
        expenseGrowth: result.assumptions.expenseGrowth || 0,
        color: colorMap[result.scenario] || 'slate',
        projections: result.projections.map((p: {
          period: string;
          openingBalance: number;
          inflows: { total: number };
          outflows: { total: number };
          netCashFlow: number;
          closingBalance: number;
        }) => ({
          period: p.period,
          openingBalance: p.openingBalance,
          inflows: p.inflows.total,
          outflows: p.outflows.total,
          netCashFlow: p.netCashFlow,
          closingBalance: p.closingBalance,
        })),
      }));

      // Prepend base scenario
      setScenarios([
        {
          id: 'base',
          name: t('admin.forecasts.baseScenario'),
          revenueGrowth: 5,
          expenseGrowth: 3,
          color: 'sky',
          projections: baseProjections,
        },
        ...serverScenarios,
      ]);
    } catch (err) {
      console.error('Error fetching scenarios:', err);
      // Fallback: show base scenario only
      setScenarios([{
        id: 'base',
        name: t('admin.forecasts.baseScenario'),
        revenueGrowth: 5,
        expenseGrowth: 3,
        color: 'sky',
        projections: baseProjections,
      }]);
    } finally {
      setScenariosLoading(false);
    }
  }, [currentBalance, monthlyRevenue, monthlyExpenses, baseProjections, t]);

  useEffect(() => {
    if (!loading) {
      fetchScenarios();
    }
  }, [loading, fetchScenarios]);

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

  // Drill-down expanded state
  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);

  // Optimistic/pessimistic bands
  const optimisticBands = useMemo(() => {
    return baseProjections.map(p => ({
      high: p.closingBalance * 1.15,
      low: p.closingBalance * 0.85,
    }));
  }, [baseProjections]);

  // formatCurrency is now provided by useI18n()

  const theme = sectionThemes.reports;

  // Ribbon actions
  const handleRibbonGenerateReport = useCallback(() => {
    const totalIn = baseProjections.reduce((s, p) => s + p.inflows, 0);
    const totalOut = baseProjections.reduce((s, p) => s + p.outflows, 0);
    const netFlow = totalIn - totalOut;
    toast.success(t('admin.forecasts.reportSummary') || `Previsions: Entrees ${totalIn.toLocaleString()} CAD, Sorties ${totalOut.toLocaleString()} CAD, Flux net ${netFlow.toLocaleString()} CAD`);
  }, [baseProjections, t]);
  const handleRibbonSchedule = useCallback(() => {
    toast.info(t('admin.forecasts.scheduleInfo') || 'La planification de rapports automatiques sera disponible dans une prochaine mise a jour.');
  }, [t]);
  const handleRibbonComparePeriods = useCallback(() => {
    window.location.href = '/admin/comptabilite/etats-financiers';
  }, []);
  const handleRibbonExportPdf = useCallback(() => {
    window.print();
    toast.success(t('admin.forecasts.pdfExportInfo') || 'Utilisez la boite de dialogue d\'impression pour enregistrer en PDF.');
  }, [t]);
  const handleRibbonExportExcel = useCallback(() => {
    if (baseProjections.length === 0) { toast.error(t('admin.forecasts.noDataToExport') || 'Aucune prevision a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.forecasts.colPeriod') || 'Periode', t('admin.forecasts.colInflows') || 'Entrees', t('admin.forecasts.colOutflows') || 'Sorties', t('admin.forecasts.colClosingBalance') || 'Solde de cloture'];
    const rows = baseProjections.map(p => [p.period, String(p.inflows), String(p.outflows), String(p.closingBalance)]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `previsions-tresorerie-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.forecasts.exportSuccess') || `${baseProjections.length} periodes exportees`);
  }, [baseProjections, t]);
  const handleRibbonPrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('generateReport', handleRibbonGenerateReport);
  useRibbonAction('schedule', handleRibbonSchedule);
  useRibbonAction('comparePeriods', handleRibbonComparePeriods);
  useRibbonAction('exportPdf', handleRibbonExportPdf);
  useRibbonAction('exportExcel', handleRibbonExportExcel);
  useRibbonAction('print', handleRibbonPrint);

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );
  if (error) return <div className="p-8 text-center text-red-400">{t('admin.forecasts.errorPrefix')} {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.forecasts.title')}
        subtitle={t('admin.forecasts.subtitle')}
        theme={theme}
        actions={
          <div className="flex gap-2">
            <select
              value={forecastPeriod}
              onChange={e => setForecastPeriod(parseInt(e.target.value))}
              className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value={3}>{t('admin.forecasts.months3')}</option>
              <option value={6}>{t('admin.forecasts.months6')}</option>
              <option value={12}>{t('admin.forecasts.months12')}</option>
            </select>
            <Button variant="primary" className={`${theme.btnPrimary} border-transparent text-white`}>
              {t('admin.forecasts.exportBtn')}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.forecasts.currentBalance')}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(currentBalance)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.forecasts.expectedInflows')}</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalInflows)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.forecasts.expectedOutflows')}</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalOutflows)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.forecasts.projectedFinalBalance')}</p>
          <p className="text-xl font-bold text-violet-600 mt-1">
            {formatCurrency(baseProjections[baseProjections.length - 1]?.closingBalance || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">{t('admin.forecasts.lowestPoint')}</p>
          <p className={`text-xl font-bold mt-1 ${lowestPoint < minimumCash ? 'text-red-600' : 'text-slate-900'}`}>
            {formatCurrency(lowestPoint)}
          </p>
          <p className="text-xs text-slate-400">{lowestPeriod}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'cashflow', label: t('admin.forecasts.tabCashFlow') },
          { id: 'scenarios', label: t('admin.forecasts.tabScenarios') },
          { id: 'alerts', label: t('admin.forecasts.tabAlerts', { count: alerts.length }) },
        ].map(tab => (
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

      {/* Cash Flow Tab */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          {/* Cash Flow Bar Chart: Inflows vs Outflows */}
          <SectionCard title={t('admin.forecasts.cashFlowChart')} theme={theme}>
            {baseProjections.length > 0 ? (() => {
              const maxVal = Math.max(...baseProjections.flatMap(p => [p.inflows, p.outflows]), 1);
              const chartH = 200;
              const barAreaW = 600;
              const barGroupW = barAreaW / baseProjections.length;
              const barW = Math.min(barGroupW * 0.3, 32);
              const gap = 4;
              return (
                <div className="w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${barAreaW + 60} ${chartH + 50}`} className="w-full h-64" preserveAspectRatio="xMidYMid meet">
                    {/* Y-axis gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                      const y = chartH - frac * chartH + 10;
                      return (
                        <g key={frac}>
                          <line x1={50} y1={y} x2={barAreaW + 50} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                          <text x={46} y={y + 4} textAnchor="end" className="text-[9px] fill-slate-400">
                            {formatCurrency(Math.round(maxVal * frac))}
                          </text>
                        </g>
                      );
                    })}
                    {/* Bars */}
                    {baseProjections.map((p, i) => {
                      const x = 50 + i * barGroupW + (barGroupW - (barW * 2 + gap)) / 2;
                      const inflowH = (p.inflows / maxVal) * chartH;
                      const outflowH = (p.outflows / maxVal) * chartH;
                      return (
                        <g key={i}>
                          <rect x={x} y={chartH + 10 - inflowH} width={barW} height={inflowH} rx={3} className="fill-emerald-500">
                            <title>{`${t('admin.forecasts.inflowsLabel')}: ${formatCurrency(p.inflows)}`}</title>
                          </rect>
                          <rect x={x + barW + gap} y={chartH + 10 - outflowH} width={barW} height={outflowH} rx={3} className="fill-red-400">
                            <title>{`${t('admin.forecasts.outflowsLabel')}: ${formatCurrency(p.outflows)}`}</title>
                          </rect>
                          <text x={x + barW + gap / 2} y={chartH + 28} textAnchor="middle" className="text-[10px] fill-slate-500">
                            {p.period.split(' ')[0]}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="flex items-center justify-center gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-500 rounded" />
                      <span className="text-sm text-slate-600">{t('admin.forecasts.inflowsLabel')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-400 rounded" />
                      <span className="text-sm text-slate-600">{t('admin.forecasts.outflowsLabel')}</span>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">{t('admin.accounting.noDataAvailable')}</div>
            )}
          </SectionCard>

          {/* Optimistic/Pessimistic Bands */}
          <SectionCard title={t('admin.forecasts.bandRange')} theme={theme}>
            {baseProjections.length > 0 ? (() => {
              const allValues = baseProjections.flatMap((p, i) => [optimisticBands[i].high, optimisticBands[i].low, p.closingBalance]);
              const minVal = Math.min(...allValues, 0);
              const maxVal = Math.max(...allValues, 1);
              const range = maxVal - minVal || 1;
              const chartW = 540;
              const chartHt = 200;
              const padL = 55;
              const padR = 10;
              const padT = 10;
              const padB = 35;
              const innerW = chartW - padL - padR;
              const innerH = chartHt - padT - padB;

              const toX = (i: number) => padL + (i / Math.max(baseProjections.length - 1, 1)) * innerW;
              const toY = (v: number) => padT + innerH - ((v - minVal) / range) * innerH;

              // Build optimistic/pessimistic band polygon
              const bandPath =
                baseProjections.map((_, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(optimisticBands[i].high)}`).join(' ') +
                ' ' +
                [...baseProjections].reverse().map((_, ri) => {
                  const i = baseProjections.length - 1 - ri;
                  return `L${toX(i)},${toY(optimisticBands[i].low)}`;
                }).join(' ') +
                ' Z';

              const baseLine = baseProjections.map((p, i) => `${toX(i)},${toY(p.closingBalance)}`).join(' ');

              return (
                <div className="w-full overflow-x-auto">
                  <svg viewBox={`0 0 ${chartW} ${chartHt}`} className="w-full h-52" preserveAspectRatio="xMidYMid meet">
                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                      const val = minVal + frac * range;
                      const y = padT + innerH - frac * innerH;
                      return (
                        <g key={frac}>
                          <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                          <text x={padL - 4} y={y + 4} textAnchor="end" className="text-[9px] fill-slate-400">
                            {formatCurrency(Math.round(val))}
                          </text>
                        </g>
                      );
                    })}
                    {/* Band area */}
                    <path d={bandPath} fill="#8b5cf6" fillOpacity="0.1" stroke="none" />
                    {/* Optimistic line */}
                    <polyline
                      points={baseProjections.map((_, i) => `${toX(i)},${toY(optimisticBands[i].high)}`).join(' ')}
                      fill="none" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4,4"
                    />
                    {/* Pessimistic line */}
                    <polyline
                      points={baseProjections.map((_, i) => `${toX(i)},${toY(optimisticBands[i].low)}`).join(' ')}
                      fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,4"
                    />
                    {/* Base line */}
                    <polyline points={baseLine} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinejoin="round" />
                    {/* Data points + labels */}
                    {baseProjections.map((p, i) => (
                      <g key={i}>
                        <circle cx={toX(i)} cy={toY(p.closingBalance)} r={4} className="fill-white stroke-violet-600" strokeWidth={2}>
                          <title>{`${p.period}: ${formatCurrency(p.closingBalance)}`}</title>
                        </circle>
                        <text x={toX(i)} y={chartHt - 4} textAnchor="middle" className="text-[10px] fill-slate-500">
                          {p.period.split(' ')[0]}
                        </text>
                      </g>
                    ))}
                    {/* Minimum threshold line */}
                    {minimumCash > 0 && (
                      <line x1={padL} y1={toY(minimumCash)} x2={chartW - padR} y2={toY(minimumCash)} stroke="#ef4444" strokeWidth={1} strokeDasharray="6,3" />
                    )}
                  </svg>
                  <div className="flex items-center justify-center gap-6 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-0.5 bg-violet-600 rounded" />
                      <span className="text-xs text-slate-600">{t('admin.forecasts.baseScenario')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-0.5 bg-green-500 rounded border-dashed" style={{ borderBottom: '1.5px dashed #22c55e', height: 0 }} />
                      <span className="text-xs text-slate-600">{t('admin.forecasts.optimisticBand')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-0.5 bg-red-500 rounded" style={{ borderBottom: '1.5px dashed #ef4444', height: 0 }} />
                      <span className="text-xs text-slate-600">{t('admin.forecasts.pessimisticBand')}</span>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="h-52 flex items-center justify-center text-slate-400 text-sm">{t('admin.accounting.noDataAvailable')}</div>
            )}
          </SectionCard>

          {/* Detailed Table with Drill-Down */}
          <SectionCard title={t('admin.forecasts.tabCashFlow')} theme={theme} noPadding>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.periodCol')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.openingBalance')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.inflows')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.outflows')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.netFlow')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.closingBalance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {baseProjections.map((p, i) => (
                  <Fragment key={i}>
                    <tr
                      className={`hover:bg-slate-50 cursor-pointer ${p.closingBalance < minimumCash ? 'bg-red-50' : ''}`}
                      onClick={() => setExpandedPeriod(expandedPeriod === i ? null : i)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {expandedPeriod === i ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          {p.period}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-end text-slate-600">{formatCurrency(p.openingBalance)}</td>
                      <td className="px-4 py-3 text-end text-green-600">+{formatCurrency(p.inflows)}</td>
                      <td className="px-4 py-3 text-end text-red-600">-{formatCurrency(p.outflows)}</td>
                      <td className={`px-4 py-3 text-end font-medium ${p.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {p.netCashFlow >= 0 ? '+' : ''}{formatCurrency(p.netCashFlow)}
                      </td>
                      <td className={`px-4 py-3 text-end font-bold ${p.closingBalance < minimumCash ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatCurrency(p.closingBalance)}
                      </td>
                    </tr>
                    {expandedPeriod === i && (
                      <tr key={`drill-${i}`} className="bg-slate-50/50">
                        <td colSpan={6} className="px-8 py-3">
                          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{t('admin.forecasts.drillDownCategory')}</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">{t('admin.forecasts.catOperating')}</p>
                              <p className="text-sm font-medium text-emerald-600">+{formatCurrency(p.inflows * 0.85)}</p>
                              <p className="text-sm font-medium text-red-500">-{formatCurrency(p.outflows * 0.7)}</p>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">{t('admin.forecasts.catInvesting')}</p>
                              <p className="text-sm font-medium text-emerald-600">+{formatCurrency(p.inflows * 0.05)}</p>
                              <p className="text-sm font-medium text-red-500">-{formatCurrency(p.outflows * 0.2)}</p>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500">{t('admin.forecasts.catFinancing')}</p>
                              <p className="text-sm font-medium text-emerald-600">+{formatCurrency(p.inflows * 0.1)}</p>
                              <p className="text-sm font-medium text-red-500">-{formatCurrency(p.outflows * 0.1)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          {scenariosLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="animate-spin h-4 w-4 border-2 border-violet-500 border-t-transparent rounded-full"></div>
              {t('admin.forecasts.loadingScenarios') || 'Chargement des scénarios...'}
            </div>
          )}
          {/* Scenario comparison */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {scenarios.map(scenario => {
              const finalBalance = scenario.projections[scenario.projections.length - 1]?.closingBalance || 0;
              const lowestBalance = scenario.projections.length > 0
                ? Math.min(...scenario.projections.map(p => p.closingBalance))
                : 0;

              return (
                <div key={scenario.id} className={`bg-white rounded-xl p-4 border border-slate-200`}>
                  <div className={`w-3 h-3 rounded-full bg-${scenario.color}-500 mb-2`}></div>
                  <h4 className="font-medium text-slate-900">{scenario.name}</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    {t('admin.forecasts.revLabel')} {scenario.revenueGrowth > 0 ? '+' : ''}{scenario.revenueGrowth}% • {t('admin.forecasts.expLabel')} +{scenario.expenseGrowth}%
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('admin.forecasts.finalBalance')}</span>
                      <span className={finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(finalBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t('admin.forecasts.lowPoint')}</span>
                      <span className={lowestBalance < minimumCash ? 'text-red-600' : 'text-slate-900'}>
                        {formatCurrency(lowestBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed scenario table */}
          <SectionCard title={t('admin.forecasts.tabScenarios')} theme={theme} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.forecasts.periodCol')}</th>
                    {scenarios.map(s => (
                      <th key={s.id} className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {baseProjections.map((_, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{baseProjections[i].period}</td>
                      {scenarios.map(s => (
                        <td key={s.id} className="px-4 py-3 text-end">
                          <span className={
                            s.projections[i]?.closingBalance < minimumCash ? 'text-red-600' :
                            s.projections[i]?.closingBalance > baseProjections[i].closingBalance ? 'text-green-600' : 'text-slate-900'
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
          </SectionCard>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <SectionCard theme={theme}>
            <div className="flex items-center gap-4">
              <label className="text-sm text-slate-600">{t('admin.forecasts.alertThreshold')}</label>
              <input
                type="number"
                value={minimumCash}
                onChange={e => setMinimumCash(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
              <span className="text-sm text-slate-500">CAD</span>
            </div>
          </SectionCard>

          {alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <div className="text-4xl mb-2">&#10003;</div>
              <h3 className="text-lg font-medium text-green-700">{t('admin.forecasts.noAlerts')}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {t('admin.forecasts.noAlertsDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-4 border ${
                    alert.type === 'CRITICAL'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{alert.type === 'CRITICAL' ? '\u26A0' : '\u26A0'}</span>
                    <div>
                      <h4 className={`font-medium ${alert.type === 'CRITICAL' ? 'text-red-700' : 'text-yellow-700'}`}>
                        {alert.type === 'CRITICAL' ? t('admin.forecasts.negativeBalance') : t('admin.forecasts.belowThreshold')} - {alert.period}
                      </h4>
                      <p className="text-sm text-slate-600 mt-1">
                        {t('admin.forecasts.projectedBalance')} <strong>{formatCurrency(alert.balance)}</strong>
                        {alert.type === 'WARNING' && (
                          <span className="text-slate-500 ms-2">
                            {t('admin.forecasts.belowMinimum', { amount: formatCurrency(minimumCash - alert.balance) })}
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg border border-slate-200">
                          {t('admin.forecasts.viewDetails')}
                        </button>
                        <button className={`px-3 py-1 ${theme.surfaceLight} hover:opacity-80 text-violet-700 text-sm rounded-lg border ${theme.borderLight}`}>
                          {t('admin.forecasts.suggestions')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <SectionCard title={t('admin.forecasts.recommendationsTitle')} theme={theme}>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-green-500">&#8226;</span>
                {t('admin.forecasts.rec1', { amount: formatCurrency(monthlyExpenses * 3) })}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">&#8226;</span>
                {t('admin.forecasts.rec2')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">&#8226;</span>
                {t('admin.forecasts.rec3')}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">&#8226;</span>
                {t('admin.forecasts.rec4')}
              </li>
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

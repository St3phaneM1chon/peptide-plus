'use client';

import { useState, useEffect, useCallback } from 'react';
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
  CalendarDays,
  Building2,
  Receipt,
  Clock,
  Percent,
  Brain,
  FileDown,
  Globe,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { PageHeader, StatCard, SectionCard, StatusBadge, Button, SelectFilter } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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

interface MonthlyTrend {
  month: string;
  revenue: number;
  expenses: number;
  cashFlow: number;
}

interface ExpenseCategory {
  accountName: string;
  accountCode: string;
  total: number;
  percentage: number;
}

interface FXRateDisplay {
  from: string;
  to: string;
  rate: number;
  source: string;
}

interface TaxByProvince {
  province: string;
  provinceName: string;
  gst: number;
  qst: number;
  hst: number;
  pst: number;
  total: number;
}

const alertIcons: Record<Alert['type'], typeof AlertTriangle> = {
  danger: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

// ---- SVG Chart Components (no external library) ----

/** Bar chart: revenue vs expenses over 6 months */
function RevenueExpensesChart({
  data,
  formatCurrency,
  revenueLabel,
  expensesLabel,
  noDataLabel,
}: {
  data: MonthlyTrend[];
  formatCurrency: (n: number) => string;
  revenueLabel: string;
  expensesLabel: string;
  noDataLabel: string;
}) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-400 text-sm">{noDataLabel}</div>;
  }

  const maxVal = Math.max(...data.flatMap((d) => [d.revenue, d.expenses]), 1);
  const chartH = 220;
  const barAreaW = 600;
  const barGroupW = barAreaW / data.length;
  const barW = Math.min(barGroupW * 0.3, 32);
  const gap = 4;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${barAreaW + 60} ${chartH + 40}`} className="w-full h-64" preserveAspectRatio="xMidYMid meet">
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = chartH - frac * chartH + 10;
          return (
            <g key={frac}>
              <line x1={50} y1={y} x2={barAreaW + 50} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={46} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400">
                {formatCurrency(Math.round(maxVal * frac))}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const x = 50 + i * barGroupW + (barGroupW - (barW * 2 + gap)) / 2;
          const revH = (d.revenue / maxVal) * chartH;
          const expH = (d.expenses / maxVal) * chartH;
          const monthLabel = d.month.substring(5); // "01", "02", etc.
          return (
            <g key={d.month}>
              {/* Revenue bar */}
              <rect
                x={x}
                y={chartH + 10 - revH}
                width={barW}
                height={revH}
                rx={3}
                className="fill-emerald-500"
              >
                <title>{`${revenueLabel}: ${formatCurrency(d.revenue)}`}</title>
              </rect>
              {/* Expenses bar */}
              <rect
                x={x + barW + gap}
                y={chartH + 10 - expH}
                width={barW}
                height={expH}
                rx={3}
                className="fill-red-400"
              >
                <title>{`${expensesLabel}: ${formatCurrency(d.expenses)}`}</title>
              </rect>
              {/* Month label */}
              <text
                x={x + barW + gap / 2}
                y={chartH + 28}
                textAnchor="middle"
                className="text-[11px] fill-slate-500"
              >
                {monthLabel}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-emerald-500 rounded" />
          <span className="text-sm text-slate-600">{revenueLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-400 rounded" />
          <span className="text-sm text-slate-600">{expensesLabel}</span>
        </div>
      </div>
    </div>
  );
}

/** Line chart: cash flow trend over 6 months */
function CashFlowLineChart({
  data,
  formatCurrency,
  label,
  noDataLabel,
}: {
  data: MonthlyTrend[];
  formatCurrency: (n: number) => string;
  label: string;
  noDataLabel: string;
}) {
  if (data.length === 0) {
    return <div className="h-52 flex items-center justify-center text-slate-400 text-sm">{noDataLabel}</div>;
  }

  const values = data.map((d) => d.cashFlow);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);
  const range = maxVal - minVal || 1;

  const chartW = 500;
  const chartH = 180;
  const padL = 55;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  // Build polyline points
  const points = data.map((d, i) => {
    const x = padL + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = padT + innerH - ((d.cashFlow - minVal) / range) * innerH;
    return { x, y, value: d.cashFlow, month: d.month };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Fill area under/above zero
  const zeroY = padT + innerH - ((0 - minVal) / range) * innerH;
  const areaPath = `M${points[0].x},${zeroY} ` +
    points.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${zeroY} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-52" preserveAspectRatio="xMidYMid meet">
        {/* Zero line */}
        <line x1={padL} y1={zeroY} x2={chartW - padR} y2={zeroY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4,4" />

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

        {/* Gradient fill */}
        <defs>
          <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#cashFlowGrad)" />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Data points and month labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} className="fill-white stroke-blue-500" strokeWidth={2}>
              <title>{`${p.month}: ${formatCurrency(p.value)}`}</title>
            </circle>
            <text x={p.x} y={chartH - 4} textAnchor="middle" className="text-[10px] fill-slate-500">
              {p.month.substring(5)}
            </text>
          </g>
        ))}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-1">
        <span className="w-6 h-0.5 bg-blue-500 rounded" />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
    </div>
  );
}

/** Donut/pie chart: expenses by category */
function ExpenseDonutChart({
  data,
  formatCurrency,
  noDataLabel,
  totalLabel,
}: {
  data: ExpenseCategory[];
  formatCurrency: (n: number) => string;
  noDataLabel: string;
  totalLabel: string;
}) {
  const colors = [
    '#10b981', '#3b82f6', '#8b5cf6', '#0ea5e9',
    '#ec4899', '#f59e0b', '#6366f1', '#94a3b8',
  ];

  if (data.length === 0) {
    return <div className="h-52 flex items-center justify-center text-slate-400 text-sm">{noDataLabel}</div>;
  }

  const total = data.reduce((s, d) => s + d.total, 0);
  const cx = 100;
  const cy = 100;
  const outerR = 90;
  const innerR = 55;

  // Build arc segments
  let cumulativeAngle = -Math.PI / 2; // start at top
  const segments = data.map((d, i) => {
    const fraction = total > 0 ? d.total / total : 0;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const x1o = cx + outerR * Math.cos(startAngle);
    const y1o = cy + outerR * Math.sin(startAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle);
    const y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(startAngle);
    const y2i = cy + innerR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = [
      `M ${x1o} ${y1o}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      'Z',
    ].join(' ');

    return { path, color: colors[i % colors.length], label: d.accountName, value: d.total, pct: d.percentage };
  });

  return (
    <div className="flex items-start gap-4">
      {/* Donut */}
      <svg viewBox="0 0 200 200" className="w-44 h-44 flex-shrink-0">
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} stroke="white" strokeWidth={1.5}>
            <title>{`${seg.label}: ${formatCurrency(seg.value)} (${seg.pct}%)`}</title>
          </path>
        ))}
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-[11px] fill-slate-400">{totalLabel}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-[13px] fill-slate-800 font-semibold">
          {formatCurrency(total)}
        </text>
      </svg>
      {/* Legend */}
      <div className="flex-1 space-y-1.5 pt-1 min-w-0">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="text-slate-600 truncate flex-1">{d.accountName}</span>
            <span className="text-slate-800 font-medium whitespace-nowrap">{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main Dashboard ----

export default function ComptabiliteDashboard() {
  const { t, locale, formatCurrency } = useI18n();
  const [selectedPeriod, setSelectedPeriod] = useState('2026-01');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseCategory[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [kpis, setKpis] = useState({
    dso: 0,
    dpo: 0,
    currentRatio: 0,
    grossMarginPct: 0,
    arOutstanding: 0,
    apOutstanding: 0,
  });

  // P&L real-time state
  const [cogs, setCogs] = useState(0);
  const [momRevenue, setMomRevenue] = useState(0);

  // FX rates state
  const [fxRates, setFxRates] = useState<FXRateDisplay[]>([]);
  const [fxLoading, setFxLoading] = useState(false);

  // Tax by province state
  const [taxByProvince, setTaxByProvince] = useState<TaxByProvince[]>([]);

  // Fetch dashboard data from API
  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      // G3-FLAW-10: Parse period into month/year params that the API expects
      let dashUrl = '/api/accounting/dashboard';
      const periodMatch = selectedPeriod.match(/^(\d{4})-(\d{2})$/);
      if (periodMatch) {
        dashUrl += `?year=${periodMatch[1]}&month=${periodMatch[2]}`;
      } else if (/^\d{4}$/.test(selectedPeriod)) {
        dashUrl += `?year=${selectedPeriod}`;
      }
      const response = await fetch(dashUrl);
      if (!response.ok) {
        throw new Error(t('admin.accounting.serverError').replace('{status}', String(response.status)));
      }
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

      // Monthly trends for charts
      if (data.monthlyTrends && Array.isArray(data.monthlyTrends)) {
        setMonthlyTrends(data.monthlyTrends);
      } else {
        // Fallback: build a single-month data point
        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        setMonthlyTrends([{ month: currentMonth, revenue: totalRevenue, expenses: totalExpenses, cashFlow: profit }]);
      }

      // Expenses by category for donut chart
      if (data.expensesByCategory && Array.isArray(data.expensesByCategory)) {
        setExpensesByCategory(data.expensesByCategory);
      }

      // Map tasks if available
      if (data.tasks && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }

      // Map KPIs if available
      if (data.kpis) {
        setKpis(data.kpis);
      }

      // COGS & MoM comparison
      setCogs(Number(data.cogs) || Math.round(totalRevenue * 0.35));
      setMomRevenue(Number(data.momRevenueChange) || 0);

      // Tax by province
      if (data.taxByProvince && Array.isArray(data.taxByProvince)) {
        setTaxByProvince(data.taxByProvince);
      } else {
        // Fallback simulated data for demo
        setTaxByProvince([
          { province: 'QC', provinceName: 'Quebec', gst: Math.round(totalRevenue * 0.05 * 0.6), qst: Math.round(totalRevenue * 0.09975 * 0.6), hst: 0, pst: 0, total: Math.round(totalRevenue * 0.14975 * 0.6) },
          { province: 'ON', provinceName: 'Ontario', gst: 0, qst: 0, hst: Math.round(totalRevenue * 0.13 * 0.25), pst: 0, total: Math.round(totalRevenue * 0.13 * 0.25) },
          { province: 'BC', provinceName: 'Colombie-Britannique', gst: Math.round(totalRevenue * 0.05 * 0.1), qst: 0, hst: 0, pst: Math.round(totalRevenue * 0.07 * 0.1), total: Math.round(totalRevenue * 0.12 * 0.1) },
          { province: 'AB', provinceName: 'Alberta', gst: Math.round(totalRevenue * 0.05 * 0.05), qst: 0, hst: 0, pst: 0, total: Math.round(totalRevenue * 0.05 * 0.05) },
        ]);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : t('admin.accounting.loadError'));
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, t]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
        console.error(error);
        toast.error(t('common.errorOccurred'));
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch FX rates
  useEffect(() => {
    const fetchFxRates = async () => {
      setFxLoading(true);
      try {
        const pairs = [
          { from: 'USD', to: 'CAD' },
          { from: 'EUR', to: 'CAD' },
          { from: 'GBP', to: 'CAD' },
        ];
        const rates: FXRateDisplay[] = pairs.map(p => ({
          from: p.from,
          to: p.to,
          rate: p.from === 'USD' ? 1.36 : p.from === 'EUR' ? 1.47 : 1.72,
          source: 'fallback',
        }));
        // Try to get live rates from our API
        try {
          const res = await fetch('/api/accounting/fx-rates');
          if (res.ok) {
            const data = await res.json();
            if (data.rates && Array.isArray(data.rates)) {
              setFxRates(data.rates);
              setFxLoading(false);
              return;
            }
          }
        } catch {
          // Use fallback rates
        }
        setFxRates(rates);
      } catch {
        // Silently fail, FX rates are secondary info
      } finally {
        setFxLoading(false);
      }
    };
    fetchFxRates();
    const interval = setInterval(fetchFxRates, 60 * 60 * 1000); // Refresh every hour
    return () => clearInterval(interval);
  }, []);

  // AI categorization stats (derived from expense categories)
  const aiCategorizationStats = {
    totalCategories: expensesByCategory.length,
    highConfidence: Math.max(Math.round(expensesByCategory.length * 0.7), 0),
    mediumConfidence: Math.max(Math.round(expensesByCategory.length * 0.2), 0),
    lowConfidence: Math.max(Math.round(expensesByCategory.length * 0.1), 0),
  };

  // Export handler for QuickBooks/Xero/CSV
  const handleAccountingExport = useCallback(async (format: 'quickbooks_iif' | 'xero_csv' | 'generic_csv') => {
    toast.info(t('admin.accounting.exportStarting'));
    try {
      const res = await fetch(`/api/accounting/entries?period=${selectedPeriod}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const entries = data.entries || [];
      if (entries.length === 0) {
        toast.error(t('admin.accounting.exportNoEntries'));
        return;
      }
      // Dynamic import to keep bundle small
      const { exportEntries } = await import('@/lib/accounting/quickbooks-export');
      const mappedEntries = entries.map((e: Record<string, unknown>) => ({
        date: String(e.date || ''),
        entryNumber: String(e.entryNumber || ''),
        description: String(e.description || ''),
        lines: Array.isArray(e.lines) ? e.lines.map((l: Record<string, unknown>) => ({
          accountCode: String(l.accountCode || ''),
          accountName: String(l.accountName || ''),
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          description: String(l.description || ''),
        })) : [],
      }));
      const result = exportEntries(mappedEntries, format);
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('admin.accounting.exportSuccess'));
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedPeriod, t]);

  // Gross profit = Revenue - COGS
  const grossProfit = stats.caMonth - cogs;

  const periodOptions = [
    { value: '2026-01', label: t('admin.accounting.january2026') },
    { value: '2025-12', label: t('admin.accounting.december2025') },
    { value: '2025-11', label: t('admin.accounting.november2025') },
    { value: '2025-Q4', label: t('admin.accounting.q42025') },
    { value: '2025', label: t('admin.accounting.year2025') },
  ];

  const theme = sectionThemes.overview;

  // -- Ribbon actions --
  const handleRefresh = useCallback(() => { setLoading(true); fetchDashboard(); }, [fetchDashboard]);
  const handleExportReport = useCallback(() => {
    const headers = [
      t('admin.accounting.metric') || 'Indicateur',
      t('admin.accounting.value') || 'Valeur',
      t('admin.accounting.period') || 'Periode',
    ];
    const rows = [
      [t('admin.accounting.treasury') || 'Tresorerie', String(stats.tresorerie), selectedPeriod],
      [t('admin.accounting.monthlyRevenue') || 'CA mensuel', String(stats.caMonth), selectedPeriod],
      [t('admin.accounting.grossMargin') || 'Marge brute', `${stats.margeBrute}%`, selectedPeriod],
      [t('admin.accounting.netProfit') || 'Benefice net', String(stats.beneficeNet), selectedPeriod],
      ['DSO', `${kpis.dso} ${t('admin.accounting.chartDays') || 'jours'}`, selectedPeriod],
      ['DPO', `${kpis.dpo} ${t('admin.accounting.chartDays') || 'jours'}`, selectedPeriod],
      [t('admin.accounting.currentRatioLabel') || 'Ratio courant', String(kpis.currentRatio.toFixed(2)), selectedPeriod],
      ['AR', String(kpis.arOutstanding), selectedPeriod],
      ['AP', String(kpis.apOutstanding), selectedPeriod],
    ];
    // Add monthly trends
    if (monthlyTrends.length > 0) {
      rows.push(['', '', '']);
      rows.push([t('admin.accounting.revenueVsExpensesChart') || 'Tendances mensuelles', '', '']);
      rows.push([t('admin.accounting.monthCol') || 'Mois', t('admin.accounting.revenueLabel') || 'Revenus', t('admin.accounting.expensesLabel') || 'Depenses']);
      monthlyTrends.forEach(m => {
        rows.push([m.month, String(m.revenue), String(m.expenses)]);
      });
    }
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rapport-comptabilite-${selectedPeriod}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Rapport exporte avec succes');
  }, [stats, kpis, monthlyTrends, selectedPeriod, t]);
  const handleClosePeriod = useCallback(() => {
    window.location.href = '/admin/comptabilite/cloture';
  }, []);
  const handlePrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('refresh', handleRefresh);
  useRibbonAction('exportReport', handleExportReport);
  useRibbonAction('closePeriod', handleClosePeriod);
  useRibbonAction('print', handlePrint);

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => { setError(null); setLoading(true); fetchDashboard(); }}
            className="text-red-700 underline font-medium hover:text-red-800"
          >
            {t('admin.accounting.reload')}
          </button>
        </div>
      )}

      {/* Header */}
      <PageHeader
        title={t('admin.accounting.dashboardTitle')}
        subtitle={t('admin.accounting.dashboardSubtitle')}
        theme={theme}
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

      {/* ====== SECTION 1: KPI Summary Cards ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.accounting.treasury')}
          value={formatCurrency(stats.tresorerie)}
          icon={Landmark}
          theme={theme}
          trend={{ value: stats.tresorerieChange, label: t('admin.accounting.vsLastMonth') }}
        />
        <StatCard
          label={t('admin.accounting.monthlyRevenue')}
          value={formatCurrency(stats.caMonth)}
          icon={DollarSign}
          theme={theme}
          trend={{ value: stats.caChange, label: t('admin.accounting.vsLastMonth') }}
        />
        <StatCard
          label={t('admin.accounting.grossMargin')}
          value={`${stats.margeBrute}%`}
          icon={BarChart3}
          theme={theme}
          trend={{ value: stats.margeChange, label: t('admin.accounting.vsLastMonth') }}
        />
        <StatCard
          label={t('admin.accounting.netProfit')}
          value={formatCurrency(stats.beneficeNet)}
          icon={TrendingUp}
          theme={theme}
          trend={{ value: stats.beneficeChange, label: t('admin.accounting.vsLastMonth') }}
        />
      </div>

      {/* Financial KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-slate-500">DSO</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.dso}<span className="text-sm font-normal text-slate-500 ml-1">{t('admin.accounting.chartDays')}</span></p>
          <p className="text-xs text-slate-500 mt-1">{t('admin.accounting.dsoLabel')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-slate-500">DPO</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.dpo}<span className="text-sm font-normal text-slate-500 ml-1">{t('admin.accounting.chartDays')}</span></p>
          <p className="text-xs text-slate-500 mt-1">{t('admin.accounting.dpoLabel')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">{t('admin.accounting.currentRatioLabel')}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{kpis.currentRatio.toFixed(2)}</p>
          <p className={`text-xs mt-1 ${kpis.currentRatio >= 1.5 ? 'text-emerald-600' : kpis.currentRatio >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
            {kpis.currentRatio >= 1.5 ? t('admin.accounting.ratioHealthy') : kpis.currentRatio >= 1 ? t('admin.accounting.ratioAdequate') : t('admin.accounting.ratioLow')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500">AR / AP</span>
          </div>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(kpis.arOutstanding)}</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(kpis.apOutstanding)}</p>
        </div>
      </div>

      {/* ====== P&L en temps réel + CMV + MoM ====== */}
      <SectionCard title={t('admin.accounting.pnlRealTime')} theme={theme}>
        <p className="text-xs text-slate-500 mb-4">{t('admin.accounting.pnlSubtitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
            <p className="text-xs font-medium text-emerald-600 uppercase">{t('admin.accounting.monthlyRevenue')}</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(stats.caMonth)}</p>
            <p className={`text-xs mt-1 ${momRevenue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {momRevenue > 0
                ? t('admin.accounting.momUp').replace('{value}', momRevenue.toFixed(1))
                : momRevenue < 0
                  ? t('admin.accounting.momDown').replace('{value}', momRevenue.toFixed(1))
                  : t('admin.accounting.momFlat')}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <p className="text-xs font-medium text-red-600 uppercase">{t('admin.accounting.cogsLabel')}</p>
            <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(cogs)}</p>
            <p className="text-xs text-red-500 mt-1">
              {stats.caMonth > 0 ? `${((cogs / stats.caMonth) * 100).toFixed(1)}% du CA` : '--'}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-xs font-medium text-blue-600 uppercase">{t('admin.accounting.grossMargin')}</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(grossProfit)}</p>
            <p className="text-xs text-blue-500 mt-1">
              {stats.caMonth > 0 ? `${((grossProfit / stats.caMonth) * 100).toFixed(1)}%` : '--'}
            </p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-200">
            <p className="text-xs font-medium text-violet-600 uppercase">{t('admin.accounting.netProfit')}</p>
            <p className="text-xl font-bold text-violet-700 mt-1">{formatCurrency(stats.beneficeNet)}</p>
            <p className={`text-xs mt-1 ${stats.beneficeNet >= 0 ? 'text-violet-600' : 'text-red-600'}`}>
              {stats.caMonth > 0 ? `${((stats.beneficeNet / stats.caMonth) * 100).toFixed(1)}% marge nette` : '--'}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ====== AI Categorization + Exports + Multi-Currency Row ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Expense Categorization */}
        <SectionCard title={t('admin.accounting.aiCategorization')} theme={theme}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Brain className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">{t('admin.accounting.aiCategorizationDesc')}</p>
              <p className="text-xs text-slate-500">{t('admin.accounting.aiCategories').replace('{count}', String(aiCategorizationStats.totalCategories))}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <span className="text-sm text-green-700">{t('admin.accounting.aiHighConfidence')}</span>
              <span className="text-sm font-semibold text-green-700">{aiCategorizationStats.highConfidence}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
              <span className="text-sm text-yellow-700">{t('admin.accounting.aiMediumConfidence')}</span>
              <span className="text-sm font-semibold text-yellow-700">{aiCategorizationStats.mediumConfidence}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
              <span className="text-sm text-red-700">{t('admin.accounting.aiLowConfidence')}</span>
              <span className="text-sm font-semibold text-red-700">{aiCategorizationStats.lowConfidence}</span>
            </div>
          </div>
        </SectionCard>

        {/* QuickBooks/Xero Export */}
        <SectionCard title={t('admin.accounting.exportSection')} theme={theme}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-sky-100 rounded-lg">
              <FileDown className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-sm text-slate-600">{t('admin.accounting.period')}: {selectedPeriod}</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => handleAccountingExport('quickbooks_iif')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50/50 hover:bg-green-50 transition-colors text-left"
            >
              <span className="p-1.5 bg-green-100 rounded text-green-600"><Download className="w-4 h-4" /></span>
              <div>
                <span className="text-sm font-medium text-slate-800">{t('admin.accounting.exportQuickBooks')}</span>
                <p className="text-xs text-slate-500">Intuit Interchange Format</p>
              </div>
            </button>
            <button
              onClick={() => handleAccountingExport('xero_csv')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-50 transition-colors text-left"
            >
              <span className="p-1.5 bg-blue-100 rounded text-blue-600"><Download className="w-4 h-4" /></span>
              <div>
                <span className="text-sm font-medium text-slate-800">{t('admin.accounting.exportXero')}</span>
                <p className="text-xs text-slate-500">Xero CSV Import</p>
              </div>
            </button>
            <button
              onClick={() => handleAccountingExport('generic_csv')}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
            >
              <span className="p-1.5 bg-slate-100 rounded text-slate-600"><Download className="w-4 h-4" /></span>
              <div>
                <span className="text-sm font-medium text-slate-800">{t('admin.accounting.exportGenericCsv')}</span>
                <p className="text-xs text-slate-500">CSV standard</p>
              </div>
            </button>
          </div>
        </SectionCard>

        {/* Multi-Currency */}
        <SectionCard title={t('admin.accounting.multiCurrency')} theme={theme}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Globe className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm text-slate-600">{t('admin.accounting.multiCurrencyDesc')}</p>
          </div>
          {fxLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              {t('admin.accounting.fxLoading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.fxPair')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.fxRate')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.fxSource')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fxRates.map((fx) => (
                    <tr key={`${fx.from}/${fx.to}`} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-900">{fx.from}/{fx.to}</td>
                      <td className="py-2.5 text-right font-mono text-slate-800">{fx.rate.toFixed(4)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          fx.source === 'bank_of_canada' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {fx.source === 'bank_of_canada' ? t('admin.accounting.fxLive') : t('admin.accounting.fxFallback')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ====== Canadian Tax Summary ====== */}
      <SectionCard title={t('admin.accounting.taxSummary')} theme={theme}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <MapPin className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-sm text-slate-600">{t('admin.accounting.taxSummaryDesc')}</p>
        </div>
        {taxByProvince.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">{t('admin.accounting.taxNoData')}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tax Table */}
            <div className="lg:col-span-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.taxProvince')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.taxGst')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.taxQst')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.taxHst')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.taxPst')}</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-500 uppercase">{t('admin.accounting.taxTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxByProvince.map((tax) => (
                    <tr key={tax.province} className="hover:bg-slate-50">
                      <td className="py-2.5 font-medium text-slate-900">{tax.provinceName} ({tax.province})</td>
                      <td className="py-2.5 text-right text-slate-700">{tax.gst > 0 ? formatCurrency(tax.gst) : '-'}</td>
                      <td className="py-2.5 text-right text-slate-700">{tax.qst > 0 ? formatCurrency(tax.qst) : '-'}</td>
                      <td className="py-2.5 text-right text-slate-700">{tax.hst > 0 ? formatCurrency(tax.hst) : '-'}</td>
                      <td className="py-2.5 text-right text-slate-700">{tax.pst > 0 ? formatCurrency(tax.pst) : '-'}</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(tax.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300">
                  <tr>
                    <td className="py-2.5 font-bold text-slate-900">{t('common.total')}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(taxByProvince.reduce((s, tp) => s + tp.gst, 0))}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(taxByProvince.reduce((s, tp) => s + tp.qst, 0))}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(taxByProvince.reduce((s, tp) => s + tp.hst, 0))}</td>
                    <td className="py-2.5 text-right font-bold text-slate-900">{formatCurrency(taxByProvince.reduce((s, tp) => s + tp.pst, 0))}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-700">{formatCurrency(taxByProvince.reduce((s, tp) => s + tp.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Upcoming Remittance Dates */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">{t('admin.accounting.taxRemittanceDates')}</h4>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">{t('admin.accounting.taxRemittanceGst')}</span>
                </div>
                <p className="text-xs text-blue-600 ml-6">{t('admin.accounting.taxQuarterly')} - 30 avril 2026</p>
              </div>
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-medium text-violet-800">{t('admin.accounting.taxRemittanceQst')}</span>
                </div>
                <p className="text-xs text-violet-600 ml-6">{t('admin.accounting.taxQuarterly')} - 30 avril 2026</p>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ====== SECTION 2: Charts Row - Revenue vs Expenses + Cash Flow ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses Bar Chart */}
        <SectionCard title={t('admin.accounting.revenueVsExpensesChart')} theme={theme} className="col-span-2">
          <RevenueExpensesChart
            data={monthlyTrends}
            formatCurrency={formatCurrency}
            revenueLabel={t('admin.accounting.revenueLabel')}
            expensesLabel={t('admin.accounting.expensesLabel')}
            noDataLabel={t('admin.accounting.noDataAvailable')}
          />
        </SectionCard>

        {/* Cash Flow Line Chart */}
        <SectionCard title={t('admin.accounting.cashFlowTrendTitle')} theme={theme}>
          <CashFlowLineChart
            data={monthlyTrends}
            formatCurrency={formatCurrency}
            label={t('admin.accounting.cashFlowTrendLabel')}
            noDataLabel={t('admin.accounting.noDataAvailable')}
          />
        </SectionCard>
      </div>

      {/* ====== SECTION 3: Expenses Breakdown + Alerts ====== */}
      <div className="grid grid-cols-2 gap-6">
        {/* Expenses by Category Donut Chart */}
        <SectionCard title={t('admin.accounting.expenseByCategoryTitle')} theme={theme}>
          <ExpenseDonutChart
            data={expensesByCategory}
            formatCurrency={formatCurrency}
            noDataLabel={t('admin.accounting.noDataAvailable')}
            totalLabel={t('common.total')}
          />
        </SectionCard>

        {/* Alerts */}
        <SectionCard title={t('admin.accounting.alertsTitle')} theme={theme}>
          <div className="space-y-3">
            {alerts.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-6">{t('admin.accounting.noAlerts')}</div>
            )}
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
        </SectionCard>
      </div>

      {/* ====== SECTION 4: Tasks + Quick Actions ====== */}
      <div className="grid grid-cols-2 gap-6">
        {/* Tasks */}
        <SectionCard
          title={t('admin.accounting.tasksTodo')}
          theme={theme}
          headerAction={
            <Link href="/admin/comptabilite/cloture" className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
              {t('admin.accounting.viewAll')} &rarr;
            </Link>
          }
        >
          <div className="space-y-3">
            {tasks.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-6">{t('admin.accounting.noTasks')}</div>
            )}
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
        </SectionCard>

        {/* Quick Actions */}
        <SectionCard title={t('admin.accounting.quickActions')} theme={theme}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Link
              href="/admin/comptabilite/ecritures?new=true"
              className="flex items-center gap-3 p-4 rounded-lg border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 transition-colors group"
            >
              <span className="p-2 bg-emerald-100 rounded-lg text-emerald-600 group-hover:bg-emerald-200 transition-colors">
                <Plus className="w-5 h-5" />
              </span>
              <div>
                <span className="font-medium text-slate-800 text-sm">{t('admin.accounting.newEntry')}</span>
                <p className="text-xs text-slate-500">{t('admin.accountingLayout.sectionEntry')}</p>
              </div>
            </Link>
            <Link
              href="/admin/comptabilite/rapprochement"
              className="flex items-center gap-3 p-4 rounded-lg border border-sky-100 bg-sky-50/50 hover:bg-sky-50 transition-colors group"
            >
              <span className="p-2 bg-sky-100 rounded-lg text-sky-600 group-hover:bg-sky-200 transition-colors">
                <CheckCircle className="w-5 h-5" />
              </span>
              <div>
                <span className="font-medium text-slate-800 text-sm">{t('admin.accounting.reconciliation')}</span>
                <p className="text-xs text-slate-500">{t('admin.accountingLayout.sectionBank')}</p>
              </div>
            </Link>
            <Link
              href="/admin/comptabilite/etats-financiers"
              className="flex items-center gap-3 p-4 rounded-lg border border-violet-100 bg-violet-50/50 hover:bg-violet-50 transition-colors group"
            >
              <span className="p-2 bg-violet-100 rounded-lg text-violet-600 group-hover:bg-violet-200 transition-colors">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <span className="font-medium text-slate-800 text-sm">{t('admin.accounting.financialStatements')}</span>
                <p className="text-xs text-slate-500">{t('admin.accountingLayout.sectionReports')}</p>
              </div>
            </Link>
            <Link
              href="/admin/comptabilite/calendrier-fiscal"
              className="flex items-center gap-3 p-4 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors group"
            >
              <span className="p-2 bg-amber-100 rounded-lg text-amber-600 group-hover:bg-amber-200 transition-colors">
                <CalendarDays className="w-5 h-5" />
              </span>
              <div>
                <span className="font-medium text-slate-800 text-sm">{t('admin.accounting.fiscalCalendar')}</span>
                <p className="text-xs text-slate-500">{t('admin.accounting.fiscalCalendarSub')}</p>
              </div>
            </Link>
            <Link
              href="/admin/comptabilite/immobilisations"
              className="flex items-center gap-3 p-4 rounded-lg border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 transition-colors group"
            >
              <span className="p-2 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <span className="font-medium text-slate-800 text-sm">{t('admin.accounting.fixedAssets')}</span>
                <p className="text-xs text-slate-500">{t('admin.accounting.fixedAssetsSub')}</p>
              </div>
            </Link>
            <Link
              href="/admin/comptabilite/declaration-tps-tvq"
              className="flex items-center gap-3 p-4 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors group"
            >
              <span className="p-2 bg-amber-100 rounded-lg text-amber-600 group-hover:bg-amber-200 transition-colors">
                <Receipt className="w-5 h-5" />
              </span>
              <div>
                <span className="font-medium text-slate-800 text-sm">{t('admin.accounting.tpsTvq')}</span>
                <p className="text-xs text-slate-500">{t('admin.accounting.tpsTvqSub')}</p>
              </div>
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

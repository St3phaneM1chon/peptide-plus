'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  Loader2,
  DollarSign,
  Receipt,
  FileText,
  ClipboardList,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface TaxRegion {
  id: string;
  name: string;
  code: string;
  type: 'COUNTRY' | 'STATE' | 'PROVINCE';
  taxRate: number;
  taxName: string;
  isActive: boolean;
  obligations: string[];
}

interface TaxReport {
  id: string;
  region: string;
  regionCode: string;
  period: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  year: number;
  month?: number;
  quarter?: number;
  totalSales: number;
  taxableAmount: number;
  taxCollected: number;
  taxRate: number;
  orderCount: number;
  status: 'DRAFT' | 'GENERATED' | 'FILED' | 'PAID';
  generatedAt: string;
  filedAt?: string;
  paidAt?: string;
  dueDate: string;
}

type TabKey = 'reports' | 'regions' | 'tasks';

const statusVariantMap: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'neutral',
  GENERATED: 'info',
  FILED: 'warning',
  PAID: 'success',
};

const yearOptions = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
];

interface TaxSummary {
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  tvhPaid: number;
  netTps: number;
  netTvq: number;
  netTvh: number;
  salesCount: number;
  totalSales: number;
}

// Helper: get nominal tax rate for a region code (for estimation when needed)
function getRegionTaxRate(regionCode: string): number {
  const rates: Record<string, number> = {
    QC: 0.14975, ON: 0.13, BC: 0.12, AB: 0.05,
    MB: 0.12, SK: 0.11, NS: 0.14, NB: 0.15,
    NL: 0.15, PE: 0.15, NT: 0.05, NU: 0.05, YT: 0.05,
    US: 0, FR: 0.20, GB: 0.20, JP: 0.10,
    AU: 0.10, AE: 0.05, IL: 0.17, CL: 0.19, PE_COUNTRY: 0.18,
  };
  return rates[regionCode] || 0.05;
}

export default function FiscalPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('reports');
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TaxReport | null>(null);
  const [regions, setRegions] = useState<TaxRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);

  const regionOptions = [
    { value: 'QC', label: t('admin.fiscal.regions.quebec') },
    { value: 'ON', label: t('admin.fiscal.regions.ontario') },
    { value: 'BC', label: t('admin.fiscal.regions.britishColumbia') },
    { value: 'AB', label: t('admin.fiscal.regions.alberta') },
    { value: 'MB', label: t('admin.fiscal.regions.manitoba') },
    { value: 'SK', label: t('admin.fiscal.regions.saskatchewan') },
    { value: 'NS', label: t('admin.fiscal.regions.novaScotia') },
    { value: 'NB', label: t('admin.fiscal.regions.newBrunswick') },
    { value: 'US', label: t('admin.fiscal.regions.unitedStates') },
    { value: 'FR', label: t('admin.fiscal.regions.france') },
    { value: 'GB', label: t('admin.fiscal.regions.unitedKingdom') },
  ];

  const fetchReports = async (year: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/accounting/tax-reports?year=${year}`);
      if (!res.ok) throw new Error(t('admin.fiscal.errorLoadingReports'));
      const data = await res.json();
      const mapped: TaxReport[] = (data.reports || []).map((r: Record<string, unknown>) => {
        const totalSales = (r.totalSales as number) || 0;
        const tpsCollected = (r.tpsCollected as number) || 0;
        const tvqCollected = (r.tvqCollected as number) || 0;
        const tvhCollected = (r.tvhCollected as number) || 0;
        const otherTaxCollected = (r.otherTaxCollected as number) || 0;
        const taxCollected = tpsCollected + tvqCollected + tvhCollected + otherTaxCollected;
        // Derive taxable amount from actual tax collected and total sales
        // taxableAmount = totalSales - non-taxable portion (estimated from collected vs expected)
        const taxableAmount = taxCollected > 0 && totalSales > 0
          ? Math.round(totalSales - (totalSales - taxCollected / getRegionTaxRate(r.regionCode as string)) * 0) // Use actual collected taxes
          : totalSales;
        // Calculate effective tax rate from actual collected taxes
        const effectiveTaxRate = totalSales > 0
          ? Math.round((taxCollected / totalSales) * 10000) / 100
          : 0;

        return {
          id: r.id as string,
          region: r.region as string,
          regionCode: r.regionCode as string,
          period: r.period as string,
          periodType: (r.periodType as string) || 'MONTHLY',
          year: r.year as number,
          month: r.month as number | undefined,
          quarter: r.quarter as number | undefined,
          totalSales,
          taxableAmount: (r.taxableAmount as number) || taxableAmount,
          taxCollected,
          taxRate: effectiveTaxRate,
          orderCount: (r.salesCount as number) || 0,
          status: (r.status as TaxReport['status']) || 'DRAFT',
          generatedAt: (r.createdAt as string) || new Date().toISOString(),
          filedAt: r.filedAt as string | undefined,
          paidAt: r.paidAt as string | undefined,
          dueDate: (r.dueDate as string) || new Date().toISOString(),
        };
      });
      setReports(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.fiscal.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxSummary = async (year: number) => {
    try {
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      const res = await fetch(`/api/accounting/tax-summary?from=${from}&to=${to}`);
      if (!res.ok) return;
      const data = await res.json();
      setTaxSummary(data);
    } catch {
      // Tax summary is supplementary, don't block on error
    }
  };

  useEffect(() => {
    fetchReports(selectedYear);
    fetchTaxSummary(selectedYear);
  }, [selectedYear]);

  const generateAllReports = async () => {
    setGenerating(true);
    try {
      const activeRegions = regionOptions.map(r => r.value);
      for (const regionCode of activeRegions) {
        for (let month = 1; month <= 12; month++) {
          await fetch('/api/accounting/tax-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              period: `${selectedYear}-${String(month).padStart(2, '0')}`,
              periodType: 'MONTHLY',
              year: selectedYear,
              month,
              regionCode,
            }),
          });
        }
      }
      toast.success(t('admin.fiscal.allReportsGenerated'));
      await fetchReports(selectedYear);
    } catch (err) {
      toast.error(t('admin.fiscal.errorGeneratingReports'));
    } finally {
      setGenerating(false);
    }
  };

  const markAsFiled = async (reportId: string) => {
    try {
      const res = await fetch('/api/accounting/tax-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'FILED' }),
      });
      if (!res.ok) throw new Error('Error');
      setReports(reports.map(r =>
        r.id === reportId ? { ...r, status: 'FILED' as const, filedAt: new Date().toISOString() } : r
      ));
    } catch {
      toast.error(t('admin.fiscal.errorUpdatingStatus'));
    }
  };

  const markAsPaid = async (reportId: string) => {
    try {
      const res = await fetch('/api/accounting/tax-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'PAID', paidAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Error');
      setReports(reports.map(r =>
        r.id === reportId ? { ...r, status: 'PAID' as const, paidAt: new Date().toISOString() } : r
      ));
    } catch {
      toast.error(t('admin.fiscal.errorUpdatingStatus'));
    }
  };

  const exportReport = (report: TaxReport, format: 'PDF' | 'CSV' | 'EXCEL') => {
    if (format === 'CSV' || format === 'EXCEL') {
      const headers = [
        t('admin.fiscal.columns.region') || 'Region', 'Code',
        t('admin.fiscal.columns.period') || 'Period',
        t('admin.fiscal.columns.sales') || 'Total Sales',
        t('admin.fiscal.columns.taxableAmount') || 'Taxable Amount',
        t('admin.fiscal.columns.rate') || 'Tax Rate %',
        t('admin.fiscal.columns.taxCollected') || 'Tax Collected',
        t('admin.fiscal.columns.orders') || 'Orders',
        t('admin.fiscal.columns.status') || 'Status',
        t('admin.fiscal.columns.dueDate') || 'Due Date',
      ];
      const rows = [[
        report.region, report.regionCode, report.period,
        report.totalSales, report.taxableAmount, report.taxRate,
        report.taxCollected, report.orderCount, report.status,
        new Date(report.dueDate).toLocaleDateString(locale),
      ]];
      const bom = '\uFEFF';
      const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `tax-report-${report.regionCode}-${report.period}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('common.exported') || 'Exported');
    } else {
      // PDF - generate a printable view
      const w = window.open('', '_blank');
      if (!w) { toast.error(t('admin.fiscal.exportError') || 'Popup blocked'); return; }
      w.document.write(`<!DOCTYPE html><html><head><title>${t('admin.fiscal.modal.title').replace('{region}', report.region)} - ${report.period}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:auto}
        h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:20px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}
        .right{text-align:right}.footer{margin-top:30px;font-size:12px;color:#888}</style></head><body>
        <h1>${report.region} (${report.regionCode}) - ${report.period}</h1>
        <table>
          <tr><th>${t('admin.fiscal.modal.totalSales') || 'Total Sales'}</th><td class="right">${formatCurrency(report.totalSales)}</td></tr>
          <tr><th>${t('admin.fiscal.modal.taxableAmount') || 'Taxable Amount'}</th><td class="right">${formatCurrency(report.taxableAmount)}</td></tr>
          <tr><th>${t('admin.fiscal.modal.taxRate') || 'Tax Rate'}</th><td class="right">${report.taxRate}%</td></tr>
          <tr><th>${t('admin.fiscal.modal.taxCollected') || 'Tax Collected'}</th><td class="right">${formatCurrency(report.taxCollected)}</td></tr>
          <tr><th>${t('admin.fiscal.modal.orders') || 'Orders'}</th><td class="right">${report.orderCount}</td></tr>
          <tr><th>${t('admin.fiscal.modal.currentStatus') || 'Status'}</th><td>${report.status}</td></tr>
          <tr><th>${t('admin.fiscal.modal.dueDate') || 'Due Date'}</th><td>${new Date(report.dueDate).toLocaleDateString(locale)}</td></tr>
        </table>
        <p class="footer">${t('admin.fiscal.title') || 'Tax Report'} - ${new Date().toLocaleString(locale)}</p>
        <script>window.print();</script></body></html>`);
      w.document.close();
      toast.success(t('admin.fiscal.exportPdf') || 'PDF generated');
    }
  };

  const filteredReports = reports.filter(r => {
    if (selectedRegion && r.regionCode !== selectedRegion) return false;
    return true;
  });

  const monthlyReports = filteredReports.filter(r => r.periodType === 'MONTHLY');
  const annualReports = filteredReports.filter(r => r.periodType === 'ANNUAL');

  const totalTaxCollected = taxSummary
    ? taxSummary.tpsCollected + taxSummary.tvqCollected + taxSummary.tvhCollected
    : monthlyReports.reduce((sum, r) => sum + r.taxCollected, 0);
  const totalSales = taxSummary
    ? taxSummary.totalSales
    : monthlyReports.reduce((sum, r) => sum + r.totalSales, 0);
  const pendingReports = reports.filter(r => r.status === 'GENERATED' || r.status === 'DRAFT').length;

  const [settings, setSettings] = useState({
    taxIncludedInPrice: false,
    displayTaxSeparately: true,
    applyTaxToShipping: true,
    taxExemptProducts: [] as string[],
  });


  // --- Column definitions for DataTable ---

  const annualColumns: Column<TaxReport>[] = [
    {
      key: 'region',
      header: t('admin.fiscal.columns.region'),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.region}</p>
          <p className="text-xs text-slate-500">{r.regionCode}</p>
        </div>
      ),
    },
    {
      key: 'totalSales',
      header: t('admin.fiscal.columns.sales'),
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{formatCurrency(r.totalSales)}</span>,
    },
    {
      key: 'taxableAmount',
      header: t('admin.fiscal.columns.taxableAmount'),
      align: 'right',
      render: (r) => <span className="text-slate-600">{formatCurrency(r.taxableAmount)}</span>,
    },
    {
      key: 'taxRate',
      header: t('admin.fiscal.columns.rate'),
      align: 'right',
      render: (r) => <span className="text-slate-600">{r.taxRate > 0 ? `${r.taxRate}%` : t('admin.fiscal.columns.variable')}</span>,
    },
    {
      key: 'taxCollected',
      header: t('admin.fiscal.columns.taxCollected'),
      align: 'right',
      render: (r) => <span className="font-bold text-green-600">{formatCurrency(r.taxCollected)}</span>,
    },
    {
      key: 'orderCount',
      header: t('admin.fiscal.columns.orders'),
      align: 'center',
      render: (r) => <span className="text-slate-600">{r.orderCount}</span>,
    },
    {
      key: 'status',
      header: t('admin.fiscal.columns.status'),
      align: 'center',
      render: (r) => <StatusBadge variant={statusVariantMap[r.status] || 'neutral'}>{r.status}</StatusBadge>,
    },
    {
      key: 'actions',
      header: t('admin.fiscal.columns.actions'),
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="primary" onClick={() => setSelectedReport(r)}>
            {t('admin.fiscal.columns.details')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportReport(r, 'PDF')}>
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const monthlyColumns: Column<TaxReport>[] = [
    {
      key: 'region',
      header: t('admin.fiscal.columns.region'),
      render: (r) => <p className="font-medium text-slate-900">{r.region}</p>,
    },
    {
      key: 'period',
      header: t('admin.fiscal.columns.period'),
      render: (r) => <span className="text-slate-600 capitalize">{r.period}</span>,
    },
    {
      key: 'totalSales',
      header: t('admin.fiscal.columns.sales'),
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{formatCurrency(r.totalSales)}</span>,
    },
    {
      key: 'taxCollected',
      header: t('admin.fiscal.columns.taxes'),
      align: 'right',
      render: (r) => <span className="font-medium text-green-600">{formatCurrency(r.taxCollected)}</span>,
    },
    {
      key: 'orderCount',
      header: t('admin.fiscal.columns.ordersShort'),
      align: 'center',
      render: (r) => <span className="text-slate-600">{r.orderCount}</span>,
    },
    {
      key: 'dueDate',
      header: t('admin.fiscal.columns.dueDate'),
      render: (r) => <span className="text-slate-500 text-sm">{new Date(r.dueDate).toLocaleDateString(locale)}</span>,
    },
    {
      key: 'status',
      header: t('admin.fiscal.columns.status'),
      align: 'center',
      render: (r) => <StatusBadge variant={statusVariantMap[r.status] || 'neutral'}>{r.status}</StatusBadge>,
    },
    {
      key: 'actions',
      header: t('admin.fiscal.columns.actions'),
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          {r.status === 'GENERATED' && (
            <Button size="sm" variant="outline" onClick={() => markAsFiled(r.id)}>
              {t('admin.fiscal.columns.declare')}
            </Button>
          )}
          {r.status === 'FILED' && (
            <Button size="sm" variant="outline" onClick={() => markAsPaid(r.id)}>
              {t('admin.fiscal.columns.paid')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => exportReport(r, 'PDF')}>
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const regionColumns: Column<TaxRegion>[] = [
    {
      key: 'name',
      header: t('admin.fiscal.columns.region'),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('admin.fiscal.columns.type'),
      render: (r) => <span className="text-slate-600">{r.type}</span>,
    },
    {
      key: 'taxRate',
      header: t('admin.fiscal.columns.rate'),
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{r.taxRate > 0 ? `${r.taxRate}%` : t('admin.fiscal.columns.variable')}</span>,
    },
    {
      key: 'taxName',
      header: t('admin.fiscal.columns.taxName'),
      render: (r) => <span className="text-slate-600">{r.taxName}</span>,
    },
    {
      key: 'isActive',
      header: t('admin.fiscal.columns.active'),
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setRegions(regions.map(reg => reg.id === r.id ? { ...reg, isActive: !reg.isActive } : reg))}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            r.isActive ? 'bg-green-500' : 'bg-slate-300'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            r.isActive ? 'right-0.5' : 'left-0.5'
          }`} />
        </button>
      ),
    },
    {
      key: 'actions',
      header: t('admin.fiscal.columns.actions'),
      align: 'center',
      render: (_r) => (
        <Button size="sm" variant="primary">
          {t('admin.fiscal.columns.details')}
        </Button>
      ),
    },
  ];

  const regionColumns2: Column<TaxRegion>[] = [
    {
      key: 'name',
      header: t('admin.fiscal.columns.region'),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('admin.fiscal.columns.type'),
      render: (r) => <span className="text-slate-600">{r.type}</span>,
    },
    {
      key: 'taxRate',
      header: t('admin.fiscal.columns.rate'),
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{r.taxRate > 0 ? `${r.taxRate}%` : t('admin.fiscal.columns.variable')}</span>,
    },
    {
      key: 'taxName',
      header: t('admin.fiscal.columns.taxName'),
      render: (r) => <span className="text-slate-600">{r.taxName}</span>,
    },
    {
      key: 'isActive',
      header: t('admin.fiscal.columns.active'),
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setRegions(regions.map(reg => reg.id === r.id ? { ...reg, isActive: !reg.isActive } : reg))}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            r.isActive ? 'bg-green-500' : 'bg-slate-300'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            r.isActive ? 'right-0.5' : 'left-0.5'
          }`} />
        </button>
      ),
    },
    {
      key: 'actions',
      header: t('admin.fiscal.columns.actions'),
      align: 'center',
      render: (r) => (
        <Button size="sm" variant="primary" onClick={() => setSelectedRegion(r.code)}>
          {t('admin.fiscal.columns.viewReports')}
        </Button>
      ),
    },
  ];

  // --- Tab definitions ---

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'reports', label: t('admin.fiscal.tabs.reports') },
    { key: 'regions', label: t('admin.fiscal.tabs.regions') },
    { key: 'tasks', label: t('admin.fiscal.tabs.tasks') },
  ];

  // ─── Ribbon action handlers ───────────────────────────────
  const handleRibbonVerifyBalances = useCallback(() => {
    const totalCollected = taxSummary
      ? taxSummary.tpsCollected + taxSummary.tvqCollected + taxSummary.tvhCollected
      : monthlyReports.reduce((sum, r) => sum + r.taxCollected, 0);
    const totalSalesAmt = taxSummary ? taxSummary.totalSales : monthlyReports.reduce((sum, r) => sum + r.totalSales, 0);
    const filed = reports.filter(r => r.status === 'FILED' || r.status === 'PAID').length;
    const pending = reports.filter(r => r.status === 'GENERATED' || r.status === 'DRAFT').length;
    toast.success(
      `${t('admin.fiscal.stats.totalSales').replace('{year}', String(selectedYear))}: ${formatCurrency(totalSalesAmt)} | ` +
      `${t('admin.fiscal.stats.taxCollected') || 'Tax Collected'}: ${formatCurrency(totalCollected)} | ` +
      `${t('admin.fiscal.tabs.reports') || 'Reports'}: ${reports.length} (${filed} ${t('admin.fiscal.annualTasks.statusCompleted') || 'filed'}, ${pending} ${t('admin.fiscal.stats.toDeclare') || 'pending'})`,
      { duration: 8000 }
    );
  }, [reports, monthlyReports, taxSummary, selectedYear, t, formatCurrency]);

  const handleRibbonAuditTrail = useCallback(() => {
    window.open('/admin/audits', '_blank');
  }, []);

  const handleRibbonClosePeriod = useCallback(() => {
    const generatedReports = reports.filter(r => r.status === 'GENERATED');
    if (generatedReports.length === 0) {
      toast.info(t('admin.fiscal.stats.toDeclare') || 'No reports to file');
      return;
    }
    (async () => {
      let filed = 0;
      for (const r of generatedReports) {
        await markAsFiled(r.id);
        filed++;
      }
      toast.success(`${filed} ${t('admin.fiscal.tabs.reports') || 'reports'} ${t('admin.fiscal.columns.declare') || 'filed'}`, { duration: 5000 });
    })();
  }, [reports, t]);

  const handleRibbonReopen = useCallback(() => {
    if (!selectedReport) {
      toast.info(t('admin.fiscal.modal.title').replace('{region}', '') || 'Select a report first via the details button');
      return;
    }
    if (selectedReport.status === 'DRAFT' || selectedReport.status === 'GENERATED') {
      toast.info(t('admin.fiscal.columns.status') || `Report is already in ${selectedReport.status} status`);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/accounting/tax-reports', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedReport.id, status: 'GENERATED' }),
        });
        if (!res.ok) throw new Error('Error');
        setReports(prev => prev.map(r =>
          r.id === selectedReport.id ? { ...r, status: 'GENERATED' as const } : r
        ));
        setSelectedReport({ ...selectedReport, status: 'GENERATED' });
        toast.success(t('admin.fiscal.columns.status') || 'Report reopened to GENERATED');
      } catch {
        toast.error(t('admin.fiscal.errorUpdatingStatus') || 'Failed to reopen report');
      }
    })();
  }, [selectedReport, t]);

  const handleRibbonFiscalCalendar = useCallback(() => {
    setActiveTab('tasks');
  }, []);

  const handleRibbonTaxReturn = useCallback(() => {
    // Open the tax return generation: generate all reports for the current year, then switch to tasks tab
    if (reports.length === 0) {
      generateAllReports();
      toast.info(t('admin.fiscal.generating') || 'Generating tax reports...');
    } else {
      setActiveTab('tasks');
      toast.info(t('admin.fiscal.deadlines.title') || 'Showing tax deadlines and tasks');
    }
  }, [reports, t]);

  const handleRibbonExport = useCallback(() => {
    if (filteredReports.length === 0) {
      toast.info(t('admin.fiscal.monthlyReports.emptyTitle') || 'No reports to export');
      return;
    }
    const headers = [
      t('admin.fiscal.columns.region') || 'Region',
      'Code',
      t('admin.fiscal.columns.period') || 'Period',
      t('admin.fiscal.columns.type') || 'Type',
      t('admin.fiscal.columns.sales') || 'Total Sales',
      t('admin.fiscal.columns.taxableAmount') || 'Taxable Amount',
      t('admin.fiscal.columns.rate') || 'Tax Rate %',
      t('admin.fiscal.columns.taxCollected') || 'Tax Collected',
      t('admin.fiscal.columns.orders') || 'Orders',
      t('admin.fiscal.columns.status') || 'Status',
      t('admin.fiscal.columns.dueDate') || 'Due Date',
    ];
    const rows = filteredReports.map(r => [
      r.region, r.regionCode, r.period, r.periodType,
      r.totalSales, r.taxableAmount, r.taxRate, r.taxCollected,
      r.orderCount, r.status, new Date(r.dueDate).toLocaleDateString(locale),
    ]);
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `fiscal-reports-${selectedYear}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported');
  }, [filteredReports, selectedYear, t, locale]);

  useRibbonAction('verifyBalances', handleRibbonVerifyBalances);
  useRibbonAction('auditTrail', handleRibbonAuditTrail);
  useRibbonAction('closePeriod', handleRibbonClosePeriod);
  useRibbonAction('reopen', handleRibbonReopen);
  useRibbonAction('fiscalCalendar', handleRibbonFiscalCalendar);
  useRibbonAction('taxReturn', handleRibbonTaxReturn);
  useRibbonAction('export', handleRibbonExport);

  if (loading) return <div className="p-8 text-center">{t('admin.fiscal.loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.fiscal.errorPrefix')} {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.fiscal.title')}
        subtitle={t('admin.fiscal.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={generating ? Loader2 : FileBarChart}
            loading={generating}
            onClick={generateAllReports}
          >
            {generating ? t('admin.fiscal.generating') : t('admin.fiscal.generateAll')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.fiscal.stats.totalSales').replace('{year}', String(selectedYear))}
          value={formatCurrency(totalSales)}
          icon={DollarSign}
        />
        <StatCard
          label={t('admin.fiscal.stats.taxCollected')}
          value={formatCurrency(totalTaxCollected)}
          icon={Receipt}
          className="bg-green-50 border-green-200"
        />
        <StatCard
          label={t('admin.fiscal.stats.reportsGenerated')}
          value={reports.length}
          icon={FileText}
          className="bg-blue-50 border-blue-200"
        />
        <StatCard
          label={t('admin.fiscal.stats.toDeclare')}
          value={pendingReports}
          icon={ClipboardList}
          className="bg-yellow-50 border-yellow-200"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'reports' && (
        <>
          {/* Filters */}
          <FilterBar
            actions={
              <div className="flex gap-2">
                <Button variant="secondary" icon={Download} onClick={() => toast.info(t('admin.fiscal.exportPdf'))}>
                  {t('admin.fiscal.filters.exportAllPdf')}
                </Button>
                <Button variant="secondary" icon={Download} onClick={() => toast.info(t('admin.fiscal.exportExcel'))}>
                  {t('admin.fiscal.filters.exportAllExcel')}
                </Button>
              </div>
            }
          >
            <SelectFilter
              label={t('admin.fiscal.filters.year')}
              value={String(selectedYear)}
              onChange={(v) => setSelectedYear(parseInt(v) || 2026)}
              options={yearOptions}
            />
            <SelectFilter
              label={t('admin.fiscal.filters.allRegions')}
              value={selectedRegion}
              onChange={setSelectedRegion}
              options={regionOptions}
            />
          </FilterBar>

          {/* Annual Reports */}
          <div>
            <div className="px-4 py-3 bg-sky-50 border border-slate-200 border-b-0 rounded-t-lg flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-sky-700" />
              <h3 className="font-semibold text-sky-900">{t('admin.fiscal.annualReports.title').replace('{year}', String(selectedYear))}</h3>
            </div>
            <DataTable
              columns={annualColumns}
              data={annualReports}
              keyExtractor={(r) => r.id}
              emptyTitle={t('admin.fiscal.annualReports.emptyTitle')}
              emptyDescription={t('admin.fiscal.annualReports.emptyDescription')}
            />
            {annualReports.length > 0 && (
              <div className="bg-sky-50 border border-slate-200 border-t-0 rounded-b-lg px-4 py-3">
                <div className="flex items-center text-sm">
                  <span className="font-bold text-sky-900 w-[200px]">{t('admin.fiscal.annualReports.totalAnnual')}</span>
                  <span className="font-bold text-sky-900 flex-1 text-end">
                    {formatCurrency(annualReports.reduce((s, r) => s + r.totalSales, 0))}
                  </span>
                  <span className="font-bold text-sky-900 flex-1 text-end">
                    {formatCurrency(annualReports.reduce((s, r) => s + r.taxableAmount, 0))}
                  </span>
                  <span className="flex-1" />
                  <span className="font-bold text-green-700 flex-1 text-end">
                    {formatCurrency(annualReports.reduce((s, r) => s + r.taxCollected, 0))}
                  </span>
                  <span className="font-bold text-sky-900 flex-1 text-center">
                    {annualReports.reduce((s, r) => s + r.orderCount, 0)}
                  </span>
                  <span className="flex-1" />
                  <span className="flex-1" />
                </div>
              </div>
            )}
          </div>

          {/* Monthly Reports */}
          <div>
            <div className="px-4 py-3 bg-blue-50 border border-slate-200 border-b-0 rounded-t-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-700" />
              <h3 className="font-semibold text-blue-900">{t('admin.fiscal.monthlyReports.title').replace('{year}', String(selectedYear))}</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <DataTable
                columns={monthlyColumns}
                data={monthlyReports.sort((a, b) => (b.month || 0) - (a.month || 0))}
                keyExtractor={(r) => r.id}
                emptyTitle={t('admin.fiscal.monthlyReports.emptyTitle')}
                emptyDescription={t('admin.fiscal.monthlyReports.emptyDescription')}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'regions' && (
        <>
          {/* Global Settings */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.fiscal.settings.title')}</h3>
            <div className="space-y-4">
              <ToggleSetting
                title={t('admin.fiscal.settings.taxIncluded')}
                description={t('admin.fiscal.settings.taxIncludedDesc')}
                checked={settings.taxIncludedInPrice}
                onChange={() => setSettings({ ...settings, taxIncludedInPrice: !settings.taxIncludedInPrice })}
              />
              <ToggleSetting
                title={t('admin.fiscal.settings.displayTaxSeparately')}
                description={t('admin.fiscal.settings.displayTaxSeparatelyDesc')}
                checked={settings.displayTaxSeparately}
                onChange={() => setSettings({ ...settings, displayTaxSeparately: !settings.displayTaxSeparately })}
              />
              <ToggleSetting
                title={t('admin.fiscal.settings.taxShipping')}
                description={t('admin.fiscal.settings.taxShippingDesc')}
                checked={settings.applyTaxToShipping}
                onChange={() => setSettings({ ...settings, applyTaxToShipping: !settings.applyTaxToShipping })}
              />
            </div>
          </div>

          {/* Tax Regions */}
          <div>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 border-b-0 rounded-t-lg">
              <h3 className="font-semibold text-slate-900">{t('admin.fiscal.regionsTables.title')}</h3>
            </div>
            <DataTable
              columns={regionColumns}
              data={regions}
              keyExtractor={(r) => r.id}
              emptyTitle={t('admin.fiscal.regionsTables.emptyTitle')}
              emptyDescription={t('admin.fiscal.regionsTables.emptyDescription')}
            />
          </div>

          {/* Tax Regions Table (configured) */}
          <div>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 border-b-0 rounded-t-lg">
              <h3 className="font-semibold text-slate-900">{t('admin.fiscal.regionsTables.configuredTitle')}</h3>
            </div>
            <DataTable
              columns={regionColumns2}
              data={regions}
              keyExtractor={(r) => `${r.id}-configured`}
              emptyTitle={t('admin.fiscal.regionsTables.configuredEmptyTitle')}
              emptyDescription={t('admin.fiscal.regionsTables.configuredEmptyDescription')}
            />
          </div>
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.fiscal.deadlines.title')}</h3>
            <div className="space-y-3">
              {reports
                .filter(r => r.status === 'GENERATED' || r.status === 'FILED')
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .slice(0, 10)
                .map((report) => {
                  const daysUntil = Math.ceil((new Date(report.dueDate).getTime() - Date.now()) / 86400000);
                  const isUrgent = daysUntil <= 7;
                  const isPast = daysUntil < 0;
                  return (
                    <div
                      key={report.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isPast ? 'bg-red-50 border-red-200' :
                        isUrgent ? 'bg-yellow-50 border-yellow-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isPast ? 'text-red-800' : isUrgent ? 'text-yellow-800' : 'text-slate-800'}`}>
                          {report.region} - {report.period}
                        </p>
                        <p className={`text-sm ${isPast ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-slate-600'}`}>
                          {t('admin.fiscal.deadlines.dueDateLabel')} {new Date(report.dueDate).toLocaleDateString(locale)}
                          {isPast && ` ${t('admin.fiscal.deadlines.overdue')}`}
                          {!isPast && isUrgent && ` ${t('admin.fiscal.deadlines.daysLeft').replace('{days}', String(daysUntil))}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={statusVariantMap[report.status] || 'neutral'}>
                          {report.status}
                        </StatusBadge>
                        {report.status === 'GENERATED' && (
                          <Button size="sm" variant="outline" onClick={() => markAsFiled(report.id)}>
                            {t('admin.fiscal.columns.declare')}
                          </Button>
                        )}
                        {report.status === 'FILED' && (
                          <Button size="sm" variant="outline" onClick={() => markAsPaid(report.id)}>
                            {t('admin.fiscal.deadlines.markPaid')}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Annual Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.fiscal.annualTasks.title')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div>
                  <p className="font-medium text-yellow-800">{t('admin.fiscal.annualTasks.tpsTvqQ4')}</p>
                  <p className="text-sm text-yellow-600">{t('admin.fiscal.annualTasks.tpsTvqQ4Due')}</p>
                </div>
                <StatusBadge variant="warning">{t('admin.fiscal.annualTasks.statusInProgress')}</StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="font-medium text-green-800">{t('admin.fiscal.annualTasks.tpsTvqQ3')}</p>
                  <p className="text-sm text-green-600">{t('admin.fiscal.annualTasks.tpsTvqQ3Done')}</p>
                </div>
                <StatusBadge variant="success">{t('admin.fiscal.annualTasks.statusCompleted')}</StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">{t('admin.fiscal.annualTasks.annualReport')}</p>
                  <p className="text-sm text-slate-600">{t('admin.fiscal.annualTasks.annualReportDue')}</p>
                </div>
                <StatusBadge variant="neutral">{t('admin.fiscal.annualTasks.statusUpcoming')}</StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">{t('admin.fiscal.annualTasks.renewTaxNumbers')}</p>
                  <p className="text-sm text-slate-600">{t('admin.fiscal.annualTasks.renewTaxNumbersDue')}</p>
                </div>
                <StatusBadge variant="neutral">{t('admin.fiscal.annualTasks.statusUpcoming')}</StatusBadge>
              </div>
            </div>
          </div>

          {/* Summary by Region */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.fiscal.regionSummary.title').replace('{year}', String(selectedYear))}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {annualReports.map((report) => (
                <div key={report.id} className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-900">{report.region}</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(report.taxCollected)}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('admin.fiscal.regionSummary.orders').replace('{count}', String(report.orderCount))}</p>
                  <p className="text-xs text-slate-500">{t('admin.fiscal.regionSummary.rate').replace('{rate}', String(report.taxRate))}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Report Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={t('admin.fiscal.modal.title').replace('{region}', selectedReport?.region ?? '')}
        subtitle={selectedReport?.period}
        size="lg"
        footer={
          selectedReport && (
            <div className="flex flex-wrap gap-3 w-full">
              <Button variant="danger" icon={Download} onClick={() => exportReport(selectedReport, 'PDF')}>
                {t('admin.fiscal.modal.exportPdf')}
              </Button>
              <Button variant="secondary" icon={Download} onClick={() => exportReport(selectedReport, 'EXCEL')}>
                {t('admin.fiscal.modal.exportExcel')}
              </Button>
              <Button variant="ghost" icon={Download} onClick={() => exportReport(selectedReport, 'CSV')}>
                {t('admin.fiscal.modal.exportCsv')}
              </Button>
              {selectedReport.status === 'GENERATED' && (
                <Button
                  variant="primary"
                  className="ms-auto"
                  onClick={() => {
                    markAsFiled(selectedReport.id);
                    setSelectedReport({ ...selectedReport, status: 'FILED', filedAt: new Date().toISOString() });
                  }}
                >
                  {t('admin.fiscal.modal.markFiled')}
                </Button>
              )}
              {selectedReport.status === 'FILED' && (
                <Button
                  variant="primary"
                  className="ms-auto"
                  onClick={() => {
                    markAsPaid(selectedReport.id);
                    setSelectedReport({ ...selectedReport, status: 'PAID', paidAt: new Date().toISOString() });
                  }}
                >
                  {t('admin.fiscal.modal.markPaid')}
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedReport && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-sm text-slate-500">{t('admin.fiscal.modal.totalSales')}</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(selectedReport.totalSales)}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-sm text-slate-500">{t('admin.fiscal.modal.taxableAmount')}</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(selectedReport.taxableAmount)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-green-600">{t('admin.fiscal.modal.taxCollected')}</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(selectedReport.taxCollected)}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-sm text-blue-600">{t('admin.fiscal.modal.orders')}</p>
                <p className="text-xl font-bold text-blue-700">{selectedReport.orderCount}</p>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-3">{t('admin.fiscal.modal.information')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.region')}</span>
                    <span className="font-medium">{selectedReport.region} ({selectedReport.regionCode})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.period')}</span>
                    <span className="font-medium">{selectedReport.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.type')}</span>
                    <span className="font-medium">{selectedReport.periodType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.taxRate')}</span>
                    <span className="font-medium">{selectedReport.taxRate}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-3">{t('admin.fiscal.modal.statusSection')}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.currentStatus')}</span>
                    <StatusBadge variant={statusVariantMap[selectedReport.status] || 'neutral'}>
                      {selectedReport.status}
                    </StatusBadge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.generatedOn')}</span>
                    <span className="font-medium">{new Date(selectedReport.generatedAt).toLocaleDateString(locale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t('admin.fiscal.modal.dueDate')}</span>
                    <span className="font-medium">{new Date(selectedReport.dueDate).toLocaleDateString(locale)}</span>
                  </div>
                  {selectedReport.filedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('admin.fiscal.modal.filedOn')}</span>
                      <span className="font-medium">{new Date(selectedReport.filedAt).toLocaleDateString(locale)}</span>
                    </div>
                  )}
                  {selectedReport.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('admin.fiscal.modal.paidOn')}</span>
                      <span className="font-medium">{new Date(selectedReport.paidAt).toLocaleDateString(locale)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-3">{t('admin.fiscal.modal.calculationDetail')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('admin.fiscal.modal.grossSales')}</span>
                  <span>{formatCurrency(selectedReport.totalSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('admin.fiscal.modal.nonTaxableSales')}</span>
                  <span>-{formatCurrency(selectedReport.totalSales - selectedReport.taxableAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-medium">{t('admin.fiscal.modal.taxableAmountCalc')}</span>
                  <span className="font-medium">{formatCurrency(selectedReport.taxableAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('admin.fiscal.modal.taxRateCalc')}</span>
                  <span>x {selectedReport.taxRate}%</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-bold text-green-700">{t('admin.fiscal.modal.taxToRemit')}</span>
                  <span className="font-bold text-green-700">{formatCurrency(selectedReport.taxCollected)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// --- Helper component for toggle settings ---

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-green-500' : 'bg-slate-300'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'right-1' : 'left-1'
        }`} />
      </button>
    </label>
  );
}

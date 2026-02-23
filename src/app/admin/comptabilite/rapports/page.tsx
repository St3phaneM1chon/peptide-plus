'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Globe,
  DollarSign,
  TrendingDown,
  Target,
  Banknote,
  FileText,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { PageHeader, StatusBadge, Button, SectionCard, type Column, DataTable, type BadgeVariant } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface TaxReport {
  id: string;
  period: string;
  periodType: string;
  year: number;
  region: string;
  regionCode: string;
  status: string;
  dueDate: string;
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  tvhPaid: number;
  netTps: number;
  netTvq: number;
  netTvh: number;
  netTotal: number;
  totalSales: number;
}

interface TaxSummary {
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  netTps: number;
  netTvq: number;
  netTvh: number;
}


export default function RapportsComptablesPage() {
  const { t, formatCurrency, formatDate } = useI18n();
  const [selectedYear, setSelectedYear] = useState('2026');
  const [taxReports, setTaxReports] = useState<TaxReport[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const managementReports = [
    { id: '1', name: t('admin.reports.salesByProduct'), icon: BarChart3, description: t('admin.reports.salesByProductDesc') },
    { id: '2', name: t('admin.reports.salesByRegion'), icon: Globe, description: t('admin.reports.salesByRegionDesc') },
    { id: '3', name: t('admin.reports.profitability'), icon: DollarSign, description: t('admin.reports.profitabilityDesc') },
    { id: '4', name: t('admin.reports.expenseAnalysis'), icon: TrendingDown, description: t('admin.reports.expenseAnalysisDesc') },
    { id: '5', name: t('admin.reports.performanceReport'), icon: Target, description: t('admin.reports.performanceReportDesc') },
    { id: '6', name: t('admin.reports.cashFlowReport'), icon: Banknote, description: t('admin.reports.cashFlowReportDesc') },
  ];

  // Fetch tax reports
  const fetchTaxReports = async (year: string) => {
    try {
      const res = await fetch(`/api/accounting/tax-reports?year=${year}`);
      if (!res.ok) throw new Error(t('admin.reports.errorLoadReports'));
      const data = await res.json();
      setTaxReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.reports.errorUnknown'));
    }
  };

  // Fetch tax summary for the year
  const fetchTaxSummary = async (year: string) => {
    try {
      const res = await fetch(`/api/accounting/tax-summary?from=${year}-01-01&to=${year}-12-31`);
      if (!res.ok) throw new Error(t('admin.reports.errorLoadSummary'));
      const data = await res.json();
      setTaxSummary(data);
    } catch (err) {
      console.error('Tax summary error:', err);
    }
  };

  // Generate PDF report
  const handleGeneratePdf = async (reportType: string) => {
    setGeneratingPdf(reportType);
    try {
      const res = await fetch(`/api/accounting/reports/pdf?type=${reportType}&period=${selectedYear}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || t('admin.reports.errorGenerating'));
      }
      const html = await res.text();
      // SECURITY: Use Blob URL instead of document.write to avoid XSS vectors
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const newWindow = window.open(blobUrl, '_blank');
      // Clean up the Blob URL after a delay to allow the window to load
      if (newWindow) {
        newWindow.addEventListener('load', () => URL.revokeObjectURL(blobUrl));
      } else {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.reports.errorGenerating'));
    } finally {
      setGeneratingPdf(null);
    }
  };

  // File a tax report (update status to FILED)
  const handleFileTaxReport = async (reportId: string) => {
    try {
      const res = await fetch('/api/accounting/tax-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'FILED' }),
      });
      if (!res.ok) throw new Error(t('admin.reports.errorFiling'));
      await fetchTaxReports(selectedYear);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.reports.errorUnknown'));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTaxReports(selectedYear),
        fetchTaxSummary(selectedYear),
      ]);
      setLoading(false);
    };
    loadData();
  }, [selectedYear]);

  const theme = sectionThemes.reports;

  // Ribbon actions
  const handleRibbonGenerateReport = useCallback(() => { handleGeneratePdf('income'); }, [handleGeneratePdf]);
  const handleRibbonSchedule = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonComparePeriods = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonExportPdf = useCallback(() => { handleGeneratePdf('income'); }, [handleGeneratePdf]);
  const handleRibbonExportExcel = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
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
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.reports.errorPrefix')} {error}</div>;

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: t('admin.reports.statusDraft'), variant: 'neutral' },
    GENERATED: { label: t('admin.reports.statusGenerated'), variant: 'info' },
    FILED: { label: t('admin.reports.statusFiled'), variant: 'warning' },
    PAID: { label: t('admin.reports.statusPaid'), variant: 'success' },
    // lowercase fallbacks
    draft: { label: t('admin.reports.statusDraft'), variant: 'neutral' },
    generated: { label: t('admin.reports.statusGenerated'), variant: 'info' },
    filed: { label: t('admin.reports.statusFiled'), variant: 'warning' },
    paid: { label: t('admin.reports.statusPaid'), variant: 'success' },
  };

  const taxColumns: Column<TaxReport>[] = [
    {
      key: 'period',
      header: t('admin.reports.reportCol'),
      render: (report) => (
        <div>
          <p className="font-medium text-slate-900">{t('admin.accounting.tax.tpsTvq')} - {report.period}</p>
          <p className="text-xs text-slate-500">{report.region}</p>
        </div>
      ),
    },
    {
      key: 'tpsCollected',
      header: t('admin.reports.tpsCollected'),
      align: 'right',
      render: (report) => <span className="text-slate-900">{formatCurrency(report.tpsCollected)}</span>,
    },
    {
      key: 'tvqCollected',
      header: t('admin.reports.tvqCollected'),
      align: 'right',
      render: (report) => <span className="text-slate-900">{formatCurrency(report.tvqCollected)}</span>,
    },
    {
      key: 'ctirti',
      header: t('admin.reports.ctiRti'),
      align: 'right',
      render: (report) => (
        <span className="text-red-600">-{formatCurrency(report.tpsPaid + report.tvqPaid)}</span>
      ),
    },
    {
      key: 'net',
      header: t('admin.reports.netToPay'),
      align: 'right',
      render: (report) => {
        return <span className="font-bold text-emerald-600">{formatCurrency(report.netTotal)}</span>;
      },
    },
    {
      key: 'dueDate',
      header: t('admin.reports.dueDate'),
      align: 'center',
      render: (report) => (
        <span className="text-sm text-slate-600">{report.dueDate ? formatDate(report.dueDate) : '-'}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.reports.statusCol'),
      align: 'center',
      render: (report) => {
        const cfg = statusConfig[report.status] || { label: report.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: t('admin.reports.actionsCol'),
      align: 'center',
      render: (report) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={() => handleGeneratePdf('tax')}
            disabled={generatingPdf === 'tax'}
          >
            PDF
          </Button>
          {(report.status === 'GENERATED' || report.status === 'generated') && (
            <Button variant="primary" size="sm" onClick={() => handleFileTaxReport(report.id)}>{t('admin.reports.fileBtn')}</Button>
          )}
        </div>
      ),
    },
  ];

  const totalTpsCollected = taxSummary?.tpsCollected ?? taxReports.reduce((s, r) => s + r.tpsCollected, 0);
  const totalTvqCollected = taxSummary?.tvqCollected ?? taxReports.reduce((s, r) => s + r.tvqCollected, 0);
  const totalCtiRti = (taxSummary?.tpsPaid ?? 0) + (taxSummary?.tvqPaid ?? 0);
  const totalNetRemit = (taxSummary?.netTps ?? 0) + (taxSummary?.netTvq ?? 0) + (taxSummary?.netTvh ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.reports.title')}
        subtitle={t('admin.reports.subtitle')}
        theme={theme}
        actions={
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        }
      />

      {/* Tax Reports Section */}
      <SectionCard
        title={t('admin.reports.taxReportsTitle')}
        theme={theme}
        headerAction={
          <Link href="/admin/fiscal" className="text-sm text-violet-600 hover:text-violet-700 inline-flex items-center gap-1">
            {t('admin.reports.fullFiscalModule')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
        noPadding
      >
        {taxReports.length > 0 ? (
          <DataTable
            columns={taxColumns}
            data={taxReports}
            keyExtractor={(r) => r.id}
          />
        ) : (
          <div className="p-8 text-center text-slate-500">
            {t('admin.reports.noTaxReports', { year: selectedYear })}
          </div>
        )}
      </SectionCard>

      {/* Management Reports Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t('admin.reports.managementReports')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {managementReports.map((report) => {
            const Icon = report.icon;
            // Map management report type to API report type
            const reportTypeMap: Record<string, string> = {
              '1': 'income',  // sales analysis -> income statement
              '3': 'income',  // profitability -> income statement
              '4': 'income',  // expense analysis -> income statement
            };
            const apiType = reportTypeMap[report.id];
            return (
              <SectionCard key={report.id} theme={theme} className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 ${theme.surfaceLight} rounded-lg`}>
                    <Icon className={`w-6 h-6 ${theme.statIconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{report.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{report.description}</p>
                    <button
                      className="mt-3 text-sm text-violet-600 hover:text-violet-700 font-medium inline-flex items-center gap-1"
                      onClick={() => {
                        if (apiType) {
                          handleGeneratePdf(apiType);
                        }
                      }}
                      disabled={!!generatingPdf}
                    >
                      {generatingPdf === apiType ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('admin.reports.generating')}
                        </>
                      ) : (
                        <>
                          {t('admin.reports.generateReport')} <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      </div>

      {/* Annual Reports */}
      <SectionCard title={t('admin.reports.annualReports')} theme={theme}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-600">{t('admin.reports.federalDeclaration')}</p>
            <p className="font-bold text-blue-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-blue-600 mt-2">{t('admin.reports.dueDatePrefix')} 30 juin {selectedYear}</p>
            <button className="mt-3 text-sm text-blue-700 hover:underline inline-flex items-center gap-1">{t('admin.reports.prepare')} <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600">{t('admin.reports.quebecDeclaration')}</p>
            <p className="font-bold text-purple-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-purple-600 mt-2">{t('admin.reports.dueDatePrefix')} 30 juin {selectedYear}</p>
            <button className="mt-3 text-sm text-purple-700 hover:underline inline-flex items-center gap-1">{t('admin.reports.prepare')} <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">{t('admin.reports.financialStatementsLabel')}</p>
            <p className="font-bold text-green-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-green-600 mt-2">{t('admin.reports.toReview')}</p>
            <button
              className="mt-3 text-sm text-green-700 hover:underline inline-flex items-center gap-1"
              onClick={() => handleGeneratePdf('income')}
            >
              {t('admin.reports.generate')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
            <p className="text-sm text-sky-600">{t('admin.reports.auditReport')}</p>
            <p className="font-bold text-sky-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-sky-600 mt-2">{t('admin.reports.optional')}</p>
            <button className="mt-3 text-sm text-sky-700 hover:underline inline-flex items-center gap-1">{t('admin.reports.request')} <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </SectionCard>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
        <h3 className="font-semibold text-emerald-100 mb-4">{t('admin.reports.fiscalSummary', { year: selectedYear })}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-emerald-200 text-sm">{t('admin.reports.tpsCollected')}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTpsCollected)}</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">{t('admin.reports.tvqCollected')}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalTvqCollected)}</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">{t('admin.reports.ctiRtiClaimed')}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalCtiRti)}</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">{t('admin.reports.netToRemit')}</p>
            <p className="text-2xl font-bold">{formatCurrency(totalNetRemit)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

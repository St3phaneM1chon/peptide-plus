'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  AlertTriangle,
  Calendar,
  Activity,
  Download,
  Loader2,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import {
  PageHeader,
  Button,
  StatCard,
  EmptyState,
  SectionCard,
} from '@/components/admin';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface AgingBucket {
  label: string;
  count: number;
  total: number;
  percentage: number;
}

interface CustomerAging {
  name: string;
  email?: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
  oldestInvoiceDays: number;
}

interface AgingReport {
  type: 'RECEIVABLE' | 'PAYABLE';
  totalOutstanding: number;
  totalOverdue: number;
  averageDaysOutstanding: number;
  buckets: AgingBucket[];
  byCustomer: CustomerAging[];
}

interface AgingStats {
  currentPercentage: number;
  overduePercentage: number;
  criticalPercentage: number;
  healthScore: number;
  recommendations: string[];
}

export default function AgingPage() {
  const { t, formatCurrency } = useI18n();
  const [reportType, setReportType] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [report, setReport] = useState<AgingReport | null>(null);
  const [stats, setStats] = useState<AgingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchAgingReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/aging?type=${reportType}`);
      const data = await response.json();
      setReport(data.report);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching aging report:', error);
      toast.error(t('common.errorOccurred'));
      setReport(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, t]);

  useEffect(() => {
    fetchAgingReport();
  }, [fetchAgingReport]);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/accounting/aging?type=${reportType}&format=csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aging-${reportType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setExporting(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getBucketColor = (index: number) => {
    const colors = [
      'bg-green-100 text-green-800',
      'bg-blue-100 text-blue-800',
      'bg-yellow-100 text-yellow-800',
      'bg-amber-100 text-amber-800',
      'bg-red-100 text-red-800',
    ];
    return colors[index] || colors[0];
  };

  // Ribbon actions
  const handleRibbonRefresh = useCallback(() => { fetchAgingReport(); }, [fetchAgingReport]);
  const handleRibbonSendReminders = useCallback(async () => {
    if (!report || report.byCustomer.length === 0) {
      toast.warning(t('admin.aging.noOverdueCustomers') || 'Aucun client en retard de paiement');
      return;
    }
    const overdueCustomers = report.byCustomer.filter(c => c.days31to60 > 0 || c.days61to90 > 0 || c.over90 > 0);
    if (overdueCustomers.length === 0) {
      toast.info(t('admin.aging.allCurrent') || 'Tous les comptes sont a jour');
      return;
    }
    const confirmed = window.confirm(
      (t('admin.aging.confirmSendReminders') || `Envoyer des rappels de paiement a ${overdueCustomers.length} client(s) en retard?`).replace('{count}', String(overdueCustomers.length))
    );
    if (!confirmed) return;
    try {
      const response = await fetch('/api/accounting/aging/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          customerIds: overdueCustomers.map(c => c.name),
        }),
      });
      if (response.ok) {
        toast.success(t('admin.aging.remindersSent') || `Rappels envoyes a ${overdueCustomers.length} client(s)`);
      } else {
        toast.error(t('admin.aging.remindersError') || 'Erreur lors de l\'envoi des rappels');
      }
    } catch {
      toast.error(t('admin.aging.remindersError') || 'Erreur lors de l\'envoi des rappels');
    }
  }, [report, reportType, t]);
  const handleRibbonExport = useCallback(() => { exportCSV(); }, [exportCSV]);
  const handleRibbonPrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('refresh', handleRibbonRefresh);
  useRibbonAction('sendReminders', handleRibbonSendReminders);
  useRibbonAction('export', handleRibbonExport);
  useRibbonAction('print', handleRibbonPrint);

  const theme = sectionThemes.accounts;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.aging.title')}
        subtitle={t('admin.aging.subtitle')}
        theme={theme}
        actions={
          <div className="flex items-center gap-3">
            {/* Type Selector */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setReportType('RECEIVABLE')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  reportType === 'RECEIVABLE'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('admin.aging.receivables')}
              </button>
              <button
                onClick={() => setReportType('PAYABLE')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  reportType === 'PAYABLE'
                    ? 'bg-white text-slate-900 shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('admin.aging.payables')}
              </button>
            </div>

            <Button
              variant="primary"
              icon={exporting ? Loader2 : Download}
              loading={exporting}
              onClick={exportCSV}
              disabled={exporting}
              className={`${theme.btnPrimary} border-transparent text-white`}
            >
              {t('admin.aging.exportCSV')}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
          <span className="sr-only">Loading...</span>
        </div>
      ) : report && stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label={t('admin.aging.totalOutstanding')}
              value={formatCurrency(report.totalOutstanding)}
              icon={DollarSign}
              theme={theme}
            />
            <StatCard
              label={t('admin.aging.totalOverdue')}
              value={formatCurrency(report.totalOverdue)}
              icon={AlertTriangle}
              theme={theme}
            />
            <StatCard
              label={t('admin.aging.averageDays')}
              value={`${report.averageDaysOutstanding} ${t('admin.aging.daysUnit')}`}
              icon={Calendar}
              theme={theme}
            />
            <StatCard
              label={t('admin.aging.healthScore')}
              value={`${stats.healthScore}/100`}
              icon={Activity}
              theme={theme}
            />
          </div>

          {/* Health Score Bar (custom, not in StatCard) */}
          <SectionCard theme={theme}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-500">{t('admin.aging.healthScoreLabel')}</span>
              <span className={`text-lg font-bold ${getHealthScoreColor(stats.healthScore)}`}>
                {stats.healthScore}/100
              </span>
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    stats.healthScore >= 80 ? 'bg-green-500' :
                    stats.healthScore >= 60 ? 'bg-yellow-500' :
                    stats.healthScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${stats.healthScore}%` }}
                />
              </div>
            </div>
          </SectionCard>

          {/* Aging Buckets Chart */}
          <SectionCard title={t('admin.aging.distributionByAge')} theme={theme}>
            {/* Visual Bar Chart */}
            <div className="mb-6">
              <div className="flex h-8 rounded-lg overflow-hidden">
                {report.buckets.map((bucket, index) => (
                  bucket.percentage > 0 && (
                    <div
                      key={bucket.label}
                      className={`${getBucketColor(index)} flex items-center justify-center text-xs font-medium`}
                      style={{ width: `${bucket.percentage}%` }}
                      title={`${bucket.label}: ${bucket.percentage.toFixed(1)}%`}
                    >
                      {bucket.percentage >= 10 && `${bucket.percentage.toFixed(0)}%`}
                    </div>
                  )
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                {report.buckets.map((bucket, index) => (
                  <div key={bucket.label} className="flex items-center gap-1">
                    <span className={`w-3 h-3 rounded ${getBucketColor(index)}`} />
                    {bucket.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Bucket Table */}
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="text-start py-3 px-4 text-sm font-medium text-slate-500">{t('admin.aging.periodCol')}</th>
                  <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">{t('admin.aging.invoicesCol')}</th>
                  <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">{t('admin.aging.amountCol')}</th>
                  <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">%</th>
                </tr>
              </thead>
              <tbody>
                {report.buckets.map((bucket, index) => (
                  <tr key={bucket.label} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getBucketColor(index)}`}>
                        {bucket.label}
                      </span>
                    </td>
                    <td className="text-end py-3 px-4 font-medium">{bucket.count}</td>
                    <td className="text-end py-3 px-4 font-medium">
                      {formatCurrency(bucket.total)}
                    </td>
                    <td className="text-end py-3 px-4 text-slate-500">{bucket.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-end py-3 px-4">{report.buckets.reduce((s, b) => s + b.count, 0)}</td>
                  <td className="text-end py-3 px-4">
                    {formatCurrency(report.totalOutstanding)}
                  </td>
                  <td className="text-end py-3 px-4">100%</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </SectionCard>

          {/* By Customer/Supplier */}
          <SectionCard
            title={reportType === 'RECEIVABLE' ? t('admin.aging.byCustomer') : t('admin.aging.bySupplier')}
            theme={theme}
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="text-start py-3 px-4 text-sm font-medium text-slate-500">{t('admin.aging.nameCol')}</th>
                    <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">{t('admin.aging.currentCol')}</th>
                    <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">1-30j</th>
                    <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">31-60j</th>
                    <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">61-90j</th>
                    <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">90j+</th>
                    <th scope="col" className="text-end py-3 px-4 text-sm font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCustomer.slice(0, 15).map((customer) => (
                    <tr key={customer.name} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-900">{customer.name}</p>
                          {customer.email && (
                            <p className="text-xs text-slate-500">{customer.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-end py-3 px-4 text-green-600">
                        {customer.current > 0 ? formatCurrency(customer.current) : '-'}
                      </td>
                      <td className="text-end py-3 px-4 text-blue-600">
                        {customer.days1to30 > 0 ? formatCurrency(customer.days1to30) : '-'}
                      </td>
                      <td className="text-end py-3 px-4 text-yellow-600">
                        {customer.days31to60 > 0 ? formatCurrency(customer.days31to60) : '-'}
                      </td>
                      <td className="text-end py-3 px-4 text-amber-600">
                        {customer.days61to90 > 0 ? formatCurrency(customer.days61to90) : '-'}
                      </td>
                      <td className="text-end py-3 px-4 text-red-600 font-medium">
                        {customer.over90 > 0 ? formatCurrency(customer.over90) : '-'}
                      </td>
                      <td className="text-end py-3 px-4 font-semibold">
                        {formatCurrency(customer.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Recommendations */}
          {stats.recommendations.length > 0 && (
            <SectionCard title={t('admin.aging.recommendations')} theme={theme} className="!bg-amber-50 !border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />
                <ul className="space-y-1">
                  {stats.recommendations.map((rec, i) => (
                    <li key={i} className="text-amber-700 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </SectionCard>
          )}
        </>
      ) : (
        <EmptyState
          icon={DollarSign}
          title={t('admin.aging.noDataTitle')}
          description={t('admin.aging.noDataDescription')}
        />
      )}
    </div>
  );
}

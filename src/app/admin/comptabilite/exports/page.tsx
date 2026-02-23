'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { PageHeader, SectionCard, Button } from '@/components/admin';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface ExportJob {
  id: string;
  type: string;
  format: string;
  dateRange: string;
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  createdAt: Date;
  fileUrl?: string;
  records: number;
}

export default function ExportsPage() {
  const { t, formatDate, locale } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    format: 'quickbooks',
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    includePosted: true,
    includeDraft: false,
  });

  const [history, setHistory] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({
    entries: 0, accounts: 0, customers: 0, suppliers: 0, transactions: 0,
  });

  useEffect(() => {
    loadHistory();
    fetchDataCounts();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/accounting/export');
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();
      setHistory(data.exports || data.history || data.data || []);
    } catch (err) {
      console.error('Error loading export history:', err);
      setError(t('admin.exports.errorLoadHistory'));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataCounts = async () => {
    try {
      const [entriesRes, accountsRes, customersRes, transactionsRes] = await Promise.all([
        fetch('/api/accounting/entries?limit=1').then(r => r.ok ? r.json() : null),
        fetch('/api/accounting/chart-of-accounts').then(r => r.ok ? r.json() : null),
        fetch('/api/accounting/customer-invoices?limit=1').then(r => r.ok ? r.json() : null),
        fetch('/api/accounting/bank-transactions?limit=1').then(r => r.ok ? r.json() : null),
      ]);
      setDataCounts({
        entries: entriesRes?.total ?? entriesRes?.entries?.length ?? 0,
        accounts: accountsRes?.accounts?.length ?? 0,
        customers: customersRes?.total ?? customersRes?.invoices?.length ?? 0,
        suppliers: 0, // No supplier invoices API yet
        transactions: transactionsRes?.total ?? transactionsRes?.transactions?.length ?? 0,
      });
    } catch {
      // Keep default counts of 0
    }
  };

  const exportFormats = [
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      icon: '📊',
      description: t('admin.exports.qboDesc'),
      fileType: 'JSON',
    },
    {
      id: 'sage',
      name: 'Sage 50',
      icon: '📈',
      description: t('admin.exports.sageDesc'),
      fileType: 'CSV',
    },
    {
      id: 'iif',
      name: 'QuickBooks Desktop (IIF)',
      icon: '💾',
      description: t('admin.exports.iifDesc'),
      fileType: 'IIF',
    },
    {
      id: 'excel',
      name: 'Excel',
      icon: '📗',
      description: t('admin.exports.excelDesc'),
      fileType: 'XLSX',
    },
    {
      id: 'csv',
      name: t('admin.exports.csvGenerique'),
      icon: '📄',
      description: t('admin.exports.csvDesc'),
      fileType: 'CSV',
    },
  ];

  const dataTypes = [
    { id: 'entries', name: t('admin.exports.journalEntries'), count: dataCounts.entries },
    { id: 'accounts', name: t('admin.exports.chartOfAccounts'), count: dataCounts.accounts },
    { id: 'customers', name: t('admin.exports.customerInvoices'), count: dataCounts.customers },
    { id: 'suppliers', name: t('admin.exports.supplierInvoices'), count: dataCounts.suppliers },
    { id: 'transactions', name: t('admin.exports.bankTransactions'), count: dataCounts.transactions },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/accounting/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportConfig.format,
          type: 'entries',
          from: exportConfig.dateFrom,
          to: exportConfig.dateTo,
          includePosted: exportConfig.includePosted,
          includeDraft: exportConfig.includeDraft,
        }),
      });
      if (!response.ok) throw new Error(`${t('common.error')} ${response.status}`);
      const data = await response.json();

      // Trigger download if URL returned
      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = `export-${exportConfig.format}-${new Date().toISOString().split('T')[0]}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      await loadHistory();
    } catch (err) {
      console.error('Error exporting:', err);
      toast.error(t('admin.exports.errorExporting'));
    } finally {
      setExporting(false);
    }
  };

  // Ribbon actions
  const handleRibbonGenerateReport = useCallback(() => { handleExport(); }, [handleExport]);
  const handleRibbonSchedule = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonComparePeriods = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonExportPdf = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonExportExcel = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleRibbonPrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('generateReport', handleRibbonGenerateReport);
  useRibbonAction('schedule', handleRibbonSchedule);
  useRibbonAction('comparePeriods', handleRibbonComparePeriods);
  useRibbonAction('exportPdf', handleRibbonExportPdf);
  useRibbonAction('exportExcel', handleRibbonExportExcel);
  useRibbonAction('print', handleRibbonPrint);

  const theme = sectionThemes.reports;

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      </div>
    );
  }

  if (error && history.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadHistory} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg">{t('admin.exports.retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.exports.title')}
        subtitle={t('admin.exports.subtitle')}
        theme={theme}
      />

      {/* Format Selection */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {exportFormats.map(format => (
          <button
            key={format.id}
            onClick={() => {
              setExportConfig(prev => ({ ...prev, format: format.id }));
            }}
            className={`p-4 rounded-xl border transition-all text-start ${
              exportConfig.format === format.id
                ? `${theme.surfaceLight} ${theme.borderLight} ring-2 ring-violet-200`
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="text-2xl mb-2">{format.icon}</div>
            <h3 className="font-medium text-slate-900">{format.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{format.description}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
              .{format.fileType.toLowerCase()}
            </span>
          </button>
        ))}
      </div>

      {/* Export Configuration */}
      <SectionCard title={t('admin.exports.exportConfig')} theme={theme}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data to export */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">{t('admin.exports.dataToExport')}</h3>
            <div className="space-y-2">
              {dataTypes.map(type => (
                <label key={type.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked={type.id === 'entries'}
                      className="rounded border-slate-300 bg-white text-violet-600"
                    />
                    <span className="text-slate-900">{type.name}</span>
                  </div>
                  <span className="text-sm text-slate-500">{type.count} {t('admin.exports.records')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">{t('admin.exports.periodLabel')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('admin.exports.fromLabel')}</label>
                  <input
                    type="date"
                    value={exportConfig.dateFrom}
                    onChange={e => setExportConfig(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t('admin.exports.toLabel')}</label>
                  <input
                    type="date"
                    value={exportConfig.dateTo}
                    onChange={e => setExportConfig(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">{t('admin.exports.options')}</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includePosted}
                    onChange={e => setExportConfig(prev => ({ ...prev, includePosted: e.target.checked }))}
                    className="rounded border-slate-300 bg-white text-violet-600"
                  />
                  <span className="text-slate-700">{t('admin.exports.includePosted')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeDraft}
                    onChange={e => setExportConfig(prev => ({ ...prev, includeDraft: e.target.checked }))}
                    className="rounded border-slate-300 bg-white text-violet-600"
                  />
                  <span className="text-slate-700">{t('admin.exports.includeDrafts')}</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className={`w-full py-3 ${theme.btnPrimary} text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {exporting ? (
                <>
                  <span className="animate-spin">&#8987;</span>
                  {t('admin.exports.exportInProgress')}
                </>
              ) : (
                t('admin.exports.generateExport')
              )}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* API Integration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard theme={theme}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-xl">&#128202;</div>
            <div>
              <h3 className="font-medium text-slate-900">QuickBooks Online</h3>
              <p className="text-xs text-slate-500">{t('admin.exports.realtimeSync')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {t('admin.exports.qboSyncDesc')}
          </p>
          <Button variant="primary" className="w-full bg-green-600 hover:bg-green-700 border-transparent text-white">
            {t('admin.exports.connectQuickBooks')}
          </Button>
        </SectionCard>

        <SectionCard theme={theme}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl">&#128200;</div>
            <div>
              <h3 className="font-medium text-slate-900">Sage 50</h3>
              <p className="text-xs text-slate-500">{t('admin.exports.manualExport')}</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {t('admin.exports.sageExportDesc')}
          </p>
          <Button variant="secondary" className="w-full">
            {t('admin.exports.exportForSage')}
          </Button>
        </SectionCard>
      </div>

      {/* Export History */}
      <SectionCard title={t('admin.exports.exportHistory')} theme={theme} noPadding>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.dateCol')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.typeCol')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.formatCol')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.periodCol')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.recordsCol')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.statusCol')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.exports.actionCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {history.map(job => (
              <tr key={job.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(job.createdAt))}
                </td>
                <td className="px-4 py-3 text-slate-900">{job.type}</td>
                <td className="px-4 py-3 text-slate-600">{job.format}</td>
                <td className="px-4 py-3 text-slate-600">{job.dateRange}</td>
                <td className="px-4 py-3 text-end text-slate-900">{job.records}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    job.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                    job.status === 'PROCESSING' ? 'bg-yellow-50 text-yellow-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {job.status === 'COMPLETED' ? t('admin.exports.statusCompleted') : job.status === 'PROCESSING' ? t('admin.exports.statusProcessing') : t('admin.exports.statusFailed')}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  {job.status === 'COMPLETED' && job.fileUrl && (
                    <a
                      href={job.fileUrl}
                      download
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded inline-block border border-slate-200"
                    >
                      {t('admin.exports.download')}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </SectionCard>
    </div>
  );
}

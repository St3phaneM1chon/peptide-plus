'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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
  const { t } = useI18n();
  const [, setActiveExport] = useState<string | null>(null);
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

      setActiveExport(null);
      await loadHistory();
    } catch (err) {
      console.error('Error exporting:', err);
      toast.error(t('admin.exports.errorExporting'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">{t('admin.exports.loading')}</div>;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.exports.title')}</h1>
          <p className="text-neutral-400 mt-1">{t('admin.exports.subtitle')}</p>
        </div>
      </div>

      {/* Format Selection */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {exportFormats.map(format => (
          <button
            key={format.id}
            onClick={() => {
              setExportConfig(prev => ({ ...prev, format: format.id }));
              setActiveExport(format.id);
            }}
            className={`p-4 rounded-xl border transition-all text-start ${
              exportConfig.format === format.id
                ? 'bg-sky-600/20 border-sky-500'
                : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
            }`}
          >
            <div className="text-2xl mb-2">{format.icon}</div>
            <h3 className="font-medium text-white">{format.name}</h3>
            <p className="text-xs text-neutral-400 mt-1">{format.description}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-neutral-700 rounded text-xs text-neutral-300">
              .{format.fileType.toLowerCase()}
            </span>
          </button>
        ))}
      </div>

      {/* Export Configuration */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <h2 className="text-lg font-medium text-white mb-4">{t('admin.exports.exportConfig')}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data to export */}
          <div>
            <h3 className="text-sm font-medium text-neutral-300 mb-3">{t('admin.exports.dataToExport')}</h3>
            <div className="space-y-2">
              {dataTypes.map(type => (
                <label key={type.id} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg cursor-pointer hover:bg-neutral-700">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked={type.id === 'entries'}
                      className="rounded border-neutral-600 bg-neutral-700 text-sky-500"
                    />
                    <span className="text-white">{type.name}</span>
                  </div>
                  <span className="text-sm text-neutral-400">{type.count} {t('admin.exports.records')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3">{t('admin.exports.periodLabel')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">{t('admin.exports.fromLabel')}</label>
                  <input
                    type="date"
                    value={exportConfig.dateFrom}
                    onChange={e => setExportConfig(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">{t('admin.exports.toLabel')}</label>
                  <input
                    type="date"
                    value={exportConfig.dateTo}
                    onChange={e => setExportConfig(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-neutral-300 mb-3">{t('admin.exports.options')}</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includePosted}
                    onChange={e => setExportConfig(prev => ({ ...prev, includePosted: e.target.checked }))}
                    className="rounded border-neutral-600 bg-neutral-700 text-sky-500"
                  />
                  <span className="text-neutral-300">{t('admin.exports.includePosted')}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeDraft}
                    onChange={e => setExportConfig(prev => ({ ...prev, includeDraft: e.target.checked }))}
                    className="rounded border-neutral-600 bg-neutral-700 text-sky-500"
                  />
                  <span className="text-neutral-300">{t('admin.exports.includeDrafts')}</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {t('admin.exports.exportInProgress')}
                </>
              ) : (
                <>
                  📥 {t('admin.exports.generateExport')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* API Integration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center text-xl">📊</div>
            <div>
              <h3 className="font-medium text-white">QuickBooks Online</h3>
              <p className="text-xs text-neutral-400">{t('admin.exports.realtimeSync')}</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            {t('admin.exports.qboSyncDesc')}
          </p>
          <button className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
            {t('admin.exports.connectQuickBooks')}
          </button>
        </div>

        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center text-xl">📈</div>
            <div>
              <h3 className="font-medium text-white">Sage 50</h3>
              <p className="text-xs text-neutral-400">{t('admin.exports.manualExport')}</p>
            </div>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            {t('admin.exports.sageExportDesc')}
          </p>
          <button className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm">
            {t('admin.exports.exportForSage')}
          </button>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <div className="p-4 border-b border-neutral-700">
          <h2 className="font-medium text-white">{t('admin.exports.exportHistory')}</h2>
        </div>
        <table className="w-full">
          <thead className="bg-neutral-900/50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.dateCol')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.typeCol')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.formatCol')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.periodCol')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.recordsCol')}</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.statusCol')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium text-neutral-400 uppercase">{t('admin.exports.actionCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {history.map(job => (
              <tr key={job.id} className="hover:bg-neutral-700/30">
                <td className="px-4 py-3 text-neutral-300">
                  {new Date(job.createdAt).toLocaleDateString('fr-CA')} {new Date(job.createdAt).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3 text-white">{job.type}</td>
                <td className="px-4 py-3 text-neutral-300">{job.format}</td>
                <td className="px-4 py-3 text-neutral-300">{job.dateRange}</td>
                <td className="px-4 py-3 text-end text-white">{job.records}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    job.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                    job.status === 'PROCESSING' ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-red-900/30 text-red-400'
                  }`}>
                    {job.status === 'COMPLETED' ? t('admin.exports.statusCompleted') : job.status === 'PROCESSING' ? t('admin.exports.statusProcessing') : t('admin.exports.statusFailed')}
                  </span>
                </td>
                <td className="px-4 py-3 text-end">
                  {job.status === 'COMPLETED' && job.fileUrl && (
                    <a
                      href={job.fileUrl}
                      download
                      className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded inline-block"
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
    </div>
  );
}

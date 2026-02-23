'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { PageHeader, SectionCard, Button } from '@/components/admin';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';

interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  userName: string;
  ipAddress?: string;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
}

// actionLabels will be resolved inside component via t()

// entityLabels will be resolved inside component via t()

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  POST: 'bg-sky-100 text-sky-700',
  VOID: 'bg-red-100 text-red-700',
  APPROVE: 'bg-green-100 text-green-700',
  RECONCILE: 'bg-purple-100 text-purple-700',
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
};

export default function AuditTrailPage() {
  const { t, formatDate, locale } = useI18n();

  const actionLabels: Record<string, string> = {
    CREATE: t('admin.audit.actionCreate'),
    UPDATE: t('admin.audit.actionUpdate'),
    DELETE: t('admin.audit.actionDelete'),
    POST: t('admin.audit.actionPost'),
    VOID: t('admin.audit.actionVoid'),
    APPROVE: t('admin.audit.actionApprove'),
    RECONCILE: t('admin.audit.actionReconcile'),
    CLOSE_PERIOD: t('admin.audit.actionClosePeriod'),
    LOGIN: t('admin.audit.actionLogin'),
    LOGOUT: t('admin.audit.actionLogout'),
    EXPORT: t('admin.audit.actionExport'),
  };

  const entityLabels: Record<string, string> = {
    JOURNAL_ENTRY: t('admin.audit.entityEntry'),
    CUSTOMER_INVOICE: t('admin.audit.entityCustomerInvoice'),
    SUPPLIER_INVOICE: t('admin.audit.entitySupplierInvoice'),
    BANK_TRANSACTION: t('admin.audit.entityBankTransaction'),
    CHART_OF_ACCOUNT: t('admin.audit.entityAccount'),
    TAX_REPORT: t('admin.audit.entityTaxReport'),
    SETTINGS: t('admin.audit.entitySettings'),
    USER: t('admin.audit.entityUser'),
  };

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    user: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.action) params.set('type', filters.action);
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);
      if (filters.entityType) params.set('entityType', filters.entityType);

      const queryStr = params.toString();
      const response = await fetch(`/api/accounting/audit-trail${queryStr ? `?${queryStr}` : ''}`);
      if (!response.ok) throw new Error(`${t('common.error')} ${response.status}`);
      const data = await response.json();
      setEntries(data.entries || data.data || []);
    } catch (err) {
      console.error('Error loading audit entries:', err);
      toast.error(t('common.errorOccurred'));
      setError(t('admin.audit.errorLoadAudit'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [filters.action, filters.dateFrom, filters.dateTo, filters.entityType, t]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Refetch when date filters change
  useEffect(() => {
    if (filters.dateFrom || filters.dateTo) {
      loadEntries();
    }
  }, [filters.dateFrom, filters.dateTo, loadEntries]);

  const filteredEntries = entries.filter(entry => {
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.entityType && entry.entityType !== filters.entityType) return false;
    if (filters.user && !entry.userName.toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!entry.entityNumber?.toLowerCase().includes(searchLower) &&
          !entry.userName.toLowerCase().includes(searchLower)) return false;
    }
    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate CSV
    const headers = [t('admin.audit.csvDateHeader'), t('admin.audit.csvActionHeader'), t('admin.audit.csvTypeHeader'), t('admin.audit.csvDocumentHeader'), t('admin.audit.csvUserHeader'), t('admin.audit.csvIPHeader'), t('admin.audit.csvChangesHeader')];
    const rows = filteredEntries.map(e => [
      new Date(e.timestamp).toISOString(),
      actionLabels[e.action] || e.action,
      entityLabels[e.entityType] || e.entityType,
      e.entityNumber || e.entityId,
      e.userName,
      e.ipAddress || '',
      e.changes.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; '),
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    setExporting(false);
  };

  // Stats
  const todayCount = entries.filter(e => 
    new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length;
  const uniqueUsers = new Set(entries.map(e => e.userName)).size;

  const theme = sectionThemes.compliance;

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

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={loadEntries} className={`px-4 py-2 ${theme.btnPrimary} border-transparent text-white rounded-lg`}>{t('admin.audit.retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.audit.title')}
        subtitle={t('admin.audit.subtitle')}
        theme={theme}
        actions={
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={exporting}
            className={`${theme.btnPrimary} border-transparent text-white`}
          >
            {exporting ? t('admin.audit.exporting') : t('admin.audit.exportCSV')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.audit.actionsToday')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{todayCount}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.audit.totalActions')}</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{entries.length}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.audit.activeUsers')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{uniqueUsers}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.audit.afterFilters')}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{filteredEntries.length}</p>
        </SectionCard>
      </div>

      {/* Filters */}
      <SectionCard theme={theme}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('admin.audit.actionLabel')}</label>
            <select
              value={filters.action}
              onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
            >
              <option value="">{t('admin.audit.allActions')}</option>
              {Object.entries(actionLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('admin.audit.entityTypeLabel')}</label>
            <select
              value={filters.entityType}
              onChange={e => setFilters(prev => ({ ...prev, entityType: e.target.value }))}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
            >
              <option value="">{t('admin.audit.allTypes')}</option>
              {Object.entries(entityLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('admin.audit.userLabel')}</label>
            <input
              type="text"
              value={filters.user}
              onChange={e => setFilters(prev => ({ ...prev, user: e.target.value }))}
              placeholder={t('admin.audit.searchPlaceholder')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('admin.audit.searchLabel')}</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder={t('admin.audit.docNumberPlaceholder')}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ action: '', entityType: '', user: '', dateFrom: '', dateTo: '', search: '' })}
              className="px-4 py-2 text-slate-500 hover:text-slate-900 text-sm"
            >
              {t('admin.audit.reset')}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Timeline */}
      <SectionCard title={t('admin.audit.title')} theme={theme} noPadding>
        <div className="divide-y divide-slate-200">
          {filteredEntries.map(entry => (
            <div
              key={entry.id}
              className="p-4 hover:bg-slate-50 cursor-pointer"
              onClick={() => setSelectedEntry(entry)}
            >
              <div className="flex items-start gap-4">
                <div className="text-center min-w-[60px]">
                  <p className="text-xs text-slate-400">
                    {formatDate(entry.timestamp)}
                  </p>
                  <p className="text-sm text-slate-600">
                    {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.timestamp))}
                  </p>
                </div>

                <span className={`px-2 py-1 rounded text-xs font-medium ${actionColors[entry.action] || 'bg-slate-100 text-slate-700'}`}>
                  {actionLabels[entry.action] || entry.action}
                </span>

                <div className="flex-1">
                  <p className="text-slate-900">
                    <span className="text-slate-500">{entityLabels[entry.entityType] || entry.entityType}:</span>{' '}
                    <span className="font-medium">{entry.entityNumber || entry.entityId}</span>
                  </p>
                  {entry.changes.length > 0 && (
                    <p className="text-sm text-slate-500 mt-1">
                      {entry.changes.slice(0, 2).map(c => c.field).join(', ')}
                      {entry.changes.length > 2 && ` +${entry.changes.length - 2} ${t('admin.audit.others')}`}
                    </p>
                  )}
                </div>

                <div className="text-end">
                  <p className="text-sm text-slate-600">{entry.userName}</p>
                  {entry.ipAddress && (
                    <p className="text-xs text-slate-400">{entry.ipAddress}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setSelectedEntry(null); }}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" onKeyDown={(e) => e.key === 'Escape' && setSelectedEntry(null)}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 id="audit-detail-title" className="text-xl font-bold text-slate-900">{t('admin.audit.auditDetails')}</h2>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-500 hover:text-slate-900" aria-label="Fermer">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">{t('admin.audit.dateTimeLabel')}</p>
                  <p className="text-slate-900">{new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(selectedEntry.timestamp))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('admin.audit.actionLabel')}</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${actionColors[selectedEntry.action]}`}>
                    {actionLabels[selectedEntry.action]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('admin.audit.typeLabel')}</p>
                  <p className="text-slate-900">{entityLabels[selectedEntry.entityType]}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('admin.audit.documentLabel')}</p>
                  <p className="text-slate-900 font-mono">{selectedEntry.entityNumber || selectedEntry.entityId}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('admin.audit.userLabel')}</p>
                  <p className="text-slate-900">{selectedEntry.userName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t('admin.audit.ipAddressLabel')}</p>
                  <p className="text-slate-900 font-mono">{selectedEntry.ipAddress || '-'}</p>
                </div>
              </div>

              {selectedEntry.changes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">{t('admin.audit.modificationsLabel')}</p>
                  <div className="bg-slate-50 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-start text-xs text-slate-500">{t('admin.audit.fieldCol')}</th>
                          <th scope="col" className="px-3 py-2 text-start text-xs text-slate-500">{t('admin.audit.oldValueCol')}</th>
                          <th scope="col" className="px-3 py-2 text-start text-xs text-slate-500">{t('admin.audit.newValueCol')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {selectedEntry.changes.map((change, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-900">{change.field}</td>
                            <td className="px-3 py-2 text-red-600 font-mono text-xs">
                              {change.oldValue === null ? <span className="text-slate-400 italic">{t('admin.audit.empty')}</span> : String(change.oldValue)}
                            </td>
                            <td className="px-3 py-2 text-green-600 font-mono text-xs">
                              {String(change.newValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

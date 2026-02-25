'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Download, FileText, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge, type BadgeVariant } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string } | null;
  orderId: string | null;
  customerName: string;
  customerEmail: string | null;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  total: number;
  currency: string;
  reason: string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  issuedAt: string | null;
  issuedBy: string | null;
  voidedAt: string | null;
  journalEntryId: string | null;
  createdAt: string;
}

interface Stats {
  totalCount: number;
  totalAmount: number;
  issuedCount: number;
  issuedAmount: number;
  voidCount: number;
}


export default function NotesCreditPage() {
  const { t, locale, formatCurrency } = useI18n();

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: t('admin.creditNotes.statusDraft'), variant: 'neutral' },
    ISSUED: { label: t('admin.creditNotes.statusIssued'), variant: 'success' },
    VOID: { label: t('admin.creditNotes.statusVoid'), variant: 'error' },
  };

  const statusFilterOptions = [
    { value: 'ISSUED', label: t('admin.creditNotes.statusIssued') },
    { value: 'VOID', label: t('admin.creditNotes.statusVoid') },
    { value: 'DRAFT', label: t('admin.creditNotes.statusDraft') },
  ];

  // Use formatCurrency from useI18n instead of local formatCAD
  const formatCAD = formatCurrency;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCount: 0, totalAmount: 0, issuedCount: 0, issuedAmount: 0, voidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      if (searchTerm) params.set('search', searchTerm);
      const response = await fetch(`/api/accounting/credit-notes?${params.toString()}`);
      if (!response.ok) throw new Error(`${t('admin.creditNotes.errorPrefix')} ${response.status}`);
      const data = await response.json();
      setCreditNotes(data.creditNotes ?? []);
      setStats(data.stats ?? { totalCount: 0, totalAmount: 0, issuedCount: 0, issuedAmount: 0, voidCount: 0 });
    } catch (err) {
      console.error('Error fetching credit notes:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : t('admin.creditNotes.loadError'));
      setCreditNotes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, searchTerm, t]);

  useEffect(() => {
    fetchCreditNotes();
  }, [fetchCreditNotes]);

  const theme = sectionThemes.accounts;

  // -- Ribbon actions --
  const handleNewCreditNote = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: 'Nouveau client', reason: 'Correction', subtotal: 0, currency: 'CAD' }),
      });
      if (!res.ok) throw new Error();
      await fetchCreditNotes();
      toast.success(t('admin.creditNotes.created') || 'Note de credit creee en brouillon');
    } catch {
      toast.error(t('admin.creditNotes.createError') || 'Erreur lors de la creation de la note de credit');
    }
  }, [fetchCreditNotes, t]);
  const handleDeleteAction = useCallback(() => {
    if (!selectedNote) { toast.info(t('admin.creditNotes.selectFirst') || 'Selectionnez une note de credit dans le tableau.'); return; }
    if (selectedNote.status === 'ISSUED') { toast.error(t('admin.creditNotes.cannotDeleteIssued') || 'Impossible de supprimer une note de credit emise. Annulez-la d\'abord.'); return; }
    toast.info(t('admin.creditNotes.deleteConfirm') || `Suppression de ${selectedNote.creditNoteNumber} - fonctionnalite en cours d'integration.`);
  }, [selectedNote, t]);
  const handleApply = useCallback(async () => {
    if (!selectedNote) { toast.info(t('admin.creditNotes.selectToApply') || 'Selectionnez une note de credit a emettre.'); return; }
    try {
      const res = await fetch('/api/accounting/credit-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedNote.id, status: 'ISSUED' }),
      });
      if (!res.ok) throw new Error();
      await fetchCreditNotes();
      setSelectedNote(null);
      toast.success(t('admin.creditNotes.issued') || 'Note de credit emise avec succes');
    } catch {
      toast.error(t('admin.creditNotes.issueError') || 'Erreur lors de l\'emission');
    }
  }, [selectedNote, fetchCreditNotes, t]);
  const handleCancel = useCallback(async () => {
    if (!selectedNote) { toast.info(t('admin.creditNotes.selectToCancel') || 'Selectionnez une note de credit a annuler.'); return; }
    try {
      const res = await fetch('/api/accounting/credit-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedNote.id, status: 'VOID' }),
      });
      if (!res.ok) throw new Error();
      await fetchCreditNotes();
      setSelectedNote(null);
      toast.success(t('admin.creditNotes.voided') || 'Note de credit annulee');
    } catch {
      toast.error(t('admin.creditNotes.voidError') || 'Erreur lors de l\'annulation');
    }
  }, [selectedNote, fetchCreditNotes, t]);
  const handleExportPdf = useCallback(() => {
    if (creditNotes.length === 0) { toast.error(t('admin.creditNotes.noDataToExport') || 'Aucune note de credit a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.creditNotes.colNumber') || 'Numero', t('admin.creditNotes.colCustomer') || 'Client', t('admin.creditNotes.colSubtotal') || 'Sous-total', t('admin.creditNotes.colTPS') || 'TPS', t('admin.creditNotes.colTVQ') || 'TVQ', t('admin.creditNotes.colTotal') || 'Total', t('admin.creditNotes.colStatus') || 'Statut', t('admin.creditNotes.colReason') || 'Raison'];
    const rows = creditNotes.map(cn => [cn.creditNoteNumber, cn.customerName, String(cn.subtotal), String(cn.taxTps), String(cn.taxTvq), String(cn.total), cn.status, cn.reason]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `notes-credit-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.creditNotes.exportSuccess') || `${creditNotes.length} notes de credit exportees`);
  }, [creditNotes, t]);
  const handlePrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('newCreditNote', handleNewCreditNote);
  useRibbonAction('delete', handleDeleteAction);
  useRibbonAction('apply', handleApply);
  useRibbonAction('cancel', handleCancel);
  useRibbonAction('exportPdf', handleExportPdf);
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
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.creditNotes.errorPrefix')} {error}</div>;

  const columns: Column<CreditNote>[] = [
    {
      key: 'creditNoteNumber',
      header: t('admin.creditNotes.number'),
      render: (cn) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedNote(cn); }}
            className="font-mono text-sm text-blue-600 hover:underline"
          >
            {cn.creditNoteNumber}
          </button>
          {cn.invoice && (
            <p className="text-xs text-slate-500">{t('admin.creditNotes.invoice')}: {cn.invoice.invoiceNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('admin.creditNotes.client'),
      render: (cn) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{cn.customerName}</p>
          {cn.customerEmail && <p className="text-xs text-slate-500">{cn.customerEmail}</p>}
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('admin.creditNotes.reason'),
      render: (cn) => (
        <p className="text-sm text-slate-600 truncate max-w-[200px]" title={cn.reason}>
          {cn.reason}
        </p>
      ),
    },
    {
      key: 'date',
      header: t('admin.creditNotes.date'),
      render: (cn) => (
        <span className="text-sm text-slate-500">
          {new Date(cn.issuedAt || cn.createdAt).toLocaleDateString(locale)}
        </span>
      ),
    },
    {
      key: 'total',
      header: t('admin.creditNotes.total'),
      align: 'right',
      render: (cn) => (
        <span className="font-medium text-red-600">-{formatCAD(cn.total)}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.creditNotes.status'),
      align: 'center',
      render: (cn) => {
        const cfg = statusConfig[cn.status];
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: t('admin.creditNotes.actions'),
      align: 'center',
      render: (cn) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedNote(cn)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title={t('admin.creditNotes.view')}
            aria-label={t('admin.creditNotes.view')}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
            title={t('admin.creditNotes.downloadPdf')}
            aria-label={t('admin.creditNotes.downloadPdf')}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const cn = selectedNote;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.creditNotes.title')}
        subtitle={t('admin.creditNotes.subtitle')}
        theme={theme}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin.creditNotes.totalNotes')} value={stats.totalCount} icon={FileText} theme={theme} />
        <StatCard label={t('admin.creditNotes.totalAmount')} value={formatCAD(stats.totalAmount)} icon={DollarSign} theme={theme} />
        <StatCard label={t('admin.creditNotes.inEffect')} value={stats.issuedCount} icon={CheckCircle} theme={theme} />
        <StatCard label={t('admin.creditNotes.voided')} value={stats.voidCount} icon={XCircle} theme={theme} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.creditNotes.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.creditNotes.allStatuses')}
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusFilterOptions}
        />
      </FilterBar>

      {/* Table */}
      <DataTable
        columns={columns}
        data={creditNotes}
        keyExtractor={(cn) => cn.id}
        emptyTitle={t('admin.creditNotes.noNotes')}
        emptyDescription={t('admin.creditNotes.noNotesDesc')}
      />

      {/* Detail Modal */}
      <Modal
        isOpen={!!cn}
        onClose={() => setSelectedNote(null)}
        title={cn?.creditNoteNumber ?? ''}
        subtitle={cn ? `${t('admin.creditNotes.order')}: ${cn.orderId || 'N/A'}` : ''}
        size="xl"
        footer={
          cn && (
            <Button variant="primary" icon={Download}>
              {t('admin.creditNotes.downloadPdf')}
            </Button>
          )
        }
      >
        {cn && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">{t('admin.creditNotes.client')}</h4>
                <p className="font-medium text-slate-900">{cn.customerName}</p>
                {cn.customerEmail && <p className="text-sm text-slate-600">{cn.customerEmail}</p>}
              </div>
              <div className="text-end">
                <div className="mb-2">
                  <StatusBadge variant={statusConfig[cn.status].variant} dot>
                    {statusConfig[cn.status].label}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">
                  {t('admin.creditNotes.issuedOn')}: {cn.issuedAt ? new Date(cn.issuedAt).toLocaleDateString(locale) : 'N/A'}
                </p>
                {cn.invoice && (
                  <p className="text-sm text-blue-600">
                    {t('admin.creditNotes.invoice')}: {cn.invoice.invoiceNumber}
                  </p>
                )}
                {cn.journalEntryId && (
                  <p className="text-sm text-slate-500">
                    {t('admin.creditNotes.linkedJournalEntry')}
                  </p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-800 mb-1">{t('admin.creditNotes.reason')}</h4>
              <p className="text-sm text-amber-700">{cn.reason}</p>
            </div>

            {/* Amounts */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.creditNotes.subtotal')}</span>
                  <span className="text-slate-900">-{formatCurrency(cn.subtotal)}</span>
                </div>
                {cn.taxTps > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('admin.creditNotes.tps')}</span>
                    <span className="text-slate-900">-{formatCurrency(cn.taxTps)}</span>
                  </div>
                )}
                {cn.taxTvq > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('admin.creditNotes.tvq')}</span>
                    <span className="text-slate-900">-{formatCurrency(cn.taxTvq)}</span>
                  </div>
                )}
                {cn.taxTvh > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('admin.creditNotes.tvh')}</span>
                    <span className="text-slate-900">-{formatCurrency(cn.taxTvh)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>{t('admin.creditNotes.total')}</span>
                  <span className="text-red-600">-{formatCurrency(cn.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

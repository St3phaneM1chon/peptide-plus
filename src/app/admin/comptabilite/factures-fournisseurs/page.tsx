'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Check, FileText, DollarSign, Clock, AlertTriangle, Download } from 'lucide-react';
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
  SectionCard,
  type BadgeVariant,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  supplier: {
    name: string;
    email: string;
  };
  date: string;
  dueDate: string;
  items: { description: string; amount: number }[];
  subtotal: number;
  taxes: number;
  total: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'OVERDUE';
  paidAt?: string;
  category: string;
}


export default function FacturesFournisseursPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING: { label: t('admin.supplierInvoices.statusPending'), variant: 'warning' },
    APPROVED: { label: t('admin.supplierInvoices.statusApproved'), variant: 'info' },
    PAID: { label: t('admin.supplierInvoices.statusPaid'), variant: 'success' },
    OVERDUE: { label: t('admin.supplierInvoices.statusOverdue'), variant: 'error' },
  };

  const statusFilterOptions = [
    { value: 'PENDING', label: t('admin.supplierInvoices.statusPending') },
    { value: 'APPROVED', label: t('admin.supplierInvoices.statusApproved') },
    { value: 'PAID', label: t('admin.supplierInvoices.statusPaid') },
    { value: 'OVERDUE', label: t('admin.supplierInvoices.statusOverdue') },
  ];

  // Use formatCurrency from useI18n instead of local formatCAD
  const formatCAD = formatCurrency;

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      const response = await fetch(`/api/accounting/supplier-invoices?${params.toString()}`);
      if (!response.ok) throw new Error(t('admin.supplierInvoices.apiError', { status: response.status }));
      const data = await response.json();
      setInvoices(data.invoices ?? []);
    } catch (err) {
      console.error('Error fetching supplier invoices:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : t('admin.supplierInvoices.fetchError'));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleApprove = async (invoiceId: string) => {
    try {
      const response = await fetch('/api/accounting/supplier-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, status: 'APPROVED' }),
      });
      if (!response.ok) throw new Error(t('admin.supplierInvoices.apiError', { status: response.status }));
      await fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const response = await fetch('/api/accounting/supplier-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, status: 'PAID', paidAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(t('admin.supplierInvoices.apiError', { status: response.status }));
      await fetchInvoices();
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
  };

  const theme = sectionThemes.accounts;

  // -- Ribbon actions --
  const handleEnterInvoice = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/supplier-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier: { name: 'Nouveau fournisseur', email: '' }, items: [], subtotal: 0, taxes: 0, total: 0, category: 'Divers' }),
      });
      if (!res.ok) throw new Error();
      await fetchInvoices();
      toast.success(t('admin.supplierInvoices.created') || 'Facture fournisseur creee en attente');
    } catch {
      toast.error(t('admin.supplierInvoices.createError') || 'Erreur lors de la creation de la facture');
    }
  }, [fetchInvoices, t]);
  const handleDeleteAction = useCallback(() => {
    if (!selectedInvoice) { toast.info(t('admin.supplierInvoices.selectToDelete') || 'Selectionnez une facture fournisseur dans le tableau.'); return; }
    if (selectedInvoice.status === 'PAID') { toast.error(t('admin.supplierInvoices.cannotDeletePaid') || 'Impossible de supprimer une facture deja payee.'); return; }
    toast.info(t('admin.supplierInvoices.deleteConfirm') || `Suppression de ${selectedInvoice.invoiceNumber} - fonctionnalite en cours d'integration.`);
  }, [selectedInvoice, t]);
  const handleApproveAction = useCallback(() => {
    if (selectedInvoice) { handleApprove(selectedInvoice.id); setSelectedInvoice(null); }
  }, [selectedInvoice]);
  const handleMarkPaidAction = useCallback(() => {
    if (selectedInvoice) { handleMarkAsPaid(selectedInvoice.id); setSelectedInvoice(null); }
  }, [selectedInvoice]);
  const handleSchedulePay = useCallback(() => {
    if (!selectedInvoice) { toast.info(t('admin.supplierInvoices.selectToSchedule') || 'Selectionnez une facture pour planifier le paiement.'); return; }
    toast.info(t('admin.supplierInvoices.scheduleInfo') || `Paiement planifie pour ${selectedInvoice.invoiceNumber} - echeance ${new Date(selectedInvoice.dueDate).toLocaleDateString(locale)}`);
  }, [selectedInvoice, locale, t]);
  const handleExport = useCallback(() => {
    if (invoices.length === 0) { toast.error(t('admin.supplierInvoices.noDataToExport') || 'Aucune facture a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.supplierInvoices.colInvoiceNumber') || 'Numero', t('admin.supplierInvoices.colSupplier') || 'Fournisseur', t('admin.supplierInvoices.colCategory') || 'Categorie', t('admin.supplierInvoices.colDate') || 'Date', t('admin.supplierInvoices.colDueDate') || 'Echeance', t('admin.supplierInvoices.colSubtotal') || 'Sous-total', t('admin.supplierInvoices.colTaxes') || 'Taxes', t('admin.supplierInvoices.colTotal') || 'Total', t('admin.supplierInvoices.colStatus') || 'Statut'];
    const rows = invoices.map(inv => [inv.invoiceNumber, inv.supplier.name, inv.category, inv.date, inv.dueDate, String(inv.subtotal), String(inv.taxes), String(inv.total), inv.status]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `factures-fournisseurs-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.supplierInvoices.exportSuccess') || `${invoices.length} factures exportees`);
  }, [invoices, t]);
  const handlePrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('enterInvoice', handleEnterInvoice);
  useRibbonAction('delete', handleDeleteAction);
  useRibbonAction('approve', handleApproveAction);
  useRibbonAction('markPaid', handleMarkPaidAction);
  useRibbonAction('schedulePay', handleSchedulePay);
  useRibbonAction('export', handleExport);
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

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm && !invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !invoice.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const totalPending = invoices.filter(i => i.status === 'PENDING' || i.status === 'APPROVED').reduce((sum, i) => sum + i.total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);

  const columns: Column<SupplierInvoice>[] = [
    {
      key: 'invoiceNumber',
      header: t('admin.supplierInvoices.invoiceNumber'),
      render: (invoice) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); }}
          className="font-mono text-sm text-blue-600 hover:underline"
        >
          {invoice.invoiceNumber}
        </button>
      ),
    },
    {
      key: 'supplier',
      header: t('admin.supplierInvoices.supplier'),
      render: (invoice) => (
        <p className="text-sm font-medium text-slate-900">{invoice.supplier.name}</p>
      ),
    },
    {
      key: 'category',
      header: t('admin.supplierInvoices.category'),
      render: (invoice) => (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700">
          {invoice.category}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('admin.supplierInvoices.date'),
      render: (invoice) => new Date(invoice.date).toLocaleDateString(locale),
    },
    {
      key: 'dueDate',
      header: t('admin.supplierInvoices.dueDate'),
      render: (invoice) => new Date(invoice.dueDate).toLocaleDateString(locale),
    },
    {
      key: 'total',
      header: t('admin.supplierInvoices.total'),
      align: 'right',
      render: (invoice) => (
        <span className="font-medium text-slate-900">{formatCAD(invoice.total)}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.supplierInvoices.status'),
      align: 'center',
      render: (invoice) => {
        const cfg = statusConfig[invoice.status];
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: t('admin.supplierInvoices.actions'),
      align: 'center',
      render: (invoice) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedInvoice(invoice)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title={t('admin.supplierInvoices.view')}
            aria-label={t('admin.supplierInvoices.view')}
          >
            <Eye className="w-4 h-4" />
          </button>
          {(invoice.status === 'PENDING' || invoice.status === 'APPROVED' || invoice.status === 'OVERDUE') && (
            <button
              onClick={() => handleMarkAsPaid(invoice.id)}
              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
              title={t('admin.supplierInvoices.markPaid')}
              aria-label={t('admin.supplierInvoices.markPaid')}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const inv = selectedInvoice;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => { setError(null); fetchInvoices(); }}
            className="text-red-700 underline font-medium hover:text-red-800"
          >
            R&eacute;essayer
          </button>
        </div>
      )}

      <PageHeader
        title={t('admin.supplierInvoices.title')}
        subtitle={t('admin.supplierInvoices.subtitle')}
        theme={theme}
        actions={
          <Button variant="primary" icon={Plus} className={`${theme.btnPrimary} border-transparent text-white`}>
            {t('admin.supplierInvoices.addInvoice')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('admin.supplierInvoices.totalInvoices')} value={invoices.length} icon={FileText} theme={theme} />
        <StatCard label={t('admin.supplierInvoices.toPay')} value={formatCAD(totalPending)} icon={Clock} theme={theme} />
        <StatCard label={t('admin.supplierInvoices.overdue')} value={formatCAD(totalOverdue)} icon={AlertTriangle} theme={theme} />
        <StatCard label={t('admin.supplierInvoices.paidThisMonth')} value={formatCAD(totalPaid)} icon={DollarSign} theme={theme} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.supplierInvoices.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.supplierInvoices.allStatuses')}
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusFilterOptions}
        />
      </FilterBar>

      {/* Invoices Table */}
      <DataTable
        columns={columns}
        data={filteredInvoices}
        keyExtractor={(inv) => inv.id}
        emptyTitle={t('admin.supplierInvoices.noInvoices')}
        emptyDescription={t('admin.supplierInvoices.noInvoicesDesc')}
      />

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!inv}
        onClose={() => setSelectedInvoice(null)}
        title={inv?.invoiceNumber ?? ''}
        subtitle={inv?.supplier.name}
        size="lg"
        footer={
          inv && (
            <>
              {inv.status === 'PENDING' && (
                <Button variant="primary" onClick={() => { handleApprove(inv.id); setSelectedInvoice(null); }} className={`${theme.btnPrimary} border-transparent text-white`}>
                  {t('admin.supplierInvoices.approve')}
                </Button>
              )}
              {(inv.status === 'APPROVED' || inv.status === 'OVERDUE') && (
                <Button variant="primary" onClick={() => { handleMarkAsPaid(inv.id); setSelectedInvoice(null); }} className={`${theme.btnPrimary} border-transparent text-white`}>
                  {t('admin.supplierInvoices.markPaid')}
                </Button>
              )}
              <Button variant="secondary" icon={Download} className="ms-auto">
                {t('admin.supplierInvoices.download')}
              </Button>
            </>
          )
        }
      >
        {inv && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">{t('admin.supplierInvoices.category')}</p>
                <p className="font-medium">{inv.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('admin.supplierInvoices.status')}</p>
                <StatusBadge variant={statusConfig[inv.status].variant} dot>
                  {statusConfig[inv.status].label}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('admin.supplierInvoices.invoiceDate')}</p>
                <p className="font-medium">{new Date(inv.date).toLocaleDateString(locale)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('admin.supplierInvoices.dueDate')}</p>
                <p className="font-medium">{new Date(inv.dueDate).toLocaleDateString(locale)}</p>
              </div>
            </div>

            <SectionCard theme={theme} noPadding>
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500">{t('admin.supplierInvoices.description')}</th>
                    <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">{t('admin.supplierInvoices.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {inv.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-slate-900">{item.description}</td>
                      <td className="px-4 py-3 text-end font-medium text-slate-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </SectionCard>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.supplierInvoices.subtotal')}</span>
                  <span>{formatCurrency(inv.subtotal)}</span>
                </div>
                {inv.taxes > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t('admin.supplierInvoices.taxes')}</span>
                    <span>{formatCurrency(inv.taxes)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>{t('admin.supplierInvoices.total')}</span>
                  <span className="text-emerald-600">{formatCurrency(inv.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

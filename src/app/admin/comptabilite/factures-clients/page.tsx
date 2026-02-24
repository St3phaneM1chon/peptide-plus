'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Eye, Download, Check, FileText, DollarSign,
  Clock, AlertTriangle, Pencil, Trash2, Send, Printer,
  CheckCircle, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge, type BadgeVariant } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { GST_RATE, QST_RATE } from '@/lib/tax-constants';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string | null;
  customerId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  shippingCost: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: string;
  paidAt?: string | null;
  notes?: string | null;
  currency: string;
  createdAt: string;
}


// ---------------------------------------------------------------------------
// Form types for create/edit
// ---------------------------------------------------------------------------

interface LineItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
  applyGst: boolean;
  applyQst: boolean;
}

interface InvoiceForm {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  invoiceDate: string;
  paymentTerms: 'NET15' | 'NET30' | 'NET45' | 'NET60';
  items: LineItemForm[];
  notes: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultDueDate(invoiceDate: string, terms: string): string {
  const date = new Date(invoiceDate);
  const daysMap: Record<string, number> = {
    NET15: 15,
    NET30: 30,
    NET45: 45,
    NET60: 60,
  };
  date.setDate(date.getDate() + (daysMap[terms] || 30));
  return date.toISOString().split('T')[0];
}

function emptyLine(): LineItemForm {
  return { description: '', quantity: 1, unitPrice: 0, applyGst: true, applyQst: true };
}

function emptyForm(): InvoiceForm {
  return {
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    paymentTerms: 'NET30',
    items: [emptyLine()],
    notes: '',
  };
}

function computeLineTotals(items: LineItemForm[]) {
  let subtotal = 0;
  let gstTotal = 0;
  let qstTotal = 0;

  for (const item of items) {
    const lineAmount = item.quantity * item.unitPrice;
    subtotal += lineAmount;
    if (item.applyGst) gstTotal += lineAmount * GST_RATE;
    if (item.applyQst) qstTotal += lineAmount * QST_RATE;
  }

  const total = subtotal + gstTotal + qstTotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(gstTotal * 100) / 100,
    qst: Math.round(qstTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function FacturesClientsPage() {
  const { t, locale, formatCurrency } = useI18n();
  const theme = sectionThemes.accounts;

  // -- Status config --
  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: t('admin.customerInvoices.statusDraft'), variant: 'neutral' },
    SENT: { label: t('admin.customerInvoices.statusSent'), variant: 'info' },
    PAID: { label: t('admin.customerInvoices.statusPaid'), variant: 'success' },
    PARTIAL: { label: t('admin.customerInvoices.statusPartial'), variant: 'warning' },
    OVERDUE: { label: t('admin.customerInvoices.statusOverdue'), variant: 'error' },
    VOID: { label: t('admin.customerInvoices.statusVoid'), variant: 'neutral' },
    CANCELLED: { label: t('admin.customerInvoices.statusCancelled'), variant: 'neutral' },
  };

  const statusFilterOptions = [
    { value: 'DRAFT', label: t('admin.customerInvoices.statusDraft') },
    { value: 'SENT', label: t('admin.customerInvoices.statusSent') },
    { value: 'PAID', label: t('admin.customerInvoices.statusPaid') },
    { value: 'PARTIAL', label: t('admin.customerInvoices.statusPartial') },
    { value: 'OVERDUE', label: t('admin.customerInvoices.statusOverdue') },
    { value: 'VOID', label: t('admin.customerInvoices.statusVoid') },
  ];

  // -- State --
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<InvoiceForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'BANK',
    reference: '',
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      params.set('limit', '200');
      const response = await fetch(`/api/accounting/customer-invoices?${params.toString()}`);
      if (!response.ok) throw new Error(`${t('admin.customerInvoices.errorPrefix')} ${response.status}`);
      const data = await response.json();
      setInvoices(data.invoices ?? []);
    } catch (err) {
      console.error('Error fetching customer invoices:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : t('admin.customerInvoices.loadError'));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // ---------------------------------------------------------------------------
  // Form validation
  // ---------------------------------------------------------------------------

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!form.customerName.trim()) {
      errors.customerName = t('admin.customerInvoices.requiredField');
    }
    if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
      errors.customerEmail = t('admin.customerInvoices.invalidEmail');
    }
    if (!form.items.some(item => item.description.trim())) {
      errors.items = t('admin.customerInvoices.minOneLine');
    }
    // Check each item has description
    form.items.forEach((item, idx) => {
      if (!item.description.trim() && (item.unitPrice > 0 || item.quantity > 1)) {
        errors[`item_${idx}_desc`] = t('admin.customerInvoices.requiredField');
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Create / Edit invoice
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setEditingInvoice(null);
    setForm(emptyForm());
    setFormErrors({});
    setShowCreateModal(true);
  }

  function openEditModal(invoice: Invoice) {
    setEditingInvoice(invoice);
    setForm({
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail || '',
      customerAddress: invoice.customerAddress || '',
      invoiceDate: invoice.invoiceDate.split('T')[0],
      paymentTerms: 'NET30', // Default; we could derive from dueDate
      items: invoice.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        applyGst: Number(invoice.taxTps) > 0,
        applyQst: Number(invoice.taxTvq) > 0,
      })),
      notes: invoice.notes || '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  }

  async function handleSaveInvoice() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const totals = computeLineTotals(form.items);
      const dueDate = getDefaultDueDate(form.invoiceDate, form.paymentTerms);

      const payload = {
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        items: form.items
          .filter(item => item.description.trim())
          .map(item => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: 0,
            applyGst: item.applyGst,
            applyQst: item.applyQst,
          })),
        // S10-03: Taxes are now computed server-side from item-level flags.
        // These values are kept for backward compat but the server ignores them.
        taxTps: totals.gst,
        taxTvq: totals.qst,
        taxTvh: 0,
        dueDate,
      };

      if (editingInvoice) {
        // For editing, we update status and details via PUT
        const response = await fetch('/api/accounting/customer-invoices', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingInvoice.id,
            notes: form.notes.trim() || undefined,
          }),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || t('admin.customerInvoices.updateError'));
        }
        setSuccessMessage(t('admin.customerInvoices.updateSuccess'));
      } else {
        // Create new invoice
        const response = await fetch('/api/accounting/customer-invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || t('admin.customerInvoices.createError'));
        }
        setSuccessMessage(t('admin.customerInvoices.createSuccess'));
      }

      setShowCreateModal(false);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.customerInvoices.createError'));
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------------

  async function handleSendInvoice(invoice: Invoice) {
    try {
      const response = await fetch(`/api/accounting/customer-invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t('admin.customerInvoices.sendError'));
      }
      setSuccessMessage(t('admin.customerInvoices.sendSuccess'));
      setShowDetailModal(false);
      setSelectedInvoice(null);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.customerInvoices.sendError'));
    }
  }


  async function handleRecordPayment() {
    if (!selectedInvoice) return;
    try {
      const response = await fetch('/api/accounting/customer-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedInvoice.id,
          amountPaid: paymentForm.amount,
          paidAt: paymentForm.date,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t('admin.customerInvoices.updateError'));
      }
      setSuccessMessage(t('admin.customerInvoices.paidSuccess'));
      setShowPaymentModal(false);
      setShowDetailModal(false);
      setSelectedInvoice(null);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.customerInvoices.updateError'));
    }
  }

  async function handleVoidInvoice() {
    if (!selectedInvoice) return;
    try {
      const response = await fetch('/api/accounting/customer-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedInvoice.id,
          status: 'VOID',
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t('admin.customerInvoices.updateError'));
      }
      setSuccessMessage(t('admin.customerInvoices.voidSuccess'));
      setShowVoidConfirm(false);
      setShowDetailModal(false);
      setSelectedInvoice(null);
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.customerInvoices.updateError'));
    }
  }

  // ---------------------------------------------------------------------------
  // Line items management
  // ---------------------------------------------------------------------------

  function updateLine(index: number, updates: Partial<LineItemForm>) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, ...updates } : item),
    }));
  }

  function addLine() {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyLine()] }));
  }

  function removeLine(index: number) {
    if (form.items.length <= 1) return;
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  // ---------------------------------------------------------------------------
  // View helpers
  // ---------------------------------------------------------------------------

  function openDetailModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
  }

  function openPaymentModal(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      amount: Number(invoice.balance),
      method: 'BANK',
      reference: '',
    });
    setShowPaymentModal(true);
  }

  function handleDownloadPdf(invoiceId: string) {
    window.open(`/api/accounting/customer-invoices/${invoiceId}/pdf`, '_blank');
  }

  // ---------------------------------------------------------------------------
  // Computed / filtered data
  // ---------------------------------------------------------------------------

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (
        !invoice.invoiceNumber.toLowerCase().includes(term) &&
        !invoice.customerName.toLowerCase().includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + Number(i.total), 0);
  const totalPending = invoices.filter(i => i.status === 'SENT' || i.status === 'PARTIAL').reduce((sum, i) => sum + Number(i.balance), 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + Number(i.balance), 0);
  const totalDraft = invoices.filter(i => i.status === 'DRAFT').length;

  // Compute line totals for the form
  const formTotals = computeLineTotals(form.items);

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: t('admin.customerInvoices.invoiceNumber'),
      sortable: true,
      render: (invoice) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); openDetailModal(invoice); }}
            className="font-mono text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
          >
            {invoice.invoiceNumber}
          </button>
          {invoice.orderId && (
            <p className="text-xs text-slate-500">{t('admin.customerInvoices.order')}: {invoice.orderId}</p>
          )}
        </div>
      ),
    },
    {
      key: 'customerName',
      header: t('admin.customerInvoices.client'),
      sortable: true,
      render: (invoice) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{invoice.customerName}</p>
          {invoice.customerEmail && (
            <p className="text-xs text-slate-500">{invoice.customerEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: 'invoiceDate',
      header: t('admin.customerInvoices.date'),
      sortable: true,
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {new Date(invoice.invoiceDate).toLocaleDateString(locale)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: t('admin.customerInvoices.dueDate'),
      sortable: true,
      render: (invoice) => {
        const isOverdue = invoice.status !== 'PAID' && invoice.status !== 'VOID' && new Date(invoice.dueDate) < new Date();
        return (
          <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
            {new Date(invoice.dueDate).toLocaleDateString(locale)}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: t('admin.customerInvoices.total'),
      align: 'right',
      sortable: true,
      render: (invoice) => (
        <span className="font-medium text-slate-900">{formatCurrency(Number(invoice.total))}</span>
      ),
    },
    {
      key: 'balance',
      header: t('admin.customerInvoices.balance'),
      align: 'right',
      render: (invoice) => (
        <span className={`text-sm ${Number(invoice.balance) > 0 ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
          {formatCurrency(Number(invoice.balance))}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('admin.customerInvoices.status'),
      align: 'center',
      render: (invoice) => {
        const cfg = statusConfig[invoice.status] || statusConfig.DRAFT;
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: t('admin.customerInvoices.actions'),
      align: 'center',
      render: (invoice) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openDetailModal(invoice)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
            title={t('admin.customerInvoices.view')}
            aria-label={t('admin.customerInvoices.view')}
          >
            <Eye className="w-4 h-4" />
          </button>
          {invoice.status === 'DRAFT' && (
            <button
              onClick={() => openEditModal(invoice)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
              title={t('admin.customerInvoices.edit')}
              aria-label={t('admin.customerInvoices.edit')}
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDownloadPdf(invoice.id)}
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
            title={t('admin.customerInvoices.downloadPdf')}
            aria-label={t('admin.customerInvoices.downloadPdf')}
          >
            <Download className="w-4 h-4" />
          </button>
          {(invoice.status === 'SENT' || invoice.status === 'OVERDUE' || invoice.status === 'PARTIAL') && (
            <button
              onClick={() => openPaymentModal(invoice)}
              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
              title={t('admin.customerInvoices.recordPayment')}
              aria-label={t('admin.customerInvoices.recordPayment')}
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          {invoice.status === 'DRAFT' && (
            <button
              onClick={() => handleSendInvoice(invoice)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title={t('admin.customerInvoices.sendInvoice')}
              aria-label={t('admin.customerInvoices.sendInvoice')}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  // -- Ribbon actions --
  const handleNewInvoice = useCallback(() => { openCreateModal(); }, []);
  const handleDeleteAction = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleSendByEmail = useCallback(() => {
    if (selectedInvoice) handleSendInvoice(selectedInvoice);
  }, [selectedInvoice]);
  const handleMarkPaid = useCallback(() => {
    if (selectedInvoice) openPaymentModal(selectedInvoice);
  }, [selectedInvoice]);
  const handleCreditNote = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleExportPdf = useCallback(() => {
    if (selectedInvoice) handleDownloadPdf(selectedInvoice.id);
  }, [selectedInvoice]);
  const handlePrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('newInvoice', handleNewInvoice);
  useRibbonAction('delete', handleDeleteAction);
  useRibbonAction('sendByEmail', handleSendByEmail);
  useRibbonAction('markPaid', handleMarkPaid);
  useRibbonAction('creditNote', handleCreditNote);
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const inv = selectedInvoice;

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => { setError(null); fetchInvoices(); }}
            className="text-red-700 underline font-medium hover:text-red-800"
          >
            {t('admin.customerInvoices.cancel')}
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title={t('admin.customerInvoices.title')}
        subtitle={t('admin.customerInvoices.subtitle')}
        theme={theme}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            className={`${theme.btnPrimary} border-transparent text-white`}
            onClick={openCreateModal}
          >
            {t('admin.customerInvoices.newInvoice')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.customerInvoices.totalInvoices')}
          value={`${invoices.length} (${totalDraft} ${t('admin.customerInvoices.draft')})`}
          icon={FileText}
          theme={theme}
        />
        <StatCard label={t('admin.customerInvoices.paid')} value={formatCurrency(totalPaid)} icon={DollarSign} theme={theme} />
        <StatCard label={t('admin.customerInvoices.pending')} value={formatCurrency(totalPending)} icon={Clock} theme={theme} />
        <StatCard label={t('admin.customerInvoices.overdue')} value={formatCurrency(totalOverdue)} icon={AlertTriangle} theme={theme} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.customerInvoices.searchPlaceholder')}
        actions={
          <Button variant="secondary">
            {t('admin.customerInvoices.export')}
          </Button>
        }
      >
        <SelectFilter
          label={t('admin.customerInvoices.allStatuses')}
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
        emptyTitle={t('admin.customerInvoices.noInvoices')}
        emptyDescription={t('admin.customerInvoices.noInvoicesDesc')}
        onRowClick={openDetailModal}
      />

      {/* ================================================================= */}
      {/* CREATE / EDIT INVOICE MODAL                                       */}
      {/* ================================================================= */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingInvoice ? t('admin.customerInvoices.editInvoice') : t('admin.customerInvoices.newInvoice')}
        subtitle={editingInvoice ? editingInvoice.invoiceNumber : t('admin.customerInvoices.invoiceNumberAuto')}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t('admin.customerInvoices.cancel')}
            </Button>
            <Button
              variant="primary"
              icon={editingInvoice ? Check : Plus}
              className={`${theme.btnPrimary} border-transparent text-white`}
              onClick={handleSaveInvoice}
              loading={saving}
            >
              {saving
                ? t('admin.customerInvoices.saving')
                : editingInvoice
                  ? t('admin.customerInvoices.saveInvoice')
                  : t('admin.customerInvoices.createInvoice')
              }
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t('admin.customerInvoices.customerName')}
              required
              error={formErrors.customerName}
            >
              <Input
                value={form.customerName}
                onChange={(e) => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                error={!!formErrors.customerName}
                placeholder="BioCycle Peptides Inc."
              />
            </FormField>
            <FormField
              label={t('admin.customerInvoices.customerEmail')}
              error={formErrors.customerEmail}
            >
              <Input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                error={!!formErrors.customerEmail}
                placeholder="client@example.com"
              />
            </FormField>
          </div>

          <FormField label={t('admin.customerInvoices.customerAddress')}>
            <Input
              value={form.customerAddress}
              onChange={(e) => setForm(prev => ({ ...prev, customerAddress: e.target.value }))}
              placeholder="123 Main St, Montreal, QC H2X 1A1"
            />
          </FormField>

          {/* Dates & Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label={t('admin.customerInvoices.invoiceDate')}>
              <Input
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
              />
            </FormField>
            <FormField label={t('admin.customerInvoices.paymentTerms')}>
              <select
                value={form.paymentTerms}
                onChange={(e) => setForm(prev => ({ ...prev, paymentTerms: e.target.value as InvoiceForm['paymentTerms'] }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="NET15">{t('admin.customerInvoices.net15')}</option>
                <option value="NET30">{t('admin.customerInvoices.net30')}</option>
                <option value="NET45">{t('admin.customerInvoices.net45')}</option>
                <option value="NET60">{t('admin.customerInvoices.net60')}</option>
              </select>
            </FormField>
            <FormField label={t('admin.customerInvoices.dueDate')}>
              <Input
                type="date"
                value={getDefaultDueDate(form.invoiceDate, form.paymentTerms)}
                readOnly
                className="bg-slate-50"
              />
            </FormField>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-700">{t('admin.customerInvoices.description')}</h4>
              {formErrors.items && (
                <p className="text-sm text-red-600">{formErrors.items}</p>
              )}
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-start text-xs font-semibold text-slate-500 w-[40%]">
                      {t('admin.customerInvoices.description')}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-16">
                      {t('admin.customerInvoices.qty')}
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-slate-500 w-28">
                      {t('admin.customerInvoices.unitPrice')}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-14">
                      {t('admin.customerInvoices.applyGst')}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-14">
                      {t('admin.customerInvoices.applyQst')}
                    </th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-slate-500 w-28">
                      {t('admin.customerInvoices.lineTotal')}
                    </th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unitPrice;
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1.5">
                          <input
                            className={`w-full h-8 px-2 rounded border text-sm ${formErrors[`item_${idx}_desc`] ? 'border-red-300' : 'border-slate-200'} focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                            value={item.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                            placeholder={t('admin.customerInvoices.description')}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={1}
                            className="w-full h-8 px-2 rounded border border-slate-200 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={item.quantity}
                            onChange={(e) => updateLine(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-full h-8 px-2 rounded border border-slate-200 text-sm text-end focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={item.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.applyGst}
                            onChange={(e) => updateLine(idx, { applyGst: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={item.applyQst}
                            onChange={(e) => updateLine(idx, { applyQst: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-end text-sm font-medium text-slate-900">
                          {formatCurrency(lineTotal)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {form.items.length > 1 && (
                            <button
                              onClick={() => removeLine(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded"
                              title={t('admin.customerInvoices.removeLine')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              onClick={addLine}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              {t('admin.customerInvoices.addLine')}
            </button>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t('admin.customerInvoices.subtotal')}</span>
                <span className="text-slate-900 font-medium">{formatCurrency(formTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t('admin.customerInvoices.tps')}</span>
                <span className="text-slate-900">{formatCurrency(formTotals.gst)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t('admin.customerInvoices.tvq')}</span>
                <span className="text-slate-900">{formatCurrency(formTotals.qst)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-slate-300 pt-2">
                <span>{t('admin.customerInvoices.total')}</span>
                <span className="text-indigo-600">{formatCurrency(formTotals.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <FormField label={t('admin.customerInvoices.notes')}>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('admin.customerInvoices.notesPlaceholder')}
              rows={3}
            />
          </FormField>
        </div>
      </Modal>

      {/* ================================================================= */}
      {/* INVOICE DETAIL MODAL                                              */}
      {/* ================================================================= */}
      <Modal
        isOpen={showDetailModal && !!inv}
        onClose={() => { setShowDetailModal(false); setSelectedInvoice(null); }}
        title={inv?.invoiceNumber ?? ''}
        subtitle={t('admin.customerInvoices.invoiceDetail')}
        size="xl"
        footer={
          inv && (
            <div className="flex items-center gap-2 w-full flex-wrap">
              <Button
                variant="secondary"
                icon={Download}
                onClick={() => handleDownloadPdf(inv.id)}
              >
                {t('admin.customerInvoices.downloadPdf')}
              </Button>
              <Button
                variant="secondary"
                icon={Printer}
                onClick={() => {
                  const w = window.open(`/api/accounting/customer-invoices/${inv.id}/pdf`, '_blank');
                  if (w) setTimeout(() => w.print(), 1000);
                }}
              >
                {t('admin.customerInvoices.printInvoice')}
              </Button>

              {inv.status === 'DRAFT' && (
                <>
                  <Button
                    variant="secondary"
                    icon={Pencil}
                    onClick={() => { setShowDetailModal(false); openEditModal(inv); }}
                  >
                    {t('admin.customerInvoices.edit')}
                  </Button>
                  <Button
                    variant="primary"
                    icon={Send}
                    className={`${theme.btnPrimary} border-transparent text-white ms-auto`}
                    onClick={() => handleSendInvoice(inv)}
                  >
                    {t('admin.customerInvoices.sendInvoice')}
                  </Button>
                </>
              )}

              {(inv.status === 'SENT' || inv.status === 'OVERDUE' || inv.status === 'PARTIAL') && (
                <Button
                  variant="primary"
                  icon={DollarSign}
                  className={`${theme.btnPrimary} border-transparent text-white ms-auto`}
                  onClick={() => openPaymentModal(inv)}
                >
                  {t('admin.customerInvoices.recordPayment')}
                </Button>
              )}

              {inv.status !== 'VOID' && inv.status !== 'PAID' && (
                <Button
                  variant="danger"
                  icon={XCircle}
                  onClick={() => setShowVoidConfirm(true)}
                >
                  {t('admin.customerInvoices.voidInvoice')}
                </Button>
              )}
              {inv.status === 'PAID' && (
                <Button
                  variant="danger"
                  icon={XCircle}
                  className="ms-auto"
                  onClick={() => setShowVoidConfirm(true)}
                >
                  {t('admin.customerInvoices.voidInvoice')}
                </Button>
              )}
            </div>
          )
        }
      >
        {inv && (
          <div className="space-y-6">
            {/* Header row */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">{t('admin.customerInvoices.billTo')}</h4>
                <p className="font-medium text-slate-900">{inv.customerName}</p>
                {inv.customerEmail && <p className="text-sm text-slate-600">{inv.customerEmail}</p>}
                {inv.customerAddress && <p className="text-sm text-slate-600">{inv.customerAddress}</p>}
              </div>
              <div className="text-end">
                <div className="mb-2">
                  <StatusBadge variant={(statusConfig[inv.status] || statusConfig.DRAFT).variant} dot>
                    {(statusConfig[inv.status] || statusConfig.DRAFT).label}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">
                  {t('admin.customerInvoices.date')}: {new Date(inv.invoiceDate).toLocaleDateString(locale)}
                </p>
                <p className="text-sm text-slate-500">
                  {t('admin.customerInvoices.dueDate')}: {new Date(inv.dueDate).toLocaleDateString(locale)}
                </p>
                {inv.paidAt && (
                  <p className="text-sm text-green-600">
                    {t('admin.customerInvoices.paidOn')}: {new Date(inv.paidAt).toLocaleDateString(locale)}
                  </p>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="overflow-x-auto">
            <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500">
                    {t('admin.customerInvoices.description')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-center text-xs font-semibold text-slate-500">
                    {t('admin.customerInvoices.qty')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">
                    {t('admin.customerInvoices.unitPrice')}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">
                    {t('admin.customerInvoices.total')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inv.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-end text-slate-600">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="px-4 py-3 text-end font-medium text-slate-900">{formatCurrency(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.customerInvoices.subtotal')}</span>
                  <span className="text-slate-900">{formatCurrency(Number(inv.subtotal))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.customerInvoices.tps')}</span>
                  <span className="text-slate-900">{formatCurrency(Number(inv.taxTps))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.customerInvoices.tvq')}</span>
                  <span className="text-slate-900">{formatCurrency(Number(inv.taxTvq))}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>{t('admin.customerInvoices.total')}</span>
                  <span className="text-indigo-600">{formatCurrency(Number(inv.total))}</span>
                </div>
                {Number(inv.amountPaid) > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>{t('admin.customerInvoices.amountPaid')}</span>
                      <span>-{formatCurrency(Number(inv.amountPaid))}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                      <span>{t('admin.customerInvoices.balance')}</span>
                      <span className={Number(inv.balance) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatCurrency(Number(inv.balance))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            {inv.notes && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-sm font-medium text-slate-500 mb-1">{t('admin.customerInvoices.notes')}</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{inv.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* RECORD PAYMENT MODAL                                              */}
      {/* ================================================================= */}
      <Modal
        isOpen={showPaymentModal && !!selectedInvoice}
        onClose={() => setShowPaymentModal(false)}
        title={t('admin.customerInvoices.recordPayment')}
        subtitle={selectedInvoice?.invoiceNumber}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
              {t('admin.customerInvoices.cancel')}
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle}
              className={`${theme.btnPrimary} border-transparent text-white`}
              onClick={handleRecordPayment}
            >
              {t('admin.customerInvoices.recordPayment')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedInvoice && (
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex justify-between text-sm">
                <span className="text-indigo-700 font-medium">{t('admin.customerInvoices.total')}</span>
                <span className="text-indigo-900 font-bold">{formatCurrency(Number(selectedInvoice.total))}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-indigo-700">{t('admin.customerInvoices.balance')}</span>
                <span className="text-indigo-900 font-medium">{formatCurrency(Number(selectedInvoice.balance))}</span>
              </div>
            </div>
          )}

          <FormField label={t('admin.customerInvoices.paymentDate')} required>
            <Input
              type="date"
              value={paymentForm.date}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
            />
          </FormField>

          <FormField label={t('admin.customerInvoices.paymentAmount')} required>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
            />
          </FormField>

          <FormField label={t('admin.customerInvoices.paymentMethod')}>
            <select
              value={paymentForm.method}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="BANK">{t('admin.customerInvoices.methodBank')}</option>
              <option value="CARD">{t('admin.customerInvoices.methodCard')}</option>
              <option value="CASH">{t('admin.customerInvoices.methodCash')}</option>
              <option value="CHECK">{t('admin.customerInvoices.methodCheck')}</option>
              <option value="OTHER">{t('admin.customerInvoices.methodOther')}</option>
            </select>
          </FormField>

          <FormField label={t('admin.customerInvoices.paymentReference')}>
            <Input
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
              placeholder="REF-001"
            />
          </FormField>
        </div>
      </Modal>

      {/* ================================================================= */}
      {/* VOID CONFIRMATION MODAL                                           */}
      {/* ================================================================= */}
      <Modal
        isOpen={showVoidConfirm}
        onClose={() => setShowVoidConfirm(false)}
        title={t('admin.customerInvoices.voidInvoice')}
        subtitle={selectedInvoice?.invoiceNumber}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowVoidConfirm(false)}>
              {t('admin.customerInvoices.cancel')}
            </Button>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={handleVoidInvoice}
            >
              {t('admin.customerInvoices.confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">{t('admin.customerInvoices.confirmVoid')}</p>
              <p className="text-sm text-red-600 mt-1">{t('admin.customerInvoices.confirmVoidDesc')}</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

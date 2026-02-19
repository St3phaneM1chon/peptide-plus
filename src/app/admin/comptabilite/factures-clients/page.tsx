'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Download, Check, Mail, FileText, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { useI18n } from '@/i18n/client';

interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  date: string;
  dueDate: string;
  customer: {
    name: string;
    email: string;
    address: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: string;
  paymentMethod?: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export default function FacturesClientsPage() {
  const { t, locale } = useI18n();

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: t('admin.customerInvoices.statusDraft'), variant: 'neutral' },
    SENT: { label: t('admin.customerInvoices.statusSent'), variant: 'info' },
    PAID: { label: t('admin.customerInvoices.statusPaid'), variant: 'success' },
    OVERDUE: { label: t('admin.customerInvoices.statusOverdue'), variant: 'error' },
    CANCELLED: { label: t('admin.customerInvoices.statusCancelled'), variant: 'neutral' },
  };

  const statusFilterOptions = [
    { value: 'DRAFT', label: t('admin.customerInvoices.statusDraft') },
    { value: 'SENT', label: t('admin.customerInvoices.statusSent') },
    { value: 'PAID', label: t('admin.customerInvoices.statusPaid') },
    { value: 'OVERDUE', label: t('admin.customerInvoices.statusOverdue') },
  ];

  const formatCAD = (amount: number) =>
    amount.toLocaleString(locale, { style: 'currency', currency: 'CAD' });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      const response = await fetch(`/api/accounting/customer-invoices?${params.toString()}`);
      if (!response.ok) throw new Error(`${t('admin.customerInvoices.errorPrefix')} ${response.status}`);
      const data = await response.json();
      setInvoices(data.invoices ?? []);
    } catch (err) {
      console.error('Error fetching customer invoices:', err);
      setError(err instanceof Error ? err.message : t('admin.customerInvoices.loadError'));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const response = await fetch('/api/accounting/customer-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, status: 'PAID', paidAt: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`${t('admin.customerInvoices.errorPrefix')} ${response.status}`);
      await fetchInvoices();
    } catch (err) {
      console.error('Error updating invoice:', err);
    }
  };

  if (loading) return <div className="p-8 text-center">{t('admin.customerInvoices.loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.customerInvoices.errorPrefix')} {error}</div>;

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm && !invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !invoice.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'SENT').reduce((sum, i) => sum + i.total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: t('admin.customerInvoices.invoiceNumber'),
      render: (invoice) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); }}
            className="font-mono text-sm text-blue-600 hover:underline"
          >
            {invoice.invoiceNumber}
          </button>
          <p className="text-xs text-slate-500">{t('admin.customerInvoices.order')}: {invoice.orderId}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: t('admin.customerInvoices.client'),
      render: (invoice) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{invoice.customer.name}</p>
          <p className="text-xs text-slate-500">{invoice.customer.email}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: t('admin.customerInvoices.date'),
      render: (invoice) => new Date(invoice.date).toLocaleDateString(locale),
    },
    {
      key: 'dueDate',
      header: t('admin.customerInvoices.dueDate'),
      render: (invoice) => new Date(invoice.dueDate).toLocaleDateString(locale),
    },
    {
      key: 'total',
      header: t('admin.customerInvoices.total'),
      align: 'right',
      render: (invoice) => (
        <span className="font-medium text-slate-900">{formatCAD(invoice.total)}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.customerInvoices.status'),
      align: 'center',
      render: (invoice) => {
        const cfg = statusConfig[invoice.status];
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
            onClick={() => setSelectedInvoice(invoice)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title={t('admin.customerInvoices.view')}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
            title={t('admin.customerInvoices.downloadPdf')}
          >
            <Download className="w-4 h-4" />
          </button>
          {invoice.status === 'SENT' && (
            <button
              onClick={() => handleMarkAsPaid(invoice.id)}
              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
              title={t('admin.customerInvoices.markPaid')}
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
      <PageHeader
        title={t('admin.customerInvoices.title')}
        subtitle={t('admin.customerInvoices.subtitle')}
        actions={
          <Button variant="primary" icon={Plus}>
            {t('admin.customerInvoices.newInvoice')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={t('admin.customerInvoices.totalInvoices')} value={invoices.length} icon={FileText} />
        <StatCard label={t('admin.customerInvoices.paid')} value={formatCAD(totalPaid)} icon={DollarSign} className="!bg-green-50 !border-green-200" />
        <StatCard label={t('admin.customerInvoices.pending')} value={formatCAD(totalPending)} icon={Clock} className="!bg-blue-50 !border-blue-200" />
        <StatCard label={t('admin.customerInvoices.overdue')} value={formatCAD(totalOverdue)} icon={AlertTriangle} className="!bg-red-50 !border-red-200" />
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
      />

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!inv}
        onClose={() => setSelectedInvoice(null)}
        title={inv?.invoiceNumber ?? ''}
        subtitle={inv ? `${t('admin.customerInvoices.order')}: ${inv.orderId}` : ''}
        size="xl"
        footer={
          inv && (
            <>
              <Button variant="primary" icon={Download}>
                {t('admin.customerInvoices.downloadPdf')}
              </Button>
              <Button variant="secondary" icon={Mail}>
                {t('admin.customerInvoices.sendByEmail')}
              </Button>
              {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                <Button variant="secondary" className="ms-auto" onClick={() => { handleMarkAsPaid(inv.id); setSelectedInvoice(null); }}>
                  {t('admin.customerInvoices.markAsPaid')}
                </Button>
              )}
            </>
          )
        }
      >
        {inv && (
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">{t('admin.customerInvoices.billTo')}</h4>
                <p className="font-medium text-slate-900">{inv.customer.name}</p>
                <p className="text-sm text-slate-600">{inv.customer.email}</p>
                <p className="text-sm text-slate-600">{inv.customer.address}</p>
              </div>
              <div className="text-end">
                <div className="mb-2">
                  <StatusBadge variant={statusConfig[inv.status].variant} dot>
                    {statusConfig[inv.status].label}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">{t('admin.customerInvoices.date')}: {new Date(inv.date).toLocaleDateString(locale)}</p>
                <p className="text-sm text-slate-500">{t('admin.customerInvoices.dueDate')}: {new Date(inv.dueDate).toLocaleDateString(locale)}</p>
                {inv.paidAt && (
                  <p className="text-sm text-green-600">{t('admin.customerInvoices.paidOn')}: {new Date(inv.paidAt).toLocaleDateString(locale)}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-start text-xs font-semibold text-slate-500">{t('admin.customerInvoices.description')}</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500">{t('admin.customerInvoices.qty')}</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold text-slate-500">{t('admin.customerInvoices.unitPrice')}</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold text-slate-500">{t('admin.customerInvoices.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inv.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-end text-slate-600">{item.unitPrice.toFixed(2)} $</td>
                    <td className="px-4 py-3 text-end font-medium text-slate-900">{item.total.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.customerInvoices.subtotal')}</span>
                  <span className="text-slate-900">{inv.subtotal.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.customerInvoices.tps')}</span>
                  <span className="text-slate-900">{inv.tps.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{t('admin.customerInvoices.tvq')}</span>
                  <span className="text-slate-900">{inv.tvq.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>{t('admin.customerInvoices.total')}</span>
                  <span className="text-emerald-600">{inv.total.toFixed(2)} $</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

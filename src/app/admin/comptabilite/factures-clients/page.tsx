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

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Brouillon', variant: 'neutral' },
  SENT: { label: 'Envoyee', variant: 'info' },
  PAID: { label: 'Payee', variant: 'success' },
  OVERDUE: { label: 'En retard', variant: 'error' },
  CANCELLED: { label: 'Annulee', variant: 'neutral' },
};

const statusFilterOptions = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'SENT', label: 'Envoyee' },
  { value: 'PAID', label: 'Payee' },
  { value: 'OVERDUE', label: 'En retard' },
];

const formatCAD = (amount: number) =>
  amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

export default function FacturesClientsPage() {
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
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setInvoices(data.invoices ?? []);
    } catch (err) {
      console.error('Error fetching customer invoices:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des factures');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

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
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      await fetchInvoices();
    } catch (err) {
      console.error('Error updating invoice:', err);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

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
      header: 'N\u00b0 Facture',
      render: (invoice) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); }}
            className="font-mono text-sm text-blue-600 hover:underline"
          >
            {invoice.invoiceNumber}
          </button>
          <p className="text-xs text-slate-500">Commande: {invoice.orderId}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Client',
      render: (invoice) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{invoice.customer.name}</p>
          <p className="text-xs text-slate-500">{invoice.customer.email}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (invoice) => new Date(invoice.date).toLocaleDateString('fr-CA'),
    },
    {
      key: 'dueDate',
      header: 'Echeance',
      render: (invoice) => new Date(invoice.dueDate).toLocaleDateString('fr-CA'),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (invoice) => (
        <span className="font-medium text-slate-900">{formatCAD(invoice.total)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (invoice) => {
        const cfg = statusConfig[invoice.status];
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (invoice) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedInvoice(invoice)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Voir"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
            title="Telecharger PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          {invoice.status === 'SENT' && (
            <button
              onClick={() => handleMarkAsPaid(invoice.id)}
              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
              title="Marquer payee"
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
        title="Factures clients"
        subtitle="Gerez les factures de vente"
        actions={
          <Button variant="primary" icon={Plus}>
            Nouvelle facture
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total factures" value={invoices.length} icon={FileText} />
        <StatCard label="Payees" value={formatCAD(totalPaid)} icon={DollarSign} className="!bg-green-50 !border-green-200" />
        <StatCard label="En attente" value={formatCAD(totalPending)} icon={Clock} className="!bg-blue-50 !border-blue-200" />
        <StatCard label="En retard" value={formatCAD(totalOverdue)} icon={AlertTriangle} className="!bg-red-50 !border-red-200" />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par numero ou client..."
        actions={
          <Button variant="secondary">
            Exporter
          </Button>
        }
      >
        <SelectFilter
          label="Tous les statuts"
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
        emptyTitle="Aucune facture"
        emptyDescription="Aucune facture ne correspond aux filtres selectionnes."
      />

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!inv}
        onClose={() => setSelectedInvoice(null)}
        title={inv?.invoiceNumber ?? ''}
        subtitle={inv ? `Commande: ${inv.orderId}` : ''}
        size="xl"
        footer={
          inv && (
            <>
              <Button variant="primary" icon={Download}>
                Telecharger PDF
              </Button>
              <Button variant="secondary" icon={Mail}>
                Envoyer par email
              </Button>
              {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                <Button variant="secondary" className="ml-auto" onClick={() => { handleMarkAsPaid(inv.id); setSelectedInvoice(null); }}>
                  Marquer comme payee
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
                <h4 className="text-sm font-medium text-slate-500 mb-2">Facturer a</h4>
                <p className="font-medium text-slate-900">{inv.customer.name}</p>
                <p className="text-sm text-slate-600">{inv.customer.email}</p>
                <p className="text-sm text-slate-600">{inv.customer.address}</p>
              </div>
              <div className="text-right">
                <div className="mb-2">
                  <StatusBadge variant={statusConfig[inv.status].variant} dot>
                    {statusConfig[inv.status].label}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">Date: {new Date(inv.date).toLocaleDateString('fr-CA')}</p>
                <p className="text-sm text-slate-500">Echeance: {new Date(inv.dueDate).toLocaleDateString('fr-CA')}</p>
                {inv.paidAt && (
                  <p className="text-sm text-green-600">Payee le: {new Date(inv.paidAt).toLocaleDateString('fr-CA')}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500">Qte</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Prix unitaire</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inv.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.unitPrice.toFixed(2)} $</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{item.total.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sous-total</span>
                  <span className="text-slate-900">{inv.subtotal.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">TPS (5%)</span>
                  <span className="text-slate-900">{inv.tps.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">TVQ (9.975%)</span>
                  <span className="text-slate-900">{inv.tvq.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>Total</span>
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

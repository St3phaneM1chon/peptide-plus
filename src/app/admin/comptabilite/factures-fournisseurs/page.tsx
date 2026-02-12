'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Check, FileText, DollarSign, Clock, AlertTriangle, Download } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { DataTable, type Column } from '@/components/admin/DataTable';

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

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  APPROVED: { label: 'Approuvee', variant: 'info' },
  PAID: { label: 'Payee', variant: 'success' },
  OVERDUE: { label: 'En retard', variant: 'error' },
};

const statusFilterOptions = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Approuvee' },
  { value: 'PAID', label: 'Payee' },
  { value: 'OVERDUE', label: 'En retard' },
];

const formatCAD = (amount: number) =>
  amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

export default function FacturesFournisseursPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      const response = await fetch(`/api/accounting/supplier-invoices?${params.toString()}`);
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setInvoices(data.invoices ?? []);
    } catch (err) {
      console.error('Error fetching supplier invoices:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des factures');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

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
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      await fetchInvoices();
    } catch (err) {
      console.error('Error approving invoice:', err);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const response = await fetch('/api/accounting/supplier-invoices', {
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
      header: 'N\u00b0 Facture',
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
      header: 'Fournisseur',
      render: (invoice) => (
        <p className="text-sm font-medium text-slate-900">{invoice.supplier.name}</p>
      ),
    },
    {
      key: 'category',
      header: 'Categorie',
      render: (invoice) => (
        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700">
          {invoice.category}
        </span>
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
          {(invoice.status === 'PENDING' || invoice.status === 'APPROVED' || invoice.status === 'OVERDUE') && (
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
        title="Factures fournisseurs"
        subtitle="Gerez les factures d'achat"
        actions={
          <Button variant="primary" icon={Plus}>
            Ajouter facture
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total factures" value={invoices.length} icon={FileText} />
        <StatCard label="A payer" value={formatCAD(totalPending)} icon={Clock} className="!bg-yellow-50 !border-yellow-200" />
        <StatCard label="En retard" value={formatCAD(totalOverdue)} icon={AlertTriangle} className="!bg-red-50 !border-red-200" />
        <StatCard label="Payees ce mois" value={formatCAD(totalPaid)} icon={DollarSign} className="!bg-green-50 !border-green-200" />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par numero ou fournisseur..."
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
        subtitle={inv?.supplier.name}
        size="lg"
        footer={
          inv && (
            <>
              {inv.status === 'PENDING' && (
                <Button variant="primary" onClick={() => { handleApprove(inv.id); setSelectedInvoice(null); }}>
                  Approuver
                </Button>
              )}
              {(inv.status === 'APPROVED' || inv.status === 'OVERDUE') && (
                <Button variant="primary" onClick={() => { handleMarkAsPaid(inv.id); setSelectedInvoice(null); }}>
                  Marquer payee
                </Button>
              )}
              <Button variant="secondary" icon={Download} className="ml-auto">
                Telecharger
              </Button>
            </>
          )
        }
      >
        {inv && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Categorie</p>
                <p className="font-medium">{inv.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Statut</p>
                <StatusBadge variant={statusConfig[inv.status].variant} dot>
                  {statusConfig[inv.status].label}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Date facture</p>
                <p className="font-medium">{new Date(inv.date).toLocaleDateString('fr-CA')}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Echeance</p>
                <p className="font-medium">{new Date(inv.dueDate).toLocaleDateString('fr-CA')}</p>
              </div>
            </div>

            <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inv.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-slate-900">{item.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{item.amount.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sous-total</span>
                  <span>{inv.subtotal.toFixed(2)} $</span>
                </div>
                {inv.taxes > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Taxes</span>
                    <span>{inv.taxes.toFixed(2)} $</span>
                  </div>
                )}
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

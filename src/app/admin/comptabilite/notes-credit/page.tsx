'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Download, FileText, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { DataTable, type Column } from '@/components/admin/DataTable';

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

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Brouillon', variant: 'neutral' },
  ISSUED: { label: 'En vigueur', variant: 'success' },
  VOID: { label: 'Annulee', variant: 'error' },
};

const statusFilterOptions = [
  { value: 'ISSUED', label: 'En vigueur' },
  { value: 'VOID', label: 'Annulee' },
  { value: 'DRAFT', label: 'Brouillon' },
];

const formatCAD = (amount: number) =>
  amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' });

export default function NotesCreditPage() {
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
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setCreditNotes(data.creditNotes ?? []);
      setStats(data.stats ?? { totalCount: 0, totalAmount: 0, issuedCount: 0, issuedAmount: 0, voidCount: 0 });
    } catch (err) {
      console.error('Error fetching credit notes:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
      setCreditNotes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, searchTerm]);

  useEffect(() => {
    fetchCreditNotes();
  }, [fetchCreditNotes]);

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  const columns: Column<CreditNote>[] = [
    {
      key: 'creditNoteNumber',
      header: 'N\u00b0',
      render: (cn) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedNote(cn); }}
            className="font-mono text-sm text-blue-600 hover:underline"
          >
            {cn.creditNoteNumber}
          </button>
          {cn.invoice && (
            <p className="text-xs text-slate-500">Facture: {cn.invoice.invoiceNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Client',
      render: (cn) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{cn.customerName}</p>
          {cn.customerEmail && <p className="text-xs text-slate-500">{cn.customerEmail}</p>}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Raison',
      render: (cn) => (
        <p className="text-sm text-slate-600 truncate max-w-[200px]" title={cn.reason}>
          {cn.reason}
        </p>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (cn) => (
        <span className="text-sm text-slate-500">
          {new Date(cn.issuedAt || cn.createdAt).toLocaleDateString('fr-CA')}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (cn) => (
        <span className="font-medium text-red-600">-{formatCAD(cn.total)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (cn) => {
        const cfg = statusConfig[cn.status];
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (cn) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedNote(cn)}
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
        </div>
      ),
    },
  ];

  const cn = selectedNote;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes de credit"
        subtitle="Notes de credit emises pour remboursements et ajustements"
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total notes" value={stats.totalCount} icon={FileText} />
        <StatCard label="Montant total" value={formatCAD(stats.totalAmount)} icon={DollarSign} className="!bg-red-50 !border-red-200" />
        <StatCard label="En vigueur" value={stats.issuedCount} icon={CheckCircle} className="!bg-green-50 !border-green-200" />
        <StatCard label="Annulees" value={stats.voidCount} icon={XCircle} className="!bg-slate-50 !border-slate-200" />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par numero, client..."
      >
        <SelectFilter
          label="Tous les statuts"
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
        emptyTitle="Aucune note de credit"
        emptyDescription="Aucune note de credit ne correspond aux filtres selectionnes."
      />

      {/* Detail Modal */}
      <Modal
        isOpen={!!cn}
        onClose={() => setSelectedNote(null)}
        title={cn?.creditNoteNumber ?? ''}
        subtitle={cn ? `Commande: ${cn.orderId || 'N/A'}` : ''}
        size="xl"
        footer={
          cn && (
            <Button variant="primary" icon={Download}>
              Telecharger PDF
            </Button>
          )
        }
      >
        {cn && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">Client</h4>
                <p className="font-medium text-slate-900">{cn.customerName}</p>
                {cn.customerEmail && <p className="text-sm text-slate-600">{cn.customerEmail}</p>}
              </div>
              <div className="text-right">
                <div className="mb-2">
                  <StatusBadge variant={statusConfig[cn.status].variant} dot>
                    {statusConfig[cn.status].label}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">
                  Emise le: {cn.issuedAt ? new Date(cn.issuedAt).toLocaleDateString('fr-CA') : 'N/A'}
                </p>
                {cn.invoice && (
                  <p className="text-sm text-blue-600">
                    Facture: {cn.invoice.invoiceNumber}
                  </p>
                )}
                {cn.journalEntryId && (
                  <p className="text-sm text-slate-500">
                    Ecriture comptable liee
                  </p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-amber-800 mb-1">Raison</h4>
              <p className="text-sm text-amber-700">{cn.reason}</p>
            </div>

            {/* Amounts */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sous-total</span>
                  <span className="text-slate-900">-{cn.subtotal.toFixed(2)} $</span>
                </div>
                {cn.taxTps > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">TPS</span>
                    <span className="text-slate-900">-{cn.taxTps.toFixed(2)} $</span>
                  </div>
                )}
                {cn.taxTvq > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">TVQ</span>
                    <span className="text-slate-900">-{cn.taxTvq.toFixed(2)} $</span>
                  </div>
                )}
                {cn.taxTvh > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">TVH</span>
                    <span className="text-slate-900">-{cn.taxTvh.toFixed(2)} $</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                  <span>Total</span>
                  <span className="text-red-600">-{cn.total.toFixed(2)} $</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

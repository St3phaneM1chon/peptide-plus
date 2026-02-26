'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Eye, Send, CheckCircle, Package, FileText, Clock,
  AlertTriangle, Trash2, ArrowRightLeft, Download, X,
} from 'lucide-react';
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
  FormField,
  Input,
  Textarea,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface POItem {
  id?: string;
  productId?: string;
  productName: string;
  description: string;
  sku?: string;
  quantity: number;
  quantityReceived: number;
  unitCost: number;
  taxRate: number;
  total: number;
  notes?: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId?: string;
  supplierName: string;
  supplierEmail?: string;
  supplierAddress?: string;
  department: string;
  status: string;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  total: number;
  currency: string;
  notes?: string;
  internalNotes?: string;
  supplierInvoiceId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  items: POItem[];
  receipts?: POReceipt[];
}

interface POReceipt {
  id: string;
  receivedDate: string;
  receivedBy?: string;
  notes?: string;
  items: { purchaseOrderItemId: string; quantityReceived: number; notes?: string }[];
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Brouillon', variant: 'neutral' },
  SENT: { label: 'Envoye', variant: 'info' },
  CONFIRMED: { label: 'Confirme', variant: 'info' },
  PARTIALLY_RECEIVED: { label: 'Recu partiellement', variant: 'warning' },
  RECEIVED: { label: 'Recu', variant: 'success' },
  INVOICED: { label: 'Facture', variant: 'success' },
  CANCELLED: { label: 'Annule', variant: 'error' },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

function emptyItem(): POItem {
  return { productName: '', description: '', quantity: 1, quantityReceived: 0, unitCost: 0, taxRate: 0, total: 0 };
}

interface POForm {
  supplierName: string;
  supplierEmail: string;
  supplierAddress: string;
  department: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  internalNotes: string;
  items: POItem[];
}

function emptyForm(): POForm {
  return {
    supplierName: '',
    supplierEmail: '',
    supplierAddress: '',
    department: 'OPS',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: '',
    internalNotes: '',
    items: [emptyItem()],
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BonsCommandePage() {
  const { locale, formatCurrency } = useI18n();
  const theme = sectionThemes.accounts;
  const formatCAD = formatCurrency;

  // List state
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Create/Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<POForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Receive modal
  const [showReceive, setShowReceive] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<Record<string, number>>({});
  const [receiveNotes, setReceiveNotes] = useState('');

  // -------------------------------------------------------------------------
  // Fetch orders
  // -------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/accounting/purchase-orders?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      toast.error('Erreur lors du chargement des bons de commande');
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, searchTerm]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // -------------------------------------------------------------------------
  // Create / Update PO
  // -------------------------------------------------------------------------

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEditForm = (po: PurchaseOrder) => {
    setEditingId(po.id);
    setForm({
      supplierName: po.supplierName,
      supplierEmail: po.supplierEmail || '',
      supplierAddress: po.supplierAddress || '',
      department: po.department,
      orderDate: po.orderDate?.split('T')[0] || '',
      expectedDate: po.expectedDate?.split('T')[0] || '',
      notes: po.notes || '',
      internalNotes: po.internalNotes || '',
      items: po.items.length > 0 ? po.items : [emptyItem()],
    });
    setShowForm(true);
  };

  const updateFormItem = (index: number, field: keyof POItem, value: string | number) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      // Recalculate total
      items[index].total = Math.round(Number(items[index].quantity) * Number(items[index].unitCost) * 100) / 100;
      return { ...prev, items };
    });
  };

  const addFormItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeFormItem = (index: number) => {
    setForm((prev) => {
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: items.length > 0 ? items : [emptyItem()] };
    });
  };

  const formSubtotal = form.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
  const formTaxTps = Math.round(formSubtotal * 0.05 * 100) / 100;
  const formTaxTvq = Math.round(formSubtotal * 0.09975 * 100) / 100;
  const formTotal = Math.round((formSubtotal + formTaxTps + formTaxTvq) * 100) / 100;

  const handleSave = async () => {
    if (!form.supplierName.trim()) {
      toast.error('Le nom du fournisseur est requis');
      return;
    }
    if (form.items.length === 0 || !form.items.some((i) => i.productName.trim())) {
      toast.error('Au moins un produit est requis');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplierName: form.supplierName,
        supplierEmail: form.supplierEmail || undefined,
        supplierAddress: form.supplierAddress || undefined,
        department: form.department,
        orderDate: form.orderDate || undefined,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        internalNotes: form.internalNotes || undefined,
        items: form.items.filter((i) => i.productName.trim()).map((i) => ({
          productName: i.productName,
          description: i.description || '',
          sku: i.sku,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          taxRate: Number(i.taxRate),
          lineTotal: Math.round(Number(i.quantity) * Number(i.unitCost) * 100) / 100,
          notes: i.notes,
        })),
      };

      const url = editingId
        ? `/api/accounting/purchase-orders/${editingId}`
        : '/api/accounting/purchase-orders';

      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      toast.success(editingId ? 'Bon de commande mis a jour' : 'Bon de commande cree');
      setShowForm(false);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Actions: Send, Approve, Delete, Receive, Convert
  // -------------------------------------------------------------------------

  const handleSend = async (po: PurchaseOrder) => {
    if (!po.supplierEmail) {
      toast.error('Aucune adresse email fournisseur. Ajoutez un email avant d\'envoyer.');
      return;
    }
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${po.id}/send`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      toast.success(`Bon de commande ${po.poNumber} envoye`);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    }
  };

  const handleApprove = async (po: PurchaseOrder) => {
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${po.id}/approve`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      toast.success(`Bon de commande ${po.poNumber} approuve`);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'approbation');
    }
  };

  const handleDelete = async (po: PurchaseOrder) => {
    if (po.status !== 'DRAFT') {
      toast.error('Seuls les brouillons peuvent etre supprimes');
      return;
    }
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${po.id}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      toast.success(`Bon de commande ${po.poNumber} supprime`);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const handleCancel = async (po: PurchaseOrder) => {
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${po.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'CANCELLED', cancelReason: 'Annule manuellement' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      toast.success(`Bon de commande ${po.poNumber} annule`);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'annulation');
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceiveOrder(po);
    const initial: Record<string, number> = {};
    for (const item of po.items) {
      if (item.id) {
        const remaining = Math.max(0, item.quantity - item.quantityReceived);
        initial[item.id] = remaining;
      }
    }
    setReceiveItems(initial);
    setReceiveNotes('');
    setShowReceive(true);
  };

  const handleReceive = async () => {
    if (!receiveOrder) return;
    const items = Object.entries(receiveItems)
      .filter(([, qty]) => qty > 0)
      .map(([purchaseOrderItemId, quantityReceived]) => ({
        purchaseOrderItemId,
        quantityReceived,
      }));

    if (items.length === 0) {
      toast.error('Aucune quantite recue');
      return;
    }

    try {
      const res = await fetch(`/api/accounting/purchase-orders/${receiveOrder.id}/receive`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ items, notes: receiveNotes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      toast.success(data.message || 'Reception enregistree');
      setShowReceive(false);
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la reception');
    }
  };

  const handleConvertToInvoice = async (po: PurchaseOrder) => {
    try {
      const res = await fetch(`/api/accounting/purchase-orders/${po.id}/convert-to-invoice`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      toast.success(data.message || 'Converti en facture fournisseur');
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la conversion');
    }
  };

  // -------------------------------------------------------------------------
  // CSV Export
  // -------------------------------------------------------------------------

  const handleExport = () => {
    if (orders.length === 0) {
      toast.error('Aucun bon de commande a exporter');
      return;
    }
    const bom = '\uFEFF';
    const headers = ['Numero', 'Fournisseur', 'Statut', 'Date', 'Livraison prevue', 'Sous-total', 'TPS', 'TVQ', 'Total'];
    const rows = orders.map((po) => [
      po.poNumber, po.supplierName, po.status,
      po.orderDate?.split('T')[0] || '', po.expectedDate?.split('T')[0] || '',
      String(po.subtotal), String(po.taxTps), String(po.taxTvq), String(po.total),
    ]);
    const csv = bom + [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bons-commande-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${orders.length} bons de commande exportes`);
  };

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  const totalDraft = orders.filter((o) => o.status === 'DRAFT').length;
  const totalPending = orders.filter((o) => ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);
  const totalReceived = orders.filter((o) => o.status === 'RECEIVED')
    .reduce((sum, o) => sum + o.total, 0);

  // -------------------------------------------------------------------------
  // Table columns
  // -------------------------------------------------------------------------

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'poNumber',
      header: 'Numero',
      render: (po) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedOrder(po); }}
          className="font-mono text-sm text-blue-600 hover:underline"
        >
          {po.poNumber}
        </button>
      ),
    },
    {
      key: 'supplierName',
      header: 'Fournisseur',
      render: (po) => (
        <div>
          <p className="text-sm font-medium text-slate-900">{po.supplierName}</p>
          {po.supplierEmail && <p className="text-xs text-slate-500">{po.supplierEmail}</p>}
        </div>
      ),
    },
    {
      key: 'orderDate',
      header: 'Date',
      render: (po) => po.orderDate ? new Date(po.orderDate).toLocaleDateString(locale) : '-',
    },
    {
      key: 'expectedDate',
      header: 'Livraison prevue',
      render: (po) => po.expectedDate ? new Date(po.expectedDate).toLocaleDateString(locale) : '-',
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (po) => (
        <span className="font-medium text-slate-900">{formatCAD(po.total)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (po) => {
        const cfg = STATUS_CONFIG[po.status] || { label: po.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (po) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedOrder(po)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Voir"
          >
            <Eye className="w-4 h-4" />
          </button>
          {po.status === 'DRAFT' && (
            <button
              onClick={() => openEditForm(po)}
              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
              title="Modifier"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          {po.status === 'DRAFT' && po.supplierEmail && (
            <button
              onClick={() => handleSend(po)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
              title="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          {['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && (
            <button
              onClick={() => openReceiveModal(po)}
              className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
              title="Recevoir"
            >
              <Package className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const po = selectedOrder;

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => { setError(null); fetchOrders(); }}
            className="text-red-700 underline font-medium hover:text-red-800"
          >
            Reessayer
          </button>
        </div>
      )}

      <PageHeader
        title="Bons de commande"
        subtitle="Gestion des commandes fournisseurs"
        theme={theme}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Download} onClick={handleExport}>
              Exporter
            </Button>
            <Button variant="primary" icon={Plus} onClick={openCreateForm} className={`${theme.btnPrimary} border-transparent text-white`}>
              Nouveau bon
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total bons" value={orders.length} icon={FileText} theme={theme} />
        <StatCard label="Brouillons" value={totalDraft} icon={Clock} theme={theme} />
        <StatCard label="En cours" value={`${formatCAD(totalPending)}`} icon={AlertTriangle} theme={theme} />
        <StatCard label="Recus" value={`${formatCAD(totalReceived)}`} icon={Package} theme={theme} />
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
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      {/* Table */}
      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(po) => po.id}
        emptyTitle="Aucun bon de commande"
        emptyDescription="Creez votre premier bon de commande pour commencer."
      />

      {/* ================================================================= */}
      {/* DETAIL MODAL                                                      */}
      {/* ================================================================= */}
      <Modal
        isOpen={!!po}
        onClose={() => setSelectedOrder(null)}
        title={po?.poNumber ?? ''}
        subtitle={po?.supplierName}
        size="lg"
        footer={
          po && (
            <div className="flex flex-wrap gap-2">
              {po.status === 'DRAFT' && (
                <>
                  <Button variant="primary" icon={Send} onClick={() => handleSend(po)} className={`${theme.btnPrimary} border-transparent text-white`}>
                    Envoyer
                  </Button>
                  <Button variant="primary" icon={CheckCircle} onClick={() => handleApprove(po)} className="bg-green-600 hover:bg-green-700 border-transparent text-white">
                    Approuver
                  </Button>
                  <Button variant="secondary" icon={Trash2} onClick={() => handleDelete(po)} className="text-red-600 hover:bg-red-50">
                    Supprimer
                  </Button>
                </>
              )}
              {po.status === 'SENT' && (
                <>
                  <Button variant="primary" icon={CheckCircle} onClick={() => handleApprove(po)} className="bg-green-600 hover:bg-green-700 border-transparent text-white">
                    Approuver
                  </Button>
                  <Button variant="secondary" icon={X} onClick={() => handleCancel(po)} className="text-red-600 hover:bg-red-50">
                    Annuler
                  </Button>
                </>
              )}
              {['CONFIRMED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && (
                <Button variant="primary" icon={Package} onClick={() => openReceiveModal(po)} className="bg-teal-600 hover:bg-teal-700 border-transparent text-white">
                  Recevoir marchandises
                </Button>
              )}
              {po.status === 'RECEIVED' && !po.supplierInvoiceId && (
                <Button variant="primary" icon={ArrowRightLeft} onClick={() => handleConvertToInvoice(po)} className="bg-violet-600 hover:bg-violet-700 border-transparent text-white">
                  Convertir en facture
                </Button>
              )}
            </div>
          )
        }
      >
        {po && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Statut</p>
                <StatusBadge variant={STATUS_CONFIG[po.status]?.variant || 'neutral'} dot>
                  {STATUS_CONFIG[po.status]?.label || po.status}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Departement</p>
                <p className="font-medium">{po.department}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Date de commande</p>
                <p className="font-medium">{po.orderDate ? new Date(po.orderDate).toLocaleDateString(locale) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Livraison prevue</p>
                <p className="font-medium">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString(locale) : '-'}</p>
              </div>
              {po.approvedBy && (
                <div>
                  <p className="text-xs text-slate-500">Approuve par</p>
                  <p className="font-medium">{po.approvedBy}</p>
                  {po.approvedAt && <p className="text-xs text-slate-400">{new Date(po.approvedAt).toLocaleDateString(locale)}</p>}
                </div>
              )}
              {po.sentAt && (
                <div>
                  <p className="text-xs text-slate-500">Envoye le</p>
                  <p className="font-medium">{new Date(po.sentAt).toLocaleDateString(locale)}</p>
                </div>
              )}
              {po.supplierInvoiceId && (
                <div>
                  <p className="text-xs text-slate-500">Facture fournisseur</p>
                  <p className="font-medium text-blue-600">{po.supplierInvoiceId}</p>
                </div>
              )}
            </div>

            {/* Supplier info */}
            {(po.supplierEmail || po.supplierAddress) && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Fournisseur</p>
                {po.supplierEmail && <p className="text-sm">{po.supplierEmail}</p>}
                {po.supplierAddress && <p className="text-sm text-slate-600">{po.supplierAddress}</p>}
              </div>
            )}

            {/* Items table */}
            <SectionCard theme={theme} noPadding>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500">Produit</th>
                      <th scope="col" className="px-4 py-2 text-start text-xs font-semibold text-slate-500">SKU</th>
                      <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Qte</th>
                      <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Recu</th>
                      <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Prix unit.</th>
                      <th scope="col" className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {po.items.map((item, i) => (
                      <tr key={item.id || i}>
                        <td className="px-4 py-2 text-sm">
                          <p className="font-medium">{item.productName || item.description}</p>
                          {item.description && item.productName && <p className="text-xs text-slate-500">{item.description}</p>}
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-500">{item.sku || '-'}</td>
                        <td className="px-4 py-2 text-sm text-end">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-end">
                          <span className={item.quantityReceived >= item.quantity ? 'text-green-600' : item.quantityReceived > 0 ? 'text-amber-600' : 'text-slate-400'}>
                            {item.quantityReceived}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-end">{formatCAD(item.unitCost)}</td>
                        <td className="px-4 py-2 text-sm text-end font-medium">{formatCAD(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={5} className="px-4 py-2 text-sm text-end text-slate-600">Sous-total</td>
                      <td className="px-4 py-2 text-sm text-end font-medium">{formatCAD(po.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-4 py-1 text-sm text-end text-slate-500">TPS (5%)</td>
                      <td className="px-4 py-1 text-sm text-end">{formatCAD(po.taxTps)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="px-4 py-1 text-sm text-end text-slate-500">TVQ (9.975%)</td>
                      <td className="px-4 py-1 text-sm text-end">{formatCAD(po.taxTvq)}</td>
                    </tr>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={5} className="px-4 py-2 text-sm text-end font-bold text-slate-800">Total</td>
                      <td className="px-4 py-2 text-sm text-end font-bold text-indigo-700">{formatCAD(po.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            {/* Notes */}
            {po.notes && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm">{po.notes}</p>
              </div>
            )}
            {po.internalNotes && (
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600 mb-1">Notes internes</p>
                <p className="text-sm">{po.internalNotes}</p>
              </div>
            )}

            {/* Cancel info */}
            {po.status === 'CANCELLED' && (
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600 mb-1">Annulation</p>
                {po.cancelledBy && <p className="text-sm">Par: {po.cancelledBy}</p>}
                {po.cancelledAt && <p className="text-sm">Le: {new Date(po.cancelledAt).toLocaleDateString(locale)}</p>}
                {po.cancelReason && <p className="text-sm">Raison: {po.cancelReason}</p>}
              </div>
            )}

            {/* Receipts history */}
            {po.receipts && po.receipts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Historique des receptions</h3>
                <div className="space-y-2">
                  {po.receipts.map((receipt) => (
                    <div key={receipt.id} className="p-3 bg-green-50 rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {new Date(receipt.receivedDate).toLocaleDateString(locale)}
                        </span>
                        {receipt.receivedBy && <span className="text-slate-500">par {receipt.receivedBy}</span>}
                      </div>
                      <ul className="mt-1 text-xs text-slate-600">
                        {receipt.items.map((ri, idx) => {
                          const poItem = po.items.find((i) => i.id === ri.purchaseOrderItemId);
                          return (
                            <li key={idx}>
                              {poItem?.productName || poItem?.description || ri.purchaseOrderItemId}: {ri.quantityReceived} recu(s)
                            </li>
                          );
                        })}
                      </ul>
                      {receipt.notes && <p className="mt-1 text-xs text-slate-500">{receipt.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* CREATE / EDIT MODAL                                               */}
      {/* ================================================================= */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Modifier le bon de commande' : 'Nouveau bon de commande'}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className={`${theme.btnPrimary} border-transparent text-white`}
            >
              {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Creer le bon'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Supplier info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nom du fournisseur" required htmlFor="supplierName">
              <Input
                id="supplierName"
                value={form.supplierName}
                onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))}
                placeholder="Nom du fournisseur"
              />
            </FormField>
            <FormField label="Email fournisseur" htmlFor="supplierEmail">
              <Input
                id="supplierEmail"
                type="email"
                value={form.supplierEmail}
                onChange={(e) => setForm((p) => ({ ...p, supplierEmail: e.target.value }))}
                placeholder="email@fournisseur.com"
              />
            </FormField>
          </div>

          <FormField label="Adresse fournisseur" htmlFor="supplierAddress">
            <Textarea
              id="supplierAddress"
              value={form.supplierAddress}
              onChange={(e) => setForm((p) => ({ ...p, supplierAddress: e.target.value }))}
              rows={2}
              placeholder="Adresse du fournisseur"
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Departement" htmlFor="department">
              <Input
                id="department"
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
              />
            </FormField>
            <FormField label="Date de commande" htmlFor="orderDate">
              <Input
                id="orderDate"
                type="date"
                value={form.orderDate}
                onChange={(e) => setForm((p) => ({ ...p, orderDate: e.target.value }))}
              />
            </FormField>
            <FormField label="Date de livraison prevue" htmlFor="expectedDate">
              <Input
                id="expectedDate"
                type="date"
                value={form.expectedDate}
                onChange={(e) => setForm((p) => ({ ...p, expectedDate: e.target.value }))}
              />
            </FormField>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Articles</h3>
              <Button variant="secondary" icon={Plus} onClick={addFormItem} className="text-xs">
                Ajouter une ligne
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-start text-xs font-semibold text-slate-500">Produit *</th>
                    <th className="px-3 py-2 text-start text-xs font-semibold text-slate-500">SKU</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-slate-500 w-20">Qte *</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-slate-500 w-28">Prix unit. *</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold text-slate-500 w-24">Total</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1.5">
                        <input
                          className="w-full h-8 px-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={item.productName}
                          onChange={(e) => updateFormItem(idx, 'productName', e.target.value)}
                          placeholder="Nom du produit"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="w-full h-8 px-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={item.sku || ''}
                          onChange={(e) => updateFormItem(idx, 'sku', e.target.value)}
                          placeholder="SKU"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-sm text-end focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={item.quantity}
                          onChange={(e) => updateFormItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full h-8 px-2 border border-slate-200 rounded text-sm text-end focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={item.unitCost}
                          onChange={(e) => updateFormItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-end font-medium text-slate-700">
                        {formatCAD(Math.round(Number(item.quantity) * Number(item.unitCost) * 100) / 100)}
                      </td>
                      <td className="px-1 py-1.5">
                        {form.items.length > 1 && (
                          <button
                            onClick={() => removeFormItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-500"
                            title="Supprimer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-3 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sous-total</span>
                  <span>{formatCAD(formSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TPS (5%)</span>
                  <span>{formatCAD(formTaxTps)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TVQ (9.975%)</span>
                  <span>{formatCAD(formTaxTvq)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-indigo-700">
                  <span>Total</span>
                  <span>{formatCAD(formTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Notes (visibles au fournisseur)" htmlFor="notes">
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Notes pour le fournisseur..."
              />
            </FormField>
            <FormField label="Notes internes" htmlFor="internalNotes">
              <Textarea
                id="internalNotes"
                value={form.internalNotes}
                onChange={(e) => setForm((p) => ({ ...p, internalNotes: e.target.value }))}
                rows={2}
                placeholder="Notes internes..."
              />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ================================================================= */}
      {/* RECEIVE MODAL                                                     */}
      {/* ================================================================= */}
      <Modal
        isOpen={showReceive}
        onClose={() => setShowReceive(false)}
        title={`Recevoir - ${receiveOrder?.poNumber || ''}`}
        subtitle={receiveOrder?.supplierName}
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowReceive(false)}>Annuler</Button>
            <Button
              variant="primary"
              icon={Package}
              onClick={handleReceive}
              className="bg-teal-600 hover:bg-teal-700 border-transparent text-white"
            >
              Enregistrer la reception
            </Button>
          </div>
        }
      >
        {receiveOrder && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Saisissez les quantites recues pour chaque article. Les articles deja entierement recus sont grisees.
            </p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold text-slate-500">Produit</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Commande</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Deja recu</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold text-slate-500">Restant</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold text-slate-500 w-28">Recu maintenant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receiveOrder.items.map((item) => {
                    const remaining = Math.max(0, item.quantity - item.quantityReceived);
                    const fullyReceived = remaining <= 0;
                    return (
                      <tr key={item.id} className={fullyReceived ? 'opacity-50' : ''}>
                        <td className="px-4 py-2">{item.productName || item.description}</td>
                        <td className="px-4 py-2 text-end">{item.quantity}</td>
                        <td className="px-4 py-2 text-end">{item.quantityReceived}</td>
                        <td className="px-4 py-2 text-end font-medium">{remaining}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            step="1"
                            disabled={fullyReceived}
                            className="w-full h-8 px-2 border border-slate-200 rounded text-sm text-end focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
                            value={item.id ? receiveItems[item.id] || 0 : 0}
                            onChange={(e) => {
                              if (!item.id) return;
                              const val = Math.min(parseFloat(e.target.value) || 0, remaining);
                              setReceiveItems((prev) => ({ ...prev, [item.id!]: val }));
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <FormField label="Notes de reception" htmlFor="receiveNotes">
              <Textarea
                id="receiveNotes"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                rows={2}
                placeholder="Notes sur cette reception..."
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}

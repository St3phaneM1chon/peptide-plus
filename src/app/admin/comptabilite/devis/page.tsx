'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Eye, Send, FileText, Copy, Trash2,
  CheckCircle, XCircle, Clock, AlertTriangle,
  ArrowRightCircle, Pencil, RefreshCw,
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
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EstimateItem {
  id?: string;
  productName: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
  lineTotal: number;
  sortOrder: number;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  customerId?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  status: string;
  issueDate: string;
  validUntil: string;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  signatureData?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  convertedAt?: string | null;
  invoiceId?: string | null;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxGst: number;
  taxQst: number;
  taxTotal: number;
  total: number;
  currency: string;
  notes?: string | null;
  internalNotes?: string | null;
  termsConditions?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  viewToken?: string | null;
  items: EstimateItem[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface LineItemForm {
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
}

interface EstimateForm {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerPhone: string;
  validityDays: number;
  items: LineItemForm[];
  notes: string;
  internalNotes: string;
  termsConditions: string;
  discountPercent: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyLine(): LineItemForm {
  return { productName: '', description: '', quantity: 1, unitPrice: 0, discountPercent: 0 };
}

function emptyForm(): EstimateForm {
  return {
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    customerPhone: '',
    validityDays: 30,
    items: [emptyLine()],
    notes: '',
    internalNotes: '',
    termsConditions: '',
    discountPercent: 0,
  };
}

function computeTotals(items: LineItemForm[], globalDiscountPercent: number) {
  let subtotal = 0;
  for (const item of items) {
    const discountMult = 1 - (item.discountPercent / 100);
    subtotal += item.quantity * item.unitPrice * discountMult;
  }
  subtotal = Math.round(subtotal * 100) / 100;

  const discountAmount = Math.round(subtotal * (globalDiscountPercent / 100) * 100) / 100;
  const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
  const gst = Math.round(afterDiscount * GST_RATE * 100) / 100;
  const qst = Math.round(afterDiscount * QST_RATE * 100) / 100;
  const total = Math.round((afterDiscount + gst + qst) * 100) / 100;

  return { subtotal, discountAmount, afterDiscount, gst, qst, total };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DevisPage() {
  const { t, formatCurrency } = useI18n();
  const theme = sectionThemes.accounts;

  // Status config
  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: 'Brouillon', variant: 'neutral' },
    SENT: { label: 'Envoyé', variant: 'info' },
    VIEWED: { label: 'Consulté', variant: 'info' },
    ACCEPTED: { label: 'Accepté', variant: 'success' },
    DECLINED: { label: 'Refusé', variant: 'error' },
    EXPIRED: { label: 'Expiré', variant: 'warning' },
    CONVERTED: { label: 'Converti', variant: 'success' },
  };

  const statusFilterOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: 'DRAFT', label: 'Brouillon' },
    { value: 'SENT', label: 'Envoyé' },
    { value: 'VIEWED', label: 'Consulté' },
    { value: 'ACCEPTED', label: 'Accepté' },
    { value: 'DECLINED', label: 'Refusé' },
    { value: 'EXPIRED', label: 'Expiré' },
    { value: 'CONVERTED', label: 'Converti' },
  ];

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<EstimateForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchEstimates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      if (searchTerm) params.set('search', searchTerm);
      params.set('limit', '200');
      const response = await fetch(`/api/accounting/estimates?${params.toString()}`);
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setEstimates(data.estimates ?? []);
    } catch (err) {
      console.error('Error fetching estimates:', err);
      toast.error('Erreur lors du chargement des devis');
      setEstimates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, searchTerm]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  // ---------------------------------------------------------------------------
  // Form validation
  // ---------------------------------------------------------------------------

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.customerName.trim()) errors.customerName = 'Le nom du client est requis';
    if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
      errors.customerEmail = 'Email invalide';
    }
    if (!form.items.some(item => item.productName.trim())) {
      errors.items = 'Au moins un article est requis';
    }
    if (form.validityDays < 1 || form.validityDays > 365) {
      errors.validityDays = 'La validité doit être entre 1 et 365 jours';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Create / Edit
  // ---------------------------------------------------------------------------

  function openCreateModal() {
    setEditingEstimate(null);
    setForm(emptyForm());
    setFormErrors({});
    setShowCreateModal(true);
  }

  function openEditModal(estimate: Estimate) {
    setEditingEstimate(estimate);
    const validUntilDate = new Date(estimate.validUntil);
    const issueDate = new Date(estimate.issueDate);
    const diffDays = Math.ceil((validUntilDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));

    setForm({
      customerName: estimate.customerName,
      customerEmail: estimate.customerEmail || '',
      customerAddress: estimate.customerAddress || '',
      customerPhone: estimate.customerPhone || '',
      validityDays: diffDays > 0 ? diffDays : 30,
      items: estimate.items.map(item => ({
        productName: item.productName,
        description: item.description || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
      })),
      notes: estimate.notes || '',
      internalNotes: estimate.internalNotes || '',
      termsConditions: estimate.termsConditions || '',
      discountPercent: estimate.discountPercent,
    });
    setFormErrors({});
    setShowCreateModal(true);
  }

  async function handleDuplicate(estimate: Estimate) {
    setEditingEstimate(null);
    setForm({
      customerName: estimate.customerName,
      customerEmail: estimate.customerEmail || '',
      customerAddress: estimate.customerAddress || '',
      customerPhone: estimate.customerPhone || '',
      validityDays: 30,
      items: estimate.items.map(item => ({
        productName: item.productName,
        description: item.description || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
      })),
      notes: estimate.notes || '',
      internalNotes: estimate.internalNotes || '',
      termsConditions: estimate.termsConditions || '',
      discountPercent: estimate.discountPercent,
    });
    setFormErrors({});
    setShowCreateModal(true);
  }

  async function handleSaveEstimate() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + form.validityDays);

      const payload = {
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim() || null,
        customerAddress: form.customerAddress.trim() || null,
        customerPhone: form.customerPhone.trim() || null,
        validUntil: validUntilDate.toISOString(),
        items: form.items
          .filter(item => item.productName.trim())
          .map((item, idx) => ({
            productName: item.productName.trim(),
            description: item.description.trim() || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxRate: (GST_RATE + QST_RATE) * 100,
            sortOrder: idx,
          })),
        notes: form.notes.trim() || null,
        internalNotes: form.internalNotes.trim() || null,
        termsConditions: form.termsConditions.trim() || null,
        discountPercent: form.discountPercent,
      };

      if (editingEstimate) {
        const response = await fetch(`/api/accounting/estimates/${editingEstimate.id}`, {
          method: 'PUT',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de la mise à jour');
        }
        toast.success('Devis mis à jour avec succès');
      } else {
        const response = await fetch('/api/accounting/estimates', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erreur lors de la création');
        }
        toast.success('Devis créé avec succès');
      }

      setShowCreateModal(false);
      fetchEstimates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleSend(estimate: Estimate) {
    if (!estimate.customerEmail) {
      toast.error("Ajoutez un email client avant d'envoyer le devis");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/accounting/estimates/${estimate.id}/send`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erreur lors de l'envoi");
      }
      toast.success('Devis envoyé par email');
      fetchEstimates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert(estimate: Estimate) {
    setSaving(true);
    try {
      const response = await fetch(`/api/accounting/estimates/${estimate.id}/convert`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur lors de la conversion');
      }
      const data = await response.json();
      toast.success(data.message || 'Devis converti en facture');
      fetchEstimates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la conversion');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedEstimate) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/accounting/estimates/${selectedEstimate.id}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      toast.success('Devis supprimé');
      setShowDeleteConfirm(false);
      setSelectedEstimate(null);
      fetchEstimates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Line item management
  // ---------------------------------------------------------------------------

  function addLine() {
    setForm(prev => ({ ...prev, items: [...prev.items, emptyLine()] }));
  }

  function removeLine(idx: number) {
    setForm(prev => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== idx) : prev.items,
    }));
  }

  function updateLine(idx: number, field: keyof LineItemForm, value: string | number) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const stats = {
    total: estimates.length,
    draft: estimates.filter(e => e.status === 'DRAFT').length,
    sent: estimates.filter(e => ['SENT', 'VIEWED'].includes(e.status)).length,
    accepted: estimates.filter(e => e.status === 'ACCEPTED').length,
    declined: estimates.filter(e => e.status === 'DECLINED').length,
    expired: estimates.filter(e => e.status === 'EXPIRED').length,
    totalValue: estimates.reduce((sum, e) => sum + e.total, 0),
    acceptedValue: estimates.filter(e => ['ACCEPTED', 'CONVERTED'].includes(e.status)).reduce((sum, e) => sum + e.total, 0),
  };

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: Column<Estimate>[] = [
    {
      key: 'estimateNumber',
      header: 'Numéro',
      render: (est) => (
        <button
          onClick={() => { setSelectedEstimate(est); setShowDetailModal(true); }}
          className="text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {est.estimateNumber}
        </button>
      ),
    },
    {
      key: 'customerName',
      header: 'Client',
      render: (est) => (
        <div>
          <div className="font-medium text-sm">{est.customerName}</div>
          {est.customerEmail && (
            <div className="text-xs text-gray-500">{est.customerEmail}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (est) => {
        const config = statusConfig[est.status] || { label: est.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge label={config.label} variant={config.variant} />;
      },
    },
    {
      key: 'total',
      header: 'Total',
      render: (est) => (
        <span className="font-semibold">
          {formatCurrency ? formatCurrency(est.total) : `$${est.total.toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'validUntil',
      header: 'Valide jusqu\'au',
      render: (est) => {
        const date = new Date(est.validUntil);
        const isExpired = date < new Date() && !['ACCEPTED', 'CONVERTED', 'DECLINED'].includes(est.status);
        return (
          <span className={isExpired ? 'text-red-600 font-medium' : ''}>
            {date.toLocaleDateString('fr-CA')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (est) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSelectedEstimate(est); setShowDetailModal(true); }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Voir le détail"
          >
            <Eye className="w-4 h-4" />
          </button>

          {est.status === 'DRAFT' && (
            <>
              <button
                onClick={() => openEditModal(est)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                title="Modifier"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSend(est)}
                className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700"
                title="Envoyer au client"
                disabled={saving}
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setSelectedEstimate(est); setShowDeleteConfirm(true); }}
                className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          {est.status === 'ACCEPTED' && !est.invoiceId && (
            <button
              onClick={() => handleConvert(est)}
              className="p-1.5 rounded hover:bg-green-50 text-green-600 hover:text-green-800"
              title="Convertir en facture"
              disabled={saving}
            >
              <ArrowRightCircle className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => handleDuplicate(est)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            title="Dupliquer"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Computed totals for form preview
  // ---------------------------------------------------------------------------

  const formTotals = computeTotals(form.items, form.discountPercent);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis / Estimations"
        subtitle="Gérez vos devis et estimations clients"
        icon={<FileText className="w-6 h-6" />}
        actions={
          <Button onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Nouveau devis
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<FileText className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="Brouillons"
          value={stats.draft}
          icon={<Clock className="w-5 h-5 text-gray-500" />}
        />
        <StatCard
          label="Envoyés"
          value={stats.sent}
          icon={<Send className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          label="Acceptés"
          value={stats.accepted}
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
        />
        <StatCard
          label="Refusés"
          value={stats.declined}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
        />
        <StatCard
          label="Valeur acceptée"
          value={formatCurrency ? formatCurrency(stats.acceptedValue) : `$${stats.acceptedValue.toFixed(2)}`}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par client ou numéro..."
      >
        <SelectFilter
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusFilterOptions}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEstimates}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Actualiser
        </Button>
      </FilterBar>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={estimates}
        loading={loading}
        emptyMessage="Aucun devis trouvé"
        emptyIcon={<FileText className="w-12 h-12 text-gray-300" />}
      />

      {/* ================================================================== */}
      {/* CREATE / EDIT MODAL */}
      {/* ================================================================== */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingEstimate ? `Modifier ${editingEstimate.estimateNumber}` : 'Nouveau devis'}
        size="xl"
      >
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nom du client *" error={formErrors.customerName}>
              <Input
                value={form.customerName}
                onChange={(e) => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                placeholder="Nom du client"
              />
            </FormField>
            <FormField label="Email" error={formErrors.customerEmail}>
              <Input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="email@client.com"
              />
            </FormField>
            <FormField label="Adresse">
              <Input
                value={form.customerAddress}
                onChange={(e) => setForm(prev => ({ ...prev, customerAddress: e.target.value }))}
                placeholder="Adresse du client"
              />
            </FormField>
            <FormField label="Téléphone">
              <Input
                value={form.customerPhone}
                onChange={(e) => setForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                placeholder="+1 (514) 000-0000"
              />
            </FormField>
          </div>

          {/* Validity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Validité (jours)" error={formErrors.validityDays}>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.validityDays}
                onChange={(e) => setForm(prev => ({ ...prev, validityDays: parseInt(e.target.value) || 30 }))}
              />
            </FormField>
            <FormField label="Remise globale (%)">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.discountPercent}
                onChange={(e) => setForm(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Articles</h3>
              <Button size="sm" variant="outline" onClick={addLine} icon={<Plus className="w-3 h-3" />}>
                Ajouter une ligne
              </Button>
            </div>
            {formErrors.items && (
              <p className="text-red-500 text-xs mb-2">{formErrors.items}</p>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Produit</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">Qté</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Prix unit.</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">Rem. %</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Total</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => {
                    const discMult = 1 - (item.discountPercent / 100);
                    const lineTotal = Math.round(item.quantity * item.unitPrice * discMult * 100) / 100;
                    return (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => updateLine(idx, 'productName', e.target.value)}
                            className="w-full border-0 bg-transparent text-sm focus:ring-0 p-1"
                            placeholder="Nom du produit"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLine(idx, 'description', e.target.value)}
                            className="w-full border-0 bg-transparent text-sm focus:ring-0 p-1"
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={item.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full border-0 bg-transparent text-sm text-right focus:ring-0 p-1"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unitPrice}
                            onChange={(e) => updateLine(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full border-0 bg-transparent text-sm text-right focus:ring-0 p-1"
                          />
                        </td>
                        <td className="px-3 py-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={item.discountPercent}
                            onChange={(e) => updateLine(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                            className="w-full border-0 bg-transparent text-sm text-right focus:ring-0 p-1"
                          />
                        </td>
                        <td className="px-3 py-1 text-right font-medium text-sm">
                          ${lineTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-1">
                          {form.items.length > 1 && (
                            <button
                              onClick={() => removeLine(idx)}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-medium">${formTotals.subtotal.toFixed(2)}</span>
                </div>
                {form.discountPercent > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remise ({form.discountPercent}%)</span>
                    <span>-${formTotals.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>TPS (5%)</span>
                  <span>${formTotals.gst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>TVQ (9.975%)</span>
                  <span>${formTotals.qst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 text-base font-bold">
                  <span>Total</span>
                  <span className="text-indigo-600">${formTotals.total.toFixed(2)} CAD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Notes (visibles au client)">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Notes pour le client..."
              />
            </FormField>
            <FormField label="Notes internes">
              <Textarea
                value={form.internalNotes}
                onChange={(e) => setForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                rows={3}
                placeholder="Notes internes (non visibles au client)..."
              />
            </FormField>
          </div>
          <FormField label="Conditions générales">
            <Textarea
              value={form.termsConditions}
              onChange={(e) => setForm(prev => ({ ...prev, termsConditions: e.target.value }))}
              rows={3}
              placeholder="Conditions de vente, modalités de paiement..."
            />
          </FormField>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEstimate} disabled={saving}>
              {saving ? 'Enregistrement...' : editingEstimate ? 'Mettre à jour' : 'Créer le devis'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================================================================== */}
      {/* DETAIL MODAL */}
      {/* ================================================================== */}
      <Modal
        open={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedEstimate(null); }}
        title={selectedEstimate ? `Devis ${selectedEstimate.estimateNumber}` : 'Détail du devis'}
        size="lg"
      >
        {selectedEstimate && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{selectedEstimate.customerName}</h3>
                {selectedEstimate.customerEmail && (
                  <p className="text-sm text-gray-500">{selectedEstimate.customerEmail}</p>
                )}
                {selectedEstimate.customerAddress && (
                  <p className="text-sm text-gray-500">{selectedEstimate.customerAddress}</p>
                )}
                {selectedEstimate.customerPhone && (
                  <p className="text-sm text-gray-500">{selectedEstimate.customerPhone}</p>
                )}
              </div>
              <div className="text-right">
                <StatusBadge
                  label={statusConfig[selectedEstimate.status]?.label || selectedEstimate.status}
                  variant={statusConfig[selectedEstimate.status]?.variant || 'neutral'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Émis le {new Date(selectedEstimate.issueDate).toLocaleDateString('fr-CA')}
                </p>
                <p className="text-xs text-gray-500">
                  Valide jusqu&apos;au {new Date(selectedEstimate.validUntil).toLocaleDateString('fr-CA')}
                </p>
              </div>
            </div>

            {/* Items table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Produit</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Qté</th>
                    <th className="px-3 py-2 text-right">Prix unit.</th>
                    <th className="px-3 py-2 text-right">Rem. %</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEstimate.items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 font-medium">{item.productName}</td>
                      <td className="px-3 py-2 text-gray-600">{item.description || '-'}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}</td>
                      <td className="px-3 py-2 text-right font-medium">${item.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span>${selectedEstimate.subtotal.toFixed(2)}</span>
                </div>
                {selectedEstimate.discountAmount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remise ({selectedEstimate.discountPercent}%)</span>
                    <span>-${selectedEstimate.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-500">
                  <span>TPS (5%)</span>
                  <span>${selectedEstimate.taxGst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>TVQ (9.975%)</span>
                  <span>${selectedEstimate.taxQst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 text-base font-bold">
                  <span>Total</span>
                  <span className="text-indigo-600">${selectedEstimate.total.toFixed(2)} CAD</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedEstimate.notes && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">Notes</h4>
                <p className="text-sm text-gray-600 whitespace-pre-line">{selectedEstimate.notes}</p>
              </div>
            )}
            {selectedEstimate.internalNotes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-yellow-800 mb-1">Notes internes</h4>
                <p className="text-sm text-yellow-700 whitespace-pre-line">{selectedEstimate.internalNotes}</p>
              </div>
            )}

            {/* Signature (if accepted) */}
            {selectedEstimate.status === 'ACCEPTED' && selectedEstimate.signatureData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-800 mb-2">Signature du client</h4>
                <p className="text-sm text-green-700 mb-2">
                  Accepté par: <strong>{selectedEstimate.acceptedBy}</strong>
                  {selectedEstimate.acceptedAt && (
                    <span> le {new Date(selectedEstimate.acceptedAt).toLocaleDateString('fr-CA')}</span>
                  )}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedEstimate.signatureData}
                  alt="Signature du client"
                  className="max-h-24 border rounded bg-white p-2"
                />
              </div>
            )}

            {/* Decline reason */}
            {selectedEstimate.status === 'DECLINED' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-800 mb-1">Raison du refus</h4>
                <p className="text-sm text-red-700">
                  {selectedEstimate.declineReason || 'Aucune raison fournie'}
                </p>
                {selectedEstimate.declinedAt && (
                  <p className="text-xs text-red-500 mt-1">
                    Refusé le {new Date(selectedEstimate.declinedAt).toLocaleDateString('fr-CA')}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              {selectedEstimate.status === 'DRAFT' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setShowDetailModal(false); openEditModal(selectedEstimate); }}
                    icon={<Pencil className="w-4 h-4" />}
                  >
                    Modifier
                  </Button>
                  <Button
                    onClick={() => { setShowDetailModal(false); handleSend(selectedEstimate); }}
                    icon={<Send className="w-4 h-4" />}
                    disabled={saving || !selectedEstimate.customerEmail}
                  >
                    Envoyer au client
                  </Button>
                </>
              )}
              {selectedEstimate.status === 'ACCEPTED' && !selectedEstimate.invoiceId && (
                <Button
                  onClick={() => { setShowDetailModal(false); handleConvert(selectedEstimate); }}
                  icon={<ArrowRightCircle className="w-4 h-4" />}
                  disabled={saving}
                >
                  Convertir en facture
                </Button>
              )}
              {selectedEstimate.invoiceId && (
                <Button
                  variant="outline"
                  onClick={() => window.open('/admin/comptabilite/factures-clients', '_blank')}
                  icon={<FileText className="w-4 h-4" />}
                >
                  Voir la facture
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => { setShowDetailModal(false); handleDuplicate(selectedEstimate); }}
                icon={<Copy className="w-4 h-4" />}
              >
                Dupliquer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================================================================== */}
      {/* DELETE CONFIRM */}
      {/* ================================================================== */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment supprimer le devis <strong>{selectedEstimate?.estimateNumber}</strong> ?
            Cette action est irréversible.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

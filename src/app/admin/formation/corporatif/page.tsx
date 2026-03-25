'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, EmptyState, Modal, FormField, Input, DataTable, StatusBadge, type Column } from '@/components/admin';
import { Plus, Building2, Eye } from 'lucide-react';
import Link from 'next/link';

interface CorporateRow {
  id: string;
  companyName: string;
  slug: string;
  contactEmail: string;
  contactName: string | null;
  billingMethod: string;
  discountPercent: number;
  budgetAmount: number | null;
  budgetUsed: number;
  isActive: boolean;
  _count: { employees: number; enrollments: number; bundleOrders: number };
}

interface CorporateForm {
  companyName: string;
  slug: string;
  contactEmail: string;
  contactName: string;
  billingMethod: string;
  discountPercent: string;
  budgetAmount: string;
}

const emptyForm: CorporateForm = {
  companyName: '', slug: '', contactEmail: '', contactName: '',
  billingMethod: 'INVOICE', discountPercent: '15', budgetAmount: '',
};

export default function CorporatifPage() {
  const { t } = useTranslations();
  const [accounts, setAccounts] = useState<CorporateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CorporateForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/corporate');
      const data = await res.json();
      setAccounts(data.data ?? []);
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        companyName: form.companyName,
        slug: form.slug,
        contactEmail: form.contactEmail,
        contactName: form.contactName || undefined,
        billingMethod: form.billingMethod,
        discountPercent: parseFloat(form.discountPercent) || 0,
        budgetAmount: form.budgetAmount ? parseFloat(form.budgetAmount) : undefined,
      };
      const res = await fetch('/api/admin/lms/corporate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');
      setModalOpen(false);
      setForm(emptyForm);
      fetchAccounts();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  };

  const columns: Column<CorporateRow>[] = [
    { key: 'companyName', header: 'Compagnie', render: (a) => (
      <div>
        <Link href={`/admin/formation/corporatif/${a.id}`} className="font-medium hover:underline">{a.companyName}</Link>
        <span className="block text-xs text-muted-foreground">{a.contactEmail}</span>
      </div>
    )},
    { key: 'employees', header: 'Employes', render: (a) => a._count.employees.toString() },
    { key: 'enrollments', header: 'Inscriptions', render: (a) => a._count.enrollments.toString() },
    { key: 'discount', header: 'Rabais', render: (a) => `${a.discountPercent}%` },
    { key: 'budget', header: 'Budget', render: (a) => a.budgetAmount
      ? `${Number(a.budgetUsed).toFixed(0)} / ${Number(a.budgetAmount).toFixed(0)} $`
      : '-'
    },
    { key: 'billing', header: 'Facturation', render: (a) => (
      <StatusBadge variant={a.billingMethod === 'STRIPE' ? 'success' : 'neutral'}>{a.billingMethod}</StatusBadge>
    )},
    { key: 'actions', header: '', render: (a) => (
      <Link href={`/admin/formation/corporatif/${a.id}`} className="p-1 hover:bg-muted rounded inline-flex">
        <Eye className="h-4 w-4" />
      </Link>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.lms.corporateAccounts")}
        subtitle={`${accounts.length} compagnie(s) d'assurance`}
        actions={
          <Button onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau compte
          </Button>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Building2} title="Aucun compte corporatif" description="Ajoutez une compagnie d'assurance comme client." />
      ) : (
        <DataTable columns={columns} data={accounts} keyExtractor={(a) => a.id} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t("admin.lms.newAccount")}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <FormField label="Nom de la compagnie">
            <Input value={form.companyName} onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))} required placeholder="Chubb Insurance" />
          </FormField>
          <FormField label="Slug">
            <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} required placeholder="chubb" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email de contact">
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))} required />
            </FormField>
            <FormField label="Nom du contact">
              <Input value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Facturation">
              <select value={form.billingMethod} onChange={(e) => setForm(f => ({ ...f, billingMethod: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="INVOICE">Facture</option>
                <option value="PURCHASE_ORDER">Bon de commande</option>
                <option value="STRIPE">Stripe</option>
                <option value="PREPAID">Prepaye</option>
              </select>
            </FormField>
            <FormField label="Rabais (%)">
              <Input type="number" min="0" max="100" value={form.discountPercent} onChange={(e) => setForm(f => ({ ...f, discountPercent: e.target.value }))} />
            </FormField>
            <FormField label="Budget annuel ($)">
              <Input type="number" value={form.budgetAmount} onChange={(e) => setForm(f => ({ ...f, budgetAmount: e.target.value }))} placeholder="50000" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'En cours...' : 'Creer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, EmptyState, Modal, FormField, Input, Textarea, DataTable, type Column } from '@/components/admin';
import { Plus, Package, Pencil, Trash2 } from 'lucide-react';

interface BundleRow {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  corporatePrice: number | null;
  courseCount: number;
  enrollmentCount: number;
  isActive: boolean;
  items: Array<{ course: { id: string; title: string; slug: string } }>;
}

interface BundleForm {
  name: string;
  slug: string;
  description: string;
  price: string;
  corporatePrice: string;
  courseIds: string[];
}

const emptyForm: BundleForm = { name: '', slug: '', description: '', price: '', corporatePrice: '', courseIds: [] };

export default function ForfaitsPage() {
  const { t } = useTranslations();
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BundleForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/bundles');
      const data = await res.json();
      setBundles(data.data ?? []);
    } catch { setBundles([]); }
    finally { setLoading(false); }
  }, []);

  const fetchCourses = useCallback(async () => {
    const res = await fetch('/api/admin/lms/courses?limit=100');
    const data = await res.json();
    setCourses(data.data?.courses ?? []);
  }, []);

  useEffect(() => { fetchBundles(); fetchCourses(); }, [fetchBundles, fetchCourses]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
        corporatePrice: form.corporatePrice ? parseFloat(form.corporatePrice) : undefined,
        courseIds: form.courseIds,
      };

      const url = editingId ? `/api/admin/lms/bundles/${editingId}` : '/api/admin/lms/bundles';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');

      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchBundles();
    } catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleEdit = (bundle: BundleRow) => {
    setEditingId(bundle.id);
    setForm({
      name: bundle.name,
      slug: bundle.slug,
      description: '',
      price: bundle.price?.toString() ?? '',
      corporatePrice: bundle.corporatePrice?.toString() ?? '',
      courseIds: bundle.items.map(i => i.course.id),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce forfait?')) return;
    await fetch(`/api/admin/lms/bundles/${id}`, { method: 'DELETE' });
    fetchBundles();
  };

  const columns: Column<BundleRow>[] = [
    { key: 'name', header: 'Forfait', render: (b) => (
      <div>
        <span className="font-medium">{b.name}</span>
        <span className="block text-xs text-muted-foreground">{b.courseCount} cours</span>
      </div>
    )},
    { key: 'price', header: 'Prix individuel', render: (b) => b.price ? `${b.price} $` : 'Gratuit' },
    { key: 'corporatePrice', header: 'Prix corporatif', render: (b) => b.corporatePrice ? `${b.corporatePrice} $` : '-' },
    { key: 'enrollmentCount', header: 'Inscriptions', render: (b) => b.enrollmentCount.toString() },
    { key: 'actions', header: '', render: (b) => (
      <div className="flex gap-2">
        <button onClick={() => handleEdit(b)} className="p-1 hover:bg-muted rounded"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => handleDelete(b.id)} className="p-1 hover:bg-destructive/10 rounded text-destructive"><Trash2 className="h-4 w-4" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.lms.bundles")}
        subtitle={`${bundles.length} forfait(s) actif(s)`}
        actions={
          <Button onClick={() => { setEditingId(null); setForm(emptyForm); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nouveau forfait
          </Button>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : bundles.length === 0 ? (
        <EmptyState icon={Package} title="Aucun forfait" description="Creez votre premier forfait de formation." />
      ) : (
        <DataTable columns={columns} data={bundles} keyExtractor={(b) => b.id} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? t('admin.lms.bundleName') : t('admin.lms.newBundle')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <FormField label="Nom du forfait">
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          </FormField>
          <FormField label="Slug (URL)">
            <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} required placeholder="pqap-complet" />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prix individuel ($)">
              <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} placeholder="499.00" />
            </FormField>
            <FormField label="Prix corporatif ($)">
              <Input type="number" step="0.01" value={form.corporatePrice} onChange={(e) => setForm(f => ({ ...f, corporatePrice: e.target.value }))} placeholder="349.00" />
            </FormField>
          </div>
          <FormField label="Cours inclus">
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
              {courses.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded">
                  <input
                    type="checkbox"
                    checked={form.courseIds.includes(c.id)}
                    onChange={(e) => {
                      setForm(f => ({
                        ...f,
                        courseIds: e.target.checked
                          ? [...f.courseIds, c.id]
                          : f.courseIds.filter(id => id !== c.id),
                      }));
                    }}
                  />
                  {c.title}
                </label>
              ))}
            </div>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'En cours...' : editingId ? 'Modifier' : 'Creer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

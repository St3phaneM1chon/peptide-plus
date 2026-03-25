'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from '@/hooks/useTranslations';
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { PageHeader, Button, EmptyState, DataTable, type Column, Modal, FormField, Input } from '@/components/admin';
import { GitBranch, Plus } from 'lucide-react';

export default function Page() {
  const { t } = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lms/role-paths`);
      const json = await res.json();
      const list = json.data?.grades ?? json.data?.statements ?? json.data ?? [];
      setData(Array.isArray(list) ? list : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/admin/lms/role-paths', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      setModalOpen(false); setForm({}); fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'parcours', header: 'Parcours', render: (row: any) => String(row.name) },
    { key: 'role', header: 'Role', render: (row: any) => String(row.roleType) },
    { key: 'niveau', header: 'Niveau', render: (row: any) => String(row.level) },
    { key: 'etapes', header: 'Etapes', render: (row: any) => String(row._count?.steps ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Parcours par role" subtitle=""
        actions={<Button onClick={() => { setForm({}); setModalOpen(true); }}><Plus className="h-4 w-4 mr-2" /> {t('common.add')}</Button>}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={GitBranch} title={t('common.noData')} description={t('common.addToStart')} />
      ) : (
        <DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <FormField label="Nom"><Input value={form.name || ""} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></FormField>
          <FormField label="Slug"><Input value={form.slug || ""} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} /></FormField>
          <FormField label="Type role"><Input value={form.roleType || ""} onChange={(e) => setForm((f: any) => ({ ...f, roleType: e.target.value }))} /></FormField>
          <FormField label="Niveau"><Input value={form.level || ""} onChange={(e) => setForm((f: any) => ({ ...f, level: e.target.value }))} /></FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? t('common.inProgress') : t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

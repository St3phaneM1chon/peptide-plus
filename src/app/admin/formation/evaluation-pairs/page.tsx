'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from '@/hooks/useTranslations';
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { PageHeader, Button, EmptyState, DataTable, type Column, Modal, FormField, Input, Textarea } from '@/components/admin';
import { UserCheck, Plus } from 'lucide-react';

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
      const res = await fetch(`/api/admin/lms/peer-review`);
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
      const res = await fetch('/api/admin/lms/peer-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      setModalOpen(false); setForm({}); fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'exercice', header: 'Exercice', render: (row: any) => String(row.title) },
    { key: 'soumissions', header: 'Soumissions', render: (row: any) => String(row._count?.submissions ?? 0) },
    { key: 'rubrique', header: 'Rubrique', render: (row: any) => String(row.rubric?.name || '-') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Evaluation par les pairs" subtitle=""
        actions={<Button onClick={() => { setForm({}); setModalOpen(true); }}><Plus className="h-4 w-4 mr-2" /> {t('common.add')}</Button>}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={UserCheck} title={t('common.noData')} description={t('common.addToStart')} />
      ) : (
        <DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <FormField label="ID Cours"><Input value={form.courseId || ""} onChange={(e) => setForm((f: any) => ({ ...f, courseId: e.target.value }))} /></FormField>
          <FormField label="ID Lecon"><Input value={form.lessonId || ""} onChange={(e) => setForm((f: any) => ({ ...f, lessonId: e.target.value }))} /></FormField>
          <FormField label="Titre"><Input value={form.title || ""} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></FormField>
          <FormField label="Instructions"><Textarea value={form.instructions || ""} onChange={(e) => setForm((f: any) => ({ ...f, instructions: e.target.value }))} /></FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? t('common.inProgress') : t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

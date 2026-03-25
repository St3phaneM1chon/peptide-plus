'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from '@/hooks/useTranslations';
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { PageHeader, Button, EmptyState, DataTable, type Column, Modal, FormField, Input } from '@/components/admin';
import { Clock, Plus } from 'lucide-react';

export default function Page() {
  const { t } = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [courseId, setCourseId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lms/drip-schedule?courseId=${courseId}`);
      const json = await res.json();
      const list = json.data?.grades ?? json.data?.statements ?? json.data ?? [];
      setData(Array.isArray(list) ? list : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { if (courseId) fetchData(); }, [fetchData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/admin/lms/drip-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      setModalOpen(false); setForm({}); fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'chapitre', header: 'Chapitre', render: (row: any) => String(String(row.chapterId).slice(0,12) + '...') },
    { key: 'type', header: 'Type', render: (row: any) => String(row.unlockType) },
    { key: 'delai', header: 'Delai', render: (row: any) => String(row.delayDays != null ? row.delayDays + 'j' : '-') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Diffusion progressive" subtitle=""
        actions={<Button onClick={() => { setForm({}); setModalOpen(true); }}><Plus className="h-4 w-4 mr-2" /> {t('common.add')}</Button>}
      />
      <div className="flex gap-2"><input type="text" placeholder="ID du cours" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-md border px-3 py-2 text-sm w-64" /><Button onClick={fetchData} variant="outline">{t('common.load')}</Button></div>
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={Clock} title={t('common.noData')} description={t('common.addToStart')} />
      ) : (
        <DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <FormField label="ID Cours"><Input value={form.courseId || ""} onChange={(e) => setForm((f: any) => ({ ...f, courseId: e.target.value }))} /></FormField>
          <FormField label="ID Chapitre"><Input value={form.chapterId || ""} onChange={(e) => setForm((f: any) => ({ ...f, chapterId: e.target.value }))} /></FormField>
          <FormField label="Type (delay/date)"><Input value={form.unlockType || ""} onChange={(e) => setForm((f: any) => ({ ...f, unlockType: e.target.value }))} /></FormField>
          <FormField label="Delai jours"><Input type="number" value={form.delayDays || ""} onChange={(e) => setForm((f: any) => ({ ...f, delayDays: e.target.value }))} /></FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? t('common.inProgress') : t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

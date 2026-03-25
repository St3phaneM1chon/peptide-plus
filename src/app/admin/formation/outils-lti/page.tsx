'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from '@/hooks/useTranslations';
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { PageHeader, Button, EmptyState, DataTable, type Column, Modal, FormField, Input } from '@/components/admin';
import { ExternalLink, Plus } from 'lucide-react';

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
      const res = await fetch(`/api/admin/lms/lti-tools`);
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
      const res = await fetch('/api/admin/lms/lti-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      setModalOpen(false); setForm({}); fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const columns: Column<any>[] = [
    { key: 'outil', header: 'Outil', render: (row: any) => String(row.name) },
    { key: 'issuer', header: 'Issuer', render: (row: any) => String(row.issuer) },
    { key: 'lancements', header: 'Lancements', render: (row: any) => String(row._count?.launches ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Outils LTI" subtitle=""
        actions={<Button onClick={() => { setForm({}); setModalOpen(true); }}><Plus className="h-4 w-4 mr-2" /> {t('common.add')}</Button>}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={ExternalLink} title={t('common.noData')} description={t('common.addToStart')} />
      ) : (
        <DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <FormField label="Nom"><Input value={form.name || ""} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} /></FormField>
          <FormField label="Issuer URL"><Input value={form.issuer || ""} onChange={(e) => setForm((f: any) => ({ ...f, issuer: e.target.value }))} /></FormField>
          <FormField label="Client ID"><Input value={form.clientId || ""} onChange={(e) => setForm((f: any) => ({ ...f, clientId: e.target.value }))} /></FormField>
          <FormField label="Auth URL"><Input value={form.authLoginUrl || ""} onChange={(e) => setForm((f: any) => ({ ...f, authLoginUrl: e.target.value }))} /></FormField>
          <FormField label="Token URL"><Input value={form.authTokenUrl || ""} onChange={(e) => setForm((f: any) => ({ ...f, authTokenUrl: e.target.value }))} /></FormField>
          <FormField label="JWKS URL"><Input value={form.jwksUrl || ""} onChange={(e) => setForm((f: any) => ({ ...f, jwksUrl: e.target.value }))} /></FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? t('common.inProgress') : t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

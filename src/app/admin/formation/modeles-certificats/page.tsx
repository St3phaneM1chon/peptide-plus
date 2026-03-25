'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, EmptyState, Modal, FormField, Input, Textarea } from '@/components/admin';
import { Plus, FileCheck, Pencil, Trash2, Star } from 'lucide-react';
import { ConfirmProvider, useConfirm } from '@/components/lms/ConfirmDialog';

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  style: string;
  logoUrl: string | null;
  signatureText: string | null;
  footerText: string | null;
  validForDays: number;
  isDefault: boolean;
  _count?: { certificates: number };
}

interface TemplateForm {
  name: string;
  description: string;
  style: string;
  logoUrl: string;
  signatureText: string;
  footerText: string;
  validForDays: string;
}

const emptyForm: TemplateForm = {
  name: '',
  description: '',
  style: 'classic',
  logoUrl: '',
  signatureText: '',
  footerText: '',
  validForDays: '0',
};

const STYLE_COLORS: Record<string, string> = {
  classic: 'bg-amber-50 text-amber-800 border-amber-200',
  modern: 'bg-blue-50 text-blue-800 border-blue-200',
  premium: 'bg-purple-50 text-purple-800 border-purple-200',
};

const STYLE_GRADIENTS: Record<string, string> = {
  classic: 'from-amber-50 to-orange-50',
  modern: 'from-blue-50 to-cyan-50',
  premium: 'from-purple-50 to-pink-50',
};

export default function CertificateTemplatesPage() {
  return <ConfirmProvider><CertificateTemplatesPageInner /></ConfirmProvider>;
}
function CertificateTemplatesPageInner() {
  const { confirm: confirmDialog } = useConfirm();
  const { t } = useTranslations();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/certificate-templates');
      const data = await res.json();
      const list = data.data ?? data.templates ?? data;
      setTemplates(Array.isArray(list) ? list : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (tmpl: TemplateRow) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name,
      description: tmpl.description ?? '',
      style: tmpl.style || 'classic',
      logoUrl: tmpl.logoUrl ?? '',
      signatureText: tmpl.signatureText ?? '',
      footerText: tmpl.footerText ?? '',
      validForDays: String(tmpl.validForDays ?? 0),
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      style: form.style,
      logoUrl: form.logoUrl.trim() || null,
      signatureText: form.signatureText.trim() || null,
      footerText: form.footerText.trim() || null,
      validForDays: parseInt(form.validForDays, 10) || 0,
    };

    try {
      const url = editingId
        ? `/api/admin/lms/certificate-templates?id=${editingId}`
        : '/api/admin/lms/certificate-templates';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || err.message || t(
            editingId
              ? 'admin.lms.certTemplates.updateError'
              : 'admin.lms.certTemplates.createError'
          )
        );
      }

      closeModal();
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.lms.certTemplates.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: t('admin.lms.certTemplates.deleteConfirm'), message: t('admin.lms.certTemplates.deleteConfirm'), destructive: true });
    if (!ok) return;
    try {
      await fetch(`/api/admin/lms/certificate-templates?id=${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch {
      // silently fail
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`/api/admin/lms/certificate-templates?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      fetchTemplates();
    } catch {
      // silently fail
    }
  };

  const styleOptions = [
    { value: 'classic', label: t('admin.lms.certTemplates.styleClassic') },
    { value: 'modern', label: t('admin.lms.certTemplates.styleModern') },
    { value: 'premium', label: t('admin.lms.certTemplates.stylePremium') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.certTemplates.title')}
        subtitle={`${templates.length} ${t('admin.lms.certTemplates.total')}`}
        backHref="/admin/formation"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />{t('admin.lms.certTemplates.addTemplate')}
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white border border-slate-200 rounded-xl">
              <div className="h-32 bg-slate-100 rounded-t-xl" />
              <div className="p-5 space-y-2">
                <div className="h-5 bg-slate-100 rounded w-2/3" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={t('admin.lms.certTemplates.noTemplates')}
          description={t('admin.lms.certTemplates.noTemplatesDesc')}
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />{t('admin.lms.certTemplates.addTemplate')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tmpl => (
            <div
              key={tmpl.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group relative"
            >
              {/* Preview header */}
              <div className={`h-28 bg-gradient-to-br ${STYLE_GRADIENTS[tmpl.style] ?? STYLE_GRADIENTS.classic} flex items-center justify-center relative`}>
                <FileCheck className="w-10 h-10 text-slate-300" />

                {/* Default badge */}
                {tmpl.isDefault && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    <Star className="w-3 h-3 fill-indigo-500" />
                    {t('admin.lms.certTemplates.default')}
                  </span>
                )}

                {/* Actions */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!tmpl.isDefault && (
                    <button
                      onClick={() => handleSetDefault(tmpl.id)}
                      className="p-1.5 rounded bg-white/80 backdrop-blur-sm hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors"
                      title={t('admin.lms.certTemplates.setDefault')}
                      aria-label={t('admin.lms.certTemplates.setDefault')}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(tmpl)}
                    className="p-1.5 rounded bg-white/80 backdrop-blur-sm hover:bg-white text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={t('admin.lms.certTemplates.editTemplate')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(tmpl.id)}
                    className="p-1.5 rounded bg-white/80 backdrop-blur-sm hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                    aria-label={t('admin.lms.certTemplates.deleteConfirm')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-medium text-slate-900 text-sm">{tmpl.name}</h3>
                  {tmpl.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{tmpl.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${STYLE_COLORS[tmpl.style] ?? STYLE_COLORS.classic}`}>
                    {styleOptions.find(s => s.value === tmpl.style)?.label ?? tmpl.style}
                  </span>
                  {tmpl.validForDays > 0 && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-50 text-slate-600">
                      {tmpl.validForDays} {t('admin.lms.certTemplates.daysValidity')}
                    </span>
                  )}
                  {tmpl.validForDays === 0 && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700">
                      {t('admin.lms.certTemplates.noExpiry')}
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs text-slate-500 tabular-nums">
                    {tmpl._count?.certificates ?? 0} {t('admin.lms.certTemplates.coursesUsing')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? t('admin.lms.certTemplates.editTemplate') : t('admin.lms.certTemplates.addTemplate')}
        footer={
          <>
            <Button onClick={closeModal}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim()}
            >
              {submitting ? t('admin.lms.certTemplates.saving') : t('admin.lms.certTemplates.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label={t('admin.lms.certTemplates.templateName')} htmlFor="tmplName" required>
            <Input
              id="tmplName"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('admin.lms.certTemplates.namePlaceholder')}
              required
              autoFocus
            />
          </FormField>

          <FormField label={t('admin.lms.certTemplates.description')} htmlFor="tmplDesc">
            <Textarea
              id="tmplDesc"
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('admin.lms.certTemplates.descriptionPlaceholder')}
              rows={2}
            />
          </FormField>

          <FormField label={t('admin.lms.certTemplates.style')} htmlFor="tmplStyle">
            <select
              id="tmplStyle"
              value={form.style}
              onChange={(e) => setForm(prev => ({ ...prev, style: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900
                bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
            >
              {styleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label={t('admin.lms.certTemplates.logoUrl')} htmlFor="tmplLogo">
            <Input
              id="tmplLogo"
              value={form.logoUrl}
              onChange={(e) => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
              placeholder={t('admin.lms.certTemplates.logoPlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.lms.certTemplates.signatureText')} htmlFor="tmplSig">
            <Input
              id="tmplSig"
              value={form.signatureText}
              onChange={(e) => setForm(prev => ({ ...prev, signatureText: e.target.value }))}
              placeholder={t('admin.lms.certTemplates.signaturePlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.lms.certTemplates.footerText')} htmlFor="tmplFooter">
            <Input
              id="tmplFooter"
              value={form.footerText}
              onChange={(e) => setForm(prev => ({ ...prev, footerText: e.target.value }))}
              placeholder={t('admin.lms.certTemplates.footerPlaceholder')}
            />
          </FormField>

          <FormField
            label={t('admin.lms.certTemplates.validForDays')}
            htmlFor="tmplValidity"
            hint={t('admin.lms.certTemplates.validForDaysHint')}
          >
            <Input
              id="tmplValidity"
              type="number"
              min="0"
              value={form.validForDays}
              onChange={(e) => setForm(prev => ({ ...prev, validForDays: e.target.value }))}
              placeholder="0"
            />
          </FormField>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

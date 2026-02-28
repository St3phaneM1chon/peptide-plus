'use client';

/**
 * Admin Consent Templates Page — Builder for consent form templates
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  ClipboardCheck, Plus, Edit2, Trash2, Loader2, Save, X,
  GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Question {
  id: string;
  question: string;
  type: 'checkbox' | 'text' | 'signature';
  required: boolean;
}

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: number;
  isActive: boolean;
  type: string;
  questions: Question[];
  legalText: string | null;
  createdAt: string;
  _count: { consents: number };
}

const typeOptionKeys = ['VIDEO_APPEARANCE', 'TESTIMONIAL', 'PHOTO', 'CASE_STUDY', 'MARKETING', 'OTHER'];

const emptyQuestion = (): Question => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  question: '',
  type: 'checkbox',
  required: true,
});

export default function ConsentTemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'VIDEO_APPEARANCE',
    questions: [emptyQuestion()] as Question[],
    legalText: '',
    isActive: true,
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/consent-templates');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTemplates(data.templates);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const resetForm = () => {
    setForm({ name: '', description: '', type: 'VIDEO_APPEARANCE', questions: [emptyQuestion()], legalText: '', isActive: true });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (template: Template) => {
    setForm({
      name: template.name,
      description: template.description || '',
      type: template.type,
      questions: (template.questions as Question[]) || [emptyQuestion()],
      legalText: template.legalText || '',
      isActive: template.isActive,
    });
    setEditingId(template.id);
    setShowForm(true);
  };

  const addQuestion = () => {
    setForm(f => ({ ...f, questions: [...f.questions, emptyQuestion()] }));
  };

  const removeQuestion = (idx: number) => {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));
  };

  const updateQuestion = (idx: number, field: keyof Question, value: string | boolean) => {
    setForm(f => ({
      ...f,
      questions: f.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (form.questions.length === 0 || !form.questions[0].question.trim()) {
      toast.error('At least one question is required');
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/admin/consent-templates/${editingId}`
        : '/api/admin/consent-templates';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetchWithCSRF(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          type: form.type,
          questions: form.questions.filter(q => q.question.trim()),
          legalText: form.legalText || null,
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      toast.success(editingId ? 'Template updated' : 'Template created');
      resetForm();
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetchWithCSRF(`/api/admin/consent-templates/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.consentTemplates.title')}
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
          >
            <Plus className="h-4 w-4" />
            {t('admin.consentTemplates.create')}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">{editingId ? t('admin.consentTemplates.edit') : t('admin.consentTemplates.create')}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.consentTemplates.labelName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder={t('admin.consentTemplates.namePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.consentTemplates.labelType')}</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {typeOptionKeys.map(k => <option key={k} value={k}>{t(`consentType.${k}`)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.consentTemplates.labelDescription')}</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Questions Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">{t('admin.consentTemplates.labelQuestions')}</label>
              <button onClick={addQuestion} className="text-sm text-orange-600 hover:text-orange-800 flex items-center gap-1">
                <Plus className="h-3 w-3" /> {t('admin.consentTemplates.addQuestion')}
              </button>
            </div>
            <div className="space-y-3">
              {form.questions.map((q, idx) => (
                <div key={q.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded border">
                  <GripVertical className="h-4 w-4 text-gray-400 mt-2 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={q.question}
                      onChange={e => updateQuestion(idx, 'question', e.target.value)}
                      className="w-full border rounded px-3 py-1.5 text-sm"
                      placeholder={t('admin.consentTemplates.questionPlaceholder')}
                    />
                    <div className="flex gap-3 items-center">
                      <select
                        value={q.type}
                        onChange={e => updateQuestion(idx, 'type', e.target.value)}
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="checkbox">{t('questionType.checkbox')}</option>
                        <option value="text">{t('questionType.text')}</option>
                        <option value="signature">{t('questionType.signature')}</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={e => updateQuestion(idx, 'required', e.target.checked)}
                        />
                        {t('admin.consentTemplates.required')}
                      </label>
                    </div>
                  </div>
                  {form.questions.length > 1 && (
                    <button onClick={() => removeQuestion(idx)} className="text-red-400 hover:text-red-600 mt-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.consentTemplates.labelLegalText')}</label>
            <textarea
              value={form.legalText}
              onChange={e => setForm(f => ({ ...f, legalText: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              rows={4}
              placeholder={t('admin.consentTemplates.legalTextPlaceholder')}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              id="isActive"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">{t('admin.consentTemplates.active')}</label>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingId ? t('admin.consentTemplates.update') : t('common.create')}
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            {t('admin.consentTemplates.empty')}
          </div>
        ) : (
          <div className="divide-y">
            {templates.map(template => (
              <div key={template.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{template.name}</h3>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {t(`consentType.${template.type}`)}
                    </span>
                    {template.isActive ? (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded flex items-center gap-0.5">
                        <Eye className="h-3 w-3" /> {t('admin.consentTemplates.active')}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded flex items-center gap-0.5">
                        <EyeOff className="h-3 w-3" /> {t('admin.consentTemplates.inactive')}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">v{template.version}</span>
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {(template.questions as Question[]).length} question(s) · {template._count.consents} consent(s) · {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(template)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title={t('common.edit')}
                  >
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setDeleteId(template.id)}
                    className="p-2 hover:bg-red-50 rounded"
                    title={t('common.delete')}
                    disabled={template._count.consents > 0}
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteId && (
        <ConfirmDialog
          title={t('admin.consentTemplates.deleteTitle')}
          message={t('admin.consentTemplates.deleteMessage')}
          confirmLabel={t('common.delete')}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

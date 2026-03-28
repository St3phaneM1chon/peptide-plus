'use client';

/**
 * Admin Form Builder Page
 * Visual form builder for creating and managing forms.
 * Outlook-style layout: content list (left) + detail/builder (right).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, Copy, Eye, EyeOff, GripVertical,
  FileText, Mail, Phone, Hash, AlignLeft, ChevronDown,
  Radio, CheckSquare, Calendar, Upload, Star, EyeIcon,
  Loader2, Download, Settings, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import { EmptyState } from '@/components/admin/EmptyState';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ────────────────────────────────────────────────────────

interface FieldOption {
  label: string;
  value: string;
}

interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
}

interface FieldDefinition {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: FieldValidation;
  options?: FieldOption[];
  defaultValue?: string;
  helpText?: string;
  width?: 'full' | 'half';
}

interface FormSettings {
  notifyEmails?: string[];
  redirectUrl?: string;
  webhookUrl?: string;
  successMessage?: string;
  recaptcha?: boolean;
}

interface FormDef {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  fields: FieldDefinition[];
  settings: FormSettings;
  isActive: boolean;
  submitCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name?: string | null; email: string };
  _count?: { submissions: number };
}

interface Submission {
  id: string;
  data: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

// ── Field type metadata ──────────────────────────────────────────

const FIELD_TYPES = [
  { type: 'text', label: 'Texte', icon: FileText },
  { type: 'email', label: 'Courriel', icon: Mail },
  { type: 'phone', label: 'Téléphone', icon: Phone },
  { type: 'number', label: 'Nombre', icon: Hash },
  { type: 'textarea', label: 'Zone de texte', icon: AlignLeft },
  { type: 'select', label: 'Liste déroulante', icon: ChevronDown },
  { type: 'radio', label: 'Boutons radio', icon: Radio },
  { type: 'checkbox', label: 'Case à cocher', icon: CheckSquare },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'file', label: 'Fichier', icon: Upload },
  { type: 'rating', label: 'Évaluation (1-5)', icon: Star },
] as const;

// ── Helper ───────────────────────────────────────────────────────

function genId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Main Component ───────────────────────────────────────────────

export default function FormBuilderPage() {
  const { t } = useI18n();
  const [forms, setForms] = useState<FormDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState<FormDef | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Builder state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFields, setFormFields] = useState<FieldDefinition[]>([]);
  const [formSettings, setFormSettings] = useState<FormSettings>({});
  const [formActive, setFormActive] = useState(true);
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null);

  // Submissions viewer
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subsTotal, setSubsTotal] = useState(0);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);

  // ── Fetch forms ────────────────────────────────────────────────

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/forms', { headers: addCSRFHeader({}) });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setForms(data.forms || []);
    } catch {
      toast.error('Erreur lors du chargement des formulaires');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  // ── Content list items ─────────────────────────────────────────

  const contentItems: ContentListItem[] = forms.map((f) => ({
    id: f.id,
    title: f.name,
    subtitle: f.description || undefined,
    preview: `${(f._count?.submissions ?? f.submitCount) || 0} soumission(s) · ${f.fields?.length || 0} champ(s)`,
    timestamp: f.updatedAt,
    badges: [
      {
        text: f.isActive ? 'Actif' : 'Inactif',
        variant: f.isActive ? 'success' as const : 'neutral' as const,
      },
    ],
    avatar: { text: f.name.charAt(0).toUpperCase(), color: f.isActive ? '#4f46e5' : '#94a3b8' },
  }));

  const selectedForm = forms.find((f) => f.id === selectedId) || null;

  // ── Builder helpers ────────────────────────────────────────────

  const openBuilder = (form?: FormDef) => {
    if (form) {
      setEditingForm(form);
      setFormName(form.name);
      setFormDesc(form.description || '');
      setFormFields(Array.isArray(form.fields) ? form.fields : []);
      setFormSettings(form.settings || {});
      setFormActive(form.isActive);
    } else {
      setEditingForm(null);
      setFormName('');
      setFormDesc('');
      setFormFields([]);
      setFormSettings({});
      setFormActive(true);
    }
    setEditingFieldIdx(null);
    setShowBuilder(true);
    setShowSettings(false);
  };

  const addField = (type: string) => {
    const fieldType = FIELD_TYPES.find((ft) => ft.type === type);
    const newField: FieldDefinition = {
      id: genId(),
      type,
      label: fieldType?.label || type,
      placeholder: '',
      required: false,
      width: 'full',
    };
    if (type === 'select' || type === 'radio') {
      newField.options = [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
      ];
    }
    setFormFields((prev) => [...prev, newField]);
    setEditingFieldIdx(formFields.length);
  };

  const removeField = (idx: number) => {
    setFormFields((prev) => prev.filter((_, i) => i !== idx));
    if (editingFieldIdx === idx) setEditingFieldIdx(null);
    else if (editingFieldIdx !== null && editingFieldIdx > idx) setEditingFieldIdx(editingFieldIdx - 1);
  };

  const moveField = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= formFields.length) return;
    const copy = [...formFields];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setFormFields(copy);
    if (editingFieldIdx === idx) setEditingFieldIdx(newIdx);
    else if (editingFieldIdx === newIdx) setEditingFieldIdx(idx);
  };

  const updateField = (idx: number, updates: Partial<FieldDefinition>) => {
    setFormFields((prev) => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  // ── Save form ──────────────────────────────────────────────────

  const saveForm = async () => {
    if (!formName.trim()) { toast.error('Le nom du formulaire est requis'); return; }
    if (formFields.length === 0) { toast.error('Ajoutez au moins un champ'); return; }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || null,
        fields: formFields,
        settings: formSettings,
        isActive: formActive,
      };

      const url = editingForm ? `/api/admin/forms/${editingForm.id}` : '/api/admin/forms';
      const method = editingForm ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      toast.success(editingForm ? 'Formulaire mis à jour' : 'Formulaire créé');
      setShowBuilder(false);
      await fetchForms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete form ────────────────────────────────────────────────

  const deleteForm = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/forms/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Formulaire supprimé');
      if (selectedId === id) setSelectedId(null);
      await fetchForms();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setConfirmDelete(null);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────

  const toggleActive = async (form: FormDef) => {
    try {
      const res = await fetch(`/api/admin/forms/${form.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: !form.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success(form.isActive ? 'Formulaire désactivé' : 'Formulaire activé');
      await fetchForms();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // ── Fetch submissions ──────────────────────────────────────────

  const fetchSubmissions = async (formId: string) => {
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/admin/forms/${formId}/submissions?limit=100`, { headers: addCSRFHeader({}) });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setSubsTotal(data.total || 0);
      setShowSubmissions(true);
    } catch {
      toast.error('Erreur lors du chargement des soumissions');
    } finally {
      setLoadingSubs(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────

  const exportCsv = () => {
    if (!selectedForm || submissions.length === 0) return;
    const fields = Array.isArray(selectedForm.fields) ? selectedForm.fields : [];
    const headers = ['Date', ...fields.map((f) => f.label), 'IP'];
    const rows = submissions.map((s) => {
      const d = s.data as Record<string, string>;
      return [
        new Date(s.createdAt).toLocaleString(),
        ...fields.map((f) => (d[f.id] || '').toString().replace(/"/g, '""')),
        s.ip || '',
      ];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedForm.slug}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Duplicate form ─────────────────────────────────────────────

  const duplicateForm = (form: FormDef) => {
    setEditingForm(null);
    setFormName(`${form.name} (copie)`);
    setFormDesc(form.description || '');
    setFormFields(Array.isArray(form.fields) ? form.fields.map(f => ({ ...f, id: genId() })) : []);
    setFormSettings(form.settings || {});
    setFormActive(true);
    setEditingFieldIdx(null);
    setShowBuilder(true);
    setShowSettings(false);
  };

  // ── Detail pane ────────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedForm) {
      return (
        <DetailPane>
          <EmptyState
            title={t('admin.formBuilder.selectForm')}
            description={t('admin.formBuilder.selectFormDesc')}
            icon={FileText}
          />
        </DetailPane>
      );
    }

    return (
      <DetailPane>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{selectedForm.name}</h2>
              {selectedForm.description && (
                <p className="text-sm text-slate-500 mt-1">{selectedForm.description}</p>
              )}
              <p className="text-xs text-slate-400 mt-2">
                Slug: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{selectedForm.slug}</code>
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => toggleActive(selectedForm)}>
                {selectedForm.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openBuilder(selectedForm)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => duplicateForm(selectedForm)}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(selectedForm.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-indigo-50 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700">{selectedForm._count?.submissions ?? selectedForm.submitCount}</p>
              <p className="text-xs text-indigo-500">Soumissions</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">{selectedForm.fields?.length || 0}</p>
              <p className="text-xs text-slate-500">Champs</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{selectedForm.isActive ? 'Actif' : 'Inactif'}</p>
              <p className="text-xs text-emerald-500">Statut</p>
            </div>
          </div>

          {/* Fields preview */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Champs du formulaire</h3>
            <div className="space-y-2">
              {(Array.isArray(selectedForm.fields) ? selectedForm.fields : []).map((f, i) => {
                const Icon = FIELD_TYPES.find((ft) => ft.type === f.type)?.icon || FileText;
                return (
                  <div key={f.id || i} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 text-sm">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700 font-medium">{f.label}</span>
                    <span className="text-slate-400 text-xs">({FIELD_TYPES.find((ft) => ft.type === f.type)?.label || f.type})</span>
                    {f.required && <span className="text-red-400 text-xs">*</span>}
                    <span className="ml-auto text-xs text-slate-400">{f.width === 'half' ? '50%' : '100%'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Public URL */}
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-700 mb-1">URL publique du formulaire</p>
            <div className="flex items-center gap-2">
              <code className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                /api/forms/{selectedForm.slug}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/forms/${selectedForm.slug}`);
                  toast.success('URL copiée');
                }}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Copier
              </button>
            </div>
          </div>

          {/* View submissions button */}
          <div className="flex gap-3">
            <Button
              onClick={() => fetchSubmissions(selectedForm.id)}
              disabled={loadingSubs}
              className="flex-1"
            >
              {loadingSubs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <EyeIcon className="w-4 h-4 mr-2" />}
              Voir les soumissions ({selectedForm._count?.submissions ?? selectedForm.submitCount})
            </Button>
            {submissions.length > 0 && showSubmissions && (
              <Button variant="secondary" onClick={exportCsv}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
            )}
          </div>

          {/* Submissions table */}
          {showSubmissions && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 flex justify-between items-center">
                <h4 className="text-sm font-semibold text-slate-700">{subsTotal} soumission(s)</h4>
                <button onClick={() => setShowSubmissions(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {submissions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Aucune soumission</div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-xs text-slate-500 font-medium">Date</th>
                        {(Array.isArray(selectedForm.fields) ? selectedForm.fields : [])
                          .filter((f) => f.type !== 'hidden')
                          .map((f) => (
                            <th key={f.id} className="text-left p-3 text-xs text-slate-500 font-medium">{f.label}</th>
                          ))}
                        <th className="text-left p-3 text-xs text-slate-500 font-medium">IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => {
                        const d = s.data as Record<string, string>;
                        return (
                          <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="p-3 text-slate-600 whitespace-nowrap">
                              {new Date(s.createdAt).toLocaleString()}
                            </td>
                            {(Array.isArray(selectedForm.fields) ? selectedForm.fields : [])
                              .filter((f) => f.type !== 'hidden')
                              .map((f) => (
                                <td key={f.id} className="p-3 text-slate-700 max-w-[200px] truncate">
                                  {d[f.id] || '-'}
                                </td>
                              ))}
                            <td className="p-3 text-slate-400 text-xs">{s.ip || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </DetailPane>
    );
  };

  // ── Builder Modal ──────────────────────────────────────────────

  const renderBuilder = () => (
    <Modal
      isOpen={showBuilder}
      onClose={() => setShowBuilder(false)}
      title={editingForm ? `Modifier: ${editingForm.name}` : 'Nouveau formulaire'}
      size="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-h-[70vh] overflow-y-auto p-1">
        {/* Left: form meta + fields list */}
        <div className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nom du formulaire" htmlFor="fb-name" required>
              <Input
                id="fb-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Formulaire de contact"
              />
            </FormField>
            <FormField label="Description" htmlFor="fb-desc">
              <Input
                id="fb-desc"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Description optionnelle"
              />
            </FormField>
          </div>

          {/* Field list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Champs ({formFields.length})</h3>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  Actif
                </label>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Paramètres
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="rounded-xl bg-slate-50 p-4 mb-4 space-y-3">
                <FormField label="Emails de notification (séparés par virgule)" htmlFor="fb-notify">
                  <Input
                    id="fb-notify"
                    value={(formSettings.notifyEmails || []).join(', ')}
                    onChange={(e) => setFormSettings({
                      ...formSettings,
                      notifyEmails: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })}
                    placeholder="admin@example.com, team@example.com"
                  />
                </FormField>
                <FormField label="URL de redirection après soumission" htmlFor="fb-redirect">
                  <Input
                    id="fb-redirect"
                    value={formSettings.redirectUrl || ''}
                    onChange={(e) => setFormSettings({ ...formSettings, redirectUrl: e.target.value })}
                    placeholder="https://example.com/merci"
                  />
                </FormField>
                <FormField label="Webhook URL" htmlFor="fb-webhook">
                  <Input
                    id="fb-webhook"
                    value={formSettings.webhookUrl || ''}
                    onChange={(e) => setFormSettings({ ...formSettings, webhookUrl: e.target.value })}
                    placeholder="https://hooks.example.com/form"
                  />
                </FormField>
                <FormField label="Message de succès" htmlFor="fb-success">
                  <Input
                    id="fb-success"
                    value={formSettings.successMessage || ''}
                    onChange={(e) => setFormSettings({ ...formSettings, successMessage: e.target.value })}
                    placeholder="Merci pour votre soumission !"
                  />
                </FormField>
              </div>
            )}

            {/* Fields list */}
            {formFields.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                Ajoutez des champs depuis le panneau de droite
              </div>
            ) : (
              <div className="space-y-2">
                {formFields.map((field, idx) => {
                  const Icon = FIELD_TYPES.find((ft) => ft.type === field.type)?.icon || FileText;
                  const isEditing = editingFieldIdx === idx;
                  return (
                    <div key={field.id}>
                      <div
                        className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                          isEditing ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-slate-50 hover:bg-slate-100'
                        }`}
                        onClick={() => setEditingFieldIdx(isEditing ? null : idx)}
                      >
                        <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 flex-1">{field.label}</span>
                        {field.required && <span className="text-red-400 text-xs">requis</span>}
                        <span className="text-xs text-slate-400">{field.width === 'half' ? '50%' : '100%'}</span>
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); moveField(idx, 'up'); }} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveField(idx, 'down'); }} disabled={idx === formFields.length - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); removeField(idx); }} className="p-0.5 text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Inline field editor */}
                      {isEditing && (
                        <div className="mt-2 ml-6 p-4 rounded-lg bg-white border border-slate-200 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Libellé" htmlFor={`fl-${idx}`}>
                              <Input
                                id={`fl-${idx}`}
                                value={field.label}
                                onChange={(e) => updateField(idx, { label: e.target.value })}
                              />
                            </FormField>
                            <FormField label="Placeholder" htmlFor={`fp-${idx}`}>
                              <Input
                                id={`fp-${idx}`}
                                value={field.placeholder || ''}
                                onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                              />
                            </FormField>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={field.required || false}
                                onChange={(e) => updateField(idx, { required: e.target.checked })}
                                className="accent-indigo-600"
                              />
                              Requis
                            </label>
                            <FormField label="Largeur" htmlFor={`fw-${idx}`}>
                              <select
                                id={`fw-${idx}`}
                                value={field.width || 'full'}
                                onChange={(e) => updateField(idx, { width: e.target.value as 'full' | 'half' })}
                                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900"
                              >
                                <option value="full">Pleine largeur</option>
                                <option value="half">Demi-largeur</option>
                              </select>
                            </FormField>
                          </div>
                          <FormField label="Texte d'aide" htmlFor={`fh-${idx}`}>
                            <Input
                              id={`fh-${idx}`}
                              value={field.helpText || ''}
                              onChange={(e) => updateField(idx, { helpText: e.target.value })}
                              placeholder="Aide contextuelle affichée sous le champ"
                            />
                          </FormField>

                          {/* Options editor for select/radio */}
                          {(field.type === 'select' || field.type === 'radio') && (
                            <div>
                              <p className="text-xs font-medium text-slate-700 mb-2">Options</p>
                              {(field.options || []).map((opt, oi) => (
                                <div key={oi} className="flex gap-2 mb-2">
                                  <Input
                                    value={opt.label}
                                    onChange={(e) => {
                                      const opts = [...(field.options || [])];
                                      opts[oi] = { ...opts[oi], label: e.target.value, value: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') };
                                      updateField(idx, { options: opts });
                                    }}
                                    placeholder="Label"
                                    className="flex-1"
                                  />
                                  <button
                                    onClick={() => {
                                      const opts = (field.options || []).filter((_, i) => i !== oi);
                                      updateField(idx, { options: opts });
                                    }}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const opts = [...(field.options || []), { label: `Option ${(field.options?.length || 0) + 1}`, value: `option${(field.options?.length || 0) + 1}` }];
                                  updateField(idx, { options: opts });
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-800"
                              >
                                + Ajouter une option
                              </button>
                            </div>
                          )}

                          {/* Validation for number */}
                          {field.type === 'number' && (
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Minimum" htmlFor={`fmin-${idx}`}>
                                <Input
                                  id={`fmin-${idx}`}
                                  type="number"
                                  value={field.validation?.min?.toString() || ''}
                                  onChange={(e) => updateField(idx, { validation: { ...field.validation, min: e.target.value ? Number(e.target.value) : undefined } })}
                                />
                              </FormField>
                              <FormField label="Maximum" htmlFor={`fmax-${idx}`}>
                                <Input
                                  id={`fmax-${idx}`}
                                  type="number"
                                  value={field.validation?.max?.toString() || ''}
                                  onChange={(e) => updateField(idx, { validation: { ...field.validation, max: e.target.value ? Number(e.target.value) : undefined } })}
                                />
                              </FormField>
                            </div>
                          )}

                          {/* Validation for text/textarea */}
                          {(field.type === 'text' || field.type === 'textarea') && (
                            <div className="grid grid-cols-2 gap-3">
                              <FormField label="Longueur min" htmlFor={`fminl-${idx}`}>
                                <Input
                                  id={`fminl-${idx}`}
                                  type="number"
                                  value={field.validation?.minLength?.toString() || ''}
                                  onChange={(e) => updateField(idx, { validation: { ...field.validation, minLength: e.target.value ? Number(e.target.value) : undefined } })}
                                />
                              </FormField>
                              <FormField label="Longueur max" htmlFor={`fmaxl-${idx}`}>
                                <Input
                                  id={`fmaxl-${idx}`}
                                  type="number"
                                  value={field.validation?.maxLength?.toString() || ''}
                                  onChange={(e) => updateField(idx, { validation: { ...field.validation, maxLength: e.target.value ? Number(e.target.value) : undefined } })}
                                />
                              </FormField>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: field type picker */}
        <div className="border-l border-slate-200 pl-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Ajouter un champ</h3>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => addField(type)}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left"
              >
                <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-medium text-slate-700">{label}</span>
              </button>
            ))}
          </div>

          {/* Quick templates */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Templates rapides</h4>
            <button
              onClick={() => {
                setFormFields([
                  { id: genId(), type: 'text', label: 'Nom complet', placeholder: 'Jean Tremblay', required: true, width: 'full' },
                  { id: genId(), type: 'email', label: 'Courriel', placeholder: 'jean@example.com', required: true, width: 'half' },
                  { id: genId(), type: 'phone', label: 'Téléphone', placeholder: '(514) 555-0123', required: false, width: 'half' },
                  { id: genId(), type: 'textarea', label: 'Message', placeholder: 'Votre message...', required: true, width: 'full' },
                ]);
                setFormName(formName || 'Formulaire de contact');
              }}
              className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Formulaire de contact
            </button>
            <button
              onClick={() => {
                setFormFields([
                  { id: genId(), type: 'text', label: 'Nom complet', required: true, width: 'half' },
                  { id: genId(), type: 'email', label: 'Courriel', required: true, width: 'half' },
                  { id: genId(), type: 'select', label: 'Sujet', required: true, width: 'full', options: [
                    { label: 'Question générale', value: 'general' },
                    { label: 'Support technique', value: 'support' },
                    { label: 'Partenariat', value: 'partnership' },
                    { label: 'Autre', value: 'other' },
                  ]},
                  { id: genId(), type: 'textarea', label: 'Détails', required: true, width: 'full' },
                  { id: genId(), type: 'rating', label: 'Évaluation de votre expérience', required: false, width: 'full' },
                ]);
                setFormName(formName || 'Sondage de satisfaction');
              }}
              className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Sondage de satisfaction
            </button>
            <button
              onClick={() => {
                setFormFields([
                  { id: genId(), type: 'text', label: 'Prénom', required: true, width: 'half' },
                  { id: genId(), type: 'text', label: 'Nom', required: true, width: 'half' },
                  { id: genId(), type: 'email', label: 'Courriel', required: true, width: 'full' },
                  { id: genId(), type: 'phone', label: 'Téléphone', required: true, width: 'half' },
                  { id: genId(), type: 'text', label: 'Entreprise', required: false, width: 'half' },
                  { id: genId(), type: 'select', label: 'Comment avez-vous entendu parler de nous ?', required: false, width: 'full', options: [
                    { label: 'Moteur de recherche', value: 'search' },
                    { label: 'Réseaux sociaux', value: 'social' },
                    { label: 'Recommandation', value: 'referral' },
                    { label: 'Publicité', value: 'advertising' },
                    { label: 'Autre', value: 'other' },
                  ]},
                ]);
                setFormName(formName || 'Génération de leads');
              }}
              className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Génération de leads
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
        <Button variant="secondary" onClick={() => setShowBuilder(false)}>Annuler</Button>
        <Button onClick={saveForm} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {editingForm ? 'Mettre à jour' : 'Créer le formulaire'}
        </Button>
      </div>
    </Modal>
  );

  // ── Page render ────────────────────────────────────────────────

  return (
    <>
      <MobileSplitLayout
        showDetail={!!selectedId}
        list={
          <ContentList
            items={contentItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={loading}
            searchPlaceholder="Rechercher un formulaire..."
            emptyIcon={FileText}
            emptyTitle="Aucun formulaire"
            emptyDescription="Créez votre premier formulaire avec le bouton ci-dessus"
            headerActions={
              <Button size="sm" onClick={() => openBuilder()}>
                <Plus className="w-4 h-4 mr-1" />
                Nouveau
              </Button>
            }
          />
        }
        detail={renderDetail()}
      />

      {showBuilder && renderBuilder()}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Supprimer ce formulaire ?"
        message="Cette action supprimera également toutes les soumissions associées. Cette action est irréversible."
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={() => { if (confirmDelete) deleteForm(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

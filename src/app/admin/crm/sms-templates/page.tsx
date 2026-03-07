'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Plus, X, MessageSquare, Copy, Edit, Trash2,
  Eye, Variable, Check, Search, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface SmsTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

const SAMPLE_DATA: Record<string, string> = {
  firstName: 'John',
  lastName: 'Smith',
  companyName: 'Acme Corp',
  phone: '+1-555-0123',
  email: 'john@acme.com',
  dealTitle: 'Enterprise License',
  dealValue: '$15,000',
  agentName: 'Sarah',
  date: new Date().toLocaleDateString('en-US'),
  time: '2:00 PM',
  productName: 'BPC-157',
  orderNumber: 'ORD-12345',
};

function renderPreview(body: string, variables: Record<string, string>): string {
  let result = body;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{?${key}\\}?\\}`, 'gi'), value);
  }
  return result;
}

function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{?\w+\}?\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

export default function SmsTemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', body: '', variables: '' });
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [customVars, setCustomVars] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/sms-templates');
      const json = await res.json();
      if (json.success) setTemplates(json.data || []);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(tpl => {
      if (search && !tpl.name.toLowerCase().includes(search.toLowerCase()) && !tpl.body.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeFilter === 'active' && !tpl.isActive) return false;
      if (activeFilter === 'inactive' && tpl.isActive) return false;
      return true;
    });
  }, [templates, search, activeFilter]);

  const saveTemplate = async () => {
    if (!form.name.trim() || !form.body.trim()) { toast.error(t('admin.crm.nameBodyRequired') || 'Name and body required'); return; }
    setSaving(true);
    try {
      const variables = form.variables ? form.variables.split(',').map(v => v.trim()).filter(Boolean) : extractVariables(form.body);
      const url = editingId ? `/api/admin/crm/sms-templates/${editingId}` : '/api/admin/crm/sms-templates';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, body: form.body, variables }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingId ? (t('admin.crm.templateUpdated') || 'Template updated') : (t('admin.crm.templateCreated') || 'Template created'));
        setShowCreate(false);
        setEditingId(null);
        setForm({ name: '', body: '', variables: '' });
        fetchTemplates();
      } else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm(t('admin.crm.confirmDeleteTemplate') || 'Delete this template?')) return;
    try {
      const res = await fetch(`/api/admin/crm/sms-templates/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success(t('admin.crm.templateDeleted') || 'Template deleted'); fetchTemplates(); }
    } catch { toast.error('Failed to delete'); }
  };

  const toggleActive = async (tpl: SmsTemplate) => {
    try {
      const res = await fetch(`/api/admin/crm/sms-templates/${tpl.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !tpl.isActive }),
      });
      const json = await res.json();
      if (json.success) { toast.success(tpl.isActive ? 'Template deactivated' : 'Template activated'); fetchTemplates(); }
    } catch { toast.error('Failed'); }
  };

  const startEdit = (tpl: SmsTemplate) => {
    setForm({ name: tpl.name, body: tpl.body, variables: tpl.variables.join(', ') });
    setEditingId(tpl.id);
    setShowCreate(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(t('admin.crm.copied') || 'Copied!'),
      () => toast.error('Failed to copy')
    );
  };

  const formPreview = useMemo(() => {
    return renderPreview(form.body, { ...SAMPLE_DATA, ...customVars });
  }, [form.body, customVars]);

  const autoDetectedVars = useMemo(() => extractVariables(form.body), [form.body]);

  const segments = Math.ceil(form.body.length / 160) || 1;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.smsTemplates') || 'SMS Templates'}</h1>
            <p className="text-sm text-gray-500">{t('admin.crm.smsTemplatesDesc') || 'Create and manage SMS templates with merge fields'}</p>
          </div>
        </div>
        <button onClick={() => { setShowCreate(true); setEditingId(null); setForm({ name: '', body: '', variables: '' }); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700">
          <Plus className="h-4 w-4" /> {t('admin.crm.newTemplate') || 'New Template'}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('admin.crm.searchTemplates') || 'Search templates...'}
            className="w-full pl-10 pr-3 py-2 border rounded-md text-sm"
          />
        </div>
        <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">{t('common.all') || 'All'}</option>
          <option value="active">{t('common.active') || 'Active'}</option>
          <option value="inactive">{t('common.inactive') || 'Inactive'}</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-900">{templates.length}</p>
          <p className="text-xs text-gray-500">{t('admin.crm.totalTemplates') || 'Total Templates'}</p>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <p className="text-2xl font-bold text-green-600">{templates.filter(t => t.isActive).length}</p>
          <p className="text-xs text-gray-500">{t('common.active') || 'Active'}</p>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-400">{templates.filter(t => !t.isActive).length}</p>
          <p className="text-xs text-gray-500">{t('common.inactive') || 'Inactive'}</p>
        </div>
      </div>

      {/* Template List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{t('admin.crm.noTemplates') || 'No templates found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map(tpl => {
            const isPreview = previewId === tpl.id;
            const charCount = tpl.body.length;
            const segCount = Math.ceil(charCount / 160) || 1;
            const previewText = renderPreview(tpl.body, SAMPLE_DATA);

            return (
              <div key={tpl.id} className={`bg-white rounded-lg border overflow-hidden transition-all ${!tpl.isActive ? 'opacity-60' : ''}`}>
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{tpl.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${tpl.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {tpl.isActive ? (t('common.active') || 'Active') : (t('common.inactive') || 'Inactive')}
                        </span>
                        <span className="text-xs text-gray-400">{charCount} {t('admin.crm.chars') || 'chars'} / {segCount} {t('admin.crm.segments') || 'segment(s)'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setPreviewId(isPreview ? null : tpl.id)} className="p-1.5 hover:bg-teal-50 rounded text-teal-500" title={t('admin.crm.preview') || 'Preview'}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => copyToClipboard(tpl.body)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400" title={t('admin.crm.copy') || 'Copy'}>
                        <Copy className="h-4 w-4" />
                      </button>
                      <button onClick={() => startEdit(tpl)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400" title={t('common.edit') || 'Edit'}>
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleActive(tpl)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400" title={tpl.isActive ? 'Deactivate' : 'Activate'}>
                        {tpl.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                      <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400" title={t('common.delete') || 'Delete'}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Template body */}
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {isPreview ? (
                      <div>
                        <div className="flex items-center gap-1 mb-1 text-xs text-teal-600 font-medium">
                          <Eye className="h-3 w-3" /> {t('admin.crm.livePreview') || 'Live Preview'}
                        </div>
                        <p>{previewText}</p>
                      </div>
                    ) : (
                      tpl.body
                    )}
                  </div>

                  {/* Variables */}
                  {tpl.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.variables.map(v => (
                        <span key={v} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full flex items-center gap-0.5">
                          <Variable className="h-3 w-3" /> {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingId ? (t('admin.crm.editTemplate') || 'Edit Template') : (t('admin.crm.newTemplate') || 'New Template')}
              </h2>
              <button onClick={() => { setShowCreate(false); setEditingId(null); }} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.name') || 'Name'} *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-teal-400 focus:outline-none" autoFocus placeholder="e.g. Welcome message" />
              </div>

              {/* Body + Preview side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('admin.crm.messageBody') || 'Message Body'} *</label>
                  <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm font-mono resize-none focus:ring-2 focus:ring-teal-400 focus:outline-none" rows={6}
                    placeholder={'Hi {{firstName}}, your order {{orderNumber}} is ready!'} />
                  <div className="flex items-center justify-between mt-1">
                    <p className={`text-xs ${form.body.length > 160 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {form.body.length}/160 {t('admin.crm.chars') || 'chars'} ({segments} {t('admin.crm.segments') || 'segment(s)'})
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5 text-teal-500" /> {t('admin.crm.livePreview') || 'Live Preview'}
                  </label>
                  <div className="bg-gray-50 border rounded-md px-3 py-2 text-sm min-h-[150px] whitespace-pre-wrap">
                    {formPreview || <span className="text-gray-400 italic">{t('admin.crm.typeToPreview') || 'Type to see preview...'}</span>}
                  </div>
                  {form.body.length > 160 && (
                    <p className="text-xs text-orange-600 mt-1">{t('admin.crm.multipleSegments') || 'This message will be sent as multiple segments'}</p>
                  )}
                </div>
              </div>

              {/* Auto-detected variables */}
              {autoDetectedVars.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    <Variable className="h-3 w-3" /> {t('admin.crm.detectedVariables') || 'Detected Variables'}
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {autoDetectedVars.map(v => (
                      <span key={v} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom preview values */}
              {autoDetectedVars.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.crm.customPreviewValues') || 'Custom Preview Values'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {autoDetectedVars.map(v => (
                      <div key={v} className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 w-24 truncate">{v}:</span>
                        <input
                          type="text"
                          value={customVars[v] || ''}
                          onChange={e => setCustomVars(prev => ({ ...prev, [v]: e.target.value }))}
                          placeholder={SAMPLE_DATA[v] || 'value'}
                          className="flex-1 border rounded px-2 py-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual variables override */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('admin.crm.variablesOverride') || 'Variables (comma-separated, auto-detected if empty)'}</label>
                <input type="text" value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm" placeholder="firstName, companyName, ..." />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setShowCreate(false); setEditingId(null); }} className="px-4 py-2 text-sm bg-white border rounded-md hover:bg-gray-50">
                {t('common.cancel') || 'Cancel'}
              </button>
              <button onClick={saveTemplate} disabled={saving || !form.name.trim() || !form.body.trim()}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1">
                {saving ? '...' : <><Check className="h-4 w-4" /> {editingId ? (t('common.save') || 'Save') : (t('common.create') || 'Create')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

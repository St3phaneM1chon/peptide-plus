'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  FileInput,
  Plus,
  Copy,
  Code,
} from 'lucide-react';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  options?: string[];
}

interface LeadForm {
  id: string;
  name: string;
  fields: FormField[];
  redirectUrl?: string;
  notifyEmails: string[];
  assignToId?: string;
  tags: string[];
  isActive: boolean;
  submissions: number;
  createdAt: string;
  createdBy?: { name: string };
}

export default function LeadFormsPage() {
  const { t, locale } = useI18n();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEmbed, setShowEmbed] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({
    name: '',
    redirectUrl: '',
    notifyEmails: '',
    tags: '',
    fields: [
      { name: 'contactName', label: 'Name', type: 'text' as const, required: true },
      { name: 'email', label: 'Email', type: 'email' as const, required: true },
      { name: 'phone', label: 'Phone', type: 'tel' as const, required: false },
      { name: 'companyName', label: 'Company', type: 'text' as const, required: false },
      { name: 'message', label: 'Message', type: 'textarea' as const, required: false },
    ],
  });

  const fetchForms = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crm/forms');
      const json = await res.json();
      if (json.success) setForms(json.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error('Name required'); return; }
    try {
      const res = await fetch('/api/admin/crm/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newForm.name,
          fields: newForm.fields,
          redirectUrl: newForm.redirectUrl || undefined,
          notifyEmails: newForm.notifyEmails ? newForm.notifyEmails.split(',').map(e => e.trim()) : [],
          tags: newForm.tags ? newForm.tags.split(',').map(t => t.trim()) : [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Form created');
        setShowCreate(false);
        fetchForms();
      }
    } catch { toast.error('Failed'); }
  };

  const getEmbedCode = (formId: string, form: LeadForm) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.com';
    return `<!-- BioCycle Lead Capture Form -->
<div id="biocycle-form-${formId}"></div>
<script>
(function() {
  var container = document.getElementById('biocycle-form-${formId}');
  var form = document.createElement('form');
  form.style.maxWidth = '500px';
  form.style.fontFamily = 'system-ui, sans-serif';
${form.fields.map(f => `
  var div_${f.name} = document.createElement('div');
  div_${f.name}.style.marginBottom = '12px';
  var label_${f.name} = document.createElement('label');
  label_${f.name}.textContent = '${f.label}${f.required ? ' *' : ''}';
  label_${f.name}.style.display = 'block';
  label_${f.name}.style.marginBottom = '4px';
  label_${f.name}.style.fontSize = '14px';
  var input_${f.name} = document.createElement('${f.type === 'textarea' ? 'textarea' : 'input'}');
  ${f.type !== 'textarea' ? `input_${f.name}.type = '${f.type}';` : ''}
  input_${f.name}.name = '${f.name}';
  ${f.required ? `input_${f.name}.required = true;` : ''}
  input_${f.name}.style.width = '100%';
  input_${f.name}.style.padding = '8px';
  input_${f.name}.style.border = '1px solid #ccc';
  input_${f.name}.style.borderRadius = '6px';
  input_${f.name}.style.boxSizing = 'border-box';
  div_${f.name}.appendChild(label_${f.name});
  div_${f.name}.appendChild(input_${f.name});
  form.appendChild(div_${f.name});`).join('')}

  var btn = document.createElement('button');
  btn.type = 'submit';
  btn.textContent = 'Submit';
  btn.style.padding = '10px 24px';
  btn.style.background = '#2563eb';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '14px';
  form.appendChild(btn);

  form.onsubmit = function(e) {
    e.preventDefault();
    var data = { formId: '${formId}' };
    var inputs = form.querySelectorAll('input, textarea');
    inputs.forEach(function(inp) { data[inp.name] = inp.value; });
    fetch('${origin}/api/public/crm/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); })
    .then(function(j) {
      if (j.success) {
        form.innerHTML = '<p style="color:green;font-size:16px">Thank you! We will be in touch.</p>';
        if (j.data && j.data.redirectUrl) window.location.href = j.data.redirectUrl;
      } else { alert(j.error || 'Error'); }
    }).catch(function() { alert('Error submitting form'); });
  };
  container.appendChild(form);
})();
</script>`;
  };

  const copyEmbed = (formId: string, form: LeadForm) => {
    navigator.clipboard.writeText(getEmbedCode(formId, form));
    toast.success('Embed code copied to clipboard');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileInput className="h-6 w-6 text-teal-600" />
            {t('admin.crm.webForms') || 'Web-to-Lead Forms'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Capture leads from your website</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
          <Plus className="h-4 w-4" /> New Form
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Lead Capture Form</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Form Name</label>
              <input type="text" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Contact Us Form" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Redirect URL (optional)</label>
              <input type="url" value={newForm.redirectUrl} onChange={e => setNewForm(f => ({ ...f, redirectUrl: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="https://your-site.com/thank-you" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notify Emails (comma-separated)</label>
              <input type="text" value={newForm.notifyEmails} onChange={e => setNewForm(f => ({ ...f, notifyEmails: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="sales@company.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Auto-tag leads (comma-separated)</label>
              <input type="text" value={newForm.tags} onChange={e => setNewForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" placeholder="website, inbound" />
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-700 mb-2">Form Fields</h3>
          <div className="space-y-2 mb-4">
            {newForm.fields.map((field, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium w-32">{field.label}</span>
                <span className="text-xs text-gray-400 w-20">{field.type}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${field.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                  {field.required ? 'Required' : 'Optional'}
                </span>
              </div>
            ))}
          </div>

          <button onClick={handleCreate} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm">
            Create Form
          </button>
        </div>
      )}

      {/* Forms List */}
      <div className="space-y-3">
        {forms.map(form => (
          <div key={form.id} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{form.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(form.fields as FormField[]).length} fields | {form.submissions} submissions | Created {new Date(form.createdAt).toLocaleDateString(locale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${form.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {form.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => setShowEmbed(showEmbed === form.id ? null : form.id)}
                  className="p-2 rounded-lg hover:bg-gray-100" title="View embed code">
                  <Code className="h-4 w-4 text-gray-400" />
                </button>
                <button onClick={() => copyEmbed(form.id, form)}
                  className="p-2 rounded-lg hover:bg-gray-100" title="Copy embed code">
                  <Copy className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>

            {showEmbed === form.id && (
              <div className="mt-3 p-3 bg-gray-900 rounded-lg overflow-x-auto">
                <pre className="text-xs text-green-400 whitespace-pre-wrap">{getEmbedCode(form.id, form)}</pre>
              </div>
            )}
          </div>
        ))}

        {forms.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <FileInput className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No forms yet</p>
            <p className="text-sm mt-1">Create a web-to-lead form to capture leads from your website</p>
          </div>
        )}
      </div>
    </div>
  );
}

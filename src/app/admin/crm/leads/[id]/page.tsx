'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, Mail, Building2, Tag,
  Flame, Thermometer, Snowflake, ShieldAlert,
  Target,
} from 'lucide-react';
import { ActivityTimeline } from '@/components/admin/crm/ActivityTimeline';
import { ScoreBreakdown } from '@/components/admin/crm/ScoreBreakdown';
import { InlineEdit } from '@/components/admin/crm/InlineEdit';

interface LeadDetail {
  id: string;
  contactName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  status: string;
  score: number;
  temperature: string;
  dncStatus: string;
  assignedTo?: { id: string; name: string | null; email: string } | null;
  tags: string[];
  customFields?: Record<string, unknown> | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  timezone?: string | null;
  preferredLang?: string | null;
  createdAt: string;
  updatedAt: string;
  deals: Array<{ id: string; title: string; value: number; stage: { name: string; color?: string | null } }>;
  tasks: Array<{ id: string; title: string; type: string; status: string; dueAt?: string | null; priority: string }>;
  activities: Array<{
    id: string; type: string; title: string; description?: string | null;
    performedBy: { name: string | null; email: string }; createdAt: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-teal-100 text-teal-700', CONTACTED: 'bg-yellow-100 text-yellow-700',
  QUALIFIED: 'bg-green-100 text-green-700', UNQUALIFIED: 'bg-gray-100 text-gray-600',
  CONVERTED: 'bg-purple-100 text-purple-700', LOST: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'UNQUALIFIED', label: 'Unqualified' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'LOST', label: 'Lost' },
];

export default function LeadDetailPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const fmt = useCallback(
    (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n),
    [locale]
  );

  const fetchLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/crm/leads/${leadId}`);
      const json = await res.json();
      if (json.success) setLead(json.data);
      else toast.error(json.error?.message || 'Failed to load lead');
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { if (leadId) fetchLead(); }, [leadId, fetchLead]);

  const recalculateScore = async () => {
    setScoring(true);
    try {
      const res = await fetch(`/api/admin/crm/leads/${leadId}/score`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast.success(`Score: ${json.data.score}`);
        fetchLead();
      } else toast.error(json.error?.message || 'Scoring failed');
    } catch { toast.error('Network error'); }
    finally { setScoring(false); }
  };

  const updateField = useCallback(async (field: string, value: string) => {
    try {
      const res = await fetch(`/api/admin/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('common.saved') || 'Saved');
        fetchLead();
      } else {
        toast.error(json.error?.message || 'Update failed');
        throw new Error('Update failed');
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === 'Update failed')) toast.error('Network error');
      throw e;
    }
  }, [leadId, fetchLead, t]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" /></div>;
  if (!lead) return <div className="p-8 text-center text-gray-500">Lead not found</div>;

  const TempIcon = lead.temperature === 'HOT' ? Flame : lead.temperature === 'WARM' ? Thermometer : Snowflake;
  const tempColor = lead.temperature === 'HOT' ? 'text-red-500' : lead.temperature === 'WARM' ? 'text-orange-500' : 'text-blue-400';

  // Find last activity date for score breakdown
  const lastActivityAt = lead.activities.length > 0 ? lead.activities[0].createdAt : null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/admin/crm/leads')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{lead.contactName}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || ''}`}>{lead.status}</span>
            <TempIcon className={`h-5 w-5 ${tempColor}`} />
            {lead.dncStatus !== 'CALLABLE' && <ShieldAlert className="h-5 w-5 text-red-500" />}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {lead.companyName && <span className="mr-3"><Building2 className="h-3.5 w-3.5 inline mr-1" />{lead.companyName}</span>}
            {lead.email && <span className="mr-3"><Mail className="h-3.5 w-3.5 inline mr-1" />{lead.email}</span>}
            {lead.phone && <span><Phone className="h-3.5 w-3.5 inline mr-1" />{lead.phone}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {lead.phone && (
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100">
              <Phone className="h-4 w-4" /> {t('admin.crm.call') || 'Call'}
            </button>
          )}
          {lead.email && (
            <button className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-50 text-teal-700 rounded-md hover:bg-teal-100">
              <Mail className="h-4 w-4" /> {t('admin.crm.sendEmail') || 'Email'}
            </button>
          )}
          {lead.status !== 'CONVERTED' && (
            <button onClick={() => setShowConvert(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700">
              <Target className="h-4 w-4" /> {t('admin.crm.convertToDeal') || 'Convert'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Timeline (new component) */}
          <ActivityTimeline
            activities={lead.activities}
            leadId={leadId}
            onActivityAdded={fetchLead}
          />

          {/* Tasks */}
          {lead.tasks.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('admin.crm.tasks') || 'Tasks'}</h3>
              <div className="space-y-2">
                {lead.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded bg-gray-50">
                    <div className={`w-2 h-2 rounded-full ${task.status === 'COMPLETED' ? 'bg-green-500' : task.priority === 'URGENT' ? 'bg-red-500' : 'bg-teal-500'}`} />
                    <span className={`text-sm flex-1 ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>{task.title}</span>
                    <span className="text-xs text-gray-400">{task.type}</span>
                    {task.dueAt && <span className="text-xs text-gray-400">{new Date(task.dueAt).toLocaleDateString(locale)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Score Breakdown (new component) */}
          <ScoreBreakdown
            score={lead.score}
            temperature={lead.temperature}
            email={lead.email}
            phone={lead.phone}
            companyName={lead.companyName}
            lastContactedAt={lead.lastContactedAt}
            lastActivityAt={lastActivityAt}
            source={lead.source}
            onRecalculate={recalculateScore}
            recalculating={scoring}
          />

          {/* Details with inline edit */}
          <div className="bg-white rounded-lg border p-4 space-y-2.5">
            <h3 className="font-semibold text-gray-700 text-sm mb-2">{t('admin.crm.details') || 'Details'}</h3>
            <InlineEdit
              label="Email"
              value={lead.email || ''}
              type="email"
              onSave={v => updateField('email', v)}
            />
            <InlineEdit
              label={t('admin.crm.phone') || 'Phone'}
              value={lead.phone || ''}
              type="tel"
              onSave={v => updateField('phone', v)}
            />
            <InlineEdit
              label={t('admin.crm.company') || 'Company'}
              value={lead.companyName || ''}
              onSave={v => updateField('companyName', v)}
            />
            <InlineEdit
              label="Source"
              value={lead.source}
              type="select"
              options={[
                { value: 'WEB', label: 'Web' },
                { value: 'REFERRAL', label: 'Referral' },
                { value: 'IMPORT', label: 'Import' },
                { value: 'CAMPAIGN', label: 'Campaign' },
                { value: 'MANUAL', label: 'Manual' },
                { value: 'PARTNER', label: 'Partner' },
              ]}
              onSave={v => updateField('source', v)}
            />
            <InlineEdit
              label="Status"
              value={lead.status}
              type="select"
              options={STATUS_OPTIONS}
              onSave={v => updateField('status', v)}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('admin.crm.assignedTo') || 'Assigned'}</span>
              <span>{lead.assignedTo?.name || lead.assignedTo?.email || '-'}</span>
            </div>
            <InlineEdit
              label="Timezone"
              value={lead.timezone || ''}
              onSave={v => updateField('timezone', v)}
            />
            <InlineEdit
              label={t('admin.crm.language') || 'Language'}
              value={lead.preferredLang || ''}
              onSave={v => updateField('preferredLang', v)}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('common.createdAt') || 'Created'}</span>
              <span className="text-gray-900">{new Date(lead.createdAt).toLocaleDateString(locale)}</span>
            </div>
            {lead.lastContactedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('admin.crm.lastContact') || 'Last Contact'}</span>
                <span>{new Date(lead.lastContactedAt).toLocaleDateString(locale)}</span>
              </div>
            )}
            {lead.nextFollowUpAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('admin.crm.nextFollowUp') || 'Next Follow-up'}</span>
                <span>{new Date(lead.nextFollowUpAt).toLocaleDateString(locale)}</span>
              </div>
            )}
          </div>

          {/* Deals */}
          {lead.deals.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.crm.deals') || 'Deals'}</h3>
              <div className="space-y-2">
                {lead.deals.map(deal => (
                  <button key={deal.id} onClick={() => router.push(`/admin/crm/deals/${deal.id}`)}
                    className="w-full flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100 text-sm">
                    <div className="flex items-center gap-2">
                      {deal.stage?.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deal.stage.color }} />}
                      <span>{deal.title}</span>
                    </div>
                    <span className="text-green-700 font-medium">{fmt(deal.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {lead.tags.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('admin.crm.tags') || 'Tags'}</h3>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700"><Tag className="h-3 w-3 inline mr-1" />{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Convert Modal */}
      {showConvert && <ConvertModal leadId={leadId} onClose={() => setShowConvert(false)} onConverted={() => { setShowConvert(false); fetchLead(); }} />}
    </div>
  );
}

function ConvertModal({ leadId, onClose, onConverted }: { leadId: string; onClose: () => void; onConverted: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ title: '', value: '', pipelineId: '', stageId: '' });
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string; stages: Array<{ id: string; name: string; position: number }> }>>([]);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/crm/pipelines').then(r => r.json()).then(json => {
      if (json.success) {
        setPipelines(json.data || []);
        const def = json.data?.find((p: { isDefault: boolean }) => p.isDefault) || json.data?.[0];
        if (def) {
          setForm(f => ({ ...f, pipelineId: def.id, stageId: def.stages?.[0]?.id || '' }));
        }
      }
    }).catch(() => {});
  }, []);

  const stages = pipelines.find(p => p.id === form.pipelineId)?.stages?.sort((a, b) => a.position - b.position) || [];

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setConverting(true);
    try {
      const body: Record<string, unknown> = { title: form.title, pipelineId: form.pipelineId, stageId: form.stageId };
      if (form.value) body.value = parseFloat(form.value);
      const res = await fetch(`/api/admin/crm/leads/${leadId}/convert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { toast.success('Lead converted to deal!'); onConverted(); }
      else toast.error(json.error?.message || 'Conversion failed');
    } catch { toast.error('Network error'); }
    finally { setConverting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('admin.crm.convertToDeal') || 'Convert to Deal'}</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Deal Title *</label>
          <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Value (CAD)</label>
          <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm" min="0" step="0.01" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pipeline</label>
          <select value={form.pipelineId} onChange={e => {
            const pid = e.target.value;
            const p = pipelines.find(pp => pp.id === pid);
            setForm(f => ({ ...f, pipelineId: pid, stageId: p?.stages?.[0]?.id || '' }));
          }} className="w-full border rounded-md px-3 py-2 text-sm">
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stage</label>
          <select value={form.stageId} onChange={e => setForm(f => ({ ...f, stageId: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm">
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200">{t('common.cancel') || 'Cancel'}</button>
          <button onClick={submit} disabled={converting} className="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50">
            {converting ? '...' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  );
}

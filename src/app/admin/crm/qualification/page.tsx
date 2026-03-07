'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Target, Search, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, MinusCircle, Save, Users,
} from 'lucide-react';

interface Lead {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  score: number;
  temperature: string;
  status: string;
  qualificationFramework: string | null;
  qualificationData: Record<string, any> | null;
}

type Framework = 'BANT' | 'MEDDIC';

const BANT_FIELDS = [
  { key: 'budget', label: 'Budget', description: 'Does the prospect have the budget?', options: ['Yes', 'No', 'Unknown'] },
  { key: 'authority', label: 'Authority', description: 'Is this the decision maker?', options: ['Decision Maker', 'Influencer', 'Champion', 'Unknown'] },
  { key: 'need', label: 'Need', description: 'Is there a clear need for the solution?', options: ['Urgent', 'Moderate', 'Low', 'None'] },
  { key: 'timeline', label: 'Timeline', description: 'When do they plan to buy?', options: ['Immediate', '1-3 months', '3-6 months', '6+ months', 'Unknown'] },
];

const MEDDIC_FIELDS = [
  { key: 'metrics', label: 'Metrics', description: 'What are the quantifiable measures of success?' },
  { key: 'economicBuyer', label: 'Economic Buyer', description: 'Who has the authority to spend?' },
  { key: 'decisionCriteria', label: 'Decision Criteria', description: 'What criteria will they use to decide?' },
  { key: 'decisionProcess', label: 'Decision Process', description: 'What is the process for making a decision?' },
  { key: 'identifyPain', label: 'Identify Pain', description: 'What pain are they trying to solve?' },
  { key: 'champion', label: 'Champion', description: 'Who is your internal champion?' },
];

function getQualificationScore(framework: Framework, data: Record<string, any> | null): { filled: number; total: number; percentage: number } {
  if (!data) return { filled: 0, total: framework === 'BANT' ? 4 : 6, percentage: 0 };
  const fields = framework === 'BANT' ? BANT_FIELDS : MEDDIC_FIELDS;
  const filled = fields.filter(f => data[f.key] && data[f.key] !== '' && data[f.key] !== 'Unknown' && data[f.key] !== 'None').length;
  return { filled, total: fields.length, percentage: Math.round((filled / fields.length) * 100) };
}

export default function QualificationPage() {
  const { t } = useI18n();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, any>>({});
  const [editingFramework, setEditingFramework] = useState<Framework>('BANT');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/crm/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        setLeads(json.data || []);
        setTotal(json.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load leads'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const expandLead = (lead: Lead) => {
    if (expandedId === lead.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(lead.id);
    setEditingFramework((lead.qualificationFramework as Framework) || 'BANT');
    setEditingData(lead.qualificationData || {});
  };

  const saveQualification = async (leadId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qualificationFramework: editingFramework,
          qualificationData: editingData,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crm.qualificationSaved') || 'Qualification saved');
        fetchLeads();
      } else toast.error(json.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  const getStatusIcon = (value: string | undefined) => {
    if (!value || value === 'Unknown' || value === 'None' || value === '') return <MinusCircle className="h-4 w-4 text-gray-400" />;
    if (['Yes', 'Decision Maker', 'Urgent', 'Immediate'].includes(value)) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Target className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.qualification') || 'Lead Qualification'}</h1>
            <p className="text-sm text-gray-500">{t('admin.crm.qualificationDesc') || 'BANT & MEDDIC qualification frameworks'}</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.crm.searchLeads') || 'Search leads...'} className="w-full pl-10 pr-3 py-2 border rounded-md text-sm" />
        </div>
        <select value={frameworkFilter} onChange={e => setFrameworkFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm">
          <option value="">{t('admin.crm.allFrameworks') || 'All Frameworks'}</option>
          <option value="BANT">BANT</option>
          <option value="MEDDIC">MEDDIC</option>
          <option value="none">{t('admin.crm.notQualified') || 'Not Qualified'}</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">{t('admin.crm.totalLeads') || 'Total Leads'}</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-teal-600">{leads.filter(l => l.qualificationFramework === 'BANT').length}</p>
          <p className="text-xs text-gray-500">BANT</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{leads.filter(l => l.qualificationFramework === 'MEDDIC').length}</p>
          <p className="text-xs text-gray-500">MEDDIC</p>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-400">{leads.filter(l => !l.qualificationFramework).length}</p>
          <p className="text-xs text-gray-500">{t('admin.crm.notQualified') || 'Not Qualified'}</p>
        </div>
      </div>

      {/* Lead List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{t('admin.crm.noLeads') || 'No leads found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads
            .filter(l => {
              if (frameworkFilter === 'none') return !l.qualificationFramework;
              if (frameworkFilter) return l.qualificationFramework === frameworkFilter;
              return true;
            })
            .map(lead => {
              const isExpanded = expandedId === lead.id;
              const fw = lead.qualificationFramework as Framework | null;
              const score = fw ? getQualificationScore(fw, lead.qualificationData) : null;

              return (
                <div key={lead.id} className="bg-white rounded-lg border overflow-hidden">
                  <button onClick={() => expandLead(lead)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{lead.contactName}</p>
                        {lead.companyName && <span className="text-xs text-gray-500">- {lead.companyName}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span>{t('admin.crm.score') || 'Score'}: {lead.score}</span>
                        <span className={`px-1.5 py-0.5 rounded-full ${lead.temperature === 'HOT' ? 'bg-red-50 text-red-600' : lead.temperature === 'WARM' ? 'bg-orange-50 text-orange-600' : 'bg-teal-50 text-teal-600'}`}>
                          {lead.temperature}
                        </span>
                        <span>{lead.status}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {fw ? (
                        <>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fw === 'BANT' ? 'bg-teal-50 text-teal-700' : 'bg-purple-50 text-purple-700'}`}>
                            {fw}
                          </span>
                          <span className={`text-xs font-medium ${score!.percentage >= 75 ? 'text-green-600' : score!.percentage >= 50 ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {score!.filled}/{score!.total} ({score!.percentage}%)
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">{t('admin.crm.notQualified') || 'Not qualified'}</span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 bg-gray-50">
                      {/* Framework selector */}
                      <div className="flex items-center gap-3 mb-4">
                        <label className="text-sm font-medium text-gray-700">{t('admin.crm.framework') || 'Framework'}:</label>
                        <div className="flex gap-2">
                          {(['BANT', 'MEDDIC'] as Framework[]).map(fw => (
                            <button key={fw} onClick={() => setEditingFramework(fw)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${editingFramework === fw ? (fw === 'BANT' ? 'bg-teal-600 text-white' : 'bg-purple-600 text-white') : 'bg-white border text-gray-700 hover:bg-gray-50'}`}>
                              {fw}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Qualification Fields */}
                      <div className="space-y-3">
                        {(editingFramework === 'BANT' ? BANT_FIELDS : MEDDIC_FIELDS).map(field => (
                          <div key={field.key} className="bg-white rounded-lg border p-3">
                            <div className="flex items-start gap-2">
                              {getStatusIcon(editingData[field.key])}
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-sm font-medium text-gray-900">{field.label}</label>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 mb-2">{field.description}</p>
                                {'options' in field && (field as { options?: string[] }).options ? (
                                  <div className="flex flex-wrap gap-1">
                                    {((field as { options: string[] }).options).map((opt: string) => (
                                      <button key={opt} onClick={() => setEditingData(d => ({ ...d, [field.key]: opt }))}
                                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${editingData[field.key] === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <textarea
                                    value={editingData[field.key] || ''}
                                    onChange={e => setEditingData(d => ({ ...d, [field.key]: e.target.value }))}
                                    rows={2}
                                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                                    className="w-full border rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Save */}
                      <div className="flex justify-end mt-4">
                        <button onClick={() => saveQualification(lead.id)} disabled={saving}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                          <Save className="h-4 w-4" /> {saving ? '...' : (t('common.save') || 'Save Qualification')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50">{t('common.previous') || 'Previous'}</button>
          <span className="text-sm text-gray-500">{t('common.page') || 'Page'} {page} / {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50">{t('common.next') || 'Next'}</button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Search,
  Upload,
  Plus,
  X,
  Flame,
  Thermometer,
  Snowflake,
  ShieldAlert,
  Trash2,
  RefreshCw,
} from 'lucide-react';

interface Lead {
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
  assignedTo?: { name: string | null; email: string } | null;
  tags: string[];
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-teal-100 text-teal-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  QUALIFIED: 'bg-green-100 text-green-700',
  UNQUALIFIED: 'bg-gray-100 text-gray-600',
  CONVERTED: 'bg-purple-100 text-purple-700',
  LOST: 'bg-red-100 text-red-700',
};

const TEMP_ICONS: Record<string, typeof Flame> = {
  HOT: Flame,
  WARM: Thermometer,
  COLD: Snowflake,
};

const TEMP_COLORS: Record<string, string> = {
  HOT: 'text-red-500',
  WARM: 'text-orange-500',
  COLD: 'text-blue-400',
};

export default function LeadsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tempFilter, setTempFilter] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limit = 20;

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (tempFilter) params.set('temperature', tempFilter);

      const res = await fetch(`/api/admin/crm/leads?${params}`);
      const json = await res.json();
      if (json.success) {
        setLeads(json.data || []);
        setTotal(json.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter, tempFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const totalPages = Math.ceil(total / limit);

  const handleImportCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV must have header + data rows'); return; }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('nom'));
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('courriel'));
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel'));
    const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('entreprise'));

    if (nameIdx === -1) { toast.error('CSV must have a name/nom column'); return; }

    const leadsToImport = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return {
        contactName: cols[nameIdx] || 'Unknown',
        email: emailIdx >= 0 ? cols[emailIdx] || undefined : undefined,
        phone: phoneIdx >= 0 ? cols[phoneIdx] || undefined : undefined,
        companyName: companyIdx >= 0 ? cols[companyIdx] || undefined : undefined,
        source: 'IMPORT' as const,
      };
    }).filter(l => l.contactName && l.contactName !== 'Unknown');

    if (leadsToImport.length === 0) { toast.error('No valid leads found in CSV'); return; }

    try {
      const res = await fetch('/api/admin/crm/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: leadsToImport }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Imported ${json.data.imported} leads (${json.data.duplicates} duplicates, ${json.data.dncSkipped} DNC)`);
        setShowImportModal(false);
        fetchLeads();
      } else {
        toast.error(json.error?.message || 'Import failed');
      }
    } catch {
      toast.error('Network error during import');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id)));
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selected.size === 0) return;
    try {
      const promises = Array.from(selected).map(id =>
        fetch(`/api/admin/crm/leads/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      );
      await Promise.all(promises);
      toast.success(`${selected.size} leads updated to ${status}`);
      setSelected(new Set());
      fetchLeads();
    } catch {
      toast.error('Bulk update failed');
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} leads? This cannot be undone.`)) return;
    try {
      const promises = Array.from(selected).map(id =>
        fetch(`/api/admin/crm/leads/${id}`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      toast.success(`${selected.size} leads deleted`);
      setSelected(new Set());
      fetchLeads();
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const bulkRecalculateScores = async () => {
    if (selected.size === 0) return;
    try {
      const promises = Array.from(selected).map(id =>
        fetch(`/api/admin/crm/leads/${id}/score`, { method: 'POST' })
      );
      await Promise.all(promises);
      toast.success(`${selected.size} scores recalculated`);
      setSelected(new Set());
      fetchLeads();
    } catch {
      toast.error('Bulk scoring failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.leads') || 'Leads'}</h1>
          <p className="text-sm text-gray-500 mt-1">{total} {t('admin.crm.leadsTotal') || 'total leads'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" /> {t('admin.crm.importCSV') || 'Import CSV'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> {t('admin.crm.newLead') || 'New Lead'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('admin.crm.searchLeads') || 'Search leads...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="">{t('admin.crm.allStatuses') || 'All Statuses'}</option>
          {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="">{t('admin.crm.allSources') || 'All Sources'}</option>
          {['WEB', 'REFERRAL', 'IMPORT', 'CAMPAIGN', 'MANUAL', 'PARTNER'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={tempFilter}
          onChange={(e) => { setTempFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="">{t('admin.crm.allTemperatures') || 'All Temperatures'}</option>
          {['HOT', 'WARM', 'COLD'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg">
          <span className="text-sm font-medium text-teal-800">
            {selected.size} {t('common.selected') || 'selected'}
          </span>
          <div className="w-px h-5 bg-teal-200" />
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) bulkUpdateStatus(e.target.value); e.target.value = ''; }}
            className="text-xs border border-teal-300 rounded-md px-2 py-1 bg-white text-teal-700"
          >
            <option value="">{t('admin.crm.changeStatus') || 'Change Status...'}</option>
            {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'LOST'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={bulkRecalculateScores}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-teal-700 bg-white border border-teal-300 rounded-md hover:bg-teal-100"
          >
            <RefreshCw className="h-3 w-3" /> {t('admin.crm.recalculate') || 'Recalculate'}
          </button>
          <div className="flex-1" />
          <button
            onClick={bulkDelete}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" /> {t('common.delete') || 'Delete'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="p-1 text-teal-500 hover:bg-teal-100 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" onChange={selectAll} checked={selected.size === leads.length && leads.length > 0} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.name') || 'Name'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.company') || 'Company'}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.crm.score') || 'Score'}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('admin.crm.temperature') || 'Temp'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.status') || 'Status'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.source') || 'Source'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.assignedTo') || 'Assigned'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.lastContact') || 'Last Contact'}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">DNC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto" />
                </td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  {t('admin.crm.noLeads') || 'No leads found'}
                </td></tr>
              ) : leads.map((lead) => {
                const TempIcon = TEMP_ICONS[lead.temperature] || Thermometer;
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/crm/leads/${lead.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{lead.contactName}</div>
                      <div className="text-xs text-gray-500">{lead.email || lead.phone || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{lead.companyName || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center gap-0.5 w-12">
                        <span className={`text-sm font-bold ${lead.score >= 70 ? 'text-green-600' : lead.score >= 40 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {lead.score}
                        </span>
                        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${lead.score}%`,
                              backgroundColor: lead.score >= 70 ? '#10B981' : lead.score >= 40 ? '#F59E0B' : '#9CA3AF',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TempIcon className={`h-5 w-5 mx-auto ${TEMP_COLORS[lead.temperature] || 'text-gray-400'}`} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{lead.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{lead.assignedTo?.name || lead.assignedTo?.email || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString(locale) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lead.dncStatus !== 'CALLABLE' && (
                        <ShieldAlert className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} / {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-100"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{t('admin.crm.importCSV') || 'Import CSV'}</h2>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                {t('admin.crm.importInstructions') || 'Upload a CSV file with columns: name/nom, email/courriel, phone/tel, company/entreprise'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportCSV(file);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
            </div>
            <div className="flex justify-end p-4 border-t">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreateModal && <CreateLeadModal onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); fetchLeads(); }} />}
    </div>
  );
}

function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ contactName: '', companyName: '', email: '', phone: '', source: 'MANUAL' });
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    if (!form.contactName.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const body: Record<string, string> = { contactName: form.contactName.trim(), source: form.source };
      if (form.companyName) body.companyName = form.companyName;
      if (form.email) body.email = form.email;
      if (form.phone) body.phone = form.phone;

      const res = await fetch('/api/admin/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { toast.success('Lead created'); onCreated(); }
      else toast.error(json.error?.message || 'Failed');
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('admin.crm.newLead') || 'New Lead'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.contactName') || 'Contact Name'} *</label>
            <input type="text" value={form.contactName} onChange={(e) => setForm(p => ({ ...p, contactName: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.company') || 'Company'}</label>
            <input type="text" value={form.companyName} onChange={(e) => setForm(p => ({ ...p, companyName: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email') || 'Email'}</label>
              <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone') || 'Phone'}</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crm.source') || 'Source'}</label>
            <select value={form.source} onChange={(e) => setForm(p => ({ ...p, source: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              {['MANUAL', 'WEB', 'REFERRAL', 'CAMPAIGN', 'PARTNER'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
            {t('common.cancel') || 'Cancel'}
          </button>
          <button onClick={submit} disabled={creating} className="px-4 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50">
            {creating ? '...' : t('common.create') || 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

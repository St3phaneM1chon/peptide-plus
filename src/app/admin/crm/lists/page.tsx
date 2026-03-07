'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Search, Plus, Upload, Trash2, Archive,
  ListChecks, MapPin, FileSpreadsheet, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProspectList {
  id: string;
  name: string;
  description?: string | null;
  source: string;
  status: string;
  totalCount: number;
  validatedCount: number;
  duplicateCount: number;
  integratedCount: number;
  assignmentMethod: string;
  tags: string[];
  createdBy?: { name: string | null; email: string } | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-700',
  INTEGRATED: 'bg-purple-100 text-purple-700',
  ARCHIVED: 'bg-yellow-100 text-yellow-700',
};

const SOURCE_ICONS: Record<string, typeof ListChecks> = {
  MANUAL: ListChecks,
  CSV_IMPORT: FileSpreadsheet,
  GOOGLE_MAPS: MapPin,
  WEB_SCRAPER: Search,
  API: ListChecks,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProspectListsPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSource, setNewSource] = useState<string>('MANUAL');
  const [creating, setCreating] = useState(false);

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvListId, setCsvListId] = useState('');
  const [importing, setImporting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchLists = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (sourceFilter) params.set('source', sourceFilter);

    try {
      const res = await fetch(`/api/admin/crm/lists?${params}`);
      const json = await res.json();
      if (json.success) {
        setLists(json.data);
        setTotal(json.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to fetch lists');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/crm/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined, source: newSource }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crmLists.saveSuccess'));
        setShowCreateModal(false);
        setNewName('');
        setNewDesc('');
        setNewSource('MANUAL');
        // Navigate to the new list
        router.push(`/admin/crm/lists/${json.data.id}`);
      } else {
        toast.error(json.error || 'Error');
      }
    } catch {
      toast.error('Error creating list');
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // CSV Import
  // ---------------------------------------------------------------------------

  async function handleCsvImport() {
    if (!csvFile || !csvListId) return;
    setImporting(true);
    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error('No valid rows in CSV');
        setImporting(false);
        return;
      }
      const res = await fetch(`/api/admin/crm/lists/${csvListId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${t('admin.crmLists.importSuccess')}: ${json.data.imported} imported, ${json.data.duplicates} duplicates`);
        setShowImportModal(false);
        setCsvFile(null);
        fetchLists();
      } else {
        toast.error(json.error || 'Import error');
      }
    } catch {
      toast.error('Import error');
    } finally {
      setImporting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete(id: string) {
    if (!confirm('Delete this list and all its prospects?')) return;
    try {
      const res = await fetch(`/api/admin/crm/lists/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crmLists.deleteSuccess'));
        fetchLists();
      }
    } catch {
      toast.error('Delete error');
    }
  }

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------

  async function handleArchive(id: string) {
    try {
      const res = await fetch(`/api/admin/crm/lists/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crmLists.saveSuccess'));
        fetchLists();
      }
    } catch {
      toast.error('Error');
    }
  }

  const totalPages = Math.ceil(total / limit);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.crmLists.title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            {t('admin.crmLists.importCSV')}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t('admin.crmLists.newList')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.crmLists.searchQuery')}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t('admin.crmLists.status')}</option>
          {['DRAFT', 'ACTIVE', 'INTEGRATED', 'ARCHIVED'].map((s) => (
            <option key={s} value={s}>{t(`admin.crmLists.status${s}`)}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t('admin.crmLists.source')}</option>
          {['MANUAL', 'CSV_IMPORT', 'GOOGLE_MAPS', 'WEB_SCRAPER', 'API'].map((s) => (
            <option key={s} value={s}>{t(`admin.crmLists.source${s}`)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">{t('admin.crmLists.name')}</th>
              <th className="px-4 py-3 font-medium">{t('admin.crmLists.source')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('admin.crmLists.totalCount')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('admin.crmLists.validatedCount')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('admin.crmLists.duplicateCount')}</th>
              <th className="px-4 py-3 font-medium text-center">{t('admin.crmLists.integratedCount')}</th>
              <th className="px-4 py-3 font-medium">{t('admin.crmLists.status')}</th>
              <th className="px-4 py-3 font-medium">{t('admin.crmLists.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : lists.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <ListChecks className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <p className="text-gray-500 font-medium">{t('admin.crmLists.noLists')}</p>
                  <p className="text-gray-400 text-sm">{t('admin.crmLists.noListsDesc')}</p>
                </td>
              </tr>
            ) : (
              lists.map((list) => {
                const SourceIcon = SOURCE_ICONS[list.source] || ListChecks;
                return (
                  <tr key={list.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/admin/crm/lists/${list.id}`)}>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{list.name}</div>
                        {list.description && <div className="text-xs text-gray-500 truncate max-w-[300px]">{list.description}</div>}
                        {list.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {list.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <SourceIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{t(`admin.crmLists.source${list.source}`)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{list.totalCount}</td>
                    <td className="px-4 py-3 text-center text-green-600">{list.validatedCount}</td>
                    <td className="px-4 py-3 text-center text-orange-600">{list.duplicateCount}</td>
                    <td className="px-4 py-3 text-center text-purple-600">{list.integratedCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[list.status] || 'bg-gray-100'}`}>
                        {t(`admin.crmLists.status${list.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => router.push(`/admin/crm/lists/${list.id}`)} className="rounded p-1 hover:bg-gray-100" title="View">
                          <Eye className="h-4 w-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleArchive(list.id)} className="rounded p-1 hover:bg-gray-100" title="Archive">
                          <Archive className="h-4 w-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(list.id)} className="rounded p-1 hover:bg-red-50" title="Delete">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{total} {t('admin.crmLists.prospects').toLowerCase()}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-40">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span>{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-40">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">{t('admin.crmLists.newList')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.name')} *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder={t('admin.crmLists.name')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.description')}</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.crmLists.source')}</label>
                <select
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {['MANUAL', 'CSV_IMPORT', 'GOOGLE_MAPS'].map((s) => (
                    <option key={s} value={s}>{t(`admin.crmLists.source${s}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '...' : t('admin.crmLists.newList')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">{t('admin.crmLists.importCSV')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">List</label>
                <select
                  value={csvListId}
                  onChange={(e) => setCsvListId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a list...</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Columns: contactName, companyName, email, phone, website, address, city, province, postalCode, country, industry
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowImportModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleCsvImport}
                disabled={importing || !csvFile || !csvListId}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? '...' : t('admin.crmLists.importCSV')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const fieldMap: Record<string, string> = {
    'name': 'contactName',
    'contact': 'contactName',
    'contact_name': 'contactName',
    'contactname': 'contactName',
    'company': 'companyName',
    'company_name': 'companyName',
    'companyname': 'companyName',
    'email': 'email',
    'e-mail': 'email',
    'phone': 'phone',
    'telephone': 'phone',
    'tel': 'phone',
    'website': 'website',
    'site': 'website',
    'url': 'website',
    'address': 'address',
    'city': 'city',
    'ville': 'city',
    'province': 'province',
    'state': 'province',
    'postal_code': 'postalCode',
    'postalcode': 'postalCode',
    'zip': 'postalCode',
    'country': 'country',
    'pays': 'country',
    'industry': 'industry',
    'secteur': 'industry',
    'notes': 'notes',
  };

  const mappedHeaders = headers.map((h) => fieldMap[h.toLowerCase()] || h.toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    mappedHeaders.forEach((header, i) => {
      if (values[i]) row[header] = values[i];
    });
    return row;
  }).filter((row) => row.contactName);
}

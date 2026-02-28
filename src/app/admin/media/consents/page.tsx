'use client';

/**
 * Admin Consents Page — Centralized tracking of ALL site consents
 * Classified by: client name, date, subject, product categories, product, status
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  FileCheck, Search, Loader2, ChevronLeft, ChevronRight,
  Eye, Download, Send, Filter, X, User, Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ConsentItem {
  id: string;
  type: string;
  status: string;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  pdfUrl: string | null;
  client: { id: string; name: string | null; email: string };
  video: { id: string; title: string; slug: string; thumbnailUrl: string | null } | null;
  formTemplate: { id: string; name: string } | null;
  requestedBy: { id: string; name: string | null } | null;
}

interface Stats {
  pending: number;
  granted: number;
  revoked: number;
  total: number;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  GRANTED: 'bg-green-100 text-green-800',
  REVOKED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
};

// Consent type labels resolved via i18n (see consentType.* keys)

export default function AdminConsentsPage() {
  const { t } = useI18n();
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);

      const res = await fetch(`/api/admin/consents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch consents');
      const data = await res.json();
      setConsents(data.consents);
      setStats(data.stats);
      setTotalPages(data.pagination.totalPages);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterType, t]);

  useEffect(() => { fetchConsents(); }, [fetchConsents]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleExportCsv = () => {
    if (consents.length === 0) {
      toast.info(t('admin.consents.noDataExport'));
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['ID', 'Client Name', 'Client Email', 'Type', 'Status', 'Video', 'Template', 'Requested By', 'Created', 'Granted', 'Revoked'];
    const rows = consents.map(c => [
      c.id, c.client.name || '', c.client.email, c.type, c.status,
      c.video?.title || '', c.formTemplate?.name || '', c.requestedBy?.name || '',
      new Date(c.createdAt).toISOString(),
      c.grantedAt ? new Date(c.grantedAt).toISOString() : '',
      c.revokedAt ? new Date(c.revokedAt).toISOString() : '',
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consents-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.consents.exportCsv') + ' OK');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.consents.title')}
          </h1>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={consents.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {t('admin.consents.exportCsv')}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">{t('admin.consents.total')}</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-yellow-600">{t('admin.consents.pending')}</p>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-green-600">{t('admin.consents.grantedLabel')}</p>
            <p className="text-2xl font-bold text-green-700">{stats.granted}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-red-600">{t('admin.consents.revokedStatus')}</p>
            <p className="text-2xl font-bold text-red-700">{stats.revoked}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">
              <Search className="h-3 w-3 inline mr-1" />
              {t('common.search')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder={t('admin.consents.searchPlaceholder') || 'Client name or email...'}
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <button onClick={handleSearch} className="px-3 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              <Filter className="h-3 w-3 inline mr-1" />
              {t('admin.consents.statusColumn')}
            </label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">{t('common.all') || 'All'}</option>
              <option value="PENDING">{t('admin.consents.pending') || 'Pending'}</option>
              <option value="GRANTED">{t('admin.consents.granted') || 'Granted'}</option>
              <option value="REVOKED">{t('admin.consents.revoked') || 'Revoked'}</option>
              <option value="EXPIRED">{t('admin.consents.expired') || 'Expired'}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('admin.consents.typeColumn') || 'Type'}</label>
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">{t('common.all') || 'All'}</option>
              {['VIDEO_APPEARANCE', 'TESTIMONIAL', 'PHOTO', 'CASE_STUDY', 'MARKETING', 'OTHER'].map(k => (
                <option key={k} value={k}>{t(`consentType.${k}`)}</option>
              ))}
            </select>
          </div>
          {(search || filterStatus || filterType) && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setFilterStatus(''); setFilterType(''); setPage(1); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> {t('common.clear') || 'Clear'}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
          </div>
        ) : consents.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            {t('admin.consents.noConsents')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    <User className="h-3 w-3 inline mr-1" />
                    {t('admin.consents.clientColumn')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('admin.consents.typeColumn')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('admin.consents.subjectColumn')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('admin.consents.statusColumn')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {t('admin.consents.dateColumn')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">{t('admin.consents.requestedByColumn')}</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {consents.map(consent => (
                  <tr key={consent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{consent.client.name || t('admin.consents.unknownClient')}</div>
                      <div className="text-xs text-gray-500">{consent.client.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {t(`consentType.${consent.type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {consent.video ? (
                        <Link href={`/admin/media/videos/${consent.video.id}`} className="text-orange-600 hover:underline text-xs">
                          {consent.video.title}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[consent.status] || 'bg-gray-100'}`}>
                        {consent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {new Date(consent.createdAt).toLocaleDateString()}
                      {consent.grantedAt && (
                        <div className="text-green-600">
                          {t('admin.consents.labelGranted')} {new Date(consent.grantedAt).toLocaleDateString()}
                        </div>
                      )}
                      {consent.revokedAt && (
                        <div className="text-red-600">
                          {t('admin.consents.labelRevoked')} {new Date(consent.revokedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {consent.requestedBy?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/media/consents/${consent.id}`}
                          title={t('admin.consents.viewDetails')}
                          className="p-1.5 hover:bg-gray-100 rounded inline-flex"
                        >
                          <Eye className="h-4 w-4 text-gray-500" />
                        </Link>
                        {consent.pdfUrl && (
                          <a
                            href={consent.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('admin.consents.downloadPdf')}
                            className="p-1.5 hover:bg-gray-100 rounded"
                          >
                            <Download className="h-4 w-4 text-gray-500" />
                          </a>
                        )}
                        {consent.status === 'PENDING' && (
                          <button
                            title={t('admin.consents.resendRequest')}
                            className="p-1.5 hover:bg-gray-100 rounded"
                            onClick={async () => {
                              try {
                                const { fetchWithCSRF } = await import('@/lib/csrf');
                                const res = await fetchWithCSRF(`/api/admin/consents/${consent.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ resend: true }),
                                });
                                if (res.ok) {
                                  toast.success(t('admin.consents.resendSuccess'));
                                } else {
                                  toast.error(t('admin.consents.resendError'));
                                }
                              } catch {
                                toast.error(t('admin.consents.resendError'));
                              }
                            }}
                          >
                            <Send className="h-4 w-4 text-orange-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> {t('common.previous')}
            </button>
            <span className="text-sm text-gray-600">
              {t('admin.consents.pageOf', { page: String(page), total: String(totalPages) })}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {t('common.next')} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

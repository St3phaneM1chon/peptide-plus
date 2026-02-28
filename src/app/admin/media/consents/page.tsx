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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-orange-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.consents.title') !== 'admin.consents.title' ? t('admin.consents.title') : 'Consents'}
          </h1>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-yellow-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-green-600">Granted</p>
            <p className="text-2xl font-bold text-green-700">{stats.granted}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-sm text-red-600">Revoked</p>
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
              {t('common.search') !== 'common.search' ? t('common.search') : 'Search'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Client name or email..."
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
              Status
            </label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="GRANTED">Granted</option>
              <option value="REVOKED">Revoked</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
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
              <X className="h-3 w-3" /> Clear
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
            No consents found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    <User className="h-3 w-3 inline mr-1" />
                    Client
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Requested By</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {consents.map(consent => (
                  <tr key={consent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{consent.client.name || 'Unknown'}</div>
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
                          Granted: {new Date(consent.grantedAt).toLocaleDateString()}
                        </div>
                      )}
                      {consent.revokedAt && (
                        <div className="text-red-600">
                          Revoked: {new Date(consent.revokedAt).toLocaleDateString()}
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
                          title="View details"
                          className="p-1.5 hover:bg-gray-100 rounded inline-flex"
                        >
                          <Eye className="h-4 w-4 text-gray-500" />
                        </Link>
                        {consent.pdfUrl && (
                          <a
                            href={consent.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download PDF"
                            className="p-1.5 hover:bg-gray-100 rounded"
                          >
                            <Download className="h-4 w-4 text-gray-500" />
                          </a>
                        )}
                        {consent.status === 'PENDING' && (
                          <button
                            title="Resend request"
                            className="p-1.5 hover:bg-gray-100 rounded"
                            onClick={async () => {
                              try {
                                const { fetchWithCSRF } = await import('@/lib/fetch-csrf');
                                const res = await fetchWithCSRF(`/api/admin/consents/${consent.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ resend: true }),
                                });
                                if (res.ok) {
                                  toast.success('Consent request resent');
                                } else {
                                  toast.error('Failed to resend');
                                }
                              } catch {
                                toast.error('Failed to resend');
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
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

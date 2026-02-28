'use client';

/**
 * Mes Consentements — Client's consent tracking page
 * Shows all consent requests sent to this client with ability to revoke.
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  FileCheck, Loader2, ChevronLeft, ChevronRight,
  Download, ShieldOff, Video, X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';

interface ConsentItem {
  id: string;
  type: string;
  status: string;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  pdfUrl: string | null;
  revocationReason: string | null;
  video: { id: string; title: string; slug: string; thumbnailUrl: string | null } | null;
  formTemplate: { id: string; name: string } | null;
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  GRANTED: 'bg-green-100 text-green-800',
  REVOKED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
};

export default function AccountConsentsPage() {
  const { t } = useI18n();
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<ConsentItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const fetchConsents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      const res = await fetch(`/api/account/consents?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setConsents(data.consents);
      setTotalPages(data.pagination.totalPages);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => { fetchConsents(); }, [fetchConsents]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetchWithCSRF(`/api/account/consents/${revokeTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', reason: revokeReason || undefined }),
      });
      if (res.ok) {
        toast.success(t('account.consents.revoked'));
        setRevokeTarget(null);
        setRevokeReason('');
        fetchConsents();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileCheck className="h-6 w-6 text-orange-600" />
          {t('account.consents.title')}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('account.consents.description')}
        </p>
      </div>

      {/* Consent List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : consents.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl">
          <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('account.consents.empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {consents.map(consent => (
            <div key={consent.id} className="bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[consent.status] || 'bg-gray-100'}`}>
                      {consent.status}
                    </span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {t(`consentType.${consent.type}`)}
                    </span>
                  </div>

                  {/* Video link */}
                  {consent.video ? (
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="h-4 w-4 text-gray-400 shrink-0" />
                      <Link
                        href={`/videos/${consent.video.slug}`}
                        className="text-sm font-medium text-orange-600 hover:underline truncate"
                      >
                        {consent.video.title}
                      </Link>
                    </div>
                  ) : null}

                  {/* Template name */}
                  {consent.formTemplate && (
                    <p className="text-xs text-gray-500 mb-1">
                      {consent.formTemplate.name}
                    </p>
                  )}

                  {/* Dates */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                    <span>
                      {t('account.consents.requestedOn')}: {new Date(consent.createdAt).toLocaleDateString()}
                    </span>
                    {consent.grantedAt && (
                      <span className="text-green-600">
                        {t('account.consents.grantedOn')}: {new Date(consent.grantedAt).toLocaleDateString()}
                      </span>
                    )}
                    {consent.revokedAt && (
                      <span className="text-red-600">
                        {t('account.consents.revokedOn')}: {new Date(consent.revokedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {consent.revocationReason && (
                    <p className="text-xs text-red-500 mt-1 italic">
                      {consent.revocationReason}
                    </p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {consent.pdfUrl && (
                    <a
                      href={consent.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="PDF"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  {consent.status === 'GRANTED' && (
                    <button
                      onClick={() => setRevokeTarget(consent)}
                      className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600"
                      title={t('account.consents.revokeTitle')}
                    >
                      <ShieldOff className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('common.previous')}
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            {t('common.next')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Revoke Dialog */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{t('account.consents.revokeTitle')}</h3>
              <button onClick={() => { setRevokeTarget(null); setRevokeReason(''); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {t('account.consents.revokeConfirm')}
            </p>

            {revokeTarget.video && (
              <p className="text-sm font-medium text-gray-800 mb-4 bg-gray-50 rounded p-2">
                {revokeTarget.video.title}
              </p>
            )}

            <textarea
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              placeholder={t('account.consents.revokeReason')}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 h-20 resize-none"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRevokeTarget(null); setRevokeReason(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {revoking && <Loader2 className="h-3 w-3 animate-spin" />}
                {t('account.consents.revokeTitle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

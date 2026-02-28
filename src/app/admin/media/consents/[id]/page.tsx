'use client';

/**
 * Admin Consent Detail Page
 * View full consent record: client info, Q&A responses, electronic proof, status actions
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { fetchWithCSRF } from '@/lib/csrf';
import {
  ArrowLeft, FileCheck, Loader2, User, Video, Calendar,
  Shield, Download, RefreshCw, ShieldOff, Clock, Globe,
  Monitor, Hash, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ConsentDetail {
  id: string;
  type: string;
  status: string;
  token: string;
  responses: Record<string, string | boolean> | null;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  signatureHash: string | null;
  pdfUrl: string | null;
  pdfGeneratedAt: string | null;
  revocationReason: string | null;
  requestedAt: string | null;
  client: { id: string; name: string | null; email: string; phone: string | null };
  video: { id: string; title: string; slug: string; thumbnailUrl: string | null; status: string } | null;
  formTemplate: { id: string; name: string; questions: unknown; legalText: string | null } | null;
  requestedBy: { id: string; name: string | null; email: string } | null;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  GRANTED: { bg: 'bg-green-100', text: 'text-green-800' },
  REVOKED: { bg: 'bg-red-100', text: 'text-red-800' },
  EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function AdminConsentDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [consent, setConsent] = useState<ConsentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/consents/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setConsent(data.consent);
      } catch {
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, t]);

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetchWithCSRF(`/api/admin/consents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setConsent(prev => prev ? { ...prev, ...data.consent } : null);
        toast.success(`Status updated to ${newStatus}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!consent) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{t('admin.consents.notFound')}</p>
        <Link href="/admin/media/consents" className="text-orange-600 hover:underline mt-2 inline-block">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const style = statusStyles[consent.status] || statusStyles.EXPIRED;
  const questions = Array.isArray(consent.formTemplate?.questions)
    ? (consent.formTemplate!.questions as Array<{ question: string; type: string; required: boolean }>)
    : [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <FileCheck className="h-6 w-6 text-orange-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('admin.consents.detailTitle')}</h1>
          <p className="text-xs text-gray-400 font-mono">{consent.id}</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
          {consent.status}
        </span>
      </div>

      {/* Client Info */}
      <section className="bg-white border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
          <User className="h-4 w-4" /> {t('admin.consents.clientInfo')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">{t('common.name')}:</span>{' '}
            <Link href={`/admin/clients/${consent.client.id}`} className="font-medium text-orange-600 hover:underline">
              {consent.client.name || '—'}
            </Link>
          </div>
          <div>
            <span className="text-gray-500">{t('common.email')}:</span>{' '}
            <span className="font-medium">{consent.client.email}</span>
          </div>
          {consent.client.phone && (
            <div>
              <span className="text-gray-500">{t('common.phone')}:</span>{' '}
              <span className="font-medium">{consent.client.phone}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">{t('admin.consents.consentType')}:</span>{' '}
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
              {t(`consentType.${consent.type}`)}
            </span>
          </div>
        </div>
      </section>

      {/* Related Video */}
      {consent.video && (
        <section className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Video className="h-4 w-4" /> {t('admin.consents.relatedVideo')}
          </h2>
          <div className="flex items-center gap-3">
            <Link href={`/admin/media/videos/${consent.video.id}`} className="text-orange-600 hover:underline font-medium">
              {consent.video.title}
            </Link>
            <span className={`text-xs px-2 py-0.5 rounded ${consent.video.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {consent.video.status}
            </span>
          </div>
        </section>
      )}

      {/* Questions & Answers */}
      {questions.length > 0 && consent.responses && (
        <section className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> {t('admin.consents.questionsAnswers')}
          </h2>
          <div className="space-y-4">
            {questions.map((q, i) => {
              const answer = consent.responses?.[String(i)];
              return (
                <div key={i} className="border-b last:border-0 pb-3 last:pb-0">
                  <p className="text-sm font-medium text-gray-700">
                    Q{i + 1}. {q.question}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 pl-4">
                    {q.type === 'checkbox'
                      ? (answer === true || answer === 'true' ? '✅ Yes' : '❌ No')
                      : q.type === 'signature'
                      ? (answer ? `✍️ ${answer}` : '—')
                      : (answer || '—')
                    }
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Dates & Timeline */}
      <section className="bg-white border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" /> {t('admin.consents.timeline')}
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">{t('admin.consents.created')}:</span>
            <span>{new Date(consent.createdAt).toLocaleString()}</span>
          </div>
          {consent.requestedAt && (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-gray-500">{t('admin.consents.requested')}:</span>
              <span>{new Date(consent.requestedAt).toLocaleString()}</span>
            </div>
          )}
          {consent.grantedAt && (
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-green-500" />
              <span className="text-gray-500">{t('admin.consents.granted')}:</span>
              <span className="text-green-600">{new Date(consent.grantedAt).toLocaleString()}</span>
            </div>
          )}
          {consent.revokedAt && (
            <div className="flex items-center gap-2">
              <ShieldOff className="h-3.5 w-3.5 text-red-500" />
              <span className="text-gray-500">{t('admin.consents.revokedLabel')}:</span>
              <span className="text-red-600">{new Date(consent.revokedAt).toLocaleString()}</span>
            </div>
          )}
          {consent.expiresAt && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-gray-500">{t('admin.consents.expires')}:</span>
              <span>{new Date(consent.expiresAt).toLocaleString()}</span>
            </div>
          )}
          {consent.revocationReason && (
            <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
              {t('admin.consents.revocationReason')}: {consent.revocationReason}
            </div>
          )}
        </div>
      </section>

      {/* Electronic Proof */}
      {(consent.ipAddress || consent.userAgent || consent.signatureHash) && (
        <section className="bg-white border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" /> {t('admin.consents.electronicProof')}
          </h2>
          <div className="space-y-2 text-sm font-mono">
            {consent.ipAddress && (
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-500">IP:</span>
                <span className="text-xs">{consent.ipAddress}</span>
              </div>
            )}
            {consent.userAgent && (
              <div className="flex items-start gap-2">
                <Monitor className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                <span className="text-gray-500">UA:</span>
                <span className="text-xs break-all">{consent.userAgent}</span>
              </div>
            )}
            {consent.signatureHash && (
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-500">SHA-256:</span>
                <span className="text-xs break-all">{consent.signatureHash}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="bg-white border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">{t('common.actions')}</h2>
        <div className="flex flex-wrap gap-3">
          {consent.pdfUrl && (
            <a
              href={consent.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <Download className="h-4 w-4" /> {t('admin.consents.downloadPdf')}
            </a>
          )}
          {consent.status === 'PENDING' && (
            <button
              onClick={() => handleStatusChange('GRANTED')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {t('admin.consents.markGranted')}
            </button>
          )}
          {consent.status === 'GRANTED' && (
            <button
              onClick={() => handleStatusChange('REVOKED')}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              {t('admin.consents.markRevoked')}
            </button>
          )}
          {consent.requestedBy && (
            <div className="text-xs text-gray-400 flex items-center gap-1 self-center ml-auto">
              {t('admin.consents.requestedByLabel')}: {consent.requestedBy.name || consent.requestedBy.email}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

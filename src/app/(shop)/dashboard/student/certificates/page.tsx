'use client';

/**
 * Student Certificates Dashboard
 * Displays all certificates earned by the current student.
 * Cards show course title, issue date, verification code, status,
 * with actions: download PDF, share link, QR code indicator.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/hooks/useTranslations';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────

type CertificateStatus = 'ISSUED' | 'REVOKED' | 'EXPIRED';

interface Certificate {
  id: string;
  courseTitle: string;
  studentName: string;
  issuedAt: string;
  expiresAt: string | null;
  verificationCode: string;
  status: CertificateStatus;
  pdfUrl: string | null;
  qrCodeUrl: string | null;
  courseThumbnailUrl: string | null;
}

type FilterTab = 'all' | 'active' | 'expired';

// ── Helpers ────────────────────────────────────────────────

function isActive(cert: Certificate): boolean {
  if (cert.status !== 'ISSUED') return false;
  if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) return false;
  return true;
}

function isExpiredOrRevoked(cert: Certificate): boolean {
  if (cert.status === 'REVOKED') return true;
  if (cert.status === 'EXPIRED') return true;
  if (cert.status === 'ISSUED' && cert.expiresAt && new Date(cert.expiresAt) < new Date()) return true;
  return false;
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return new Date(dateStr).toLocaleDateString();
  }
}

function getDisplayStatus(cert: Certificate): 'ACTIVE' | 'EXPIRED' | 'REVOKED' {
  if (cert.status === 'REVOKED') return 'REVOKED';
  if (cert.status === 'EXPIRED') return 'EXPIRED';
  if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) return 'EXPIRED';
  return 'ACTIVE';
}

// ── Component ──────────────────────────────────────────────

export default function StudentCertificatesPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const { t, locale } = useTranslations();

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');

  // Redirect unauthenticated users
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  // Fetch certificates
  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lms/certificates');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setCertificates(data.certificates ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchCertificates();
    }
  }, [sessionStatus, fetchCertificates]);

  // Filter
  const filteredCertificates = useMemo(() => {
    switch (filter) {
      case 'active':
        return certificates.filter(isActive);
      case 'expired':
        return certificates.filter(isExpiredOrRevoked);
      default:
        return certificates;
    }
  }, [certificates, filter]);

  // Actions
  const handleCopyVerificationLink = useCallback(
    (verificationCode: string) => {
      const url = `${window.location.origin}/api/lms/certificates/verify?code=${encodeURIComponent(verificationCode)}`;
      navigator.clipboard.writeText(url).then(
        () => toast.success(t('lms.certificateLinkCopied')),
        () => toast.error(t('lms.certificateCopyFailed'))
      );
    },
    [t]
  );

  const handleDownload = useCallback(
    (certId: string) => {
      // Opens the download endpoint in a new tab
      window.open(`/api/lms/certificates/${certId}/download`, '_blank');
    },
    []
  );

  // ── Render States ────────────────────────────────────────

  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('lms.myCertificates')}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t('lms.myCertificatesDesc')}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6" role="tablist" aria-label={t('lms.certificateFilter')}>
          {(['all', 'active', 'expired'] as FilterTab[]).map((tab) => {
            const isSelected = filter === tab;
            const count =
              tab === 'all'
                ? certificates.length
                : tab === 'active'
                  ? certificates.filter(isActive).length
                  : certificates.filter(isExpiredOrRevoked).length;

            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setFilter(tab)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                {t(`lms.filterTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`)} ({count})
              </button>
            );
          })}
        </div>

        {/* Error State */}
        {error && (
          <div
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300"
            role="alert"
          >
            <p className="font-medium">{t('lms.certificateLoadError')}</p>
            <button
              onClick={fetchCertificates}
              className="mt-2 text-sm underline hover:no-underline"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!error && filteredCertificates.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-gray-400 dark:text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {filter === 'all'
                ? t('lms.noCertificatesStudent')
                : t('lms.noCertificatesFilter')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {filter === 'all'
                ? t('lms.noCertificatesStudentDesc')
                : t('lms.noCertificatesFilterDesc')}
            </p>
          </div>
        )}

        {/* Certificate Grid */}
        {filteredCertificates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCertificates.map((cert) => {
              const displayStatus = getDisplayStatus(cert);

              return (
                <div
                  key={cert.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail / Header */}
                  <div className="relative h-32 bg-gradient-to-br from-blue-500 to-indigo-600">
                    {cert.courseThumbnailUrl && (
                      <img
                        src={cert.courseThumbnailUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-white/80"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                        />
                      </svg>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <StatusBadge status={displayStatus} t={t} />
                    </div>

                    {/* QR Code indicator */}
                    {cert.qrCodeUrl && (
                      <div
                        className="absolute top-3 left-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center"
                        title={t('lms.qrCodeAvailable')}
                      >
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75H16.5v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75H16.5v-.75z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3
                      className="text-lg font-semibold text-gray-900 dark:text-white mb-3 line-clamp-2"
                      title={cert.courseTitle}
                    >
                      {cert.courseTitle}
                    </h3>

                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      {/* Issue date */}
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                          />
                        </svg>
                        <span>
                          {t('lms.issuedOn')}: {formatDate(cert.issuedAt, locale)}
                        </span>
                      </div>

                      {/* Expiry date */}
                      {cert.expiresAt && (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>
                            {t('lms.expiresOn')}: {formatDate(cert.expiresAt, locale)}
                          </span>
                        </div>
                      )}

                      {/* Verification code */}
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                          />
                        </svg>
                        <span
                          className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded select-all"
                          title={t('lms.verificationCode')}
                        >
                          {cert.verificationCode.substring(0, 8)}...
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                      {/* Download PDF */}
                      <button
                        onClick={() => handleDownload(cert.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        aria-label={`${t('lms.downloadCertificate')} - ${cert.courseTitle}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                        {t('lms.downloadCertificate')}
                      </button>

                      {/* Share Link */}
                      <button
                        onClick={() => handleCopyVerificationLink(cert.verificationCode)}
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        aria-label={t('lms.shareLink')}
                        title={t('lms.shareLink')}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Status Badge Subcomponent ─────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  t: (key: string) => string;
}) {
  const styles = {
    ACTIVE:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800',
    EXPIRED:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    REVOKED:
      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  const labels = {
    ACTIVE: t('lms.certificateStatusActive'),
    EXPIRED: t('lms.certificateStatusExpired'),
    REVOKED: t('lms.certificateStatusRevoked'),
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

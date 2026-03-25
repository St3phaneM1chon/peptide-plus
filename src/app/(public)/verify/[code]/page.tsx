export const dynamic = 'force-dynamic';

/**
 * PUBLIC CERTIFICATE VERIFICATION PAGE
 * Verifies a certificate by its verification code (from QR code or link)
 * No authentication required
 */

import Link from 'next/link';
import { getApiTranslator } from '@/i18n/server';

interface PageProps {
  params: Promise<{ code: string }>;
}

async function verifyCertificateByCode(code: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/lms/certificates/verify?code=${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) return { valid: false, certificate: null };
      return { valid: false, certificate: null };
    }
    return await res.json();
  } catch {
    return { valid: false, certificate: null };
  }
}

export default async function CertificateVerificationPage({ params }: PageProps) {
  const { code } = await params;
  const { t, formatDate } = await getApiTranslator();

  if (!code) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('lms.certificate.noCode')}</h1>
          <p className="text-gray-500">{t('lms.certificate.noCodeDesc')}</p>
        </div>
      </div>
    );
  }

  const result = await verifyCertificateByCode(code);
  const cert = result.certificate;
  const isValid = result.valid;

  if (!cert) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('lms.certificate.notFound')}</h1>
          <p className="text-gray-500 mb-6">{t('lms.certificate.notFoundDesc')}</p>
          <Link
            href="/"
            className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            {t('lms.certificate.verifyAnother')}
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = (() => {
    if (cert.status === 'REVOKED') {
      return {
        icon: (
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ),
        bgColor: 'bg-red-100',
        title: t('lms.certificate.revoked'),
        desc: t('lms.certificate.revokedDesc'),
        badgeColor: 'bg-red-100 text-red-700',
      };
    }
    if (!isValid) {
      return {
        icon: (
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        bgColor: 'bg-yellow-100',
        title: t('lms.certificate.expired'),
        desc: t('lms.certificate.expiredDesc'),
        badgeColor: 'bg-yellow-100 text-yellow-700',
      };
    }
    return {
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      bgColor: 'bg-green-100',
      title: t('lms.certificate.valid'),
      desc: t('lms.certificate.validDesc'),
      badgeColor: 'bg-green-100 text-green-700',
    };
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Verification Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('lms.certificate.verification')}</h1>
        </div>

        {/* Certificate Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Status Banner */}
          <div className={`p-6 text-center ${statusConfig.bgColor}`}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 bg-white/60">
              {statusConfig.icon}
            </div>
            <h2 className="text-xl font-bold text-gray-900">{statusConfig.title}</h2>
            <p className="text-sm text-gray-600 mt-1">{statusConfig.desc}</p>
          </div>

          {/* Certificate Details */}
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{t('lms.certificate.courseName')}</p>
                <p className="text-lg font-semibold text-gray-900 mt-0.5">{cert.courseTitle}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.badgeColor}`}>
                {cert.status === 'ISSUED' ? t('lms.certificateStatusActive') : cert.status === 'REVOKED' ? t('lms.certificateStatusRevoked') : t('lms.certificateStatusExpired')}
              </span>
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">{t('lms.certificate.studentName')}</p>
              <p className="text-gray-900 font-medium mt-0.5">{cert.studentName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">{t('lms.certificate.issuedDate')}</p>
                <p className="text-gray-900 text-sm mt-0.5">
                  {formatDate(cert.issuedAt)}
                </p>
              </div>
              {cert.expiresAt && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{t('lms.certificate.expiryDate')}</p>
                  <p className="text-gray-900 text-sm mt-0.5">
                    {formatDate(cert.expiresAt)}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {t('lms.verificationCode')}: <span className="font-mono">{code}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

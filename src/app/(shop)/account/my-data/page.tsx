'use client';

/**
 * PAGE MES DONNEES - RGPD Art. 15 (Droit d'acces)
 * Permet aux utilisateurs de consulter toutes les donnees stockees a leur sujet.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface MyDataResponse {
  personalInfo: {
    name: string | null;
    email: string;
    phone: string | null;
    locale: string | null;
    createdAt: string;
  };
  orders: {
    total: number;
    recent: Array<{
      id: string;
      orderNumber: string;
      status: string;
      total: number;
      date: string;
    }>;
  };
  addresses: Array<{
    id: string;
    label: string | null;
    recipientName: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
  }>;
  reviews: {
    total: number;
    recent: Array<{
      id: string;
      rating: number;
      title: string | null;
      date: string;
    }>;
  };
  wishlist: {
    count: number;
  };
  loyalty: {
    points: number;
    tier: string;
    lifetimePoints: number;
  };
  consents: Array<{
    type: string;
    source: string;
    grantedAt: string;
    revokedAt: string | null;
  }>;
  sessions: {
    active: number;
  };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-neutral-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DataSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">{icon}</span>
          <span className="font-medium text-neutral-900">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-6 pb-5 border-t border-neutral-100">
          {children}
        </div>
      )}
    </div>
  );
}

export default function MyDataPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale: _locale, formatDate, formatCurrency } = useI18n();
  const [data, setData] = useState<MyDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/my-data');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/account/my-data')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(setData)
        .catch((err) => {
          console.error('Failed to load my data:', err);
          toast.error(t('account.myData.fetchError'));
        })
        .finally(() => setLoading(false));
    }
  }, [session, t]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/account/data-export');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('account.myData.exportSuccess'));
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(
        error instanceof Error ? error.message : t('account.myData.fetchError')
      );
    } finally {
      setExporting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const noData = t('account.myData.noData');

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <nav className="text-sm text-neutral-500 mb-2" aria-label="breadcrumb">
          <Link href="/" className="hover:text-orange-600">
            {t('nav.home')}
          </Link>
          <span className="mx-2">/</span>
          <Link href="/account" className="hover:text-orange-600">
            {t('account.myAccount')}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-900">{t('account.myData.title')}</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900">
              {t('account.myData.title')}
            </h1>
            <p className="text-neutral-500 mt-1">
              {t('account.myData.description')}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('account.myData.exporting')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('account.myData.exportButton')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Data Sections */}
      <div className="space-y-4">
        {/* 1. Personal Information */}
        <DataSection
          title={t('account.myData.personalInfo')}
          icon="👤"
          defaultOpen={true}
        >
          {data?.personalInfo ? (
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <dt className="text-sm text-neutral-500">{t('account.fullName')}</dt>
                <dd className="text-neutral-900 font-medium">{data.personalInfo.name || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">{t('account.email')}</dt>
                <dd className="text-neutral-900 font-medium">{data.personalInfo.email}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">{t('account.phone')}</dt>
                <dd className="text-neutral-900 font-medium">{data.personalInfo.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">{t('account.preferredLanguage')}</dt>
                <dd className="text-neutral-900 font-medium">{data.personalInfo.locale || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">{t('account.memberSince')}</dt>
                <dd className="text-neutral-900 font-medium">{formatDate(data.personalInfo.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-neutral-500">{noData}</p>
          )}
        </DataSection>

        {/* 2. Orders */}
        <DataSection
          title={t('account.myData.orders')}
          icon="📦"
          badge={data?.orders.total}
        >
          {data?.orders && data.orders.total > 0 ? (
            <div className="mt-4">
              <p className="text-sm text-neutral-500 mb-3">
                {data.orders.total} {t('account.myData.orders').toLowerCase()}
              </p>
              <div className="space-y-2">
                {data.orders.recent.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg text-sm"
                  >
                    <div>
                      <span className="font-mono text-neutral-700">#{order.orderNumber}</span>
                      <span className="mx-2 text-neutral-400">|</span>
                      <span className="text-neutral-500">
                        {formatDate(order.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-900 font-medium">
                        {formatCurrency(order.total)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'DELIVERED'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-neutral-500">{noData}</p>
          )}
        </DataSection>

        {/* 3. Addresses */}
        <DataSection
          title={t('account.myData.addresses')}
          icon="📍"
          badge={data?.addresses.length}
        >
          {data?.addresses && data.addresses.length > 0 ? (
            <div className="mt-4 space-y-3">
              {data.addresses.map((addr) => (
                <div key={addr.id} className="p-3 bg-neutral-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-neutral-900">
                      {addr.label || addr.recipientName}
                    </span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-600">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}
                    <br />
                    {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-500">{noData}</p>
          )}
        </DataSection>

        {/* 4. Reviews */}
        <DataSection
          title={t('account.myData.reviews')}
          icon="⭐"
          badge={data?.reviews.total}
        >
          {data?.reviews && data.reviews.total > 0 ? (
            <div className="mt-4">
              <p className="text-sm text-neutral-500 mb-3">
                {data.reviews.total} {t('account.myData.reviews').toLowerCase()}
              </p>
              <div className="space-y-2">
                {data.reviews.recent.map((review) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-neutral-300'}`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-neutral-700">{review.title || '-'}</span>
                    </div>
                    <span className="text-neutral-500 text-xs">
                      {formatDate(review.date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-neutral-500">{noData}</p>
          )}
        </DataSection>

        {/* 5. Wishlist */}
        <DataSection
          title={t('account.myData.wishlist')}
          icon="❤️"
          badge={data?.wishlist.count}
        >
          <p className="mt-4 text-neutral-600 text-sm">
            {data?.wishlist.count
              ? `${data.wishlist.count} ${t('account.myData.wishlist').toLowerCase()}`
              : noData}
          </p>
        </DataSection>

        {/* 6. Loyalty */}
        <DataSection
          title={t('account.myData.loyalty')}
          icon="🏆"
          badge={data?.loyalty.tier}
        >
          {data?.loyalty ? (
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-neutral-50 rounded-lg text-center">
                <dt className="text-xs text-neutral-500 mb-1">{t('account.loyaltyPoints')}</dt>
                <dd className="text-xl font-bold text-orange-600">{data.loyalty.points}</dd>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg text-center">
                <dt className="text-xs text-neutral-500 mb-1">{t('account.myData.loyalty')}</dt>
                <dd className="text-xl font-bold text-neutral-900">{data.loyalty.tier}</dd>
              </div>
              <div className="p-3 bg-neutral-50 rounded-lg text-center">
                <dt className="text-xs text-neutral-500 mb-1">Lifetime</dt>
                <dd className="text-xl font-bold text-neutral-700">{data.loyalty.lifetimePoints}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-neutral-500">{noData}</p>
          )}
        </DataSection>

        {/* 7. Consent Records */}
        <DataSection
          title={t('account.myData.consents')}
          icon="✅"
          badge={data?.consents.length}
        >
          {data?.consents && data.consents.length > 0 ? (
            <div className="mt-4 space-y-2">
              {data.consents.map((consent, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg text-sm"
                >
                  <div>
                    <span className="font-medium text-neutral-900">{consent.type}</span>
                    <span className="mx-2 text-neutral-400">|</span>
                    <span className="text-neutral-500">{consent.source}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500 text-xs">
                      {formatDate(consent.grantedAt)}
                    </span>
                    {consent.revokedAt ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-500">{noData}</p>
          )}
        </DataSection>

        {/* 8. Active Sessions */}
        <DataSection
          title={t('account.myData.sessions')}
          icon="🔒"
          badge={data?.sessions.active}
        >
          <p className="mt-4 text-neutral-600 text-sm">
            {data?.sessions.active !== undefined
              ? `${data.sessions.active} ${t('account.myData.sessions').toLowerCase()}`
              : noData}
          </p>
        </DataSection>
      </div>

      {/* RGPD Notice */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p>
          {t('account.myData.rgpdNotice')}
        </p>
      </div>
    </div>
  );
}

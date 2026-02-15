/**
 * DIGITAL DELIVERY TRACKING
 * Suivi pour produits numériques (cours, formations, ebooks)
 * Accès immédiat après paiement
 */

'use client';

import Link from 'next/link';
import { TrackingTimeline } from './TrackingTimeline';
import { OrderSummary } from './OrderSummary';
import { useTranslations } from '@/hooks/useTranslations';

interface DigitalDeliveryTrackingProps {
  order: {
    id: string;
    createdAt: Date | string;
    amount: number;
    currency: string;
    paymentMethod: string;
    product: {
      id: string;
      name: string;
      slug: string;
      imageUrl: string | null;
      category: { name: string } | null;
    };
    user: {
      name: string | null;
      email: string;
    };
    courseAccess?: {
      createdAt: Date | string;
    } | null;
  };
}

export function DigitalDeliveryTracking({ order }: DigitalDeliveryTrackingProps) {
  const { t } = useTranslations();
  const purchaseDate = new Date(order.createdAt);

  // Étapes pour produit numérique (accès immédiat)
  const steps = [
    {
      id: 'payment',
      title: t('order.tracking.paymentConfirmed'),
      description: t('order.tracking.paymentConfirmedDesc'),
      timestamp: purchaseDate,
      status: 'completed' as const,
      icon: 'check',
    },
    {
      id: 'access',
      title: t('order.tracking.accessActivated'),
      description: t('order.tracking.accessActivatedDesc'),
      timestamp: order.courseAccess
        ? new Date(order.courseAccess.createdAt)
        : new Date(purchaseDate.getTime() + 1000),
      status: order.courseAccess ? 'completed' as const : 'current' as const,
      icon: 'unlock',
    },
    {
      id: 'ready',
      title: t('order.tracking.readyToUse'),
      description: t('order.tracking.readyToUseDesc'),
      timestamp: order.courseAccess
        ? new Date(order.courseAccess.createdAt)
        : null,
      status: order.courseAccess ? 'completed' as const : 'pending' as const,
      icon: 'play',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Bandeau accès immédiat */}
      <div
        style={{
          backgroundColor: '#E8F5E9',
          border: '1px solid #A5D6A7',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#4CAF50',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="white"
            width="24"
            height="24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
            />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#2E7D32',
              marginBottom: '4px',
            }}
          >
            {t('order.tracking.immediateAccess')}
          </h3>
          <p style={{ fontSize: '14px', color: '#388E3C' }}>
            {t('order.tracking.courseReady').replace('{name}', order.product.name)}
          </p>
        </div>
        <Link
          href={`/cours/${order.product.slug}/learn`}
          className="btn btn-primary"
          style={{
            backgroundColor: '#4CAF50',
            padding: '12px 24px',
          }}
        >
          {t('order.tracking.startNow')}
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Timeline */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid var(--gray-200)',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--gray-500)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📱</span>
            {t('order.tracking.digitalDelivery')}
          </h2>
          <TrackingTimeline steps={steps} />
        </div>

        {/* Résumé */}
        <OrderSummary order={{ ...order, createdAt: new Date(order.createdAt) }} />
      </div>

      {/* Actions */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid var(--gray-200)',
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--gray-500)',
            marginBottom: '16px',
          }}
        >
          {t('order.tracking.yourContent')}
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          <Link
            href={`/cours/${order.product.slug}/learn`}
            className="btn btn-primary"
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="18"
              height="18"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
              />
            </svg>
            {t('order.tracking.accessCourse')}
          </Link>

          <a
            href={`/api/receipts/${order.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="18"
              height="18"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            {t('order.tracking.downloadReceipt')}
          </a>

          <Link
            href={`/account/orders`}
            className="btn btn-secondary"
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="18"
              height="18"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
              />
            </svg>
            {t('order.tracking.myCertificates')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default DigitalDeliveryTracking;

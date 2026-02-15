/**
 * PHYSICAL DELIVERY TRACKING
 * Suivi pour produits physiques avec expédition
 */

'use client';

import Link from 'next/link';
import { TrackingTimeline } from './TrackingTimeline';
import { OrderSummary } from './OrderSummary';
import { useTranslations } from '@/hooks/useTranslations';

interface ShippingInfo {
  status: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: Date | string;
  deliveredAt?: Date | string;
  estimatedDelivery?: Date | string;
  recipientName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

interface PhysicalDeliveryTrackingProps {
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
    shipping?: ShippingInfo | null;
  };
}

export function PhysicalDeliveryTracking({ order }: PhysicalDeliveryTrackingProps) {
  const { t } = useTranslations();
  const shipping = order.shipping;
  const purchaseDate = new Date(order.createdAt);

  // Générer les étapes selon le statut d'expédition
  const steps = generateShippingSteps(shipping, purchaseDate, t);

  // Calculer la progression
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progressPercent = (completedSteps / steps.length) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Carte de suivi principale */}
      {shipping?.trackingNumber && (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid var(--gray-200)',
          }}
        >
          {/* Barre de progression */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                {t('order.tracking.progress')}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                }}
              >
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div
              style={{
                height: '8px',
                backgroundColor: 'var(--gray-200)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  backgroundColor:
                    shipping?.status === 'DELIVERED' ? '#4CAF50' : '#2196F3',
                  borderRadius: '4px',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>

          {/* Infos transporteur */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: 'var(--gray-100)',
              borderRadius: '8px',
              marginBottom: '24px',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--gray-400)',
                  marginBottom: '4px',
                }}
              >
                {t('order.tracking.carrier')}
              </p>
              <p
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                }}
              >
                {shipping.carrier || t('order.tracking.notAssigned')}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--gray-400)',
                  marginBottom: '4px',
                }}
              >
                {t('order.tracking.trackingNumber')}
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: 'var(--gray-500)',
                }}
              >
                {shipping.trackingNumber}
              </p>
            </div>
            {shipping.trackingUrl && (
              <a
                href={shipping.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {t('order.tracking.trackPackage')}
              </a>
            )}
          </div>

          {/* Estimation livraison */}
          {shipping.estimatedDelivery && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#E3F2FD',
                borderRadius: '8px',
                marginBottom: '24px',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="#1976D2"
                width="24"
                height="24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
              <div>
                <p style={{ fontSize: '13px', color: '#1976D2' }}>
                  {t('order.tracking.estimatedDelivery')}
                </p>
                <p
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#1565C0',
                  }}
                >
                  {new Date(shipping.estimatedDelivery).toLocaleDateString(
                    'fr-CA',
                    {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    }
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--gray-500)',
              marginBottom: '16px',
            }}
          >
            {t('order.tracking.history')}
          </h3>
          <TrackingTimeline steps={steps} />
        </div>
      )}

      {/* Si pas encore expédié */}
      {!shipping?.trackingNumber && (
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid var(--gray-200)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px',
              backgroundColor: '#FFF3E0',
              borderRadius: '8px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#FF9800',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                  d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
                />
              </svg>
            </div>
            <div>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#E65100',
                  marginBottom: '4px',
                }}
              >
                {t('order.tracking.beingPrepared')}
              </h3>
              <p style={{ fontSize: '14px', color: '#F57C00' }}>
                {t('order.tracking.beingPreparedDesc')}
              </p>
            </div>
          </div>

          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--gray-500)',
              marginBottom: '16px',
            }}
          >
            {t('order.tracking.deliverySteps')}
          </h3>
          <TrackingTimeline steps={steps} />
        </div>
      )}

      {/* Adresse de livraison */}
      {shipping && (
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
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="20"
              height="20"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
              />
            </svg>
            {t('order.tracking.shippingAddress')}
          </h2>

          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--gray-100)',
              borderRadius: '8px',
            }}
          >
            <p
              style={{
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--gray-500)',
                marginBottom: '4px',
              }}
            >
              {shipping.recipientName}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
              {shipping.addressLine1}
            </p>
            {shipping.addressLine2 && (
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                {shipping.addressLine2}
              </p>
            )}
            <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
              {shipping.city}, {shipping.state} {shipping.postalCode}
            </p>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
              {shipping.country}
            </p>
            {shipping.phone && (
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--gray-400)',
                  marginTop: '8px',
                }}
              >
                {t('order.tracking.phone')}: {shipping.phone}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Résumé commande */}
      <OrderSummary order={{ ...order, createdAt: new Date(order.createdAt) }} />

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
          {t('order.tracking.needHelp')}
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
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
            {t('order.tracking.downloadReceipt')}
          </a>

          <Link
            href="/contact"
            className="btn btn-secondary"
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {t('order.tracking.contactSupport')}
          </Link>

          <Link
            href="/faq/livraison"
            className="btn btn-secondary"
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {t('order.tracking.faqDelivery')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function generateShippingSteps(shipping: ShippingInfo | null | undefined, purchaseDate: Date, t: (key: string) => string) {
  const steps = [
    {
      id: 'confirmed',
      title: t('order.tracking.orderConfirmed'),
      description: t('order.tracking.paymentReceived'),
      timestamp: purchaseDate,
      status: 'completed' as const,
      icon: 'check',
    },
    {
      id: 'processing',
      title: t('order.tracking.inPreparation'),
      description: t('order.tracking.orderBeingPacked'),
      timestamp: shipping?.status !== 'PENDING'
        ? new Date(purchaseDate.getTime() + 3600000)
        : null,
      status: shipping?.status !== 'PENDING' ? 'completed' as const : 'current' as const,
      icon: 'package',
    },
    {
      id: 'shipped',
      title: t('order.tracking.shipped'),
      description: shipping?.carrier
        ? t('order.tracking.handledByCarrier').replace('{carrier}', shipping.carrier)
        : t('order.tracking.givenToCarrier'),
      timestamp: shipping?.shippedAt ? new Date(shipping.shippedAt) : null,
      status: ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(shipping?.status ?? '')
        ? 'completed' as const
        : 'pending' as const,
      icon: 'truck',
    },
    {
      id: 'transit',
      title: t('order.tracking.inTransit'),
      description: t('order.tracking.enRoute'),
      timestamp: null,
      status: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(shipping?.status ?? '')
        ? 'completed' as const
        : 'pending' as const,
      icon: 'transit',
    },
    {
      id: 'delivery',
      title: t('order.tracking.outForDelivery'),
      description: t('order.tracking.driverOnWay'),
      timestamp: null,
      status: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(shipping?.status ?? '')
        ? 'completed' as const
        : 'pending' as const,
      icon: 'delivery',
    },
    {
      id: 'delivered',
      title: t('order.tracking.delivered'),
      description: shipping?.deliveredAt
        ? t('order.tracking.deliveredOn').replace('{date}', new Date(shipping.deliveredAt).toLocaleDateString())
        : t('order.tracking.toYourAddress'),
      timestamp: shipping?.deliveredAt ? new Date(shipping.deliveredAt) : null,
      status: shipping?.status === 'DELIVERED' ? 'completed' as const : 'pending' as const,
      icon: 'home',
    },
  ];

  return steps;
}

export default PhysicalDeliveryTracking;

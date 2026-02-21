export const dynamic = 'force-dynamic';
/**
 * PAGE SUIVI COMMANDE - Routeur
 * Redirige vers le bon type de suivi selon le produit
 */

import type { Metadata } from 'next';
import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { PhysicalDeliveryTracking } from '@/components/order/PhysicalDeliveryTracking';

interface TrackingPageProps {
  params: Promise<{ orderId: string }>;
}

export async function generateMetadata({ params }: TrackingPageProps): Promise<Metadata> {
  const { orderId } = await params;

  return {
    title: `Order Tracking - ${orderId}`,
    description: 'Track the status and delivery of your BioCycle Peptides order.',
    robots: { index: false, follow: false },
  };
}

async function getOrder(orderId: string, userId: string) {
  return prisma.purchase.findFirst({
    where: {
      OR: [
        { id: orderId },
        { receiptNumber: orderId },
      ],
      userId,
    },
    include: {
      user: true,
      product: {
        include: { category: true },
      },
      courseAccess: true,
      shipping: {
        include: {
          statusHistory: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });
}

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { orderId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/order/${orderId}/tracking`);
  }

  const order = await getOrder(orderId, session.user.id);

  if (!order) {
    notFound();
  }

  // Tous les produits BioCycle sont physiques et nécessitent une livraison
  return (
    <div style={{ backgroundColor: 'var(--gray-100)', minHeight: '100vh' }}>
      {/* Header commun */}
      <TrackingHeader order={order} />

      {/* Contenu - suivi de livraison physique */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <PhysicalDeliveryTracking order={{ ...order, amount: Number(order.amount), createdAt: new Date(order.createdAt) } as React.ComponentProps<typeof PhysicalDeliveryTracking>['order']} />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Order object has deep nested structure from Prisma
function TrackingHeader({ order }: { order: any }) {
  const isDigital = order.product.productType === 'DIGITAL';
  const statusLabel = isDigital
    ? order.courseAccess ? 'Accès activé' : 'En préparation'
    : order.shipping?.status === 'DELIVERED' ? 'Livré' : 
      order.shipping?.status === 'SHIPPED' ? 'En transit' : 'En préparation';

  const statusColor = 
    (order.courseAccess || order.shipping?.status === 'DELIVERED') ? '#4CAF50' :
    order.shipping?.status === 'SHIPPED' ? '#2196F3' : '#FF9800';

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-200)',
        padding: '20px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <a
          href="/dashboard/customer/achats"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'var(--gray-400)',
            marginBottom: '16px',
            textDecoration: 'none',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            width="16"
            height="16"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
          Mes commandes
        </a>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: 'var(--gray-500)',
                marginBottom: '4px',
              }}
            >
              Suivi de commande
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
              <span style={{ fontFamily: 'monospace' }}>
                {order.receiptNumber || order.id}
              </span>
              <span style={{ margin: '0 8px' }}>•</span>
              <span>
                {order.product.productType === 'DIGITAL' ? '📱 Produit numérique' :
                 order.product.productType === 'PHYSICAL' ? '📦 Produit physique' :
                 '📱📦 Produit hybride'}
              </span>
            </p>
          </div>

          <div
            style={{
              padding: '8px 16px',
              backgroundColor: `${statusColor}15`,
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              color: statusColor,
            }}
          >
            {statusLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

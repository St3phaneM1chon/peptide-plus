/**
 * API Order Tracking - BioCycle Peptides
 * Recherche une commande par numéro + email et retourne le statut de livraison
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Order Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

const STATUS_ORDER = [
  'PENDING', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');
    const email = searchParams.get('email');

    if (!orderNumber || !email) {
      return NextResponse.json(
        { found: false, error: 'Order number and email required' },
        { status: 400 }
      );
    }

    // Chercher la commande dans la DB
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim(),
        user: { email: email.toLowerCase().trim() },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        carrier: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ found: false });
    }

    // Construire la timeline des étapes
    const currentStatusIndex = STATUS_ORDER.indexOf(order.status);
    const steps = STATUS_ORDER.map((status, index) => ({
      status: STATUS_LABELS[status] || status,
      date: index === 0 && order.createdAt
        ? order.createdAt.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
        : status === 'SHIPPED' && order.shippedAt
        ? order.shippedAt.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
        : status === 'DELIVERED' && order.deliveredAt
        ? order.deliveredAt.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })
        : '',
      location: '',
      completed: index <= currentStatusIndex,
    }));

    return NextResponse.json({
      found: true,
      status: STATUS_LABELS[order.status] || order.status,
      trackingNumber: order.trackingNumber || undefined,
      carrier: order.carrier || undefined,
      trackingUrl: order.trackingUrl || undefined,
      estimatedDelivery: undefined,
      steps,
    });

  } catch (error) {
    console.error('Order tracking error:', error);
    return NextResponse.json(
      { found: false, error: 'Erreur de recherche' },
      { status: 500 }
    );
  }
}

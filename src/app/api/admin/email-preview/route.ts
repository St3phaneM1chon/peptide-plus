export const dynamic = 'force-dynamic';

/**
 * ADMIN - Email Template Preview
 *
 * Improvement #51: Preview email templates with locale support
 *
 * GET /api/admin/email-preview?template=welcome&locale=fr
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  orderConfirmationEmail,
  welcomeEmail,
  passwordResetEmail,
  shippingUpdateEmail,
  receiptEmail,
  backInStockEmail,
  orderCancellationEmail,
} from '@/lib/email-templates';
import type { Locale } from '@/i18n/config';

// Sample data for previews
const sampleData = {
  welcome: {
    userName: 'John Doe',
    verificationUrl: 'https://example.com/verify?token=abc123',
  },
  orderConfirmation: {
    customerName: 'John Doe',
    orderNumber: 'ORD-2026-001234',
    productName: 'BPC-157 5mg',
    amount: 89.99,
    isDigital: false,
    trackingUrl: 'https://example.com/track/abc',
  },
  passwordReset: {
    userName: 'John Doe',
    resetUrl: 'https://example.com/reset?token=xyz',
    expiresIn: '1 hour',
  },
  shippingUpdate: {
    customerName: 'John Doe',
    orderNumber: 'ORD-2026-001234',
    productName: 'BPC-157 5mg',
    status: 'SHIPPED',
    trackingNumber: 'CAN123456789',
    trackingUrl: 'https://example.com/track',
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
  receipt: {
    customerName: 'John Doe',
    orderNumber: 'ORD-2026-001234',
    items: [
      { name: 'BPC-157 5mg', price: 79.99 },
      { name: 'TB-500 2mg', price: 59.99 },
    ],
    subtotal: 139.98,
    taxes: [{ name: 'GST (5%)', amount: 7.0 }, { name: 'QST (9.975%)', amount: 13.97 }],
    total: 160.95,
    paymentMethod: 'Visa ending in 4242',
    receiptUrl: 'https://example.com/receipt/abc',
  },
  backInStock: {
    productName: 'BPC-157 5mg',
    productSlug: 'bpc-157-5mg',
    formatName: 'Vial 2ml',
    price: 79.99,
    currency: 'CAD',
    imageUrl: 'https://example.com/images/bpc-157.jpg',
  },
  orderCancellation: {
    customerName: 'John Doe',
    orderNumber: 'ORD-2026-001234',
    total: 160.95,
    items: [{ name: 'BPC-157 5mg', quantity: 2 }],
    refundAmount: 160.95,
    refundMethod: 'Visa ending in 4242',
  },
};

const templateMap: Record<string, (locale: Locale) => { subject: string; html: string }> = {
  welcome: (locale) => welcomeEmail(sampleData.welcome, locale),
  'order-confirmation': (locale) => orderConfirmationEmail(sampleData.orderConfirmation, locale),
  'password-reset': (locale) => passwordResetEmail(sampleData.passwordReset, locale),
  'shipping-update': (locale) => shippingUpdateEmail(sampleData.shippingUpdate, locale),
  receipt: (locale) => receiptEmail(sampleData.receipt, locale),
  'back-in-stock': (locale) => backInStockEmail(sampleData.backInStock, locale),
  'order-cancellation': (locale) => orderCancellationEmail(sampleData.orderCancellation, locale),
};

export const GET = withAdminGuard(async (request: NextRequest) => {
  const template = request.nextUrl.searchParams.get('template');
  const locale = (request.nextUrl.searchParams.get('locale') || 'fr') as Locale;
  const format = request.nextUrl.searchParams.get('format') || 'html'; // html or json

  if (!template) {
    return NextResponse.json({
      availableTemplates: Object.keys(templateMap),
      usage: 'GET /api/admin/email-preview?template=welcome&locale=fr',
    });
  }

  const generator = templateMap[template];
  if (!generator) {
    return NextResponse.json(
      { error: `Template "${template}" not found`, availableTemplates: Object.keys(templateMap) },
      { status: 404 }
    );
  }

  const { subject, html } = generator(locale);

  if (format === 'json') {
    return NextResponse.json({ template, locale, subject, html });
  }

  // Return raw HTML for browser preview
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});

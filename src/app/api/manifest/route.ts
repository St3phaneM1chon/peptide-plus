/**
 * GET /api/manifest — Dynamic tenant-aware PWA manifest
 *
 * Generates a manifest.json dynamically based on tenant branding
 * (name, colors, icons). Falls back to default Attitudes VIP branding
 * when no tenant context is available.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getTenantBranding } from '@/lib/tenant-branding';

export async function GET() {
  const branding = await getTenantBranding();

  const name = branding.name || 'Attitudes VIP';
  const shortName = name.length > 12 ? name.substring(0, 12).trim() : name;
  const themeColor = branding.primaryColor || '#0066CC';
  const backgroundColor = '#ffffff';

  // Build icon set — use tenant logo for main icons when available,
  // fall back to default icons in /icons/ and /public root
  const icons = [
    { src: branding.logoUrl || '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
    { src: branding.logoUrl || '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
    { src: branding.logoUrl || '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
    { src: branding.logoUrl || '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
    { src: branding.logoUrl || '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
    { src: branding.logoUrl || '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: branding.logoUrl || '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
    { src: branding.logoUrl || '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];

  const manifest = {
    name: `${name} - Suite Koraline`,
    short_name: shortName,
    description: `${name} — Powered by Koraline SaaS e-commerce platform`,
    start_url: '/',
    display: 'standalone',
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: 'portrait-primary',
    categories: ['business', 'shopping'],
    icons,
    screenshots: [
      {
        src: '/images/screenshot-mobile.jpg',
        sizes: '540x720',
        type: 'image/jpeg',
        form_factor: 'narrow',
      },
    ],
    shortcuts: [
      {
        name: 'Shop',
        short_name: 'Shop',
        description: 'Browse products',
        url: '/shop',
        icons: [{ src: branding.logoUrl || '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'My Account',
        short_name: 'Account',
        description: 'View your account',
        url: '/account',
        icons: [{ src: branding.logoUrl || '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Cart',
        short_name: 'Cart',
        description: 'View your cart',
        url: '/checkout',
        icons: [{ src: branding.logoUrl || '/icon-192.png', sizes: '192x192' }],
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
    scope: '/',
    dir: 'ltr',
    lang: branding.locale === 'fr' ? 'fr-CA' : 'en-CA',
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}

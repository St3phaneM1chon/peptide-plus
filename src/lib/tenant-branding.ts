/**
 * TENANT BRANDING — Server-Side Loader
 *
 * Loads tenant branding from the database based on the x-tenant-slug header.
 * Also loads SiteSettings (headerNav, footerNav, trustBadges, etc.) so the
 * shop shell (Header, Footer, FreeShippingBanner) is 100% dynamic.
 *
 * Cached with React cache() for dedup within a single request.
 *
 * Usage (Server Components):
 *   const branding = await getTenantBranding();
 *
 * The branding object is then passed to TenantBrandingProvider (client)
 * so that all client components can access it via useTenantBranding().
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

// ── JSON shape types for SiteSettings fields ───────────────────────────

export interface HeaderNavItem {
  label: string;
  href: string;
  type: 'link' | 'dropdown';
  children?: Array<{ label: string; href: string }>;
}

export interface FooterNavColumn {
  title: string;
  links: Array<{ label: string; href: string }>;
}

export interface TrustBadge {
  icon: string;
  label: string;
}

// ── Main TenantBranding interface ──────────────────────────────────────

export interface TenantBranding {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  locale: string;
  currency: string;
  // SiteSettings — shop shell dynamic data
  headerNav: HeaderNavItem[];
  footerNav: FooterNavColumn[];
  trustBadges: TrustBadge[];
  companyDescription: string;
  disclaimerText: string;
  address: string;
  city: string;
  province: string;
  country: string;
  phone: string;
  freeShippingThreshold: number;
}

/** Default branding used as fallback when tenant is not found in DB. */
const DEFAULT_BRANDING: TenantBranding = {
  id: '',
  slug: 'default',
  name: process.env.NEXT_PUBLIC_SITE_NAME || '',
  logoUrl: null,
  primaryColor: '#0066CC',
  secondaryColor: '#003366',
  font: 'Inter',
  locale: 'fr',
  currency: 'CAD',
  // Empty defaults — components show nothing when fields are empty
  headerNav: [],
  footerNav: [],
  trustBadges: [],
  companyDescription: '',
  disclaimerText: '',
  address: '',
  city: '',
  province: '',
  country: '',
  phone: '',
  freeShippingThreshold: 0,
};

// ── Helpers to safely parse JSON strings from SiteSettings ─────────────

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Loads tenant branding from DB. Cached per-request via React cache().
 * Safe to call multiple times in the same request tree — only 1 DB query.
 */
export const getTenantBranding = cache(async (): Promise<TenantBranding> => {
  try {
    const headersList = await headers();
    const tenantSlug = headersList.get('x-tenant-slug') || 'attitudes';

    // Load tenant + SiteSettings in parallel (both are small, single-row queries)
    const [tenant, siteSettings] = await Promise.all([
      prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          font: true,
          locale: true,
          currency: true,
        },
      }),
      prisma.siteSettings.findFirst({
        where: { id: 'default' },
        select: {
          headerNav: true,
          footerNav: true,
          trustBadges: true,
          companyDescription: true,
          disclaimerContent: true,
          address: true,
          city: true,
          province: true,
          country: true,
          phone: true,
          freeShippingThreshold: true,
        },
      }).catch(() => null), // SiteSettings table might not exist yet
    ]);

    if (!tenant) {
      return { ...DEFAULT_BRANDING, slug: tenantSlug };
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      font: tenant.font,
      locale: tenant.locale,
      currency: tenant.currency,
      // SiteSettings data (parsed from JSON strings)
      headerNav: parseJsonArray<HeaderNavItem>(siteSettings?.headerNav),
      footerNav: parseJsonArray<FooterNavColumn>(siteSettings?.footerNav),
      trustBadges: parseJsonArray<TrustBadge>(siteSettings?.trustBadges),
      companyDescription: siteSettings?.companyDescription || '',
      disclaimerText: siteSettings?.disclaimerContent || '',
      address: siteSettings?.address || '',
      city: siteSettings?.city || '',
      province: siteSettings?.province || '',
      country: siteSettings?.country || '',
      phone: siteSettings?.phone || '',
      freeShippingThreshold: siteSettings?.freeShippingThreshold
        ? Number(siteSettings.freeShippingThreshold)
        : 0,
    };
  } catch (error) {
    // During build or when DB is unavailable, return defaults
    console.warn('[getTenantBranding] Failed to load tenant, using defaults:', error);
    return DEFAULT_BRANDING;
  }
});

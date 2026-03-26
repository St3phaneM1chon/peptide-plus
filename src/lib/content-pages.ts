/**
 * CONTENT PAGES — Server-Side Loaders
 *
 * Loads static content pages (shipping-policy, refund-policy, about, etc.)
 * from the `Page` model in the database. Each tenant configures their own
 * content via the admin content manager at /admin/contenu.
 *
 * Also loads SiteSettings for contact info (address, email, phone, hours).
 *
 * Usage (Server Components):
 *   const page = await getContentPage('shipping-policy');
 *   const settings = await getSiteSettings();
 */

import { cache } from 'react';
import { prisma } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────

export interface ContentPageData {
  title: string;
  content: string;
  excerpt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: Date;
  template: string;
}

export interface SiteContactInfo {
  companyName: string;
  companyDescription: string | null;
  logoUrl: string | null;
  email: string | null;
  supportEmail: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  businessHours: string | null;
  socialLinks: string | null;
}

// ── Loaders ───────────────────────────────────────────────────────────

/**
 * Loads a published Page by slug from the database.
 * Returns null if the page doesn't exist or is not published.
 * Cached per-request via React cache().
 */
export const getContentPage = cache(async (slug: string): Promise<ContentPageData | null> => {
  try {
    const page = await prisma.page.findFirst({
      where: { slug, isPublished: true },
      select: {
        title: true,
        content: true,
        excerpt: true,
        metaTitle: true,
        metaDescription: true,
        updatedAt: true,
        template: true,
      },
    });
    return page;
  } catch (error) {
    console.warn(`[getContentPage] Failed to load page "${slug}":`, error);
    return null;
  }
});

/**
 * Loads SiteSettings contact information from the database.
 * Falls back to sensible defaults when DB is unavailable (e.g., during build).
 * Cached per-request via React cache().
 */
export const getSiteSettings = cache(async (): Promise<SiteContactInfo> => {
  const defaults: SiteContactInfo = {
    companyName: process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP',
    companyDescription: null,
    logoUrl: null,
    email: null,
    supportEmail: null,
    phone: null,
    address: null,
    city: null,
    province: null,
    postalCode: null,
    country: null,
    businessHours: null,
    socialLinks: null,
  };

  try {
    const settings = await prisma.siteSettings.findFirst({
      where: { id: 'default' },
      select: {
        companyName: true,
        companyDescription: true,
        logoUrl: true,
        email: true,
        supportEmail: true,
        phone: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        country: true,
        businessHours: true,
        socialLinks: true,
      },
    });

    if (!settings) return defaults;

    return {
      companyName: settings.companyName || defaults.companyName,
      companyDescription: settings.companyDescription,
      logoUrl: settings.logoUrl,
      email: settings.email,
      supportEmail: settings.supportEmail,
      phone: settings.phone,
      address: settings.address,
      city: settings.city,
      province: settings.province,
      postalCode: settings.postalCode,
      country: settings.country,
      businessHours: settings.businessHours,
      socialLinks: settings.socialLinks,
    };
  } catch (error) {
    console.warn('[getSiteSettings] Failed to load site settings:', error);
    return defaults;
  }
});

/**
 * Parse businessHours JSON string into structured data.
 * Expected format: [{ day: "Lundi - Vendredi", hours: "9h - 17h" }, ...]
 */
export interface BusinessHoursEntry {
  day: string;
  hours: string;
}

export function parseBusinessHours(raw: string | null): BusinessHoursEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse socialLinks JSON string into structured data.
 * Expected format: [{ platform: "facebook", url: "https://..." }, ...]
 */
export interface SocialLink {
  platform: string;
  url: string;
}

export function parseSocialLinks(raw: string | null): SocialLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Data format converters between Koraline's legacy section format and Puck's Data format.
 *
 * Koraline format: [{ id, type, data: { ... } }]
 * Puck format: { content: [{ type, props: { id, ... } }], root: { props: {} } }
 */

import type { Data } from '@measured/puck';

// Legacy Koraline section format
interface KoralineSection {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

// Map legacy type names to Puck component names
const TYPE_MAP: Record<string, string> = {
  hero: 'Hero',
  features: 'Features',
  cta: 'CTA',
  text_image: 'TextImage',
  text: 'Text',
  custom_html: 'CustomHTML',
  gallery: 'Gallery',
  video: 'Video',
  team: 'Team',
  testimonials: 'Testimonials',
  stats: 'Stats',
  pricing_table: 'PricingTable',
  featured_products: 'FeaturedProducts',
  featured_courses: 'FeaturedProducts', // Map to same component
  faq_accordion: 'FAQ',
  contact_form: 'ContactForm',
  newsletter: 'Newsletter',
  map: 'Map',
  countdown: 'Countdown',
  logo_carousel: 'LogoCarousel',
};

// Reverse map
const REVERSE_TYPE_MAP: Record<string, string> = {};
for (const [legacy, puck] of Object.entries(TYPE_MAP)) {
  if (!REVERSE_TYPE_MAP[puck]) REVERSE_TYPE_MAP[puck] = legacy;
}

/**
 * Convert legacy Koraline sections to Puck Data format
 */
export function koralineToPuck(sections: KoralineSection[]): Data {
  return {
    content: sections.map((section) => ({
      type: TYPE_MAP[section.type] || section.type,
      props: {
        id: section.id,
        ...section.data,
      },
    })),
    root: { props: {} },
  };
}

/**
 * Convert Puck Data format back to Koraline sections
 */
export function puckToKoraline(data: Data): KoralineSection[] {
  return data.content.map((item) => {
    const { id, ...rest } = item.props as Record<string, unknown>;
    return {
      id: (id as string) || `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: REVERSE_TYPE_MAP[item.type] || item.type.toLowerCase(),
      data: rest,
    };
  });
}

/**
 * Check if data is in legacy Koraline format (array) vs Puck format (object with content)
 */
export function isLegacyFormat(data: unknown): boolean {
  return Array.isArray(data);
}

/**
 * Auto-detect format and convert to Puck Data
 */
export function toPuckData(raw: unknown): Data {
  if (!raw) return { content: [], root: { props: {} } };

  // Already Puck format
  if (typeof raw === 'object' && !Array.isArray(raw) && 'content' in (raw as Record<string, unknown>)) {
    return raw as Data;
  }

  // Legacy array format
  if (Array.isArray(raw)) {
    return koralineToPuck(raw as KoralineSection[]);
  }

  // String (from DB)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return toPuckData(parsed);
    } catch {
      return { content: [], root: { props: {} } };
    }
  }

  return { content: [], root: { props: {} } };
}

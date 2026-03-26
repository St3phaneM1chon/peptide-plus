/**
 * HOMEPAGE SECTIONS — Type Definitions
 *
 * The homepage is a composition of configurable sections.
 * Each tenant chooses which sections to show and configures
 * their content via admin (stored as JSON in SiteSetting).
 *
 * SiteSetting key: "homepageSections"
 * SiteSetting type: "json"
 * SiteSetting module: "homepage"
 */

// ── Section Type Interfaces ──────────────────────────────────────────

export interface HeroSection {
  type: 'hero';
  title: string;
  subtitle: string;
  imageUrl?: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface FeaturedProductsSection {
  type: 'featured_products';
  title: string;
  subtitle?: string;
  limit?: number; // default 6
}

export interface FeaturedCoursesSection {
  type: 'featured_courses';
  title: string;
  subtitle?: string;
  limit?: number; // default 6
}

export interface TestimonialsSection {
  type: 'testimonials';
  title: string;
}

export interface FeaturesSection {
  type: 'features';
  title: string;
  subtitle?: string;
  items: Array<{ icon: string; title: string; description: string }>;
}

export interface CTASection {
  type: 'cta';
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
}

export interface StatsSection {
  type: 'stats';
  items: Array<{ value: string; label: string }>;
}

export interface NewsletterSection {
  type: 'newsletter';
  title: string;
  subtitle?: string;
}

export interface CustomHTMLSection {
  type: 'custom_html';
  content: string; // HTML string (sanitized before render)
}

// ── Union Type ───────────────────────────────────────────────────────

export type HomepageSection =
  | HeroSection
  | FeaturedProductsSection
  | FeaturedCoursesSection
  | TestimonialsSection
  | FeaturesSection
  | CTASection
  | StatsSection
  | NewsletterSection
  | CustomHTMLSection;

export type HomepageSectionType = HomepageSection['type'];

// ── Resolved Data (server-side enrichment) ───────────────────────────
// Some sections need DB data. We resolve these server-side in page.tsx
// and pass them alongside the section config.

export interface FeaturedProductData {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  isFeatured: boolean;
  category: string | null;
}

export interface FeaturedCourseData {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  level: string;
  isFree: boolean;
  price: number | null;
}

export interface TestimonialDisplayData {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  content: string;
  rating: number;
  imageUrl: string | null;
}

/** Data resolved server-side and passed to client section renderer. */
export interface HomepageSectionData {
  products: FeaturedProductData[];
  courses: FeaturedCourseData[];
  testimonials: TestimonialDisplayData[];
}

// ── Validation ───────────────────────────────────────────────────────

const VALID_TYPES: HomepageSectionType[] = [
  'hero',
  'featured_products',
  'featured_courses',
  'testimonials',
  'features',
  'cta',
  'stats',
  'newsletter',
  'custom_html',
];

/** Validate and parse homepage sections from raw JSON. Returns empty array on invalid input. */
export function parseHomepageSections(raw: unknown): HomepageSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (section): section is HomepageSection =>
      section != null &&
      typeof section === 'object' &&
      'type' in section &&
      VALID_TYPES.includes((section as { type: string }).type as HomepageSectionType)
  );
}

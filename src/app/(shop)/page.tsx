import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import HomePageClient from './HomePageClient';
import HomePageEmpty from './HomePageEmpty';
import HomePageLearning from './HomePageLearning';
import type { TestimonialData } from './HomePageClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { getTenantBranding } from '@/lib/tenant-branding';
import { headers } from 'next/headers';
import { SectionRenderer } from '@/components/shop/homepage';
import {
  parseHomepageSections,
  type HomepageSection,
  type HomepageSectionData,
  type FeaturedProductData,
  type FeaturedCourseData,
  type TestimonialDisplayData,
} from '@/lib/homepage-sections';

// Revalidate hero slides every 60 seconds (ISR) for fresh content without blocking render
export const revalidate = 60;

// Static fallback metadata — overridden at render time by JSON-LD with tenant name
const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
const siteDescription = "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping.";

export const metadata: Metadata = {
  title: `${siteName} - Premium Research Peptides Canada`,
  description:
    `${siteDescription} Shop BPC-157, TB-500, Semaglutide and more.`,
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip',
  },
  openGraph: {
    title: `${siteName} - Premium Research Peptides Canada`,
    description: siteDescription,
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip',
    type: 'website',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: `${siteName} - Premium Research Peptides Canada`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} - Premium Research Peptides Canada`,
    description: siteDescription,
    images: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/opengraph-image`],
  },
};

// ── Data Fetchers ────────────────────────────────────────────────────

/** Fetch active hero slides server-side for instant LCP (no client-side loading flash). */
async function getHeroSlides() {
  try {
    const now = new Date();
    const slides = await prisma.heroSlide.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      include: { translations: true },
      orderBy: { sortOrder: 'asc' },
    });
    // Serialize to plain objects to avoid Date serialization issues across the server/client boundary
    return JSON.parse(JSON.stringify(slides));
  } catch (error) {
    console.warn('[getHeroSlides] Failed to fetch hero slides, returning empty array:', error);
    return [];
  }
}

/** Fetch published testimonials server-side, preferring locale-specific translations. */
async function getTestimonials(): Promise<TestimonialData[]> {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isPublished: true },
      include: { translations: true },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 6,
    });
    return JSON.parse(JSON.stringify(testimonials));
  } catch (error) {
    console.warn('[getTestimonials] Failed to fetch testimonials, returning empty array:', error);
    return [];
  }
}

/** Count active products for the current tenant. */
async function getProductCount(): Promise<number> {
  try {
    return await prisma.product.count({ where: { isActive: true } });
  } catch {
    return 0;
  }
}

/** Count published courses for the current tenant (LMS module). */
async function getCourseCount(): Promise<number> {
  try {
    return await prisma.course.count({ where: { status: 'PUBLISHED' } });
  } catch {
    return 0;
  }
}

/** Check if a specific module is enabled for the current tenant. */
async function isModuleEnabled(tenantSlug: string, moduleName: string): Promise<boolean> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { modulesEnabled: true },
    });
    if (!tenant) return false;
    const modules: string[] = (() => {
      try {
        const raw = tenant.modulesEnabled;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') return JSON.parse(raw);
        return [];
      } catch {
        return [];
      }
    })();
    return modules.includes(moduleName);
  } catch {
    return false;
  }
}

/** Fetch published courses for learning-focused homepage. */
async function getPublishedCourses() {
  try {
    const courses = await prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        thumbnailUrl: true,
        level: true,
        isFree: true,
        price: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return JSON.parse(JSON.stringify(courses));
  } catch {
    return [];
  }
}

// ── Dynamic Section Data Loaders ─────────────────────────────────────

/** Load homepage sections config from SiteSetting key-value store. */
async function getHomepageSections(): Promise<HomepageSection[]> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: 'homepageSections' },
    });
    if (!setting?.value) return [];
    const raw = JSON.parse(setting.value);
    return parseHomepageSections(raw);
  } catch {
    return [];
  }
}

/** Fetch featured products for the section-based homepage. */
async function getFeaturedProducts(limit: number): Promise<FeaturedProductData[]> {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        isFeatured: true,
        category: { select: { name: true } },
        options: {
          where: { isActive: true },
          select: { price: true, comparePrice: true },
          orderBy: { price: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl: p.imageUrl,
      price: p.options[0] ? Number(p.options[0].price) : 0,
      compareAtPrice: p.options[0]?.comparePrice ? Number(p.options[0].comparePrice) : null,
      isFeatured: p.isFeatured,
      category: p.category?.name || null,
    }));
  } catch {
    return [];
  }
}

/** Fetch featured courses for the section-based homepage. */
async function getFeaturedCourses(limit: number): Promise<FeaturedCourseData[]> {
  try {
    const courses = await prisma.course.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        thumbnailUrl: true,
        level: true,
        isFree: true,
        price: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      thumbnailUrl: c.thumbnailUrl,
      level: c.level,
      isFree: c.isFree,
      price: c.price ? Number(c.price) : null,
    }));
  } catch {
    return [];
  }
}

/** Fetch testimonials for the section-based homepage (simplified display data). */
async function getTestimonialsForSections(limit: number): Promise<TestimonialDisplayData[]> {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        name: true,
        role: true,
        company: true,
        content: true,
        rating: true,
        imageUrl: true,
      },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return testimonials;
  } catch {
    return [];
  }
}

/**
 * Resolve all dynamic data needed by the configured sections.
 * Only fetches data for section types actually present in the config.
 */
async function resolveSectionData(sections: HomepageSection[]): Promise<HomepageSectionData> {
  const needsProducts = sections.some((s) => s.type === 'featured_products');
  const needsCourses = sections.some((s) => s.type === 'featured_courses');
  const needsTestimonials = sections.some((s) => s.type === 'testimonials');

  // Determine limits from section configs (use largest if multiple sections of same type)
  const productLimit = needsProducts
    ? Math.max(
        ...sections
          .filter((s): s is Extract<HomepageSection, { type: 'featured_products' }> => s.type === 'featured_products')
          .map((s) => s.limit || 6)
      )
    : 0;

  const courseLimit = needsCourses
    ? Math.max(
        ...sections
          .filter((s): s is Extract<HomepageSection, { type: 'featured_courses' }> => s.type === 'featured_courses')
          .map((s) => s.limit || 6)
      )
    : 0;

  const [products, courses, testimonials] = await Promise.all([
    needsProducts ? getFeaturedProducts(productLimit) : Promise.resolve([]),
    needsCourses ? getFeaturedCourses(courseLimit) : Promise.resolve([]),
    needsTestimonials ? getTestimonialsForSections(6) : Promise.resolve([]),
  ]);

  return { products, courses, testimonials };
}

// ── Page Component ───────────────────────────────────────────────────

export default async function HomePage() {
  const headersList = await headers();
  const tenantSlug = headersList.get('x-tenant-slug') || 'attitudes';

  const [heroSlides, testimonials, branding, productCount, courseCount, lmsEnabled, homepageSections] = await Promise.all([
    getHeroSlides(),
    getTestimonials(),
    getTenantBranding(),
    getProductCount(),
    getCourseCount(),
    isModuleEnabled(tenantSlug, 'lms'),
    getHomepageSections(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';
  const tenantName = branding.name;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: tenantName,
    url: siteUrl,
    logo: branding.logoUrl || `${siteUrl}/icon-512.png`,
    description: `${tenantName} - Powered by Koraline`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${siteUrl}/contact`,
      availableLanguage: ['English', 'French'],
    },
  };

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: tenantName,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  // ---------------------------------------------------------------------------
  // Dynamic Homepage: Section-based engine with fallback
  // ---------------------------------------------------------------------------
  // Priority 1: If homepageSections are configured in SiteSetting → render them
  // Priority 2: Tenant has no content → clean branded welcome page
  // Priority 3: Courses-only tenant → learning-focused homepage
  // Priority 4: Legacy fallback → existing HomePageClient (deprecated)
  // ---------------------------------------------------------------------------

  const hasProducts = productCount > 0;
  const hasCourses = lmsEnabled && courseCount > 0;

  // Priority 1: Dynamic section-based homepage (new engine)
  if (homepageSections.length > 0) {
    const sectionData = await resolveSectionData(homepageSections);
    return (
      <>
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
        <h1 className="sr-only">{tenantName}</h1>
        <SectionRenderer sections={homepageSections} data={sectionData} />
      </>
    );
  }

  // Priority 2: No products AND no courses → clean welcome page
  if (!hasProducts && !hasCourses) {
    return (
      <>
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
        <h1 className="sr-only">{tenantName}</h1>
        <HomePageEmpty branding={branding} />
      </>
    );
  }

  // Priority 3: Courses but no products → learning-focused homepage
  if (!hasProducts && hasCourses) {
    const courses = await getPublishedCourses();
    return (
      <>
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
        <h1 className="sr-only">{tenantName}</h1>
        <HomePageLearning branding={branding} courses={courses} />
      </>
    );
  }

  // Priority 4: Legacy fallback — has products but no sections configured (deprecated)
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={webSiteSchema} />
      <h1 className="sr-only">{tenantName}</h1>
      <HomePageClient initialHeroSlides={heroSlides} initialTestimonials={testimonials} />
    </>
  );
}

import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import HomePageClient from './HomePageClient';
import type { TestimonialData } from './HomePageClient';

// Revalidate hero slides every 60 seconds (ISR) for fresh content without blocking render
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'BioCycle Peptides - Premium Research Peptides Canada',
  description:
    "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping. Shop BPC-157, TB-500, Semaglutide and more.",
  alternates: {
    canonical: 'https://biocyclepeptides.com',
  },
  openGraph: {
    title: 'BioCycle Peptides - Premium Research Peptides Canada',
    description:
      "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping.",
    url: 'https://biocyclepeptides.com',
    type: 'website',
    images: [
      {
        url: 'https://biocyclepeptides.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'BioCycle Peptides - Premium Research Peptides Canada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BioCycle Peptides - Premium Research Peptides Canada',
    description:
      "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping.",
    images: ['https://biocyclepeptides.com/opengraph-image'],
  },
};

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
  } catch {
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
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [heroSlides, testimonials] = await Promise.all([
    getHeroSlides(),
    getTestimonials(),
  ]);

  return (
    <>
      <h1 className="sr-only">BioCycle Peptides - Research Peptides</h1>
      <HomePageClient initialHeroSlides={heroSlides} initialTestimonials={testimonials} />
    </>
  );
}

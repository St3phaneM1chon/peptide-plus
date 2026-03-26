'use client';

import type { HomepageSection, HomepageSectionData } from '@/lib/homepage-sections';
import HeroSection from './HeroSection';
import FeaturedProductsSection from './FeaturedProductsSection';
import FeaturedCoursesSection from './FeaturedCoursesSection';
import TestimonialsSection from './TestimonialsSection';
import FeaturesSection from './FeaturesSection';
import CTASection from './CTASection';
import StatsSection from './StatsSection';
import NewsletterSection from './NewsletterSection';
import CustomHTMLSection from './CustomHTMLSection';

interface SectionRendererProps {
  sections: HomepageSection[];
  data: HomepageSectionData;
}

/**
 * Dynamic Homepage Section Renderer.
 *
 * Takes an ordered array of section configs (from SiteSetting "homepageSections")
 * plus resolved DB data (products, courses, testimonials), and renders each
 * section component in order.
 *
 * Each section is self-contained. Sections that need no DB data (hero, features,
 * cta, stats, newsletter, custom_html) use only their config. Data-driven sections
 * (featured_products, featured_courses, testimonials) receive pre-fetched data
 * from the server component.
 */
export default function SectionRenderer({ sections, data }: SectionRendererProps) {
  return (
    <div className="min-h-screen bg-[var(--k-bg-base)]">
      {sections.map((section, index) => {
        const key = `${section.type}-${index}`;

        switch (section.type) {
          case 'hero':
            return <HeroSection key={key} config={section} />;

          case 'featured_products':
            return (
              <FeaturedProductsSection
                key={key}
                config={section}
                products={data.products}
              />
            );

          case 'featured_courses':
            return (
              <FeaturedCoursesSection
                key={key}
                config={section}
                courses={data.courses}
              />
            );

          case 'testimonials':
            return (
              <TestimonialsSection
                key={key}
                config={section}
                testimonials={data.testimonials}
              />
            );

          case 'features':
            return <FeaturesSection key={key} config={section} />;

          case 'cta':
            return <CTASection key={key} config={section} />;

          case 'stats':
            return <StatsSection key={key} config={section} />;

          case 'newsletter':
            return <NewsletterSection key={key} config={section} />;

          case 'custom_html':
            return <CustomHTMLSection key={key} config={section} />;

          default:
            return null;
        }
      })}
    </div>
  );
}

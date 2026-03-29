/**
 * PageRenderer — Renders a Page from the database using the appropriate template.
 *
 * Templates:
 *   - default:      Glass card with rich HTML content
 *   - hero-content:  Full-width hero image banner + content area below
 *   - sections:      Composable sections rendered from JSON array
 *   - landing:       Marketing template (hero + features grid + CTA)
 */

import Link from 'next/link';
import { ContentPageData } from '@/lib/content-pages';
import PuckSectionsWrapper from './PuckSectionsWrapper';
import type {
  TextImageSection,
  GallerySection,
  VideoSection,
  TeamSection,
  PricingTableSection,
  FAQAccordionSection,
  ContactFormSection,
  MapSection,
  CountdownSection,
  LogoCarouselSection,
} from '@/lib/homepage-sections';
import {
  TextImageRenderer,
  GalleryRenderer,
  VideoRenderer,
  TeamRenderer,
  PricingTableRenderer,
  FAQAccordionRenderer,
  ContactFormRenderer,
  MapRenderer,
  CountdownRenderer,
  LogoCarouselRenderer,
} from './sections';

// ── Section types for the "sections" template ───────────────────────

interface PageSection {
  id?: string;
  type: string;
  title?: string;
  subtitle?: string;
  content?: string;
  items?: Array<{
    icon?: string;
    title?: string;
    description?: string;
    value?: string;
    label?: string;
    href?: string;
  }>;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  // Extended fields for new section types (passed as-is to typed renderers)
  [key: string]: unknown;
}

// ── Main renderer ───────────────────────────────────────────────────

export default function PageRenderer({ page }: { page: ContentPageData }) {
  switch (page.template) {
    case 'hero-content':
      return <HeroContentTemplate page={page} />;
    case 'sections':
      return <SectionsTemplate page={page} />;
    case 'landing':
      return <LandingTemplate page={page} />;
    default:
      return <DefaultTemplate page={page} />;
  }
}

// ── Default template ────────────────────────────────────────────────

function DefaultTemplate({ page }: { page: ContentPageData }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Hero */}
      <section
        className="py-20 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            className="font-heading text-4xl md:text-5xl font-bold mb-6"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            {page.title}
          </h1>
          {page.excerpt && (
            <p
              className="text-lg"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: '1.8' }}
            >
              {page.excerpt}
            </p>
          )}
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className="rounded-2xl p-8 md:p-12"
          style={{
            background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="prose prose-invert max-w-none"
            style={{
              color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
              lineHeight: '1.8',
            }}
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
          <UpdatedAtFooter updatedAt={page.updatedAt} />
        </div>
      </div>
    </div>
  );
}

// ── Hero-content template ───────────────────────────────────────────

function HeroContentTemplate({ page }: { page: ContentPageData }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Full-width hero banner */}
      <section
        className="relative flex items-center justify-center"
        style={{
          minHeight: '420px',
          background: page.heroImageUrl
            ? `linear-gradient(to bottom, rgba(10,10,15,0.35), rgba(10,10,15,0.85)), url(${page.heroImageUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(59,130,246,0.12) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1
            className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            {page.title}
          </h1>
          {page.excerpt && (
            <p
              className="text-lg md:text-xl"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))', lineHeight: '1.8' }}
            >
              {page.excerpt}
            </p>
          )}
        </div>
      </section>

      {/* Content area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className="rounded-2xl p-8 md:p-12"
          style={{
            background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="prose prose-invert max-w-none"
            style={{
              color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
              lineHeight: '1.8',
            }}
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
          <UpdatedAtFooter updatedAt={page.updatedAt} />
        </div>
      </div>
    </div>
  );
}

// ── Sections template ───────────────────────────────────────────────

function SectionsTemplate({ page }: { page: ContentPageData }) {
  // Check if this page has Puck-style sections (with animation props)
  const hasPuckSections = detectPuckSections(page.sections);

  if (hasPuckSections) {
    // Use the animated Puck renderer (Framer Motion)
    return (
      <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
        <PuckSectionsWrapper sections={page.sections} />
      </div>
    );
  }

  // Fallback: legacy section renderer
  const sections = parseSections(page.sections);

  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Title header */}
      <section
        className="py-16 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1
            className="font-heading text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            {page.title}
          </h1>
          {page.excerpt && (
            <p
              className="text-lg"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
            >
              {page.excerpt}
            </p>
          )}
        </div>
      </section>

      {/* Render each section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {sections.map((section, idx) => (
          <SectionRenderer key={section.id || idx} section={section} />
        ))}
      </div>
    </div>
  );
}

/** Detect if sections were created with the Puck editor (have animation/padding props) */
function detectPuckSections(raw: unknown): boolean {
  if (!raw) return false;
  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return false; }
  }
  // Puck format object
  if (typeof data === 'object' && !Array.isArray(data) && 'content' in (data as Record<string, unknown>)) return true;
  // Legacy array with animation props (saved from Puck)
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (first.data && (first.data.animation || first.data.paddingTop)) return true;
  }
  return false;
}

function SectionRenderer({ section }: { section: PageSection }) {
  switch (section.type) {
    case 'text':
      return (
        <div
          className="rounded-2xl p-8 md:p-10"
          style={{
            background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {section.title && (
            <h2
              className="text-2xl font-bold mb-4"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
            >
              {section.title}
            </h2>
          )}
          {section.content && (
            <div
              className="prose prose-invert max-w-none"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))', lineHeight: '1.8' }}
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          )}
        </div>
      );

    case 'features':
      return (
        <div>
          {section.title && (
            <h2
              className="text-2xl font-bold mb-6 text-center"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
            >
              {section.title}
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(section.items || []).map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                {item.icon && <div className="text-3xl mb-3">{item.icon}</div>}
                {item.title && (
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
                  >
                    {item.title}
                  </h3>
                )}
                {item.description && (
                  <p style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))', lineHeight: '1.6' }}>
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case 'cta':
      return (
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(59,130,246,0.12) 100%)',
            border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          {section.title && (
            <h2
              className="text-2xl md:text-3xl font-bold mb-4"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
            >
              {section.title}
            </h2>
          )}
          {section.subtitle && (
            <p
              className="text-lg mb-6"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}
            >
              {section.subtitle}
            </p>
          )}
          {section.ctaText && section.ctaUrl && (
            <Link
              href={section.ctaUrl}
              className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-lg transition-opacity hover:opacity-90"
              style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}
            >
              {section.ctaText}
            </Link>
          )}
        </div>
      );

    case 'stats':
      return (
        <div>
          {section.title && (
            <h2
              className="text-2xl font-bold mb-6 text-center"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
            >
              {section.title}
            </h2>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {(section.items || []).map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 text-center"
                style={{
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="text-3xl md:text-4xl font-bold mb-1"
                  style={{ color: 'var(--k-accent, #6366f1)' }}
                >
                  {item.value}
                </div>
                <div
                  className="text-sm"
                  style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'image':
      return (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={section.imageUrl || ''}
            alt={section.title || ''}
            className="w-full h-auto"
            loading="lazy"
          />
          {section.title && (
            <p
              className="text-center py-3 text-sm"
              style={{
                background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
                color: 'var(--k-text-tertiary, rgba(255,255,255,0.40))',
              }}
            >
              {section.title}
            </p>
          )}
        </div>
      );

    // ── New section types (Phase 1.1 — Page Builder) ──────────────
    case 'text_image':
      return <TextImageRenderer section={section as unknown as TextImageSection} />;
    case 'gallery':
      return <GalleryRenderer section={section as unknown as GallerySection} />;
    case 'video':
      return <VideoRenderer section={section as unknown as VideoSection} />;
    case 'team':
      return <TeamRenderer section={section as unknown as TeamSection} />;
    case 'pricing_table':
      return <PricingTableRenderer section={section as unknown as PricingTableSection} />;
    case 'faq_accordion':
      return <FAQAccordionRenderer section={section as unknown as FAQAccordionSection} />;
    case 'contact_form':
      return <ContactFormRenderer section={section as unknown as ContactFormSection} />;
    case 'map':
      return <MapRenderer section={section as unknown as MapSection} />;
    case 'countdown':
      return <CountdownRenderer section={section as unknown as CountdownSection} />;
    case 'logo_carousel':
      return <LogoCarouselRenderer section={section as unknown as LogoCarouselSection} />;

    // ── Puck-format section types ────────────────────────────────
    case 'hero': {
      const bg = (section as Record<string, unknown>).backgroundColor as string || '#0f172a';
      const tc = (section as Record<string, unknown>).textColor as string || '#ffffff';
      const variant = (section as Record<string, unknown>).variant as string || 'centered';
      return (
        <div
          className={`py-20 ${variant === 'centered' ? 'text-center' : 'text-left'}`}
          style={{ background: bg, color: tc, borderRadius: '1rem' }}
        >
          <div className="max-w-4xl mx-auto px-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">{section.title}</h1>
            {section.subtitle && <p className="text-lg md:text-xl opacity-80 mb-8">{section.subtitle}</p>}
            <div className="flex flex-wrap gap-4 justify-center">
              {section.ctaText && section.ctaUrl && (
                <Link href={section.ctaUrl} className="inline-flex px-8 py-4 rounded-xl font-semibold text-lg bg-white/20 hover:bg-white/30 transition-colors">
                  {section.ctaText}
                </Link>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'heading': {
      const level = ((section as Record<string, unknown>).level as string) || 'h2';
      const align = ((section as Record<string, unknown>).align as string) || 'center';
      const text = ((section as Record<string, unknown>).text as string) || '';
      const sizes: Record<string, string> = { h1: 'text-4xl md:text-5xl', h2: 'text-3xl md:text-4xl', h3: 'text-2xl md:text-3xl' };
      const Tag = level as 'h1' | 'h2' | 'h3';
      return <Tag className={`${sizes[level] || sizes.h2} font-bold`} style={{ textAlign: align as 'left' | 'center', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{text}</Tag>;
    }

    case 'rich_text': {
      const html = ((section as Record<string, unknown>).html as string) || '';
      return (
        <div className="prose prose-invert max-w-none" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }} dangerouslySetInnerHTML={{ __html: html }} />
      );
    }

    case 'custom_html': {
      const code = ((section as Record<string, unknown>).code as string) || '';
      return <div dangerouslySetInnerHTML={{ __html: code }} />;
    }

    case 'newsletter':
      return (
        <div className="text-center space-y-4 max-w-xl mx-auto py-8">
          <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{section.title}</h2>
          {section.subtitle && <p className="opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{section.subtitle}</p>}
          <div className="flex gap-2">
            <input placeholder="votre@email.com" className="flex-1 p-3 border rounded-lg bg-white/10" />
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold">
              {((section as Record<string, unknown>).buttonText as string) || 'S\'abonner'}
            </button>
          </div>
        </div>
      );

    case 'tabs': {
      const tabItems = ((section as Record<string, unknown>).tabs as Array<{ title: string; content: string }>) || [];
      return (
        <div className="space-y-4">
          <div className="flex border-b border-white/10">
            {tabItems.map((tab, i) => (
              <button key={i} className={`px-6 py-3 font-medium ${i === 0 ? 'border-b-2 border-blue-500 text-blue-400' : 'opacity-50'}`} style={{ color: i === 0 ? undefined : 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
                {tab.title}
              </button>
            ))}
          </div>
          {tabItems[0] && <div className="p-4" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{tabItems[0].content}</div>}
        </div>
      );
    }

    case 'accordion': {
      const accItems = ((section as Record<string, unknown>).items as Array<{ title: string; content: string }>) || [];
      return (
        <div className="space-y-2 max-w-3xl mx-auto">
          {accItems.map((item, i) => (
            <details key={i} className="rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>
              <summary className="p-4 font-medium cursor-pointer" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{item.title}</summary>
              <div className="px-4 pb-4 opacity-80" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{item.content}</div>
            </details>
          ))}
        </div>
      );
    }

    case 'social_links': {
      const s = section as Record<string, unknown>;
      const socialLinks = [
        { url: s.facebook as string, icon: '📘' },
        { url: s.instagram as string, icon: '📷' },
        { url: s.twitter as string, icon: '🐦' },
        { url: s.linkedin as string, icon: '💼' },
        { url: s.tiktok as string, icon: '🎵' },
        { url: s.youtube as string, icon: '▶️' },
      ].filter(l => l.url);
      return (
        <div className="text-center space-y-4">
          {section.title && <h2 className="text-xl font-semibold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{section.title}</h2>}
          <div className="flex justify-center gap-6 text-3xl">
            {socialLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="hover:scale-110 transition-transform">{link.icon}</a>
            ))}
          </div>
        </div>
      );
    }

    case 'spacer': {
      const height = ((section as Record<string, unknown>).height as string) || '2rem';
      return <div style={{ height }} />;
    }

    case 'divider': {
      const divStyle = ((section as Record<string, unknown>).style as string) || 'solid';
      if (divStyle === 'gradient') {
        return <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)' }} />;
      }
      return <hr style={{ borderStyle: divStyle, borderColor: 'rgba(255,255,255,0.1)' }} />;
    }

    case 'image_slider': {
      const slides = ((section as Record<string, unknown>).images as Array<{ url: string; alt: string }>) || [];
      return (
        <div className="relative overflow-hidden rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {slides.length > 0 && slides[0].url ? (
            <img src={slides[0].url} alt={slides[0].alt} className="w-full aspect-[21/9] object-cover" />
          ) : (
            <div className="w-full aspect-[21/9] flex items-center justify-center" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>Carrousel</div>
          )}
        </div>
      );
    }

    case 'featured_products':
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{section.title || 'Nos produits'}</h2>
          <p className="text-center opacity-50" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>Les produits de votre catalogue s&apos;afficheront ici</p>
        </div>
      );

    case 'product_grid':
      return (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{section.title || 'Boutique'}</h2>
          <p className="text-center opacity-50" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>Les produits de votre catalogue s&apos;afficheront ici</p>
        </div>
      );

    case 'columns': {
      const layout = ((section as Record<string, unknown>).layout as string) || '1fr 1fr';
      const gap = ((section as Record<string, unknown>).gap as string) || '2rem';
      return <div style={{ display: 'grid', gridTemplateColumns: layout, gap }} />;
    }

    case 'container':
      return <div style={{ maxWidth: ((section as Record<string, unknown>).maxWidth as string) || '960px', margin: '0 auto' }} />;

    default:
      return null;
  }
}

// ── Landing template ────────────────────────────────────────────────

function LandingTemplate({ page }: { page: ContentPageData }) {
  const sections = parseSections(page.sections);
  const featuresSection = sections.find((s) => s.type === 'features');
  const ctaSection = sections.find((s) => s.type === 'cta');

  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Hero */}
      <section
        className="relative flex items-center justify-center"
        style={{
          minHeight: '500px',
          background: page.heroImageUrl
            ? `linear-gradient(to bottom, rgba(10,10,15,0.30), rgba(10,10,15,0.80)), url(${page.heroImageUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(59,130,246,0.12) 50%, rgba(139,92,246,0.10) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1
            className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            {page.title}
          </h1>
          {page.excerpt && (
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto mb-8"
              style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))', lineHeight: '1.8' }}
            >
              {page.excerpt}
            </p>
          )}
          {ctaSection?.ctaText && ctaSection?.ctaUrl && (
            <Link
              href={ctaSection.ctaUrl}
              className="inline-flex items-center px-8 py-4 rounded-xl font-semibold text-lg transition-opacity hover:opacity-90"
              style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}
            >
              {ctaSection.ctaText}
            </Link>
          )}
        </div>
      </section>

      {/* Content (from WYSIWYG) */}
      {page.content && page.content.trim() !== '' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div
            className="rounded-2xl p-8 md:p-12"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div
              className="prose prose-invert max-w-none"
              style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))', lineHeight: '1.8' }}
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          </div>
        </div>
      )}

      {/* Features grid */}
      {featuresSection && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SectionRenderer section={featuresSection} />
        </div>
      )}

      {/* Remaining sections */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-12">
        {sections
          .filter((s) => s.type !== 'features' && s.type !== 'cta')
          .map((section, idx) => (
            <SectionRenderer key={section.id || idx} section={section} />
          ))}
      </div>

      {/* Bottom CTA */}
      {ctaSection && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <SectionRenderer section={ctaSection} />
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function UpdatedAtFooter({ updatedAt }: { updatedAt: Date }) {
  if (!updatedAt) return null;
  return (
    <p
      className="text-sm mt-8 pt-4 text-center"
      style={{
        color: 'var(--k-text-tertiary, rgba(255,255,255,0.40))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      Last updated: {new Date(updatedAt).toLocaleDateString('fr-CA')}
    </p>
  );
}

// Map PascalCase Puck types back to snake_case legacy types
const PUCK_TYPE_MAP: Record<string, string> = {
  Hero: 'hero', Features: 'features', CTA: 'cta', TextImage: 'text_image',
  Text: 'text', Heading: 'heading', RichText: 'rich_text', CustomHTML: 'custom_html',
  Gallery: 'gallery', Video: 'video', ImageSlider: 'image_slider',
  FeaturedProducts: 'featured_products', PricingTable: 'pricing_table', ProductGrid: 'product_grid',
  FAQ: 'faq_accordion', ContactForm: 'contact_form', Newsletter: 'newsletter',
  Map: 'map', Countdown: 'countdown', Tabs: 'tabs', Accordion: 'accordion',
  Team: 'team', Testimonials: 'testimonials', Stats: 'stats',
  LogoCarousel: 'logo_carousel', SocialLinks: 'social_links',
  Spacer: 'spacer', Divider: 'divider', Columns: 'columns', Container: 'container',
};

function parseSections(raw: unknown): PageSection[] {
  if (!raw) return [];

  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return []; }
  }

  // Legacy array format: [{id, type, data}]
  if (Array.isArray(data)) {
    return (data as Array<{ id?: string; type: string; data?: Record<string, unknown>; [key: string]: unknown }>).map(item => {
      if (item.data && typeof item.data === 'object') {
        // Legacy format with nested data
        return { id: item.id, type: item.type, ...item.data } as PageSection;
      }
      return item as PageSection;
    });
  }

  // Puck format: {content: [{type, props}], root: {props}}
  if (typeof data === 'object' && data !== null && 'content' in (data as Record<string, unknown>)) {
    const puckData = data as { content: Array<{ type: string; props: Record<string, unknown> }> };
    return (puckData.content || []).map(item => {
      const legacyType = PUCK_TYPE_MAP[item.type] || item.type.toLowerCase();
      const { id, ...rest } = item.props || {};
      return { id: id as string, type: legacyType, ...rest } as PageSection;
    });
  }

  return [];
}

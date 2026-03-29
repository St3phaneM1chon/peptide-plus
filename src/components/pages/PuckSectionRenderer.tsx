'use client';

/**
 * PuckSectionRenderer — Renders Puck-format sections on public pages with
 * Framer Motion scroll-triggered animations.
 *
 * Accepts:
 *   - Legacy array format:  [{id, type, data}] or [{id, type, ...props}]
 *   - Puck Data format:     {content: [{type, props}], root: {props}}
 *   - JSON string of either
 */

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { animationVariants, staggerContainer, staggerChild, type AnimationType } from '@/lib/puck/animations';
import DOMPurify from 'isomorphic-dompurify';

// Live data components (lazy loaded)
const LiveProductGrid = dynamic(() => import('./sections/LiveProductGrid'), { ssr: false });
const LiveCourseGrid = dynamic(() => import('./sections/LiveCourseGrid'), { ssr: false });

// ── Helpers ────────────────────────────────────────────────────────────

/** Safe boolean check for unknown values — avoids `unknown && <JSX>` */
function has(val: unknown): boolean {
  return val !== null && val !== undefined && val !== '' && val !== false;
}

// ── Types ──────────────────────────────────────────────────────────────

interface NormalizedSection {
  type: string;
  props: Record<string, unknown>;
}

// Puck type → internal kebab type
const PUCK_TYPE_MAP: Record<string, string> = {
  Hero: 'Hero', Features: 'Features', CTA: 'CTA', TextImage: 'TextImage',
  Text: 'Text', Heading: 'Heading', RichText: 'RichText', CustomHTML: 'CustomHTML',
  Gallery: 'Gallery', Video: 'Video', ImageSlider: 'ImageSlider',
  FeaturedProducts: 'FeaturedProducts', FeaturedCourses: 'FeaturedCourses',
  PricingTable: 'PricingTable', ProductGrid: 'ProductGrid',
  FAQ: 'FAQ', ContactForm: 'ContactForm', Newsletter: 'Newsletter',
  Map: 'Map', Countdown: 'Countdown', Tabs: 'Tabs', Accordion: 'Accordion',
  Team: 'Team', Testimonials: 'Testimonials', Stats: 'Stats',
  LogoCarousel: 'LogoCarousel', SocialLinks: 'SocialLinks',
  Spacer: 'Spacer', Divider: 'Divider', Columns: 'Columns', Container: 'Container',
};

// Legacy snake_case → PascalCase
const LEGACY_TYPE_MAP: Record<string, string> = {
  hero: 'Hero', features: 'Features', cta: 'CTA', text_image: 'TextImage',
  text: 'Text', heading: 'Heading', rich_text: 'RichText', custom_html: 'CustomHTML',
  gallery: 'Gallery', video: 'Video', image_slider: 'ImageSlider',
  featured_products: 'FeaturedProducts', featured_courses: 'FeaturedCourses',
  pricing_table: 'PricingTable', product_grid: 'ProductGrid',
  faq_accordion: 'FAQ', contact_form: 'ContactForm', newsletter: 'Newsletter',
  map: 'Map', countdown: 'Countdown', tabs: 'Tabs', accordion: 'Accordion',
  team: 'Team', testimonials: 'Testimonials', stats: 'Stats',
  logo_carousel: 'LogoCarousel', social_links: 'SocialLinks',
  spacer: 'Spacer', divider: 'Divider', columns: 'Columns', container: 'Container',
};

// ── Format detection & normalization ───────────────────────────────────

function normalizeSections(raw: unknown): NormalizedSection[] {
  if (!raw) return [];

  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return []; }
  }

  // Puck Data format: {content: [{type, props}]}
  if (
    typeof data === 'object' &&
    data !== null &&
    'content' in (data as Record<string, unknown>) &&
    Array.isArray((data as Record<string, unknown>).content)
  ) {
    const puck = data as { content: Array<{ type: string; props?: Record<string, unknown> }> };
    return puck.content.map((item) => ({
      type: PUCK_TYPE_MAP[item.type] || item.type,
      props: item.props || {},
    }));
  }

  // Legacy array: [{id, type, data?, ...rest}]
  if (Array.isArray(data)) {
    return (data as Array<{ id?: string; type: string; data?: Record<string, unknown>; [k: string]: unknown }>).map((item) => {
      const { type, id: _id, data: nested, ...rest } = item;
      const resolvedType = PUCK_TYPE_MAP[type] || LEGACY_TYPE_MAP[type] || type;
      const props: Record<string, unknown> = nested && typeof nested === 'object'
        ? { ...(nested as Record<string, unknown>), ...rest }
        : rest;
      return { type: resolvedType, props };
    });
  }

  return [];
}

// ── Animated wrapper ───────────────────────────────────────────────────

interface SectionWrapperProps {
  animation?: string;
  paddingTop?: string;
  paddingBottom?: string;
  backgroundColor?: string;
  textColor?: string;
  children: React.ReactNode;
}

function SectionWrapper({
  animation = 'none',
  paddingTop = '4rem',
  paddingBottom = '4rem',
  backgroundColor,
  textColor,
  children,
}: SectionWrapperProps) {
  const animType = (animation || 'none') as AnimationType;
  const variants = animationVariants[animType] ?? animationVariants.none;

  const style: React.CSSProperties = {
    paddingTop: paddingTop || '4rem',
    paddingBottom: paddingBottom || '4rem',
    backgroundColor: backgroundColor || undefined,
    color: textColor || undefined,
  };

  return (
    <motion.section
      className="w-full relative"
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={variants}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </motion.section>
  );
}

// ── Individual section renderers ───────────────────────────────────────

function HeroSection({ props }: { props: Record<string, unknown> }) {
  const p = props;
  const variant = (p.variant as string) || 'centered';
  const isCenter = variant === 'centered' || variant === 'fullscreen' || variant === 'gradient';
  const isSplit = variant === 'split';

  const bgStyle: React.CSSProperties = {};

  if (has(p.backgroundImage)) {
    // Overlay intensity can be tuned per-variant
    const overlayDark = variant === 'fullscreen' ? '0.55' : '0.45';
    bgStyle.backgroundImage = `linear-gradient(rgba(0,0,0,${overlayDark}),rgba(0,0,0,${overlayDark})),url(${String(p.backgroundImage)})`;
    bgStyle.backgroundSize = 'cover';
    bgStyle.backgroundPosition = 'center';
    bgStyle.backgroundRepeat = 'no-repeat';
  } else if (variant === 'gradient') {
    // Animated gradient — keyframes injected once via a <style> tag
    bgStyle.backgroundSize = '300% 300%';
    bgStyle.animation = 'heroGradientShift 8s ease infinite';
    bgStyle.background = `linear-gradient(135deg, ${String(p.gradientFrom || p.backgroundColor || '#312e81')} 0%, ${String(p.gradientMid || '#1e40af')} 50%, ${String(p.gradientTo || '#0f766e')} 100%)`;
  }

  if (variant === 'fullscreen') {
    bgStyle.minHeight = '80vh';
    bgStyle.display = 'flex';
    bgStyle.alignItems = 'center';
    bgStyle.justifyContent = 'center';
  }

  const textColor = (p.textColor as string) || 'var(--k-text-primary, rgba(255,255,255,0.95))';

  return (
    <SectionWrapper animation={p.animation as string} paddingTop={p.paddingTop as string} paddingBottom={p.paddingBottom as string} backgroundColor={!has(p.backgroundImage) && variant !== 'gradient' ? (p.backgroundColor as string) : undefined} textColor={p.textColor as string}>
      {/* Inject gradient animation keyframes once */}
      {variant === 'gradient' && (
        <style>{`@keyframes heroGradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`}</style>
      )}
      <div
        className={`${isSplit ? 'grid md:grid-cols-2 gap-12 items-center' : `${isCenter ? 'text-center' : 'text-left'} space-y-6`} rounded-xl py-16 px-6`}
        style={{ ...bgStyle, color: textColor }}
      >
        {/* Text block — in split layout this is the left column */}
        <div className={`${isSplit ? 'space-y-6' : ''}`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">{String(p.title || '')}</h1>
          {has(p.subtitle) ? (
            <p className={`text-xl md:text-2xl opacity-80 ${isCenter ? 'max-w-3xl mx-auto' : 'max-w-xl'}`}>{String(p.subtitle)}</p>
          ) : null}
          <div className={`flex flex-wrap gap-4 pt-4 ${isCenter ? 'justify-center' : ''}`}>
            {has(p.ctaText) ? (
              <a
                href={String(p.ctaUrl || '#')}
                className="group relative inline-flex items-center px-8 py-4 rounded-xl font-semibold text-white overflow-hidden transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
                style={{ background: 'var(--k-accent, #6366f1)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}
              >
                <span className="relative z-10">{String(p.ctaText)}</span>
                <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl" />
              </a>
            ) : null}
            {has(p.ctaSecondaryText) ? (
              <a
                href={String(p.ctaSecondaryUrl || '#')}
                className="inline-flex items-center px-8 py-4 border-2 border-current rounded-xl font-semibold transition-all duration-200 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
              >
                {String(p.ctaSecondaryText)}
              </a>
            ) : null}
          </div>
        </div>
        {/* Split layout: right column shows hero image or accent block */}
        {isSplit && (
          <div className="flex items-center justify-center">
            {has(p.backgroundImage) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={String(p.backgroundImage)} alt={String(p.imageAlt || p.title || '')} className="w-full rounded-xl shadow-2xl object-cover max-h-[480px]" />
            ) : (
              <div className="w-full aspect-[4/3] rounded-2xl flex items-center justify-center text-6xl" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.10)' }}>
                {String(p.splitIcon || '✦')}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}

function FeaturesSection({ props }: { props: Record<string, unknown> }) {
  const cols = props.columns === '4' ? 'md:grid-cols-4' : props.columns === '2' ? 'md:grid-cols-2' : 'md:grid-cols-3';
  const items = (props.items as Array<{ icon?: string; title?: string; description?: string }>) || [];
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-8">
        {has(props.title) && <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>
          {has(props.subtitle) && <p className="text-lg opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{String(props.subtitle)}</p>}
        </div>}
        <motion.div className={`grid ${cols} gap-8`} variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {items.map((item, i) => (
            <motion.div key={i} variants={staggerChild} className="text-center space-y-4 p-6 rounded-xl transition-all duration-300 hover:translate-y-[-2px]" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
              {has(item.icon) && (
                <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center text-3xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  {item.icon}
                </div>
              )}
              {has(item.title) && <h3 className="text-xl font-semibold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{item.title}</h3>}
              {has(item.description) && <p className="text-sm opacity-70 leading-relaxed" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{item.description}</p>}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function CTASection({ props }: { props: Record<string, unknown> }) {
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="text-center space-y-6 rounded-2xl p-10 md:p-14" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.20) 0%, rgba(59,130,246,0.12) 100%)', border: '1px solid rgba(99,102,241,0.25)' }}>
        {has(props.title) && <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        {has(props.subtitle) && <p className="text-xl opacity-90 max-w-2xl mx-auto" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}>{String(props.subtitle)}</p>}
        <div className="flex flex-wrap gap-4 justify-center">
          {(has(props.buttonText) || has(props.ctaText)) ? (
            <a href={String(props.buttonUrl || props.ctaUrl || '#')} className="inline-block px-10 py-4 rounded-xl font-bold text-lg transition-all hover:scale-[1.02] hover:shadow-lg" style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}>
              {String(props.buttonText || props.ctaText)}
            </a>
          ) : null}
          {has(props.secondaryText) ? (
            <a href={String(props.secondaryUrl || '#')} className="inline-block px-10 py-4 rounded-xl font-semibold text-lg border transition-colors hover:bg-white/10" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
              {String(props.secondaryText)}
            </a>
          ) : null}
        </div>
      </div>
    </SectionWrapper>
  );
}

function TextImageSection({ props }: { props: Record<string, unknown> }) {
  const isLeft = props.layout === 'imageLeft';
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className={`space-y-4 ${isLeft ? 'md:order-2' : ''}`}>
          {has(props.title) && <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
          {has(props.content) && <p className="text-lg opacity-80 leading-relaxed" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}>{String(props.content)}</p>}
        </div>
        <div className={isLeft ? 'md:order-1' : ''}>
          {props.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(props.imageUrl)} alt={String(props.imageAlt || props.title || '')} className="w-full rounded-xl shadow-lg" />
          ) : (
            <div className="w-full aspect-video rounded-xl flex items-center justify-center" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="opacity-40">Image</span>
            </div>
          )}
        </div>
      </div>
    </SectionWrapper>
  );
}

function TextSection({ props }: { props: Record<string, unknown> }) {
  const align = (props.align as string) || 'left';
  const maxWidth = (props.maxWidth as string) || '700px';
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div style={{ maxWidth, margin: align === 'center' ? '0 auto' : undefined, textAlign: align as 'left' | 'center' | 'right' }}>
        <p className="text-lg leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.content || '')}</p>
      </div>
    </SectionWrapper>
  );
}

function HeadingSection({ props }: { props: Record<string, unknown> }) {
  const level = (props.level as string) || 'h2';
  const align = (props.align as string) || 'center';
  const sizes: Record<string, string> = { h1: 'text-4xl md:text-5xl', h2: 'text-3xl md:text-4xl', h3: 'text-2xl md:text-3xl' };
  const Tag = level as 'h1' | 'h2' | 'h3';
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <Tag className={`${sizes[level] || sizes.h2} font-bold`} style={{ textAlign: align as 'left' | 'center', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
        {String(props.text || '')}
      </Tag>
    </SectionWrapper>
  );
}

function RichTextSection({ props }: { props: Record<string, unknown> }) {
  const html = DOMPurify.sanitize(String(props.html || ''));
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="prose prose-invert max-w-none" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }} dangerouslySetInnerHTML={{ __html: html }} />
    </SectionWrapper>
  );
}

function CustomHTMLSection({ props }: { props: Record<string, unknown> }) {
  const code = DOMPurify.sanitize(String(props.code || ''), {
    ADD_TAGS: ['iframe', 'style'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
  });
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div dangerouslySetInnerHTML={{ __html: code }} />
    </SectionWrapper>
  );
}

function GallerySection({ props }: { props: Record<string, unknown> }) {
  const colCount = props.columns === '4' ? 4 : props.columns === '2' ? 2 : 3;
  const colClass = colCount === 4 ? 'md:grid-cols-4' : colCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  const useMasonry = colCount > 2; // alternate aspect ratios for masonry feel
  const images = (props.images as Array<{ url: string; alt?: string; caption?: string; title?: string }>) || [];

  // Masonry pattern: cycle through 3 aspect ratios to create visual rhythm
  const masonryAspects = ['aspect-square', 'aspect-[4/3]', 'aspect-[3/4]'];

  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-6">
        {has(props.title) && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        <motion.div className={`grid ${colClass} gap-4`} variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {images.map((img, i) => {
            const aspectClass = useMasonry ? masonryAspects[i % masonryAspects.length] : 'aspect-square';
            // Build a meaningful alt: prefer explicit alt, fall back to caption or title, then a positional description
            const altText = img.alt || img.caption || img.title || `${has(props.title) ? String(props.title) + ' — ' : ''}image ${i + 1}`;
            return (
              <motion.div key={i} variants={staggerChild} className="group relative overflow-hidden rounded-xl">
                {has(img.url)
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={img.url} alt={altText} className={`w-full ${aspectClass} object-cover group-hover:scale-105 transition-transform duration-300`} loading="lazy" />
                  : <div className={`w-full ${aspectClass} flex items-center justify-center`} style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }} role="img" aria-label={altText}>📷</div>
                }
                {has(img.caption) && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 text-white text-sm" aria-hidden="true">
                    {String(img.caption)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function VideoSection({ props }: { props: Record<string, unknown> }) {
  let embedUrl = String(props.videoUrl || '');
  if (embedUrl.includes('youtube.com/watch')) {
    try { const vid = new URL(embedUrl).searchParams.get('v'); embedUrl = vid ? `https://www.youtube.com/embed/${vid}` : ''; } catch { embedUrl = ''; }
  } else if (embedUrl.includes('youtu.be/')) {
    embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/');
  } else if (embedUrl.includes('youtube.com/shorts/')) {
    embedUrl = embedUrl.replace('youtube.com/shorts/', 'youtube.com/embed/');
  } else if (embedUrl.includes('vimeo.com/') && !embedUrl.includes('player.vimeo.com')) {
    const vid = embedUrl.match(/vimeo\.com\/(\d+)/)?.[1];
    embedUrl = vid ? `https://player.vimeo.com/video/${vid}` : embedUrl;
  }
  const aspectRatio = String(props.aspectRatio || '56.25%');
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-4">
        {has(props.title) && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ paddingBottom: aspectRatio }}>
          {embedUrl
            ? <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen title={String(props.title || 'Vidéo')} sandbox="allow-scripts allow-same-origin allow-presentation" />
            : <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>🎬</div>
          }
        </div>
      </div>
    </SectionWrapper>
  );
}

function ImageSliderSection({ props }: { props: Record<string, unknown> }) {
  const slides = (props.images as Array<{ url: string; alt?: string }>) || [];
  const [current, setCurrent] = useState(0);
  const autoPlay = props.autoPlay === 'true' || props.autoPlay === true;

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent((c) => (c + 1) % slides.length);

  // Auto-advance slides
  useEffect(() => {
    if (!autoPlay || slides.length < 2) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [autoPlay, slides.length]);

  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="relative overflow-hidden rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {slides.length > 0 && slides[current]?.url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={slides[current].url} alt={slides[current].alt || ''} className="w-full aspect-[21/9] object-cover" />
          : <div className="w-full aspect-[21/9] flex items-center justify-center" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>🖼️</div>
        }
        {slides.length > 1 && (
          <>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? 'bg-white' : 'bg-white/40'}`} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 rounded-full flex items-center justify-center text-white text-lg backdrop-blur-sm hover:bg-black/50 transition-colors" aria-label="Précédent">‹</button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 rounded-full flex items-center justify-center text-white text-lg backdrop-blur-sm hover:bg-black/50 transition-colors" aria-label="Suivant">›</button>
          </>
        )}
      </div>
    </SectionWrapper>
  );
}

function PricingTableSection({ props }: { props: Record<string, unknown> }) {
  const plans = (props.plans as Array<{ name: string; price: string; period?: string; features: string; ctaText?: string; highlighted?: string }>) || [];
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-8">
        <div className="text-center space-y-3">
          {has(props.title) && <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
          {has(props.subtitle) && <p className="text-lg opacity-70 max-w-2xl mx-auto" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{String(props.subtitle)}</p>}
        </div>
        <div className={`grid gap-6 max-w-5xl mx-auto ${plans.length === 2 ? 'md:grid-cols-2' : plans.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {plans.map((plan, i) => {
            const isHighlighted = plan.highlighted === 'true' || plan.highlighted === true as unknown;
            return (
              <motion.div key={i} variants={staggerChild} className={`rounded-2xl p-8 space-y-6 relative ${isHighlighted ? 'scale-105' : ''}`} style={{ background: isHighlighted ? 'linear-gradient(to bottom, #6366f1, #4f46e5)' : 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: isHighlighted ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', color: 'var(--k-text-primary, rgba(255,255,255,0.95))', boxShadow: isHighlighted ? '0 20px 60px rgba(99,102,241,0.3)' : undefined }}>
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-sm">POPULAIRE</div>
                )}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div><span className="text-4xl font-bold">{plan.price}</span><span className="opacity-70">{plan.period || ''}</span></div>
                <ul className="space-y-2 text-sm">
                  {(plan.features || '').split('\n').filter(Boolean).map((f, j) => (
                    <li key={j} className="flex items-center gap-2"><span style={{ color: isHighlighted ? '#fff' : 'var(--k-accent, #6366f1)' }}>✓</span>{f}</li>
                  ))}
                </ul>
                {has(plan.ctaText) && (
                  <button className={`w-full py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 ${isHighlighted ? 'bg-white' : ''}`} style={{ color: isHighlighted ? 'var(--k-accent, #6366f1)' : '#fff', background: isHighlighted ? '#fff' : 'var(--k-accent, #6366f1)' }}>
                    {plan.ctaText}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}

function FAQSection({ props }: { props: Record<string, unknown> }) {
  const faqs = (props.items as Array<{ question: string; answer: string }>) || [];
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-6 max-w-3xl mx-auto">
        {has(props.title) && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>
              <summary className="p-5 font-semibold cursor-pointer hover:bg-white/5 transition-colors" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{faq.question}</summary>
              <div className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}>{faq.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function ContactFormSection({ props }: { props: Record<string, unknown> }) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());
    // Honeypot spam protection — if hidden field is filled, it's a bot
    if (body._hp) { setSubmitted(true); return; }
    delete body._hp;
    try {
      const res = await fetch('/api/forms/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) { setSubmitted(true); } else { setError('Une erreur est survenue. Veuillez réessayer.'); }
    } catch { setError('Impossible d\'envoyer le message. Vérifiez votre connexion.'); } finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--k-text-primary, rgba(255,255,255,0.95))', borderRadius: '0.75rem', padding: '0.625rem 1rem', width: '100%', fontSize: '0.875rem' };

  if (submitted) {
    return (
      <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
        <div className="rounded-2xl p-10 text-center max-w-2xl mx-auto" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
          <div className="text-5xl mb-4 text-green-400">✓</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>Message envoyé</h3>
          <p style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>Nous vous répondrons dans les plus brefs délais.</p>
        </div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="rounded-2xl p-8 md:p-10 max-w-2xl mx-auto" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
        {has(props.title) && <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        {has(props.subtitle) && <p className="text-center mb-6" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{String(props.subtitle)}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot — hidden field to catch bots */}
          <input name="_hp" type="text" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px', opacity: 0 }} />
          <div className="grid md:grid-cols-2 gap-4">
            <input name="name" placeholder="Nom" required style={inputStyle} />
            <input name="email" type="email" placeholder="Email" required style={inputStyle} />
          </div>
          <input name="subject" placeholder="Sujet" style={inputStyle} />
          <textarea name="message" placeholder="Message" rows={4} required style={{ ...inputStyle, resize: 'vertical' }} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}>
            {loading ? 'Envoi en cours…' : String(props.submitLabel || 'Envoyer le message')}
          </button>
        </form>
      </div>
    </SectionWrapper>
  );
}

function NewsletterSection({ props }: { props: Record<string, unknown> }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mailing-list/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) { setSubscribed(true); } else { setError('Une erreur est survenue.'); }
    } catch { setError('Impossible de s\'abonner pour l\'instant.'); } finally { setLoading(false); }
  };

  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="text-center space-y-4 max-w-xl mx-auto">
        {has(props.title) && <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        {has(props.subtitle) && <p className="opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{String(props.subtitle)}</p>}
        {subscribed
          ? <p className="text-green-400 font-medium">✓ Vous êtes abonné !</p>
          : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" required className="flex-1 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }} />
              <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap" style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}>
                {loading ? '…' : String(props.buttonText || "S'abonner")}
              </button>
            </form>
          )
        }
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </SectionWrapper>
  );
}

function MapSection({ props }: { props: Record<string, unknown> }) {
  const height = String(props.height || '400');
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-4">
        {has(props.title) && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        {props.embedUrl
          ? <iframe src={String(props.embedUrl).startsWith('https://') ? String(props.embedUrl) : ''} className="w-full rounded-xl" style={{ height: `${height}px`, border: '1px solid rgba(255,255,255,0.08)' }} allowFullScreen loading="lazy" title={String(props.title || 'Carte')} sandbox="allow-scripts allow-same-origin" />
          : <div className="w-full rounded-xl flex items-center justify-center opacity-40" style={{ height: `${height}px`, background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)' }}>📍 Carte</div>
        }
      </div>
    </SectionWrapper>
  );
}

function CountdownSection({ props }: { props: Record<string, unknown> }) {
  const targetDate = String(props.targetDate || '2027-01-01');

  function calcTimeLeft() {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  }

  const [timeLeft, setTimeLeft] = useState(calcTimeLeft);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  const units = [
    { value: timeLeft.days, label: 'Jours' },
    { value: timeLeft.hours, label: 'Heures' },
    { value: timeLeft.minutes, label: 'Minutes' },
    { value: timeLeft.seconds, label: 'Secondes' },
  ];

  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="text-center space-y-8 rounded-2xl p-10" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)', border: '1px solid rgba(99,102,241,0.20)' }}>
        {has(props.title) && <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        {has(props.subtitle) && <p className="opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}>{String(props.subtitle)}</p>}
        <div className="flex justify-center items-center gap-3 md:gap-6">
          {units.map((u, i) => (
            <React.Fragment key={u.label}>
              {i > 0 && <span className="text-2xl font-bold" style={{ color: 'rgba(255,255,255,0.30)' }}>:</span>}
              <div className="text-center">
                <div className="text-3xl md:text-5xl font-bold tabular-nums px-4 py-3 rounded-xl" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', color: 'var(--k-text-primary, rgba(255,255,255,0.95))', border: '1px solid rgba(255,255,255,0.08)', minWidth: '4rem' }}>
                  {String(u.value).padStart(2, '0')}
                </div>
                <p className="text-xs mt-2 uppercase tracking-wider" style={{ color: 'var(--k-text-tertiary, rgba(255,255,255,0.40))' }}>{u.label}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
        {has(props.ctaLabel) && has(props.ctaHref) ? (
          <a href={String(props.ctaHref)} className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-lg transition-opacity hover:opacity-90" style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}>
            {String(props.ctaLabel)}
          </a>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function TabsSection({ props }: { props: Record<string, unknown> }) {
  const tabs = (props.tabs as Array<{ title: string; content: string }>) || [];
  const [active, setActive] = useState(0);
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-0">
        <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          {tabs.map((tab, i) => (
            <button key={i} onClick={() => setActive(i)} className={`px-6 py-3 font-medium whitespace-nowrap transition-colors ${i === active ? 'border-b-2' : 'opacity-50 hover:opacity-80'}`} style={{ borderBottomColor: i === active ? 'var(--k-accent, #6366f1)' : 'transparent', color: i === active ? 'var(--k-accent, #6366f1)' : 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
              {tab.title}
            </button>
          ))}
        </div>
        {tabs[active] ? (
          <div className="p-6 rounded-b-xl" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none', color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            <p className="whitespace-pre-wrap leading-relaxed">{tabs[active].content}</p>
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function AccordionSection({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as Array<{ title: string; content: string }>) || [];
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-2 max-w-3xl mx-auto">
        {items.map((item, i) => (
          <details key={i} className="rounded-xl overflow-hidden group" open={i === 0} style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>
            <summary className="p-4 font-medium cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between list-none [&::-webkit-details-marker]:hidden" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
              <span>{item.title}</span>
              <span className="text-sm opacity-40 group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
            </summary>
            <div className="px-4 pb-4 leading-relaxed border-t border-white/5 pt-3" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}>{item.content}</div>
          </details>
        ))}
      </div>
    </SectionWrapper>
  );
}

function TeamSection({ props }: { props: Record<string, unknown> }) {
  const members = (props.members as Array<{ name: string; role?: string; imageUrl?: string }>) || [];
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-8">
        {has(props.title) && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        <motion.div className="grid md:grid-cols-3 gap-8" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {members.map((m, i) => (
            <motion.div key={i} variants={staggerChild} className="text-center space-y-4 p-6 rounded-xl transition-all duration-300 hover:translate-y-[-2px]" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.05))', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="relative mx-auto w-28 h-28">
                {m.imageUrl
                  ? <img src={m.imageUrl} alt={m.name} className="w-28 h-28 rounded-full object-cover" style={{ border: '3px solid rgba(99,102,241,0.3)' }} loading="lazy" />
                  : <div className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold text-white" style={{ background: `linear-gradient(135deg, hsl(${(i * 60 + 240) % 360}, 70%, 50%), hsl(${(i * 60 + 280) % 360}, 70%, 40%))`, border: '3px solid rgba(255,255,255,0.15)' }}>
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                }
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{m.name}</h3>
                {m.role ? <p className="text-sm opacity-70 mt-1" style={{ color: 'var(--k-accent, #6366f1)' }}>{m.role}</p> : null}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function TestimonialsSection({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as Array<{ quote: string; author: string; role?: string; rating?: string }>) || [];
  const layout = String(props.layout || 'grid');

  // Hero layout — single large testimonial
  if (layout === 'hero' && items.length > 0) {
    const t = items[0];
    return (
      <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          {has(props.title) && <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
          <div className="text-5xl opacity-20" style={{ color: 'var(--k-accent, #6366f1)' }}>&ldquo;</div>
          <blockquote className="text-2xl md:text-3xl font-medium italic leading-relaxed -mt-6" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
            {t.quote}
          </blockquote>
          {t.rating ? <div className="text-amber-400 text-xl">{'★'.repeat(Number(t.rating))}{'☆'.repeat(5 - Number(t.rating))}</div> : null}
          <footer>
            <p className="font-semibold text-lg" style={{ color: 'var(--k-accent, #6366f1)' }}>{t.author}</p>
            {t.role ? <p className="opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{t.role}</p> : null}
          </footer>
        </div>
      </SectionWrapper>
    );
  }

  const gridClass = layout === 'centered' ? 'max-w-2xl mx-auto space-y-6' : 'grid md:grid-cols-2 gap-8 max-w-4xl mx-auto';

  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-8">
        {has(props.title) && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        <motion.div className={gridClass} variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {items.map((t, i) => (
            <motion.blockquote key={i} variants={staggerChild} className="p-8 rounded-2xl space-y-4" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
              {t.rating ? <div className="text-amber-400">{'★'.repeat(Number(t.rating))}{'☆'.repeat(5 - Number(t.rating))}</div> : null}
              <p className="text-lg italic leading-relaxed" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.90))' }}>&ldquo;{t.quote}&rdquo;</p>
              <footer className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                  {t.author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{t.author}</p>
                  {t.role ? <p className="text-xs opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{t.role}</p> : null}
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function StatsSection({ props }: { props: Record<string, unknown> }) {
  const stats = (props.items as Array<{ value: string; label: string }>) || [];
  const cols = stats.length === 3 ? 'md:grid-cols-3' : stats.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-4';
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <motion.div className={`grid grid-cols-2 ${cols} gap-6`} variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        {stats.map((s, i) => (
          <motion.div key={i} variants={staggerChild} className="text-center p-6 rounded-xl" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.06))', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: 'var(--k-accent, #6366f1)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div className="text-sm font-medium" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{s.label}</div>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}

function LogoCarouselSection({ props }: { props: Record<string, unknown> }) {
  const logos = (props.logos as Array<{ url: string; name: string }>) || [];
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="space-y-6">
        {has(props.title) && <h2 className="text-xl font-semibold text-center opacity-50" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{String(props.title)}</h2>}
        <div className="flex flex-wrap justify-center items-center gap-12">
          {logos.map((logo, i) => (
            <div key={i} className="grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100">
              {logo.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logo.url} alt={logo.name} className="h-12 object-contain" />
                : <div className="w-24 h-12 rounded flex items-center justify-center text-xs" style={{ background: 'var(--k-glass-regular, rgba(255,255,255,0.08))', color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{logo.name}</div>
              }
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

function SocialLinksSection({ props }: { props: Record<string, unknown> }) {
  const links = [
    { url: props.facebook as string, label: 'Facebook', icon: '📘' },
    { url: props.instagram as string, label: 'Instagram', icon: '📷' },
    { url: props.twitter as string, label: 'X (Twitter)', icon: '🐦' },
    { url: props.linkedin as string, label: 'LinkedIn', icon: '💼' },
    { url: props.tiktok as string, label: 'TikTok', icon: '🎵' },
    { url: props.youtube as string, label: 'YouTube', icon: '▶️' },
  ].filter((l) => l.url);
  return (
    <SectionWrapper animation={props.animation as string} paddingTop={props.paddingTop as string} paddingBottom={props.paddingBottom as string} backgroundColor={props.backgroundColor as string} textColor={props.textColor as string}>
      <div className="text-center space-y-4">
        {has(props.title) && <h2 className="text-xl font-semibold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(props.title)}</h2>}
        <div className="flex justify-center gap-6 text-3xl">
          {links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="hover:scale-110 transition-transform">{link.icon}</a>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}

// ── Main switch renderer ───────────────────────────────────────────────

function RenderSection({ section }: { section: NormalizedSection }) {
  switch (section.type) {
    case 'Hero':         return <HeroSection props={section.props} />;
    case 'Features':     return <FeaturesSection props={section.props} />;
    case 'CTA':          return <CTASection props={section.props} />;
    case 'TextImage':    return <TextImageSection props={section.props} />;
    case 'Text':         return <TextSection props={section.props} />;
    case 'Heading':      return <HeadingSection props={section.props} />;
    case 'RichText':     return <RichTextSection props={section.props} />;
    case 'CustomHTML':   return <CustomHTMLSection props={section.props} />;
    case 'Gallery':      return <GallerySection props={section.props} />;
    case 'Video':        return <VideoSection props={section.props} />;
    case 'ImageSlider':  return <ImageSliderSection props={section.props} />;
    case 'PricingTable': return <PricingTableSection props={section.props} />;
    case 'FAQ':          return <FAQSection props={section.props} />;
    case 'ContactForm':  return <ContactFormSection props={section.props} />;
    case 'Newsletter':   return <NewsletterSection props={section.props} />;
    case 'Map':          return <MapSection props={section.props} />;
    case 'Countdown':    return <CountdownSection props={section.props} />;
    case 'Tabs':         return <TabsSection props={section.props} />;
    case 'Accordion':    return <AccordionSection props={section.props} />;
    case 'Team':         return <TeamSection props={section.props} />;
    case 'Testimonials': return <TestimonialsSection props={section.props} />;
    case 'Stats':        return <StatsSection props={section.props} />;
    case 'LogoCarousel': return <LogoCarouselSection props={section.props} />;
    case 'SocialLinks':  return <SocialLinksSection props={section.props} />;
    case 'FeaturedProducts':
    case 'ProductGrid':
      return (
        <SectionWrapper animation={section.props.animation as string} paddingTop={section.props.paddingTop as string} paddingBottom={section.props.paddingBottom as string} backgroundColor={section.props.backgroundColor as string} textColor={section.props.textColor as string}>
          <LiveProductGrid
            title={String(section.props.title || 'Nos produits')}
            category={section.props.category as string}
            limit={(section.props.limit as number) || 4}
          />
        </SectionWrapper>
      );
    case 'FeaturedCourses':
      return (
        <SectionWrapper animation={section.props.animation as string} paddingTop={section.props.paddingTop as string} paddingBottom={section.props.paddingBottom as string} backgroundColor={section.props.backgroundColor as string} textColor={section.props.textColor as string}>
          <LiveCourseGrid
            title={String(section.props.title || 'Nos formations')}
            limit={(section.props.limit as number) || 3}
          />
        </SectionWrapper>
      );
    case 'Spacer':
      return <div style={{ height: String(section.props.height || '2rem') }} />;
    case 'Divider': {
      const divStyle = String(section.props.style || 'solid');
      if (divStyle === 'gradient') return <div className="h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)' }} />;
      return <hr style={{ borderStyle: divStyle as 'solid' | 'dashed' | 'dotted', borderColor: 'rgba(255,255,255,0.10)', borderTopWidth: '1px', borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0 }} />;
    }
    case 'Columns': {
      // Render nested zones if available in Puck data format
      const zones = section.props._zones as Record<string, Array<{ type: string; props: Record<string, unknown> }>> | undefined;
      const colLayout = String(section.props.layout || '1fr 1fr');
      const colGap = String(section.props.gap || '2rem');
      const colCount = colLayout.split(' ').length;
      return (
        <SectionWrapper animation={section.props.animation as string} paddingTop={section.props.paddingTop as string} paddingBottom={section.props.paddingBottom as string} backgroundColor={section.props.backgroundColor as string} textColor={section.props.textColor as string}>
          <div style={{ display: 'grid', gridTemplateColumns: colLayout, gap: colGap }}>
            {Array.from({ length: colCount }).map((_, i) => {
              const zoneContent = zones?.[`column-${i}`];
              return (
                <div key={i}>
                  {zoneContent ? (
                    zoneContent.map((child, ci) => (
                      <div key={ci}>{<RenderSection section={{ type: child.type, props: child.props }} />}</div>
                    ))
                  ) : null}
                </div>
              );
            })}
          </div>
        </SectionWrapper>
      );
    }
    case 'Container': {
      const containerZones = section.props._zones as Record<string, Array<{ type: string; props: Record<string, unknown> }>> | undefined;
      const containerContent = containerZones?.['container-content'];
      return (
        <SectionWrapper animation={section.props.animation as string} paddingTop={section.props.paddingTop as string} paddingBottom={section.props.paddingBottom as string} backgroundColor={section.props.backgroundColor as string} textColor={section.props.textColor as string}>
          <div style={{ maxWidth: String(section.props.maxWidth || '960px'), margin: '0 auto' }}>
            {containerContent ? containerContent.map((child, ci) => (
              <div key={ci}>{<RenderSection section={{ type: child.type, props: child.props }} />}</div>
            )) : null}
          </div>
        </SectionWrapper>
      );
    }
    case 'Banner': {
      const bannerStyles: Record<string, string> = {
        info: 'background: #2563eb; color: white;',
        success: 'background: #059669; color: white;',
        warning: 'background: #f59e0b; color: #451a03;',
        promo: 'background: linear-gradient(to right, #7c3aed, #2563eb); color: white;',
        gradient: 'background: linear-gradient(to right, #f43f5e, #8b5cf6, #3b82f6); color: white;',
      };
      const bannerStyle = bannerStyles[String(section.props.variant || 'promo')] || bannerStyles.promo;
      return (
        <div className="w-full py-3 px-6 text-center text-sm font-medium flex items-center justify-center gap-3" style={Object.fromEntries(bannerStyle.split(';').filter(Boolean).map(s => { const [k, v] = s.split(':').map(x => x.trim()); return [k, v]; })) as React.CSSProperties} role="banner">
          <span>{String(section.props.text || '')}</span>
          {has(section.props.linkText) ? <a href={String(section.props.linkUrl || '#')} className="underline font-semibold">{String(section.props.linkText)}</a> : null}
        </div>
      );
    }
    case 'ProcessSteps': {
      const steps = (section.props.steps as Array<{ icon: string; title: string; description: string }>) || [];
      return (
        <SectionWrapper animation={section.props.animation as string} paddingTop={section.props.paddingTop as string} paddingBottom={section.props.paddingBottom as string} backgroundColor={section.props.backgroundColor as string} textColor={section.props.textColor as string}>
          <div className="space-y-8">
            <div className="text-center space-y-2">
              {has(section.props.title) && <h2 className="text-3xl font-bold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{String(section.props.title)}</h2>}
              {has(section.props.subtitle) && <p className="text-lg opacity-70" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{String(section.props.subtitle)}</p>}
            </div>
            <div className="relative max-w-4xl mx-auto">
              <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(to right, transparent, rgba(99,102,241,0.3), transparent)' }} />
              <div className="grid md:grid-cols-4 gap-8 relative">
                {steps.map((step, i) => (
                  <motion.div key={i} className="text-center space-y-3" variants={staggerChild} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    <div className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center text-2xl relative z-10" style={{ background: 'var(--k-glass-thick, rgba(255,255,255,0.12))', border: '1px solid rgba(99,102,241,0.3)' }}>
                      {step.icon}
                    </div>
                    <h3 className="font-semibold" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{step.title}</h3>
                    <p className="text-sm opacity-70 leading-relaxed" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>{step.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </SectionWrapper>
      );
    }
    case 'BackgroundVideo': {
      const videoSrc = String(section.props.videoUrl || '');
      const overlay = String(section.props.overlayOpacity || '0.5');
      const h = String(section.props.height || '600px');
      return (
        <div className="relative overflow-hidden flex items-center justify-center" style={{ minHeight: h, background: '#0f172a' }}>
          {videoSrc && (videoSrc.endsWith('.mp4') || videoSrc.endsWith('.webm')) ? (
            <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
              <source src={videoSrc} type="video/mp4" />
            </video>
          ) : null}
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
          <div className="relative z-10 text-center space-y-6 px-6 max-w-3xl" style={{ color: '#fff' }}>
            {has(section.props.title) && <h2 className="text-4xl md:text-5xl font-bold">{String(section.props.title)}</h2>}
            {has(section.props.subtitle) && <p className="text-xl opacity-80">{String(section.props.subtitle)}</p>}
            {has(section.props.ctaText) ? (
              <a href={String(section.props.ctaUrl || '#')} className="inline-block px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl font-semibold text-lg hover:bg-white/30 transition-all">
                {String(section.props.ctaText)}
              </a>
            ) : null}
          </div>
        </div>
      );
    }
    case 'Section': {
      const sectionZones = section.props._zones as Record<string, Array<{ type: string; props: Record<string, unknown> }>> | undefined;
      const sectionContent = sectionZones?.['section-content'];
      return (
        <SectionWrapper animation={section.props.animation as string} paddingTop={section.props.paddingTop as string} paddingBottom={section.props.paddingBottom as string} backgroundColor={section.props.backgroundColor as string} textColor={section.props.textColor as string}>
          <div className={section.props.fullWidth === 'true' ? 'w-full' : 'max-w-7xl mx-auto'}>
            {sectionContent ? sectionContent.map((child, ci) => (
              <div key={ci}>{<RenderSection section={{ type: child.type, props: child.props }} />}</div>
            )) : null}
          </div>
        </SectionWrapper>
      );
    }
    default:
      return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────

export interface PuckSectionRendererProps {
  sections: unknown; // accepts legacy array, Puck Data, or JSON string
}

export default function PuckSectionRenderer({ sections }: PuckSectionRendererProps) {
  const normalized = useMemo(() => normalizeSections(sections), [sections]);
  if (normalized.length === 0) return null;

  return (
    <div className="w-full" style={{ background: 'var(--k-bg, #0a0a0f)' }}>
      {normalized.map((section, idx) => (
        <RenderSection key={idx} section={section} />
      ))}
    </div>
  );
}

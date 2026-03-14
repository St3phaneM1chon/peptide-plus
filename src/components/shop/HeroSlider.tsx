'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';

interface HeroSlideTranslation {
  locale: string;
  badgeText?: string | null;
  title: string;
  subtitle?: string | null;
  ctaText?: string | null;
  cta2Text?: string | null;
  statsJson?: string | null;
}

interface HeroSlide {
  id: string;
  slug: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'ANIMATION';
  backgroundUrl: string;
  backgroundMobile?: string | null;
  overlayOpacity: number;
  overlayGradient?: string | null;
  badgeText?: string | null;
  title: string;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaStyle?: string | null;
  cta2Text?: string | null;
  cta2Url?: string | null;
  cta2Style?: string | null;
  statsJson?: string | null;
  translations: HeroSlideTranslation[];
}

interface StatItem {
  value: string;
  label: string;
}

function getLocalizedField(
  slide: HeroSlide,
  field: 'badgeText' | 'title' | 'subtitle' | 'ctaText' | 'cta2Text' | 'statsJson',
  locale: string
): string | null | undefined {
  const translation = slide.translations.find((t) => t.locale === locale);
  if (translation && translation[field]) return translation[field];
  return slide[field];
}

interface HeroSliderProps {
  /** Pre-fetched slides from SSR for instant LCP rendering. */
  initialSlides?: HeroSlide[];
}

// Simple in-memory cache for hero slides to avoid refetching on re-mounts
let heroSlidesCache: { data: HeroSlide[] | null; timestamp: number } = { data: null, timestamp: 0 };
const HERO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function HeroSlider({ initialSlides }: HeroSliderProps) {
  const { t, locale } = useI18n();
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides || heroSlidesCache.data || []);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadSlides = useCallback(() => {
    // If we have SSR-provided slides, populate cache and skip fetch
    if (initialSlides && initialSlides.length > 0) {
      heroSlidesCache = { data: initialSlides, timestamp: Date.now() };
      return;
    }

    const now = Date.now();
    if (heroSlidesCache.data && (now - heroSlidesCache.timestamp) < HERO_CACHE_TTL) {
      setSlides(heroSlidesCache.data);
      return;
    }

    // Fallback: client-side fetch only when no SSR data was provided
    fetch('/api/hero-slides/active')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.slides?.length) {
          heroSlidesCache = { data: data.slides, timestamp: Date.now() };
          setSlides(data.slides);
        }
      })
      .catch(() => {});
  }, [initialSlides]);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || slides.length === 0) return;
      setIsTransitioning(true);
      setCurrent((index + slides.length) % slides.length);
      setTimeout(() => setIsTransitioning(false), 600);
    },
    [slides.length, isTransitioning]
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // Autoplay
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    intervalRef.current = setInterval(next, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [slides.length, isPaused, next]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
  };

  if (slides.length === 0) {
    // Skeleton while loading
    return (
      <section className="relative text-white py-5 md:py-6 overflow-hidden bg-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse max-w-3xl">
            <div className="h-6 w-48 bg-white/10 rounded-full mb-6" />
            <div className="h-12 w-96 bg-white/10 rounded mb-4" />
            <div className="h-6 w-80 bg-white/10 rounded mb-8" />
            <div className="flex gap-4 mb-12">
              <div className="h-14 w-48 bg-white/10 rounded-xl" />
              <div className="h-14 w-40 bg-white/10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-white/10 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const slide = slides[current];
  const badgeText = getLocalizedField(slide, 'badgeText', locale);
  const title = getLocalizedField(slide, 'title', locale) || slide.title;
  const subtitle = getLocalizedField(slide, 'subtitle', locale);
  const ctaText = getLocalizedField(slide, 'ctaText', locale);
  const cta2Text = getLocalizedField(slide, 'cta2Text', locale);
  const rawStats = getLocalizedField(slide, 'statsJson', locale);

  let stats: StatItem[] = [];
  try {
    if (rawStats) stats = JSON.parse(rawStats);
  } catch {
    // Invalid JSON in statsJson - use empty stats
  }

  const ctaClasses: Record<string, string> = {
    primary:
      'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/25 hover:scale-105',
    secondary:
      'bg-white hover:bg-gray-100 text-black shadow-lg hover:scale-105',
    outline:
      'bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white',
  };

  return (
    <section
      className="relative text-white overflow-hidden min-h-[280px] md:min-h-[340px] flex items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Background layers for all slides */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-600 ease-in-out"
          style={{
            opacity: i === current ? 1 : 0,
            zIndex: i === current ? 1 : 0,
          }}
        >
          {s.mediaType === 'VIDEO' ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={s.backgroundUrl}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <>
              {/* Desktop image */}
              <Image
                src={s.backgroundUrl}
                alt={s.title || ''}
                fill
                priority={i === 0}
                sizes="100vw"
                className="absolute inset-0 object-cover hidden md:block"
              />
              {/* Mobile image */}
              <Image
                src={s.backgroundMobile || s.backgroundUrl}
                alt={s.title || ''}
                fill
                priority={i === 0}
                sizes="100vw"
                className="absolute inset-0 object-cover md:hidden"
              />
            </>
          )}
          {/* Overlay — bleuté pour harmoniser le visuel */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(20,60,120,${Math.max(s.overlayOpacity, 30) / 100})` }}
          />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-14 sm:px-16 lg:px-20">
        <div className="max-w-5xl">
          {/* Badge */}
          {badgeText && (
            <div
              key={`badge-${current}`}
              className="inline-flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 rounded-full px-3 py-1 mb-4 animate-fadeInUp"
            >
              <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
              <span className="text-primary-400 text-sm font-medium">
                {badgeText}
              </span>
            </div>
          )}

          {/* Title */}
          <h1
            key={`title-${current}`}
            className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 leading-tight text-white animate-fadeInUp drop-shadow-lg"
            style={{ animationDelay: '0.1s', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p
              key={`sub-${current}`}
              className="text-sm md:text-base text-gray-100 mb-5 max-w-2xl animate-fadeInUp drop-shadow-md line-clamp-2"
              style={{ animationDelay: '0.2s' }}
            >
              {subtitle}
            </p>
          )}

          {/* CTA Buttons */}
          {(ctaText || cta2Text) && (
            <div
              key={`cta-${current}`}
              className="flex flex-wrap gap-3 mb-6 animate-fadeInUp"
              style={{ animationDelay: '0.3s' }}
            >
              {ctaText && slide.ctaUrl && (
                <Link
                  href={slide.ctaUrl}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${ctaClasses[slide.ctaStyle || 'primary']}`}
                >
                  {ctaText}
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
              )}
              {cta2Text && slide.cta2Url && (
                <Link
                  href={slide.cta2Url}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${ctaClasses[slide.cta2Style || 'outline']}`}
                >
                  {cta2Text}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        {stats.length > 0 && (
          <div
            key={`stats-${current}`}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-5xl animate-fadeInUp"
            style={{ animationDelay: '0.4s' }}
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg"
              >
                <p className="text-lg md:text-xl font-bold text-primary-400">
                  {stat.value}
                </p>
                <p className="text-[11px] text-gray-300">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        {slides.length > 1 && (
          <>
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-8">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current
                      ? 'w-8 bg-primary-500'
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Arrows */}
            <button
              onClick={prev}
              className="absolute start-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/50 backdrop-blur rounded-full text-white transition-colors"
              aria-label={t('common.aria.previousSlide')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute end-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/50 backdrop-blur rounded-full text-white transition-colors"
              aria-label={t('common.aria.nextSlide')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

    </section>
  );
}

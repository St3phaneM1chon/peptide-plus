'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

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

export default function HeroSlider() {
  const { locale } = useTranslations();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/hero-slides/active')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.slides?.length) setSlides(data.slides);
      })
      .catch(() => {});
  }, []);

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
  } catch {}

  const ctaClasses: Record<string, string> = {
    primary:
      'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25 hover:scale-105',
    secondary:
      'bg-white hover:bg-gray-100 text-black shadow-lg hover:scale-105',
    outline:
      'bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white',
  };

  return (
    <section
      className="relative text-white py-5 md:py-6 overflow-hidden"
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
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden md:block"
                style={{ backgroundImage: `url('${s.backgroundUrl}')` }}
              />
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat md:hidden"
                style={{
                  backgroundImage: `url('${s.backgroundMobile || s.backgroundUrl}')`,
                }}
              />
            </>
          )}
          {/* Overlay - dark base + optional gradient */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${Math.max(s.overlayOpacity, 75) / 100})` }}
          />
          {s.overlayGradient && (
            <div className={`absolute inset-0 bg-gradient-to-r ${s.overlayGradient}`} />
          )}
        </div>
      ))}

      {/* Content - px-16 to clear navigation arrows */}
      <div className="relative z-10 max-w-7xl mx-auto px-16 sm:px-20 lg:px-24">
        <div className="max-w-3xl">
          {/* Badge */}
          {badgeText && (
            <div
              key={`badge-${current}`}
              className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-1.5 mb-6 animate-fadeInUp"
            >
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-orange-400 text-sm font-medium">
                {badgeText}
              </span>
            </div>
          )}

          {/* Title */}
          <h1
            key={`title-${current}`}
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white animate-fadeInUp drop-shadow-lg"
            style={{ animationDelay: '0.1s', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p
              key={`sub-${current}`}
              className="text-lg md:text-xl text-gray-100 mb-8 max-w-2xl animate-fadeInUp drop-shadow-md"
              style={{ animationDelay: '0.2s' }}
            >
              {subtitle}
            </p>
          )}

          {/* CTA Buttons */}
          {(ctaText || cta2Text) && (
            <div
              key={`cta-${current}`}
              className="flex flex-wrap gap-4 mb-12 animate-fadeInUp"
              style={{ animationDelay: '0.3s' }}
            >
              {ctaText && slide.ctaUrl && (
                <Link
                  href={slide.ctaUrl}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-all ${ctaClasses[slide.ctaStyle || 'primary']}`}
                >
                  {ctaText}
                  <svg
                    className="w-5 h-5"
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
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-all ${ctaClasses[slide.cta2Style || 'outline']}`}
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
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl animate-fadeInUp"
            style={{ animationDelay: '0.4s' }}
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md border border-white/10 px-5 py-4 rounded-xl"
              >
                <p className="text-3xl md:text-4xl font-bold text-orange-400">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-300">{stat.label}</p>
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
                      ? 'w-8 bg-orange-500'
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Arrows */}
            <button
              onClick={prev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/50 backdrop-blur rounded-full text-white transition-colors"
              aria-label="Previous slide"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center bg-black/30 hover:bg-black/50 backdrop-blur rounded-full text-white transition-colors"
              aria-label="Next slide"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out both;
        }
      `}</style>
    </section>
  );
}

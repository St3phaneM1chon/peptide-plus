'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  href: string;
  bgGradient: string;
  badge?: string;
}

const slides: Slide[] = [
  {
    id: 1,
    title: 'Peptides de Recherche',
    subtitle: 'Pureté 99%+ Garantie',
    description: 'Peptides de haute qualité pour la recherche scientifique. Certificats d\'analyse disponibles.',
    cta: 'Voir les produits',
    href: '/shop',
    bgGradient: 'from-emerald-900 via-emerald-800 to-neutral-900',
    badge: 'QUALITÉ LABORATOIRE',
  },
  {
    id: 2,
    title: 'Nouveaux GLP-1',
    subtitle: 'Semaglutide • Tirzepatide • Retatrutide',
    description: 'Découvrez notre gamme complète de peptides agonistes GLP-1 pour la recherche métabolique.',
    cta: 'Explorer',
    href: '/category/weight-loss',
    bgGradient: 'from-blue-900 via-blue-800 to-neutral-900',
    badge: 'NOUVEAUTÉS',
  },
  {
    id: 3,
    title: 'Blends Populaires',
    subtitle: 'BPC-157 + TB-500',
    description: 'Combinaisons synergiques pré-mélangées pour une efficacité maximale en recherche.',
    cta: 'Voir les blends',
    href: '/category/peptide-blends',
    bgGradient: 'from-purple-900 via-purple-800 to-neutral-900',
    badge: 'BEST-SELLER',
  },
  {
    id: 4,
    title: 'Livraison Gratuite',
    subtitle: 'Commandes 200$+ au Canada',
    description: 'Expédition rapide et discrète. Suivi complet de votre commande.',
    cta: 'Commander maintenant',
    href: '/shop',
    bgGradient: 'from-amber-900 via-amber-800 to-neutral-900',
    badge: 'OFFRE SPÉCIALE',
  },
];

export default function HeroBanner() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-advance slides
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const slide = slides[currentSlide];

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient} transition-all duration-700`}
      />

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="max-w-2xl">
          {/* Badge */}
          {slide.badge && (
            <span className="inline-block px-4 py-1.5 bg-white/10 backdrop-blur-sm text-white text-xs font-bold tracking-wider rounded-full mb-6 animate-fade-in">
              {slide.badge}
            </span>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 animate-slide-up">
            {slide.title}
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-white/80 font-medium mb-4 animate-slide-up animation-delay-100">
            {slide.subtitle}
          </p>

          {/* Description */}
          <p className="text-lg text-white/60 mb-8 max-w-lg animate-slide-up animation-delay-200">
            {slide.description}
          </p>

          {/* CTA */}
          <Link
            href={slide.href}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-neutral-900 font-semibold rounded-xl hover:bg-neutral-100 transition-colors animate-slide-up animation-delay-300"
          >
            {slide.cta}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors hidden md:block"
        aria-label="Slide précédent"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 transition-colors hidden md:block"
        aria-label="Slide suivant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === currentSlide
                ? 'bg-white w-8'
                : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Aller au slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Styles */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
        }
        .animation-delay-100 {
          animation-delay: 0.1s;
          opacity: 0;
        }
        .animation-delay-200 {
          animation-delay: 0.2s;
          opacity: 0;
        }
        .animation-delay-300 {
          animation-delay: 0.3s;
          opacity: 0;
        }
      `}</style>
    </section>
  );
}

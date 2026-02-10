'use client';

import React from 'react';
import Link from 'next/link';
import { ProductCard, PeptideCalculator, TrustBadges } from '@/components/shop';
import { TrustBadgesHero } from '@/components/shop/TrustBadges';
import { useTranslations } from '@/hooks/useTranslations';
import { 
  getFeaturedProducts, 
  getProductsByType, 
  getDefaultFormat,
  type Product
} from '@/data/products';

// Transform Product to ProductCard props
type ProductCardPropsType = React.ComponentProps<typeof ProductCard>;

function productToCardProps(product: Product): ProductCardPropsType {
  const defaultFormat = getDefaultFormat(product);
  
  // Transform formats for ProductCard - cast to match component's expected type
  const formats = product.formats.map(f => ({
    id: f.id,
    name: f.name,
    nameKey: f.nameKey,
    type: f.type as 'vial_2ml' | 'vial_10ml' | 'cartridge_3ml' | 'cartridge_kit_12' | 'capsule' | 'pack_10' | 'syringe' | 'accessory' | 'powder' | 'gummies' | 'capsules_30' | 'capsules_60' | 'capsules_120' | 'pack_2' | 'pack_5' | 'box_50' | 'box_100' | 'kit' | undefined,
    price: f.price,
    comparePrice: f.comparePrice,
    inStock: f.inStock,
    stockQuantity: f.stockQuantity,
    image: f.image,
  }));

  return {
    id: product.id,
    name: product.name,
    nameKey: product.nameKey,
    slug: product.slug,
    price: defaultFormat?.price || product.price,
    comparePrice: defaultFormat?.comparePrice,
    purity: product.purity,
    avgMass: product.avgMass,
    imageUrl: product.images?.[0]?.url || '/images/products/peptide-default.png',
    category: product.categoryName,
    categoryKey: product.categoryKey,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    inStock: product.formats.some(f => f.inStock),
    formats,
  };
}

// Get products for each section
const featuredProducts = getFeaturedProducts(4).map(productToCardProps);
const peptideProducts = getProductsByType('PEPTIDE', 4).map(productToCardProps);
const supplementProducts = getProductsByType('SUPPLEMENT', 4).map(productToCardProps);
const accessoryProducts = getProductsByType('ACCESSORY', 4).map(productToCardProps);

// Testimonials
const testimonials = [
  {
    quote: "Been using Peptide Plus for a year now. In my opinion, it's the best source in Canada. Quality product everytime and gives me the best results. Also the communication is second to none.",
    author: '@ResearchPro',
    source: 'Verified Buyer',
  },
  {
    quote: "Ordered my kit on the 2nd, received tracking 2 hours later and got my package on the 4th. Remarkable service. I already feel these are better than others I've been using.",
    author: '@LabTester',
    source: 'Verified Buyer',
  },
  {
    quote: "A+ service and communication. Delivery is always quick and packaged safe and sound. I love how they're transparent and also have lab results to back up their batches.",
    author: '@QualityFirst',
    source: 'Verified Buyer',
  },
];

export default function HomePage() {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Lab Background */}
      <section className="relative text-white py-5 md:py-6 overflow-hidden">
        {/* Background Image - Scientists working in laboratory */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1532094349884-543bc11b234d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')`,
          }}
        />
        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/60" />
        
        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
              <span className="text-orange-400 text-sm font-medium">Research Grade Peptides</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white">
              Les meilleurs Peptides de recherche au Canada
            </h1>
            
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl">
              {t('shop.subtitle')}
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 mb-12">
              <Link 
                href="/shop" 
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-orange-500/25"
              >
                {t('shop.viewProducts') || 'View Products'}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link 
                href="/lab-results" 
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
              >
                {t('shop.viewLabResults') || 'Lab Results'}
              </Link>
            </div>
          </div>
          
          {/* Hero Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-5 py-4 rounded-xl">
              <p className="text-3xl md:text-4xl font-bold text-orange-400">99%+</p>
              <p className="text-sm text-gray-300">{t('shop.avgPurity') || 'Purity Guaranteed'}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-5 py-4 rounded-xl">
              <p className="text-3xl md:text-4xl font-bold text-orange-400">500+</p>
              <p className="text-sm text-gray-300">{t('shop.products') || 'Products'}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-5 py-4 rounded-xl">
              <p className="text-3xl md:text-4xl font-bold text-orange-400">24h</p>
              <p className="text-sm text-gray-300">{t('shop.shipping') || 'Fast Shipping'}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-5 py-4 rounded-xl">
              <p className="text-3xl md:text-4xl font-bold text-orange-400">COA</p>
              <p className="text-sm text-gray-300">{t('shop.coaAvailable') || 'Lab Tested'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges Hero */}
      <TrustBadgesHero />

      {/* Section 1: Featured Products (Best Sellers - All Categories) */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold">{t('home.featuredProducts')}</h2>
              <p className="text-neutral-600 mt-1">{t('home.featuredDesc')}</p>
            </div>
            <Link
              href="/shop"
              className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
            >
              {t('shop.viewAll')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
            {featuredProducts.map((product) => (
              <div key={product.id} className="overflow-visible h-full">
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2: Peptides */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold">{t('home.peptidesSection')}</h2>
              <p className="text-neutral-600 mt-1">{t('home.peptidesDesc')}</p>
            </div>
            <Link
              href="/category/peptides"
              className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
            >
              {t('shop.viewAll')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
            {peptideProducts.map((product) => (
              <div key={product.id} className="overflow-visible h-full">
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Supplements */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold">{t('home.supplementsSection')}</h2>
              <p className="text-neutral-600 mt-1">{t('home.supplementsDesc')}</p>
            </div>
            <Link
              href="/category/supplements"
              className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
            >
              {t('shop.viewAll')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
            {supplementProducts.map((product) => (
              <div key={product.id} className="overflow-visible h-full">
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Accessories */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold">{t('home.accessoriesSection')}</h2>
              <p className="text-neutral-600 mt-1">{t('home.accessoriesDesc')}</p>
            </div>
            <Link
              href="/category/accessories"
              className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
            >
              {t('shop.viewAll')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
            {accessoryProducts.map((product) => (
              <div key={product.id} className="overflow-visible h-full">
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">{t('home.aboutTitle')}</h2>
          <p className="text-lg text-neutral-300 leading-relaxed">
            {t('home.aboutText')}
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">{t('home.testimonialsTitle')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
                <div className="text-4xl text-orange-500 mb-4">"</div>
                <p className="text-neutral-700 mb-4 leading-relaxed">
                  {testimonial.quote}
                </p>
                <div className="border-t border-neutral-200 pt-4">
                  <p className="font-bold text-neutral-900">{testimonial.author}</p>
                  <p className="text-sm text-neutral-500">{testimonial.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Peptide Calculator */}
      <section className="py-16">
        <div id="calculator" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-8">{t('home.calculatorTitle')}</h2>
          <PeptideCalculator />
        </div>
      </section>

      {/* Trust Badges Section */}
      <section className="py-12 bg-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TrustBadges variant="horizontal" showAll={true} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t('home.ctaTitle')}</h2>
          <p className="text-neutral-400 mb-8">
            {t('home.ctaText')}
          </p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('shop.shopNow')}
          </Link>
        </div>
      </section>
    </div>
  );
}

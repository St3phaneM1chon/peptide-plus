'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

// Article data
const articles = [
  {
    id: 1,
    slug: 'what-are-peptides',
    title: 'What Are Peptides? A Beginner\'s Guide',
    excerpt: 'Discover the fundamentals of peptides, how they work, and why they\'re important for scientific research.',
    category: 'Education',
    readTime: '5 min read',
    image: '/images/articles/peptides-intro.jpg',
    featured: true,
  },
  {
    id: 2,
    slug: 'how-to-reconstitute-peptides',
    title: 'How to Reconstitute Peptides: Step-by-Step Guide',
    excerpt: 'Learn the proper techniques for reconstituting research peptides with bacteriostatic water.',
    category: 'How-To',
    readTime: '7 min read',
    image: '/images/articles/reconstitution.jpg',
    featured: true,
  },
  {
    id: 3,
    slug: 'peptide-storage-guide',
    title: 'Peptide Storage: Best Practices for Researchers',
    excerpt: 'Proper storage is crucial for maintaining peptide integrity. Learn the optimal conditions.',
    category: 'How-To',
    readTime: '4 min read',
    image: '/images/articles/storage.jpg',
  },
  {
    id: 4,
    slug: 'understanding-coa-documents',
    title: 'Understanding Certificate of Analysis (COA) Documents',
    excerpt: 'Learn how to read and interpret COA documents, including HPLC and MS data.',
    category: 'Education',
    readTime: '6 min read',
    image: '/images/articles/coa.jpg',
  },
  {
    id: 5,
    slug: 'bpc-157-research-overview',
    title: 'BPC-157 Research Overview: What Scientists Have Discovered',
    excerpt: 'A comprehensive look at the research surrounding BPC-157 and its potential applications.',
    category: 'Research',
    readTime: '10 min read',
    image: '/images/articles/bpc157.jpg',
    featured: true,
  },
  {
    id: 6,
    slug: 'glp1-agonists-explained',
    title: 'GLP-1 Agonists Explained: Semaglutide, Tirzepatide & Retatrutide',
    excerpt: 'Understanding the science behind GLP-1 receptor agonists and incretin-based research.',
    category: 'Research',
    readTime: '12 min read',
    image: '/images/articles/glp1.jpg',
  },
  {
    id: 7,
    slug: 'tb500-healing-peptide',
    title: 'TB-500: The Healing Peptide in Research',
    excerpt: 'Explore the research on Thymosin Beta-4 and its role in tissue repair studies.',
    category: 'Research',
    readTime: '8 min read',
    image: '/images/articles/tb500.jpg',
  },
  {
    id: 8,
    slug: 'peptide-calculator-guide',
    title: 'How to Use a Peptide Calculator for Reconstitution',
    excerpt: 'Master the mathematics of peptide reconstitution with our comprehensive calculator guide.',
    category: 'How-To',
    readTime: '5 min read',
    image: '/images/articles/calculator.jpg',
  },
];

const categories = [
  { name: 'All', count: articles.length },
  { name: 'Education', count: articles.filter(a => a.category === 'Education').length },
  { name: 'How-To', count: articles.filter(a => a.category === 'How-To').length },
  { name: 'Research', count: articles.filter(a => a.category === 'Research').length },
];

export default function LearnPage() {
  const { t } = useI18n();
  const featuredArticles = articles.filter(a => a.featured);

  return (
    <div className="min-h-screen bg-[var(--k-bg-base)]">
      {/* Hero */}
      <section className="bg-[var(--k-bg-surface)] text-white py-16 border-b border-[var(--k-border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--k-text-primary)]">
            {t('learn.title') || 'Learning Center'}
          </h1>
          <p className="text-xl text-[var(--k-text-secondary)] max-w-2xl mx-auto">
            {t('learn.subtitle') || 'Your comprehensive resource for peptide research knowledge, guides, and scientific insights.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Featured Articles */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-[var(--k-text-primary)] mb-8 flex items-center gap-3">
            <span className="text-[var(--k-accent-amber)]">⭐</span>
            {t('learn.featured') || 'Featured Articles'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredArticles.map((article) => (
              <Link
                key={article.id}
                href={`/learn/${article.slug}`}
                className="group bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)] shadow-[var(--k-shadow-md)] overflow-hidden hover:shadow-[var(--k-shadow-xl)] hover:border-[var(--k-border-default)] transition-all duration-300"
              >
                <div className="aspect-video bg-[var(--k-accent-indigo-20)] relative">
                  <div className="absolute inset-0 flex items-center justify-center text-white text-6xl opacity-50">
                    📚
                  </div>
                  <div className="absolute top-3 start-3">
                    <span className="px-3 py-1 bg-[var(--k-glass-thick)] backdrop-blur-md text-[var(--k-accent-indigo)] text-xs font-semibold rounded-full border border-[var(--k-border-subtle)]">
                      {article.category}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-[var(--k-text-primary)] mb-2 group-hover:text-[var(--k-accent-indigo)] transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-[var(--k-text-secondary)] text-sm mb-4 line-clamp-2">
                    {article.excerpt}
                  </p>
                  <span className="text-xs text-[var(--k-text-tertiary)]">{article.readTime}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Categories & Articles */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Categories */}
              <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)] shadow-[var(--k-shadow-md)] p-6">
                <h3 className="font-semibold text-[var(--k-text-primary)] mb-4">{t('learn.categories')}</h3>
                <nav className="space-y-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      className="w-full flex items-center justify-between px-4 py-2 text-start text-[var(--k-text-secondary)] hover:bg-[var(--k-glass-thin)] hover:text-[var(--k-accent-indigo)] rounded-lg transition-colors"
                    >
                      <span>{cat.name}</span>
                      <span className="text-xs bg-[var(--k-glass-thin)] text-[var(--k-text-tertiary)] px-2 py-0.5 rounded-full">{cat.count}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Quick Links */}
              <div className="bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)] shadow-[var(--k-shadow-md)] p-6">
                <h3 className="font-semibold text-[var(--k-text-primary)] mb-4">{t('learn.quickLinks')}</h3>
                <nav className="space-y-2">
                  <Link href="/faq" className="flex items-center gap-2 text-[var(--k-text-secondary)] hover:text-[var(--k-accent-indigo)]">
                    <span>❓</span> {t('learn.faq')}
                  </Link>
                  <Link href="/#calculator" className="flex items-center gap-2 text-[var(--k-text-secondary)] hover:text-[var(--k-accent-indigo)]">
                    <span>🧮</span> {t('learn.calculator')}
                  </Link>
                  <Link href="/lab-results" className="flex items-center gap-2 text-[var(--k-text-secondary)] hover:text-[var(--k-accent-indigo)]">
                    <span>🔬</span> {t('learn.labResults')}
                  </Link>
                </nav>
              </div>

              {/* Newsletter CTA */}
              <div className="bg-[var(--k-glass-chromatic)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)] p-6">
                <h3 className="font-semibold text-[var(--k-text-primary)] mb-2">{t('learn.stayUpdated')}</h3>
                <p className="text-sm text-[var(--k-text-secondary)] mb-4">
                  {t('learn.stayUpdatedDesc')}
                </p>
                <button className="w-full py-3 px-4 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white text-sm font-semibold rounded-lg hover:from-[#5558e6] hover:to-[#737de6] transition-colors">
                  {t('learn.subscribe')}
                </button>
              </div>
            </div>
          </aside>

          {/* Article Grid */}
          <div className="lg:col-span-3">
            <h2 className="text-xl font-bold text-[var(--k-text-primary)] mb-6">{t('learn.allArticles')}</h2>
            <div className="space-y-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/learn/${article.slug}`}
                  className="group flex gap-6 bg-[var(--k-glass-regular)] backdrop-blur-xl rounded-xl border border-[var(--k-border-subtle)] shadow-[var(--k-shadow-md)] overflow-hidden hover:shadow-[var(--k-shadow-lg)] hover:border-[var(--k-border-default)] transition-all duration-300"
                >
                  <div className="w-48 h-32 bg-[var(--k-glass-thin)] flex-shrink-0 flex items-center justify-center text-4xl">
                    📄
                  </div>
                  <div className="flex-1 py-4 pe-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-[var(--k-accent-indigo-10)] text-[var(--k-accent-indigo)] text-xs font-medium rounded">
                        {article.category}
                      </span>
                      <span className="text-xs text-[var(--k-text-tertiary)]">{article.readTime}</span>
                    </div>
                    <h3 className="font-bold text-[var(--k-text-primary)] mb-2 group-hover:text-[var(--k-accent-indigo)] transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-[var(--k-text-secondary)] text-sm line-clamp-2">
                      {article.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Free Guide CTA */}
        <section className="mt-16 bg-gradient-to-r from-[#6366f1] to-[#06b6d4] rounded-2xl p-8 md:p-12 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              {t('learn.guideTitle')}
            </h2>
            <p className="text-white/70 mb-6">
              {t('learn.guideDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-3 bg-white text-[#6366f1] font-semibold rounded-lg hover:bg-white/90 transition-colors">
                {t('learn.downloadGuide')}
              </button>
              <Link
                href="/faq"
                className="px-8 py-3 border border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('learn.viewFaq')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

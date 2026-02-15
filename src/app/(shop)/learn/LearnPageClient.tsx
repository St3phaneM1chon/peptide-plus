'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

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
  const { t } = useTranslations();
  const featuredArticles = articles.filter(a => a.featured);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('learn.title') || 'Learning Center'}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('learn.subtitle') || 'Your comprehensive resource for peptide research knowledge, guides, and scientific insights.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Featured Articles */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            <span className="text-orange-500">⭐</span>
            {t('learn.featured') || 'Featured Articles'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredArticles.map((article) => (
              <Link
                key={article.id}
                href={`/learn/${article.slug}`}
                className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                <div className="aspect-video bg-gradient-to-br from-orange-400 to-orange-600 relative">
                  <div className="absolute inset-0 flex items-center justify-center text-white text-6xl opacity-50">
                    📚
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 bg-white/90 text-orange-600 text-xs font-semibold rounded-full">
                      {article.category}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {article.excerpt}
                  </p>
                  <span className="text-xs text-gray-400">{article.readTime}</span>
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
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Categories</h3>
                <nav className="space-y-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      className="w-full flex items-center justify-between px-4 py-2 text-left text-gray-600 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                    >
                      <span>{cat.name}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{cat.count}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Quick Links */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
                <nav className="space-y-2">
                  <Link href="/faq" className="flex items-center gap-2 text-gray-600 hover:text-orange-600">
                    <span>❓</span> FAQ
                  </Link>
                  <Link href="/#calculator" className="flex items-center gap-2 text-gray-600 hover:text-orange-600">
                    <span>🧮</span> Peptide Calculator
                  </Link>
                  <Link href="/lab-results" className="flex items-center gap-2 text-gray-600 hover:text-orange-600">
                    <span>🔬</span> Lab Results
                  </Link>
                </nav>
              </div>

              {/* Newsletter CTA */}
              <div className="bg-orange-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-2">Stay Updated</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Get the latest research insights and exclusive offers.
                </p>
                <button className="w-full py-2 px-4 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors">
                  Subscribe
                </button>
              </div>
            </div>
          </aside>

          {/* Article Grid */}
          <div className="lg:col-span-3">
            <h2 className="text-xl font-bold text-gray-900 mb-6">All Articles</h2>
            <div className="space-y-6">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/learn/${article.slug}`}
                  className="group flex gap-6 bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-300"
                >
                  <div className="w-48 h-32 bg-gradient-to-br from-gray-200 to-gray-300 flex-shrink-0 flex items-center justify-center text-4xl">
                    📄
                  </div>
                  <div className="flex-1 py-4 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded">
                        {article.category}
                      </span>
                      <span className="text-xs text-gray-400">{article.readTime}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {article.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Free Guide CTA */}
        <section className="mt-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 md:p-12 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              📘 The Complete Guide to Peptide Research
            </h2>
            <p className="text-orange-100 mb-6">
              Download our free comprehensive guide covering peptide fundamentals, storage, reconstitution, 
              and research protocols. Perfect for researchers of all experience levels.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors">
                Download Free Guide (PDF)
              </button>
              <Link
                href="/faq"
                className="px-8 py-3 border border-white/50 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                View FAQ
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

'use client';
/**
 * PAGE ACTUALITES / COMMUNIQUES DE PRESSE
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  type: string;
  author: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
  locale: string;
}

const typeColors: Record<string, string> = {
  'Communique': '#3b82f6',
  'Partenariat': '#8b5cf6',
  'Produit': '#22c55e',
  'Recompense': '#f59e0b',
  'Evenement': '#ec4899',
  'Certification': '#06b6d4',
  'news': '#3b82f6',
  'press': '#3b82f6',
  'partnership': '#8b5cf6',
  'product': '#22c55e',
  'award': '#f59e0b',
  'event': '#ec4899',
  'certification': '#06b6d4',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('/api/news');
        const data = await res.json();
        setArticles(data.articles || []);
      } catch (error) {
        console.error('Failed to fetch news:', error);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  const featuredNews = articles.filter(n => n.isFeatured);
  const otherNews = articles.filter(n => !n.isFeatured);

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Actualites</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Communiques de presse, annonces et nouveautes
        </p>
      </section>

      {/* Loading State */}
      {loading && (
        <section style={{ padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
            Chargement des actualites...
          </p>
        </section>
      )}

      {/* Empty State */}
      {!loading && articles.length === 0 && (
        <section style={{ padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
            Aucune actualite disponible pour le moment.
          </p>
        </section>
      )}

      {/* Featured */}
      {!loading && featuredNews.length > 0 && (
        <section style={{ padding: '64px 24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
              A la une
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              {featuredNews.map((item) => (
                <Link
                  key={item.id}
                  href={`/actualites/${item.slug}`}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '32px',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        backgroundColor: typeColors[item.type] || 'var(--gray-500)',
                        color: 'white',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      {item.type}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{formatDate(item.publishedAt)}</span>
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6 }}>
                    {item.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Timeline */}
      {!loading && otherNews.length > 0 && (
        <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
              Toutes les actualites
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {otherNews.map((item) => (
                <Link
                  key={item.id}
                  href={`/actualites/${item.slug}`}
                  style={{
                    display: 'flex',
                    gap: '24px',
                    padding: '24px',
                    backgroundColor: 'var(--gray-50)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ width: '100px', flexShrink: 0 }}>
                    <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{formatDate(item.publishedAt)}</span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', alignItems: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          backgroundColor: typeColors[item.type] || 'var(--gray-500)',
                          color: 'white',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: 600,
                        }}
                      >
                        {item.type}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-500)' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{item.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Press Contact */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Contact presse
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Pour toute demande media, contactez notre equipe de relations publiques.
        </p>
        <p style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
          presse@formationspro.com | 514-555-0199
        </p>
      </section>
    </div>
  );
}

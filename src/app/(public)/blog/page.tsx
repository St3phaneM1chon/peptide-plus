'use client';

/**
 * PAGE BLOG
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

// metadata moved to layout or head for client components

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  readTime: number | null;
  isFeatured: boolean;
  publishedAt: string | null;
  locale: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { locale } = useI18n();

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch(`/api/blog?locale=${locale}`);
        const data = await res.json();
        setPosts(data.posts ?? []);
      } catch (error) {
        console.error('Failed to fetch blog posts:', error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  const featuredPost = posts.find((p) => p.isFeatured) || posts[0] || null;
  const otherPosts = featuredPost
    ? posts.filter((p) => p.id !== featuredPost.id)
    : [];
  const categories = [
    'Tous',
    ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean))),
  ] as string[];

  if (loading) {
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
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Blog</h1>
          <p style={{ fontSize: '18px', opacity: 0.9 }}>
            Conseils, tendances et bonnes pratiques en formation professionnelle
          </p>
        </section>

        {/* Loading state */}
        <section style={{ padding: '64px 24px' }}>
          <div
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              textAlign: 'center',
              padding: '80px 0',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--gray-200)',
                borderTopColor: 'var(--gray-500)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
              Chargement des articles...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </section>
      </div>
    );
  }

  if (posts.length === 0) {
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
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Blog</h1>
          <p style={{ fontSize: '18px', opacity: 0.9 }}>
            Conseils, tendances et bonnes pratiques en formation professionnelle
          </p>
        </section>

        {/* Empty state */}
        <section style={{ padding: '64px 24px' }}>
          <div
            style={{
              maxWidth: '600px',
              margin: '0 auto',
              textAlign: 'center',
              padding: '80px 0',
            }}
          >
            <span style={{ fontSize: '64px', display: 'block', marginBottom: '24px' }}>📝</span>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '12px',
                color: 'var(--gray-500)',
              }}
            >
              Aucun article pour le moment
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
              Revenez bientôt pour découvrir nos prochains articles.
            </p>
          </div>
        </section>

        {/* Newsletter */}
        <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
              Restez informé
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
              Recevez nos derniers articles directement dans votre boîte courriel.
            </p>
            <form style={{ display: 'flex', gap: '12px' }} onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Votre courriel"
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary">
                S&apos;abonner
              </button>
            </form>
          </div>
        </section>
      </div>
    );
  }

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
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Blog</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Conseils, tendances et bonnes pratiques en formation professionnelle
        </p>
      </section>

      {/* Featured Post */}
      {featuredPost && (
        <section style={{ padding: '64px 24px' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Link
              href={`/blog/${featuredPost.slug}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr',
                gap: '48px',
                backgroundColor: 'white',
                borderRadius: '16px',
                overflow: 'hidden',
                textDecoration: 'none',
              }}
            >
              <div
                style={{
                  backgroundColor: 'var(--gray-200)',
                  minHeight: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {featuredPost.imageUrl ? (
                  <img
                    src={featuredPost.imageUrl}
                    alt={featuredPost.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '80px' }}>📚</span>
                )}
              </div>
              <div style={{ padding: '40px 40px 40px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    backgroundColor: 'var(--gray-100)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--gray-500)',
                    marginBottom: '16px',
                    alignSelf: 'flex-start',
                  }}
                >
                  {featuredPost.category}
                </span>
                <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
                  {featuredPost.title}
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '24px' }}>
                  {featuredPost.excerpt}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                  {featuredPost.author} • {formatDate(featuredPost.publishedAt)} • {featuredPost.readTime} min de lecture
                </p>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Categories */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map((cat, i) => (
            <button
              key={cat}
              style={{
                padding: '8px 16px',
                backgroundColor: i === 0 ? 'var(--gray-500)' : 'white',
                color: i === 0 ? 'white' : 'var(--gray-500)',
                border: 'none',
                borderRadius: '20px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Grid */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
            }}
          >
            {otherPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--gray-200)',
                    height: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '48px' }}>📝</span>
                  )}
                </div>
                <div style={{ padding: '24px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      backgroundColor: 'var(--gray-100)',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--gray-500)',
                      marginBottom: '12px',
                    }}
                  >
                    {post.category}
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                    {post.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: '16px' }}>
                    {post.excerpt}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    {formatDate(post.publishedAt)} • {post.readTime} min
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Load more */}
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button className="btn btn-secondary" style={{ padding: '12px 32px' }}>
              Voir plus d&apos;articles
            </button>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Restez informé
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Recevez nos derniers articles directement dans votre boîte courriel.
          </p>
          <form style={{ display: 'flex', gap: '12px' }} onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Votre courriel"
              className="form-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">
              S&apos;abonner
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

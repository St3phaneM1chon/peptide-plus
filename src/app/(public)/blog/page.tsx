/**
 * BLOG LIST PAGE - Server Component for SEO
 *
 * Fetches blog posts server-side so search engines can crawl content.
 * Uses generateMetadata() for dynamic SEO tags.
 */

import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getStaticLocale, createServerTranslator } from '@/i18n/server';
import type { Locale } from '@/i18n/config';
import { withTranslations, DB_SOURCE_LOCALE } from '@/lib/translation';
import { JsonLd } from '@/components/seo/JsonLd';

// ISR: revalidate every 5 minutes (uses getStaticLocale to avoid cookies/headers)
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';
  return {
    title: 'Blog - BioCycle Peptides',
    description:
      'Read the latest articles about research peptides, lab protocols, and scientific discoveries from the BioCycle Peptides team.',
    alternates: {
      canonical: `${siteUrl}/blog`,
    },
    openGraph: {
      title: 'Blog - BioCycle Peptides',
      description:
        'Read the latest articles about research peptides, lab protocols, and scientific discoveries.',
      url: `${siteUrl}/blog`,
      type: 'website',
    },
  };
}

// ---------------------------------------------------------------------------
// Data fetching (server-side)
// ---------------------------------------------------------------------------

interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  readTime: number | null;
  isFeatured: boolean;
  publishedAt: Date | null;
  locale: string;
}

async function getBlogPosts(locale: string): Promise<BlogPostRow[]> {
  let posts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      imageUrl: true,
      author: true,
      category: true,
      readTime: true,
      isFeatured: true,
      publishedAt: true,
      locale: true,
    },
  });

  // Apply translations if needed
  if (locale !== DB_SOURCE_LOCALE) {
    posts = await withTranslations(posts, 'BlogPost', locale);
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Structured data (JSON-LD)
// ---------------------------------------------------------------------------

function blogListSchema(posts: BlogPostRow[]) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'BioCycle Peptides Blog',
    url: `${siteUrl}/blog`,
    description:
      'Research articles, lab protocols, and peptide science from BioCycle Peptides.',
    publisher: {
      '@type': 'Organization',
      name: 'BioCycle Peptides',
      url: siteUrl,
    },
    blogPost: posts.slice(0, 10).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${siteUrl}/blog/${post.slug}`,
      ...(post.imageUrl ? { image: post.imageUrl } : {}),
      datePublished: post.publishedAt?.toISOString(),
      author: {
        '@type': 'Organization',
        name: post.author || 'BioCycle Peptides',
      },
      ...(post.excerpt ? { description: post.excerpt } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | null, locale: string = 'en'): string {
  if (!date) return '';
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page Component (Server Component)
// ---------------------------------------------------------------------------

export default async function BlogPage() {
  const locale = getStaticLocale();

  const t = createServerTranslator(locale as Locale);

  let posts: BlogPostRow[] = [];
  try {
    posts = await getBlogPosts(locale);
  } catch (error: unknown) {
    console.error('Failed to fetch blog posts:', error);
  }

  const featuredPost = posts.find((p) => p.isFeatured) || posts[0] || null;
  const otherPosts = featuredPost
    ? posts.filter((p) => p.id !== featuredPost.id)
    : [];
  const allLabel = t('blog.allCategories') || 'Tous';
  const categories = [
    allLabel,
    ...Array.from(new Set(posts.map((p) => p.category).filter(Boolean))),
  ] as string[];

  // Empty state
  if (posts.length === 0) {
    return (
      <div style={{ backgroundColor: 'var(--gray-100)' }}>
        <JsonLd data={blogListSchema([])} />
        {/* Hero */}
        <section
          style={{
            backgroundColor: 'var(--gray-500)',
            color: 'white',
            padding: '64px 24px',
            textAlign: 'center',
          }}
        >
          <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Blog</h1>
          <p style={{ fontSize: '18px', opacity: 0.9 }}>
            {t('blog.subtitle') || 'Research insights, protocols, and scientific discoveries in peptide research'}
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
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '12px',
                color: 'var(--gray-500)',
              }}
            >
              {t('blog.noArticlesYet') || 'No articles yet'}
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
              {t('blog.comingSoon') || 'Check back soon for upcoming articles.'}
            </p>
          </div>
        </section>

        {/* Newsletter */}
        <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                marginBottom: '16px',
                color: 'var(--gray-500)',
              }}
            >
              {t('blog.stayInformed') || 'Stay Informed'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
              {t('blog.newsletterCta') || 'Receive our latest articles directly in your inbox.'}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      <JsonLd data={blogListSchema(posts)} />

      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 className="font-heading" style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Blog</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          {t('blog.heroSubtitle')}
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
                  position: 'relative',
                  backgroundColor: 'var(--gray-200)',
                  minHeight: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {featuredPost.imageUrl ? (
                  <Image
                    src={featuredPost.imageUrl}
                    alt={featuredPost.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '80px' }} aria-hidden="true">
                    Image
                  </span>
                )}
              </div>
              <div
                style={{
                  padding: '40px 40px 40px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
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
                <h2
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    marginBottom: '16px',
                    color: 'var(--gray-500)',
                  }}
                >
                  {featuredPost.title}
                </h2>
                <p
                  style={{
                    fontSize: '16px',
                    color: 'var(--gray-400)',
                    lineHeight: 1.7,
                    marginBottom: '24px',
                  }}
                >
                  {featuredPost.excerpt}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                  {featuredPost.author} &bull; {formatDate(featuredPost.publishedAt, locale)} &bull;{' '}
                  {featuredPost.readTime} {t('blog.readTime') || 'min de lecture'}
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
            <Link
              key={cat}
              href={i === 0 ? '/blog' : `/blog?category=${encodeURIComponent(cat)}`}
              style={{
                padding: '8px 16px',
                backgroundColor: i === 0 ? 'var(--gray-500)' : 'white',
                color: i === 0 ? 'white' : 'var(--gray-500)',
                border: 'none',
                borderRadius: '20px',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              {cat}
            </Link>
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
                    position: 'relative',
                    backgroundColor: 'var(--gray-200)',
                    height: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {post.imageUrl ? (
                    <Image
                      src={post.imageUrl}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '48px' }} aria-hidden="true">
                      Article
                    </span>
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
                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: 'var(--gray-500)',
                    }}
                  >
                    {post.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--gray-400)',
                      lineHeight: 1.6,
                      marginBottom: '16px',
                    }}
                  >
                    {post.excerpt}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    {formatDate(post.publishedAt, locale)} &bull; {post.readTime} min
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '16px',
              color: 'var(--gray-500)',
            }}
          >
            {t('blog.stayInformed') || 'Restez informé'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            {t('blog.newsletterCta') || 'Recevez nos derniers articles directement dans votre boîte courriel.'}
          </p>
        </div>
      </section>
    </div>
  );
}

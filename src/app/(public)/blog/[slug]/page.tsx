/**
 * BLOG POST DETAIL PAGE - Server Component for SEO
 *
 * Fetches individual blog post server-side for full crawlability.
 * Includes generateMetadata() and JSON-LD structured data.
 */

import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { prisma } from '@/lib/db';
import { getServerLocale } from '@/i18n/server';
import { getTranslatedFields, DB_SOURCE_LOCALE } from '@/lib/translation';
import { JsonLd } from '@/components/seo/JsonLd';

// ISR: revalidate every 5 minutes
export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// Static params for ISR
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true },
    });
    return posts.map((p) => ({ slug: p.slug }));
  } catch (error: unknown) {
    console.error('Failed to generate static params for blog posts:', error instanceof Error ? error.message : error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getBlogPost(slug: string) {
  return prisma.blogPost.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      imageUrl: true,
      author: true,
      category: true,
      tags: true,
      readTime: true,
      isFeatured: true,
      isPublished: true,
      publishedAt: true,
      locale: true,
      metaTitle: true,
      metaDescription: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post || !post.isPublished) {
    return { title: 'Article not found' };
  }

  const locale = await getServerLocale();
  let title = post.metaTitle || post.title;
  let description =
    post.metaDescription || post.excerpt || post.content?.substring(0, 160) || '';

  if (locale !== DB_SOURCE_LOCALE) {
    const translated = await getTranslatedFields('BlogPost', post.id, locale);
    if (translated) {
      title = (translated.metaTitle as string) || (translated.title as string) || title;
      description =
        (translated.metaDescription as string) ||
        (translated.excerpt as string) ||
        description;
    }
  }

  const siteUrl = 'https://biocyclepeptides.com';
  const imageUrl = post.imageUrl
    ? post.imageUrl.startsWith('http')
      ? post.imageUrl
      : `${siteUrl}${post.imageUrl}`
    : `${siteUrl}/api/og?title=${encodeURIComponent(title)}&type=blog`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/blog/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/blog/${slug}`,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

function blogPostSchema(post: {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
}) {
  const siteUrl = 'https://biocyclepeptides.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    url: `${siteUrl}/blog/${post.slug}`,
    ...(post.imageUrl
      ? {
          image: post.imageUrl.startsWith('http')
            ? post.imageUrl
            : `${siteUrl}${post.imageUrl}`,
        }
      : {}),
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString() || post.publishedAt?.toISOString(),
    ...(post.excerpt ? { description: post.excerpt } : {}),
    author: {
      '@type': 'Organization',
      name: post.author || 'BioCycle Peptides',
    },
    publisher: {
      '@type': 'Organization',
      name: 'BioCycle Peptides',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/images/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/blog/${post.slug}`,
    },
  };
}

function breadcrumbSchema(postTitle: string, slug: string) {
  const siteUrl = 'https://biocyclepeptides.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${siteUrl}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: postTitle,
        item: `${siteUrl}/blog/${slug}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page Component (Server Component)
// ---------------------------------------------------------------------------

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post || !post.isPublished) {
    notFound();
  }

  // Apply translations
  const locale = await getServerLocale();
  let title = post.title;
  let excerpt = post.excerpt;
  let content = post.content;

  if (locale !== DB_SOURCE_LOCALE) {
    const translated = await getTranslatedFields('BlogPost', post.id, locale);
    if (translated) {
      title = (translated.title as string) || title;
      excerpt = (translated.excerpt as string) || excerpt;
      content = (translated.content as string) || content;
    }
  }

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      <JsonLd data={blogPostSchema(post)} />
      <JsonLd data={breadcrumbSchema(title, slug)} />

      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <nav style={{ fontSize: '14px', opacity: 0.8, marginBottom: '24px' }}>
          <Link href="/" style={{ color: 'white', textDecoration: 'none' }}>
            Accueil
          </Link>{' '}
          &rsaquo;{' '}
          <Link href="/blog" style={{ color: 'white', textDecoration: 'none' }}>
            Blog
          </Link>{' '}
          &rsaquo; <span>{title}</span>
        </nav>

        {post.category && (
          <span
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {post.category}
          </span>
        )}

        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px', maxWidth: '800px', margin: '0 auto 16px' }}>
          {title}
        </h1>

        <p style={{ fontSize: '14px', opacity: 0.8 }}>
          {post.author && <span>{post.author} &bull; </span>}
          {formatDate(post.publishedAt)}
          {post.readTime && <span> &bull; {post.readTime} min de lecture</span>}
        </p>
      </section>

      {/* Featured image */}
      {post.imageUrl && (
        <div style={{ maxWidth: '900px', margin: '-32px auto 0', padding: '0 24px' }}>
          <img
            src={post.imageUrl}
            alt={title}
            style={{
              width: '100%',
              borderRadius: '16px',
              objectFit: 'cover',
              maxHeight: '400px',
            }}
          />
        </div>
      )}

      {/* Content */}
      <article
        style={{
          maxWidth: '800px',
          margin: '48px auto',
          padding: '0 24px',
        }}
      >
        {excerpt && (
          <p
            style={{
              fontSize: '18px',
              color: 'var(--gray-400)',
              lineHeight: 1.7,
              marginBottom: '32px',
              fontStyle: 'italic',
            }}
          >
            {excerpt}
          </p>
        )}

        {content ? (
          <div
            style={{
              fontSize: '16px',
              lineHeight: 1.8,
              color: 'var(--gray-500)',
            }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'blockquote', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'div', 'sub', 'sup', 'hr'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'style'] }) }}
          />
        ) : (
          <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
            Le contenu de cet article sera bientôt disponible.
          </p>
        )}
      </article>

      {/* Back to blog */}
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <Link
          href="/blog"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
            backgroundColor: 'var(--gray-500)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          &larr; Retour au blog
        </Link>
      </div>
    </div>
  );
}

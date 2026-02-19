/**
 * SITEMAP - Dynamic sitemap generation for SEO
 * Includes: static pages, products, categories, blog posts, learning articles
 */

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';

  // Static pages
  const staticPages = [
    '',
    '/shop',
    '/faq',
    '/learn',
    '/contact',
    '/community',
    '/rewards',
    '/subscriptions',
    '/a-propos',
    '/a-propos/mission',
    '/a-propos/equipe',
    '/a-propos/histoire',
    '/a-propos/valeurs',
    '/a-propos/engagements',
    '/aide',
    '/accessibilite',
    '/mentions-legales/conditions',
    '/mentions-legales/confidentialite',
    '/mentions-legales/cookies',
    '/refund-policy',
    '/shipping-policy',
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? ('daily' as const) : ('weekly' as const),
    priority: path === '' ? 1 : path === '/shop' ? 0.9 : 0.7,
  }));

  // Product pages (dynamic from DB)
  let productPages: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    });
    productPages = products.map((p) => ({
      url: `${baseUrl}/product/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {
    // Database may not be available during build
  }

  // Category pages (dynamic from DB)
  let categoryPages: MetadataRoute.Sitemap = [];
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true, parentId: true },
    });
    categoryPages = categories.map((c) => ({
      url: `${baseUrl}/shop?category=${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: c.parentId ? 0.6 : 0.7,
    }));
  } catch {
    // Database may not be available during build
  }

  // Blog posts
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
    blogPages = blogPosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch {
    // Database may not be available during build
  }

  // Learning articles
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const articles = await prisma.article.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
    articlePages = articles.map((a) => ({
      url: `${baseUrl}/learn/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));
  } catch {
    // Database may not be available during build
  }

  return [...staticPages, ...productPages, ...categoryPages, ...blogPages, ...articlePages];
}

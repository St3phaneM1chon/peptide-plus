/**
 * SITEMAP - Dynamic sitemap generation for SEO
 * Includes: static pages, products, categories, blog posts, learning articles
 */

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';

  // --- Main pages (high traffic, updated often) ---
  const mainPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '',                    changeFrequency: 'daily',   priority: 1.0 },
    { path: '/shop',               changeFrequency: 'daily',   priority: 0.9 },
    { path: '/learn',              changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/faq',                changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/contact',            changeFrequency: 'monthly', priority: 0.8 },
    { path: '/community',          changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/rewards',            changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/subscriptions',      changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/tarifs',             changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/blog',               changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/calculator',         changeFrequency: 'monthly', priority: 0.8 },
    { path: '/lab-results',        changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/videos',             changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/webinars',           changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/catalogue',          changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/bundles',            changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/search',             changeFrequency: 'weekly',  priority: 0.7 },
    { path: '/compare',            changeFrequency: 'monthly', priority: 0.7 },
    { path: '/gift-cards',         changeFrequency: 'monthly', priority: 0.7 },
  ];

  // --- Solutions pages ---
  const solutionPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/solutions',              changeFrequency: 'weekly',  priority: 0.8 },
    { path: '/solutions/cas-usage',    changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/entreprises',  changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/partenaires',  changeFrequency: 'monthly', priority: 0.7 },
    { path: '/solutions/particuliers', changeFrequency: 'monthly', priority: 0.7 },
  ];

  // --- About pages ---
  const aboutPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/a-propos',              changeFrequency: 'monthly', priority: 0.7 },
    { path: '/a-propos/mission',      changeFrequency: 'monthly', priority: 0.6 },
    { path: '/a-propos/equipe',       changeFrequency: 'monthly', priority: 0.6 },
    { path: '/a-propos/histoire',     changeFrequency: 'monthly', priority: 0.6 },
    { path: '/a-propos/valeurs',      changeFrequency: 'monthly', priority: 0.6 },
    { path: '/a-propos/engagements',  changeFrequency: 'monthly', priority: 0.6 },
  ];

  // --- Clients / Testimonials pages ---
  const clientPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/clients',                changeFrequency: 'monthly', priority: 0.6 },
    { path: '/clients/references',     changeFrequency: 'monthly', priority: 0.6 },
    { path: '/clients/temoignages',    changeFrequency: 'monthly', priority: 0.6 },
    { path: '/clients/etudes-de-cas',  changeFrequency: 'monthly', priority: 0.6 },
  ];

  // --- Resources pages ---
  const resourcePages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/ressources/guides',     changeFrequency: 'monthly', priority: 0.6 },
    { path: '/ressources/webinaires', changeFrequency: 'monthly', priority: 0.6 },
  ];

  // --- Corporate / Info pages ---
  const corporatePages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/actualites',   changeFrequency: 'weekly',  priority: 0.6 },
    { path: '/presse',       changeFrequency: 'monthly', priority: 0.5 },
    { path: '/carrieres',    changeFrequency: 'monthly', priority: 0.5 },
    { path: '/demo',         changeFrequency: 'monthly', priority: 0.6 },
    { path: '/aide',         changeFrequency: 'monthly', priority: 0.6 },
    { path: '/securite',     changeFrequency: 'monthly', priority: 0.5 },
    { path: '/plan-du-site', changeFrequency: 'monthly', priority: 0.4 },
  ];

  // --- Legal pages (rarely updated, low priority) ---
  const legalPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/mentions-legales/conditions',       changeFrequency: 'yearly', priority: 0.3 },
    { path: '/mentions-legales/confidentialite',  changeFrequency: 'yearly', priority: 0.3 },
    { path: '/mentions-legales/cookies',          changeFrequency: 'yearly', priority: 0.3 },
    { path: '/refund-policy',                     changeFrequency: 'yearly', priority: 0.3 },
    { path: '/shipping-policy',                   changeFrequency: 'yearly', priority: 0.3 },
    { path: '/accessibilite',                     changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Combine all static pages
  const allStaticEntries = [
    ...mainPages,
    ...solutionPages,
    ...aboutPages,
    ...clientPages,
    ...resourcePages,
    ...corporatePages,
    ...legalPages,
  ];

  const staticPages = allStaticEntries.map((entry) => ({
    url: `${baseUrl}${entry.path}`,
    lastModified: new Date(),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
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

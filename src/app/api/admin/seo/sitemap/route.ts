export const dynamic = 'force-dynamic';

/**
 * Admin SEO Sitemap Generator API
 *
 * POST /api/admin/seo/sitemap
 * Generates a sitemap.xml containing all public pages, products, categories,
 * and blog posts. Returns the XML content (and optionally writes to public/).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { writeFile } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITE_URL = 'https://biocyclepeptides.com';

/** Static public pages that should always appear in the sitemap */
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/shop', priority: '0.9', changefreq: 'daily' },
  { path: '/blog', priority: '0.8', changefreq: 'weekly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/learn', priority: '0.7', changefreq: 'weekly' },
  { path: '/faq', priority: '0.5', changefreq: 'monthly' },
  { path: '/politique-de-confidentialite', priority: '0.3', changefreq: 'yearly' },
  { path: '/conditions-generales', priority: '0.3', changefreq: 'yearly' },
  { path: '/politique-cookies', priority: '0.3', changefreq: 'yearly' },
  { path: '/politique-de-remboursement', priority: '0.3', changefreq: 'yearly' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${
          entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''
        }${entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : ''}${
          entry.priority ? `\n    <priority>${entry.priority}</priority>` : ''
        }
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// ---------------------------------------------------------------------------
// POST /api/admin/seo/sitemap
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (_request: NextRequest, { session }) => {
  try {
    const entries: SitemapEntry[] = [];
    const now = formatDate(new Date());

    // 1. Static pages
    for (const page of STATIC_PAGES) {
      entries.push({
        loc: `${SITE_URL}${page.path}`,
        lastmod: now,
        changefreq: page.changefreq,
        priority: page.priority,
      });
    }

    // 2. Categories
    try {
      const categories = await prisma.category.findMany({
        select: { slug: true, updatedAt: true },
      });
      for (const cat of categories) {
        entries.push({
          loc: `${SITE_URL}/category/${cat.slug}`,
          lastmod: formatDate(cat.updatedAt),
          changefreq: 'weekly',
          priority: '0.7',
        });
      }
    } catch (error) {
      console.error('Sitemap: Error fetching categories:', error);
    }

    // 3. Products
    try {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      });
      for (const product of products) {
        entries.push({
          loc: `${SITE_URL}/product/${product.slug}`,
          lastmod: formatDate(product.updatedAt),
          changefreq: 'weekly',
          priority: '0.8',
        });
      }
    } catch (error) {
      console.error('Sitemap: Error fetching products:', error);
    }

    // 4. Blog posts
    try {
      const blogPosts = await prisma.blogPost.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true, publishedAt: true },
      });
      for (const post of blogPosts) {
        entries.push({
          loc: `${SITE_URL}/blog/${post.slug}`,
          lastmod: formatDate(post.updatedAt || post.publishedAt || new Date()),
          changefreq: 'monthly',
          priority: '0.6',
        });
      }
    } catch (error) {
      console.error('Sitemap: Error fetching blog posts:', error);
    }

    // 5. Learn/Article pages
    try {
      const articles = await prisma.article.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      });
      for (const article of articles) {
        entries.push({
          loc: `${SITE_URL}/learn/${article.slug}`,
          lastmod: formatDate(article.updatedAt),
          changefreq: 'monthly',
          priority: '0.6',
        });
      }
    } catch (error) {
      // Article model may not exist yet - silently skip
      console.warn('Sitemap: Article model not available, skipping');
    }

    // Generate XML
    const xml = buildSitemapXml(entries);

    // Try to write to public/sitemap.xml (best-effort)
    let writtenToFile = false;
    try {
      const publicDir = join(process.cwd(), 'public');
      await writeFile(join(publicDir, 'sitemap.xml'), xml, 'utf-8');
      writtenToFile = true;
    } catch (writeError) {
      console.warn('Sitemap: Could not write to public/sitemap.xml:', writeError);
    }

    // Audit log (fire-and-forget)
    logAdminAction({
      adminUserId: session.user.id,
      action: 'GENERATE_SITEMAP',
      targetType: 'Sitemap',
      targetId: 'sitemap.xml',
      newValue: { totalUrls: entries.length, writtenToFile },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      totalUrls: entries.length,
      writtenToFile,
      xml,
    });
  } catch (error) {
    console.error('Admin sitemap generation error:', error);
    return NextResponse.json(
      { error: 'Error generating sitemap' },
      { status: 500 }
    );
  }
});

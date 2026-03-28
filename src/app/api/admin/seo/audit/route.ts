export const dynamic = 'force-dynamic';

/**
 * Admin SEO Audit API
 * POST - Run SEO audit on a specific page URL (or all published pages)
 * GET  - Get stored audit results
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const auditRequestSchema = z.object({
  pageUrl: z.string().optional(), // If omitted, audit all published pages
}).strict();

// ---------------------------------------------------------------------------
// SEO analysis helpers
// ---------------------------------------------------------------------------

interface SeoIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
}

interface PageMeta {
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  keywords: string;
  hasOgImage: boolean;
  hasCanonical: boolean;
  headingsCount: number;
  imagesWithoutAlt: number;
  hasStructuredData: boolean;
}

function analyzePageSeo(_url: string, meta: PageMeta): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  let score = 100;

  // Title checks
  if (!meta.title || meta.title.trim().length === 0) {
    issues.push({ type: 'title', severity: 'critical', message: 'Missing page title', suggestion: 'Add a descriptive <title> tag (50-60 characters)' });
    score -= 20;
  } else if (meta.titleLength < 30) {
    issues.push({ type: 'title', severity: 'medium', message: `Title too short (${meta.titleLength} chars)`, suggestion: 'Expand title to 50-60 characters for better SEO' });
    score -= 5;
  } else if (meta.titleLength > 60) {
    issues.push({ type: 'title', severity: 'low', message: `Title too long (${meta.titleLength} chars)`, suggestion: 'Shorten title to under 60 characters to avoid truncation in SERPs' });
    score -= 3;
  }

  // Meta description checks
  if (!meta.description || meta.description.trim().length === 0) {
    issues.push({ type: 'description', severity: 'high', message: 'Missing meta description', suggestion: 'Add a compelling meta description (120-160 characters)' });
    score -= 15;
  } else if (meta.descriptionLength < 70) {
    issues.push({ type: 'description', severity: 'medium', message: `Meta description too short (${meta.descriptionLength} chars)`, suggestion: 'Expand description to 120-160 characters' });
    score -= 5;
  } else if (meta.descriptionLength > 160) {
    issues.push({ type: 'description', severity: 'low', message: `Meta description too long (${meta.descriptionLength} chars)`, suggestion: 'Shorten to under 160 characters to avoid SERP truncation' });
    score -= 3;
  }

  // Open Graph checks
  if (!meta.hasOgImage) {
    issues.push({ type: 'og', severity: 'medium', message: 'No Open Graph image set', suggestion: 'Add an og:image for better social media sharing previews' });
    score -= 5;
  }

  // Canonical URL
  if (!meta.hasCanonical) {
    issues.push({ type: 'canonical', severity: 'medium', message: 'No canonical URL defined', suggestion: 'Add a <link rel="canonical"> to prevent duplicate content issues' });
    score -= 5;
  }

  // Headings structure
  if (meta.headingsCount === 0) {
    issues.push({ type: 'headings', severity: 'high', message: 'No heading tags found', suggestion: 'Add at least one H1 tag with target keywords' });
    score -= 10;
  }

  // Image alt text
  if (meta.imagesWithoutAlt > 0) {
    issues.push({ type: 'images', severity: 'medium', message: `${meta.imagesWithoutAlt} image(s) missing alt text`, suggestion: 'Add descriptive alt attributes to all images for accessibility and SEO' });
    score -= Math.min(meta.imagesWithoutAlt * 2, 10);
  }

  // Structured data
  if (!meta.hasStructuredData) {
    issues.push({ type: 'structured_data', severity: 'low', message: 'No structured data (JSON-LD) found', suggestion: 'Add Schema.org structured data to enhance search result appearance' });
    score -= 3;
  }

  // Keywords
  if (!meta.keywords || meta.keywords.trim().length === 0) {
    issues.push({ type: 'keywords', severity: 'low', message: 'No meta keywords defined', suggestion: 'While not heavily weighted by Google, keywords help with internal organization' });
    score -= 2;
  }

  return { score: Math.max(0, score), issues };
}

// ---------------------------------------------------------------------------
// GET /api/admin/seo/audit - Get stored audit results
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const minScore = parseInt(searchParams.get('minScore') || '0', 10);
    const maxScore = parseInt(searchParams.get('maxScore') || '100', 10);
    const sortBy = searchParams.get('sortBy') || 'score';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    const where = {
      score: { gte: minScore, lte: maxScore },
    };

    const [results, total] = await Promise.all([
      prisma.seoAuditResult.findMany({
        where,
        orderBy: sortBy === 'lastAudit' ? { lastAudit: sortOrder } : { score: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.seoAuditResult.count({ where }),
    ]);

    // Summary stats
    const allResults = await prisma.seoAuditResult.findMany({ select: { score: true } });
    const avgScore = allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length)
      : 0;
    const criticalCount = allResults.filter(r => r.score < 50).length;
    const goodCount = allResults.filter(r => r.score >= 80).length;

    return NextResponse.json({
      results,
      total,
      page,
      limit,
      stats: { avgScore, criticalCount, goodCount, totalPages: allResults.length },
    });
  } catch (error) {
    logger.error('SEO audit GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/seo/audit - Run audit on page(s)
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = auditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { pageUrl } = parsed.data;
    let pagesToAudit: Array<{ url: string; title: string; description: string; keywords: string; ogImage: string | null }> = [];

    if (pageUrl) {
      // Single page audit — get metadata from SEO settings
      const setting = await prisma.siteSetting.findFirst({
        where: { module: 'seo', key: { startsWith: 'seo_page_' } },
      });
      let meta = { title: '', description: '', keywords: '', ogImage: null as string | null };
      if (setting) {
        try {
          const parsed = JSON.parse(setting.value);
          meta = { title: parsed.title || '', description: parsed.description || '', keywords: parsed.keywords || '', ogImage: parsed.ogImage || null };
        } catch { /* ignore */ }
      }
      pagesToAudit = [{ url: pageUrl, ...meta }];
    } else {
      // Audit all published pages — gather from articles + products + SEO settings
      const [articles, products, seoSettings] = await Promise.all([
        prisma.article.findMany({ where: { isPublished: true }, select: { slug: true, title: true, metaDescription: true, metaTitle: true, imageUrl: true } }),
        prisma.product.findMany({ where: { isActive: true }, select: { slug: true, name: true, metaTitle: true, metaDescription: true, imageUrl: true } }),
        prisma.siteSetting.findMany({ where: { module: 'seo', key: { startsWith: 'seo_page_' } } }),
      ]);

      for (const article of articles) {
        pagesToAudit.push({
          url: `/blog/${article.slug}`,
          title: article.metaTitle || article.title,
          description: article.metaDescription || '',
          keywords: '',
          ogImage: article.imageUrl || null,
        });
      }

      for (const product of products) {
        pagesToAudit.push({
          url: `/products/${product.slug}`,
          title: product.metaTitle || product.name,
          description: product.metaDescription || '',
          keywords: '',
          ogImage: product.imageUrl || null,
        });
      }

      // Static pages from SEO settings
      for (const setting of seoSettings) {
        try {
          const parsed = JSON.parse(setting.value);
          pagesToAudit.push({
            url: parsed.path || setting.key.replace('seo_page_', '/'),
            title: parsed.title || '',
            description: parsed.description || '',
            keywords: parsed.keywords || '',
            ogImage: parsed.ogImage || null,
          });
        } catch { /* ignore malformed */ }
      }

      // Add known static pages if not already included
      const knownPages = ['/', '/about', '/contact', '/blog', '/products', '/faq'];
      for (const kp of knownPages) {
        if (!pagesToAudit.some(p => p.url === kp)) {
          pagesToAudit.push({ url: kp, title: '', description: '', keywords: '', ogImage: null });
        }
      }
    }

    // Run audit for each page
    const auditResults = [];
    for (const page of pagesToAudit) {
      const meta: PageMeta = {
        title: page.title,
        titleLength: page.title.length,
        description: page.description,
        descriptionLength: page.description.length,
        keywords: page.keywords,
        hasOgImage: !!page.ogImage,
        hasCanonical: true, // Assume Next.js generates canonical
        headingsCount: page.title ? 1 : 0, // Approximation for stored meta
        imagesWithoutAlt: 0,
        hasStructuredData: false, // Default; could be enhanced with actual page fetch
      };

      const { score, issues } = analyzePageSeo(page.url, meta);

      const issuesJson = JSON.parse(JSON.stringify(issues));
      const metadataJson = JSON.parse(JSON.stringify({
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        ogImage: page.ogImage,
      }));

      const result = await prisma.seoAuditResult.upsert({
        where: { tenantId_pageUrl: { tenantId: '', pageUrl: page.url } },
        create: {
          tenantId: '',
          pageUrl: page.url,
          score,
          issues: issuesJson,
          metadata: metadataJson,
          lastAudit: new Date(),
        },
        update: {
          score,
          issues: issuesJson,
          metadata: metadataJson,
          lastAudit: new Date(),
        },
      });

      auditResults.push(result);
    }

    return NextResponse.json({
      success: true,
      audited: auditResults.length,
      results: auditResults,
      averageScore: auditResults.length > 0
        ? Math.round(auditResults.reduce((s, r) => s + r.score, 0) / auditResults.length)
        : 0,
    });
  } catch (error) {
    logger.error('SEO audit POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

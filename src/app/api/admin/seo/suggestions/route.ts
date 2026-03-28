export const dynamic = 'force-dynamic';

/**
 * Admin SEO Suggestions API
 * POST - Generate AI-powered SEO suggestions for a page
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const suggestionsSchema = z.object({
  pageUrl: z.string().min(1),
  currentTitle: z.string().optional().default(''),
  currentDescription: z.string().optional().default(''),
  pageContent: z.string().optional().default(''), // optional body text for context
  type: z.enum(['title', 'description', 'keywords', 'all']).default('all'),
}).strict();

// ---------------------------------------------------------------------------
// SEO suggestion generation (rule-based + template)
// ---------------------------------------------------------------------------

function generateTitleSuggestions(url: string, currentTitle: string): string[] {
  const suggestions: string[] = [];
  const pageName = url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Page';
  const capitalizedPage = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  if (currentTitle.length > 60) {
    suggestions.push(currentTitle.substring(0, 57) + '...');
  }
  if (!currentTitle || currentTitle.length < 30) {
    suggestions.push(`${capitalizedPage} | Attitudes VIP - Trusted Quality`);
    suggestions.push(`${capitalizedPage} - Premium Products | Attitudes VIP`);
    suggestions.push(`Discover ${capitalizedPage} | Attitudes VIP Canada`);
  }
  if (currentTitle && !currentTitle.includes('Attitudes')) {
    suggestions.push(`${currentTitle} | Attitudes VIP`);
  }
  return suggestions.filter(s => s.length <= 60 && s.length >= 30);
}

function generateDescriptionSuggestions(url: string, currentTitle: string, currentDesc: string): string[] {
  const suggestions: string[] = [];
  const pageName = url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'our products';

  if (!currentDesc || currentDesc.length < 70) {
    suggestions.push(
      `Explore ${pageName} at Attitudes VIP. Premium quality, fast Canadian shipping, expert support. Shop now with confidence.`
    );
    suggestions.push(
      `${currentTitle || pageName} - Trusted by thousands of Canadians. Free shipping on orders over $150. Discover our complete range.`
    );
  }
  if (currentDesc && currentDesc.length > 160) {
    suggestions.push(currentDesc.substring(0, 157) + '...');
  }
  suggestions.push(
    `Looking for ${pageName}? Attitudes VIP offers premium products with lab-verified quality. Order now for fast Canadian delivery.`
  );
  return suggestions.filter(s => s.length <= 160 && s.length >= 70);
}

function generateKeywordSuggestions(url: string, currentTitle: string): string[] {
  const segments = url.split('/').filter(Boolean);
  const keywords = new Set<string>();

  for (const segment of segments) {
    const words = segment.replace(/-/g, ' ').split(' ');
    for (const word of words) {
      if (word.length > 2) keywords.add(word.toLowerCase());
    }
  }

  if (currentTitle) {
    const titleWords = currentTitle.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'this', 'that'].includes(word)) {
        keywords.add(word);
      }
    }
  }

  keywords.add('attitudes vip');
  keywords.add('canada');
  keywords.add('premium');

  return [Array.from(keywords).slice(0, 10).join(', ')];
}

// ---------------------------------------------------------------------------
// POST /api/admin/seo/suggestions
// ---------------------------------------------------------------------------
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = suggestionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
    }

    const { pageUrl, currentTitle, currentDescription, type } = parsed.data;

    const result: Record<string, string[]> = {};

    if (type === 'all' || type === 'title') {
      result.titles = generateTitleSuggestions(pageUrl, currentTitle);
    }
    if (type === 'all' || type === 'description') {
      result.descriptions = generateDescriptionSuggestions(pageUrl, currentTitle, currentDescription);
    }
    if (type === 'all' || type === 'keywords') {
      result.keywords = generateKeywordSuggestions(pageUrl, currentTitle);
    }

    // Quick-fix suggestions based on common issues
    const quickFixes: Array<{ field: string; issue: string; fix: string }> = [];

    if (currentTitle.length > 60) {
      quickFixes.push({ field: 'title', issue: 'Title exceeds 60 characters', fix: currentTitle.substring(0, 57) + '...' });
    }
    if (currentTitle.length > 0 && currentTitle.length < 30) {
      quickFixes.push({ field: 'title', issue: 'Title is too short', fix: `${currentTitle} | Attitudes VIP` });
    }
    if (currentDescription.length > 160) {
      quickFixes.push({ field: 'description', issue: 'Description exceeds 160 characters', fix: currentDescription.substring(0, 157) + '...' });
    }
    if (!currentDescription) {
      quickFixes.push({ field: 'description', issue: 'No meta description', fix: result.descriptions?.[0] || '' });
    }

    return NextResponse.json({ suggestions: result, quickFixes });
  } catch (error) {
    logger.error('SEO suggestions error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

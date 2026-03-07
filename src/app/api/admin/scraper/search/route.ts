export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Google Maps Playwright Scraper — Search
 * POST /api/admin/scraper/search
 *
 * Scrapes Google Maps via headless browser. No API key needed.
 * Returns structured results with full details.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { scrapeGoogleMaps } from '@/lib/scraper/google-maps-playwright';

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500).trim(),
  location: z.string().max(200).trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  zoom: z.number().int().min(3).max(21).optional(),
  maxResults: z.number().int().min(1).max(500).optional().default(100),
  crawlWebsites: z.boolean().optional().default(true),
  scrollTimeout: z.number().int().min(5000).max(120000).optional().default(30000),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  try {
    const results = await scrapeGoogleMaps({
      query: parsed.data.query,
      location: parsed.data.location,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      zoom: parsed.data.zoom,
      maxResults: parsed.data.maxResults,
      crawlWebsites: parsed.data.crawlWebsites,
      scrollTimeout: parsed.data.scrollTimeout,
    });

    return apiSuccess(results, { request });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return apiError('Google Maps scrape failed', 'EXTERNAL_SERVICE_ERROR', { status: 502, details: message, request });
  }
}, { rateLimit: 3 });

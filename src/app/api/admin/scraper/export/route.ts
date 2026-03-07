export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Google Maps Playwright Scraper — CSV Export
 * POST /api/admin/scraper/export
 *
 * Scrapes Google Maps via headless browser and exports as CSV.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiError } from '@/lib/api-response';
import { scrapeGoogleMaps } from '@/lib/scraper/google-maps-playwright';
import { generateCSV } from '@/lib/csv-export';

const exportSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500).trim(),
  location: z.string().max(200).trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  zoom: z.number().int().min(3).max(21).optional(),
  maxResults: z.number().int().min(1).max(500).optional().default(100),
  crawlWebsites: z.boolean().optional().default(true),
  scrollTimeout: z.number().int().min(5000).max(120000).optional().default(30000),
});

const CSV_HEADERS = [
  'Nom',
  'Adresse',
  'Ville',
  'Province',
  'Code Postal',
  'Pays',
  'T\u00e9l\u00e9phone',
  'Email',
  'Site Web',
  'Note Google',
  'Avis Google',
  'Cat\u00e9gorie',
  'Latitude',
  'Longitude',
  'Lien Google Maps',
];

export const POST = withAdminGuard(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  const parsed = exportSchema.safeParse(body);
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

    const rows = results.map((place) => [
      place.name,
      place.address || '',
      place.city || '',
      place.province || '',
      place.postalCode || '',
      place.country || '',
      place.phone || '',
      place.email || '',
      place.website || '',
      place.googleRating != null ? String(place.googleRating) : '',
      place.googleReviewCount != null ? String(place.googleReviewCount) : '',
      place.category || '',
      place.latitude != null ? String(place.latitude) : '',
      place.longitude != null ? String(place.longitude) : '',
      place.googleMapsUrl || '',
    ]);

    const csv = generateCSV(CSV_HEADERS, rows);
    const today = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="google-maps-export-${today}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return apiError('Google Maps export failed', 'EXTERNAL_SERVICE_ERROR', { status: 502, details: message, request });
  }
}, { rateLimit: 3 });

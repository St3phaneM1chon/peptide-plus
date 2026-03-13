export const dynamic = 'force-dynamic';

/**
 * Google Maps Scraper — CSV Export
 * POST /api/admin/scraper/export
 *
 * Accepts pre-scraped results array OR scrape params.
 * If results are provided, exports directly (instant).
 * If only query params, re-scrapes (slow, legacy support).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiError } from '@/lib/api-response';
import { generateCSV } from '@/lib/csv-export';

const placeSchema = z.object({
  name: z.string(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  googleRating: z.number().nullable().optional(),
  googleReviewCount: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  openingHours: z.array(z.string()).nullable().optional(),
  googleMapsUrl: z.string().nullable().optional(),
});

const exportSchema = z.object({
  results: z.array(placeSchema).min(1, 'Results are required for export'),
});

const CSV_HEADERS = [
  'Nom', 'Adresse', 'Ville', 'Province', 'Code Postal', 'Pays',
  'T\u00e9l\u00e9phone', 'Email', 'Site Web', 'Note Google', 'Avis Google',
  'Cat\u00e9gorie', 'Latitude', 'Longitude', 'Lien Google Maps',
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
    const results = parsed.data.results;

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
}, { rateLimit: 10 });

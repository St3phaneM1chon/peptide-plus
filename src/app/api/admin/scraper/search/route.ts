export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Google Maps Scraper — Search
 * POST /api/admin/scraper/search
 *
 * Supports:
 *   - Simple point search (latitude/longitude)
 *   - Region search (circle/rectangle/polygon) with automatic polygon decomposition
 *   - Engine selection (playwright or places_api)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { decomposeRegion, type RegionShape } from '@/lib/scraper/polygon-decomposition';
import type { ScrapedPlace } from '@/lib/scraper/google-maps-playwright';

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500).trim(),
  location: z.string().max(200).trim().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.number().optional(),
  zoom: z.number().int().min(3).max(21).optional(),
  maxResults: z.number().int().min(1).max(500).optional().default(100),
  crawlWebsites: z.boolean().optional().default(true),
  scrollTimeout: z.number().int().min(5000).max(120000).optional().default(30000),
  engine: z.enum(['playwright', 'places_api']).optional().default('playwright'),
  region: z.object({
    type: z.enum(['circle', 'rectangle', 'polygon']),
    center: z.object({ lat: z.number(), lng: z.number() }).optional(),
    radius: z.number().optional(),
    bounds: z.object({
      north: z.number(), south: z.number(),
      east: z.number(), west: z.number(),
    }).optional(),
    path: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  }).optional().nullable(),
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
    const data = parsed.data;

    // Build search circles from region (polygon decomposition) or single point
    const searchCircles: Array<{ lat: number; lng: number; radius?: number }> = [];

    if (data.region) {
      const region = data.region;
      let regionShape: RegionShape | null = null;

      if (region.type === 'circle' && region.center && region.radius) {
        regionShape = { type: 'circle', center: region.center, radius: region.radius };
      } else if (region.type === 'rectangle' && region.bounds) {
        regionShape = { type: 'rectangle', bounds: region.bounds };
      } else if (region.type === 'polygon' && region.path && region.path.length >= 3) {
        regionShape = { type: 'polygon', path: region.path };
      }

      if (regionShape) {
        const circles = decomposeRegion(regionShape);
        for (const c of circles) {
          searchCircles.push({ lat: c.center.lat, lng: c.center.lng, radius: c.radius });
        }
      }
    }

    // Fallback: single point search
    if (searchCircles.length === 0) {
      if (data.latitude != null && data.longitude != null) {
        searchCircles.push({ lat: data.latitude, lng: data.longitude, radius: data.radius });
      } else {
        // Location-based (text) or query-only search — single call
        searchCircles.push({} as { lat: number; lng: number; radius?: number });
      }
    }

    // Execute scrape for each circle, dedup results by googleMapsUrl || name+address
    const allResults: ScrapedPlace[] = [];
    const seenKeys = new Set<string>();
    const maxPerCircle = Math.max(20, Math.ceil(data.maxResults / searchCircles.length));

    for (const circle of searchCircles) {
      let circleResults: ScrapedPlace[];

      if (data.engine === 'places_api') {
        const { searchGoogleMaps } = await import('@/lib/scraper/google-maps-standalone');
        circleResults = await searchGoogleMaps({
          query: data.query,
          location: circle.lat ? undefined : data.location,
          latitude: circle.lat || undefined,
          longitude: circle.lng || undefined,
          radius: circle.radius,
          maxResults: maxPerCircle,
          crawlWebsites: data.crawlWebsites,
        });
      } else {
        const { scrapeGoogleMaps } = await import('@/lib/scraper/google-maps-playwright');
        circleResults = await scrapeGoogleMaps({
          query: data.query,
          location: circle.lat ? undefined : data.location,
          latitude: circle.lat || undefined,
          longitude: circle.lng || undefined,
          maxResults: maxPerCircle,
          crawlWebsites: data.crawlWebsites,
          scrollTimeout: data.scrollTimeout,
        });
      }

      // Dedup across circles
      for (const place of circleResults) {
        const key = place.googleMapsUrl || `${place.name?.toLowerCase()}|${place.address?.toLowerCase()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allResults.push(place);
        }
      }

      if (allResults.length >= data.maxResults) break;
    }

    return apiSuccess(allResults.slice(0, data.maxResults), { request });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return apiError('Google Maps scrape failed', 'EXTERNAL_SERVICE_ERROR', { status: 502, details: message, request });
  }
}, { rateLimit: 3 });

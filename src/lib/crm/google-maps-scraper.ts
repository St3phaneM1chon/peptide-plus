/**
 * Google Maps Places Scraper for CRM Prospect Lists
 *
 * Uses Google Places API (Text Search + Place Details) — legal and reliable.
 * Env var: GOOGLE_PLACES_API_KEY
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateListCounters } from './prospect-dedup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  geometry?: { location: { lat: number; lng: number } };
  opening_hours?: { weekday_text?: string[] };
  address_components?: { long_name: string; short_name: string; types: string[] }[];
}

export interface ScrapeOptions {
  query: string;
  location?: string;
  radius?: number; // in meters
  maxResults?: number;
}

export interface ScrapeResult {
  scraped: number;
  duplicates: number;
  added: number;
  prospects: { id: string; contactName: string; googlePlaceId: string }[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY not configured');
  return key;
}

async function searchPlaces(
  query: string,
  pageToken?: string,
): Promise<{ results: PlaceSearchResult[]; nextPageToken?: string }> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({ query, key: apiKey });
  if (pageToken) params.set('pagetoken', pageToken);

  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Places API error: ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API status: ${data.status} - ${data.error_message || ''}`);
  }

  return {
    results: data.results || [],
    nextPageToken: data.next_page_token,
  };
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = getApiKey();
  const fields = 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,geometry,opening_hours,address_components';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 'OK') return null;

  return data.result;
}

// ---------------------------------------------------------------------------
// Main scraper
// ---------------------------------------------------------------------------

/**
 * Search Google Maps and add results as Prospects to a list.
 */
export async function scrapePlacesToProspects(
  listId: string,
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  const maxResults = Math.min(options.maxResults || 60, 60); // Google max = 60 (3 pages × 20)
  const fullQuery = options.location ? `${options.query} near ${options.location}` : options.query;

  let allResults: PlaceSearchResult[] = [];
  let nextPageToken: string | undefined;

  // Fetch up to 3 pages (max 60 results)
  for (let page = 0; page < 3 && allResults.length < maxResults; page++) {
    const { results, nextPageToken: npt } = await searchPlaces(fullQuery, nextPageToken);
    allResults = allResults.concat(results);
    nextPageToken = npt;

    if (!nextPageToken) break;
    // Google requires a short delay before using nextPageToken
    await new Promise((r) => setTimeout(r, 2000));
  }

  allResults = allResults.slice(0, maxResults);

  // Check existing placeIds in this list to skip duplicates
  const existingPlaceIds = new Set(
    (await prisma.prospect.findMany({
      where: { listId, googlePlaceId: { not: null } },
      select: { googlePlaceId: true },
    })).map((p) => p.googlePlaceId),
  );

  let duplicates = 0;
  let added = 0;
  const prospects: { id: string; contactName: string; googlePlaceId: string }[] = [];

  for (const place of allResults) {
    if (existingPlaceIds.has(place.place_id)) {
      duplicates++;
      continue;
    }

    // Get full details
    const details = await getPlaceDetails(place.place_id);
    if (!details) continue;

    const addressParts = parseAddressComponents(details.address_components || []);

    const prospect = await prisma.prospect.create({
      data: {
        listId,
        contactName: details.name,
        companyName: details.name,
        email: null,
        phone: details.formatted_phone_number || details.international_phone_number || null,
        website: details.website || null,
        address: details.formatted_address || null,
        city: addressParts.city,
        province: addressParts.province,
        postalCode: addressParts.postalCode,
        country: addressParts.country,
        googlePlaceId: details.place_id,
        googleRating: details.rating || null,
        googleReviewCount: details.user_ratings_total || null,
        googleCategory: details.types?.[0] || null,
        latitude: details.geometry?.location.lat || null,
        longitude: details.geometry?.location.lng || null,
        openingHours: details.opening_hours?.weekday_text ? { days: details.opening_hours.weekday_text } : undefined,
        status: 'NEW',
      },
    });

    existingPlaceIds.add(details.place_id);
    prospects.push({ id: prospect.id, contactName: prospect.contactName, googlePlaceId: details.place_id });
    added++;
  }

  // Update list metadata
  await prisma.prospectList.update({
    where: { id: listId },
    data: { sourceQuery: fullQuery },
  });
  await updateListCounters(listId);

  logger.info('Google Maps scrape completed', { listId, query: fullQuery, scraped: allResults.length, duplicates, added });

  return { scraped: allResults.length, duplicates, added, prospects };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAddressComponents(components: { long_name: string; short_name: string; types: string[] }[]): {
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
} {
  let city: string | null = null;
  let province: string | null = null;
  let postalCode: string | null = null;
  let country: string | null = null;

  for (const comp of components) {
    if (comp.types.includes('locality')) city = comp.long_name;
    if (comp.types.includes('administrative_area_level_1')) province = comp.short_name;
    if (comp.types.includes('postal_code')) postalCode = comp.long_name;
    if (comp.types.includes('country')) country = comp.short_name;
  }

  return { city, province, postalCode, country };
}

/**
 * Standalone Google Maps Places Scraper
 *
 * Independent from CRM — no Prisma/database dependencies.
 * Uses Google Places API (Text Search + Nearby Search + Place Details).
 *
 * Features:
 *   - Unlimited pagination (nextPageToken loop)
 *   - Nearby Search fallback for sparse results
 *   - Token bucket rate limiter (100 QPM)
 *   - Optional website crawl for email extraction
 *
 * Env var: GOOGLE_PLACES_API_KEY
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScrapedPlace {
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string[] | null;
}

export interface StandaloneSearchOptions {
  query: string;
  location?: string;
  /** Latitude for coordinate-based search (used with longitude + radius) */
  latitude?: number;
  /** Longitude for coordinate-based search (used with latitude + radius) */
  longitude?: number;
  /** Search radius in meters (default 5000, max 50000) */
  radius?: number;
  maxResults?: number;
  crawlWebsites?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
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

// ---------------------------------------------------------------------------
// Rate Limiter (Token Bucket — 100 QPM)
// ---------------------------------------------------------------------------

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(maxPerMinute = 100) {
    this.maxTokens = maxPerMinute;
    this.tokens = maxPerMinute;
    this.lastRefill = Date.now();
    this.refillRate = maxPerMinute / 60000;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise((r) => setTimeout(r, waitMs));
      this.refill();
    }
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

const rateLimiter = new RateLimiter(100);

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
  await rateLimiter.acquire();
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

async function nearbySearch(
  lat: number,
  lng: number,
  radius: number,
  type?: string,
  pageToken?: string,
): Promise<{ results: PlaceSearchResult[]; nextPageToken?: string }> {
  await rateLimiter.acquire();
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    key: apiKey,
  });
  if (type) params.set('type', type);
  if (pageToken) params.set('pagetoken', pageToken);

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Places Nearby API error: ${res.status}`);

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places Nearby API status: ${data.status} - ${data.error_message || ''}`);
  }

  return { results: data.results || [], nextPageToken: data.next_page_token };
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  await rateLimiter.acquire();
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
// Website email extraction
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const GENERIC_PREFIXES = new Set(['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster']);

async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadEngine/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();

    // mailto: links first (highest quality)
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch) {
      const email = mailtoMatch[1].toLowerCase();
      if (!GENERIC_PREFIXES.has(email.split('@')[0])) return email;
    }

    // Regex extraction
    const emails = html.match(EMAIL_REGEX) || [];
    for (const email of emails) {
      const lower = email.toLowerCase();
      const prefix = lower.split('@')[0];
      if (!GENERIC_PREFIXES.has(prefix) && !/\.(png|jpg|gif|svg|css|js)$/i.test(lower)) {
        return lower;
      }
    }
  } catch {
    // Website crawl failed — silently continue
  }
  return null;
}

// ---------------------------------------------------------------------------
// Address parsing
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

// ---------------------------------------------------------------------------
// Main search function (no DB, returns data only)
// ---------------------------------------------------------------------------

export async function searchGoogleMaps(options: StandaloneSearchOptions): Promise<ScrapedPlace[]> {
  const maxResults = options.maxResults || 60;
  const crawlWebsites = options.crawlWebsites ?? true;
  const hasCoordinates = options.latitude != null && options.longitude != null;

  let allResults: PlaceSearchResult[] = [];
  let nextPageToken: string | undefined;
  const seenPlaceIds = new Set<string>();

  // ---- If coordinates provided, use Nearby Search as primary strategy ----
  if (hasCoordinates) {
    const searchRadius = Math.min(options.radius || 5000, 50000);
    const type = undefined; // Let Google decide based on query

    // First: Text Search with location bias (query near coordinates)
    const fullQuery = `${options.query} near ${options.latitude},${options.longitude}`;
    for (let page = 0; allResults.length < maxResults; page++) {
      const { results, nextPageToken: npt } = await searchPlaces(fullQuery, nextPageToken);
      for (const r of results) {
        if (!seenPlaceIds.has(r.place_id)) {
          seenPlaceIds.add(r.place_id);
          allResults.push(r);
        }
      }
      nextPageToken = npt;
      if (!nextPageToken) break;
      const delay = page < 3 ? 2000 : Math.min(2000 + page * 500, 5000);
      await new Promise((r) => setTimeout(r, delay));
    }

    // Then: Nearby Search with the specified radius for more results
    if (allResults.length < maxResults) {
      let nearbyToken: string | undefined;
      for (let np = 0; np < 5 && allResults.length < maxResults; np++) {
        const { results: nearby, nextPageToken: npt } = await nearbySearch(
          options.latitude!, options.longitude!, searchRadius, type, nearbyToken,
        );
        for (const r of nearby) {
          if (!seenPlaceIds.has(r.place_id)) {
            seenPlaceIds.add(r.place_id);
            allResults.push(r);
          }
        }
        nearbyToken = npt;
        if (!nearbyToken) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } else {
    // ---- Standard text-based search ----
    const fullQuery = options.location ? `${options.query} near ${options.location}` : options.query;

    for (let page = 0; allResults.length < maxResults; page++) {
      const { results, nextPageToken: npt } = await searchPlaces(fullQuery, nextPageToken);

      for (const r of results) {
        if (!seenPlaceIds.has(r.place_id)) {
          seenPlaceIds.add(r.place_id);
          allResults.push(r);
        }
      }

      nextPageToken = npt;
      if (!nextPageToken) break;

      // Google requires a delay before using nextPageToken (adaptive: 2-5s)
      const delay = page < 3 ? 2000 : Math.min(2000 + page * 500, 5000);
      await new Promise((r) => setTimeout(r, delay));
    }

    // ---- Nearby Search fallback if < 20 results and we have coordinates ----
    if (allResults.length < 20) {
      const firstResult = allResults[0];
      if (firstResult?.geometry?.location) {
        const { lat, lng } = firstResult.geometry.location;
        const radii = [1000, 5000, 25000]; // Progressive radius
        const firstType = firstResult.types?.[0];

        for (const radius of radii) {
          if (allResults.length >= maxResults) break;

          let nearbyToken: string | undefined;
          for (let np = 0; np < 3; np++) {
            const { results: nearby, nextPageToken: npt } = await nearbySearch(lat, lng, radius, firstType, nearbyToken);

            for (const r of nearby) {
              if (!seenPlaceIds.has(r.place_id)) {
                seenPlaceIds.add(r.place_id);
                allResults.push(r);
              }
            }

            nearbyToken = npt;
            if (!nearbyToken) break;
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }
    }
  }

  allResults = allResults.slice(0, maxResults);

  // ---- Get details + optional email crawl for each result ----
  const places: ScrapedPlace[] = [];

  for (const place of allResults) {
    const details = await getPlaceDetails(place.place_id);
    if (!details) continue;

    const addressParts = parseAddressComponents(details.address_components || []);

    // Optional website crawl for email
    let email: string | null = null;
    if (crawlWebsites && details.website) {
      email = await extractEmailFromWebsite(details.website);
    }

    places.push({
      name: details.name,
      address: details.formatted_address || null,
      city: addressParts.city,
      province: addressParts.province,
      postalCode: addressParts.postalCode,
      country: addressParts.country,
      phone: details.formatted_phone_number || details.international_phone_number || null,
      email,
      website: details.website || null,
      googleRating: details.rating || null,
      googleReviewCount: details.user_ratings_total || null,
      category: details.types?.[0] || null,
      latitude: details.geometry?.location.lat || null,
      longitude: details.geometry?.location.lng || null,
      openingHours: details.opening_hours?.weekday_text || null,
    });
  }

  logger.info('Standalone Google Maps search completed', {
    query: options.query,
    location: hasCoordinates ? `${options.latitude},${options.longitude} r=${options.radius || 5000}` : (options.location || 'none'),
    maxResults,
    crawlWebsites,
    totalFound: allResults.length,
    detailsFetched: places.length,
    emailsFound: places.filter((p) => p.email).length,
  });

  return places;
}

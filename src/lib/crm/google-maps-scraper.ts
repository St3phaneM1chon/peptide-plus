/**
 * Google Maps Playwright Scraper for CRM Prospect Lists
 *
 * Scrapes Google Maps directly via headless browser (no API key needed).
 * - Infinite scroll to collect all results
 * - Clicks each result to extract full details
 * - Website crawl for email extraction
 * - Saves directly to Prospect table in DB
 *
 * Dedup strategy: MERGE, not skip.
 *   - If a prospect already exists: fill in missing fields + update with newer data
 *   - Existing data is preserved if the new scrape has null/empty for that field
 *   - If both have a value and they differ: take the most recent (new scrape wins)
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { updateListCounters } from './prospect-dedup';
import { scrapeGoogleMaps, type ScrapedPlace } from '@/lib/scraper/google-maps-playwright';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeOptions {
  query: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  radius?: number;
  maxResults?: number;
  enableNearbyFallback?: boolean;
  crawlWebsites?: boolean;
  scrollTimeout?: number;
}

export interface ScrapeResult {
  scraped: number;
  duplicates: number;
  updated: number;
  added: number;
  emailsFound: number;
  prospects: { id: string; contactName: string; companyName: string | null }[];
}

// ---------------------------------------------------------------------------
// Main scraper — scrapes Google Maps and saves/merges to DB
// ---------------------------------------------------------------------------

export async function scrapePlacesToProspects(
  listId: string,
  options: ScrapeOptions,
): Promise<ScrapeResult> {
  const maxResults = options.maxResults || 200;
  const crawlWebsites = options.crawlWebsites ?? true;

  // ---- Scrape Google Maps via Playwright ----
  const places = await scrapeGoogleMaps({
    query: options.query,
    location: options.location,
    latitude: options.latitude,
    longitude: options.longitude,
    zoom: options.zoom,
    maxResults,
    crawlWebsites,
    scrollTimeout: options.scrollTimeout ?? 30000,
  });

  // ---- Load ALL existing prospects in this list for dedup matching ----
  const existingProspects = await prisma.prospect.findMany({
    where: { listId },
  });

  // Build a lookup map by dedup key → existing prospect
  const existingByKey = new Map<string, typeof existingProspects[0]>();
  for (const p of existingProspects) {
    existingByKey.set(dedupKey(p.contactName, p.address, p.phone), p);
  }

  let duplicates = 0;
  let updated = 0;
  let added = 0;
  let emailsFound = 0;
  const prospects: { id: string; contactName: string; companyName: string | null }[] = [];

  for (const place of places) {
    const key = dedupKey(place.name, place.address, place.phone);
    const existing = existingByKey.get(key);

    if (existing) {
      // ---- MERGE: complete missing fields, update with newer data ----
      const updates = buildMergeUpdate(existing, place);

      if (Object.keys(updates).length > 0) {
        const updatedProspect = await prisma.prospect.update({
          where: { id: existing.id },
          data: updates,
        });

        updated++;
        if (updates.email && !existing.email) emailsFound++;

        prospects.push({
          id: updatedProspect.id,
          contactName: updatedProspect.contactName,
          companyName: updatedProspect.companyName,
        });

        // Update the map with merged data for subsequent dedup checks
        existingByKey.set(key, updatedProspect);
      }

      duplicates++;
    } else {
      // ---- NEW: create prospect ----
      const prospect = await prisma.prospect.create({
        data: {
          listId,
          contactName: place.name,
          companyName: place.name,
          email: place.email,
          phone: place.phone,
          website: place.website,
          address: place.address,
          city: place.city,
          province: place.province,
          postalCode: place.postalCode,
          country: place.country,
          googleRating: place.googleRating,
          googleReviewCount: place.googleReviewCount,
          googleCategory: place.category,
          latitude: place.latitude,
          longitude: place.longitude,
          openingHours: place.openingHours ? { days: place.openingHours } : undefined,
          enrichmentSource: place.email ? 'website_crawl' : null,
          enrichedAt: place.email ? new Date() : null,
          status: 'NEW',
        },
      });

      if (place.email) emailsFound++;
      existingByKey.set(key, prospect);
      prospects.push({
        id: prospect.id,
        contactName: prospect.contactName,
        companyName: prospect.companyName,
      });
      added++;
    }
  }

  // Update list metadata
  await prisma.prospectList.update({
    where: { id: listId },
    data: {
      sourceQuery: `${options.query}${options.location ? ` near ${options.location}` : ''}`,
    },
  });
  await updateListCounters(listId);

  logger.info('Google Maps Playwright scrape completed', {
    listId,
    query: options.query,
    location: options.location,
    scraped: places.length,
    duplicates,
    updated,
    added,
    emailsFound,
  });

  return { scraped: places.length, duplicates, updated, added, emailsFound, prospects };
}

// ---------------------------------------------------------------------------
// Merge logic: complete missing fields + update with newer data
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMergeUpdate(existing: any, newPlace: ScrapedPlace): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  // For each field: if existing is empty/null and new has data → fill in
  // If both have data and they differ → take new (most recent)
  // If existing has data and new is empty → keep existing (no update)

  mergeStr(updates, 'email', existing.email, newPlace.email);
  mergeStr(updates, 'phone', existing.phone, newPlace.phone);
  mergeStr(updates, 'website', existing.website, newPlace.website);
  mergeStr(updates, 'address', existing.address, newPlace.address);
  mergeStr(updates, 'city', existing.city, newPlace.city);
  mergeStr(updates, 'province', existing.province, newPlace.province);
  mergeStr(updates, 'postalCode', existing.postalCode, newPlace.postalCode);
  mergeStr(updates, 'country', existing.country, newPlace.country);
  mergeStr(updates, 'googleCategory', existing.googleCategory, newPlace.category);

  // Numeric fields: update if new has data
  mergeNum(updates, 'googleRating', existing.googleRating, newPlace.googleRating);
  mergeNum(updates, 'googleReviewCount', existing.googleReviewCount, newPlace.googleReviewCount);
  mergeNum(updates, 'latitude', existing.latitude, newPlace.latitude);
  mergeNum(updates, 'longitude', existing.longitude, newPlace.longitude);

  // Opening hours: update if new has data
  if (newPlace.openingHours && newPlace.openingHours.length > 0) {
    const existingHours = existing.openingHours as { days?: string[] } | null;
    if (!existingHours?.days || existingHours.days.length === 0) {
      updates.openingHours = { days: newPlace.openingHours };
    } else {
      // Both have hours — take the new (most recent scrape)
      const existingStr = JSON.stringify(existingHours.days);
      const newStr = JSON.stringify(newPlace.openingHours);
      if (existingStr !== newStr) {
        updates.openingHours = { days: newPlace.openingHours };
      }
    }
  }

  // If email was just filled in, update enrichment fields
  if (updates.email && !existing.email) {
    updates.enrichmentSource = 'website_crawl';
    updates.enrichedAt = new Date();
  }

  return updates;
}

/** Merge a string field: fill if empty, update if different (new wins) */
function mergeStr(
  updates: Record<string, unknown>,
  field: string,
  existingVal: string | null,
  newVal: string | null,
): void {
  if (!newVal) return; // New has nothing → keep existing
  if (!existingVal) {
    // Existing is empty → fill in
    updates[field] = newVal;
  } else if (existingVal.trim().toLowerCase() !== newVal.trim().toLowerCase()) {
    // Both have values but different → take the most recent (new scrape)
    updates[field] = newVal;
  }
}

/** Merge a numeric field: fill if null, update if different (new wins) */
function mergeNum(
  updates: Record<string, unknown>,
  field: string,
  existingVal: number | null,
  newVal: number | null,
): void {
  if (newVal == null) return; // New has nothing → keep existing
  if (existingVal == null) {
    // Existing is null → fill in
    updates[field] = newVal;
  } else if (existingVal !== newVal) {
    // Both have values but different → take the most recent
    updates[field] = newVal;
  }
}

// ---------------------------------------------------------------------------
// Dedup key helper
// ---------------------------------------------------------------------------

function dedupKey(name: string, address: string | null, phone: string | null): string {
  const n = name.toLowerCase().trim();
  const a = (address || '').toLowerCase().trim().slice(0, 50);
  const p = (phone || '').replace(/\D/g, '').slice(-10);
  return `${n}|${a}|${p}`;
}

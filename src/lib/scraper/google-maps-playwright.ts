/**
 * Google Maps Playwright Scraper
 *
 * Scrapes Google Maps directly via headless browser (no API key needed).
 * Strategy:
 *   1. Search on Google Maps
 *   2. Scroll the infinite list to collect all result links
 *   3. Visit each place URL directly to extract full details
 *   4. Optional website crawl for email extraction
 *
 * Used by both standalone scraper page and CRM prospect lists.
 */

import { chromium, Browser, Page } from 'playwright';
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
  googleMapsUrl: string | null;
}

export interface PlaywrightSearchOptions {
  query: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  maxResults?: number;
  crawlWebsites?: boolean;
  scrollTimeout?: number;
}

// ---------------------------------------------------------------------------
// Email extraction
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const GENERIC_PREFIXES = new Set([
  'noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster',
  'webmaster', 'admin', 'info', 'support', 'contact', 'sales',
]);

async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadEngine/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();

    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch) {
      const email = mailtoMatch[1].toLowerCase();
      if (!GENERIC_PREFIXES.has(email.split('@')[0])) return email;
    }

    const emails = html.match(EMAIL_REGEX) || [];
    for (const email of emails) {
      const lower = email.toLowerCase();
      const prefix = lower.split('@')[0];
      if (!GENERIC_PREFIXES.has(prefix) && !/\.(png|jpg|gif|svg|css|js)$/i.test(lower)) {
        return lower;
      }
    }
  } catch {
    // Silently continue
  }
  return null;
}

// ---------------------------------------------------------------------------
// Address parsing from Google Maps formatted address
// ---------------------------------------------------------------------------

function parseFormattedAddress(address: string | null): {
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
} {
  if (!address) return { city: null, province: null, postalCode: null, country: null };

  const parts = address.split(',').map((p) => p.trim());
  let city: string | null = null;
  let province: string | null = null;
  let postalCode: string | null = null;
  let country: string | null = null;

  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.length <= 30) country = lastPart;

    const secondLast = parts[parts.length - 2];
    const provPostalMatch = secondLast.match(/^([A-Z]{2})\s+(.+)$/);
    if (provPostalMatch) {
      province = provPostalMatch[1];
      postalCode = provPostalMatch[2];
    } else {
      province = secondLast;
    }

    if (parts.length >= 4) {
      city = parts[parts.length - 3];
    } else {
      city = parts.length >= 2 ? parts[parts.length - 2] : null;
    }
  } else if (parts.length === 2) {
    city = parts[0];
    country = parts[1];
  }

  return { city, province, postalCode, country };
}

// ---------------------------------------------------------------------------
// Coordinates extraction from URL
// ---------------------------------------------------------------------------

function extractCoordsFromUrl(url: string): { lat: number | null; lng: number | null } {
  // Try !3d and !4d format first (more precise place coords)
  const preciseMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (preciseMatch) {
    return { lat: parseFloat(preciseMatch[1]), lng: parseFloat(preciseMatch[2]) };
  }
  // Fallback to /@lat,lng format
  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return { lat: null, lng: null };
}

// ---------------------------------------------------------------------------
// Collected place reference (from the list scroll phase)
// ---------------------------------------------------------------------------

interface PlaceRef {
  name: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Main scraper
// ---------------------------------------------------------------------------

export async function scrapeGoogleMaps(options: PlaywrightSearchOptions): Promise<ScrapedPlace[]> {
  const maxResults = options.maxResults ?? 100;
  const crawlWebsites = options.crawlWebsites ?? true;
  const scrollTimeout = options.scrollTimeout ?? 30000;
  const zoom = options.zoom ?? 13;

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      locale: 'fr-CA',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    // ---- Build search URL ----
    let searchUrl: string;
    if (options.latitude != null && options.longitude != null) {
      const q = encodeURIComponent(options.query);
      searchUrl = `https://www.google.com/maps/search/${q}/@${options.latitude},${options.longitude},${zoom}z`;
    } else if (options.location) {
      const q = encodeURIComponent(`${options.query} ${options.location}`);
      searchUrl = `https://www.google.com/maps/search/${q}`;
    } else {
      const q = encodeURIComponent(options.query);
      searchUrl = `https://www.google.com/maps/search/${q}`;
    }

    logger.info('Playwright scraper: navigating', { searchUrl });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Accept cookies
    try {
      const btn = page.locator('button:has-text("Tout accepter"), button:has-text("Accept all")');
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
        await page.waitForTimeout(1000);
      }
    } catch {}

    await page.waitForTimeout(2000);

    // ---- Check for results feed ----
    const feedSelector = 'div[role="feed"]';
    let hasFeed = false;
    try {
      await page.waitForSelector(feedSelector, { timeout: 10000 });
      hasFeed = true;
    } catch {
      logger.warn('Playwright scraper: no feed found');
    }

    if (!hasFeed) {
      const single = await scrapePlaceFromPage(page, crawlWebsites);
      if (single) return [single];
      return [];
    }

    // ==================================================================
    // PHASE 1: Scroll the list and collect all place links
    // ==================================================================
    logger.info('Playwright scraper: scrolling to collect links...', { maxResults, scrollTimeout });
    const placeRefs = await scrollAndCollectLinks(page, feedSelector, maxResults, scrollTimeout);
    logger.info(`Playwright scraper: collected ${placeRefs.length} place links`);

    // ==================================================================
    // PHASE 2: Visit each place URL and scrape details
    // ==================================================================
    const places: ScrapedPlace[] = [];

    for (let i = 0; i < placeRefs.length; i++) {
      if (maxResults > 0 && places.length >= maxResults) break;

      const ref = placeRefs[i];
      try {
        await page.goto(ref.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500);

        const place = await scrapePlaceFromPage(page, crawlWebsites, ref.name);
        if (place) {
          places.push(place);
          logger.info(`Playwright scraper: scraped ${places.length}/${placeRefs.length} - ${place.name}`);
        }
      } catch (err) {
        logger.warn(`Playwright scraper: failed to scrape "${ref.name}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('Playwright scraper: completed', {
      query: options.query,
      location: options.location || `${options.latitude},${options.longitude}`,
      totalFound: placeRefs.length,
      detailsScraped: places.length,
      emailsFound: places.filter((p) => p.email).length,
    });

    return places;
  } catch (err) {
    logger.error('Playwright scraper: fatal error', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 1: Scroll and collect all place links from the feed
// ---------------------------------------------------------------------------

async function scrollAndCollectLinks(
  page: Page,
  feedSelector: string,
  maxResults: number,
  scrollTimeout: number,
): Promise<PlaceRef[]> {
  const startTime = Date.now();
  let lastCount = 0;
  let staleCount = 0;
  const MAX_STALE = 5;

  while (true) {
    const currentCount = await page.locator(`${feedSelector} a[href*="/maps/place/"]`).count();

    if (maxResults > 0 && currentCount >= maxResults) break;
    if (Date.now() - startTime > scrollTimeout) break;

    if (currentCount === lastCount) {
      staleCount++;
      if (staleCount >= MAX_STALE) break;
    } else {
      staleCount = 0;
    }
    lastCount = currentCount;

    // Check end of list
    const endOfList = await page.locator('span:has-text("Vous êtes arrivé"), span:has-text("You\'ve reached the end")').isVisible().catch(() => false);
    if (endOfList) break;

    // Scroll feed
    await page.evaluate((sel) => {
      const feed = document.querySelector(sel);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);

    await page.waitForTimeout(1500);
  }

  // Collect all links
  const links = page.locator(`${feedSelector} a[href*="/maps/place/"]`);
  const count = await links.count();
  const limit = maxResults > 0 ? Math.min(count, maxResults) : count;

  const refs: PlaceRef[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < limit; i++) {
    const link = links.nth(i);
    const name = (await link.getAttribute('aria-label'))?.trim() || '';
    const href = (await link.getAttribute('href')) || '';

    if (name && href && !seenNames.has(name)) {
      seenNames.add(name);
      refs.push({ name, href: href.startsWith('http') ? href : `https://www.google.com${href}` });
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Phase 2: Scrape a single place page
// ---------------------------------------------------------------------------

async function scrapePlaceFromPage(
  page: Page,
  crawlWebsites: boolean,
  fallbackName?: string,
): Promise<ScrapedPlace | null> {
  // Wait for detail content
  try {
    await page.waitForSelector('button[data-item-id="address"], h1.fontHeadlineLarge, div.fontHeadlineLarge', { timeout: 5000 });
  } catch {
    await page.waitForTimeout(1000);
  }

  const data = await page.evaluate(() => {
    const result: Record<string, string | null> = {};

    // Name from h1
    const h1 = document.querySelector('h1.fontHeadlineLarge, div.fontHeadlineLarge, h1');
    result.name = h1?.textContent?.trim() || null;

    // Rating
    const ratingEl = document.querySelector('div.fontBodyMedium span[aria-hidden="true"]');
    result.rating = ratingEl?.textContent?.trim() || null;

    // Review count
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent?.trim() || '';
      const match = text.match(/^\((\d[\d\s,.]*)\)$/);
      if (match) {
        result.reviewCount = match[1].replace(/[\s.]/g, '').replace(',', '');
        break;
      }
    }
    if (!result.reviewCount) {
      const reviewBtn = document.querySelector('button[aria-label*="avis"], button[aria-label*="review"]');
      const label = reviewBtn?.getAttribute('aria-label') || '';
      const m = label.match(/(\d[\d\s,.]*)/);
      if (m) result.reviewCount = m[1].replace(/[\s.]/g, '').replace(',', '');
    }

    // Category
    const catEl = document.querySelector('button[jsaction*="category"]');
    result.category = catEl?.textContent?.trim() || null;

    // Address
    const addrBtn = document.querySelector('button[data-item-id="address"]');
    if (addrBtn) {
      const label = addrBtn.getAttribute('aria-label') || '';
      result.address = label.replace(/^Adresse\s*:\s*/i, '').replace(/^Address\s*:\s*/i, '').trim() || addrBtn.textContent?.trim() || null;
    }

    // Phone (exclude "Envoyer au téléphone" button)
    const phoneBtns = document.querySelectorAll('button[data-item-id*="phone"]');
    for (const btn of phoneBtns) {
      const label = btn.getAttribute('aria-label') || '';
      if (label.includes('Envoyer') || label.includes('Send')) continue;
      const phoneMatch = label.match(/[:]\s*(.+)/);
      result.phone = phoneMatch ? phoneMatch[1].trim() : btn.textContent?.trim() || null;
      break;
    }

    // Website
    const webLink = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null;
    result.website = webLink?.href || null;

    // Hours
    const hoursBtn = document.querySelector('button[data-item-id*="oh"], button[aria-label*="heure"], button[aria-label*="hour"]');
    if (hoursBtn) {
      result.hours = hoursBtn.getAttribute('aria-label') || hoursBtn.textContent?.trim() || null;
    }

    return result;
  });

  const name = data.name && data.name !== 'Résultats' ? data.name : (fallbackName || null);
  if (!name) return null;

  const url = page.url();
  const coords = extractCoordsFromUrl(url);
  const addressParts = parseFormattedAddress(data.address);

  let googleRating: number | null = null;
  if (data.rating) {
    const n = parseFloat(data.rating.replace(',', '.'));
    if (!isNaN(n)) googleRating = n;
  }

  let googleReviewCount: number | null = null;
  if (data.reviewCount) {
    const n = parseInt(data.reviewCount.replace(/[.,\s]/g, ''), 10);
    if (!isNaN(n)) googleReviewCount = n;
  }

  let openingHours: string[] | null = null;
  if (data.hours) {
    openingHours = data.hours.split(';').map((h) => h.trim()).filter(Boolean);
    if (openingHours.length === 0) openingHours = [data.hours];
  }

  let email: string | null = null;
  if (crawlWebsites && data.website) {
    const websiteUrl = data.website.startsWith('http') ? data.website : `https://${data.website}`;
    email = await extractEmailFromWebsite(websiteUrl);
  }

  return {
    name,
    address: data.address,
    city: addressParts.city,
    province: addressParts.province,
    postalCode: addressParts.postalCode,
    country: addressParts.country,
    phone: data.phone,
    email,
    website: data.website,
    googleRating,
    googleReviewCount,
    category: data.category,
    latitude: coords.lat,
    longitude: coords.lng,
    openingHours,
    googleMapsUrl: url,
  };
}

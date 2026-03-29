/**
 * Stock Photo API — Unsplash + Pexels integration
 *
 * Free APIs for searching professional photos directly in the page builder.
 * - Unsplash: 50 req/hour (demo), unlimited with key
 * - Pexels: 200 req/month (demo), unlimited with key
 */

export interface StockPhoto {
  id: string;
  url: string;       // Full size
  thumbUrl: string;   // Thumbnail
  width: number;
  height: number;
  alt: string;
  photographer: string;
  source: 'unsplash' | 'pexels';
  sourceUrl: string;  // Attribution link
}

/**
 * Search photos from Unsplash
 */
async function searchUnsplash(query: string, page = 1, perPage = 20): Promise<StockPhoto[]> {
  const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: { id: string; urls: { regular: string; small: string }; width: number; height: number; alt_description: string; user: { name: string }; links: { html: string } }) => ({
      id: `unsplash_${p.id}`,
      url: p.urls.regular,
      thumbUrl: p.urls.small,
      width: p.width,
      height: p.height,
      alt: p.alt_description || query,
      photographer: p.user.name,
      source: 'unsplash' as const,
      sourceUrl: p.links.html,
    }));
  } catch {
    return [];
  }
}

/**
 * Search photos from Pexels
 */
async function searchPexels(query: string, page = 1, perPage = 20): Promise<StockPhoto[]> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY || process.env.PEXELS_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=landscape`,
      { headers: { Authorization: key } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: { id: number; src: { large2x: string; medium: string }; width: number; height: number; alt: string; photographer: string; url: string }) => ({
      id: `pexels_${p.id}`,
      url: p.src.large2x,
      thumbUrl: p.src.medium,
      width: p.width,
      height: p.height,
      alt: p.alt || query,
      photographer: p.photographer,
      source: 'pexels' as const,
      sourceUrl: p.url,
    }));
  } catch {
    return [];
  }
}

/**
 * Search both Unsplash and Pexels in parallel
 */
export async function searchStockPhotos(
  query: string,
  page = 1,
  perPage = 12
): Promise<StockPhoto[]> {
  const [unsplash, pexels] = await Promise.allSettled([
    searchUnsplash(query, page, perPage),
    searchPexels(query, page, perPage),
  ]);

  const results: StockPhoto[] = [];
  if (unsplash.status === 'fulfilled') results.push(...unsplash.value);
  if (pexels.status === 'fulfilled') results.push(...pexels.value);

  // Fisher-Yates shuffle to interleave results from both sources
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }
  return results;
}

/**
 * Get curated/trending photos (no search query)
 */
export async function getTrendingPhotos(perPage = 12): Promise<StockPhoto[]> {
  return searchStockPhotos('business professional modern', 1, perPage);
}

/**
 * Industry-specific photo suggestions
 */
export const INDUSTRY_PHOTO_QUERIES: Record<string, string[]> = {
  restaurant: ['restaurant interior', 'food plating', 'chef cooking', 'dining table'],
  ecommerce: ['online shopping', 'product photography', 'delivery package', 'happy customer'],
  business: ['modern office', 'team meeting', 'business handshake', 'presentation'],
  portfolio: ['creative workspace', 'design mockup', 'art studio', 'laptop desk'],
  fitness: ['gym workout', 'personal training', 'yoga class', 'healthy food'],
  education: ['classroom learning', 'students studying', 'online education', 'graduation'],
  realestate: ['modern house', 'apartment interior', 'kitchen design', 'living room'],
  medical: ['doctor patient', 'medical office', 'healthcare team', 'clinic waiting room'],
  beauty: ['hair salon', 'spa treatment', 'beauty products', 'skincare routine'],
  construction: ['construction site', 'architecture building', 'renovation project', 'blueprints'],
};

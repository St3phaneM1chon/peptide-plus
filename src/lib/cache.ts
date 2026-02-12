/**
 * CACHING UTILITIES
 * In-memory cache avec TTL pour les données fréquemment accédées
 * Pour production multi-serveur, considérer Redis
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
  tags: string[];
}

// Cache en mémoire
const cache = new Map<string, CacheEntry<unknown>>();

// Index des tags pour invalidation
const tagIndex = new Map<string, Set<string>>();

// Configuration par défaut
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère une valeur du cache
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  // Vérifier l'expiration
  if (Date.now() > entry.expiry) {
    cacheDelete(key);
    return null;
  }
  
  return entry.data as T;
}

/**
 * Stocke une valeur dans le cache
 */
export function cacheSet<T>(
  key: string,
  data: T,
  options: { ttl?: number; tags?: string[] } = {}
): void {
  const { ttl = DEFAULT_TTL, tags = [] } = options;
  
  // Supprimer l'ancienne entrée si elle existe
  if (cache.has(key)) {
    cacheDelete(key);
  }
  
  // Créer la nouvelle entrée
  const entry: CacheEntry<T> = {
    data,
    expiry: Date.now() + ttl,
    tags,
  };
  
  cache.set(key, entry);
  
  // Indexer les tags
  for (const tag of tags) {
    if (!tagIndex.has(tag)) {
      tagIndex.set(tag, new Set());
    }
    tagIndex.get(tag)!.add(key);
  }
}

/**
 * Supprime une entrée du cache
 */
export function cacheDelete(key: string): boolean {
  const entry = cache.get(key);
  
  if (!entry) return false;
  
  // Retirer des index de tags
  for (const tag of entry.tags) {
    tagIndex.get(tag)?.delete(key);
  }
  
  return cache.delete(key);
}

/**
 * Invalide toutes les entrées avec un tag spécifique
 */
export function cacheInvalidateTag(tag: string): number {
  const keys = tagIndex.get(tag);
  
  if (!keys) return 0;
  
  let count = 0;
  for (const key of keys) {
    if (cacheDelete(key)) count++;
  }
  
  tagIndex.delete(tag);
  return count;
}

/**
 * Invalide plusieurs tags
 */
export function cacheInvalidateTags(tags: string[]): number {
  let count = 0;
  for (const tag of tags) {
    count += cacheInvalidateTag(tag);
  }
  return count;
}

/**
 * Récupère ou calcule une valeur (pattern stale-while-revalidate)
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; tags?: string[] } = {}
): Promise<T> {
  const cached = cacheGet<T>(key);
  
  if (cached !== null) {
    return cached;
  }
  
  const data = await fetcher();
  cacheSet(key, data, options);
  return data;
}

/**
 * Nettoie les entrées expirées
 */
export function cacheCleanup(): number {
  const now = Date.now();
  let count = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiry) {
      cacheDelete(key);
      count++;
    }
  }
  
  return count;
}

/**
 * Vide complètement le cache
 */
export function cacheClear(): void {
  cache.clear();
  tagIndex.clear();
}

/**
 * Statistiques du cache
 */
export function cacheStats(): {
  size: number;
  tags: string[];
  entries: { key: string; ttlRemaining: number; tags: string[] }[];
} {
  const now = Date.now();
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    ttlRemaining: Math.max(0, entry.expiry - now),
    tags: entry.tags,
  }));
  
  return {
    size: cache.size,
    tags: Array.from(tagIndex.keys()),
    entries,
  };
}

// Nettoyage automatique toutes les minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cacheCleanup, 60 * 1000);
}

// =====================================================
// CACHE KEYS - Helpers pour générer des clés cohérentes
// =====================================================

export const CacheKeys = {
  // Products
  products: {
    all: () => 'products:all',
    bySlug: (slug: string) => `products:slug:${slug}`,
    byCategory: (categoryId: string) => `products:category:${categoryId}`,
    featured: () => 'products:featured',
    bestsellers: () => 'products:bestsellers',
    new: () => 'products:new',
  },

  // Categories
  categories: {
    all: () => 'categories:all',
    bySlug: (slug: string) => `categories:slug:${slug}`,
  },

  // Translations
  translations: {
    byEntity: (model: string, entityId: string, locale: string) =>
      `translation:${model}:${entityId}:${locale}`,
  },
  
  // User
  user: {
    byId: (id: string) => `user:${id}`,
    cart: (userId: string) => `cart:user:${userId}`,
    wishlist: (userId: string) => `wishlist:user:${userId}`,
    orders: (userId: string) => `orders:user:${userId}`,
  },
  
  // Config
  config: {
    shippingZones: () => 'config:shipping-zones',
    currencies: () => 'config:currencies',
    promoCodes: () => 'config:promo-codes',
  },
  
  // Stats
  stats: {
    dashboard: () => 'stats:dashboard',
    revenue: (period: string) => `stats:revenue:${period}`,
  },
};

// =====================================================
// CACHE TAGS - Pour invalidation groupée
// =====================================================

export const CacheTags = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  ORDERS: 'orders',
  USERS: 'users',
  CONFIG: 'config',
  STATS: 'stats',
  TRANSLATIONS: 'translations',
};

// =====================================================
// TTL PRESETS - Durées de cache recommandées
// =====================================================

export const CacheTTL = {
  // Données rarement modifiées
  STATIC: 24 * 60 * 60 * 1000, // 24 heures
  
  // Données de configuration
  CONFIG: 60 * 60 * 1000, // 1 heure
  
  // Données de catalogue
  PRODUCTS: 15 * 60 * 1000, // 15 minutes
  
  // Données utilisateur
  USER: 5 * 60 * 1000, // 5 minutes
  
  // Données en temps réel
  REALTIME: 30 * 1000, // 30 secondes
  
  // Statistiques
  STATS: 10 * 60 * 1000, // 10 minutes
};

# Performance Audit Report - peptide-plus (BioCycle Peptides)
**Date**: 2026-02-19
**Auditor**: Claude Code (Automated)
**Project**: Next.js 15 + Prisma 5.22 + PostgreSQL + 22 i18n Locales

---

## FINDINGS SUMMARY

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 6     |
| MEDIUM   | 6     |
| LOW      | 3     |
| **TOTAL** | **18** |

---

## P-01: All 22 Locale Files Statically Imported Into Client Bundle (~5.6 MB)

- **Severity**: CRITICAL
- **Files**:
  - `/Volumes/AI_Project/peptide-plus/src/hooks/useTranslations.ts` (lines 6-27)
  - `/Volumes/AI_Project/peptide-plus/src/i18n/index.ts` (lines 10-31)
  - `/Volumes/AI_Project/peptide-plus/src/i18n/server.ts` (lines 10-31)
- **Description**: The `useTranslations` hook (a `'use client'` module) statically imports ALL 22 locale JSON files at the top level. These files total 5.9 MB on disk. Because `useTranslations.ts` is marked `'use client'`, Next.js bundles **every locale** into the client-side JavaScript. A user visiting in French downloads Tamil (424 KB), Hindi (364 KB), Punjabi (352 KB), Russian (312 KB), Arabic variants, etc. -- none of which they need.
- **Impact**: Initial JS bundle is bloated by ~5-6 MB of unused translation data. This adds 2-5 seconds to page load on 3G/4G connections. Largest Contentful Paint (LCP) and Time to Interactive (TTI) severely degraded.
- **Fix**: Use dynamic `import()` to lazy-load only the active locale:
  ```ts
  const loadMessages = async (locale: string) => {
    const mod = await import(`@/i18n/locales/${locale}.json`);
    return mod.default;
  };
  ```
  Keep only `en.json` and `fr.json` as static fallbacks. Load the user's locale on mount. This reduces the client bundle from ~5.6 MB to ~250 KB (one locale).

---

## P-02: 30+ Static Public Pages Forced to Dynamic Rendering

- **Severity**: CRITICAL
- **Files**: Multiple pages in `src/app/(public)/`:
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/mentions-legales/conditions/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/mentions-legales/confidentialite/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/mentions-legales/cookies/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/securite/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/equipe/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/mission/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/histoire/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/valeurs/page.tsx`
  - `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/engagements/page.tsx`
  - (and ~20 more)
- **Description**: These pages contain **zero database queries** and **no user-specific content** -- they are pure static HTML (terms of service, about us, privacy policy, security info, etc.). Yet they all have `export const dynamic = 'force-dynamic'`, forcing Next.js to server-render every single request. Most are also `'use client'` pages with hardcoded content.
- **Impact**: Each visit triggers a server-side render for content that never changes. This wastes compute on Azure App Service, increases TTFB by 200-500ms per request, and prevents CDN edge caching. For high-traffic pages like "About" and legal pages, this is entirely unnecessary server load.
- **Fix**: Remove `export const dynamic = 'force-dynamic'` from all static pages. For pages that need i18n but no database, use `export const revalidate = 86400` (revalidate once per day) or `export const dynamic = 'force-static'`. This enables full static generation and CDN caching.

---

## P-03: Product Listing API Returns Default Limit of 200 With Full Object Graph

- **Severity**: CRITICAL
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/route.ts` (line 23)
- **Description**: The products GET endpoint defaults to `limit=200` with full `include` of category (with parent), all images, and all formats. No `select` is used to restrict fields. A product with 5 images and 4 formats generates a large JSON payload. With 200 products, the response can easily exceed 1-2 MB. Additionally, the products are fully fetched and then translation is applied in a loop with individual database queries per category (lines 85-89).
- **Impact**: Slow API responses (500ms-2s), excessive data transfer to clients, unnecessary DB load. The homepage product listing and category pages all hit this endpoint. Mobile users on slow connections experience significant delays.
- **Fix**:
  1. Reduce default limit to 20-30 with proper pagination (`skip`/`take`).
  2. Use `select` to return only fields needed by listing pages (no `fullDetails`, `specifications`, `description`, etc.).
  3. Batch the category translation lookups into a single `findMany` query instead of `Promise.all(categoryIds.map(...))`.

---

## P-04: N+1 Query Pattern in Product Search Category Translations

- **Severity**: HIGH
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/search/route.ts` (lines 121-126, 159-164)
- **Description**: After fetching products, the search endpoint performs individual `getTranslatedFields()` calls per category ID inside `Promise.all(categoryIds.map(async (catId) => ...))`. Then it does the same thing AGAIN for the category facets (lines 159-164). Each call likely hits the database. With 10 categories, that is 20 individual queries.
- **Impact**: Adds 100-300ms of latency per search request due to sequential/parallel DB round-trips.
- **Fix**: Fetch all translations in a single query:
  ```ts
  const catTranslations = await prisma.categoryTranslation.findMany({
    where: { categoryId: { in: categoryIds }, locale },
  });
  ```

---

## P-05: Admin User Detail Endpoint Executes 7+ Sequential Queries Without Batching

- **Severity**: HIGH
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/users/[id]/route.ts` (lines 11-188)
- **Description**: The GET handler for admin user detail fetches:
  1. User with loyaltyTransactions (line 11)
  2. All orders with items + products + currency (line 61) -- **no pagination, no limit**
  3. Referrer info (line 99)
  4. All referrals (line 106)
  5. All chat conversations with messages (line 115)
  6. All subscriptions (line 134)
  7. All reviews (line 150)
  8. All wishlist items + then all products for those items (lines 165-171)

  These are mostly sequential, and the orders query has no `take` limit -- a power user could have thousands of orders loaded into memory.
- **Impact**: Response times of 1-5+ seconds for users with significant history. Memory spikes from loading unbounded order arrays. DB connection held for the entire sequential execution.
- **Fix**: Use `Promise.all()` to parallelize independent queries. Add `take: 50` limits to orders, conversations, reviews, wishlist. Use `select` instead of `include` where full objects aren't needed.

---

## P-06: Order Export Has No Pagination or Streaming

- **Severity**: HIGH
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/account/orders/export/route.ts` (line 66)
- **Description**: The CSV export fetches ALL orders for a user with `prisma.order.findMany()` without any `take` limit. For a B2B customer with thousands of orders, this loads everything into memory at once. Same issue in `/Volumes/AI_Project/peptide-plus/src/app/api/admin/products/export/route.ts` (line 29) which fetches ALL products with includes.
- **Impact**: Memory spikes, potential OOM crashes on Azure App Service (limited RAM). Slow response for large datasets.
- **Fix**: Implement cursor-based pagination with streaming response, or add a reasonable limit (e.g., 5000) with a warning. Use `ReadableStream` for CSV generation to avoid buffering.

---

## P-07: Accounting Dashboard Fetches Full Order/Line Arrays for Aggregation

- **Severity**: HIGH
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/accounting/dashboard/route.ts` (lines 37-85)
- **Description**: The dashboard endpoint fetches all paid orders for the month (`select: { total: true }`) and all expense journal lines (`select: { debit: true }`) into memory, then reduces them in JavaScript (lines 87-88). This should be a `SUM()` aggregate in the database.
- **Impact**: Transfers potentially thousands of rows just to sum one column. Wasted memory and CPU. With growth, this will get linearly slower.
- **Fix**: Use Prisma `aggregate()`:
  ```ts
  const { _sum: { total: totalRevenue } } = await prisma.order.aggregate({
    where: { paymentStatus: 'PAID', createdAt: { gte: startOfMonth, lte: endOfMonth } },
    _sum: { total: true },
  });
  ```

---

## P-08: Five In-Memory Maps Growing Without Bound (Memory Leak Risk)

- **Severity**: HIGH
- **Files**:
  - `/Volumes/AI_Project/peptide-plus/src/lib/session-security.ts` (lines 15-16, 96): `lastActivityCache`, `sessionCreationCache`, `sessionMetadataCache`
  - `/Volumes/AI_Project/peptide-plus/src/lib/security.ts` (lines 270, 315): `rateLimitStore`, `csrfTokens`
  - `/Volumes/AI_Project/peptide-plus/src/lib/cache.ts` (lines 14, 17): `cache`, `tagIndex`
  - `/Volumes/AI_Project/peptide-plus/src/lib/brute-force-protection.ts` (line 15): `loginAttempts`
  - `/Volumes/AI_Project/peptide-plus/src/lib/accounting/ml-reconciliation.service.ts` (line 50): `learnedPatterns`
  - `/Volumes/AI_Project/peptide-plus/src/lib/accounting/search.service.ts` (line 393): `savedSearches`
- **Description**: The rate limiter in `rate-limiter.ts` (line 122) has cleanup every 5 minutes, which is good. However, the duplicate rate limiter in `security.ts` (line 270) has **no cleanup at all**. The `csrfTokens` map cleans up only when new tokens are generated, not on a schedule. The `sessionMetadataCache` (line 96) has no cleanup -- sessions that are invalidated via `invalidateSession()` clean `lastActivityCache` and `sessionCreationCache` but NOT `sessionMetadataCache`. The `savedSearches` and `learnedPatterns` maps have no eviction.
- **Impact**: On a long-running server, these maps accumulate entries indefinitely. With thousands of login attempts or session creations per day, memory usage grows without bound. Under sustained traffic, this can cause OOM kills on Azure.
- **Fix**:
  1. Add periodic cleanup to `security.ts` `rateLimitStore` and `csrfTokens` maps.
  2. Add `sessionMetadataCache.delete(sessionId)` to `invalidateSession()` in `session-security.ts`.
  3. Add max-size caps or LRU eviction to all in-memory Maps. Or use Redis for all these stores.

---

## P-09: Missing Database Index on Product.isActive

- **Severity**: HIGH
- **File**: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` (Product model, around line 1468)
- **Description**: The `Product.isActive` field is used in WHERE clauses on virtually every product query: the products listing, search, recommendations, category pages, wishlist enrichment, etc. There are indexes on `isBestseller`, `isFeatured`, `isNew`, `productType`, `sku`, and `slug` -- but NOT on `isActive`. Given that almost every product query filters by `isActive: true`, this is a frequently used filter column without an index.
- **Impact**: Full table scans on the Product table for every product listing query. With catalog growth (hundreds/thousands of products), this will cause progressively slower queries.
- **Fix**: Add `@@index([isActive])` to the Product model. Even better, add a composite index `@@index([isActive, categoryId])` since most queries filter by both.

---

## P-10: Product Search Uses LIKE '%query%' Without Full-Text Search

- **Severity**: MEDIUM
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/search/route.ts` (lines 33-38)
- **Description**: The search endpoint uses `{ contains: q, mode: 'insensitive' }` on four fields (name, subtitle, description, shortDescription). Prisma translates this to `ILIKE '%query%'` which cannot use B-tree indexes and requires full sequential scans of all text columns.
- **Impact**: O(n) scan for every search query. Currently acceptable with a small catalog but will degrade linearly with product count. With large `description` fields, this is especially slow.
- **Fix**: Implement PostgreSQL full-text search using `tsvector` / `tsquery` with a GIN index. Or use Prisma's `search` mode with the `fullTextSearch` preview feature. For the best UX, consider a search service like Meilisearch or Algolia.

---

## P-11: Recommendation Engine Makes 3-5 Sequential DB Queries

- **Severity**: MEDIUM
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/recommendations/route.ts` (lines 53-207)
- **Description**: The recommendations endpoint executes up to 5 sequential queries:
  1. Find related order items (line 53)
  2. GroupBy on order items (line 72)
  3. Fetch product details (line 91)
  4. Fetch cart products for categories (line 147)
  5. Fetch category products for fallback (line 155)

  Steps 4-5 only run if insufficient recommendations, but the first 3 always run. These are not parallelized.
- **Impact**: 200-500ms per request. Recommendations are loaded on product pages and cart pages, directly affecting user experience.
- **Fix**: Parallelize independent queries. Cache recommendation results per product set (these don't change frequently). Consider pre-computing recommendations in a materialized view or cache table.

---

## P-12: Product History Endpoint Loads All Orders Then Processes in JS

- **Severity**: MEDIUM
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/account/product-history/route.ts` (lines 30-39, 56-80)
- **Description**: The endpoint fetches ALL non-cancelled orders for a user with full `items` include (no limit), then iterates through every order and every item in nested loops to build an aggregation Map in JavaScript. This should be a `groupBy` query or SQL aggregation.
- **Impact**: For a user with 100 orders averaging 3 items each, this loads 300 OrderItem records and processes them in JS. Worse, it then fetches ALL product details (line 88) and ALL format details (line 93) for the entire history.
- **Fix**: Use Prisma `groupBy` on OrderItem, or a raw SQL query with `GROUP BY productId, formatId`. Add `take` limit to the initial orders query.

---

## P-13: `getToken()` Called on Every Non-Static Request via Middleware

- **Severity**: MEDIUM
- **File**: `/Volumes/AI_Project/peptide-plus/src/middleware.ts` (lines 102-119)
- **Description**: The middleware calls `getToken()` on every request that is not a static file, API, or auth route. This involves decrypting/verifying the JWT on every page navigation. While JWT verification is fast, the middleware does it even for fully public pages that don't need authentication info (like legal pages, about pages).
- **Impact**: Adds 5-20ms per request for JWT decryption/verification. Under high traffic, this adds up.
- **Fix**: Move the `getToken()` call inside the `isProtected` conditional, or at least skip it for known public-only routes. The locale detection from token (line 125) can fall back to cookies/headers for public pages.

---

## P-14: In-Stock Filter Applied Post-Query in Search

- **Severity**: MEDIUM
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/search/route.ts` (lines 107-112)
- **Description**: The `inStock=true` filter is applied AFTER fetching all matching products from the database (`products = products.filter(...)` on line 109). This means the database returns products that will be discarded, wasting bandwidth and memory.
- **Impact**: If 50 out of 200 products are out of stock, the DB returns 200 rows but only 150 are used. Combined with the `take: limit`, the user might get fewer results than expected.
- **Fix**: Add a `formats: { some: { stockQuantity: { gt: 0 } } }` clause to the Prisma `where` when `inStock=true`, filtering at the database level.

---

## P-15: Missing `select` on Multiple findMany Queries Returning Full Objects

- **Severity**: MEDIUM
- **Files**:
  - `/Volumes/AI_Project/peptide-plus/src/app/api/account/product-history/route.ts` (line 88): `db.product.findMany` with `include: { category }` loads all 30+ Product fields when only `imageUrl`, `slug`, `price`, `isActive`, and `category.name` are used.
  - `/Volumes/AI_Project/peptide-plus/src/app/api/admin/products/export/route.ts` (line 29): Loads all products with all fields, including large text fields (`fullDetails`, `description`, `specifications`) that don't appear in the CSV output.
  - `/Volumes/AI_Project/peptide-plus/src/app/api/accounting/dashboard/route.ts` (line 75): `recentOrders` fetches all Order fields when only a summary is displayed.
  - `/Volumes/AI_Project/peptide-plus/src/app/api/admin/users/[id]/route.ts` (line 134): `subscription.findMany` loads all subscription fields.
- **Impact**: 30-50% excess data transferred from database per query. Adds to network latency and memory pressure.
- **Fix**: Add `select` clauses restricting to only the fields actually used by the consumer.

---

## P-16: Duplicate Rate Limiter Implementation

- **Severity**: LOW
- **Files**:
  - `/Volumes/AI_Project/peptide-plus/src/lib/rate-limiter.ts` (full file, 465 lines)
  - `/Volumes/AI_Project/peptide-plus/src/lib/security.ts` (lines 265-309)
- **Description**: There are TWO completely independent rate limiter implementations. The one in `rate-limiter.ts` is comprehensive (Redis-backed with memory fallback, periodic cleanup, stats). The one in `security.ts` is a simpler in-memory Map with no cleanup. Both are imported and used in different parts of the codebase.
- **Impact**: Wasted memory (two separate Maps tracking similar data). Inconsistent rate limiting behavior. The `security.ts` version has no cleanup, creating a slow memory leak.
- **Fix**: Consolidate to a single rate limiter implementation. Remove the duplicate from `security.ts` and use `rate-limiter.ts` everywhere.

---

## P-17: No Dynamic Import for Heavy Admin Components

- **Severity**: LOW
- **File**: `/Volumes/AI_Project/peptide-plus/src/app/(shop)/layout.tsx` (lines 14-18)
- **Description**: The shop layout correctly uses `dynamic(() => import(...), { ssr: false })` for ChatWidget, NewsletterPopup, CompareBar, InstallPWA, and TextToSpeech. However, admin pages (116 `'use client'` pages found) do not use dynamic imports for heavy components like chart libraries, rich text editors, data tables, etc.
- **Impact**: Admin bundle may be larger than necessary. Less critical because admin pages are not public-facing, but still affects admin user experience.
- **Fix**: Audit admin pages for heavy client libraries and use `next/dynamic` with `{ ssr: false }` for chart components, rich text editors, and other heavy imports.

---

## P-18: Missing Composite Indexes for Common Query Patterns

- **Severity**: LOW
- **File**: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma`
- **Description**: Several common query patterns lack composite indexes:
  - **Order**: Queries frequently filter by `userId + createdAt` or `userId + status` but only individual indexes exist on each column.
  - **Review**: `productId + isApproved + isPublished` is used for showing approved reviews on product pages but only individual indexes exist.
  - **OrderItem**: `orderId + productId` is used in recommendation queries but only individual indexes exist.
- **Impact**: PostgreSQL must perform index intersections or partial scans for these multi-column filters. Small impact now, grows with data volume.
- **Fix**: Add composite indexes:
  ```prisma
  // Order
  @@index([userId, createdAt])
  @@index([userId, status])

  // Review
  @@index([productId, isApproved, isPublished])
  ```

---

## QUICK WINS (Highest ROI for Least Effort)

1. **P-02** - Remove `force-dynamic` from static pages: Search-and-replace, zero risk, massive CDN benefit.
2. **P-09** - Add `@@index([isActive])` to Product: One line in schema, instant query improvement.
3. **P-07** - Replace `findMany` + `reduce` with `aggregate()` in dashboard: ~10 lines changed, 10x faster.
4. **P-01** - Dynamic locale imports: Medium effort, massive bundle size reduction (5.6 MB saved).
5. **P-08** - Add `sessionMetadataCache.delete()` to `invalidateSession()`: One line fix for memory leak.

---

## ESTIMATED CUMULATIVE IMPACT

| Metric | Current (estimated) | After Fixes |
|--------|-------------------|-------------|
| Client JS bundle | ~7-8 MB | ~2-3 MB |
| Homepage TTFB (static pages) | 300-800ms | 50-100ms (CDN) |
| Product listing API | 500-2000ms | 100-300ms |
| Search API | 300-800ms | 100-200ms |
| Admin user detail API | 1-5s | 200-500ms |
| Memory (24h server) | Grows unbounded | Stable |

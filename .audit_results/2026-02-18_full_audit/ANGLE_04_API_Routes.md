
---

# EXHAUSTIVE API ROUTES AUDIT -- ANGLE 4: API ROUTES & ENDPOINTS

## 1. COMPLETE ROUTE INVENTORY

The project contains **170 route files** across **208 exported handler functions (GET/POST/PUT/DELETE)**. Below is the full inventory organized by domain.

---

### 1A. AUTHENTICATION ROUTES (`/api/auth/`)

| Route | Methods | Auth? | Validation | Status Codes | Error Handling |
|-------|---------|-------|-----------|-------------|----------------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth handlers | N/A | N/A | Delegated to Auth.js |
| `/api/auth/signup` | POST | No (public) | Zod schema | 201, 400, 429, 500 | try/catch, rate-limited |
| `/api/auth/forgot-password` | POST | No (public) | Manual | 200, 400, 429, 500 | try/catch, rate-limited |
| `/api/auth/reset-password` | POST | No (public) | Manual | 200, 400, 429, 500 | try/catch, rate-limited |
| `/api/auth/webauthn/register/options` | POST | auth() | N/A | | |
| `/api/auth/webauthn/register/verify` | POST | auth() | N/A | | |
| `/api/auth/webauthn/authenticate/options` | POST | No (public) | | | |
| `/api/auth/webauthn/authenticate/verify` | POST | No (public) | | | |

### 1B. PAYMENT ROUTES (`/api/payments/`, `/api/webhooks/`)

| Route | Methods | Auth? | Validation | Status Codes | Error Handling |
|-------|---------|-------|-----------|-------------|----------------|
| `/api/payments/create-intent` | POST | auth() | Manual (productId) | 200, 400, 401, 404, 500 | try/catch |
| `/api/payments/create-checkout` | POST | auth() (optional for guest) | Thorough server-side | 200, 400, 500 | try/catch |
| `/api/payments/webhook` (Stripe) | POST | Stripe signature | N/A | 200, 400, 500 | try/catch + idempotence |
| `/api/payments/paypal/create-order` | POST | auth() | Server-side price validation | 200, 400, 401, 500, 503 | try/catch |
| `/api/payments/paypal/capture` | POST | auth() (after capture) | Server-side price reverify | 200, 400, 401, 500 | try/catch |
| `/api/payments/paypal/create` | POST | auth() | | | try/catch |
| `/api/webhooks/stripe` | POST | Forwards to /api/payments/webhook | Checks stripe-signature | 200, 400 | Forward pattern |
| `/api/webhooks/paypal` | POST | PayPal signature verify | Full API verification | 200, 400, 500 | try/catch + idempotence |

### 1C. PRODUCT ROUTES (`/api/products/`)

| Route | Methods | Auth? | Validation | Status Codes | Error Handling |
|-------|---------|-------|-----------|-------------|----------------|
| `/api/products` | GET | No (public) | N/A | 200, 500 | try/catch |
| `/api/products` | POST | EMPLOYEE/OWNER | Manual (name, slug, price, categoryId) | 201, 400, 401, 403, 500 | try/catch |
| `/api/products/[id]` | GET | No (public) | N/A | 200, 404, 500 | try/catch |
| `/api/products/[id]` | PUT | EMPLOYEE/OWNER | Whitelist (mass assignment fix) | 200, 400, 401, 403, 404, 500 | try/catch |
| `/api/products/[id]` | DELETE | OWNER only | N/A | 200, 401, 403, 500 | try/catch (soft delete) |
| `/api/products/[id]/formats` | GET, POST | POST: auth() | Manual | Various | try/catch |
| `/api/products/[id]/formats/[formatId]` | GET, PUT, DELETE | PUT/DELETE: auth() | Manual | Various | try/catch |
| `/api/products/[id]/translations` | GET | auth() | | | |
| `/api/products/by-slug/[slug]` | GET | No (public) | | | |
| `/api/products/search` | GET | No (public) | N/A | 200, 500 | try/catch |
| `/api/products/compare` | GET | No (public) | | | |
| `/api/products/recommendations` | GET | No (public) | Manual (productIds) | 200, 400, 500 | try/catch |

### 1D. ORDER ROUTES

| Route | Methods | Auth? | Validation | Status Codes | Error Handling |
|-------|---------|-------|-----------|-------------|----------------|
| `/api/orders` | GET | auth() | N/A | 200, 401, 404, 500 | try/catch |
| `/api/orders/track` | GET | auth() | | | |
| `/api/orders/by-session` | GET | **NO AUTH** | session_id param | 200, 400 | try/catch |
| `/api/account/orders` | GET | auth() | N/A | 200, 401, 404, 500 | **Suppresses errors: returns []** |
| `/api/account/orders/[id]/cancel` | POST | auth() | | 200, 400, 500 | |
| `/api/account/orders/[id]/reorder` | POST | auth() | | | |
| `/api/account/orders/[id]/update-address` | POST | auth() | | | |
| `/api/account/orders/export` | GET | auth() | | | |
| `/api/admin/orders` | GET | EMPLOYEE/OWNER | N/A | 200, 403, 500 | try/catch, paginated |
| `/api/admin/orders` | PUT | EMPLOYEE/OWNER | Manual (orderId, status) | 200, 400, 403, 404, 500 | try/catch |
| `/api/admin/orders/[id]` | GET, PUT, DELETE | EMPLOYEE/OWNER | | Various | |

### 1E. USER & ACCOUNT ROUTES

| Route | Methods | Auth? | Validation | Status Codes | Error Handling |
|-------|---------|-------|-----------|-------------|----------------|
| `/api/users` | GET | EMPLOYEE/OWNER | Paginated | 200, 401, 403, 500 | try/catch |
| `/api/users/[id]` | GET, PUT, DELETE | auth() | | Various | |
| `/api/user/profile` | GET, PUT | auth() | | | |
| `/api/user/locale` | GET, PUT | auth() | | | |
| `/api/user/change-password` | POST | auth() | | | |
| `/api/account/profile` | GET, PUT | auth() | | | |
| `/api/account/address` | GET, PUT | auth() | | | |
| `/api/account/password` | POST | auth() | | | |
| `/api/account/summary` | GET | auth() | | | |
| `/api/account/product-history` | GET | auth() | | | |
| `/api/account/notifications` | GET, PUT | auth() | | | |
| `/api/account/mfa/setup` | POST | auth() | | | |
| `/api/account/mfa/verify` | POST | auth() | | | |
| `/api/account/wishlist` | GET, POST | auth() | Manual | 200, 201, 400, 401, 404, 500 | try/catch |
| `/api/account/wishlist/[id]` | DELETE | auth() | | | |
| `/api/account/wishlists` | GET, POST, PUT, DELETE | auth() | Zod on some | | |
| `/api/account/wishlists/items` | GET, POST, PUT, DELETE | auth() | Zod on some | | |
| `/api/account/invoices` | GET | auth() | | | |
| `/api/account/invoices/[id]` | GET | auth() | | | |
| `/api/account/invoices/[id]/pdf` | GET | auth() | | | |
| `/api/account/returns` | GET, POST | auth() | | 201 | |
| `/api/account/subscriptions` | GET, POST, PUT | auth() | | | |
| `/api/admin/users` | GET | EMPLOYEE/OWNER | Paginated | 200, 401, 403, 500 | try/catch |
| `/api/admin/users/[id]` | GET, PUT | EMPLOYEE/OWNER | | | |
| `/api/admin/users/[id]/points` | POST | EMPLOYEE/OWNER | | | |

### 1F. ACCOUNTING ROUTES (`/api/accounting/`)

All 24 accounting routes **require auth()** with **EMPLOYEE/OWNER** role check. They all have:
- try/catch error handling
- Paginated list endpoints
- Proper 401/403 responses

Routes: `entries`, `entries/[id]/post`, `chart-of-accounts`, `bank-accounts`, `bank-transactions`, `customer-invoices`, `supplier-invoices`, `credit-notes`, `expenses`, `budgets`, `general-ledger`, `tax-reports`, `tax-summary`, `periods`, `periods/[code]/close`, `periods/year-end`, `reconciliation`, `aging`, `alerts`, `dashboard`, `settings`, `currencies`, `reports/pdf`, `stripe-sync`

### 1G. ADMIN ROUTES (`/api/admin/`)

All ~55 admin routes **require auth()** with **EMPLOYEE/OWNER** role check. Domains covered:
- `orders`, `users`, `products`, `inventory`, `promotions`, `promo-codes`
- `currencies`, `shipping/zones`, `settings`, `logs`, `permissions`
- `reviews`, `questions`, `employees`, `emails`, `medias`, `seo`
- `translations`, `uat`, `newsletters`, `loyalty`, `content`, `blog`, `articles`, `videos`, `webinars`, `bundles`, `subscriptions`, `upsell-config`, `quantity-discounts`, `purchase-orders`, `payment-methods`

### 1H. PUBLIC ROUTES (No authentication required)

| Route | Methods | Purpose | Validation |
|-------|---------|---------|-----------|
| `/api/health` | GET, HEAD | Health check | None needed |
| `/api/csrf` | GET | CSRF token | None needed |
| `/api/debug-auth` | GET | **DEBUG ENDPOINT** | **NONE** |
| `/api/products` | GET | Product catalog | N/A |
| `/api/products/[id]` | GET | Product detail | N/A |
| `/api/products/search` | GET | Search | N/A |
| `/api/products/recommendations` | GET | Recommendations | productIds |
| `/api/products/compare` | GET | Compare | N/A |
| `/api/products/by-slug/[slug]` | GET | Slug lookup | N/A |
| `/api/categories` | GET | Category list | N/A |
| `/api/categories/[id]` | GET | Category detail | N/A |
| `/api/hero-slides/active` | GET | Active slides | N/A |
| `/api/client-references` | GET | References | N/A |
| `/api/contact` | POST | Contact form | Manual |
| `/api/newsletter` | GET, POST | Subscribe | Manual |
| `/api/faq` | GET | FAQ list | N/A |
| `/api/blog` | GET | Blog posts | N/A |
| `/api/articles` | GET | Articles | N/A |
| `/api/news` | GET | News | N/A |
| `/api/videos` | GET | Videos | N/A |
| `/api/webinars` | GET | Webinars | N/A |
| `/api/guides` | GET | Guides | N/A |
| `/api/testimonials` | GET | Testimonials | N/A |
| `/api/currencies` | GET | Currencies | N/A |
| `/api/promo/validate` | POST | Validate promo | N/A |
| `/api/orders/by-session` | GET | Order by Stripe session | session_id |
| `/api/bundles` | GET | Bundle list | N/A |
| `/api/bundles/[slug]` | GET | Bundle detail | N/A |
| `/api/payment-methods` | GET | Payment methods | N/A |

### 1I. CRON ROUTES (`/api/cron/`)

All 9 cron routes verify `CRON_SECRET` via Bearer token:
- `release-reservations`, `satisfaction-survey`, `abandoned-cart`, `birthday-emails`
- `points-expiring`, `price-drop-alerts`, `stock-alerts`, `update-exchange-rates`, `welcome-series`

---

## 2. ISSUES FOUND -- SEVERITY RATINGS

### CRITICAL (P0)

| # | Issue | Location | Details |
|---|-------|----------|---------|
| **C1** | **Debug endpoint exposed in production** | `/Volumes/AI_Project/peptide-plus/src/app/api/debug-auth/route.ts` | Exposes `AUTH_SECRET` length/prefix, `AUTH_URL`, cookie names, all request headers. **No authentication required.** Comments say "DELETE AFTER OAUTH IS WORKING" but it remains. This is an information disclosure vulnerability enabling session hijacking. |
| **C2** | **Stack traces returned in error responses** | `/Volumes/AI_Project/peptide-plus/src/app/api/payments/webhook/route.ts` (line 159), `/api/cron/birthday-emails/route.ts` (line 279), `/api/cron/price-drop-alerts/route.ts` (line 254), `/api/cron/update-exchange-rates/route.ts` (line 186), `/api/cron/abandoned-cart/route.ts` (line 291) | `error.stack` is included in JSON response bodies. Cron routes are guarded by CRON_SECRET, but the Stripe webhook route's outer catch logs stack to the logger (which may forward to response via structured logging). Stack traces reveal file paths, library versions, and internal architecture. |
| **C3** | **Order lookup without authentication** | `/Volumes/AI_Project/peptide-plus/src/app/api/orders/by-session/route.ts` | Given a valid Stripe `session_id`, returns `orderId` and `orderNumber` without any authentication. An attacker who intercepts or guesses session IDs can enumerate orders. The session_id is exposed in URL query params on checkout success page. |

### HIGH (P1)

| # | Issue | Location | Details |
|---|-------|----------|---------|
| **H1** | **Inconsistent input validation -- only 6 of ~170 routes use Zod** | Various | Only `auth/signup`, `stock-alerts`, and 4 chat routes use Zod schemas. All other routes use manual validation (`if (!field)`) which is error-prone and inconsistent. Most routes accept untrusted JSON with no schema validation. |
| **H2** | **Products GET returns up to 200 items with no upper limit enforcement** | `/Volumes/AI_Project/peptide-plus/src/app/api/products/route.ts` (line 23) | Default limit is 200 (`parseInt(searchParams.get('limit') || '200')`). The `limit` parameter is user-controlled with no maximum cap. A client could request `?limit=999999` and dump the entire product catalog with images, formats, and categories. |
| **H3** | **Unbounded queries on multiple list endpoints** | `/api/account/orders`, `/api/orders`, `/api/reviews`, `/api/client-references`, `/api/hero-slides/active` | These GET endpoints have **no pagination** and return `findMany()` with no `take` limit. As data grows, these become performance bombs and potential DoS vectors. |
| **H4** | **Order number generation race condition** | `/Volumes/AI_Project/peptide-plus/src/app/api/payments/webhook/route.ts` (line 191-194), `/api/payments/paypal/capture/route.ts` (line 118-121) | Order number is generated via `count() + 1`. Under concurrent webhook deliveries (which is common with Stripe/PayPal), two orders can get the same number. This is not inside the transaction. |
| **H5** | **Error responses silently swallow errors** | `/Volumes/AI_Project/peptide-plus/src/app/api/account/orders/route.ts` (line 66-67) | On error, returns `NextResponse.json([])` with **200 status**. The client has no way to know an error occurred. Data loss is silently masked. |
| **H6** | **`force-dynamic` on all routes defeats Next.js caching** | All route files | Every single route has `export const dynamic = 'force-dynamic'` at the top. While some routes (webhooks, auth) genuinely need this, public read-only routes like `/api/products`, `/api/categories`, `/api/hero-slides/active` would benefit from Next.js ISR caching. The `Cache-Control` headers are set on some (good), but `force-dynamic` prevents edge caching. |

### MEDIUM (P2)

| # | Issue | Location | Details |
|---|-------|----------|---------|
| **M1** | **Inconsistent response shapes** | Various | Some routes return `{ products }`, others `{ orders }`, some return bare arrays, some return `{ success: true, ... }`, some return `{ data, pagination }`. There is no standard envelope. Examples: `/api/account/orders` returns bare array, `/api/orders` returns `{ orders }`, `/api/loyalty` returns flat object. |
| **M2** | **Duplicate user/profile routes** | `/api/user/profile` and `/api/account/profile` | Two different route files serve similar purposes. `/api/user/locale` and `/api/user/change-password` are under `/user/` while most account-related routes are under `/account/`. Naming inconsistency. |
| **M3** | **Duplicate wishlist routes** | `/api/account/wishlist` and `/api/account/wishlists` | Two complete wishlist implementations exist side by side. `wishlist` is simpler, `wishlists` supports multiple named lists. Both are active. |
| **M4** | **Missing rate limiting on public endpoints** | `/api/contact`, `/api/newsletter`, `/api/promo/validate`, `/api/products/search` | The auth routes have rate limiting (good). But public POST endpoints like contact form and newsletter subscription have no rate limiting, enabling spam. |
| **M5** | **POST routes inconsistently return 201** | Various | Out of ~80 POST handlers, only ~40 return `201 Created`. Others return default `200` for creation operations. Examples: `/api/chat` POST creates a conversation but returns 200. `/api/newsletter` POST creates a subscriber but returns 200. |
| **M6** | **Inconsistent auth error codes** | Various | Admin routes mix `401 Unauthorized` and `403 Forbidden` inconsistently. `/api/admin/orders` returns 403 for unauthenticated requests (should be 401 first). `/api/admin/settings` returns 401 for role mismatch (should be 403). |
| **M7** | **PayPal webhook token fetch on every request** | `/Volumes/AI_Project/peptide-plus/src/app/api/webhooks/paypal/route.ts` (lines 46-61) | Each webhook triggers a fresh OAuth token request to PayPal. Token should be cached (PayPal tokens are valid for ~9 hours). |
| **M8** | **Category search uses `case-sensitive` contains** | `/Volumes/AI_Project/peptide-plus/src/app/api/users/route.ts` (line 38) | User search `{ contains: search }` without `mode: 'insensitive'` means searches are case-sensitive by default in PostgreSQL. |

### LOW (P3)

| # | Issue | Location | Details |
|---|-------|----------|---------|
| **L1** | **Mixed language in error messages** | All routes | Error messages alternate between French ("Non autorise", "Acces refuse") and English ("Unauthorized", "Internal server error") within the same route and across routes. Should be consistent or use i18n keys. |
| **L2** | **`eslint-disable` for TypeScript any types** | Multiple routes (webhook handlers, chat) | `@typescript-eslint/no-explicit-any` is suppressed in several routes. PayPal webhook uses `any` for event payloads. Should use typed SDK or Zod parsing. |
| **L3** | **Console.log with emojis in production code** | `/api/cron/satisfaction-survey/route.ts` (line 56), `/api/emails/send-marketing-email/route.ts` (line 194) | Uses emoji in console.log (`log(📊...)`, `log(📧...)`). Not harmful but unprofessional in production logs. |
| **L4** | **Orphaned GET+POST alias on cron route** | `/Volumes/AI_Project/peptide-plus/src/app/api/cron/satisfaction-survey/route.ts` (line 143) | `export { GET as POST }` exports GET handler as POST too. Unusual pattern -- cron jobs typically only need GET. |
| **L5** | **Unused frequency field leak in recommendations** | `/Volumes/AI_Project/peptide-plus/src/app/api/products/recommendations/route.ts` (line 212) | `frequency` is stripped before response (good), but the internal type `ProductRecommendation` includes it, which is a minor design smell. |
| **L6** | **Hardcoded Stripe API version** | Multiple payment routes | `apiVersion: '2023-10-16'` is hardcoded. Should be a constant or env var for easier upgrades. |
| **L7** | **`db` and `prisma` import inconsistency** | Various | Some routes import `import { prisma } from '@/lib/db'`, others import `import { db } from '@/lib/db'`. Both are likely the same client but the naming inconsistency is confusing. |

---

## 3. REST CONVENTIONS ANALYSIS

### Good Practices Observed
- Collection endpoints use **plural nouns**: `/api/products`, `/api/orders`, `/api/users`, `/api/categories` -- correct.
- Resource-level operations use `[id]` dynamic segments.
- POST creation routes that return `201` do so correctly (~40 of them).
- Nested resources follow REST conventions: `/api/products/[id]/formats/[formatId]`.

### Violations
- **Action endpoints masquerading as resources**: `/api/promo/validate`, `/api/loyalty/earn`, `/api/loyalty/redeem`, `/api/referrals/apply`, `/api/referrals/qualify`. These are RPC-style, not RESTful.
- **PUT on collection endpoints instead of resource**: `/api/admin/orders` uses PUT on the collection endpoint with `orderId` in the body. Should be `PUT /api/admin/orders/[id]` (which also exists as a separate route, creating ambiguity).
- **DELETE via query params**: `/api/accounting/entries?id=xxx&action=delete` uses query params for DELETE identification. Should be `DELETE /api/accounting/entries/[id]`.
- **Mixed singular/plural**: `/api/company` (singular), `/api/contact` (singular) vs `/api/products` (plural). Utility/singleton resources can be singular, but it should be deliberate.

---

## 4. PAGINATION ANALYSIS

### Properly Paginated (with total count)
- `/api/users` -- page/limit with `totalPages`
- `/api/admin/orders` -- page/limit/total/totalPages/hasMore
- `/api/accounting/entries` -- page/limit/total/pages
- `/api/admin/logs` -- page/limit/total/totalPages/hasMore

### Upper Limit Enforced
- `/api/admin/orders` -- `Math.min(limit, 100)` -- **GOOD**
- `/api/admin/logs` -- `Math.min(limit, 200)` -- **GOOD**

### No Upper Limit (user-controlled)
- `/api/products` -- default 200, no max cap -- **BAD**
- `/api/products/search` -- default 50, no max cap
- `/api/chat` -- default 50, no max cap
- `/api/accounting/entries` -- default 50, no max cap

### No Pagination At All
- `/api/account/orders` -- returns ALL user orders
- `/api/orders` -- returns ALL user orders
- `/api/reviews` -- returns ALL reviews for a product
- `/api/client-references` -- returns ALL references
- `/api/account/wishlist` -- returns ALL wishlist items
- `/api/loyalty` -- returns last 20 transactions (hardcoded)

---

## 5. CACHING ANALYSIS

### Routes with Cache-Control Headers
- `/api/products` GET -- `s-maxage=300, stale-while-revalidate=600` (5min)
- `/api/products/search` GET -- `s-maxage=60, stale-while-revalidate=120` (1min)
- `/api/products/recommendations` GET -- `s-maxage=300, stale-while-revalidate=600` (5min)
- `/api/categories` GET -- `s-maxage=600, stale-while-revalidate=1200` (10min)
- `/api/hero-slides/active` GET -- `s-maxage=60, stale-while-revalidate=120` (1min)
- `/api/health` GET -- `no-store, no-cache, must-revalidate` (correct)

### Routes Missing Cache-Control (should have it)
- `/api/faq` -- static content, should cache
- `/api/blog` -- semi-static, should cache
- `/api/articles` -- semi-static, should cache
- `/api/testimonials` -- semi-static, should cache
- `/api/videos` -- semi-static, should cache
- `/api/currencies` -- changes infrequently, should cache
- `/api/client-references` -- semi-static, should cache

### Note on `force-dynamic`
All routes declare `export const dynamic = 'force-dynamic'`. This means Next.js will never statically cache or ISR these routes at the framework level. Cache-Control headers still work for CDN/browser caching, but the Next.js edge runtime will always invoke the handler. For truly static content (FAQ, blog listings), this is unnecessary overhead.

---

## 6. WEBHOOK HANDLER ANALYSIS

### Stripe Webhook (`/api/payments/webhook`)
- **Signature verification**: YES -- `stripe.webhooks.constructEvent()` -- correct
- **Idempotence**: YES -- `WebhookEvent` model with status tracking
- **Error isolation**: YES -- individual handler errors don't fail the webhook
- **Return 200 on handler error**: NO -- returns 500, which will cause Stripe retries. Should return 200 and log error (like PayPal handler does).

### PayPal Webhook (`/api/webhooks/paypal`)
- **Signature verification**: YES -- Full PayPal API verification
- **Idempotence**: YES -- `WebhookEvent` model with `findUnique` check
- **Error isolation**: YES -- handler errors return 200 to PayPal (correct)
- **Token caching**: NO -- fetches new OAuth token on every webhook (wasteful)

### Legacy Stripe Webhook (`/api/webhooks/stripe`)
- Simply forwards to `/api/payments/webhook` via internal `fetch()`. Works but adds latency. Should be configured to point directly to the canonical endpoint.

---

## 7. FILE STRUCTURE ANALYSIS

### Co-location
Route files are properly co-located in their respective directories. No orphaned route files detected.

### Problematic Patterns
1. **Duplicate routes for same functionality**:
   - `/api/user/profile` vs `/api/account/profile`
   - `/api/account/wishlist` vs `/api/account/wishlists`
   - `/api/webhooks/stripe` vs `/api/payments/webhook`

2. **Inconsistent nesting**:
   - User routes split between `/api/user/` (locale, profile, change-password) and `/api/users/` (CRUD) and `/api/account/` (orders, wishlist, etc.)

---

## 8. SUMMARY OF FINDINGS BY SEVERITY

| Severity | Count | Key Issues |
|----------|-------|------------|
| **CRITICAL (P0)** | 3 | Debug endpoint in production, stack trace exposure, unauthenticated order lookup |
| **HIGH (P1)** | 6 | Missing Zod validation, unbounded queries, order number race condition, silent error swallowing, force-dynamic everywhere |
| **MEDIUM (P2)** | 8 | Inconsistent response shapes, duplicate routes, missing rate limits, inconsistent status codes, PayPal token waste |
| **LOW (P3)** | 7 | Mixed languages, any types, emojis in logs, import naming inconsistency |

## 9. TOP PRIORITY REMEDIATION

1. **DELETE `/api/debug-auth/route.ts` immediately** -- This is the highest-risk finding. It exposes auth secrets metadata to the public internet.

2. **Add authentication to `/api/orders/by-session`** -- Either require `auth()` or validate that the requesting user owns the order.

3. **Remove `error.stack` from all response bodies** -- Stack traces must only appear in server-side logs, never in HTTP responses.

4. **Adopt Zod validation universally** -- Create shared schemas for common patterns (pagination params, IDs, etc.) and apply to all routes.

5. **Add `Math.min(limit, MAX)` caps** to all paginated endpoints, especially `/api/products` and `/api/products/search`.

6. **Standardize response envelope** -- Adopt a consistent shape like `{ data, meta?, error? }` across all routes.

7. **Fix order number generation** -- Use a database sequence or `UPSERT`-based counter inside the transaction to prevent duplicates.


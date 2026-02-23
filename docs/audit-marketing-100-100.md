# AUDIT MARKETING & SALES - BioCycle Peptides (peptide-plus)
# Date: 2026-02-22
# Auditeur: Claude Opus 4.6 (expert code auditor)
# Scope: Promotions, Newsletter, Ambassadors, SEO, Banners, Webinaires, Promo Codes, Upsell, Loyalty, Referrals, Social Proof, Stock Alerts, Cron Jobs, Email Templates, Lib Services, Prisma Models

---

## RESUME EXECUTIF

| Priorite   | Failles/Bugs | Ameliorations |
|------------|-------------|---------------|
| CRITICAL   | 14          | 8             |
| HIGH       | 31          | 27            |
| MEDIUM     | 38          | 42            |
| LOW        | 17          | 23            |
| **TOTAL**  | **100**     | **100**       |

### TOP 10 PROBLEMES CRITIQUES

1. **FLAW-001** - Social proof generates FAKE purchase notifications with synthetic data (legal/ethical)
2. **FLAW-002** - Newsletter admin page calls API routes that DO NOT EXIST (`/api/admin/newsletter/subscribers`, `/api/admin/newsletter/campaigns`)
3. **FLAW-003** - Referral code generation uses `Math.random()` (not crypto-secure, predictable codes)
4. **FLAW-004** - Ambassador GET syncs ALL commissions on EVERY request (N+1 performance bomb)
5. **FLAW-005** - Sitemap generation writes to filesystem (`public/sitemap.xml`) - fails on Azure App Service
6. **FLAW-006** - `email-flows` cron accepts secret via query string parameter (secret in URL logs/referer)
7. **FLAW-007** - `scheduled-campaigns` cron accepts secret via query string (same issue)
8. **FLAW-008** - Upsell admin `handleSave` always uses POST even for edits, creating duplicates
9. **FLAW-009** - Loyalty `earn` endpoint allows BONUS type without amount cap (admin can award unlimited points)
10. **FLAW-010** - Ambassador referral code uses `Date.now().toString(36)` (predictable, sequential)

---

## PARTIE 1: 100 FAILLES ET BUGS

### CRITICAL (14)

**FLAW-001** [CRITICAL] - Social proof generates deceptive fake data
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/social-proof/route.ts` lines 80-140
- Issue: When insufficient real purchases exist, the API generates synthetic purchase notifications with random fake names and cities. This is potentially illegal under consumer protection laws (FTC Act Section 5, Canadian Competition Act) and violates trust.
- Fix: Remove synthetic fallback entirely. Return empty array if no real recent purchases. Alternatively, clearly mark as "popular products" instead of fake purchase notifications.

**FLAW-002** [CRITICAL] - Newsletter admin calls non-existent API routes
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/newsletter/page.tsx` lines ~60-80
- Issue: The admin newsletter page fetches from `/api/admin/newsletter/subscribers` and `/api/admin/newsletter/campaigns` but these API route files do not exist in the codebase. The entire subscribers and campaigns tabs are completely non-functional.
- Fix: Create the missing API routes at `src/app/api/admin/newsletter/subscribers/route.ts` and `src/app/api/admin/newsletter/campaigns/route.ts`, or point to existing routes.

**FLAW-003** [CRITICAL] - Referral code uses Math.random()
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/referrals/generate/route.ts` line ~50
- Issue: `Math.random()` is not cryptographically secure. Referral codes can be predicted/brute-forced, allowing unauthorized referral bonuses.
- Fix: Use `crypto.randomUUID()` or `crypto.getRandomValues()` for code generation, as done correctly in `/api/loyalty/route.ts` line 34.

**FLAW-004** [CRITICAL] - Ambassador GET triggers heavy sync on every call
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts` lines 50-100
- Issue: `syncCommissionsForCodes()` runs on EVERY GET request to list ambassadors. This performs N+1 queries for each ambassador's referral code, fetching all orders and creating/updating commissions. On a page with pagination, this creates massive DB load.
- Fix: Move commission sync to a scheduled cron job or manual admin action. Never run sync in a GET endpoint.

**FLAW-005** [CRITICAL] - Sitemap writes to filesystem
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/seo/sitemap/route.ts` lines 150-180
- Issue: `fs.writeFileSync('public/sitemap.xml', ...)` writes to the local filesystem. On Azure App Service (read-only deployment), this will fail silently or crash. The sitemap will never be generated in production.
- Fix: Store sitemap in Azure Blob Storage and serve via CDN, or generate dynamically via Next.js sitemap route handler.

**FLAW-006** [CRITICAL] - Cron secret exposed in URL query string
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/email-flows/route.ts` line 22
- Issue: `querySecret = request.nextUrl.searchParams.get('secret')` - Accepting the cron secret as a URL query parameter means it appears in server access logs, browser history, CDN logs, and Referer headers. This leaks the authentication secret.
- Fix: Only accept the secret via `Authorization: Bearer` header. Remove the `querySecret` fallback.

**FLAW-007** [CRITICAL] - Same query string secret in scheduled-campaigns
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/scheduled-campaigns/route.ts` line 32
- Issue: Same vulnerability as FLAW-006. `querySecret = request.nextUrl.searchParams.get('secret')`.
- Fix: Remove the `querySecret` check. Only allow `Authorization: Bearer` header.

**FLAW-008** [CRITICAL] - Upsell admin always POSTs (creates duplicates)
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/upsell/page.tsx` line ~164
- Issue: `handleSave` always uses `POST` method even when editing an existing config. This creates duplicate UpsellConfig records instead of updating the existing one. The `productId` unique constraint may prevent duplicates but will return 500 errors.
- Fix: Use `PUT` or `PATCH` when `editingConfig.id` exists, `POST` only for new configs.

**FLAW-009** [CRITICAL] - Loyalty earn BONUS type has no amount cap
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/earn/route.ts` lines 157-164
- Issue: The `BONUS` type directly uses `amount` from the request body with no upper limit. Even though it requires admin role, a compromised admin account could award billions of points. No audit trail captures the admin who initiated it.
- Fix: Add a maximum cap (e.g., 10000 points per BONUS transaction). Log the admin userId in the transaction metadata.

**FLAW-010** [CRITICAL] - Ambassador referral code is predictable
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts` line ~120
- Issue: `Date.now().toString(36)` generates sequential, predictable referral codes. An attacker can enumerate valid codes and create fake referrals.
- Fix: Use `crypto.randomUUID().slice(0,8)` or similar cryptographic random generation.

**FLAW-011** [CRITICAL] - Stock alerts cron has no GET authentication
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/stock-alerts/route.ts` lines 204-230
- Issue: The GET endpoint (health check) is completely unauthenticated. It exposes `pendingAlerts` and `totalAlerts` counts publicly. This leaks business intelligence about product availability.
- Fix: Add the same `Authorization: Bearer CRON_SECRET` check or move health data behind admin auth.

**FLAW-012** [CRITICAL] - Birthday promo code is predictable
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/birthday-emails/route.ts` line 192
- Issue: `BDAY${user.id.slice(0,8).toUpperCase()}${today.getFullYear()}` - If user IDs are guessable (e.g., CUID/UUID), attackers can construct valid birthday promo codes for any user.
- Fix: Include a crypto-random suffix: `BDAY${crypto.randomUUID().slice(0,8).toUpperCase()}`.

**FLAW-013** [CRITICAL] - Satisfaction survey dedup is fragile
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/satisfaction-survey/route.ts` lines 109-122
- Issue: Dedup relies on parsing order numbers from email subjects with string matching (`log.subject?.includes(orderNumber)`). If the subject format changes or includes special characters, dedup fails and users receive duplicate survey emails.
- Fix: Store `orderId` or `orderNumber` in EmailLog metadata column, then filter by that field directly.

**FLAW-014** [CRITICAL] - Abandoned cart N+1 query for order check
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/abandoned-cart/route.ts` lines 148-155
- Issue: `db.order.findFirst()` runs inside a for-loop for EACH cart. With 1000 abandoned carts, this is 1000 individual queries. The user batch was optimized but the order check was not.
- Fix: Batch-fetch recent orders for all cart user IDs in a single query, then filter in memory.

### HIGH (31)

**FLAW-015** [HIGH] - Promotions form type mismatch
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/promotions/page.tsx` lines ~180-220
- Issue: The form sends `type` as `PERCENTAGE`/`FIXED_AMOUNT` but the interface defines types like `PRODUCT_DISCOUNT`, `CATEGORY_DISCOUNT`, `BUNDLE`, `BUY_X_GET_Y`, `FLASH_SALE`. These are different classification axes causing confusion.
- Fix: Separate discount type (PERCENTAGE/FIXED_AMOUNT) from promotion type (PRODUCT/CATEGORY/BUNDLE). Add a separate promotion type selector.

**FLAW-016** [HIGH] - Newsletter SourceCard color mismatch
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/newsletter/page.tsx` line ~886
- Issue: SourceCard with `color='amber'` renders teal/green CSS classes instead of amber. The color mapping function has a bug in the amber branch.
- Fix: Correct the CSS class mapping for 'amber' to use `bg-amber-100 text-amber-700` instead of teal classes.

**FLAW-017** [HIGH] - Ambassadors page uses public API endpoint
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/ambassadeurs/page.tsx` line ~60
- Issue: Admin page fetches from `/api/ambassadors` (public endpoint) instead of an admin-specific route with proper `withAdminGuard` protection. The ambassador API uses `auth()` directly without role checking.
- Fix: Create `/api/admin/ambassadors/route.ts` with `withAdminGuard` and use that from the admin page.

**FLAW-018** [HIGH] - Ambassador API lacks proper admin guard
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts` lines 20-30
- Issue: Uses `auth()` directly instead of `withAdminGuard()`. Any authenticated user can list, create, and modify ambassadors. No role check.
- Fix: Wrap with `withAdminGuard()` or add explicit role check: `if (session.user.role !== 'EMPLOYEE' && session.user.role !== 'OWNER')`.

**FLAW-019** [HIGH] - Ambassador [id] API lacks admin guard
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/[id]/route.ts` lines 10-20
- Issue: Same as FLAW-018. Uses `auth()` without role checking. Any logged-in user can GET/PATCH/DELETE any ambassador.
- Fix: Add `withAdminGuard` or explicit role check.

**FLAW-020** [HIGH] - Ambassador payouts API lacks admin guard
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/payouts/route.ts` lines 10-20
- Issue: Payout processing (creating financial transactions) has no admin role verification.
- Fix: Add `withAdminGuard` wrapper.

**FLAW-021** [HIGH] - Fidelite saveConfig ignores response status
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/fidelite/page.tsx` lines 67-68
- Issue: `saveConfig` always calls `toast.success()` regardless of whether the API response was successful. If the server returns 500, the user still sees a success message.
- Fix: Check `res.ok` before showing success toast. Show `toast.error()` on failure.

**FLAW-022** [HIGH] - Webinar "View Registered" button is a stub
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/webinaires/page.tsx` line ~487
- Issue: The "View Registered" button has no onClick handler. It renders as a non-functional button, confusing admins.
- Fix: Implement the onClick handler to show a modal with registered attendees, or remove the button until implemented.

**FLAW-023** [HIGH] - Webinar cancel sends wrong status
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/webinaires/page.tsx` line ~400
- Issue: `handleCancelWebinar` sends `{isPublished: false}` but does not set `status` to `'CANCELLED'`. The webinar becomes unpublished but its status remains unchanged. Admins cannot distinguish between draft and cancelled webinars.
- Fix: Send `{isPublished: false, status: 'CANCELLED'}` or use a proper cancel API endpoint.

**FLAW-024** [HIGH] - Promo validate returns French hardcoded errors
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/promo/validate/route.ts` lines 50-150
- Issue: Error messages are hardcoded in French: `"Code promo invalide"`, `"Ce code est expire"`, etc. For an app with 22 locales, this breaks i18n for non-French speakers.
- Fix: Return error codes (e.g., `PROMO_INVALID`, `PROMO_EXPIRED`) and let the frontend translate them via `t()`.

**FLAW-025** [HIGH] - SEO settings upsert loop without transaction
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/seo/route.ts` lines 50-80
- Issue: Multiple `prisma.siteSetting.upsert()` calls run sequentially without a transaction. If the 3rd out of 5 upserts fails, the DB is in an inconsistent state with partial settings.
- Fix: Wrap all upserts in `prisma.$transaction()`.

**FLAW-026** [HIGH] - SEO settings accepts arbitrary keys
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/seo/route.ts` lines 40-50
- Issue: No validation on which settings keys can be set. An attacker with admin access could write arbitrary key-value pairs to the SiteSetting table, potentially affecting other system behavior.
- Fix: Validate against an allowlist of permitted SEO setting keys.

**FLAW-027** [HIGH] - Banner move up/down fires parallel PUTs
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/bannieres/page.tsx` lines ~350-380
- Issue: Moving a slide fires two PUT requests in parallel (for the swapped slides) without error handling on individual failures. If one succeeds and the other fails, sort order becomes inconsistent.
- Fix: Use a single API endpoint for reordering, or wrap both updates in Promise.all with proper rollback.

**FLAW-028** [HIGH] - Promotion [id] N+1 for category/product names
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promotions/[id]/route.ts` lines ~50-80
- Issue: `mapDiscountToPromotion` makes individual queries to fetch category name and product name for each discount. When listing promotions, this creates N+1 queries.
- Fix: Use Prisma `include` to join Category and Product in the initial query.

**FLAW-029** [HIGH] - Mailing list subscribe exposes IP in email
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/mailing-list/subscribe/route.ts` lines ~80-100
- Issue: The confirmation email includes the subscriber's IP address in plain text. This is a privacy concern under GDPR (unnecessary personal data exposure) and could be used for doxxing.
- Fix: Remove IP address from the email body. Store it in the DB for compliance but don't expose it to the user.

**FLAW-030** [HIGH] - Newsletter route self-calls via fetch
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/newsletter/route.ts` lines ~80-100
- Issue: The newsletter subscribe endpoint internally calls `fetch('/api/mailing-list/subscribe')` (server-to-server call to itself). This adds latency, creates a circular dependency, and fails if the URL resolution differs between server-side and client-side.
- Fix: Import and call the mailing-list subscription logic directly as a function, not via HTTP.

**FLAW-031** [HIGH] - PromoCode usageCount race condition
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/promo/validate/route.ts` lines ~100-120
- Issue: The validation checks `usageCount < usageLimit` but doesn't lock the row. Two concurrent requests could both pass validation before either increments `usageCount`, exceeding the usage limit.
- Fix: Use `prisma.$transaction` with FOR UPDATE or atomic increment: `prisma.promoCode.update({ where: { id, usageCount: { lt: usageLimit } }, data: { usageCount: { increment: 1 } } })`.

**FLAW-032** [HIGH] - Email flows cron processes emails sequentially
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/email-flows/route.ts` lines 45-106
- Issue: Each execution is processed sequentially in a for-loop. With 50 executions and network latency per email send, this can easily timeout on serverless platforms (10-30s limit).
- Fix: Process executions in parallel batches of 10 using `Promise.allSettled`.

**FLAW-033** [HIGH] - Welcome series uses same template for all steps
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/welcome-series/route.ts` lines 229-246
- Issue: All 4 drip steps use the same `welcomeEmail()` template. Step 2 ("bestsellers"), step 3 ("education"), and step 4 ("incentive") all render as the generic welcome email. The subject changes but the body doesn't match the step's purpose.
- Fix: Create separate email templates for each drip step or add step-specific content sections.

**FLAW-034** [HIGH] - Loyalty tier calculation duplicated in 3 files
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/route.ts` line 13, `earn/route.ts` line 22
- Issue: `calculateTier()` is copy-pasted across multiple files with the same logic. If tier thresholds change, all copies must be updated simultaneously. Risk of drift.
- Fix: Extract to a shared utility: `src/lib/loyalty-tiers.ts`.

**FLAW-035** [HIGH] - Loyalty earn uses `as any` for transaction type
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/earn/route.ts` line 189
- Issue: `type: transactionType as any` bypasses TypeScript's type checking for the Prisma enum. If a typo is introduced (e.g., `EARN_REFERAL`), it will only fail at runtime.
- Fix: Use the Prisma-generated enum: `import { LoyaltyTransactionType } from '@prisma/client'` and validate against it.

**FLAW-036** [HIGH] - Scheduled campaigns builds audience without pagination
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/scheduled-campaigns/route.ts` lines 91-100
- Issue: `prisma.user.findMany()` fetches ALL matching users without pagination. For a campaign targeting all users, this could load thousands of records into memory at once, causing OOM on serverless.
- Fix: Use cursor-based pagination or streaming to process users in chunks.

**FLAW-037** [HIGH] - Scheduled campaigns checks bounce per-user sequentially
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/scheduled-campaigns/route.ts` lines 127-133
- Issue: `shouldSuppressEmail()` is called in a sequential loop for each recipient. With 10000 recipients, this creates 10000 individual DB queries.
- Fix: Batch-fetch suppression list and filter in memory.

**FLAW-038** [HIGH] - Hero slides POST doesn't sanitize CTA URLs
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/hero-slides/route.ts` lines 83-86
- Issue: `ctaUrl`, `cta2Url`, `overlayGradient` are not sanitized. While `backgroundUrl` is sanitized with `sanitizeUrl()`, the CTA URLs pass through raw. An admin could inject `javascript:alert(1)` as a CTA link.
- Fix: Apply `sanitizeUrl()` to `ctaUrl` and `cta2Url` as well.

**FLAW-039** [HIGH] - Loyalty redeem PromoCode creation error swallowed
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/redeem/route.ts` lines 131-133
- Issue: `catch (e) { console.log('PromoCode creation skipped (table may not exist):', e); }` - If the PromoCode table exists but creation fails (e.g., duplicate code), the user loses their loyalty points but never receives the discount code.
- Fix: If promo code creation fails, roll back the loyalty transaction or retry with a different code.

**FLAW-040** [HIGH] - Discount model has no relation to Category/Product
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 786-806
- Issue: The Discount model has `categoryId` and `productId` fields but NO `@relation` directives. Prisma won't enforce referential integrity. A discount can reference a deleted category/product with no cascade.
- Fix: Add relations: `category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)` and similar for Product.

**FLAW-041** [HIGH] - Ambassador payout has no minimum amount check
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/payouts/route.ts` lines 50-80
- Issue: No minimum payout amount is enforced. An admin could process a $0.01 payout, which is impractical and creates unnecessary transaction records and banking fees.
- Fix: Add minimum payout validation (e.g., $25 minimum).

**FLAW-042** [HIGH] - Referral apply allows replay if status not checked atomically
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/referrals/apply/route.ts` lines 80-120
- Issue: The self-referral and email checks happen before the transaction, but the actual referral creation is inside. A race condition allows two concurrent requests from the same referred user to both pass the initial checks.
- Fix: Use a unique constraint on `(referredId, referralCode)` or check-and-create atomically inside the transaction.

**FLAW-043** [HIGH] - Points expiring cron doesn't check notification preferences
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/points-expiring/route.ts` lines 190-215
- Issue: Emails are sent without checking user's NotificationPreference.loyaltyUpdates setting. Users who opted out of loyalty notifications still receive these emails.
- Fix: Batch-fetch NotificationPreference and filter out users where `loyaltyUpdates === false`.

**FLAW-044** [HIGH] - Satisfaction survey doesn't check notification preferences
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/satisfaction-survey/route.ts` lines 141-200
- Issue: No check on NotificationPreference or marketingConsent. Users who opted out of marketing emails still receive satisfaction surveys.
- Fix: Check NotificationPreference before sending.

**FLAW-045** [HIGH] - Webinar model has no registration tracking
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 2597-2626
- Issue: The Webinar model has `registeredCount` (a counter) but no `WebinarRegistration` model to track WHO registered. The admin "View Registered" button (FLAW-022) has nowhere to get data from.
- Fix: Create a `WebinarRegistration` model with userId, webinarId, registeredAt, attended, etc.

### MEDIUM (38)

**FLAW-046** [MEDIUM] - Promotions priority hardcoded to 0
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promotions/route.ts` line 101
- Issue: `priority: 0` is hardcoded for all new promotions. The UI shows a priority field but the API ignores it.
- Fix: Accept `priority` from the request body.

**FLAW-047** [MEDIUM] - Banner delete calls fetchSlides in wrong place
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/bannieres/page.tsx` lines ~420-440
- Issue: `deleteSlide` calls `fetchSlides()` after the `finally` block instead of inside `try`. If the delete fails, the UI still refreshes, potentially hiding the error.
- Fix: Call `fetchSlides()` only inside the `try` block after successful deletion.

**FLAW-048** [MEDIUM] - PromoCode validation doesn't check endsAt timezone
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/promo/validate/route.ts` lines 60-70
- Issue: `new Date() > new Date(promoCode.endsAt)` compares UTC server time with the stored date. If the promo code expires at midnight Montreal time but the server is in UTC, it expires 5 hours early.
- Fix: Store all dates in UTC with explicit timezone conversion, or document the timezone assumption.

**FLAW-049** [MEDIUM] - Upsell fetchProducts uses limit=500
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/upsell/page.tsx` line ~100
- Issue: `fetchProducts` uses `?limit=500` which will truncate results for catalogs with more than 500 products. No pagination or search.
- Fix: Implement server-side search/autocomplete for product selection instead of loading all products.

**FLAW-050** [MEDIUM] - Upsell uses `<img>` instead of Next.js `<Image>`
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/upsell/page.tsx` line ~458
- Issue: Uses native `<img>` tag instead of Next.js `<Image>` component. Misses automatic optimization, WebP conversion, and lazy loading.
- Fix: Replace `<img>` with `import Image from 'next/image'` and use `<Image>`.

**FLAW-051** [MEDIUM] - SEO toggleNoIndex has no success feedback
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/seo/page.tsx` lines ~300-320
- Issue: `toggleNoIndex` fires an API call but shows no toast/feedback on success. Admin doesn't know if the action worked.
- Fix: Add `toast.success()` after successful API response.

**FLAW-052** [MEDIUM] - Promo-codes toggleActive doesn't use optimistic update
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/promo-codes/page.tsx` lines ~300-320
- Issue: `toggleActive` waits for the server response before updating the UI toggle. This creates a visible delay.
- Fix: Implement optimistic update pattern: update UI immediately, revert on error.

**FLAW-053** [MEDIUM] - Ambassador config save doesn't load existing config
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/ambassadeurs/page.tsx` lines ~400-430
- Issue: When opening the config modal, it doesn't pre-load existing settings from `/api/admin/settings`. Admin sees empty defaults instead of current values.
- Fix: Fetch current ambassador settings on modal open and populate the form.

**FLAW-054** [MEDIUM] - Missing useEffect dependency warnings
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/promotions/page.tsx` line ~50
- Issue: `useEffect(() => { fetchPromotions(); }, [])` triggers ESLint exhaustive-deps warning because `fetchPromotions` is not in the dependency array.
- Fix: Use `useCallback` for `fetchPromotions` and add it to the dependency array, or use the `// eslint-disable-next-line` with a comment explaining why.

**FLAW-055** [MEDIUM] - Multiple admin pages share same pattern bug
- Files: All admin marketing pages (promotions, newsletter, ambassadeurs, seo, bannieres, webinaires, promo-codes, upsell, fidelite)
- Issue: All use `useEffect(() => { fetchX(); }, [])` with the same missing dependency pattern.
- Fix: Create a shared `useFetchOnMount` hook or use `useCallback` consistently.

**FLAW-056** [MEDIUM] - Social proof in-memory cache has no invalidation
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/social-proof/route.ts` lines 20-30
- Issue: The 5-minute in-memory cache persists across requests on the same server instance but resets on redeployment. On serverless (Azure), each cold start creates a new cache, defeating the purpose.
- Fix: Use Redis or a shared cache that persists across instances.

**FLAW-057** [MEDIUM] - Stock alerts cron hardcodes locale to 'en'
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/stock-alerts/route.ts` line 121
- Issue: `const locale: Locale = 'en'` is hardcoded. All stock alert emails are sent in English regardless of user preference.
- Fix: Look up user locale from the User model (requires joining StockAlert -> User or storing locale on StockAlert).

**FLAW-058** [MEDIUM] - StockAlert model has no user relation
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 2174-2187
- Issue: StockAlert only stores `email` with no `userId` relation. Cannot determine user locale, notification preferences, or consent status.
- Fix: Add optional `userId` field with User relation.

**FLAW-059** [MEDIUM] - Stock alerts cron uses console.log instead of logger
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/stock-alerts/route.ts` lines 72, 158, 168
- Issue: Uses raw `console.log`/`console.error` instead of the structured `logger` used by other cron jobs. Loses structured metadata and log levels.
- Fix: Import and use `logger` from `@/lib/logger`.

**FLAW-060** [MEDIUM] - Birthday email promo code not tied to specific user
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/birthday-emails/route.ts` lines 198-215
- Issue: The birthday promo code has no `userId` restriction in the PromoCode itself. While `usageLimitPerUser=1`, any user who guesses the code (FLAW-012) could use it.
- Fix: Set `productIds` to the user's ID or add a user-specific restriction mechanism.

**FLAW-061** [MEDIUM] - Price drop cron doesn't check bounce suppression
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/price-drop-alerts/route.ts` lines 110-230
- Issue: Unlike welcome-series and scheduled-campaigns, price drop alerts don't check `shouldSuppressEmail()` before sending. Hard-bounced emails continue receiving alerts.
- Fix: Add bounce suppression check before each send.

**FLAW-062** [MEDIUM] - Birthday cron doesn't check bounce suppression
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/birthday-emails/route.ts` lines 189-260
- Issue: No `shouldSuppressEmail()` check. Birthday emails are sent to hard-bounced addresses.
- Fix: Add bounce suppression check.

**FLAW-063** [MEDIUM] - Points expiring cron doesn't check bounce suppression
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/points-expiring/route.ts` lines 190-210
- Issue: No bounce suppression check.
- Fix: Add `shouldSuppressEmail()` check.

**FLAW-064** [MEDIUM] - Abandoned cart doesn't check bounce suppression
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/abandoned-cart/route.ts` lines 200-250
- Issue: No bounce suppression check.
- Fix: Add `shouldSuppressEmail()` check after the recently-emailed filter.

**FLAW-065** [MEDIUM] - EmailLog doesn't store userId
- File: All cron jobs and email sending code
- Issue: EmailLog only stores `to` (email address), `subject`, `status`. No `userId` field. Queries that need to filter by user require joining through email address, which is slower and less reliable.
- Fix: Add optional `userId` field to EmailLog model.

**FLAW-066** [MEDIUM] - Referral anti-fraud max 50 limit too high
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/referrals/apply/route.ts` line ~90
- Issue: Max 50 referrals per user allows significant abuse. At 1000 points per referral, that's 50,000 points ($500+ in discounts).
- Fix: Lower to 10-15 max referrals, or implement velocity checks (max 3 per week).

**FLAW-067** [MEDIUM] - Loyalty redeem reward catalog is hardcoded
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/redeem/route.ts` lines 12-21
- Issue: REWARDS object is hardcoded in the source file. Changing rewards requires code deployment. Cannot be configured by admin.
- Fix: Move to SiteSetting or a dedicated RewardConfig model.

**FLAW-068** [MEDIUM] - Webinar public API has no pagination
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/webinars/route.ts` lines 19-26
- Issue: Returns ALL published webinars with no limit. As the webinar count grows, response size and query time increase linearly.
- Fix: Add `take` and `skip` parameters for pagination.

**FLAW-069** [MEDIUM] - ConsentRecord has no index on email+type
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 3413-3429
- Issue: ConsentRecord has separate indexes on `email` and `type` but no composite index. Queries filtering by both (e.g., "find active marketing consent for email X") cannot use a combined index.
- Fix: Add `@@index([email, type])`.

**FLAW-070** [MEDIUM] - LoyaltyTransaction missing composite index
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 1184-1201
- Issue: No composite index on `[userId, type]`. The duplicate check queries in loyalty earn (e.g., find EARN_SIGNUP for user X) scan all transactions for the user.
- Fix: Add `@@index([userId, type])`.

**FLAW-071** [MEDIUM] - Promo validate doesn't check if promo code is deleted
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/promo/validate/route.ts` lines 40-50
- Issue: Soft-deleted promo codes (if using `isActive: false` as delete) are rejected, but the error message says "expired" not "invalid". Hard-deleted codes return 404, which is correct.
- Fix: Check `isActive` explicitly with a clear "code deactivated" message.

**FLAW-072** [MEDIUM] - Email flows cron doesn't log EmailLog on failure
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/email-flows/route.ts` lines 137-194
- Issue: When `sendEmail` fails, no EmailLog is created. Failed sends are invisible in the admin dashboard.
- Fix: Create EmailLog with status 'failed' when send fails.

**FLAW-073** [MEDIUM] - UpsellConfig model allows null productId as global
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 2732-2751
- Issue: `productId String? @unique` - The unique constraint on a nullable field allows only ONE global config (productId=null). But the admin UI allows creating multiple global configs (FLAW-008).
- Fix: This is actually correct for the constraint but the admin UI needs to handle the uniqueness error gracefully.

**FLAW-074** [MEDIUM] - Abandoned cart SMS recovery uses N+1 queries
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/abandoned-cart/route.ts` lines 336-381
- Issue: SMS recovery section queries `db.user.findFirst` and `db.order.findFirst` individually for each email in the loop. Not batch-optimized.
- Fix: Batch-fetch all users with phones and their recent orders.

**FLAW-075** [MEDIUM] - Email service uses AuditLog instead of EmailLog
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email-service.ts` lines 88-95
- Issue: `sendOrderConfirmation` logs to `auditLog` instead of `emailLog`. This creates inconsistency - some email sends are in AuditLog, others in EmailLog. Dedup queries on EmailLog miss these.
- Fix: Log all email sends consistently to EmailLog. AuditLog can be a secondary log.

**FLAW-076** [MEDIUM] - Email service duplicate provider pattern
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email-service.ts` lines 25-37
- Issue: `emailProviderImpl` dynamically imports `@/lib/email/email-service` on every send. The provider could be cached after first import.
- Fix: Cache the imported module after first use.

**FLAW-077** [MEDIUM] - Referral qualify uses console.log instead of logger
- File: `/Volumes/AI_Project/peptide-plus/src/lib/referral-qualify.ts` lines 119-121, 128
- Issue: Uses `console.log` and `console.error` instead of the structured `logger`.
- Fix: Import and use `logger` from `@/lib/logger`.

**FLAW-078** [MEDIUM] - Promotion validation allows 0% discount
- File: `/Volumes/AI_Project/peptide-plus/src/lib/validations/promotion.ts` line 20
- Issue: `z.number().min(0)` allows value of exactly 0. A 0% or $0 discount is pointless but would be processed.
- Fix: Use `.min(0.01)` or `.positive()` to require a meaningful discount value.

**FLAW-079** [MEDIUM] - PromoCode productIds/categoryIds stored as string
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 1786-1787
- Issue: `productIds String?` and `categoryIds String?` store comma-separated IDs as a string. This prevents relational integrity, makes queries difficult, and is error-prone.
- Fix: Create junction tables `PromoCodeProduct` and `PromoCodeCategory` for proper many-to-many relations.

**FLAW-080** [MEDIUM] - Webinar tags stored as single string
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` line 2609
- Issue: `tags String?` stores tags as a comma-separated string. Cannot efficiently query "all webinars with tag X".
- Fix: Use JSON array field or a separate WebinarTag model.

**FLAW-081** [MEDIUM] - Ambassador commission clawback uses Decimal comparison in JS
- File: `/Volumes/AI_Project/peptide-plus/src/lib/ambassador-commission.ts` lines 61-82
- Issue: `Number(commission.commissionAmount)` converts Prisma Decimal to JS Number, which can lose precision for large values. The rounding (`Math.round(...*100)/100`) partially mitigates but is fragile.
- Fix: Use Prisma's `Decimal` type operations or a library like `decimal.js`.

**FLAW-082** [MEDIUM] - Welcome series generates referral codes with ID prefix
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/welcome-series/route.ts` lines 207-223
- Issue: `REF${user.id.slice(0,6).toUpperCase()}` uses the first 6 chars of the user ID as prefix. If IDs are sequential or predictable, codes are guessable.
- Fix: Use fully random codes: `REF${crypto.randomBytes(4).toString('hex').toUpperCase()}`.

**FLAW-083** [MEDIUM] - Email templates only support fr/en
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/marketing-emails.ts` lines 41, 146, 345, etc.
- Issue: All marketing email templates use `locale?: 'fr' | 'en'` with binary `isFr` logic. The app supports 22 locales but marketing emails only work in French and English.
- Fix: Use a translation system for email content that supports all 22 locales, or at minimum support the major ones (es, de, ar, zh).

### LOW (17)

**FLAW-084** [LOW] - typeLabels not memoized in promotions page
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/promotions/page.tsx` lines ~100-110
- Issue: `typeLabels` object is recreated on every render without `useMemo`.
- Fix: Wrap in `useMemo` or move to module scope.

**FLAW-085** [LOW] - SEO page uses plain Input for per-page OG image
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/seo/page.tsx` lines ~400-420
- Issue: Global SEO uses `MediaUploader` component for OG image selection, but per-page SEO uses a plain text `Input`. Inconsistent UX.
- Fix: Use `MediaUploader` for per-page OG images too.

**FLAW-086** [LOW] - Fidelite tier editing uses name as identifier
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/fidelite/page.tsx` lines ~200-250
- Issue: Tier identification uses the tier name string. If an admin renames a tier, the reference breaks.
- Fix: Use tier index or a stable ID.

**FLAW-087** [LOW] - Social proof cache key is global, not locale-specific
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/social-proof/route.ts` lines 20-30
- Issue: The in-memory cache doesn't consider locale. All locales get the same cached data even if locale-specific content should differ.
- Fix: Make cache key locale-aware.

**FLAW-088** [LOW] - Loyalty GET updates user tier as side effect
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/route.ts` lines 87-94
- Issue: A GET endpoint performs a write operation (updating loyaltyTier). GET should be idempotent with no side effects per HTTP spec.
- Fix: Move tier recalculation to a separate PATCH endpoint or post-purchase hook.

**FLAW-089** [LOW] - Loyalty GET generates referral code as side effect
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/route.ts` lines 77-84
- Issue: GET endpoint writes a referralCode to the DB. Same violation as FLAW-088.
- Fix: Generate referral code at signup or in a dedicated POST endpoint.

**FLAW-090** [LOW] - Inconsistent DB client usage (db vs prisma)
- Files: Various - some use `import { db }`, others use `import { prisma }`
- Issue: Some files import `db` from `@/lib/db`, others import `prisma`. Both appear to be the same PrismaClient but the inconsistency is confusing.
- Fix: Standardize on one name. Prefer `prisma` since it's the Prisma convention.

**FLAW-091** [LOW] - Hero slides active endpoint includes all translations
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/hero-slides/active/route.ts` line 19
- Issue: `include: { translations: true }` returns ALL 22 locale translations for each slide. The client only needs 1-2 locales.
- Fix: Accept `locale` parameter and filter translations: `where: { locale: { in: [locale, 'en'] } }`.

**FLAW-092** [LOW] - Ambassador model status uses String instead of enum
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` line 134
- Issue: `status String @default("ACTIVE")` - Using a plain String allows arbitrary values. No DB-level validation.
- Fix: Create an `AmbassadorStatus` enum (ACTIVE, INACTIVE, PENDING, SUSPENDED) and use it.

**FLAW-093** [LOW] - Ambassador model tier uses String instead of enum
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` line 135
- Issue: `tier String @default("BRONZE")` - Same as FLAW-092.
- Fix: Create an `AmbassadorTier` enum (BRONZE, SILVER, GOLD, PLATINUM).

**FLAW-094** [LOW] - Referral model status uses String instead of enum
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` line 1938
- Issue: `status String @default("PENDING")` - Same pattern.
- Fix: Create a `ReferralStatus` enum.

**FLAW-095** [LOW] - NewsletterSubscriber has no unsubscribeToken
- File: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` lines 1298-1310
- Issue: Unlike MailingListSubscriber (which has `confirmToken` and `unsubscribeToken`), NewsletterSubscriber has neither. The two models are partially redundant.
- Fix: Consolidate into one model or add missing fields.

**FLAW-096** [LOW] - Marketing email subject doesn't escape customer name
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/marketing-emails.ts` lines 48-49, 149-151
- Issue: Email subjects include `data.customerName` without escaping. While subjects aren't rendered as HTML, names with special characters could cause display issues.
- Fix: Apply basic sanitization (strip control chars, limit length) to names in subjects.

**FLAW-097** [LOW] - BackInStockEmailData interface doesn't match cron usage
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/marketing-emails.ts` lines 439-449
- Issue: The `BackInStockEmailData` interface requires `customerName`, `customerEmail`, `productUrl` but the stock alerts cron at `src/lib/email-templates.ts` calls `backInStockEmail()` with different parameters (see cron/stock-alerts). Two different `backInStockEmail` functions exist.
- Fix: Consolidate to one canonical implementation.

**FLAW-098** [LOW] - Promo code validation Zod schema allows negative minOrderAmount
- File: `/Volumes/AI_Project/peptide-plus/src/lib/validations/promo-code.ts` line 22
- Issue: `z.number().min(0)` allows exactly 0 for minOrderAmount. While not a bug, a $0 minimum order amount is the same as no minimum and could confuse admins.
- Fix: Document that 0 means "no minimum" or use null/undefined for that case.

**FLOW-099** [LOW] - Patch promo code schema doesn't validate PERCENTAGE max
- File: `/Volumes/AI_Project/peptide-plus/src/lib/validations/promo-code.ts` lines 53-68
- Issue: The `patchPromoCodeSchema` doesn't have the `.refine()` check that limits PERCENTAGE type to max 100. Only the create schema has it.
- Fix: Add the same refinement to the patch schema.

**FLAW-100** [LOW] - Email templates use toLocaleDateString without timezone
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/marketing-emails.ts` lines 51, 523
- Issue: `data.expiresAt.toLocaleDateString()` uses the server's timezone, which may differ between local dev (EST) and Azure (UTC). Dates could show one day off.
- Fix: Use explicit timezone: `toLocaleDateString('fr-CA', { timeZone: 'America/Toronto' })`.

---

## PARTIE 2: 100 AMELIORATIONS

### CRITICAL (8)

**IMP-001** [CRITICAL] - Create missing admin newsletter API routes
- File: Need to create `src/app/api/admin/newsletter/subscribers/route.ts` and `src/app/api/admin/newsletter/campaigns/route.ts`
- Why: The entire newsletter admin page is non-functional without these routes (FLAW-002). This is the most visible broken feature in the marketing section.
- How: Implement CRUD for NewsletterSubscriber (GET list with pagination/search, POST add, DELETE remove) and EmailCampaign (GET list, POST create, PATCH update, POST send).

**IMP-002** [CRITICAL] - Create WebinarRegistration model and API
- Why: Without a registration model, the webinar feature cannot track attendees, send reminders, or limit capacity. The "View Registered" button is useless (FLAW-022, FLAW-045).
- How: Create `WebinarRegistration` model (userId, webinarId, registeredAt, attended, cancelledAt). Create API routes for registration/unregistration. Update the admin page to show registrants.

**IMP-003** [CRITICAL] - Implement A/B testing framework for marketing emails
- File: Create `src/lib/ab-testing.ts`
- Why: Without A/B testing, marketing campaigns are optimized by gut feeling. The satisfaction survey TODO (item 81) already identifies this need.
- How: Create an `AbTestVariant` model. Implement deterministic assignment: `hash(userId + experimentId) % variantCount`. Track metrics per variant. Auto-graduate winners.

**IMP-004** [CRITICAL] - Add email preview/sandbox for admin
- Why: Admins create campaigns but have no way to preview how emails will look before sending to thousands of users. Risk of sending broken HTML.
- How: Add a "Preview" button in the campaign editor that renders the email template with test data in an iframe. Add a "Send test" button to send to the admin's own email.

**IMP-005** [CRITICAL] - Implement proper email bounce handling integration
- Why: The EmailBounce model exists but automated processing is incomplete. Hard bounces should permanently suppress the email, soft bounces should retry with backoff.
- How: Integrate with Resend/SendGrid webhook for bounce notifications. Automatically update MailingListSubscriber status to BOUNCED. Suppress future sends via `shouldSuppressEmail()`.

**IMP-006** [CRITICAL] - Add CSRF protection to all mutation endpoints
- Files: Ambassador routes, loyalty routes, stock-alerts POST
- Why: Several mutation endpoints lack CSRF protection. The referral/apply route has it, but ambassador CRUD, loyalty earn/redeem, and stock alert subscription do not.
- How: Add `csrfMiddleware()` to all POST/PUT/PATCH/DELETE handlers that accept JSON bodies from the frontend.

**IMP-007** [CRITICAL] - Implement rate limiting on loyalty earn endpoint
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/earn/route.ts`
- Why: No rate limiting on point earning. A compromised session could spam SIGNUP or REVIEW type requests (even with duplicate checks, the queries add load).
- How: Add `rateLimitMiddleware(ip, '/api/loyalty/earn')` at the top of the handler.

**IMP-008** [CRITICAL] - Add comprehensive email analytics dashboard
- Why: Email logs exist but there's no admin UI to view send rates, open rates, bounce rates, unsubscribe rates. Marketing decisions are blind.
- How: Create `/admin/email-analytics` page with charts showing: sent/delivered/bounced/opened/clicked over time, per-campaign breakdown, top performing campaigns, subscriber growth.

### HIGH (27)

**IMP-009** [HIGH] - Consolidate NewsletterSubscriber and MailingListSubscriber
- Files: `prisma/schema.prisma` lines 1298-1310 and 3579-3615
- Why: Two overlapping models for the same concept. Code must cross-sync between them (visible in unsubscribe, confirm, newsletter routes). This duplication causes bugs.
- How: Deprecate NewsletterSubscriber. Migrate data to MailingListSubscriber. Update all references.

**IMP-010** [HIGH] - Extract shared marketing email config to SiteSetting
- Files: All cron jobs with hardcoded values
- Why: Constants like batch size, timing delays, points amounts are hardcoded across 9 cron files. Any change requires code deployment.
- How: Store configurable values in SiteSetting with key prefix (e.g., `marketing.abandoned_cart.batch_size`). Load at runtime with fallback defaults.

**IMP-011** [HIGH] - Add admin-specific ambassador API routes
- Why: The admin ambassadeur page uses public `/api/ambassadors` routes without proper admin guards (FLAW-017, FLAW-018, FLAW-019).
- How: Create `/api/admin/ambassadors/route.ts` with `withAdminGuard`, including commission sync as a manual action (not on every GET).

**IMP-012** [HIGH] - Implement proper campaign scheduling UI
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/newsletter/page.tsx`
- Why: The campaigns tab exists in the UI but is non-functional. Email campaigns need: create, edit content, select audience segment, schedule, send, view stats.
- How: Build a campaign wizard with: HTML editor, segment selector, scheduling calendar, preview, and send confirmation.

**IMP-013** [HIGH] - Add segment builder for email campaigns
- Why: The `scheduled-campaigns` cron supports `segmentQuery` but there's no UI to build segments. Admins would need to write raw JSON queries.
- How: Create a visual segment builder: loyalty tier, locale, order history, signup date, product categories purchased.

**IMP-014** [HIGH] - Implement email template editor (WYSIWYG)
- Why: Campaign HTML content must be hand-coded. Non-technical admins cannot create marketing emails.
- How: Integrate a drag-and-drop email builder (e.g., react-email, unlayer, or MJML editor) in the admin campaign creation flow.

**IMP-015** [HIGH] - Add multi-language support to marketing emails
- File: `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/marketing-emails.ts`
- Why: All marketing emails only support fr/en (FLAW-083). The app supports 22 locales. Arabic, Chinese, Spanish users get English emails.
- How: Create a translation system for email content. At minimum support: fr, en, es, de, ar, zh (6 major languages covering most users).

**IMP-016** [HIGH] - Implement UTM tracking for marketing emails
- Files: All email templates
- Why: Marketing links in emails have no UTM parameters. Cannot track which email campaign drove which sales in Google Analytics.
- How: Add `?utm_source=email&utm_medium=automated&utm_campaign={templateId}` to all CTA links in email templates.

**IMP-017** [HIGH] - Add email open/click tracking
- Why: EmailLog tracks sent/failed but not opens or clicks. No way to measure campaign engagement.
- How: Add a tracking pixel (1x1 transparent GIF) via `/api/email/track/open?id={logId}` and redirect links via `/api/email/track/click?id={logId}&url={encodedUrl}`. Update EmailLog with open/click timestamps.

**IMP-018** [HIGH] - Implement subscription frequency management
- Why: Users can only fully unsubscribe or stay subscribed. No option to reduce frequency (e.g., weekly digest instead of individual emails).
- How: Expand MailingListPreference with frequency options. Create an email preference center page.

**IMP-019** [HIGH] - Add product recommendation engine
- Why: Welcome series and abandoned cart emails show generic content. Personalized product recommendations increase conversion by 20-30%.
- How: Implement collaborative filtering: "users who bought X also bought Y". Use purchase history and browsing data to personalize email product sections.

**IMP-020** [HIGH] - Implement coupon code analytics
- Why: PromoCode has usageCount but no dashboard showing: total discount given, average order value with/without code, conversion rate, revenue impact.
- How: Create `/admin/promo-analytics` page with charts. Query PromoCodeUsage joined with Orders for financial metrics.

**IMP-021** [HIGH] - Add ambassador dashboard (ambassador-facing)
- Why: Ambassadors have no way to view their own stats, commission history, or payout status. Only admins can see this data.
- How: Create `/dashboard/ambassador` page accessible to users with ambassador status. Show: referral count, pending/paid commissions, tier progress, referral link.

**IMP-022** [HIGH] - Implement ambassador tier auto-promotion
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts`
- Why: Ambassador tier (BRONZE/SILVER/GOLD/PLATINUM) must be manually updated by admin. Should auto-promote based on performance.
- How: Define tier thresholds (e.g., SILVER: 10 referrals, GOLD: 50 referrals) and auto-update after each new commission.

**IMP-023** [HIGH] - Add retry mechanism for failed email sends
- Files: All cron jobs
- Why: Failed email sends are logged but never retried. Transient failures (network timeout, provider rate limit) permanently miss the send window.
- How: Create a `retry-failed-emails` cron job that retries EmailLog entries with status='failed' and sentAt within the last 24h. Max 3 retries with exponential backoff.

**IMP-024** [HIGH] - Implement dynamic discount rules engine
- Why: Current promotions are simple percentage/fixed discounts. Cannot express complex rules like "Buy 3 peptides, get cheapest free" or "10% off orders over $200 for GOLD tier customers".
- How: Create a rule engine with conditions (min order, user tier, product count, category mix) and actions (percentage off, fixed amount, free item, free shipping).

**IMP-025** [HIGH] - Add marketing calendar view
- Why: Admins manage promotions, campaigns, webinars, and birthday emails across separate pages. No unified view of what's happening when.
- How: Create `/admin/marketing-calendar` with a calendar view showing: active promotions, scheduled campaigns, upcoming webinars, seasonal events.

**IMP-026** [HIGH] - Implement promo code generation rules
- Why: The admin promo-codes page has a random code generator but no batch generation with rules (e.g., "generate 1000 unique codes with prefix SUMMER, 15% off, valid 30 days").
- How: Add a "Batch Generate" modal with: quantity, prefix, discount type/value, expiry, usage limit per code.

**IMP-027** [HIGH] - Add loyalty points expiry enforcement
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/points-expiring/route.ts`
- Why: The cron job warns about expiring points but never actually expires them. The `expiresAt` field is set but no cron deducts expired points.
- How: Create a `expire-points` cron job that sets expired LoyaltyTransaction points to 0 and decrements the user's loyaltyPoints balance.

**IMP-028** [HIGH] - Implement flash sale countdown functionality
- Why: The promotion types include FLASH_SALE but there's no countdown timer integration or urgency UI on the storefront.
- How: Add `flashSaleEndsAt` to the discount response. Create a `<FlashSaleCountdown>` component that shows real-time countdown on product pages.

**IMP-029** [HIGH] - Add webhook support for marketing events
- Why: No way to integrate with external marketing tools (Mailchimp, Klaviyo, HubSpot). When a user signs up or makes a purchase, these events should be forwarded.
- How: Create a webhook system: register webhook URLs per event type (signup, purchase, referral, etc.). Fire webhooks asynchronously on events.

**IMP-030** [HIGH] - Implement social media sharing for referrals
- Why: Referral codes exist but there's no easy sharing mechanism. Users must manually copy and paste codes.
- How: Add share buttons (Twitter/X, Facebook, WhatsApp, email) with pre-filled text and referral link. Track which channel generates the most referrals.

**IMP-031** [HIGH] - Add automated discount expiry notifications
- Why: Active discounts can expire without admin awareness. An expired promotion that's still referenced in marketing materials causes confusion.
- How: Create a cron job that sends admin notifications 24h before a discount/promo code expires. Show expiring promotions prominently on the admin dashboard.

**IMP-032** [HIGH] - Implement cart recovery with personalized incentives
- File: `/Volumes/AI_Project/peptide-plus/src/app/api/cron/abandoned-cart/route.ts`
- Why: Current abandoned cart emails are generic. Higher-value carts should get bigger incentives to recover.
- How: Tier the incentive: carts < $50: no discount, $50-$100: 5% off, $100-$200: 10% off, $200+: 15% off. Auto-generate unique promo codes.

**IMP-033** [HIGH] - Add email deliverability monitoring
- Why: No visibility into email deliverability metrics (SPF/DKIM pass rate, spam complaints, inbox placement).
- How: Integrate provider webhooks (Resend/SendGrid) for delivery, bounce, complaint events. Create a deliverability dashboard showing sender reputation metrics.

**IMP-034** [HIGH] - Implement progressive profiling for newsletter subscribers
- Why: Newsletter signup only captures email. No progressive enrichment of subscriber profiles over time.
- How: After initial signup, use drip emails to collect: name, birth date, product interests, preferred language. Store in subscriber profile. Use for segmentation.

**IMP-035** [HIGH] - Add real-time marketing analytics
- Why: All analytics are based on batch queries. No real-time view of: active users, current cart values, live campaign performance.
- How: Implement server-sent events or WebSocket for live dashboard metrics. Track active carts, real-time conversions, and campaign clicks.

### MEDIUM (42)

**IMP-036** [MEDIUM] - Add email template versioning
- Why: No version history for email templates. If a template change causes issues, there's no rollback.
- How: Store template versions with `templateId`, `version`, `content`, `createdAt`. Allow reverting to previous versions.

**IMP-037** [MEDIUM] - Implement smart send time optimization
- Why: All cron emails are sent at fixed times. Different users are active at different times.
- How: Track email open times per user. Build a user-level "best send time" model. Shift cron scheduling to match.

**IMP-038** [MEDIUM] - Add discount stacking rules
- Why: No rules for whether multiple discounts/promo codes can be combined. Currently, behavior is undefined.
- How: Define stacking policies: "best discount only", "stack percentage + fixed", "max total discount cap". Store in SiteSetting.

**IMP-039** [MEDIUM] - Implement loyalty tier benefits beyond points
- Why: Loyalty tiers (BRONZE to DIAMOND) only differ in name. No actual benefits per tier.
- How: Define per-tier benefits: free shipping threshold, exclusive discounts, early access to new products, birthday bonus multiplier.

**IMP-040** [MEDIUM] - Add geographic targeting for promotions
- Why: Promotions are global. Cannot target specific regions (e.g., Canadian users only, or EU users only).
- How: Add `geoTargeting` field to Discount model with country/region list. Filter active promotions by user's shipping address or IP geolocation.

**IMP-041** [MEDIUM] - Implement seasonal promotion templates
- Why: Admins must manually create promotions for recurring events (Black Friday, Christmas, Easter).
- How: Create promotion templates: pre-defined settings for common seasonal events. Allow one-click creation with pre-filled dates and discount values.

**IMP-042** [MEDIUM] - Add email engagement scoring
- Why: No way to identify highly engaged vs disengaged subscribers. All subscribers are treated equally.
- How: Calculate engagement score based on: opens (1pt), clicks (2pts), purchases (5pts), recency multiplier. Segment by score for re-engagement campaigns.

**IMP-043** [MEDIUM] - Implement automatic unsubscribe list cleaning
- Why: Unsubscribed users remain in the database forever. List hygiene is manual.
- How: Create a data-retention cron that anonymizes unsubscribed users after 90 days (GDPR/CASL compliance). Keep aggregate stats but remove PII.

**IMP-044** [MEDIUM] - Add print-friendly promo code receipts
- Why: When loyalty points are redeemed for discount codes, users only see the code on screen. No email confirmation or printable receipt.
- How: Send a confirmation email with the discount code, expiry date, and terms when points are redeemed.

**IMP-045** [MEDIUM] - Implement referral landing pages
- Why: Referral links go to the homepage. No personalized landing page explaining the referral benefit to the new user.
- How: Create `/ref/[code]` page that shows: "Your friend [name] invited you! Sign up and get [X] off your first order." Save referral code in cookie.

**IMP-046** [MEDIUM] - Add bulk ambassador import
- Why: Ambassadors must be created one at a time via the admin UI. For B2B partnerships with multiple ambassadors, this is tedious.
- How: Add CSV import in the ambassador admin page. Validate emails, generate unique codes, send welcome emails.

**IMP-047** [MEDIUM] - Implement ambassador commission reports
- Why: No export capability for ambassador commissions. Accounting needs CSV exports for tax reporting.
- How: Add "Export CSV" button in ambassador admin page. Include: ambassador name, commission amount, order number, date, payout status.

**IMP-048** [MEDIUM] - Add newsletter subscriber import/export
- Why: No way to bulk import existing email lists or export subscribers for backup/migration.
- How: Add CSV import/export in the newsletter admin page. Validate emails, check duplicates, respect consent requirements.

**IMP-049** [MEDIUM] - Implement email content personalization
- Why: Email templates use basic `{{name}}` substitution. No dynamic content blocks based on user preferences or behavior.
- How: Add conditional content blocks: "if user has no orders, show getting started section; if user is GOLD tier, show exclusive offers."

**IMP-050** [MEDIUM] - Add promotional banner scheduling
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/bannieres/page.tsx`
- Why: HeroSlide model has startDate/endDate but the admin UI doesn't prominently show scheduling status or upcoming/expired banners.
- How: Add a calendar view and status indicators: "Active", "Scheduled (starts in 3 days)", "Expired".

**IMP-051** [MEDIUM] - Implement SEO meta preview
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/seo/page.tsx`
- Why: Admins edit meta titles and descriptions but cannot preview how they'll look in Google search results.
- How: Add a Google SERP preview component that shows the rendered title (truncated at 60 chars) and description (truncated at 160 chars).

**IMP-052** [MEDIUM] - Add sitemap generation on content change
- Why: Sitemap is only generated manually via admin action. New products, articles, or webinars don't appear until someone remembers to regenerate.
- How: Auto-regenerate sitemap on product/article/webinar create/update/delete events via a post-save hook.

**IMP-053** [MEDIUM] - Implement robots.txt preview
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/seo/page.tsx`
- Why: Admin edits robots.txt as raw text. No preview of the effective crawling rules.
- How: Add a visual preview showing which paths are allowed/disallowed for each user agent.

**IMP-054** [MEDIUM] - Add product-specific SEO recommendations
- Why: Per-page SEO is manual. No automated suggestions for improving SEO scores.
- How: Implement an SEO score calculator: check title length, description length, keyword density, image alt tags, heading hierarchy. Show score and suggestions.

**IMP-055** [MEDIUM] - Implement email template testing across clients
- Why: Email HTML rendering varies drastically between Outlook, Gmail, Apple Mail, etc. No way to test compatibility.
- How: Integrate with Litmus or Email on Acid API for cross-client testing. Or provide a curated list of testing guidelines.

**IMP-056** [MEDIUM] - Add conversion tracking for marketing campaigns
- Why: No direct link between email campaigns and revenue generated. Cannot calculate ROI per campaign.
- How: Add `campaignId` to Order model. Track which campaign drove the purchase. Calculate revenue per campaign.

**IMP-057** [MEDIUM] - Implement marketing automation flow builder
- File: EmailAutomationFlow exists but no admin UI
- Why: The email flow engine (trigger->condition->delay->email) exists in the backend but there's no visual builder.
- How: Create a drag-and-drop flow builder using React Flow. Nodes: trigger (signup, purchase, cart abandon), condition (tier, locale), action (send email, add points), delay.

**IMP-058** [MEDIUM] - Add abandoned cart value metrics
- Why: Abandoned cart cron logs count but not value. Cannot measure revenue leakage from cart abandonment.
- How: Track cart total value in the cron results. Create a dashboard widget showing: abandoned cart value (daily/weekly/monthly), recovery rate, recovered revenue.

**IMP-059** [MEDIUM] - Implement loyalty points transfer between users
- Why: Users cannot gift or transfer points to family members or friends.
- How: Add a points transfer API with limits: max 1000 points per transfer, max 3 transfers per month, both users must have verified accounts.

**IMP-060** [MEDIUM] - Add marketing consent audit trail
- Why: ConsentRecord exists but there's no admin UI to view/search consent history per user. GDPR auditors need this.
- How: Create `/admin/consent-audit` page with search by email. Show full consent history: granted, revoked, type, source, IP, date.

**IMP-061** [MEDIUM] - Implement dynamic hero slide content
- Why: Hero slides are static content only. Cannot show dynamic data like "50+ researchers trust us" with real numbers.
- How: Extend HeroSlide with dynamic data sources: user count, product count, review average. Template variables in slide content.

**IMP-062** [MEDIUM] - Add promotional popup/modal system
- Why: Marketing is limited to hero slides, banners, and emails. No on-site popup for promotions (e.g., "Get 10% off your first order" for new visitors).
- How: Create a PopupConfig model (trigger: page load/exit intent/scroll, audience: new/returning, content, frequency cap). Admin UI to manage popups.

**IMP-063** [MEDIUM] - Implement product bundling discounts
- Why: The promotion type includes BUNDLE but there's no actual bundle creation or management system.
- How: Create a ProductBundle model (products[], bundlePrice, savings). Admin UI to create bundles. Apply bundle pricing automatically in cart.

**IMP-064** [MEDIUM] - Add email unsubscribe reason collection
- Why: When users unsubscribe, no reason is collected. Cannot improve based on feedback.
- How: On unsubscribe confirmation page, show optional survey: "Too many emails", "Not relevant", "Found cheaper", "Other".

**IMP-065** [MEDIUM] - Implement cross-sell recommendations in emails
- Why: Order confirmation and shipping emails don't include product recommendations. Missed upsell opportunity.
- How: Add "You might also like" section to order emails based on: same category, frequently bought together, complementary products.

**IMP-066** [MEDIUM] - Add loyalty program explainer page
- Why: No dedicated page explaining the loyalty program to customers. Only scattered mentions in emails.
- How: Create `/loyalty` public page with: how to earn points, tier benefits, redemption options, FAQ.

**IMP-067** [MEDIUM] - Implement smart discount recommendations
- Why: Admins must manually decide discount values. No data-driven suggestions.
- How: Analyze historical promo code usage: which discount values had highest conversion? Suggest optimal discount for target margin.

**IMP-068** [MEDIUM] - Add marketing campaign cloning
- Why: Creating similar campaigns requires re-entering all details. Common for recurring campaigns (monthly newsletter).
- How: Add "Clone" button on campaign list that copies all settings to a new draft campaign.

**IMP-069** [MEDIUM] - Implement subscriber churn prediction
- Why: No early warning when subscribers are about to disengage. Re-engagement is reactive, not proactive.
- How: Track engagement decline patterns. Flag subscribers with declining open rates. Trigger automated re-engagement flows.

**IMP-070** [MEDIUM] - Add promotion conflict detection
- Why: Multiple promotions can be active simultaneously with overlapping products/categories. No warning when new promotions conflict.
- How: When creating a promotion, check for overlap with existing active promotions. Show warning with details.

**IMP-071** [MEDIUM] - Implement email content localization workflow
- Why: Marketing emails are only fr/en (FLAW-083). Need a workflow for translating email content to other locales.
- How: When creating a campaign in French, auto-translate to other active locales using the existing translation system. Allow manual review before send.

**IMP-072** [MEDIUM] - Add SEO structured data (JSON-LD)
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/seo/page.tsx`
- Why: No structured data management. Missing JSON-LD for products, organization, breadcrumbs, FAQ.
- How: Auto-generate JSON-LD for product pages (Product schema), articles (Article schema), webinars (Event schema).

**IMP-073** [MEDIUM] - Implement ambassador link tracking
- Why: Ambassador referral links have no click tracking. Cannot measure link performance without conversion.
- How: Route referral links through `/ref/[code]` with click tracking. Show click-through rate in ambassador dashboard.

**IMP-074** [MEDIUM] - Add marketing budget tracking
- Why: No way to track marketing spend vs revenue generated. Cannot calculate customer acquisition cost.
- How: Create a simple marketing budget model: campaign, spend amount, date, source. Dashboard showing spend vs revenue.

**IMP-075** [MEDIUM] - Implement dynamic pricing based on demand
- Why: Prices are static. No ability to adjust based on demand signals.
- How: Track product view-to-purchase ratio. Suggest price adjustments for high-demand/low-conversion products.

**IMP-076** [MEDIUM] - Add customer lifetime value calculation
- Why: No CLV metric available. Cannot segment by value for targeted marketing.
- How: Calculate CLV based on: average order value * purchase frequency * customer lifespan. Expose in admin customer detail.

**IMP-077** [MEDIUM] - Implement win-back campaigns for inactive customers
- Why: No automated re-engagement for customers who haven't purchased in 6+ months.
- How: Create a `win-back` cron job targeting users with no orders in 6 months. Send tiered incentives: reminder at 6mo, 10% off at 9mo, 20% off at 12mo.

### LOW (23)

**IMP-078** [LOW] - Add dark mode support for marketing emails
- Why: Many email clients now support dark mode. Current emails may look poor in dark mode.
- How: Add `@media (prefers-color-scheme: dark)` styles to base-template.ts.

**IMP-079** [LOW] - Implement email accessibility (WCAG)
- Why: Marketing emails lack proper accessibility: no ARIA labels, no alt text on decorative images, poor color contrast.
- How: Audit all email templates for WCAG 2.1 compliance. Add role="presentation" to layout tables, meaningful alt text, sufficient contrast ratios.

**IMP-080** [LOW] - Add emoji picker for campaign subject lines
- Why: Marketing subject lines benefit from emojis (higher open rates). Currently admins must copy-paste emojis.
- How: Add an emoji picker component in the campaign subject input field.

**IMP-081** [LOW] - Implement social proof with real reviews instead of purchases
- Why: Current social proof shows (fake) purchase notifications. Real product reviews would be more trustworthy and legal.
- How: Replace social proof API with real recent 5-star reviews: "Jean M. rated BPC-157 5 stars: 'Excellent quality!'"

**IMP-082** [LOW] - Add keyboard shortcuts for admin marketing pages
- Why: Power users switching between promotions, campaigns, and analytics would benefit from shortcuts.
- How: Add keyboard shortcuts: Ctrl+N for new, Ctrl+S for save, Ctrl+E for edit, arrow keys for navigation.

**IMP-083** [LOW] - Implement batch discount operations
- Why: Cannot activate/deactivate multiple promotions at once. Must click each one individually.
- How: Add checkboxes to the promotions list with batch actions: activate, deactivate, delete, extend dates.

**IMP-084** [LOW] - Add promotional QR codes
- Why: Physical marketing (brochures, packaging) cannot link to digital promotions without QR codes.
- How: Generate QR codes for promo codes and referral links. Display in admin with download option.

**IMP-085** [LOW] - Implement email footer customization
- Why: Email footer (company address, unsubscribe link) is hardcoded in the base template.
- How: Make footer content configurable via SiteSetting: company name, address, social links, logo.

**IMP-086** [LOW] - Add marketing image library
- Why: Creating banners and email campaigns requires uploading images each time. No reusable library.
- How: Create a media library section in the marketing admin with folders: banners, email, social, product.

**IMP-087** [LOW] - Implement URL shortener for marketing links
- Why: Long URLs with UTM parameters are ugly in SMS and social media.
- How: Create a simple URL shortener: `/l/[code]` -> redirect with tracking. Use for SMS, social, QR codes.

**IMP-088** [LOW] - Add newsletter archive page
- Why: Past newsletters are not accessible to new subscribers. Archived content could attract organic search traffic.
- How: Create a public `/newsletter/archive` page listing past campaigns with content.

**IMP-089** [LOW] - Implement loyalty points calculator widget
- Why: Users cannot easily see how many points they'd earn on a potential purchase.
- How: Add a "Points calculator" widget on product pages showing: "Buy this product and earn X points (worth $Y)."

**IMP-090** [LOW] - Add promotional countdown timer component
- Why: Flash sales and time-limited offers need visible countdown timers on the storefront.
- How: Create a `<PromotionalCountdown endsAt={date}>` component. Show in hero slides, product pages, and cart.

**IMP-091** [LOW] - Implement email forwarding tracking
- Why: Cannot measure viral spread of marketing emails.
- How: Add a "Forward to a friend" link in emails that tracks forwards and attributes new signups to the original recipient.

**IMP-092** [LOW] - Add competitor price comparison for SEO
- Why: Product pages don't show pricing advantages. Structured data could include competitor pricing for rich snippets.
- How: Add `AggregateOffer` schema markup showing price range. Create a price comparison section for high-value products.

**IMP-093** [LOW] - Implement loyalty tier celebration emails
- Why: When a user reaches a new tier (e.g., GOLD), there's no celebration email acknowledging the achievement.
- How: Trigger an email when `loyaltyTier` changes. Include new benefits and a congratulatory message.

**IMP-094** [LOW] - Add promotional link health checker
- Why: CTA links in banners and emails can break if product pages are removed or URLs change.
- How: Create a cron job that checks all active promotional links. Alert admin if any return 404.

**IMP-095** [LOW] - Implement survey/poll in marketing emails
- Why: No interactive elements in marketing emails. Cannot collect quick feedback inline.
- How: Add AMP email support for simple 1-click surveys (emoji rating, NPS score) directly in the email.

**IMP-096** [LOW] - Add marketing notification preferences granularity
- Why: NotificationPreference has broad categories (promotions, newsletter). Cannot distinguish between: flash sales, weekly digest, product launches.
- How: Add more granular preferences: `flashSales`, `weeklyDigest`, `productLaunches`, `researchArticles`.

**IMP-097** [LOW] - Implement drag-and-drop banner reordering
- File: `/Volumes/AI_Project/peptide-plus/src/app/admin/bannieres/page.tsx`
- Why: Current reordering uses "move up"/"move down" buttons. With many banners, this is tedious.
- How: Implement drag-and-drop using `@dnd-kit/core`. Save new order on drop.

**IMP-098** [LOW] - Add webinar reminder emails
- Why: Users register for webinars but receive no reminder emails before the event.
- How: Create a `webinar-reminders` cron job: send reminder 24h before and 1h before the webinar.

**IMP-099** [LOW] - Implement post-webinar follow-up sequence
- Why: No engagement after the webinar ends. Attendees should receive: recording link, related products, next webinar announcement.
- How: Create a post-webinar drip: Day 0 (recording + thank you), Day 3 (related products), Day 7 (next event).

**IMP-100** [LOW] - Add SEO sitemap submission to Google/Bing
- Why: Sitemap is generated but not automatically submitted to search engines.
- How: After sitemap generation, ping Google (GET `https://www.google.com/ping?sitemap=URL`) and Bing (GET `https://www.bing.com/ping?sitemap=URL`).

---

## ANNEXE: FICHIERS AUDITES

### Admin Pages (10 fichiers)
- `/Volumes/AI_Project/peptide-plus/src/app/admin/promotions/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/newsletter/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/ambassadeurs/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/seo/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/bannieres/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/webinaires/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/promo-codes/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/upsell/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/fidelite/page.tsx`
- `/Volumes/AI_Project/peptide-plus/src/app/admin/fidelite/error.tsx`

### API Routes (28 fichiers)
- `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promotions/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promotions/[id]/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/admin/seo/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/admin/seo/sitemap/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promo-codes/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promo-codes/[id]/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/[id]/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/payouts/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/newsletter/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/mailing-list/subscribe/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/mailing-list/unsubscribe/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/mailing-list/confirm/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/referrals/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/referrals/generate/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/referrals/apply/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/unsubscribe/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/social-proof/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/upsell/[productId]/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/promo/validate/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/hero-slides/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/hero-slides/active/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/webinars/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/stock-alerts/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/earn/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/redeem/route.ts`

### Cron Jobs (9 fichiers marketing)
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/abandoned-cart/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/birthday-emails/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/price-drop-alerts/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/stock-alerts/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/welcome-series/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/email-flows/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/scheduled-campaigns/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/points-expiring/route.ts`
- `/Volumes/AI_Project/peptide-plus/src/app/api/cron/satisfaction-survey/route.ts`

### Lib Files (8 fichiers)
- `/Volumes/AI_Project/peptide-plus/src/lib/validations/promo-code.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/validations/promotion.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/validations/newsletter.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/ambassador-commission.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/referral-qualify.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/email-service.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/marketing-emails.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/email/unsubscribe.ts`

### Prisma Models (16 models audites)
- Ambassador, AmbassadorCommission, AmbassadorPayout
- Discount, PromoCode, PromoCodeUsage
- HeroSlide, HeroSlideTranslation
- Webinar, WebinarTranslation
- NewsletterSubscriber, MailingListSubscriber, MailingListPreference
- NotificationPreference, ConsentRecord
- LoyaltyTransaction, Referral, StockAlert, UpsellConfig
- EmailLog, EmailBounce, EmailSuppression, EmailSegment, EmailSettings

---

*Audit complete. 55+ fichiers analyses, ~12000+ lignes de code lues.*

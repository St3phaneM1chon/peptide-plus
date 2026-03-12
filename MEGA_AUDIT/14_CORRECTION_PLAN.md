# 14. CORRECTION PLAN — MEGA AUDIT v4.0

**BioCycle Peptides (peptide-plus)**
**Date**: 2026-03-12
**Current Score**: 72/100
**Target Score**: 83+ after Sprints 1-2, 90+ after all sprints
**Total Findings**: 42 (3 P0, 10 P1, 16 P2, 13 P3)

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Scoring Projection](#2-scoring-projection)
3. [Sequencing Principles](#3-sequencing-principles)
4. [TIER 1: CRITIQUE (P0) — Fix Immediately](#4-tier-1-critique-p0--fix-immediately)
5. [TIER 2: INTEGRATION (P1) — Fix This Week](#5-tier-2-integration-p1--fix-this-week)
6. [TIER 3: EVOLUTION (P2) — Fix This Month](#6-tier-3-evolution-p2--fix-this-month)
7. [TIER 4: STRATEGIQUE (P3) — Roadmap](#7-tier-4-strategique-p3--roadmap)
8. [Sprint Execution Plan](#8-sprint-execution-plan)
9. [Quality Gates](#9-quality-gates)
10. [Effort Summary & Timeline](#10-effort-summary--timeline)
11. [Risk Register](#11-risk-register)
12. [Decision Required](#12-decision-required)

---

## 1. EXECUTIVE SUMMARY

The platform scores **72/100** across 10 audit angles. Forty-two findings were consolidated in `13_FINDINGS_CONSOLIDATED.md`. This correction plan transforms those findings into an ordered, dependency-aware execution sequence split into four sprints.

**Key numbers:**

| Metric | Value |
|---|---|
| P0 findings (fix now) | 3 |
| P1 findings (fix this week) | 10 |
| P2 findings (fix this month) | 16 |
| P3 findings (roadmap) | 13 |
| P0+P1 effort | **20 dev-days (1 month)** |
| All tiers effort | **68.5 dev-days (~3 months)** |
| Score after Sprint 1 | ~80 |
| Score after Sprint 2 | ~85 |
| Score after Sprint 3 | ~88 |
| Score after Sprint 4 | 90+ |

**The single most impactful fix**: T1-1 (Prisma findMany default limit) resolves 728 out of 732 unbounded query findings in a single middleware change. Half a day of work, massive risk reduction.

---

## 2. SCORING PROJECTION

```
Current:    72/100  ████████████████████░░░░░░░░░░  42 open findings
Sprint 1:   80/100  ████████████████████████░░░░░░  ~25 open findings
Sprint 2:   85/100  █████████████████████████░░░░░  ~14 open findings
Sprint 3:   88/100  ██████████████████████████░░░░  ~6 open findings
Sprint 4:   90+/100 ███████████████████████████░░░  ~0 open findings
```

Each sprint targets specific audit angles:

| Sprint | Primary Angles Improved | Expected Lift |
|---|---|---|
| 1 | Data Integrity, Security, i18n, Performance | +8 pts |
| 2 | API Routes, Business Logic, Security | +5 pts |
| 3 | Performance, Cross-Module, Frontend | +3 pts |
| 4 | Evolution, Cron/Queues, remaining | +2 pts |

---

## 3. SEQUENCING PRINCIPLES

All corrections follow a strict dependency chain:

```
Prisma (schema/middleware)
  → API (validation, security, error handling)
    → Frontend (components, metadata, i18n)
      → i18n (keys, bundles, RTL)
        → Build (tsc, next build)
          → Test (quality gates, re-score)
```

**Why this order:**
1. Prisma changes can break API signatures -- do them first
2. API validation depends on stable Prisma types
3. Frontend depends on stable API contracts
4. i18n extraction depends on stable frontend strings
5. Build verification catches cascading issues
6. Tests confirm the score actually improved

---

## 4. TIER 1: CRITIQUE (P0) — Fix Immediately

These three findings represent active production risks. Any one of them can cause data loss, outages, or severe performance degradation.

---

### T1-1: Prisma findMany Default Limit

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Audit Angle** | Data Integrity, Performance |
| **Problem** | 728 out of 732 `findMany` calls have no `take` parameter. A single table with 100K+ rows returns everything, causing OOM crashes and 10+ second responses. |
| **Root Cause** | No global safeguard; each developer must remember to add limits. |
| **Solution** | Create a Prisma client extension that injects `take: 50` as the default for all `findMany` operations. Developers can override with explicit `take` values. |
| **Target File** | `src/lib/db.ts` or new `src/lib/prisma-middleware.ts` |
| **Effort** | 0.5 days |
| **Impact** | Fixes 728 findings in one change. Prevents OOM. |
| **Sequence** | **FIRST** -- foundational for all subsequent work |
| **Rollback** | Remove the extension; behavior returns to current state |

**Implementation sketch:**
```typescript
// src/lib/prisma-middleware.ts
import { Prisma } from '@prisma/client'

export const findManyDefaultLimit = Prisma.defineExtension({
  query: {
    $allModels: {
      findMany({ args, query }) {
        if (args.take === undefined) {
          args.take = 50
        }
        return query(args)
      },
    },
  },
})
```

**Verification:** Search codebase for any `findMany` call that relies on returning ALL rows (e.g., export functions, analytics aggregations). Those must be updated to pass explicit `take` values or use cursor-based pagination.

---

### T1-2: Redis Caching Layer

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Audit Angle** | Performance |
| **Problem** | Only 19 out of 840 routes use Redis caching. Product listings, category pages, dashboard data, and search results hit the database on every request. |
| **Root Cause** | No shared caching utility; each route must implement caching from scratch. |
| **Solution** | Create a `src/lib/cache.ts` utility with `cacheGet`, `cacheSet`, `cacheInvalidate` helpers. Apply to top 20 most-hit routes. |
| **Target Files** | New `src/lib/cache.ts`, then 20 route files |
| **Effort** | 2 days |
| **Impact** | 10-50x latency improvement on hot paths (product pages, categories, search) |
| **Sequence** | After T1-1 (Sprint 2, Day 5 -- needs stable query patterns first) |

**Target routes for caching (priority order):**
1. Product listings (by category, by search, featured)
2. Category tree
3. Navigation menus
4. Dashboard summary stats
5. Blog/article listings
6. FAQ data
7. Locale/translation bundles
8. User loyalty point balance
9. Order history (per-user, short TTL)
10. Search autocomplete suggestions

**Cache TTL strategy:**
- Static data (categories, navigation): 1 hour
- Semi-dynamic (product listings): 5 minutes
- User-specific (loyalty, orders): 1 minute
- Search results: 2 minutes

---

### T1-3: i18n Bundle Splitting

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Audit Angle** | Performance, Frontend |
| **Problem** | A single 600 KB locale blob is loaded on every page, regardless of which strings are needed. |
| **Root Cause** | All translation keys in a monolithic JSON file per locale. |
| **Solution** | Split locale files by namespace (common, shop, admin, auth, checkout, blog, crm, accounting). Load only the namespaces needed per route group. |
| **Effort** | 1.5 days |
| **Impact** | Reduces first load by ~500 KB for most pages. Typical page loads only `common` (~40 KB) + one namespace (~30 KB). |
| **Sequence** | Sprint 1, Day 1 PM + Day 2 AM |

**Namespace split plan:**
| Namespace | Estimated Size | Used By |
|---|---|---|
| `common` | ~40 KB | All pages (nav, footer, errors) |
| `shop` | ~80 KB | Product, category, search pages |
| `admin` | ~120 KB | Admin panel only |
| `auth` | ~20 KB | Login, register, password reset |
| `checkout` | ~50 KB | Cart, checkout, payment |
| `blog` | ~30 KB | Blog, articles, research |
| `crm` | ~60 KB | CRM, customer management |
| `accounting` | ~50 KB | Invoices, reports, taxes |
| Other | ~150 KB | Remaining keys |

---

## 5. TIER 2: INTEGRATION (P1) — Fix This Week

Ten findings that represent significant gaps in validation, security, and business logic.

---

### T2-1: Zod Validation for Admin Routes (129 routes)

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | 129 admin POST/PUT/DELETE routes accept unvalidated input. Any malformed or malicious payload passes straight to Prisma. |
| **Solution** | Create Zod schemas per domain, apply via a wrapper middleware. Generate base schemas from Prisma types (`zod-prisma-types`), then customize with business rules. |
| **Effort** | 5 days |
| **Impact** | Closes the largest single security and data integrity gap |
| **Sequence** | After T1-1 (depends on stable Prisma types) |
| **Batch Order** | CRM (Day 1) -> Orders (Day 2) -> Customers (Day 3) -> Accounting (Day 4) -> Remaining (Day 5) |

**Approach:**
1. Generate base Zod schemas from Prisma schema using `zod-prisma-types`
2. Create `src/lib/validation/` directory with domain-specific schema files
3. Build a `withValidation(schema, handler)` wrapper
4. Apply to all 129 routes, domain by domain (~26 routes/day)
5. Each domain batch gets its own commit

---

### T2-2: CSRF Protection Expansion

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | Only 15.1% of state-changing routes have CSRF protection. |
| **Solution** | Add CSRF token verification to all POST/PUT/PATCH/DELETE routes via `middleware.ts`. |
| **Effort** | 1 day |
| **Sequence** | After T2-1 (validation should be stable first) |

---

### T2-3: Rate Limiting Expansion

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | Only 20.5% of routes are rate-limited. Abuse vectors wide open. |
| **Solution** | Add default rate limits via middleware. |
| **Effort** | 1 day |

**Rate limit tiers:**
| Tier | Limit | Applied To |
|---|---|---|
| General | 100 req/min | All routes (default) |
| Auth | 10 req/min | Login, register, password reset |
| Mutations | 30 req/min | All POST/PUT/PATCH/DELETE |
| Search | 60 req/min | Search, autocomplete |
| Admin | 200 req/min | Admin panel (higher for productivity) |

---

### T2-4: i18n Missing Keys (1,144 keys x 20 locales)

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | 20 locales are each missing 1,144 translation keys. Users see raw key strings or English fallbacks. |
| **Solution** | Script to diff `fr.json` vs each locale, fill missing keys with English fallback values. Mark with `[EN]` prefix for later human translation. |
| **Effort** | 0.5 days (automated) |

---

### T2-5: i18n Hardcoded Strings (483 instances)

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | 483 instances of hardcoded text in `placeholder`, `title`, `aria-label` attributes. Non-English users see English fragments. |
| **Solution** | Extract each string to an i18n key, add to all 22 locale files. |
| **Effort** | 3 days (batch by file, ~160 instances/day) |
| **Sequence** | Sprint 3 (after bundle splitting is stable) |

---

### T2-6: Public Pages SEO Metadata (19 pages)

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | 50% of public pages are missing `generateMetadata` exports. Search engines see generic titles. |
| **Solution** | Add `generateMetadata` export to each of the 19 public pages with proper title, description, Open Graph, and Twitter card data. |
| **Effort** | 1 day |

---

### T2-7: dangerouslySetInnerHTML in Checkout

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | XSS vector in the payment flow. `dangerouslySetInnerHTML` used without sanitization. |
| **Solution** | Add DOMPurify sanitization before rendering, or remove dynamic HTML entirely if the content can be rendered with React components. |
| **Effort** | 0.5 days |
| **Sequence** | Sprint 1 -- security fix in payment flow is urgent |

---

### T2-8: International VAT Engine

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | No VAT calculation for non-Canadian customers. International orders have incorrect tax amounts. |
| **Solution** | Create a VAT calculation engine modeled after the existing Canadian tax engine. Start with EU countries (standard rates), then expand. |
| **Effort** | 3 days |
| **Sequence** | Sprint 2 (business logic, after API validation is solid) |

---

### T2-9: Loyalty Fraud Protection

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | No accumulation caps or velocity limits on loyalty points. A script could generate unlimited points. |
| **Solution** | Add daily cap (e.g., 500 pts/day), weekly cap (e.g., 2000 pts/week), velocity detection (flag accounts earning points faster than 1 transaction/minute), and admin alerts. |
| **Effort** | 1 day |

---

### T2-10: Loyalty Points Expiry

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Problem** | Points never expire. This creates indefinite balance sheet liability and accounting complications. |
| **Solution** | Add `expiresAt` field to `LoyaltyTransaction` model, create a cron job to expire old points (configurable: 12 or 24 months), notify users before expiry. |
| **Effort** | 1 day |

---

## 6. TIER 3: EVOLUTION (P2) — Fix This Month

Sixteen findings that improve quality, performance, and completeness but are not blocking.

---

### T3-1: N+1 Query Fixes (87 patterns)

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | 87 locations where Prisma queries run inside loops, causing N+1 query patterns. |
| **Solution** | Refactor each to use `include`, `select` with relations, or batch queries (`findMany` with `where: { id: { in: ids } }`). |
| **Effort** | 3 days |
| **Impact** | Reduces DB query count by 10-100x on affected pages |

---

### T3-2: Server Component Migration (19 public pages)

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | 19 public pages have unnecessary `'use client'` directives, shipping extra JS to the browser. |
| **Solution** | Remove `'use client'` where not needed, extract interactive parts into small client components. |
| **Effort** | 1 day |

---

### T3-3: Stub Pages Completion (14 pages)

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | 14 pages are stubs or minimal placeholders: 6 ad landing pages, 5 minimal pages, forum backend, and others. |
| **Solution** | Build out each page with proper content, layout, and functionality. |
| **Effort** | 5 days |

---

### T3-4: Try/Catch Coverage (90 routes)

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | 90 API routes have no try/catch error handling. Unhandled errors crash the route and return 500 with stack traces. |
| **Solution** | Create a `withErrorHandler(handler)` wrapper that catches errors, logs them, and returns proper error responses. Apply to all 90 routes. |
| **Effort** | 1 day |

---

### T3-5: Payment Chain Saga Pattern

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | Partial payment failures leave the system in an inconsistent state (payment charged but order not created, or order created but inventory not decremented). |
| **Solution** | Implement a saga pattern with compensation steps: if any step fails, previous steps are rolled back (refund payment, restore inventory, cancel order). |
| **Effort** | 3 days |

---

### T3-6: Bridge Frontend Components

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | 42 identified bridge opportunities (cross-module integrations) lack frontend components. |
| **Solution** | Create reusable bridge card components (e.g., "Recent Orders" widget for customer profile, "Loyalty Points" badge for checkout). |
| **Effort** | 3 days |

---

### T3-7: Zapier Webhook Security

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | Zapier webhooks accept requests without signature verification. Anyone with the URL can trigger workflows. |
| **Solution** | Add HMAC signature verification to all webhook endpoints. |
| **Effort** | 0.5 days |

---

### T3-8: Arabic RTL CSS Verification

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Problem** | 4 Arabic locales may not render correctly if CSS uses physical properties (`margin-left`) instead of logical properties (`margin-inline-start`). |
| **Solution** | Audit all CSS for physical direction properties, replace with logical equivalents. Test with Arabic locale. |
| **Effort** | 1 day |

---

*Remaining P2 findings (T3-9 through T3-16) are tracked in `13_FINDINGS_CONSOLIDATED.md` and will be addressed during Sprint 3 as capacity allows.*

---

## 7. TIER 4: STRATEGIQUE (P3) — Roadmap

Thirteen findings for long-term platform maturity. These are improvements, not fixes.

| ID | Title | Effort | Notes |
|---|---|---|---|
| T4-1 | Monitoring Dashboard for Crons | 2 days | Visibility into cron health, last run, next run, failure count |
| T4-2 | BullMQ Expansion + Dead Letter Queue | 3 days | Move heavy operations to queues, add DLQ for failed jobs |
| T4-3 | Forum Backend | 5 days | Connect existing frontend (`community/page.tsx`) to DB + API |
| T4-4 | Mobile Module Completion | 10 days | Responsive views, PWA manifest, mobile-specific flows |
| T4-5 | Cleanup 139 TODOs | 3 days | Audit and resolve or remove all TODO/FIXME/HACK comments |
| T4-6 | Marketing Schema Expansion | 2 days | JSON-LD for products, FAQ, breadcrumbs, organization |
| T4-7 | Additional Bridge Pairs | 5 days | Implement remaining cross-module integrations |
| T4-8 | Not-Found Pages | 1 day | Custom 404 pages per route group with helpful navigation |

**Total T4 effort: 31 days**

These items should be prioritized based on business value. T4-3 (Forum Backend) and T4-4 (Mobile) likely have the highest user impact.

---

## 8. SPRINT EXECUTION PLAN

### Sprint 1: FOUNDATION (Week 1) — Target: 72 -> 80

**Goal:** Eliminate all P0 risks, close quick-win P1 security gaps.

| Day | AM (4h) | PM (4h) | Finding |
|---|---|---|---|
| **Day 1** | T1-1: Prisma findMany default limit middleware | T1-3: i18n bundle splitting (start) | P0, P0 |
| **Day 2** | T1-3: i18n bundle splitting (finish) | T2-2: CSRF middleware for all state-changing routes | P0, P1 |
| **Day 3** | T2-3: Rate limiting middleware | T2-4: i18n missing keys script (automated) | P1, P1 |
| **Day 4** | T2-7: DOMPurify in checkout (XSS fix) | T2-6: Public pages SEO metadata (start) | P1, P1 |
| **Day 5** | T2-6: Public pages SEO metadata (finish) | **Quality Gate** | P1, -- |

**Sprint 1 dependencies:**
```
T1-1 (Prisma middleware)
  ↓
T1-3 (i18n splitting) ──── no dependency on T1-1
  ↓
T2-2 (CSRF) ──────────── no dependency on T1-3
  ↓
T2-3 (Rate limiting) ──── no dependency on T2-2
  ↓
T2-4 (i18n keys) ──────── depends on T1-3 (new namespace structure)
  ↓
T2-7 (XSS fix) ────────── independent
  ↓
T2-6 (SEO metadata) ───── independent
  ↓
Quality Gate
```

**Sprint 1 deliverables:**
- 728 findMany calls protected (T1-1)
- ~500 KB first-load reduction (T1-3)
- 100% CSRF coverage (T2-2)
- 100% rate limiting coverage (T2-3)
- 22,880 missing i18n keys filled (T2-4)
- XSS vector closed (T2-7)
- 19 pages with SEO metadata (T2-6)

---

### Sprint 2: VALIDATION & BUSINESS (Week 2) — Target: 80 -> 85

**Goal:** Lock down input validation, fix business logic gaps, add caching.

| Day | AM (4h) | PM (4h) | Finding |
|---|---|---|---|
| **Day 1** | T2-1: Zod validation -- CRM domain (~40 routes) | T2-1: Zod validation -- CRM domain (cont.) | P1 |
| **Day 2** | T2-1: Zod validation -- Orders domain (~35 routes) | T2-1: Zod validation -- Orders domain (cont.) | P1 |
| **Day 3** | T2-1: Zod validation -- Customers + Accounting (~30 routes) | T2-1: Zod validation -- Remaining domains (~24 routes) | P1 |
| **Day 4** | T2-9: Loyalty fraud protection | T2-10: Loyalty points expiry | P1, P1 |
| **Day 5** | T1-2: Redis caching layer -- utility + top 10 routes | T1-2: Redis caching -- remaining 10 routes | P0 |

**Sprint 2 dependencies:**
```
T2-1 (Zod validation) ──── depends on T1-1 (stable Prisma types)
  ↓
T2-9 (Loyalty fraud) ──── independent, but logically after validation
  ↓
T2-10 (Loyalty expiry) ── depends on T2-9 (same domain, Prisma migration)
  ↓
T1-2 (Redis caching) ──── depends on T1-1 (cached queries must have limits)
  ↓
Quality Gate
```

**Sprint 2 deliverables:**
- 129 admin routes validated with Zod schemas (T2-1)
- Loyalty points fraud detection active (T2-9)
- Loyalty points expiry system live (T2-10)
- 20 routes cached with Redis, 10-50x faster (T1-2)

---

### Sprint 3: EVOLUTION (Weeks 3-4) — Target: 85 -> 88

**Goal:** Performance optimization, code quality, frontend hardening.

| Days | Task | Finding |
|---|---|---|
| Days 1-3 | T3-1: N+1 query fixes (87 patterns) | P2 |
| Day 4 | T3-2: Server component migration (19 pages) | P2 |
| Day 5 | T3-4: Try/catch coverage (90 routes) | P2 |
| Days 6-8 | T3-5: Payment chain saga pattern | P2 |
| Days 6-8 | T2-5: i18n hardcoded strings (483, overlap with T3-5) | P1 |
| Day 9 | T3-7: Zapier webhook security | P2 |
| Day 10 | T3-8: Arabic RTL CSS verification | P2 |

**Note:** T2-5 (hardcoded strings) and T3-5 (payment saga) can be worked in parallel by different developers, or interleaved by a single developer (different codepaths, no conflicts).

**Sprint 3 deliverables:**
- 87 N+1 patterns eliminated (T3-1)
- 19 pages converted to server components (T3-2)
- 90 routes with proper error handling (T3-4)
- Payment flow with saga rollback (T3-5)
- 483 hardcoded strings extracted to i18n (T2-5)
- Webhook HMAC verification (T3-7)
- RTL support verified for Arabic (T3-8)

---

### Sprint 4: STRATEGIC (Month 2) — Target: 88 -> 90+

Items executed based on business priority. Recommended order:

1. **T2-8: International VAT Engine** (3 days) -- Revenue impact, required for EU sales
2. **T4-3: Forum Backend** (5 days) -- User engagement, frontend already exists
3. **T3-3: Stub Pages Completion** (5 days) -- Content completeness
4. **T3-6: Bridge Frontend Components** (3 days) -- Cross-module UX
5. **T4-1: Monitoring Dashboard** (2 days) -- Operational visibility
6. **T4-2: BullMQ + DLQ** (3 days) -- Reliability
7. **T4-5: Cleanup TODOs** (3 days) -- Code hygiene
8. **T4-6: Marketing Schema** (2 days) -- SEO
9. **T4-8: Not-Found Pages** (1 day) -- UX polish
10. **T4-4: Mobile Module** (10 days) -- If mobile is a priority
11. **T4-7: Additional Bridges** (5 days) -- Advanced integrations

---

## 9. QUALITY GATES

Every sprint ends with a mandatory quality gate. **No code merges to main without passing all checks.**

### Gate Checklist (run after each sprint)

```bash
# 1. TypeScript compilation -- zero errors
npx tsc --noEmit

# 2. Next.js build -- must succeed
npm run build

# 3. Prisma schema validation
npx prisma validate

# 4. Lint check
npm run lint

# 5. Unit tests (if applicable)
npm test

# 6. Re-score affected audit angles
# (manual: re-run relevant sections from audit scripts)
```

### Gate Pass Criteria

| Check | Required | Blocking |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | YES |
| `npm run build` | Exit code 0 | YES |
| `npx prisma validate` | Valid | YES |
| `npm run lint` | 0 new errors | YES |
| Score improvement | +3 minimum per sprint | NO (investigate if missed) |

### Gate Failure Protocol

1. **Do not merge.** Fix the issue first.
2. Identify which correction introduced the regression.
3. Fix or revert that specific correction.
4. Re-run the full gate checklist.
5. Document the regression in the sprint retrospective.

---

## 10. EFFORT SUMMARY & TIMELINE

### By Tier

| Tier | Findings | Effort | Timeline |
|---|---|---|---|
| **Tier 1 (P0)** | 3 | 4 days | Sprint 1-2 |
| **Tier 2 (P1)** | 10 | 16 days | Sprint 1-3 |
| **Tier 3 (P2)** | 16 | 17.5 days | Sprint 3 |
| **Tier 4 (P3)** | 13 | 31 days | Sprint 4+ |
| **TOTAL** | **42** | **68.5 days** | **~3 months** |

### By Sprint

| Sprint | Duration | Findings Closed | Score Change | Cumulative |
|---|---|---|---|---|
| Sprint 1 | 5 days (Week 1) | ~7 (P0+P1) | 72 -> 80 | 80 |
| Sprint 2 | 5 days (Week 2) | ~5 (P0+P1) | 80 -> 85 | 85 |
| Sprint 3 | 10 days (Weeks 3-4) | ~8 (P1+P2) | 85 -> 88 | 88 |
| Sprint 4 | ~30 days (Month 2-3) | ~22 (P2+P3) | 88 -> 90+ | 90+ |

### Critical Path

The critical path runs through:
```
T1-1 (Prisma) → T2-1 (Zod) → T1-2 (Redis) → Quality Gate 2
     0.5d          5d           2d              0.5d
                                        Total: 8 days
```

Everything else can run in parallel with this chain. If resources are limited, the critical path determines the minimum timeline for Sprint 1+2.

---

## 11. RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Prisma middleware breaks existing queries that expect unlimited results | Medium | High | Audit all `findMany` calls for export/analytics before deploying T1-1. Add explicit `take` overrides where needed. |
| Zod schemas too strict, blocking legitimate admin operations | Medium | Medium | Deploy with `warn` mode first (log but don't reject), then switch to `reject` after 48h of clean logs. |
| i18n bundle splitting breaks existing translations | Low | Medium | Run full i18n test suite after T1-3. Verify all locales load correctly. |
| CSRF middleware breaks third-party integrations (Zapier, webhooks) | Medium | High | Exclude webhook routes from CSRF checks. Use HMAC verification instead (T3-7). |
| Redis cache serves stale data | Low | Medium | Conservative TTLs, explicit invalidation on writes, cache-aside pattern. |
| Payment saga complexity introduces new bugs | Medium | High | Extensive test coverage before deploying T3-5. Staging environment testing mandatory. |
| Sprint 1 overruns, delaying Sprint 2 | Low | Medium | Sprint 1 has 0.5 day buffer. Items can be moved to Sprint 2 if needed. |

---

## 12. DECISION REQUIRED

**Stephane -- the following approvals are needed to proceed:**

### Approval 1: Sprint Scope

- [ ] **Approve Sprint 1** (5 days, 7 fixes, target 72 -> 80)
- [ ] **Approve Sprint 2** (5 days, 5 fixes, target 80 -> 85)
- [ ] **Approve Sprint 3** (10 days, 8 fixes, target 85 -> 88)
- [ ] **Approve Sprint 4** (30 days, 22 fixes, target 88 -> 90+) -- or cherry-pick items

### Approval 2: Business Logic Decisions

- [ ] **Loyalty points expiry period**: 12 months or 24 months?
- [ ] **Loyalty daily cap**: 500 points/day or different value?
- [ ] **International VAT**: Start with EU only, or include other regions?
- [ ] **Forum backend priority**: Sprint 4 or earlier?

### Approval 3: Execution Mode

- [ ] **Sequential**: One developer, 3 months total
- [ ] **Parallel**: Two developers, ~6 weeks for P0+P1+P2
- [ ] **Selective**: Cherry-pick specific tiers/items only

---

**Next step:** Upon approval, execution begins with T1-1 (Prisma findMany default limit) -- the single highest-impact fix in the entire plan.

---

*Generated by MEGA AUDIT v4.0 -- Phase 14/15*
*Audit date: 2026-03-12*
*Source data: `13_FINDINGS_CONSOLIDATED.md`*

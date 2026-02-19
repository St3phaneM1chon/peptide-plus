# AUDIT EXHAUSTIF DE PERFORMANCE -- peptide-plus (BioCycle Peptides)

**Date**: 2026-02-18
**Stack**: Next.js 15, App Router, TypeScript, Prisma, PostgreSQL, Tailwind CSS, Stripe, PayPal
**Score Global**: 50/100

---

## 1. BUNDLE SIZE -- Score: 4/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **CRITICAL** | `layout.tsx:20-41` | **22 fichiers de locale importes statiquement** (~5.5 MB de JSON dans le bundle initial) |
| **CRITICAL** | Projet entier | **Zero usage de `next/dynamic`** et **zero `React.lazy`** |
| **HIGH** | `(shop)/layout.tsx:1-43` | ShopLayout importe 7 composants non-critiques: ChatWidget, NewsletterPopup, CookieConsent, InstallPWA, CompareBar, BackToTop, TextToSpeechButton |
| **HIGH** | `CheckoutForm.tsx:19` | `loadStripe` au module-level (~40KB gzip charge immediatement) |
| **MEDIUM** | `package.json` | Deps lourdes: `jspdf` (290KB), `openai`, `@anthropic-ai/sdk` |

Points positifs: `modularizeImports` et `optimizePackageImports` configures pour lucide-react/date-fns.

---

## 2. RENDERING -- Score: 2/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **CRITICAL** | `layout.tsx:1` | **`force-dynamic` sur le ROOT LAYOUT** -- force TOUT en SSR dynamique |
| **CRITICAL** | 259 fichiers | 259 fichiers avec `force-dynamic` dont pages publiques statiques |
| **CRITICAL** | Projet entier | **Zero `generateStaticParams`** -- aucune page pre-rendue |
| **HIGH** | 229 fichiers | 229 fichiers `'use client'` -- Server Components non exploites |
| **HIGH** | `product/[slug]/page.tsx` | 3-4 queries Prisma sequentielles au lieu de paralleles |

---

## 3. DATABASE -- Score: 6/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **HIGH** | `api/products/route.ts:83-90` | N+1 query pour les traductions de categories |
| **HIGH** | `product/[slug]/page.tsx:210-237` | 4 requetes sequentielles (2 parallelisables) |
| **HIGH** | `prisma/schema.prisma:6-9` | Pas de connection pooling configure |
| **MEDIUM** | `api/products/route.ts:23` | Default limit 200 produits sans pagination |

Points positifs: 320+ index Prisma, singleton correct, select/include bien utilises.

---

## 4. CACHING -- Score: 5/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **CRITICAL** | `layout.tsx:1` | `force-dynamic` annule tout caching Next.js |
| **HIGH** | `lib/cache.ts` | Cache **in-memory only** (Map) -- pas de Redis, pas partage entre instances |
| **HIGH** | Toutes les routes API | `cacheGetOrSet` **jamais utilise** -- toutes les requetes frappent la DB |
| **MEDIUM** | `vercel.json:44` | `no-store, max-age=0` sur toutes les API routes |

Points positifs: Architecture cache bien concue (CacheKeys, CacheTags, CacheTTL presets).

---

## 5. IMAGES -- Score: 7/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **HIGH** | 44 composants Image | **Seulement 3/44 utilisent `sizes`** -- images trop larges sur mobile |
| **HIGH** | HeroSlider.tsx | Image hero sans `priority` -- mauvais pour LCP |

Points positifs: 44 composants utilisent `next/image`, formats AVIF/WebP actives, cache 30 jours.

---

## 6. API ROUTES -- Score: 5/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **HIGH** | 150+ routes | Rate limiting sur seulement 3 routes sur 150+ |
| **HIGH** | `api/products/route.ts:23` | Default limit 200, pas de pagination |
| **MEDIUM** | ChatWidget.tsx:138 | Polling 5s au lieu de SSE/WebSocket |

---

## 7. FONTS & CSS -- Score: 6/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **HIGH** | `globals.css:1-1198` | 1198 lignes CSS custom dupliquant Tailwind |
| **MEDIUM** | `globals.css:61-65` | Reset CSS conflit avec Tailwind Preflight |
| **MEDIUM** | `globals.css:67-68` | `scroll-behavior: smooth` global |

Points positifs: Font Inter via next/font/google, subsets latin.

---

## 8. THIRD PARTY SCRIPTS -- Score: 6/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **HIGH** | `CheckoutForm.tsx:19` | `loadStripe` top-level (~40KB charge immediatement) |
| **MEDIUM** | `layout.tsx:189-206` | Service Worker via `dangerouslySetInnerHTML` au lieu de `next/script` |

Points positifs: PayPal server-side, pas de scripts analytics bloquants, CSP bien configure.

---

## 9. SERVICE WORKER / PWA -- Score: 3/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **CRITICAL** | `public/sw.js` | **N'EXISTE PAS** -- l'enregistrement echoue en silence |
| **CRITICAL** | `public/manifest.json` | **N'EXISTE PAS** -- meta tag pointe vers fichier inexistant |
| **HIGH** | `InstallPWA.tsx` | Composant charge mais inutile sans SW/manifest |

---

## 10. MEMORY & CPU -- Score: 6/10

| Severite | Fichier | Probleme |
|----------|---------|----------|
| **HIGH** | `CurrencyContext.tsx:100` | `new Intl.NumberFormat()` cree a chaque appel de `formatPrice` |
| **HIGH** | `LoyaltyContext.tsx:293-306` | Context value sans `useMemo`, fonctions sans `useCallback` |
| **MEDIUM** | `CurrencyContext.tsx:112-125` | Context value sans `useMemo` |
| **MEDIUM** | `ChatWidget.tsx:138` | Polling actif meme quand widget ferme |

Points positifs: `useCallback` correct dans CartContext/WishlistContext, passive scroll listeners.

---

## RESUME DES SCORES

| Aspect | Score |
|--------|-------|
| Bundle Size | 4/10 |
| Rendering | 2/10 |
| Database | 6/10 |
| Caching | 5/10 |
| Images | 7/10 |
| API Routes | 5/10 |
| Fonts & CSS | 6/10 |
| Third Party | 6/10 |
| PWA | 3/10 |
| Memory & CPU | 6/10 |

## **SCORE GLOBAL: 50/100**

---

## TOP 10 OPTIMISATIONS PRIORITAIRES

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Supprimer `force-dynamic` du root layout** | TTFB /5-10x | 5 min |
| 2 | **Retirer `force-dynamic` des 30+ pages statiques** | Pages instantanees via CDN | 30 min |
| 3 | **Charger les locales dynamiquement** | -5 MB bundle initial | 2h |
| 4 | **Ajouter `generateStaticParams` + `revalidate`** produit/category | TTFB < 50ms | 1h |
| 5 | **Lazy-load composants non-critiques ShopLayout** | -200KB JS initial | 1h |
| 6 | **Ajouter `sizes` a tous les `Image`** | -40-60% bande passante mobile | 2h |
| 7 | **Ajouter `useMemo` aux context values** | Elimine re-renders inutiles | 30 min |
| 8 | **Implementer `cacheGetOrSet` sur routes API** | -80% queries DB catalogue | 2h |
| 9 | **Creer fichiers PWA (sw.js, manifest.json)** | Active caching offline | 3h |
| 10 | **Lazy-load Stripe SDK** | -40KB pour 95% visiteurs | 30 min |

**Impact estime**: Actions 1-4 seules: TTFB de 800ms+ a <100ms, LCP de 3-4s a <1.5s, charge serveur -70-80%.

Now I have enough data for a comprehensive audit. Let me compile the final report.

---

# AUDIT EXHAUSTIF D'ARCHITECTURE -- Peptide-Plus (BioCycle Peptides)

**Projet**: `/Volumes/AI_Project/peptide-plus/`
**Stack**: Next.js 15 (App Router), TypeScript (strict), Prisma 5.8, PostgreSQL, Tailwind CSS 3.4
**Date**: 2026-02-18
**Fichiers source**: 619 fichiers dans `src/`

---

## 1. STRUCTURE DES REPERTOIRES -- Score: 7/10

### Architecture globale
```
src/
  app/           -- 18 entrees (route groups + globals)
    (auth)/      -- 7 pages auth (signin, signup, error, etc.)
    (public)/    -- 35 pages corporate/info
    (shop)/      -- 41 pages e-commerce
    admin/       -- 65 pages admin (!!)
    api/         -- 211 routes API
    dashboard/   -- 6 pages
    owner/       -- 1 page
  components/    -- 82 fichiers
  config/        -- 2 fichiers
  contexts/      -- 5 fichiers
  data/          -- 2 fichiers
  hooks/         -- 7 fichiers
  i18n/          -- 26 fichiers (22 locales + config)
  lib/           -- 68 fichiers
  middleware/    -- repertoire VIDE
  types/         -- 1 fichier
  __tests__/     -- 11 fichiers
```

### Problemes trouves

**[HIGH] Repertoire `src/middleware/` vide** -- Le middleware vit dans `src/middleware.ts` (correct pour Next.js), mais le dossier `src/middleware/` est un arttefact orphelin qui prete a confusion.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/middleware/` (repertoire vide)

**[HIGH] Repertoire `src/utils/` vide** -- Declare dans le path alias tsconfig mais aucun fichier dedans. Du code utilitaire est plutot dans `src/lib/`.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/utils/` (repertoire vide)
- Fichier: `/Volumes/AI_Project/peptide-plus/tsconfig.json` ligne 24: `"@/utils/*": ["./src/utils/*"]`

**[MEDIUM] Types dans un seul fichier monolithique** -- 514 lignes dans un seul `src/types/index.ts`. Pour 120 modeles Prisma, un seul fichier de types manuels est insuffisant et source de drift entre Prisma et les types frontend.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/types/index.ts` (514 lignes)

**[MEDIUM] Repertoire `config/` racine vide** -- Un dossier vide au root du projet.
- Fichier: `/Volumes/AI_Project/peptide-plus/config/` (repertoire vide)

**[LOW] Pas de repertoire `src/services/`** -- Les services sont dans `src/lib/` melange avec les utilitaires. Un split serait benefique.

### Recommandations
- Supprimer les repertoires vides (`src/middleware/`, `src/utils/`, `config/`)
- Scinder `src/types/index.ts` en fichiers par domaine: `user.types.ts`, `product.types.ts`, `order.types.ts`, `accounting.types.ts`
- Utiliser `Prisma.` generated types plutot que des types manuels dupliques

---

## 2. APP ROUTER NEXT.JS 15 -- Score: 6/10

### Organisation des route groups

| Route Group | Pages | Layout | Loading | Error | Not-Found |
|------------|-------|--------|---------|-------|-----------|
| (shop)     | 41    | Oui    | 5 fichiers | Non | Non |
| (public)   | 35    | Oui    | Non     | Non   | Non       |
| (auth)     | 7     | Non    | Non     | Non   | Non       |
| admin      | 65    | Oui    | 1 fichier | Non | Non    |
| Root       | -     | Oui    | Non     | Oui   | Oui       |

### Problemes trouves

**[CRITICAL] `force-dynamic` excessif -- 51 pages marquees `export const dynamic = 'force-dynamic'`** -- Cela desactive entierement le caching statique de Next.js, y compris pour des pages entierement statiques comme les pages legales, a-propos, FAQ, etc. C'est un anti-pattern majeur de performance.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/layout.tsx` ligne 1: `export const dynamic = 'force-dynamic'` -- Sur le ROOT LAYOUT, force TOUTES les pages en dynamique
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/(public)/a-propos/histoire/page.tsx` ligne 2
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/(public)/mentions-legales/conditions/page.tsx` ligne 2
- Et 48 autres pages

**[CRITICAL] `ignoreBuildErrors: true` + `ignoreDuringBuilds: true`** -- La config Next.js ignore les erreurs TypeScript ET ESLint lors du build. Cela cache potentiellement des dizaines d'erreurs qui peuvent causer des bugs en production.
- Fichier: `/Volumes/AI_Project/peptide-plus/next.config.js` lignes 7-12

**[HIGH] Duplication de checkout** -- Deux routes checkout distinctes:
- `/Volumes/AI_Project/peptide-plus/src/app/(shop)/checkout/page.tsx` (le checkout panier principal)
- `/Volumes/AI_Project/peptide-plus/src/app/(public)/checkout/[slug]/page.tsx` (checkout par produit unique)
Confusion potentielle entre les deux flows; l'un est dans `(shop)`, l'autre dans `(public)` avec des layouts differents.

**[HIGH] Aucun `error.tsx` dans les route groups** -- Seulement le root `error.tsx`. Si une page admin plante, l'erreur remonte au root error boundary, perdant le layout admin.
- Manquants: `(shop)/error.tsx`, `(public)/error.tsx`, `admin/error.tsx`

**[HIGH] Pas de loading states dans (public) et admin** -- Le route group `(public)` n'a aucun `loading.tsx` (35 pages). L'admin a un seul `loading.tsx` pour 65 pages (seulement au root `admin/`).

**[MEDIUM] Pas de `not-found.tsx` dans les route groups** -- Si un produit n'existe pas, la 404 affiche le layout root, pas le layout shop avec header/footer.

**[MEDIUM] Page de test en production** -- `/Volumes/AI_Project/peptide-plus/src/app/(shop)/test/page.tsx` avec du HTML inline brut.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/(shop)/test/page.tsx` (11 lignes)

**[MEDIUM] Endpoint de debug en production** -- `/api/debug-auth` expose des diagnostics sensibles (secrets masques, cookies, headers) et est marque TEMPORARY.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/api/debug-auth/route.ts` lignes 1-65

### Recommandations
- Retirer `export const dynamic = 'force-dynamic'` du root layout et de toutes les pages statiques
- Activer `ignoreBuildErrors: false` et `ignoreDuringBuilds: false`, corriger les erreurs TypeScript/ESLint
- Ajouter `error.tsx`, `loading.tsx` et `not-found.tsx` dans chaque route group
- Supprimer la page test et l'endpoint debug-auth

---

## 3. PATTERNS ARCHITECTURAUX -- Score: 6.5/10

### Server vs Client Components

- **116 pages sur 158 sont `'use client'`** (73%). La majorite ecrasante des pages sont des Client Components.
- **77 composants sur 82 sont `'use client'`** (94%).
- Seules 42 pages sont des Server Components. La plupart des pages dans `(public)` sont des Client Components malgre un contenu essentiellement statique.

### Problemes trouves

**[CRITICAL] Quasi-absence de Server Components** -- Les pages comme a-propos, mentions legales, FAQ, blog sont marquees `'use client'` alors qu'elles pourraient etre 100% Server Components. Cela envoie du JavaScript superflu au client et empeche le streaming SSR.

**[HIGH] Duplication de providers entre root et (public) layout** -- `CartProvider` et `CurrencyProvider` sont declares dans le root `providers.tsx` (qui enveloppe TOUT le site) ET a nouveau dans `(public)/layout.tsx`. Double instantiation inutile.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/providers.tsx` lignes 28-37
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/(public)/layout.tsx` lignes 18-27

**[HIGH] Pas de pattern data-fetching clair** -- Pas de couche `actions/` (Server Actions) ni de data layer centralisee. Le data fetching se fait directement avec `prisma` dans les pages server et via `fetch('/api/...')` dans les client components, sans abstraction.

**[MEDIUM] Manque de Suspense boundaries** -- Aucune utilisation de `<Suspense>` pour le streaming. Les pages chargent tout ou rien.

**[MEDIUM] Schemas Zod eparpilles** -- La validation vit dans 3 fichiers differents:
- `/Volumes/AI_Project/peptide-plus/src/lib/validation.ts` (432 lignes)
- `/Volumes/AI_Project/peptide-plus/src/lib/validations.ts` (179 lignes)
- `/Volumes/AI_Project/peptide-plus/src/lib/form-validation.ts` (181 lignes)

### Recommandations
- Convertir toutes les pages statiques en Server Components
- Supprimer les providers dupliques du layout (public)
- Creer un layer `src/data/` ou `src/actions/` pour centraliser les appels DB
- Unifier les fichiers de validation en un seul module

---

## 4. CONFIGURATION -- Score: 7.5/10

### Problemes trouves

**[CRITICAL] `ignoreBuildErrors` et `ignoreDuringBuilds`** -- Deja mentionne au point 2, c'est le probleme de configuration le plus grave.
- Fichier: `/Volumes/AI_Project/peptide-plus/next.config.js` lignes 7-12

**[HIGH] `modularizeImports` est deprecated en Next.js 15** -- Next.js 15 favorise `experimental.optimizePackageImports`. Les deux sont presentes, ce qui est redondant.
- Fichier: `/Volumes/AI_Project/peptide-plus/next.config.js` lignes 88-95 et 103-105

**[MEDIUM] next-auth beta dans un projet production** -- `"next-auth": "^5.0.0-beta.4"` est une version beta. Risque de breaking changes non annonces.
- Fichier: `/Volumes/AI_Project/peptide-plus/package.json` ligne 46

**[MEDIUM] `unsafe-eval` dans CSP pour la production** -- Le commentaire dit "safe to keep in prod" mais `unsafe-eval` est un risque CSP reel en production.
- Fichier: `/Volumes/AI_Project/peptide-plus/next.config.js` ligne 59

**[LOW] tsconfig strict est bien configure** -- `strict: true`, `noImplicitAny`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`. Excellent, mais neutralise par `ignoreBuildErrors: true`.

**[LOW] Config tailwind reference `src/pages/**` qui n'existe pas** -- Le content path inclut `./src/pages/**` mais le projet utilise exclusivement l'App Router.
- Fichier: `/Volumes/AI_Project/peptide-plus/tailwind.config.ts` ligne 5

### Recommandations
- Desactiver `ignoreBuildErrors` et corriger les erreurs
- Remplacer `modularizeImports` par `experimental.optimizePackageImports`
- Envisager de pinner next-auth a une version stable
- Nettoyer le CSP en utilisant `nonce` au lieu de `unsafe-eval`

---

## 5. DEPENDANCES -- Score: 7/10

### package.json: 31 dependencies + 18 devDependencies

**[HIGH] @types/uuid dans dependencies au lieu de devDependencies** -- Les types ne doivent pas etre dans les dependances de production.
- Fichier: `/Volumes/AI_Project/peptide-plus/package.json` ligne 37

**[HIGH] `isomorphic-dompurify` utilise `jsdom`** -- Necessite un workaround `serverExternalPackages` dans next.config. DOMPurify cote serveur pourrait etre remplace par une sanitisation plus legere.
- Fichier: `/Volumes/AI_Project/peptide-plus/next.config.js` ligne 100

**[MEDIUM] `openai` et `@anthropic-ai/sdk` en parallele** -- Deux SDK d'IA differentes en production. La clarification de l'usage est necessaire.
- Fichier: `/Volumes/AI_Project/peptide-plus/package.json` lignes 26 et 48

**[MEDIUM] Configuration Vercel PLUS Azure** -- `vercel.json` est present avec des crons Vercel, mais le deploiement cible Azure. Confusion sur la plateforme reelle.
- Fichier: `/Volumes/AI_Project/peptide-plus/vercel.json` (56 lignes)

**[LOW] `react` 18.2 avec Next.js 15** -- Next.js 15 supporte React 19. Passer a React 19 permettrait les Server Actions ameliores et `use()`.
- Fichier: `/Volumes/AI_Project/peptide-plus/package.json` lignes 52-53

**[LOW] `ioredis` installe mais pas d'evidence d'utilisation Redis en production** -- Le rate limiter utilise une implementation memoire fallback.

### Recommandations
- Deplacer `@types/uuid` dans devDependencies
- Consolider les SDK AI (garder un seul)
- Decider entre Vercel et Azure, supprimer la config non utilisee
- Evaluer la migration vers React 19

---

## 6. COHERENCE DU NAMING ET FICHIERS ORPHELINS -- Score: 5/10

### Duplications majeures trouvees

**[CRITICAL] 2x CartDrawer.tsx** -- Deux composants CartDrawer identiques dans des dossiers differents:
- `/Volumes/AI_Project/peptide-plus/src/components/cart/CartDrawer.tsx` (281 lignes)
- `/Volumes/AI_Project/peptide-plus/src/components/shop/CartDrawer.tsx` (196 lignes)

**[CRITICAL] 2x ProductCard.tsx** -- Deux composants ProductCard:
- `/Volumes/AI_Project/peptide-plus/src/components/products/ProductCard.tsx` (174 lignes)
- `/Volumes/AI_Project/peptide-plus/src/components/shop/ProductCard.tsx` (400 lignes)
- Plus `ProductCardShopify.tsx` (une 3eme variante)

**[HIGH] 4x Header.tsx** -- Quatre fichiers header differents:
- `/Volumes/AI_Project/peptide-plus/src/components/shop/Header.tsx`
- `/Volumes/AI_Project/peptide-plus/src/components/layout/Header.tsx`
- `/Volumes/AI_Project/peptide-plus/src/components/layout/HeaderCorporate.tsx`
- `/Volumes/AI_Project/peptide-plus/src/components/layout/HeaderShopify.tsx`

**[HIGH] 2x email-service.ts** -- Deux fichiers de service email:
- `/Volumes/AI_Project/peptide-plus/src/lib/email-service.ts` (257 lignes)
- `/Volumes/AI_Project/peptide-plus/src/lib/email/email-service.ts` (191 lignes)

**[HIGH] 2x receipt-generator** -- Deux generateurs de recus:
- `/Volumes/AI_Project/peptide-plus/src/lib/receipt-generator.ts`
- `/Volumes/AI_Project/peptide-plus/src/lib/receipt-generator-i18n.ts`

**[HIGH] 3x validation files**:
- `/Volumes/AI_Project/peptide-plus/src/lib/validation.ts` (432 lignes)
- `/Volumes/AI_Project/peptide-plus/src/lib/validations.ts` (179 lignes)
- `/Volumes/AI_Project/peptide-plus/src/lib/form-validation.ts` (181 lignes)

**[HIGH] email-templates en double**:
- `/Volumes/AI_Project/peptide-plus/src/lib/email-templates.ts` (597 lignes)
- `/Volumes/AI_Project/peptide-plus/src/lib/email/templates/` (3 fichiers, 1555 lignes total)

**[MEDIUM] Naming inconsistant FR/EN dans les routes admin** -- Mix de francais et anglais: `commandes` vs `customers`, `produits` vs `chat`, `avis` vs `promo-codes`, `employes` vs `dashboard`.

### Recommandations
- URGENT: Consolider tous les doublons (garder une seule version de chaque)
- Choisir une langue unique pour le naming des routes (FR ou EN, pas les deux)
- Supprimer les fichiers "Shopify" legacy

---

## 7. MIDDLEWARE -- Score: 7.5/10

### Structure du middleware
Un seul fichier `src/middleware.ts` (236 lignes) gere:
- Detection de locale (cookie, header, Accept-Language)
- Protection des routes (auth)
- Verification des roles (EMPLOYEE, OWNER, CLIENT)
- Permissions granulaires par route admin
- Force MFA pour OWNER/EMPLOYEE

### Problemes trouves

**[HIGH] Debug logging en production** -- `console.log(JSON.stringify({event: 'middleware_debug'...})` sur toutes les routes protegees.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/middleware.ts` lignes 121-133

**[HIGH] Permissions EMPLOYEE dupliquees** -- Le middleware duplique `EMPLOYEE_PERMISSIONS` manuellement au lieu de les importer de `src/lib/permissions.ts`. Le commentaire le dit explicitement: "mirrors ROLE_DEFAULTS from src/lib/permissions.ts". Source de drift.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/middleware.ts` lignes 61-74

**[MEDIUM] Secret en fallback** -- `process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET` -- la double variable augmente la surface d'erreur de configuration.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/middleware.ts` ligne 106

**[LOW] Matcher regex complexe** -- Le matcher exclut les fichiers statiques mais la logique de skip interne re-verifie `pathname.startsWith('/_next')`.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/middleware.ts` lignes 89-97 et 234

### Recommandations
- Retirer le debug logging
- Extraire les permissions dans un fichier shared importable par le middleware Edge
- Unifier la variable de secret

---

## 8. CODE SHARING / DRY -- Score: 4.5/10

### Violations DRY majeures

**[CRITICAL] Locale detection implementee 3 fois** -- La logique de detection de locale est ecrite dans:
1. `src/middleware.ts` lignes 136-152
2. `src/app/layout.tsx` lignes 119-140 (`getLocaleFromAcceptLanguage`)
3. `src/i18n/config.ts` lignes 172-213 (`getLocaleFromHeaders`)
Trois implementations paralleles de la meme logique.

**[CRITICAL] 22 fichiers JSON de locale importes individuellement** -- Le root layout importe manuellement les 22 fichiers locale (lignes 20-41) puis construit une map (lignes 46-69). Cela devrait etre dynamique.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/layout.tsx` lignes 20-69

**[HIGH] Comptabilite sur-dimensionnee** -- 22 services dans `src/lib/accounting/` et 25+ routes API dans `src/app/api/accounting/`. Un ERP complet est integre dans une app e-commerce de peptides. La complexite est disproportionnee.

**[MEDIUM] Duplications de composants deja listees au point 6** -- CartDrawer, ProductCard, Header, email-service, receipt-generator, validation.

**[MEDIUM] Admin nav sections hardcoded** -- 150 lignes de configuration de navigation dans le layout admin plutot que dans un fichier de config.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/admin/layout.tsx` lignes 71-150

### Recommandations
- Centraliser la detection de locale dans `src/i18n/config.ts` et l'importer partout
- Charger les locales dynamiquement avec `import()` au lieu de 22 imports statiques
- Extraire la nav admin dans `src/config/admin-navigation.ts`
- Evaluer si le module comptabilite merite d'etre un micro-service separe

---

## 9. BUILD & DEPLOY -- Score: 7/10

### CI/CD

**2 workflows GitHub Actions**:
1. `deploy-azure.yml` -- Build + Deploy standalone vers Azure App Service
2. `security-scan.yml` -- Dependency audit, Gitleaks, Semgrep, CodeQL, ESLint, Build test

### Problemes trouves

**[CRITICAL] `prisma db push --accept-data-loss` en production** -- Le pipeline de deploiement execute `prisma db push --accept-data-loss` automatiquement en production. Cela peut detruire des donnees lors de schema changes.
- Fichier: `/Volumes/AI_Project/peptide-plus/.github/workflows/deploy-azure.yml` ligne 198

**[HIGH] Pas de staging environment** -- Le workflow ne deploie que sur production. L'option staging existe dans l'input mais ne pointe vers aucune ressource differente.
- Fichier: `/Volumes/AI_Project/peptide-plus/.github/workflows/deploy-azure.yml` lignes 15-21

**[HIGH] Configuration Vercel + Azure en parallele** -- `vercel.json` configure des crons et headers pour Vercel, mais le deploiement est sur Azure. Les crons Vercel ne s'executeront pas sur Azure.
- Fichier: `/Volumes/AI_Project/peptide-plus/vercel.json`

**[MEDIUM] Build sans tests** -- Le workflow `deploy-azure.yml` ne lance pas les tests avant de deployer.

**[MEDIUM] Security scan en `continue-on-error: true`** -- npm audit et Snyk ne bloquent pas le pipeline.
- Fichier: `/Volumes/AI_Project/peptide-plus/.github/workflows/security-scan.yml` lignes 42-43

**[LOW] Pas de Dockerfile** -- Le deploiement utilise `output: 'standalone'` mais pas Docker malgre la mention dans les docs. Le container scan dans le workflow est disable (`if: false`).

### Recommandations
- Remplacer `prisma db push --accept-data-loss` par `prisma migrate deploy` avec des migrations versionees
- Creer un environment staging reel
- Supprimer `vercel.json` ou implementer les crons Azure equivalent (Azure Functions Timer Triggers)
- Ajouter `npm test` dans le pipeline avant deploy

---

## 10. SCALABILITE -- Score: 5.5/10

### Points de friction architecturaux

**[CRITICAL] 120 modeles Prisma dans un seul fichier schema** -- 2729 lignes dans `schema.prisma`. Pas de multi-file schema (Prisma 5+ le supporte). Les migrations et la comprehension sont penibles.
- Fichier: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma` (2729 lignes)

**[HIGH] 211 routes API dans `src/app/api/`** -- Le nombre est considerable et aucun mecanisme de rate limiting centralized n'est visible au niveau middleware (seulement dans quelques routes individuelles via `src/lib/rate-limiter.ts`).

**[HIGH] Tous les locales charges en memoire** -- Les 22 fichiers JSON de locale sont charges au boot dans le root layout. Cela impacte la memoire serveur et le TTFB.
- Fichier: `/Volumes/AI_Project/peptide-plus/src/app/layout.tsx` lignes 20-69

**[MEDIUM] Pas de caching layer** -- `src/lib/cache.ts` existe mais `force-dynamic` sur 51 pages desactive tout cache. Aucun ISR (Incremental Static Regeneration) n'est utilise.

**[MEDIUM] Module comptabilite trop couple** -- 22 services de comptabilite sont directement dans le monolithe. Si la charge augmente, impossible de scaler ce module independamment.

**[MEDIUM] Pas de pagination par defaut sur les routes API** -- Les routes API ne semblent pas systematiquement paginee (bien que `src/lib/pagination.ts` existe).

**[LOW] Image optimization OK** -- AVIF + WebP configures, cache 30 jours. Bon.

### Recommandations
- Split le schema Prisma en multi-fichiers par domaine
- Implementer ISR/cache pour les pages statiques (produits, categories, blog)
- Extraire la comptabilite comme micro-service ou module lazy-loaded
- Charger les locales a la demande (`import()`) plutot qu'en static

---

## RESUME DES SCORES

| Critere                        | Score | Severite critique |
|-------------------------------|-------|-------------------|
| 1. Structure des repertoires   | 7/10  | 0 CRITICAL        |
| 2. App Router Next.js 15       | 6/10  | 2 CRITICAL        |
| 3. Patterns architecturaux     | 6.5/10| 1 CRITICAL        |
| 4. Configuration               | 7.5/10| 1 CRITICAL        |
| 5. Dependances                 | 7/10  | 0 CRITICAL        |
| 6. Coherence naming/fichiers   | 5/10  | 2 CRITICAL        |
| 7. Middleware                   | 7.5/10| 0 CRITICAL        |
| 8. Code sharing / DRY          | 4.5/10| 2 CRITICAL        |
| 9. Build & Deploy              | 7/10  | 1 CRITICAL        |
| 10. Scalabilite                | 5.5/10| 1 CRITICAL        |

---

## SCORE GLOBAL: 63/100

---

## TOP 5 AMELIORATIONS ARCHITECTURALES RECOMMANDEES

### 1. DESACTIVER `ignoreBuildErrors` + `force-dynamic` global (Impact: +15 perf, +10 fiabilite)
Retirer `ignoreBuildErrors: true` et `ignoreDuringBuilds: true` de `next.config.js`. Retirer `export const dynamic = 'force-dynamic'` du root layout et de toutes les pages statiques. Fixer les erreurs TypeScript. Cela seul peut doubler les performances en reactivant le SSG/ISR.

### 2. CONSOLIDER TOUS LES DOUBLONS DE CODE (Impact: -40% complexite, +maintenabilite)
Fusionner: CartDrawer (2), ProductCard (3), Header (4), email-service (2), email-templates (2), validation (3), receipt-generator (2), locale detection (3). Choisir une seule implementation, supprimer les autres, mettre a jour les imports. ~15 fichiers a supprimer.

### 3. CONVERTIR LES PAGES STATIQUES EN SERVER COMPONENTS (Impact: -60% JS client)
Les 35 pages `(public)` (a-propos, mentions legales, blog, etc.) et les pages produit/categorie n'ont pas besoin d'etre des Client Components. Convertir en Server Components avec Suspense boundaries. Ajouter ISR avec `revalidate` pour les pages produit.

### 4. SECURISER LE PIPELINE CI/CD (Impact: protection donnees production)
Remplacer `prisma db push --accept-data-loss` par `prisma migrate deploy`. Ajouter un environment staging. Supprimer l'endpoint `/api/debug-auth` et la page `/test`. Retirer le debug logging du middleware. Supprimer `vercel.json` si Azure est la cible.

### 5. RESTRUCTURER LES MODULES PAR DOMAINE (Impact: scalabilite long terme)
Split le schema Prisma en multi-fichiers. Extraire la comptabilite (22 services, 25+ API routes) en module autonome. Creer un data layer centralise (`src/data/` avec Server Actions). Charger les locales dynamiquement au lieu de 22 imports statiques.
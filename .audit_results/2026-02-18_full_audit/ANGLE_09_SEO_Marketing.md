# AUDIT SEO & MARKETING EXHAUSTIF -- BioCycle Peptides (biocyclepeptides.com)

**Date**: 2026-02-18
**Projet**: `/Volumes/AI_Project/peptide-plus/`
**Stack**: Next.js 15 (App Router), TypeScript, Prisma, PostgreSQL
**Score Global**: 52/100

---

## 1. METADATA -- Score: 4/10

- 22 pages AVEC metadata (home, shop, faq, learn, calculator, product/[slug], category/[slug], pages publiques)
- **~35 pages publiques SANS metadata** (refund-policy, shipping-policy, videos, community, ambassador, rewards, lab-results, bundles, learn/[slug], contact, blog, a-propos/*, mentions-legales/*)
- **CRITICAL**: `learn/[slug]/page.tsx` 'use client' SANS generateMetadata -- les articles de recherche n'ont aucun SEO
- **CRITICAL**: `product/[slug]` og:type est 'website' au lieu de 'product'
- **HIGH**: `category/[slug]` generateMetadata sans canonical, OG, Twitter

---

## 2. SITEMAP -- Score: 7/10

- Genere dynamiquement depuis la DB (produits + categories)
- **CRITICAL**: ~30 pages publiques manquantes (learn, faq, calculator, lab-results, videos, blog, contact, a-propos/*, solutions/*)
- **CRITICAL**: `/learn/[slug]` articles absents
- `/auth/signin` et `/auth/signup` ne devraient PAS etre dans le sitemap

---

## 3. ROBOTS.TXT -- Score: 8/10

- Directives correctes: Allow /, Disallow /admin/, /owner/, /dashboard/, /api/
- Manque Disallow pour /checkout/, /account/
- Pas de blocage des parametres de tri/filtre

---

## 4. STRUCTURED DATA (JSON-LD) -- Score: 7/10

- Schema Organization, WebSite avec SearchAction, Product complet, BreadcrumbList, FAQPage
- **CRITICAL**: `articleSchema()` definie mais JAMAIS utilisee dans learn/[slug]
- `sameAs: []` vide dans Organization (pas de liens sociaux)
- Breadcrumbs JSON-LD duplique (composant + page server)

---

## 5. URL STRUCTURE -- Score: 7/10

- Slugs propres et descriptifs
- **HIGH**: Melange FR/EN dans les URLs (/a-propos vs /shop, /mentions-legales vs /learn)
- **CRITICAL**: Canonical URLs manquantes sur ~30 pages
- **CRITICAL**: Pas de hreflang malgre 22 langues

---

## 6. HEADING HIERARCHY -- Score: 6/10

- **CRITICAL**: Homepage pas de H1 visible (uniquement dans HeroSlider dynamique)
- `learn/[slug]` affiche H1 "Article Not Found" au lieu de 404

---

## 7. IMAGES SEO -- Score: 5/10

- **CRITICAL**: OG image par defaut (`/images/og-default.jpg`) N'EXISTE PAS
- **CRITICAL**: Logo (`/images/logo.png`) N'EXISTE PAS
- HeroSlider n'utilise PAS Next.js Image (pas d'optimisation LCP)
- Pas de sitemap images

---

## 8. INTERNAL LINKING -- Score: 7/10

- Breadcrumbs sur 17+ pages avec JSON-LD
- **CRITICAL**: Pas de liens depuis articles vers produits mentionnes (BPC-157 article -> product/bpc-157)
- Articles learn/[slug] ont des liens "Related" hardcodes

---

## 9. PAGE SPEED SIGNALS -- Score: 6/10

- **CRITICAL**: `force-dynamic` sur le root layout desactive TOUT le cache SSR
- HeroSlider charge via fetch client-side (mauvais pour LCP)
- Pas de `generateStaticParams` pour produit/category/article
- 22 fichiers JSON locales importes dans le root layout

---

## 10. MARKETING FEATURES -- Score: 8/10

- Newsletter popup, Ambassador program (5 tiers), Referral system, Promo codes
- Loyalty/Rewards (5 niveaux), Social sharing, Compare, Bundles, Gift cards, Subscriptions
- Wishlist, Free shipping banner, Cookie consent, Chat widget
- Newsletter sans incentive (pas de code promo pour inscription)

---

## 11. ANALYTICS -- Score: 2/10

**CRITICAL: AUCUN tracking analytics implemente**
- Aucun GA4, GTM, Facebook Pixel
- Aucun event tracking (add_to_cart, purchase, etc.)
- Admin SEO a les champs mais ne sont connectes a RIEN
- Cookie consent n'active AUCUN script de tracking

---

## 12. EMAIL MARKETING -- Score: 7/10

- Welcome email + series J+3, Abandoned cart (1-48h), Order lifecycle (6 events)
- Birthday emails, Satisfaction survey, Points expiring, Price drop alerts
- Manque: nurturing post-achat, review request, win-back inactifs

---

## RESUME DES SCORES

| Critere | Score |
|---------|-------|
| Metadata | 4/10 |
| Sitemap | 7/10 |
| Robots.txt | 8/10 |
| Structured Data | 7/10 |
| URL Structure | 7/10 |
| Heading Hierarchy | 6/10 |
| Images SEO | 5/10 |
| Internal Linking | 7/10 |
| Page Speed | 6/10 |
| Marketing Features | 8/10 |
| Analytics | 2/10 |
| Email Marketing | 7/10 |

## **SCORE GLOBAL: 52/100**

---

## TOP 10 ACTIONS PRIORITAIRES

1. **[CRITICAL] Installer GA4 + e-commerce tracking** (view_item, add_to_cart, purchase)
2. **[CRITICAL] Ajouter generateMetadata sur ~35 pages manquantes** (learn/[slug] en priorite)
3. **[CRITICAL] Creer OG image et logo manquants** (/images/og-default.jpg, /images/logo.png)
4. **[CRITICAL] Supprimer force-dynamic du root layout**
5. **[CRITICAL] Completer le sitemap** avec toutes les pages publiques
6. **[HIGH] Implementer hreflang** pour les 22 langues
7. **[HIGH] Ajouter JSON-LD Article sur learn/[slug]** (articleSchema() existe mais jamais utilisee)
8. **[HIGH] Optimiser Hero pour LCP** (SSR + Next.js Image + priority)
9. **[HIGH] Remplir sameAs dans Organization schema** (liens sociaux)
10. **[HIGH] Corriger og:type "product"** sur les pages produit

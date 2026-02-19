# AUDIT EXHAUSTIF FRONTEND / UX -- PEPTIDE-PLUS (BioCycle Peptides)

**Date**: 2026-02-18
**Projet**: `/Volumes/AI_Project/peptide-plus/`
**Stack**: Next.js 15 (App Router), TypeScript strict, Tailwind CSS, Prisma, 22 langues i18n
**Score Global**: 67/100

---

## 1. COMPOSANTS PARTAGES (`src/components/`) -- Score: 7/10

### Problemes trouves

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | `FormatType` et `formatIcons` dupliques entre ProductCard et QuickViewModal | `src/components/shop/ProductCard.tsx:16` + `src/components/shop/QuickViewModal.tsx:13,47-66` | MEDIUM |
| 2 | Sub-components definis dans Header.tsx au lieu d'etre extraits | `src/components/shop/Header.tsx:483-623` | MEDIUM |
| 3 | `FormField` error ne lie pas le message d'erreur a l'input via `aria-describedby` | `src/components/admin/FormField.tsx:22-24` | HIGH |
| 4 | `Skeleton` n'a pas de texte sr-only ("Loading...") pour lecteurs d'ecran | `src/components/ui/Skeleton.tsx` | LOW |
| 5 | `FormError` tres minimal (4 lignes) -- pas de variantes (warning, info) | `src/components/ui/FormError.tsx` | LOW |

### Points positifs
- Barrel exports admin bien organises
- `Button` admin avec 5 variantes, 3 tailles, loading state, support icones
- `DataTable` generique avec tri, selection, etats vides/chargement
- `Breadcrumbs` avec JSON-LD schema.org et troncature mobile intelligente
- Bonne separation shop / admin / ui / layout / checkout / payment / chat

---

## 2. PAGES SHOP (`src/app/(shop)/`) -- Score: 7/10

### Problemes trouves

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | Page Protocols fait 1096 lignes avec 6+ sub-components inline | `src/app/(shop)/account/protocols/page.tsx:1-1096` | MEDIUM |
| 2 | Protocols utilise localStorage uniquement (pas de persistence serveur) | `src/app/(shop)/account/protocols/page.tsx` | HIGH |
| 3 | Pas d'error.tsx specifique pour les routes (shop), (auth), admin | Manquant | HIGH |
| 4 | Un seul `not-found.tsx` a la racine | Manquant dans `src/app/(shop)/` | LOW |
| 5 | SearchModal prix affiche avec `toFixed(2)` au lieu de `formatPrice()` | `src/components/shop/SearchModal.tsx:~151` | MEDIUM |

### Points positifs
- 7 fichiers `loading.tsx` couvrant les routes principales
- Bonne utilisation des route groups `(shop)`, `(public)`, `(auth)`
- ProductCard riche avec format selector, badges, quickview, compare, wishlist

---

## 3. PAGES ADMIN (`src/app/admin/`) -- Score: 7/10

### Problemes trouves

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | Admin Modal manque `role="dialog"` et `aria-modal="true"` | `src/components/admin/Modal.tsx:48-55` | HIGH |
| 2 | Admin Modal n'a pas de focus trap | `src/components/admin/Modal.tsx:23-84` | HIGH |
| 3 | Bouton close du Modal manque `aria-label="Close"` | `src/components/admin/Modal.tsx:62-67` | MEDIUM |

---

## 4. PAGES AUTH (`src/app/(auth)/`) -- Score: 6/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | Inconsistance `useI18n()` vs `useTranslations()` | Multiple fichiers auth | MEDIUM |
| 2 | Pas de rate-limiting UI sur forgot-password | `forgot-password/page.tsx` | HIGH |
| 3 | Reset password - pas de force indicator visuel | `reset-password/page.tsx` | MEDIUM |

---

## 5. PAGES ACCOUNT -- Score: 7/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | Protocols: toutes les donnees en localStorage | `protocols/page.tsx` | HIGH |
| 2 | Protocols page monolithique (1096 lignes) | `protocols/page.tsx:1-1096` | MEDIUM |
| 3 | Fallback texte en dur dans Header mobile | `Header.tsx:443-449` | MEDIUM |

---

## 6. NAVIGATION -- Score: 6.5/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | **MobileNavLink utilise `window.location.href`** -- casse le SPA | `Header.tsx:507` | **CRITICAL** |
| 2 | **DropdownItem utilise `window.location.href`** -- meme probleme | `Header.tsx:536` | **CRITICAL** |
| 3 | Layout Header dropdown ne ferme pas au clic externe | `layout/Header.tsx:100-131` | HIGH |
| 4 | Layout Header bouton dropdown manque `aria-expanded` et `aria-haspopup` | `layout/Header.tsx:97-131` | HIGH |
| 5 | MegaMenu refetch a chaque ouverture | `MegaMenu.tsx` | MEDIUM |

---

## 7. FORMULAIRES -- Score: 6/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | ShippingAddressForm utilise des styles inline au lieu de Tailwind | `ShippingAddressForm.tsx:102-159` | HIGH |
| 2 | ShippingAddressForm utilise `var(--gray-200)` potentiellement non definis | `ShippingAddressForm.tsx:107,114` | HIGH |
| 3 | FormField admin ne lie pas l'erreur au champ via `aria-describedby` | `FormField.tsx:22-24` | HIGH |
| 4 | CheckoutForm erreur hardcodee en francais | `CheckoutForm.tsx:309` | MEDIUM |
| 5 | ChatWidget utilise `onKeyPress` (deprecie) | `ChatWidget.tsx:191` | LOW |

---

## 8. GESTION D'ETAT -- Score: 8/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | `useTranslations` importe statiquement les 22 fichiers locale | `useTranslations.ts:6-27` | HIGH |
| 2 | QuickViewModal useEffect deps manquantes | `QuickViewModal.tsx:108` | MEDIUM |
| 3 | SearchModal useEffect deps manquante | `SearchModal.tsx:64` | MEDIUM |

### Points positifs
- CartContext avec localStorage, sync cross-tab, `useCallback`
- WishlistContext avec updates optimistes + rollback
- CurrencyContext avec fallback taux statiques + Intl.NumberFormat
- Types bien definis avec enums TypeScript

---

## 9. RESPONSIVE DESIGN -- Score: 7.5/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | ShippingAddressForm styles inline pas responsive | `ShippingAddressForm.tsx:102-159` | HIGH |
| 2 | ChatWidget largeur fixe `w-[380px]` | `ChatWidget.tsx:234` | MEDIUM |

---

## 10. ACCESSIBILITE -- Score: 5.5/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | **Focus indicators presents dans seulement 11 fichiers sur 39+** | Global | **CRITICAL** |
| 2 | **Admin Modal sans role="dialog", aria-modal, focus trap** | `Modal.tsx:48-55` | **CRITICAL** |
| 3 | Layout Header dropdown sans aria-expanded, aria-haspopup | `layout/Header.tsx:97-131` | HIGH |
| 4 | ChatWidget hardcode "Online", "AI Assistant" | `ChatWidget.tsx:242-243` | HIGH |
| 5 | Global error page texte hardcode en anglais | `global-error.tsx:41-44` | HIGH |
| 6 | FormField error sans aria-describedby | `FormField.tsx:22-24` | HIGH |
| 7 | Pas de skip-to-content link | Global | MEDIUM |

---

## 11. GESTION D'ERREURS UI -- Score: 6/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | **Un seul error.tsx a la racine** | `src/app/error.tsx` | **CRITICAL** |
| 2 | Global error page avec texte non traduit | `global-error.tsx` | HIGH |
| 3 | ChatWidget supprime silencieusement le message en cas d'erreur | `ChatWidget.tsx:182-185` | MEDIUM |

---

## 12. MODALS ET OVERLAYS -- Score: 7/10

| # | Probleme | Fichier:Ligne | Impact |
|---|----------|---------------|--------|
| 1 | Admin Modal sans role="dialog", aria-modal | `Modal.tsx:48-55` | HIGH |
| 2 | Admin Modal sans focus trap | `Modal.tsx:23-84` | HIGH |
| 3 | 3 implementations differentes de "ESC to close" | Multiple | LOW |

---

## SYNTHESE DES SCORES

| # | Zone | Score /10 |
|---|------|-----------|
| 1 | Composants partages | 7.0 |
| 2 | Pages Shop | 7.0 |
| 3 | Pages Admin | 7.0 |
| 4 | Pages Auth | 6.0 |
| 5 | Pages Account | 7.0 |
| 6 | Navigation | 6.5 |
| 7 | Formulaires | 6.0 |
| 8 | Gestion d'etat | 8.0 |
| 9 | Responsive Design | 7.5 |
| 10 | Accessibilite | 5.5 |
| 11 | Gestion d'erreurs UI | 6.0 |
| 12 | Modals et Overlays | 7.0 |

## **SCORE GLOBAL: 67/100**

---

## TOP 5 AMELIORATIONS UX PRIORITAIRES

1. **[CRITICAL] Remplacer `window.location.href` par Next.js router** dans MobileNavLink et DropdownItem
2. **[CRITICAL] Focus indicators sur tous les elements interactifs** (WCAG 2.4.7)
3. **[CRITICAL] Error boundaries par section** (shop, auth, admin)
4. **[HIGH] Migrer ShippingAddressForm vers Tailwind** (supprimer styles inline)
5. **[HIGH] Charger les traductions dynamiquement** (reduire bundle ~5MB)

## RESUME: 40 problemes identifies, dont 4 critiques.

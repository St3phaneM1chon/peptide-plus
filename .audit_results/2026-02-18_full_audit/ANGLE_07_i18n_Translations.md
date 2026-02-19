# AUDIT EXHAUSTIF i18n - BioCycle Peptides (peptide-plus)

**Date**: 2026-02-18
**Projet**: `/Volumes/AI_Project/peptide-plus/`
**Stack**: Next.js 15, TypeScript (strict), Prisma 5.22, PostgreSQL
**Nombre de locales**: 22 (en, fr, ar, ar-dz, ar-lb, ar-ma, de, es, gcr, hi, ht, it, ko, pa, pl, pt, ru, sv, ta, tl, vi, zh)
**Score Global**: 50/100

---

## 1. SYSTEME DE TRADUCTION (Architecture) -- Score: 6/10

### Problemes

**CRITICAL - Double systeme de hooks paralleles**
- `useTranslations()` (hook autonome): 103 usages dans 92 fichiers. Fallback vers `en.json`.
- `useI18n()` / `useTranslation()` (contexte): 92 usages dans 80 fichiers. Retourne la cle brute.
- Comportement utilisateur inconsistant selon la page visitee.

**HIGH - Import statique triple des 22 fichiers de locale**
- 4 fichiers importent statiquement les 22 locales: layout.tsx, index.ts, useTranslations.ts, server.ts
- ~5MB+ de JSON non compresse dans le bundle initial.

**MEDIUM - Rechargement complet au changement de locale**
- `window.location.reload()` au lieu d'un re-rendu React.

---

## 2. FICHIERS DE LOCALE -- Score: 8/10

- 22 fichiers presents, FR reference: 5611 lignes, 5237 cles
- EN: correspondance parfaite avec FR (0 cle manquante)
- Ecart max: 72 lignes entre FR (5611) et IT (5539)

---

## 3. CLES MANQUANTES -- Score: 7/10

- FR vs EN: **correspondance parfaite** (5237 cles chacun)
- Les 20 autres locales non verifiees programmatiquement (ecarts possibles dans it, ko, pa)

---

## 4. TEXTE ENCODE EN DUR (Hardcoded) -- Score: 3/10

**CRITICAL - 245 instances de texte non traduit:**
- **93 messages toast()** non traduits (24 fichiers)
- **54 attributs aria-label** encodes en dur (29 fichiers)
- **98 attributs placeholder=** encodes en dur (40 fichiers)

Exemples critiques:
- `CartContext.tsx:101`: `` toast.success(`${newItem.name} added to cart`) ``
- `checkout/page.tsx:409`: `toast.error('Something went wrong placing your order.')`
- `account/settings/page.tsx:165`: `toast.error('Passwords do not match')`

---

## 5. TRADUCTIONS EN BASE DE DONNEES -- Score: 7/10

- 14 modeles Prisma de traduction
- Systeme de traduction automatique via GPT-4o-mini
- Seuls Product et Category sont activement traduits dans le code de rendu
- 12 modeles (Article, BlogPost, Faq, Guide, etc.) ont des tables mais ne sont pas utilises

---

## 6. SUPPORT RTL (Arabe) -- Score: 3/10

**CRITICAL - Aucun CSS RTL**
- `dir="rtl"` est declare sur `<html>` mais aucun composant ne s'adapte
- Aucune classe Tailwind RTL (`rtl:`, `ltr:`) utilisee
- Le plugin Tailwind RTL n'est pas configure

**HIGH - Template email RTL incomplet**
- `email-templates.ts:68`: ne couvre que `ar`, pas `ar-dz`, `ar-lb`, `ar-ma`
- Emails traduits en 3 langues seulement (fr/en/es), les 19 autres recoivent l'espagnol

---

## 7. PLURALISATION -- Score: 3/10

**HIGH - Pas de support ICU MessageFormat**
- Pluralisation via cles separees (`cart.item` / `cart.items`) uniquement
- Ne fonctionne pas pour: Arabe (4 formes), Russe/Polonais (3 formes)
- Logique JavaScript manuelle dans certains composants

---

## 8. SEO i18n -- Score: 1/10

**CRITICAL - Aucune balise hreflang**
**CRITICAL - Sitemap monolingue** (pas de variantes linguistiques)
**CRITICAL - Pas de routing par locale** (pas de prefixe `/fr/`, `/en/`)
**HIGH - Metadata non traduite** (OG/Twitter fixe en anglais)

---

## 9. QUALITE DES TRADUCTIONS -- Score: 5/10

- 10 cles en anglais dans fr.json (fichier de reference): admin.customers.title, admin.users.role*, admin.dashboard.title
- Fallback inconsistant entre les deux systemes de hooks
- Aucune detection de traductions manquantes en production

---

## 10. FORMATAGE DATES/NOMBRES -- Score: 7/10

- Utilisation correcte de `Intl.DateTimeFormat` et `Intl.NumberFormat`
- Devise unique CAD hardcodee dans le formateur i18n
- Server-side default 'fr' vs client default 'en'

---

## RESUME DES SCORES

| # | Domaine | Score |
|---|---------|-------|
| 1 | Systeme de traduction | 6/10 |
| 2 | Fichiers de locale | 8/10 |
| 3 | Cles manquantes | 7/10 |
| 4 | Texte encode en dur | 3/10 |
| 5 | Traductions DB | 7/10 |
| 6 | Support RTL | 3/10 |
| 7 | Pluralisation | 3/10 |
| 8 | SEO i18n | 1/10 |
| 9 | Qualite traductions | 5/10 |
| 10 | Formatage dates/nombres | 7/10 |

## **SCORE GLOBAL: 50/100**

---

## PLAN D'ACTION PRIORITAIRE

### P0 - CRITIQUE
1. Unifier les hooks de traduction (eliminer le double systeme)
2. Traduire les 93 toast() en dur
3. Ajouter les balises hreflang pour 22 locales
4. Corriger les 10 cles anglaises dans fr.json

### P1 - HIGH
5. Ajouter le support CSS RTL (plugin Tailwind)
6. Traduire les 98 placeholder= et 54 aria-label=
7. Implementer la pluralisation ICU MessageFormat
8. Creer un sitemap multilingue
9. Corriger le template email RTL (ar-dz, ar-lb, ar-ma)

### P2 - MEDIUM
10. Chargement dynamique des locales (reduire bundle ~5MB)
11. Routing par locale (/fr/, /en/)
12. Traduire les metadata OpenGraph/Twitter
13. Connecter les 12 modeles de traduction DB non utilises

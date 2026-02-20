# Audit Exhaustif Admin Peptide-Plus - 825 Ameliorations
# Date: 2026-02-19
# 33 elements de menu x 25 ameliorations = 825 total

---

## Resume Executif

| Groupe | Elements | Ameliorations | CRITICAL | HIGH | MEDIUM | LOW |
|--------|----------|---------------|----------|------|--------|-----|
| G1 Commerce Core | 6 | 150 | 24 | 42 | 42 | 42 |
| G2 Marketing & Sales | 6 | 150 | 24 | 42 | 42 | 42 |
| G3 Finance & Accounting | 6 | 150 | 30 | 42 | 42 | 36 |
| G4 Content & Communication | 8 | 200 | 40 | 40 | 40 | 80 |
| G5 Operations & Config | 7 | 175 | 35 | 35 | 35 | 70 |
| **TOTAL** | **33** | **825** | **~153** | **~201** | **~201** | **~270** |

---

## Taches TodoMaster (83 pending)

### Sprint S8 - Bug Fixes Urgents (8 taches)
- `admin-s8-01`: Fix commandes PATCH->PUT
- `admin-s8-02`: Creer route inventaire/[id]/route.ts
- `admin-s8-03`: Connecter inventaire historique a l'API
- `admin-s8-04`: Fix reconciliation bookBalance
- `admin-s8-05`: Aligner frequences abonnement
- `admin-s8-06`: Creer 6 routes API comptabilite manquantes
- `admin-s8-07`: Fix tax reports region filter
- `admin-s8-08`: Fix expense anomalies (objet vide)

### Sprint S9 - Connexions Backend (2 taches restantes)
- `admin-s9-08`: Connecter Promotions toggle/delete
- `admin-s9-10`: Connecter Newsletter campaigns

### Sprint S10 - Infrastructure (6 taches)
- `admin-s10-01` a `admin-s10-06`: Sequences DB, modeles Prisma, calculs serveur, multi-currency, upload, audit logging

### Sprint S11 - UX/Performance (4 taches)
- `admin-s11-01/03/05/07`: Skeleton loading, SWR caching, UAT isolation, URL filters

### Sprint S12 - Polish (4 taches)
- `admin-s12-01/03/05/07`: Charting library, keyboard shortcuts, notifications, global search

### Cross-Cut (4 taches)
- `admin-xcut-04/06/07/08`: Audit logging, mockups->backend, Decimal.js, currency dynamique

### Flaws (38 taches)
- G1: 10 flaws | G2: 6 flaws | G3: 10 flaws | G4: 6 flaws | G5: 6 flaws

### Roadmap (16 taches) + Import Lab (1 tache ready)

---

## TOP 20 Problemes Critiques

1. **Stripe SDK top-level instantiation** - Crash en CI/build (commandes, refunds)
2. **updateStatus client-only** - Abonnements, ambassadeurs: changements perdus au refresh
3. **Boutons sans onClick** (~25+) - Send Email, Print, Export, Configure tous inoperants
4. **setState sans API** (~8 modules) - Donnees perdues au refresh
5. **Race condition numeros ecritures** - Doublons possibles en concurrent
6. **6 routes API comptabilite manquantes** - Endpoints appeles mais inexistants
7. **XSS x5** - Medias, emails, SEO, webinaires: contenu HTML non sanitise
8. **Newsletter jamais envoyee** - "Send Now" marque SENT sans envoyer d'email
9. **Reconciliation bookBalance cassee** - Balance toujours 0
10. **Categories API publique** - includeInactive=true sans auth
11. **Clients: privilege escalation** - EMPLOYEE peut se promouvoir OWNER
12. **Inventaire: pas de revert sur erreur** - Stock UI faux apres echec API
13. **Promotions create/edit stubbed** - "Feature in development" placeholder
14. **Bannieres: pas de [id]/route.ts** - Edit/delete/toggle tous casses (405)
15. **Ambassadeurs: commissions sync N+1** - ~5000 queries par page load
16. **Fidelite: bonus fields non sauvegardes** - defaultValue au lieu de state
17. **Factures: payment method non sauvegardee** - Reconciliation impossible
18. **Tax reports: fetch all rows JS** - Pas d'aggregation SQL, lent
19. **Credentials bancaires en clair** - Pas de chiffrement
20. **3 modeles Prisma manquants** - AuditTrail, ReconciliationLog, etc.

---

## Patterns Transversaux

| Pattern | Occurrences | Impact |
|---------|-------------|--------|
| Boutons decoratifs sans onClick | ~25+ | Fonctionnalites manquantes |
| setState sans appel API | ~8 modules | Perte de donnees au refresh |
| Pas de pagination | 20/33 pages | Performance degradee |
| Currency hardcodee "$" | ~15 endroits | Affichage incorrect multi-devise |
| Pas d'audit trail | 33/33 pages | Compliance impossible |
| withAdminGuard manquant | ~5 APIs | Pas de CSRF/rate-limit |
| unoptimized sur Image | ~10 endroits | Bande passante gaspillee |
| i18n hardcode | ~20 strings | Traductions cassees |
| CSV injection risque | ~3 exports | Securite |
| No error revert optimistic | ~6 modules | UI desynchronisee |

---

## G1 - Commerce Core (6 elements, 150 ameliorations)

### 1. Dashboard (25)
- C1: No auth guard on dashboard page
- C2: formatCurrency duplicated vs useI18n hook
- C3: StatCard data not validated for nulls
- C4: No rate limiting on dashboard API
- H1-H7: Missing AOV metric, no alerts, no drill-down, no real-time, no export, no date comparison, no custom widgets
- M1-M6: No sparklines, no accessibility on pulse, no responsive charts, no loading skeleton, stale data indicator, keyboard nav
- L1-L9: Dark mode, welcome personalization, keyboard shortcuts, command palette

### 2. Produits (25)
- C1: Delete uses PUBLIC /api/products (not admin), no CSRF
- C2: CSV import no file size limit, no filename sanitization
- C3: All products fetched without pagination (server)
- C4: CSV export vulnerable to injection
- H1-H7: No bulk actions, client-side only sort, no duplicate, hardcoded $, no drag-drop, no import errors, no audit trail
- M1-M7: Search limited to name/slug, no pagination indicator, unoptimized images, reload after import, unused constants, no column toggle
- L1-L8: No count animation, broken "View on site" for inactive, no quick view, no URL filter state, clickable stats, empty state, import roles, hover preview

### 3. Commandes (25)
- C1: Stripe SDK top-level (KB-PP-BUILD-002)
- C2: Admin notes never saved (no API call)
- C3: Send Email + Print buttons have no onClick
- C4: Refund parseFloat rounding issue
- H1-H6: No server page wrapper, date filters client-only, no batch UI, export CSV no onClick, raw enum labels, no order timeline
- M1-M6: No pagination UI, hardcoded carriers, no printing, tracking Enter key, PARTIAL_REFUND badge, no order notifications
- L1-L9: Modal overflow, tax breakdown missing, no copy clipboard, reship reasons, hardcoded $, no replacement badge, loading color, customer link wrong, no shortcuts

### 4. Inventaire (25)
- C1: Optimistic update no revert on error
- C2: No validation stockQuantity >= 0 integer
- C3: Input accepts negative stock
- C4: No concurrency protection (optimistic locking)
- H1-H6: Import CSV no onClick, no bulk adjustment, adjustment reason disconnected, no low stock alerts, no history export, no PO creation
- M1-M6: No pagination, API field name mismatch, currency multiplication wrong, locale wrong in history, no recent changes indicator, missing filter options
- L1-L9: Subtle stock colors, no barcode scanner, edit button responsive, no reorder calculation, retail vs cost value, no user in history, no snapshots, no URL filters, small checkmark

### 5. Categories (25)
- C1: API GET is PUBLIC, includeInactive without auth
- C2: POST uses manual auth (no withAdminGuard, no CSRF)
- C3: Slug not validated at API level
- C4: Image URL accepts any URL (SSRF, XSS)
- H1-H6: No drag-drop reorder, max 2 nesting levels, no image upload, delete is soft but labeled "Delete", no SEO fields, hardcoded "Sub" label
- M1-M6: eslint-disable masking real bug, no search, flat parent selector, no circular reference check, no image preview in form, no rich text description
- L1-L9: Auto-clear errors, "sub" abbreviation, no parent toggle warning, auto-sort order, no stats, style hack delete button, orphan categories silent, slug no transliteration, no keyboard shortcut

### 6. Clients (25)
- C1: EMPLOYEE can change any role to OWNER (privilege escalation)
- C2: Loyalty points no max limit (999999999 possible)
- C3: Suspend + Reset Password buttons have no onClick
- C4: Initial fetch pre-filters CLIENT, filter shows all roles but empty
- H1-H6: Export no onClick, no user creation, Send Email no onClick, no activity log, no phone search, no pagination
- M1-M6: clients vs customers duplication, hardcoded tier English labels, no point slider, hardcoded $, no error revert, no email verified indicator
- L1-L9: unoptimized avatar, View Orders link broken, no client notes, VIP count not broken down, competing row click vs button, no order preview, no copy referral code, no segmentation, raw tier text

---

## G2 - Marketing & Sales (6 elements, 150 ameliorations)

### 1. Promotions (25)
- C1-C4: Create form not connected to API (stubbed), auto-apply no mechanism, no max discount cap, overlapping promotions no conflict detection
- H1-H7: Edit opens "Feature in development", toggle/delete client-only, no usage stats, no AB testing, no schedule calendar, conditions incomplete, types mismatch
- M1-M7: No search, client-side filtering only, no pagination, no template feature, date picker UX, no priority reorder
- L1-L7: No import/export, no analytics view, type mapping inconsistencies

### 2. Newsletter (25)
- C1: Campaign data stored in SiteSetting JSON (not proper table)
- C2: Campaign IDs with Date.now()+Math.random() (collisions)
- C3: "Send Now" sets SENT but never actually sends email
- C4: Subscriber delete button no onClick
- H1-H7: Search non-functional, Export CSV no onClick, no pagination, Edit/Send buttons no onClick, Cancel no onClick, Statistics no onClick, no template preview
- M1-M7: No email validation, NaN avgOpenRate, no error isolation, no status filter, no schedule date picker, no virtualization, no content sanitization
- L1-L7: No CSV import, no resend non-openers, source breakdown incomplete, no unsubscribe chart, no template variables, no AB testing, prop naming inconsistency

### 3. Fidelite (25)
- C1: Config sent without sanitization (XSS in tier perks)
- C2: Silent fallback to defaults on invalid input
- C3: Negative values accepted (pointsValue, multiplier)
- C4: No HTML sanitization on perk strings
- H1-H7: Bonus fields use defaultValue (never saved), edit tier "Feature in development", add tier no onClick, simulation hardcoded, no transactions view, no manual point adjust, no config confirmation
- M1-M7: Hardcoded grid-cols-5, wrong color mapping (orange->sky), simulation select not connected, simulation input not connected, floating point step, no unsaved indicator, dual storage SiteSetting
- L1-L7: No expiration config, no analytics dashboard, no email notifications, no icon perks, no what-if simulator, no holiday multiplier, no tier migration preview

### 4. Ambassadeurs (25)
- C1: API no withAdminGuard (no CSRF, no rate-limit)
- C2: Commission sync N+1 queries on every GET (5000+ queries)
- C3: updateStatus client-only (never calls API)
- C4: Payouts API no withAdminGuard, allows payout for SUSPENDED
- H1-H7: Applications button never shows UI, Configure no onClick, Edit Commission no onClick, predictable referral codes, no PUT/PATCH endpoint, no payout notification, commission formula ambiguous
- M1-M7: No pagination, hardcoded "1" notification badge, reads cause writes, no double-click prevention, no performance charts, non-standard currency format, error returns 200
- L1-L7: No leaderboard, no UTM links, no payout export, no auto-promotion, no bulk communication, no fraud detection, hardcoded English tiers

### 5. Codes Promo (25)
- C1: handleSubmit doesn't check res.ok (silent failure)
- C2: toggleActive error doesn't revert state
- C3: deletePromoCode frontend removes but API soft-deletes (ghost codes)
- C4: parseInt truncates FIXED_AMOUNT decimals
- H1-H7: No decimal for FIXED_AMOUNT, no search/filter, API no search params, no product/category selector, no usage analytics, no pagination, no copy-to-clipboard
- M1-M7: No configurable code format, past dates accepted, no near-limit indicator, no sensible defaults, no sorting, fragile date slice, no deactivation confirmation
- L1-L7: No bulk generation, no QR codes, no expiration alerts, no total discount stat, no duplicate action, no tags, string type inconsistency

### 6. Bannieres (25)
- C1: API no withAdminGuard (no CSRF)
- C2: backgroundUrl accepts any URL (SSRF)
- C3: statsJson no validation (invalid JSON breaks frontend)
- C4: overlayGradient accepts arbitrary CSS (injection)
- H1-H7: NO [id]/route.ts (edit/delete/toggle ALL broken 405), no error handling, moveSlide race condition, deleteSlide no error handling, no image upload, 22 locale tabs overflow, no preview
- M1-M7: No upsert for translations edit, hardcoded LOCALES, unoptimized Image, no drag-drop, tab overflow mobile, no form validation feedback, default opacity not shown
- L1-L7: No click analytics, no auto-copy translations, no duplication, no schedule calendar, no responsive preview, LOCALE_LABELS hardcoded, no video preview

---

## G3 - Finance & Accounting (6 elements, 150 ameliorations)

### 1. Factures (25)
- C1-C5: Payment method/reference not saved (reconciliation broken), no supplier invoice API, race condition invoice numbers, no double-payment prevention, financial calc with JS floats
- H1-H7: No credit note from invoice, no recurring invoices, no aging report, no partial payment tracking, no PDF generation, no email invoice, no approval workflow
- M1-M6: Client-side search only, no bulk actions, no currency display, no overdue alerts, no template customization
- L1-L6: No duplicate detection, no import, no mobile-optimized, no skeleton loading

### 2. Ecritures/Journal Entries (25)
- C1-C5: Race condition sequential numbers, debit!=credit no reject, no AuditTrail model, entries editable after posting (no lock), no closing entries year-end
- H1-H7: No recurring entries, no reversals, no import CSV, no search, no template, no accruals, no approval workflow
- M1-M6: No auto-balancing, no account type validation, no multi-period comparison, no drill-down, no month-end close
- L1-L6: No keyboard shortcuts, no batch posting, no notes/attachments

### 3. Depenses (25)
- C1-C5: Expense number race condition, no approval workflow, receipt upload not connected, vendor creation client-only, floating-point amounts
- H1-H7: No receipt OCR, no recurring expenses, no vendor management, no PO matching, no mileage/per-diem, no credit card import, no budget check
- M1-M7: No search API-side, no expense categories hierarchy, no approval delegation, no CC import, no mobile optimized
- L1-L6: No duplicate detection, no draft auto-save, no mobile layout, no skeleton

### 4. Dashboard Comptabilite (25)
- C1-C5: KPI changes all show 0, in-memory cache lost on restart, gross margin uses total expenses (not COGS), 11+ parallel queries no circuit breaker, no fiscal year filter
- H1-H6: Hand-coded SVG charts (no library), hardcoded periods, no auto-refresh, cash flow mock data, alerts no history, DSO/DPO partial period wrong
- M1-M8: No drill-down, donut limited categories, no budget vs actual, limited quick actions, no YoY comparison, trend limited 6 months, no AR/AP widget, no bank balance
- L1-L6: No customizable layout, no dark mode charts, no PDF export, generic spinner, no keyboard nav, tasks don't persist

### 5. Abonnements (25)
- C1-C5: updateStatus client-only (NEVER calls API), no PUT endpoint exists, floating-point revenue sum, frequency constants mismatch frontend/API, no payment integration (Stripe)
- H1-H7: Config hardcoded, no renewal/expiration, no User relation in Prisma, no history/changelog, detail read-only, no cancellation flow, no churn/MRR metrics
- M1-M7: Client-side search only, no plan management CRUD, no email notifications, no pagination, no invoice generation, no proration, no grace period
- L1-L6: No analytics chart, inconsistent status colors, no bulk management, no export, no trial support, no coupon support

### 6. Rapports Fiscaux (25)
- C1-C5: Fetch all rows in JS (no SQL aggregation), SHA-256 hash includes mutable notes, no validation vs journal entries, only 3/6 report types mapped, no digital signature
- H1-H7: Year hardcoded 2024-2026, no GST/QST quick method, no ITC/ITR tracking, no installment tracking, error handling disconnected, no T2/T5/RL-1, no standard format export
- M1-M6: Annual section placeholder, no YoY comparison, no audit trail status changes, no tax calendar, no detail breakdown, no auto-generation
- L1-L7: No archival system, no multi-jurisdiction, no completeness indicator, no auditor annotations, no CRA integration, no search/filter, no print layout

---

## G4 - Content & Communication (8 elements, 200 ameliorations)
**Fichier detaille**: `docs/G4-G5-improvements-375.md`

Elements: Medias, Emails, SEO, Webinaires, Chat, Avis/Reviews, Questions, Traductions
- ~15 boutons decoratifs sans onClick (upload, save, export, send test)
- setState sans persistence serveur partout
- 7/8 pages sans pagination
- ChatDashboard.tsx: 15+ strings francais hardcodes (pas de t())
- Aucune sanitization HTML (XSS via contenu riche)

---

## G5 - Operations & Config (7 elements, 175 ameliorations)
**Fichier detaille**: `docs/G4-G5-improvements-375.md`

Elements: Parametres, Employes, Livraison, Rapports, UAT, Permissions, Logs
- Rapports: export PDF/CSV non fonctionnel
- UAT: pas d'isolation test/production
- Permissions: modele RBAC incomplet
- Logs: pas de retention/rotation

---

## Progression Taches

### Completees cette session (20)
- G4-flaw-03/04/05/06 (SEO, webinaires, medias, emails)
- G5-flaw-02/03/04 (employes, livraison, parametres)
- G2-flaw-03/04/08/09 (fidelite, ambassadeurs, promo-codes, bannieres)
- S9-01/02/03/04/05/06/07/09/11 (connexions backend deja faites)

### Restantes: 83 taches
- Priorite 1: S8 (8 bug fixes urgents)
- Priorite 2: S9 (2 connexions restantes)
- Priorite 3: S10 (6 infrastructure)
- Priorite 4: 38 flaws + 4 cross-cut
- Priorite 5: S11-S12 (8 UX/polish)
- Priorite 6: 16 roadmap + 1 import lab

---

## Fichiers Source des Rapports Detailles
- G1 Commerce: `/private/tmp/claude-501/-Volumes-AI-Project/tasks/a35129f.output`
- G2 Marketing: `/private/tmp/claude-501/-Volumes-AI-Project/tasks/a16707a.output`
- G3 Finance: `/private/tmp/claude-501/-Volumes-AI-Project/tasks/a257979.output`
- G4+G5 Content+Ops: `/Volumes/AI_Project/peptide-plus/docs/G4-G5-improvements-375.md`

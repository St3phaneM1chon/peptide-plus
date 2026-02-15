# PEPTIDE-PLUS - Fixes en attente
## Audit: 737 → 102 issues | Post-agents: ~40 restantes estimées

### SECURITY (6 fixes - Priorité HAUTE)
1. `src/lib/accounting/currency.service.ts:265` - Ajouter commentaire SECURITY NOTE sur Math.random()
2. `src/app/admin/comptabilite/devises/page.tsx:373` - Ajouter commentaire SECURITY NOTE sur Math.random()
3. `src/lib/canadianTaxes.ts:2381` - Wrap RegExp dans try/catch
4. `src/lib/accounting/ml-reconciliation.service.ts:395` - Escape regex special chars
5. `scripts/batch-translate.ts:166` - Escape field.name avant RegExp
6. `src/lib/translation/auto-translate.ts:213` - Escape field.name avant RegExp

### ESLINT (17 fixes - no-explicit-any + misc)
- `scripts/batch-translate.ts:181` - Trailing semicolon in eslint-disable + `any` → `unknown`
- `src/app/(public)/catalogue/page.tsx:230` - `product as any` → `product as unknown as Product`
- `src/components/layout/HeaderCorporate.tsx:441,445` - `session: any` + `t: any` → types propres
- `src/components/order/DigitalDeliveryTracking.tsx:14` - `order: any` → interface typée
- `src/components/order/OrderSummary.tsx:13` - `amount: number | any` → `amount: number`
- `src/components/order/PhysicalDeliveryTracking.tsx:13,463` - `order: any` + `shipping: any` → types
- `src/components/shop/DisclaimerModal.tsx:20` - `navigator as any` → `Navigator & { userLanguage?: string }`
- `src/components/shop/Header.tsx:55` - `(c: any)` → `(c: { name; slug; isActive? })`
- `src/components/shop/NewsletterPopup.tsx:17` - `navigator as any` → typé
- `src/config/navigation.ts:277` - Anonymous default export → named
- `src/i18n/client.tsx:13,83` - `Record<string, any>` → `Record<string, unknown>`
- `src/i18n/server.ts:66` - `let value: any` → `unknown`
- `src/lib/permissions.ts:312` - `const module` → `const permissionModule`

### TYPESCRIPT (40 fixes - types + unused vars)
**Unused vars (supprimer ou utiliser):**
- `src/app/admin/ambassadeurs/page.tsx:47,53` - _statusVariant, _statusLabels
- `src/app/admin/fiscal/reports/page.tsx:136` - _countryColumns
- `src/app/api/accounting/alerts/route.ts:97` - _startOfMonth
- `src/app/api/payments/webhook/route.ts:360` - _totalTax
- `src/components/shop/Header.tsx:34` - _router (supprimer ligne)
- `src/components/shop/NewsletterPopup.tsx:30` - _showPopupAfterDisclaimer (dead code)
- `src/i18n/client.tsx:36` - _router (supprimer ligne)

**Unused params Next.js (prefix _):**
- `src/app/api/accounting/periods/[code]/close/route.ts:7` - request → _request
- `src/app/api/admin/orders/[id]/route.ts:20` - request → _request

**Type mismatches (type assertions):**
- `prisma/seed-hero-slides.ts:271-282` - `as string | undefined` sur cta2Text/statsJson
- `scripts/test-uat.ts:124` - `row as unknown as Record<string, unknown>`
- `src/app/(public)/checkout/[slug]/CheckoutPageClient.tsx:61` - ShippingAddress state type
- `src/app/(shop)/account/protocols/page.tsx:658` - `'mcg' as 'mcg'|'mg'|'IU'`
- `src/app/admin/comptabilite/recherche/page.tsx:121` - cast saved.filters.types
- `src/app/api/admin/inventory/route.ts:142` - cast item properties
- `src/app/api/admin/orders/route.ts:47,53` - cast where.createdAt
- `src/app/api/chat/conversations/[id]/route.ts:175` - explicit spread
- `src/app/api/payments/paypal/capture/route.ts:136` - cast item.price/quantity
- `src/app/api/payments/webhook/route.ts:234` - cast item.price/quantity
- `src/lib/accounting/quick-entry.service.ts:268,283,308` - String() casts
- `src/lib/accounting/webhook-accounting.service.ts:341,347` - `as unknown as`
- `src/lib/auth-config.ts:233-234` - `as unknown as` + UserRole cast
- `src/lib/auth.ts:93,193` - refreshToken as string
- `src/lib/uat/verifier.ts:64,633` - tax type + InputJsonValue cast

---
*Généré par Aurelia - 2026-02-13 20:15*
*Reprendre avec: `audit /Volumes/AI_Project/peptide-plus` après corrections*

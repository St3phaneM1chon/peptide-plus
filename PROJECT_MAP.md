# PROJECT MAP - peptide-plus (BioCycle Peptides)
# LAST UPDATED: 2026-03-07 (LeadEngine: Google Maps scraper, waterfall enrichment, AI scoring, DNC compliance, 1-click campaign, 12 API routes, 7 lib files, 29 i18n keys)
# RULE: This file MUST be updated after every feature addition/modification
# SEE: .claude/rules/project-map-mandatory.md for enforcement rules

## QUICK STATS
- **Pages**: 286 | **API Routes**: 774 | **Prisma Models**: 267 | **Enums**: 61 | **Components**: 141 | **Hooks**: 24 | **Lib files**: 376
- **Loading skeletons**: 198 loading.tsx files (coverage expanded beyond admin pages)
- **Stack**: Next.js 15 (App Router), TypeScript strict, Prisma 5.22, PostgreSQL 15, Redis
- **i18n**: 22 languages (fr reference) | **Auth**: NextAuth v5 + MFA + WebAuthn
- **Hosting**: Azure App Service | **Payments**: Stripe + PayPal
- **Orphan models** (no Prisma FK): 36/124 (29.0%) -- many use soft references

---

## TABLE OF CONTENTS
1. [Feature Domains & Cross-References](#1-feature-domains--cross-references)
2. [Dependency Chains](#2-dependency-chains)
3. [Impact Analysis (Change X -> Check Y)](#3-impact-analysis)
4. [Admin Pages (87+)](#4-admin-pages-87)
5. [Shop Pages (42+)](#5-shop-pages-42)
6. [Public Pages (36)](#6-public-pages-36)
7. [Auth & Dashboard Pages](#7-auth--dashboard-pages)
8. [API Routes by Domain](#8-api-routes-by-domain)
9. [Components & Their Consumers](#9-components--their-consumers)
10. [Hooks & Their Consumers](#10-hooks--their-consumers)
11. [Context Providers](#11-context-providers)
12. [Prisma Model Relationships](#12-prisma-model-relationships)
13. [Lib Services](#13-lib-services)
14. [Infrastructure](#14-infrastructure)
15. [Known Gaps & Status Legend](#15-known-gaps--status-legend)

---

## 1. FEATURE DOMAINS & CROSS-REFERENCES

Each domain lists ALL pages, API routes, models, and components involved.
**Use this section to understand what a feature touches across the entire stack.**

---

### 1.1 PRODUCT CATALOG
> **What**: Product listing, detail, categories, formats, translations, images

| Layer | Elements |
|-------|----------|
| **Pages** | `/shop`, `/product/[slug]`, `/category/[slug]`, `/search`, `/compare`, `/admin/produits`, `/admin/produits/nouveau`, `/admin/produits/[id]`, `/admin/categories` |
| **API Routes** | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/[id]`, `GET /api/products/search`, `GET /api/products/compare`, `GET /api/products/by-slug/[slug]`, `GET /api/products/viewed`, `GET /api/products/recommendations`, `GET /api/categories`, `POST /api/categories` |
| **Models** | `Product`, `ProductFormat`, `ProductImage`, `ProductTranslation`, `ProductFormatTranslation`, `Category`, `CategoryTranslation`, `QuantityDiscount`, `UpsellConfig` |
| **Components** | `ProductCard`, `ProductGallery`, `ProductReviews`, `ProductQA`, `ProductVideo`, `ProductBadges`, `FormatSelector`, `QuantityTiers`, `StickyAddToCart`, `WishlistButton`, `CompareButton`, `CompareBar`, `StockAlertButton`, `PriceDropButton`, `ShareButtons`, `RecentlyViewed`, `CategoryScroller` |
| **Hooks** | `useCompare`, `useRecentlyViewed`, `useCurrency` |
| **Contexts** | `CartContext`, `UpsellContext`, `CurrencyContext`, `I18nProvider` |
| **Lib** | `@/lib/db`, `@/lib/translation`, `@/lib/structured-data`, `@/lib/format-icons`, `@/data/peptideChemistry`, `@/lib/validations/product` |
| **Affects** | Orders (OrderItem refs productId), Inventory, Reviews, Bundles, Subscriptions, Wishlist, StockAlerts, PriceWatch, Accounting (auto-entries) |

---

### 1.2 ORDERS & CHECKOUT
> **What**: Cart, checkout flow, order creation, order tracking, returns

| Layer | Elements |
|-------|----------|
| **Pages** | `/checkout`, `/checkout/success`, `/track-order`, `/account/orders`, `/account/returns`, `/admin/commandes` |
| **API Routes** | `POST /api/orders`, `GET /api/orders/by-session`, `GET /api/orders/track`, `GET /api/admin/orders`, `GET /api/account/orders`, `GET/POST /api/account/returns` |
| **Models** | `Order`, `OrderItem`, `Currency`, `PaymentError`, `ReturnRequest`, `Refund` (orphan) |
| **Components** | `CartDrawer`, `CartCrossSell`, `OrderSummary`, `CheckoutForm`, `PhysicalDeliveryTracking`, `DigitalDeliveryTracking`, `TrackingTimeline`, `FormError`, `AddressAutocomplete` |
| **Hooks** | `useDiscountCode`, `useCurrency` |
| **Contexts** | `CartContext`, `CurrencyContext`, `SessionProvider`, `I18nProvider` |
| **Lib** | `@/lib/canadianTaxes`, `@/lib/form-validation`, `@/lib/validation`, `@/lib/stripe`, `@/lib/paypal` |
| **Affects** | Payments (Stripe/PayPal), Inventory (reservations), Accounting (auto journal entries), Shipping, Loyalty (points earn), Ambassador (commissions), Email (order lifecycle) |
| **NOTE** | `OrderItem` has `productId`/`formatId` as **soft references** -- NO Prisma FK to Product! |

---

### 1.3 PAYMENTS
> **What**: Stripe, PayPal, saved cards, webhooks, refunds

| Layer | Elements |
|-------|----------|
| **Pages** | `/checkout` (payment step) |
| **API Routes** | `POST /api/payments/create-checkout`, `POST /api/payments/create-intent`, `POST /api/payments/express`, `POST /api/payments/charge-saved-card`, `POST /api/payments/webhook`, `POST /api/payments/paypal/create-order`, `POST /api/payments/paypal/capture`, `POST /api/webhooks/stripe`, `POST /api/webhooks/paypal` |
| **Models** | `Order` (stripePaymentId, paypalOrderId), `SavedCard`, `PaymentError`, `Refund` (orphan), `WebhookEvent` (orphan), `PaymentMethodConfig` (orphan) |
| **Lib** | `@/lib/stripe` (lazy init!), `@/lib/paypal` |
| **Affects** | Orders (status updates), Accounting (stripe-sync auto-entries), Email (payment confirmation), Inventory (release on failure) |
| **CRITICAL** | Stripe SDK MUST use lazy init (see KB-PP-BUILD-002). WebhookEvent has NO FK to Order. |

---

### 1.4 ACCOUNTING (29 admin pages)
> **What**: Double-entry bookkeeping, journal entries, chart of accounts, invoices, bank reconciliation, tax reports, fixed assets, budgets

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/comptabilite` + 29 sub-pages (ecritures, factures-clients, factures-fournisseurs, notes-credit, grand-livre, plan-comptable, rapprochement, banques, devises, saisie-rapide, recurrentes, previsions, recherche, rapports, rapports-personnalises, exports, ocr, audit, calendrier-fiscal, declaration-tps-tvq, etats-financiers, immobilisations, import-bancaire, parametres, budget, cloture, aging, depenses, **ai-assistant**) |
| **API Routes** | 52+ routes under `/api/accounting/*`: dashboard, entries, chart-of-accounts, general-ledger, tax-summary, reconciliation, bank-accounts, bank-transactions, budgets, forecasting, aging, expenses, recurring, quick-entry, ocr, search, settings, stripe-sync, export, pdf-reports, alerts, kpis, payment-matching, **payroll** (GET/POST -- stub), **reports/custom** (GET/POST), **reports/custom/[id]** (GET/PUT/DELETE), **reports/custom/[id]/run** (POST), **reports/custom/[id]/export** (GET), **reports/columns** (GET), **ai-chat** (GET/POST) |
| **Models** | `ChartOfAccount` (self-ref parent/children), `JournalEntry`, `JournalLine`, `CustomerInvoice`, `CustomerInvoiceItem`, `SupplierInvoice` (orphan), `CreditNote`, `BankAccount`, `BankTransaction`, `BankRule`, `Budget`, `BudgetLine`, `Expense`, `TaxReport` (orphan), `FixedAsset`, `FixedAssetDepreciation`, `AuditTrail`, `RecurringEntryTemplate` (orphan), `AccountingPeriod` (orphan), `FiscalYear` (orphan), `AccountingSettings` (orphan), `AccountingAlert` (orphan), `DocumentAttachment` (orphan), `FiscalCalendarEvent` (orphan), `CustomReport` (orphan) |
| **Lib** | 35 files in `@/lib/accounting/`: auto-entries, stripe-sync, reconciliation, pdf-reports, alerts, aging, recurring-entries, bank-import, ml-reconciliation, forecasting, audit-trail, tax-compliance, currency, integrations (QuickBooks/Sage), quick-entry, ocr, search, alert-rules, auto-reconciliation, scheduler, kpi, payment-matching, report-templates, **report-engine**, **ai-accountant.service** |
| **Affects** | Orders (auto journal entries on sale/refund), Payments (stripe-sync), Tax (TPS/TVQ declarations), Fixed Assets (depreciation) |
| **NOTE** | Heavily uses soft references. JournalEntry.orderId is NOT a FK. BankTransaction.matchedEntryId is NOW a real FK to JournalEntry (SetNull). Most accounting-to-commerce connections are soft. |

---

### 1.5 MAILING & NEWSLETTER (CASL Compliance)
> **What**: CASL-compliant mailing list, newsletter popup, double opt-in, unsubscribe, email campaigns

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/newsletter`, `/(shop)/email-preferences` (token-based, no auth required) |
| **API Routes** | `POST /api/newsletter`, `POST /api/mailing-list/subscribe`, `GET /api/mailing-list/confirm`, `POST /api/mailing-list/unsubscribe`, `GET /api/unsubscribe`, `GET,PUT /api/email-preferences` (JWT token-based), `/api/admin/newsletter/*`, `GET /api/tracking/email` (open pixel), `GET /api/tracking/click` (click redirect), `GET /api/cron/ab-test-check` (A/B winner auto-send) |
| **Models** | `MailingListSubscriber` (CASL-compliant, double opt-in), `MailingListPreference`, `ConsentRecord`, `NewsletterSubscriber` (legacy, NOT compliant), `NotificationPreference`, `EmailCampaign` (orphan), `EmailLog` (orphan, +openedAt/clickedAt/clickCount/abVariant), `EmailEngagement`, `AuditLog` |
| **Components** | `NewsletterPopup`, `MailingListSignup`, `PreferenceForm` (email-preferences) |
| **Lib** | `@/lib/email/email-service`, `@/lib/email/unsubscribe`, `@/lib/email/tracking` (HMAC pixel/link tracking), `@/lib/email/ab-test-engine` (Z-test winner selection) |
| **CRITICAL BUGS** | 1) `NewsletterPopup` line 74 hardcodes `marketingConsent: true`. 2) `/api/newsletter` has NO double opt-in. 3) `ConsentRecord` model exists but is NEVER used by newsletter routes. 4) RFC 8058 one-click unsubscribe NOT implemented. 5) Two duplicate subscriber models exist (MailingListSubscriber vs NewsletterSubscriber). |
| **Affects** | Email campaigns, GDPR compliance, user consent tracking |

---

### 1.6 WEB NAVIGATOR (Admin)
> **What**: Admin iframe-based web browser for navigating external URLs

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/navigateur` (CRUD), `/admin/navigateur/view` (iframe viewer) |
| **API Routes** | `/api/admin/nav-sections`, `/api/admin/nav-subsections`, `/api/admin/nav-pages`, `/api/admin/nav-pages/[id]` |
| **Models** | `AdminNavSection`, `AdminNavSubSection`, `AdminNavPage` (3-level hierarchy) |
| **Components** | `WebNavigator` |
| **CRITICAL SECURITY** | iframe sandbox uses `allow-scripts allow-same-origin` (XSS risk). No CSP headers. No URL validation whitelist. No audit logging. |

---

### 1.7 INVENTORY & STOCK
> **What**: Stock tracking, reservations, alerts, price watch

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/inventaire`, `/account/inventory` |
| **API Routes** | `/api/admin/inventory`, `PATCH /api/admin/inventory/[id]`, `/api/admin/inventory/history`, `/api/admin/inventory/import`, `/api/admin/inventory/export`, `/api/cron/stock-alerts`, `/api/cron/price-drop-alerts`, `/api/cron/release-reservations` |
| **Models** | `InventoryReservation` (orphan!), `InventoryTransaction` (orphan!), `StockAlert`, `PriceWatch` |
| **Hooks** | `useAdminNotifications` (stock badge count) |
| **NOTE** | `InventoryReservation` and `InventoryTransaction` have NO FK to Product -- all soft references. |

---

### 1.8 LOYALTY & AMBASSADOR PROGRAM
> **What**: Points, tiers, referrals, ambassador commissions, payouts

| Layer | Elements |
|-------|----------|
| **Pages** | `/rewards`, `/ambassador`, `/account/rewards`, `/account/referrals`, `/admin/fidelite`, `/admin/ambassadeurs` |
| **API Routes** | `/api/admin/loyalty/*` (tiers, transactions, config), `/api/admin/ambassadors`, `/api/account/rewards`, `/api/account/referrals`, `/api/cron/points-expiring`, `/api/cron/birthday-emails` |
| **Models** | `LoyaltyTransaction`, `Referral`, `Ambassador`, `AmbassadorCommission`, `AmbassadorPayout` |
| **Contexts** | `LoyaltyProvider` (used by `/rewards`) |
| **Lib** | `@/contexts/LoyaltyContext` (LOYALTY_TIERS, LOYALTY_REWARDS, LOYALTY_CONFIG) |
| **Affects** | Orders (points earn on purchase), Users (tier upgrades), Email (birthday rewards) |
| **NOTE** | `AmbassadorCommission.orderId` is soft reference -- NO FK to Order. `LoyaltyTransaction.orderId` is also soft. |

---

### 1.9 USER MANAGEMENT
> **What**: Authentication, profiles, permissions, employees, B2B clients, B2C customers

| Layer | Elements |
|-------|----------|
| **Pages** | `/auth/*` (9 pages), `/account/*` (14 pages), `/dashboard/*` (4 pages), `/admin/employes`, `/admin/clients`, `/admin/clients/[id]`, `/admin/customers`, `/admin/customers/[id]`, `/admin/permissions` |
| **API Routes** | `/api/auth/*`, `/api/account/*` (22 routes), `/api/admin/users`, `/api/admin/employees`, `/api/admin/permissions` |
| **Models** | `User` (32 incoming FK -- CENTRAL HUB), `Account`, `Session`, `Authenticator`, `PasswordHistory`, `SavedCard`, `UserAddress`, `NotificationPreference`, `UserPermissionGroup`, `UserPermissionOverride` (orphan), `VerificationToken`, `Company`, `CompanyCustomer` |
| **Components** | `PasskeyButton` |
| **Lib** | `@/lib/auth-config`, `@/lib/mfa`, `@/lib/brute-force-protection`, `@/lib/csrf`, `@/lib/session-security`, `@/lib/webauthn`, `@/lib/password-history` |
| **CRITICAL** | User model has 32 incoming FK. Deleting a User cascades to ~12 tables. `UserPermissionGroup` has userId but NO @relation to User (broken chain). |

---

### 1.10 CONTENT & TRANSLATIONS
> **What**: Blog, articles, FAQ, guides, pages, hero slides, testimonials, videos, webinars + 14 translation models

| Layer | Elements |
|-------|----------|
| **Pages** | `/blog`, `/blog/[slug]`, `/faq`, `/learn`, `/learn/[slug]`, `/lab-results`, `/webinars`, `/videos`, `/admin/contenu`, `/admin/avis`, `/admin/questions`, `/admin/traductions`, `/admin/bannieres`, `/admin/webinaires` |
| **API Routes** | `/api/admin/content/*`, `/api/admin/reviews`, `/api/admin/questions`, `/api/admin/translations/*`, `/api/hero-slides`, `/api/testimonials`, `/api/webinars`, `/api/videos` |
| **Models** | `Article`+`ArticleTranslation`, `BlogPost`+`BlogPostTranslation`, `Faq`+`FaqTranslation`, `Guide`+`GuideTranslation`, `HeroSlide`+`HeroSlideTranslation`, `NewsArticle`+`NewsArticleTranslation`, `Page`+`PageTranslation`, `Testimonial`+`TestimonialTranslation`, `Video`+`VideoTranslation`, `Webinar`+`WebinarTranslation`, `Review`+`ReviewImage`, `ProductQuestion` |
| **Lib** | `@/lib/translation` (withTranslation, getTranslatedFields, DB_SOURCE_LOCALE) |
| **NOTE** | ALL 14 translation models use pattern: `@@unique([parentId, locale])`, `qualityLevel TranslationQuality @default(draft)`, `translatedBy @default("gpt-4o-mini")` |

---

### 1.11 COMMUNICATION HUB
> **What**: Chat, email conversations, email automation, canned responses, inbound email

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/chat`, `/admin/emails` |
| **API Routes** | `/api/chat/*` (8 routes), `/api/admin/emails/*`, `/api/webhooks/email-bounce`, `/api/webhooks/inbound-email` |
| **Models** | `Conversation`, `Message`, `ChatConversation`, `ChatMessage`, `ChatSettings`, `EmailConversation`, `InboundEmail`, `InboundEmailAttachment`, `OutboundReply`, `ConversationNote`, `ConversationActivity`, `CannedResponse`, `EmailAutomationFlow`, `EmailCampaign`, `EmailLog`, `EmailTemplate` |
| **Components** | `ChatWidget` |
| **Hooks** | `useRecentChats`, `useAdminSSE`, `useAdminNotifications` |
| **Lib** | `@/lib/email/email-service` (multi-provider: Resend/SendGrid/SMTP), `@/lib/email/templates/*`, `@/lib/email/automation-engine`, `@/lib/email/bounce-handler`, `@/lib/email/inbound-handler`, `@/lib/email/tracking` (open pixel/click tracking), `@/lib/email/ab-test-engine` (Z-test winner selection) |

---

### 1.12 PROMOTIONS & PRICING
> **What**: Promo codes, discounts, upsell, gift cards, bundles, subscriptions

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/promotions`, `/admin/promo-codes`, `/admin/upsell`, `/admin/abonnements`, `/bundles`, `/bundles/[slug]`, `/subscriptions`, `/gift-cards` |
| **API Routes** | `/api/admin/promotions`, `/api/admin/promo-codes`, `/api/admin/upsell-config`, `/api/admin/subscriptions`, `/api/promo/validate`, `/api/gift-cards`, `/api/bundles` |
| **Models** | `PromoCode`, `PromoCodeUsage`, `Discount` (orphan), `Bundle`, `BundleItem`, `GiftCard`, `Subscription` (orphan), `UpsellConfig` |
| **Components** | `BundleCard`, `GiftCardRedeem`, `UpsellInterstitialModal`, `CartCrossSell`, `FlashSaleBanner`, `FreeShippingBanner` |
| **Hooks** | `useDiscountCode`, `useUpsell` |
| **NOTE** | `Discount` has NO FK to Product or Category. `Subscription` has NO FK to User or Product. Both are orphans. |

---

### 1.13 SHIPPING & DELIVERY
> **What**: Shipping zones, carriers, tracking, delivery status

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/livraison`, `/track-order` |
| **API Routes** | `/api/admin/shipping/*`, `/api/orders/track` |
| **Models** | `Shipping`, `ShippingStatusHistory`, `ShippingZone` (orphan) |
| **Components** | `PhysicalDeliveryTracking`, `DigitalDeliveryTracking`, `TrackingTimeline` |
| **Lib** | `@/lib/canadianTaxes` (calculateShipping) |

---

### 1.14 SUPPLIER MANAGEMENT & PURCHASE ORDERS
> **What**: Supplier directory, contacts, purchase orders, goods receipt, PO-to-invoice conversion

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/fournisseurs`, `/admin/comptabilite/bons-commande` |
| **API Routes** | `/api/admin/suppliers`, `/api/accounting/purchase-orders` (GET/POST), `/api/accounting/purchase-orders/[id]` (GET/PUT/DELETE), `/api/accounting/purchase-orders/[id]/send` (POST), `/api/accounting/purchase-orders/[id]/approve` (POST), `/api/accounting/purchase-orders/[id]/receive` (POST), `/api/accounting/purchase-orders/[id]/convert-to-invoice` (POST), `/api/accounting/purchase-orders/next-number` (GET) |
| **Models** | `Supplier`, `SupplierContact`, `SupplierLink`, `SupplierInvoice` (orphan -- soft ref supplierId), `PurchaseOrder` (soft ref supplierId), `PurchaseOrderItem`, `PurchaseOrderReceipt`, `PurchaseOrderReceiptItem` |
| **Components** | Admin shared: `PageHeader`, `DataTable`, `Modal`, `StatusBadge`, `StatCard`, `FilterBar`, `FormField`, `SectionCard` |
| **NOTE** | PO lifecycle: DRAFT -> SENT -> CONFIRMED -> PARTIALLY_RECEIVED -> RECEIVED -> INVOICED. Convert-to-invoice creates a SupplierInvoice from a received PO. |

---

### 1.15 MEDIA (MOSTLY COMPLETE)
> **What**: Media library, videos, images, API integrations (Zoom, WhatsApp, Teams), advertising platforms, social media scheduling

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/media` (STUB), `/admin/medias` (COMPLETE), `/admin/media/videos` (COMPLETE - see 1.19 Content Hub), `/admin/media/library` (STUB), `/admin/media/analytics` (NEW - KPI dashboard), `/admin/media/brand-kit` (COMPLETE - API-connected editing), `/admin/media/api-zoom` (STUB), `/admin/media/api-whatsapp` (STUB), `/admin/media/api-teams` (STUB), `/admin/media/ads-google` (COMPLETE), `/admin/media/ads-tiktok` (COMPLETE), `/admin/media/ads-x` (COMPLETE), `/admin/media/ads-youtube` (COMPLETE), `/admin/media/ads-linkedin` (COMPLETE), `/admin/media/ads-meta` (COMPLETE), `/admin/media/social-scheduler` (COMPLETE), `/admin/media/connections` (COMPLETE - see 1.20 Platform Integrations), `/admin/media/imports` (COMPLETE - see 1.20 Platform Integrations) |
| **API Routes** | `/api/admin/medias`, `/api/admin/videos`, `/api/admin/videos/[id]/transcribe` (NEW), `/api/admin/videos/[id]/highlights` (NEW), `/api/admin/platform-connections/*`, `/api/admin/recording-imports/*`, `/api/admin/social-posts/*`, `/api/admin/ads/*`, `/api/admin/media/analytics` (NEW), `/api/admin/media/dashboard` (NEW), `/api/admin/brand-kit` (NEW - GET/PUT) |
| **Models** | `Media` (orphan), `PlatformConnection`, `RecordingImport`, `SocialPost`, `AdCampaignSnapshot` |
| **Components** | `AdsPlatformDashboard` (reusable ads dashboard), `MediaPicker` (NEW - modal media selector), `CalendarView` (NEW - month/week calendar) |
| **Hooks** | `useVideos`, `useSocialPosts`, `useMedias`, `useMediaStats`, `useVideo`, `useAds`, `usePlatformConnections` (all NEW - SWR hooks in `media-hooks.ts`) |
| **Lib** | `@/lib/social/social-publisher.ts`, `@/lib/social/social-scheduler-cron.ts`, `@/lib/ads/ads-sync.ts` (+ anomaly detection), `@/lib/media-hooks.ts` (NEW), `@/lib/media/image-pipeline.ts` (NEW), `@/lib/media/video-transcription.ts` (NEW), `@/lib/media/video-highlights.ts` (NEW), `@/lib/media/content-analytics.ts` (NEW), `@/lib/media/brand-kit.ts` (NEW), `@/lib/platform/oauth-token-refresh.ts` (NEW), `@/lib/validations/media.ts` (NEW) |
| **NOTE** | Media audit 2026-02-28: 5 security fixes (V-025 to V-068), SWR caching, image optimization pipeline, cross-post multi-platform, Zod validation schemas, OAuth auto-refresh, video transcription, AI auto-tagging, KPI anomaly detection, MediaPicker, CalendarView, dashboard aggregation, bulk actions, video highlights, content analytics, brand kit API. 2 stubs remain (dashboard index + library). |

---

### 1.16 FISCAL & TAX
> **What**: Fiscal calendar, TPS/TVQ declarations, country-specific obligations

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/fiscal`, `/admin/fiscal/country/[code]`, `/admin/fiscal/reports`, `/admin/fiscal/tasks`, `/admin/comptabilite/calendrier-fiscal`, `/admin/comptabilite/declaration-tps-tvq` |
| **Models** | `FiscalCalendarEvent` (orphan), `TaxReport` (orphan), `FiscalYear` (orphan) |
| **Lib** | `@/lib/tax-rates`, `@/lib/canadianTaxes`, `@/lib/countryObligations`, `@/lib/financial`, `@/lib/accounting/tax-compliance` |

---

### 1.17 SEO & ANALYTICS
> **What**: SEO management, structured data, analytics tracking

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/seo` |
| **API Routes** | `/api/admin/seo` |
| **Components** | `JsonLd`, `GoogleAnalytics`, `MetaPixel` |
| **Lib** | `@/lib/structured-data` (productSchema, breadcrumbSchema, faqSchema) |
| **Used by** | `/shop`, `/product/[slug]`, `/faq`, `/learn`, `/blog`, `/blog/[slug]` |

---

### 1.18 CRON JOBS (11 scheduled tasks)
> **What**: Background automation tasks

| Route | Models | Side Effects |
|-------|--------|-------------|
| `/api/cron/abandoned-cart` | Order, Cart | Sends email |
| `/api/cron/birthday-emails` | User | Sends email + loyalty points |
| `/api/cron/data-retention` | Various | GDPR cleanup |
| `/api/cron/dependency-check` | - | System health |
| `/api/cron/points-expiring` | LoyaltyTransaction | Sends notification |
| `/api/cron/price-drop-alerts` | PriceWatch, Product | Sends email |
| `/api/cron/release-reservations` | InventoryReservation | Releases stock |
| `/api/cron/satisfaction-survey` | Order | Sends email |
| `/api/cron/stock-alerts` | StockAlert, Product | Sends notification |
| `/api/cron/update-exchange-rates` | Currency | External API call |
| `/api/cron/welcome-series` | User | Sends email sequence |
| `/api/admin/social-posts/cron` | SocialPost | Publishes scheduled social posts |
| `/api/admin/ads/cron` | AdCampaignSnapshot | Daily sync of ads stats from 6 platforms |

---

### 1.19 CONTENT HUB / MEDIATHEQUE
> **What**: Video management, categorized mediatheque, consent forms (PDF/email), video placements on products/pages

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/media/video-categories` (COMPLETE), `/admin/media/content-hub` (COMPLETE), `/admin/media/consents` (COMPLETE), `/admin/media/consent-templates` (COMPLETE), `/admin/media/videos/[id]` (COMPLETE), `/account/content` (COMPLETE), `/consent/[token]` (COMPLETE), `/videos` (refactored) |
| **API Routes** | `/api/admin/video-categories`, `/api/admin/video-categories/[id]`, `/api/admin/videos/[id]/placements`, `/api/admin/videos/[id]/products`, `/api/admin/videos/[id]/tags`, `/api/admin/videos/[id]/consent`, `/api/admin/consent-templates`, `/api/admin/consent-templates/[id]`, `/api/admin/consents`, `/api/admin/consents/[id]`, `/api/admin/content-hub/stats`, `/api/videos`, `/api/videos/[slug]`, `/api/videos/placements/[placement]`, `/api/account/content`, `/api/account/consents`, `/api/account/consents/[id]`, `/api/consent/[token]` |
| **Models** | `Video` (extended), `VideoCategory`, `VideoCategoryTranslation`, `VideoPlacement`, `VideoProductLink`, `VideoTag`, `SiteConsent`, `ConsentFormTemplate`, `ConsentFormTranslation` |
| **Components** | `VideoPlayer`, `VideoCard`, `VideoGrid`, `VideoFilters`, `VideoPlacementWidget` |
| **Lib** | `consent-pdf.ts`, `consent-email.ts`, `validations/video-category.ts`, `validations/consent.ts` |
| **Affects** | Products (video links), Account (mediatheque), Email system (consent emails), Platform Integrations (recording imports create Videos) |

---

### 1.20 PLATFORM INTEGRATIONS
> **What**: OAuth connections to video conferencing platforms (Zoom, Teams, Meet, Webex), recording auto-import, YouTube publishing, webhook receivers

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/media/connections` (COMPLETE), `/admin/media/imports` (COMPLETE) |
| **API Routes** | `/api/admin/platform-connections/*`, `/api/admin/recording-imports/*`, `/api/webhooks/zoom`, `/api/webhooks/teams`, `/api/webhooks/webex`, `/api/admin/videos/[id]/publish-youtube` |
| **Models** | `PlatformConnection`, `RecordingImport`, `VideoSession`, `Video` (extended with recordingImport relation, platformMeetingId field) |
| **Components** | (inline in pages: PlatformConnectionCard, Toggle, Select, ImportRow, StatusBadge, Pagination) |
| **Lib** | `platform/crypto.ts`, `platform/oauth.ts`, `platform/recording-import.ts`, `platform/webhook-handlers.ts`, `platform/youtube-publish.ts` |
| **Affects** | Content Hub (Video), Consents (SiteConsent auto-create), Users (participant matching) |

---

### 1.21 VOIP / TELEPHONY
> **What**: WebRTC softphone, call logging (CDR), recordings, voicemails, SIP extensions, phone numbers, analytics, post-call surveys, AI transcription

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/telephonie` (dashboard), `/admin/telephonie/journal` (call log), `/admin/telephonie/enregistrements` (recordings), `/admin/telephonie/messagerie` (voicemail), `/admin/telephonie/connexions` (SIP config), `/admin/telephonie/analytique` (charts), `/admin/telephonie/extensions` (SIP ext), `/admin/telephonie/numeros` (DIDs) |
| **API Routes** | `/api/admin/voip/dashboard`, `/api/admin/voip/connections`, `/api/admin/voip/extensions`, `/api/admin/voip/call-logs`, `/api/admin/voip/phone-numbers`, `/api/admin/voip/recordings/[id]`, `/api/admin/voip/voicemails`, `/api/admin/voip/cdr/ingest` (webhook), `/api/admin/voip/surveys/submit` (webhook) |
| **Models** | `VoipConnection`, `PhoneNumber`, `SipExtension`, `CallLog`, `CallRecording`, `CallTranscription`, `CallSurvey`, `Voicemail` |
| **Enums** | `PhoneNumberType`, `CallDirection`, `CallStatus`, `AgentStatus` |
| **Components** | `Softphone` (draggable, video, multi-line, notes, search, speed dial, recent, conference, warm transfer), `SoftphoneProvider`, `CtiToolbar` (supervisor listen/whisper/barge), `IncomingCallModal`, `CallControls`, `AgentStatus`, `AudioPlayer`, `RecordingPlayer` (WaveSurfer waveform), `ContactCard` (rich CRM contact), `CallStats`, `SatisfactionBadge` |
| **Hooks** | `useVoip` (JsSIP WebRTC), `useCallState` (SWR polling) |
| **Lib** | `voip/connection.ts`, `voip/cdr-sync.ts`, `voip/recording-upload.ts`, `voip/esl-client.ts`, `voip/transcription.ts`, `voip/call-control.ts`, `voip/voip-state.ts`, `voip/recording.ts`, `voip/power-dialer.ts`, `voip/queue-engine.ts`, `voip/ivr-engine.ts`, `voip/voicemail-engine.ts`, `voip/transfer-engine.ts`, `voip/coaching-engine.ts`, `voip/call-quality-monitor.ts`, `voip/pre-call-test.ts`, `voip/krisp-noise-cancel.ts`, `voip/call-flip.ts`, `voip/call-park.ts`, `voip/call-pickup.ts`, `voip/dnd-manager.ts`, `voip/multi-line.ts`, `voip/call-forwarding.ts`, `voip/e911.ts`, `voip/presence-manager.ts`, `voip/screen-share.ts`, `voip/virtual-background.ts`, `voip/video-recording.ts`, `voip/incoming-notification.ts`, `voip/ringtone-manager.ts`, `voip/cnam-lookup.ts`, `voip/ring-groups.ts`, `voip/simultaneous-ring.ts`, `voip/vad-analytics.ts` |
| **External** | FreeSWITCH (ESL port 8021), FusionPBX, Telnyx SIP, VoIP.ms, OpenAI Whisper API |
| **Affects** | User (reverse: sipExtensions, clientCalls, clientVoicemails), Company (reverse: companyCalls), Platform Integrations (reuses crypto.ts), Media (reuses StorageService for recordings) |

---

### 1.22 CRM ENTERPRISE (Phase 3)
> **What**: Full CRM suite — leads, deals, quotes/CPQ, approvals, exchange rates, agent scheduling, QA scoring, AI chatbot, attribution, WhatsApp, email-inbound, Meta webhook, PWA

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/crm/qualification`, `/admin/crm/recurring-revenue`, `/admin/crm/exchange-rates`, `/admin/crm/snippets`, `/admin/crm/quotes`, `/admin/crm/approvals`, `/admin/crm/attribution`, `/admin/crm/scheduling`, `/admin/crm/qa`, `/admin/crm/inbox` (enhanced), `/admin/crm/sms-templates` (enhanced) |
| **API Routes** | `/api/admin/crm/snippets`, `/api/admin/crm/quotes`, `/api/admin/crm/quotes/[id]`, `/api/admin/crm/approvals`, `/api/admin/crm/approvals/[id]`, `/api/admin/crm/exchange-rates`, `/api/admin/crm/exchange-rates/sync`, `/api/admin/crm/recurring-revenue`, `/api/admin/crm/agent-schedules`, `/api/admin/crm/qa-forms`, `/api/admin/crm/qa-scores`, `/api/admin/crm/agent-breaks`, `/api/admin/crm/attribution`, `/api/public/chatbot`, `/api/webhooks/whatsapp`, `/api/webhooks/email-inbound`, `/api/webhooks/meta` |
| **Models** | `CrmSnippet`, `CrmQuote`, `CrmQuoteItem`, `CrmApproval`, `ExchangeRate`, `AgentSchedule`, `CrmQaForm`, `CrmQaScore`, `AgentBreak` |
| **Enums** | `CrmQuoteStatus`, `ApprovalStatus`, `AgentBreakType`, `AgentShiftType` |
| **Fields added** | `CrmLead`: qualificationFramework, qualificationData; `CrmDeal`: isRecurring, recurringInterval, mrrValue, quotes[] |
| **Components** | `ChatWidget` (src/components/chat/ChatWidget.tsx), `EmbedScript` (src/components/chat/EmbedScript.tsx) |
| **Lib** | `@/lib/crm/exchange-rates`, `@/lib/crm/quote-pdf`, `@/lib/crm/predictive-dialer`, `@/lib/crm/voicemail-drop`, `@/lib/crm/call-blending`, `@/lib/crm/local-presence`, `@/lib/crm/recording-consent`, `@/lib/crm/whatsapp`, `@/lib/crm/email-sync`, `@/lib/crm/social-inbox`, `@/lib/crm/shared-inbox`, `@/lib/crm/chatbot-engine`, `@/lib/crm/ai-forecasting`, `@/lib/crm/realtime-sentiment`, `@/lib/crm/ai-coaching`, `@/lib/crm/best-time-to-send`, `@/lib/crm/push-notifications`, `@/lib/crm/attribution`, `@/lib/crm/ab-testing`, `@/lib/crm/mms`, `@/lib/crm/payment-ivr` |
| **External** | OpenAI (chatbot + AI forecasting + sentiment + coaching), WhatsApp Business API, Facebook/Instagram Messenger, IMAP (email sync), Web Push API, Telnyx/VoIP (MMS, payment IVR) |
| **Affects** | CrmLead (qualification fields), CrmDeal (MRR/ARR + quotes), VoIP (blending, local presence, recording consent, payment IVR), Email (inbound sync), Social (inbox), Attribution (campaigns) |
| **PWA** | `public/manifest.json` (PWA manifest), `public/sw.js` (service worker, offline support) |

---

### 1.23 CRM ENTERPRISE ULTIMATE (Phase 4 — 62+ items)
> **What**: Call center advanced (ACD, skills routing, streaming transcription, conference, surveys), telemarketing (lead recycling, disposition triggers, SMS drip/surveys/keyword), inbox (tickets, knowledge base, channel switching, customer portal), workflow advanced (parallel/loops/error handling, code sandbox, templates, versions), reporting (call center KPIs, dashboard builder, funnel, CLV, churn, heatmaps, activity reports), AI (conversation intelligence, anomaly detection, generative AI, streaming sentiment), WFM (adherence, volume forecasting, intraday management, shift bidding), deals (e-signature, playbooks, contracts, deal teams, price books), compliance (field security, data retention, GDPR delete, IP whitelist, TCPA manual touch), integrations (Zapier, calendar sync, Calendly), email (A/B testing, health, signatures), SMS (link tracking, keyword responders, drip sequences, surveys)

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/crm/call-analytics`, `/admin/crm/adherence`, `/admin/crm/tickets`, `/admin/crm/knowledge-base`, `/admin/crm/workflow-analytics`, `/admin/crm/call-center-kpis`, `/admin/crm/dashboard-builder`, `/admin/crm/funnel-analysis`, `/admin/crm/activity-reports`, `/admin/crm/clv`, `/admin/crm/churn`, `/admin/crm/heatmaps`, `/admin/crm/playbooks`, `/admin/crm/contracts`, `/(shop)/portal` |
| **API Routes** | `/api/admin/crm/call-analytics`, `/api/admin/crm/adherence`, `/api/admin/crm/tickets`, `/api/admin/crm/knowledge-base`, `/api/admin/crm/workflow-analytics`, `/api/admin/crm/workflow-versions`, `/api/admin/crm/call-center-kpis`, `/api/admin/crm/dashboard-builder`, `/api/admin/crm/activity-reports`, `/api/admin/crm/price-books`, `/api/admin/crm/deal-teams`, `/api/admin/crm/contracts`, `/api/admin/crm/gdpr-delete`, `/api/webhooks/zapier` |
| **Models** | `PriceBook`, `PriceBookEntry`, `CrmDealTeam`, `CrmContract`, `CrmTicket`, `CrmTicketComment`, `KBArticle`, `KBCategory`, `CrmWorkflowVersion`, `CrmPlaybook`, `DataRetentionPolicy`, `IpWhitelist` |
| **Enums** | `PriceBookType`, `ContractStatus`, `TicketStatus`, `TicketPriority`, `TicketCategory`, `KBArticleStatus`, `PlaybookStatus` |
| **Components** | `CtiToolbar` (src/components/admin/crm/CtiToolbar.tsx) |
| **Lib (37 new)** | `dialer-modes`, `agentless-dialer`, `skills-routing`, `acd-engine`, `streaming-transcription`, `conference-call`, `virtual-hold`, `post-call-survey`, `lead-recycling`, `whisper-preconnect`, `disposition-triggers`, `sms-link-tracking`, `sms-keyword-responder`, `sms-surveys`, `sms-drip-sequence`, `channel-switching`, `knowledge-base`, `workflow-code-sandbox`, `workflow-templates`, `conversation-intelligence`, `anomaly-detection`, `generative-ai`, `realtime-adherence`, `volume-forecasting`, `intraday-management`, `e-signature`, `sales-playbooks`, `field-security`, `data-retention`, `calendar-sync`, `calendly-integration`, `email-ab-testing`, `email-health`, `email-signature-manager`, `tcpa-manual-touch`, `clv-calculator`, `churn-analysis` |
| **Lib (modified)** | `predictive-dialer` (+vertical dialing, pacing, list penetration), `call-supervision` (+takeover mode), `recording.ts` (+dual-channel forking), `workflow-engine` (+parallel/loops/error handling/cross-object), `realtime-sentiment` (+streaming mode), `contact-enrichment` (+web scraping), `email-sync` (+auto-create lead), `ai-assistant` (+conversation summaries all channels) |
| **External** | DocuSign API, Zapier webhooks, Google Calendar API, Outlook Calendar API, Calendly webhooks, Telnyx streaming transcription, vm2 sandbox |
| **Affects** | CrmDeal (teams, contracts, price books, playbooks), CrmLead (recycling, enrichment, GDPR), VoIP (ACD, skills routing, conference, dual-channel, streaming transcription), Inbox (tickets, KB, channel switching, customer portal), Workflow (parallel, loops, versions), Agent (WFM adherence, forecasting, intraday) |

---

### 1.24 CRM ENTERPRISE ULTIMATE (Phase 5 — 28 enterprise items)
> **What**: AI enterprise (voice AI, auto-QM 100%, ML routing, experience memory), telephony advanced (no-pause predictive, IVR speech NLP, data-directed routing, voice biometrics, noise cancellation), WFM (screen recording, agent wellness, AI QA evaluation), compliance (HIPAA, regional recording storage), mobile (offline sync, mobile call log, business card scanner OCR, geolocation check-in), reporting (BI connector, cohort analysis, snapshot reporting), integrations (LinkedIn, BI export API, ERP QuickBooks/Xero, CDP Segment, Calendly), email (domain warmup), SMS (short code management), deal (revenue recognition ASC 606, deal journey analytics), buyer intent (web tracking, form shortening AI)

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/crm/cohort-analysis`, `/admin/crm/snapshots`, `/admin/crm/deal-journey` |
| **Lib (31 new)** | `voice-ai-agent`, `ai-quality-monitor`, `ml-routing`, `experience-memory`, `no-pause-predictive`, `ivr-speech-recognition`, `data-directed-routing`, `voice-biometrics`, `noise-cancellation`, `screen-recording`, `agent-wellness`, `ai-quality-evaluation`, `hipaa-compliance`, `regional-recording-storage`, `offline-sync`, `mobile-call-log`, `business-card-scanner`, `geolocation-checkin`, `bi-connector`, `cohort-analysis`, `snapshot-reporting`, `linkedin-integration`, `bi-export-api`, `erp-integration`, `cdp-integration`, `domain-warmup`, `short-code-management`, `revenue-recognition`, `deal-journey`, `buyer-intent`, `form-shortening-ai` |
| **External** | OpenAI Vision (OCR), LinkedIn API, QuickBooks/Xero OAuth, Segment/RudderStack, Telnyx streaming, GPS API |
| **Affects** | All CRM modules (AI quality monitoring covers calls/chat/email), Agent (wellness/burnout), VoIP (voice AI/biometrics/noise cancel), Pipeline (deal journey/revenue recognition), Lead (intent signals/form AI) |

### 1.25 CROSS-MODULE BRIDGES (Phase 0-5 — 43 bridges done, 2 planned)
> **What**: Interconnections between the 12 separately-sold admin modules. Each bridge is feature-flag gated (`ff.{module}_module`). Bridges surface contextual data from other modules (e.g., CRM deals on an order, sales stats on a product, loyalty tier in a call).

| Layer | Elements |
|-------|----------|
| **Infra** | `src/lib/bridges/types.ts`, `src/lib/bridges/registry.ts`, `src/hooks/useBridgeData.ts`, `src/components/admin/BridgeCard.tsx` |
| **API** | 35 new routes across all modules (see Section 8 bridge tables) |
| **Frontend** | 8 pages modified with bridge cards: commandes, deals/[id], promo-codes, avis, videos/[id], ecritures, CustomerSidebar, CallLogClient |
| **i18n** | 18+ keys in `admin.bridges` namespace across 22 locales |
| **Affects** | ALL 12 modules — Commerce, CRM, Comptabilite, Catalogue, Fidelite, Marketing, Telephonie, Emails, Media, Communaute, Dashboard, Systeme |

---

### 1.26 CRM LEADENGINE / PROSPECT LISTS (LeadEngine Pipeline)
> **What**: Multi-source lead generation pipeline — Google Maps scraping, waterfall email enrichment, AI scoring, DNC compliance, 1-click campaign launch. Converts Prospects into CrmLeads into DialerCampaign entries.

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/crm/lists` (list index), `/admin/crm/lists/[id]` (6 tabs: prospects, googleMaps, enrichment, duplicates, assignment, campaign) |
| **API Routes** | `GET,POST /api/admin/crm/lists`, `GET,PUT,DELETE /api/admin/crm/lists/[id]`, `POST /api/admin/crm/lists/[id]/scrape`, `POST /api/admin/crm/lists/[id]/enrich`, `POST /api/admin/crm/lists/[id]/score`, `POST /api/admin/crm/lists/[id]/integrate`, `POST /api/admin/crm/lists/[id]/start-campaign`, `POST /api/admin/crm/lists/[id]/prospects`, `PUT,DELETE /api/admin/crm/lists/[id]/prospects/[prospectId]`, `POST /api/admin/crm/lists/[id]/import`, `POST /api/admin/crm/lists/[id]/validate`, `POST /api/admin/crm/lists/[id]/deduplicate` |
| **Models** | `ProspectList`, `Prospect`, `CrmLead`, `DialerCampaign`, `DialerListEntry`, `DnclEntry`, `AuditLog` |
| **Components** | Inline in page (tabs: Google Maps config, enrichment progress, score distribution, dedup results, assignment matrix, campaign launcher) |
| **Lib** | `@/lib/crm/google-maps-scraper`, `@/lib/crm/enrichment-pipeline`, `@/lib/crm/lead-scoring`, `@/lib/crm/lead-assignment`, `@/lib/crm/prospect-dedup`, `@/lib/crm/campaign-bridge`, `@/lib/crm/phone-utils` |
| **Audit** | All 5 action endpoints log via `logAdminAction()`: SCRAPE_PROSPECTS, ENRICH_PROSPECTS, SCORE_PROSPECTS, INTEGRATE_PROSPECTS, START_CAMPAIGN |
| **i18n** | 29 keys in `admin.crmLists` namespace (campaign*, enrichment*, score*) across 22 locales |
| **External** | Google Places API (Text Search + Details + Nearby), Hunter.io (email lookup), Apollo.io (contact enrichment) |
| **Affects** | CrmLead (creates leads from prospects), DialerCampaign (1-click campaign creation), DnclEntry (DNC pre-check filtering), VoIP power-dialer (campaign entries) |

**Pipeline flow:**
```
Google Maps Scrape → Waterfall Enrichment → AI Scoring (7-factor) → DNC Pre-Check → Integrate → 1-Click Campaign
     (scrape)            (enrich)              (score)                              (integrate)   (start-campaign)
```

**Scoring factors (0-100):** Google Rating (25), Review Volume (15), Website Quality (15), Email Available (10), Phone Available (10), Industry Fit (15), Recency (10)

**Assignment methods:** MANUAL, ROUND_ROBIN, LOAD_BALANCED, SCORE_BASED

---

## 2. DEPENDENCY CHAINS

### Order Lifecycle Chain
```
User --> Order --> OrderItem (soft ref Product)
            |
            +--> PaymentError
            +--> ReturnRequest --> Refund (orphan)
            +--> [soft] JournalEntry --> JournalLine --> ChartOfAccount
            +--> [soft] LoyaltyTransaction (earn points)
            +--> [soft] AmbassadorCommission (if referred)
            +--> [soft] WebhookEvent (Stripe/PayPal)
            +--> Email (order-lifecycle templates)
```

### Product Ecosystem
```
Category (self-ref parent/children)
    |
    +--> Product --> ProductFormat --> ProductFormatTranslation
            |
            +--> ProductImage
            +--> ProductTranslation
            +--> Module --> Grade
            +--> QuantityDiscount
            +--> Review --> ReviewImage
            +--> StockAlert
            +--> PriceWatch <-- User
            +--> BundleItem <-- Bundle
            +--> UpsellConfig
            +--> ProductQuestion <-- User
            +--> [soft] OrderItem, InventoryTransaction, InventoryReservation, Subscription
```

### Accounting Connections
```
ChartOfAccount (self-ref)
    +--> JournalLine <-- JournalEntry [soft: orderId]
    +--> FixedAsset (x3 FK) --> FixedAssetDepreciation
    +--> BankRule
    +--> Expense

BankAccount --> BankTransaction --> JournalEntry (matchedEntry FK, SetNull)
Budget --> BudgetLine [soft: accountCode to ChartOfAccount.code]
CustomerInvoice --> CustomerInvoiceItem, CreditNote [soft: customerId, orderId, journalEntryId]
SupplierInvoice [ORPHAN: soft refs supplierId, journalEntryId]
```

### User Fan-Out (32 incoming FK)
```
User
  ├── Auth: Account, Session, Authenticator, PasswordHistory, VerificationToken
  ├── Profile: UserAddress, SavedCard, NotificationPreference
  ├── Commerce: Order, Purchase, ReturnRequest
  ├── Social: Review, ProductQuestion, LoyaltyTransaction, Referral(x2)
  ├── B2B: Company(owner), CompanyCustomer
  ├── Communication: Conversation(x2), Message, EmailConversation(x2), OutboundReply, ConversationNote
  ├── Marketing: MailingListSubscriber, ConsentRecord, GiftCard(x2)
  ├── Learning: CourseAccess, Grade
  ├── Tracking: PriceWatch
  ├── Loyalty: Ambassador
  ├── Collections: WishlistCollection
  ├── Integrations: PlatformConnection
  └── Social: SocialPost(createdBy)
```

---

## 3. IMPACT ANALYSIS

**When you change X, also check Y:**

| Change | Also Check |
|--------|-----------|
| **Product model** | ProductFormat, ProductTranslation, ProductImage, Review, ProductQuestion, StockAlert, PriceWatch, QuantityDiscount, UpsellConfig, BundleItem, Module; Admin produits pages; Shop product/category/search/compare pages; All API routes using Product |
| **Order model** | OrderItem, PaymentError, ReturnRequest; Accounting auto-entries (stripe-sync); Email templates (order lifecycle); Shipping; Loyalty points; Ambassador commissions; Admin commandes; Account orders |
| **User model** | ALL 32 related tables (cascades to 12+); Auth flow; All account/* pages; Admin clients/customers/employes; Permissions; Loyalty; Chat conversations |
| **ChartOfAccount** | JournalLine, FixedAsset(x3), BankRule, Expense, BudgetLine (soft ref); ALL 28 comptabilite pages |
| **Category** | CategoryTranslation, Products in category; Shop/category page; Admin categories; Navigation |
| **Newsletter/Mailing** | NewsletterPopup, MailingListSignup, Footer; `/api/newsletter`, `/api/mailing-list/*`, `/api/unsubscribe`; ConsentRecord; CASL compliance |
| **Translation system** | ALL 14 translation models; `/admin/traductions`; `@/lib/translation`; ALL 22 locale files |
| **Stripe integration** | `@/lib/stripe` (lazy init!); Payment routes; Webhook handler; Accounting stripe-sync; Checkout page |
| **Auth config** | middleware.ts permissions; All protected routes; Session handling; WebAuthn; MFA; Password history |
| **Admin Nav models** | WebNavigator component; `/admin/navigateur/*`; Nav API routes |
| **Email templates** | Order lifecycle emails; Welcome series; Marketing campaigns; Bounce handler; Automation flows |
| **Tax calculations** | `@/lib/canadianTaxes`; Checkout page; Accounting tax-summary; Fiscal declarations; Country obligations |
| **i18n locale files** | ALL 22 locale JSON files; Every page using `t()` calls |
| **Platform connections** | `@/lib/platform/*` (crypto, oauth, recording-import, webhook-handlers, youtube-publish); Platform API routes; Webhook routes; Video model; RecordingImport model |
| **Video model** (extended) | VideoCategory, VideoPlacement, VideoProductLink, VideoTag, SiteConsent, RecordingImport; Content Hub pages; Platform Integrations pages; All video API routes |
| **SocialPost model** | social-publisher.ts, social-scheduler-cron.ts; Social scheduler page; /api/admin/social-posts/* routes |
| **AdCampaignSnapshot model** | ads-sync.ts; 6 ads platform pages (AdsPlatformDashboard); /api/admin/ads/* routes |

---

## 4. ADMIN PAGES (87+)

### Dashboard & Navigation
| Page | Path | Status | Components | API | Models |
|------|------|--------|-----------|-----|--------|
| Dashboard | `/admin/dashboard` | COMPLETE | StatCard, various | Server-side Prisma | Order, User, Product |
| Parametres | `/admin/parametres` | COMPLETE | FormField | `/api/admin/settings` | SiteSettings |
| Navigateur CRUD | `/admin/navigateur` | COMPLETE | OutlookUI, WebNavigator | `/api/admin/nav-*` | AdminNavSection/SubSection/Page |
| Navigateur View | `/admin/navigateur/view` | COMPLETE | WebNavigator (iframe) | `/api/admin/nav-pages/[id]` | AdminNavPage |
| Permissions | `/admin/permissions` | COMPLETE | OutlookUI | `/api/admin/permissions` | Permission, PermissionGroup, UserPermissionGroup |
| Logs | `/admin/logs` | COMPLETE | DataTable | `/api/admin/logs` | AuditLog |

### Commerce
| Page | Path | Status | Components | API | Models |
|------|------|--------|-----------|-----|--------|
| Commandes | `/admin/commandes` | COMPLETE | OutlookUI, StatusBadge | `/api/admin/orders` | Order, OrderItem, User |
| Clients B2B | `/admin/clients` | COMPLETE | ContactListPage | `/api/admin/users?role=CLIENT` | User, Company, CompanyCustomer |
| Client Detail | `/admin/clients/[id]` | COMPLETE | RoleManagementSection, PointAdjustment | `/api/admin/users/[id]`, `/api/admin/users/[id]/reset-password`, `/api/admin/users/[id]/email` | User, LoyaltyTransaction |
| Customers B2C | `/admin/customers` | COMPLETE | ContactListPage | `/api/admin/users?role=CUSTOMER` | User, Order, LoyaltyTransaction |
| Customer Detail | `/admin/customers/[id]` | COMPLETE | Detailed order history | `/api/admin/users/[id]` | User, Order, OrderItem, Product |

### Catalog
| Page | Path | Status | Components | API | Models |
|------|------|--------|-----------|-----|--------|
| Produits | `/admin/produits` | COMPLETE | DataTable, server queries | Server Prisma + `/api/products` | Product, Category, ProductFormat |
| Nouveau Produit | `/admin/produits/nouveau` | COMPLETE | FormField, MediaUploader | `POST /api/products` | Product, ProductFormat, ProductImage |
| Editer Produit | `/admin/produits/[id]` | COMPLETE | FormField, MediaUploader | `PUT /api/products/[id]` | Product, ProductFormat, ProductImage, ProductTranslation |
| Categories | `/admin/categories` | COMPLETE | Tree view | `/api/categories` | Category, CategoryTranslation |

### Marketing
| Page | Path | Status | Components | API |
|------|------|--------|-----------|-----|
| Promotions | `/admin/promotions` | COMPLETE | OutlookUI | `/api/admin/promotions` |
| Promo Codes | `/admin/promo-codes` | COMPLETE | OutlookUI | `/api/admin/promo-codes` |
| Newsletter | `/admin/newsletter` | COMPLETE | OutlookUI, DataTable | `/api/admin/newsletter/*` |
| Upsell | `/admin/upsell` | COMPLETE | FormField | `/api/admin/upsell-config` |
| SEO | `/admin/seo` | COMPLETE | FormField | `/api/admin/seo` |

### Media
| Page | Path | Status | Backend |
|------|------|--------|---------|
| Media Dashboard | `/admin/media` | **STUB** | - |
| Medias Library | `/admin/medias` | COMPLETE | `/api/admin/medias` |
| Bannieres | `/admin/bannieres` | COMPLETE | `/api/hero-slides` |
| Videos | `/admin/media/videos` | COMPLETE | `/api/admin/videos` (Content Hub 1.19) |
| Video Detail | `/admin/media/videos/[id]` | COMPLETE | `/api/admin/videos/[id]/*` (enhanced YouTube publish modal) |
| Library Images | `/admin/media/library` | **STUB** | - |
| API Zoom | `/admin/media/api-zoom` | **STUB** | - |
| API WhatsApp | `/admin/media/api-whatsapp` | **STUB** | - |
| API Teams | `/admin/media/api-teams` | **STUB** | - |
| Ads Google | `/admin/media/ads-google` | COMPLETE | `/api/admin/ads/*` (AdsPlatformDashboard) |
| Ads TikTok | `/admin/media/ads-tiktok` | COMPLETE | `/api/admin/ads/*` (AdsPlatformDashboard) |
| Ads X/Twitter | `/admin/media/ads-x` | COMPLETE | `/api/admin/ads/*` (AdsPlatformDashboard) |
| Ads YouTube | `/admin/media/ads-youtube` | COMPLETE | `/api/admin/ads/*` (AdsPlatformDashboard) |
| Ads LinkedIn | `/admin/media/ads-linkedin` | COMPLETE | `/api/admin/ads/*` (AdsPlatformDashboard) |
| Ads Meta | `/admin/media/ads-meta` | COMPLETE | `/api/admin/ads/*` (AdsPlatformDashboard) |
| Social Scheduler | `/admin/media/social-scheduler` | COMPLETE | `/api/admin/social-posts/*` |
| Connections | `/admin/media/connections` | COMPLETE | `/api/admin/platform-connections/*` |
| Imports | `/admin/media/imports` | COMPLETE | `/api/admin/recording-imports/*` |
| Video Sessions | `/admin/media/sessions` | COMPLETE | `/api/admin/video-sessions/*` |

### Content & Reviews
| Page | Path | Status | Components | API |
|------|------|--------|-----------|-----|
| Contenu | `/admin/contenu` | COMPLETE | OutlookUI | `/api/admin/content/*` |
| Avis | `/admin/avis` | COMPLETE | OutlookUI | `/api/admin/reviews` |
| Questions | `/admin/questions` | COMPLETE | OutlookUI | `/api/admin/questions` |
| Traductions | `/admin/traductions` | COMPLETE | DataTable | `/api/admin/translations/*` |

### Business
| Page | Path | Status | Components | API |
|------|------|--------|-----------|-----|
| Employes | `/admin/employes` | COMPLETE | OutlookUI (ContentList, DetailPane, MobileSplitLayout), Modal, FormField, StatCard, Button | `/api/admin/employees`, `/api/admin/employees/[id]` |
| Ambassadeurs | `/admin/ambassadeurs` | COMPLETE | OutlookUI | `/api/admin/ambassadors` |
| Fournisseurs | `/admin/fournisseurs` | COMPLETE | OutlookUI | `/api/admin/suppliers` |
| Abonnements | `/admin/abonnements` | COMPLETE | OutlookUI | `/api/admin/subscriptions` |
| Fidelite | `/admin/fidelite` | COMPLETE | OutlookUI | `/api/admin/loyalty/*` |

### Comptabilite (29 pages - ALL COMPLETE)
All pages use Outlook UI pattern (SplitLayout, ContentList, DetailPane). Key backend connections:
- **Dashboard**: `/api/accounting/dashboard` -> JournalEntry, BankAccount, CustomerInvoice aggregate
- **Ecritures**: `/api/accounting/entries` -> JournalEntry, JournalLine, ChartOfAccount
- **Factures Clients**: `/api/accounting/customer-invoices` -> CustomerInvoice, CustomerInvoiceItem
- **Grand Livre**: `/api/accounting/general-ledger` -> JournalLine, ChartOfAccount
- **Rapprochement**: `/api/accounting/reconciliation` -> BankTransaction, JournalEntry, BankAccount
- **Banques**: `/api/accounting/bank-accounts` -> BankAccount, BankTransaction
- **Budget**: `/api/accounting/budgets` -> Budget, BudgetLine
- **AI Assistant**: `/api/accounting/ai-chat` -> JournalEntry, JournalLine, ChartOfAccount, CustomerInvoice, SupplierInvoice, BankAccount, Budget, BudgetLine, Expense (rule-based NLP, 18 intents, bilingual EN/FR)
- **Exports**: `/api/accounting/export` -> JournalEntry, JournalLine, ChartOfAccount, TaxReport
- **Alerts**: `/api/accounting/alerts` -> CustomerInvoice, BankAccount, SupplierInvoice, TaxReport
- **Tax Summary**: `/api/accounting/tax-summary` -> Order, SupplierInvoice

### Other Admin
| Page | Path | Status | API |
|------|------|--------|-----|
| Rapports | `/admin/rapports` | COMPLETE | `/api/admin/reports` |
| Chat | `/admin/chat` | COMPLETE | `/api/chat/*` |
| Webinaires | `/admin/webinaires` | COMPLETE | `/api/admin/webinars` |
| Inventaire | `/admin/inventaire` | COMPLETE | `/api/admin/inventory`, `/api/admin/inventory/[id]` |
| Livraison | `/admin/livraison` | COMPLETE | `/api/admin/shipping/*` |
| Devises | `/admin/devises` | COMPLETE | `/api/admin/currencies` |
| Emails Hub | `/admin/emails` | COMPLETE | `/api/admin/emails/*` |
| UAT | `/admin/uat` | COMPLETE | `/api/admin/uat` |
| Audits Dashboard | `/admin/audits` | COMPLETE | `/api/admin/audits` |
| Audit by Type | `/admin/audits/[type]` | COMPLETE | `/api/admin/audits` |
| Audit Catalog | `/admin/audits/catalog` | COMPLETE | `/api/admin/audits` |
| Backups Dashboard | `/admin/backups` | COMPLETE | `/api/admin/backups` |

### VoIP / Telephony (8 pages)
| Page | Path | Status | Components | API | Models |
|------|------|--------|-----------|-----|--------|
| Dashboard | `/admin/telephonie` | COMPLETE | VoipDashboardClient, CallStats | `/api/admin/voip/dashboard` | CallLog, VoipConnection |
| Call Log | `/admin/telephonie/journal` | COMPLETE | CallLogClient, AudioPlayer | `/api/admin/voip/call-logs` | CallLog, CallRecording, CallTranscription |
| Recordings | `/admin/telephonie/enregistrements` | COMPLETE | RecordingsClient, AudioPlayer | `/api/admin/voip/recordings/[id]` | CallRecording, CallTranscription |
| Voicemail | `/admin/telephonie/messagerie` | COMPLETE | VoicemailClient, AudioPlayer | `/api/admin/voip/voicemails` | Voicemail, SipExtension |
| Connections | `/admin/telephonie/connexions` | COMPLETE | ConnectionsClient | `/api/admin/voip/connections` | VoipConnection |
| Analytics | `/admin/telephonie/analytique` | COMPLETE | AnalyticsClient, Recharts | `/api/admin/voip/dashboard` | CallLog, CallSurvey |
| Extensions | `/admin/telephonie/extensions` | COMPLETE | ExtensionsClient | `/api/admin/voip/extensions` | SipExtension, User |
| Phone Numbers | `/admin/telephonie/numeros` | COMPLETE | PhoneNumbersClient | `/api/admin/voip/phone-numbers` | PhoneNumber, VoipConnection |

### Fiscal (4 pages)
| Page | Path | Status |
|------|------|--------|
| Fiscal Dashboard | `/admin/fiscal` | COMPLETE |
| Country Detail | `/admin/fiscal/country/[code]` | COMPLETE |
| Reports | `/admin/fiscal/reports` | COMPLETE |
| Tasks | `/admin/fiscal/tasks` | COMPLETE |

### CRM Enterprise (11 pages - Phase 3)
| Page | Path | Status | Components | API | Notes |
|------|------|--------|-----------|-----|-------|
| BANT/MEDDIC Qualification | `/admin/crm/qualification` | COMPLETE | - | `/api/admin/crm/leads` | Qualification framework selector + data grid |
| MRR/ARR Dashboard | `/admin/crm/recurring-revenue` | COMPLETE | - | `/api/admin/crm/recurring-revenue` | MRR/ARR KPIs, cohort charts |
| Exchange Rates | `/admin/crm/exchange-rates` | COMPLETE | - | `/api/admin/crm/exchange-rates`, `/api/admin/crm/exchange-rates/sync` | Multi-currency management + live sync |
| Canned Responses (Snippets) | `/admin/crm/snippets` | COMPLETE | - | `/api/admin/crm/snippets` | Canned response library for agents |
| Quotes / CPQ | `/admin/crm/quotes` | COMPLETE | - | `/api/admin/crm/quotes`, `/api/admin/crm/quotes/[id]` | Quote builder, line items, PDF export |
| Approval Workflows | `/admin/crm/approvals` | COMPLETE | - | `/api/admin/crm/approvals`, `/api/admin/crm/approvals/[id]` | Multi-step approval chains |
| Attribution Reporting | `/admin/crm/attribution` | COMPLETE | - | `/api/admin/crm/attribution` | Multi-touch attribution analytics |
| Agent Scheduling | `/admin/crm/scheduling` | COMPLETE | - | `/api/admin/crm/agent-schedules`, `/api/admin/crm/agent-breaks` | Shift management + break tracking |
| QA Scoring | `/admin/crm/qa` | COMPLETE | - | `/api/admin/crm/qa-forms`, `/api/admin/crm/qa-scores` | Quality assurance form builder + scoring |
| Inbox (Enhanced) | `/admin/crm/inbox` | COMPLETE (enhanced) | ChatWidget | - | Enhanced with full contact panel sidebar |
| SMS Templates (Enhanced) | `/admin/crm/sms-templates` | COMPLETE (enhanced) | - | - | Enhanced with live SMS preview |

### CRM Enterprise ULTIMATE (15 pages - Phase 4)
| Page | Path | Status | Components | API | Notes |
|------|------|--------|-----------|-----|-------|
| Call Analytics | `/admin/crm/call-analytics` | COMPLETE | Recharts | `/api/admin/crm/call-analytics` | AHT/ASA/FCR/SL% KPI dashboard |
| Real-time Adherence | `/admin/crm/adherence` | COMPLETE | - | `/api/admin/crm/adherence` | Agent schedule adherence monitoring |
| Tickets | `/admin/crm/tickets` | COMPLETE | - | `/api/admin/crm/tickets` | Full ticket management with priority/category |
| Knowledge Base | `/admin/crm/knowledge-base` | COMPLETE | - | `/api/admin/crm/knowledge-base` | KB articles with categories and status |
| Workflow Analytics | `/admin/crm/workflow-analytics` | COMPLETE | Recharts | `/api/admin/crm/workflow-analytics` | Execution stats, error rates, durations |
| Call Center KPIs | `/admin/crm/call-center-kpis` | COMPLETE | Recharts | `/api/admin/crm/call-center-kpis` | Comprehensive call center metrics |
| Dashboard Builder | `/admin/crm/dashboard-builder` | COMPLETE | - | `/api/admin/crm/dashboard-builder` | Configurable widget dashboard |
| Funnel Analysis | `/admin/crm/funnel-analysis` | COMPLETE | Recharts | - (client-side) | Stage-by-stage conversion funnel |
| Activity Reports | `/admin/crm/activity-reports` | COMPLETE | Recharts | `/api/admin/crm/activity-reports` | Daily/weekly rep activity breakdown |
| CLV Dashboard | `/admin/crm/clv` | COMPLETE | Recharts | - (client-side) | Customer Lifetime Value analysis |
| Churn Analysis | `/admin/crm/churn` | COMPLETE | Recharts | - (client-side) | Churn rate, prediction, at-risk |
| Heatmaps | `/admin/crm/heatmaps` | COMPLETE | - | - (client-side) | Best calling times heatmap |
| Playbooks | `/admin/crm/playbooks` | COMPLETE | - | - (lib API) | Sales playbooks with stage guidance |
| Contracts | `/admin/crm/contracts` | COMPLETE | - | `/api/admin/crm/contracts` | Contract management with renewals |
| Customer Portal | `/(shop)/portal` | COMPLETE | - | - | Customer-facing tickets + KB |

---

## 5. SHOP PAGES (42+)

### Core E-Commerce
| Page | Path | Components | API Calls | Hooks | Contexts |
|------|------|-----------|----------|-------|----------|
| Home | `/` | ProductCard, TrustBadges, HeroSlider, PeptideCalculator(dynamic) | `GET /api/products`, `GET /api/categories` | useI18n | I18n |
| Shop | `/shop` | ProductCard, RecentlyViewed, Breadcrumbs, JsonLd | `GET /api/products` | useI18n, useCurrency | I18n, Currency |
| Product Detail | `/product/[slug]` | WishlistButton, ShareButtons, StickyAddToCart, StockAlertButton, QuantityTiers, ProductBadges, PriceDropButton, CountdownTimer, ProductReviews(dyn), ProductQA(dyn), RecentlyViewed(dyn), ProductVideo(dyn), JsonLd | Server props (ISR 3600s) | useRecentlyViewed, useI18n, useCurrency, useCart, useUpsell | I18n, Currency, Cart, Upsell |
| Category | `/category/[slug]` | ProductCard | Server props (ISR 3600s) | useI18n | I18n |
| Search | `/search` | Breadcrumbs, ProductCard | `GET /api/products/search` | useI18n, useCurrency | I18n, Currency |
| Compare | `/compare` | (inline JSX) | `GET /api/products/compare` | useCompare, useI18n, useCurrency, useCart, useUpsell | I18n, Currency, Cart, Upsell |

### Checkout Flow
| Page | Path | Components | API Calls | Hooks | Key Lib |
|------|------|-----------|----------|-------|---------|
| Checkout | `/checkout` | Breadcrumbs, FormError, AddressAutocomplete | Stripe session creation | useDiscountCode, useI18n, useCurrency, useCart, useSession | `canadianTaxes`, `form-validation` |
| Success | `/checkout/success` | Breadcrumbs | `GET /api/orders/by-session` | useI18n, useCart (clearCart) | - |

### Account (14 pages)
All share: `useSession` (next-auth), `useRouter`, `useI18n`, SessionProvider, I18nProvider

| Page | Path | Extra Components | Extra API | Extra Hooks/Contexts |
|------|------|-----------------|----------|---------------------|
| Dashboard | `/account` | Breadcrumbs | `/api/account/summary` | useCurrency |
| Profile | `/account/profile` | FormError | `PUT /api/account/profile` | - |
| Settings | `/account/settings` | FormError, ConfirmDialog | `PUT /api/account/settings` | - |
| Addresses | `/account/addresses` | FormError, AddressAutocomplete, ConfirmDialog | `CRUD /api/account/addresses` | - |
| Orders | `/account/orders` | - | `GET /api/account/orders` | useCart |
| Invoices | `/account/invoices` | - | `GET /api/account/invoices` | - |
| Wishlist | `/account/wishlist` | PriceDropButton, ConfirmDialog | `GET/DELETE /api/account/wishlist` | useCurrency |
| Rewards | `/account/rewards` | - | `GET /api/account/rewards` | - |
| Referrals | `/account/referrals` | - | `GET /api/account/referrals` | - |
| Notifications | `/account/notifications` | - | `GET/PUT /api/account/notifications` | - |
| Inventory | `/account/inventory` | - | `GET /api/account/inventory` | - |
| Products | `/account/products` | SubscriptionOfferModal | `GET /api/account/products` | useCart, useUpsell |
| My Data | `/account/my-data` | - | `GET/DELETE /api/account/my-data` | - |
| Protocols | `/account/protocols` | - | `GET /api/account/protocols` | - |

### Community & Learning
| Page | Path | Status | API | Notes |
|------|------|--------|-----|-------|
| Community Forum | `/community` | **COMPLETE** | `GET/POST /api/community/posts`, `GET /api/community/categories` | Real API with ForumPost, ForumCategory, ForumReply, ForumVote models |
| FAQ | `/faq` | COMPLETE (ISR) | Server Prisma | Uses JsonLd, faqSchema |
| Learn | `/learn` | COMPLETE | NONE | Hardcoded articles |
| Learn Detail | `/learn/[slug]` | COMPLETE | NONE | DOMPurify for HTML |
| Lab Results | `/lab-results` | COMPLETE (ISR) | Server Prisma | CoA data |
| Webinars | `/webinars` | PARTIAL | `GET /api/webinars` | Needs useSession |
| Videos | `/videos` | PARTIAL | NONE | Hardcoded data |
| Rewards | `/rewards` | PARTIAL | LoyaltyContext | Needs LoyaltyProvider |

### Special Features
| Page | Path | Components | API | Notes |
|------|------|-----------|-----|-------|
| Bundles | `/bundles` | BundleCard | `GET /api/bundles` | - |
| Bundle Detail | `/bundles/[slug]` | (inline) | `GET /api/bundles/[slug]` | useCart |
| Subscriptions | `/subscriptions` | (inline) | `/api/products`, `/api/account/subscriptions` | useSession, useCurrency |
| Gift Cards | `/gift-cards` | Breadcrumbs | `POST /api/gift-cards` | useCurrency |
| Ambassador | `/ambassador` | (inline) | `POST /api/contact` | useSession |
| Calculator | `/calculator` | PeptideCalculator(dynamic) | NONE | - |
| Track Order | `/track-order` | (inline) | `GET /api/orders/track` | - |

---

## 6. PUBLIC PAGES (36)

### Company (6 pages - ALL STUBS)
All are simple static pages with no components, hooks, or API calls.
`/a-propos`, `/a-propos/histoire`, `/a-propos/mission`, `/a-propos/valeurs`, `/a-propos/engagements`, `/a-propos/equipe`

### Marketing Content
| Page | Path | Status | Lib Used |
|------|------|--------|----------|
| Blog | `/blog` | COMPLETE (ISR 300s) | prisma, translation, structured-data, JsonLd |
| Blog Detail | `/blog/[slug]` | COMPLETE (ISR 300s) | prisma, translation, structured-data, JsonLd |
| Contact | `/contact` | PARTIAL | form-validation (contactFormSchema) |
| Tarifs | `/tarifs` | PARTIAL | useI18n only |
| Presse | `/presse` | PARTIAL | - |
| Solutions | `/solutions` | PARTIAL | - |
| Clients | `/clients` | PARTIAL | - |

### Legal (ALL COMPLETE)
All use `useI18n` only: `/mentions-legales/confidentialite`, `/mentions-legales/conditions`, `/mentions-legales/cookies`, `/accessibilite`

---

## 7. AUTH & DASHBOARD PAGES

### Auth (9 pages)
| Page | Path | Status |
|------|------|--------|
| Sign In | `/auth/signin` | COMPLETE |
| Sign Up | `/auth/signup` | COMPLETE |
| Forgot Password | `/auth/forgot-password` | COMPLETE |
| Reset Password | `/auth/reset-password` | COMPLETE |
| Post-Login Router | `/auth/post-login` | COMPLETE |
| Sign Out | `/auth/signout` | COMPLETE |
| Welcome | `/auth/welcome` | PARTIAL |
| Accept Terms | `/auth/accept-terms` | PARTIAL |
| Error | `/auth/error` | PARTIAL |

### Dashboards (role-based routing)
| Page | Path | Status |
|------|------|--------|
| Router | `/dashboard` | COMPLETE (redirects by role) |
| Customer | `/dashboard/customer` | PARTIAL |
| Employee | `/dashboard/employee` | PARTIAL |
| Client B2B | `/dashboard/client` | PARTIAL |
| Owner | `/owner/dashboard` | PARTIAL |

---

## 8. API ROUTES BY DOMAIN

**Auth Legend**: admin-guard=`withAdminGuard()`, auth=session required, cron-secret=Bearer CRON_SECRET, stripe-sig/paypal-sig=webhook signature, rate-limit=IP throttle, none=public

### Commerce (16 routes)
| Route | Methods | Models | Auth | External |
|-------|---------|--------|------|----------|
| /api/orders | GET | Order,OrderItem,User,Currency | auth | - |
| /api/orders/track | GET | Order,User | rate-limit | - |
| /api/orders/by-session | GET | Order | none | Stripe |
| /api/payments/create-intent | POST | Product,Purchase,AuditLog | auth+csrf | Stripe |
| /api/payments/create-checkout | POST | Product,ProductFormat,PromoCode,GiftCard,Currency,Order,InventoryReservation | auth+csrf | Stripe |
| /api/payments/charge-saved-card | POST | Product,SavedCard,Purchase,AuditLog | auth+csrf | Stripe |
| /api/payments/express | POST | Product,Purchase,AuditLog | auth+csrf | Stripe |
| /api/payments/webhook | POST | Order,OrderItem,WebhookEvent,PromoCode,GiftCard,Ambassador,InventoryReservation,InventoryTransaction,JournalEntry,User + 5 more | stripe-sig | Stripe,Email,SMS,Redis |
| /api/payments/paypal/create-order | POST | Product,ProductFormat,PromoCode,GiftCard,Order,InventoryReservation | auth+csrf | PayPal |
| /api/payments/paypal/capture | POST | Order,OrderItem,ProductFormat,Product,PromoCode,GiftCard,Ambassador,AmbassadorCommission,InventoryReservation,InventoryTransaction,Purchase,AuditLog | auth+csrf | PayPal |
| /api/products | GET,POST | Product,ProductFormat,ProductImage,Category,AuditLog | GET:none POST:auth | - |
| /api/products/[id] | GET,PUT,DEL | Product,ProductFormat,ProductImage,Category,AuditLog | GET:none PUT/DEL:auth | - |
| /api/categories | GET,POST | Category,AuditLog | GET:none POST:auth | - |

### Newsletter/Mailing (14 routes)
| Route | Methods | Models | Auth | External |
|-------|---------|--------|------|----------|
| /api/newsletter | GET,POST | NewsletterSubscriber → forwards to mailing-list | rate-limit | - |
| /api/mailing-list/subscribe | POST | MailingListSubscriber,MailingListPreference | none | Email(sendEmail) |
| /api/mailing-list/confirm | GET | MailingListSubscriber | none | - |
| /api/mailing-list/unsubscribe | GET,POST | MailingListSubscriber | rate-limit | - |
| /api/unsubscribe | GET,POST | NewsletterSubscriber,NotificationPreference,AuditLog | jwt-token | jose(JWT) |
| /api/email-preferences | GET,PUT | NewsletterSubscriber,MailingListSubscriber,MailingListPreference,NotificationPreference,ConsentRecord,AuditLog | jwt-token | jose(JWT) |
| /api/admin/mailing-list | GET | MailingListSubscriber,MailingListPreference | admin-guard | - |
| /api/admin/newsletter/subscribers | GET,POST | NewsletterSubscriber | admin-guard | - |
| /api/admin/newsletter/campaigns | GET,POST | EmailCampaign (abTestConfig JSON) | admin-guard | - |
| /api/tracking/email | GET | EmailLog,EmailEngagement,EmailCampaign | none (HMAC) | 1x1 GIF pixel |
| /api/tracking/click | GET | EmailLog,EmailEngagement,EmailCampaign | none (HMAC) | 302 redirect |
| /api/cron/ab-test-check | GET,POST | EmailCampaign,EmailLog,User,NotificationPreference,ConsentRecord | cron-secret | sendEmail |

### Admin Integrations (3 routes) - NEW 2026-02-21
| Route | Methods | Models | Auth | External |
|-------|---------|--------|------|----------|
| /api/admin/integrations/zoom | GET,PUT,POST | SiteSetting | admin-guard | Zoom OAuth |
| /api/admin/integrations/whatsapp | GET,PUT,POST | SiteSetting | admin-guard | WhatsApp Cloud API |
| /api/admin/integrations/teams | GET,PUT,POST | SiteSetting | admin-guard | Teams Graph/Webhook |

### Accounting (10+ key routes)
| Route | Methods | Models | Auth |
|-------|---------|--------|------|
| /api/accounting/dashboard | GET | Order,JournalLine,CustomerInvoice,BankAccount,AccountingAlert | admin-guard |
| /api/accounting/entries | GET,POST,PUT,DEL | JournalEntry,JournalLine,ChartOfAccount,FiscalYear,AccountingPeriod | admin-guard |
| /api/accounting/general-ledger | GET | JournalLine | admin-guard |
| /api/accounting/reconciliation | GET,POST,PUT | BankTransaction,JournalEntry,BankAccount | admin-guard |
| /api/accounting/stripe-sync | GET,POST | BankTransaction,JournalEntry,WebhookEvent | admin-guard |
| /api/accounting/tax-summary | GET | Order,SupplierInvoice | admin-guard |
| /api/accounting/bank-accounts | GET,POST,PUT,DEL | BankAccount | admin-guard |
| /api/accounting/budgets | GET,POST,PUT,DEL | Budget,BudgetLine | admin-guard |
| /api/accounting/export | GET | JournalEntry,JournalLine,ChartOfAccount,TaxReport | admin-guard |
| /api/accounting/alerts | GET,POST,PATCH | AccountingAlert,CustomerInvoice,BankAccount,SupplierInvoice | admin-guard |
| /api/accounting/ai-chat | GET,POST | JournalEntry,JournalLine,ChartOfAccount,CustomerInvoice,SupplierInvoice,BankAccount,Budget,BudgetLine | admin-guard (30 req/min) |

### Auth (5 routes)
| Route | Models | External |
|-------|--------|----------|
| /api/auth/[...nextauth] | User(Auth.js) | Auth.js providers |
| /api/auth/signup | User,AuditLog | bcryptjs,Email |
| /api/auth/forgot-password | User | Email |
| /api/auth/reset-password | User | bcryptjs |
| /api/auth/accept-terms | User | - |

### Webhooks (7 routes)
| Route | Models | Auth |
|-------|--------|------|
| /api/webhooks/stripe | proxy → /api/payments/webhook | stripe-sig |
| /api/webhooks/paypal | WebhookEvent,Order,OrderItem,ProductFormat,InventoryTransaction,Ambassador | paypal-sig |
| /api/webhooks/email-bounce | EmailLog,BounceRecord via bounce-handler | svix-signature (Resend) |
| /api/webhooks/inbound-email | InboundEmail,EmailConversation | webhook-secret |
| /api/webhooks/zoom | RecordingImport | webhook-secret (also in Platform Integrations) |
| /api/webhooks/teams | RecordingImport | webhook-secret (also in Platform Integrations) |
| /api/webhooks/webex | RecordingImport | webhook-secret (also in Platform Integrations) |

### Cron Jobs (12 routes, all cron-secret auth)
abandoned-cart, birthday-emails, data-retention, dependency-check, email-flows, points-expiring, price-drop-alerts, release-reservations, satisfaction-survey, stock-alerts, update-exchange-rates, welcome-series

### Admin Core (100+ routes)
orders, users/[id], users/[id]/points, **users/[id]/email** (POST - admin transactional email), users/[id]/reset-password, employees, inventory, **inventory/[id]** (PATCH - stock update), **inventory/history**, **inventory/import**, **inventory/export**, currencies, settings, seo, emails/send, emails/settings, emails/mailing-list, emails/mailing-list/import, promotions, promo-codes, reviews, suppliers, subscriptions, loyalty/*, translations, nav-sections, nav-subsections, nav-pages, medias, webinars, videos, logs, audit-log, **audits** (GET - audit dashboard), metrics, cache-stats, permissions, shipping/*, uat, reports

### Community Forum (7 routes) - NEW 2026-02-25
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/community/categories | GET | ForumCategory,ForumPost | none | Returns categories with post counts |
| /api/community/posts | GET,POST | ForumPost,ForumCategory,User,ForumVote | GET:none POST:auth | Pagination, filtering by category/search |
| /api/community/posts/[id] | GET,DELETE | ForumPost,ForumReply,ForumVote,User | GET:none DEL:auth(owner/admin) | Single post with replies |
| /api/community/posts/[id]/replies | GET,POST | ForumReply,ForumPost,User | GET:none POST:auth | Nested replies support |
| /api/community/posts/[id]/vote | POST | ForumVote,ForumPost | auth | Upvote/downvote, unique per user |
| /api/community/seed | POST | ForumCategory | admin-guard | Seed default forum categories |
| /api/community/debug | GET | ForumCategory,ForumPost | none | Debug endpoint for dev |

### Content Hub / Mediatheque (20 routes) - NEW 2026-02-27
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/video-categories | GET,POST | VideoCategory,VideoCategoryTranslation | admin-guard | CRUD with translations |
| /api/admin/video-categories/[id] | GET,PUT,DELETE | VideoCategory,VideoCategoryTranslation | admin-guard | Single category management |
| /api/admin/videos/[id]/placements | GET,POST,DELETE | VideoPlacement,Video | admin-guard | Assign videos to page locations |
| /api/admin/videos/[id]/products | GET,POST,DELETE | VideoProductLink,Video,Product | admin-guard | Link videos to products |
| /api/admin/videos/[id]/tags | GET,POST,DELETE | VideoTag,Video | admin-guard | Tag management per video |
| /api/admin/videos/[id]/consent | GET,POST | SiteConsent,Video | admin-guard | Consent forms for video appearances |
| /api/admin/consent-templates | GET,POST | ConsentFormTemplate,ConsentFormTranslation | admin-guard | Consent form templates |
| /api/admin/consent-templates/[id] | GET,PUT,DELETE | ConsentFormTemplate,ConsentFormTranslation | admin-guard | Single template management |
| /api/admin/consents | GET,POST | SiteConsent | admin-guard | All consent records |
| /api/admin/consents/[id] | GET,PUT,DELETE | SiteConsent | admin-guard | Single consent management |
| /api/admin/content-hub/stats | GET | Video,VideoCategory,SiteConsent,VideoPlacement | admin-guard | Dashboard statistics |
| /api/admin/emails/accounts | GET,POST | EmailAccount (SiteSetting) | admin-guard | Email accounts for consent sending |
| /api/videos | GET | Video,VideoCategory,VideoTag | none | Public video listing |
| /api/videos/[slug] | GET | Video,VideoCategory | none | Single video by slug |
| /api/videos/placements/[placement] | GET | VideoPlacement,Video | none | Videos for a specific placement |
| /api/account/content | GET | Video,VideoCategory,SiteConsent | auth | User mediatheque |
| /api/account/consents | GET,POST | SiteConsent,ConsentFormTemplate | auth | User consent management |
| /api/account/consents/[id] | GET | SiteConsent | auth | Single consent detail |
| /api/consent/[token] | GET,POST | SiteConsent,ConsentFormTemplate | none (token) | Public consent form signing |

### Platform Integrations (15 routes) - NEW 2026-02-28
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/platform-connections | GET | PlatformConnection | admin-guard | List all connections |
| /api/admin/platform-connections/[platform] | GET,PUT,DELETE | PlatformConnection | admin-guard | CRUD connection |
| /api/admin/platform-connections/[platform]/oauth | GET | PlatformConnection | admin-guard | Init OAuth flow |
| /api/admin/platform-connections/[platform]/callback | GET | PlatformConnection | admin-guard | OAuth callback |
| /api/admin/platform-connections/[platform]/refresh | POST | PlatformConnection | admin-guard | Refresh token |
| /api/admin/platform-connections/[platform]/test | POST | PlatformConnection | admin-guard | Test connection |
| /api/admin/recording-imports | GET | RecordingImport | admin-guard | List imports |
| /api/admin/recording-imports/sync | POST | RecordingImport | admin-guard | Sync recordings |
| /api/admin/recording-imports/[id] | GET,PATCH | RecordingImport | admin-guard | Detail/retry |
| /api/admin/recording-imports/[id]/import | POST | RecordingImport,Video | admin-guard | Import recording |
| /api/admin/recording-imports/bulk-import | POST | RecordingImport,Video | admin-guard | Bulk import |
| /api/admin/video-sessions | GET,POST | VideoSession,User | admin-guard | List/create sessions |
| /api/admin/video-sessions/[id] | GET,PUT | VideoSession | admin-guard | Detail/update session |
| /api/webhooks/zoom | POST | RecordingImport | webhook-secret | Zoom webhook |
| /api/webhooks/teams | POST | RecordingImport | webhook-secret | Teams webhook |
| /api/webhooks/webex | POST | RecordingImport | webhook-secret | Webex webhook |
| /api/admin/videos/[id]/publish-youtube | POST | Video | admin-guard | YouTube upload |
| /api/admin/meetings/create | POST | - | admin-guard | Create meeting (Zoom/Teams/Meet/Webex) |
| /api/admin/meetings/notify-whatsapp | POST | - | admin-guard | Send WhatsApp meeting notification |

### Social Media & Ads (8 routes) - NEW 2026-02-28
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/social-posts | GET,POST | SocialPost,User | admin-guard | List and create social posts |
| /api/admin/social-posts/[id] | PATCH,DELETE | SocialPost | admin-guard | Update/delete social post |
| /api/admin/social-posts/[id]/publish | POST | SocialPost | admin-guard | Publish immediately |
| /api/admin/social-posts/cron | POST | SocialPost | cron-secret | Cron for scheduled posts |
| /api/admin/ads/stats | GET | AdCampaignSnapshot | admin-guard | Aggregated ads stats |
| /api/admin/ads/[platform]/campaigns | GET | AdCampaignSnapshot | admin-guard | Campaigns by platform |
| /api/admin/ads/sync | POST | AdCampaignSnapshot | admin-guard | Manual sync trigger |
| /api/admin/ads/cron | POST | AdCampaignSnapshot | cron-secret | Cron for daily sync |

### VoIP / Telephony (12 routes) - NEW 2026-03-01
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/voip/dashboard | GET | CallLog,CallSurvey,SipExtension,Voicemail | admin-guard | Aggregated VoIP metrics |
| /api/admin/voip/connections | GET,POST,PUT,DEL | VoipConnection | admin-guard | CRUD + test connection |
| /api/admin/voip/extensions | GET,POST,PUT,DEL | SipExtension,User | admin-guard | CRUD + get SIP creds |
| /api/admin/voip/call-logs | GET | CallLog,CallRecording,CallTranscription,User | admin-guard | Filtered + paginated |
| /api/admin/voip/phone-numbers | GET,POST,DEL | PhoneNumber,VoipConnection | admin-guard | DID management |
| /api/admin/voip/recordings/[id] | GET | CallRecording | admin-guard | Stream audio from Azure Blob |
| /api/admin/voip/voicemails | GET,PUT | Voicemail,SipExtension,User | admin-guard | List + markRead/archive |
| /api/admin/voip/cdr/ingest | POST | CallLog,CallRecording,PhoneNumber,SipExtension | cdr-secret | FreeSWITCH CDR webhook |
| /api/admin/voip/surveys/submit | POST | CallSurvey,CallLog | cdr-secret | FreeSWITCH survey webhook |
| /api/cron/voip-recordings | POST | CallRecording,VoipConnection | cron-secret | Upload pending PBX recordings to Azure Blob |
| /api/cron/voip-transcriptions | POST | CallRecording,CallTranscription | cron-secret | Whisper STT + GPT-4o-mini analysis |
| /api/cron/voip-notifications | POST | CallLog,Voicemail,SipExtension,User | cron-secret | Email alerts for missed calls + voicemails |

### CRM Enterprise Routes (17 new routes - Phase 3 2026-03-04)

**CRM Admin**
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/crm/snippets | GET,POST | CrmSnippet | admin-guard | Canned responses CRUD |
| /api/admin/crm/quotes | GET,POST | CrmQuote,CrmQuoteItem,CrmDeal | admin-guard | Quote/CPQ list and create |
| /api/admin/crm/quotes/[id] | GET,PUT,DELETE | CrmQuote,CrmQuoteItem | admin-guard | Single quote management + PDF |
| /api/admin/crm/approvals | GET,POST | CrmApproval | admin-guard | Approval request list and create |
| /api/admin/crm/approvals/[id] | GET,PUT | CrmApproval | admin-guard | Single approval + status update |
| /api/admin/crm/exchange-rates | GET,POST | ExchangeRate | admin-guard | Exchange rate management |
| /api/admin/crm/exchange-rates/sync | POST | ExchangeRate | admin-guard | Sync rates from external API |
| /api/admin/crm/recurring-revenue | GET | CrmDeal | admin-guard | MRR/ARR dashboard aggregation |
| /api/admin/crm/agent-schedules | GET,POST | AgentSchedule | admin-guard | Agent shift management |
| /api/admin/crm/qa-forms | GET,POST | CrmQaForm | admin-guard | QA form builder |
| /api/admin/crm/qa-scores | GET,POST | CrmQaScore,CrmQaForm | admin-guard | QA scoring records |
| /api/admin/crm/agent-breaks | GET,POST,PUT | AgentBreak | admin-guard | Agent break tracking |
| /api/admin/crm/attribution | GET | - | admin-guard | Multi-touch attribution report |

**Public / Webhooks**
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/public/chatbot | POST | - | rate-limit | AI chatbot endpoint (OpenAI powered) |
| /api/webhooks/whatsapp | POST | - | webhook-secret | WhatsApp Business API webhook |
| /api/webhooks/email-inbound | POST | - | webhook-secret | Inbound email parsing + routing |
| /api/webhooks/meta | GET,POST | - | webhook-secret | Facebook/Instagram Messenger webhook (GET=verify, POST=events) |

### CRM Enterprise ULTIMATE Routes (14 new routes - Phase 4 2026-03-04)

**CRM Admin**
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/crm/call-analytics | GET | CallLog, AgentDailyStats | admin-guard | AHT/ASA/FCR/SL% metrics |
| /api/admin/crm/adherence | GET | AgentSchedule, User | admin-guard | Real-time adherence monitoring |
| /api/admin/crm/tickets | GET,POST | CrmTicket, CrmTicketComment | admin-guard | Ticket CRUD with priority/category |
| /api/admin/crm/knowledge-base | GET,POST | KBArticle, KBCategory | admin-guard | KB article CRUD |
| /api/admin/crm/workflow-analytics | GET | CrmWorkflow | admin-guard | Workflow execution stats |
| /api/admin/crm/workflow-versions | GET,POST | CrmWorkflowVersion | admin-guard | Workflow version history |
| /api/admin/crm/call-center-kpis | GET | CallLog, CrmCampaignActivity | admin-guard | Comprehensive CC KPIs |
| /api/admin/crm/dashboard-builder | GET,POST | - | admin-guard | Custom dashboard widget config |
| /api/admin/crm/activity-reports | GET | CrmActivity, User | admin-guard | Rep activity breakdown |
| /api/admin/crm/price-books | GET,POST | PriceBook, PriceBookEntry | admin-guard | Price book CRUD |
| /api/admin/crm/deal-teams | GET,POST,DELETE | CrmDealTeam | admin-guard | Deal team member management |
| /api/admin/crm/contracts | GET,POST | CrmContract, CrmDeal | admin-guard | Contract CRUD with renewals |
| /api/admin/crm/gdpr-delete | POST | CrmLead, CrmActivity, User | admin-guard | GDPR Art 17 right to deletion |

**Webhooks**
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/webhooks/zapier | POST | Various | webhook-secret | Zapier trigger/action endpoint |

### CRM LeadEngine / Prospect Lists Routes (12 routes - 2026-03-07)
| Route | Methods | Models | Auth | Notes |
|-------|---------|--------|------|-------|
| /api/admin/crm/lists | GET,POST | ProspectList | admin-guard | List index + create |
| /api/admin/crm/lists/[id] | GET,PUT,DELETE | ProspectList,Prospect | admin-guard | Single list CRUD |
| /api/admin/crm/lists/[id]/prospects | POST | Prospect | admin-guard | Add prospect to list |
| /api/admin/crm/lists/[id]/prospects/[prospectId] | PUT,DELETE | Prospect | admin-guard | Edit/delete single prospect |
| /api/admin/crm/lists/[id]/import | POST | Prospect,ProspectList | admin-guard | CSV import with dedup |
| /api/admin/crm/lists/[id]/scrape | POST | Prospect,ProspectList | admin-guard | Google Maps scrape (Text Search + Nearby fallback) |
| /api/admin/crm/lists/[id]/enrich | POST | Prospect | admin-guard | Waterfall enrichment (website→Hunter→pattern→Apollo) |
| /api/admin/crm/lists/[id]/score | POST | Prospect | admin-guard | 7-factor AI scoring + auto-qualify |
| /api/admin/crm/lists/[id]/validate | POST | Prospect | admin-guard | Bulk validation by rules |
| /api/admin/crm/lists/[id]/deduplicate | POST | Prospect | admin-guard | Cross-list dedup (phone+domain+GPS) |
| /api/admin/crm/lists/[id]/integrate | POST | Prospect,CrmLead,DnclEntry | admin-guard | Convert prospects → CRM leads + DNC check + assignment |
| /api/admin/crm/lists/[id]/start-campaign | POST | CrmLead,DialerCampaign,DialerListEntry,DnclEntry | admin-guard | 1-click campaign creation from list |

### Mega-Audit v2 Routes (32 new routes - 2026-03-04)

**Cart Enhancements**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/cart/sync | GET,POST | auth | Sync cart to DB for authenticated users |
| /api/cart/saved | GET,POST,DEL | auth | Save cart for later |
| /api/cart/share | GET,POST | rate-limit | JWT-based cart sharing (stateless) |

**Order Management (Admin)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/orders/[id]/notes | GET,PATCH | admin-guard | Order notes (customer + admin) |
| /api/admin/orders/export | GET | admin-guard | CSV export with status filter |
| /api/admin/orders/bulk-status | PATCH | admin-guard | Bulk status update |
| /api/admin/orders/[id]/split | POST | admin-guard | Split order into partial shipments |
| /api/admin/orders/[id]/preorder | POST,PATCH | admin-guard | Pre-order management |
| /api/admin/orders/backorders | GET | admin-guard | Backorder tracking |
| /api/orders/[id]/invoice | GET | auth | Customer invoice HTML (print/PDF) |

**Inventory & Suppliers (Admin)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/inventory/suppliers | GET,POST | admin-guard | Supplier CRUD via SiteSettings |
| /api/admin/inventory/purchase-orders | GET,POST | admin-guard | Purchase order tracking |

**Payments (Admin)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/payments/reconciliation | GET | admin-guard | Revenue reconciliation report |

**CRM (Admin)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/crm/leads | GET,POST | admin-guard | Lead management |
| /api/admin/crm/deals | GET,POST | admin-guard | Deal/pipeline tracking |
| /api/admin/crm/dialer | GET,POST | admin-guard | Power dialer session (get state / start campaign or ad-hoc) |
| /api/admin/crm/dialer/action | POST | admin-guard | Dialer actions: pause, resume, stop, disposition, skip |
| /api/admin/customers/merge | POST | admin-guard | Merge two customer accounts |

**Reviews (Admin + Customer)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/reviews/bulk | PATCH | admin-guard | Bulk approve/reject reviews |
| /api/reviews/[id]/vote | POST | auth+csrf | Helpful vote toggle |

**Blog**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/blog/[slug]/comments | GET,POST | GET:none POST:auth | Blog comments (moderated) |
| /api/admin/blog/analytics | GET | admin-guard | Blog post analytics |

**Security & Monitoring (Admin)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/security/headers-audit | GET | admin-guard | Security headers checklist |

**Shipping**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/webhooks/shipping | POST | webhook-secret | Carrier tracking updates (idempotent) |
| /api/admin/shipping/zones | GET,POST | admin-guard | Shipping zone management |

**Cron Jobs (3 new)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/cron/low-stock-alerts | POST | cron-secret | Email alerts for low inventory |
| /api/cron/birthday-bonus | POST | cron-secret | Award birthday loyalty points |
| /api/cron/calculate-metrics | POST | cron-secret | RFM/CLV customer metrics |

**Ambassador**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/ambassador/status | GET | auth | Ambassador dashboard data |

### Audit Session Routes (22 new routes - 2026-03-04)

**Admin User/Customer CRM**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/users/[id]/email | POST | admin-guard | Send transactional email to user |
| /api/admin/users/[id]/reset-password | POST | admin-guard | Admin-initiated password reset |
| /api/admin/users/[id]/notes | GET,POST,PUT,DEL | admin-guard | Customer notes CRUD |
| /api/admin/users/[id]/tags | GET,POST,DEL | admin-guard | Customer tag management |
| /api/admin/tags | GET | admin-guard | All unique customer tags (aggregated) |
| /api/admin/sms-logs | GET | admin-guard | SMS log viewer |
| /api/admin/customers/segments | GET | admin-guard | Dynamic customer segmentation |
| /api/admin/customers/at-risk | GET | admin-guard | At-risk customers (churn prediction) |
| /api/admin/customers/[id]/health | GET | admin-guard | Customer health score |

**Order Enhancements**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/orders/[id]/pdf | GET | admin-guard | Order invoice PDF generation |
| /api/admin/orders/[id]/timeline | GET | admin-guard | Order event audit timeline |
| /api/account/orders/[id]/receipt | GET | auth | Customer-facing order receipt |
| /api/account/orders/[id]/reorder | POST | auth | Re-order from a past order |

**Cart**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/account/saved-items | GET,POST,DEL | auth | Save items for later (wishlist-cart hybrid) |
| /api/cart/shared/[code] | GET | rate-limit | Shared cart resolver (JWT stateless) |

**Inventory & Analytics**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/inventory/reconciliation | GET,POST | admin-guard | Stock reconciliation report |
| /api/admin/search-analytics | GET | admin-guard | Search query analytics |

**Reviews**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/admin/reviews/[id]/respond | POST | admin-guard | Admin response to a review |

**Blog**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/blog/[slug]/comments | GET,POST | GET:none POST:auth | Blog post comments (moderated) |

**Cron Jobs (3 new)**
| Route | Methods | Auth | Notes |
|-------|---------|------|-------|
| /api/cron/low-stock-alerts | POST | cron-secret | Email alerts for low inventory |
| /api/cron/churn-alerts | POST | cron-secret | Churn prediction email alerts |
| /api/cron/birthday-bonus | POST | cron-secret | Birthday loyalty bonus points |

### Public Utility (30+ routes)
products, categories, blog, articles, reviews, ambassadors, referrals, loyalty, gift-cards, currencies, contact, consent, csrf, health, hero-slides, testimonials, videos, webinars, search/suggest, social-proof, stock-alerts, price-watch, promo/validate, upsell, bundles

---

## 9. COMPONENTS & THEIR CONSUMERS

### Most Shared Components
| Component | Used By (pages) |
|-----------|-----------------|
| `Breadcrumbs` | shop, search, checkout, checkout/success, rewards, gift-cards, account, account/returns (8) |
| `ProductCard` | home, shop, category, search (4) |
| `JsonLd` | shop, product, faq, learn, blog, blog/[slug] (5-6) |
| `FormError` | checkout, account/addresses, account/profile, account/settings (4) |
| `ConfirmDialog` | account/addresses, account/wishlist, account/settings (3) |
| `PriceDropButton` | product, account/wishlist (2) |
| `RecentlyViewed` | shop, product (2) |
| `AddressAutocomplete` | checkout, account/addresses (2) |
| `ContactListPage` | admin/clients, admin/customers (2) |
| `OutlookUI` suite | 20+ admin pages (ContentList, DetailPane, MobileSplitLayout, etc.) |

### Admin-Specific Components (28)
PageHeader, StatCard, Modal, Button, DataTable, FilterBar, FormField, MediaUploader, MediaGalleryUploader, WebNavigator, CsrfInit, ContactListPage, StatusBadge, EmptyState, SectionCard, OutlookRibbon, SplitLayout, ContentList, DetailPane, FolderPane, IconRail, ChatPreview, AvatarCircle, OutlookTopBar, MobileSplitLayout, IntegrationCard, **AdminCommandPalette** (NEW - Cmd+K global search/navigation), **KeyboardShortcutsDialog** (NEW - ?-key shortcut reference)

### Content Hub / Video Components (5) - NEW 2026-02-27
| Component | Used By (pages) |
|-----------|-----------------|
| `VideoPlayer` | /admin/media/videos/[id], /videos, /product/[slug], /account/content |
| `VideoCard` | /admin/media/content-hub, /videos, /account/content |
| `VideoGrid` | /admin/media/content-hub, /videos, /account/content |
| `VideoFilters` | /admin/media/content-hub, /videos |
| `VideoPlacementWidget` | /admin/media/videos/[id], product pages (embedded) |

### Bridge Components (1) - NEW 2026-03-05
| Component | Used By (pages) |
|-----------|-----------------|
| `BridgeCard` | commandes, deals/[id], promo-codes, avis, videos/[id], ecritures, CustomerSidebar, CallLogClient (8+) |

### Ads & Social Components (1) - NEW 2026-02-28
| Component | Used By (pages) |
|-----------|-----------------|
| `AdsPlatformDashboard` | /admin/media/ads-youtube, /admin/media/ads-google, /admin/media/ads-tiktok, /admin/media/ads-x, /admin/media/ads-linkedin, /admin/media/ads-meta (6) |

### VoIP Components (8) - NEW 2026-03-01
| Component | Used By (pages) |
|-----------|-----------------|
| `Softphone` | Admin layout (fixed bottom bar, all admin pages) |
| `SoftphoneProvider` | Admin layout (context wrapper) |
| `IncomingCallModal` | Softphone (incoming call popup) |
| `CallControls` | Softphone (mute, hold, DTMF, transfer) |
| `AgentStatus` | Softphone (availability selector) |
| `AudioPlayer` | /admin/telephonie/journal, /admin/telephonie/enregistrements, /admin/telephonie/messagerie |
| `CallStats` | /admin/telephonie (dashboard), /admin/telephonie/analytique |
| `SatisfactionBadge` | /admin/telephonie/journal (call log rows) |

### Blog & Cart Components (3) - NEW 2026-03-04
| Component | Used By (pages) |
|-----------|-----------------|
| `BlogComments` | /blog/[slug] |
| `CartShareButton` | CartDrawer, /checkout |
| `SharedCartBanner` | CartDrawer, /checkout (shared cart import banner) |

### CRM Chat Components (2) - NEW Phase 3 2026-03-04
| Component | Used By (pages) |
|-----------|-----------------|
| `ChatWidget` (src/components/chat/ChatWidget.tsx) | /admin/crm/inbox, embeddable on any page via EmbedScript |
| `EmbedScript` (src/components/chat/EmbedScript.tsx) | Standalone embed snippet for external site integration of ChatWidget |

### Shop-Specific Components (57)
Header, Footer, HeroBanner, ProductCard, ProductGallery, ProductReviews, ProductQA, CartDrawer, CartCrossSell, SearchModal, QuickViewModal, WishlistButton, FormatSelector, PeptideCalculator, CompareButton, CompareBar, NewsletterPopup, MailingListSignup, CookieConsent, FreeShippingBanner, FlashSaleBanner, TrustBadges, ShareButtons, UpsellInterstitialModal, StickyAddToCart, BundleCard, StockAlertButton, PriceDropButton, GiftCardRedeem, RecentlyViewed, TextToSpeechButton, DisclaimerModal, QuantityTiers, CategoryScroller, ProductBadges, HeroSlider, ProductVideo, SubscriptionOfferModal...

---

## 10. HOOKS & THEIR CONSUMERS

| Hook | Purpose | Storage | Used By |
|------|---------|---------|---------|
| `useCompare` | Compare up to 4 products | localStorage | `/compare` |
| `useRecentlyViewed` | Track last 10 viewed | localStorage | `/product/[slug]` |
| `useAdminSSE` | Singleton SSE for admin | Memory | Admin layout |
| `useAdminList` | Generic list fetch/filter | API | Multiple admin pages |
| `useAdminNotifications` | Real-time badge counts | SSE | Admin sidebar |
| `useRecentChats` | Poll chats every 30s | API | Admin chat |
| `useOnlineStatus` | Detect online/offline | Browser | Layout |
| `useNavPages` | Fetch nav pages by rail | API | Admin navigator |
| `useAddressAutocomplete` | Google Places | Google API | Checkout, account/addresses |
| `useDiscountCode` | Promo/gift validation | API | Checkout |
| `useCsrf` | CSRF token | API | Forms |
| `useTextToSpeech` | TTS Chatterbox + Web Speech | Audio | Product pages |
| `useAdminShortcuts` | Keyboard shortcuts + command palette | Memory | Admin layout |
| `useUpsell` | Upsell modal trigger | Context | Product, compare, account/products |
| `useCurrency` | Currency conversion | Context | Shop, product, checkout, compare |
| `useI18n` | Translations | Context | 35+ client pages |
| `useVoip` | WebRTC softphone (JsSIP) | Memory+WSS | SoftphoneProvider |
| `useCallState` | Real-time call stats | SWR API poll | VoipDashboardClient, AnalyticsClient |
| `useDiscountCode` | Promo/gift code validation | API | Checkout |
| `useCartShare` | Cart sharing (generate/resolve JWT link) | API | CartDrawer, /checkout |
| `useBridgeData` | Cross-module bridge fetch + feature-flag gate | API | commandes, deals, avis, promo-codes, videos, ecritures, call-logs |

---

## 11. CONTEXT PROVIDERS

| Provider | Location | Required By (count) |
|----------|----------|-------------------|
| `I18nProvider` | `@/i18n/client` | 35+ client pages (nearly all) |
| `SessionProvider` | `next-auth/react` | 12+ pages (all account, community, webinars, subscriptions, ambassador, rewards) |
| `CartProvider` | `@/contexts/CartContext` | 6 pages (product, compare, checkout, bundles/[slug], account/orders, account/products) |
| `CurrencyProvider` | `@/contexts/CurrencyContext` | 7+ pages (shop, product, search, compare, checkout, subscriptions, gift-cards, account, account/wishlist) |
| `UpsellProvider` | `@/contexts/UpsellContext` | 3 pages (product, compare, account/products) |
| `LoyaltyProvider` | `@/contexts/LoyaltyContext` | 1 page (rewards) |
| `SoftphoneProvider` | `@/components/voip/SoftphoneProvider` | All admin pages (WebRTC softphone context) |

---

## 12. PRISMA MODEL RELATIONSHIPS

### Hub Models (highest incoming FK)
| Model | Incoming FK Count | Deletion Impact |
|-------|------------------|-----------------|
| **User** | 38 | CATASTROPHIC -- cascades to 18+ tables (incl. ForumPost, ForumReply, ForumVote, ContactMessage, PlatformConnection, SocialPost), blocks on 3 |
| **Product** | 14 | HIGH -- cascades formats, images, translations, modules, alerts |
| **ChartOfAccount** | 6 | BLOCKS if JournalLines or FixedAssets reference it |
| **Order** | 4 | Cascades OrderItems. SetNull PaymentErrors. |
| **EmailConversation** | 4 | Cascades inbound/outbound/notes/activities |

### Translation Models (16)
ALL follow pattern: `1:N Cascade`, `@@unique([parentId, locale])`, `translatedBy @default("gpt-4o-mini")`
- Article, BlogPost, Category, ConsentFormTranslation, Faq, Guide, HeroSlide, NewsArticle, Page, Product, ProductFormat, QuickReply, Testimonial, Video, VideoCategoryTranslation, Webinar

### Community Forum Models (4) - NEW 2026-02-25
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `ForumCategory` | id, name, slug, description, icon, color, sortOrder, isActive | ForumPost[] | Forum discussion categories, unique slug |
| `ForumPost` | id, title, content, isPinned, isLocked, viewCount, deletedAt | author(User), category(ForumCategory), replies(ForumReply[]), votes(ForumVote[]) | Soft-delete via deletedAt, pinned/locked flags |
| `ForumReply` | id, content, parentReplyId, deletedAt | author(User), post(ForumPost), parentReply(self-ref), childReplies[] | Nested replies, soft-delete |
| `ForumVote` | id, type(UP/DOWN), targetType(POST/REPLY), targetId | user(User), post(ForumPost?) | @@unique([userId, targetType, targetId]) |

### Contact Model (1) - NEW 2026-02-25
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `ContactMessage` | id, name, email, subject, message, status, userId?, readAt, archivedAt | user(User?) | Persisted contact form messages, optional user FK |

### Content Hub / Mediatheque Models (8) - NEW 2026-02-27
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `VideoCategory` | id, slug, sortOrder, isActive, createdAt, updatedAt | translations(VideoCategoryTranslation[]), videos(Video[]) | Hierarchical video categories, unique slug |
| `VideoCategoryTranslation` | id, videoCategoryId, locale, name, description | videoCategory(VideoCategory) | @@unique([videoCategoryId, locale]) |
| `VideoPlacement` | id, videoId, placement, position, isActive, startDate?, endDate? | video(Video) | Where a video appears (homepage, product page, etc.) |
| `VideoProductLink` | id, videoId, productId, sortOrder | video(Video), product(Product) | @@unique([videoId, productId]), links videos to products |
| `VideoTag` | id, videoId, tag | video(Video) | @@unique([videoId, tag]), tagging system for videos |
| `SiteConsent` | id, type, status, signerName, signerEmail, signedAt?, token, videoId?, templateId?, pdfUrl?, metadata? | video(Video?), template(ConsentFormTemplate?) | Consent records (image/video rights), token-based signing |
| `ConsentFormTemplate` | id, slug, isActive, createdAt, updatedAt | translations(ConsentFormTranslation[]), consents(SiteConsent[]) | Reusable consent form templates, unique slug |
| `ConsentFormTranslation` | id, templateId, locale, title, content, fields? | template(ConsentFormTemplate) | @@unique([templateId, locale]) |

### Platform Integrations Models (2) - NEW 2026-02-28
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `PlatformConnection` | id, platform, accessToken, refreshToken, tokenExpiresAt, accountId, isEnabled, autoImport, defaultCategoryId, webhookSecret, createdAt, updatedAt | connectedBy(User), defaultCategory(VideoCategory?), recordingImports(RecordingImport[]) | OAuth tokens AES-256-GCM encrypted, unique platform |
| `RecordingImport` | id, connectionId, externalId, meetingId, meetingTitle, status, blobUrl, fileSize, createdAt, updatedAt | connection(PlatformConnection), video(Video?) | Import lifecycle: PENDING -> DOWNLOADING -> PROCESSING -> COMPLETED/FAILED |

### Social Media & Ads Models (2) - NEW 2026-02-28
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `SocialPost` | id, platform, content, imageUrl, scheduledAt, publishedAt, status, error, externalId, externalUrl | createdBy(User) | Social media post scheduling and publishing |
| `AdCampaignSnapshot` | id, platform, campaignId, campaignName, date, impressions, clicks, spend, conversions, currency, rawData | - (orphan) | Daily snapshot of ad campaign metrics from 6 platforms |

### Updated Models (2026-02-28)
| Model | Change | Details |
|-------|--------|---------|
| `Video` | Extended | Added `recordingImport` relation to RecordingImport, `platformMeetingId` field, enhanced YouTube publish modal |
| `User` | New relation | Added `socialPosts(SocialPost[])` relation |

### VoIP / Telephony Models (8) + Enums (4) - NEW 2026-03-01
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `VoipConnection` | id, provider(unique), isEnabled, apiKey?, apiSecret?, accountSid?, pbxHost?, pbxPort?, eslPassword?, lastSyncAt?, syncStatus?, syncError? | configuredBy(User?), phoneNumbers[], callLogs[] | Credentials AES-256-GCM encrypted |
| `PhoneNumber` | id, connectionId, number(unique), displayName?, country, type(PhoneNumberType), routeToIvr?, routeToQueue?, routeToExt?, isActive, monthlyCost? | connection(VoipConnection), callLogs[] | E.164 format, DID management |
| `SipExtension` | id, userId, extension(unique), sipUsername, sipPassword, sipDomain, isRegistered, lastSeenAt?, status(AgentStatus), fusionExtId?, fusionDomainId? | user(User), callsAsAgent[], voicemails[] | SIP creds encrypted |
| `CallLog` | id, pbxUuid?(unique), connectionId?, callerNumber, callerName?, calledNumber, direction(CallDirection), phoneNumberId?, agentId?, queue?, ivr?, startedAt, answeredAt?, endedAt?, duration?, billableSec?, waitTime?, status(CallStatus), hangupCause?, clientId?, companyId?, agentNotes?, disposition?, tags[] | connection?, phoneNumber?, agent(SipExtension), client(User?), company(Company?), recording?, survey?, transcription? | Central CDR table |
| `CallRecording` | id, callLogId(unique), blobUrl?, localPath?, fileSize?, format, durationSec?, isUploaded, isTranscribed, consentObtained, consentMethod? | callLog(CallLog), transcription? | Azure Blob storage |
| `CallTranscription` | id, callLogId(unique), recordingId?(unique), fullText, summary?, actionItems?, sentiment?, sentimentScore?, keywords[], language, engine, model?, confidence? | callLog(CallLog), recording?(CallRecording) | Whisper + GPT-4o-mini analysis |
| `CallSurvey` | id, callLogId(unique), overallScore?, resolvedScore?, method, completedAt? | callLog(CallLog) | Post-call DTMF survey |
| `Voicemail` | id, extensionId, callerNumber, callerName?, blobUrl?, localPath?, durationSec?, transcription?, isRead, isArchived, clientId? | extension(SipExtension), client(User?) | Voicemail inbox |

**Enums**: `PhoneNumberType` (LOCAL/TOLL_FREE/MOBILE), `CallDirection` (INBOUND/OUTBOUND/INTERNAL), `CallStatus` (RINGING/IN_PROGRESS/COMPLETED/MISSED/VOICEMAIL/FAILED/TRANSFERRED), `AgentStatus` (ONLINE/BUSY/DND/AWAY/OFFLINE)

### Audit Session Models (3) - NEW 2026-03-04
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `OrderEvent` | id, orderId, type, description, metadata?, actorId?, actorType, createdAt | order(Order), actor(User?) | Immutable audit trail for order lifecycle events (status change, note, refund, split, etc.) |
| `ApprovalRequest` | id, entityType, entityId, requestedBy, assignedTo?, status, reason?, resolvedAt?, createdAt | requester(User), assignee(User?) | Workflow approval requests for orders/returns/refunds pending manager sign-off |
| `WorkflowRule` | id, name, trigger, conditions(Json), actions(Json), isActive, priority, createdAt, updatedAt | - | Configurable automation rules (e.g. auto-approve orders < $X, escalate returns) |

### CRM Enterprise Models (9) + Enums (4) - NEW Phase 3 2026-03-04
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `CrmSnippet` | id, title, body, category?, shortcut?, createdBy?, createdAt, updatedAt | createdBy(User?) | Canned response snippets for agents; shortcut = slash-command trigger |
| `CrmQuote` | id, dealId, title, status(CrmQuoteStatus), validUntil?, totalAmount, currency, notes?, pdfUrl?, approvedAt?, approvedBy?, createdAt, updatedAt | deal(CrmDeal), items(CrmQuoteItem[]), approvedByUser(User?) | CPQ quotes linked to a deal; PDF generated via quote-pdf.ts |
| `CrmQuoteItem` | id, quoteId, description, quantity, unitPrice, discount?, totalPrice, sortOrder | quote(CrmQuote) | Line items for a quote; discount is per-item percentage |
| `CrmApproval` | id, entityType, entityId, requestedBy, assignedTo?, status(ApprovalStatus), reason?, approvalData?, resolvedAt?, createdAt | requester(User), assignee(User?) | Multi-step approval workflow for quotes, deals, refunds, etc. |
| `ExchangeRate` | id, fromCurrency, toCurrency, rate, source?, syncedAt, createdAt, updatedAt | - | @@unique([fromCurrency, toCurrency]); auto-synced from external FX API |
| `AgentSchedule` | id, agentId, shiftType(AgentShiftType), startTime, endTime, daysOfWeek, isActive, createdAt, updatedAt | agent(User) | Weekly shift schedule per agent; daysOfWeek is array of day integers (0-6) |
| `CrmQaForm` | id, title, description?, sections(Json), isActive, createdAt, updatedAt | scores(CrmQaScore[]) | QA evaluation form template; sections JSON defines criteria and weights |
| `CrmQaScore` | id, formId, agentId, callLogId?, evaluatorId, scores(Json), totalScore, feedback?, createdAt | form(CrmQaForm), agent(User), evaluator(User), callLog(CallLog?) | Individual QA evaluation results; scores JSON maps criterion to score |
| `AgentBreak` | id, agentId, breakType(AgentBreakType), startedAt, endedAt?, durationSec?, notes?, createdAt | agent(User) | Agent break tracking for WFM compliance |

**New Enums**: `CrmQuoteStatus` (DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED), `ApprovalStatus` (PENDING/APPROVED/REJECTED/ESCALATED), `AgentBreakType` (LUNCH/SHORT/TRAINING/PERSONAL/OTHER), `AgentShiftType` (MORNING/AFTERNOON/EVENING/NIGHT/FLEXIBLE)

### CRM Enterprise ULTIMATE Models (10) + Enums (7) - NEW Phase 4 2026-03-04
| Model | Fields | Relations | Notes |
|-------|--------|-----------|-------|
| `PriceBook` | id, name, type(PriceBookType), currency, isActive, validFrom?, validUntil?, createdAt, updatedAt | entries(PriceBookEntry[]) | Standard/Custom/Promotional price books |
| `PriceBookEntry` | id, priceBookId, productId, unitPrice, minQuantity?, maxQuantity?, createdAt | priceBook(PriceBook) | Product pricing per price book |
| `CrmDealTeam` | id, dealId, userId, role, splitPercentage?, createdAt | deal(CrmDeal), user(User) | Deal team members with commission splits |
| `CrmContract` | id, dealId, title, status(ContractStatus), startDate, endDate?, value?, autoRenew, renewalTermMonths?, terms?, signedAt?, signedBy?, createdAt, updatedAt | deal(CrmDeal), signer(User?) | Contract management with renewals |
| `CrmTicket` | id, title, description?, status(TicketStatus), priority(TicketPriority), category(TicketCategory), assignedToId?, reportedById?, leadId?, resolvedAt?, createdAt, updatedAt | assignedTo(User?), reportedBy(User?), lead(CrmLead?), comments(CrmTicketComment[]) | Full ticket/case management |
| `CrmTicketComment` | id, ticketId, authorId, body, isInternal, createdAt | ticket(CrmTicket), author(User) | Ticket comments (internal/external) |
| `KBArticle` | id, title, slug, body, categoryId?, status(KBArticleStatus), authorId, viewCount, helpfulCount, createdAt, updatedAt | category(KBCategory?), author(User) | Knowledge base articles |
| `KBCategory` | id, name, slug, description?, sortOrder, parentId?, createdAt | parent(KBCategory?), children(KBCategory[]), articles(KBArticle[]) | KB categories (self-referencing) |
| `CrmWorkflowVersion` | id, workflowId, version, definition(Json), createdById, changelog?, createdAt | workflow(CrmWorkflow), createdBy(User) | Workflow version history with rollback |
| `CrmPlaybook` | id, name, description?, pipelineId?, stages(Json), status(PlaybookStatus), createdById, createdAt, updatedAt | pipeline(CrmPipeline?), createdBy(User) | Sales playbooks with stage-based guidance |
| `DataRetentionPolicy` | id, entityType, retentionDays, action, isActive, lastRunAt?, createdAt, updatedAt | - | GDPR data retention auto-purge rules |
| `IpWhitelist` | id, ipAddress, description?, createdById, isActive, createdAt | createdBy(User) | IP whitelist for admin/API access |

**New Enums**: `PriceBookType` (STANDARD/CUSTOM/PROMOTIONAL), `ContractStatus` (DRAFT/ACTIVE/EXPIRED/TERMINATED/RENEWED), `TicketStatus` (OPEN/IN_PROGRESS/WAITING/RESOLVED/CLOSED), `TicketPriority` (LOW/MEDIUM/HIGH/URGENT), `TicketCategory` (BUG/FEATURE_REQUEST/SUPPORT/BILLING/OTHER), `KBArticleStatus` (DRAFT/PUBLISHED/ARCHIVED), `PlaybookStatus` (DRAFT/ACTIVE/ARCHIVED)

**Updated Models (Phase 3)**:
| Model | Change | Details |
|-------|--------|---------|
| `CrmLead` | New fields | Added `qualificationFramework` (BANT/MEDDIC/SPIN/CUSTOM), `qualificationData` (Json) |
| `CrmDeal` | New fields + relation | Added `isRecurring` (Boolean), `recurringInterval` (String?), `mrrValue` (Decimal?), `quotes(CrmQuote[])` relation |

### Updated Models (2026-03-01)
| Model | Change | Details |
|-------|--------|---------|
| `User` | New relations | Added `voipConnections`, `sipExtensions`, `clientCalls`, `clientVoicemails` relations |
| `Company` | New relation | Added `companyCalls` relation |

### Updated Models (2026-02-27)
| Model | Change | Details |
|-------|--------|---------|
| `Video` | Extended | Added `categoryId` FK to VideoCategory, `placements`, `productLinks`, `tags`, `consents` relations |
| `Product` | New relation | Added `videoLinks(VideoProductLink[])` relation for video associations |

### Updated Models (2026-02-25)
| Model | Change | Details |
|-------|--------|---------|
| `BankTransaction` | Added FK | `matchedEntryId` now real FK to JournalEntry (was soft reference), onDelete: SetNull |
| `ChartOfAccount` | Type change | `ccaRate` changed from Float? to Decimal? @db.Decimal(5,4) for tax precision |
| `FixedAsset` | Type change | `ccaRate` changed from Float to Decimal @db.Decimal(5,4) for tax precision |
| `Media` | New fields | Added `width Int?` and `height Int?` for image dimensions |
| `User` | New relations | Added `forumPosts`, `forumReplies`, `forumVotes`, `contactMessages` relations |

### Orphan Models (36 -- no Prisma @relation)
**Critical orphans** (should probably have FK):
- `InventoryReservation` (soft: productId, formatId, orderId, cartId)
- `InventoryTransaction` (soft: productId, formatId, orderId)
- `Subscription` (soft: userId, productId, formatId)
- `Refund` (soft: orderId, returnRequestId)
- `Discount` (soft: categoryId, productId)
- `SupplierInvoice` (soft: supplierId, journalEntryId)
- `WebhookEvent` (soft: orderId, journalEntryId)
- `UserPermissionOverride` (soft: userId, permissionCode)

**Intentional orphans** (singletons/logs/polymorphic):
- AdCampaignSnapshot (daily snapshot metrics, no FK needed)
- AccountingSettings, ChatSettings, SiteSettings, SiteSetting
- AuditLog, AuditTrail, SearchLog (polymorphic entityType/entityId)
- DocumentAttachment (polymorphic)
- EmailAutomationFlow, EmailCampaign, EmailLog, EmailTemplate, CannedResponse, EmailSettings, EmailSegment, EmailFlowExecution
- FiscalCalendarEvent, FiscalYear, AccountingPeriod, AccountingAlert
- Media, NewsletterSubscriber, PaymentMethodConfig, RecurringEntryTemplate
- ShippingZone, TranslationFeedback, TranslationJob, VerificationToken, Wishlist, ClientReference

---

## 13. LIB SERVICES

### Root `/src/lib/` (192 files total)
| Category | Files | Used By |
|----------|-------|---------|
| **Auth** | auth-config, mfa, brute-force-protection, csrf, session-security, webauthn, password-history | Auth pages, middleware, API guards |
| **DB** | db.ts (Prisma singleton), redis.ts | ALL server code |
| **Cache** | cache.ts (Redis + in-memory fallback) | API routes |
| **Payments** | stripe.ts (LAZY INIT!), paypal.ts | Payment routes, webhooks |
| **API Guards** | api-handler, api-response, api-errors, admin-api-guard, user-api-guard | ALL API routes |
| **Logging** | logger (Winston), apm, metrics, analytics | System-wide |
| **Files** | file-validation, image-optimizer, storage (Azure Blob) | Media upload |
| **Security** | token-encryption, azure-keyvault, sanitize, rate-limiter | Auth, API |
| **Tax** | tax-rates, canadianTaxes, countryObligations, financial | Checkout, accounting |
| **Validation** | 13 Zod schemas in `/validations/` | API routes |
| **Audit** | admin-audit.ts (logAdminAction, getClientIpFromRequest), audit-engine.ts (getAuditDashboard) | Admin API routes, audit pages |
| **Inventory** | inventory.ts (adjustStock) | Inventory API routes |
| **Order** | order-status-machine.ts (valid transition validator), order-events.ts (OrderEvent recording) | Order API routes, admin order management |
| **Cache** | cache.ts (Redis + in-memory TTL fallback) | API routes requiring caching |
| **Loyalty** | loyalty/referral-milestones.ts (milestone-based referral bonus logic) | /api/cron/birthday-bonus, referral routes |

### `/src/lib/accounting/` (34 files)
auto-entries, stripe-sync, reconciliation, pdf-reports, alerts, aging, recurring-entries, bank-import, ml-reconciliation, forecasting, audit-trail, tax-compliance, currency, integrations (QuickBooks/Sage), quick-entry, ocr, search, alert-rules, auto-reconciliation, scheduler, kpi, payment-matching, report-templates, **ai-accountant.service** (rule-based NLP chat, 18 intents, bilingual, session management)

### `/src/lib/email/` (14 files)
email-service (multi-provider: Resend/SendGrid/SMTP), templates (base, order, marketing), order-lifecycle, automation-engine, bounce-handler, inbound-handler, unsubscribe, tracking (HMAC pixel/link injection), ab-test-engine (Z-test statistical significance), meeting-invitation

### `/src/lib/platform/` (7 files) - NEW 2026-02-28
| File | Purpose | Used By |
|------|---------|---------|
| `crypto.ts` | AES-256-GCM token encryption/decryption | platform-connections API routes |
| `oauth.ts` | Unified OAuth manager (Zoom, Teams, Meet, Webex, YouTube) | platform-connections OAuth/callback routes |
| `recording-import.ts` | Recording import service (fetch, download, create Video, auto-link VideoSession) | recording-imports API routes, video-sessions |
| `webhook-handlers.ts` | Webhook validation & handlers (Zoom, Teams, Webex) | /api/webhooks/zoom, teams, webex |
| `youtube-publish.ts` | YouTube resumable upload service | /api/admin/videos/[id]/publish-youtube |
| `meeting-creation.ts` | Unified meeting creation service (Zoom, Teams, Google Meet, Webex) | /api/admin/meetings/create |

### `/src/lib/social/` (2 files) - NEW 2026-02-28
| File | Purpose | Used By |
|------|---------|---------|
| `social-publisher.ts` | Social media publishing service (Meta, X, TikTok, LinkedIn) | /api/admin/social-posts/[id]/publish, cron |
| `social-scheduler-cron.ts` | Cron processor for scheduled social posts | /api/admin/social-posts/cron |

### `/src/lib/ads/` (1 file) - NEW 2026-02-28
| File | Purpose | Used By |
|------|---------|---------|
| `ads-sync.ts` | Ads sync service for 6 platforms (Google, YouTube, Meta, TikTok, X, LinkedIn) | /api/admin/ads/sync, /api/admin/ads/cron |

### `/src/lib/voip/` (34 files) - EXPANDED 2026-03-04 (Softphone BEST-IN-CLASS)
| File | Purpose | Used By |
|------|---------|---------|
| `connection.ts` | VoIP provider CRUD with encrypted credentials (Telnyx, VoIP.ms, FusionPBX) | /api/admin/voip/connections |
| `cdr-sync.ts` | CDR ingestion from FreeSWITCH mod_json_cdr, caller-client matching | /api/admin/voip/cdr/ingest |
| `recording-upload.ts` | Upload recordings PBX → Azure Blob, processing queue | /api/admin/voip/recordings/[id] |
| `esl-client.ts` | FreeSWITCH ESL client (lazy singleton, esl-lite), originate/hangup/transfer/hold | Softphone actions |
| `transcription.ts` | Whisper transcription + GPT-4o-mini analysis (sentiment, summary, keywords, video) | Post-call processing |
| `call-control.ts` | Central event router, state machine, Telnyx webhook handler | All VoIP webhooks |
| `voip-state.ts` | Redis-backed VoipStateMap with in-memory fallback, 24h TTL | All VoIP modules |
| `recording.ts` | Dual-channel recording (caller L / agent R) + pause/resume (PCI) | Call recording |
| `power-dialer.ts` | Auto-dial, AMD detection, DNCL, wrap-up timers | Dialer campaigns |
| `queue-engine.ts` | 5 strategies (RING_ALL, ROUND_ROBIN, HUNT, RANDOM, LEAST_RECENT) | ACD routing |
| `ivr-engine.ts` | IVR menus, DTMF navigation, time-based routing | Inbound call routing |
| `voicemail-engine.ts` | VM recording, greeting, CRM linking, Whisper transcription | Voicemail system |
| `transfer-engine.ts` | Blind/attended transfer, conference, video rooms (Telnyx Video API) | Softphone |
| `coaching-engine.ts` | Listen/whisper/barge supervisor coaching | CtiToolbar |
| `call-quality-monitor.ts` | getStats() polling, MOS/R-Factor (ITU-T G.107), quality alerts | Softphone quality bars |
| `pre-call-test.ts` | STUN/TURN test, RTT/jitter/packet-loss measurement | Pre-call diagnostics |
| `krisp-noise-cancel.ts` | AI noise cancellation via Krisp WASM SDK, WebAudio pipeline | Softphone audio |
| `call-flip.ts` | Transfer active call to another device (mobile/desk phone) | Softphone |
| `call-park.ts` | Park slot system (orbit 701-720), park/retrieve via DTMF/UI | Softphone |
| `call-pickup.ts` | Directed pickup (*8+ext) + group pickup (*9) | Softphone |
| `dnd-manager.ts` | DND modes, schedule, whitelist exceptions | Presence system |
| `multi-line.ts` | Multi-line support (2-6 simultaneous calls), line switching | Softphone |
| `call-forwarding.ts` | Rules: unconditional, busy, no-answer, unavailable + schedule | Call routing |
| `e911.ts` | E911 emergency calling via Telnyx, location registration | Emergency routing |
| `presence-manager.ts` | 6 presence states, auto-detect from call, custom message, schedule | Softphone, CtiToolbar |
| `screen-share.ts` | Screen sharing via getDisplayMedia() + peer connection | Softphone video |
| `virtual-background.ts` | MediaPipe Selfie Segmentation + canvas composite | Softphone video |
| `video-recording.ts` | MediaRecorder API for video, upload Azure Blob | Video calls |
| `incoming-notification.ts` | Browser Notification API + custom ringtone Audio API | Incoming calls |
| `ringtone-manager.ts` | 5 ringtone presets + custom upload, Web Audio API synthesis | Incoming calls |
| `cnam-lookup.ts` | CNAM DB lookup + spam score via Telnyx Number Lookup | Caller ID |
| `ring-groups.ts` | Dedicated ring groups (simultaneous/sequential/round-robin) | Inbound routing |
| `simultaneous-ring.ts` | Ring WebRTC + SIP extension + mobile simultaneously | Multi-device ring |
| `vad-analytics.ts` | Voice Activity Detection, talk-time ratio, silence detection | Call analytics |

### `/src/lib/crm/` (21 files) - NEW Phase 3 2026-03-04
| File | Purpose | Used By |
|------|---------|---------|
| `exchange-rates.ts` | Currency conversion engine + external FX API sync (ECB, Open Exchange Rates) | /api/admin/crm/exchange-rates, /api/admin/crm/exchange-rates/sync |
| `quote-pdf.ts` | PDF generation for CRM quotes using PDFKit/pdfmake | /api/admin/crm/quotes/[id] |
| `predictive-dialer.ts` | Adaptive dial ratio calculation + lead scoring-based selection | /api/admin/crm/dialer |
| `voicemail-drop.ts` | Pre-recorded voicemail drop service (Telnyx) | VoIP dialer campaign actions |
| `call-blending.ts` | Inbound/outbound call blending with queue balancing | SoftphoneProvider, dialer |
| `local-presence.ts` | Local caller ID matching by area code (DID pool lookup) | /api/admin/crm/dialer/action |
| `recording-consent.ts` | PCI-DSS consent announcement before recording starts | VoIP recording pipeline |
| `whatsapp.ts` | WhatsApp Business API integration (send messages, templates, media) | /api/webhooks/whatsapp, social-inbox |
| `email-sync.ts` | Bidirectional IMAP email sync (fetch, parse, thread, store) | /api/webhooks/email-inbound, shared-inbox |
| `social-inbox.ts` | Facebook/Instagram Messenger unified inbox (webhook events, replies) | /api/webhooks/meta |
| `shared-inbox.ts` | Team shared mailbox routing (assignment, SLA, escalation) | /admin/crm/inbox |
| `chatbot-engine.ts` | AI chatbot with OpenAI function-calling (FAQ, lead capture, handoff) | /api/public/chatbot |
| `ai-forecasting.ts` | ML-based revenue forecasting (linear regression + seasonality on CrmDeal data) | /admin/crm/recurring-revenue |
| `realtime-sentiment.ts` | Real-time call sentiment analysis (streaming transcript → GPT-4o-mini scoring) | VoIP transcription pipeline |
| `ai-coaching.ts` | AI coaching suggestions for agents (next best action, script adherence) | /admin/crm/qa |
| `best-time-to-send.ts` | Optimal send-time analysis per contact (email/SMS open-rate history) | CRM campaign scheduler |
| `push-notifications.ts` | Web Push API integration (VAPID keys, subscription management, send) | Admin PWA notifications |
| `attribution.ts` | Multi-touch attribution engine (first-touch, last-touch, linear, time-decay, data-driven) | /api/admin/crm/attribution |
| `ab-testing.ts` | A/B testing framework for CRM campaigns (variant assignment, significance testing) | CRM email/SMS campaigns |
| `mms.ts` | MMS media messaging service (Telnyx MMS, media upload, send) | CRM outbound campaigns |
| `payment-ivr.ts` | PCI DSS compliant payment over phone via DTMF IVR (tokenized, no card data in logs) | /api/admin/voip/*, FreeSWITCH |

### `/src/lib/crm/` (37 new files) - Phase 4 2026-03-04
| File | Purpose | Used By |
|------|---------|---------|
| `dialer-modes.ts` | Progressive dialer mode with agent-controlled pacing | Dialer page |
| `agentless-dialer.ts` | Outbound IVR without live agent (press-1 connect) | Campaign automation |
| `skills-routing.ts` | Skills-based call routing with proficiency matching | ACD engine |
| `acd-engine.ts` | Automatic Call Distribution with priority + overflow + longest-idle | Queue engine |
| `streaming-transcription.ts` | Real-time transcription via Telnyx streaming WebSocket | Softphone, AI coaching |
| `conference-call.ts` | Multi-party conference calling via Telnyx | Call supervision |
| `virtual-hold.ts` | Estimated wait time calculation + virtual hold callback | Queue engine |
| `post-call-survey.ts` | IVR DTMF + SMS post-call CSAT surveys | Campaign post-call |
| `lead-recycling.ts` | Disposition-based lead recycling rules engine | Campaign lists |
| `whisper-preconnect.ts` | Audio whisper message to agent before call connect | Predictive dialer |
| `disposition-triggers.ts` | Auto-actions on call disposition (SMS, email, task, DNC) | Softphone, dialer |
| `sms-link-tracking.ts` | Short URL generation + click tracking for SMS | SMS campaigns |
| `sms-keyword-responder.ts` | Auto-reply on SMS keywords (HELP, INFO, etc.) | SMS inbound webhook |
| `sms-surveys.ts` | SMS-based surveys and polls with response tracking | SMS campaigns |
| `sms-drip-sequence.ts` | Dedicated SMS drip sequence builder + executor | SMS marketing |
| `channel-switching.ts` | Seamless conversation handoff across email/chat/phone | Inbox routing |
| `knowledge-base.ts` | KB article CRUD with search + categorization | KB page, customer portal |
| `workflow-code-sandbox.ts` | Sandboxed JavaScript execution in workflows (Node vm) | Workflow engine |
| `workflow-templates.ts` | 8 pre-built installable workflow templates | Workflow builder |
| `conversation-intelligence.ts` | Gong-like analysis: topics, objections, talk ratio, keywords | AI analytics |
| `anomaly-detection.ts` | Z-score based anomaly detection for pipeline + agent metrics | AI dashboards |
| `generative-ai.ts` | Gen AI for proposals, scripts, reports, summaries | CRM content creation |
| `realtime-adherence.ts` | Real-time schedule adherence tracking vs planned shifts | WFM adherence page |
| `volume-forecasting.ts` | ML volume prediction with Erlang-C staffing calculation | WFM planning |
| `intraday-management.ts` | Intraday staffing adjustments based on real-time volume | WFM management |
| `e-signature.ts` | DocuSign API integration for quote/contract signing | Quotes, contracts |
| `sales-playbooks.ts` | Stage-based selling guidance with best practices | Playbooks page |
| `field-security.ts` | Field-level permissions per role/user for CRM fields | CRM data access |
| `data-retention.ts` | GDPR auto-purge with configurable retention policies + cron | Data compliance |
| `calendar-sync.ts` | Google Calendar + Outlook bidirectional sync | CRM activities |
| `calendly-integration.ts` | Calendly webhook + embed integration for scheduling | Meeting booking |
| `email-ab-testing.ts` | Email A/B split testing with Z-test significance | Email campaigns |
| `email-health.ts` | Deliverability monitoring (bounce rate, spam score) | Email marketing |
| `email-signature-manager.ts` | Centralized team email signature management | Email settings |
| `tcpa-manual-touch.ts` | TCPA 1-to-1 manual touch mode for cell phones | Dialer compliance |
| `clv-calculator.ts` | Customer Lifetime Value calculation (historical + predictive) | CLV dashboard |
| `churn-analysis.ts` | Churn rate analysis + prediction with risk scoring | Churn dashboard |

### `/src/lib/crm/` LeadEngine files (7 new) - 2026-03-07
| File | Purpose | Used By |
|------|---------|---------|
| `google-maps-scraper.ts` | Google Places API scraper (Text Search + Details + Nearby fallback, pagination, rate limiter, website email crawl) | /api/admin/crm/lists/[id]/scrape |
| `enrichment-pipeline.ts` | 4-level waterfall enrichment: website crawl → Hunter.io → pattern+MX → Apollo.io | /api/admin/crm/lists/[id]/enrich |
| `lead-scoring.ts` | 7-factor scoring (0-100), temperature auto-assign (HOT/WARM/COLD), BANT generation, list scoring + auto-qualify | /api/admin/crm/lists/[id]/score, /integrate |
| `lead-assignment.ts` | 5 assignment strategies: Manual, Round Robin, Load Balanced, Score Based, Territory | /api/admin/crm/lists/[id]/integrate |
| `prospect-dedup.ts` | Cross-list dedup (phone+email+domain+GPS proximity), transitive merge, counter sync | /api/admin/crm/lists/[id]/deduplicate, /integrate |
| `campaign-bridge.ts` | 1-click Prospect→CrmLead→DialerCampaign→DialerListEntry bridge, DNC filtering, call outcome recording | /api/admin/crm/lists/[id]/start-campaign |
| `phone-utils.ts` | Phone normalization (E.164), DNC variant generation for lookup | /integrate, /start-campaign, /deduplicate |

### `/src/lib/crm/` modified files - Phase 4 2026-03-04
| File | Changes | Impact |
|------|---------|--------|
| `predictive-dialer.ts` | +vertical dialing, +campaign pacing slider, +list penetration mode | Dialer campaigns |
| `call-supervision.ts` | +supervisor takeover mode (full call transfer) | Call monitoring |
| `recording.ts` | +dual-channel recording via Telnyx media forking | Call recording |
| `workflow-engine.ts` | +parallel execution paths, +loop/iteration, +try/catch error handling, +cross-object automation | All workflows |
| `realtime-sentiment.ts` | +streaming sentiment analysis during live calls | Softphone, AI |
| `contact-enrichment.ts` | +web scraping enrichment from company websites | Lead enrichment |
| `email-sync.ts` | +auto-create lead from unknown inbound emails | Inbox routing |
| `ai-assistant.ts` | +conversation summaries for all channels (not just calls) | Inbox, AI |

### `/src/lib/admin/` (6 files)
admin-fetch, admin-layout-context, icon-resolver, outlook-nav, ribbon-config, section-themes

---

## 14. INFRASTRUCTURE

### Middleware Permissions
| Route Pattern | Required Permission |
|---------------|-------------------|
| `/admin/produits` | `products.view` |
| `/admin/commandes` | `orders.view` |
| `/admin/comptabilite` | `accounting.view` |
| `/admin/permissions` | `users.manage_permissions` |
| OWNER role | Bypasses ALL checks |

### Environment (120+ vars)
DATABASE_URL, NEXTAUTH_*, OAuth (Google/Apple/Azure), STRIPE_*, PAYPAL_*, EMAIL_PROVIDER, REDIS_URL, OPENAI_API_KEY, ENCRYPTION_KEY, Business info, Tax numbers (TPS/TVQ/NEQ)

### PWA (Phase 3 updated)
`public/manifest.json` (PWA manifest - name, icons, theme_color, start_url, display: standalone), `public/sw.js` (service worker - cache-first for assets, network-first for API, offline fallback), `offline.html`, icons

### Tests (10 files)
`src/__tests__/`: tax-calculations, products, form-validation, quick-entry, auth, checkout, products-api, webhook, health

---

## 15. KNOWN GAPS & STATUS LEGEND

### Status Legend
- **COMPLETE**: Fully functional with backend integration
- **PARTIAL**: UI done, backend partially connected
- **MOCKUP**: UI done, data in useState only (NO backend)
- **STUB**: Placeholder page (title + description only)

### Known Gaps (Priority Order)
1. ~~**CASL Mailing**~~ -- FIXED 2026-02-21: Double opt-in, audit logging, rate limiting, CASL language, i18n
2. ~~**Navigator Security**~~ -- FIXED 2026-02-21: Sandbox hardened, HTTPS-only validation, schema protection
3. ~~**Media APIs (Zoom/WhatsApp/Teams)**~~ -- FIXED 2026-02-21: Config dashboards, services, API routes, IntegrationCard
4. ~~**Audit Logging Coverage**~~ -- FIXED 2026-02-24 (S10-06): 100% admin API audit logging with `logAdminAction()`
5. ~~**Skeleton Loading**~~ -- FIXED 2026-02-24 (S11): 119 loading.tsx files across all admin pages
6. ~~**Media Section Ads/Social**~~ -- FIXED 2026-02-28: 6 ads platform dashboards (AdsPlatformDashboard component) + social scheduler with real API. Only 2 STUB pages remain (media dashboard + library)
7. ~~**Community Forum**~~ -- FIXED 2026-02-25: 5 Prisma models (ForumCategory, ForumPost, ForumReply, ForumVote, ContactMessage) + 7 API routes, /community page now uses real API
8. **About Section** -- 6 STUB pages
9. ~~**Checkout Payment**~~ -- FIXED 2026-03-04 (Mega-Audit v2): 3D Secure enforcement, cart quantity limits, cart persistence
10. **35 Orphan Models** -- Many should have proper FK constraints (InventoryReservation, Subscription, Refund, etc.)
11. **UserPermissionGroup** -- Has userId but NO @relation to User (broken permission chain)
12. **Payroll** -- Stub API route with in-memory data, no Prisma model yet
13. ~~**Ambassador Dashboard**~~ -- FIXED 2026-03-04 (Mega-Audit v2 E1): isAmbassador now checks real status via API
14. ~~**Analytics Dashboard Fake Data**~~ -- FIXED 2026-03-04 (Mega-Audit v2 E2): Real KPIs from Order/User/EmailLog
15. ~~**OAuth MFA Bypass**~~ -- FIXED 2026-03-04 (Mega-Audit v2 E4): OAuth users with MFA redirect to /auth/mfa-verify
16. ~~**CSP unsafe-inline**~~ -- FIXED 2026-03-04 (Mega-Audit v2 F2): strict-dynamic in production
17. ~~**decryptToken plaintext fallback**~~ -- FIXED 2026-03-04 (Mega-Audit v2 F6): enc: prefix migration
18. ~~**Tax 3 implementations**~~ -- FIXED 2026-03-04 (Mega-Audit v2 F1): Single canadian-tax-engine.ts
19. ~~**Blog comments orphan**~~ -- FIXED 2026-03-04: BlogComments component + frontend integration
20. ~~**Inventory reconciliation missing**~~ -- FIXED 2026-03-04: GET/POST /api/admin/inventory/reconciliation
21. ~~**ApprovalRequest/WorkflowRule models**~~ -- FIXED 2026-03-04: Added to Prisma schema + restored routes
22. **TS errors**: 167 → **2** (non-blocking: .next/ cache + seed script only)
29. ~~**Cross-Module Bridges #33/#44**~~ -- DONE 2026-03-05: `EmailLog.campaignId` FK added, both API routes + frontend done
23. ~~**Customer health score**~~ -- DONE 2026-03-04: /api/admin/customers/[id]/health + segments + at-risk
24. ~~**Order PDF/invoice**~~ -- DONE 2026-03-04: /api/admin/orders/[id]/pdf + /api/account/orders/[id]/receipt
25. ~~**Order audit trail**~~ -- DONE 2026-03-04: OrderEvent model + /api/admin/orders/[id]/timeline
26. ~~**Cart sharing**~~ -- DONE 2026-03-04: CartShareButton + SharedCartBanner + /api/cart/shared/[code]
27. ~~**Blog comments**~~ -- DONE 2026-03-04: BlogComments component + /api/blog/[slug]/comments
28. ~~**Churn alerts cron**~~ -- DONE 2026-03-04: /api/cron/churn-alerts

### New Files (2026-02-21 Session)
- `src/lib/integrations/zoom.ts` -- Zoom S2S OAuth, meetings, connection test
- `src/lib/integrations/whatsapp.ts` -- WhatsApp Cloud API, templates, messaging
- `src/lib/integrations/teams.ts` -- Teams Webhooks + Graph API, order notifications
- `src/app/api/admin/integrations/{zoom,whatsapp,teams}/route.ts` -- Config CRUD + test
- `src/components/admin/IntegrationCard.tsx` -- Reusable config card with toggle, test, webhook copy
- `.claude/rules/project-map-mandatory.md` -- Enforcement rule for keeping this file updated

### New Files (2026-02-24 Session - S10/S11/S12)

#### S10-06: Audit Logging (100% coverage)
- `src/lib/admin-audit.ts` -- `logAdminAction()` utility, `getClientIpFromRequest()` helper
- `src/lib/audit-engine.ts` -- `getAuditDashboard()` for audit pages
- `src/app/api/admin/audits/route.ts` -- GET audit dashboard
- `src/app/admin/audits/page.tsx` -- Audit dashboard page
- `src/app/admin/audits/[type]/page.tsx` -- Audit detail by type
- `src/app/admin/audits/catalog/page.tsx` -- Audit catalog page
- `src/lib/backup-storage.ts` -- Azure Blob + local backup listing, health computation
- `src/app/api/admin/backups/route.ts` -- GET real backup status from Azure Blob Storage
- `src/app/admin/backups/page.tsx` -- Multi-project backup dashboard
- `src/app/api/admin/video-sessions/route.ts` -- POST create + GET list video sessions
- `src/app/api/admin/video-sessions/[id]/route.ts` -- GET detail + PUT update video session
- `src/app/admin/media/sessions/page.tsx` -- Video sessions admin page (table, filters, create modal)
- All admin API routes now call `logAdminAction()` for CREATE/UPDATE/DELETE operations

#### S11: Skeleton Loading (100% coverage)
- 119 `loading.tsx` files added across all admin pages
- Every admin route now has a skeleton loading state with consistent Outlook-style layout
- Covers: dashboard, comptabilite (28 pages), commerce, catalog, marketing, media, content, business, fiscal, other admin

#### S12: Keyboard Shortcuts + Command Palette
- `src/hooks/useAdminShortcuts.ts` -- Global keyboard shortcut handler for admin
- `src/components/admin/AdminCommandPalette.tsx` -- Cmd+K command palette (search, navigation, actions)
- `src/components/admin/KeyboardShortcutsDialog.tsx` -- ?-key shortcut reference dialog

#### New API Routes
- `PATCH /api/admin/inventory/[id]/route.ts` -- Update stock quantity for a specific ProductFormat
- `GET /api/admin/inventory/history/route.ts` -- Inventory history log
- `POST /api/admin/inventory/import/route.ts` -- Bulk inventory import
- `GET /api/admin/inventory/export/route.ts` -- Inventory data export
- `GET/POST /api/accounting/payroll/route.ts` -- Payroll stub (in-memory, no Prisma model)

### New Files (2026-02-25 Session - Community Forum Backend)

#### Community Forum API Routes (7 files)
- `src/app/api/community/categories/route.ts` -- GET forum categories with post counts
- `src/app/api/community/posts/route.ts` -- GET (paginated, filterable) + POST forum posts
- `src/app/api/community/posts/[id]/route.ts` -- GET single post with replies, DELETE (owner/admin)
- `src/app/api/community/posts/[id]/replies/route.ts` -- GET + POST replies (nested support)
- `src/app/api/community/posts/[id]/vote/route.ts` -- POST upvote/downvote (unique per user)
- `src/app/api/community/seed/route.ts` -- POST seed default forum categories (admin-guard)
- `src/app/api/community/debug/route.ts` -- GET debug endpoint for dev

#### New Prisma Models (5)
- `ForumCategory` -- Forum discussion categories (name, slug, icon, color, sortOrder, isActive)
- `ForumPost` -- Forum discussion posts (soft-delete via deletedAt, isPinned, isLocked, viewCount)
- `ForumReply` -- Replies to forum posts (nested via parentReplyId self-ref, soft-delete)
- `ForumVote` -- User votes on posts/replies (UP/DOWN, @@unique per user+target)
- `ContactMessage` -- Persisted contact form messages (name, email, subject, message, status, optional user FK)

#### Updated Prisma Models
- `BankTransaction` -- Added `matchedEntry` FK relation to JournalEntry (onDelete: SetNull)
- `ChartOfAccount` -- `ccaRate` changed from Float? to Decimal? @db.Decimal(5,4)
- `FixedAsset` -- `ccaRate` changed from Float to Decimal @db.Decimal(5,4)
- `Media` -- Added `width Int?`, `height Int?` fields for image dimensions
- `User` -- Added `forumPosts`, `forumReplies`, `forumVotes`, `contactMessages` relations

#### Updated Pages
- `src/app/(shop)/community/page.tsx` -- Now uses real API (was useState local data only)

### New Files (2026-02-27 Session - Content Hub / Mediatheque)

#### Admin Pages (4 new)
- `src/app/admin/media/video-categories/page.tsx` -- Video category management (CRUD, translations)
- `src/app/admin/media/content-hub/page.tsx` -- Content hub dashboard (stats, video grid, filters)
- `src/app/admin/media/consents/page.tsx` -- Consent records management (list, status, PDF)
- `src/app/admin/media/consent-templates/page.tsx` -- Consent form template builder

#### Client/Public Pages (2 new + 1 refactored)
- `src/app/(shop)/account/content/page.tsx` -- User mediatheque (purchased/accessible videos)
- `src/app/(public)/consent/[token]/page.tsx` -- Public consent form signing page (token-based)
- `src/app/(shop)/videos/page.tsx` -- Refactored video listing with categories and filters

#### Content Hub API Routes (20 files)
- `src/app/api/admin/video-categories/route.ts` -- GET,POST video categories with translations
- `src/app/api/admin/video-categories/[id]/route.ts` -- GET,PUT,DELETE single video category
- `src/app/api/admin/videos/[id]/placements/route.ts` -- GET,POST,DELETE video placements
- `src/app/api/admin/videos/[id]/products/route.ts` -- GET,POST,DELETE video-product links
- `src/app/api/admin/videos/[id]/tags/route.ts` -- GET,POST,DELETE video tags
- `src/app/api/admin/videos/[id]/consent/route.ts` -- GET,POST consent for video appearances
- `src/app/api/admin/consent-templates/route.ts` -- GET,POST consent form templates
- `src/app/api/admin/consent-templates/[id]/route.ts` -- GET,PUT,DELETE single template
- `src/app/api/admin/consents/route.ts` -- GET,POST all consent records
- `src/app/api/admin/consents/[id]/route.ts` -- GET,PUT,DELETE single consent
- `src/app/api/admin/content-hub/stats/route.ts` -- GET content hub dashboard statistics
- `src/app/api/admin/emails/accounts/route.ts` -- GET,POST email accounts configuration
- `src/app/api/videos/route.ts` -- GET public video listing
- `src/app/api/videos/[slug]/route.ts` -- GET single video by slug
- `src/app/api/videos/placements/[placement]/route.ts` -- GET videos for placement location
- `src/app/api/account/content/route.ts` -- GET user mediatheque content
- `src/app/api/account/consents/route.ts` -- GET,POST user consents
- `src/app/api/account/consents/[id]/route.ts` -- GET single user consent
- `src/app/api/consent/[token]/route.ts` -- GET,POST public consent form (token-based)

#### New Components (5)
- `src/components/VideoPlayer.tsx` -- Video player with controls, responsive
- `src/components/VideoCard.tsx` -- Video thumbnail card with metadata
- `src/components/VideoGrid.tsx` -- Responsive grid layout for video cards
- `src/components/VideoFilters.tsx` -- Category/tag/search filters for videos
- `src/components/VideoPlacementWidget.tsx` -- Embeddable widget for video placements on pages/products

#### New Prisma Models (8)
- `VideoCategory` -- Video categories with translations (slug, sortOrder, isActive)
- `VideoCategoryTranslation` -- Translations for video categories (locale, name, description)
- `VideoPlacement` -- Video placement assignments (placement location, position, date range)
- `VideoProductLink` -- Video-product associations (sortOrder, unique per video+product)
- `VideoTag` -- Video tags (unique per video+tag)
- `SiteConsent` -- Consent records (type, status, signer info, token-based signing, PDF storage)
- `ConsentFormTemplate` -- Reusable consent form templates (slug, isActive)
- `ConsentFormTranslation` -- Translations for consent templates (locale, title, content, fields)

#### New Lib Files (4)
- `src/lib/consent-pdf.ts` -- PDF generation for consent forms
- `src/lib/consent-email.ts` -- Email sending for consent requests
- `src/lib/validations/video-category.ts` -- Zod schemas for video category validation
- `src/lib/validations/consent.ts` -- Zod schemas for consent form validation

#### Updated Prisma Models
- `Video` -- Added `categoryId` FK to VideoCategory, new relations: placements, productLinks, tags, consents
- `Product` -- Added `videoLinks(VideoProductLink[])` relation

### New Files (2026-02-28 Session - Social Scheduler + Ads Dashboards + Platform Integrations)

#### New Prisma Models (2)
- `SocialPost` -- Social media post scheduling/publishing (platform, content, imageUrl, scheduledAt, publishedAt, status, error, externalId, externalUrl, createdBy->User)
- `AdCampaignSnapshot` -- Daily ads campaign metrics snapshot (platform, campaignId, campaignName, date, impressions, clicks, spend, conversions, currency, rawData)

#### New API Routes (8 files)
- `src/app/api/admin/social-posts/route.ts` -- GET,POST social posts (list and create)
- `src/app/api/admin/social-posts/[id]/route.ts` -- PATCH,DELETE social post (update/delete)
- `src/app/api/admin/social-posts/[id]/publish/route.ts` -- POST publish social post immediately
- `src/app/api/admin/social-posts/cron/route.ts` -- POST cron for scheduled posts
- `src/app/api/admin/ads/stats/route.ts` -- GET aggregated ads stats
- `src/app/api/admin/ads/[platform]/campaigns/route.ts` -- GET campaigns by platform
- `src/app/api/admin/ads/sync/route.ts` -- POST manual sync trigger
- `src/app/api/admin/ads/cron/route.ts` -- POST cron for daily sync

#### New Components (1)
- `src/components/admin/AdsPlatformDashboard.tsx` -- Reusable ads dashboard component used by all 6 ads pages

#### New Lib Files (3)
- `src/lib/social/social-publisher.ts` -- Social media publishing service (Meta, X, TikTok, LinkedIn)
- `src/lib/social/social-scheduler-cron.ts` -- Cron processor for scheduled social posts
- `src/lib/ads/ads-sync.ts` -- Ads sync service for 6 platforms (Google, YouTube, Meta, TikTok, X, LinkedIn)

#### Modified Pages (8)
- `src/app/admin/media/social-scheduler/page.tsx` -- Rewritten with real API integration (was local state only)
- `src/app/admin/media/ads-youtube/page.tsx` -- Now uses AdsPlatformDashboard component
- `src/app/admin/media/ads-google/page.tsx` -- Now uses AdsPlatformDashboard component
- `src/app/admin/media/ads-tiktok/page.tsx` -- Now uses AdsPlatformDashboard component
- `src/app/admin/media/ads-x/page.tsx` -- Now uses AdsPlatformDashboard component
- `src/app/admin/media/ads-linkedin/page.tsx` -- Now uses AdsPlatformDashboard component
- `src/app/admin/media/ads-meta/page.tsx` -- Now uses AdsPlatformDashboard component
- `src/app/admin/media/videos/[id]/page.tsx` -- Enhanced with YouTube publish modal

### New Files (2026-02-28 Session - Media Audit: Security + Improvements + Automations + UX + Evolutions)

#### Phase 0: Security Fixes (5 modified files)
- `src/app/api/admin/ads/sync/route.ts` -- V-025: Added CRON_SECRET validation for automated GET calls
- `src/lib/validations/video.ts` -- V-032: Added `.strict()` to patchVideoSchema (mass assignment prevention)
- `src/lib/platform/youtube-publish.ts` -- V-072: Runtime enum validation for privacyStatus
- `src/lib/platform/oauth.ts` -- V-052: Token redaction helpers (redactSensitive, safeErrorMessage) in all logs
- `src/app/api/admin/platform-connections/[platform]/route.ts` -- V-068: Replaced webhookId with boolean hasWebhookConfigured

#### Phase 1: P0 Improvements (4 new + 2 modified files)
- `src/lib/media-hooks.ts` -- NEW: 7 SWR hooks (useVideos, useSocialPosts, useMedias, useMediaStats, useVideo, useAds, usePlatformConnections)
- `src/lib/media/image-pipeline.ts` -- NEW: Sharp lazy-loaded pipeline (resize, WebP, thumbnails, metadata)
- `src/lib/validations/media.ts` -- NEW: Zod schemas for SocialPost, Consent, VideoCategory, BrandKit, MediaUpload (all .strict())
- `src/app/api/admin/social-posts/route.ts` -- Modified: Cross-post multi-platform (platform accepts string|string[], creates N posts via $transaction)
- `src/app/api/admin/videos/route.ts` -- Modified: Auto-tagging via ai-tagger.ts when no tags provided

#### Phase 2: Automations (3 new + 1 modified)
- `src/lib/platform/oauth-token-refresh.ts` -- NEW: ensureValidTokens() proactive refresh, getExpiringTokens()
- `src/lib/media/video-transcription.ts` -- NEW: transcribeVideo() via OpenAI Whisper API (25MB limit)
- `src/app/api/admin/videos/[id]/transcribe/route.ts` -- NEW: POST endpoint for video transcription
- `src/lib/ads/ads-sync.ts` -- Modified: detectAnomalies() function (>20% variation alerts)

#### Phase 3: UX/UI (3 new + 1 modified)
- `src/components/admin/MediaPicker.tsx` -- NEW: Modal with search, folder filter, grid gallery, multi-select, preview
- `src/components/admin/CalendarView.tsx` -- NEW: Month/week views, platform-colored events, navigation
- `src/app/api/admin/media/dashboard/route.ts` -- NEW: Aggregated media stats (videos, posts, media counts)
- `src/components/admin/DataTable.tsx` -- Modified: BulkAction interface + floating action bar with checkboxes

#### Phase 4: Evolutions (5 new + 1 modified)
- `src/lib/media/video-highlights.ts` -- NEW: extractHighlights() via GPT-4o-mini analysis
- `src/app/api/admin/videos/[id]/highlights/route.ts` -- NEW: POST endpoint for highlight extraction
- `src/lib/media/content-analytics.ts` -- NEW: getMediaAnalytics() aggregation service
- `src/app/api/admin/media/analytics/route.ts` -- NEW: GET with ?days=N parameter
- `src/app/admin/media/analytics/page.tsx` -- NEW: Analytics page (KPI cards, bar chart, platform breakdown, top content)
- `src/lib/media/brand-kit.ts` -- NEW: In-memory brand kit CRUD (getActiveBrandKit, updateBrandKit, brandKitToCSSVars)
- `src/app/api/admin/brand-kit/route.ts` -- NEW: GET/PUT with Zod validation
- `src/app/admin/media/brand-kit/page.tsx` -- Modified: API-connected editing (fetch, editable fields, save)

#### Phase 5: i18n (22 locale files updated)
- 45+ new keys added under `admin.media.*` (analytics, brandKit, dashboard, highlights, transcription, etc.)
- All 22 locale files updated (fr + en reference, 20 others with English fallback)

### New Files (2026-03-04 Audit Session - CRM, Orders, Cart, Blog, Loyalty)

#### New API Routes (22 files)
- `src/app/api/admin/users/[id]/email/route.ts` -- POST admin send transactional email to user
- `src/app/api/admin/users/[id]/reset-password/route.ts` -- POST admin-initiated password reset
- `src/app/api/admin/users/[id]/notes/route.ts` -- GET,POST,PUT,DEL customer notes CRUD
- `src/app/api/admin/users/[id]/tags/route.ts` -- GET,POST,DEL customer tag management
- `src/app/api/admin/tags/route.ts` -- GET all unique customer tags (aggregated)
- `src/app/api/admin/sms-logs/route.ts` -- GET SMS log viewer
- `src/app/api/admin/customers/segments/route.ts` -- GET dynamic customer segmentation
- `src/app/api/admin/customers/at-risk/route.ts` -- GET at-risk customers (churn prediction)
- `src/app/api/admin/customers/[id]/health/route.ts` -- GET customer health score
- `src/app/api/admin/orders/[id]/pdf/route.ts` -- GET order invoice PDF generation
- `src/app/api/admin/orders/[id]/timeline/route.ts` -- GET order event audit timeline (OrderEvent)
- `src/app/api/admin/search-analytics/route.ts` -- GET search query analytics
- `src/app/api/admin/inventory/reconciliation/route.ts` -- GET,POST stock reconciliation report
- `src/app/api/admin/reviews/[id]/respond/route.ts` -- POST admin response to a review
- `src/app/api/account/orders/[id]/receipt/route.ts` -- GET customer-facing order receipt
- `src/app/api/account/orders/[id]/reorder/route.ts` -- POST re-order from a past order
- `src/app/api/account/saved-items/route.ts` -- GET,POST,DEL save items for later
- `src/app/api/cart/shared/[code]/route.ts` -- GET shared cart resolver (JWT stateless)
- `src/app/api/blog/[slug]/comments/route.ts` -- GET,POST blog post comments (moderated)
- `src/app/api/cron/low-stock-alerts/route.ts` -- POST low-stock email alert cron
- `src/app/api/cron/churn-alerts/route.ts` -- POST churn prediction alert cron
- `src/app/api/cron/birthday-bonus/route.ts` -- POST birthday loyalty bonus cron

#### New Components (3)
- `src/components/BlogComments.tsx` -- Blog post comments section (list, post, moderation status)
- `src/components/CartShareButton.tsx` -- Cart sharing button (generates JWT share link)
- `src/components/SharedCartBanner.tsx` -- Shared cart import banner (resolves shared cart on load)

#### New Hooks (2)
- `src/hooks/useDiscountCode.ts` -- Promo/gift code validation with API call and error handling
- `src/hooks/useCartShare.ts` -- Cart sharing: generate share link, resolve shared cart from code

#### New Lib Files (4)
- `src/lib/order-status-machine.ts` -- Order status transition validator (FSM: valid next states per current status)
- `src/lib/order-events.ts` -- OrderEvent recording utility (createOrderEvent, getOrderTimeline)
- `src/lib/cache.ts` -- In-memory cache with TTL + Redis fallback (get, set, invalidate, namespace helpers)
- `src/lib/loyalty/referral-milestones.ts` -- Referral milestone bonus logic (N referrals = bonus points tier)

#### New Prisma Models (3)
- `OrderEvent` -- Immutable order audit trail (type, description, metadata, actorId, actorType)
- `ApprovalRequest` -- Workflow approval requests (entityType, entityId, status, requester, assignee)
- `WorkflowRule` -- Configurable automation rules (trigger, conditions JSON, actions JSON, priority)

### New Files (2026-03-04 Phase 3 - CRM Enterprise)

#### New Prisma Models (9)
- `CrmSnippet` -- Canned response snippets for agents (title, body, category, shortcut)
- `CrmQuote` -- CPQ quotes linked to deals (status, validUntil, totalAmount, currency, pdfUrl)
- `CrmQuoteItem` -- Quote line items (description, quantity, unitPrice, discount, totalPrice, sortOrder)
- `CrmApproval` -- Multi-step approval workflow records (entityType, entityId, status, reason, approvalData)
- `ExchangeRate` -- Currency exchange rates with auto-sync (fromCurrency, toCurrency, rate, source, syncedAt)
- `AgentSchedule` -- Agent shift schedules (shiftType, startTime, endTime, daysOfWeek, isActive)
- `CrmQaForm` -- QA evaluation form templates (title, sections JSON, isActive)
- `CrmQaScore` -- QA scoring records (scores JSON, totalScore, feedback, callLogId)
- `AgentBreak` -- Agent break tracking (breakType, startedAt, endedAt, durationSec)

#### New Enums (4)
- `CrmQuoteStatus` -- DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED
- `ApprovalStatus` -- PENDING, APPROVED, REJECTED, ESCALATED
- `AgentBreakType` -- LUNCH, SHORT, TRAINING, PERSONAL, OTHER
- `AgentShiftType` -- MORNING, AFTERNOON, EVENING, NIGHT, FLEXIBLE

#### Updated Prisma Models (2)
- `CrmLead` -- Added `qualificationFramework` (String: BANT/MEDDIC/SPIN/CUSTOM) and `qualificationData` (Json)
- `CrmDeal` -- Added `isRecurring` (Boolean), `recurringInterval` (String?), `mrrValue` (Decimal?), `quotes(CrmQuote[])` relation

#### New Admin CRM Pages (9)
- `src/app/admin/crm/qualification/page.tsx` -- BANT/MEDDIC lead qualification framework + data grid
- `src/app/admin/crm/recurring-revenue/page.tsx` -- MRR/ARR KPI dashboard with cohort charts
- `src/app/admin/crm/exchange-rates/page.tsx` -- Multi-currency exchange rate management + live sync
- `src/app/admin/crm/snippets/page.tsx` -- Canned response library CRUD
- `src/app/admin/crm/quotes/page.tsx` -- Quote/CPQ builder with line items and PDF export
- `src/app/admin/crm/approvals/page.tsx` -- Multi-step approval workflow management
- `src/app/admin/crm/attribution/page.tsx` -- Multi-touch attribution reporting
- `src/app/admin/crm/scheduling/page.tsx` -- Agent shift scheduling + break tracking
- `src/app/admin/crm/qa/page.tsx` -- QA form builder and scoring dashboard

#### Enhanced Admin CRM Pages (2)
- `src/app/admin/crm/inbox/page.tsx` -- Enhanced with full contact panel sidebar
- `src/app/admin/crm/sms-templates/page.tsx` -- Enhanced with live SMS preview

#### New Admin CRM API Routes (13 files)
- `src/app/api/admin/crm/snippets/route.ts` -- GET,POST canned responses
- `src/app/api/admin/crm/quotes/route.ts` -- GET,POST CRM quotes
- `src/app/api/admin/crm/quotes/[id]/route.ts` -- GET,PUT,DELETE single quote + PDF
- `src/app/api/admin/crm/approvals/route.ts` -- GET,POST approval requests
- `src/app/api/admin/crm/approvals/[id]/route.ts` -- GET,PUT single approval + status
- `src/app/api/admin/crm/exchange-rates/route.ts` -- GET,POST exchange rates
- `src/app/api/admin/crm/exchange-rates/sync/route.ts` -- POST sync from external FX API
- `src/app/api/admin/crm/recurring-revenue/route.ts` -- GET MRR/ARR aggregation
- `src/app/api/admin/crm/agent-schedules/route.ts` -- GET,POST agent schedules
- `src/app/api/admin/crm/qa-forms/route.ts` -- GET,POST QA form templates
- `src/app/api/admin/crm/qa-scores/route.ts` -- GET,POST QA scoring records
- `src/app/api/admin/crm/agent-breaks/route.ts` -- GET,POST,PUT agent break tracking
- `src/app/api/admin/crm/attribution/route.ts` -- GET attribution report

#### New Public / Webhook API Routes (4 files)
- `src/app/api/public/chatbot/route.ts` -- POST AI chatbot (OpenAI function-calling, rate-limited)
- `src/app/api/webhooks/whatsapp/route.ts` -- POST WhatsApp Business API webhook handler
- `src/app/api/webhooks/email-inbound/route.ts` -- POST inbound email parsing and routing
- `src/app/api/webhooks/meta/route.ts` -- GET+POST Facebook/Instagram Messenger webhook

#### New Components (2)
- `src/components/chat/ChatWidget.tsx` -- Embeddable AI chat widget (WebSocket + REST fallback)
- `src/components/chat/EmbedScript.tsx` -- Standalone embed script generator for external site integration

#### New Lib CRM Files (21 files in `src/lib/crm/`)
- `exchange-rates.ts` -- Currency conversion + external FX API sync
- `quote-pdf.ts` -- PDF generation for CRM quotes
- `predictive-dialer.ts` -- Adaptive dial ratio + lead scoring-based selection
- `voicemail-drop.ts` -- Pre-recorded voicemail drop (Telnyx)
- `call-blending.ts` -- Inbound/outbound blending with queue balancing
- `local-presence.ts` -- Local caller ID matching by area code
- `recording-consent.ts` -- PCI-DSS consent announcement before recording
- `whatsapp.ts` -- WhatsApp Business API integration
- `email-sync.ts` -- Bidirectional IMAP email sync
- `social-inbox.ts` -- Facebook/Instagram Messenger unified inbox
- `shared-inbox.ts` -- Team shared mailbox routing + SLA
- `chatbot-engine.ts` -- AI chatbot with OpenAI function-calling
- `ai-forecasting.ts` -- ML-based revenue forecasting (linear regression + seasonality)
- `realtime-sentiment.ts` -- Real-time call sentiment analysis (streaming transcript)
- `ai-coaching.ts` -- AI coaching suggestions for agents
- `best-time-to-send.ts` -- Optimal send-time analysis per contact
- `push-notifications.ts` -- Web Push API (VAPID, subscription management)
- `attribution.ts` -- Multi-touch attribution engine (5 models: first-touch, last-touch, linear, time-decay, data-driven)
- `ab-testing.ts` -- A/B testing framework for CRM campaigns
- `mms.ts` -- MMS media messaging (Telnyx MMS)
- `payment-ivr.ts` -- PCI DSS compliant payment over phone via DTMF IVR

#### New PWA Files (2)
- `public/manifest.json` -- PWA manifest (name, icons, theme_color, start_url, display: standalone)
- `public/sw.js` -- Service worker (cache-first for assets, network-first for API, offline fallback)

### New Files (2026-03-05 Cross-Module Bridges Phase 0-5)

#### Bridge Infrastructure (Phase 0 — 3 new files)
- `src/lib/bridges/types.ts` -- Shared `BridgeResponse<T>` generic type + all bridge data interfaces
- `src/lib/bridges/registry.ts` -- 43 bridge entries with source/target module, API path, status (done/planned)
- `src/hooks/useBridgeData.ts` -- Reusable hook: fetch + feature-flag gating + loading/error state
- `src/components/admin/BridgeCard.tsx` -- Reusable card with skeleton, conditional hide, consistent styling

#### Bridge API Routes (35 new routes across Phases 1-5)

**Commerce Bridges (6 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/orders/[id]/accounting | GET | Commerce → Comptabilite | #3 | JournalEntry linked via sourceOrderId |
| /api/admin/orders/[id]/loyalty | GET | Commerce → Fidelite | #5 | LoyaltyTransaction by userId |
| /api/admin/orders/[id]/marketing | GET | Commerce → Marketing | #9 | PromoCodeUsage on order |
| /api/admin/orders/[id]/calls | GET | Commerce → Telephonie | #23 | CallLog by customer phone |
| /api/admin/orders/[id]/products | GET | Commerce → Catalogue | #19 | Product detail per OrderItem |
| /api/admin/orders/[id]/reviews | GET | Commerce → Communaute | #20 | Reviews by buyer for ordered products |

**CRM Bridges (7 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/crm/deals/[id]/route.ts | GET | CRM → Commerce+Tel+Email+Fidelite | #1-2,7,11,15 | 4 bridges in single endpoint |
| /api/admin/crm/deals/[id]/accounting | GET | CRM → Comptabilite | #50 | JournalEntry via deal orders |
| /api/admin/crm/deals/[id]/media | GET | CRM → Media | #49 | Videos via CrmDealProduct→VideoProductLink |
| /api/admin/customers/[id]/crm | GET | Customer → CRM | #12 | CrmDeal + CrmLead for customer |

**Telephonie Bridges (3 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/voip/call-logs/[id] | GET | Tel → CRM+Commerce | #8,13 | CrmDeal + recentOrders in response |
| /api/admin/voip/call-logs/[id]/loyalty | GET | Tel → Fidelite | #45 | Loyalty tier+points of caller |
| /api/admin/voip/call-logs/[id]/emails | GET | Tel → Emails | #46 | Recent EmailLog for caller |

**Comptabilite Bridges (2 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/accounting/entries/[id]/order | GET | Compta → Commerce | #4 | Order linked via sourceOrderId |
| /api/admin/accounting/entries/[id]/crm | GET | Compta → CRM | #14 | CrmDeal via entry→order→deal |

**Email Bridges (3 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/emails/[id]/crm | GET | Email → CRM | #12 | CrmDeal+CrmLead by email address |
| /api/admin/emails/[id]/orders | GET | Email → Commerce | #43 | Recent orders by email recipient |
| /api/admin/emails/inbox/CustomerSidebar | - | Email → CRM (frontend) | #12 | CRM deals in sidebar via customer API |

**Marketing Bridges (3 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/promo-codes/[id]/orders | GET | Marketing → Commerce | #10 | Orders using this promo code |
| /api/admin/promo-codes/[id]/crm | GET | Marketing → CRM | #16 | CrmDeal contacts who used promo |
| /api/admin/promo-codes/[id]/products | GET | Marketing → Catalogue | #29 | Products/categories of promo |

**Catalogue Bridges (3 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/products/[id]/sales | GET | Catalogue → Commerce | #25 | Units sold, revenue, recent orders |
| /api/admin/products/[id]/videos | GET | Catalogue → Media | #27 | VideoProductLink videos |
| /api/admin/products/[id]/deals | GET | Catalogue → CRM | #28 | CrmDealProduct deals |

**Communaute Bridges (3 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/reviews/[id]/purchases | GET | Communaute → Commerce | #34 | Verify reviewer purchase history |
| /api/admin/reviews/[id]/product | GET | Communaute → Catalogue | #35 | Product detail from review |
| /api/admin/reviews/[id]/crm | GET | Communaute → CRM | #36 | CRM context for reviewer |

**Fidelite Bridges (3 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/loyalty/members/[id]/orders | GET | Fidelite → Commerce | #6 | Member purchase history |
| /api/admin/loyalty/transactions/promos | GET | Fidelite → Marketing | #37 | PromoCodeUsage cross-ref loyalty |
| /api/admin/loyalty/transactions/community | GET | Fidelite → Communaute | #38 | EARN_REVIEW transactions |

**Media Bridges (4 routes)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/media/videos/[id]/sales | GET | Media → Commerce | #39 | Sales of VideoProductLink products |
| /api/admin/media/videos/[id]/products | GET | Media → Catalogue | #40 | Products via VideoProductLink |
| /api/admin/media/videos/[id]/community | GET | Media → Communaute | #42 | Reviews for video-linked products |
| /api/admin/media/social-posts/marketing | GET | Media → Marketing | #41 | SocialPost + campaigns correlation |

**Dashboard Bridge (1 route)**
| Route | Methods | Direction | Bridge # | Notes |
|-------|---------|-----------|----------|-------|
| /api/admin/dashboard/cross-module | GET | Dashboard → All | #18 | KPI widgets for 6 modules |

#### Frontend Integrations (8 pages modified for bridge cards)
- `src/app/admin/commandes/page.tsx` -- Added #19 (products, rose) + #20 (reviews, violet)
- `src/app/admin/crm/deals/[id]/page.tsx` -- Added #49 (media/videos, teal)
- `src/app/admin/promo-codes/page.tsx` -- Added #16 (CRM attribution, purple) + #29 (products, amber)
- `src/app/admin/avis/page.tsx` -- Added #34 (purchases, emerald) + #35 (product, amber) + #36 (CRM, purple)
- `src/app/admin/media/videos/[id]/page.tsx` -- Added #39 (sales, emerald) + #42 (community, violet)
- `src/app/admin/emails/inbox/CustomerSidebar.tsx` -- Added #12 (CRM deals, teal)
- `src/app/admin/comptabilite/ecritures/page.tsx` -- Added #14 (CRM deal, purple)
- `src/app/admin/telephonie/journal/CallLogClient.tsx` -- #13 render (orders in call expand)

#### i18n Keys Added (18 keys in all 22 locales)
Under `admin.bridges`: orderProducts, orderReviews, promoProducts, reviewPurchases, reviewProduct, reviewCrm, loyaltyPromos, loyaltyCommunity, videoSales, videoProducts, videoCommunity, mediaMarketing, dealMedia, verifiedPurchase, notPurchased, communityPoints, noSocialPosts, + prior keys from Phase 1-3

#### Bridge Coverage Summary
- **Before**: 11 bridges (8.3% of 132 possible directions)
- **After**: 43 done + 2 planned = 45 total (~34% coverage)
- **All 45 bridges done** — no more planned bridges
- **Schema change**: `EmailLog.campaignId` FK added for Marketing↔Email bridges
- **All bridges**: Feature-flag gated via `ff.{module}_module` in SiteSetting
- **Registry**: `src/lib/bridges/registry.ts` (complete index of all 45 bridges)

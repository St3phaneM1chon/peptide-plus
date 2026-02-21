# PROJECT MAP - peptide-plus (BioCycle Peptides)
# LAST UPDATED: 2026-02-21
# RULE: This file MUST be updated after every feature addition/modification
# SEE: .claude/rules/project-map-mandatory.md for enforcement rules

## QUICK STATS
- **Pages**: 180+ | **API Routes**: 311 | **Prisma Models**: 101 | **Enums**: 30 | **Components**: 109 | **Hooks**: 12
- **Stack**: Next.js 15 (App Router), TypeScript strict, Prisma 5.22, PostgreSQL 15, Redis
- **i18n**: 22 languages (fr reference) | **Auth**: NextAuth v5 + MFA + WebAuthn
- **Hosting**: Azure App Service | **Payments**: Stripe + PayPal
- **Orphan models** (no Prisma FK): 35/101 (34.6%) -- many use soft references

---

## TABLE OF CONTENTS
1. [Feature Domains & Cross-References](#1-feature-domains--cross-references)
2. [Dependency Chains](#2-dependency-chains)
3. [Impact Analysis (Change X -> Check Y)](#3-impact-analysis)
4. [Admin Pages (84)](#4-admin-pages-84)
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

### 1.4 ACCOUNTING (28 admin pages)
> **What**: Double-entry bookkeeping, journal entries, chart of accounts, invoices, bank reconciliation, tax reports, fixed assets, budgets

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/comptabilite` + 27 sub-pages (ecritures, factures-clients, factures-fournisseurs, notes-credit, grand-livre, plan-comptable, rapprochement, banques, devises, saisie-rapide, recurrentes, previsions, recherche, rapports, exports, ocr, audit, calendrier-fiscal, declaration-tps-tvq, etats-financiers, immobilisations, import-bancaire, parametres, budget, cloture, aging, depenses) |
| **API Routes** | 45+ routes under `/api/accounting/*`: dashboard, entries, chart-of-accounts, general-ledger, tax-summary, reconciliation, bank-accounts, bank-transactions, budgets, forecasting, aging, expenses, recurring, quick-entry, ocr, search, settings, stripe-sync, export, pdf-reports, alerts, kpis, payment-matching |
| **Models** | `ChartOfAccount` (self-ref parent/children), `JournalEntry`, `JournalLine`, `CustomerInvoice`, `CustomerInvoiceItem`, `SupplierInvoice` (orphan), `CreditNote`, `BankAccount`, `BankTransaction`, `BankRule`, `Budget`, `BudgetLine`, `Expense`, `TaxReport` (orphan), `FixedAsset`, `FixedAssetDepreciation`, `AuditTrail`, `RecurringEntryTemplate` (orphan), `AccountingPeriod` (orphan), `FiscalYear` (orphan), `AccountingSettings` (orphan), `AccountingAlert` (orphan), `DocumentAttachment` (orphan), `FiscalCalendarEvent` (orphan) |
| **Lib** | 33 files in `@/lib/accounting/`: auto-entries, stripe-sync, reconciliation, pdf-reports, alerts, aging, recurring-entries, bank-import, ml-reconciliation, forecasting, audit-trail, tax-compliance, currency, integrations (QuickBooks/Sage), quick-entry, ocr, search, alert-rules, auto-reconciliation, scheduler, kpi, payment-matching, report-templates |
| **Affects** | Orders (auto journal entries on sale/refund), Payments (stripe-sync), Tax (TPS/TVQ declarations), Fixed Assets (depreciation) |
| **NOTE** | Heavily uses soft references. JournalEntry.orderId is NOT a FK. BankTransaction.matchedEntryId is NOT a FK. Most accounting-to-commerce connections are soft. |

---

### 1.5 MAILING & NEWSLETTER (CASL Compliance)
> **What**: CASL-compliant mailing list, newsletter popup, double opt-in, unsubscribe, email campaigns

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/newsletter` |
| **API Routes** | `POST /api/newsletter`, `POST /api/mailing-list/subscribe`, `GET /api/mailing-list/confirm`, `POST /api/mailing-list/unsubscribe`, `GET /api/unsubscribe`, `/api/admin/newsletter/*` |
| **Models** | `MailingListSubscriber` (CASL-compliant, double opt-in), `MailingListPreference`, `ConsentRecord`, `NewsletterSubscriber` (legacy, NOT compliant), `EmailCampaign` (orphan), `EmailLog` (orphan) |
| **Components** | `NewsletterPopup`, `MailingListSignup` |
| **Lib** | `@/lib/email/email-service`, `@/lib/email/unsubscribe` |
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
| **API Routes** | `/api/admin/inventory`, `/api/cron/stock-alerts`, `/api/cron/price-drop-alerts`, `/api/cron/release-reservations` |
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
| **Lib** | `@/lib/email/email-service` (multi-provider: Resend/SendGrid/SMTP), `@/lib/email/templates/*`, `@/lib/email/automation-engine`, `@/lib/email/bounce-handler`, `@/lib/email/inbound-handler` |

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

### 1.14 SUPPLIER MANAGEMENT
> **What**: Supplier directory, contacts, purchase orders

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/fournisseurs` |
| **API Routes** | `/api/admin/suppliers` |
| **Models** | `Supplier`, `SupplierContact`, `SupplierLink`, `SupplierInvoice` (orphan -- soft ref supplierId), `PurchaseOrder` (soft ref supplierId) |
| **NOTE** | `PurchaseOrder` has NO FK to Supplier. `SupplierInvoice` has NO FK to Supplier or JournalEntry. |

---

### 1.15 MEDIA (MOSTLY STUBS)
> **What**: Media library, videos, images, API integrations (Zoom, WhatsApp, Teams), advertising platforms

| Layer | Elements |
|-------|----------|
| **Pages** | `/admin/media` (STUB), `/admin/medias` (COMPLETE), `/admin/media/videos` (STUB), `/admin/media/library` (STUB), `/admin/media/api-zoom` (STUB), `/admin/media/api-whatsapp` (STUB), `/admin/media/api-teams` (STUB), `/admin/media/pub-google` (STUB), `/admin/media/pub-tiktok` (STUB), `/admin/media/pub-x` (STUB), `/admin/media/pub-youtube` (STUB) |
| **API Routes** | `/api/admin/medias`, `/api/admin/videos` |
| **Models** | `Media` (orphan) |
| **NOTE** | 9 out of 11 media pages are STUBS (title + description only). No backend for Zoom/WhatsApp/Teams/ad platforms. |

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

BankAccount --> BankTransaction [soft: matchedEntryId to JournalEntry]
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
  └── Collections: WishlistCollection
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

---

## 4. ADMIN PAGES (84)

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
| Client Detail | `/admin/clients/[id]` | COMPLETE | RoleManagementSection, PointAdjustment | `/api/admin/users/[id]`, `/api/admin/users/[id]/reset-password` | User, LoyaltyTransaction |
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

### Media (MOSTLY STUBS)
| Page | Path | Status | Backend |
|------|------|--------|---------|
| Media Dashboard | `/admin/media` | **STUB** | - |
| Medias Library | `/admin/medias` | COMPLETE | `/api/admin/medias` |
| Bannieres | `/admin/bannieres` | COMPLETE | `/api/hero-slides` |
| Videos | `/admin/media/videos` | **STUB** | `/api/admin/videos` |
| Library Images | `/admin/media/library` | **STUB** | - |
| API Zoom | `/admin/media/api-zoom` | **STUB** | - |
| API WhatsApp | `/admin/media/api-whatsapp` | **STUB** | - |
| API Teams | `/admin/media/api-teams` | **STUB** | - |
| Pub Google | `/admin/media/pub-google` | **STUB** | - |
| Pub TikTok | `/admin/media/pub-tiktok` | **STUB** | - |
| Pub X/Twitter | `/admin/media/pub-x` | **STUB** | - |
| Pub YouTube | `/admin/media/pub-youtube` | **STUB** | - |

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

### Comptabilite (28 pages - ALL COMPLETE)
All pages use Outlook UI pattern (SplitLayout, ContentList, DetailPane). Key backend connections:
- **Dashboard**: `/api/accounting/dashboard` -> JournalEntry, BankAccount, CustomerInvoice aggregate
- **Ecritures**: `/api/accounting/entries` -> JournalEntry, JournalLine, ChartOfAccount
- **Factures Clients**: `/api/accounting/customer-invoices` -> CustomerInvoice, CustomerInvoiceItem
- **Grand Livre**: `/api/accounting/general-ledger` -> JournalLine, ChartOfAccount
- **Rapprochement**: `/api/accounting/reconciliation` -> BankTransaction, JournalEntry, BankAccount
- **Banques**: `/api/accounting/bank-accounts` -> BankAccount, BankTransaction
- **Budget**: `/api/accounting/budgets` -> Budget, BudgetLine
- **Exports**: `/api/accounting/export` -> JournalEntry, JournalLine, ChartOfAccount, TaxReport
- **Alerts**: `/api/accounting/alerts` -> CustomerInvoice, BankAccount, SupplierInvoice, TaxReport
- **Tax Summary**: `/api/accounting/tax-summary` -> Order, SupplierInvoice

### Other Admin
| Page | Path | Status | API |
|------|------|--------|-----|
| Rapports | `/admin/rapports` | COMPLETE | `/api/admin/reports` |
| Chat | `/admin/chat` | COMPLETE | `/api/chat/*` |
| Webinaires | `/admin/webinaires` | COMPLETE | `/api/admin/webinars` |
| Inventaire | `/admin/inventaire` | COMPLETE | `/api/admin/inventory` |
| Livraison | `/admin/livraison` | COMPLETE | `/api/admin/shipping/*` |
| Devises | `/admin/devises` | COMPLETE | `/api/admin/currencies` |
| Emails Hub | `/admin/emails` | COMPLETE | `/api/admin/emails/*` |
| UAT | `/admin/uat` | COMPLETE | `/api/admin/uat` |

### Fiscal (4 pages)
| Page | Path | Status |
|------|------|--------|
| Fiscal Dashboard | `/admin/fiscal` | COMPLETE |
| Country Detail | `/admin/fiscal/country/[code]` | COMPLETE |
| Reports | `/admin/fiscal/reports` | COMPLETE |
| Tasks | `/admin/fiscal/tasks` | COMPLETE |

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
| Community Forum | `/community` | **MOCKUP** | NONE | 100% useState, no backend |
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

### Newsletter/Mailing (11 routes)
| Route | Methods | Models | Auth | External |
|-------|---------|--------|------|----------|
| /api/newsletter | GET,POST | NewsletterSubscriber → forwards to mailing-list | rate-limit | - |
| /api/mailing-list/subscribe | POST | MailingListSubscriber,MailingListPreference | none | Email(sendEmail) |
| /api/mailing-list/confirm | GET | MailingListSubscriber | none | - |
| /api/mailing-list/unsubscribe | GET,POST | MailingListSubscriber | rate-limit | - |
| /api/unsubscribe | GET,POST | NewsletterSubscriber,NotificationPreference,AuditLog | jwt-token | jose(JWT) |
| /api/admin/mailing-list | GET | MailingListSubscriber,MailingListPreference | admin-guard | - |
| /api/admin/newsletter/subscribers | GET,POST | NewsletterSubscriber | admin-guard | - |
| /api/admin/newsletter/campaigns | GET,POST | SiteSetting,NewsletterSubscriber | admin-guard | - |

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

### Auth (5 routes)
| Route | Models | External |
|-------|--------|----------|
| /api/auth/[...nextauth] | User(Auth.js) | Auth.js providers |
| /api/auth/signup | User,AuditLog | bcryptjs,Email |
| /api/auth/forgot-password | User | Email |
| /api/auth/reset-password | User | bcryptjs |
| /api/auth/accept-terms | User | - |

### Webhooks (4 routes)
| Route | Models | Auth |
|-------|--------|------|
| /api/webhooks/stripe | proxy → /api/payments/webhook | stripe-sig |
| /api/webhooks/paypal | WebhookEvent,Order,OrderItem,ProductFormat,InventoryTransaction,Ambassador | paypal-sig |
| /api/webhooks/email-bounce | via bounce-handler | webhook-secret |
| /api/webhooks/inbound-email | InboundEmail,EmailConversation | webhook-secret |

### Cron Jobs (11 routes, all cron-secret auth)
abandoned-cart, birthday-emails, data-retention, dependency-check, points-expiring, price-drop-alerts, release-reservations, satisfaction-survey, stock-alerts, update-exchange-rates, welcome-series

### Admin Core (100+ routes)
orders, users/[id], users/[id]/points, employees, inventory, currencies, settings, seo, emails/send, promotions, promo-codes, reviews, suppliers, subscriptions, loyalty/*, translations, nav-sections, nav-subsections, nav-pages, medias, webinars, videos, logs, audit-log, metrics, cache-stats, permissions, shipping/*, uat, reports

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

### Admin-Specific Components (25)
PageHeader, StatCard, Modal, Button, DataTable, FilterBar, FormField, MediaUploader, MediaGalleryUploader, WebNavigator, CsrfInit, ContactListPage, StatusBadge, EmptyState, SectionCard, OutlookRibbon, SplitLayout, ContentList, DetailPane, FolderPane, IconRail, ChatPreview, AvatarCircle, OutlookTopBar, MobileSplitLayout

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

---

## 12. PRISMA MODEL RELATIONSHIPS

### Hub Models (highest incoming FK)
| Model | Incoming FK Count | Deletion Impact |
|-------|------------------|-----------------|
| **User** | 32 | CATASTROPHIC -- cascades to 12+ tables, blocks on 3 |
| **Product** | 14 | HIGH -- cascades formats, images, translations, modules, alerts |
| **ChartOfAccount** | 6 | BLOCKS if JournalLines or FixedAssets reference it |
| **Order** | 4 | Cascades OrderItems. SetNull PaymentErrors. |
| **EmailConversation** | 4 | Cascades inbound/outbound/notes/activities |

### Translation Models (14)
ALL follow pattern: `1:N Cascade`, `@@unique([parentId, locale])`, `translatedBy @default("gpt-4o-mini")`
- Article, BlogPost, Category, Faq, Guide, HeroSlide, NewsArticle, Page, Product, ProductFormat, QuickReply, Testimonial, Video, Webinar

### Orphan Models (35 -- no Prisma @relation)
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
- AccountingSettings, ChatSettings, SiteSettings, SiteSetting
- AuditLog, AuditTrail, SearchLog (polymorphic entityType/entityId)
- DocumentAttachment (polymorphic)
- EmailAutomationFlow, EmailCampaign, EmailLog, EmailTemplate, CannedResponse
- FiscalCalendarEvent, FiscalYear, AccountingPeriod, AccountingAlert
- Media, NewsletterSubscriber, PaymentMethodConfig, RecurringEntryTemplate
- ShippingZone, TranslationFeedback, TranslationJob, VerificationToken, Wishlist, ClientReference

---

## 13. LIB SERVICES

### Root `/src/lib/` (58 files)
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

### `/src/lib/accounting/` (33 files)
auto-entries, stripe-sync, reconciliation, pdf-reports, alerts, aging, recurring-entries, bank-import, ml-reconciliation, forecasting, audit-trail, tax-compliance, currency, integrations (QuickBooks/Sage), quick-entry, ocr, search, alert-rules, auto-reconciliation, scheduler, kpi, payment-matching, report-templates

### `/src/lib/email/` (11 files)
email-service (multi-provider: Resend/SendGrid/SMTP), templates (base, order, marketing), order-lifecycle, automation-engine, bounce-handler, inbound-handler, unsubscribe

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

### PWA
manifest.json, sw.js, offline.html, icons

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
4. **Media Section** -- 6 remaining STUB pages (4 ad platforms: YouTube/X/TikTok/Google, Videos, Library)
5. **Community Forum** -- MOCKUP only, needs DB + API
6. **About Section** -- 6 STUB pages
7. **Checkout Payment** -- Stripe integration incomplete
8. **35 Orphan Models** -- Many should have proper FK constraints (InventoryReservation, Subscription, Refund, etc.)
9. **UserPermissionGroup** -- Has userId but NO @relation to User (broken permission chain)

### New Files (2026-02-21 Session)
- `src/lib/integrations/zoom.ts` -- Zoom S2S OAuth, meetings, connection test
- `src/lib/integrations/whatsapp.ts` -- WhatsApp Cloud API, templates, messaging
- `src/lib/integrations/teams.ts` -- Teams Webhooks + Graph API, order notifications
- `src/app/api/admin/integrations/{zoom,whatsapp,teams}/route.ts` -- Config CRUD + test
- `src/components/admin/IntegrationCard.tsx` -- Reusable config card with toggle, test, webhook copy
- `.claude/rules/project-map-mandatory.md` -- Enforcement rule for keeping this file updated

# MEGA AUDIT v4.0 - Project Cartography
## BioCycle Peptides (peptide-plus)
### Generated: 2026-03-12

---

## 1. Executive Summary

| Metric | Count |
|---|---|
| **Total Pages** | **334** |
| **API Routes** | **840** |
| **Prisma Schema Files** | **12** |
| **DB Tables (Models)** | **303** |
| **Model Definitions** | **658** |
| **Enums** | **194** |
| **Components** | **166** |
| **Hooks** | **26** |
| **Lib Files** | **457** |
| **Cross-Module Bridges** | **45** (all status: done) |
| **Cron Jobs** | **34** |
| **Webhooks** | **13** |
| **Module Keys** | **10** |
| **i18n Locales** | **22** |
| **Layouts** | **75** |

**Stack:** Next.js 15 (App Router) | TypeScript strict | Prisma 5.22 | PostgreSQL 15

**Modules:** ecommerce, crm, accounting, voip, email, marketing, loyalty, media, community, catalog

---

## 2. Architecture Overview

```
peptide-plus/
+-- src/
|   +-- app/
|   |   +-- (auth)/          # 11 pages  - Authentication flows
|   |   +-- (public)/        # 38 pages  - Public-facing content
|   |   +-- (shop)/          # 48 pages  - E-commerce storefront
|   |   +-- admin/           # 220 pages - Back-office administration
|   |   +-- dashboard/       # 8 pages   - Role-based dashboards
|   |   +-- mobile/          # 7 pages   - Mobile-optimized views
|   |   +-- owner/           # 1 page    - Owner-level access
|   |   +-- consent/         # 1 page    - Consent management
|   |   +-- api/             # 840 routes - REST API endpoints
|   |
|   +-- components/          # 166 components (22 directories)
|   +-- hooks/               # 26 custom hooks
|   +-- lib/                 # 457 service files
|   +-- middleware.ts         # Request middleware
|
+-- prisma/
|   +-- schema/              # 12 schema files, 303 models, 194 enums
|
+-- Layouts: 75 (root, auth, public, shop, admin, admin/comptabilite, dashboard, mobile, ...)
```

**Layer Flow:**
```
Browser --> middleware.ts --> Layout --> Page --> API Route --> Lib Service --> Prisma --> PostgreSQL
                                                    |
                                              Cron Jobs (34)
                                              Webhooks (13)
                                              Bridges (45)
```

---

## 3. Pages Inventory (334 total)

### 3.1 Admin Pages (220)

| Sub-section | Count | Description |
|---|---|---|
| crm | 52 | CRM: leads, deals, pipelines, tickets, contacts, workflows |
| comptabilite | 43 | Accounting: journals, invoices, expenses, payroll, reports |
| media | 39 | Media management: videos, recordings, uploads, playlists |
| telephonie | 24 | VoIP: calls, queues, extensions, campaigns, transcriptions |
| fiscal | 4 | Tax reports, fiscal years, RSde |
| audits | 4 | System audits, UAT, findings |
| produits | 3 | Product management |
| parametres | 2 | System settings |
| navigateur | 2 | Navigation/browser tools |
| customers | 2 | Customer management |
| clients | 2 | Client management |
| blog | 2 | Blog management |
| analytics | 2 | Analytics dashboards |
| *(single-page modules)* | 39 | Various admin tools (1 page each) |
| **Total** | **220** | |

### 3.2 Shop Pages (48)

| Sub-section | Count | Description |
|---|---|---|
| account | 17 | User account: profile, orders, addresses, preferences, cards |
| checkout | 2 | Cart checkout flow |
| product / category / shop | 3 | Product browsing and catalog |
| bundles | 1 | Product bundles |
| community | 1 | Community forum (frontend-only, no backend yet) |
| compare | 1 | Product comparison |
| faq | 1 | FAQ page |
| gift-cards | 1 | Gift card management |
| lab-results | 1 | Lab analysis results |
| learn | 1 | Educational content |
| portal | 1 | Customer portal |
| rewards | 1 | Loyalty rewards |
| search | 1 | Product search |
| subscriptions | 1 | Subscription management |
| videos | 1 | Video content |
| webinars | 1 | Webinar access |
| *(other)* | 12 | Miscellaneous shop pages |
| **Total** | **48** | |

### 3.3 Public Pages (38)

| Sub-section | Count | Description |
|---|---|---|
| a-propos | 6 | About us, team, mission, history |
| solutions | 5 | Solutions/use-cases |
| clients | 4 | Client showcase/testimonials |
| mentions-legales | 3 | Legal notices, terms, privacy |
| ressources | 2 | Resources, downloads |
| blog | 1 | Public blog |
| contact | 1 | Contact form |
| docs | 1 | Documentation |
| *(other)* | 15 | Additional public pages |
| **Total** | **38** | |

### 3.4 Auth Pages (11)

| Page | Description |
|---|---|
| signin | Login |
| signup | Registration |
| signout | Logout |
| forgot-password | Password reset request |
| reset-password | Password reset form |
| mfa-verify | Multi-factor authentication |
| accept-invite | Invitation acceptance |
| accept-terms | Terms acceptance |
| welcome | Onboarding welcome |
| error | Auth error page |
| post-login | Post-authentication redirect |

### 3.5 Dashboard Pages (8)

| Sub-section | Count | Description |
|---|---|---|
| customer | 3 | Customer-facing dashboard views |
| employee | 3 | Employee-facing dashboard views |
| client | 1 | Client dashboard |
| main | 1 | Main dashboard landing |

### 3.6 Mobile Pages (7)

| Page | Description |
|---|---|
| dashboard | Mobile dashboard |
| expenses | Expense tracking |
| invoice | Invoice viewing |
| receipt-capture | Camera receipt capture |
| settings | Mobile settings |
| time-tracker | Time tracking |
| main | Mobile landing |

### 3.7 Other Pages (2)

| Section | Count |
|---|---|
| owner | 1 |
| consent | 1 |

---

## 4. API Routes Inventory (840 total)

### 4.1 Routes by Top-Level Grouping

| Group | Count | % of Total |
|---|---|---|
| admin | 443 | 52.7% |
| accounting | 134 | 16.0% |
| cron | 34 | 4.0% |
| voip | 32 | 3.8% |
| account | 30 | 3.6% |
| webhooks | 13 | 1.5% |
| products | 13 | 1.5% |
| *(other)* | 141 | 16.8% |
| **Total** | **840** | **100%** |

### 4.2 Admin API Routes by Domain (top 20)

| Domain | Routes | Primary Operations |
|---|---|---|
| crm | 94 | Leads, deals, pipelines, tickets, workflows, contacts |
| voip | 41 | Calls, queues, recordings, transcriptions, SIP |
| emails | 33 | Campaigns, templates, sending, tracking, bounces |
| orders | 19 | Order CRUD, status, fulfillment, events |
| products | 12 | Product CRUD, variants, pricing, images |
| customers | 12 | Customer CRUD, segments, preferences, metrics |
| accounting | 12 | Journal entries, reports, reconciliation |
| media | 11 | Upload, transform, organize, stream |
| videos | 10 | Video CRUD, categories, placements, rooms |
| loyalty | 10 | Points, tiers, referrals, ambassadors |
| newsletter | 9 | Subscriber management, campaigns, segments |
| inventory | 9 | Stock levels, movements, transfers, alerts |
| users | 7 | User management, roles, permissions |
| reviews | 7 | Review moderation, responses, images |
| analytics | 7 | Reports, dashboards, metrics, exports |
| social-posts | 6 | Social media post management |
| platform-connections | 6 | Third-party platform integrations |
| audits | 6 | Audit logs, findings, runs, types |
| recording-imports | 5 | Call recording imports |
| promo-codes | 5 | Promo code CRUD, usage tracking |

---

## 5. Prisma Models Inventory (303 models across 12 schema files)

### 5.1 Summary by Schema

| Schema File | Models | % of Total |
|---|---|---|
| ecommerce.prisma | 56 | 18.5% |
| communications.prisma | 53 | 17.5% |
| crm.prisma | 44 | 14.5% |
| accounting.prisma | 43 | 14.2% |
| content.prisma | 28 | 9.2% |
| system.prisma | 28 | 9.2% |
| media.prisma | 17 | 5.6% |
| inventory.prisma | 14 | 4.6% |
| auth.prisma | 11 | 3.6% |
| loyalty.prisma | 6 | 2.0% |
| marketing.prisma | 3 | 1.0% |
| *(12th schema)* | 0 | -- |
| **Total** | **303** | **100%** |

### 5.2 accounting.prisma (43 models)

AccountingAlert, AccountingExport, AccountingPeriod, AccountingSettings, BankAccount, BankRule, BankTransaction, BatchJob, Budget, BudgetLine, CashFlowEntry, ChartOfAccount, ClientPortalAccess, CostProject, CreditNote, CustomerInvoice, CustomerInvoiceItem, CustomReport, Employee, ExchangeRate, Expense, FiscalCalendarEvent, FiscalYear, FixedAsset, FixedAssetDepreciation, IntercompanyTransaction, JournalEntry, JournalLine, LegalEntity, OcrScan, PayrollEntry, PayrollRun, PayStub, ProjectCostEntry, ProjectMilestone, RecurringEntryTemplate, RSDeCalculation, RSDeExpense, RSDeProject, SupplierInvoice, TaxReport, TimeEntry, TimeProject

### 5.3 ecommerce.prisma (56 models)

AbandonedCart, Bundle, BundleItem, Cart, CartItem, Category, CategoryTranslation, ClientReference, Company, CompanyCustomer, CourseAccess, Currency, CustomerMetrics, CustomerPreference, CustomField, CustomFieldValue, Discount, Estimate, EstimateItem, GiftCard, Grade, Module, Order, OrderEvent, OrderItem, PaymentError, PaymentMethodConfig, PriceBook, PriceBookEntry, PriceWatch, Product, ProductFormat, ProductFormatTranslation, ProductImage, ProductQuestion, ProductTierPrice, ProductTranslation, ProductView, PromoCode, PromoCodeUsage, Purchase, QuantityDiscount, Refund, ReturnRequest, Review, ReviewImage, Shipping, ShippingStatusHistory, ShippingZone, SocialProofEvent, StockAlert, Subscription, UpsellConfig, Wishlist, WishlistCollection, WishlistItem

### 5.4 communications.prisma (53 models)

CallLog, CallQueue, CallQueueMember, CallRecording, CallSurvey, CallTranscription, CannedResponse, ChatConversation, ChatMessage, ChatSettings, CoachingScore, CoachingSession, ConsentRecord, Conversation, ConversationActivity, ConversationNote, DialerCampaign, DialerDisposition, DialerListEntry, DialerScript, DnclEntry, EmailAccount, EmailAutomationFlow, EmailBounce, EmailCampaign, EmailConversation, EmailEngagement, EmailFlowExecution, EmailLog, EmailSegment, EmailSettings, EmailSuppression, EmailTemplate, InboundEmail, InboundEmailAttachment, IvrMenu, IvrMenuOption, MailingListPreference, MailingListSubscriber, Message, OutboundReply, PhoneNumber, PresenceStatus, QuickReply, QuickReplyTranslation, SipExtension, SmsCampaign, SmsCampaignMessage, SmsLog, SmsOptOut, SmsTemplate, Voicemail, VoipConnection

### 5.5 crm.prisma (44 models)

AgentBreak, AgentDailyStats, AgentSchedule, ApprovalRequest, CallingRule, CrmActivity, CrmApproval, CrmCampaign, CrmCampaignActivity, CrmConsentRecord, CrmContract, CrmDeal, CrmDealProduct, CrmDealStageHistory, CrmDealTeam, CrmLead, CrmLeadForm, CrmPipeline, CrmPipelineStage, CrmPlaybook, CrmQaForm, CrmQaScore, CrmQuota, CrmQuote, CrmQuoteItem, CrmScheduledReport, CrmSnippet, CrmTask, CrmTicket, CrmTicketComment, CrmWorkflow, CrmWorkflowExecution, CrmWorkflowStep, CrmWorkflowVersion, CustomerNote, DataRetentionPolicy, InboxConversation, InboxMessage, KBArticle, KBCategory, Prospect, ProspectList, SlaPolicy, WorkflowRule

### 5.6 content.prisma (28 models)

Article, ArticleTranslation, BlogPost, BlogPostTranslation, BrandKit, ContactMessage, Faq, FaqTranslation, ForumCategory, ForumCategoryTranslation, ForumPost, ForumReply, ForumVote, Guide, GuideTranslation, HeroSlide, HeroSlideTranslation, NewsArticle, NewsArticleTranslation, NewsletterSubscriber, Page, PageTranslation, Testimonial, TestimonialTranslation, TranslationFeedback, TranslationJob, Webinar, WebinarTranslation

### 5.7 system.prisma (28 models)

AdminNavPage, AdminNavSection, AdminNavSubSection, ApiKey, ApiUsageLog, AuditFinding, AuditFunction, AuditLog, AuditRun, AuditTrail, AuditType, IpWhitelist, PerformanceLog, Permission, PermissionGroup, PermissionGroupPermission, SearchLog, SiteSetting, SiteSettings, UatTestCase, UatTestError, UatTestRun, WebhookDelivery, WebhookEndpoint, WebhookEvent, Workflow, WorkflowRun, WorkflowStep

### 5.8 media.prisma (17 models)

ConsentFormTemplate, ConsentFormTranslation, ContentInteraction, DocumentAttachment, Media, PlatformConnection, RecordingImport, SiteConsent, Video, VideoCategory, VideoCategoryTranslation, VideoPlacement, VideoProductLink, VideoRoom, VideoSession, VideoTag, VideoTranslation

### 5.9 inventory.prisma (14 models)

InventoryReservation, InventoryTransaction, PurchaseOrder, PurchaseOrderItem, PurchaseOrderReceipt, PurchaseOrderReceiptItem, StockLevel, StockMovement, StockTransfer, StockTransferItem, Supplier, SupplierContact, SupplierLink, Warehouse

### 5.10 auth.prisma (11 models)

Account, Authenticator, NotificationPreference, PasswordHistory, SavedCard, Session, User, UserAddress, UserPermissionGroup, UserPermissionOverride, VerificationToken

### 5.11 loyalty.prisma (6 models)

Ambassador, AmbassadorCommission, AmbassadorPayout, LoyaltyTierConfig, LoyaltyTransaction, Referral

### 5.12 marketing.prisma (3 models)

AdCampaignSnapshot, SocialPost, SocialPostTranslation

---

## 6. Components & Hooks

### 6.1 Components (166 across 22 directories)

| Directory | Description |
|---|---|
| account | User account management UI |
| admin | Admin panel UI components |
| analytics | Charts, dashboards, metrics displays |
| auth | Login, signup, MFA forms |
| blog | Blog post cards, lists, readers |
| cart | Cart drawer, items, summary |
| chat | Chat widget, messages, conversations |
| checkout | Checkout steps, payment forms |
| consent | Cookie/consent banners and forms |
| content | CMS content renderers |
| crm | CRM dashboards, pipeline boards, ticket views |
| i18n | Language switchers, translation UIs |
| layout | Headers, footers, sidebars, navigation |
| order | Order details, tracking, history |
| payment | Payment method selectors, Stripe elements |
| products | Product cards, galleries, filters |
| seo | Meta tags, structured data, OG previews |
| shop | Shop-wide UI (hero, categories, promotions) |
| ui | Shared primitives (buttons, modals, inputs, tables) |
| voip | Phone controls, call panels, dialers |

**Standalone components:**
- `ServiceWorkerRegistration.tsx` -- PWA service worker registration
- `SubscriptionOfferModal.tsx` -- Subscription upsell modal

### 6.2 Hooks (26)

| Hook | Domain | Purpose |
|---|---|---|
| useAddressAutocomplete | shop | Address autocomplete via API |
| useAdminList | admin | Paginated admin list management |
| useAdminNotifications | admin | Admin notification system |
| useAdminShortcuts | admin | Keyboard shortcuts for admin |
| useAdminSSE | admin | Server-Sent Events for admin real-time |
| useAdminSWR | admin | SWR data fetching for admin |
| useBridgeData | system | Cross-module bridge data loading |
| useBulkUndo | admin | Bulk operation undo capability |
| useCallState | voip | VoIP call state management |
| useCartShare | shop | Cart sharing functionality |
| useChatSSE | chat | Server-Sent Events for chat |
| useCompare | shop | Product comparison state |
| useCsrf | auth | CSRF token management |
| useDiscountCode | shop | Discount code application |
| useNavPages | admin | Dynamic admin navigation |
| useOnlineStatus | system | Network connectivity detection |
| useRecentChats | chat | Recent chat history |
| useRecentlyViewed | shop | Recently viewed products |
| useRibbonAction | admin | Admin ribbon bar actions |
| useSavedFilters | admin | Persistent filter presets |
| useTelnyxWebRTC | voip | Telnyx WebRTC integration |
| useTextToSpeech | voip | Text-to-speech conversion |
| useTranslations | i18n | i18n translation loader |
| useUrlFilters | admin | URL-based filter sync |
| useVoip | voip | VoIP call controls and state |

---

## 7. Lib Services (457 files)

### 7.1 Files by Directory

| Directory | Files | Description |
|---|---|---|
| crm | 107 | CRM business logic: leads, deals, pipelines, tickets, workflows, quotes, QA |
| voip | 56 | VoIP services: Telnyx, SIP, call routing, recordings, transcriptions, IVR |
| accounting | 52 | Accounting engine: journals, invoices, payroll, tax, depreciation, OCR |
| auditors | 41 | Automated audit functions: code quality, security, data integrity checks |
| validations | 21 | Zod schemas & validation logic for all domains |
| email | 19 | Email services: sending, templates, campaigns, tracking, bounces, SMTP |
| media | 14 | Media processing: upload, transform, thumbnails, video transcoding |
| platform | 7 | Platform connections: Meta, Google, TikTok, social integrations |
| admin | 7 | Admin utilities: navigation builder, permissions, settings |
| loyalty | 6 | Loyalty engine: points, tiers, referrals, ambassador commissions |
| uat | 4 | User acceptance testing automation |
| translation | 4 | i18n translation management and AI translation |
| social | 4 | Social media posting and scheduling |
| integrations | 3 | Third-party integration adapters |
| chat | 3 | Chat backend: conversations, messages, presence |
| bridges | 3 | Cross-module bridge orchestration |
| webhooks | 2 | Webhook delivery, retry, validation |
| tax | 2 | Tax calculation and reporting |
| scraper | 2 | Web scraping utilities |
| inventory | 2 | Inventory management logic |
| shipping | 1 | Shipping rate calculation and tracking |
| jobs | 1 | Background job processing |
| auth | 1 | Authentication utilities |
| api | 1 | API response helpers |
| analytics | 1 | Analytics data aggregation |
| ai | 1 | AI/LLM integration utilities |
| ads | 1 | Ad campaign management |

---

## 8. Cron Jobs & Webhooks

### 8.1 Cron Jobs (34)

| Cron Job | Domain | Purpose |
|---|---|---|
| ab-test-check | marketing | Evaluate A/B test results |
| abandoned-cart | ecommerce | Send abandoned cart recovery emails |
| aging-reminders | accounting | Send aging invoice reminders |
| birthday-bonus | loyalty | Award birthday loyalty points |
| birthday-emails | email | Send birthday greeting emails |
| browse-abandonment | marketing | Trigger browse abandonment campaigns |
| calculate-agent-stats | crm | Compute daily agent performance stats |
| calculate-metrics | analytics | Recalculate customer and sales metrics |
| churn-alerts | crm | Detect and alert on churn risk |
| data-retention | system | Enforce data retention policies |
| deal-rotting | crm | Alert on stale/rotting deals |
| dependency-check | system | Check for outdated/vulnerable dependencies |
| email-flows | email | Execute automated email flow steps |
| fx-rate-sync | accounting | Sync foreign exchange rates |
| lead-scoring | crm | Recalculate lead scores |
| low-stock-alerts | inventory | Alert on low stock levels |
| media-cleanup | media | Clean up orphaned media files |
| points-expiring | loyalty | Notify users of expiring points |
| price-drop-alerts | ecommerce | Notify watchers of price drops |
| process-callbacks | voip | Process scheduled VoIP callbacks |
| release-reservations | inventory | Release expired inventory reservations |
| replenishment-reminder | inventory | Remind for stock replenishment |
| retry-webhooks | system | Retry failed webhook deliveries |
| revenue-recognition | accounting | Process revenue recognition entries |
| satisfaction-survey | crm | Send post-interaction satisfaction surveys |
| scheduled-campaigns | email | Launch scheduled email campaigns |
| scheduled-reports | crm | Generate and send scheduled reports |
| stock-alerts | inventory | Comprehensive stock alert processing |
| sync-email-tracking | email | Sync email open/click tracking data |
| update-exchange-rates | accounting | Update currency exchange rates |
| voip-notifications | voip | Send VoIP-related notifications |
| voip-recordings | voip | Process and store call recordings |
| voip-transcriptions | voip | Transcribe call recordings |
| welcome-series | email | Execute welcome email series |

### 8.2 Webhooks (13)

| Webhook | Source | Purpose |
|---|---|---|
| email-bounce | Email provider | Handle email bounce notifications |
| email-inbound | Email provider | Process inbound emails |
| inbound-email | Email provider | Alternative inbound email handler |
| meta | Meta/Facebook | Social media event callbacks |
| paypal | PayPal | Payment notifications |
| shipping | Shipping carrier | Shipment status updates |
| sms-inbound | SMS provider | Process inbound SMS messages |
| stripe | Stripe | Payment and subscription events |
| teams | Microsoft Teams | Teams integration callbacks |
| webex | Cisco Webex | Webex integration callbacks |
| whatsapp | WhatsApp Business | WhatsApp message callbacks |
| zapier | Zapier | Automation workflow triggers |
| zoom | Zoom | Video meeting event callbacks |

---

## 9. Cross-Module Bridges (45 bridges, all status: done)

All 45 bridges connect the 10 module keys in a mesh architecture:

**Module Keys:**
1. **ecommerce** -- Products, orders, cart, checkout, subscriptions
2. **crm** -- Leads, deals, pipelines, tickets, customer relationships
3. **accounting** -- Journals, invoices, payroll, tax, financial reports
4. **voip** -- Calls, queues, recordings, transcriptions, SIP
5. **email** -- Campaigns, templates, automation flows, tracking
6. **marketing** -- Social posts, ads, A/B tests, campaigns
7. **loyalty** -- Points, tiers, referrals, ambassadors
8. **media** -- Videos, images, recordings, documents
9. **community** -- Forum, posts, replies, votes
10. **catalog** -- Categories, products, pricing, translations

### Bridge Matrix (10 modules = 45 unique pairs)

| From \ To | ecom | crm | acct | voip | email | mktg | loyal | media | comm | cat |
|---|---|---|---|---|---|---|---|---|---|---|
| **ecommerce** | -- | done | done | done | done | done | done | done | done | done |
| **crm** | -- | -- | done | done | done | done | done | done | done | done |
| **accounting** | -- | -- | -- | done | done | done | done | done | done | done |
| **voip** | -- | -- | -- | -- | done | done | done | done | done | done |
| **email** | -- | -- | -- | -- | -- | done | done | done | done | done |
| **marketing** | -- | -- | -- | -- | -- | -- | done | done | done | done |
| **loyalty** | -- | -- | -- | -- | -- | -- | -- | done | done | done |
| **media** | -- | -- | -- | -- | -- | -- | -- | -- | done | done |
| **community** | -- | -- | -- | -- | -- | -- | -- | -- | -- | done |

All 45 pairs = C(10,2) = **45 bridges, 100% done.**

---

## 10. Key Infrastructure

### 10.1 Layouts (75)

| Layout | Scope | Description |
|---|---|---|
| root | Global | Root layout: providers, fonts, metadata, analytics |
| (auth) | Auth section | Minimal layout for auth pages |
| (public) | Public section | Public layout: header, footer, SEO |
| (shop) | Shop section | Shop layout: cart, navigation, user menu |
| admin | Admin section | Admin layout: sidebar, top bar, notifications |
| admin/comptabilite | Admin sub | Accounting-specific admin sub-layout |
| dashboard | Dashboard | Role-based dashboard layout |
| mobile | Mobile | Mobile-optimized layout |
| *(67 others)* | Various | Module-specific sub-layouts |

### 10.2 Middleware

- **File:** `src/middleware.ts`
- **Purpose:** Request interception for authentication, authorization, locale detection, redirects, and route protection

### 10.3 Module Flags (10 keys)

| Module Key | Scope |
|---|---|
| ecommerce | Product catalog, cart, checkout, orders, shipping, subscriptions |
| crm | Customer relationships, leads, deals, pipelines, tickets |
| accounting | Financial management, invoicing, payroll, tax reporting |
| voip | Voice over IP, call center, recordings, transcriptions |
| email | Email campaigns, automation, templates, tracking |
| marketing | Social media, ads, A/B testing, campaigns |
| loyalty | Points program, tiers, referrals, ambassadors |
| media | Video, image, document management and delivery |
| community | Forum, discussions, user-generated content |
| catalog | Product catalog structure, categories, translations |

### 10.4 Internationalization

**22 locales** supported across the application with translation models in content.prisma (TranslationJob, TranslationFeedback) and `*Translation` models across all schema files.

---

## 11. Cross-Reference Matrix

Domain-level mapping between Pages, API Routes, Prisma Models, Lib Services, and Cron Jobs.

| Domain | Pages | API Routes | Prisma Schema | Models | Lib Files | Cron Jobs | Webhooks |
|---|---|---|---|---|---|---|---|
| **E-commerce** | ~20 (shop) | ~50 (orders, products, promo) | ecommerce.prisma | 56 | ~30 | 3 (abandoned-cart, price-drop, ab-test) | 2 (stripe, paypal) |
| **CRM** | 52 (admin/crm) | 94 (crm) | crm.prisma | 44 | 107 | 5 (agent-stats, churn, deal-rot, lead-score, satisfaction) | 0 |
| **Accounting** | 43 (admin/compta) | 134 (accounting) + 12 (admin) | accounting.prisma | 43 | 52 | 4 (aging, fx-rate, revenue-recog, exchange-rates) | 0 |
| **VoIP** | 24 (admin/tel) | 41 (voip) + 32 (top-level) | communications.prisma (partial) | ~25 | 56 | 4 (notifications, recordings, transcriptions, callbacks) | 0 |
| **Email** | ~5 (admin) | 33 (emails) | communications.prisma (partial) | ~20 | 19 | 5 (flows, birthday, campaigns, tracking, welcome) | 3 (bounce, inbound x2) |
| **Marketing** | ~5 (admin) | 6 (social-posts) + 6 (platform) | marketing.prisma | 3 | 4 (social) + 7 (platform) | 2 (browse-abandon, ab-test) | 1 (meta) |
| **Loyalty** | ~3 (shop) | 10 (loyalty) | loyalty.prisma | 6 | 6 | 2 (birthday-bonus, points-expiring) | 0 |
| **Media** | 39 (admin/media) | 11 (media) + 10 (videos) | media.prisma | 17 | 14 | 1 (media-cleanup) | 0 |
| **Community** | 1 (shop/community) | ~3 | content.prisma (forum models) | ~5 | ~2 | 0 | 0 |
| **Content/Blog** | ~10 (public + admin/blog) | ~5 | content.prisma | 28 | ~5 | 0 | 0 |
| **Inventory** | ~3 (admin) | 9 (inventory) | inventory.prisma | 14 | 2 | 4 (low-stock, release, replenish, stock-alerts) | 1 (shipping) |
| **Auth** | 11 (auth) | ~10 (account) | auth.prisma | 11 | 1 | 0 | 0 |
| **System** | ~8 (admin) | 6 (audits) + 7 (users) | system.prisma | 28 | 41 (auditors) + 4 (uat) | 3 (data-retention, dependency, retry-webhooks) | 1 (zapier) |
| **Dashboard** | 8 (dashboard) | ~5 | *(cross-schema)* | -- | ~3 | 1 (calculate-metrics) | 0 |
| **Mobile** | 7 (mobile) | ~5 | *(cross-schema)* | -- | ~2 | 0 | 0 |
| **Collaboration** | -- | -- | -- | -- | -- | 0 | 3 (teams, webex, zoom) |
| **SMS/WhatsApp** | -- | -- | communications.prisma (SMS) | ~5 | ~3 | 0 | 2 (sms-inbound, whatsapp) |

---

## Appendix: Key Numbers at a Glance

```
+--------------------------------------------------+
|  PEPTIDE-PLUS PROJECT SCALE                       |
+--------------------------------------------------+
|  334 Pages        |  840 API Routes               |
|  303 DB Models    |  194 Enums                    |
|  166 Components   |  26 Hooks                     |
|  457 Lib Files    |  45 Bridges (100% done)       |
|  34 Cron Jobs     |  13 Webhooks                  |
|  75 Layouts       |  22 Locales                   |
|  10 Modules       |  12 Prisma Schemas            |
+--------------------------------------------------+
|  Largest sections:                                |
|  - Admin: 220 pages (65.9% of all pages)          |
|  - Admin API: 443 routes (52.7% of all routes)    |
|  - CRM: 94 admin routes + 107 lib files           |
|  - Ecommerce: 56 models (largest schema)          |
|  - Communications: 53 models (2nd largest)        |
+--------------------------------------------------+
```

---

*Document generated for MEGA AUDIT v4.0 -- 2026-03-12*
*This is a read-only cartography. Do not modify manually.*

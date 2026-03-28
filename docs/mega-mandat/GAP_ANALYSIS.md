# Gap Analysis — Koraline vs Industry Best-in-Class

**Date**: 2026-03-28
**Scope**: 28 feature domains, 10 competitors (Wix, Shopify, Squarespace, Hostinger, Elementor, IONOS, Bluehost, DreamHost, Network Solutions, Site123)
**Koraline Inventory**: ~437 pages, ~1048 API routes, ~399 models (310 Prisma tables), 22 languages

---

## Table of Contents

1. [Part A: Features Koraline HAS That Competitors DON'T (Our Advantages)](#part-a-koraline-advantages)
2. [Part B: Features Competitors HAVE That Koraline DOESN'T (Gaps to Fill)](#part-b-gaps-to-fill)
3. [Part C: Priority Ranking & Implementation Roadmap](#part-c-priority-ranking)
4. [Part D: Effort Estimation & Dependencies](#part-d-effort-estimation)
5. [Part E: Summary Scorecards](#part-e-summary)

---

## Part A: Koraline Advantages

### Features That 0 of 10 Competitors Match

These are Koraline's unique differentiators. No single competitor offers these natively.

| # | Feature | Koraline Implementation | Closest Competitor | Competitor Gap |
|---|---------|------------------------|--------------------|----------------|
| 1 | **Multi-tenant SaaS Architecture** | 310 Prisma tables, tenant isolation, module-based pricing (a la carte D34) | None | Would require ground-up rebuild |
| 2 | **Full CRM Suite (42 pages)** | Pipeline, deals, leads, quotes, forecasting, leaderboard, tickets, knowledge base, workflows, CLV, cohort analysis, funnel analysis, dashboard builder | Wix Ascend (basic contacts only) | Competitors rely on HubSpot/Salesforce ($45-800/mo extra) |
| 3 | **Full Accounting Module** | General ledger, chart of accounts, client/vendor invoicing, bank reconciliation, OCR, payroll, budget/forecasting, financial statements, TPS/TVQ, RS&DE, multi-entity, AI assistant, audit trail | None | Competitors rely on QuickBooks/Sage ($30-200/mo extra) |
| 4 | **VoIP Telephony (Telnyx)** | IVR builder, call queues, call recording, conference, campaigns, coaching, speech analytics, wallboard, voicemail, SMS | None | Competitors rely on RingCentral/Talkdesk ($30-125/user/mo extra) |
| 5 | **Advanced LMS with FSRS** | Spaced repetition engine, Socratic tutoring (12 skills), IRT diagnostic quiz, flashcards, concept maps, study timer, achievements (30+), role-play scenarios | Squarespace Courses (basic) | No competitor has AI tutoring or advanced learning science |
| 6 | **Aurelia AI Tutor (12 skills)** | Pan-Canadian (13 provinces), anti-hallucination, Socratic method, contextual tutoring | Shopify Sidekick (basic chat) | No competitor has pedagogical AI with provincial law awareness |
| 7 | **Native Loyalty & Rewards** | Points, rewards, referral, tiered levels, gift cards, ambassador program | Shopify (via apps only) | Built-in vs third-party apps ($20-100/mo) |
| 8 | **Full Email Client (Outlook-style)** | 16 pages: inbox, sent, drafts, templates, campaigns, flows, segments, mailing lists | Shopify Email (marketing only) | No competitor has full email client integrated |
| 9 | **Module-based A La Carte Pricing** | Tenants pay only for modules they use (commerce, CRM, telephony, accounting, etc.) | None | All competitors use fixed-tier pricing |
| 10 | **Canadian Tax Compliance** | TPS/TVQ/GST/HST, RS&DE credits, RDTOH, GRIP, TOSI, LCGE, CDAE, CO-17, Loi 25 | None | No competitor targets Canadian fiscal specifics |

### Features Where Koraline Leads (Ahead of Most Competitors)

| # | Feature | Koraline | Competitors with Same | Advantage Level |
|---|---------|----------|-----------------------|----------------|
| 11 | **22 Native Languages** | Compiled i18n, RTL support, URL per language | Wix (180 via auto-translate), Site123 (native multi-lang) | Strong (compiled vs auto-translated) |
| 12 | **Media Management** | Content hub, brand kit, social scheduler, webinars (5 platforms), video management, social ads (6 platforms) | Wix (SEO tools), Shopify (Shop Campaigns) | Strong (breadth of media features) |
| 13 | **Security Audit (98/100)** | 14-domain audit, 106 findings resolved, PCI DSS, Loi 25, GDPR, CCPA | Wix (SOC 2/3), Shopify (PCI DSS) | Strong (audit rigor unique) |
| 14 | **B2B/Wholesale** | Native distributor and supplier management | Shopify Plus only ($2,300/mo) | Strong (available at base tier) |
| 15 | **Heatmaps** | Built-in | Shopify (Winter '26 only) | Moderate |
| 16 | **Self-service Tenant Signup** | Hybrid plan/a-la-carte, onboarding wizard, assisted setup | None have SaaS multi-tenant signup | Unique |

### TCO Advantage (Total Cost of Ownership)

For a Canadian SMB with 10 employees needing commerce + CRM + accounting + telephony:

| Solution | Monthly Cost |
|----------|-------------|
| **Koraline (all included)** | ~$99/mo (Enterprise plan) |
| **Shopify + apps** | ~$623/mo ($79 Shopify + $45 HubSpot + $30 QuickBooks + $300 RingCentral + $120 Google + $49 Teachable) |
| **Wix + apps** | ~$653/mo ($39 Wix + $45 HubSpot + $30 QuickBooks + $300 RingCentral + $120 Google + $29 Wix Courses + $89 POS) |

**Koraline saves tenants $500-600/month** compared to equivalent multi-vendor setups.

---

## Part B: Gaps to Fill

### P0 — Critical for Launch (Must Have)

| # | Gap | Best-in-Class | Impact Score | Effort | Risk | Dependencies | Notes |
|---|-----|---------------|-------------|--------|------|--------------|-------|
| G1 | **Template Marketplace (100+ templates)** | Wix (900+), Shopify (800+), Hostinger (300+) | **10** | **XL** | High | Template engine, preview system, marketplace UI | Zero credibility without templates. Prospects judge in 30 seconds. Start with 50 across 10 industries. |
| G2 | **Free Trial (14 days)** | Hostinger (14d), Shopify (3d), all others (30d money-back) | **10** | **Small** | Low | Stripe billing, tenant provisioning | Industry standard. Without trial, CAC is dramatically higher. Implementation is mostly billing logic. |
| G3 | **App Marketplace / Integration Hub** | Shopify (16K+), Wix (500+), Squarespace (49+) | **9** | **XL** | High | Plugin SDK, OAuth, developer portal, app review | Start with Zapier/Make connector (provides 5000+ integrations immediately) + 10-20 curated native integrations. |
| G4 | **Booking & Scheduling Module** | Wix (native), Squarespace (Acuity), Hostinger | **9** | **Large** | Medium | Calendar API (Google, MS), payment at booking, reminders | Service businesses are massive market. 6/10 competitors have this. Core features: services, providers, availability, booking, reminders. |
| G5 | **POS / Point of Sale** | Shopify (92 features, hardware), Squarespace (app) | **9** | **Large** | Medium | Stripe Terminal SDK, POS UI, inventory sync | Shopify's #1 differentiator. Start with Stripe Terminal Tap-to-Pay on iPhone + basic POS UI. |

### P1 — Important (Add Within 6 Months)

| # | Gap | Best-in-Class | Impact Score | Effort | Risk | Dependencies | Notes |
|---|-----|---------------|-------------|--------|------|--------------|-------|
| G6 | **Social Commerce (Instagram/FB/TikTok)** | Shopify (multi-channel), Wix | **8** | **Large** | Medium | Facebook Catalog API, TikTok Shop API, Google Merchant Center | Product catalog sync to social platforms. Growing channel, expected by modern merchants. |
| G7 | **Buy Now Pay Later (BNPL)** | Squarespace (Afterpay+Klarna), Shopify | **8** | **Medium** | Low | Stripe (already integrated; Klarna/Afterpay are Stripe-native) | Increases AOV by 20-30%. Enable via Stripe PaymentIntents with BNPL methods. Low effort because Stripe handles everything. |
| G8 | **Discounted Shipping Labels** | Shopify (91% off), Squarespace (USPS/UPS) | **8** | **Large** | Medium | Canada Post API, Purolator API, ShipStation/Shippo middleware | Major cost saver. Partnership with Canada Post recommended for Canadian focus. |
| G9 | **Real-time Carrier Shipping Rates** | Shopify (Advanced+), Squarespace | **7** | **Medium** | Low | Carrier APIs (Canada Post, UPS, FedEx) | Accurate shipping at checkout reduces cart abandonment. Can use ShipStation/Shippo as middleware. |
| G10 | **Admin Mobile App** | Shopify, Wix (Owner), Squarespace | **7** | **Large** | Medium | React Native/Expo, push notifications (APNs/FCM) | Business owners manage on-the-go. Start with PWA + push notifications (faster than native app). |
| G11 | **Dropshipping / Print-on-Demand** | Shopify (DSers), Wix, Hostinger (Printful) | **7** | **Medium** | Low | Printful/Printify API | Huge entrepreneur market. API integration with Printful is well-documented. |
| G12 | **Structured Data (Schema.org)** | Shopify, Wix, Yoast | **7** | **Medium** | Low | JSON-LD generation from Prisma models | Auto-generate Product, Offer, FAQ, Article, BreadcrumbList schemas. High SEO impact, moderate effort. |
| G13 | **Workflow Automation Engine** | Shopify (Flow), Wix (Automations) | **7** | **Large** | Medium | Event bus (Redis/BullMQ), visual workflow editor | "If this then that" for business processes. Visual editor is the hard part. |
| G14 | **Multi-Channel Selling (Amazon/eBay)** | Shopify, Wix, Squarespace | **7** | **XL** | High | Amazon SP-API, eBay Trading API, inventory sync | Product and order sync across marketplaces. Complex API integrations with strict requirements. |
| G15 | **Agentic Storefronts (AI Sales Channel)** | Shopify Winter '26 | **8** | **Medium** | Medium | MCP server, product API, conversational checkout | First-mover advantage. Expose products for ChatGPT/Copilot/Perplexity discovery. Shopify just announced this. |

### P2 — Nice to Have (Add Within 12 Months)

| # | Gap | Best-in-Class | Impact Score | Effort | Risk | Dependencies | Notes |
|---|-----|---------------|-------------|--------|------|--------------|-------|
| G16 | **Events Management** | Wix, Site123 | **6** | **Medium** | Low | Booking module (G4), ticketing, calendar | Build on booking module; add ticketing and event pages. |
| G17 | **Membership Tiers & Paywalled Content** | Wix, Squarespace, Bluehost | **6** | **Medium** | Low | Stripe subscriptions, content access middleware | Recurring revenue model. Drip content, tiers, gated pages. |
| G18 | **CMS / Dynamic Content Collections** | Wix CMS, Shopify Metaobjects | **6** | **Large** | Medium | Custom field builder, dynamic page templates | Custom content types beyond blog. Important for non-ecommerce tenants. |
| G19 | **Return/Exchange Management** | Shopify POS Pro | **6** | **Medium** | Low | Order system (existing), RMA workflow | Self-service returns portal reduces support load. |
| G20 | **A/B Testing Engine** | Shopify (W26), Wix | **6** | **Large** | Medium | Feature flags, statistical engine, results dashboard | Email A/B testing first (lower effort), then page/theme A/B testing. |
| G21 | **Express Checkout (Skip Cart)** | Squarespace, Shopify | **5** | **Small** | Low | Checkout system (existing) | Reduces friction for single-item purchases. Simple Buy Now button. |
| G22 | **Affiliate Marketing System** | Shopify (apps), Wix, Bluehost | **5** | **Medium** | Low | Tracking links, commission engine, affiliate portal | Low-cost customer acquisition. Build or integrate with existing affiliate platforms. |
| G23 | **Animation & Parallax Effects** | Wix, Squarespace, Elementor | **5** | **Medium** | Low | Page builder (existing), Framer Motion/GSAP | Visual polish. Scroll-triggered animations, hover effects, parallax. |
| G24 | **AI Logo Maker** | Wix, Squarespace, Hostinger | **5** | **Small** | Low | AI image generation (existing via DALL-E) | Quick branding tool. Icon generation + text composition. |
| G25 | **Course Certificates** | No strong competitor | **5** | **Small** | Low | LMS module (existing), PDF generation | Completes the LMS offering. Template-based PDF certificates. |
| G26 | **Custom Fonts Upload** | Wix, Squarespace, Elementor | **5** | **Small** | Low | Font storage, CSS @font-face injection | Brand consistency feature. WOFF2 upload and management. |
| G27 | **Zapier/Make Connector** | Shopify, Wix, Squarespace | **5** | **Medium** | Low | Webhook system (existing), Zapier developer platform | Instant access to 5000+ integrations. Build triggers + actions + searches. |
| G28 | **Social Media Scheduler** | Wix, Squarespace (Unfold) | **5** | **Medium** | Low | Social APIs (Facebook, Instagram, X, LinkedIn) | Content calendar + auto-posting. Streamlines marketing. |
| G29 | **Portfolio Pages** | Squarespace (leader), Wix, Elementor | **5** | **Small** | Low | Page builder (existing) | Pre-built portfolio template/component for creative professionals. |
| G30 | **Automatic Translation** | Wix (180 languages), Site123 | **5** | **Medium** | Low | AI translation API (Google/DeepL) | Auto-translate content for new languages. Manual override capability. |

### P3 — Future (2027+)

| # | Gap | Best-in-Class | Impact Score | Effort | Risk | Dependencies | Notes |
|---|-----|---------------|-------------|--------|------|--------------|-------|
| G31 | **AI Behavior Simulation (SimGym)** | Shopify Winter '26 | **7** | **XL** | High | AI agents, store simulation engine | Test UX before launch with AI-simulated users. Innovative but complex. |
| G32 | **Headless Commerce API** | Shopify Hydrogen, Wix Studio | **6** | **Large** | Medium | Public API, developer docs, SDK | Let developers build custom frontends. Koraline as backend-only. |
| G33 | **Real-Time Collaboration** | Wix Studio, WordPress 7.0 | **5** | **XL** | High | CRDTs (Yjs/Liveblocks), editor refactor | Multi-user page editing. Premium feature for agency plans. |
| G34 | **Branded Mobile App Builder** | Wix | **5** | **XL** | High | React Native codegen, App Store automation | Let tenants create their own branded app. Very complex pipeline. |
| G35 | **Figma-to-Site Import** | Wix Studio | **5** | **Large** | High | Figma API, layout parser, component mapper | Attract designers. Convert Figma designs to Koraline pages. |
| G36 | **WebAssembly Plugin System** | None (innovative) | **4** | **XL** | High | WASI 1.0, sandboxed execution | Tenants run custom logic in WASM sandbox. Wait for WASI 1.0 stabilization. |
| G37 | **Crypto/Web3 Payments** | Stripe (limited crypto), INXY | **3** | **Medium** | Medium | Crypto gateway API | Stablecoin payments via Stripe or INXY. Niche market currently. |
| G38 | **SSO for Tenants (SAML/OIDC)** | Squarespace Enterprise | **4** | **Medium** | Low | SAML 2.0, Azure AD integration | Enterprise feature. Required for corporate clients. |
| G39 | **SOC 2 Compliance** | Wix | **4** | **XL** | Medium | Compliance platform (Vanta/Drata), 6-month audit | Enterprise credibility. Required for large corporate tenants. |
| G40 | **Geo-Redundant Storage** | Shopify, Wix, IONOS | **4** | **Large** | Medium | Multi-region DB replication, failover | Enterprise reliability. Important as tenant base grows. |

---

## Part C: Priority Ranking

### Implementation Roadmap

```
TIMELINE    Q2 2026              Q3 2026              Q4 2026              2027
            |                    |                    |                    |
P0 CRITICAL |==== G2 Trial ====| |                    |                    |
            |======= G5 POS (Stripe Terminal) ========|                    |
            |============ G4 Booking/Scheduling ========|                   |
            |=================== G1 Templates (50+) ====================| |
            |=================== G3 App Marketplace ======================>
            |                    |                    |                    |
P1 HIGH     |== G7 BNPL ======| |                    |                    |
            |== G12 Schema.org | |                    |                    |
            |== G15 Agentic ===| |                    |                    |
            |=== G9 Carrier ===| |                    |                    |
            |                    |== G6 Social Commerce ========|          |
            |                    |== G8 Shipping Labels ========|          |
            |                    |== G11 Dropshipping ==|       |          |
            |                    |== G13 Workflows =====|       |          |
            |                    |                    |== G10 Mobile App ==|
            |                    |                    |== G14 Multi-Channel|
            |                    |                    |                    |
P2 NICE     |                    |== G21 Express CK ==| |                  |
            |                    |== G24 Logo Maker ==| |                  |
            |                    |== G25 Certificates =| |                 |
            |                    |== G26 Custom Fonts =| |                 |
            |                    |                    |== G17 Membership ==|
            |                    |                    |== G18 CMS ==========
            |                    |                    |== G19 Returns ====| |
            |                    |                    |== G27 Zapier =====| |
```

### Quick Wins (Small effort, High impact)

| # | Gap | Effort | Impact | Time to Ship |
|---|-----|--------|--------|-------------|
| G2 | Free Trial (14 days) | Small | 10 | 1-2 weeks |
| G7 | BNPL (Klarna/Afterpay) | Medium | 8 | 2-3 weeks |
| G12 | Structured Data / Schema.org | Medium | 7 | 2-3 weeks |
| G21 | Express Checkout (Buy Now) | Small | 5 | 1 week |
| G25 | Course Certificates | Small | 5 | 1 week |
| G26 | Custom Fonts Upload | Small | 5 | 1 week |
| G24 | AI Logo Maker | Small | 5 | 1-2 weeks |
| G29 | Portfolio Pages | Small | 5 | 1 week |

---

## Part D: Effort Estimation & Dependencies

### Effort Legend
- **Small**: 1-2 weeks, 1 developer, <2000 LOC
- **Medium**: 2-4 weeks, 1-2 developers, 2000-5000 LOC
- **Large**: 1-2 months, 2-3 developers, 5000-15000 LOC
- **XL**: 2-4 months, 3+ developers, 15000+ LOC

### Dependency Graph

```
G2 (Free Trial) ─── standalone (billing only)

G5 (POS) ──────────┬── Stripe Terminal SDK
                    └── Inventory sync (existing)

G4 (Booking) ──────┬── Google Calendar API
                    ├── Payment at booking (Stripe existing)
                    └── SMS reminders (Telnyx existing)

G1 (Templates) ────┬── Template engine (new)
                    ├── Preview system (new)
                    └── Marketplace UI (new)

G3 (App Market) ───┬── Plugin SDK (new)
                    ├── OAuth system (existing)
                    ├── Developer portal (new)
                    └── G27 (Zapier) can be Phase 1

G7 (BNPL) ─────────── Stripe (existing)

G12 (Schema.org) ──── Prisma models (existing)

G6 (Social) ───────┬── Facebook Catalog API
                    ├── Google Merchant Center
                    └── TikTok Shop API

G8 (Shipping) ─────┬── Canada Post API
                    ├── ShipStation/Shippo middleware
                    └── G9 (Carrier Rates)

G13 (Workflows) ───┬── Event bus (Redis/BullMQ)
                    └── Visual editor (React Flow)

G15 (Agentic) ─────┬── MCP server
                    └── Product API (existing)

G17 (Membership) ──┬── Stripe subscriptions (existing)
                    └── Content middleware (new)

G10 (Mobile) ──────┬── React Native/Expo OR PWA
                    └── Push notifications (APNs/FCM)
```

### Risk Assessment

| Risk Level | Gaps | Reason |
|------------|------|--------|
| **High** | G1 (Templates), G3 (App Market), G14 (Multi-Channel) | Large scope, quality requirements, third-party dependencies |
| **Medium** | G4 (Booking), G5 (POS), G6 (Social), G8 (Shipping), G10 (Mobile), G13 (Workflows), G15 (Agentic) | Moderate complexity, well-documented APIs |
| **Low** | G2 (Trial), G7 (BNPL), G9 (Rates), G11 (Dropshipping), G12 (Schema), G16-G30 | Straightforward implementation, existing dependencies |

---

## Part E: Summary Scorecards

### Koraline vs Competitors — Domain Scorecard

| Domain | Koraline Score | Best Competitor | Gap Severity |
|--------|---------------|-----------------|-------------|
| **Multi-tenant SaaS** | **10/10** | None (0/10) | ADVANTAGE |
| **CRM** | **10/10** | Wix Ascend (3/10) | ADVANTAGE |
| **Accounting** | **10/10** | None (0/10) | ADVANTAGE |
| **VoIP/Telephony** | **10/10** | None (0/10) | ADVANTAGE |
| **LMS/Education** | **9/10** | Squarespace (4/10) | ADVANTAGE |
| **Loyalty/Rewards** | **9/10** | Shopify apps (5/10) | ADVANTAGE |
| **Email Client** | **8/10** | Shopify Email (4/10) | ADVANTAGE |
| **Security** | **8/10** | Wix SOC 2/3 (9/10) | SLIGHT GAP |
| **Analytics** | **8/10** | Shopify (8/10) | PARITY |
| **Blog/Content** | **7/10** | Wix (9/10) | MODERATE GAP |
| **i18n** | **8/10** | Wix 180 langs (9/10) | SLIGHT GAP |
| **E-Commerce Core** | **7/10** | Shopify (10/10) | MODERATE GAP |
| **Checkout** | **6/10** | Shopify (10/10) | SIGNIFICANT GAP |
| **Marketing** | **6/10** | Wix (8/10) | MODERATE GAP |
| **SEO** | **6/10** | Wix (10/10) | SIGNIFICANT GAP |
| **Forms** | **7/10** | Wix (9/10) | SLIGHT GAP |
| **Hosting/Perf** | **7/10** | Wix multi-cloud (9/10) | MODERATE GAP |
| **Site Builder** | **5/10** | Wix/Elementor (10/10) | CRITICAL GAP |
| **Booking** | **0/10** | Wix/Squarespace (9/10) | CRITICAL GAP |
| **POS** | **0/10** | Shopify (10/10) | CRITICAL GAP |
| **Templates** | **1/10** | Wix (10/10) | CRITICAL GAP |
| **App Marketplace** | **0/10** | Shopify (10/10) | CRITICAL GAP |
| **Membership** | **3/10** | Wix (8/10) | SIGNIFICANT GAP |
| **Social Commerce** | **1/10** | Shopify (9/10) | CRITICAL GAP |
| **Mobile App** | **2/10** | Shopify (9/10) | CRITICAL GAP |
| **Dev Tools** | **4/10** | Shopify (9/10) | SIGNIFICANT GAP |
| **Collaboration** | **5/10** | Wix Studio (8/10) | MODERATE GAP |
| **Accessibility** | **6/10** | Elementor (8/10) | MODERATE GAP |
| **CMS Collections** | **2/10** | Wix CMS (9/10) | SIGNIFICANT GAP |
| **Portfolio** | **0/10** | Squarespace (10/10) | CRITICAL GAP |

### Overall Position

| Metric | Value |
|--------|-------|
| **Domains where Koraline LEADS** | 7 (Multi-tenant, CRM, Accounting, VoIP, LMS, Loyalty, Email) |
| **Domains at PARITY** | 3 (Analytics, Forms, Security) |
| **Domains with MODERATE gaps** | 8 (Blog, i18n, E-Commerce, Marketing, SEO, Hosting, Collaboration, Accessibility) |
| **Domains with CRITICAL gaps** | 7 (Site Builder, Booking, POS, Templates, App Marketplace, Social Commerce, Mobile App) |
| **Total features Koraline HAS** | ~180 (across 28 domains) |
| **Total features MISSING** | ~95 (identified in taxonomy) |
| **Features UNIQUE to Koraline** | 12 (no competitor has them) |

### Strategic Summary

**Koraline's position is paradoxical**: it is simultaneously the most feature-rich platform (all-in-one: CRM + accounting + telephony + LMS + loyalty + commerce) AND has critical gaps in foundational website builder features (templates, booking, POS, app ecosystem).

**The priority is clear**: fill the 5 critical P0 gaps (templates, trial, app marketplace, booking, POS) while maintaining the unique all-in-one advantage. The 7 domains where Koraline leads are irreplicable advantages that no competitor can match without years of development.

**Recommended strategy**: "Complete the foundation, protect the moat."

1. **Q2 2026**: Free trial (G2) + BNPL (G7) + Schema.org (G12) + quick wins = immediate credibility
2. **Q2-Q3 2026**: POS (G5) + Booking (G4) + Agentic Storefronts (G15) = unlock new market segments
3. **Q3-Q4 2026**: Templates (G1) Phase 1 + Social Commerce (G6) + Shipping (G8/G9) = competitive parity
4. **Q4 2026+**: App Marketplace (G3) Phase 1 + Workflows (G13) + Mobile (G10) = ecosystem growth

---

*Generated 2026-03-28 from comprehensive analysis of Feature Taxonomy (28 domains, 772 feature rows), Tech Research 2026 (10 technology domains), and Koraline platform inventory (~437 pages, ~1048 APIs, ~399 models).*

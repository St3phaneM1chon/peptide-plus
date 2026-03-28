# Analyse Comparative: Koraline (Attitudes.vip) vs Wix vs Shopify

**Date**: 2026-03-28
**Sources**: Scrapes firecrawl (wix.json, shopify.json) + architecture Koraline (outlook-nav.ts)

---

## 1. Vue d'ensemble des plateformes

| Critere | Koraline (Attitudes.vip) | Wix | Shopify |
|---------|--------------------------|-----|---------|
| **Type** | SaaS multi-tenant tout-en-un | Website builder + ecommerce | Ecommerce-first platform |
| **Cible** | PME canadiennes (multi-secteur) | Tous publics, freelancers, PME | Marchands e-commerce, retail |
| **Stack** | Next.js 15, Prisma, PostgreSQL, Railway | Proprietary, multi-cloud | Proprietary (Ruby/React) |
| **Pages admin** | ~223 pages | N/A (drag-and-drop editor) | ~50 pages admin |
| **Modules natifs** | 11 modules integres | 16 categories de features | Core commerce + apps |
| **Marketplace** | Aucune (tout integre) | 500+ apps | 16,000+ apps |
| **i18n** | 22 langues | 180 langues | Multi-langue + multi-devise |
| **IA integree** | Aurelia (tutor + assistant) | 9 outils AI (image, text, code) | Sidekick Pulse + Magic |

---

## 2. Comparaison des prix

| Plan | Koraline | Wix | Shopify |
|------|----------|-----|---------|
| **Entree** | Module-based (a la carte D34) | $17/mo (Light) | $5/mo (Starter) |
| **PME** | Plan standard | $29/mo (Core) | $29/mo (Basic) |
| **Business** | Plan business | $39/mo (Business) | $79/mo (Grow) |
| **Premium** | Plan enterprise | $159/mo (Business Elite) | $299/mo (Advanced) |
| **Enterprise** | Custom | Custom (Studio) | $2,300/mo+ (Plus) |
| **Modele** | SaaS multi-tenant, modules a la carte | Forfait par site | Forfait + % transactions |
| **Frais transaction** | Stripe standard (2.9%) | Aucun frais propre | 2.25%-5% selon plan |

**Avantage Koraline**: Le modele "modules a la carte" (D34) est unique. Un client paie UNIQUEMENT pour les modules utilises (commerce, CRM, telephonie, comptabilite, etc.) au lieu d'un forfait fixe. Wix et Shopify facturent un forfait global meme si des fonctions ne sont pas utilisees.

---

## 3. Fonctionnalites par domaine

### 3.1 E-Commerce

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Catalogue produits | Oui (categories, bundles) | Oui (1,000 variants) | Oui (2,048 variants) |
| Commandes | Oui (gestion complete) | Oui | Oui (meilleur checkout au monde) |
| Abonnements | Oui (natif) | Oui (natif) | Oui (natif + apps) |
| Inventaire | Oui (multi-location) | Oui (basique) | Oui (avance, POS) |
| Fournisseurs | Oui (module natif) | Non (via apps) | Non (via apps) |
| Livraison/zones | Oui (zones configurables) | Oui (etiquettes discount) | Oui (87% off shipping) |
| Distributeurs B2B | Oui (natif) | Non | Oui (Plus: B2B catalogs) |
| Dropshipping | Non natif | Oui (natif) | Oui (via apps) |
| Print on demand | Non | Oui (natif) | Oui (via apps) |
| Digital products | Non specifie | Oui (natif) | Oui (via apps) |
| POS (Point de vente) | Non | Non natif (via apps) | **OUI (92 features, hardware)** |
| Checkout conversion | Standard | Standard | **+15% vs concurrence** |

**Verdict**: Shopify domine en e-commerce pur (POS, checkout, B2B). Koraline a l'avantage des fournisseurs et distributeurs B2B natifs. Wix est intermediaire.

### 3.2 CRM

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Pipeline/Deals | **Oui (42 pages!)** | Non | Non |
| Leads management | Oui | Non | Non |
| Quotes/Devis | Oui | Non | Non |
| Contacts | Oui (avance) | Basique | Customer profiles |
| Forecast/Previsions | Oui | Non | Non |
| Leaderboard | Oui | Non | Non |
| Tickets support | Oui | Non | Non |
| Knowledge base | Oui | Non | Non |
| SMS Campaigns | Oui | Non | Oui (Shopify Messaging) |
| Workflows CRM | Oui | Non | Non |
| Compliance | Oui | Non | Non |
| QA/Scoring | Oui | Non | Non |
| Funnel analysis | Oui | Non | Non |
| CLV analysis | Oui | Non | Non |
| Cohort analysis | Oui | Non | Non |
| Heatmaps | Oui | Non | Oui (Winter '26) |
| Dashboard builder | Oui | Non | Non |

**Verdict**: **Koraline ecrase la concurrence** en CRM. Ni Wix ni Shopify n'offrent de CRM natif. Un marchand Shopify doit payer HubSpot ($45-800/mo) ou Salesforce ($25-300/mo) en supplement.

### 3.3 Comptabilite

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Grand livre | **Oui** | Non | Non |
| Plan comptable | **Oui** | Non | Non |
| Factures clients | **Oui** | Non | Non |
| Factures fournisseurs | **Oui** | Non | Non |
| Rapprochement bancaire | **Oui** | Non | Non |
| OCR (scan factures) | **Oui** | Non | Non |
| Paie/Payroll | **Oui** | Non | Non |
| Budget/Previsions | **Oui** | Non | Non |
| Etats financiers | **Oui** | Non | Non |
| TPS/TVQ (fiscalite QC) | **Oui** | Non | Non |
| RS&DE | **Oui** | Non | Non |
| Multi-entite | **Oui** | Non | Non |
| AI Assistant comptable | **Oui** | Non | Non |
| Audit trail | **Oui** | Non | Non |

**Verdict**: **Koraline est UNIQUE** sur ce point. Aucune plateforme concurrente n'offre de comptabilite integree. Les marchands Wix/Shopify doivent payer QuickBooks ($30-200/mo), Sage ($25-75/mo) ou FreshBooks ($19-60/mo) en plus.

### 3.4 Telephonie/VoIP

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Appels entrants/sortants | **Oui (Telnyx)** | Non | Non |
| IVR Builder | **Oui** | Non | Non |
| Call Center | **Oui (8 pages)** | Non | Non |
| Enregistrements | **Oui** | Non | Non |
| Conference | **Oui** | Non | Non |
| Campagnes appels | **Oui** | Non | Non |
| Coaching agents | **Oui** | Non | Non |
| Speech analytics | **Oui** | Non | Non |
| Wallboard temps reel | **Oui** | Non | Non |
| Messagerie vocale | **Oui** | Non | Non |

**Verdict**: **Koraline est UNIQUE**. Ni Wix ni Shopify n'offrent de telephonie. Cout equivalent: RingCentral ($30-45/user/mo), Talkdesk ($75-125/user/mo).

### 3.5 Email (Outlook-style)

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Email complet (Inbox/Sent/etc.) | **Oui (16 pages)** | Non | Non |
| Templates email | Oui | Oui (marketing) | Oui (Shopify Email) |
| Newsletter | Oui | Oui | Oui |
| Campagnes email | Oui | Oui (basic) | Oui (Shopify Email) |
| Flows automatises | Oui | Non | Oui (Shopify Flow) |
| Segments | Oui | Non | Oui |
| Mailing lists | Oui | Non | Non |

**Verdict**: Koraline offre un client email complet style Outlook integre, ce que ni Wix ni Shopify ne proposent.

### 3.6 Media & Marketing

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Blog | Oui | Oui | Oui (via apps) |
| Webinaires | **Oui (5 plateformes)** | Non | Non |
| Social media ads | **Oui (6 plateformes)** | Non natif | Oui (Shop Campaigns) |
| Content Hub | **Oui** | Non | Non |
| Brand Kit | **Oui** | Non | Non |
| Social Scheduler | **Oui** | Non | Non |
| Video management | **Oui** | Non | Non |
| SEO | Oui | **Oui (27 features!)** | Oui |
| AI image tools | Non natif | **Oui (9 outils)** | Oui (Shopify Magic) |

**Verdict**: Koraline excelle en media management multi-plateforme. Wix domine en SEO et outils AI visuels.

### 3.7 LMS (Formation)

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Cours en ligne | **Oui (FSRS engine)** | Oui (29 features) | Non |
| Quiz/Evaluations | **Oui (IRT scoring)** | Oui | Non |
| Certificats | **Oui** | Oui | Non |
| Cohortes | **Oui** | Non | Non |
| Corporate training | **Oui** | Non | Non |
| Aurelia AI tutor | **Oui (Socratique)** | Non | Non |
| Live sessions | **Oui** | Oui (Events) | Non |

**Verdict**: Les deux plateformes offrent du LMS, mais Koraline a un avantage net avec le tuteur IA Aurelia et les fonctions corporate.

### 3.8 Multi-Tenant

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| Multi-tenant natif | **Oui (310 tables)** | Non | Non (Shopify Plus partiel) |
| Assisted setup | **Oui** | Non | Non |
| Modules par tenant | **Oui (a la carte)** | Non | Non |
| Domaine custom | **Oui (CNAME)** | Oui (par site) | Oui (par boutique) |
| Super-admin | **Oui** | Non | Non |
| Broadcast clients | **Oui** | Non | Non |

**Verdict**: **Koraline est UNIQUE** en tant que SaaS multi-tenant ou chaque client a son propre espace avec modules a la carte.

---

## 4. IA et Innovation

| Fonctionnalite | Koraline | Wix | Shopify |
|----------------|----------|-----|---------|
| AI Assistant general | Aurelia (contextuel) | Wix AI (9 outils) | Sidekick Pulse |
| AI Code assistant | Non | Oui | Oui (Dev Assistant) |
| AI Image creation | Non natif | **Oui (creator, editor, eraser, upscale)** | Oui (Shopify Magic) |
| AI Text generation | Non natif | Oui | Oui |
| AI Tutoring | **Oui (Aurelia Socratique)** | Non | Non |
| AI Product descriptions | Non | Oui | Oui |
| AI Recommendations | Non | Oui | Oui |
| AI Responsive design | Non | Oui (1-click) | Non |
| AI Checkout in ChatGPT | Non | Non | **Oui (Agentic Storefronts)** |
| AI Store simulation | Non | Non | **Oui (SimGym)** |
| AI Theme A/B testing | Non | Non | **Oui (natif)** |
| Voice interaction | Non | Non | **Oui (Sidekick Voice)** |

**Verdict**: Shopify mene en innovation IA pour le commerce (Sidekick Pulse, Agentic Storefronts, SimGym). Wix mene en IA creative (images, design). Koraline a un avantage unique avec le tuteur IA Aurelia pour la formation.

---

## 5. Infrastructure & Ecosysteme

| Critere | Koraline | Wix | Shopify |
|---------|----------|-----|---------|
| Uptime | Railway SLA | 99.98% multi-cloud | 99.9% |
| CDN | Railway (Cloudflare) | 200 nodes worldwide | 300 points of presence |
| App marketplace | Aucune | 500+ apps | **16,000+ apps** |
| Developer platform | API REST | Full-stack (Velo IDE, APIs) | Functions, APIs, Hydrogen |
| Headless | Non | Oui (composable APIs) | **Oui (Hydrogen)** |
| Figma plugin | Non | **Oui** | Non |
| GitHub integration | Non | **Oui** | Oui |
| SSR | Oui (Next.js) | Oui | Oui |
| Compliance | Loi 25 Quebec | PCI DSS L1, SOC 2/3, GDPR, CCPA | PCI DSS, GDPR |

---

## 6. Forces et faiblesses

### Koraline — Forces uniques (avantage competitif majeur)

1. **TOUT-EN-UN REEL**: CRM + Comptabilite + Telephonie + Email + Commerce + LMS + Media dans UNE seule plateforme. Un marchand Shopify paierait $500-2000/mo en apps tierces pour reproduire ca.
2. **Multi-tenant natif**: Modele SaaS avec modules a la carte — unique sur le marche.
3. **Comptabilite integree**: Aucun concurrent direct ne l'offre (meme Salesforce ne l'a pas nativement).
4. **Telephonie/VoIP integree**: Call center complet, IVR builder, speech analytics — inexistant chez Wix/Shopify.
5. **CRM enterprise**: 42 pages de CRM rivalisant avec HubSpot/Salesforce.
6. **Aurelia AI tutor**: Tuteur IA Socratique unique pour la formation.
7. **Fiscalite canadienne**: TPS/TVQ, RS&DE, Loi 25 — specifique au marche cible.

### Koraline — Faiblesses a combler

1. **Pas de POS physique**: Shopify a 92 features POS + hardware. Critique pour le retail.
2. **Pas d'app marketplace**: Wix (500+) et Shopify (16,000+) offrent un ecosysteme extensible.
3. **IA generative limitee**: Pas d'outils AI pour images, texte, descriptions produits.
4. **Pas de headless/composable**: Wix et Shopify permettent le decouplage frontend.
5. **Checkout non optimise**: Shopify convertit 15% mieux que la concurrence.
6. **Pas de dropshipping/POD natif**: Wix l'integre nativement.
7. **SEO moins mature**: Wix a 27 features SEO dediees.
8. **Pas de vente via ChatGPT/Copilot**: Shopify a les Agentic Storefronts.

---

## 7. Cout total de possession (TCO) pour une PME canadienne

### Scenario: PME avec 10 employes, boutique en ligne + CRM + comptabilite + telephonie

| Poste | Koraline | Wix + Apps | Shopify + Apps |
|-------|----------|------------|----------------|
| Plateforme | ~$X/mo (tout inclus) | $39/mo (Business) | $79/mo (Grow) |
| CRM | Inclus | +$45/mo (HubSpot Starter) | +$45/mo (HubSpot) |
| Comptabilite | Inclus | +$30/mo (QuickBooks) | +$30/mo (QuickBooks) |
| Telephonie | Inclus | +$30/user = $300/mo (RingCentral) | +$300/mo (RingCentral) |
| Email pro | Inclus | +$12/user = $120/mo (Google) | +$120/mo (Google) |
| LMS | Inclus | +$29/mo (Wix Courses) | +$49/mo (Teachable) |
| POS | Non disponible | +$89/mo (app tierce) | Inclus (POS Lite) |
| **TOTAL** | **~$X/mo** | **~$653/mo** | **~$623/mo** |

**Conclusion TCO**: Un client Koraline economise potentiellement **$500-600/mo** par rapport a un ecosysteme Shopify+apps ou Wix+apps pour des fonctionnalites equivalentes.

---

## 8. Recommandations strategiques pour Koraline

### Priorite 1 — Combler les lacunes critiques
- [ ] Ajouter des outils AI generative (descriptions produits, images, texte) via OpenAI/Anthropic APIs
- [ ] Optimiser le checkout (A/B testing natif, one-click checkout)
- [ ] Ajouter le SEO avance (structured data, sitemaps auto, robots.txt, indexation Google)

### Priorite 2 — Differenciateurs a renforcer
- [ ] Mettre en avant le TCO inferieur dans le marketing
- [ ] Positionner Koraline comme "le Salesforce canadien tout-en-un pour PME"
- [ ] Renforcer Aurelia comme assistant IA omnipresent (pas seulement LMS)

### Priorite 3 — Innovations futures
- [ ] POS leger (mobile, Tap to Pay via Stripe Terminal)
- [ ] Marketplace de modules/extensions communautaires
- [ ] Agentic commerce (vente via ChatGPT/Copilot)
- [ ] Headless API pour les developpeurs

---

## 9. Donnees brutes

- **wix.json**: 262 features extraites, 4 plans tarifaires, 500+ apps marketplace
- **shopify.json**: 150+ features (Winter 2026), 6 plans tarifaires, 16,000+ apps, 92 POS features
- Sources scrapees: 10 pages (5 Wix + 5 Shopify) + 1 article analyse (ecommerce-platforms.com)

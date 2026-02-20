# Analyse Concurrentielle Exhaustive - Module Comptable peptide-plus

Date: 2026-02-19

---

## Ce que nous avons

### 23 Pages Admin Comptabilite

| Section | Pages | Statut |
|---------|-------|--------|
| Saisie | ecritures, saisie-rapide, recurrentes, ocr | Fonctionnel |
| Comptes | plan-comptable, grand-livre, aging, factures-clients, factures-fournisseurs, notes-credit | Fonctionnel |
| Banque | banques, import-bancaire, rapprochement, devises | Fonctionnel |
| Rapports | etats-financiers, previsions, budget, rapports, exports | Fonctionnel |
| Conformite | audit, cloture, parametres, recherche | Fonctionnel |

### 48 API Routes

Couvrent: GL, AR/AP aging, balance sheet, income statement, trial balance, chart of accounts, budgets, credit notes, reconciliation, currencies, periods, OCR, bank import, recurring, expenses, audit trail, dashboard, export, KPIs, payment matching, forecasting, search, quick-entry, tax reports/summary, cron, fiscal years, period close, year-end, stripe sync, PDF reports, alerts, supplier/customer invoices, bank transactions, entries, settings, cash-flow, profit-loss, budget-comparison

---

## Analyse des 10 Logiciels Concurrents

### QuickBooks Online (Intuit) - Leader du marche

- **Intuit Assist (IA)**: Categorisation auto, previsions cash flow, assistant conversationnel
- 14,000+ connexions bancaires via Plaid
- NETFILE integre pour declaration GST/HST directe au ARC
- GIFI mapping via Workpapers pour T2
- Payroll canadien complet: T4, RL-1, ROE, EFILE
- 750+ apps marketplace
- **Prix**: $20-$235 USD/mois

### Xero - Meilleur multi-devises

- **JAX (IA)**: Assistant conversationnel, reconciliation ML
- 21,000+ connexions bancaires mondiales
- 160+ devises avec taux horaires auto
- Homepage 4 colonnes drag-and-drop
- Hubdoc inclus (capture IA documents)
- Unlimited users tous plans
- **Prix**: $20-$80 USD/mois

### Sage 50 Canada - Meilleur conformite canadienne

- Payroll integre (tous plans): CPP, EI, T4, T4A, RL-1, ROE
- EFILE CRA direct (XML)
- GIFI codes natifs
- CCA schedules via module immobilisations
- 150+ rapports
- 3 methodes inventaire: FIFO, Average, Specific Unit
- Bilingue francais/anglais natif
- **Prix**: $340-$842 CAD/an

### FreshBooks - Meilleur freelancers/services

- Propositions avec e-signature
- Time tracking natif
- Project management avec budgets
- UX ultra-simple pour non-comptables
- **Prix**: $19-$70 USD/mois

### Wave - Meilleur gratuit

- Comptabilite complete GRATUITE (double-entry, rapports, factures illimitees)
- Multi-business sur un seul compte
- **Prix**: Gratuit (Pro $25 CAD/mois)

### Zoho Books - Meilleur rapport qualite/prix

- **Zia AI Engine**: categorisation, anomalies, predictions
- Automations avancees: Workflow Rules, webhooks, Custom Functions
- 70+ rapports + Zoho Analytics (150+ rapports BI)
- Module immobilisations avec depreciation multi-methodes
- Revenue recognition ASC 606
- Advanced inventory: entrepots, serial/batch tracking
- **Prix**: Gratuit a $240 USD/mois

### Oracle NetSuite - Enterprise

- ERP complet: GL, AP, AR, Fixed Assets, CRM, Inventory, Manufacturing
- OneWorld: multi-subsidiaire, 190+ devises, multi-juridiction
- SuiteFlow: workflow builder visuel
- SuiteScript: customisation JavaScript
- 75+ KPIs natifs
- **Prix**: $50K-$200K+/an

### Autres

- **FreeAgent** (UK): Comptabilite simplifiee, Making Tax Digital UK
- **Kashoo** (Vancouver): Double-entry simple, focus PME canadiennes
- **Humi** (Payroll): Payroll canadien specialise, integration RH

---

## Gap Analysis

### CRITIQUE

| # | Feature | Impact |
|---|---------|--------|
| G1 | Facturation client native (templates, envoi, paiement Stripe) | Essentiel e-commerce |
| G2 | Gestion des depenses (OCR mobile, categorisation auto, mileage) | Productivite |
| G3 | Dashboard interactif (widgets drag-drop, KPIs, charts) | UX critique |
| G4 | Connexion bancaire directe (Plaid/Yodlee) | Automatisation |
| G5 | Rapprochement bancaire IA (ML, auto-match, bank rules) | Gain de temps |
| G6 | Recurrences completes (factures, depenses, JE flexibles) | Automatisation |
| G7 | Pieces jointes/Documents (fichiers aux transactions) | Conformite |

### HAUTE PRIORITE

| # | Feature | Impact |
|---|---------|--------|
| G8 | Payroll canadien (CPP/QPP, EI, T4, RL-1, ROE) | Conformite majeure |
| G9 | GIFI codes mapping (plan comptable -> codes GIFI T2) | Conformite CRA |
| G10 | CCA schedules (classes amortissement, half-year, AII) | Fiscalite |
| G11 | Gestion immobilisations (register, depreciation, disposal) | Comptabilite complete |
| G12 | Declarations GST/QST (FPZ-500, ITC/ITR, e-filing prep) | Conformite |
| G13 | Inventaire avance (FIFO/Average/Specific, lots, series) | E-commerce |
| G14 | Time tracking (timer, billable hours, time-to-invoice) | Services |
| G15 | Portail client (factures, paiements, releves) | UX client |
| G16 | Project/Job costing (couts, profitabilite, budget vs actuel) | Gestion projets |
| G17 | Multi-entite/consolidation | Croissance |

### MOYENNE PRIORITE

| # | Feature | Impact |
|---|---------|--------|
| G18 | IA conversationnelle (assistant comptable NLP) | Differenciation |
| G19 | Workflow builder (regles auto, approbations, triggers) | Automatisation |
| G20 | Purchase orders (creation, reception, matching 3-way) | Achats |
| G21 | Estimates/Devis (creation, conversion en facture) | Ventes |
| G22 | Calendrier fiscal (deadlines ARC/RQ, rappels, installments) | Conformite |
| G23 | Mobile app (saisie depenses, photos recus, approbations) | Mobilite |
| G24 | Revenue recognition (ASC 606, multi-element arrangements) | Conformite GAAP |
| G25 | Bons de livraison (shipping, tracking, proof of delivery) | Logistique |
| G26 | Releves compte client (statements periodiques) | Communication |
| G27 | Budget vs Actuals (variance analysis, drill-down) | Analyse |
| G28 | Batch operations (paiements groupes, ecritures groupees) | Productivite |
| G29 | Custom reports builder (drag-drop, filtres, formules) | Rapports |
| G30 | Marketplace/API publique (integrations tierces, webhooks) | Ecosysteme |

---

## Roadmap Implementation

### Phase 1: Fondations Critiques

| # | Feature | Complexite |
|---|---------|------------|
| 1.1 | Dashboard interactif (widgets drag-drop, KPIs, charts temps reel) | Haute |
| 1.2 | Facturation client complete (templates, email, PDF, paiement Stripe) | Haute |
| 1.3 | Gestion depenses (OCR mobile, categorisation auto, workflow approbation) | Haute |
| 1.4 | Pieces jointes transactions (upload, preview, stockage S3/Azure Blob) | Moyenne |
| 1.5 | Bank rules auto-categorisation (regles, suggestions, apprentissage) | Moyenne |
| 1.6 | Calendrier fiscal (deadlines ARC/RQ, rappels, acomptes provisionnels) | Moyenne |

### Phase 2: Conformite Canadienne

| # | Feature | Complexite |
|---|---------|------------|
| 2.1 | GIFI codes mapping plan comptable (1,700+ codes, import/export T2) | Moyenne |
| 2.2 | Module immobilisations (CCA classes, depreciation, disposal, AII) | Haute |
| 2.3 | Declaration GST/QST (FPZ-500, ITC/ITR, export XML/PDF) | Haute |
| 2.4 | Place of supply rules (provinces, HST/GST/PST selon destination) | Moyenne |
| 2.5 | Quick Method GST/HST (taux reduits, calcul simplifie) | Basse |
| 2.6 | Retention 7 ans automatique (archivage, purge, audit trail) | Basse |

### Phase 3: Productivite & Automatisation

| # | Feature | Complexite |
|---|---------|------------|
| 3.1 | Purchase orders (creation, reception partielle, matching 3-way) | Moyenne |
| 3.2 | Estimates/Devis (templates, conversion facture, expiration) | Moyenne |
| 3.3 | Time tracking (timer, billable hours, time-to-invoice, rapports) | Moyenne |
| 3.4 | Job costing (couts directs/indirects, profitabilite, budget vs actuel) | Haute |
| 3.5 | Batch operations (paiements groupes, ecritures groupees, imports) | Moyenne |
| 3.6 | Custom reports builder (drag-drop colonnes, filtres, formules, export) | Haute |
| 3.7 | Workflow rules (triggers, conditions, actions auto, notifications) | Haute |
| 3.8 | Client statements (releves periodiques, envoi auto, PDF) | Basse |

### Phase 4: Differenciation

| # | Feature | Complexite |
|---|---------|------------|
| 4.1 | IA comptable conversationnelle (NLP, suggestions, anomalies, chat) | Haute |
| 4.2 | Portail client (factures en ligne, paiement, historique, documents) | Haute |
| 4.3 | Payroll canadien (CPP/QPP, EI, T4, T4A, RL-1, ROE, EFILE) | Tres haute |
| 4.4 | Mobile app (saisie depenses, photos recus, approbations, dashboard) | Haute |
| 4.5 | Inventaire avance (FIFO/Average/Specific, lots, series, entrepots) | Haute |
| 4.6 | Multi-entite/consolidation (inter-company, eliminations, rapports consolides) | Tres haute |
| 4.7 | API publique & marketplace (REST/GraphQL, webhooks, SDK, documentation) | Haute |
| 4.8 | RS&DE tracker (depenses eligibles, formulaire T661, calcul credits) | Moyenne |

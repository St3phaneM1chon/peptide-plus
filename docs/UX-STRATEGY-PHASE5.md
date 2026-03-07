# PHASE 5 : SYSTEME DE DASHBOARDS COMPLET

---

## 5.1 Inventaire des Dashboards

### A. Dashboard Global "Home" - Ma Journee

**Objectif :** Repondre en 10 secondes a "Que dois-je faire maintenant?" (Pattern : Zoho Action Panel + HubSpot Playbooks)

**Widgets par defaut :**

| Widget | Type | Description |
|--------|------|-------------|
| **Action Panel** | Liste d'actions | Taches urgentes, approbations en attente, items necessitant une action. Priorise par urgence. Chaque item = 1-clic vers l'action. |
| **Agenda du jour** | Timeline | Rendez-vous, appels planifies, deadlines du jour. Synced avec le calendrier. |
| **KPIs Business** | 4-6 KPI cards | Revenue du jour/semaine/mois, commandes en cours, tickets ouverts, leads chauds. Sparkline de tendance. |
| **Alertes critiques** | Banniere rouge | Stock critique, paiements en retard 60j+, SLA violes, erreurs systeme. Maximum 3 alertes visibles, "Voir tout" si plus. |
| **Feed d'activite** | Timeline | Dernieres activites cross-modules : nouveau deal cree, facture payee, ticket resolu, stock recu. Filtre par module. |
| **Raccourcis rapides** | Liens | 4-6 actions les plus frequentes de l'utilisateur (detectees par usage ou configurees manuellement). |

**Comportement AI :**
- "Bonjour Stephane. 3 deals a suivre aujourd'hui. Le stock de BPC-157 sera epuise dans 5 jours. 2 factures en retard de 30+ jours."
- Suggestions basees sur les patterns : "Vous consultez les ventes chaque lundi matin. Voici le rapport de la semaine."

---

### B. Dashboards par Role

#### B1. Founder / CEO Dashboard

| Widget | Donnees | Source |
|--------|---------|--------|
| Revenue MTD + trend | Revenus mois en cours vs mois precedent, sparkline 12 mois | Finance |
| P&L simplifie | Revenus - Depenses - Marge, 3 chiffres | Finance |
| Pipeline total | Montant total + nombre de deals par etape | CRM |
| Top 5 clients | Par revenu sur la periode, avec trend | CRM + Finance |
| Churn / Retention | Taux de retention, clients perdus ce mois | CRM |
| Cash Flow 30j | Projection tresorerie 30 jours (entrees - sorties planifiees) | Finance |
| NPS / CSAT | Score de satisfaction client, trend | Support |
| Team Velocity | Taches completees vs planifiees, par equipe | Projets |

#### B2. Operations Manager Dashboard

| Widget | Donnees | Source |
|--------|---------|--------|
| Stock Alerts | Produits sous le seuil de reorder, quantite vs seuil | Inventaire |
| Commandes en cours | Nombre + valeur, par statut (new, processing, shipped) | E-commerce |
| Fulfillment Rate | % commandes expediees dans les delais | Operations |
| Bons de commande en attente | POs non recus, par fournisseur, retards | Inventaire |
| Retours | Nombre + raisons, trend | E-commerce |
| Livraisons du jour | Liste des expeditions a traiter aujourd'hui | Operations |
| Entrepots utilization | Taux d'utilisation par entrepot (si multi-warehouse) | Inventaire |

#### B3. Agent Commercial / Support Dashboard

| Widget | Donnees | Source |
|--------|---------|--------|
| Mes taches du jour | Taches + appels + follow-ups planifies | CRM + Telephonie |
| Mon pipeline | Mes deals par etape, montant total, nb deals | CRM |
| Leads chauds | Leads score 80+ non contactes depuis 48h | CRM |
| Queue d'appels | Appels en attente si mode support/dialer | Telephonie |
| Tickets assignes | Tickets ouverts, par priorite et SLA status | Support |
| Performance | Appels/jour, deals fermes/semaine, CSAT moyen | Analytics |
| Emails non repondus | Emails recus sans reponse depuis 24h+ | Inbox |

#### B4. Comptable Dashboard

| Widget | Donnees | Source |
|--------|---------|--------|
| Cash Flow | Graphique entrees/sorties 30 jours + projection | Finance |
| Factures en retard | Aging report : 30j, 60j, 90j, 120j+ | Finance (AR) |
| Fournisseurs a payer | AP echues cette semaine | Finance (AP) |
| Reconciliation status | % transactions bancaires matchees ce mois | Finance |
| Marge brute | % marge brute MTD vs objectif | Finance |
| Taxes a remetre | TPS/TVQ/TVH dues, prochaine echeance | Finance |
| Ecritures recurrentes | Prochaines ecritures automatiques planifiees | Finance |

#### B5. Marketeur / Content Manager Dashboard

| Widget | Donnees | Source |
|--------|---------|--------|
| Performance campagnes | Open rate, CTR, conversions par campagne active | Marketing |
| Leads generes | Nombre de leads par source (organic, paid, social, referral) | CRM + Marketing |
| ROI campagnes | Revenue attribue / cout par campagne | Marketing + Finance |
| Calendrier editorial | Prochains contenus planifies cette semaine | Contenu |
| Engagement social | Likes, partages, commentaires par plateforme | Medias |
| Landing pages | Taux de conversion par landing page active | Marketing |
| Content pipeline | Contenus en draft, en review, planifies, publies | Contenu |

---

### C. Dashboards par Module

#### C1. Dashboard CRM
- **KPIs top :** Leads actifs, Deals ouverts ($), Taux de conversion, Revenu ferme MTD
- **Graphiques :** Pipeline funnel, Revenue par source, Leads par statut (bar chart)
- **Actions rapides :** Nouveau lead, Nouveau deal, Importer contacts, Voir pipeline
- **AI Insight :** "3 deals risquent de glisser au prochain mois. 5 leads chauds non contactes."

#### C2. Dashboard Inventaire
- **KPIs top :** Valeur totale du stock, Produits sous seuil, Commandes en transit, Taux de rotation
- **Graphiques :** Stock par categorie (bar), Mouvements 30j (line), Top 10 produits par rotation
- **Actions rapides :** Ajustement stock, Nouveau bon de commande, Scanner reception
- **AI Insight :** "BPC-157 sera en rupture dans 5 jours. Suggerez un reorder de 500 unites."

#### C3. Dashboard Finance
- **KPIs top :** Cash disponible, AR total, AP total, Marge nette %
- **Graphiques :** Cash flow 90j (area), Revenue vs Depenses (bar mensuel), Aging AR (stacked bar)
- **Actions rapides :** Nouvelle facture, Reconciliation bancaire, Rapport P&L
- **AI Insight :** "Le cash flow sera negatif dans 12 jours si les factures #042 et #051 ne sont pas payees."

#### C4. Dashboard Telephonie
- **KPIs top :** Appels du jour, Duree moyenne, Taux de connexion, Appels en attente
- **Graphiques :** Volume d'appels par heure (bar), Outcomes (pie : connected, voicemail, busy), Duree moyenne trend
- **Actions rapides :** Demarrer campagne, Voir queue, Mon historique d'appels
- **Wallboard :** Vue temps reel pour les superviseurs (agents en ligne, temps d'attente, SLA)

#### C5. Dashboard Contenu
- **KPIs top :** Assets totaux, Contenus publies ce mois, Contenus en review, Espace utilise
- **Graphiques :** Publications par type (bar), Engagement trend (line), Top contenus par vues
- **Actions rapides :** Upload asset, Nouveau contenu, Voir calendrier editorial
- **AI Insight :** "Le post 'Guide BPC-157' a 3x plus d'engagement que la moyenne. Suggerez un contenu similaire."

---

## 5.2 Systeme de Widgets et Personnalisation

### Types de Widgets

| Type | Description | Exemples |
|------|-------------|----------|
| **KPI Card** | Metrique unique avec label, valeur, trend (sparkline), variation % | Revenue: $45,200 (+12%) |
| **Liste d'actions** | Items actionnables avec badge de priorite et bouton d'action | 3 taches urgentes, 2 approbations |
| **Graphique** | Line, bar, area, pie, funnel, donut. Interactif (hover = tooltip, click = drill-down) | Revenue par mois, Pipeline funnel |
| **Table condensee** | 5-10 lignes des top items avec colonnes essentielles | Top 5 deals, Factures en retard |
| **Timeline** | Flux chronologique d'evenements | Feed d'activite, historique appels |
| **Liens rapides** | Grille de boutons/icones pour les actions frequentes | Nouvelle facture, Nouveau deal |
| **Mini-chart (Sparkline)** | Graphique minimaliste inline dans une KPI card | Trend 7 jours |
| **Gauge / Progress** | Jauge circulaire ou barre de progression | Quota atteint: 73% |
| **Calendrier mini** | Vue semaine/mois compacte avec indicateurs d'evenements | 3 RDV aujourd'hui |
| **Alerte / Banner** | Banniere coloree pour les situations critiques | Stock critique sur 2 produits |

### Regles de Personnalisation

1. **Drag & Drop** : Chaque widget est deplacable par sa poignee (6 dots) en haut a gauche. Grille de placement avec snap magnetique (pattern Notion/Monday.com).

2. **Resize** : Widgets redimensionnables (small 1x1, medium 2x1, large 2x2, full-width 4x1). Poignee de resize en bas a droite.

3. **Hide/Show** : Menu "+" pour ajouter des widgets depuis une bibliotheque. "X" sur chaque widget pour le masquer.

4. **Sauvegarder des layouts** : Bouton "Sauvegarder comme..." pour creer des layouts nommes. Switch entre layouts via dropdown.

5. **Reset vers defaut** : Bouton "Restaurer le layout par defaut" dans les settings du dashboard. Revert a la configuration recommandee par role.

6. **Partage** : Un admin peut "publier" un layout comme template pour un role. Les utilisateurs du role recoivent le template comme defaut.

### Densite Adaptative

| Mode | Espacement | Police | Colonnes visibles | Usage |
|------|-----------|--------|-------------------|-------|
| **Focus (Confort)** | Aere (24px gaps) | 14px body | 4-6 | Decouverte, executive view |
| **Standard** | Normal (16px gaps) | 13px body | 6-8 | Usage quotidien |
| **Pro (Compact)** | Dense (8px gaps) | 12px body | 10-15 | Power users, comptables |

**Toggle** : Accessible depuis le menu utilisateur > Preferences > Densite, OU via raccourci Ctrl+D pour switch rapide.

### Rafraichissement

- **Temps reel** (WebSocket) : Appels en cours, queue, stock live → push instantane
- **Periodique** (configurable) : KPIs financiers, rapports → toutes les 5/15/30 min (configurable par widget)
- **A la demande** : Bouton "Refresh" sur chaque widget + pull-to-refresh sur mobile
- **Indicateur de fraicheur** : Timestamp "Mis a jour il y a 3 min" sur chaque widget

---

*Sources: Zoho One Dashboard 2.0, HubSpot dashboard customization, Salesforce App Builder, Monday.com widget system, Notion drag-and-drop UX, Bloomberg Terminal information density, Stripe Dashboard real-time patterns, Linear density modes.*

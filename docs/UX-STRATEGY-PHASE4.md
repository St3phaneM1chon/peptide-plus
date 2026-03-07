# PHASE 4 : ARCHITECTURE D'INFORMATION COMPLETE

---

## 4.1 Structure de Navigation Globale

### Principe retenu : Sidebar Spaces + Command Palette + Global Create

**Justification :** 8/10 plateformes benchmarkees utilisent une sidebar (Phase 2). Le pattern Zoho One Spaces (groupement par fonction) combine avec le command palette (Linear, Zoho QuickNav) offre le meilleur equilibre exploration/acces direct. HubSpot et SAP (top bar / launchpad) montrent les limites des alternatives a 20+ modules.

### Arbre Hierarchique de Navigation

```
[SIDEBAR GAUCHE - Collapsible]
|
|-- [PERSONAL SPACE - Toujours visible]
|   |-- Home (Dashboard global / Ma journee)
|   |-- Inbox (Hub omnicanal unifie)
|   |-- Calendar (Agenda cross-modules)
|   |-- Tasks (Taches personnelles cross-modules)
|   |-- Notes (Notes rapides)
|
|-- [VENTES & CRM]
|   |-- Dashboard CRM
|   |-- Contacts
|   |-- Entreprises
|   |-- Deals / Pipeline
|   |-- Listes de prospection
|   |-- Activites
|   |-- Sequences (outreach automatise)
|
|-- [OPERATIONS]
|   |-- Dashboard Operations
|   |-- Produits & Catalogue
|   |-- Inventaire / Stock
|   |   |-- Niveaux de stock
|   |   |-- Mouvements
|   |   |-- Entrepots
|   |   |-- Ajustements
|   |-- Commandes
|   |   |-- Bons de commande (achat)
|   |   |-- Commandes clients
|   |   |-- Expeditions
|   |-- Fournisseurs
|
|-- [FINANCE]
|   |-- Dashboard Financier
|   |-- Factures (AR)
|   |-- Depenses (AP)
|   |-- Reconciliation bancaire
|   |-- Journal & Grand livre
|   |-- Rapports financiers
|   |-- Taxes
|
|-- [CONTENU & MEDIAS]
|   |-- Dashboard Contenu
|   |-- Bibliotheque d'assets (DAM)
|   |-- Editeur de contenu
|   |-- Calendrier editorial
|   |-- Acces medias sociaux
|   |-- Base de connaissances / Wiki
|
|-- [TELEPHONIE]
|   |-- Dashboard Telephonie
|   |-- Appels recents
|   |-- Campagnes d'appels
|   |-- File d'attente / Queues
|   |-- Enregistrements
|   |-- Configuration IVR
|
|-- [MARKETING]
|   |-- Dashboard Marketing
|   |-- Campagnes email/SMS
|   |-- Landing pages
|   |-- Formulaires
|   |-- Automatisations marketing
|   |-- Analytics de campagne
|
|-- [SUPPORT]
|   |-- Dashboard Support
|   |-- Tickets
|   |-- SLA & Priorites
|   |-- Portail client
|   |-- Satisfaction (CSAT)
|
|-- [PROJETS]
|   |-- Mes projets
|   |-- Vue Kanban
|   |-- Vue Gantt / Timeline
|   |-- Time tracking
|
|-- [ADMINISTRATION] (visible selon role)
|   |-- Utilisateurs & Roles
|   |-- Permissions
|   |-- Parametres generaux
|   |-- Integrations
|   |-- Audit & Logs
|   |-- Import / Export
|   |-- Sante systeme
|   |-- Mises a jour
```

### Elements Globaux Cross-Cutting

#### 1. Command Palette (Cmd+K / Z+Space)

**Justification :** Pattern present dans 7/10 plateformes benchmarkees. Reference : Zoho QuickNav, Linear, WordPress 6.9.

**Fonctionnalites :**
- **Recherche de records** : "Acme Corp" → Contact, Entreprise, Deal, Facture...
- **Recherche d'actions** : "Creer une facture" → ouvre le formulaire directement
- **Recherche de pages** : "Inventaire" → navigue vers le module
- **Recherche de settings** : "Changer mon theme" → ouvre les preferences
- **NLI (Phase 2, tendance #4)** : "Montre-moi les deals qui ferment ce mois" → genere le rapport
- **Raccourcis recents** : Affiche les 5 derniers records/pages visites
- **Fuzzy search** : Trouve "rcpt" quand on tape "receipt" (tolerant aux fautes)

#### 2. Centre de Notifications Unifie

**Position :** Icone cloche dans le top bar, ouvre un panneau lateral droit.

**Categories :**
- **Alertes urgentes** (rouge) : Stock critique, paiement en retard, SLA viole, erreur systeme
- **Taches** (bleu) : Taches assignees, approbations en attente, deadlines proches
- **Mises a jour** (gris) : Mentions, commentaires, mises a jour de records suivis
- **Systeme** (icone gear) : Mises a jour de la plateforme, maintenance, nouvelles fonctionnalites

**Comportement :**
- Groupement par categorie avec compteurs
- Mark as read individuel et en masse
- Filtres par type et par module
- Preferences de notification par canal (in-app, email, push, SMS)
- "Do not disturb" mode

#### 3. Bouton "Creer" Global (+)

**Position :** Top bar, cote droit du search. Raccourci : "C" ou "N".

**Comportement contextuel :** Le menu "Creer" s'adapte au module actif :
- Dans CRM : Creer Contact, Entreprise, Deal, Tache, Note
- Dans Inventaire : Creer Produit, Ajustement, Bon de commande
- Dans Finance : Creer Facture, Depense, Ecriture
- **Toujours visible :** Creer Tache, Creer Note (cross-module)

#### 4. Menu Utilisateur / Compte

**Position :** Top bar, coin droit. Avatar + nom.

**Contenu :**
- Mon profil
- Preferences (theme, densite, langue, fuseau horaire)
- Mes raccourcis / Favoris
- Switch de role (si multi-role)
- Statut de presence (Available, Away, Busy, DND)
- Aide & Documentation
- Raccourcis clavier (?)
- Deconnexion

#### 5. Indicateur Softphone

**Position :** Top bar ou widget flottant en bas a droite (configurable).

**Etats :**
- Inactif : Icone telephone discret
- En appel : Badge vert pulse, duree d'appel, boutons mute/hold
- Appel entrant : Notification screen pop avec info client
- **Toujours accessible** depuis n'importe quel ecran (pattern Freshcaller)

---

## 4.2 Strategie de Contexte et de Transition

### Passage entre modules sans perte de contexte

**Pattern retenu : Persistent Sidebar + SPA Navigation + Tab State**

**Justification :** L'experience Zoho Spaces et Salesforce Tabs montre que le contexte est preserve quand la sidebar reste stable et que la zone de contenu change en SPA (Single Page Application) sans full reload.

**Comportement :**
1. **Clic dans la sidebar** → La zone de contenu principale change (SPA navigation, pas de reload). La sidebar reste ouverte avec l'item actif surligne.
2. **Le module precedent conserve son etat** : si l'utilisateur etait sur la page 3 de la liste des contacts avec un filtre actif, quand il revient au CRM, il retrouve exactement cet etat.
3. **Ouverture en nouvel onglet** : Ctrl+clic / clic milieu sur n'importe quel lien ouvre dans un nouvel onglet navigateur (deep linking).

### Breadcrumbs Dynamiques

**Format :** `[Espace] > [Module] > [Sous-section] > [Record]`

**Exemples :**
- `Ventes & CRM > Contacts > Acme Corp > Jean Dupont`
- `Finance > Factures > FAC-2026-0042`
- `Operations > Inventaire > Entrepot Montreal > BPC-157`

**Comportement :**
- Chaque segment est cliquable et navigue vers la liste/section correspondante
- Le dernier segment (record actuel) est non-cliquable et en gras
- Sur mobile : seuls les 2 derniers segments sont affiches avec un "..." pour le reste
- Breadcrumbs generees automatiquement par le routeur (URL-driven)

### Tabs / Multi-onglets Intra-Module

**Usage :** Sur les pages de type "Record Page" (contact, deal, produit, facture), des tabs organisent les sections :

**Exemple - Page Contact :**
- Tab "Apercu" : proprietes + timeline recente + associations
- Tab "Activites" : timeline complete filtrable
- Tab "Deals" : deals associes avec pipeline mini-view
- Tab "Tickets" : tickets de support associes
- Tab "Factures" : historique facturation
- Tab "Documents" : fichiers et notes

**Comportement :**
- Les tabs sont dans l'URL (`/contacts/123?tab=deals`) pour le deep linking
- Le tab actif est memorise par utilisateur (si je vais toujours sur "Deals", le systeme s'en souvient)
- Sur mobile : tabs en horizontal scroll

### Historique de Navigation Recente / "Recently Viewed"

**Position :** Accessible via :
1. Le Command Palette (section "Recent" en haut)
2. Un widget "Recently Viewed" sur le dashboard Home
3. Raccourci clavier Alt+R

**Contenu :**
- 20 derniers records visites avec : type (Contact, Deal, Facture...), nom, timestamp
- 10 dernieres pages/modules visites
- Possibilite d'epingler un item en "favori" (persiste au-dela de 20)

### Deep Linking

**Regle absolue :** Chaque ecran a une URL unique et partageable.

**Format :**
- `/crm/contacts` → Liste des contacts
- `/crm/contacts/abc123` → Fiche du contact abc123
- `/crm/contacts/abc123?tab=deals` → Onglet deals du contact
- `/inventory/stock?warehouse=mtl&category=peptides` → Vue stock filtree
- `/finance/invoices/new?customer=abc123` → Nouvelle facture pre-remplie

**Partage :** Tout URL peut etre colle dans un email, un chat, ou un ticket. Le destinataire voit exactement le meme ecran (soumis aux permissions).

---

*Sources: Zoho One Spaces architecture, Salesforce Lightning navigation model, Atlassian sidebar redesign (2023), Linear command palette, SAP Fiori shell bar, Notion navigation UX, WordPress 6.9 Command Palette, HubSpot mega-menu navigation.*

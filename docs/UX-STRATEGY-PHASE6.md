# PHASE 6 : DESIGN SYSTEM & LANGAGE VISUEL

---

## 6.1 Fondations (Design Tokens)

### Architecture de Tokens en 3 Niveaux

**Justification :** Inspire de IBM Carbon, Salesforce SLDS 2 Styling Hooks, et Atlassian Design Tokens. Les tokens semantiques permettent le theming (light/dark/brand) sans modifier les composants.

```
Niveau 1: Global (valeurs brutes)
  --teal-600: #0D9488
  --gray-900: #111827

Niveau 2: Semantic/Alias (intention)
  --color-action-primary: var(--teal-600)
  --color-text-primary: var(--gray-900)

Niveau 3: Component (specifique)
  --button-primary-bg: var(--color-action-primary)
  --heading-color: var(--color-text-primary)
```

### Palette Light Mode

#### Backgrounds & Surfaces

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--bg-base` | Cloud White | `#FAFBFC` | Background principal de l'application |
| `--bg-surface` | Snow Surface | `#F3F4F6` | Cards, panels, zones de contenu |
| `--bg-surface-raised` | Frost | `#FFFFFF` | Cards sureleves, modals, dropdowns |
| `--border-default` | Mist Border | `#E5E7EB` | Bordures, separateurs, dividers |
| `--border-strong` | Steel | `#D1D5DB` | Bordures actives, inputs focus |

#### Neutrals / Text (Elevated Neutrals - tendance 2026)

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--text-primary` | Ink Primary | `#111827` | Texte principal, titres, labels importants |
| `--text-secondary` | Slate Secondary | `#4B5563` | Texte secondaire, descriptions, sous-titres |
| `--text-tertiary` | Fog Placeholder | `#9CA3AF` | Placeholders, texte desactive, hints |
| `--text-inverse` | White | `#FFFFFF` | Texte sur fonds colores (boutons primaires) |

#### Primary Accent - Transformative Teal (WGSN/Coloro 2026)

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--color-primary` | Teal 600 | `#0D9488` | Boutons primaires, liens, focus states, selection |
| `--color-primary-hover` | Teal 500 | `#14B8A6` | Hover sur boutons primaires et liens |
| `--color-primary-active` | Teal 700 | `#0F766E` | Active/pressed state |
| `--color-primary-surface` | Teal 100 | `#CCFBF1` | Backgrounds de badges, highlights, selected rows |
| `--color-primary-border` | Teal 300 | `#5EEAD4` | Bordures d'elements selectionnes |

#### Secondary Accent - Indigo

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--color-secondary` | Indigo 600 | `#4F46E5` | Actions secondaires, tags, liens alternatifs |
| `--color-secondary-hover` | Indigo 500 | `#6366F1` | Hover |
| `--color-secondary-surface` | Indigo 100 | `#E0E7FF` | Background info panels, badges secondaires |

#### Semantic Colors

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--color-success` | Success Green | `#16A34A` | Confirmations, statuts positifs, checkmarks |
| `--color-success-surface` | Success Light | `#DCFCE7` | Background badges succes |
| `--color-warning` | Warning Amber | `#F59E0B` | Alertes, actions requises, attention |
| `--color-warning-surface` | Warning Light | `#FEF3C7` | Background badges warning |
| `--color-error` | Error Red | `#DC2626` | Erreurs, etats critiques, destructifs |
| `--color-error-surface` | Error Light | `#FEE2E2` | Background badges erreur |
| `--color-info` | Info Blue | `#2563EB` | Information, tips, suggestions |
| `--color-info-surface` | Info Light | `#DBEAFE` | Background badges info |

---

### Palette Dark Mode

#### Backgrounds & Surfaces (Carbon-layered)

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--bg-base` | Void Base | `#0B0F19` | Background principal, profondeur maximale |
| `--bg-surface` | Carbon Layer 1 | `#111827` | Cards, premier niveau de surface |
| `--bg-surface-raised` | Graphite Layer 2 | `#1F2937` | Panels, modals, menus, popovers |
| `--border-default` | Onyx | `#374151` | Bordures, separateurs |
| `--border-strong` | Pewter | `#4B5563` | Bordures actives |

#### Text (Desature pour sessions longues)

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--text-primary` | Cloud Text | `#F3F4F6` | Texte principal |
| `--text-secondary` | Ash Text | `#9CA3AF` | Texte secondaire |
| `--text-tertiary` | Shadow Text | `#6B7280` | Placeholders, desactive |

#### Primary Accent - Teal (Desature pour dark mode)

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--color-primary` | Teal 400 | `#2DD4BF` | Boutons, liens, focus |
| `--color-primary-hover` | Teal 300 | `#5EEAD4` | Hover states |
| `--color-primary-surface` | Teal 900 | `#134E4A` | Backgrounds selectionnes, badges |

#### Secondary Accent - Indigo (Desature)

| Token | Nom | Hex | Usage |
|-------|-----|-----|-------|
| `--color-secondary` | Indigo 400 | `#818CF8` | Actions secondaires |
| `--color-secondary-surface` | Indigo 900 | `#312E81` | Background info panels |

#### Semantic Colors (Desature)

| Token | Hex | Ratio contraste vs bg |
|-------|-----|----------------------|
| `--color-success` | `#4ADE80` | 5.2:1 |
| `--color-warning` | `#FBBF24` | 8.1:1 |
| `--color-error` | `#F87171` | 4.8:1 |
| `--color-info` | `#60A5FA` | 4.6:1 |

---

### Palette Data Visualization (10 couleurs categoriques)

| # | Nom | Hex | Usage typique |
|---|-----|-----|---------------|
| 1 | Teal | `#0D9488` | Serie principale, revenus |
| 2 | Indigo | `#4F46E5` | Serie secondaire, comparaisons |
| 3 | Amber | `#F59E0B` | Alertes, thresholds |
| 4 | Rose | `#E11D48` | Pertes, negatifs |
| 5 | Emerald | `#059669` | Profits, positifs |
| 6 | Violet | `#7C3AED` | Categorie 6 |
| 7 | Sky | `#0284C7` | Categorie 7 |
| 8 | Orange | `#EA580C` | Categorie 8 |
| 9 | Cyan | `#0891B2` | Categorie 9 |
| 10 | Lime | `#65A30D` | Categorie 10 |

**Principes :**
- Toutes les paires adjacentes respectent WCAG AA (ratio 3:1 minimum entre elles)
- En dark mode, les couleurs sont eclaircies de 1-2 steps pour maintenir la lisibilite
- Ordre delibere pour maximiser la distinction perceptuelle (meme pour les daltoniens)

---

### Typographie

| Token | Taille | Weight | Line Height | Usage |
|-------|--------|--------|-------------|-------|
| `--font-display` | 28px | 700 (Bold) | 1.3 | Titres de page (H1) |
| `--font-heading-lg` | 22px | 600 (SemiBold) | 1.35 | Titres de section (H2) |
| `--font-heading-md` | 18px | 600 | 1.4 | Sous-titres (H3) |
| `--font-heading-sm` | 16px | 600 | 1.4 | Sous-sous-titres (H4) |
| `--font-body` | 14px | 400 (Regular) | 1.5 | Texte courant, paragraphes |
| `--font-body-sm` | 13px | 400 | 1.5 | Descriptions, aide contextuelle |
| `--font-caption` | 12px | 400 | 1.5 | Labels de formulaire, metadata |
| `--font-table` | 13px | 400 | 1.4 | Cellules de tableau |
| `--font-table-header` | 12px | 600 | 1.4 | En-tetes de colonnes |
| `--font-mono` | 13px | 400 | 1.5 | IDs, codes, SKUs, montants |

**Font stack :**
```css
--font-family-sans: 'Inter', 'Geist', system-ui, -apple-system, sans-serif;
--font-family-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
```

**Principes :**
- Inter comme font principale (gratuite, excellente lisibilite en petite taille, tabular numbers)
- Monospace pour les donnees numeriques, codes, SKUs, IDs (alignement des chiffres)
- Line height 1.5 pour le body (lisibilite en sessions longues)
- Pas de font en dessous de 11px (accessibilite)

---

### Espacement & Layout

**Grille base-8 :**

| Token | Valeur | Usage |
|-------|--------|-------|
| `--space-1` | 4px | Micro-espacement (entre icone et label) |
| `--space-2` | 8px | Espacement interne compact (padding table cells) |
| `--space-3` | 12px | Espacement interne standard (padding inputs) |
| `--space-4` | 16px | Padding interne des cards |
| `--space-5` | 20px | Gap entre elements de formulaire |
| `--space-6` | 24px | Gap entre sections |
| `--space-8` | 32px | Marge entre blocs majeurs |
| `--space-10` | 40px | Espacement entre sections de page |
| `--space-12` | 48px | Marge superieure de page |
| `--space-16` | 64px | Espacement maximal |

**Border radius :**

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-sm` | 4px | Badges, tags, chips |
| `--radius-md` | 8px | Boutons, inputs, cards |
| `--radius-lg` | 12px | Modals, panels, drawers |
| `--radius-xl` | 16px | Cards prominentes, popovers |
| `--radius-full` | 9999px | Avatars, pills, toggles |

**Ombres (3 niveaux) :**

| Token | Valeur | Usage |
|-------|--------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Cards au repos, separation subtile |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Cards hover, dropdowns |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, popovers, drawers |

---

## 6.2 Composants Prioritaires (Ordre d'implementation)

### 1. Navigation Shell (Sidebar + Topbar + Command Palette)

**Sidebar :**
- Largeur : 240px expanded, 64px collapsed (icones only)
- Toggle collapse : bouton hamburger en haut OU double-clic sur le bord
- Sections separees par dividers avec labels de section
- Items : icone (20px) + label (font-body-sm) + badge count optionnel
- Item actif : background `--color-primary-surface`, bord gauche 3px `--color-primary`
- Hover : background `--bg-surface`
- Scroll interne si contenu deborde
- Footer : avatar utilisateur + nom + statut

**Topbar :**
- Hauteur : 56px
- Contenu : Breadcrumbs (gauche) | Search bar (centre, 400px max) | Icons droite (Create +, Notifications bell, Softphone, Avatar)
- Background : `--bg-surface-raised`
- Border bottom : 1px `--border-default`

**Command Palette :**
- Trigger : Cmd+K (Mac) / Ctrl+K (Win)
- Overlay : modal centree, largeur 600px, max-height 480px
- Input en haut avec icone search
- Resultats groupes par categorie (Recent, Actions, Records, Pages, Settings)
- Navigation clavier (fleches + Enter)
- Raccourci visible a droite de chaque action

### 2. Tables de Donnees

**Fonctionnalites :**
- Tri : clic sur header → asc → desc → none (icone fleche)
- Filtres : barre de filtres au-dessus avec chips actifs. Filtres sauvegardables en "vues"
- Pagination : "1-50 of 1,234" + boutons prev/next + select page size (25, 50, 100)
- Inline edit : double-clic sur une cellule → mode edition (input inline). Save on blur/Enter
- Bulk actions : checkbox en premiere colonne. Toolbar contextuelle apparait en haut sur selection
- Colonnes fixes : premiere colonne (checkbox) et colonne nom toujours visibles en scroll horizontal
- Responsive : sur mobile, passage en vue "card list" au lieu de table
- Densite : mode compact (32px rows) vs standard (44px rows)
- Colonnes configurables : menu "Colonnes" pour show/hide et reorder par drag-and-drop
- Export : bouton export (CSV, Excel) dans la toolbar

### 3. Formulaires

**Composants :**
- Text input : label au-dessus, placeholder dans le champ, aide en dessous
- Select/dropdown : avec recherche integree si > 10 options
- Date picker : calendrier popup, formats localises, raccourcis (Aujourd'hui, Cette semaine)
- Toggle : switch pour les booleens (pas de checkbox quand un seul choix)
- Textarea : auto-resize, compteur de caracteres si limite
- File upload : zone drag-and-drop + bouton "Parcourir"
- Radio group : options verticales avec descriptions optionnelles

**Comportement :**
- Validation inline : erreur affichee sous le champ en rouge apres blur (pas en temps reel pendant la saisie)
- Auto-save : indicateur "Sauvegarde automatique" avec timestamp. Undo possible
- Champs conditionnels : sections qui apparaissent/disparaissent selon les valeurs saisies
- Required : asterisque rouge apres le label

### 4. Cards & Panels

- **KPI Card :** Label + Valeur grande + Sparkline + Variation % (vert/rouge)
- **Entity Card :** Avatar/thumbnail + Nom + 2-3 proprietes + Badge statut
- **Preview Panel :** Side panel 400px qui s'ouvre a droite sur clic dans une liste
- **Detail Panel :** Drawer complet (50-70% de la largeur) pour edition sans quitter la liste

### 5. Boutons & Actions

| Variant | Usage | Style |
|---------|-------|-------|
| Primary | Action principale (Save, Create, Send) | Background teal, text white, rounded-md |
| Secondary | Action secondaire (Cancel, Back) | Border teal, text teal, bg transparent |
| Tertiary | Action mineure (Skip, Later) | Text only, underline on hover |
| Danger | Action destructive (Delete, Remove) | Background red, text white |
| Icon button | Action avec icone seule (Edit, Copy, More) | Rond, background on hover |
| Split button | Action avec dropdown d'alternatives | Primary + dropdown chevron |
| Button group | Actions liees (View: Table | Kanban | Calendar) | Groupe avec un actif, autres inactifs |

### 6. Modals & Drawers

- **Confirmation modal :** Compact (400px), titre + message + 2 boutons (Cancel, Confirm)
- **Form modal :** Medium (560px), formulaire de creation rapide
- **Side drawer :** 480px de large, ouvre a droite, pour detail/edition sans quitter le contexte
- **Full-screen modal :** Pour les wizards multi-etapes (overlay sur toute la page avec steps en haut)
- **Overlay :** Fond sombre semi-transparent (#000 @ 40%). Click outside = ferme (sauf si unsaved changes)

### 7. Notifications & Toasts

- **Position :** Coin superieur droit, empilees vers le bas (max 3 visibles)
- **Variants :** Success (vert), Error (rouge), Warning (ambre), Info (bleu)
- **Avec action :** Bouton optionnel ("Undo", "View", "Retry")
- **Auto-dismiss :** 5 secondes pour success/info, persistant pour error/warning
- **Accessibilite :** role="alert", aria-live="polite"

### 8. Tags, Badges, Pills, Statuts

- **Tags :** Fond colore leger + texte fonce. Removable (X). Tailles : sm (20px h), md (24px h)
- **Badges :** Compteur numerique sur icone (notifications bell: 3). Forme ronde, fond rouge
- **Pills :** Status inline : Active (vert), Inactive (gris), Pending (ambre), Error (rouge)
- **Status dot :** Cercle colore 8px avant le label de statut

### 9. Graphiques & Data Viz

- **Library recommandee :** Recharts (React, composable, responsive) ou Tremor (pre-style pour enterprise)
- **Interactivite :** Hover = tooltip avec valeurs, Click = drill-down ou filtre
- **Responsive :** Les graphiques s'adaptent au container (pas de taille fixe)
- **Annotations :** Ligne de reference pour les targets/seuils, zone coloree pour les anomalies
- **Export :** Bouton pour exporter le graphique en PNG ou les donnees en CSV

### 10. Timeline d'Activites

- **Layout :** Ligne verticale a gauche, events a droite avec timestamp
- **Types :** Note (icone crayon), Email (icone enveloppe), Call (icone telephone), Meeting (icone calendrier), Change (icone fleche), Task (icone checkbox)
- **Filtres :** Chips en haut pour filtrer par type d'activite
- **Ajout inline :** Champ "Ajouter une note" en haut de la timeline
- **Pagination :** "Voir plus" en bas (lazy load, pas de pagination classique)

### 11-15. Search, Tabs, Avatars, Empty States, Skeleton Loaders

- **Search :** Input avec icone loupe. Debounce 300ms. Resultats groupes sous l'input
- **Tabs :** Horizontal, avec indicator bar sous le tab actif (animation slide). Sur mobile : scroll horizontal
- **Breadcrumbs :** Segments cliquables separes par ">". Dernier segment en bold non-cliquable
- **Avatars :** Cercle avec initiales si pas d'image. Tailles : xs(24), sm(32), md(40), lg(56). Badge de presence
- **Empty states :** Illustration legere + titre + description + CTA ("Creer votre premier contact")
- **Skeleton loaders :** Rectangles gris animes (pulse) reprenant la forme du contenu a venir. Pas de spinner plein ecran

---

## 6.3 Themes

### Implementation

```css
/* Classe sur <html> ou <body> */
.theme-light { /* tokens light mode */ }
.theme-dark { /* tokens dark mode */ }
.density-comfortable { /* espacements aeres */ }
.density-standard { /* espacements normaux */ }
.density-compact { /* espacements reduits */ }
```

| Theme | Background | Text | Accent | Usage |
|-------|-----------|------|--------|-------|
| **Light** | Cloud White `#FAFBFC` | Ink `#111827` | Teal 600 `#0D9488` | Mode par defaut, bureau eclaire |
| **Dark** | Void `#0B0F19` | Cloud `#F3F4F6` | Teal 400 `#2DD4BF` | Sessions longues, preference utilisateur |
| **Pro (Compact)** | Meme que Light/Dark | Meme | Meme | Espacement reduit, police 12px, plus de donnees |
| **Focus (Confort)** | Meme que Light/Dark | Meme | Meme | Espacement aere, police 14px, moins de colonnes |

**Switch :** Accessible depuis Menu utilisateur > Preferences > Apparence. Ou raccourci Ctrl+Shift+T pour toggle light/dark.

---

## 6.4 Principes Directeurs du Design System

### 1. Consistency-first
Meme pattern partout, zero exception injustifiee. Chaque nouveau composant doit etre valide par le design system avant integration. Si un module a besoin d'un pattern different, c'est le design system qui evolue, pas le module qui diverge.

### 2. Data-density-aware
Adapter la densite au contexte. Un tableau comptable de reconciliation n'a pas la meme densite qu'un dashboard marketing. Les 3 modes de densite (compact, standard, comfortable) permettent a chaque utilisateur de trouver son equilibre.

### 3. Mobile-first token scale
Tous les tokens fonctionnent de 320px (mobile) a 2560px (4K). Les breakpoints sont documentes. Les composants sont concu responsive-first avec adaptation automatique (table → card list, sidebar → bottom nav, modal → full-screen).

### 4. Accessibility non-negotiable
WCAG 2.2 AA minimum sur tous les composants :
- Contraste texte : 4.5:1 minimum (7:1 pour le mode high-contrast)
- Contraste elements interactifs : 3:1 minimum
- Navigation clavier complete (focus visible, tab order logique)
- Screen reader compatible (aria-labels, roles, live regions)
- Pas de "color only" indication (toujours icone + couleur, ou texte + couleur)
- Focus trap dans les modals
- Annonces live pour les toasts/notifications

### 5. Composable, not monolithic
Les composants sont atomiques et recombinables. Un "Record Page" n'est pas un composant monolithique - c'est une composition de : Header, TabGroup, PropertyPanel, Timeline, AssociationList, ActionBar. Chaque atome est reutilisable independamment dans d'autres contextes.

---

*Sources: IBM Carbon Design System (tokens, Carbon for AI), Salesforce SLDS 2/Cosmos (styling hooks, dark mode), Atlassian Design System (design tokens, 4px grid, sidebar navigation), Shopify Polaris (web components, data tables), Microsoft Fluent 2 (density modifier, dark mode), Google Material 3, Adobe Spectrum, WGSN/Coloro Transformative Teal 2026, Stripe Dashboard (visual design), Linear (density modes), Vercel (typography, performance).*

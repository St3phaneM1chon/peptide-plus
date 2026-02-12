# PLAN: Sante Entreprise — Business Health at a Glance

## Contexte

Le dashboard comptable actuel affiche 4 KPI basiques (tresorerie, CA, marge brute, benefice net) sans tendances reelles (MoM toujours a 0), un graphique revenue/depenses, et des alertes. Il manque une vue exhaustive de la sante de l'entreprise en un coup d'oeil.

**Objectif:** Creer une page dediee "Sante de l'entreprise" dans la section comptabilite qui agrege TOUS les indicateurs de sante business, organises en sections visuelles avec code couleur vert/jaune/rouge, tendances MoM reelles, et ratios financiers professionnels.

---

## ARCHITECTURE

### Nouveau fichier API: `src/app/api/accounting/business-health/route.ts`
Un seul endpoint GET qui calcule TOUT en parallele (Promise.all) pour minimiser la latence.

### Nouvelle page: `src/app/admin/comptabilite/sante-entreprise/page.tsx`
Dashboard visuel avec 8 sections thematiques.

### Navigation: `src/app/admin/comptabilite/layout.tsx`
Ajout lien "Sante Entreprise" dans la section "Vue d'ensemble".

---

## METRIQUES EXHAUSTIVES (8 categories, ~40 KPIs)

### 1. REVENUS & RENTABILITE (Revenue & Profitability)
| Metrique | Source | Calcul |
|---|---|---|
| Revenu du mois | `Order` (paymentStatus=PAID) | SUM(total) current month |
| Revenu mois precedent | `Order` | SUM(total) previous month |
| Croissance MoM % | derivee | ((current - prev) / prev) * 100 |
| Revenu YTD | `Order` | SUM(total) depuis Jan 1 |
| Marge brute % | `Order` + `JournalLine` (5xxx) | (Revenue - COGS) / Revenue |
| Marge operationnelle % | + `JournalLine` (6xxx) | (Revenue - COGS - OPEX) / Revenue |
| Marge nette % | complete | Net Profit / Revenue |
| Revenu par jour (run rate) | derivee | Revenue du mois / jours ecoules |
| Projection fin de mois | derivee | Run rate * jours dans le mois |
| Repartition par region | `Order` shippingCountry | CA/US/EU/Other en % |

### 2. COMMANDES & PANIER MOYEN (Orders & AOV)
| Metrique | Source | Calcul |
|---|---|---|
| Nb commandes du mois | `Order` | COUNT current month |
| Nb commandes mois precedent | `Order` | COUNT previous month |
| Croissance commandes MoM % | derivee | ((current - prev) / prev) * 100 |
| Panier moyen (AOV) | derivee | Revenue / Nb commandes |
| AOV mois precedent | derivee | idem previous month |
| Taux de remboursement % | `Order` paymentStatus | REFUNDED / total * 100 |
| Taux d'annulation % | `Order` status | CANCELLED / total * 100 |
| Nb re-expeditions | `Order` orderType=REPLACEMENT | COUNT current month |
| Commandes par statut | `Order` | GROUP BY status |

### 3. TRESORERIE & LIQUIDITE (Cash & Liquidity)
| Metrique | Source | Calcul |
|---|---|---|
| Position tresorerie | `BankAccount` | SUM(currentBalance) actifs |
| Ratio de liquidite generale | `ChartOfAccount` | Actifs courants / Passifs courants |
| Ratio de liquidite rapide | `ChartOfAccount` | (Actifs courants - Stocks) / Passifs courants |
| Jours de tresorerie | derivee | Cash / (OPEX mensuel / 30) |
| Burn rate mensuel | `JournalLine` (6xxx) | Total depenses du mois |
| Mois de runway | derivee | Cash / Burn rate |

### 4. COMPTES CLIENTS & FOURNISSEURS (AR/AP)
| Metrique | Source | Calcul |
|---|---|---|
| Comptes clients (AR) | `CustomerInvoice` | SUM(balance) status != PAID/CANCELLED |
| DSO (delai encaissement) | derivee | (AR / Revenue) * 30 |
| Factures en retard | `CustomerInvoice` | COUNT status=OVERDUE |
| Montant en retard | `CustomerInvoice` | SUM(balance) status=OVERDUE |
| Comptes fournisseurs (AP) | `SupplierInvoice` | SUM(balance) status != PAID/CANCELLED |
| DPO (delai paiement) | derivee | (AP / COGS) * 30 |
| Notes de credit emises | `CreditNote` | COUNT + SUM(total) current month |

### 5. INVENTAIRE & OPERATIONS (Inventory)
| Metrique | Source | Calcul |
|---|---|---|
| Valeur du stock | `ProductFormat` + `InventoryTransaction` | SUM(stockQuantity * runningWAC) |
| Rotation des stocks | derivee | COGS annualise / Valeur stock |
| Jours de stock (DIO) | derivee | 365 / Rotation |
| Articles en rupture | `ProductFormat` | COUNT stockQuantity <= 0 AND trackInventory |
| Articles stock faible | `ProductFormat` | COUNT stockQuantity <= lowStockThreshold |
| Pertes inventaire (mois) | `InventoryTransaction` type=LOSS | SUM(ABS(quantity) * unitCost) |
| Taux de perte % | derivee | Pertes / COGS * 100 |

### 6. FRAIS DE TRAITEMENT (Processing Costs)
| Metrique | Source | Calcul |
|---|---|---|
| Frais Stripe du mois | `JournalLine` account=6110 | SUM(debit) |
| Frais PayPal du mois | `JournalLine` account=6120 | SUM(debit) |
| Taux frais traitement % | derivee | (Stripe + PayPal) / Revenue * 100 |
| Frais expedition sortante | `JournalLine` account=6xxx shipping | SUM(debit) |
| Cout expedition par commande | derivee | Frais expedition / Nb commandes |

### 7. CONFORMITE FISCALE (Tax Compliance)
| Metrique | Source | Calcul |
|---|---|---|
| TPS percue (mois) | `Order` taxTps | SUM current month |
| TVQ percue (mois) | `Order` taxTvq | SUM current month |
| TVH percue (mois) | `Order` taxTvh | SUM current month |
| Total taxes percues | derivee | TPS + TVQ + TVH |
| Prochaine echeance | `TaxReport` | Prochain filing due |
| Statut declarations | `TaxReport` | Latest status |

### 8. CYCLE DE CONVERSION (Working Capital Cycle)
| Metrique | Source | Calcul |
|---|---|---|
| Fonds de roulement | derivee | Actifs courants - Passifs courants |
| Cycle de conversion cash | derivee | DSO + DIO - DPO |
| Score de sante global | derivee | Composite pondérée 0-100 |

---

## IMPLEMENTATION

### Fichier 1: `src/app/api/accounting/business-health/route.ts` (NOUVEAU)

```
GET /api/accounting/business-health
```

Executer ~15 requetes Prisma en Promise.all:
1. Orders current month (PAID) → revenue, count, taxes, by-region
2. Orders previous month (PAID) → revenue prev, count prev
3. Orders YTD → revenue YTD
4. Orders refunded/cancelled current month → refund rate
5. Orders REPLACEMENT current month → reship count
6. Orders by status current month → status breakdown
7. JournalLines EXPENSE current month → COGS + OPEX
8. JournalLines EXPENSE previous month → for MoM
9. BankAccounts active → cash position
10. CustomerInvoice outstanding → AR, overdue
11. SupplierInvoice outstanding → AP
12. ProductFormat with inventory → stock value, ruptures, low stock
13. InventoryTransaction LOSS current month → losses
14. CreditNote current month → credit note stats
15. GL balances for current/non-current assets & liabilities → ratios
16. TaxReport latest → compliance status
17. Stripe/PayPal fee lines current month → processing costs
18. Shipping expense lines current month → shipping costs

Retourne un objet JSON structure en 8 sections.

### Fichier 2: `src/app/admin/comptabilite/sante-entreprise/page.tsx` (NOUVEAU)

Layout de la page:
- **Header**: "Sante de l'entreprise" avec selecteur de periode et export
- **Score global**: Grand indicateur circulaire 0-100 avec couleur vert/jaune/rouge
- **Section 1**: 5 cartes Revenue (Revenue, MoM%, Marge brute, AOV, Projection)
- **Section 2**: Mini-tableau commandes (nb, croissance, refund rate, reship)
- **Section 3**: 3 cartes Tresorerie (Cash, Ratio liquidite, Runway)
- **Section 4**: 2 colonnes AR/AP avec barres de progression aging
- **Section 5**: Cartes inventaire (Valeur, Rotation, Ruptures, Pertes)
- **Section 6**: Barre horizontale frais traitement + shipping
- **Section 7**: Resume fiscal compact
- **Section 8**: Fonds de roulement + Cycle conversion cash

Code couleur universel:
- Vert: Sain (marge > 30%, ratio > 2, DSO < 30, runway > 6 mois)
- Jaune: Attention (marge 15-30%, ratio 1-2, DSO 30-60, runway 3-6 mois)
- Rouge: Critique (marge < 15%, ratio < 1, DSO > 60, runway < 3 mois)

Composant `HealthIndicator` reutilisable:
```tsx
// Mini composant: label, valeur, sous-valeur, couleur (green/yellow/red), icone optionnelle
```

Composant `HealthGauge` pour le score global:
```tsx
// Cercle SVG avec score 0-100, couleur dynamique
```

### Fichier 3: `src/app/admin/comptabilite/layout.tsx` (MODIFIE)
Ajouter dans la section "Vue d'ensemble":
```
{ name: 'Sante Entreprise', href: '/admin/comptabilite/sante-entreprise', icon: 'trending' },
```

---

## SCORE DE SANTE GLOBAL (0-100)

Formule composite ponderee:

| Critere | Poids | Score 100 | Score 50 | Score 0 |
|---|---|---|---|---|
| Marge brute % | 20% | > 40% | 20-40% | < 20% |
| Croissance MoM | 10% | > 10% | 0-10% | < 0% |
| Ratio liquidite | 15% | > 2.0 | 1.0-2.0 | < 1.0 |
| Runway (mois) | 15% | > 12 | 3-12 | < 3 |
| DSO (jours) | 10% | < 15 | 15-45 | > 45 |
| Taux remboursement | 10% | < 2% | 2-5% | > 5% |
| Ruptures stock | 10% | 0 | 1-3 | > 3 |
| Taux perte inventaire | 10% | < 0.5% | 0.5-2% | > 2% |

---

## FICHIERS MODIFIES/CREES

| Fichier | Action |
|---|---|
| `src/app/api/accounting/business-health/route.ts` | **NOUVEAU** — API calcul ~40 KPIs |
| `src/app/admin/comptabilite/sante-entreprise/page.tsx` | **NOUVEAU** — Page dashboard sante |
| `src/app/admin/comptabilite/layout.tsx` | +lien navigation Sante Entreprise |

---

## VERIFICATION

1. `npm run build` — Build sans erreurs
2. Page `/admin/comptabilite/sante-entreprise` accessible
3. API retourne toutes les metriques sans erreur 500
4. Score de sante calcule correctement
5. Code couleur applique selon les seuils
6. MoM reels calcules (plus de 0% en dur)

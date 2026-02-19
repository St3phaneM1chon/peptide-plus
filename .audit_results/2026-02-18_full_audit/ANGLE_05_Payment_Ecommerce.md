Excellent. I now have a comprehensive picture of the entire e-commerce and payment system. Let me compile the full audit.

---

# AUDIT EXHAUSTIF - Systeme de Paiement et E-Commerce

## Projet: peptide-plus (BioCycle Peptides)
## Date: 2026-02-18
## Auditeur: Expert E-Commerce & Paiements

---

## 1. STRIPE INTEGRATION

**Score: 8/10**

**Points forts:**
- Verification de signature webhook correcte avec `stripe.webhooks.constructEvent()` (`/Volumes/AI_Project/peptide-plus/src/app/api/payments/webhook/route.ts:88`)
- Idempotence implementee via `WebhookEvent` model avec statuts PROCESSING/COMPLETED/FAILED (lignes 27-78)
- Validation server-side des prix depuis la DB -- les prix client ne sont JAMAIS approuves directement (`create-checkout/route.ts:8-9`, lignes 117-164)
- Gestion des erreurs de webhook avec failWebhookEvent() et logging structure (lignes 69-78)
- Support multi-devises avec taux de change stockes en metadata (lignes 82-110)
- Reservation d'inventaire AVANT la creation de la session Stripe (lignes 207-247)
- Ecritures comptables automatiques non-bloquantes (lignes 332-349)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 1.1 | **RACE CONDITION sur orderNumber**: `prisma.order.count()` + increment n'est PAS atomique. Deux webhooks simultanes peuvent generer le meme numero de commande `PP-{year}-000042` | `webhook/route.ts:191-194` | **CRITICAL** |
| 1.2 | **Nova Scotia HST rate inconsistance**: `create-checkout/route.ts:27` dit NS=0.15, mais `accounting/types.ts:102` dit NS=0.14, et `canadianTaxes.ts:67` dit NS=0.14. Le taux reel 2024 est 0.15 (passe de 0.14 a 0.15). | `create-checkout/route.ts:27` vs `types.ts:102` | **HIGH** |
| 1.3 | **cartItems metadata tronque a []**: Si les items du panier depassent 490 chars, ils sont serialises en `[]`, ce qui fait que la commande sera creee SANS items dans le webhook | `create-checkout/route.ts:345-347` | **HIGH** |
| 1.4 | **Discount applique comme reduction proportionnelle line items au lieu de Stripe Coupons**: Le code fait `lineItems.pop()` puis redistribue la reduction proportionnellement. Cela peut creer des arrondis qui ne matchent pas Stripe | `create-checkout/route.ts:264-289` | **MEDIUM** |
| 1.5 | **API version figee**: `apiVersion: '2023-10-16'` -- Plus de 2 ans de retard sur les API Stripe | `webhook/route.ts:19` | **LOW** |

**Risques financiers:**
- Race condition sur orderNumber: Deux commandes pourraient avoir le meme numero, corrompant la comptabilite
- Taux NS incoherent: 1% de difference sur les ventes en Nouvelle-Ecosse = erreur fiscale declarable

---

## 2. PAYPAL INTEGRATION

**Score: 7.5/10**

**Points forts:**
- Webhook PayPal avec verification de signature via API PayPal (`/Volumes/AI_Project/peptide-plus/src/app/api/webhooks/paypal/route.ts:25-89`)
- Idempotence via WebhookEvent model (lignes 109-127)
- Support des 3 evenements cles: COMPLETED, REFUNDED, DENIED
- Capture flow avec validation serveur des prix (`paypal/create-order/route.ts:56-98`)
- Commission ambassadeur creee dans le webhook PayPal aussi (lignes 234-241)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 2.1 | **RACE CONDITION sur orderNumber**: Meme probleme que Stripe -- `prisma.order.count()` non atomique | `paypal/capture/route.ts:117-121` | **CRITICAL** |
| 2.2 | **Taxes non calculees cote serveur dans PayPal create-order**: Le total PayPal = serverSubtotal seulement (`serverTotal = serverSubtotal`), les taxes ne sont PAS ajoutees | `paypal/create-order/route.ts:101` | **CRITICAL** |
| 2.3 | **PayPal capture accepte taxBreakdown du CLIENT**: Dans `capture/route.ts:111-114`, les taxes `taxTps`, `taxTvq`, `taxTvh` viennent du body de la requete client, pas d'un calcul serveur | `paypal/capture/route.ts:111-114` | **HIGH** |
| 2.4 | **Deux routes PayPal create dupliquees**: `/payments/paypal/create/route.ts` (legacy, single product) et `/payments/paypal/create-order/route.ts` (cart) coexistent. La route legacy hardcode `DIGITAL_GOODS`, `brand_name: 'Formations Pro'` | `paypal/create/route.ts:106` | **MEDIUM** |
| 2.5 | **PayPal capture: pas de reservation d'inventaire pre-paiement**: Le stock n'est pas reserve avant le paiement PayPal dans `create-order`, contrairement au flow Stripe | `paypal/create-order/route.ts` | **MEDIUM** |
| 2.6 | **Pas de promo code per-user limit check dans PayPal capture**: Stripe webhook verifie `maxUsesPerUser`, mais PayPal capture fait juste `updateMany` incrementant le compteur | `paypal/capture/route.ts:224-229` | **MEDIUM** |

**Risques financiers:**
- PayPal sans taxes = perte de 5-15% de revenu fiscal sur chaque commande PayPal
- Client peut envoyer des taxes = 0 dans la capture et recevoir un prix sans taxes

---

## 3. CART SYSTEM

**Score: 7/10**

**Points forts:**
- Panier persiste en localStorage avec cle `biocycle-cart` (`/Volumes/AI_Project/peptide-plus/src/contexts/CartContext.tsx:37`)
- Synchronisation cross-tab via StorageEvent (lignes 65-77)
- Maximum de quantite respecte (`maxQuantity || 99`) (lignes 91-94)
- Callbacks memoises avec useCallback (lignes 83, 105, 114, 129)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 3.1 | **Pas de validation de stock cote client au moment de l'ajout**: Le prix et la disponibilite ne sont pas verifies lors du `addItem`. L'utilisateur peut ajouter 99 unites d'un produit en stock 2 | `CartContext.tsx:83-103` | **MEDIUM** |
| 3.2 | **Prix stockes cote client non-verifies periodiquement**: Si un prix change apres l'ajout au panier, le client voit l'ancien prix. La correction se fait seulement au checkout serveur | `CartContext.tsx:81` | **MEDIUM** |
| 3.3 | **Pas de TTL/expiration du panier**: Un panier peut rester en localStorage indefiniment avec des produits desactives ou des prix obsoletes | `CartContext.tsx` | **LOW** |
| 3.4 | **Pas d'identifiant unique de panier (cartId) genere dans le contexte**: Le cartId est fourni par le checkout mais n'est pas genere automatiquement | `CartContext.tsx` | **LOW** |

---

## 4. CHECKOUT FLOW

**Score: 8/10**

**Points forts:**
- Toutes les validations sont faites cote serveur: prix, taxes, shipping, promo codes (`create-checkout/route.ts:8-9`)
- Calcul des taxes canadiennes correct avec support GST/PST/HST/QST (lignes 22-41)
- Calcul du shipping dynamique selon le pays et le type de produit (lignes 44-53)
- Reservation d'inventaire avec TTL 30 minutes (lignes 207-247)
- Liberation automatique des reservations en cas d'erreur (lignes 236-242)
- Support multi-devises avec conversion correcte (lignes 82-110)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 4.1 | **Checkout Stripe permet les guests**: Pas d'authentification requise -- `session?.user?.id || 'guest'` -- mais le panier n'est pas lie a un utilisateur pour les guests | `create-checkout/route.ts:369` | **MEDIUM** |
| 4.2 | **Pas de CSRF token verifie dans le POST checkout**: Bien qu'un middleware CSRF existe (`csrf-middleware.ts`), la route est `force-dynamic` sans verification apparente | `create-checkout/route.ts:1` | **MEDIUM** |
| 4.3 | **Pas de rate limiting sur la creation de session Stripe**: Un attaquant pourrait creer des milliers de sessions pour bloquer l'inventaire (30 min par reservation) | `create-checkout/route.ts` | **HIGH** |
| 4.4 | **create-intent hardcode QC taxes**: L'ancien endpoint `create-intent/route.ts` calcule toujours TPS+TVQ de Quebec, ignorant la province du client | `create-intent/route.ts:36-38` | **HIGH** |

---

## 5. ORDER MANAGEMENT

**Score: 7.5/10**

**Points forts:**
- Statuts de commande bien definis: PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED -> CANCELLED
- Timestamps automatiques (shippedAt, deliveredAt) (admin/orders/[id]/route.ts:215-221)
- Support des commandes de remplacement avec lien parent/enfant (`parentOrderId`, `replacementReason`)
- Recherche, filtrage, pagination implementes (admin/orders/route.ts:22-83)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 5.1 | **RACE CONDITION sur orderNumber (repetee)**: Utilise `count() + 1` dans 3 endroits differents (webhook Stripe, capture PayPal, webhook PayPal) sans verrouillage | `webhook/route.ts:191`, `paypal/capture/route.ts:118`, `webhooks/paypal/route.ts` | **CRITICAL** |
| 5.2 | **Pas de validation de transitions de statut**: Un admin peut passer DELIVERED -> PENDING sans restriction logique | `admin/orders/route.ts:135-141` | **MEDIUM** |
| 5.3 | **Reship order number aussi vulnerable**: Le reship utilise `findFirst(orderBy: desc)` + parse du numero, race condition possible | `admin/orders/[id]/route.ts:597-603` | **MEDIUM** |
| 5.4 | **Cancel client ne fait PAS de refund reel**: `account/orders/[id]/cancel/route.ts:108-141` met le statut a REFUNDED mais laisse un commentaire "Refund will be processed manually" -- AUCUN appel a Stripe/PayPal | `account/orders/[id]/cancel/route.ts:107-141` | **HIGH** |

**Risques financiers:**
- Le cancel client marque "REFUNDED" sans rembourser reellement: le client croit etre rembourse mais ne l'est pas

---

## 6. INVENTORY MANAGEMENT

**Score: 8.5/10**

**Points forts:**
- Systeme de reservation avec TTL (`/Volumes/AI_Project/peptide-plus/src/lib/inventory/inventory.service.ts:13-65`)
- Transaction Prisma pour la reservation atomique -- empeche les surventes (lignes 21-64)
- Verification du stock disponible = stock physique - reservations actives (lignes 33-47)
- Weighted Average Cost (WAC) correctement calcule a chaque achat (lignes 152-217)
- Transactions de type SALE, PURCHASE, RETURN, ADJUSTMENT, LOSS toutes traquees
- COGS genere automatiquement avec double-entree correcte (lignes 271-349)
- Cron job pour liberer les reservations expirees (`cron/release-reservations/route.ts`)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 6.1 | **Stock peut devenir negatif**: Pas de contrainte `CHECK(stockQuantity >= 0)` en DB. Le `decrement` Prisma peut descendre sous zero | `inventory.service.ts:114-119` | **HIGH** |
| 6.2 | **consumeReservation fait une transaction PAR reservation**: Pas batch atomique -- si une echoue, les precedentes sont consommees | `inventory.service.ts:105-146` | **MEDIUM** |
| 6.3 | **Cron release-reservations ne verifie que `CRON_SECRET`**: Pas de rate limiting ni de verification IP source | `cron/release-reservations/route.ts:13-16` | **LOW** |
| 6.4 | **checkout create-checkout reserve stock HORS transaction**: Les reservations individuelles ne sont pas dans un `$transaction` comme dans `inventory.service.ts` | `create-checkout/route.ts:208-247` | **HIGH** |

---

## 7. REFUNDS & RETURNS

**Score: 8.5/10**

**Points forts:**
- Admin refund supporte Stripe ET PayPal avec appel reel a l'API de chaque provider (`/Volumes/AI_Project/peptide-plus/src/app/api/admin/orders/[id]/route.ts:350-428`)
- Refund partiel ET complet supportes (lignes 348, 431)
- Ecritures comptables de remboursement generees automatiquement avec reversal des taxes proportionnel (lignes 430-446)
- Credit Note formelle creee avec numero sequentiel NC-{year}-{seq} (lignes 498-526)
- Stock restaure pour les remboursements complets (lignes 461-496)
- Return request flow avec verification: 30 jours, order DELIVERED, pas de doublon (`account/returns/route.ts:119-153`)
- Email de remboursement envoye en fire-and-forget (lignes 528-533)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 7.1 | **Cancel client (route client) ne fait PAS de refund reel**: Deja note en 5.4, mais c'est un risque financier majeur | `account/orders/[id]/cancel/route.ts:107-141` | **CRITICAL** |
| 7.2 | **Partial refund PayPal hardcode CAD**: `currency_code: 'CAD'` au lieu d'utiliser la devise de la commande | `admin/orders/[id]/route.ts:404` | **MEDIUM** |
| 7.3 | **Pas de COGS reversal sur refund complet**: Le stock est restaure mais l'ecriture COGS de la vente n'est pas inversee | `webhook/route.ts:541-572` | **MEDIUM** |
| 7.4 | **Webhook Stripe refund: la restauration stock n'est PAS dans une transaction**: Operations individuelles hors `$transaction` | `webhook/route.ts:543-571` | **MEDIUM** |

---

## 8. PROMO CODES & DISCOUNTS

**Score: 8/10**

**Points forts:**
- Validation serveur complete: date debut/fin, limite d'usage globale, montant minimum, plafond de reduction (`/Volumes/AI_Project/peptide-plus/src/app/api/promo/validate/route.ts`)
- Support PERCENTAGE et FIXED_AMOUNT (`validate/route.ts:72-79`)
- Max discount pour les pourcentages (ligne 76-78)
- Tracking des usages par utilisateur dans `PromoCodeUsage` (webhook `route.ts:366-398`)
- Verification per-user limit dans le webhook Stripe (webhook `route.ts:368`)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 8.1 | **Per-user limit NON verifiee dans PayPal capture**: Le webhook PayPal fait simplement `updateMany` increment sans verifier `maxUsesPerUser` | `paypal/capture/route.ts:224-229` | **HIGH** |
| 8.2 | **Validate endpoint ne verifie PAS le per-user limit**: L'API `/promo/validate` ne prend pas de userId en parametre et ne verifie pas combien de fois l'utilisateur l'a deja utilise | `promo/validate/route.ts` | **MEDIUM** |
| 8.3 | **Promo code usage track APRES la creation de commande**: Si deux commandes sont traitees en parallele, le meme code pourrait etre applique deux fois | `webhook/route.ts:362-398` | **MEDIUM** |
| 8.4 | **Ambassador referral code confondu avec promo code**: Si un code ambassadeur est aussi un code promo, les deux systemes s'executent | `webhook/route.ts:362-440` | **LOW** |

---

## 9. AMBASSADOR SYSTEM

**Score: 7.5/10**

**Points forts:**
- Commissions calculees automatiquement dans les webhooks Stripe et PayPal
- Upsert pour eviter les doublons (idempotent) (`webhook/route.ts:411-427`)
- Sync retroactive des commissions manquantes (`ambassadors/route.ts:99-153`)
- Support des tiers (BRONZE, SILVER, etc.) et statuts (ACTIVE/INACTIVE)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 9.1 | **Commission = `Math.round(total * rate) / 100`**: Si `commissionRate` = 10 (pour 10%), le calcul fait `total * 10 / 100 = total * 0.10`. MAIS si `rate` est deja en decimal (0.10), ca donne `total * 0.10 / 100 = total * 0.001`. Ambiguite sur le format | `webhook/route.ts:409` | **HIGH** |
| 9.2 | **Pas d'API de payout**: Les commissions sont traquees mais il n'y a aucun endpoint pour marquer les payouts comme effectues ou initier un virement | `ambassadors/route.ts` | **MEDIUM** |
| 9.3 | **syncCommissionsForCodes s'execute a CHAQUE GET /api/ambassadors**: Cela fait potentiellement des dizaines de requetes DB a chaque chargement de la page admin | `ambassadors/route.ts:32-35` | **MEDIUM** |
| 9.4 | **Pas de recalcul de commission si commande remboursee**: Un refund ne clawback pas la commission ambassadeur | `admin/orders/[id]/route.ts:297-558` | **HIGH** |

**Risques financiers:**
- Si l'ambassadeur gagne 10% sur une commande de 200$ refundee, on perd 20$ de commission non-recuperee
- Ambiguite sur rate format: potentielle sous ou sur-evaluation des commissions

---

## 10. ACCOUNTING

**Score: 9/10**

**Points forts:**
- Plan comptable complet conforme NCECF Quebec (`/Volumes/AI_Project/peptide-plus/src/lib/accounting/types.ts`)
- 47 comptes couvrant actifs, passifs, capitaux propres, revenus, CMV, charges
- Journal entries auto-generees pour: vente, frais Stripe/PayPal, COGS, remboursement, perte inventaire
- Double-entree verifiee: validation `totalDebits === totalCredits` dans les entries manuelles (entries/route.ts:136)
- Multi-devises avec taux de change stocke sur chaque ecriture (webhook-accounting.service.ts:151-153)
- Factures client automatiques avec items detailles (lignes 332-381)
- Credit notes formelles pour les remboursements (lignes 490-533)
- Entries recurrentes avec templates predefinies (recurring-entries.service.ts)
- Reconciliation bancaire, rapports PDF, compliance fiscale, aging -- services complets

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 10.1 | **RACE CONDITION sur entryNumber**: `getNextEntryNumber()` utilise `count() + 1`, meme probleme que pour orderNumber | `webhook-accounting.service.ts:70-77` | **HIGH** |
| 10.2 | **Fees estimes (2.9% + 0.30$) pas reconcilies**: Les frais Stripe/PayPal sont estimes, pas les vrais montants. Le commentaire dit "will be reconciled" mais je ne vois pas de reconciliation automatique | `webhook-accounting.service.ts:282-287` | **MEDIUM** |
| 10.3 | **Recurring entries templates sont en memoire (mock data)**: `getRecurringTemplates()` retourne des donnees hardcodees, pas de la DB | `recurring-entries.service.ts:98-161` | **MEDIUM** |
| 10.4 | **PST manquante dans create-checkout**: Les provinces BC, SK, MB ont de la PST mais le checkout ne la calcule pas separement -- elle est incluse dans le "tps" pour BC/SK/MB mais etiquetee comme TPS | `create-checkout/route.ts:22-41` | **MEDIUM** |

---

## 11. LOYALTY PROGRAM

**Score: 7/10**

**Points forts:**
- 5 tiers (BRONZE -> DIAMOND) avec calcul automatique (`/Volumes/AI_Project/peptide-plus/src/app/api/loyalty/route.ts:13-19`)
- Earn points pour: PURCHASE, SIGNUP, REVIEW, REFERRAL, BIRTHDAY, BONUS (`loyalty/earn/route.ts:13-19`)
- Protection anti-fraude: seul le SIGNUP est self-service; les autres types requierent admin (lignes 47-51)
- Verification du doublon de bonus signup (lignes 86-97)
- Points de purchase expirent apres 1 an (ligne 159)
- Redemption genere un PromoCode a usage unique valide 90 jours (`loyalty/redeem/route.ts:101-118`)
- Config admin persiste dans DB via SiteSetting (admin/loyalty/config/route.ts)

**Problemes trouves:**

| # | Probleme | Fichier:Ligne | Severite |
|---|---------|---------------|----------|
| 11.1 | **Tier thresholds INCOHERENTS entre earn et config**: `earn/route.ts` utilise 500/2000/5000/10000 pour SILVER/GOLD/PLATINUM/DIAMOND, mais `admin/loyalty/config` definit 1000/5000/15000/50000 | `earn/route.ts:22-28` vs `config/route.ts:39-42` | **HIGH** |
| 11.2 | **Earn purchase: pas de lien automatique avec la commande payee**: Le endpoint `/loyalty/earn` est un POST separe, pas appele automatiquement dans le webhook de paiement | `loyalty/earn/route.ts` | **HIGH** |
| 11.3 | **Pas de CRON pour expirer les points**: L'expiration est stockee (`expiresAt`) mais aucun job ne deduit les points expires du solde | `loyalty/earn/route.ts:159` | **MEDIUM** |
| 11.4 | **Redeem: race condition sur le solde de points**: Deux redemptions simultanees pourraient dedier plus de points que disponibles (`loyaltyPoints < reward.points` check + update non-atomique) | `loyalty/redeem/route.ts:60-98` | **MEDIUM** |
| 11.5 | **Referral POST endpoint pas protege**: N'importe qui peut appeler `/api/referrals/qualify` sans authentification (pas de `auth()` check dans le POST handler) | `referrals/qualify/route.ts:147-180` | **HIGH** |

---

## TOP 5 RISQUES FINANCIERS/BUSINESS CRITIQUES

### 1. RACE CONDITION sur les numeros de commande -- RISQUE FINANCIER ELEVE
**Fichiers**: `webhook/route.ts:191-194`, `paypal/capture/route.ts:117-121`, `webhook-accounting.service.ts:70-77`
**Impact**: Deux commandes simultanees (Black Friday, flash sale) pourraient obtenir le meme numero `PP-2026-000042`. Cela corrompt les rapports comptables, les declarations de taxes, les factures client, et rend le rapprochement bancaire impossible.
**Correction**: Utiliser une sequence PostgreSQL (`CREATE SEQUENCE order_seq`) ou un compteur atomique (`UPDATE ... RETURNING`).

### 2. CANCEL CLIENT ne fait PAS de remboursement reel -- RISQUE JURIDIQUE
**Fichier**: `/Volumes/AI_Project/peptide-plus/src/app/api/account/orders/[id]/cancel/route.ts:107-141`
**Impact**: Le statut passe a "REFUNDED" et le client recoit un email de confirmation de remboursement, mais AUCUN appel a Stripe ou PayPal n'est effectue. Le client peut deposer une plainte pour fraude ou initier un chargeback, ce qui coute des frais supplementaires (15-25$ par chargeback).
**Correction**: Appeler `stripe.refunds.create()` ou l'API PayPal refund avant de marquer REFUNDED.

### 3. PayPal create-order ne calcule PAS les taxes -- PERTE DE REVENU FISCAL
**Fichier**: `/Volumes/AI_Project/peptide-plus/src/app/api/payments/paypal/create-order/route.ts:101`
**Impact**: Le total PayPal = subtotal uniquement. Pour une commande de 200$ au Quebec, les taxes TPS+TVQ de ~30$ sont perdues. Sur le volume PayPal, cela represente une perte directe.
**Correction**: Ajouter le calcul `calculateServerTaxes()` et `calculateServerShipping()` comme dans Stripe checkout.

### 4. Commissions ambassadeur non-clawbackees sur refund -- PERTE NETTE
**Fichiers**: `webhook/route.ts:401-440`, `admin/orders/[id]/route.ts:297-558`
**Impact**: Si un client utilise un code ambassadeur, paie, puis se fait rembourser, la commission de 10% n'est jamais recuperee. Sur un volume de refund de 5000$/mois, c'est 500$ de perte.
**Correction**: Dans le handleRefund, ajouter un clawback de la commission (`paidOut: false`).

### 5. PayPal capture accepte les taxes du CLIENT -- MANIPULATION DE PRIX
**Fichier**: `/Volumes/AI_Project/peptide-plus/src/app/api/payments/paypal/capture/route.ts:111-114`
**Impact**: Un attaquant peut envoyer `taxBreakdown: { tps: 0, tvq: 0, tvh: 0 }` dans le body, et la commande sera enregistree sans taxes. Le total PayPal est verifie, mais les taxes en base seront a zero, faussant la comptabilite.
**Correction**: Calculer les taxes cote serveur dans le capture, comme dans Stripe checkout.

---

## SCORE GLOBAL

| Composant | Score | Poids |
|-----------|-------|-------|
| 1. Stripe Integration | 8/10 | 15% |
| 2. PayPal Integration | 7.5/10 | 12% |
| 3. Cart System | 7/10 | 8% |
| 4. Checkout Flow | 8/10 | 12% |
| 5. Order Management | 7.5/10 | 10% |
| 6. Inventory Management | 8.5/10 | 10% |
| 7. Refunds & Returns | 8.5/10 | 10% |
| 8. Promo Codes | 8/10 | 5% |
| 9. Ambassador System | 7.5/10 | 5% |
| 10. Accounting | 9/10 | 8% |
| 11. Loyalty Program | 7/10 | 5% |

## **SCORE GLOBAL: 79/100**

**Resume**: Le systeme est solide dans son architecture avec de bonnes pratiques (validation serveur, idempotence, transactions Prisma, comptabilite double-entree). Les faiblesses principales sont: (1) les race conditions sur la generation de numeros sequentiels, (2) l'incoherence PayPal vs Stripe sur le calcul des taxes, (3) le cancel client sans refund reel, et (4) l'absence de clawback des commissions ambassadeur. Ces 4 points representent les risques financiers les plus urgents a corriger.
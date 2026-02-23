# Audit Expert Comptabilite - 100 Failles + 100 Ameliorations
# Date: 2026-02-22
# Projet: peptide-plus (BioCycle Peptides)
# Scope: Toute la section Comptabilite (API, services, Prisma, pages admin)

---

## Resume Executif

| Categorie | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-----------|----------|------|--------|-----|-------|
| Failles/Bugs | 18 | 32 | 35 | 15 | 100 |
| Ameliorations | 12 | 28 | 38 | 22 | 100 |
| **TOTAL** | **30** | **60** | **73** | **37** | **200** |

### Top 5 Risques Critiques
1. **Hardcoded tax approximation in Stripe sync** - Calculs financiers faux (0.87 multiplier)
2. **Race condition generateExpenseNumber()** - Doublons de numeros de depenses
3. **roundCurrency() n'est pas un banker's rounding** - Erreurs d'arrondi systematiques
4. **In-memory COA cache ne survit pas aux instances serverless** - Cache incoherent
5. **Nova Scotia HST rate wrong** - 14% au lieu de 15% (effectif 2025-04-01 mais NS a change)

### Fichiers Audites
- **API Routes**: 15 fichiers dans `src/app/api/accounting/`
- **Services**: 33 fichiers dans `src/lib/accounting/`
- **Utilitaires**: `src/lib/financial.ts`, `src/lib/accounting/types.ts`, `src/lib/accounting/validation.ts`
- **Schema Prisma**: ~22 modeles comptables dans `prisma/schema.prisma`
- **Pages Admin**: 32 pages dans `src/app/admin/comptabilite/`

---

# PARTIE 1: 100 FAILLES / BUGS

---

## F001 [CRITICAL] Hardcoded tax approximation in Stripe sync
- **Fichier**: `src/lib/accounting/stripe-sync.service.ts:124-128`
- **Description**: Le calcul du sous-total et des taxes utilise un multiplicateur magique `0.87` pour approximer le montant hors-taxes a partir du montant Stripe. Ceci est mathematiquement incorrect pour toutes les provinces sauf le Quebec (14.975%).
- **Impact**: Les ecritures comptables generees par Stripe ont des montants de vente et de TPS/TVQ incorrects. Cela fausse les declarations de taxes.
- **Fix suggere**: Stocker la province/taux de taxe dans les metadonnees Stripe lors du paiement, puis recalculer avec le vrai taux: `subtotal = charge.amount / (1 + taxRate)`.

## F002 [CRITICAL] Race condition dans generateExpenseNumber()
- **Fichier**: `src/app/api/accounting/expenses/route.ts:39-57`
- **Description**: La generation du numero de depense utilise `findFirst` + `orderBy` hors transaction, sans `SELECT FOR UPDATE`. Deux requetes concurrentes peuvent obtenir le meme numero.
- **Impact**: Doublons de numeros de depenses, violation d'unicite potentielle.
- **Fix suggere**: Deplacer dans un `prisma.$transaction` avec `$queryRaw` et `FOR UPDATE` comme fait dans `entries/route.ts`.

## F003 [CRITICAL] roundCurrency() pretend faire du banker's rounding mais ne le fait pas
- **Fichier**: `src/lib/financial.ts:8-12`
- **Description**: Le commentaire dit "banker's rounding" mais utilise `Math.round(amount * 100) / 100`. `Math.round(0.5)` retourne 1, pas 0 (banker's rounding arrondit 0.5 au pair le plus proche).
- **Impact**: Erreurs d'arrondi cumulatives sur des milliers de transactions, ecart par rapport aux normes comptables.
- **Fix suggere**: Implementer un vrai banker's rounding ou utiliser `Decimal.js` avec `ROUND_HALF_EVEN`.

## F004 [CRITICAL] In-memory COA cache inutile en serverless
- **Fichier**: `src/app/api/accounting/chart-of-accounts/route.ts:8-13`
- **Description**: Le cache du plan comptable est stocke dans une variable module-level avec TTL de 5 min. En environnement serverless (Azure App Service avec cold starts), chaque instance a son propre cache, menant a des lectures obsoletes.
- **Impact**: Un compte desactive dans une instance peut apparaitre actif dans une autre.
- **Fix suggere**: Utiliser un cache Redis/externe, ou supprimer le cache et compter sur les indexes DB.

## F005 [CRITICAL] NS HST rate potentiellement incorrect
- **Fichier**: `src/lib/accounting/types.ts` (TAX_RATES) et `src/lib/accounting/canadian-tax-config.ts:33`
- **Description**: La config NS montre `hstRate: 14` dans types.ts mais `hstRate: 14` dans canadian-tax-config.ts avec `effectiveDate: '2025-04-01'`. La NS a effectivement baisse de 15% a 14% le 1er avril 2025 - mais la config dans types.ts montre 0.14 pour toutes les dates, sans gestion de la date d'effectivite.
- **Impact**: Calculs de TVH potentiellement faux pour les transactions avant avril 2025.
- **Fix suggere**: Ajouter un champ `effectiveDate` dans TAX_RATES de types.ts et utiliser la date de transaction pour selectionner le bon taux.

## F006 [CRITICAL] Due date GST/QST differs between GET and POST
- **Fichier**: `src/app/api/accounting/gst-qst-declaration/route.ts`
- **Description**: Le GET calcule la date d'echeance comme `periodEnd + 1 mois` tandis que le POST utilise `periodEnd + 2 mois`. L'utilisateur voit une echeance differente de celle enregistree.
- **Impact**: Risque de retard de paiement fiscal, penalites de l'ARC/RQ.
- **Fix suggere**: Centraliser le calcul de la due date dans une fonction utilitaire partagee.

## F007 [CRITICAL] Stripe sync hardcoded tax calculation for refunds too
- **Fichier**: `src/lib/accounting/stripe-sync.service.ts:223-224`
- **Description**: Meme probleme que F001 pour les remboursements: `refund.amount * 0.87` et `* 0.05 * 0.87` pour la TPS.
- **Impact**: Ecritures de remboursement avec montants de taxes incorrects.
- **Fix suggere**: Voir F001 - stocker les taxes originales et utiliser pour le remboursement.

## F008 [CRITICAL] Float utilise pour ccaRate au lieu de Decimal
- **Fichier**: `prisma/schema.prisma` (models ChartOfAccount et FixedAsset)
- **Description**: Le champ `ccaRate Float?` utilise le type Float pour un taux financier. IEEE 754 floats ne peuvent pas representer 0.055 exactement.
- **Impact**: Erreurs de precision dans les calculs d'amortissement fiscal (CCA).
- **Fix suggere**: Changer en `Decimal` dans le schema Prisma.

## F009 [CRITICAL] No FK constraint on BankTransaction.matchedEntryId
- **Fichier**: `prisma/schema.prisma` (model BankTransaction)
- **Description**: Le champ `matchedEntryId String?` est un simple string sans contrainte de cle etrangere vers JournalEntry. Un matchedEntryId peut pointer vers une ecriture supprimee.
- **Impact**: Integrite referentielle brisee, rapprochements orphelins.
- **Fix suggere**: Ajouter `@relation(fields: [matchedEntryId], references: [id])` avec une relation vers JournalEntry.

## F010 [CRITICAL] Stripe API pagination missing
- **Fichier**: `src/lib/accounting/stripe-sync.service.ts`
- **Description**: L'appel a `stripe.charges.list({ limit: 100 })` ne gere pas la pagination. Stripe retourne max 100 resultats par appel.
- **Impact**: Perte de transactions si plus de 100 charges dans la periode de sync.
- **Fix suggere**: Implementer `has_more` / `starting_after` auto-pagination.

## F011 [CRITICAL] generateStripePayoutEntry() uses wrong journal entry type
- **Fichier**: `src/lib/accounting/auto-entries.service.ts`
- **Description**: Les ecritures de virements Stripe utilisent `type: 'AUTO_SALE'` au lieu d'un type 'TRANSFER' ou 'AUTO_PAYOUT'.
- **Impact**: Rapports de ventes gonfles par les virements intra-comptes.
- **Fix suggere**: Ajouter un type `AUTO_PAYOUT` ou `TRANSFER` dans l'enum.

## F012 [CRITICAL] Supplier invoice number not unique-enforced
- **Fichier**: `src/app/api/accounting/supplier-invoices/route.ts`
- **Description**: Le numero de facture fournisseur est saisi par l'utilisateur sans verification d'unicite au niveau DB (pas de `@@unique` dans le schema).
- **Impact**: Doublons possibles, confusion dans le rapprochement.
- **Fix suggere**: Ajouter `@@unique([invoiceNumber, supplierId])` dans le schema Prisma.

## F013 [CRITICAL] revalueForeignAccounts() same account for gain AND loss
- **Fichier**: `src/lib/accounting/currency.service.ts`
- **Description**: Le gain de change et la perte de change utilisent tous les deux le compte '7000'. Le gain devrait aller au credit de 7020 et la perte au debit de 7010 (ou equivalent).
- **Impact**: Le resultat net est correct mais impossible de separer gains et pertes pour la declaration T2/CO-17.
- **Fix suggere**: Utiliser deux comptes distincts: ACCOUNT_CODES.FX_GAIN et ACCOUNT_CODES.FX_LOSS.

## F014 [CRITICAL] Auto-reconciliation can match same entry to multiple bank transactions
- **Fichier**: `src/lib/accounting/auto-reconciliation.service.ts:265-314`
- **Description**: `runAutoReconciliation()` itere sur toutes les transactions PENDING et pour chacune cherche un match parmi les entries. Si deux transactions bancaires matchent la meme ecriture, les deux seront marquees MATCHED avec le meme journalEntryId.
- **Impact**: Une ecriture matchee en double, balance de rapprochement fausse.
- **Fix suggere**: Maintenir un Set de journalEntryIds deja matches et les exclure des recherches suivantes.

## F015 [CRITICAL] Expense DELETE has no audit trail
- **Fichier**: `src/app/api/accounting/expenses/route.ts`
- **Description**: La suppression d'une depense ne log aucune entree dans l'audit trail (ni AuditLog ni AuditTrail).
- **Impact**: Non-conformite avec la politique de retention de 7 ans et les exigences CRA/RQ.
- **Fix suggere**: Ajouter `logAuditTrail({ action: 'DELETE', entityType: 'EXPENSE', ... })` avant la suppression.

## F016 [CRITICAL] tvhPaid hardcoded to 0 in tax reports
- **Fichier**: `src/app/api/accounting/tax-reports/route.ts`
- **Description**: Le montant de TVH payee sur les factures fournisseurs est toujours 0 au lieu d'etre calcule a partir des champs taxTvh.
- **Impact**: Les declarations de taxe pour les provinces HST sous-declarent les CTI (credit de taxe sur intrants).
- **Fix suggere**: Agregger `_sum: { taxTvh: true }` sur les supplierInvoices comme fait pour taxTps.

## F017 [CRITICAL] Duplicate/inconsistent validation schemas
- **Fichier**: `src/lib/accounting/validation.ts` vs `src/app/api/accounting/expenses/route.ts`
- **Description**: Le schema Zod `createExpenseSchema` dans validation.ts a des champs differents de celui dans expenses/route.ts. Les types d'entree dans `createJournalEntrySchema` ont un enum different du route-level.
- **Impact**: Validation inconsistante selon le point d'entree, donnees invalides possibles.
- **Fix suggere**: Centraliser tous les schemas dans validation.ts et les importer dans les routes.

## F018 [CRITICAL] Date.now() used for IDs - collision risk
- **Fichier**: `src/lib/accounting/reconciliation.service.ts`, `src/lib/accounting/auto-entries.service.ts`
- **Description**: `Date.now()` est utilise pour generer des IDs de lignes d'ecritures. Avec des appels rapides (<1ms), deux lignes peuvent avoir le meme ID.
- **Impact**: Collision d'IDs, ecritures corrompues.
- **Fix suggere**: Utiliser `crypto.randomUUID()` comme fait dans webhook-accounting.service.ts.

## F019 [HIGH] getHistoricalRates() not implemented
- **Fichier**: `src/lib/accounting/currency.service.ts`
- **Description**: La fonction retourne des taux statiques hardcodes au lieu de chercher dans la BOC Valet API ou un historique en base.
- **Impact**: Reevaluations de devises avec des taux faux, gains/pertes de change incorrects.
- **Fix suggere**: Implementer un cache historique en DB ou appeler l'API BOC avec les dates.

## F020 [HIGH] Hardcoded fallback currency rates are stale
- **Fichier**: `src/lib/accounting/currency.service.ts`
- **Description**: Les taux de secours (USD=1.35, EUR=1.47, etc.) sont hardcodes et ne refletent pas les taux actuels.
- **Impact**: Si l'API BOC est down, les conversions sont fausses.
- **Fix suggere**: Mettre a jour les fallbacks regulierement ou les stocker en DB avec un script cron.

## F021 [HIGH] Budget comparison sums ALL expense lines regardless of department
- **Fichier**: `src/lib/accounting/expense.service.ts`
- **Description**: `getDepartmentBudgetVsActual()` agrege toutes les lignes de budget de type EXPENSE sans filtrer par departement.
- **Impact**: Chaque departement voit le budget total au lieu de son budget propre.
- **Fix suggere**: Filtrer les lignes de budget par le departement demande.

## F022 [HIGH] CSV import uses PUT method (wrong HTTP semantics)
- **Fichier**: `src/app/api/accounting/reconciliation/route.ts`
- **Description**: L'import CSV de transactions bancaires utilise la methode HTTP PUT. PUT est idempotent et designe un remplacement complet de la ressource, pas un import/ajout.
- **Impact**: Confusion semantique, proxys/CDN pourraient cacher les requetes PUT.
- **Fix suggere**: Utiliser POST ou creer une route dediee `/api/accounting/bank-import`.

## F023 [HIGH] No rate limiting on any accounting API endpoints
- **Fichier**: Tous les fichiers `src/app/api/accounting/*/route.ts`
- **Description**: Aucun rate limiting n'est applique aux endpoints comptables. Un attaquant authentifie pourrait faire des milliers de requetes par seconde.
- **Impact**: Denial of service, scraping de donnees financieres.
- **Fix suggere**: Ajouter un middleware de rate limiting (ex: `next-rate-limit` ou Redis-based).

## F024 [HIGH] 7-year retention policy documented but not enforced
- **Fichier**: `src/lib/accounting/types.ts` (TODO #80)
- **Description**: La politique de retention de 7 ans est documentee comme TODO mais jamais implementee. Les soft-deletes n'empechent pas la purge manuelle.
- **Impact**: Non-conformite CRA/RQ section 230(4) ITA.
- **Fix suggere**: Ajouter une validation dans les endpoints DELETE qui empeche la suppression des enregistrements de moins de 7 ans.

## F025 [HIGH] Chart of accounts DELETE is hard-delete, not soft-delete
- **Fichier**: `src/app/api/accounting/chart-of-accounts/route.ts`
- **Description**: Contrairement aux autres entites (ecritures, factures, depenses), la suppression d'un compte comptable est definitive.
- **Impact**: Perte d'historique, references brisees si des ecritures utilisaient ce compte.
- **Fix suggere**: Utiliser `isActive: false` (deja present) au lieu de `prisma.delete()`.

## F026 [HIGH] Expense total validation missing
- **Fichier**: `src/app/api/accounting/expenses/route.ts`
- **Description**: Aucune verification que `subtotal + taxes = total` dans la creation/mise a jour de depenses.
- **Impact**: Totaux incoherents, rapports financiers faux.
- **Fix suggere**: Ajouter `if (Math.abs((subtotal + taxTps + taxTvq) - total) > 0.01) throw`.

## F027 [HIGH] Bank account DELETE uses different soft-delete pattern
- **Fichier**: `src/app/api/accounting/bank-accounts/route.ts`
- **Description**: La suppression de comptes bancaires utilise `isActive: false` au lieu de `deletedAt: new Date()` comme les autres entites.
- **Impact**: Incohérence dans le pattern de soft-delete, queries incorrectes si on filtre par `deletedAt`.
- **Fix suggere**: Unifier le pattern: utiliser `deletedAt` partout.

## F028 [HIGH] Supplier invoice updates have no audit trail
- **Fichier**: `src/app/api/accounting/supplier-invoices/route.ts`
- **Description**: Les mises a jour de factures fournisseurs ne sont loguees que dans `console.info`, pas dans AuditTrail.
- **Impact**: Pas de trace des modifications pour la piste d'audit.
- **Fix suggere**: Ajouter `logAuditTrail()` pour chaque mise a jour.

## F029 [HIGH] ML reconciliation learnedPatterns stored in memory only
- **Fichier**: `src/lib/accounting/ml-reconciliation.service.ts:50`
- **Description**: Les patterns appris sont stockes dans un `Map` en memoire. Ils sont perdus a chaque redemarrage du serveur.
- **Impact**: L'apprentissage des patterns de rapprochement est ephemere.
- **Fix suggere**: Persister les patterns dans la table BankRule ou une nouvelle table dediee.

## F030 [HIGH] Quick entry template uses hardcoded QC tax rate 1.14975
- **Fichier**: `src/lib/accounting/quick-entry.service.ts:181,274`
- **Description**: Le calcul du "total" dans les templates utilise `amount * 1.14975` hardcode (TPS 5% + TVQ 9.975%), ignorant la province du client.
- **Impact**: Templates faux pour les ventes hors-Quebec.
- **Fix suggere**: Parametriser la province et utiliser `calculateSalesTax()` de canadian-tax-config.ts.

## F031 [HIGH] Auto-reconciliation creates N+1 queries
- **Fichier**: `src/lib/accounting/auto-reconciliation.service.ts:283-310`
- **Description**: `runAutoReconciliation()` fetch toutes les transactions PENDING, puis pour chacune appelle `autoReconcileByReference()` et `autoReconcileByAmount()`, chacun faisant 2+ queries DB.
- **Impact**: Pour 1000 transactions, ~3000-6000 queries. Timeout en production.
- **Fix suggere**: Pre-charger toutes les entries et transactions en bulk, puis matcher en memoire.

## F032 [HIGH] parseDate() in bank-import falls through to new Date(dateStr)
- **Fichier**: `src/lib/accounting/bank-import.service.ts:412-427`
- **Description**: La fonction `parseDate()` teste des formats avec regex mais le fallback `new Date(dateStr)` interprete DD/MM/YYYY comme MM/DD/YYYY en JS.
- **Impact**: 12/03/2026 sera interprete comme December 3 au lieu de March 12 pour les releves Desjardins.
- **Fix suggere**: Parser manuellement les composants de date pour les formats DD/MM/YYYY et DD-MM-YYYY.

## F033 [HIGH] Desjardins CSV ID collision
- **Fichier**: `src/lib/accounting/bank-import.service.ts:305`
- **Description**: Les IDs des transactions importees sont `csv-${Date.now()}-${i}`. Si deux fichiers CSV sont importes la meme milliseconde, les lignes avec le meme index auront le meme ID.
- **Impact**: Collisions d'IDs, ecrasement de transactions.
- **Fix suggere**: Utiliser `crypto.randomUUID()` ou ajouter un hash du contenu de la ligne.

## F034 [HIGH] Aging report health score always returns trend: 'STABLE'
- **Fichier**: `src/lib/accounting/aging.service.ts:275`
- **Description**: `getAgingSummaryStats()` retourne toujours `trend: 'STABLE'` avec le commentaire "Would need historical data".
- **Impact**: L'indicateur de tendance est inutile/trompeur.
- **Fix suggere**: Comparer avec le rapport d'aging du mois precedent stocke en DB.

## F035 [HIGH] Alert rules upsert logic has race condition
- **Fichier**: `src/lib/accounting/alert-rules.service.ts:367-392`
- **Description**: `findUnique` + conditonal `upsert` n'est pas atomique. Deux evaluations concurrentes peuvent creer des doublons.
- **Impact**: Alertes dupliquees dans le dashboard.
- **Fix suggere**: Utiliser directement `upsert` sans le `findUnique` prealable.

## F036 [HIGH] Alert IDs truncated to 255 chars may collide
- **Fichier**: `src/lib/accounting/alert-rules.service.ts:365`
- **Description**: `alertId = \`auto-${ruleType}-${entityId || title}\`.substring(0, 255)`. Si deux alertes ont un titre long qui ne differe qu'apres le 255e caractere, elles auront le meme ID.
- **Impact**: Alertes ecrasees.
- **Fix suggere**: Utiliser un hash SHA-256 du contenu pour garantir l'unicite.

## F037 [HIGH] Payment matching entry number generation not in transaction
- **Fichier**: `src/lib/accounting/payment-matching.service.ts:218-227`
- **Description**: `getNextEntryNumber` est appele hors de la transaction `prisma.$transaction`. La generation de numero n'est pas protegee par le lock FOR UPDATE.
- **Impact**: Doublons de numeros d'ecritures possibles.
- **Fix suggere**: Deplacer la generation du numero dans le callback `prisma.$transaction`.

## F038 [HIGH] KPI service makes ~15 DB queries per calculateKPIs() call
- **Fichier**: `src/lib/accounting/kpi.service.ts:107-133`
- **Description**: `calculateKPIs()` appelle `sumByAccountType()` 13+ fois, chacune faisant une query `aggregate`. Pour `getKPITrend(kpi, 6)`, c'est 6 * 15 = 90 queries.
- **Impact**: Latence elevee pour le dashboard financier.
- **Fix suggere**: Combiner en une seule query avec GROUP BY type et code prefix.

## F039 [HIGH] createAccountingEntriesForOrder uses unsafe type assertion
- **Fichier**: `src/lib/accounting/webhook-accounting.service.ts:408`
- **Description**: `(order as unknown as Record<string, unknown>).shippingName` est un cast unsafe. Si le champ n'existe pas, customerName sera `undefined` converti en string 'undefined'.
- **Impact**: Factures avec nom client "undefined".
- **Fix suggere**: Ajouter shippingName au select/include de la query Order ou utiliser un fallback propre.

## F040 [HIGH] evaluateFormula() in quick-entry replaces 'total' after variable substitution
- **Fichier**: `src/lib/accounting/quick-entry.service.ts:179-183`
- **Description**: La variable 'total' est calculee et remplacee APRES les variables utilisateur. Si un variable s'appelle 'subtotal', le remplacement de 'total' dans 'subtotal' pourrait casser l'expression.
- **Impact**: Calculs de formules incorrects avec certains noms de variables.
- **Fix suggere**: Calculer 'total' dans l'objet numericValues AVANT l'appel a evaluateFormula.

## F041 [HIGH] Webhook entry fee calculation is estimated, never reconciled
- **Fichier**: `src/lib/accounting/webhook-accounting.service.ts:345-348`
- **Description**: Les frais Stripe/PayPal sont estimes a 2.9% + $0.30 mais jamais reconcilies avec les frais reels reportes par Stripe.
- **Impact**: Ecart permanent entre les frais estimes et reels dans le grand livre.
- **Fix suggere**: Ajouter un flag `isEstimated: true` et un processus de reconciliation avec les rapports Stripe.

## F042 [HIGH] Recurring entries templateData update overwrites previous data
- **Fichier**: `src/lib/accounting/recurring-entries.service.ts:387-390`
- **Description**: L'update du templateData utilise `typeof template === 'object'` (toujours true) et reconstruit un objet partiel, perdant potentiellement des champs existants.
- **Impact**: Perte de configuration de template apres execution.
- **Fix suggere**: Lire le templateData existant, merger avec les nouvelles valeurs, puis sauvegarder.

## F043 [HIGH] Tax compliance imports 'db as prisma' vs 'prisma' inconsistency
- **Fichier**: `src/lib/accounting/tax-compliance.service.ts:1`
- **Description**: Certains services importent `{ prisma } from '@/lib/db'`, d'autres importent `{ db as prisma } from '@/lib/db'`. Si le module exporte les deux, c'est OK, mais sinon c'est une erreur.
- **Impact**: Potentiel `undefined` si le mauvais export est utilise.
- **Fix suggere**: Standardiser sur un seul pattern d'import (`prisma` partout).

## F044 [HIGH] Audit trail service has dual logging systems
- **Fichier**: `src/lib/accounting/audit-trail.service.ts`
- **Description**: Le fichier contient deux systemes de logging: `logAuditEntry()` (vers AuditLog) et `logAuditTrail()` (vers AuditTrail). Les routes utilisent l'un ou l'autre de maniere inconsistante.
- **Impact**: Piste d'audit fragmentee entre deux tables.
- **Fix suggere**: Deprecier l'un des deux et migrer toutes les references vers un seul systeme.

## F045 [HIGH] getAuditHistory() hardcodes userName = 'Utilisateur'
- **Fichier**: `src/lib/accounting/audit-trail.service.ts:237`
- **Description**: Au lieu de chercher le nom de l'utilisateur dans la table User, la fonction retourne toujours 'Utilisateur'.
- **Impact**: L'audit trail ne permet pas d'identifier qui a fait quoi.
- **Fix suggere**: Joindre la table User pour recuperer le vrai nom.

## F046 [MEDIUM] Auto-reconcile only checks debit amounts, ignores credits
- **Fichier**: `src/lib/accounting/auto-reconciliation.service.ts:123, 200`
- **Description**: Le montant de l'ecriture est calcule comme `entry.lines.reduce((sum, l) => sum + Number(l.debit), 0)`. Cela ignore les credits et ne marchera pas pour les paiements sortants.
- **Impact**: Les transactions bancaires de type CREDIT ne seront jamais auto-rapprochees.
- **Fix suggere**: Pour les DEBIT bancaires, matcher les credits GL; pour les CREDIT bancaires, matcher les debits GL.

## F047 [MEDIUM] BudgetLine uses 12 individual month columns instead of normalized table
- **Fichier**: `prisma/schema.prisma` (model BudgetLine)
- **Description**: Chaque mois est une colonne separee (january, february, ..., december). Pattern denomalise.
- **Impact**: Impossible d'agreger par periode sans caster dynamiquement les colonnes. Maintenance difficile.
- **Fix suggere**: Creer une table BudgetLineMonth (budgetLineId, month, amount) ou garder tel quel si la structure est figee.

## F048 [MEDIUM] Period close sets status 'IN_REVIEW' not in enum
- **Fichier**: `src/lib/accounting/period-close.service.ts`
- **Description**: `runMonthEndChecklist()` met le status a 'IN_REVIEW' mais ce statut n'est pas dans l'enum AccountingPeriod du schema Prisma.
- **Impact**: Erreur Prisma si l'enum est strictement valide, ou donnees incoherentes.
- **Fix suggere**: Ajouter 'IN_REVIEW' a l'enum ou utiliser un statut existant.

## F049 [MEDIUM] OCR service hardcodes confidence 0.85 for Vision
- **Fichier**: `src/lib/accounting/ocr.service.ts`
- **Description**: La confiance OCR est toujours 0.85 pour les images et 0.6 pour le texte, peu importe la qualite reelle de l'extraction.
- **Impact**: L'utilisateur ne peut pas evaluer la fiabilite de l'OCR.
- **Fix suggere**: Extraire la confiance des metadonnees de reponse GPT-4o Vision.

## F050 [MEDIUM] Tax compliance HST handling for supplier invoices is approximate
- **Fichier**: `src/lib/accounting/tax-compliance.service.ts`
- **Description**: Le commentaire "HST would be included in taxTps for simplicity" indique que la TVH est amalgamee avec la TPS sur les factures fournisseurs.
- **Impact**: Separation incorrecte entre federal/provincial dans les declarations.
- **Fix suggere**: Utiliser les champs taxTvh separes comme dans les factures clients.

## F051 [MEDIUM] CSV parser doesn't handle escaped quotes properly
- **Fichier**: `src/lib/accounting/bank-import.service.ts:392-409`
- **Description**: La fonction `parseCSVLine()` ne gere pas les guillemets doubles echappes (`""`) a l'interieur des champs.
- **Impact**: Descriptions de transactions avec guillemets seront mal parsees.
- **Fix suggere**: Ajouter la gestion de `""` -> `"` dans le parser.

## F052 [MEDIUM] Forecasting variance uses population variance (divides by N, not N-1)
- **Fichier**: `src/lib/accounting/forecasting.service.ts:441-445`
- **Description**: `calculateVariance()` divise par `arr.length` (variance de population) au lieu de `arr.length - 1` (variance d'echantillon).
- **Impact**: Intervalles de confiance legerement sous-estimes pour les previsions.
- **Fix suggere**: Utiliser `arr.length - 1` pour les donnees echantillonnees.

## F053 [MEDIUM] Normalize function strips all non-alphanumeric for reconciliation
- **Fichier**: `src/lib/accounting/auto-reconciliation.service.ts:63-65`
- **Description**: `normalize()` supprime tous les caracteres non-alphanumeriques, y compris les accents francais. "Depot" et "Depôt" deviendraient differents apres `.replace(/[^a-z0-9]/g, '')`.
- **Impact**: References francaises ne matchent pas correctement.
- **Fix suggere**: Normaliser les accents d'abord avec `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`.

## F054 [MEDIUM] Customer invoice discount applied per-item, not as percentage
- **Fichier**: `src/app/api/accounting/customer-invoices/route.ts:139-143`
- **Description**: Le calcul est `quantity * unitPrice - discount` ou discount est un montant absolu par item, pas un pourcentage. Cela peut diverger des attentes UX.
- **Impact**: Confusion entre rabais en dollars et pourcentage.
- **Fix suggere**: Documenter clairement le type de rabais ou ajouter un champ `discountType: 'AMOUNT' | 'PERCENT'`.

## F055 [MEDIUM] Supplier invoice tolerance check is asymmetric
- **Fichier**: `src/app/api/accounting/supplier-invoices/route.ts:135`
- **Description**: La tolerance est `Math.abs(computedTotal - total) > 0.01` (1 cent). Pour les factures en devises etrangeres, 0.01 peut etre insuffisant.
- **Impact**: Factures valides rejetees pour des erreurs d'arrondi en multi-devise.
- **Fix suggere**: Ajuster la tolerance en fonction de la devise (ex: 0.05 pour JPY).

## F056 [MEDIUM] Tax report integrity hash doesn't include line items
- **Fichier**: `src/app/api/accounting/tax-reports/route.ts:242-263`
- **Description**: Le hash SHA-256 est calcule sur les totaux du rapport mais pas sur les details sous-jacents. Modifier les sous-items sans changer les totaux ne serait pas detecte.
- **Impact**: Faux sentiment de securite sur l'integrite du rapport.
- **Fix suggere**: Inclure un hash des factures/ecritures source dans le calcul.

## F057 [MEDIUM] Bank import hardcodes bankAccountId for CSV imports
- **Fichier**: `src/lib/accounting/bank-import.service.ts:306, 353`
- **Description**: Les transactions CSV importees ont `bankAccountId: 'desjardins-main'` ou `'td-main'` hardcode.
- **Impact**: Toutes les transactions importees vont dans le meme compte, meme si l'utilisateur a plusieurs comptes.
- **Fix suggere**: Accepter le bankAccountId en parametre de `parseDesjardinsCSV()`.

## F058 [MEDIUM] Reconciliation auto-reconcile loads 500 txs + 1000 entries without pagination
- **Fichier**: `src/app/api/accounting/reconciliation/route.ts`
- **Description**: Les limites hardcodees de 500 et 1000 sont arbitraires. Si le volume depasse, des transactions sont ignorees.
- **Impact**: Rapprochement partiel, transactions non reconciliees malgre un match existant.
- **Fix suggere**: Implementer un traitement par batch avec curseur.

## F059 [MEDIUM] Fallback COA codes hardcoded for bank reconciliation
- **Fichier**: `src/app/api/accounting/reconciliation/route.ts`
- **Description**: Si aucun compte n'est lie, le code essaie les codes hardcodes ['1010','1020','1030','1040']. Ces codes peuvent ne pas exister dans le plan comptable.
- **Impact**: Erreur silencieuse si les codes n'existent pas.
- **Fix suggere**: Valider que les comptes fallback existent en DB.

## F060 [MEDIUM] Duplicate alert services: alerts.service.ts vs alert-rules.service.ts
- **Fichier**: `src/lib/accounting/alerts.service.ts` et `src/lib/accounting/alert-rules.service.ts`
- **Description**: Deux services font essentiellement la meme chose. `alerts.service.ts` est une version fonctionnelle pure (sans DB), `alert-rules.service.ts` persiste en DB.
- **Impact**: Code duplique, maintenance double, risque de divergence.
- **Fix suggere**: Deprecier `alerts.service.ts` et utiliser uniquement `alert-rules.service.ts`.

## F061 [MEDIUM] Aging report uses local interfaces instead of shared types
- **Fichier**: `src/lib/accounting/aging.service.ts:6-50`
- **Description**: Le service definit ses propres interfaces Invoice, AgingBucket, etc. au lieu d'utiliser les types partages de types.ts.
- **Impact**: Duplication de types, drift possible.
- **Fix suggere**: Importer les types depuis types.ts.

## F062 [MEDIUM] Tax compliance fetches ALL orders without pagination
- **Fichier**: `src/lib/accounting/tax-compliance.service.ts`
- **Description**: `generateTaxSummary()` charge toutes les commandes de la periode sans limit/pagination.
- **Impact**: OOM pour les periodes avec des milliers de commandes.
- **Fix suggere**: Utiliser `aggregate` directement ou paginer avec curseur.

## F063 [MEDIUM] Entry number format inconsistency: 4 digits vs 5 digits
- **Fichier**: `src/lib/accounting/recurring-entries.service.ts:329` vs `src/lib/accounting/webhook-accounting.service.ts:90`
- **Description**: Les ecritures recurrentes utilisent `padStart(4, '0')` (JV-2026-0001) tandis que les webhooks utilisent `padStart(4, '0')` aussi mais le payment-matching utilise `padStart(5, '0')`.
- **Impact**: Numeros de longueur variable, tri incorrect.
- **Fix suggere**: Standardiser sur 5 digits partout.

## F064 [MEDIUM] Accounting scheduler runs tasks sequentially without timeout
- **Fichier**: `src/lib/accounting/scheduler.service.ts:80-131`
- **Description**: Les 3 taches (recurring, alerts, reconciliation) s'executent sequentiellement sans timeout. Si la reconciliation prend 5 minutes, les Azure Function timeouts pourraient declencher.
- **Impact**: Taches partiellement executees.
- **Fix suggere**: Ajouter un timeout par tache et un mecanisme de reprise.

## F065 [MEDIUM] getNextTaxDeadline() doesn't handle quarter boundary correctly
- **Fichier**: `src/lib/accounting/alerts.service.ts:266-282`
- **Description**: Le calcul du trimestre utilise `currentMonth / 3` mais `currentMonth` est 1-indexed. Janvier (month=1) donne Q1 correct, mais le mois de soumission est calcule comme `quarterEndMonth + 1` sans gerer le passage d'annee correctement pour Q4.
- **Impact**: Echeance fiscale incorrecte pour Q4.
- **Fix suggere**: Utiliser des librairies de dates ou gerer explicitement le passage d'annee.

## F066 [MEDIUM] GSTDeclaration Quick Method $30K threshold not validated
- **Fichier**: `src/app/api/accounting/gst-qst-declaration/route.ts`
- **Description**: Le seuil de $30K pour la methode rapide est mentionne mais la validation ne verifie pas si le chiffre d'affaires annuel depasse ce seuil.
- **Impact**: Application de la methode rapide pour des entreprises non admissibles.
- **Fix suggere**: Valider le chiffre d'affaires des 12 derniers mois avant d'appliquer la methode rapide.

## F067 [MEDIUM] Collection priority uses fixed $500/$200 thresholds in CAD
- **Fichier**: `src/lib/accounting/aging.service.ts:206-210`
- **Description**: Les seuils de priorite de recouvrement ($500, $200) sont hardcodes en CAD et ne tiennent pas compte de la devise de la facture.
- **Impact**: Factures en devises etrangeres pourraient etre mal priorisees.
- **Fix suggere**: Parametriser les seuils ou convertir en CAD pour comparaison.

## F068 [MEDIUM] Closing alerts use alert type 'RECONCILIATION_PENDING' for period closing
- **Fichier**: `src/lib/accounting/alerts.service.ts:175`
- **Description**: L'alerte de cloture de periode utilise le type 'RECONCILIATION_PENDING' au lieu d'un type 'PERIOD_CLOSE_PENDING'.
- **Impact**: Confusion dans le filtrage des alertes.
- **Fix suggere**: Ajouter un type 'PERIOD_CLOSE_PENDING'.

## F069 [MEDIUM] Auto-entries getAccountName() has incomplete mapping
- **Fichier**: `src/lib/accounting/auto-entries.service.ts`
- **Description**: La map hardcodee ne contient pas tous les codes de ACCOUNT_CODES. Les comptes non mappes retournent un nom generique.
- **Impact**: Descriptions d'ecritures generiques au lieu de noms specifiques.
- **Fix suggere**: Chercher le nom dans la table ChartOfAccount au lieu d'un mapping statique.

## F070 [MEDIUM] Reconciliation service mutates input objects
- **Fichier**: `src/lib/accounting/reconciliation.service.ts`
- **Description**: Les fonctions modifient directement les objets passes en parametre (ex: `bankTx.reconciliationStatus = 'MATCHED'`).
- **Impact**: Effets de bord inattendus, difficulte de debug.
- **Fix suggere**: Creer des copies des objets avant modification.

## F071 [MEDIUM] GIFI code gap: 3621-3849 mapped to EQUITY but out of official range
- **Fichier**: `src/lib/accounting/gifi-codes.ts:78`
- **Description**: Les codes 3621-3849 sont mappes a EQUITY avec la range '3450-3620', ce qui est une approximation.
- **Impact**: Mauvaise categorisation GIFI pour certains comptes.
- **Fix suggere**: Verifier la documentation CRA pour les codes 3621-3849.

## F072 [MEDIUM] Quick entry bank transfer template has empty accountCodes
- **Fichier**: `src/lib/accounting/quick-entry.service.ts:113-114`
- **Description**: Le template de transfert entre comptes a `accountCode: ''` pour les deux lignes, comptant sur la logique dynamique. Si les variables ne sont pas fournies, les codes seront vides.
- **Impact**: Ecriture avec des comptes invalides.
- **Fix suggere**: Ajouter une validation des variables requises avant generation.

## F073 [MEDIUM] Webhook fee entry type 'AUTO_PAYPAL_FEE' might not exist in JournalEntry type enum
- **Fichier**: `src/lib/accounting/webhook-accounting.service.ts:366`
- **Description**: Le type 'AUTO_PAYPAL_FEE' et 'AUTO_STRIPE_FEE' sont utilises mais pourraient ne pas etre dans l'enum JournalEntry.type du schema Prisma.
- **Impact**: Erreur Prisma a l'insertion si l'enum est strictement valide.
- **Fix suggere**: Verifier l'enum et ajouter les types manquants.

## F074 [MEDIUM] Batch CSV import has no duplicate detection
- **Fichier**: `src/lib/accounting/quick-entry.service.ts:442-510`
- **Description**: `parseCSVForEntries()` ne detecte pas les doublons (meme date, meme montant, meme description).
- **Impact**: Import double des memes ecritures.
- **Fix suggere**: Ajouter une verification par hash (date+montant+description).

## F075 [MEDIUM] Forecasting doesn't handle negative historical values
- **Fichier**: `src/lib/accounting/forecasting.service.ts:173`
- **Description**: `Math.max(0, projectedRevenue)` empeche les projections negatives. Mais un mois avec des retours nets pourrait legitimement etre negatif.
- **Impact**: Previsions trop optimistes en periode de retours massifs.
- **Fix suggere**: Permettre les valeurs negatives pour les periodes avec retours nets.

## F076 [MEDIUM] Anomaly detection O(n^2) complexity for duplicate check
- **Fichier**: `src/lib/accounting/ml-reconciliation.service.ts:487-501`
- **Description**: `detectAnomalies()` compare chaque transaction avec toutes les autres pour les doublons: O(n^2).
- **Impact**: Performance degradee avec beaucoup de transactions.
- **Fix suggere**: Utiliser un index hash (amount + date) pour la detection en O(n).

## F077 [MEDIUM] getAlertStyle() uses emoji icons
- **Fichier**: `src/lib/accounting/alerts.service.ts:316-322`
- **Description**: Les icones d'alertes sont des emojis. Certains navigateurs/systemes les affichent differemment ou pas du tout.
- **Impact**: Affichage inconsistant.
- **Fix suggere**: Utiliser des icones SVG/Lucide a la place.

## F078 [MEDIUM] Credit note validation: existing credit notes not filtered by VOID status correctly
- **Fichier**: `src/lib/accounting/webhook-accounting.service.ts:592`
- **Description**: Le filtre `status: { not: 'VOID' }` devrait aussi exclure 'CANCELLED' si ce statut existe.
- **Impact**: Credit notes annulees comptees dans le total existant.
- **Fix suggere**: Filtrer par `status: { in: ['ISSUED', 'APPLIED'] }` (whitelist).

## F079 [MEDIUM] Webhook customer invoice sets dueDate = createdAt (same day)
- **Fichier**: `src/lib/accounting/webhook-accounting.service.ts:430`
- **Description**: Les factures automatiques ont une dueDate egale a la date de creation car le paiement est immediat.
- **Impact**: Techniquement correct pour les paiements immediate, mais l'aging report pourrait montrer des factures "overdue" si le status etait different.
- **Fix suggere**: Documenter ce comportement et s'assurer que le status PAID empeche les alertes overdue.

## F080 [MEDIUM] LCS algorithm in reconciliation is O(m*n) memory
- **Fichier**: `src/lib/accounting/ml-reconciliation.service.ts:156-172`
- **Description**: `countCommonSubstring()` alloue une matrice `(m+1) x (n+1)`. Pour des references longues, c'est potentiellement couteux.
- **Impact**: Consommation memoire elevee pour de longues descriptions.
- **Fix suggere**: Limiter la longueur des chaines avant comparaison ou utiliser un rolling array.

## F081 [LOW] Currency detection checks only apostrophe character
- **Fichier**: `src/lib/accounting/ocr.service.ts`
- **Description**: La detection de devise dans l'OCR ne verifie que le caractere apostrophe. D'autres symboles ($, EUR, GBP) ne sont pas geres.
- **Impact**: Devise mal detectee sur les factures internationales.
- **Fix suggere**: Ajouter la detection de symboles monetaires courants.

## F082 [LOW] Circular dependency risk between expense.service.ts and recurring-entries.service.ts
- **Fichier**: `src/lib/accounting/index.ts` (TODO #88)
- **Description**: Le barrel export documente un risque de dependance circulaire entre ces deux services.
- **Impact**: Erreur de runtime possible dans certains ordres d'import.
- **Fix suggere**: Factoriser le code partage dans un troisieme module.

## F083 [LOW] Tax report safety limit: take: 10000
- **Fichier**: `src/app/api/accounting/tax-reports/route.ts`
- **Description**: La limite de 10000 factures par requete pourrait ne pas suffire pour les entreprises a haut volume.
- **Impact**: Declarations fiscales incompletes pour les gros volumes.
- **Fix suggere**: Utiliser `aggregate` SQL au lieu de charger les enregistrements.

## F084 [LOW] GST/QST declaration uses take: 50000
- **Fichier**: `src/app/api/accounting/gst-qst-declaration/route.ts`
- **Description**: 50000 est une limite tres elevee qui pourrait causer des OOM.
- **Impact**: Crash memoire sur les gros datasets.
- **Fix suggere**: Utiliser des requetes agregees au lieu de charger les rows.

## F085 [LOW] CSVExport doesn't escape newlines in descriptions
- **Fichier**: `src/lib/accounting/aging.service.ts:371-387`
- **Description**: L'export CSV n'echappe pas les retours a la ligne dans les descriptions. Les noms de clients multi-lignes casseraient le format.
- **Impact**: Fichiers CSV corrompus.
- **Fix suggere**: Remplacer les newlines par des espaces dans les champs.

## F086 [LOW] Forecasting exponentialSmoothing() not used in output
- **Fichier**: `src/lib/accounting/forecasting.service.ts:101-110`
- **Description**: La fonction `exponentialSmoothing()` est implementee mais n'est pas utilisee directement dans `forecastRevenue()` (seulement la derniere valeur lissee est utilisee).
- **Impact**: Code mort partiel, complexite inutile.
- **Fix suggere**: Soit l'integrer completement, soit la supprimer.

## F087 [LOW] OCR max file size 20MB might be too large for serverless
- **Fichier**: `src/lib/accounting/ocr.service.ts`
- **Description**: 20MB de donnees base64 occupe ~27MB en memoire. Les fonctions serverless Azure ont des limites de memoire.
- **Impact**: Timeout ou OOM sur les gros fichiers.
- **Fix suggere**: Reduire a 10MB ou compresser avant envoi.

## F088 [LOW] Auditable deepEqual doesn't handle arrays
- **Fichier**: `src/lib/accounting/audit-trail.service.ts:179-193`
- **Description**: `deepEqual()` gere les objets et les Dates mais pas les Arrays specifiquement. `[1,2]` et `[1,2]` seront compares element par element correctement, mais `[1,2]` et `[2,1]` seront consideres differents.
- **Impact**: Faux changements detectes pour les arrays reordonnees.
- **Fix suggere**: Trier les arrays avant comparaison si l'ordre n'est pas significatif.

## F089 [LOW] Scheduler doesn't log execution history
- **Fichier**: `src/lib/accounting/scheduler.service.ts`
- **Description**: Le resultat de `runScheduledTasks()` est retourne a l'appelant mais jamais persiste en base.
- **Impact**: Pas de trace historique des executions du scheduler.
- **Fix suggere**: Sauvegarder le SchedulerRunResult dans une table dediee.

## F090 [LOW] accountCode vs accountId confusion across codebase
- **Fichier**: Multiple (`validation.ts` uses accountId, entries route uses accountCode in some places)
- **Description**: Certains schemas Zod et routes utilisent `accountCode` (string), d'autres `accountId` (UUID). Les deux existent dans le schema Prisma.
- **Impact**: Confusion pour les developpeurs, risk de mauvais champ envoye.
- **Fix suggere**: Documenter clairement: API accepte accountCode, service resout en accountId.

## F091 [LOW] Recurring entry 'DAILY' frequency doesn't set time component
- **Fichier**: `src/lib/accounting/recurring-entries.service.ts:193-195`
- **Description**: `calculateNextRunDate` pour DAILY ajoute 1 jour mais ne fixe pas l'heure. Le drift temporel pourrait causer des doubles executions ou des manques.
- **Impact**: Ecritures quotidiennes executees a des heures variables.
- **Fix suggere**: Fixer l'heure a 00:00:00 UTC pour chaque prochaine execution.

## F092 [LOW] CATEGORY_MAPPING keys use English names but bank transactions may be in French
- **Fichier**: `src/lib/accounting/bank-import.service.ts:59-85`
- **Description**: Les cles de mapping sont en anglais ('Bank Fees:Service Charge') mais les categories Plaid pour les banques canadiennes francophones pourraient etre en francais.
- **Impact**: Transactions non categorisees (fallback account 6999).
- **Fix suggere**: Ajouter des equivalents francophones dans le mapping.

## F093 [LOW] Decimal import from Prisma runtime
- **Fichier**: `src/lib/accounting/webhook-accounting.service.ts:8`
- **Description**: `import { Decimal } from '@prisma/client/runtime/library'` est un import interne de Prisma qui pourrait changer entre versions.
- **Impact**: Possible breakage lors d'une mise a jour Prisma.
- **Fix suggere**: Utiliser `import { Decimal } from 'decimal.js'` directement.

## F094 [LOW] Forecasting confidence floor of 0.5 is arbitrary
- **Fichier**: `src/lib/accounting/forecasting.service.ts:176`
- **Description**: La confiance minimum est hardcodee a 0.5 (50%). Pour des previsions a 12 mois, cela semble eleve.
- **Impact**: Fausse confiance dans les previsions lointaines.
- **Fix suggere**: Baisser le floor a 0.3 ou le rendre configurable.

## F095 [LOW] Reconciliation service Jaccard similarity filters words < 3 chars
- **Fichier**: `src/lib/accounting/ml-reconciliation.service.ts:133`
- **Description**: Les mots de moins de 3 caracteres sont exclus. Cela exclut des references importantes comme "TD", "RBC", "FX", etc.
- **Impact**: Baisse de la qualite du matching par description.
- **Fix suggere**: Reduire le seuil a 2 caracteres ou maintenir une whitelist.

## F096 [LOW] Expense deductibility map doesn't include all categories
- **Fichier**: `src/app/api/accounting/expenses/route.ts:14-33`
- **Description**: Le mapping de deductibilite ne couvre pas toutes les categories possibles. Les categories non mappees n'ont pas de taux de deductibilite.
- **Impact**: Depenses non classifiees pour la deductibilite fiscale.
- **Fix suggere**: Utiliser le mapping complet de DEDUCTIBILITY_RULES dans canadian-tax-config.ts.

## F097 [LOW] Alert pagination missing for getActiveAlerts()
- **Fichier**: `src/lib/accounting/alert-rules.service.ts:437`
- **Description**: `findMany` sans `take` retourne toutes les alertes actives.
- **Impact**: Performance degradee si des centaines d'alertes non resolues existent.
- **Fix suggere**: Ajouter `take: 100` et un parametre `offset` pour la pagination.

## F098 [LOW] Aging report HTML output has no XSS sanitization
- **Fichier**: `src/lib/accounting/aging.service.ts:283-365`
- **Description**: `formatAgingReportHTML()` interpole des noms de clients directement dans le HTML sans echappement.
- **Impact**: XSS si un nom de client contient du HTML malveillant.
- **Fix suggere**: Echapper les caracteres HTML dans les noms.

## F099 [LOW] Canadian tax config payroll rates are for 2026 specifically
- **Fichier**: `src/lib/accounting/canadian-tax-config.ts:155-163`
- **Description**: Les taux de paie sont specifiques a 2026 sans mecanisme de mise a jour automatique.
- **Impact**: Taux obsoletes apres decembre 2026.
- **Fix suggere**: Ajouter le concept d'annee fiscale et charger les taux depuis une DB ou config externe.

## F100 [LOW] formatProjectionSummary() uses toLocaleString which may differ by server locale
- **Fichier**: `src/lib/accounting/forecasting.service.ts:454`
- **Description**: `toLocaleString('fr-CA')` depend de la locale du serveur. En CI ou sur un serveur anglophone, le format pourrait differer.
- **Impact**: Formatage inconsistant des montants.
- **Fix suggere**: Utiliser une librairie de formatage deterministe (Intl.NumberFormat est OK si la locale est disponible).

---

# PARTIE 2: 100 AMELIORATIONS

---

## A001 [CRITICAL] Implementer un vrai Decimal.js partout pour les calculs financiers
- **Fichier**: Tout le codebase comptabilite
- **Description**: Remplacer tous les `Number()` + `Math.round()` par `Decimal.js` avec `ROUND_HALF_EVEN` pour les calculs financiers.
- **Impact**: Elimination des erreurs d'arrondi IEEE 754 sur les montants.
- **Effort**: Large (50+ fichiers concernes).

## A002 [CRITICAL] Centraliser la generation de numeros sequentiels
- **Fichier**: Creer `src/lib/accounting/sequence.service.ts`
- **Description**: Extraire le pattern `SELECT MAX() FOR UPDATE` dans un service generique qui gere tous les types de numeros (JV-, FACT-, NC-, DEP-).
- **Impact**: Eliminer les doublons et les inconsistances de format.
- **Effort**: Moyen (refactoring de 8+ routes).

## A003 [CRITICAL] Ajouter le rate limiting sur toutes les API comptables
- **Fichier**: Middleware ou wrapper pour `src/app/api/accounting/*/route.ts`
- **Description**: Limiter a ~100 requetes/minute par utilisateur pour les endpoints comptables sensibles.
- **Impact**: Protection contre le DoS et le scraping.
- **Effort**: Faible (middleware generique).

## A004 [CRITICAL] Implementer la retention de 7 ans au niveau DB
- **Fichier**: Middleware global et triggers Prisma
- **Description**: Empecher la suppression physique de tout enregistrement comptable de moins de 7 ans (section 230(4) ITA).
- **Impact**: Conformite CRA/RQ automatique.
- **Effort**: Moyen.

## A005 [CRITICAL] Corriger le Stripe sync pour utiliser les vraies taxes
- **Fichier**: `src/lib/accounting/stripe-sync.service.ts`
- **Description**: Stocker les taxes reelles dans les metadonnees Stripe lors du paiement et les recuperer lors du sync.
- **Impact**: Ecritures comptables financierement exactes.
- **Effort**: Moyen (modification checkout + sync).

## A006 [CRITICAL] Migrer le cache COA vers Redis ou supprimer
- **Fichier**: `src/app/api/accounting/chart-of-accounts/route.ts`
- **Description**: Soit utiliser Redis pour un cache distribue, soit supprimer le cache et compter sur l'index DB.
- **Impact**: Coherence des donnees en environnement serverless.
- **Effort**: Faible.

## A007 [CRITICAL] Implementer la gestion des dates d'effectivite des taux de taxe
- **Fichier**: `src/lib/accounting/types.ts`, `src/lib/accounting/canadian-tax-config.ts`
- **Description**: Chaque taux de taxe devrait avoir une plage de dates d'effectivite. Le calcul de taxe devrait selectionner le bon taux selon la date de transaction.
- **Impact**: Calculs de taxe corrects pour les periodes de transition.
- **Effort**: Moyen.

## A008 [CRITICAL] Ajouter des tests unitaires pour les calculs financiers
- **Fichier**: Creer `src/lib/accounting/__tests__/`
- **Description**: Au minimum: roundCurrency, calculateSalesTax, calculateCCA, evaluateFormula, stripe sync amounts. Avec des cas limites (0.005, montants negatifs, multi-devise).
- **Impact**: Detecter les regressions dans les calculs critiques.
- **Effort**: Large mais essentiel.

## A009 [CRITICAL] Standardiser le pattern d'audit trail
- **Fichier**: `src/lib/accounting/audit-trail.service.ts`
- **Description**: Unifier les deux systemes (AuditLog + AuditTrail) en un seul, puis l'appliquer systematiquement dans toutes les routes.
- **Impact**: Piste d'audit complete et coherente.
- **Effort**: Moyen.

## A010 [CRITICAL] Corriger l'auto-reconciliation pour eviter les double-matches
- **Fichier**: `src/lib/accounting/auto-reconciliation.service.ts`
- **Description**: Maintenir un Set de matchedEntryIds deja utilises dans `runAutoReconciliation()`.
- **Impact**: Elimination des rapprochements en double.
- **Effort**: Faible.

## A011 [CRITICAL] Ajouter une validation de balance debit=credit systematique
- **Fichier**: Middleware ou trigger dans `src/app/api/accounting/entries/route.ts`
- **Description**: Verifier que totalDebits === totalCredits pour CHAQUE ecriture avant insertion, avec une tolerance de 0.01.
- **Impact**: Impossible de creer des ecritures desequilibrees.
- **Effort**: Faible (deja partiellement implemente).

## A012 [CRITICAL] Persister les patterns ML de reconciliation en DB
- **Fichier**: `src/lib/accounting/ml-reconciliation.service.ts`
- **Description**: Utiliser la table BankRule pour sauvegarder les patterns appris au lieu d'un Map en memoire.
- **Impact**: Apprentissage qui survit aux redemarrages.
- **Effort**: Moyen.

## A013 [HIGH] Ajouter des indexes DB pour les requetes comptables frequentes
- **Fichier**: `prisma/schema.prisma`
- **Description**: Ajouter des indexes composites: `@@index([status, date, deletedAt])` sur JournalEntry, `@@index([reconciliationStatus, date])` sur BankTransaction, etc.
- **Impact**: Performance x5-10 sur les requetes de rapports.
- **Effort**: Faible.

## A014 [HIGH] Implementer un middleware d'authentification comptable
- **Fichier**: Creer `src/lib/accounting/auth-middleware.ts`
- **Description**: Wrapper qui verifie les permissions comptables (ADMIN, ACCOUNTANT, VIEWER) avant chaque operation.
- **Impact**: Segregation des taches, principe du moindre privilege.
- **Effort**: Moyen.

## A015 [HIGH] Ajouter le support multi-devise natif dans les ecritures
- **Fichier**: Schema Prisma + services
- **Description**: Chaque JournalLine devrait avoir un champ `amount` en devise d'origine + `amountCAD` en CAD. Le taux de change serait sur l'ecriture.
- **Impact**: Rapports financiers multi-devises corrects.
- **Effort**: Large.

## A016 [HIGH] Implementer des webhooks Stripe pour les frais reels
- **Fichier**: `src/app/api/webhooks/stripe/route.ts`
- **Description**: Ecouter les evenements `balance_transaction.created` pour obtenir les vrais frais Stripe et reconcilier automatiquement.
- **Impact**: Frais Stripe exacts dans le grand livre.
- **Effort**: Moyen.

## A017 [HIGH] Ajouter la gestion des periodes fermees dans toutes les routes
- **Fichier**: Tous les `src/app/api/accounting/*/route.ts`
- **Description**: Verifier que la date de l'operation n'est pas dans une periode fermee AVANT chaque creation/modification.
- **Impact**: Integrite des periodes comptables.
- **Effort**: Faible (fonction utilitaire + appel dans chaque route).

## A018 [HIGH] Implementer l'export PDF des rapports
- **Fichier**: Creer `src/lib/accounting/pdf-reports.service.ts`
- **Description**: Generer des PDF pour: bilan, resultats, aging, declarations TPS/TVQ, ecritures de journal.
- **Impact**: Rapports imprimables pour les auditeurs et le comptable.
- **Effort**: Large.

## A019 [HIGH] Ajouter un dashboard financier temps-reel
- **Fichier**: Creer `src/app/admin/comptabilite/dashboard/`
- **Description**: Dashboard avec KPIs en temps-reel: tresorerie, ratio courant, marges, DSO, DPO. Utiliser le KPI service existant.
- **Impact**: Visibilite instantanee sur la sante financiere.
- **Effort**: Moyen (service deja existant).

## A020 [HIGH] Implementer le rapprochement bancaire automatique via OFX/QFX
- **Fichier**: Etendre `src/lib/accounting/bank-import.service.ts`
- **Description**: Supporter l'import de fichiers OFX/QFX (format standard des banques canadiennes) en plus du CSV.
- **Impact**: Import plus fiable et universel.
- **Effort**: Moyen.

## A021 [HIGH] Ajouter des alertes email pour les echeances fiscales
- **Fichier**: Etendre `src/lib/accounting/alert-rules.service.ts`
- **Description**: Envoyer un email (via SendGrid/Resend) quand une echeance fiscale est dans les 14 jours.
- **Impact**: Prevention des retards de declaration.
- **Effort**: Faible.

## A022 [HIGH] Implementer la declaration T2/CO-17 auto-generee
- **Fichier**: Creer `src/lib/accounting/t2-return.service.ts`
- **Description**: Generer les donnees de la declaration T2 federale et CO-17 provinciale a partir des ecritures comptables et des codes GIFI.
- **Impact**: Automatisation de la preparation fiscale.
- **Effort**: Large.

## A023 [HIGH] Optimiser getKPITrend() pour eviter N*15 queries
- **Fichier**: `src/lib/accounting/kpi.service.ts`
- **Description**: Precalculer les KPIs mensuels dans une table materialisee, mise a jour par le scheduler.
- **Impact**: Dashboard financier instantane au lieu de 90+ queries.
- **Effort**: Moyen.

## A024 [HIGH] Ajouter le support des notes internes sur les ecritures
- **Fichier**: Schema Prisma (model JournalEntry)
- **Description**: Ajouter un champ `internalNotes` pour les commentaires du comptable, distincts de la description officielle.
- **Impact**: Meilleure communication entre comptables et auditeurs.
- **Effort**: Faible.

## A025 [HIGH] Implementer l'approbation multi-niveaux pour les depenses
- **Fichier**: Etendre `src/app/api/accounting/expenses/route.ts`
- **Description**: Workflow: DRAFT -> SUBMITTED -> APPROVED_L1 -> APPROVED_L2 -> REIMBURSED, avec des seuils configurables.
- **Impact**: Controle interne sur les depenses.
- **Effort**: Moyen.

## A026 [HIGH] Ajouter le calcul automatique de l'amortissement CCA
- **Fichier**: Etendre `src/lib/accounting/canadian-tax-config.ts`
- **Description**: Pour chaque immobilisation (FixedAsset), calculer automatiquement la DPA mensuelle/annuelle selon la classe CCA.
- **Impact**: Ecritures d'amortissement exactes et automatiques.
- **Effort**: Moyen.

## A027 [HIGH] Implementer les comptes de regularisation (accruals)
- **Fichier**: Nouveau service `accruals.service.ts`
- **Description**: Gerer les charges a payer, les produits a recevoir et les ecritures de regularisation automatiques en fin de mois.
- **Impact**: Etats financiers plus precis en methode de comptabilite d'exercice.
- **Effort**: Moyen.

## A028 [HIGH] Ajouter la validation GIFI automatique
- **Fichier**: Etendre `src/lib/accounting/gifi-codes.ts`
- **Description**: Valider automatiquement que chaque compte du plan comptable a un code GIFI valide et coherent avec son type.
- **Impact**: Preparation T2/CO-17 sans erreurs manuelles.
- **Effort**: Faible.

## A029 [HIGH] Implementer un log d'import avec rollback
- **Fichier**: Etendre `src/lib/accounting/bank-import.service.ts`
- **Description**: Chaque import CSV/OFX cree un batch avec un ID unique. Permettre le rollback complet d'un batch.
- **Impact**: Correction facile des erreurs d'import.
- **Effort**: Moyen.

## A030 [HIGH] Ajouter le support des taxes sur les depenses ITCs/RTIs
- **Fichier**: Etendre le schema Expense
- **Description**: Pour chaque depense, calculer les credits de taxes (ITC pour TPS, RTI pour TVQ) reclamables.
- **Impact**: Declarations de taxes plus precises.
- **Effort**: Moyen.

## A031 [HIGH] Creer un rapport de rapprochement bancaire formel
- **Fichier**: Creer `src/lib/accounting/bank-reconciliation-report.service.ts`
- **Description**: Generer le rapport officiel de rapprochement: solde bancaire + elements en circulation = solde comptable.
- **Impact**: Document auditable pour le verificateur.
- **Effort**: Moyen.

## A032 [HIGH] Implementer les relances automatiques de paiement client
- **Fichier**: Etendre `src/lib/accounting/alerts.service.ts`
- **Description**: Envoyer automatiquement des emails de rappel a 7, 14, 30 et 60 jours de retard (deja modelize dans `generatePaymentReminders`).
- **Impact**: Amelioration du DSO et du recouvrement.
- **Effort**: Moyen.

## A033 [MEDIUM] Ajouter la pagination a toutes les routes comptables
- **Fichier**: Tous les `src/app/api/accounting/*/route.ts`
- **Description**: Implementer `?page=1&limit=50` avec un maximum de 200 par page sur toutes les routes GET.
- **Impact**: Performance et scalabilite.
- **Effort**: Moyen.

## A034 [MEDIUM] Implementer le cache des taux de change avec Redis
- **Fichier**: `src/lib/accounting/currency.service.ts`
- **Description**: Remplacer le cache en memoire par Redis avec TTL de 1 heure. Stocker les taux historiques en DB.
- **Impact**: Taux coherents entre toutes les instances.
- **Effort**: Moyen.

## A035 [MEDIUM] Ajouter des transactions Prisma pour toutes les operations critiques
- **Fichier**: Routes qui modifient plusieurs tables
- **Description**: Certaines operations (ex: reconciliation manuelle) modifient BankTransaction + JournalEntry separement. Wrapper dans `$transaction`.
- **Impact**: Atomicite des operations.
- **Effort**: Moyen.

## A036 [MEDIUM] Creer un systeme de permissions granulaire par module comptable
- **Fichier**: Nouveau `src/lib/accounting/permissions.ts`
- **Description**: Definir des permissions: CAN_CREATE_ENTRY, CAN_POST_ENTRY, CAN_VOID_ENTRY, CAN_CLOSE_PERIOD, etc.
- **Impact**: Segregation des taches plus fine.
- **Effort**: Moyen.

## A037 [MEDIUM] Implementer le suivi des modifications (change history) visuel
- **Fichier**: Frontend des pages comptables
- **Description**: Afficher l'historique des modifications de chaque ecriture/facture avec diff visuel (ancien -> nouveau).
- **Impact**: Transparence totale pour les auditeurs.
- **Effort**: Moyen.

## A038 [MEDIUM] Ajouter des graphiques de tresorerie previsionnelle
- **Fichier**: Page admin dashboard comptabilite
- **Description**: Utiliser le service forecasting existant pour afficher des projections graphiques de tresorerie.
- **Impact**: Planification financiere visuelle.
- **Effort**: Faible (service deja existant).

## A039 [MEDIUM] Implementer l'import/export en format IFRS/NCECF
- **Fichier**: Nouveau service d'export
- **Description**: Permettre l'export des etats financiers en format conforme NCECF (norme canadienne) ou IFRS.
- **Impact**: Rapports standards pour les auditeurs externes.
- **Effort**: Large.

## A040 [MEDIUM] Ajouter des templates de rapprochement pour les transactions recurrentes
- **Fichier**: Etendre la table BankRule
- **Description**: Permettre de creer des regles de rapprochement automatique (ex: "Stripe payout toujours = compte 1040").
- **Impact**: Automatisation accrue du rapprochement.
- **Effort**: Moyen.

## A041 [MEDIUM] Implementer le batch posting des ecritures
- **Fichier**: `src/app/api/accounting/entries/route.ts`
- **Description**: Permettre de valider (POST) plusieurs ecritures DRAFT en une seule requete.
- **Impact**: Gain de temps en fin de mois.
- **Effort**: Faible.

## A042 [MEDIUM] Ajouter le filtrage par periode comptable dans toutes les vues
- **Fichier**: Toutes les pages admin comptabilite
- **Description**: Ajouter un selecteur de periode comptable (mois/trimestre/annee) persistant dans l'URL.
- **Impact**: Navigation plus intuitive.
- **Effort**: Moyen.

## A043 [MEDIUM] Implementer l'export des ecritures en format journal (livre-journal)
- **Fichier**: Nouveau endpoint d'export
- **Description**: Generer le livre-journal officiel avec: date, numero, description, debits, credits, solde progressif.
- **Impact**: Document comptable officiel.
- **Effort**: Moyen.

## A044 [MEDIUM] Ajouter le support des devises pour le budget
- **Fichier**: Schema Budget/BudgetLine
- **Description**: Permettre la budgetisation en devises etrangeres avec conversion automatique en CAD.
- **Impact**: Budget plus precis pour les depenses en USD/EUR.
- **Effort**: Moyen.

## A045 [MEDIUM] Creer un rapport de flux de tresorerie (cash flow statement)
- **Fichier**: Nouveau `src/lib/accounting/cash-flow-statement.service.ts`
- **Description**: Generer le tableau des flux de tresorerie (activites d'exploitation, investissement, financement) a partir des ecritures.
- **Impact**: Etat financier complet #3 (apres bilan et resultats).
- **Effort**: Large.

## A046 [MEDIUM] Implementer la consolidation multi-devises
- **Fichier**: Etendre currency.service.ts
- **Description**: Permettre la consolidation de toutes les ecritures en devises dans une vue CAD unifiee.
- **Impact**: Vue financiere consolidee.
- **Effort**: Moyen.

## A047 [MEDIUM] Ajouter des champs d'adresse structuree sur les factures
- **Fichier**: Schema CustomerInvoice, SupplierInvoice
- **Description**: Ajouter: address, city, province, postalCode, country au lieu d'un seul champ texte.
- **Impact**: Meilleure conformite fiscale et impression.
- **Effort**: Moyen.

## A048 [MEDIUM] Implementer les provisions pour creances douteuses automatiques
- **Fichier**: Etendre le scheduler
- **Description**: Calculer automatiquement les provisions basees sur l'aging (ex: 5% pour 30-60j, 20% pour 60-90j, 50% pour 90+j).
- **Impact**: Etats financiers plus prudents et realistes.
- **Effort**: Moyen.

## A049 [MEDIUM] Ajouter la detection de fraude basique
- **Fichier**: Nouveau `src/lib/accounting/fraud-detection.service.ts`
- **Description**: Detecter les patterns suspects: montants ronds repetitifs, ecritures juste sous les seuils d'approbation, horaires inhabituels.
- **Impact**: Controle interne ameliore.
- **Effort**: Moyen.

## A050 [MEDIUM] Implementer un systeme de pieces justificatives (attachments)
- **Fichier**: Schema Prisma + service d'upload
- **Description**: Permettre d'attacher des fichiers (factures PDF, recus) a chaque ecriture/depense avec stockage Azure Blob.
- **Impact**: Documentation complete de chaque transaction.
- **Effort**: Moyen.

## A051 [MEDIUM] Ajouter le support des remises de debut de paiement (escompte)
- **Fichier**: Schema CustomerInvoice
- **Description**: Gerer les termes 2/10 net 30 (2% de rabais si paye dans les 10 jours).
- **Impact**: Gestion financiere des escomptes.
- **Effort**: Faible.

## A052 [MEDIUM] Creer un rapport comparatif budget vs reel par mois
- **Fichier**: Etendre les rapports existants
- **Description**: Tableau: Budget | Reel | Ecart ($) | Ecart (%) pour chaque compte, par mois.
- **Impact**: Suivi budgetaire precis.
- **Effort**: Moyen.

## A053 [MEDIUM] Implementer les categories analytiques (centres de cout)
- **Fichier**: Schema Prisma (ajouter CostCenter, analytique sur JournalLine)
- **Description**: Permettre d'affecter chaque ligne d'ecriture a un centre de cout (marketing, operations, R&D).
- **Impact**: Analyse de rentabilite par activite.
- **Effort**: Moyen.

## A054 [MEDIUM] Ajouter le calcul du point mort (break-even)
- **Fichier**: Etendre KPI service
- **Description**: Calculer le chiffre d'affaires minimum pour couvrir les couts fixes + variables.
- **Impact**: Indicateur strategique pour la direction.
- **Effort**: Faible.

## A055 [MEDIUM] Implementer un mode de saisie rapide (speed entry)
- **Fichier**: Page admin ecritures
- **Description**: Interface keyboard-driven pour saisir des ecritures rapidement: Tab entre les champs, auto-complete des comptes, calcul automatique de la balance.
- **Impact**: Productivite du comptable x3.
- **Effort**: Moyen.

## A056 [MEDIUM] Ajouter la gestion des devises etrangeres pour les factures fournisseurs
- **Fichier**: Schema SupplierInvoice
- **Description**: Ajouter currency, exchangeRate, amountInCAD sur les factures fournisseurs.
- **Impact**: Support complet des fournisseurs internationaux.
- **Effort**: Moyen.

## A057 [MEDIUM] Creer un rapport de variations des capitaux propres
- **Fichier**: Nouveau service
- **Description**: Generer le tableau des variations des capitaux propres (4e etat financier).
- **Impact**: Jeu complet d'etats financiers.
- **Effort**: Moyen.

## A058 [MEDIUM] Implementer le verrouillage optimiste sur les factures
- **Fichier**: Routes factures clients et fournisseurs
- **Description**: Ajouter la verification `updatedAt` (comme fait pour les ecritures) pour eviter les modifications concurrentes.
- **Impact**: Integrite des factures.
- **Effort**: Faible.

## A059 [MEDIUM] Ajouter des statistiques de rapprochement
- **Fichier**: Dashboard rapprochement
- **Description**: Afficher: % transactions rapprochees, temps moyen de rapprochement, nombre de suggestions acceptees/rejetees.
- **Impact**: Suivi de la qualite du rapprochement.
- **Effort**: Faible.

## A060 [MEDIUM] Implementer l'envoi de factures par email
- **Fichier**: Service d'envoi email
- **Description**: Permettre l'envoi de factures clients en PDF par email directement depuis l'interface.
- **Impact**: Processus de facturation complet.
- **Effort**: Moyen.

## A061 [MEDIUM] Ajouter la gestion des acomptes clients (deposits)
- **Fichier**: Schema et service
- **Description**: Gerer les acomptes recus avant livraison avec le compte de produits reportes (2800).
- **Impact**: Comptabilisation correcte des acomptes.
- **Effort**: Moyen.

## A062 [MEDIUM] Creer un rapport de marges par produit/categorie
- **Fichier**: Nouveau rapport
- **Description**: Croiser les donnees de vente (Order) avec le cout des marchandises pour calculer la marge par produit.
- **Impact**: Analyse de rentabilite par produit.
- **Effort**: Moyen.

## A063 [MEDIUM] Implementer la comptabilisation automatique des abonnements
- **Fichier**: Connecter Subscription model aux ecritures
- **Description**: Quand un abonnement est renouvele, creer automatiquement l'ecriture de vente correspondante.
- **Impact**: Automatisation complete du cycle de vente recurrente.
- **Effort**: Moyen.

## A064 [MEDIUM] Ajouter le support des notes de credit partielles
- **Fichier**: Etendre credit-notes
- **Description**: Permettre d'emettre une note de credit pour une partie seulement d'une facture (ex: 1 item sur 3).
- **Impact**: Flexibilite dans la gestion des retours.
- **Effort**: Faible.

## A065 [MEDIUM] Implementer un systeme de tags/etiquettes sur les ecritures
- **Fichier**: Schema JournalEntry
- **Description**: Ajouter un champ `tags String[]` pour classifier les ecritures (ex: "projet-X", "client-Y").
- **Impact**: Recherche et filtrage avances.
- **Effort**: Faible.

## A066 [MEDIUM] Ajouter la conversion automatique des montants dans les rapports
- **Fichier**: Tous les services de rapports
- **Description**: Permettre de generer les rapports dans n'importe quelle devise (CAD, USD, EUR) avec conversion automatique.
- **Impact**: Rapports adaptes aux investisseurs etrangers.
- **Effort**: Moyen.

## A067 [MEDIUM] Creer un calendrier fiscal interactif
- **Fichier**: Page admin comptabilite
- **Description**: Afficher un calendrier avec toutes les echeances fiscales (utilisant FISCAL_DEADLINES existant) avec rappels visuels.
- **Impact**: Vue d'ensemble des obligations fiscales.
- **Effort**: Moyen.

## A068 [MEDIUM] Implementer le calcul des acomptes provisionnels d'impot
- **Fichier**: Nouveau service
- **Description**: Calculer les acomptes mensuels/trimestriels bases sur l'impot de l'annee precedente ou l'estimation de l'annee courante.
- **Impact**: Planification fiscale proactive.
- **Effort**: Moyen.

## A069 [LOW] Ajouter un mode sombre au module comptabilite
- **Fichier**: Toutes les pages admin/comptabilite
- **Description**: Supporter le mode sombre pour les longues sessions de travail comptable.
- **Impact**: Confort visuel pour les utilisateurs.
- **Effort**: Faible.

## A070 [LOW] Implementer le drag-and-drop pour reordonner les lignes d'ecritures
- **Fichier**: Frontend ecritures
- **Description**: Permettre de reordonner les lignes d'une ecriture par drag-and-drop.
- **Impact**: UX amelioree.
- **Effort**: Faible.

## A071 [LOW] Ajouter des tooltips explicatifs sur les termes comptables
- **Fichier**: Toutes les pages comptables
- **Description**: Ajouter des icones (?) avec tooltip expliquant les termes comptables (CTI, RTI, DPA, etc.).
- **Impact**: Accessibilite pour les non-comptables.
- **Effort**: Faible.

## A072 [LOW] Creer un guide d'utilisation integre (onboarding)
- **Fichier**: Composant de guided tour
- **Description**: Un wizard interactif qui guide les nouveaux utilisateurs dans la configuration comptable initiale.
- **Impact**: Adoption facilitee.
- **Effort**: Moyen.

## A073 [LOW] Ajouter l'export Excel (XLSX) en plus du CSV
- **Fichier**: Services d'export
- **Description**: Generer des fichiers Excel avec formatage, en-tetes, et totaux automatiques (via xlsx library).
- **Impact**: Rapports plus professionnels.
- **Effort**: Faible.

## A074 [LOW] Implementer la recherche globale comptable
- **Fichier**: Nouveau composant de recherche
- **Description**: Barre de recherche unifiee qui cherche dans: ecritures, factures, depenses, comptes, par numero, description ou montant.
- **Impact**: Navigation rapide dans le module comptable.
- **Effort**: Moyen.

## A075 [LOW] Ajouter des raccourcis clavier pour les actions frequentes
- **Fichier**: Hook useKeyboardShortcuts (deja partiellement implemente)
- **Description**: Connecter les raccourcis definis dans quick-entry.service.ts au frontend.
- **Impact**: Productivite du comptable.
- **Effort**: Faible.

## A076 [LOW] Implementer un systeme de favoris/signets
- **Fichier**: Frontend
- **Description**: Permettre de marquer des ecritures/factures comme favoris pour un acces rapide.
- **Impact**: Ergonomie.
- **Effort**: Faible.

## A077 [LOW] Ajouter des indicateurs de performance par page
- **Fichier**: Layout admin comptabilite
- **Description**: Afficher le temps de chargement et le nombre de requetes DB par page pour le debugging.
- **Impact**: Aide au diagnostic des problemes de performance.
- **Effort**: Faible.

## A078 [LOW] Implementer la sauvegarde automatique (auto-save) des ecritures en brouillon
- **Fichier**: Frontend ecritures
- **Description**: Sauvegarder automatiquement les ecritures DRAFT toutes les 30 secondes pour eviter la perte de donnees.
- **Impact**: Prevention de la perte de travail.
- **Effort**: Faible.

## A079 [LOW] Ajouter le support du format comptable europeen (virgule decimale)
- **Fichier**: Services de formatage
- **Description**: Permettre l'affichage des montants avec virgule decimale (1 234,56) ou point (1,234.56) selon la locale.
- **Impact**: Support international.
- **Effort**: Faible.

## A080 [LOW] Creer des vues resumees pour les ecritures complexes
- **Fichier**: Frontend ecritures
- **Description**: Pour les ecritures avec 10+ lignes, afficher un resume (total debit, total credit, comptes principaux) avant le detail.
- **Impact**: Lisibilite amelioree.
- **Effort**: Faible.

## A081 [LOW] Implementer la comparaison periode a periode
- **Fichier**: Pages de rapports
- **Description**: Permettre de comparer deux periodes cote-a-cote (ex: janvier 2025 vs janvier 2026) avec calcul des ecarts.
- **Impact**: Analyse de tendances.
- **Effort**: Moyen.

## A082 [LOW] Ajouter un flux RSS/webhook pour les alertes comptables
- **Fichier**: Etendre le systeme d'alertes
- **Description**: Permettre de recevoir les alertes comptables via webhook (Slack, Teams) ou RSS.
- **Impact**: Notifications en temps-reel pour l'equipe.
- **Effort**: Moyen.

## A083 [LOW] Implementer l'archivage des periodes anciennes
- **Fichier**: Nouveau service d'archivage
- **Description**: Deplacer les ecritures et factures de plus de 3 ans dans des tables d'archive pour optimiser les performances.
- **Impact**: Performance a long terme.
- **Effort**: Moyen.

## A084 [LOW] Ajouter un systeme de commentaires sur les factures
- **Fichier**: Schema CustomerInvoice/SupplierInvoice
- **Description**: Permettre d'ajouter des commentaires chronologiques sur les factures (historique de communication).
- **Impact**: Tracabilite des echanges.
- **Effort**: Faible.

## A085 [LOW] Creer un rapport de tresorerie previsionnelle 12 mois
- **Fichier**: Etendre le service forecasting
- **Description**: Generer un rapport detaille mois par mois avec toutes les entrees/sorties prevues.
- **Impact**: Planification financiere avancee.
- **Effort**: Moyen.

## A086 [LOW] Implementer le suivi des engagements hors-bilan
- **Fichier**: Nouvelle fonctionnalite
- **Description**: Gerer les engagements (baux, contrats a long terme) qui ne sont pas au bilan mais requis en notes.
- **Impact**: Conformite NCECF/IFRS.
- **Effort**: Large.

## A087 [LOW] Ajouter le calcul du BFR (besoin en fonds de roulement)
- **Fichier**: Etendre KPI service
- **Description**: BFR = Stock + Clients - Fournisseurs. Indicateur cle pour la gestion de tresorerie.
- **Impact**: KPI supplementaire important.
- **Effort**: Faible.

## A088 [LOW] Implementer la gestion des comptes d'attente (suspense accounts)
- **Fichier**: Nouveau service
- **Description**: Permettre de comptabiliser temporairement dans un compte d'attente quand la classification finale n'est pas encore connue.
- **Impact**: Flexibilite comptable.
- **Effort**: Faible.

## A089 [LOW] Ajouter un indicateur de sante du rapprochement bancaire
- **Fichier**: Dashboard comptabilite
- **Description**: Widget montrant: % rapproche, nombre de jours depuis le dernier rapprochement, montant non rapproche.
- **Impact**: Visibilite sur l'etat du rapprochement.
- **Effort**: Faible.

## A090 [LOW] Creer un rapport d'ecart de caisse
- **Fichier**: Nouveau rapport
- **Description**: Comparer le solde comptable avec le solde bancaire reel et expliquer les ecarts.
- **Impact**: Controle interne.
- **Effort**: Moyen.

## A091 [LOW] Ajouter la possibilite de dupliquer une facture
- **Fichier**: Frontend factures
- **Description**: Bouton pour creer une copie d'une facture existante avec les memes items (nouvelle date, nouveau numero).
- **Impact**: Gain de temps pour la facturation repetitive.
- **Effort**: Faible.

## A092 [LOW] Implementer un historique des taux de change utilises
- **Fichier**: Nouvelle table et UI
- **Description**: Conserver un historique de tous les taux utilises dans les ecritures pour reference et audit.
- **Impact**: Tracabilite des conversions.
- **Effort**: Faible.

## A093 [LOW] Ajouter la gestion des comptes bancaires multiples par institution
- **Fichier**: Frontend comptes bancaires
- **Description**: Interface pour gerer plusieurs comptes (operations, epargne, USD) par institution.
- **Impact**: Gestion complete de la tresorerie.
- **Effort**: Faible (modele deja supporte).

## A094 [LOW] Implementer le rapprochement inter-comptes
- **Fichier**: Nouveau service
- **Description**: Reconcilier automatiquement les transferts entre comptes bancaires propres (debit sur un = credit sur l'autre).
- **Impact**: Simplification du rapprochement.
- **Effort**: Moyen.

## A095 [LOW] Ajouter des graphiques de tendance sur le dashboard
- **Fichier**: Dashboard comptabilite
- **Description**: Graphiques sparkline pour: revenus, depenses, tresorerie, marge brute sur les 12 derniers mois.
- **Impact**: Vue visuelle instantanee des tendances.
- **Effort**: Faible.

## A096 [LOW] Creer un rapport de verification pre-audit
- **Fichier**: Nouveau service
- **Description**: Checklist automatisee: ecritures non postees, periodes non fermees, comptes avec solde anormal, factures en retard excessif.
- **Impact**: Preparation d'audit acceleree.
- **Effort**: Moyen.

## A097 [LOW] Implementer la numerotation automatique des factures fournisseurs internes
- **Fichier**: Route factures fournisseurs
- **Description**: En plus du numero fournisseur, generer un numero de reference interne sequentiel.
- **Impact**: Meilleur suivi interne.
- **Effort**: Faible.

## A098 [LOW] Ajouter le support du paiement partiel sur les factures
- **Fichier**: Frontend et API factures
- **Description**: Interface pour enregistrer un paiement partiel et mettre a jour le statut (PARTIAL) avec le nouveau solde.
- **Impact**: Gestion complete du cycle de paiement.
- **Effort**: Moyen.

## A099 [LOW] Implementer un systeme de templates personnalisables pour les rapports
- **Fichier**: Nouveau service
- **Description**: Permettre aux utilisateurs de creer leurs propres rapports en selectionnant les comptes et periodes.
- **Impact**: Flexibilite de reporting.
- **Effort**: Large.

## A100 [LOW] Ajouter la compatibilite avec les logiciels comptables externes
- **Fichier**: Nouveau service d'import/export
- **Description**: Supporter l'import/export en format compatible avec QuickBooks (IIF), Sage (CSV), et Xero (CSV).
- **Impact**: Migration et integration facilitees.
- **Effort**: Large.

---

# ANNEXE: Fichiers Principaux Audites

| Fichier | Type | Failles | Ameliorations citees |
|---------|------|---------|---------------------|
| `src/lib/accounting/stripe-sync.service.ts` | Service | F001, F007, F010 | A005, A016 |
| `src/app/api/accounting/expenses/route.ts` | API Route | F002, F015, F026 | A025 |
| `src/lib/financial.ts` | Utilitaire | F003 | A001 |
| `src/app/api/accounting/chart-of-accounts/route.ts` | API Route | F004, F025 | A006, A013 |
| `src/lib/accounting/types.ts` | Types | F005 | A007 |
| `src/app/api/accounting/gst-qst-declaration/route.ts` | API Route | F006 | A022 |
| `prisma/schema.prisma` | Schema | F008, F009, F047 | A013, A015 |
| `src/lib/accounting/auto-reconciliation.service.ts` | Service | F014, F031, F046, F053 | A010, A012 |
| `src/lib/accounting/currency.service.ts` | Service | F013, F019, F020 | A034, A046 |
| `src/lib/accounting/reconciliation.service.ts` | Service | F018, F070 | A031, A059 |
| `src/lib/accounting/auto-entries.service.ts` | Service | F011, F018, F069 | A002 |
| `src/lib/accounting/bank-import.service.ts` | Service | F032, F033, F051, F057, F092 | A020, A029 |
| `src/lib/accounting/alert-rules.service.ts` | Service | F035, F036 | A021 |
| `src/lib/accounting/ml-reconciliation.service.ts` | Service | F029, F076, F080, F095 | A012, A040 |
| `src/lib/accounting/payment-matching.service.ts` | Service | F037 | A032 |
| `src/lib/accounting/kpi.service.ts` | Service | F038 | A023, A054 |
| `src/lib/accounting/webhook-accounting.service.ts` | Service | F039, F041, F073, F078, F079, F093 | A005, A016, A063 |
| `src/lib/accounting/recurring-entries.service.ts` | Service | F042, F063 | A002 |
| `src/lib/accounting/tax-compliance.service.ts` | Service | F043, F050, F062 | A022 |
| `src/lib/accounting/audit-trail.service.ts` | Service | F044, F045, F088 | A009, A037 |
| `src/lib/accounting/quick-entry.service.ts` | Service | F030, F040, F072, F074 | A055, A075 |
| `src/lib/accounting/aging.service.ts` | Service | F034, F061, F067, F085, F098 | A048 |
| `src/lib/accounting/alerts.service.ts` | Service | F060, F065, F068, F077 | A021, A082 |
| `src/lib/accounting/forecasting.service.ts` | Service | F052, F075, F086, F094, F100 | A038, A085 |
| `src/lib/accounting/validation.ts` | Schemas | F017 | A008 |
| `src/lib/accounting/canadian-tax-config.ts` | Config | F099 | A007, A026 |
| `src/lib/accounting/gifi-codes.ts` | Data | F071 | A028 |
| `src/lib/accounting/error-handler.ts` | Utilitaire | - | A003 |
| `src/lib/accounting/scheduler.service.ts` | Service | F064, F089 | A064 |
| `src/app/api/accounting/reconciliation/route.ts` | API Route | F022, F058, F059 | A020, A031 |
| `src/app/api/accounting/tax-reports/route.ts` | API Route | F016, F056, F083 | A022 |
| `src/app/api/accounting/supplier-invoices/route.ts` | API Route | F012, F028, F055 | A056 |
| `src/app/api/accounting/customer-invoices/route.ts` | API Route | F054 | A060, A091 |
| `src/app/api/accounting/bank-accounts/route.ts` | API Route | F027 | A093 |
| `src/lib/accounting/expense.service.ts` | Service | F021 | A053 |
| `src/lib/accounting/period-close.service.ts` | Service | F048 | A017 |
| `src/lib/accounting/ocr.service.ts` | Service | F049, F081, F087 | A050 |

---

*Audit realise par analyse statique exhaustive du code source. Aucune execution dynamique n'a ete effectuee.*
*Recommandation: Prioriser les 18 failles CRITICAL et les 12 ameliorations CRITICAL en premier sprint.*

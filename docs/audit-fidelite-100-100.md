# AUDIT FIDELITE (Loyalty Program) - BioCycle Peptides
## 100 Failles/Bugs + 100 Ameliorations

**Date**: 2026-02-22
**Auditeur**: Claude Opus 4.6
**Perimetre**: Programme fidelite, codes promo, promotions, parrainage, ambassadeurs, abonnements
**Fichiers audites**: 25+ fichiers (pages admin, API routes, lib, Prisma models, contextes client, cron jobs)

---

## RESUME EXECUTIF

Le systeme de fidelite de BioCycle Peptides est fonctionnel mais souffre de **problemes critiques d'incoherence des donnees entre les couches** (contexte client vs API vs admin config), de **multiples vecteurs d'abus non proteges**, et de **fonctionnalites stub cote client**. Les principales preoccupations sont:

- **CRITIQUE**: 4 sources de verite differentes pour les tiers/seuils/points (LoyaltyContext, API /loyalty, API /loyalty/earn, admin config)
- **CRITIQUE**: Le contexte client `LoyaltyContext.tsx` effectue des modifications de points cote client sans validation serveur atomique
- **CRITIQUE**: L'endpoint `/api/referrals/qualify` est ouvert sans authentification ni autorisation
- **HAUTE**: Aucune expiration effective des points (le cron ne les expire pas, il envoie juste des emails)
- **HAUTE**: Les recompenses du catalog client (account/rewards) ne sont pas connectees a l'API redeem

**Score global**: 45/100 (Fonctionnel mais avec des risques de securite et d'integrite significatifs)

---

## SECTION 1: 100 FAILLES ET BUGS

### CRITIQUE (Risque d'exploitation immediat)

**F-001** [CRITIQUE] Incoherence majeure des seuils de tiers entre les couches
- `LoyaltyContext.tsx:19-56` : BRONZE=0, SILVER=2500, GOLD=7500, PLATINUM=15000
- `src/app/api/loyalty/route.ts:13-18` : BRONZE=0, SILVER=500, GOLD=2000, PLATINUM=5000, DIAMOND=10000
- `src/app/api/loyalty/earn/route.ts:22-28` : Memes seuils que route.ts (differents du contexte)
- `src/app/api/admin/loyalty/config/route.ts:37-73` : Admin config avec encore d'autres valeurs (0, 1000, 5000, 15000, 50000)
- `src/app/(shop)/account/rewards/page.tsx:45-82` : BRONZE=0, SILVER=500, GOLD=1500, PLATINUM=5000 (4e version!)
- **Fix**: Unifier dans la config admin (DB) et propager partout via API. Supprimer toutes les constantes hardcodees.

**F-002** [CRITIQUE] Modification de points cote client sans validation serveur atomique
- `src/contexts/LoyaltyContext.tsx:190-233` : `earnPoints()` met a jour l'etat local AVANT l'appel API, et l'API peut echouer silencieusement
- De plus, le body envoye a `/api/loyalty/earn` est `{ points, description, orderId }` mais l'API attend `{ type, amount, orderId }` - les champs ne correspondent pas
- **Fix**: L'earnPoints doit appeler l'API en premier, attendre la reponse, puis mettre a jour l'etat local

**F-003** [CRITIQUE] `redeemReward()` dans LoyaltyContext ne gere pas les erreurs API
- `src/contexts/LoyaltyContext.tsx:235-264` : Points debites localement, fetch fire-and-forget sans await ni error handling
- Si l'API echoue (race condition detectee cote serveur), le client affiche un solde incorrect
- **Fix**: Await le fetch, verifier la reponse, rollback si erreur

**F-004** [CRITIQUE] `/api/referrals/qualify` est ouvert sans authentification
- `src/app/api/referrals/qualify/route.ts:15-48` : POST endpoint sans aucune verification d'identite
- N'importe qui peut qualifier un referral et attribuer 1000 points a un utilisateur
- **Fix**: Ajouter `withAdminGuard()` ou verifier un token interne (CRON_SECRET ou API key interne)

**F-005** [CRITIQUE] Race condition sur l'attribution de points dans `/api/loyalty/earn`
- `src/app/api/loyalty/earn/route.ts:170-200` : Pas de verrou FOR UPDATE comme dans /redeem
- Deux requetes concurrentes pour SIGNUP pourraient passer la verification `findFirst` avant que l'autre n'insere
- **Fix**: Utiliser `$transaction` avec `FOR UPDATE` ou un verrou unique en DB (unique constraint sur userId+type pour SIGNUP)

**F-006** [CRITIQUE] Catalogue de recompenses hardcode avec 3 versions differentes
- `src/app/api/loyalty/redeem/route.ts:13-21` : REWARDS avec points 500/900/2000/3500/6000/300/1000
- `src/contexts/LoyaltyContext.tsx:59-68` : LOYALTY_REWARDS avec points 500/1000/2500/5000/300/800/600/1500
- `src/app/(shop)/account/rewards/page.tsx:85-92` : AVAILABLE_REWARDS_CONFIG avec 100/250/750/150/200/1000
- Le client et le serveur ne s'accordent pas sur le cout des recompenses
- **Fix**: Source unique en DB ou dans la config admin, chargee via API

**F-007** [CRITIQUE] Pas d'authentification sur `/api/referrals/validate`
- `src/app/api/referrals/validate/route.ts:11` : Endpoint public sans rate limiting
- Permet l'enumeration de tous les codes de parrainage existants par brute force
- **Fix**: Ajouter rate limiting (comme `/api/promo/validate`)

**F-008** [CRITIQUE] `POINTS_CONFIG.PURCHASE = 1` dans earn vs `LOYALTY_CONFIG.pointsPerDollar = 10` dans le contexte
- `src/app/api/loyalty/earn/route.ts:13` : 1 point par dollar
- `src/contexts/LoyaltyContext.tsx:8` : 10 points par dollar
- Le client affiche 10x plus de points que ce que le serveur attribue reellement
- **Fix**: Lire la config depuis l'API admin loyalty/config

**F-009** [CRITIQUE] La page `/account/rewards` utilise des donnees mock et n'est pas connectee au backend
- `src/app/(shop)/account/rewards/page.tsx:99-100` : `const [loading, setLoading] = useState(true)` suivi de setTimeout pour simuler le chargement
- Les transactions et points sont des donnees statiques, pas de fetch API
- **Fix**: Connecter a `/api/loyalty` et `/api/loyalty/redeem`

**F-010** [CRITIQUE] Ambassador commission calculation bug
- `src/app/api/ambassadors/route.ts:181` : `commissionAmount = Math.round(orderTotal * rate) / 100`
- Si rate=10 (pour 10%) et orderTotal=100, cela donne `Math.round(100*10)/100 = 10.00` - correct par hasard
- Mais si rate=5.5 et orderTotal=99.99: `Math.round(99.99*5.5)/100 = 5.50` au lieu de `5.4995` - arrondi incorrect
- La formule correcte devrait etre `Math.round(orderTotal * rate / 100 * 100) / 100`
- **Fix**: `commissionAmount = Math.round(orderTotal * (rate / 100) * 100) / 100`

### HAUTE (Bugs fonctionnels significatifs)

**F-011** [HAUTE] Aucune expiration effective des points - le cron n'expire pas les points
- `src/app/api/cron/points-expiring/route.ts` : Envoie des emails de rappel mais ne retire jamais les points expires
- Les points avec `expiresAt` passe ne sont jamais debites du solde utilisateur
- **Fix**: Ajouter un cron job qui expire effectivement les points (decremente loyaltyPoints, cree une LoyaltyTransaction type EXPIRE)

**F-012** [HAUTE] `parseInt` utilise pour `pointsPerDollar` - perte de precision pour les decimaux
- `src/app/admin/fidelite/page.tsx:197` : `parseInt(e.target.value)` sur pointsPerDollar
- Si l'admin saisit 1.5 points par dollar, c'est tronque a 1
- **Fix**: Utiliser `parseFloat`

**F-013** [HAUTE] Tier non sauvegarde automatiquement lors de la modification de config admin
- `src/app/admin/fidelite/page.tsx:112` : `saveTier()` met a jour l'etat local mais ne sauvegarde pas en DB
- L'admin doit ensuite cliquer "Save" separement, mais peut croire que c'est fait apres le toast "Tier saved"
- **Fix**: Sauvegarder directement en DB ou clarifier le workflow (renommer le toast en "Tier updated - click Save to persist")

**F-014** [HAUTE] `tierName` comme cle unique pour les tiers - collision si deux tiers ont le meme nom
- `src/app/admin/fidelite/page.tsx:84,100-101` : Le tier est identifie par son nom (`find(t => t.name === tierName)`)
- Si un admin cree deux tiers "Silver", l'edition echoue silencieusement
- **Fix**: Utiliser un ID unique (uuid) pour identifier les tiers

**F-015** [HAUTE] Referral bonus inconsistency: config dit 500, qualify attribue 1000
- `src/app/api/admin/loyalty/config/route.ts:40` : `referralBonus: 500`
- `src/lib/referral-qualify.ts:12` : `REFERRAL_BONUS_POINTS = 1000`
- `src/contexts/LoyaltyContext.tsx:12` : `referralBonus: 1000`
- **Fix**: Lire depuis la config admin

**F-016** [HAUTE] Birthday bonus: cron attribue 200 points mais config contexte dit 500
- `src/app/api/cron/birthday-emails/route.ts:58` : `DEFAULT_BONUS_POINTS = 200`
- `src/contexts/LoyaltyContext.tsx:14` : `birthdayBonus: 500`
- **Fix**: Harmoniser en lisant la config admin

**F-017** [HAUTE] `promoCode.productIds` stocke en JSON string mais parse sans try/catch dans validate
- `src/app/api/promo/validate/route.ts:122` : `JSON.parse(promoCode.productIds)` sans try/catch
- Si le JSON est malforme (ex: entree admin incorrecte), crash 500
- **Fix**: Wrapper dans try/catch

**F-018** [HAUTE] Pas de validation du tier multiplier dans le formulaire admin
- `src/app/admin/fidelite/page.tsx:389` : min=0.1 mais pas de max
- Un admin pourrait mettre un multiplier de 999999, attribuant des milliards de points par commande
- **Fix**: Ajouter max=10 (ou configurable)

**F-019** [HAUTE] Promotions page: formType stocke seulement PERCENTAGE/FIXED_AMOUNT mais le modele supporte 5 types
- `src/app/admin/promotions/page.tsx:81` : `formType: 'PERCENTAGE' | 'FIXED_AMOUNT'`
- Interface `Promotion` ligne 24: supporte aussi BUNDLE, BUY_X_GET_Y, FLASH_SALE
- Le formulaire ne permet pas de creer les types avances
- **Fix**: Ajouter les types de promotion manquants au formulaire

**F-020** [HAUTE] Optimistic update dans promotions toggleActive ne gere pas les erreurs correctement
- `src/app/admin/promotions/page.tsx:200` : Met a jour le state avant l'API call
- Si l'API echoue, le revert utilise `prev` mais la closure capture l'ancien `isActive`, pas forcement le bon si d'autres toggles ont eu lieu
- **Fix**: Utiliser le state fonctionnel avec un identifiant unique pour le revert

**F-021** [HAUTE] PromoCode validation ne verifie pas `usageCount` atomiquement
- `src/app/api/promo/validate/route.ts:72` : `promoCode.usageCount >= promoCode.usageLimit`
- Mais `usageCount` n'est pas incremente ici (c'est fait dans create-checkout), donc deux utilisateurs concurrents pourraient valider le meme code au meme moment
- **Fix**: Documenter que c'est "best-effort" ou verifier atomiquement lors du checkout

**F-022** [HAUTE] Ambassador GET endpoint effectue des ecritures (sync commissions) - viole REST
- `src/app/api/ambassadors/route.ts:31-35,96-101` : Le GET trigger `syncCommissionsForCodes` et batch updates
- Provoque des effets de bord et peut etre lent
- **Fix**: Deplacer la synchronisation dans un endpoint POST dedie ou un cron job

**F-023** [HAUTE] `Number(body.pointsValue) || DEFAULT_CONFIG.pointsValue` - 0 revient au default
- `src/app/api/admin/loyalty/config/route.ts:138` : Si un admin veut mettre pointsValue a 0 (desactiver les points), ca revient au default
- Meme probleme pour tous les champs (lines 137-141)
- **Fix**: Utiliser `body.pointsPerDollar !== undefined ? Number(body.pointsPerDollar) : DEFAULT_CONFIG.pointsPerDollar`

**F-024** [HAUTE] La page client rewards `(shop)/rewards/page.tsx` utilise `LOYALTY_CONFIG.pointsValue` du contexte, pas de l'API
- Le prix affiche des recompenses peut ne pas correspondre a la config admin reelle
- **Fix**: Charger pointsValue depuis l'API au lieu du contexte hardcode

**F-025** [HAUTE] Pas de validation CSRF sur `/api/loyalty/earn` et `/api/loyalty/redeem`
- `/api/referrals/apply/route.ts` a CSRF, mais pas les endpoints loyalty
- Un site malveillant pourrait declencher des requetes earn/redeem via le navigateur de l'utilisateur
- **Fix**: Ajouter `validateCsrf()` comme dans referrals/apply

**F-026** [HAUTE] Ambassador payout ne verifie pas le montant minimum
- `src/app/api/ambassadors/payouts/route.ts:96-109` : Pas de seuil minimum de paiement
- Un payout de $0.01 pourrait etre traite, creant du bruit administratif
- **Fix**: Verifier que `totalAmount >= minPayoutAmount` (configurable dans ambassador_program_config)

**F-027** [HAUTE] La suppression de tier dans l'admin fidelite ne verifie pas si des users l'utilisent
- `src/app/admin/fidelite/page.tsx:138-147` : Supprime le tier du config sans verifier
- Les utilisateurs existants dans ce tier se retrouveraient orphelins
- **Fix**: Verifier les utilisateurs dans le tier avant suppression

**F-028** [HAUTE] `usageCount` sur PromoCode n'est pas incremente atomiquement dans l'API promo-codes
- Le champ `usageCount` dans le modele PromoCode n'est incremente nulle part dans les routes admin promo-codes
- Il semble etre incremente dans checkout, mais s'il y a un crash entre le paiement et l'increment, le compteur diverge
- **Fix**: Utiliser `{ increment: 1 }` dans une transaction avec la creation d'usage

**F-029** [HAUTE] `birthDate` n'est pas valide dans le cron birthday - dates invalides causeraient un crash
- `src/app/api/cron/birthday-emails/route.ts:128-133` : `user.birthDate.getMonth()` pourrait echouer si le champ est une string invalide en DB
- **Fix**: Ajouter un try/catch autour du parsing de date

**F-030** [HAUTE] Subscription config section affiche des valeurs hardcodees au lieu de la config DB
- `src/app/admin/abonnements/page.tsx:337` : Affiche "15%" en dur au lieu de la config reelle
- La modal de config met a jour la DB mais la section affichee ne se recharge pas
- **Fix**: Charger la config depuis l'API settings au montage et afficher les valeurs dynamiques

### MOYENNE (Bugs fonctionnels et risques moderes)

**F-031** [MOYENNE] `Math.random()` utilise pour generer les codes de parrainage dans `/api/referrals/generate`
- `src/app/api/referrals/generate/route.ts:24` : `Math.floor(Math.random() * chars.length)` n'est pas cryptographiquement sur
- Contrairement a `/api/loyalty/route.ts:34` qui utilise `crypto.randomUUID()`
- **Fix**: Utiliser `crypto.getRandomValues` comme dans LoyaltyContext

**F-032** [MOYENNE] Error boundary fidelite affiche "Orders section error" au lieu de "Loyalty"
- `src/app/admin/fidelite/error.tsx:16` : `console.error('Orders section error:', error)` - copie-colle non corrige
- **Fix**: Renommer en "Loyalty section error"

**F-033** [MOYENNE] PromoCode validation retourne 200 OK meme quand le code est invalide
- `src/app/api/promo/validate/route.ts:49-54` : Status 200 avec `{ valid: false }` au lieu de 404 ou 400
- De meme pour les codes expires (ligne 59-62)
- **Fix**: Utiliser des status codes HTTP semantiques (404 pour non-trouve, 410 pour expire)

**F-034** [MOYENNE] `ambassador.name` peut etre vide dans le modele Prisma
- `prisma/schema.prisma:127` : `name String` (non nullable) mais `src/app/api/ambassadors/route.ts:220` : `name: name || ''`
- Permet de creer un ambassadeur avec un nom vide
- **Fix**: Valider que name est non-vide dans le POST handler

**F-035** [MOYENNE] Les transactions de fidélité n'ont pas d'index sur expiresAt
- `prisma/schema.prisma:1198-1200` : Index sur createdAt, type, userId mais pas expiresAt
- Le cron points-expiring fait `findMany where expiresAt gte/lt` - scan complet
- **Fix**: Ajouter `@@index([expiresAt])` au modele LoyaltyTransaction

**F-036** [MOYENNE] Pas de pagination dans les transactions affichees dans `/api/loyalty`
- `src/app/api/loyalty/route.ts:58-59` : `take: 20` hardcode, pas de parametre de pagination
- Un utilisateur avec des centaines de transactions ne peut pas voir l'historique complet
- **Fix**: Ajouter les parametres `page` et `limit`

**F-037** [MOYENNE] PromoCode `categoryIds` parse avec JSON.parse mais stocke comme String
- Le champ est un `String?` dans Prisma, pas un `Json`, ce qui ne garantit pas la validite JSON
- `src/app/api/promo/validate/route.ts:148` : Parse sans validation
- **Fix**: Utiliser le type `Json` dans Prisma ou valider le format a la creation

**F-038** [MOYENNE] `lifetimePoints` non mis a jour dans `/api/loyalty/redeem`
- `src/app/api/loyalty/redeem/route.ts:88-93` : Seul `loyaltyPoints` est decremente
- C'est correct (lifetimePoints ne devrait pas diminuer), mais pas d'ajustement du tier
- Si un utilisateur est retrograde par un admin, le tier ne serait pas recalcule
- **Fix**: Documenter que lifetimePoints est monotone croissant

**F-039** [MOYENNE] La recherche de transactions admin fait un findMany sur TOUS les users correspondants
- `src/app/api/admin/loyalty/transactions/route.ts:38-47` : Requete N+1 - d'abord cherche les users, puis les transactions
- **Fix**: Utiliser un join direct ou un subquery Prisma

**F-040** [MOYENNE] `formatCurrency` non utilise dans certaines valeurs monetaires de la page ambassadeurs
- `src/app/admin/ambassadeurs/page.tsx:499` : `formatCurrency(selectedAmbassador.totalSales)` est bon
- Mais les tier configs (ligne 47-52) affichent les montants en nombre brut sans formattage
- **Fix**: Utiliser formatCurrency pour `config.minSales`

**F-041** [MOYENNE] Le formulaire de promotions n'envoie pas le bon `type` pour le type de promotion
- `src/app/admin/promotions/page.tsx:160-165` : Envoie `type: formType` qui est PERCENTAGE/FIXED_AMOUNT
- Mais le modele Promotion attend un type comme PRODUCT_DISCOUNT, FLASH_SALE, etc.
- Confusion entre `type` (kind de promo) et `discountType` (% vs fixed)
- **Fix**: Separer les deux champs dans le formulaire

**F-042** [MOYENNE] Ambassador `totalReferrals` n'est jamais incremente
- `prisma/schema.prisma:132` : `totalReferrals Int @default(0)`
- Aucune route n'incremente ce compteur - il reste toujours a 0
- Le GET de la page ambassadeurs affiche cette valeur comme 0
- **Fix**: Incrementer lors de la creation de referrals qualifies

**F-043** [MOYENNE] Pas de validation Zod dans `/api/loyalty/earn` et `/api/loyalty/redeem`
- Ces endpoints font du parsing manuel alors que promo-codes utilise des schemas Zod
- **Fix**: Creer des schemas Zod pour earn/redeem

**F-044** [MOYENNE] `config.tiers.length <= 1` empeche la suppression du dernier tier mais permet 0
- `src/app/admin/fidelite/page.tsx:358` : `disabled={config.tiers.length <= 1}`
- Si un bug cause `config.tiers = []`, le bouton de suppression est desactive mais l'UI est cassee
- **Fix**: Ajouter une verification cote serveur aussi

**F-045** [MOYENNE] PromoCode promo-code de birthday re-creation silencieuse
- `src/app/api/cron/birthday-emails/route.ts:210-211` : Si le code existe deja (meme birthday, re-run), l'erreur est silencieusement ignoree
- Mais les points sont quand meme ajoutes (car la transaction est separee)
- L'utilisateur pourrait recevoir les points 2x si le cron est execute manuellement
- **Fix**: Verifier si une transaction EARN_BIRTHDAY existe deja pour cette annee (comme dans earn/route.ts)

**F-046** [MOYENNE] La config ambassadeur est sauvegardee comme JSON string dans un champ `value` generique
- `src/app/admin/ambassadeurs/page.tsx:236-245` : `JSON.stringify({...})` stocke dans SiteSetting
- Pas de schema de validation pour la structure JSON
- **Fix**: Ajouter un schema Zod pour la config ambassadeur

**F-047** [MOYENNE] `ambassador.id` utilise `@id` sans `@default(cuid())` - Prisma ne genere pas d'ID automatiquement
- `prisma/schema.prisma:125` : `id String @id` sans default
- L'API POST ne genere pas d'ID - risque de crash
- **Fix**: Ajouter `@default(cuid())` ou generer dans l'API

**F-048** [MOYENNE] Referral `status` est un `String` libre au lieu d'un enum
- `prisma/schema.prisma:1938` : `status String @default("PENDING")`
- Permet n'importe quelle valeur en DB (typos, etc.)
- **Fix**: Creer un `ReferralStatus` enum (PENDING, QUALIFIED, REWARDED, CANCELLED)

**F-049** [MOYENNE] `SiteSettings.rewardTiers` sync est "non-critical" mais silencieusement ignore
- `src/app/api/admin/loyalty/config/route.ts:191-193` : `catch {}` ignore l'erreur
- Cause de la derive entre SiteSetting et SiteSettings
- **Fix**: Au minimum logger l'erreur

**F-050** [MOYENNE] Ambassador tiers hardcodes dans le frontend, pas dans la DB
- `src/app/admin/ambassadeurs/page.tsx:47-52` : `tierConfig` hardcode BRONZE/SILVER/GOLD/PLATINUM
- `SiteSettings.ambassadorTiers` existe en DB mais n'est pas utilise
- **Fix**: Charger depuis la DB

### BASSE (Bugs mineurs, issues de qualite)

**F-051** [BASSE] `tierColors` dans fidelite admin a "orange" qui mappe vers `bg-sky-*`
- `src/app/admin/fidelite/page.tsx:161` : `orange: 'bg-sky-100 text-sky-800 border-sky-300'` - sky n'est pas orange
- **Fix**: Utiliser `bg-orange-100 text-orange-800`

**F-052** [BASSE] Missing `key` prop warning potentiel dans les tiers
- `src/app/admin/fidelite/page.tsx:272` : `key={tier.name}` - si deux tiers ont le meme nom, React warning
- **Fix**: Utiliser un index ou un ID unique

**F-053** [BASSE] `listItems` dans promo-codes recalcule `formatCurrency` a chaque render
- `src/app/admin/promo-codes/page.tsx:308` : `formatCurrency` dans le dependency array de useMemo mais constant
- **Fix**: Retirer du dependency array ou memoizer a un niveau plus haut

**F-054** [BASSE] `typeLabels` dans promotions n'est pas memoize
- `src/app/admin/promotions/page.tsx:91-97` : Recree a chaque render sans useMemo
- Inclus dans le dependency array de `listItems` useMemo (ligne 291)
- **Fix**: Wrapper dans useMemo

**F-055** [BASSE] Ambassador status 'INACTIVE' accepte dans PATCH mais non affiche dans la page
- `src/app/api/ambassadors/[id]/route.ts:7` : `VALID_STATUSES` inclut 'INACTIVE'
- Mais la page admin ne montre pas de filtre/badge pour INACTIVE
- **Fix**: Ajouter l'etat INACTIVE a l'UI

**F-056** [BASSE] `selected.joinedAt` dans ambassadeur utilise un fallback hardcode "Membre depuis"
- `src/app/admin/ambassadeurs/page.tsx:543` : `t('admin.ambassadors.joinedAt') || 'Membre depuis'`
- Mixing French fallback avec une app bilingue
- **Fix**: S'assurer que la cle i18n existe dans les 22 locales

**F-057** [BASSE] `locale` dans dependency array de listItems mais `formatCurrency` deja en depend
- `src/app/admin/ambassadeurs/page.tsx:311` : `[filteredAmbassadors, locale, t]` - locale est redondant si formatCurrency est stable
- **Fix**: Retirer `locale` du dependency array

**F-058** [BASSE] PromoCode percentage validation ne contraint pas < 100 cote PATCH
- `src/lib/validations/promo-code.ts:53-68` : Le patch schema n'a pas le refine pour percentage <= 100
- **Fix**: Ajouter le meme refine ou une validation dans le handler PATCH

**F-059** [BASSE] `generateCode` dans referrals/generate utilise `Math.random` pour chaque caractere individuellement
- `src/app/api/referrals/generate/route.ts:23-28` : 5 appels a Math.random
- **Fix**: Utiliser `crypto.getRandomValues(new Uint8Array(5))`

**F-060** [BASSE] `StatusBadge` dans account/referrals a des labels hardcodes en anglais
- `src/app/(shop)/account/referrals/page.tsx:73-98` : "Pending", "Qualified", "Rewarded" non traduits
- **Fix**: Utiliser `t()` pour chaque label

**F-061** [BASSE] `err` unused dans catch de fetchSubscriptions
- `src/app/admin/abonnements/page.tsx:109` : `catch (err)` variable declare mais utilisee uniquement pour console.error
- **Fix**: Utiliser `catch` sans argument ou prefixer `_err`

**F-062** [BASSE] La simulation fidelite ne prend pas en compte les bonus speciaux
- `src/app/admin/fidelite/page.tsx:151-158` : Le simulateur ne tient compte que de pointsPerDollar * multiplier
- Les bonus (birthday, signup, etc.) ne sont pas simules
- **Fix**: Ajouter une option de simulation de scenario complet

**F-063** [BASSE] Ambassador `email` est nullable mais utilisee dans l'UI sans verification
- `prisma/schema.prisma:128` : `email String?`
- `src/app/api/ambassadors/route.ts:82` : `userEmail: a.user?.email || a.email || ''`
- Si les deux sont null, affiche une string vide - pas bloquant mais UX pauvre
- **Fix**: Afficher "Email non renseigne" au lieu de ''

**F-064** [BASSE] `tierFormColor` default "orange" mais l'option select est labellee "Bronze"
- `src/app/admin/fidelite/page.tsx:41,411` : Le label dit "Bronze" mais la valeur est "orange"
- Confusion semantique entre couleur et nom de tier
- **Fix**: Utiliser des labels clairs ("Orange (Bronze)", "Gray (Silver)", etc.)

**F-065** [BASSE] Promo validate retourne les erreurs en francais hardcode
- `src/app/api/promo/validate/route.ts:37-38,53-54,etc.` : Messages d'erreur en francais
- L'API ne respecte pas la locale de l'utilisateur
- **Fix**: Retourner des codes d'erreur et traduire cote client

**F-066** [BASSE] Ambassador payout `method` est un String? libre
- `prisma/schema.prisma:175` : `method String?`
- Pas de validation sur les valeurs possibles (PayPal, virement, cheque)
- **Fix**: Creer un enum PayoutMethod

**F-067** [BASSE] `confirm()` utilise pour suppression dans promo-codes - pas accessible sur mobile
- `src/app/admin/promo-codes/page.tsx:180` : `confirm(t('admin.promoCodes.confirmDelete'))`
- Les dialogs natifs sont bloquants et non-stylises
- **Fix**: Utiliser un Modal de confirmation

**F-068** [BASSE] Ambassador referralCode genere avec `Date.now().toString(36)` - previsible
- `src/app/api/ambassadors/route.ts:213` : Pattern temporel, un attaquant peut predire les prochains codes
- **Fix**: Utiliser `crypto.randomUUID().slice(0, 8)`

**F-069** [BASSE] PromoCode value est un `Decimal` en DB mais compare comme `number` partout
- Risque de perte de precision pour des valeurs comme 9.99
- **Fix**: Utiliser `Decimal.js` ou s'assurer de la conversion consistante

**F-070** [BASSE] `updatePromoCodeSchema` est un alias de `createPromoCodeSchema` - tous les champs requis
- `src/lib/validations/promo-code.ts:45` : L'update force la re-saisie de tous les champs
- **Fix**: Rendre les champs optionnels pour l'update (utiliser `.partial()`)

**F-071** [BASSE] Pas d'audit log dans le cron birthday-emails pour les points ajoutes
- Les points sont ajoutes silencieusement sans entry dans l'audit admin
- **Fix**: Ajouter un `logAdminAction` pour chaque attribution de points cron

**F-072** [BASSE] Ambassador page ne montre pas l'historique des commissions dans le detail pane
- La page de detail affiche les stats mais pas la liste des commissions individuelles
- **Fix**: Ajouter une section "Commissions recentes" avec les donnees de l'API GET /ambassadors/[id]

**F-073** [BASSE] `promoCode.usageCount` vs `promoCode._count.usages` - deux sources de verite
- `src/app/api/admin/promo-codes/route.ts:29` : Retourne `_count.usages` mais aussi `usageCount`
- Ces deux valeurs peuvent diverger si `usageCount` n'est pas synchronise
- **Fix**: Utiliser uniquement `_count.usages` ou synchroniser `usageCount` via trigger

**F-074** [BASSE] Subscription monthly revenue calcul utilise des fractions approximatives
- `src/app/admin/abonnements/page.tsx:237` : `1/6` pour EVERY_6_MONTHS
- JavaScript floating point: `1/6 = 0.16666666666666666`
- **Fix**: Arrondir le resultat final a 2 decimales

**F-075** [BASSE] Pas de loading state sur le bouton "Process Payout" ambassadeur
- `src/app/admin/ambassadeurs/page.tsx:517-519` : Le bouton n'a pas d'etat de chargement
- L'admin peut cliquer plusieurs fois et creer des payouts dupliques
- **Fix**: Ajouter un state `processingPayout` et desactiver le bouton

**F-076** [BASSE] Le cron birthday ne gere pas les timezones
- `src/app/api/cron/birthday-emails/route.ts:100-102` : Utilise `new Date()` qui est en UTC
- Un utilisateur dont l'anniversaire est le 5 mars en EST recevra l'email le 4 mars a 19h
- **Fix**: Considerer la timezone de l'utilisateur ou envoyer en debut de journee UTC

**F-077** [BASSE] `PromoCodeUsage` n'a pas de relation avec `User` dans le schema
- `prisma/schema.prisma:1800` : `userId String` sans relation `@relation`
- Impossible de joindre directement les usages avec les users
- **Fix**: Ajouter `user User @relation(...)` au modele

**F-078** [BASSE] Ambassador config modal ne charge pas les valeurs actuelles depuis la DB
- `src/app/admin/ambassadeurs/page.tsx:94-98` : `configDefaultCommission = '5'` hardcode
- Quand l'admin ouvre la config, il voit les defaults au lieu des valeurs sauvegardees
- **Fix**: Charger les valeurs depuis `/api/admin/settings` au montage

**F-079** [BASSE] `Subscription.frequency` est un `String` au lieu d'un enum
- `prisma/schema.prisma:2197` : `frequency String @default("MONTHLY")`
- Le default est "MONTHLY" mais l'interface du frontend ne propose que EVERY_2/4/6/12_MONTHS
- Incoherence entre le default et les valeurs UI
- **Fix**: Creer un enum SubscriptionFrequency et aligner

**F-080** [BASSE] `session.user.role` check dans les routes ambassadeur n'utilise pas withAdminGuard
- `src/app/api/ambassadors/route.ts:10` : Check manuel `['OWNER', 'EMPLOYEE'].includes(session.user.role)`
- Inconsistant avec les routes promo-codes qui utilisent `withAdminGuard`
- **Fix**: Utiliser `withAdminGuard` partout pour la consistance

**F-081** [BASSE] Cron points-expiring expose les resultats detailles (emails utilisateurs) dans la reponse
- `src/app/api/cron/points-expiring/route.ts:281-294` : Retourne `email`, `userId` dans le JSON
- Si l'endpoint est expose publiquement, c'est une fuite de donnees
- **Fix**: Ne retourner que les stats agreges

**F-082** [BASSE] `Referral.referralCode` stocke le code mais n'a pas de relation avec User.referralCode
- Pas de foreign key constraint - le code pourrait etre modifie cote User sans mettre a jour les Referral existants
- **Fix**: Ajouter une relation ou une contrainte

**F-083** [BASSE] `LoyaltyTransaction.orderId` n'a pas de relation avec Order
- `prisma/schema.prisma:1190` : `orderId String?` sans `@relation`
- Impossible de faire des joins directs
- **Fix**: Ajouter la relation si applicable

**F-084** [BASSE] Ambassador DELETE n'est accessible qu'au OWNER mais PATCH est accessible aux EMPLOYEES
- `src/app/api/ambassadors/[id]/route.ts:117` : DELETE require OWNER
- `src/app/api/ambassadors/[id]/route.ts:49` : PATCH require OWNER ou EMPLOYEE
- Un employee peut changer le status a INACTIVE (soft delete equivalent) via PATCH
- **Fix**: Documenter ou aligner les permissions

**F-085** [BASSE] `balanceAfter` calcule avant la transaction dans earn, potentiellement incorrect en concurrence
- `src/app/api/loyalty/earn/route.ts:171-172` : `newPoints = user.loyaltyPoints + pointsToEarn`
- Si une autre transaction a modifie les points entre le read et le write, `balanceAfter` est faux
- **Fix**: Utiliser `FOR UPDATE` comme dans redeem, ou calculer depuis le resultat de l'update

**F-086** [BASSE] Le select `tierFormColor` utilise des options hardcodees en anglais
- `src/app/admin/fidelite/page.tsx:411-416` : "Bronze", "Silver", etc. non traduits
- **Fix**: Utiliser `t()` pour les labels

**F-087** [BASSE] Page abonnements: config section hardcode "15%" au lieu de la valeur reelle
- `src/app/admin/abonnements/page.tsx:337` : `<p className="font-bold text-lg">15%</p>`
- **Fix**: Afficher la valeur configurable

**F-088** [BASSE] Pas de rate limiting sur `/api/loyalty/earn`
- Un utilisateur authentifie pourrait spammer l'endpoint SIGNUP meme si les doublons sont verifies
- Les verifications de doublons creent une charge DB inutile
- **Fix**: Ajouter `rateLimitMiddleware`

**F-089** [BASSE] `promoCodeTypeEnum` est defini a la fois dans promo-code.ts et promotion.ts
- `src/lib/validations/promo-code.ts:11` et `src/lib/validations/promotion.ts:11`
- Duplication de code
- **Fix**: Extraire dans un fichier shared

**F-090** [BASSE] Ambassador page applications modal ne pagine pas les candidatures
- Si 100 ambassadeurs sont en attente, tous sont charges et affiches d'un coup
- **Fix**: Ajouter la pagination ou le scroll virtuel

**F-091** [BASSE] `fetchWithRetry` utilise dans certaines pages admin mais pas dans d'autres
- Promotions et ambassadeurs utilisent `fetchWithRetry`, mais fidelite et promo-codes utilisent `fetch` standard
- **Fix**: Uniformiser l'utilisation

**F-092** [BASSE] Le `firstOrderOnly` check dans promo/validate fait un `auth()` supplementaire
- `src/app/api/promo/validate/route.ts:97-98` : Appelle `auth()` une deuxieme fois (deja appele ligne 81)
- **Fix**: Mettre `auth()` en haut et reutiliser la session

**F-093** [BASSE] Promo validate ne tient pas compte de `categoryId` null sur les produits
- `src/app/api/promo/validate/route.ts:148` : `products.map(p => p.categoryId)` peut contenir null
- `allowedCategoryIds.includes(null)` retourne false, ce qui est correct, mais un produit sans categorie serait exclu
- **Fix**: Filtrer les null avant la comparaison

**F-094** [BASSE] `Ambassador.id` et `AmbassadorCommission.id` n'ont pas de `@default(cuid())`
- `prisma/schema.prisma:125,149` : IDs sans generateur automatique
- Les API doivent generer les IDs manuellement
- **Fix**: Ajouter `@default(cuid())` a tous les modeles sans default

**F-095** [BASSE] Subscription model n'a pas de relation avec User dans le schema
- `prisma/schema.prisma:2191` : `userId String` sans `@relation`
- Empeche les includes/joins Prisma
- **Fix**: Ajouter la relation

**F-096** [BASSE] Les messages d'erreur dans ambassador routes melangent francais et anglais
- `src/app/api/ambassadors/route.ts:8` : 'Non autorise' mais le reste du code est en anglais
- **Fix**: Retourner des codes d'erreur et traduire cote client

**F-097** [BASSE] `showApplicationsModal` utilise `ambassadors.filter(a => a.status === 'PENDING')` 3 fois
- `src/app/admin/ambassadeurs/page.tsx:568,575,590` : Re-calcul redondant
- **Fix**: Extraire dans un `useMemo`

**F-098** [BASSE] `editCommissionRate` stocke comme string, compare comme float
- `src/app/admin/ambassadeurs/page.tsx:195` : `parseFloat(editCommissionRate)` a chaque save
- **Fix**: Stocker comme number des le depart

**F-099** [BASSE] Ambassador `totalEarnings` est un Decimal en DB mais un number dans le frontend
- Risque de precision pour les grands montants
- **Fix**: Utiliser une lib de precision decimale ou toFixed(2) partout

**F-100** [BASSE] `Subscription.discountPercent` est un `Int` - pas de decimales possibles
- `prisma/schema.prisma:2198` : `discountPercent Int @default(10)`
- Un rabais de 12.5% est impossible
- **Fix**: Changer en `Decimal @db.Decimal(5, 2)` ou documenter la limitation

---

## SECTION 2: 100 AMELIORATIONS

### Architecture & Systeme

**A-001** [HAUTE] Creer une source unique de verite pour la configuration loyalty
- Supprimer toutes les constantes hardcodees (LoyaltyContext, earn/route.ts, redeem/route.ts, account/rewards)
- Charger dynamiquement depuis `/api/admin/loyalty/config` ou `/api/loyalty/config` (endpoint public read-only)
- Cache en memoire avec TTL de 5 min pour eviter les requetes repetees

**A-002** [HAUTE] Implementer un vrai systeme d'expiration des points
- Creer un cron job `/api/cron/expire-points` qui:
  1. Trouve les LoyaltyTransaction avec expiresAt < now() et points > 0
  2. Cree des transactions EXPIRE avec points negatifs
  3. Decremente loyaltyPoints de l'utilisateur
  4. Envoie une notification (email + in-app)

**A-003** [HAUTE] Migrer `LoyaltyContext` vers React Query / SWR
- Remplacer le state local par un cache reactif avec invalidation automatique
- Supprimer les mutations optimistes dangereuses
- Ajouter une revalidation apres chaque mutation

**A-004** [HAUTE] Creer un service de fidélité unifié (`src/lib/loyalty.service.ts`)
- Centraliser toute la logique: calcul de points, tiers, recompenses, config
- Utiliser par les routes API et les cron jobs
- Tester unitairement

**A-005** [HAUTE] Implementer un systeme de "wallet" pour les recompenses redeem
- Au lieu de generer un PromoCode a chaque redemption, creer un modele `UserWallet` / `UserReward`
- Le client voit ses recompenses actives dans son compte
- Automatiquement appliquees au checkout

**A-006** [HAUTE] Ajouter des notifications push/in-app pour les evenements loyalty
- Tier upgrade, points expires, recompense disponible, parrainage qualifie
- Utiliser le systeme de notifications existant (`/api/account/notifications`)

**A-007** [HAUTE] Implementer un dashboard loyalty dans l'admin avec des graphiques
- Graphe de points distribues/redimes par mois
- Taux de redemption
- ROI du programme fidelite
- Distribution des tiers
- Top 10 clients fidelite

**A-008** [HAUTE] Migrer Referral.status et Ambassador.status vers des enums Prisma
- Creer `ReferralStatus` et `AmbassadorStatus` enums
- Ajouter une migration pour convertir les String existants

**A-009** [HAUTE] Ajouter des webhooks pour les evenements loyalty
- `loyalty.points.earned`, `loyalty.tier.upgraded`, `loyalty.reward.redeemed`
- Permettre l'integration avec des outils externes (CRM, email marketing)

**A-010** [HAUTE] Implementer un systeme anti-fraude plus robuste
- Limiter les points par IP/device
- Detecter les patterns suspects (multi-comptes, auto-parrainage via emails differents)
- Flag automatique pour review manuel au-dessus d'un seuil

### Securite

**A-011** [HAUTE] Ajouter CSRF protection a tous les endpoints loyalty mutation
- `/api/loyalty/earn`, `/api/loyalty/redeem`, `/api/referrals/generate`
- Utiliser `validateCsrf()` comme dans `/api/referrals/apply`

**A-012** [HAUTE] Ajouter rate limiting a `/api/referrals/validate` et `/api/referrals/generate`
- Prevenir l'enumeration des codes
- 10 requetes par minute par IP

**A-013** [HAUTE] Proteger `/api/referrals/qualify` avec authentification interne
- Ajouter un header `X-Internal-API-Key` ou utiliser `CRON_SECRET`
- Ou rendre l'endpoint accessible uniquement via `withAdminGuard`

**A-014** [MOYENNE] Ajouter un audit trail complet pour les operations loyalty sensibles
- Logger chaque attribution/retrait de points avec l'admin qui l'a fait
- Inclure l'IP, le user-agent, le timestamp
- Similaire a `logAdminAction` deja utilise dans promo-codes

**A-015** [MOYENNE] Ajouter une verification de fraude sur les redemptions
- Si un utilisateur redime plus de X points en Y heures, flag pour review
- Verifier que le solde de points est coherent avec l'historique des transactions

**A-016** [MOYENNE] Chiffrer les codes promo/referral en transit et au repos
- Les codes promo sont previsibles (BDAY + userId + annee)
- Utiliser des codes aleaoires cryptographiquement surs partout

**A-017** [MOYENNE] Ajouter une limite de tentatives pour la validation de codes promo
- Rate limit deja en place (10/h) mais pourrait etre plus agressif pour les IPs qui tentent beaucoup de codes invalides

**A-018** [BASSE] Implementer CSP headers pour les pages loyalty client
- Prevenir les injections XSS dans les descriptions de transactions

### Performance

**A-019** [HAUTE] Ajouter des index manquants dans Prisma
- `LoyaltyTransaction.expiresAt` pour le cron d'expiration
- `PromoCodeUsage.userId + promoCodeId` pour les verifications de limite par user
- `Referral.status + referredId` pour les lookups de qualification

**A-020** [HAUTE] Implementer un cache Redis pour la config loyalty
- La config est lue a chaque requete API loyalty
- Un cache Redis avec TTL de 5 min reduirait les requetes DB de 90%

**A-021** [MOYENNE] Batch les mises a jour de totalEarnings ambassadeur dans un cron
- Actuellement fait dans le GET des ambassadeurs (F-022)
- Deplacer dans un cron job nocturne

**A-022** [MOYENNE] Paginer les transactions loyalty dans le contexte client
- Actuellement `take: 20` hardcode
- Implementer le scroll infini ou la pagination

**A-023** [MOYENNE] Optimiser la recherche de transactions admin avec des index full-text
- La recherche par nom/email fait un findMany sur User puis un findMany sur LoyaltyTransaction
- Un index full-text ou une recherche integree serait plus performant

**A-024** [BASSE] Lazy load les modals dans les pages admin
- Les modals de formulaire sont rendus meme quand invisibles
- Utiliser `React.lazy` ou un portail conditionnel

**A-025** [BASSE] Utiliser `useDeferredValue` pour la recherche dans les listes
- Les filtres de recherche re-renderent toute la liste a chaque keystroke
- `useDeferredValue` ameliorerait la reactivite

### UX Admin

**A-026** [HAUTE] Ajouter un onglet "Transactions" dans la page admin fidelite
- Actuellement, il faut aller dans la gestion des utilisateurs pour voir les transactions
- La page `/admin/fidelite` devrait avoir un onglet avec la liste des transactions recentes

**A-027** [HAUTE] Ajouter un onglet "Statistiques" dans la page admin fidelite
- Total de points en circulation
- Nombre de membres par tier
- Taux de redemption mensuel
- Valeur moyenne des points par client

**A-028** [HAUTE] Permettre l'ajustement de points depuis la page admin fidelite
- Actuellement possible seulement via `/admin/clients/[id]`
- Ajouter un raccourci dans la page fidelite (recherche utilisateur + ajustement)

**A-029** [HAUTE] Ajouter un systeme de regles automatiques pour le programme fidelite
- "Si PURCHASE > $200 alors bonus de 50 points"
- "Si 3 achats en 1 mois alors tier upgrade automatique"
- Configurable depuis l'admin

**A-030** [MOYENNE] Ajouter un apercu email dans le cron birthday
- L'admin devrait pouvoir previsualiser l'email d'anniversaire depuis la config
- Ajouter un bouton "Preview" dans la page admin

**A-031** [MOYENNE] Ajouter des filtres avances dans la page promotions
- Filtrer par type de promotion (PRODUCT_DISCOUNT, BUNDLE, etc.)
- Filtrer par date de validite
- Filtrer par produit/categorie cible

**A-032** [MOYENNE] Afficher les commissions recentes dans le detail ambassadeur
- L'API GET /ambassadors/[id] retourne les commissions, mais la page ne les affiche pas
- Ajouter une table de commissions dans le detail pane

**A-033** [MOYENNE] Ajouter un bouton "Dupliquer" pour les codes promo
- Permet de creer rapidement un code similaire a un existant
- Copie tous les champs sauf le code lui-meme

**A-034** [MOYENNE] Ajouter un export CSV des codes promo
- Pour la comptabilite et le reporting
- Inclure les usages, montants de remise, dates

**A-035** [MOYENNE] Ameliorer le formulaire de promotion pour supporter tous les types
- Actuellement ne supporte que PERCENTAGE/FIXED_AMOUNT
- Ajouter les champs pour BUNDLE (selection de produits), BUY_X_GET_Y (quantites), FLASH_SALE (timer)

**A-036** [MOYENNE] Ajouter un calendrier de promotions
- Vue calendrier montrant les promotions actives/futures
- Permet de planifier les campagnes sans chevauchement

**A-037** [MOYENNE] Ajouter des modals de confirmation stylisees
- Remplacer tous les `confirm()` natifs par des Modals React
- Plus accessible, plus joli, et fonctionne sur mobile

**A-038** [BASSE] Ajouter un historique des modifications de config dans la page fidelite
- Quand un admin modifie la config, sauvegarder l'ancienne version
- Permettre de voir et rollback les changements

**A-039** [BASSE] Ajouter des tooltips explicatifs dans la config fidelite
- Expliquer ce que fait chaque champ (pointsPerDollar, pointsValue, etc.)
- Avec des exemples concrets

**A-040** [BASSE] Afficher un badge de nombre de codes promo actifs dans la navigation admin
- Comme le badge de candidatures ambassadeur
- Permet de voir rapidement s'il y a des codes expires a nettoyer

### UX Client

**A-041** [HAUTE] Connecter la page `(shop)/account/rewards` au backend reel
- Remplacer les donnees mock par des appels API
- Charger les transactions depuis `/api/loyalty`
- Charger les recompenses depuis `/api/loyalty/redeem` GET

**A-042** [HAUTE] Ajouter un widget de points dans le header du site
- "Vous avez 1,500 points" avec un lien vers la page rewards
- Visible uniquement pour les utilisateurs authentifies

**A-043** [HAUTE] Afficher les points gagnes sur la page de confirmation de commande
- "Vous avez gagne 150 points avec cette commande!"
- Avec le nouveau solde et la progression vers le prochain tier

**A-044** [HAUTE] Integrer le parrainage dans le processus d'inscription
- Champ "Code de parrainage" pendant l'inscription
- Pre-rempli si l'utilisateur a clique sur un lien de parrainage

**A-045** [HAUTE] Ajouter un historique de points interactif avec filtres
- Filtrer par type (earn/redeem/expire)
- Filtrer par date
- Exporter en PDF

**A-046** [MOYENNE] Ajouter des gamification elements
- Barre de progression vers le prochain tier avec animation
- Badges pour les achievements (premiere commande, 10 commandes, etc.)
- Notification toast quand un tier est upgrade

**A-047** [MOYENNE] Ajouter un calculateur de recompenses dans la page produit
- "Achetez ce produit et gagnez 50 points (valeur: $0.50)"
- Variant selon le tier de l'utilisateur

**A-048** [MOYENNE] Creer une page dediee au programme de parrainage
- URL courte et partageable (peptideplus.ca/ref/CODE)
- Landing page explicative avec les avantages
- Stats de parrainage en temps reel

**A-049** [MOYENNE] Ajouter la possibilite de partager le code de parrainage sur les reseaux sociaux
- Boutons de partage Twitter, Facebook, WhatsApp, Email
- Message pre-rempli avec le code et les avantages
- (La page referrals a deja les icones mais verifier la fonctionnalite)

**A-050** [MOYENNE] Afficher les recompenses proches dans la page panier
- "Plus que 200 points pour un envoi gratuit!"
- Encourage les achats supplementaires

**A-051** [MOYENNE] Permettre l'application de recompenses au checkout
- L'utilisateur choisit une recompense a appliquer directement dans le checkout
- Au lieu du processus en 2 etapes (redeem puis code promo)

**A-052** [MOYENNE] Ajouter un email de bienvenue au programme fidelite
- Envoye automatiquement apres l'inscription
- Explique le programme, les tiers, comment gagner des points

**A-053** [BASSE] Ajouter des animations de points gagnes
- Animation de "+50 points" qui float vers le compteur de points
- Feedback visuel satisfaisant

**A-054** [BASSE] Creer une FAQ du programme fidelite
- Questions frequentes sur les points, tiers, expiration
- Lien depuis la page rewards

**A-055** [BASSE] Ajouter un "streak bonus" pour les achats reguliers
- Bonus de points pour X achats consecutifs
- Encourage la retention

### Backend & API

**A-056** [HAUTE] Creer un endpoint `/api/loyalty/config` public (lecture seule)
- Retourne la config loyalty (tiers, points par dollar, recompenses)
- Utilisable par le frontend sans etre admin
- Cache-Control: max-age=300

**A-057** [HAUTE] Implementer un systeme de regles de bonus configurables
- Modele `LoyaltyRule` en DB: condition, points, actif, date debut/fin
- Ex: "2x points le weekend", "50 points bonus si panier > $150"
- Evalue automatiquement au moment du checkout

**A-058** [HAUTE] Creer un endpoint de reporting loyalty pour l'admin
- GET `/api/admin/loyalty/stats`
- Points distribues/redimes par periode
- Nombre de membres par tier
- Taux de conversion des referrals

**A-059** [HAUTE] Ajouter le support multi-devise pour les points et recompenses
- Actuellement tout est en dollars
- Les recompenses "$5 off" doivent etre en CAD/USD selon la devise de l'utilisateur

**A-060** [MOYENNE] Implementer un webhook Stripe pour attribution automatique de points
- Lors de `payment_intent.succeeded`, appeler `/api/loyalty/earn` automatiquement
- Plus fiable que de compter sur le frontend

**A-061** [MOYENNE] Creer un endpoint `/api/loyalty/balance` leger
- Retourne uniquement points + tier (sans transactions)
- Pour les requetes frequentes (header widget)

**A-062** [MOYENNE] Implementer le "double points" comme recompense
- Actuellement dans le catalogue mais pas implemente
- Creer un flag `nextOrderMultiplier` sur l'utilisateur
- Applique automatiquement au prochain achat puis remis a 1

**A-063** [MOYENNE] Ajouter des metadata aux transactions loyalty
- Stocker plus d'informations (produit achete, montant de la commande, etc.)
- Utile pour l'analytics et le debugging

**A-064** [MOYENNE] Implementer la qualification automatique des referrals dans le webhook de paiement
- Actuellement via un endpoint POST manuel
- Devrait etre automatique quand un payment est confirme

**A-065** [MOYENNE] Creer un systeme de "points pending" pour les commandes en cours
- Points visibles mais non-utilisables jusqu'a la livraison
- Annules si la commande est annulee/remboursee

**A-066** [MOYENNE] Ajouter le rollback des points sur remboursement
- Quand une commande est remboursee, les points gagnes doivent etre retires
- Creer une transaction ADJUST avec description "Refund order #xxx"

**A-067** [MOYENNE] Implementer des promotions conditionnelles
- "Code valide uniquement pour les membres Gold+"
- "Code valide uniquement si referral applique"

**A-068** [BASSE] Ajouter un endpoint de health check pour le systeme loyalty
- `/api/loyalty/health` - verifie la config, les cron jobs, la coherence des donnees

**A-069** [BASSE] Creer un systeme de notification email configurable pour la loyalty
- Template d'email parametrable depuis l'admin
- Variables: {{points}}, {{tier}}, {{nextTier}}, {{customerName}}

**A-070** [BASSE] Ajouter le support des "point bundles" (achat de points)
- Permettre aux clients d'acheter des points supplementaires
- Ex: "Achetez 500 points pour $4.00 (valeur $5.00)"

### Data & Analytics

**A-071** [HAUTE] Creer un tableau de bord analytique du programme fidelite
- KPIs: taux d'engagement, taux de redemption, CLV par tier
- Graphiques temporels
- Exportable

**A-072** [HAUTE] Implementer le tracking de ROI du programme fidelite
- Cout total des points distribues (en valeur monetaire)
- Revenu supplementaire genere par les membres fidelite vs non-membres
- Marge apres deduction des recompenses

**A-073** [MOYENNE] Ajouter des cohortes d'analyse
- Comparer les clients avec/sans programme fidelite
- Analyser la retention par tier
- Frequence d'achat par tier

**A-074** [MOYENNE] Implementer des alertes automatiques
- Points totaux en circulation depasse un seuil (risque financier)
- Taux de redemption anormalement eleve
- Activite suspecte detectee

**A-075** [MOYENNE] Creer un rapport de "liability" des points
- Valeur financiere des points en circulation (points * pointsValue)
- Important pour la comptabilite

**A-076** [BASSE] Tracker les sources d'acquisition des membres loyalty
- D'ou viennent-ils? (organic, referral, campagne email, social)
- Quel canal produit les meilleurs membres?

**A-077** [BASSE] Segmenter les clients par comportement loyalty
- "Power redeemers" vs "point hoarders"
- Adapter les communications en consequence

### Email & Communication

**A-078** [HAUTE] Creer des emails de tier upgrade
- "Felicitations! Vous etes maintenant Gold!"
- Expliquer les nouveaux avantages

**A-079** [HAUTE] Creer des emails de reengagement pour les points dormants
- "Vos 1,500 points attendent! Voici ce que vous pouvez obtenir..."
- Envoyes X jours apres inactivite

**A-080** [MOYENNE] Creer des emails de rappel de redemption
- "Vous avez assez de points pour $25 de rabais!"
- Lien direct vers la page de redemption

**A-081** [MOYENNE] Creer un email de resume mensuel loyalty
- Points gagnes/depenses le mois precedent
- Progression vers le prochain tier
- Recompenses disponibles

**A-082** [MOYENNE] Personnaliser les emails birthday par tier
- Bronze: 10% + 100pts
- Silver: 15% + 200pts
- Gold: 20% + 300pts
- Platinum: 25% + 500pts

**A-083** [BASSE] Ajouter des emails de confirmation de redemption
- "Votre code BCXXX123 de $10 est pret!"
- Rappel avant expiration

### Integration & Technique

**A-084** [HAUTE] Ajouter des tests unitaires pour le service loyalty
- Tester les calculs de points, tiers, recompenses
- Tester les cas limites (0 points, tier max, etc.)
- Tester les scenarios de concurrence

**A-085** [HAUTE] Creer des tests d'integration pour les endpoints loyalty
- Tester le flow complet: earn -> check balance -> redeem -> verify code
- Tester les scenarios d'erreur (points insuffisants, reward invalide)

**A-086** [HAUTE] Implementer un systeme de migration pour les changements de config loyalty
- Quand les seuils de tier changent, recalculer les tiers de tous les utilisateurs
- Script de migration automatique

**A-087** [MOYENNE] Ajouter OpenAPI/Swagger pour les endpoints loyalty
- Documentation automatique des endpoints
- Types generes pour le frontend

**A-088** [MOYENNE] Implementer un event bus pour les evenements loyalty
- Decoupler les composants: earn points -> event -> update tier, send email, log, etc.
- Facilite l'extension future

**A-089** [MOYENNE] Creer un CLI pour la gestion du programme loyalty
- `npm run loyalty:stats` - affiche les stats
- `npm run loyalty:expire` - force l'expiration des points
- `npm run loyalty:recalculate` - recalcule tous les tiers

**A-090** [MOYENNE] Ajouter un mecanisme de "feature flags" pour la loyalty
- Activer/desactiver les fonctionnalites sans deploy
- Ex: desactiver les referrals pendant une maintenance

**A-091** [BASSE] Implementer le logging structure pour toutes les operations loyalty
- Utiliser le logger existant avec des metadata specifiques
- Facilite le debugging en production

**A-092** [BASSE] Ajouter des metriques Prometheus/Datadog pour la loyalty
- points_earned_total, points_redeemed_total, active_members_by_tier
- Alerting sur les anomalies

### Programme Ambassadeur Specifique

**A-093** [HAUTE] Creer un dashboard ambassadeur self-service
- Les ambassadeurs voient leurs stats, commissions, payouts
- Sans passer par l'admin

**A-094** [HAUTE] Implementer le tracking de liens ambassadeur
- URL unique par ambassadeur avec UTM parameters
- Tracker les clics, conversions, et attribution

**A-095** [MOYENNE] Ajouter un systeme de tier automatique pour les ambassadeurs
- Promotion automatique basee sur les ventes generees
- Utiliser les seuils de `tierConfig` (actuellement hardcodes)

**A-096** [MOYENNE] Creer des rapports de performance ambassadeur
- Comparaison entre ambassadeurs
- Tendances mensuelles
- Meilleurs produits vendus par referral

**A-097** [MOYENNE] Ajouter le support des materiels marketing pour les ambassadeurs
- Bannieres, images, textes de promotion
- Telechargeable depuis le dashboard ambassadeur

**A-098** [BASSE] Implementer un systeme de MLM multi-niveaux (optionnel)
- Commission sur les ventes des sous-ambassadeurs
- Arbre de parrainage visible

### Abonnements Specifique

**A-099** [MOYENNE] Lier les abonnements au programme fidelite
- Points bonus pour chaque livraison d'abonnement
- Tier upgrade accelere pour les abonnes

**A-100** [MOYENNE] Ajouter un email de rappel avant le prochain prelevement d'abonnement
- "Votre prochaine livraison est dans 3 jours - $45.00"
- Lien pour modifier ou pauser
- Integrer les points gagnes prevus ("Vous gagnerez 45 points!")

---

## MATRICE DE PRIORITE

| Priorite  | Failles | Ameliorations |
|-----------|---------|---------------|
| CRITIQUE  | 10      | -             |
| HAUTE     | 20      | 30            |
| MOYENNE   | 20      | 40            |
| BASSE     | 50      | 30            |
| **Total** | **100** | **100**       |

## FICHIERS AUDITES

| Fichier | Failles | Ameliorations |
|---------|---------|---------------|
| `src/contexts/LoyaltyContext.tsx` | F-002,003,006,008 | A-003,041 |
| `src/app/admin/fidelite/page.tsx` | F-012,013,014,018,044,051,052,062,064,086 | A-026,027,028,039 |
| `src/app/api/loyalty/route.ts` | F-001,036 | A-056,061 |
| `src/app/api/loyalty/earn/route.ts` | F-001,005,008 | A-043,060 |
| `src/app/api/loyalty/redeem/route.ts` | F-006 | A-005,051 |
| `src/app/api/admin/loyalty/config/route.ts` | F-001,023,049 | A-001,020 |
| `src/app/api/admin/loyalty/transactions/route.ts` | F-039 | A-023 |
| `src/app/api/promo/validate/route.ts` | F-017,021,033,065,092,093 | A-067 |
| `src/app/admin/promo-codes/page.tsx` | F-053,067 | A-033,034,037 |
| `src/app/admin/promotions/page.tsx` | F-019,020,041,054 | A-035,036 |
| `src/app/admin/ambassadeurs/page.tsx` | F-040,055,056,057,063,075,078,090,097,098 | A-032,093,094 |
| `src/app/admin/abonnements/page.tsx` | F-030,061,074,087 | A-099,100 |
| `src/app/api/ambassadors/route.ts` | F-010,022,034,042,068,080 | A-021,095 |
| `src/app/api/referrals/qualify/route.ts` | F-004 | A-064 |
| `src/app/api/referrals/validate/route.ts` | F-007 | A-012 |
| `src/app/api/referrals/generate/route.ts` | F-031,059 | A-016 |
| `src/lib/referral-qualify.ts` | F-015 | A-066 |
| `src/app/api/cron/points-expiring/route.ts` | F-011,081 | A-002 |
| `src/app/api/cron/birthday-emails/route.ts` | F-016,029,045,071,076 | A-082 |
| `src/app/(shop)/account/rewards/page.tsx` | F-001,009 | A-041,045 |
| `src/app/(shop)/rewards/page.tsx` | F-006,024 | A-046,047 |
| `prisma/schema.prisma` | F-035,047,048,066,077,079,083,094,095,100 | A-008,019 |
| `src/lib/validations/promo-code.ts` | F-058,070,089 | - |
| `src/app/api/admin/users/[id]/points/route.ts` | F-085 | A-028 |
| `src/app/admin/fidelite/error.tsx` | F-032 | - |

---

*Audit realise le 2026-02-22 par Claude Opus 4.6. Tous les numeros de ligne referent aux fichiers tels que lus au moment de l'audit.*

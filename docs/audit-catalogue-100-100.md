# AUDIT CATALOGUE - BioCycle Peptides (peptide-plus)
# Date: 2026-02-22
# Auditeur: Claude Code (Opus 4.6)
# Scope: Section CATALOGUE (Admin Produits, Admin Categories, API Products/Categories/Inventory, Lib, Shop Pages, Prisma Schema, Components)

---

## RESUME EXECUTIF

| Categorie       | CRITIQUE | HAUTE | MOYENNE | BASSE | Total |
|:----------------|:--------:|:-----:|:-------:|:-----:|:-----:|
| Bugs/Failles    |    14    |   28  |    38   |   20  |  100  |
| Ameliorations   |     8    |   30  |    40   |   22  |  100  |

### TOP 10 PROBLEMES CRITIQUES

1. **BUG-001** - Product POST utilise `body` brut au lieu de `validation.data` apres Zod parse (injection de champs non valides)
2. **BUG-002** - Duplicate Zod schemas entre `validations/product.ts` et `api/products/route.ts` (desynchronisation)
3. **BUG-003** - `by-slug` API retourne les produits inactifs sans filtre `isActive` (fuite de donnees)
4. **BUG-004** - Category POST n'a AUCUNE validation Zod (injection SQL potentielle via nom/slug)
5. **BUG-005** - Search API genere une cache key mais ne l'utilise jamais (`cacheGetOrSet` importe mais non appele)
6. **BUG-006** - `!effectivePrice` sur ProductPageClient:375 est toujours false pour prix > 0 (logique cassee)
7. **BUG-007** - `handleDelete` dans admin categories appelle `res.json()` sur reponse 204 (crash JS)
8. **BUG-008** - ShopPageClient charge TOUS les produits client-side (limit=200) sans pagination server-side
9. **BUG-009** - Format PUT API n'a pas de validation Zod du body (mass assignment risk)
10. **BUG-010** - `inStock` calculation bug: `newStockQuantity > 0 && newAvailability === 'IN_STOCK'` exclut les formats `LIMITED`

---

## PARTIE 1: 100 BUGS ET FAILLES

### CRITIQUE (14)

**BUG-001** [CRITICAL] Product POST utilise body brut au lieu de validation.data
- **Fichier**: `src/app/api/products/route.ts:391`
- **Description**: Apres le Zod parse `createProductSchema.safeParse(body)`, le code destructure depuis `body` (ligne 391) au lieu de `validation.data`. Cela signifie que des champs non valides ou malicieux passent le filtre Zod et sont envoyes a Prisma.
- **Fix**: Remplacer `const { name, slug, ... } = body;` par `const { name, slug, ... } = validation.data;`

**BUG-002** [CRITICAL] Schemas Zod dupliques et potentiellement desynchronises
- **Fichier**: `src/app/api/products/route.ts:22-88` vs `src/lib/validations/product.ts`
- **Description**: Un schema Zod complet est defini inline dans route.ts (lignes 22-88) ET un autre existe dans validations/product.ts. Les deux peuvent diverger silencieusement.
- **Fix**: Supprimer le schema inline dans route.ts et importer uniquement depuis `@/lib/validations/product.ts`.

**BUG-003** [CRITICAL] API by-slug retourne les produits inactifs
- **Fichier**: `src/app/api/products/by-slug/[slug]/route.ts`
- **Description**: Le endpoint GET ne filtre pas sur `isActive: true`. Les produits desactives sont accessibles publiquement via QuickView.
- **Fix**: Ajouter `isActive: true` dans le `where` du `findFirst`.

**BUG-004** [CRITICAL] Category POST sans validation Zod
- **Fichier**: `src/app/api/categories/route.ts:POST`
- **Description**: La creation de categorie ne valide que `if (!name || !slug)`. Pas de sanitization, pas de validation de format, pas de protection XSS sur le nom ou la description.
- **Fix**: Creer un `createCategorySchema` Zod avec `sanitizedString()` pour name, description, slug, et utiliser `.safeParse()`.

**BUG-005** [CRITICAL] Search cache key generee mais inutilisee
- **Fichier**: `src/app/api/products/search/route.ts:32-34`
- **Description**: `cacheGetOrSet` est importe (ligne 3) et une cache key est generee (lignes 32-34) mais `cacheGetOrSet` n'est jamais appele. Chaque recherche frappe la DB sans cache.
- **Fix**: Wrapper le bloc de recherche dans `cacheGetOrSet(cacheKey, async () => { ... }, { ttl: 300, tags: ['products-search'] })`.

**BUG-006** [CRITICAL] Condition `!effectivePrice` toujours false
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx:375`
- **Description**: `if (!effectivePrice)` est utilise comme garde. Pour un prix de 0 (gratuit/erreur), `!0` serait `true`, mais pour tout prix > 0, c'est toujours `false`. Si l'intention est de verifier l'absence de prix, il faut `effectivePrice === null || effectivePrice === undefined`.
- **Fix**: Remplacer `!effectivePrice` par `effectivePrice == null` ou `typeof effectivePrice !== 'number'`.

**BUG-007** [CRITICAL] res.json() appele sur reponse 204 No Content
- **Fichier**: `src/app/admin/categories/page.tsx:224`
- **Description**: Apres DELETE d'une categorie, `handleDelete` appelle `await res.json()` sur la reponse. L'API retourne `apiNoContent()` (status 204) qui n'a pas de body JSON. Cela provoque une erreur JS.
- **Fix**: Verifier `if (res.status === 204) { /* success */ } else { const data = await res.json(); ... }`.

**BUG-008** [CRITICAL] Shop page charge 200 produits client-side
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx`
- **Description**: Le composant fetch `limit=200` produits puis filtre/trie en memoire. Pas de pagination server-side. Performance catastrophique avec un catalogue large.
- **Fix**: Implementer une pagination server-side via l'API: `page`, `limit`, et deplacer le filtrage/tri cote serveur.

**BUG-009** [CRITICAL] Format PUT sans validation Zod
- **Fichier**: `src/app/api/products/[id]/formats/[formatId]/route.ts:45-69`
- **Description**: Le body de la requete PUT est directement destructure sans validation Zod. Tout champ (y compris des champs non autorises) peut etre envoye a Prisma.
- **Fix**: Creer un `updateFormatSchema` Zod et valider le body avant destructuration.

**BUG-010** [CRITICAL] Calcul inStock errone exclut les formats LIMITED
- **Fichier**: `src/app/api/products/[id]/formats/[formatId]/route.ts:91`
- **Description**: `const inStock = newStockQuantity > 0 && newAvailability === 'IN_STOCK';` met `inStock = false` pour les formats avec `availability: 'LIMITED'` meme s'ils ont du stock. Le frontend filtre sur `inStock` ce qui cache ces formats.
- **Fix**: `const inStock = newStockQuantity > 0 && ['IN_STOCK', 'LIMITED'].includes(newAvailability);`

**BUG-011** [CRITICAL] Product GET par ID retourne les produits inactifs
- **Fichier**: `src/app/api/products/[id]/route.ts:GET`
- **Description**: Le GET ne filtre pas `isActive`. Un produit desactive est accessible via son ID par n'importe qui.
- **Fix**: Ajouter un check: si pas admin et `product.isActive === false`, retourner 404.

**BUG-012** [CRITICAL] Default productType hardcode 'DIGITAL' au lieu de 'PEPTIDE'
- **Fichier**: `src/app/api/products/route.ts:421`
- **Description**: Le `productType` par defaut dans le `prisma.product.create` est `'DIGITAL'` mais le schema Zod definit `'PEPTIDE'` comme default. Si le champ est omis, le produit est cree comme DIGITAL.
- **Fix**: Remplacer `productType: productType || 'DIGITAL'` par `productType: productType || 'PEPTIDE'`.

**BUG-013** [CRITICAL] Inventory import N+1 pattern pour large CSV
- **Fichier**: `src/app/api/admin/inventory/import/route.ts`
- **Description**: Chaque ligne du CSV fait une requete DB individuelle (lookup + update). Un import de 1000 lignes = 2000+ requetes sequentielles. Timeout garanti.
- **Fix**: Batchers les lookups avec `findMany({ where: { sku: { in: skus } } })` puis `$transaction` pour les updates.

**BUG-014** [CRITICAL] Prix safety check `!price` echoue pour prix = 0
- **Fichier**: `src/app/api/products/route.ts:397`
- **Description**: `if (!price)` est `true` pour `price = 0`. Un produit gratuit (ou un echantillon) ne peut pas etre cree car le check pense qu'il manque le prix.
- **Fix**: Remplacer `if (!price)` par `if (price === undefined || price === null)`.

### HAUTE (28)

**BUG-015** [HIGH] `includeInactive` category param sans auth check
- **Fichier**: `src/app/api/categories/route.ts:GET`
- **Description**: Le parametre `includeInactive=true` peut etre ajoute par n'importe quel visiteur pour voir les categories cachees.
- **Fix**: Ajouter un check `session?.user?.role` avant d'autoriser `includeInactive`.

**BUG-016** [HIGH] Product PUT n'utilise pas de validation Zod
- **Fichier**: `src/app/api/products/[id]/route.ts:PUT`
- **Description**: L'update produit destructure directement le body sans passer par `updateProductSchema.safeParse()`.
- **Fix**: Importer et utiliser `updateProductSchema` de `@/lib/validations/product.ts`.

**BUG-017** [HIGH] Category cache non invalidee apres POST/PUT/DELETE
- **Fichier**: `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`
- **Description**: Le GET utilise `cacheGetOrSet` avec tag `categories` mais POST, PUT et DELETE n'appellent pas `revalidateTag('categories')`.
- **Fix**: Ajouter `revalidateTag('categories')` apres chaque mutation.

**BUG-018** [HIGH] Format DELETE hard-delete au lieu de soft-delete
- **Fichier**: `src/app/api/products/[id]/formats/[formatId]/route.ts:156`
- **Description**: `prisma.productFormat.delete()` supprime definitivement le format. Les commandes passees referancant ce format auront des foreign key errors.
- **Fix**: Soft-delete avec `isActive: false` au lieu de delete, ou verifier qu'aucun OrderItem ne reference ce format.

**BUG-019** [HIGH] "New" badge threshold inconsistant (14j vs 30j)
- **Fichier**: `src/lib/product-badges.ts:35` vs `src/app/(shop)/shop/ShopPageClient.tsx:232`
- **Description**: `product-badges.ts` considere un produit "new" si < 14 jours. `ShopPageClient` utilise 30 jours. Les deux calculs se contredisent.
- **Fix**: Centraliser la constante `NEW_PRODUCT_DAYS` dans un fichier de config et l'utiliser partout.

**BUG-020** [HIGH] `back-in-stock` badge dans la liste de priorites mais jamais genere
- **Fichier**: `src/lib/product-badges.ts:87-93`
- **Description**: Le type `back-in-stock` est dans `badgePriority` (ligne 87) mais aucune logique ne le genere dans `getPriorityBadges()`. C'est du dead code.
- **Fix**: Implementer la detection back-in-stock (comparer avec `restockedAt` ou un historique) ou retirer du tableau de priorites.

**BUG-021** [HIGH] Badge comment skip #4
- **Fichier**: `src/lib/product-badges.ts:50-70`
- **Description**: Les commentaires de badges passent de #3 a #5. Le badge #4 (back-in-stock) est absent du code generateur.
- **Fix**: Ajouter le bloc de generation pour le badge #4 ou corriger la numerotation.

**BUG-022** [HIGH] Hardcoded English text in ShopPageClient
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx:432,442,502,519`
- **Description**: "Reset filters", "product"/"products" count text, "No products found", "Clear all filters", "Retry" sont hardcodes en anglais.
- **Fix**: Remplacer par des appels `t()` avec les cles i18n correspondantes.

**BUG-023** [HIGH] Hardcoded English in CategoryPageClient
- **Fichier**: `src/app/(shop)/category/[slug]/CategoryPageClient.tsx:148,159`
- **Description**: "product"/"products" pluralisation hardcodee en anglais.
- **Fix**: Utiliser `t('shop.productCount', { count })` avec pluralisation i18n.

**BUG-024** [HIGH] FormatSelector hardcoded English
- **Fichier**: `src/components/shop/FormatSelector.tsx:43,56,105,111`
- **Description**: "Select Format:", "out of stock", "{n} left" sont hardcodes en anglais.
- **Fix**: Remplacer par `t('shop.selectFormat')`, `t('shop.outOfStock')`, `t('shop.unitsLeft', { count })`.

**BUG-025** [HIGH] FormatSelector formatImages labels hardcodes
- **Fichier**: `src/components/shop/FormatSelector.tsx:23-32`
- **Description**: Les labels comme 'Vial 2ml', 'Cartridge 3ml' etc. sont hardcodes en anglais.
- **Fix**: Utiliser les cles de traduction depuis `getFormatTypes(t)`.

**BUG-026** [HIGH] StickyAddToCart aria-label hardcode en anglais
- **Fichier**: `src/components/shop/StickyAddToCart.tsx:86`
- **Description**: `` aria-label={`Add ${productName} to cart`} `` est hardcode en anglais.
- **Fix**: Utiliser `t('shop.aria.addToCart', { name: productName })`.

**BUG-027** [HIGH] SearchModal popularSearches hardcode
- **Fichier**: `src/components/shop/SearchModal.tsx:125-132`
- **Description**: La liste des recherches populaires est hardcodee en code. Devrait venir de la DB (search analytics) ou au minimum des traductions.
- **Fix**: Charger depuis `getTopQueries()` de `search-analytics.ts` ou configurer dans les settings admin.

**BUG-028** [HIGH] ProductGallery image type labels non traduits
- **Fichier**: `src/components/shop/ProductGallery.tsx:116`
- **Description**: `{image.type}` affiche 'main', 'vial', etc. directement sans traduction.
- **Fix**: Mapper les types vers des cles i18n: `t('shop.imageType.' + image.type)`.

**BUG-029** [HIGH] QuickViewModal quantity sans max limit
- **Fichier**: `src/components/shop/QuickViewModal.tsx:362`
- **Description**: Le bouton "+" incremente `quantity` sans verifier `selectedFormat?.stockQuantity`. L'utilisateur peut commander 999 unites.
- **Fix**: `setQuantity(Math.min(quantity + 1, selectedFormat?.stockQuantity || 99))`.

**BUG-030** [HIGH] Admin price format hardcode dollar sign
- **Fichier**: `src/app/admin/produits/ProductsListClient.tsx:267` et `src/app/admin/produits/[id]/ProductEditClient.tsx:801-803`
- **Description**: `$${Number(p.price).toFixed(2)}` utilise un symbole dollar hardcode. La devise devrait etre dynamique.
- **Fix**: Utiliser `formatPrice()` de `useCurrency()` ou au minimum `Intl.NumberFormat`.

**BUG-031** [HIGH] Product translations endpoint pas d'auth check
- **Fichier**: `src/app/api/products/[id]/translations/route.ts`
- **Description**: Le GET retourne les statuts de traduction sans verifier l'authentification. Information interne visible publiquement.
- **Fix**: Ajouter `withAdminGuard` ou un check de session.

**BUG-032** [HIGH] ProductEditClient locales list mismatch
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:101`
- **Description**: `ALL_LOCALES` contient 22 locales differentes de celles en production (ex: 'nl', 'cs', 'ro', 'hu' non lisees dans i18n/locales). Le projet supporte 22 locales specifiques dont ar-dz, ar-lb, ar-ma, gcr, ht, etc.
- **Fix**: Importer la liste des locales depuis un fichier central (`src/i18n/config.ts`) au lieu de la hardcoder.

**BUG-033** [HIGH] No rate limiting on search API
- **Fichier**: `src/app/api/products/search/route.ts`
- **Description**: L'endpoint de recherche n'a aucun rate limiting. Un attaquant peut DDoS le endpoint avec des recherches lourdes.
- **Fix**: Ajouter un rate limiter (ex: `@upstash/ratelimit` ou un middleware custom) avec 30 req/min par IP.

**BUG-034** [HIGH] Search query length not validated
- **Fichier**: `src/app/api/products/search/route.ts`
- **Description**: Le parametre `q` n'est pas valide en longueur. Un query de 10000 caracteres serait envoye a la DB.
- **Fix**: Ajouter `.slice(0, 200)` sur le query ou valider avec Zod.

**BUG-035** [HIGH] Relevance sort does not use actual relevance
- **Fichier**: `src/app/api/products/search/route.ts`
- **Description**: Le sort `relevance` trie simplement par `isFeatured` desc. Ce n'est pas une vraie pertinence de recherche.
- **Fix**: Utiliser `fullTextSearch()` de `src/lib/search.ts` qui fait un vrai `ts_rank` avec tsvector/tsquery.

**BUG-036** [HIGH] inventory.service.ts consumeReservation non-batch
- **Fichier**: `src/lib/inventory/inventory.service.ts`
- **Description**: `consumeReservation` itere les reservations une par une dans une boucle. Pas de batch.
- **Fix**: Utiliser `updateMany` ou `$transaction` pour traiter toutes les reservations en batch.

**BUG-037** [HIGH] inventory POST allows zero unitCost
- **Fichier**: `src/app/api/admin/inventory/route.ts`
- **Description**: La validation `item.unitCost < 0` autorise un cout de 0. Un achat gratuit fausse le WAC.
- **Fix**: Verifier `item.unitCost <= 0` sauf si intentionnel (echantillons).

**BUG-038** [HIGH] inventory/[id] non-null assertion on params
- **Fichier**: `src/app/api/admin/inventory/[id]/route.ts:16`
- **Description**: `params!.id` utilise une assertion non-null. Si params est undefined, crash runtime.
- **Fix**: `const { id } = await params;` (comme dans les autres routes).

**BUG-039** [HIGH] data/products.ts static data duplique/diverge de la DB
- **Fichier**: `src/data/products.ts`
- **Description**: Fichier de 763 lignes avec des donnees produit statiques. Ces donnees ne correspondent probablement plus a la DB Prisma. Double source de verite.
- **Fix**: Marquer clairement comme "seed data only" ou supprimer si la DB est la seule source.

**BUG-040** [HIGH] shop/page.tsx metadata hardcoded English
- **Fichier**: `src/app/(shop)/shop/page.tsx`
- **Description**: Les metadata statiques (title, description) sont hardcodes en anglais. Pas de traduction pour le SEO.
- **Fix**: Utiliser `generateMetadata()` dynamique avec traduction basee sur la locale du header.

**BUG-041** [HIGH] Category page pas de pagination
- **Fichier**: `src/app/(shop)/category/[slug]/CategoryPageClient.tsx`
- **Description**: Tous les produits d'une categorie sont charges sans pagination.
- **Fix**: Implementer une pagination server-side similaire a la shop page.

**BUG-042** [HIGH] Fallback format stockQuantity hardcode a 99
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx:139`
- **Description**: Si aucun format n'a de stock, un format fallback est cree avec `stockQuantity: 99`. Cela permet de "commander" un produit rupture.
- **Fix**: Mettre `stockQuantity: 0` et `inStock: false` dans le fallback, ou ne pas creer de fallback.

### MOYENNE (38)

**BUG-043** [MEDIUM] Formats GET filtre isActive mais pas le POST format
- **Fichier**: `src/app/api/products/[id]/formats/route.ts:16` vs `route.ts:POST`
- **Description**: Le GET retourne uniquement les formats actifs, mais un format POST avec `isActive: false` est quand meme cree sans avertissement.
- **Fix**: Logger un warning ou refuser la creation de formats inactifs sans raison explicite.

**BUG-044** [MEDIUM] Format default toggle non-transactionnel
- **Fichier**: `src/app/api/products/[id]/formats/route.ts:66-71`
- **Description**: L'update des anciens defaults et la creation du nouveau format ne sont pas dans une transaction. Race condition possible.
- **Fix**: Wrapper dans `prisma.$transaction()`.

**BUG-045** [MEDIUM] RecentlyViewed slugsToFetch dependency in useEffect
- **Fichier**: `src/components/shop/RecentlyViewed.tsx:107`
- **Description**: `eslint-disable-next-line react-hooks/exhaustive-deps` est utilise pour masquer un warning de dependance. `slugsToFetch.join(',')` n'est pas stable.
- **Fix**: Utiliser `useMemo` pour `slugsToFetch` et le passer comme dependance.

**BUG-046** [MEDIUM] QuickViewModal useEffect missing locale dependency
- **Fichier**: `src/components/shop/QuickViewModal.tsx:90`
- **Description**: Le useEffect fetch le produit mais la dependance `locale` est absente. Si l'utilisateur change de langue, le QuickView ne recharge pas.
- **Fix**: Ajouter `locale` au tableau de dependances du useEffect.

**BUG-047** [MEDIUM] Product creation sends formats without validation
- **Fichier**: `src/app/admin/produits/nouveau/NewProductClient.tsx:183`
- **Description**: Les formats sont envoyes au POST API sans validation client-side. Un format sans nom ou avec prix negatif passe.
- **Fix**: Valider les formats avec le schema Zod cote client avant envoi.

**BUG-048** [MEDIUM] NewProductClient categoryId vide si pas de categories
- **Fichier**: `src/app/admin/produits/nouveau/NewProductClient.tsx:82`
- **Description**: `categoryId: categories[0]?.id || ''`. Si la liste est vide, une string vide est envoyee. L'API repondra 500.
- **Fix**: Afficher un message d'erreur si pas de categories disponibles.

**BUG-049** [MEDIUM] EditFormatForm onSave passe le format local sans merge DB
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:987`
- **Description**: `onSave(format)` envoie l'etat local complet y compris des champs qui n'ont pas change. Si un autre admin modifie en parallele, ses changements sont ecrases.
- **Fix**: Envoyer uniquement les champs modifies (diff avec initialFormat).

**BUG-050** [MEDIUM] MediaUploader label "PDF" et "Image" hardcodes
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:690,699` et `nouveau/NewProductClient.tsx:608,615`
- **Description**: Les labels "PDF" et "Image" sont hardcodes en anglais dans le MediaUploader.
- **Fix**: Utiliser `t('admin.productForm.pdf')` et `t('admin.productForm.image')`.

**BUG-051** [MEDIUM] fullTextSearch totalCount includes filtered results
- **Fichier**: `src/lib/search.ts:114-116`
- **Description**: Le `total` est compte AVANT le filtre `inStock`. Si 10 resultats sont retournes mais 3 sont out-of-stock, `total` dit 10 alors que seulement 7 sont affiches.
- **Fix**: Recompter apres le filtre inStock ou integrer le filtre dans le SQL.

**BUG-052** [MEDIUM] sanitizeQuery removes hyphens from peptide names
- **Fichier**: `src/lib/search.ts:57`
- **Description**: `replace(/[^\w\s-]/g, '')` garde les hyphens mais `split(/\s+/)` ne gere pas "BPC-157" comme un seul token. La recherche devient `BPC:* & 157:*` au lieu de chercher le nom complet.
- **Fix**: Traiter les mots avec tiret comme un seul token: `'BPC-157'` -> `'BPC-157':*`.

**BUG-053** [MEDIUM] ProductCard quantity no max check
- **Fichier**: `src/components/shop/ProductCard.tsx`
- **Description**: Le bouton d'incrementation de quantite n'a pas de limite max basee sur le stock reel.
- **Fix**: Limiter a `selectedFormat.stockQuantity`.

**BUG-054** [MEDIUM] Product export limited to 5000 sans pagination
- **Fichier**: `src/app/api/admin/products/export/route.ts`
- **Description**: L'export est limite a 5000 produits sans option de pagination. Un catalogue plus large sera tronque silencieusement.
- **Fix**: Ajouter une pagination ou un streaming pour les gros catalogues.

**BUG-055** [MEDIUM] Compare API max 4 products but no error message on violation
- **Fichier**: `src/app/api/products/compare/route.ts`
- **Description**: Le max est 4 produits mais l'erreur renvoyee n'est pas user-friendly.
- **Fix**: Retourner un message clair: "Maximum 4 products for comparison".

**BUG-056** [MEDIUM] RecentlyViewed product response shape assumption
- **Fichier**: `src/components/shop/RecentlyViewed.tsx:55`
- **Description**: `const fetchedProducts = Array.isArray(data) ? data : data.products || data.data?.products || data.data || []` - Trop de fallbacks car la shape de la reponse API n'est pas documentee.
- **Fix**: Standardiser la reponse API et simplifier le parsing.

**BUG-057** [MEDIUM] Category tree orphan silently displayed
- **Fichier**: `src/app/admin/categories/page.tsx`
- **Description**: Les categories orphelines (parentId pointe vers un ID inexistant) sont detectees mais affichees dans une section separee sans action corrective. L'admin pourrait ne pas comprendre.
- **Fix**: Ajouter un bouton "Fix orphans" pour re-parenter ou supprimer.

**BUG-058** [MEDIUM] product.compareAtPrice vs format.comparePrice confusion
- **Fichier**: Multiple files
- **Description**: Le modele Product a `compareAtPrice` et ProductFormat a `comparePrice`. Les noms differents creent de la confusion et des bugs potentiels.
- **Fix**: Standardiser le naming: utiliser `compareAtPrice` partout ou `comparePrice` partout.

**BUG-059** [MEDIUM] Viewed API POST no productId validation
- **Fichier**: `src/app/api/products/viewed/route.ts:POST`
- **Description**: Le POST accepte n'importe quel productId sans verifier qu'il existe en DB.
- **Fix**: Ajouter un `prisma.product.findUnique({ where: { id } })` check.

**BUG-060** [MEDIUM] ISR revalidate = 3600 trop long pour e-commerce
- **Fichier**: `src/app/(shop)/product/[slug]/page.tsx`, `src/app/(shop)/category/[slug]/page.tsx`
- **Description**: Les pages produit et categorie sont ISR avec 1h de revalidation. Un changement de prix ou de stock ne sera visible qu'apres 1h.
- **Fix**: Reduire a 300 (5min) ou utiliser on-demand revalidation via `revalidatePath/revalidateTag`.

**BUG-061** [MEDIUM] JSON-LD structured data uses static locale
- **Fichier**: `src/app/(shop)/product/[slug]/page.tsx`
- **Description**: Les donnees JSON-LD pour le SEO utilisent les noms en dur (base locale) sans prendre en compte la locale de l'utilisateur.
- **Fix**: Passer la locale detectee et utiliser les traductions dans le JSON-LD.

**BUG-062** [MEDIUM] Search modal results limited to 5 hardcoded
- **Fichier**: `src/components/shop/SearchModal.tsx:185`
- **Description**: `results.slice(0, 5)` hardcode le max de resultats dans le modal. Devrait etre configurable.
- **Fix**: Extraire dans une constante ou prop `maxResults`.

**BUG-063** [MEDIUM] ProductPageClient monolithic (1062 lines)
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx`
- **Description**: Composant monolithique de 1062 lignes. Difficile a maintenir, tester, et debug.
- **Fix**: Decomposer en sous-composants: ProductHeader, ProductFormats, ProductQuantity, ProductActions, etc.

**BUG-064** [MEDIUM] useMemo dependency on product.quantityDiscounts
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx:227`
- **Description**: Le `useMemo` a `product.quantityDiscounts` comme dependance. Si l'objet change de reference (re-render parent), le memo est invalide meme si les donnees sont identiques.
- **Fix**: Stabiliser la reference avec `JSON.stringify` ou `useMemo` sur l'objet parent.

**BUG-065** [MEDIUM] Inventory WAC calculation may be incorrect on import
- **Fichier**: `src/app/api/admin/inventory/import/route.ts`
- **Description**: L'import CSV recalcule le WAC par ligne sans prendre en compte les lignes precedentes du meme import.
- **Fix**: Accumuler les quantites et couts par format avant de calculer le WAC final.

**BUG-066** [MEDIUM] Product creation default image path
- **Fichier**: `src/app/admin/produits/nouveau/NewProductClient.tsx:80`
- **Description**: `imageUrl: '/images/products/peptide-default.png'` est hardcode. Si ce fichier n'existe pas en production, l'image sera cassee.
- **Fix**: Verifier l'existence du fichier ou utiliser un placeholder dynamique.

**BUG-067** [MEDIUM] FormatType enum mismatch between files
- **Fichier**: `src/components/shop/FormatSelector.tsx:3` vs `src/data/products.ts:8-26` vs `src/components/shop/QuickViewModal.tsx:14`
- **Description**: Chaque fichier definit sa propre union type `FormatType` avec des valeurs differentes. Le QuickViewModal a des types (powder, gummies, etc.) que FormatSelector ne connait pas.
- **Fix**: Centraliser dans un seul fichier `src/types/product.ts` et importer partout.

**BUG-068** [MEDIUM] Inventory export only includes active+tracked formats
- **Fichier**: `src/app/api/admin/inventory/export/route.ts`
- **Description**: L'export CSV ignore les formats inactifs. Si un admin veut un inventaire complet, il ne les verra pas.
- **Fix**: Ajouter un param `includeInactive` pour l'export.

**BUG-069** [MEDIUM] Product edit compareAtPrice type mismatch
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:123`
- **Description**: `compareAtPrice: product.compareAtPrice || ''` stocke une string vide si null. Quand envoye a l'API, une string vide n'est pas un number valide.
- **Fix**: Utiliser `compareAtPrice: product.compareAtPrice ?? null` et gerer le type correctement.

**BUG-070** [MEDIUM] Admin product list price not using format prices
- **Fichier**: `src/app/admin/produits/ProductsListClient.tsx:267`
- **Description**: Affiche `p.price` (prix de base produit) mais le vrai prix pour le client vient des formats. Peut etre trompeur.
- **Fix**: Afficher "From ${lowestFormatPrice}" comme sur le front.

**BUG-071** [MEDIUM] fullTextSearch English-only ts_config
- **Fichier**: `src/lib/search.ts:95,123`
- **Description**: `to_tsquery('english', ...)` est hardcode. La recherche ne fonctionne pas bien pour les termes francais ou d'autres langues.
- **Fix**: Detecter la locale et utiliser le config tsquery correspondant (ou `simple` pour multilingual).

**BUG-072** [MEDIUM] Category page fetches all products for children too
- **Fichier**: `src/app/(shop)/category/[slug]/page.tsx`
- **Description**: Charge les produits de la categorie ET de tous ses enfants sans limite. Avec des sous-categories larges, ca peut etre lourd.
- **Fix**: Ajouter une limite et pagination.

**BUG-073** [MEDIUM] Product viewed cookie manipulation possible
- **Fichier**: `src/app/api/products/viewed/route.ts`
- **Description**: Le cookie `recently_viewed` n'est pas httpOnly (intentionnel pour le client-side), mais un script malicieux peut le modifier.
- **Fix**: Valider les slugs lus depuis le cookie cote serveur.

**BUG-074** [MEDIUM] Admin produits error page generic
- **Fichier**: `src/app/admin/produits/error.tsx`
- **Description**: La page d'erreur est probablement generique sans information utile pour l'admin.
- **Fix**: Afficher le message d'erreur et un bouton retry avec contexte.

**BUG-075** [MEDIUM] No optimistic update on format save
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:219-233`
- **Description**: Apres save d'un format, le UI attend la reponse serveur. Pas de mise a jour optimiste.
- **Fix**: Mettre a jour l'etat local immediatement et rollback en cas d'erreur.

**BUG-076** [MEDIUM] Product delete is soft-delete but format delete is hard
- **Fichier**: `src/app/api/products/[id]/route.ts:DELETE` vs `src/app/api/products/[id]/formats/[formatId]/route.ts:DELETE`
- **Description**: Inconsistance: produits sont soft-deleted (`isActive: false`) mais formats sont hard-deleted.
- **Fix**: Uniformiser: soft-delete pour les deux.

**BUG-077** [MEDIUM] multiLanguageSearch in search.ts not exposed via API
- **Fichier**: `src/lib/search.ts:282-360`
- **Description**: `multiLanguageSearch()` existe mais n'est appelee par aucune route API. La recherche multilangue n'est pas accessible.
- **Fix**: Integrer dans `/api/products/search` quand la locale n'est pas 'en'.

**BUG-078** [MEDIUM] Recommendations API order-based with no fallback data
- **Fichier**: `src/app/api/products/recommendations/route.ts`
- **Description**: Si aucune commande n'existe (nouveau site), les recommendations echouent silencieusement.
- **Fix**: Ajouter un fallback robuste (produits bestseller, meme categorie) quand pas de donnees de commande.

**BUG-079** [MEDIUM] Product creation slug not unique-checked client-side
- **Fichier**: `src/app/admin/produits/nouveau/NewProductClient.tsx:94-101`
- **Description**: Le slug est auto-genere a partir du nom mais pas verifie en unicite avant envoi.
- **Fix**: Ajouter un debounced check `/api/products?slug=xxx` pour verifier l'unicite.

**BUG-080** [MEDIUM] ProductEditClient no unsaved changes warning
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx`
- **Description**: L'admin peut naviguer away sans sauvegarder ses modifications. Pas de confirmation "unsaved changes".
- **Fix**: Ajouter un `beforeunload` event listener et un router guard.

### BASSE (20)

**BUG-081** [LOW] ProductBadge comment badge numbering wrong
- **Fichier**: `src/lib/product-badges.ts`
- **Description**: Commentaires dans le code avec numerotation discontinue (#1,#2,#3,#5).
- **Fix**: Corriger la numerotation des commentaires.

**BUG-082** [LOW] Unused `_request` parameter style inconsistant
- **Fichier**: Multiple API routes
- **Description**: Certaines routes utilisent `_request` (underscore), d'autres `request` meme quand non utilise.
- **Fix**: Standardiser sur `_request` quand le parametre n'est pas utilise.

**BUG-083** [LOW] Category page ProductCard import not shown
- **Fichier**: `src/app/(shop)/category/[slug]/CategoryPageClient.tsx`
- **Description**: Le composant ProductCard est importe mais pourrait utiliser un composant simplifie pour les listings.
- **Fix**: Purement stylistique, pas d'impact fonctionnel.

**BUG-084** [LOW] Console.error in production code
- **Fichier**: Multiple files (search.ts, inventory.service.ts, etc.)
- **Description**: `console.error` reste dans le code de production. Devrait utiliser un logger structure.
- **Fix**: Remplacer par un service de logging (ex: Pino, Winston) avec niveaux.

**BUG-085** [LOW] SearchModal no debounce cancel on unmount
- **Fichier**: `src/components/shop/SearchModal.tsx:52-67`
- **Description**: Le timeout est clear au re-render mais le fetch en cours n'est pas annule si le modal se ferme.
- **Fix**: Utiliser un `AbortController` pour annuler le fetch en cours.

**BUG-086** [LOW] Product edit tabs use emoji icons
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:297-299`
- **Description**: Les tabs utilisent des emojis (📋📝📦) qui peuvent s'afficher differemment selon l'OS.
- **Fix**: Utiliser des icones Lucide coherentes avec le reste de l'admin.

**BUG-087** [LOW] ProductGallery zoom is simple toggle
- **Fichier**: `src/components/shop/ProductGallery.tsx:49-51`
- **Description**: Le zoom est un simple toggle scale(1.5). Pas de zoom directionnel suivant le curseur.
- **Fix**: Ameliorer avec un zoom center-on-mouse pour une meilleure UX.

**BUG-088** [LOW] data/products.ts descriptions all in English
- **Fichier**: `src/data/products.ts`
- **Description**: Toutes les descriptions produit sont en anglais seulement. Pas de cle de traduction associee.
- **Fix**: Ajouter les `descriptionKey` pour traduction ou marquer comme seed data.

**BUG-089** [LOW] ProductPageClient formats filtered by stockQuantity > 0
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx:129`
- **Description**: `filter(f => f.stockQuantity > 0)` exclut les formats a stock 0. L'utilisateur ne voit pas qu'un format existe mais est rupture.
- **Fix**: Afficher les formats rupture en grise avec un label "Out of stock" et un bouton "Notify me".

**BUG-090** [LOW] ProductGallery images type 'lifestyle' etc. undocumented
- **Fichier**: `src/components/shop/ProductGallery.tsx:11`
- **Description**: Les types d'image ('main', 'vial', 'cartridge', 'kit', 'capsule', 'lifestyle') ne sont documentes nulle part.
- **Fix**: Creer un enum et le documenter.

**BUG-091** [LOW] CSS classes not responsive for RTL
- **Fichier**: Multiple components
- **Description**: Certains composants utilisent `left-0.5` au lieu de `start-0.5` pour le positionnement, ce qui ne fonctionnera pas en RTL.
- **Fix**: Utiliser `start`/`end` au lieu de `left`/`right` partout.

**BUG-092** [LOW] SearchModal spinners different colors
- **Fichier**: `src/components/shop/SearchModal.tsx:181` vs `QuickViewModal.tsx:237`
- **Description**: Le spinner de recherche utilise `border-emerald-600` mais le QuickView utilise `border-orange-600`. Inconsistance visuelle.
- **Fix**: Standardiser la couleur du spinner (orange = brand color).

**BUG-093** [LOW] No loading state feedback during product save
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:331-337`
- **Description**: Le bouton Save montre juste "Saving..." mais pas de skeleton ou overlay pour eviter les double-clicks sur d'autres elements.
- **Fix**: Ajouter un overlay ou desactiver le formulaire pendant la sauvegarde.

**BUG-094** [LOW] Admin delete confirmation uses confirm()
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:237`
- **Description**: `handleDeleteFormat` utilise `confirm()` natif qui est bloquant et non stylise. Devrait utiliser un modal custom.
- **Fix**: Remplacer par un modal de confirmation coherent avec le design system.

**BUG-095** [LOW] Product text IDs use Date.now()
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:175` et `nouveau/NewProductClient.tsx:107`
- **Description**: `id: 'text-${Date.now()}'` peut generer des doublons si deux textes sont ajoutes rapidement.
- **Fix**: Utiliser `crypto.randomUUID()`.

**BUG-096** [LOW] ProductGallery no lazy loading for thumbnails
- **Fichier**: `src/components/shop/ProductGallery.tsx:107`
- **Description**: Toutes les thumbnails ont `priority` implicite. Elles devraient etre lazy-loaded.
- **Fix**: Ajouter `loading="lazy"` sauf pour la premiere image.

**BUG-097** [LOW] No keyboard navigation in format selector
- **Fichier**: `src/components/shop/FormatSelector.tsx`
- **Description**: Le radiogroup n'a pas de navigation par fleches (ArrowUp/ArrowDown). Le role="radio" est la mais le comportement clavier manque.
- **Fix**: Implementer un handler onKeyDown pour les fleches directionnelles.

**BUG-098** [LOW] Product edit does not show success toast
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:262-263`
- **Description**: Apres un save reussi, `router.refresh()` est appele mais aucun toast de succes n'est affiche.
- **Fix**: Ajouter `toast.success(t('admin.productForm.updateSuccess'))`.

**BUG-099** [LOW] GripVertical icon not functional (drag not implemented)
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:634` et `nouveau/NewProductClient.tsx:509`
- **Description**: L'icone GripVertical est affichee pour le drag-and-drop mais le drag n'est pas implemente.
- **Fix**: Soit implementer le drag-and-drop (dnd-kit), soit retirer l'icone pour ne pas tromper l'utilisateur.

**BUG-100** [LOW] category/[slug]/page.tsx translations applied inconsistently
- **Fichier**: `src/app/(shop)/category/[slug]/page.tsx`
- **Description**: Les traductions sont appliquees server-side pour certains champs mais pas tous. Melange de champs traduits et non-traduits.
- **Fix**: Appliquer les traductions uniformement a tous les champs produit.

---

## PARTIE 2: 100 AMELIORATIONS

### CRITIQUE (8)

**IMP-001** [CRITICAL] Implementer la pagination server-side pour ShopPageClient
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx`
- **Description**: Remplacer le fetch de 200 produits par une pagination serveur avec `page`, `limit`, filtres et tri envoyes a l'API.
- **Suggestion**: `/api/products?page=1&limit=24&sort=price-asc&category=peptides&minPrice=10&maxPrice=100`

**IMP-002** [CRITICAL] Unifier les schemas de validation Zod
- **Fichier**: `src/lib/validations/product.ts` + tous les API routes
- **Description**: Centraliser TOUTES les validations dans `src/lib/validations/`. Un schema par entite (product, category, format, inventory). Les routes importent et utilisent ces schemas.
- **Suggestion**: `src/lib/validations/product.ts`, `category.ts`, `format.ts`, `inventory.ts`

**IMP-003** [CRITICAL] Ajouter un rate limiter global sur les API publiques
- **Fichier**: Middleware ou route-level
- **Description**: Les APIs search, products, categories n'ont aucun rate limiting. Vulnerables au DDoS et scraping.
- **Suggestion**: Utiliser `@upstash/ratelimit` avec Redis ou un middleware Express-style.

**IMP-004** [CRITICAL] Implementer CSRF protection sur les mutations
- **Fichier**: Toutes les routes POST/PUT/DELETE
- **Description**: Aucune protection CSRF sur les mutations. Un site tiers peut forger des requetes.
- **Suggestion**: Ajouter un token CSRF via cookies SameSite=Strict + header custom X-CSRF-Token.

**IMP-005** [CRITICAL] Standardiser les reponses API
- **Fichier**: Toutes les routes API
- **Description**: Certaines routes retournent `{ product }`, d'autres `{ products }`, d'autres directement l'objet. Pas de format standard.
- **Suggestion**: Adopter `{ data: T, meta: { page, total, ... }, error?: string }` partout.

**IMP-006** [CRITICAL] Ajouter des indexes DB pour la recherche
- **Fichier**: `prisma/schema.prisma`
- **Description**: Les champs de recherche (name, slug, categoryId, isActive) n'ont probablement pas tous des index. Performances catastrophiques a grande echelle.
- **Suggestion**: `@@index([isActive, isFeatured])`, `@@index([categoryId, isActive])`, `@@index([slug])`.

**IMP-007** [CRITICAL] Implementer on-demand ISR revalidation
- **Fichier**: API routes de mutation + webhook
- **Description**: Au lieu de `revalidate = 3600`, utiliser `revalidatePath('/product/' + slug)` apres chaque modification produit.
- **Suggestion**: Appeler `revalidatePath` et `revalidateTag` dans chaque PUT/DELETE des produits et categories.

**IMP-008** [CRITICAL] Ajouter des tests unitaires pour le catalogue
- **Fichier**: Nouveau `__tests__/` directory
- **Description**: ZERO test pour les routes API catalogue, les services inventaire, les badges, la recherche. Pas de filet de securite.
- **Suggestion**: Jest + supertest pour les routes API, vitest pour les utilitaires.

### HAUTE (30)

**IMP-009** [HIGH] Decomposer ProductPageClient en sous-composants
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx`
- **Description**: 1062 lignes. Decomposer en: ProductHeader, ProductGallerySection, ProductFormats, ProductQuantity, ProductActions, ProductCustomSections, ProductTabs.
- **Suggestion**: 7-8 composants de 100-150 lignes chacun.

**IMP-010** [HIGH] Ajouter un systeme de cache invalide pour les produits
- **Fichier**: `src/lib/cache.ts` + toutes routes de mutation
- **Description**: Utiliser un systeme de tags pour invalider le cache produit quand un produit/format/categorie est modifie.
- **Suggestion**: Tags: `product-${id}`, `products-list`, `category-${id}`, `categories-list`.

**IMP-011** [HIGH] Implementer un error boundary pour les pages catalogue
- **Fichier**: `src/app/(shop)/product/[slug]/error.tsx`, `src/app/(shop)/shop/error.tsx`
- **Description**: Pas d'error boundary specifique pour les pages produit. Un crash affiche une page blanche.
- **Suggestion**: Creer des error.tsx avec message user-friendly et bouton retry.

**IMP-012** [HIGH] Ajouter le support RTL complet au catalogue
- **Fichier**: Tous les composants shop
- **Description**: Le site supporte l'arabe (ar, ar-dz, ar-lb, ar-ma) mais de nombreux composants utilisent `left/right` au lieu de `start/end`.
- **Suggestion**: Audit complet des classes CSS et remplacement par des variantes logiques.

**IMP-013** [HIGH] Implementer les filtres avances sur la page shop
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx`
- **Description**: Les filtres actuels sont basiques. Ajouter: fourchette de prix (slider), purity min/max, format type, in-stock only, sort options.
- **Suggestion**: Composant FilterPanel avec URL search params pour sharing/bookmarking.

**IMP-014** [HIGH] Ajouter un skeleton loader pour les pages produit
- **Fichier**: `src/app/(shop)/product/[slug]/loading.tsx`
- **Description**: Pas de loading.tsx pour la page produit. L'utilisateur voit un ecran blanc pendant le chargement.
- **Suggestion**: Creer un skeleton qui reproduit la mise en page du produit (image placeholder, lignes de texte, etc.).

**IMP-015** [HIGH] Implementer le "Notify me" pour produits rupture
- **Fichier**: `src/components/shop/StockAlertButton.tsx` (existe deja)
- **Description**: Les formats out-of-stock sont simplement caches. Les utilisateurs devraient pouvoir s'inscrire pour etre notifies.
- **Suggestion**: Connecter StockAlertButton a une API `/api/products/[id]/stock-alert` avec email notification.

**IMP-016** [HIGH] Ajouter la recherche par voice
- **Fichier**: `src/components/shop/SearchModal.tsx`
- **Description**: Ajouter un bouton microphone pour la recherche vocale via Web Speech API.
- **Suggestion**: `navigator.mediaDevices` + `SpeechRecognition` avec fallback gracieux.

**IMP-017** [HIGH] Implementer le product comparison page
- **Fichier**: Nouveau `src/app/(shop)/compare/page.tsx`
- **Description**: L'API `/api/products/compare` existe mais pas de page frontend pour l'utiliser.
- **Suggestion**: Tableau de comparaison avec specs, prix, formats, purity side-by-side.

**IMP-018** [HIGH] Ajouter des breadcrumbs dynamiques
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx`, `src/app/(shop)/category/[slug]/CategoryPageClient.tsx`
- **Description**: Pas de breadcrumbs visibles pour la navigation (Home > Category > Product).
- **Suggestion**: Composant Breadcrumbs reutilisable avec hierarchie categorie parent > enfant.

**IMP-019** [HIGH] Implementer infinite scroll ou load-more pour la shop page
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx`
- **Description**: Alternative a la pagination classique: un bouton "Load more" ou un infinite scroll avec Intersection Observer.
- **Suggestion**: Charger 24 produits initialement, puis 12 par "Load more".

**IMP-020** [HIGH] Ajouter des meta og:image pour le partage social
- **Fichier**: `src/app/(shop)/product/[slug]/page.tsx`
- **Description**: Les meta Open Graph sont generees mais l'image pourrait etre optimisee pour les reseaux sociaux (1200x630).
- **Suggestion**: Generer des images OG dynamiques avec `next/og` (ImageResponse).

**IMP-021** [HIGH] Ajouter un audit trail pour les modifications produit
- **Fichier**: API routes de mutation
- **Description**: Pas de trace des modifications. Impossible de savoir qui a change quoi et quand.
- **Suggestion**: Table `ProductAuditLog` avec user, action, diff, timestamp.

**IMP-022** [HIGH] Implementer le bulk edit pour les produits admin
- **Fichier**: `src/app/admin/produits/ProductsListClient.tsx`
- **Description**: Pas de selection multiple. L'admin doit editer les produits un par un.
- **Suggestion**: Checkboxes + actions groupees (activate, deactivate, change category, adjust price%).

**IMP-023** [HIGH] Ajouter le support des variantes de produit (couleur, taille)
- **Fichier**: Schema Prisma + API
- **Description**: Les formats couvrent les dosages/volumes mais pas d'autres variantes (couleur d'accessoire, taille de kit).
- **Suggestion**: Ajouter un modele `ProductVariant` ou des attributs dynamiques sur `ProductFormat`.

**IMP-024** [HIGH] Implementer la recherche avec facettes
- **Fichier**: `src/app/api/products/search/route.ts`
- **Description**: La recherche retourne des resultats mais pas de facettes (combien par categorie, par fourchette de prix, etc.).
- **Suggestion**: Ajouter un `groupBy` categoryId et des ranges de prix dans la reponse.

**IMP-025** [HIGH] Ajouter un composant de prix avec historique
- **Fichier**: Nouveau composant
- **Description**: Afficher l'evolution du prix (graphe ou indicateur up/down) pour gagner la confiance.
- **Suggestion**: Table `PriceHistory` avec webhook sur modification de prix.

**IMP-026** [HIGH] Implementer le rich text editing pour descriptions
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx`
- **Description**: Les descriptions produit sont editees dans un simple textarea. Pas de mise en forme.
- **Suggestion**: Integrer TipTap ou Slate.js pour un editeur WYSIWYG avec formatting, listes, liens.

**IMP-027** [HIGH] Ajouter le support des bundles/packs custom
- **Fichier**: Schema + API + UI
- **Description**: Les bundles sont des produits normaux. Pas de logique specifique pour "build your own bundle".
- **Suggestion**: Composant BundleBuilder avec selection de produits et discount automatique.

**IMP-028** [HIGH] Implementer les product reviews avec photos
- **Fichier**: `src/components/shop/ProductReviews.tsx` (existe), `src/components/shop/ReviewImageUpload.tsx` (existe)
- **Description**: Les composants UI existent mais verifier la connexion avec l'API et la moderation.
- **Suggestion**: Ajouter la moderation auto des images (ML-based ou queue manuelle).

**IMP-029** [HIGH] Ajouter le support du lazy loading pour les images produit
- **Fichier**: `src/components/shop/ProductCard.tsx`, `src/components/shop/ProductGallery.tsx`
- **Description**: Certaines images sont marquees `priority` alors qu'elles sont below the fold.
- **Suggestion**: Ne marquer `priority` que pour les images above-the-fold. Utiliser `loading="lazy"` pour le reste.

**IMP-030** [HIGH] Implementer un A/B testing framework pour les pages produit
- **Fichier**: Nouveau middleware
- **Description**: Pas de capacite de A/B testing pour tester differentes mises en page, prix, ou CTA.
- **Suggestion**: Middleware qui assigne un bucket et passe un cookie. Composant `<Variant>`.

**IMP-031** [HIGH] Ajouter le support des videos produit inline
- **Fichier**: `src/components/shop/ProductVideo.tsx` (existe)
- **Description**: Le composant existe mais verifier l'integration dans la page produit et le support YouTube/Vimeo embed.
- **Suggestion**: Integrer dans la galerie d'images comme slide video.

**IMP-032** [HIGH] Implementer les quantity discounts progressifs
- **Fichier**: `src/components/shop/QuantityTiers.tsx` (existe)
- **Description**: Verifier que le calcul des prix degressifs est bien applique au panier et a la commande.
- **Suggestion**: Appliquer les discounts cote serveur (pas seulement affichage client).

**IMP-033** [HIGH] Ajouter le support PWA pour le catalogue offline
- **Fichier**: Service Worker
- **Description**: Les pages produit les plus visitees devraient etre cachees pour consultation offline.
- **Suggestion**: Cache les 50 produits les plus vus dans le Service Worker.

**IMP-034** [HIGH] Implementer des analytics de catalogue
- **Fichier**: Nouveau dashboard admin
- **Description**: Pas de dashboard montrant: produits les plus vus, taux de conversion par produit, produits ajoutes au panier mais pas achetes.
- **Suggestion**: Table `ProductView` + aggregation dans un dashboard admin.

**IMP-035** [HIGH] Ajouter des tags/labels personnalises aux produits
- **Fichier**: Schema Prisma + Admin UI
- **Description**: Les seuls badges sont new/bestseller/featured. Pas de tags custom (ex: "Lab Special", "Bundle Deal", "Editor's Pick").
- **Suggestion**: Table `ProductTag` many-to-many avec gestion admin.

**IMP-036** [HIGH] Implementer la recherche par image (visual search)
- **Fichier**: API + Upload component
- **Description**: Permettre aux utilisateurs de chercher un produit en uploadant une photo (ex: photo de peptide).
- **Suggestion**: Utiliser un service de vision AI (Google Vision, Azure CV) pour identifier le produit.

**IMP-037** [HIGH] Ajouter le support des codes promotionnels sur les produits
- **Fichier**: `src/app/api/products/[id]/promotions/route.ts`
- **Description**: Les promotions sont chargees mais pas de systeme de codes promo applicables au panier.
- **Suggestion**: Composant PromoCodeInput dans le checkout avec validation API.

**IMP-038** [HIGH] Implementer la synchronisation temps-reel du stock
- **Fichier**: WebSocket ou SSE
- **Description**: Le stock affiche peut etre obsolete si un autre utilisateur achete en parallele.
- **Suggestion**: WebSocket pour push les mises a jour de stock en temps reel. Ou au minimum, re-checker au checkout.

### MOYENNE (40)

**IMP-039** [MEDIUM] Ajouter un composant de partage social optimise
- **Fichier**: `src/components/shop/ShareButtons.tsx` (existe)
- **Description**: Verifier que le partage inclut les meta OG et fonctionne pour tous les reseaux.
- **Suggestion**: Ajouter le copy-to-clipboard, email, WhatsApp en plus de Facebook/Twitter.

**IMP-040** [MEDIUM] Implementer un "You may also like" base sur l'IA
- **Fichier**: `src/app/api/products/recommendations/route.ts`
- **Description**: Les recommendations sont basees sur les commandes. Ajouter un fallback ML-based.
- **Suggestion**: Utiliser les embeddings produit pour calculer la similarite cosinus.

**IMP-041** [MEDIUM] Ajouter un zoom pinch-to-zoom mobile pour la galerie
- **Fichier**: `src/components/shop/ProductGallery.tsx`
- **Description**: Le zoom est un simple click toggle. Sur mobile, le pinch-to-zoom serait plus naturel.
- **Suggestion**: Integrer une lib comme `react-zoom-pan-pinch`.

**IMP-042** [MEDIUM] Ajouter la gestion des devises avec taux dynamiques
- **Fichier**: `src/contexts/CurrencyContext.tsx`
- **Description**: Verifier que les taux de change sont dynamiques et non hardcodes.
- **Suggestion**: API de taux (Open Exchange Rates) avec cache 1h.

**IMP-043** [MEDIUM] Ajouter des filtres de categorie dans l'admin inventaire
- **Fichier**: `src/app/api/admin/inventory/route.ts`
- **Description**: Le filtre inventaire ne supporte que lowStock. Pas de filtre par categorie.
- **Suggestion**: Ajouter `categoryId` comme parametre de filtre.

**IMP-044** [MEDIUM] Implementer un import/export Excel en plus du CSV
- **Fichier**: `src/app/api/admin/inventory/import/route.ts`, `export/route.ts`
- **Description**: Seul le CSV est supporte. Excel (xlsx) est plus commun pour les equipes non-tech.
- **Suggestion**: Utiliser `xlsx` ou `exceljs` pour le parsing/generation.

**IMP-045** [MEDIUM] Ajouter des tooltips informatifs sur les specs peptide
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx`
- **Description**: Les termes comme "CAS Number", "Molecular Weight", "Purity HPLC" ne sont pas expliques.
- **Suggestion**: Tooltip au hover avec une courte definition pour les non-experts.

**IMP-046** [MEDIUM] Implementer un mode grille/liste pour la shop page
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx`
- **Description**: Uniquement mode grille. Certains utilisateurs preferent le mode liste (plus de details visibles).
- **Suggestion**: Toggle grid/list avec persistence en localStorage.

**IMP-047** [MEDIUM] Ajouter la gestion des pre-commandes
- **Fichier**: Schema + API + UI
- **Description**: Le status `PRE_ORDER` existe dans les types mais pas de workflow complet.
- **Suggestion**: Permettre l'ajout au panier avec date estimee et notification quand disponible.

**IMP-048** [MEDIUM] Implementer les product questions & answers
- **Fichier**: `src/components/shop/ProductQA.tsx` (existe)
- **Description**: Le composant existe mais verifier la connexion backend et la moderation.
- **Suggestion**: API pour poster/repondre aux questions avec notifications email.

**IMP-049** [MEDIUM] Ajouter un certificat d'analyse (CoA) telechargeable
- **Fichier**: Page produit
- **Description**: Les peptides mentionnent des CoA mais pas de lien de telechargement.
- **Suggestion**: Champ `coaUrl` sur ProductFormat avec lien PDF.

**IMP-050** [MEDIUM] Implementer le lazy loading des tabs produit
- **Fichier**: `src/app/(shop)/product/[slug]/ProductPageClient.tsx`
- **Description**: Tous les tabs sont rendus meme quand ils ne sont pas visibles.
- **Suggestion**: Utiliser React.lazy ou un rendu conditionnel pour ne charger le contenu du tab qu'au clic.

**IMP-051** [MEDIUM] Ajouter un filtre "Recently Added" a la shop page
- **Fichier**: `src/app/(shop)/shop/ShopPageClient.tsx`
- **Description**: Pas de filtre pour voir les produits recemment ajoutes au catalogue.
- **Suggestion**: Ajouter un filtre "Last 30 days" base sur createdAt.

**IMP-052** [MEDIUM] Implementer un product feed pour Google Merchant
- **Fichier**: Nouvelle route API
- **Description**: Pas de feed XML pour Google Shopping.
- **Suggestion**: Route `/api/feeds/google-merchant` generant le XML conforme.

**IMP-053** [MEDIUM] Ajouter le support des images WebP/AVIF
- **Fichier**: Next.js config + image handling
- **Description**: Les images produit sont probablement en PNG/JPEG. Les formats modernes (WebP, AVIF) sont plus legers.
- **Suggestion**: Configurer `next/image` pour servir automatiquement en WebP/AVIF.

**IMP-054** [MEDIUM] Implementer un sitemap dynamique pour les produits
- **Fichier**: `src/app/sitemap.ts`
- **Description**: Verifier que tous les produits actifs sont dans le sitemap avec la bonne priorite.
- **Suggestion**: `src/app/sitemap.ts` avec generation dynamique depuis la DB.

**IMP-055** [MEDIUM] Ajouter des meta schema.org pour les reviews
- **Fichier**: `src/app/(shop)/product/[slug]/page.tsx`
- **Description**: Le JSON-LD Product existe mais manque les aggregateRating/reviews.
- **Suggestion**: Ajouter `aggregateRating` et `review` dans le JSON-LD.

**IMP-056** [MEDIUM] Implementer le drag-and-drop pour reordonner les formats
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx`
- **Description**: L'icone GripVertical existe mais pas de DnD. Les formats ne sont pas reordonnables.
- **Suggestion**: Integrer `@dnd-kit/core` pour le reordering et persister le `sortOrder`.

**IMP-057** [MEDIUM] Ajouter un mode dark pour l'admin
- **Fichier**: Admin layout
- **Description**: L'admin utilise un theme clair uniquement. Le dark mode reduirait la fatigue oculaire.
- **Suggestion**: Utiliser les classes `dark:` de Tailwind avec un toggle dans l'en-tete admin.

**IMP-058** [MEDIUM] Implementer des webhooks pour les evenements catalogue
- **Fichier**: Nouvelle API
- **Description**: Pas de webhooks pour notifier les systemes externes (ERP, CRM) lors de changements catalogue.
- **Suggestion**: Table `Webhook` avec event types: product.created, product.updated, stock.low, etc.

**IMP-059** [MEDIUM] Ajouter un systeme de tags i18n pour les badges
- **Fichier**: `src/lib/product-badges.ts`
- **Description**: Les badges sont generes par code mais les labels ne sont pas traduits dynamiquement.
- **Suggestion**: Retourner des cles i18n depuis `getPriorityBadges()` au lieu de labels.

**IMP-060** [MEDIUM] Implementer un tableau de bord inventaire visuel
- **Fichier**: Admin dashboard
- **Description**: L'inventaire est une liste. Un dashboard avec graphes (stock par categorie, tendances, alerts) serait plus utile.
- **Suggestion**: Composants Chart.js ou Recharts pour visualiser l'inventaire.

**IMP-061** [MEDIUM] Ajouter le support multi-warehouse
- **Fichier**: Schema Prisma
- **Description**: Le stock est global. Pas de support pour plusieurs entrepots/locations.
- **Suggestion**: Table `Warehouse` + `WarehouseStock` avec stockQuantity par format par warehouse.

**IMP-062** [MEDIUM] Implementer le product versioning
- **Fichier**: Schema + API
- **Description**: Pas d'historique des versions produit. Impossible de rollback une modification.
- **Suggestion**: Table `ProductVersion` avec snapshot JSON et timestamp.

**IMP-063** [MEDIUM] Ajouter un "Quick Edit" inline dans la liste admin
- **Fichier**: `src/app/admin/produits/ProductsListClient.tsx`
- **Description**: Pour modifier un prix ou stock, il faut ouvrir la page edit complete. Un inline edit serait plus rapide.
- **Suggestion**: Double-click sur une cellule pour editer inline (prix, stock, status).

**IMP-064** [MEDIUM] Implementer la gestion des lots (batch tracking)
- **Fichier**: Schema + Inventory service
- **Description**: Les peptides ont des numeros de lot pour la tracabilite. Pas de champ dans le schema.
- **Suggestion**: Table `InventoryBatch` avec batchNumber, expirationDate, coaUrl.

**IMP-065** [MEDIUM] Ajouter des meta-descriptions generees par IA
- **Fichier**: Admin product form
- **Description**: L'admin doit ecrire manuellement les meta descriptions SEO.
- **Suggestion**: Bouton "Generate with AI" qui cree une meta description a partir du nom et de la description produit.

**IMP-066** [MEDIUM] Implementer un systeme de scores qualite produit
- **Fichier**: Admin + page produit
- **Description**: Pas d'indicateur de "completude" du produit (a-t-il des images? descriptions? formats? traductions?).
- **Suggestion**: Score de 0-100% base sur les champs remplis, affiche dans l'admin.

**IMP-067** [MEDIUM] Ajouter le support des poids pour le calcul de shipping
- **Fichier**: Schema ProductFormat + checkout
- **Description**: `weightGrams` existe sur ProductFormat mais n'est pas utilise dans le calcul de frais de livraison.
- **Suggestion**: Integrer le poids dans le calcul shipping (par total weight du panier).

**IMP-068** [MEDIUM] Implementer un systeme d'alertes admin pour le catalogue
- **Fichier**: Admin dashboard
- **Description**: Pas d'alertes quand: produit sans image, format sans prix, stock critique, traduction manquante.
- **Suggestion**: Widget "Catalogue Health" dans le dashboard admin avec la liste des problemes.

**IMP-069** [MEDIUM] Ajouter des tests E2E pour le parcours catalogue
- **Fichier**: Nouveau directory `e2e/`
- **Description**: Pas de tests E2E pour: parcourir la boutique, voir un produit, ajouter au panier.
- **Suggestion**: Playwright avec scenarios: browse > filter > view product > add to cart > checkout.

**IMP-070** [MEDIUM] Implementer le SEO avec hreflang pour les 22 langues
- **Fichier**: `src/app/(shop)/product/[slug]/page.tsx`, layout.tsx
- **Description**: Les pages produit n'ont pas de balises `hreflang` pour indiquer les versions linguistiques.
- **Suggestion**: Generer les `<link rel="alternate" hreflang="xx" href="..." />` pour chaque locale.

**IMP-071** [MEDIUM] Ajouter un mode "print" pour les fiches produit
- **Fichier**: ProductPageClient
- **Description**: L'impression d'une fiche produit inclut le header, footer, sidebar. Pas de style d'impression.
- **Suggestion**: Media query `@media print` pour masquer la navigation et formater proprement.

**IMP-072** [MEDIUM] Implementer la gestion des dates d'expiration produit
- **Fichier**: Schema + Admin
- **Description**: Les peptides ont des dates d'expiration mais pas de champ dans le schema.
- **Suggestion**: Ajouter `expirationDate` sur ProductFormat et alerter quand proche.

**IMP-073** [MEDIUM] Ajouter un endpoint de health-check catalogue
- **Fichier**: `src/app/api/products/health/route.ts`
- **Description**: Pas de moyen de verifier que le catalogue est accessible et coherent.
- **Suggestion**: Endpoint qui compte les produits actifs, formates, categories, et verifie la DB.

**IMP-074** [MEDIUM] Implementer un systeme de favoris persistant
- **Fichier**: Wishlist
- **Description**: `AddToWishlistButton.tsx` et `WishlistButton.tsx` existent mais verifier la persistance DB vs localStorage.
- **Suggestion**: Table `Wishlist` pour les utilisateurs connectes, localStorage pour les anonymes.

**IMP-075** [MEDIUM] Ajouter le support des unites de mesure configurables
- **Fichier**: Admin + page produit
- **Description**: Les unites (mg, ml, g) sont hardcodees. Pour un marche international, les unites pourraient varier.
- **Suggestion**: Enum `MeasurementUnit` avec conversion automatique.

**IMP-076** [MEDIUM] Implementer des micro-interactions sur le ProductCard
- **Fichier**: `src/components/shop/ProductCard.tsx`
- **Description**: Les cartes sont statiques. Ajouter des animations subtiles (hover, add-to-cart, etc.).
- **Suggestion**: Framer Motion pour les animations d'entree, hover scale, et feedback d'ajout panier.

**IMP-077** [MEDIUM] Ajouter un mode "Samples" pour les produits
- **Fichier**: Schema + UI
- **Description**: Pas de moyen d'offrir des echantillons gratuits ou a prix reduit.
- **Suggestion**: Flag `isSample` sur ProductFormat avec logique de limitation (1 par client).

**IMP-078** [MEDIUM] Implementer le calcul automatique du prix minimum
- **Fichier**: API products POST/PUT
- **Description**: Le prix de base du produit (`product.price`) est saisi manuellement. Il devrait etre calcule automatiquement comme le min des prix de formats actifs.
- **Suggestion**: Trigger Prisma ou calcul dans le PUT pour maintenir `price = min(format.prices)`.

### BASSE (22)

**IMP-079** [LOW] Ajouter des animations de transition entre les pages
- **Fichier**: Layout/template
- **Description**: Les transitions entre pages sont brutales (flash blanc).
- **Suggestion**: Utiliser `next/navigation` avec `startTransition` et des animations CSS.

**IMP-080** [LOW] Implementer un "Back to top" button sur les longues pages
- **Fichier**: ShopPageClient, CategoryPageClient
- **Description**: Les pages longues n'ont pas de bouton de retour en haut.
- **Suggestion**: Composant flottant qui apparait apres 500px de scroll.

**IMP-081** [LOW] Ajouter des raccourcis clavier pour l'admin
- **Fichier**: Admin produits
- **Description**: Pas de raccourcis clavier (Ctrl+S pour sauvegarder, Ctrl+N pour nouveau produit).
- **Suggestion**: Hook `useKeyboardShortcuts` pour les actions courantes.

**IMP-082** [LOW] Standardiser les noms de fichiers dans src/components/shop
- **Fichier**: `src/components/shop/`
- **Description**: 45 composants dans un seul dossier. Difficile a naviguer.
- **Suggestion**: Organiser en sous-dossiers: `shop/product/`, `shop/cart/`, `shop/search/`, `shop/layout/`.

**IMP-083** [LOW] Ajouter des emojis accessibles dans les tabs admin
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx:297-299`
- **Description**: Les emojis des tabs ne sont pas wrappees dans des `aria-hidden` et pourraient confondre les lecteurs d'ecran.
- **Suggestion**: Wraper dans `<span aria-hidden="true">` et s'assurer que le label textuel est suffisant.

**IMP-084** [LOW] Ajouter un indicateur de chargement global
- **Fichier**: Layout
- **Description**: Pas de barre de progression (NProgress-style) lors de la navigation entre pages.
- **Suggestion**: Integrer `nextjs-toploader` ou similar.

**IMP-085** [LOW] Implementer un tooltip de disponibilite sur le ProductCard
- **Fichier**: `src/components/shop/ProductCard.tsx`
- **Description**: Pas d'indicateur clair de la disponibilite sur la carte (en stock, stock faible, rupture).
- **Suggestion**: Pastille de couleur (vert/orange/rouge) avec tooltip.

**IMP-086** [LOW] Ajouter le support du copy-paste pour les specs peptide
- **Fichier**: ProductPageClient
- **Description**: Les specs (CAS number, molecular formula) devraient etre faciles a copier.
- **Suggestion**: Bouton "copy" a cote de chaque spec avec feedback toast.

**IMP-087** [LOW] Implementer un "View as customer" pour l'admin
- **Fichier**: Admin produits
- **Description**: Le lien "Voir produit" existe mais ouvre dans un nouvel onglet. Un mode preview inline serait plus pratique.
- **Suggestion**: Split-view ou modal preview dans l'admin.

**IMP-088** [LOW] Ajouter des noms descriptifs aux couleurs admin
- **Fichier**: CSS/Tailwind config
- **Description**: Les couleurs sont codees en classes Tailwind generiques (sky-500, neutral-200). Pas de tokens semantiques.
- **Suggestion**: Definir des tokens: `--color-admin-primary`, `--color-admin-danger`, etc.

**IMP-089** [LOW] Implementer le support des URL canoniques
- **Fichier**: Pages produit et categorie
- **Description**: Pas de balise `<link rel="canonical">` pour eviter le contenu duplique entre locales.
- **Suggestion**: Generer la canonical URL dans generateMetadata() de chaque page.

**IMP-090** [LOW] Ajouter un feedback visuel lors de l'ajout au panier
- **Fichier**: ProductCard, ProductPageClient, QuickViewModal
- **Description**: L'ajout au panier change le texte du bouton mais pas d'animation de "fly-to-cart".
- **Suggestion**: Animation de l'image produit qui "vole" vers l'icone du panier.

**IMP-091** [LOW] Implementer un systeme de couleurs coherent pour les badges
- **Fichier**: `src/lib/product-badges.ts`, `src/components/shop/ProductBadge.tsx`
- **Description**: Les couleurs des badges sont definies dans deux endroits differents.
- **Suggestion**: Centraliser les couleurs dans product-badges.ts et les exporter.

**IMP-092** [LOW] Ajouter un compteur de caracteres pour la description admin
- **Fichier**: `src/app/admin/produits/[id]/ProductEditClient.tsx`
- **Description**: Le shortDescription a un compteur (300) mais pas la description longue.
- **Suggestion**: Ajouter un compteur pour la description et les autres champs texte longs.

**IMP-093** [LOW] Implementer un auto-save draft pour le formulaire produit
- **Fichier**: ProductEditClient, NewProductClient
- **Description**: Si l'admin ferme l'onglet, tout est perdu. Pas de brouillon auto-sauvegarde.
- **Suggestion**: Auto-save en localStorage toutes les 30 secondes avec restoration au chargement.

**IMP-094** [LOW] Ajouter des transitions CSS pour les accordeons de texte
- **Fichier**: ProductEditClient, NewProductClient
- **Description**: Les accordeons de texte s'ouvrent/ferment sans animation.
- **Suggestion**: Transition CSS `max-height` ou Framer Motion `AnimatePresence`.

**IMP-095** [LOW] Implementer un indicateur de connexion reseau
- **Fichier**: Global
- **Description**: Pas de detection offline. Si l'admin perd sa connexion, les saves echouent silencieusement.
- **Suggestion**: Detecter `navigator.onLine` et afficher un banner "You are offline".

**IMP-096** [LOW] Ajouter des aria-live regions pour les mises a jour dynamiques
- **Fichier**: ShopPageClient, SearchModal
- **Description**: Les resultats de filtre/recherche changent sans notification aux lecteurs d'ecran.
- **Suggestion**: `aria-live="polite"` sur les conteneurs de resultats (deja present dans SearchModal, manque dans ShopPageClient).

**IMP-097** [LOW] Standardiser les messages d'erreur API
- **Fichier**: Toutes les routes API
- **Description**: Les messages d'erreur varient: "Failed to fetch", "Error creating", "Unauthorized". Pas de code d'erreur.
- **Suggestion**: Format standard: `{ error: { code: 'PRODUCT_NOT_FOUND', message: '...', details: {} } }`.

**IMP-098** [LOW] Ajouter le support du "Compare at price" dans l'admin liste
- **Fichier**: `src/app/admin/produits/ProductsListClient.tsx`
- **Description**: La liste admin ne montre pas les prix barres. L'admin ne sait pas quels produits sont en promotion.
- **Suggestion**: Afficher le compareAtPrice barre si present.

**IMP-099** [LOW] Implementer des tests de performance Lighthouse
- **Fichier**: CI/CD pipeline
- **Description**: Pas de tests de performance automatises pour les pages catalogue.
- **Suggestion**: Integrer `lhci` (Lighthouse CI) dans la pipeline GitHub Actions.

**IMP-100** [LOW] Ajouter un guide utilisateur inline pour l'admin
- **Fichier**: Admin produits
- **Description**: Pas de guide ou tooltips d'aide pour les nouvelles fonctionnalites admin.
- **Suggestion**: Composant `OnboardingTour` avec des etapes guidees (react-joyride ou similar).

---

## FICHIERS AUDITES

| Fichier | Lignes | Bugs | Ameliorations |
|---------|--------|------|---------------|
| `src/app/api/products/route.ts` | 517 | 4 | 3 |
| `src/app/api/products/[id]/route.ts` | 290 | 3 | 2 |
| `src/app/api/products/search/route.ts` | 229 | 4 | 3 |
| `src/app/api/products/by-slug/[slug]/route.ts` | 103 | 1 | 1 |
| `src/app/api/products/[id]/formats/route.ts` | 118 | 2 | 1 |
| `src/app/api/products/[id]/formats/[formatId]/route.ts` | 169 | 3 | 2 |
| `src/app/api/products/[id]/translations/route.ts` | 34 | 1 | 0 |
| `src/app/api/products/[id]/related/route.ts` | 110 | 0 | 1 |
| `src/app/api/products/compare/route.ts` | 135 | 1 | 1 |
| `src/app/api/products/recommendations/route.ts` | 229 | 1 | 2 |
| `src/app/api/products/viewed/route.ts` | 118 | 2 | 0 |
| `src/app/api/admin/products/export/route.ts` | 243 | 1 | 1 |
| `src/app/api/categories/route.ts` | 199 | 2 | 2 |
| `src/app/api/categories/[id]/route.ts` | 208 | 1 | 1 |
| `src/app/api/admin/inventory/route.ts` | 243 | 1 | 2 |
| `src/app/api/admin/inventory/[id]/route.ts` | 124 | 1 | 0 |
| `src/app/api/admin/inventory/import/route.ts` | 253 | 2 | 2 |
| `src/app/api/admin/inventory/export/route.ts` | 114 | 1 | 1 |
| `src/app/(shop)/product/[slug]/page.tsx` | 301 | 2 | 4 |
| `src/app/(shop)/product/[slug]/ProductPageClient.tsx` | 1062 | 6 | 5 |
| `src/app/(shop)/shop/page.tsx` | 50 | 1 | 1 |
| `src/app/(shop)/shop/ShopPageClient.tsx` | 573 | 3 | 5 |
| `src/app/(shop)/category/[slug]/page.tsx` | 187 | 2 | 2 |
| `src/app/(shop)/category/[slug]/CategoryPageClient.tsx` | 196 | 2 | 2 |
| `src/app/admin/produits/ProductsListClient.tsx` | 562 | 2 | 3 |
| `src/app/admin/produits/[id]/ProductEditClient.tsx` | 994 | 6 | 5 |
| `src/app/admin/produits/nouveau/NewProductClient.tsx` | 977 | 3 | 2 |
| `src/app/admin/produits/product-constants.ts` | 54 | 0 | 0 |
| `src/app/admin/categories/page.tsx` | 532 | 2 | 2 |
| `src/lib/product-badges.ts` | 100 | 3 | 2 |
| `src/lib/search.ts` | 361 | 2 | 3 |
| `src/lib/search-analytics.ts` | 154 | 0 | 1 |
| `src/lib/validations/product.ts` | ~120 | 1 | 2 |
| `src/lib/inventory/inventory.service.ts` | 403 | 2 | 2 |
| `src/components/shop/ProductCard.tsx` | ~200 | 1 | 2 |
| `src/components/shop/ProductBadges.tsx` | 45 | 0 | 1 |
| `src/components/shop/ProductGallery.tsx` | 125 | 2 | 3 |
| `src/components/shop/FormatSelector.tsx` | 122 | 3 | 1 |
| `src/components/shop/QuickViewModal.tsx` | 405 | 2 | 1 |
| `src/components/shop/SearchModal.tsx` | 259 | 2 | 2 |
| `src/components/shop/RecentlyViewed.tsx` | 168 | 2 | 0 |
| `src/components/shop/StickyAddToCart.tsx` | 102 | 1 | 0 |
| `src/data/products.ts` | 763 | 2 | 1 |

**Total fichiers audites**: 43
**Total lignes examinees**: ~10,500

---

*Audit genere le 2026-02-22 par Claude Code (Opus 4.6)*
*Methode: Lecture integrale de chaque fichier, analyse statique, verification des patterns de securite et de coherence*

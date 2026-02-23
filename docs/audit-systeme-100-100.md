# AUDIT SYSTEME - BioCycle Peptides (peptide-plus)
## 100 Failles + 100 Ameliorations

**Date**: 2026-02-22
**Auditeur**: Claude Code (Opus 4.6)
**Perimetre**: Section Systeme - Auth, Permissions, Sessions, CSRF, Rate Limiting, MFA, Admin Guard, Middleware, Audit Logging, Admin Dashboard (Settings, Permissions, Users, Logs)
**Methode**: Lecture exhaustive du code source, analyse statique, verification OWASP Top 10 + NYDFS 23 NYCRR 500

---

## RESUME EXECUTIF

### Statistiques Failles
| Severite  | Nombre | % |
|-----------|--------|---|
| CRITIQUE  | 18     | 18% |
| HAUTE     | 32     | 32% |
| MOYENNE   | 30     | 30% |
| BASSE     | 20     | 20% |
| **TOTAL** | **100**| 100% |

### Statistiques Ameliorations
| Priorite  | Nombre | % |
|-----------|--------|---|
| CRITIQUE  | 12     | 12% |
| HAUTE     | 33     | 33% |
| MOYENNE   | 35     | 35% |
| BASSE     | 20     | 20% |
| **TOTAL** | **100**| 100% |

### Top 5 Risques Critiques
1. **session-security.ts est du code mort** -- 316 lignes de securite session jamais appelees
2. **CSRF non envoye par le frontend admin** -- Toutes les mutations POST dans permissions/page.tsx sans header x-csrf-token
3. **Escalade de privilege** -- EMPLOYEE peut changer un role en OWNER via /api/admin/users/[id]
4. **admin-api-guard.ts sans permission granulaire** -- Tout EMPLOYEE accede a toutes les routes admin API
5. **Brute force in-memory seulement** -- Resets complets sur chaque deploy/restart serveur

---

## FAILLES (100)

### CRITIQUE (18)

**FAILLE-001** [CRITIQUE] Code mort: session-security.ts jamais integre
- **Fichier**: `src/lib/session-security.ts:1-316`
- **Description**: Le fichier entier (316 lignes) implemente timeout d'inactivite (15min), timeout absolu (8h), detection anomalies session (IP/UA/pays change), rotation tokens, limitation sessions concurrentes. AUCUNE de ces fonctions n'est appelee dans middleware.ts, auth-config.ts, ou aucun autre fichier. La securite des sessions NYDFS annoncee est inexistante.
- **Fix**: Integrer `recordUserActivity()` et `isSessionValid()` dans le middleware. Integrer `enforceMaxSessions()` dans le callback `signIn` de auth-config.ts. Integrer `detectSessionAnomaly()` dans le middleware pour les routes protegees.

**FAILLE-002** [CRITIQUE] CSRF non envoye par le frontend admin (permissions)
- **Fichier**: `src/app/admin/permissions/page.tsx:143-147, 162-166, 177-185, 203-207, 223-233, 247-253`
- **Description**: Toutes les requetes POST dans la page permissions utilisent `fetch('/api/admin/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ... })` SANS header `x-csrf-token`. Le guard admin verifie le CSRF (admin-api-guard.ts:131-143), donc ces requetes devraient etre rejetees 403 en production. Si elles passent, c'est que le CSRF est desactive ou bypasse.
- **Fix**: Utiliser `fetchWithCSRF()` de csrf.ts ou ajouter `addCSRFHeader()` a tous les appels fetch. Ou creer un hook `useAdminFetch()` qui ajoute automatiquement le header CSRF.

**FAILLE-003** [CRITIQUE] Escalade de privilege: EMPLOYEE peut devenir OWNER
- **Fichier**: `src/app/api/admin/users/[id]/route.ts:261`
- **Description**: Le PATCH permet de changer `role` sans verifier la hierarchie. Un EMPLOYEE peut envoyer `{ role: "OWNER" }` pour se promouvoir ou promouvoir un autre utilisateur. `adminUpdateUserSchema` valide le format mais pas la hierarchie des roles.
- **Fix**: Ajouter une verification: seul un OWNER peut assigner le role OWNER. Un EMPLOYEE ne peut changer que les roles inferieurs (CUSTOMER, CLIENT). Bloquer tout changement vers OWNER si `session.user.role !== 'OWNER'`.

**FAILLE-004** [CRITIQUE] admin-api-guard.ts sans permission granulaire
- **Fichier**: `src/lib/admin-api-guard.ts:111-124`
- **Description**: Le guard verifie uniquement si le role est EMPLOYEE ou OWNER (`ADMIN_ROLES.has(userRole)`). Il ne verifie AUCUNE permission granulaire. Un EMPLOYEE avec seulement `products.view` peut appeler `/api/admin/permissions` (gestion permissions), `/api/admin/settings` (parametres), `/api/admin/users/[id]` (modification utilisateurs).
- **Fix**: Ajouter un parametre `requiredPermission` a `withAdminGuard()` et appeler `hasPermission()` depuis permissions.ts. Exemple: `export const POST = withAdminGuard(handler, { requiredPermission: 'users.manage_permissions' })`.

**FAILLE-005** [CRITIQUE] Brute force in-memory perd tout au restart
- **Fichier**: `src/lib/brute-force-protection.ts:14-19`
- **Description**: `loginAttempts` est un `Map<string, ...>` en memoire. Un restart serveur (deploy Azure, scaling, crash) remet le compteur a zero. Un attaquant peut forcer un restart ou simplement attendre le deploy suivant pour retenter 3 tentatives.
- **Fix**: Migrer vers Redis (ou la table AuditLog existante pour compter les FAILED_LOGIN recents). Pattern: `SELECT COUNT(*) FROM AuditLog WHERE action='FAILED_LOGIN' AND entityId=email AND createdAt > NOW() - INTERVAL 15 MINUTES`.

**FAILLE-006** [CRITIQUE] Double implementation CSRF deconnectee
- **Fichier**: `src/lib/csrf.ts:1-210` et `src/lib/security.ts:325-378`
- **Description**: Deux systemes CSRF completement independants: (1) csrf.ts utilise le pattern double-submit cookie avec HMAC-SHA256, (2) security.ts utilise des tokens in-memory a usage unique. Le guard admin utilise `csrf-middleware.ts` (qui importe de csrf.ts), mais security.ts exporte aussi `generateCsrfToken()`/`validateCsrfToken()` qui ne sont relies a rien. Confusion, maintenance impossible.
- **Fix**: Supprimer le CSRF in-memory de security.ts (lignes 325-378). Standardiser sur csrf.ts + csrf-middleware.ts partout. Documenter clairement le pattern utilise.

**FAILLE-007** [CRITIQUE] MFA fallback au secret brut si decryption echoue
- **Fichier**: `src/lib/auth-config.ts:141-147`
- **Description**: `catch { mfaSecret = user.mfaSecret! }` -- si le decryptage echoue (cle changee, corrupted), le code utilise la valeur chiffree comme secret TOTP. Cela rend le MFA invalide (le code ne correspondra jamais) OU pire, si la valeur brute est un secret valide d'un ancien format, permet un bypass.
- **Fix**: En cas d'echec de decryptage, refuser la connexion et forcer un reset MFA. Ne JAMAIS fallback au secret brut. Pattern: `catch { console.error(...); return null; // force login failure }`.

**FAILLE-008** [CRITIQUE] Deux definitions EMPLOYEE_PERMISSIONS qui derivent
- **Fichier**: `src/middleware.ts:75-88` vs `src/lib/permissions.ts:160-173`
- **Description**: Le middleware a son propre `EMPLOYEE_PERMISSIONS` Set, et permissions.ts a `ROLE_DEFAULTS.EMPLOYEE` array. Ces deux listes DOIVENT etre identiques mais sont maintenues separement. Si on ajoute une permission dans l'une sans l'autre, un EMPLOYEE pourrait acceder a une route middleware mais pas a l'API, ou vice versa.
- **Fix**: Exporter `ROLE_DEFAULTS` depuis permissions.ts et l'utiliser dans le middleware. Si le middleware est en edge runtime et ne peut pas importer, generer automatiquement le Set au build time via un script.

**FAILLE-009** [CRITIQUE] Rate limiting admin utilise l'implementation in-memory basique
- **Fichier**: `src/lib/admin-api-guard.ts:23` et `src/lib/security.ts:262-323`
- **Description**: Le guard admin importe `checkRateLimit` depuis security.ts (in-memory basique), alors qu'il existe rate-limiter.ts (512 lignes, Redis-backed avec fallback). Le rate limiting admin est donc fragile: reset au restart, pas partage entre instances Azure.
- **Fix**: Migrer admin-api-guard.ts pour utiliser `checkRateLimit` de rate-limiter.ts au lieu de security.ts. Adapter la signature (rate-limiter.ts prend ip+path, security.ts prend key+max+window).

**FAILLE-010** [CRITIQUE] Seed permissions auto sans CSRF ni confirmation
- **Fichier**: `src/app/admin/permissions/page.tsx:141-149`
- **Description**: Si `permissions.length === 0`, le useEffect envoie automatiquement un POST seed sans CSRF token, sans confirmation utilisateur, et potentiellement en boucle infinie si le seed echoue silencieusement (fetch retourne ok mais permissions restent vides).
- **Fix**: Ajouter un bouton "Initialiser les permissions" au lieu d'auto-seed. Ajouter un guard `hasSeeded` pour eviter les boucles. Ajouter CSRF header.

**FAILLE-011** [CRITIQUE] CORS missing x-csrf-token dans allowed headers
- **Fichier**: `src/middleware.ts:145, 155`
- **Description**: Les headers CORS autorisent `Content-Type, Authorization, x-idempotency-key, x-request-id` mais PAS `x-csrf-token`. Les requetes cross-origin avec CSRF seront bloquees par le navigateur (header non autorise en preflight).
- **Fix**: Ajouter `x-csrf-token` a la liste `Access-Control-Allow-Headers`.

**FAILLE-012** [CRITIQUE] Aucun security header HTTP
- **Fichier**: `src/middleware.ts:100-305`
- **Description**: Le middleware ne set aucun header de securite: pas de CSP, pas de HSTS, pas de X-Frame-Options, pas de X-Content-Type-Options, pas de Referrer-Policy, pas de Permissions-Policy. Le site est vulnerable au clickjacking, MIME sniffing, referrer leakage.
- **Fix**: Ajouter dans le middleware avant return: `res.headers.set('X-Frame-Options', 'DENY')`, `res.headers.set('X-Content-Type-Options', 'nosniff')`, `res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')`, `res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')`, `res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')`.

**FAILLE-013** [CRITIQUE] Permission cache sans limite de taille
- **Fichier**: `src/lib/permissions.ts:248`
- **Description**: `permissionCache = new Map<string, ...>()` grandit indefiniment. Chaque combinaison userId:role cree une entree. Avec 10000 utilisateurs, cela represente 10000 entrees en memoire permanente (TTL 60s mais les entrees ne sont pas supprimees apres expiration, elles sont juste ignorees).
- **Fix**: Ajouter un nettoyage periodique ou utiliser un LRU cache avec taille maximale (ex: `lru-cache` npm avec max 1000 entrees). Ou nettoyer les entrees expirees dans un setInterval.

**FAILLE-014** [CRITIQUE] Race condition updateGroup: deleteMany + createMany
- **Fichier**: `src/app/api/admin/permissions/route.ts:155-167`
- **Description**: `updateGroup` fait un `deleteMany` puis `createMany` sur les permissions du groupe SANS transaction. Si le serveur crash entre les deux, le groupe perd toutes ses permissions.
- **Fix**: Wrapper dans `prisma.$transaction()`: `await prisma.$transaction([prisma.permissionGroupPermission.deleteMany({where:{groupId}}), prisma.permissionGroupPermission.createMany({data:...})])`.

**FAILLE-015** [CRITIQUE] generateCurrentTOTP exporte publiquement
- **Fichier**: `src/lib/mfa.ts:59-61`
- **Description**: `generateCurrentTOTP(secret)` genere le code TOTP valide pour un secret donne. Marque "pour tests uniquement" mais exporte publiquement. Si un attaquant obtient le secret chiffre ET la cle de dechiffrage, il peut generer des codes valides sans l'appareil de l'utilisateur.
- **Fix**: Retirer l'export. Si necessaire pour les tests, conditionner: `if (process.env.NODE_ENV === 'test')` ou le deplacer dans un fichier de test.

**FAILLE-016** [CRITIQUE] SSRF protection incomplete
- **Fichier**: `src/lib/security.ts:180-201`
- **Description**: La liste des IPs bloquees manque: 169.254.x.x (link-local/IMDS Azure), fd00::/8 (IPv6 ULA), fc00::/7, [::ffff:127.0.0.1] (IPv4-mapped IPv6), 0.0.0.0/8, 100.64.0.0/10 (carrier-grade NAT). Un attaquant peut utiliser `http://169.254.169.254/metadata/identity/oauth2/token` pour voler les credentials Azure IMDS.
- **Fix**: Ajouter `/^169\.254\./`, `/^100\.(6[4-9]|[7-9]\d|1[0-2]\d|127)\./`, verifier aussi les representations IPv6, et bloquer les redirections vers ces IPs.

**FAILLE-017** [CRITIQUE] Cookie CSRF httpOnly: false expose au XSS
- **Fichier**: `src/lib/csrf.ts:149`
- **Description**: `httpOnly: false` est necessaire pour que le JS client puisse lire le cookie et l'envoyer dans le header. Mais si une XSS existe (et il n'y a pas de CSP), l'attaquant peut lire le cookie CSRF et forger des requetes.
- **Fix**: Ajouter un Content-Security-Policy strict pour mitiger le risque XSS. Pattern: `default-src 'self'; script-src 'self' 'nonce-xxx'`. Considerer un pattern alternatif (token dans le DOM via server component, lu par le JS).

**FAILLE-018** [CRITIQUE] Double cleanup intervals dans brute-force-protection.ts
- **Fichier**: `src/lib/brute-force-protection.ts:22-31, 245-247`
- **Description**: Deux `setInterval` font le meme nettoyage: ligne 22 (toutes les 10 minutes) et ligne 245 (toutes les 5 minutes). Duplication, gaspillage, et la logique de nettoyage ligne 234-241 a un bug: `lockoutExpired` est vrai si `lockedUntil < now` mais ne verifie pas que la fenetre est aussi expiree, ce qui peut supprimer des entrees prematurement.
- **Fix**: Supprimer un des deux intervals. Unifier la logique de nettoyage.

### HAUTE (32)

**FAILLE-019** [HAUTE] Audit ID utilise Math.random()
- **Fichier**: `src/lib/admin-audit.ts:255`
- **Description**: `Math.random().toString(36).substring(2, 10)` pour generer les IDs d'audit. Math.random() n'est pas cryptographiquement sur -- les IDs sont previsibles et pourraient etre forges.
- **Fix**: Utiliser `crypto.randomBytes(8).toString('hex')` ou `crypto.randomUUID()`.

**FAILLE-020** [HAUTE] Audit logging fire-and-forget peut perdre des entrees
- **Fichier**: `src/lib/admin-audit.ts:175-184` et appels `.catch(() => {})` partout
- **Description**: Tous les appels a `logAdminAction()` dans les routes admin utilisent `.catch(() => {})`. L'audit log peut silencieusement echouer sans que personne ne le sache. Pour la conformite NYDFS, les audit logs sont obligatoires.
- **Fix**: Au minimum logger l'echec dans un fichier/console. Idealement, utiliser une queue (Redis/BullMQ) pour retenter. Ajouter un monitoring/alerte si le taux d'echec depasse un seuil.

**FAILLE-021** [HAUTE] Email en clair dans les logs signIn
- **Fichier**: `src/lib/auth-config.ts:257-265`
- **Description**: `console.log(JSON.stringify({ email: user.email, ... }))` -- l'email complet est logge en clair dans la console. En production Azure, ces logs sont accessibles dans App Service Logs.
- **Fix**: Masquer l'email: `email: maskEmail(user.email)` ou utiliser `maskSensitiveData()` de security.ts.

**FAILLE-022** [HAUTE] Error.message expose en dev dans admin-api-guard
- **Fichier**: `src/lib/admin-api-guard.ts:194-197`
- **Description**: `process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'`. Si NODE_ENV n'est pas correctement set en production Azure (oubli, typo), les messages d'erreur internes seront exposes aux clients.
- **Fix**: Utiliser une verification plus stricte: ne jamais exposer error.message sauf si une variable specifique `DEBUG_ERRORS=true` est explicitement definie.

**FAILLE-023** [HAUTE] Token getToken fallback secret silencieux
- **Fichier**: `src/middleware.ts:192`
- **Description**: `secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET` -- si aucune variable n'est definie, `secret` est `undefined` et getToken peut echouer silencieusement ou accepter n'importe quel token selon la version de next-auth.
- **Fix**: Ajouter une verification au demarrage: si aucun secret n'est defini en production, throw. Ajouter dans le middleware: `if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) { return jsonError('Server misconfigured', 500); }`.

**FAILLE-024** [HAUTE] setOverride ne verifie pas que l'utilisateur cible existe
- **Fichier**: `src/app/api/admin/permissions/route.ts:239-258`
- **Description**: `setOverride` fait un upsert avec le userId fourni sans verifier que l'utilisateur existe. Un admin pourrait creer des overrides pour des IDs inexistants (pollution de donnees) ou pour son propre compte.
- **Fix**: Ajouter `const user = await prisma.user.findUnique({where:{id:userId}})` avant le upsert. Verifier aussi que l'admin ne s'accorde pas des permissions a lui-meme.

**FAILLE-025** [HAUTE] deleteGroup ne verifie pas les utilisateurs assignes
- **Fichier**: `src/app/api/admin/permissions/route.ts:183-195`
- **Description**: `deleteGroup` supprime un groupe sans verifier si des utilisateurs y sont assignes. Cela peut retirer des permissions a des utilisateurs sans avertissement.
- **Fix**: Verifier `_count.users > 0` et demander confirmation, ou au moins loguer les utilisateurs affectes dans l'audit.

**FAILLE-026** [HAUTE] Settings PUT sans validation Zod
- **Fichier**: `src/app/api/admin/settings/route.ts:134-137`
- **Description**: Le body du PUT est destructure directement sans validation Zod: `const { siteSettings: siteSettingsData, settings: keyValueSettings } = body`. Les champs sont filtres par `allowedFields` mais les valeurs ne sont pas validees (type, longueur, format).
- **Fix**: Creer un schema Zod pour valider le body complet du PUT, incluant les types attendus pour chaque champ.

**FAILLE-027** [HAUTE] Settings PATCH accepte n'importe quelle cle
- **Fichier**: `src/app/api/admin/settings/route.ts:276-279`
- **Description**: Le PATCH accepte n'importe quel `key` string sans validation de format ou de whitelist. Un attaquant admin pourrait creer des cles arbitraires dans SiteSetting, potentiellement des feature flags malveillants.
- **Fix**: Ajouter une regex de validation pour les cles (ex: `/^[a-z][a-z0-9_.]{1,100}$/`) et/ou une whitelist de modules autorises.

**FAILLE-028** [HAUTE] stripeCustomerId expose dans la reponse user detail
- **Fichier**: `src/app/api/admin/users/[id]/route.ts:33`
- **Description**: La reponse GET inclut `stripeCustomerId` -- une donnee sensible Stripe qui pourrait etre utilisee pour des actions non autorisees via l'API Stripe.
- **Fix**: Retirer `stripeCustomerId` du select, ou le masquer partiellement: `stripeCustomerId: user.stripeCustomerId ? 'cus_***' + user.stripeCustomerId.slice(-4) : null`.

**FAILLE-029** [HAUTE] CSV export sans sanitization formules Excel
- **Fichier**: `src/app/admin/logs/page.tsx:191-194`
- **Description**: L'export CSV ne sanitize pas les valeurs contre les formules Excel. Un log avec `details: {"cmd": "=CMD(...)"}` pourrait executer des commandes quand l'admin ouvre le CSV dans Excel.
- **Fix**: Prefixer les valeurs commencant par `=`, `+`, `-`, `@`, `\t`, `\r` avec un apostrophe: `v.startsWith('=') ? "'" + v : v`.

**FAILLE-030** [HAUTE] Auto-refresh logs sans jitter
- **Fichier**: `src/app/admin/logs/page.tsx:154`
- **Description**: `setInterval(fetchLogs, 10000)` -- tous les admins connectes fetchent exactement toutes les 10 secondes. Si 10 admins sont connectes, cela cree un "thundering herd" toutes les 10 secondes.
- **Fix**: Ajouter un jitter aleatoire: `setInterval(fetchLogs, 10000 + Math.random() * 2000)`.

**FAILLE-031** [HAUTE] fetchLogs hors useCallback avec deps manquantes
- **Fichier**: `src/app/admin/logs/page.tsx:151-176`
- **Description**: `fetchLogs` est defini apres le useEffect qui l'utilise, et n'est pas dans un useCallback. Le useEffect a `[autoRefresh, levelFilter, searchValue]` comme deps mais ne liste pas fetchLogs, ce qui cause des bugs React (closure stale).
- **Fix**: Wrapper fetchLogs dans useCallback avec les deps appropriees, et l'ajouter au tableau de deps du useEffect.

**FAILLE-032** [HAUTE] Error page auth en anglais hardcode
- **Fichier**: `src/app/auth/error.tsx:20-36`
- **Description**: Tous les textes sont en anglais hardcode: "Authentication Error", "Try again", "Sign in". Viole les regles i18n du projet (22 locales supportees).
- **Fix**: Utiliser `useI18n()` et des cles de traduction: `t('auth.error.title')`, `t('auth.error.description')`, etc.

**FAILLE-033** [HAUTE] console.error expose l'objet error dans auth/error.tsx
- **Fichier**: `src/app/auth/error.tsx:14`
- **Description**: `console.error('Auth error:', error)` -- l'objet Error complet (avec stack trace, message potentiellement sensible) est affiche dans la console du navigateur de l'utilisateur.
- **Fix**: Logger uniquement le digest: `console.error('Auth error:', error.digest)` ou supprimer le log client-side.

**FAILLE-034** [HAUTE] Twitter placeholder email sans verification
- **Fichier**: `src/lib/auth-config.ts:76`
- **Description**: `twitter_${data.id}@noemail.biocyclepeptides.com` -- ce domaine placeholder pourrait etre enregistre par un attaquant. Si un email de verification est envoye a cette adresse, l'attaquant le recevrait.
- **Fix**: Utiliser un domaine invalide RFC: `twitter_${data.id}@invalid.invalid` ou `twitter_${data.id}@noreply.localhost`. Mieux: ne pas generer de placeholder email.

**FAILLE-035** [HAUTE] DEV_FALLBACK_SECRET deterministe pour CSRF
- **Fichier**: `src/lib/csrf.ts:11`
- **Description**: `DEV_FALLBACK_SECRET = 'dev-csrf-secret-not-for-production-use-only'` -- si CSRF_SECRET et NEXTAUTH_SECRET ne sont pas definis, ce secret deterministe est utilise. Un attaquant connaissant ce secret peut forger des tokens CSRF valides.
- **Fix**: En dev, utiliser un secret aleatoire genere au demarrage: `const DEV_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex')`. Ajouter un check au runtime: si production et utilisation du fallback, throw.

**FAILLE-036** [HAUTE] CSRF_SECRET resolve au top-level module load
- **Fichier**: `src/lib/csrf.ts:36`
- **Description**: `const CSRF_SECRET: string = resolveCSRFSecret()` est execute au moment du `import`. Si l'env var n'est pas encore disponible (edge case Azure cold start), le secret sera le fallback dev.
- **Fix**: Lazy resolve: `let _csrfSecret: string | null = null; function getCSRFSecret() { if (!_csrfSecret) _csrfSecret = resolveCSRFSecret(); return _csrfSecret; }`.

**FAILLE-037** [HAUTE] HTML escaping manque le backtick
- **Fichier**: `src/lib/security.ts:146-157`
- **Description**: `escapeHtml()` echappe `& < > " ' /` mais pas le backtick. En JavaScript template literals, un backtick non echappe peut etre utilise pour des injections dans des contextes specifiques.
- **Fix**: Ajouter le backtick au dictionnaire htmlEntities et au regex.

**FAILLE-038** [HAUTE] Cleanup intervals jamais cleared (memory leak server)
- **Fichier**: `src/lib/security.ts:276-284, 334-341`
- **Description**: Les `setInterval` pour le nettoyage des rate limits et CSRF tokens ne sont jamais `clearInterval`. En serverless/edge, cela peut causer des memory leaks ou des comportements inattendus lors du hot-reload.
- **Fix**: Exposer une fonction `cleanup()` qui clear les intervals, et l'appeler dans les tests. Pour Next.js, utiliser un pattern singleton avec cleanup sur `process.on('SIGTERM')`.

**FAILLE-039** [HAUTE] seedPermissions fait des upserts en boucle sans transaction
- **Fichier**: `src/lib/permissions.ts:307-328`
- **Description**: `seedPermissions()` fait un `prisma.permission.upsert()` pour chaque permission (45+) dans une boucle for, sans transaction. Si le serveur crash au milieu, les permissions sont partiellement seedees.
- **Fix**: Wrapper dans `prisma.$transaction()` avec un tableau de upserts.

**FAILLE-040** [HAUTE] findMany sans take dans Settings GET
- **Fichier**: `src/app/api/admin/settings/route.ts:65-66`
- **Description**: `prisma.siteSetting.findMany({ orderBy: [...] })` sans `take`. Si la table contient des milliers d'entrees, toutes sont retournees en une seule requete.
- **Fix**: Ajouter `take: 500` ou implementer une pagination.

**FAILLE-041** [HAUTE] Lockout message revele l'existence du compte
- **Fichier**: `src/lib/brute-force-protection.ts:172-176`
- **Description**: `"Compte temporairement verrouille. Reessayez dans X minute(s)."` -- ce message revele qu'un compte existe pour cet email. Un attaquant peut enumerer les comptes en tentant des logins.
- **Fix**: Utiliser un message generique: `"Identifiants invalides ou compte verrouille."` pour tous les cas d'echec.

**FAILLE-042** [HAUTE] Settings findMany retourne les emails admin dans SiteSettings
- **Fichier**: `src/app/api/admin/settings/route.ts:104-121`
- **Description**: La reponse GET retourne tous les champs SiteSettings incluant `email`, `supportEmail`, `legalEmail`, `privacyEmail`. Ces emails pourraient etre visibles par tout EMPLOYEE (pas seulement OWNER).
- **Fix**: Ajouter une permission granulaire `admin.settings` dans le guard, ou filtrer les champs sensibles selon le role.

**FAILLE-043** [HAUTE] Pas de validation des donnees Zod dans les schemas francais
- **Fichier**: `src/lib/security.ts:97-137`
- **Description**: Les messages d'erreur Zod sont hardcodes en francais: `'Email invalide'`, `'Minimum 2 caracteres'`. Cela viole l'i18n (le site supporte 22 langues) et expose la langue du serveur.
- **Fix**: Utiliser des cles i18n ou des messages neutres retournant des codes d'erreur que le frontend traduit.

**FAILLE-044** [HAUTE] Backup codes MFA non rate-limited separement
- **Fichier**: `src/lib/mfa.ts:97-111`
- **Description**: `verifyBackupCode()` itere sur tous les codes hashes avec bcrypt.compare() sans rate limiting. Un attaquant peut brute-forcer les 10 backup codes (8 hex chars = 4.3 milliards possibilites) via des requetes rapides.
- **Fix**: Ajouter un rate limit specifique sur les tentatives de backup code (max 3 par heure). Apres 3 echecs, forcer un delai ou bloquer.

**FAILLE-045** [HAUTE] clearFailedAttempts n'est pas async coherent
- **Fichier**: `src/lib/brute-force-protection.ts:156-158`
- **Description**: `clearFailedAttempts` est synchrone (Map.delete) mais appele apres une connexion reussie dans auth-config.ts. Si la brute force migre vers Redis/DB (fix FAILLE-005), cette fonction devra devenir async, cassant tous les appelants.
- **Fix**: Declarer `async` des maintenant pour preparer la migration.

**FAILLE-046** [HAUTE] getActiveSessions retourne `expires` comme `createdAt`
- **Fichier**: `src/lib/session-security.ts:210`
- **Description**: `createdAt: session.expires` -- le champ `createdAt` contient la date d'expiration, pas la date de creation. C'est semantiquement incorrect et trompeur pour l'UI admin.
- **Fix**: Utiliser `session.createdAt` si disponible dans le modele Session, ou documenter l'approximation.

**FAILLE-047** [HAUTE] allowDangerousEmailAccountLinking active pour Google
- **Fichier**: `src/lib/auth-config.ts:41`
- **Description**: Bien que documente comme "TRUSTED", `allowDangerousEmailAccountLinking: true` permet le lien automatique d'un compte OAuth a un compte existant par email. Si un attaquant controle un compte Google avec le meme email qu'un admin, il obtient acces au compte admin.
- **Fix**: Considerer desactiver pour les comptes avec role EMPLOYEE/OWNER. Ou exiger une verification supplementaire (MFA) lors du premier lien OAuth.

**FAILLE-048** [HAUTE] Rate limiter Redis KEYS command
- **Fichier**: `src/lib/rate-limiter.ts:460`
- **Description**: `redisClient.keys('rl:*')` dans `getRateLimitStats()` utilise la commande KEYS qui est O(n) et bloque Redis sur les grandes bases. En production avec beaucoup de cles, cela peut causer un timeout.
- **Fix**: Utiliser SCAN avec cursor pour l'iteration, ou maintenir un compteur separe.

**FAILLE-049** [HAUTE] In-memory cleanup tourne meme quand Redis est le backend
- **Fichier**: `src/lib/rate-limiter.ts:411-413`
- **Description**: Le `setInterval(cleanupRateLimitCache, 5 * 60 * 1000)` tourne toujours, meme quand Redis est le backend et que le cache in-memory est vide.
- **Fix**: Conditionner: `if (!redisAvailable) { setInterval(...) }` ou verifier la taille du cache avant le nettoyage.

**FAILLE-050** [HAUTE] Type UserRole defini en doublon
- **Fichier**: `src/lib/permissions.ts:13` vs `src/types/index.ts` (importe dans admin-api-guard.ts:24)
- **Description**: permissions.ts definit `export type UserRole = 'PUBLIC' | 'CUSTOMER' | 'CLIENT' | 'EMPLOYEE' | 'OWNER'` localement, alors que `@/types` exporte aussi un `UserRole`. Si les deux divergent, les comparaisons de roles peuvent echouer silencieusement.
- **Fix**: Supprimer la definition locale dans permissions.ts et importer depuis `@/types`.

### MOYENNE (30)

**FAILLE-051** [MOYENNE] Permission page est 'use client' sans check server-side
- **Fichier**: `src/app/admin/permissions/page.tsx:1`
- **Description**: La page permissions est entierement client-side. Aucune verification server-side des permissions avant le rendu. Un utilisateur non autorise voit un ecran vide ou une erreur API, mais le composant est quand meme telecharge et rendu.
- **Fix**: Ajouter un layout server-side ou un middleware check qui redirige avant le rendu client.

**FAILLE-052** [MOYENNE] Pas de debounce sur les mutations checkbox permissions
- **Fichier**: `src/app/admin/permissions/page.tsx:159-172`
- **Description**: Chaque clic sur un checkbox envoie immediatement un POST. Un admin cliquant rapidement sur 10 checkboxes envoie 10 requetes simultanees, risquant des race conditions sur le rate limit et la DB.
- **Fix**: Ajouter un debounce (300ms) ou batcher les modifications et envoyer un seul POST.

**FAILLE-053** [MOYENNE] MFA non applique aux providers OAuth
- **Fichier**: `src/lib/auth-config.ts:288-291`
- **Description**: Le check MFA dans `signIn` pour les OAuth providers ne force pas la verification MFA: `if (!existingUser || !existingUser.mfaEnabled) { return true; }`. Un utilisateur OWNER avec MFA active peut se connecter via Google OAuth sans code MFA.
- **Fix**: Apres connexion OAuth, si l'utilisateur a MFA active, rediriger vers une page de verification MFA avant d'accorder la session complete.

**FAILLE-054** [MOYENNE] Role JWT mis a jour seulement sur trigger 'update'
- **Fichier**: `src/lib/auth-config.ts:344`
- **Description**: Le role dans le JWT n'est rafraichi que quand `trigger === 'update'`. Si un admin change le role d'un utilisateur en DB, le JWT de l'utilisateur conserve l'ancien role jusqu'a expiration (1h max) ou refresh explicite.
- **Fix**: Ajouter un check periodique: si le token a plus de 5 minutes, re-fetch le role depuis la DB. Utiliser `token.iat` pour calculer l'age.

**FAILLE-055** [MOYENNE] Pas de validation IP dans getClientIp
- **Fichier**: `src/lib/admin-api-guard.ts:65-71` et `src/lib/admin-audit.ts:272-279`
- **Description**: `getClientIp` fait confiance a `x-forwarded-for` sans validation. Un attaquant peut spoofer ce header pour bypasser le rate limiting IP et falsifier les logs d'audit.
- **Fix**: Valider le format IP avec une regex. En Azure App Service, utiliser `x-client-ip` qui est set par le load balancer et ne peut pas etre spoofe.

**FAILLE-056** [MOYENNE] Redis connection non-blocking au module load
- **Fichier**: `src/lib/rate-limiter.ts:112-116`
- **Description**: `getRedisClient().catch(() => {})` au top-level. Le premier appel a `checkRateLimit` peut arriver avant que Redis soit connecte, forcant un fallback in-memory. Le rate limiting est donc inconsistant au demarrage.
- **Fix**: Attendre la connexion Redis dans le premier appel a checkRateLimit, ou utiliser un flag "ready" avant d'accepter des requetes.

**FAILLE-057** [MOYENNE] Pas de validation de longueur sur les parametres searchParams
- **Fichier**: `src/app/api/admin/permissions/route.ts:57-58`
- **Description**: Le search parameter `search` est passe directement a Prisma `contains` sans validation de longueur. Un attaquant pourrait envoyer une string de 1MB.
- **Fix**: Limiter: `const search = (searchParams.get('search') || '').substring(0, 100)`.

**FAILLE-058** [MOYENNE] Audit log creation silently fails avec .catch(() => {})
- **Fichier**: `src/lib/brute-force-protection.ts:121`
- **Description**: `prisma.auditLog.create({...}).catch(() => {})` -- si la table AuditLog n'existe pas ou la DB est down, l'echec de connexion n'est jamais signale.
- **Fix**: Au minimum loguer l'erreur: `.catch((e) => console.error('Audit log failed:', e.message))`.

**FAILLE-059** [MOYENNE] session.user.mfaVerified toujours true
- **Fichier**: `src/lib/auth-config.ts:372`
- **Description**: `session.user.mfaVerified = true; // Si on arrive ici, MFA est verifie` -- cette valeur est toujours true, meme pour les utilisateurs OAuth qui n'ont pas fait de verification MFA. Le commentaire est trompeur.
- **Fix**: Traquer reellement l'etat de verification MFA dans le JWT et le propager.

**FAILLE-060** [MOYENNE] Pas de nettoyage des sessions expirees en DB
- **Fichier**: `src/lib/session-security.ts:303-316`
- **Description**: `cleanupExpiredSessions()` ne nettoie que le cache in-memory. Les sessions expirees dans la table Prisma `Session` ne sont jamais nettoyees.
- **Fix**: Ajouter `prisma.session.deleteMany({ where: { expires: { lt: new Date() } } })` dans un cron job ou dans le cleanup periodique.

**FAILLE-061** [MOYENNE] ADMIN_ROUTE_PERMISSIONS ne couvre pas /admin/logs
- **Fichier**: `src/middleware.ts:46-65`
- **Description**: Le mapping `ADMIN_ROUTE_PERMISSIONS` ne contient pas d'entree pour `/admin/logs`. Tout EMPLOYEE peut acceder aux logs d'audit sans la permission `admin.audit_log`.
- **Fix**: Ajouter `'/admin/logs': 'admin.audit_log'` dans le mapping.

**FAILLE-062** [MOYENNE] Pas de protection contre le self-delete
- **Fichier**: Aucune route admin/users ne protege contre la suppression du propre compte admin
- **Description**: Bien qu'il n'y ait pas de route DELETE pour les utilisateurs dans le fichier audite, si elle est ajoutee, rien n'empeche un OWNER de se supprimer lui-meme.
- **Fix**: Ajouter un check: `if (targetId === session.user.id) return jsonError('Cannot modify own account', 403)` pour les actions destructives.

**FAILLE-063** [MOYENNE] Logging IP avec x-forwarded-for non sanitize
- **Fichier**: `src/middleware.ts:131`
- **Description**: `request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()` est logge directement. Un attaquant peut injecter du contenu arbitraire dans le header x-forwarded-for qui se retrouve dans les logs (log injection).
- **Fix**: Valider que la valeur extraite est une IP valide avant de la loguer.

**FAILLE-064** [MOYENNE] User-Agent tronque a 100 caracteres dans le log
- **Fichier**: `src/middleware.ts:130`
- **Description**: `userAgent: request.headers.get('user-agent')?.substring(0, 100)` -- la troncation a 100 caracteres peut couper des informations utiles pour la detection d'anomalies.
- **Fix**: Augmenter a 256 caracteres ou hasher le UA pour la comparaison.

**FAILLE-065** [MOYENNE] Pas de mecanisme de refresh du token CSRF expire
- **Fichier**: `src/lib/csrf.ts:39` et `src/app/admin/permissions/page.tsx`
- **Description**: Le token CSRF expire apres 1h (`TOKEN_EXPIRY_MS = 3600000`). Si un admin laisse la page ouverte plus d'une heure sans refresh, toutes les mutations echoueront 403 sans message clair.
- **Fix**: Ajouter un refresh automatique du token CSRF avant chaque mutation, ou un interceptor qui detecte le 403 CSRF et re-fetch le token.

**FAILLE-066** [MOYENNE] Pas de Content-Length limit sur les body JSON
- **Fichier**: `src/app/api/admin/settings/route.ts`, `src/app/api/admin/permissions/route.ts`
- **Description**: Les routes admin acceptent `request.json()` sans limite de taille. Un attaquant admin pourrait envoyer un body de 100MB.
- **Fix**: Verifier `request.headers.get('content-length')` et rejeter si > 1MB. Ou configurer dans next.config.js: `api: { bodyParser: { sizeLimit: '1mb' } }`.

**FAILLE-067** [MOYENNE] Pas de retry mechanism pour les queries Prisma
- **Fichier**: Toutes les routes API admin
- **Description**: Les queries Prisma n'ont pas de retry en cas d'erreur transitoire (connection pool exhausted, timeout). Un pic de trafic peut causer des erreurs 500 cascadees.
- **Fix**: Configurer les retries dans le PrismaClient ou wrapper les queries critiques dans un retry loop avec backoff.

**FAILLE-068** [MOYENNE] JSON.stringify(log.details) dans le filtre de recherche
- **Fichier**: `src/app/admin/logs/page.tsx:229`
- **Description**: `JSON.stringify(log.details).toLowerCase().includes(search)` -- stringifier l'objet details pour chaque log a chaque frappe de recherche est inefficace (O(n*m) ou m est la taille des details).
- **Fix**: Pre-calculer la string de recherche lors du fetch et stocker dans un champ indexable.

**FAILLE-069** [MOYENNE] APP_NAME hardcode pour TOTP
- **Fichier**: `src/lib/mfa.ts:17`
- **Description**: `APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'SecureApp'` -- si NEXT_PUBLIC_APP_NAME n'est pas defini, le QR code affichera "SecureApp" dans Google Authenticator, confondant l'utilisateur.
- **Fix**: Definir NEXT_PUBLIC_APP_NAME='BioCycle Peptides' dans les env vars. Ajouter une verification: si undefined, utiliser le nom du site depuis SiteSettings.

**FAILLE-070** [MOYENNE] Audit log details column est un TEXT non structure
- **Fichier**: `src/lib/admin-audit.ts:8` et Prisma model
- **Description**: Le champ `details` est un `JSON.stringify()` stocke comme TEXT. Pas de validation de structure, pas d'indexation possible, pas de requete par contenu.
- **Fix**: Utiliser le type JSON natif PostgreSQL si disponible, ou creer des colonnes dediees pour les champs frequemment queries (previousValue, newValue).

**FAILLE-071** [MOYENNE] Pas de pagination dans l'export CSV logs
- **Fichier**: `src/app/admin/logs/page.tsx:182-201`
- **Description**: L'export CSV exporte tous les logs charges en memoire. Si le fetch retourne 10000 logs, le navigateur peut planter lors de la generation du CSV.
- **Fix**: Limiter l'export a 1000 entrees, ou implementer un export server-side avec streaming.

**FAILLE-072** [MOYENNE] Pas de timeout sur les requetes Prisma
- **Fichier**: Toutes les routes admin
- **Description**: Les queries Prisma n'ont pas de timeout explicite. Une requete lente (full table scan, deadlock) peut bloquer le worker indefiniment.
- **Fix**: Configurer `queryTimeout` dans PrismaClient ou wrapper avec `Promise.race([query, timeout])`.

**FAILLE-073** [MOYENNE] maskSensitiveData ne detecte pas les patterns imbriques
- **Fichier**: `src/lib/security.ts:211-242`
- **Description**: `maskSensitiveData` ne traite que le premier niveau d'objet. Les champs sensibles dans des objets imbriques ne sont pas masques. En revanche, `sanitizeForLog` dans admin-audit.ts est recursif.
- **Fix**: Rendre `maskSensitiveData` recursif comme `sanitizeForLog`, ou unifier les deux fonctions.

**FAILLE-074** [MOYENNE] console.error dans auth events peut crash silencieusement
- **Fichier**: `src/lib/auth-config.ts:416-418, 437-439, 449-451, 461-463`
- **Description**: Chaque event handler a un try/catch qui fait `console.error(...)`. Si le console.error lui-meme echoue (edge cases), l'erreur est perdue.
- **Fix**: Utiliser le `logger` importe au lieu de console.error pour une gestion coherente.

**FAILLE-075** [MOYENNE] Pas de validation de l'email dans le callback signIn OAuth
- **Fichier**: `src/lib/auth-config.ts:279`
- **Description**: `await prisma.user.findUnique({ where: { email: user.email! } })` -- `user.email!` utilise le non-null assertion. Si l'email est null (possible avec certains providers OAuth), cela va chercher un utilisateur avec email=null.
- **Fix**: Ajouter `if (!user.email) return false;` avant la requete DB.

**FAILLE-076** [MOYENNE] Pas de protection CSRF sur le GET settings seed
- **Fichier**: `src/app/api/admin/permissions/route.ts:16-19`
- **Description**: La route GET auto-seed les permissions si `count === 0`. Un GET ne devrait jamais modifier l'etat (violation REST). Un attaquant pourrait forcer un re-seed en supprimant les permissions.
- **Fix**: Deplacer le seed dans un endpoint POST dedie ou un script CLI.

**FAILLE-077** [MOYENNE] Regex nom trop permissif
- **Fichier**: `src/lib/security.ts:122`
- **Description**: Le regex pour la validation de nom autorise les caracteres accentues mais certaines combinaisons inattendues pourraient passer. Le range Unicode pourrait inclure des caracteres non-lettres selon l'encodage.
- **Fix**: Utiliser une classe Unicode: `/^[\p{L}\s'-]+$/u` pour accepter toutes les lettres Unicode.

**FAILLE-078** [MOYENNE] Rate limit key inclut le pathname complet
- **Fichier**: `src/lib/admin-api-guard.ts:150`
- **Description**: `const rateLimitKey = 'admin:${ip}:${pathname}'` -- le pathname inclut les IDs dynamiques. Chaque URL differente (ex: `/api/admin/users/abc123`) a son propre bucket de rate limit. Un attaquant peut contourner en variant les IDs.
- **Fix**: Normaliser le pathname: remplacer les segments dynamiques par des placeholders: `/api/admin/users/[id]`.

**FAILLE-079** [MOYENNE] Pas de logging des actions CSRF echouees dans le middleware
- **Fichier**: `src/lib/csrf.ts:115-137`
- **Description**: `verifyCSRFMiddleware` retourne `{ valid: false }` mais ne logue pas l'echec. Les tentatives de CSRF ne sont pas tracees.
- **Fix**: Ajouter un log de securite quand la validation CSRF echoue: `console.warn(createSecurityLog('warn', 'csrf_failed', { path, method }))`.

**FAILLE-080** [MOYENNE] Options preflight caches 86400s sans invalidation
- **Fichier**: `src/middleware.ts:146`
- **Description**: `Access-Control-Max-Age: 86400` (24h). Si les headers CORS sont changes, les navigateurs continueront a utiliser l'ancien cache pendant 24h.
- **Fix**: Reduire a 3600 (1h) en dev, garder 86400 en production. Ajouter un commentaire expliquant le tradeoff.

### BASSE (20)

**FAILLE-081** [BASSE] Sampling rate logs a 10% en production
- **Fichier**: `src/middleware.ts:119`
- **Description**: `Math.random() < 0.1` -- seulement 10% des requetes sont loguees en production. Les 90% restantes sont silencieuses, rendant difficile le debugging et la detection d'anomalies.
- **Fix**: Logger 100% des requetes mais en mode "summary" (pas de details). Utiliser un service de logging structure (Azure Monitor, Datadog) avec echantillonnage configurable.

**FAILLE-082** [BASSE] Pas de verification de schema au demarrage
- **Fichier**: Aucun fichier
- **Description**: L'application ne verifie pas au demarrage que le schema Prisma correspond a la DB. Un deploy avec schema drift cause des erreurs 500 a l'execution.
- **Fix**: Ajouter un health check au demarrage: `prisma.$queryRaw'SELECT 1'` et verifier que les tables critiques existent.

**FAILLE-083** [BASSE] createSecurityLog retourne une string, pas un objet
- **Fichier**: `src/lib/security.ts:247-260`
- **Description**: `createSecurityLog()` retourne `JSON.stringify(logEntry)` -- une string. Les appelants font `console.log(createSecurityLog(...))` qui double-stringifie si la console fait aussi un stringify.
- **Fix**: Retourner l'objet et laisser les appelants choisir le format.

**FAILLE-084** [BASSE] Pas de test de la fonction decrypt en cas de cle corrompue
- **Fichier**: `src/lib/security.ts:58-88`
- **Description**: Si les donnees base64 sont corrompues (taille incorrecte, caracteres invalides), le code peut throw une erreur non descriptive au subarray().
- **Fix**: Ajouter une verification de la longueur minimale du buffer avant le slicing: `if (combined.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) throw new Error('Invalid encrypted data')`.

**FAILLE-085** [BASSE] AuthType any utilise pour les providers
- **Fichier**: `src/lib/auth-config.ts:19`
- **Description**: `type AuthProvider = any` -- desactive completement le type checking pour les providers.
- **Fix**: Utiliser le type correct de next-auth: `import type { Provider } from 'next-auth/providers'`.

**FAILLE-086** [BASSE] Cookie session-token name ne matche pas le default Next-Auth
- **Fichier**: `src/lib/auth-config.ts:237` et `src/middleware.ts:194`
- **Description**: Le cookie est force a `authjs.session-token` au lieu du defaut avec prefix `__Secure-`. Cela est documente comme fix Azure, mais si Azure est mis a jour pour supporter HTTPS end-to-end, le cookie sera moins securise que necessaire.
- **Fix**: Ajouter un TODO pour revoir quand Azure supporte HTTPS E2E. Documenter le risque dans le code.

**FAILLE-087** [BASSE] Pas de monitoring des setInterval actifs
- **Fichier**: `src/lib/security.ts:276, 334`, `src/lib/brute-force-protection.ts:22, 245`, `src/lib/session-security.ts:314`, `src/lib/rate-limiter.ts:411`
- **Description**: 6+ setInterval dans differents modules, aucun n'est track. Impossible de savoir combien sont actifs, combien sont dupliques.
- **Fix**: Creer un registre central des timers: `export const timers = new Map<string, NodeJS.Timeout>()`.

**FAILLE-088** [BASSE] Pas de type discriminant pour les actions POST permissions
- **Fichier**: `src/app/api/admin/permissions/route.ts:86-96`
- **Description**: Le switch sur `action` est fait avec des `if` en cascade au lieu d'un discriminated union TypeScript propre. Le type `validatedData` necessite des casts `as Extract<...>` partout.
- **Fix**: Utiliser un switch/case sur action apres le parse Zod, avec le type discrimine naturellement.

**FAILLE-089** [BASSE] Pas de helmet/next-secure-headers
- **Fichier**: Aucun fichier
- **Description**: Le projet n'utilise pas de package comme `next-secure-headers` ou equivalent pour gerer les headers de securite de maniere centralisee.
- **Fix**: Installer et configurer `next-secure-headers` ou ajouter les headers dans next.config.js via `headers()`.

**FAILLE-090** [BASSE] Email masking inconsistant entre les modules
- **Fichier**: `src/lib/security.ts:236-239` vs `src/lib/admin-audit.ts:78-93`
- **Description**: security.ts masque les emails (`ab***@domain.com`), admin-audit.ts redacte les champs sensibles. Pas de standard unifie pour le masking.
- **Fix**: Creer une fonction utilitaire partagee `maskPII()` utilisee partout.

**FAILLE-091** [BASSE] Prisma adapter cast as any
- **Fichier**: `src/lib/auth-config.ts:201`
- **Description**: `adapter: encryptedAdapter as any` -- desactive le type checking pour l'adapter. Si la signature change dans une mise a jour de next-auth, l'erreur ne sera pas detectee au build.
- **Fix**: Typer correctement l'adapter ou utiliser `satisfies` pour une verification partielle.

**FAILLE-092** [BASSE] Pas de logging structure pour les events signOut
- **Fichier**: `src/lib/auth-config.ts:452-463`
- **Description**: L'event signOut logue l'userId extrait du token, mais pas l'IP ni le user-agent. Difficile de tracer les deconnexions suspectes.
- **Fix**: Ajouter l'IP et le UA au log de signOut.

**FAILLE-093** [BASSE] phone schema ne supporte pas les formats locaux
- **Fichier**: `src/lib/security.ts:128-130`
- **Description**: Le regex n'accepte que le format E.164 strict. Les utilisateurs entrant un numero local (ex: 0612345678) seront rejetes.
- **Fix**: Accepter les formats locaux et les normaliser en E.164 avec une librairie comme `libphonenumber-js`.

**FAILLE-094** [BASSE] SiteSettings create sans validation des defaults
- **Fichier**: `src/app/api/admin/settings/route.ts:59-61`
- **Description**: `prisma.siteSettings.create({ data: { id: 'default' } })` cree un enregistrement avec tous les champs a null/default. Les champs obligatoires (companyName, email, etc.) ne sont pas initialises.
- **Fix**: Fournir des valeurs par defaut sensees ou afficher un wizard de configuration au premier acces.

**FAILLE-095** [BASSE] parseSafe retourne unknown
- **Fichier**: `src/app/api/admin/settings/route.ts:95-101`
- **Description**: `parseSafe(val: string | null): unknown` -- le type de retour est `unknown`, ce qui perd l'information de type. Les consommateurs doivent caster.
- **Fix**: Utiliser un generic: `parseSafe<T>(val: string | null): T | string | null`.

**FAILLE-096** [BASSE] No rate limit specifique pour la recherche utilisateurs
- **Fichier**: `src/app/api/admin/permissions/route.ts:57-78`
- **Description**: La recherche utilisateurs (tab=users) utilise le rate limit general admin (60/min read) mais pourrait etre abusee pour enumerer tous les utilisateurs du systeme.
- **Fix**: Ajouter un rate limit specifique plus strict pour la recherche utilisateurs (10/min).

**FAILLE-097** [BASSE] Prisma queries incluent des relations inutiles
- **Fichier**: `src/app/api/admin/permissions/route.ts:33`
- **Description**: `include: { users: true }` dans la query groups retourne tous les users de chaque groupe, alors que seul `_count.users` est utilise dans le frontend.
- **Fix**: Retirer `users: true` de l'include, garder seulement `_count: { select: { users: true } }`.

**FAILLE-098** [BASSE] Pas de cache pour les parametres SiteSettings
- **Fichier**: `src/app/api/admin/settings/route.ts:54-67`
- **Description**: Chaque GET re-fetch les SiteSettings + tous les SiteSetting depuis la DB. Pour un panneau admin avec 5 onglets, cela fait 5 queries identiques.
- **Fix**: Ajouter un cache en memoire avec TTL 30s, invalide sur PUT/PATCH.

**FAILLE-099** [BASSE] requestId fallback utilise Math.random()
- **Fichier**: `src/middleware.ts:16-20`
- **Description**: Le fallback UUID utilise `Math.random()` qui n'est pas cryptographiquement sur. Pour un ID de correlation/tracing, ce n'est pas grave, mais c'est une mauvaise pratique.
- **Fix**: Utiliser `crypto.getRandomValues()` disponible dans le edge runtime: `crypto.getRandomValues(new Uint8Array(16))`.

**FAILLE-100** [BASSE] debug: true en developpement dans NextAuth
- **Fichier**: `src/lib/auth-config.ts:466`
- **Description**: `debug: process.env.NODE_ENV === 'development'` active les logs debug de NextAuth. Si NODE_ENV est accidentellement 'development' en production, des informations sensibles seront loguees.
- **Fix**: Utiliser une variable dediee: `debug: process.env.AUTH_DEBUG === 'true'`.

---

## AMELIORATIONS (100)

### CRITIQUE (12)

**AMELIORATION-001** [CRITIQUE] Integrer session-security.ts dans le flow de production
- **Fichier**: `src/lib/session-security.ts`, `src/middleware.ts`, `src/lib/auth-config.ts`
- **Description**: Activer les 316 lignes de code mort: timeout inactivite, timeout absolu, detection anomalies, rotation tokens, limitation sessions concurrentes.
- **Implementation**: 1) Dans middleware.ts, appeler `recordUserActivity(token.jti)` pour chaque requete authentifiee. 2) Appeler `isSessionValid(token.jti)` et rediriger vers /auth/signin si invalide. 3) Dans auth-config signIn callback, appeler `enforceMaxSessions(user.id)`. 4) Migrer les stores in-memory vers Redis.

**AMELIORATION-002** [CRITIQUE] Ajouter les security headers HTTP
- **Fichier**: `src/middleware.ts`
- **Description**: Ajouter tous les headers de securite manquants.
- **Implementation**: Creer une fonction `addSecurityHeaders(response)` qui ajoute: CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control: off.

**AMELIORATION-003** [CRITIQUE] Ajouter la permission granulaire au guard admin
- **Fichier**: `src/lib/admin-api-guard.ts`
- **Description**: Le guard doit verifier les permissions granulaires, pas seulement le role.
- **Implementation**: Ajouter `requiredPermission?: PermissionCode` aux options. Si present, appeler `hasPermission(session.user.id, session.user.role, requiredPermission)`. Mettre a jour toutes les routes: settings -> 'admin.settings', permissions -> 'users.manage_permissions', users -> 'users.edit'.

**AMELIORATION-004** [CRITIQUE] Migrer le brute force vers Redis/DB
- **Fichier**: `src/lib/brute-force-protection.ts`
- **Description**: Remplacer le Map in-memory par un store persistant.
- **Implementation**: Utiliser Redis si disponible (comme rate-limiter.ts), sinon compter les entries AuditLog: `SELECT COUNT(*) FROM "AuditLog" WHERE action='FAILED_LOGIN' AND "entityId"=$email AND "createdAt" > NOW() - INTERVAL '15 minutes'`.

**AMELIORATION-005** [CRITIQUE] Unifier les implementations CSRF
- **Fichier**: `src/lib/csrf.ts`, `src/lib/security.ts`
- **Description**: Supprimer le CSRF in-memory de security.ts, standardiser sur csrf.ts.
- **Implementation**: 1) Supprimer les lignes 325-378 de security.ts. 2) Grep tous les imports de `generateCsrfToken`/`validateCsrfToken` depuis security.ts. 3) Les remplacer par les equivalents de csrf.ts. 4) Creer un hook `useCSRF()` pour le frontend.

**AMELIORATION-006** [CRITIQUE] Ajouter CSRF a toutes les requetes admin frontend
- **Fichier**: `src/app/admin/permissions/page.tsx` et toutes les pages admin
- **Description**: Toutes les mutations doivent envoyer le header x-csrf-token.
- **Implementation**: Creer un hook `useAdminFetch()` qui wrap fetch avec le CSRF header automatique. Remplacer tous les `fetch('/api/admin/...')` par `adminFetch('/api/admin/...')`.

**AMELIORATION-007** [CRITIQUE] Proteger l'escalade de privilege dans la gestion des roles
- **Fichier**: `src/app/api/admin/users/[id]/route.ts`
- **Description**: Seul un OWNER peut promouvoir quelqu'un en OWNER.
- **Implementation**: Ajouter dans le PATCH: `if (data.role === 'OWNER' && session.user.role !== 'OWNER') return jsonError('Only OWNER can promote to OWNER', 403)`. Ajouter aussi: `if (id === session.user.id) return jsonError('Cannot change own role', 403)`.

**AMELIORATION-008** [CRITIQUE] Unifier les sources de EMPLOYEE_PERMISSIONS
- **Fichier**: `src/middleware.ts`, `src/lib/permissions.ts`
- **Description**: Une seule source de verite pour les permissions par role.
- **Implementation**: Exporter `ROLE_DEFAULTS` de permissions.ts. Dans le middleware, importer et construire le Set: `const EMPLOYEE_PERMISSIONS = new Set(ROLE_DEFAULTS.EMPLOYEE)`. Si edge runtime incompatible, creer un script de build qui genere le fichier.

**AMELIORATION-009** [CRITIQUE] Migrer le rate limiting admin vers Redis
- **Fichier**: `src/lib/admin-api-guard.ts`
- **Description**: Utiliser rate-limiter.ts (Redis-backed) au lieu de security.ts (in-memory).
- **Implementation**: Changer l'import: `import { checkRateLimit } from '@/lib/rate-limiter'`. Adapter l'appel: `const rateResult = await checkRateLimit(ip, pathname)`. Mettre a jour la signature du handler pour etre async.

**AMELIORATION-010** [CRITIQUE] Corriger le MFA fallback au secret brut
- **Fichier**: `src/lib/auth-config.ts:141-147`
- **Description**: Ne jamais fallback au secret brut en cas d'echec de decryptage.
- **Implementation**: Remplacer `catch { mfaSecret = user.mfaSecret! }` par `catch (e) { console.error('MFA decryption failed, blocking login', e.message); return null; }`.

**AMELIORATION-011** [CRITIQUE] Ajouter la protection Azure IMDS dans sanitizeUrl
- **Fichier**: `src/lib/security.ts:180-201`
- **Description**: Bloquer l'acces au service de metadata Azure.
- **Implementation**: Ajouter `/^169\.254\./` et `'169.254.169.254'` a la liste des IPs bloquees. Ajouter aussi `/^100\.(6[4-9]|[7-9]\d|1[0-2]\d|127)\./`, `/^198\.51\.100\./`, `/^203\.0\.113\./`.

**AMELIORATION-012** [CRITIQUE] Ajouter x-csrf-token aux headers CORS
- **Fichier**: `src/middleware.ts:145, 155`
- **Description**: Permettre l'envoi du header CSRF en cross-origin.
- **Implementation**: Changer `'Content-Type, Authorization, x-idempotency-key, x-request-id'` en `'Content-Type, Authorization, x-idempotency-key, x-request-id, x-csrf-token'`.

### HAUTE (33)

**AMELIORATION-013** [HAUTE] Ajouter un LRU cache pour les permissions
- **Fichier**: `src/lib/permissions.ts:248`
- **Implementation**: Installer `lru-cache` et remplacer le Map par: `const permissionCache = new LRUCache<string, {permissions: Set<PermissionCode>, timestamp: number}>({ max: 500 })`.

**AMELIORATION-014** [HAUTE] Wrapper updateGroup dans une transaction Prisma
- **Fichier**: `src/app/api/admin/permissions/route.ts:150-168`
- **Implementation**: `await prisma.$transaction(async (tx) => { await tx.permissionGroupPermission.deleteMany({where:{groupId}}); ... })`.

**AMELIORATION-015** [HAUTE] Ajouter Zod validation au settings PUT/PATCH
- **Fichier**: `src/app/api/admin/settings/route.ts`
- **Implementation**: Creer `src/lib/validations/settings.ts` avec un schema Zod pour le body PUT (siteSettings fields types + keyValueSettings array schema).

**AMELIORATION-016** [HAUTE] Retirer stripeCustomerId de la reponse GET user
- **Fichier**: `src/app/api/admin/users/[id]/route.ts:33`
- **Implementation**: Retirer `stripeCustomerId: true` du select, ou masquer: `stripeCustomerId: user.stripeCustomerId ? '***' + user.stripeCustomerId.slice(-4) : null`.

**AMELIORATION-017** [HAUTE] Sanitizer les exports CSV contre les formules
- **Fichier**: `src/app/admin/logs/page.tsx:191`
- **Implementation**: Creer une fonction `sanitizeCSVValue()` qui prefixe les valeurs dangereuses avec un apostrophe.

**AMELIORATION-018** [HAUTE] Remplacer Math.random() dans generateAuditId
- **Fichier**: `src/lib/admin-audit.ts:253-257`
- **Implementation**: `import { randomBytes } from 'crypto'; const random = randomBytes(8).toString('hex');`.

**AMELIORATION-019** [HAUTE] Masquer les emails dans les logs signIn
- **Fichier**: `src/lib/auth-config.ts:257-265, 409-415, 430-435`
- **Implementation**: Creer `function maskEmail(email: string)` et l'utiliser dans tous les logs.

**AMELIORATION-020** [HAUTE] Ajouter le mapping /admin/logs dans ADMIN_ROUTE_PERMISSIONS
- **Fichier**: `src/middleware.ts:46-65`
- **Implementation**: Ajouter `'/admin/logs': 'admin.audit_log'` au mapping.

**AMELIORATION-021** [HAUTE] Rendre fetchLogs stable avec useCallback
- **Fichier**: `src/app/admin/logs/page.tsx:160-176`
- **Implementation**: Wrapper fetchLogs dans useCallback et l'ajouter aux deps du useEffect.

**AMELIORATION-022** [HAUTE] Internationaliser auth/error.tsx
- **Fichier**: `src/app/auth/error.tsx`
- **Implementation**: Importer `useI18n`, remplacer tous les textes hardcodes par `t(...)`.

**AMELIORATION-023** [HAUTE] Ajouter jitter au auto-refresh des logs
- **Fichier**: `src/app/admin/logs/page.tsx:154`
- **Implementation**: `setInterval(fetchLogs, 10000 + Math.floor(Math.random() * 3000))`.

**AMELIORATION-024** [HAUTE] Verifier l'existence de l'utilisateur dans setOverride
- **Fichier**: `src/app/api/admin/permissions/route.ts:239-258`
- **Implementation**: Ajouter `findUnique` avant le upsert.

**AMELIORATION-025** [HAUTE] Ajouter un check deleteGroup pour les utilisateurs assignes
- **Fichier**: `src/app/api/admin/permissions/route.ts:183-195`
- **Implementation**: Compter les utilisateurs avant la suppression et retourner 409 si > 0.

**AMELIORATION-026** [HAUTE] Wrapper seedPermissions dans une transaction
- **Fichier**: `src/lib/permissions.ts:307-328`
- **Implementation**: `await prisma.$transaction(allCodes.map(code => prisma.permission.upsert(...)))`.

**AMELIORATION-027** [HAUTE] Ajouter take au findMany Settings
- **Fichier**: `src/app/api/admin/settings/route.ts:65`
- **Implementation**: `prisma.siteSetting.findMany({ ..., take: 500 })`.

**AMELIORATION-028** [HAUTE] Utiliser un message generique pour le lockout
- **Fichier**: `src/lib/brute-force-protection.ts:172-176`
- **Implementation**: Message unique pour echec et lockout.

**AMELIORATION-029** [HAUTE] Supprimer le double cleanup interval dans brute-force
- **Fichier**: `src/lib/brute-force-protection.ts:22-31, 245-247`
- **Implementation**: Garder un seul interval.

**AMELIORATION-030** [HAUTE] Rendre generateCurrentTOTP non-exportable
- **Fichier**: `src/lib/mfa.ts:59-61`
- **Implementation**: Retirer `export` ou conditionner sur NODE_ENV.

**AMELIORATION-031** [HAUTE] Completer la SSRF protection pour Azure IMDS
- **Fichier**: `src/lib/security.ts:186-196`
- **Implementation**: Ajouter 169.254.x.x, 100.64.0.0/10, IPv6 link-local.

**AMELIORATION-032** [HAUTE] Creer un hook useAdminFetch centralise
- **Fichier**: Nouveau `src/hooks/useAdminFetch.ts`
- **Implementation**: Hook avec CSRF automatique, error handling, rate limit retry.

**AMELIORATION-033** [HAUTE] Ajouter un Content-Security-Policy
- **Fichier**: `src/middleware.ts` ou `next.config.ts`
- **Implementation**: CSP minimum: `default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://api.stripe.com;`.

**AMELIORATION-034** [HAUTE] Ajouter backtick a l'echappement HTML
- **Fichier**: `src/lib/security.ts:146-157`
- **Implementation**: Ajouter le backtick au dictionnaire et au regex.

**AMELIORATION-035** [HAUTE] Lazy resolve CSRF secret
- **Fichier**: `src/lib/csrf.ts:36`
- **Implementation**: Remplacer la constante par une fonction lazy.

**AMELIORATION-036** [HAUTE] Normaliser le rate limit key admin
- **Fichier**: `src/lib/admin-api-guard.ts:150`
- **Implementation**: Remplacer les segments dynamiques par `[id]`.

**AMELIORATION-037** [HAUTE] Ajouter la notification email de lockout
- **Fichier**: `src/lib/brute-force-protection.ts:135-139`
- **Implementation**: Creer `sendAccountLockedNotification()` dans email.ts.

**AMELIORATION-038** [HAUTE] Verifier la hierarchie des roles dans le PATCH user
- **Fichier**: `src/app/api/admin/users/[id]/route.ts:261`
- **Implementation**: Definir ROLE_HIERARCHY et verifier avant changement.

**AMELIORATION-039** [HAUTE] Ajouter un monitoring des audit log failures
- **Fichier**: `src/lib/admin-audit.ts:175-184`
- **Implementation**: Compteur d'echecs avec alerte apres seuil.

**AMELIORATION-040** [HAUTE] Ajouter validation IP sur x-forwarded-for
- **Fichier**: `src/lib/admin-api-guard.ts:65-71`
- **Implementation**: Regex de validation IP dans getClientIp.

**AMELIORATION-041** [HAUTE] Remplacer le type UserRole local par l'import @/types
- **Fichier**: `src/lib/permissions.ts:13`
- **Implementation**: Supprimer la definition locale et importer depuis `@/types`.

**AMELIORATION-042** [HAUTE] Ajouter un debounce aux checkbox mutations permissions
- **Fichier**: `src/app/admin/permissions/page.tsx:159-172`
- **Implementation**: Batcher les modifications avec un debounce de 500ms.

**AMELIORATION-043** [HAUTE] Ajouter un test de decryption au demarrage
- **Fichier**: `src/lib/security.ts`
- **Implementation**: Fonction `verifyEncryptionKey()` qui encrypt/decrypt une valeur test.

**AMELIORATION-044** [HAUTE] Utiliser SCAN au lieu de KEYS dans rate-limiter stats
- **Fichier**: `src/lib/rate-limiter.ts:460`
- **Implementation**: Remplacer `KEYS` par `SCAN` iteratif.

**AMELIORATION-045** [HAUTE] Ajouter un rate limit pour les backup codes MFA
- **Fichier**: `src/lib/mfa.ts:97-111`
- **Implementation**: Max 3 tentatives de backup code par heure.

### MOYENNE (35)

**AMELIORATION-046** [MOYENNE] Creer un health endpoint pour les composants securite
- **Implementation**: `/api/health/security` retournant l'etat de Redis, brute force, rate limit, CSRF, permissions cache.

**AMELIORATION-047** [MOYENNE] Ajouter des metriques de performance aux queries admin
- **Implementation**: Header `X-Response-Time` sur chaque reponse admin.

**AMELIORATION-048** [MOYENNE] Implementer le auto-refresh CSRF token
- **Implementation**: Composant `CSRFProvider` qui refresh le cookie toutes les 45 minutes.

**AMELIORATION-049** [MOYENNE] Ajouter la verification MFA pour les actions sensibles
- **Implementation**: Exiger un code MFA pour changement de role, permission management.

**AMELIORATION-050** [MOYENNE] Implementer la rotation automatique du JWT
- **Implementation**: Re-fetch role si token > 15 minutes.

**AMELIORATION-051** [MOYENNE] Ajouter un middleware de Content-Length limit
- **Implementation**: Rejeter les requetes > 1MB.

**AMELIORATION-052** [MOYENNE] Implementer un export CSV server-side
- **Implementation**: Endpoint streaming avec sanitization des formules.

**AMELIORATION-053** [MOYENNE] Ajouter un nettoyage periodique des sessions DB expirees
- **Implementation**: `prisma.session.deleteMany({ where: { expires: { lt: new Date() } } })` toutes les heures.

**AMELIORATION-054** [MOYENNE] Implementer le refresh du role JWT
- **Implementation**: Check periodique base sur `token.iat`.

**AMELIORATION-055** [MOYENNE] Utiliser des cles i18n pour les messages Zod
- **Implementation**: Retourner des codes d'erreur au lieu de messages en francais.

**AMELIORATION-056** [MOYENNE] Ajouter une page de deconnexion forcee
- **Implementation**: Bouton admin "Deconnecter toutes les sessions" pour un utilisateur.

**AMELIORATION-057** [MOYENNE] Implementer un registre central des timers
- **Implementation**: `src/lib/timer-registry.ts` avec Map de tous les setInterval.

**AMELIORATION-058** [MOYENNE] Ajouter des tests unitaires pour les fonctions securite
- **Implementation**: Tests pour encrypt/decrypt, escapeHtml, sanitizeUrl, checkRateLimit.

**AMELIORATION-059** [MOYENNE] Ajouter un cache Redis pour les permissions
- **Implementation**: Cache Redis avec TTL 60s pour les permissions resolues.

**AMELIORATION-060** [MOYENNE] Implementer la rotation des cles de chiffrement
- **Implementation**: Supporter ENCRYPTION_KEY_CURRENT et ENCRYPTION_KEY_PREVIOUS.

**AMELIORATION-061** [MOYENNE] Ajouter des alertes email pour les events securite critiques
- **Implementation**: Email sur: brute force lockout, changement de role, desactivation MFA.

**AMELIORATION-062** [MOYENNE] Implementer le feature flags system
- **Implementation**: `/api/feature-flags` endpoint avec cache 60s et hook client.

**AMELIORATION-063** [MOYENNE] Ajouter la pagination a la recherche utilisateurs
- **Implementation**: Parametres skip/take avec total count.

**AMELIORATION-064** [MOYENNE] Implementer le password history
- **Implementation**: Nouveau modele Prisma PasswordHistory, verification lors du changement.

**AMELIORATION-065** [MOYENNE] Ajouter un audit trail pour les changements de permissions
- **Implementation**: `logAdminAction()` dans toutes les mutations de permissions.

**AMELIORATION-066** [MOYENNE] Implementer le IP whitelisting pour les admins
- **Implementation**: Liste d'IPs autorisees dans SiteSettings, verification dans admin-api-guard.

**AMELIORATION-067** [MOYENNE] Ajouter un mecanisme de grace period pour MFA
- **Implementation**: 48h pour configurer MFA apres creation compte EMPLOYEE/OWNER.

**AMELIORATION-068** [MOYENNE] Implementer la verification d'email pour credentials
- **Implementation**: Email de verification obligatoire avant premiere connexion.

**AMELIORATION-069** [MOYENNE] Ajouter un rate limit distinct pour mutations vs lectures admin
- **Implementation**: `admin/read: 200/min`, `admin/write: 30/min`.

**AMELIORATION-070** [MOYENNE] Creer un composant ErrorBoundary admin dedie
- **Implementation**: `src/app/admin/error.tsx` avec logging, message i18n, retry.

**AMELIORATION-071** [MOYENNE] Ajouter un webhook pour les events securite
- **Implementation**: Webhooks vers SIEM pour login, role change, MFA toggle, lockout.

**AMELIORATION-072** [MOYENNE] Implementer le CAPTCHA apres N echecs de connexion
- **Implementation**: reCAPTCHA v3 ou hCaptcha apres 2 echecs (avant lockout a 3).

**AMELIORATION-073** [MOYENNE] Ajouter la geoIP detection pour les sessions
- **Implementation**: MaxMind GeoLite2 ou Cloudflare headers pour detection pays.

**AMELIORATION-074** [MOYENNE] Implementer les permission groups expirables
- **Implementation**: Champ `expiresAt DateTime?` sur UserPermissionGroup.

**AMELIORATION-075** [MOYENNE] Ajouter un systeme de revue des permissions periodique
- **Implementation**: Rapport mensuel des permissions atypiques.

**AMELIORATION-076** [MOYENNE] Implementer le pre-fetch des permissions dans le middleware
- **Implementation**: Pre-fetch permission en middleware, stocker dans header x-permission-result.

**AMELIORATION-077** [MOYENNE] Ajouter la validation DNS du domaine placeholder Twitter
- **Implementation**: Utiliser `.invalid` TLD (RFC 6761).

**AMELIORATION-078** [MOYENNE] Creer un dashboard de monitoring securite
- **Implementation**: Page admin affichant: echecs connexion, lockouts, anomalies, rate limits.

**AMELIORATION-079** [MOYENNE] Implementer la suppression de compte conforme RGPD
- **Implementation**: Endpoint de demande avec delai 30 jours + anonymisation.

**AMELIORATION-080** [MOYENNE] Ajouter des metriques de latence Redis
- **Implementation**: Mesurer temps de chaque appel Redis, loguer les lents (>100ms).

### BASSE (20)

**AMELIORATION-081** [BASSE] Documenter les decisions de securite dans le code
- **Implementation**: Commentaires detailles sur les choix (httpOnly:false, cookie prefix, linking).

**AMELIORATION-082** [BASSE] Ajouter un script de verification des secrets
- **Implementation**: `scripts/check-secrets.ts` verifiant tous les secrets requis.

**AMELIORATION-083** [BASSE] Utiliser crypto.getRandomValues dans le fallback UUID
- **Implementation**: Remplacer Math.random() par crypto.getRandomValues() dans middleware.ts.

**AMELIORATION-084** [BASSE] Ajouter un type Provider correct au lieu de any
- **Implementation**: `import type { Provider } from 'next-auth/providers'`.

**AMELIORATION-085** [BASSE] Typer correctement l'encrypted adapter
- **Implementation**: Utiliser `satisfies` au lieu de `as any`.

**AMELIORATION-086** [BASSE] Utiliser le logger structure partout
- **Implementation**: Remplacer console.log/console.error par le logger existant.

**AMELIORATION-087** [BASSE] Ajouter un test E2E pour le flow MFA
- **Implementation**: Test Playwright: activer MFA, reconnecter avec TOTP, tester backup code.

**AMELIORATION-088** [BASSE] Ajouter des commentaires JSDoc aux fonctions securite
- **Implementation**: JSDoc avec @throws, @example, @security.

**AMELIORATION-089** [BASSE] Configurer next-secure-headers
- **Implementation**: Config `headers()` dans next.config.ts.

**AMELIORATION-090** [BASSE] Ajouter le logging du signOut avec IP et UA
- **Implementation**: Extraire IP/UA du contexte token/session dans l'event signOut.

**AMELIORATION-091** [BASSE] Utiliser libphonenumber pour la validation telephone
- **Implementation**: Installer `libphonenumber-js`, valider et normaliser en E.164.

**AMELIORATION-092** [BASSE] Ajouter des defaults sensees a SiteSettings
- **Implementation**: companyName: 'BioCycle Peptides', defaultCurrency: 'USD', etc.

**AMELIORATION-093** [BASSE] Ajouter un parseSafe type
- **Implementation**: `function parseSafe<T = unknown>(val: string | null): T | string | null`.

**AMELIORATION-094** [BASSE] Ajouter un rate limit specifique pour la recherche utilisateurs
- **Implementation**: `'admin/users-search': { windowMs: 60000, maxRequests: 20 }`.

**AMELIORATION-095** [BASSE] Retirer l'include users inutile dans la query groups
- **Implementation**: Garder seulement `_count: { select: { users: true } }`.

**AMELIORATION-096** [BASSE] Ajouter un cache pour les SiteSettings GET
- **Implementation**: Cache in-memory TTL 30s, invalide sur PUT/PATCH.

**AMELIORATION-097** [BASSE] Conditionner le cleanup in-memory quand Redis est le backend
- **Implementation**: `if (!redisAvailable) { setInterval(cleanupRateLimitCache, ...) }`.

**AMELIORATION-098** [BASSE] Utiliser AUTH_DEBUG au lieu de NODE_ENV pour le debug NextAuth
- **Implementation**: `debug: process.env.AUTH_DEBUG === 'true'`.

**AMELIORATION-099** [BASSE] Ajouter une verification de la taille du body
- **Implementation**: `if (contentLength > 1048576) return jsonError('Payload too large', 413)`.

**AMELIORATION-100** [BASSE] Documenter le placeholder domain Twitter comme risque accepte
- **Implementation**: Commentaire dans le code avec reference a AMELIORATION-077.

---

## FICHIERS AUDITES (30+)

| Fichier | Lignes | Failles | Ameliorations |
|---------|--------|---------|---------------|
| `src/middleware.ts` | 309 | 8 | 6 |
| `src/lib/admin-api-guard.ts` | 202 | 5 | 5 |
| `src/lib/auth-config.ts` | 500 | 12 | 10 |
| `src/lib/permissions.ts` | 329 | 5 | 6 |
| `src/lib/security.ts` | 378 | 8 | 7 |
| `src/lib/csrf.ts` | 210 | 4 | 3 |
| `src/lib/brute-force-protection.ts` | 248 | 5 | 4 |
| `src/lib/mfa.ts` | 263 | 3 | 3 |
| `src/lib/session-security.ts` | 316 | 3 | 3 |
| `src/lib/rate-limiter.ts` | 512 | 3 | 4 |
| `src/lib/admin-audit.ts` | 280 | 3 | 2 |
| `src/app/admin/permissions/page.tsx` | 661 | 4 | 3 |
| `src/app/api/admin/permissions/route.ts` | 315 | 5 | 4 |
| `src/app/api/admin/settings/route.ts` | 316 | 4 | 4 |
| `src/app/api/admin/users/[id]/route.ts` | 293 | 2 | 3 |
| `src/app/admin/logs/page.tsx` | 427 | 4 | 4 |
| `src/app/auth/error.tsx` | 41 | 2 | 1 |

**Total lignes auditees**: ~5,150 lignes
**Densite de failles**: ~1 faille pour 51 lignes
**Score de securite estime**: 45/100 (de nombreux mecanismes existent mais ne sont pas integres)

---

## FIN DE L'AUDIT

Le systeme de securite de peptide-plus possede de nombreux composants bien concus individuellement (CSRF double-submit, rate limiting Redis-backed, MFA TOTP, audit logging, permission resolution engine, session security NYDFS), mais souffre de problemes d'integration critiques:

1. **Code mort**: session-security.ts (316 lignes) n'est appele nulle part
2. **Implementations dupliquees**: 2 CSRF, 2 rate limiters, 2 listes EMPLOYEE_PERMISSIONS
3. **Frontend deconnecte du backend**: les pages admin n'envoient pas les tokens CSRF
4. **Granularite manquante**: le guard admin verifie le role mais pas les permissions
5. **Persistance fragile**: brute force, rate limiting admin, CSRF tokens -- tout in-memory

La priorite absolue est de: (1) integrer session-security.ts, (2) unifier les implementations dupliquees, (3) ajouter les headers de securite HTTP, (4) connecter le CSRF frontend au backend, (5) migrer les stores in-memory vers Redis/DB.

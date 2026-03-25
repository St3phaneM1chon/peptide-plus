# Audit: Small Services (audit-trail, open-badges, xapi-service) — 18 Findings

## audit-trail.ts

### logAudit() (line 9-44)

#### P1: details cast unsafe — line 36
**Code**: `details: (params.details ?? undefined) as unknown as undefined`
**Description**: Le double cast `as unknown as undefined` est un hack pour contourner le type Prisma Json. Si details contient des fonctions ou des references circulaires, JSON.stringify implicite de Prisma crashera silencieusement.
**Fix**: `details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined`

#### P2: catch vide — line 41-43
**Description**: Toute erreur dans logAudit est avalee. Si la DB est down, on perd l'audit trail silencieusement. Pour un systeme de compliance, c'est risque.
**Fix**: Logger l'erreur au minimum: `catch (e) { console.error('[audit-trail] Failed to log', params.action, e); }`

#### P2: IP spoofing via x-forwarded-for — line 23
**Description**: `x-forwarded-for` peut etre forge par le client. Sans validation au niveau reverse proxy, l'IP est non fiable.
**Fix**: Documenter que le reverse proxy (Railway/Cloudflare) doit etre configure pour sanitiser x-forwarded-for.

#### P3: headers() async import — line 7
**Description**: `headers` de `next/headers` est importe au top-level mais n'est disponible que dans les Server Components. Si appele depuis un contexte client ou middleware, ca crash.
**Fix**: Le try/catch existant (line 21-27) gere ce cas, mais ajouter un commentaire explicite.

### getAuditLogs() (line 49-89)

#### P2: count query sans filtre date — line 78-85
**Description**: La query `count` ne filtre pas par `from`/`to` comme la query principale. Le total retourne inclut TOUS les logs meme si on filtre par date.
**Fix**: Ajouter le meme filtre `createdAt` dans la query count.

#### P3: Pas de validation du limit max — line 58
**Description**: `limit = 50` par defaut mais pas de max. Un appelant pourrait demander `limit=100000`.
**Fix**: `const limit = Math.min(options?.limit ?? 50, 500);`

---

## open-badges.ts

### generateBadgeClass() (line 41-66)

#### P2: XSS dans badge.name et badge.description — line 53-56
**Description**: Les valeurs `badge.name` et `badge.description` sont injectees directement dans le JSON-LD sans echappement. Si elles contiennent du HTML/JS, un consommateur du badge JSON pourrait etre vulnerable.
**Fix**: Echapper les valeurs HTML: `name: escapeHtml(badge.name)`

#### P3: SITE_URL au top-level — line 7
**Description**: `process.env.NEXT_PUBLIC_BASE_URL` est lu au module load time. Si la variable change (hot reload), la valeur est stale.
**Fix**: Lire la variable a l'interieur de chaque fonction, ou utiliser un getter.

### generateBadgeAssertion() (line 81-117)

#### P1: Email recipient non hashed — line 94-97
**Description**: `hashed: false` expose l'email du destinataire en clair dans le JSON-LD public. Violation de vie privee.
**Fix**: Hasher l'email: `identity: sha256(params.recipientEmail), hashed: true`

#### P3: Pas de validation de l'email — line 93
**Description**: `recipientEmail` pourrait etre vide ou invalide. Le badge serait emis avec un recipient vide.
**Fix**: Valider avec z.string().email() avant de generer.

### generateLinkedInShareUrl() (line 122-140)

#### P2: URL injection — line 133
**Description**: `certUrl` est injecte directement dans l'URL sans validation. Un attaquant pourrait injecter un lien malveillant.
**Fix**: Valider que certUrl commence par SITE_URL: `if (!params.certUrl.startsWith(SITE_URL)) throw new Error('Invalid cert URL');`

---

## xapi-service.ts

### recordStatement() (line 27-64)

#### P2: Pas de validation du verb — line 54
**Description**: Le verb est un string libre. Si un verb invalide est passe, le statement est stocke mais ne sera pas reconnu par un LRS externe.
**Fix**: Valider que le verb existe dans XAPI_VERBS: `if (!Object.keys(XAPI_VERBS).includes(params.verb)) throw new Error('Invalid xAPI verb');`

#### P2: JSON.parse(JSON.stringify()) — line 58-59
**Description**: Double serialisation pour convertir en Prisma Json. Si result/context contient des Dates, elles seront converties en strings.
**Fix**: Acceptable pour le moment mais documenter le comportement.

### queryStatements() (line 68-90)

#### P3: Pas de limit max — line 78
**Description**: `limit = 50` par defaut mais pas de max. Query sans garde.
**Fix**: `const limit = Math.min(options?.limit ?? 50, 1000);`

### exportStatements() (line 95-120)

#### P2: Hardcoded limit 1000 — line 102
**Description**: L'export est limite a 1000 statements. Pour un tenant avec 50K+ statements, l'export est incomplet sans pagination.
**Fix**: Ajouter pagination ou streaming.

#### P1: Pas de filtre tenant dans l'export — line 100-102
**Description**: Le filtre `tenantId` est present mais si l'appelant passe un tenantId errone, il peut exporter les donnees d'un autre tenant.
**Fix**: Valider que le tenantId correspond a l'utilisateur connecte (au niveau de la route API, pas du service).

#### P3: XAPI_VERBS lookup peut retourner undefined — line 107
**Description**: `XAPI_VERBS[s.verb as keyof typeof XAPI_VERBS]` — si le verb n'est pas dans la map, on obtient undefined, et le display sera `undefined`.
**Fix**: Fallback: `XAPI_VERBS[s.verb as keyof typeof XAPI_VERBS] ?? s.verb`

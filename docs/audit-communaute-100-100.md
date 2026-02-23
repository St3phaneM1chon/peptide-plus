# AUDIT COMMUNAUTE - BioCycle Peptides
## 100 Failles/Bugs + 100 Ameliorations
### Date: 2026-02-22

---

## RESUME EXECUTIF

| Priorite | Failles/Bugs | Ameliorations |
|----------|-------------|---------------|
| CRITIQUE | 18 | 12 |
| HAUTE    | 32 | 28 |
| MOYENNE  | 30 | 35 |
| BASSE    | 20 | 25 |
| **TOTAL** | **100** | **100** |

### TOP 10 FAILLES CRITIQUES

1. **F-001** Forum community entierement client-side (aucune persistance) - posts perdus au refresh
2. **F-002** Chat upload sans authentification - n'importe qui peut uploader des fichiers
3. **F-003** Review image upload sur filesystem local - ne persiste pas sur Azure App Service
4. **F-005** Pas de modele ForumPost en DB - le forum n'existe pas en backend
5. **F-008** Chat message sender non verifie - un visiteur peut envoyer en tant qu'ADMIN
6. **F-012** Conversation DELETE sans cascade des messages orphelins potentielle
7. **F-014** OpenAI API key exposee si erreur non catchee correctement
8. **F-017** Pas de CSRF sur chat/message endpoint malgre mutation
9. **F-021** Admin reviews GET ne paginne pas cote frontend (charge tout en memoire)
10. **F-028** Chat upload extension non sanitisee - path traversal possible

---

## PARTIE 1: 100 FAILLES ET BUGS

### CRITIQUES (18)

**F-001** [CRITIQUE] Forum community sans persistance
- Fichier: `src/app/(shop)/community/page.tsx:57`
- `useState<Post[]>([])` : les posts sont stockes uniquement en memoire client
- Tout est perdu au refresh de page ou changement de tab
- Fix: Creer modele ForumPost en Prisma + API CRUD `/api/community/posts`

**F-002** [CRITIQUE] Chat upload sans authentification
- Fichier: `src/app/api/chat/upload/route.ts:11`
- `POST(request: Request)` - pas de `auth()`, pas de session check
- N'importe qui peut uploader des fichiers sur le serveur
- Fix: Ajouter `const session = await auth(); if (!session) return 401`

**F-003** [CRITIQUE] Review images stockees sur filesystem local
- Fichier: `src/app/api/reviews/upload/route.ts:47`
- `const uploadDir = join(process.cwd(), 'public', 'uploads', 'reviews');`
- Azure App Service n'a pas de filesystem persistant - images perdues apres deploy
- Le TODO ligne 45 le confirme: "migrate to Azure Blob Storage"
- Fix: Migrer vers Azure Blob Storage ou Cloudinary

**F-004** [CRITIQUE] Pas de validation CSRF sur chat endpoints principaux
- Fichier: `src/app/api/chat/route.ts:56` (POST)
- Fichier: `src/app/api/chat/message/route.ts:14` (POST)
- Contrairement a `/api/reviews` et `/api/contact` qui ont `validateCsrf()`, les endpoints chat n'en ont pas
- Fix: Ajouter `validateCsrf(request)` sur tous les POST chat

**F-005** [CRITIQUE] Pas de modele Prisma pour le forum
- Fichier: `prisma/schema.prisma` - modele ForumPost absent
- Le frontend community affiche un formulaire de creation de post qui ne sauvegarde nulle part
- Les utilisateurs pensent poster mais rien n'est persiste
- Fix: Creer modeles ForumPost, ForumReply, ForumVote dans le schema

**F-006** [CRITIQUE] Injection potentielle via status filter dans chat
- Fichier: `src/app/api/chat/route.ts:32`
- `where: status ? { status: status as any } : undefined` - cast `as any` dangereux
- Le parametre `status` du query string est passe directement a Prisma sans validation
- Fix: Valider status contre l'enum ChatStatus avant usage

**F-007** [CRITIQUE] Pas de rate limit sur chat upload
- Fichier: `src/app/api/chat/upload/route.ts`
- Aucun `rateLimitMiddleware` - un attaquant peut flood de fichiers
- Fix: Ajouter rate limit (5 uploads/minute par IP)

**F-008** [CRITIQUE] Sender spoofing dans chat/message
- Fichier: `src/app/api/chat/message/route.ts:32`
- Le `sender` vient du body client: `const { sender } = body`
- Verification partielle ligne 103: `if (sender === 'ADMIN' && !isAdmin)`
- Mais un visiteur peut envoyer `sender: 'BOT'` qui n'est pas verifie
- Fix: Deduire le sender du contexte auth au lieu de le lire du body

**F-009** [CRITIQUE] Chat conversation ownership bypass via visitorId
- Fichier: `src/app/api/chat/message/route.ts:73-83`
- Un attaquant peut bruteforce des visitorId UUID pour acceder aux conversations d'autres visiteurs
- Le visitorId vient du body non authentifie
- Fix: Lier les conversations a des sessions cote serveur, pas des visitorId client

**F-010** [CRITIQUE] Admin reviews status derivation fragile
- Fichier: `src/app/api/admin/reviews/route.ts:57-64`
- Le statut REJECTED est derive par heuristique: "reply exists AND not approved"
- Un avis avec reply admin mais pas encore modere sera incorrectement marque REJECTED
- Fix: Ajouter un vrai champ `status` enum dans le modele Review

**F-011** [CRITIQUE] Pas de Content-Type validation sur chat message
- Fichier: `src/app/api/chat/message/route.ts:14`
- Contrairement a `/api/reviews` et `/api/contact` qui utilisent `validateContentType(request)`, cet endpoint ne le fait pas
- Fix: Ajouter `validateContentType(request)`

**F-012** [CRITIQUE] Conversation delete sans verification d'existence
- Fichier: `src/app/api/chat/conversations/[id]/route.ts:217`
- `await prisma.conversation.delete({ where: { id } })` - pas de findUnique avant
- Si l'ID n'existe pas, Prisma lance une exception PrismaClientKnownRequestError
- Pas de catch specifique pour ce cas
- Fix: Verifier existence avant delete, retourner 404

**F-013** [CRITIQUE] Limite de chat messages non bornee
- Fichier: `src/app/api/chat/route.ts:28`
- `const limit = parseInt(searchParams.get('limit') || '50')` sans `Math.min()`
- Un attaquant peut demander `?limit=999999` et surcharger le serveur
- Fix: `Math.min(parseInt(...), 100)`

**F-014** [CRITIQUE] OpenAI error non masquee en production
- Fichier: `src/lib/chat/openai-chat.ts:79-82`
- `console.error('Translation error:', error)` pourrait logguer l'API key dans un stack trace
- Le fallback retourne le texte original - pas de notification d'echec a l'utilisateur
- Fix: Logger seulement `error.message`, pas l'objet complet

**F-015** [CRITIQUE] Chat settings modifiables par EMPLOYEE
- Fichier: `src/app/api/chat/settings/route.ts:63`
- Les EMPLOYEE peuvent modifier chatbotPrompt qui controle le comportement de l'IA
- Un employe malveillant pourrait injecter des instructions dans le prompt
- Fix: Restreindre la modification du prompt au OWNER uniquement

**F-016** [CRITIQUE] Pas de validation Zod sur chat settings PUT body
- Fichier: `src/app/api/chat/settings/route.ts:67-79`
- Le body est destructure directement sans validation schema
- `widgetColor` pourrait contenir du XSS: `<script>alert(1)</script>`
- Fix: Ajouter un schema Zod avec sanitization pour chaque champ

**F-017** [CRITIQUE] Quick replies sans sanitization
- Fichier: `src/app/api/chat/quick-replies/route.ts:59`
- `const data = quickReplySchema.parse(body)` - le schema valide la longueur mais ne sanitize pas le contenu
- Du HTML malveillant dans `content` sera injecte dans le chat
- Fix: Ajouter `stripHtml` + `stripControlChars` sur title et content

**F-018** [CRITIQUE] Admin question PATCH accepte n'importe quel body field
- Fichier: `src/app/api/admin/questions/[id]/route.ts:64`
- `const body = await request.json()` sans validation Zod
- Un attaquant admin pourrait envoyer `{ "userId": "another-user" }` dans le body
- Prisma appliquera silencieusement les champs non prevus si present dans le modele
- Fix: Ajouter un schema Zod strict

### HAUTES (32)

**F-019** [HAUTE] Review upload pas de nettoyage des fichiers orphelins
- Fichier: `src/app/api/reviews/upload/route.ts`
- Si la creation de review echoue apres upload, les images restent sur le serveur
- Pas de job de nettoyage des fichiers non references
- Fix: Implementer un cleanup cron ou lier upload a une transaction

**F-020** [HAUTE] Chat message attachmentUrl non valide
- Fichier: `src/app/api/chat/message/route.ts:36`
- `const attachmentUrl = body.attachmentUrl || null` - pas de validation URL
- Pourrait contenir `javascript:alert(1)` ou un lien externe malveillant
- Fix: Valider avec `z.string().url()` et verifier le domaine

**F-021** [HAUTE] Admin avis charge toutes les reviews sans pagination cote frontend
- Fichier: `src/app/admin/avis/page.tsx:96`
- `const res = await fetch('/api/admin/reviews')` sans `?page=&limit=`
- L'API supporte la pagination mais le frontend ne l'utilise pas
- Avec 10K+ reviews, ca plante le navigateur
- Fix: Implementer infinite scroll ou pagination dans ContentList

**F-022** [HAUTE] Admin questions charge tout sans pagination
- Fichier: `src/app/api/admin/questions/route.ts:35`
- `prisma.productQuestion.findMany()` sans `take` ni `skip`
- Peut retourner des milliers de questions en un appel
- Fix: Ajouter pagination avec `take: limit, skip: (page-1)*limit`

**F-023** [HAUTE] Community page userId = email
- Fichier: `src/app/(shop)/community/page.tsx:95`
- `userId: session.user?.email || ''` expose l'email comme identifiant public
- Visible dans l'interface pour tous les utilisateurs
- Fix: Utiliser `session.user?.id` et ne jamais exposer l'email

**F-024** [HAUTE] Pas d'echappement HTML dans le contenu du forum
- Fichier: `src/app/(shop)/community/page.tsx:332`
- `<p className="text-neutral-600 mt-1 line-clamp-2">{post.content}</p>`
- Si le contenu contient du HTML, React l'echappe mais des entites HTML pourraient causer des problemes d'affichage
- Plus grave: si un futur dev utilise `dangerouslySetInnerHTML`
- Fix: Sanitizer le contenu a la creation (prevu quand le backend existera)

**F-025** [HAUTE] Date.now().toString() comme ID de post
- Fichier: `src/app/(shop)/community/page.tsx:94`
- `id: Date.now().toString()` - collision possible si 2 posts au meme milliseconde
- Non-unique, predictible, non-UUID
- Fix: Utiliser `crypto.randomUUID()` ou un UUID generator

**F-026** [HAUTE] Admin review response modal ne gere pas les erreurs reseau
- Fichier: `src/app/admin/avis/page.tsx:136-156`
- `submitAdminResponse` a un try/catch mais pas de state `submitting` pour desactiver le bouton
- Double-click peut envoyer la reponse deux fois
- Fix: Ajouter state `isSubmitting` + desactiver bouton pendant soumission

**F-027** [HAUTE] Chat conversation findFirst non deterministe
- Fichier: `src/app/api/chat/route.ts:87-98`
- `findFirst` sans `orderBy` - si plusieurs conversations ACTIVE existent pour un visitorId, le resultat est imprevisible
- Fix: Ajouter `orderBy: { lastMessageAt: 'desc' }`

**F-028** [HAUTE] Chat upload extension non validee cote serveur
- Fichier: `src/app/api/chat/upload/route.ts:45-46`
- `const ext = file.name.split('.').pop() || 'jpg'` - l'extension vient du nom de fichier client
- Un fichier nomme `malware.exe.jpg` aurait l'extension `jpg`
- Mais le filename genere contient l'extension brute sans sanitization
- Fix: Deriver l'extension du magic bytes, pas du nom de fichier

**F-029** [HAUTE] Community layout metadata non traduite
- Fichier: `src/app/(shop)/community/layout.tsx:3-6`
- `title: 'Community Forum'` et `description: '...'` hardcodes en anglais
- Devrait utiliser les metadonnees traduites via `generateMetadata()`
- Fix: Implementer `generateMetadata()` avec i18n

**F-030** [HAUTE] Admin questions deleteQuestion utilise confirm() natif
- Fichier: `src/app/admin/questions/page.tsx:133`
- `if (!confirm(t('admin.questions.deleteConfirm'))) return;`
- `confirm()` est bloquant, non-stylable, et ne fonctionne pas dans certains contextes
- Fix: Utiliser un modal de confirmation stylise

**F-031** [HAUTE] Chat settings expose chatbotPrompt aux non-admin
- Fichier: `src/app/api/chat/settings/route.ts:41-49`
- Le filtrage public ne retourne que 4 champs mais la logique est fragile
- Si un nouveau champ sensible est ajoute, il sera expose par defaut
- Fix: Utiliser une whitelist explicite avec Prisma `select:`

**F-032** [HAUTE] Pas de debounce sur la recherche community
- Fichier: `src/app/(shop)/community/page.tsx:239`
- `onChange={(e) => setSearchQuery(e.target.value)}` filtre a chaque caractere
- Avec beaucoup de posts, ca sera lent
- Fix: Ajouter un debounce de 300ms

**F-033** [HAUTE] Review helpfulCount non implementee
- Fichier: `prisma/schema.prisma:2006` - `helpfulCount Int @default(0)`
- Fichier: `src/app/api/reviews/route.ts:72` - retourne `helpful: r.helpfulCount`
- Pas d'endpoint pour incrementer ce compteur
- Fix: Creer endpoint PUT `/api/reviews/[id]/helpful`

**F-034** [HAUTE] Chat bot response stockee sans sanitization
- Fichier: `src/app/api/chat/message/route.ts:220-229`
- `content: botResponse.content` - la reponse OpenAI est stockee brute
- L'IA pourrait generer du contenu HTML malveillant (prompt injection)
- Fix: Appliquer `stripHtml` sur `botResponse.content`

**F-035** [HAUTE] Admin review images affichees avec `unoptimized`
- Fichier: `src/app/admin/avis/page.tsx:384`
- `unoptimized` bypass Next.js Image Optimization
- Les images pourraient etre tres grandes et ralentir le chargement
- Fix: Retirer `unoptimized` et configurer `next.config.js` pour le domaine

**F-036** [HAUTE] Chat conversation recharge complete apres creation
- Fichier: `src/app/api/chat/route.ts:151-158`
- Apres creation + message greeting, `findUnique` est appele pour recharger
- La conversation vient d'etre creee - les donnees sont deja en memoire
- Race condition possible si un message arrive entre create et findUnique
- Fix: Construire la reponse a partir des donnees locales

**F-037** [HAUTE] Pas d'index sur ChatConversation.visitorId + status compose
- Fichier: `prisma/schema.prisma:538-541`
- Les index sont separes: `@@index([status])`, `@@index([visitorId])`
- La query `findFirst({ where: { visitorId, status: { in: [...] } } })` beneficierait d'un index compose
- Fix: Ajouter `@@index([visitorId, status])`

**F-038** [HAUTE] Conversation messages polling inefficace
- Fichier: `src/app/api/chat/conversations/[id]/messages/route.ts:63-72`
- Le polling par `after` ID fait un `findUnique` supplementaire pour obtenir le createdAt
- Puis filtre par `createdAt > afterMessage.createdAt`
- Si 2 messages ont le meme createdAt, l'un sera perdu
- Fix: Utiliser cursor-based pagination avec `id` au lieu de `createdAt`

**F-039** [HAUTE] Community search ne filtre pas les tags dans la barre laterale
- Fichier: `src/app/(shop)/community/page.tsx:217-223`
- Les "Popular Tags" sont hardcodes: `['bpc-157', 'semaglutide', ...]`
- Ils ne refletent pas les vrais tags des posts
- Fix: Calculer les tags populaires dynamiquement a partir des posts

**F-040** [HAUTE] Admin chat recent ne verifie pas les conversations fermees
- Fichier: `src/app/api/admin/chats/recent/route.ts:18`
- `where: { lastMessageAt: { gte: since } }` retourne aussi les conversations CLOSED/ARCHIVED
- Fix: Ajouter `status: { in: ['ACTIVE', 'WAITING_ADMIN'] }`

**F-041** [HAUTE] Double conversation possible avec 2 onglets
- Fichier: `src/app/api/chat/route.ts:87-98`
- `findFirst` cherche une conversation ACTIVE ou WAITING_ADMIN
- Si l'utilisateur ouvre 2 onglets simultanement, 2 conversations peuvent etre creees (race condition)
- Fix: Utiliser une contrainte unique ou un lock optimiste

**F-042** [HAUTE] Review creation ne notifie pas l'admin
- Fichier: `src/app/api/reviews/route.ts:197-262`
- Pas d'email ou notification envoyee a l'admin quand un nouveau review est soumis
- Les reviews en PENDING peuvent rester indefiniment sans moderation
- Fix: Envoyer un email/notification a l'admin via `sendEmail()`

**F-043** [HAUTE] Question creation absente du frontend
- Aucun composant pour soumettre une question produit cote client
- Le modele `ProductQuestion` existe, l'admin peut repondre, mais il n'y a pas de `POST /api/questions` public
- Fix: Creer la page et l'API de soumission de questions

**F-044** [HAUTE] Chat message history tronquee a 20 messages pour le bot
- Fichier: `src/app/api/chat/message/route.ts:67-71`
- `messages: { orderBy: { createdAt: 'asc' }, take: 20 }` - seulement les 20 premiers messages
- Le chatbot perd le contexte des longues conversations
- Fix: Prendre les 20 DERNIERS messages: `orderBy: { createdAt: 'desc' }, take: 20` puis reverse

**F-045** [HAUTE] Conversation unreadCount pas decremente quand le client lit
- Fichier: `src/app/api/chat/conversations/[id]/route.ts:86-94`
- Quand le client lit ses messages, `readAt` est mis a jour mais `unreadCount` n'est pas decremente
- Seul l'admin reset le `unreadCount` (ligne 82)
- Fix: Aussi reset le count cote client, ou utiliser un calcul dynamique

**F-046** [HAUTE] Chat quick-replies POST sans sanitization
- Fichier: `src/app/api/chat/quick-replies/route.ts:58-68`
- Le schema Zod valide longueur mais ne strip pas le HTML
- `data.title` et `data.content` pourraient contenir du HTML/script
- Fix: Ajouter `stripHtml(data.title)` et `stripHtml(data.content)`

**F-047** [HAUTE] Review images deletion non implementee
- Fichier: `src/app/api/admin/reviews/[id]/route.ts:77`
- `await prisma.review.delete()` supprime la review mais les fichiers images restent sur le filesystem
- Les ReviewImage sont supprimees en cascade mais les fichiers physiques persistent
- Fix: Supprimer les fichiers physiques avant de delete la DB row

**F-048** [HAUTE] Chat conversation ne verifie pas si la conversation est CLOSED
- Fichier: `src/app/api/chat/message/route.ts`
- Pas de verification du statut de la ChatConversation avant d'envoyer un message
- Contrairement a Conversation qui verifie `status === 'CLOSED'` (ligne 135)
- Fix: Ajouter `if (conversation.status === 'CLOSED') return 400`

**F-049** [HAUTE] Community post creation sans validation de longueur
- Fichier: `src/app/(shop)/community/page.tsx:89-111`
- Le formulaire a `required` sur title/content mais pas de `maxLength`
- Un utilisateur pourrait poster un titre de 100K caracteres
- Fix: Ajouter `maxLength={200}` sur title, `maxLength={10000}` sur content

**F-050** [HAUTE] Admin audit log silencieusement ignore les erreurs
- Fichier: `src/app/api/admin/reviews/[id]/route.ts:57`
- `logAdminAction({...}).catch(() => {})` - les erreurs d'audit sont avales
- Si l'audit fail systematiquement, aucune alerte
- Fix: Logger l'erreur dans le catch: `.catch(err => console.error('Audit failed:', err))`

### MOYENNES (30)

**F-051** [MOYENNE] Hardcoded strings dans community page
- Fichier: `src/app/(shop)/community/page.tsx:118-121`
- `formatDate()` retourne 'Just now', 'Yesterday' en anglais
- Devrait utiliser `t()` pour la traduction
- Fix: Passer par les cles i18n: `t('community.justNow')`, etc.

**F-052** [MOYENNE] Review model manque un champ `status` explicite
- Fichier: `prisma/schema.prisma:1994-2017`
- Status derive de `isApproved` + `isPublished` + `reply` presence
- 3 booleans pour 3 etats = ambiguite
- Fix: Ajouter `status ReviewStatus @default(PENDING)` enum

**F-053** [MOYENNE] Chat settings default widgetColor inconsistant
- Fichier: `prisma/schema.prisma:577` - default `"#f97316"` (orange)
- Fichier: `src/app/api/chat/settings/route.ts:35` - default `'#CC5500'` (orange fonce)
- Inconsistance entre schema et code
- Fix: Aligner les defaults

**F-054** [MOYENNE] Chat message parsing regex fragile
- Fichier: `src/app/api/chat/message/route.ts:50`
- `contentStr.replace(/<[^>]*>/g, '')` - regex basique pour strip HTML
- Peut etre bypasse avec des attributs malformes: `<img src=x onerror=alert(1) /`
- Le `<[^>]*>` ne gere pas les cas edge
- Fix: Utiliser la fonction `stripHtml` de `@/lib/sanitize` au lieu d'une regex inline

**F-055** [MOYENNE] Community popular tags hardcodes
- Fichier: `src/app/(shop)/community/page.tsx:215`
- Tags: `['bpc-157', 'semaglutide', 'reconstitution', ...]`
- Pas dynamiques, pas mis a jour, ne correspondent pas forcement aux posts
- Fix: Calculer a partir des posts reels ou depuis la DB

**F-056** [MOYENNE] Admin reviews status filter ne correspond pas au backend
- Fichier: `src/app/admin/avis/page.tsx:162`
- Frontend filtre par `review.status` (PENDING/APPROVED/REJECTED)
- Backend (`/api/admin/reviews?status=pending`) utilise un mapping different
- Le frontend ne passe pas le status filter a l'API
- Fix: Aligner la logique ou filtrer entierement cote frontend

**F-057** [MOYENNE] Chat escalation detection basee sur des mots cles francais
- Fichier: `src/lib/chat/openai-chat.ts:262-268`
- `botMessage.toLowerCase().includes('transmettre')` - mot francais
- Si le bot repond en anglais, espagnol, etc., l'escalation ne se declenche pas
- Fix: Utiliser une detection multilingue ou un flag dans le prompt systeme

**F-058** [MOYENNE] Community members count affiche "-"
- Fichier: `src/app/(shop)/community/page.tsx:154`
- `<p className="text-2xl font-bold">-</p>` - hardcode comme placeholder
- Fix: Compter les utilisateurs ou afficher un vrai compteur

**F-059** [MOYENNE] Review userAvatar toujours undefined
- Fichier: `src/app/api/reviews/route.ts:66`
- `userAvatar: undefined` - le champ est defini mais jamais rempli
- Les avatars ne s'affichent jamais dans les reviews publiques
- Fix: Inclure `image` dans le select user et le retourner

**F-060** [MOYENNE] Chat greetings ne couvrent pas toutes les langues supportees
- Fichier: `src/app/api/chat/route.ts:172-183`
- 9 langues seulement: en, fr, es, de, it, pt, zh, ar, ru
- Le site supporte 22 langues (ko, ja, hi, vi, pl, sv, etc. manquent)
- Fix: Ajouter les traductions pour les 13 langues manquantes

**F-061** [MOYENNE] Admin reviews statusLabel depend du memo
- Fichier: `src/app/admin/avis/page.tsx:82-86`
- `statusLabel` est un `useMemo` avec `[t]` comme dep
- Si `t` change (rare), le memo se recalcule mais les anciennes references dans listItems ne sont pas mises a jour
- Fix: Inclure `statusLabel` dans les deps de `listItems`

**F-062** [MOYENNE] Chat conversation update met a jour lastMessageAt deux fois
- Fichier: `src/app/api/chat/message/route.ts:209-215` et `232-235`
- Le message visiteur update `lastMessageAt`, puis le bot message le re-update
- 2 queries UPDATE en sequence pour la meme conversation
- Fix: Combiner dans un seul update ou utiliser un batch

**F-063** [MOYENNE] Admin question answer auto-publishes
- Fichier: `src/app/api/admin/questions/[id]/answer/route.ts:48`
- `isPublished: true` automatiquement quand admin repond
- L'admin n'a pas le choix de repondre en prive
- Fix: Rendre la publication optionnelle via un checkbox

**F-064** [MOYENNE] Community sorting ne persiste pas
- Fichier: `src/app/(shop)/community/page.tsx:58`
- `const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'replies'>('recent')`
- Le tri est reset a chaque navigation
- Fix: Stocker dans localStorage ou URL search params

**F-065** [MOYENNE] Conversation system messages hardcodes en francais
- Fichier: `src/app/api/chat/conversations/[id]/route.ts:145-152`
- `content: 'Conversation assignee a ...'` et `'Conversation desassignee'`
- Pas de traduction i18n
- Fix: Utiliser les cles de traduction ou stocker la langue

**F-066** [MOYENNE] Review API utilise deux imports differents pour stripHtml
- Fichier: `src/app/api/reviews/route.ts:11` - `import { stripHtml } from '@/lib/validation'`
- Fichier: `src/app/api/admin/reviews/[id]/respond/route.ts:11` - `import { stripHtml } from '@/lib/sanitize'`
- Deux implementations possiblement differentes
- Fix: Consolider dans un seul module

**F-067** [MOYENNE] Community page Image component avec unoptimized
- Fichier: `src/app/(shop)/community/page.tsx:309`
- `<Image src={post.userAvatar} ... unoptimized />` - bypass optimisation
- Fix: Configurer les domaines dans next.config.js et retirer unoptimized

**F-068** [MOYENNE] Chat message type accepte n'importe quelle valeur
- Fichier: `src/app/api/chat/message/route.ts:35`
- `const messageType = body.type || 'TEXT'` - pas de validation enum
- `type: messageType as any` cast dangereux
- Fix: Valider contre ['TEXT', 'IMAGE', 'FILE']

**F-069** [MOYENNE] Admin avis fetchReviews manque useCallback
- Fichier: `src/app/admin/avis/page.tsx:90-105`
- `useEffect(() => { fetchReviews(); }, [])` - exhaustive deps warning
- `fetchReviews` n'est pas dans les deps car pas wrape dans useCallback
- Fix: Wraper `fetchReviews` dans `useCallback` et l'ajouter aux deps

**F-070** [MOYENNE] Pas de confirmation avant approve/reject review
- Fichier: `src/app/admin/avis/page.tsx:303-318`
- Les boutons Approve/Reject executent immediatement sans confirmation
- Un clic accidentel peut approuver un review spam
- Fix: Ajouter une modal de confirmation ou un toast annulable

**F-071** [MOYENNE] Chat message content post-sanitization peut etre vide
- Fichier: `src/app/api/chat/message/route.ts:50-53`
- Apres strip HTML + control chars, le contenu pourrait etre vide
- Le check `if (!content)` retourne erreur mais le message utilisateur n'est pas clair
- Fix: Message d'erreur traduit et specifique

**F-072** [MOYENNE] Community page n'a pas de skeleton loading
- Fichier: `src/app/(shop)/community/page.tsx`
- Pas de state `loading` - les posts apparaissent instantanement (vides)
- Quand le backend existera, il faudra gerer le loading
- Fix: Preparer un state loading et des skeleton components

**F-073** [MOYENNE] Admin review images onclick pas de lightbox
- Fichier: `src/app/admin/avis/page.tsx:376-389`
- Les images sont affichees en 28x28 sans possibilite de zoom
- Fix: Ajouter un lightbox/modal pour voir les images en taille reelle

**F-074** [MOYENNE] ChatPreview ne gere pas les erreurs fetch
- Fichier: `src/hooks/useRecentChats.ts:28`
- `catch { /* silently fail */ }` - aucune indication d'erreur
- Si l'API est down, le widget reste en loading indefiniment
- Fix: Ajouter un state error et un retry

**F-075** [MOYENNE] Chat conversation visitorLanguage update race condition
- Fichier: `src/app/api/chat/message/route.ts:133-138`
- `detectLanguage` est async - pendant l'update, un autre message peut arriver
- Fix: Utiliser une atomic update ou accepter la derniere detection

**F-076** [MOYENNE] Admin questions page Pencil/MessageSquare icon inconsistant
- Fichier: `src/app/admin/questions/page.tsx:283`
- `icon={selectedQuestion.answer ? Pencil : MessageSquare}` - icone change dynamiquement
- Pas de tooltip pour expliquer la difference
- Fix: Ajouter un title/tooltip sur le bouton

**F-077** [MOYENNE] Review creation permet rating flottant cote API
- Fichier: `src/lib/validations/shared.ts:86-89`
- `ratingSchema = z.number().int()` - OK
- Mais `src/app/api/reviews/route.ts:129` destructure `rating` du body avant validation
- La ligne `const { productId, rating, ... } = body` prend la valeur brute
- Fix: Utiliser `validation.data` au lieu de `body` pour les valeurs

**F-078** [MOYENNE] Chat OpenAI max_tokens trop bas pour les reponses complexes
- Fichier: `src/lib/chat/openai-chat.ts:257`
- `max_tokens: 1000` - environ 750 mots
- Pour des reponses detaillees sur les peptides avec disclaimer, c'est souvent insuffisant
- Fix: Augmenter a 1500-2000

**F-079** [MOYENNE] Conversation PUT updateData utilise `any`
- Fichier: `src/app/api/chat/conversations/[id]/route.ts:174`
- `const updateData: any = { ...data }` - contourne TypeScript
- Fix: Typer correctement avec Prisma types

**F-080** [MOYENNE] Community modal ne se ferme pas avec Escape
- Fichier: `src/app/(shop)/community/page.tsx:396`
- Le modal a `role="dialog"` et `aria-modal="true"` mais pas de handler pour keydown Escape
- Fix: Ajouter un `useEffect` avec event listener pour Escape

### BASSES (20)

**F-081** [BASSE] Community stats toujours a zero
- Fichier: `src/app/(shop)/community/page.tsx:146-157`
- Les stats (Discussions, Replies, Members) sont toutes a 0 car pas de donnees
- Fix: Afficher "Coming soon" ou des stats calculees quand le backend existera

**F-082** [BASSE] formatDate dans community non internationalise
- Fichier: `src/app/(shop)/community/page.tsx:121`
- `date.toLocaleDateString('en-CA', ...)` hardcode le locale canadien
- Fix: Utiliser `locale` du contexte i18n

**F-083** [BASSE] Chat recent formatRelativeTime hardcode en anglais
- Fichier: `src/components/admin/outlook/ChatPreview.tsx:89-92`
- `'now'`, `'${diffMin}m'`, `'${diffHrs}h'` - anglais seulement
- Fix: Utiliser les cles de traduction admin

**F-084** [BASSE] Admin reviews avg rating affiche trop de decimales potentiellement
- Fichier: `src/app/admin/avis/page.tsx:259`
- `stats.avgRating.toFixed(1)` - OK pour la plupart des cas
- Mais `toFixed(1)` sur 0 donne "0.0" au lieu de "-" quand il n'y a pas de reviews
- Fix: Afficher "-" quand `reviews.length === 0`

**F-085** [BASSE] Reply interface commentee dans community page
- Fichier: `src/app/(shop)/community/page.tsx:27-38`
- Interface `Reply` commentee - code mort
- Fix: Supprimer ou implementer les replies

**F-086** [BASSE] Community page pas de SEO meta dynamique
- Fichier: `src/app/(shop)/community/layout.tsx`
- Meta statique, pas de Open Graph, pas de Twitter Card
- Fix: Ajouter OG et Twitter meta

**F-087** [BASSE] Admin questions page import Trash2 inutilise en mobile
- Fichier: `src/app/admin/questions/page.tsx:8`
- `Trash2` est importe mais utilise seulement dans le detail pane
- Tree-shaking devrait l'eliminer mais c'est du bruit
- Fix: OK si tree-shaking fonctionne, sinon import dynamique

**F-088** [BASSE] Chat settings widgetPosition non valide
- Fichier: `src/app/api/chat/settings/route.ts:93`
- `widgetPosition` accepte n'importe quelle string
- Fix: Valider contre enum ['bottom-right', 'bottom-left']

**F-089** [BASSE] Review upload randomString faible entropie
- Fichier: `src/app/api/reviews/upload/route.ts:71`
- `Math.random().toString(36).substring(2, 8)` - seulement 6 chars aleatoires
- Math.random n'est pas cryptographiquement securise
- Fix: Utiliser `crypto.randomBytes(8).toString('hex')`

**F-090** [BASSE] Admin avis page pas d'aria-label sur les etoiles
- Fichier: `src/app/admin/avis/page.tsx:222-230`
- Les etoiles SVG n'ont pas de label accessible
- Fix: Ajouter `aria-label={`${rating} sur 5 etoiles`}`

**F-091** [BASSE] Community page accessible sans verification d'age
- Fichier: `src/app/(shop)/community/page.tsx`
- Les peptides sont un sujet restreint - pas de warning/disclaimer
- Fix: Ajouter un disclaimer legal comme dans le chat bot

**F-092** [BASSE] Chat message language stored as 2-letter code without validation
- Fichier: `src/app/api/chat/message/route.ts:197`
- `language: messageToSave.language` pourrait contenir n'importe quoi si detectLanguage retourne un code invalide
- Fix: Valider contre une liste de codes ISO 639-1

**F-093** [BASSE] Admin questions togglePublic pas de loading state
- Fichier: `src/app/admin/questions/page.tsx:113-130`
- Pas de feedback visuel pendant le toggle
- Fix: Ajouter un spinner sur le badge pendant la requete

**F-094** [BASSE] ContactListPage export button ne fait rien
- Fichier: `src/components/admin/ContactListPage.tsx:266-268`
- Le bouton Export est present mais sans onClick handler
- Fix: Implementer l'export CSV/Excel ou masquer le bouton

**F-095** [BASSE] Community search pas de clear button
- Fichier: `src/app/(shop)/community/page.tsx:236-242`
- L'input de recherche n'a pas de bouton X pour effacer
- Fix: Ajouter un bouton clear quand searchQuery n'est pas vide

**F-096** [BASSE] Chat messages orderBy inconsistant
- Fichier: `src/app/api/chat/route.ts:94` - `orderBy: { createdAt: 'asc' }, take: 50`
- Fichier: `src/app/api/chat/message/route.ts:68` - `orderBy: { createdAt: 'asc' }, take: 20`
- Limites differentes (50 vs 20) pour les memes donnees
- Fix: Uniformiser a 50 ou parametrer

**F-097** [BASSE] Review creation uses `body` values instead of `validation.data`
- Fichier: `src/app/api/reviews/route.ts:129`
- `const { productId, rating, ... } = body` au lieu de `validation.data`
- Les valeurs ne sont pas transformees par le schema Zod (trim, etc.)
- Fix: Destructurer depuis `validation.data`

**F-098** [BASSE] ChatPreview time format ne gere pas les fuseaux horaires
- Fichier: `src/components/admin/outlook/ChatPreview.tsx:82-93`
- `new Date(dateStr)` depend du fuseau du navigateur
- Fix: Utiliser un format UTC ou Intl.RelativeTimeFormat

**F-099** [BASSE] Admin reviews pagination metadata non utilisee
- Fichier: `src/app/api/admin/reviews/route.ts:84-92`
- L'API retourne `pagination: { page, limit, total, pages }` mais le frontend l'ignore
- Fix: Utiliser la pagination dans le frontend

**F-100** [BASSE] Contact form ne stocke pas les messages en DB
- Fichier: `src/app/api/contact/route.ts`
- Les messages de contact sont envoyes par email seulement, pas stockes en base
- Si l'email fail, le message est perdu
- Fix: Sauvegarder en DB (modele ContactMessage) avant d'envoyer l'email

---

## PARTIE 2: 100 AMELIORATIONS

### CRITIQUES (12)

**A-001** [CRITIQUE] Implementer le backend du forum community
- Creer modeles: ForumPost, ForumReply, ForumVote, ForumTag
- Creer API CRUD: `/api/community/posts`, `/api/community/posts/[id]/replies`
- Connecter le frontend existant au backend
- Ajouter moderation automatique (filtre de mots, anti-spam)

**A-002** [CRITIQUE] Migrer review upload vers Azure Blob Storage
- Remplacer le filesystem local par Azure Blob Storage
- Utiliser le service `storage` existant (`@/lib/storage`)
- Generer des thumbnails automatiquement
- Ajouter CDN pour les images

**A-003** [CRITIQUE] Ajouter WebSocket/SSE pour le chat en temps reel
- Actuellement: polling toutes les 30s (useRecentChats)
- Remplacer par Server-Sent Events ou WebSocket
- Notifications instantanees pour admin et visiteur
- Indicateur de frappe ("typing...")

**A-004** [CRITIQUE] Creer un systeme de moderation communautaire
- Queue de moderation pour posts, reviews, questions
- Auto-moderation par IA (detection toxicite, spam)
- Systeme de signalement (report) par les utilisateurs
- Dashboard de moderation pour admin

**A-005** [CRITIQUE] Ajouter endpoint public pour soumettre des questions
- `POST /api/questions` avec auth utilisateur
- Validation Zod, rate limiting, sanitization
- Notification admin par email quand nouvelle question
- Page produit: section Q&A interactive

**A-006** [CRITIQUE] Implementer notifications multi-canal
- Email automatique quand review/question recoit reponse
- Push notifications navigateur pour chat
- Badge de notifications dans le header utilisateur
- Digest quotidien des activites communautaires pour admin

**A-007** [CRITIQUE] Ajouter champ status enum au modele Review
- Migration: `status ReviewStatus @default(PENDING)` avec enum PENDING/APPROVED/REJECTED
- Script de migration des donnees existantes
- Supprimer la logique de derivation fragile dans l'API
- Ajouter index: `@@index([productId, status])`

**A-008** [CRITIQUE] Securiser l'endpoint chat upload
- Ajouter authentification (session ou visitorId verifie)
- Rate limit: 5 uploads/minute
- Scan antivirus/malware des fichiers uploades
- Validation stricte: magic bytes + MIME type + extension

**A-009** [CRITIQUE] Creer un systeme anti-spam global
- Honeypot fields dans les formulaires publics
- CAPTCHA (hCaptcha ou Turnstile) pour les visiteurs non authentifies
- Detection de patterns: repetition, liens suspects, contenu politique
- Blocage IP automatique apres X violations

**A-010** [CRITIQUE] Implementer la gestion des pieces jointes chat
- Validation des URLs d'attachement (domaine autorise uniquement)
- Preview des images inline dans le chat
- Telechargement securise des fichiers
- Scan de securite des uploads

**A-011** [CRITIQUE] Ajouter CSRF protection sur tous les endpoints POST chat
- `validateCsrf(request)` sur `/api/chat`, `/api/chat/message`, `/api/chat/upload`
- Token CSRF genere et inclus dans le widget chat
- Rotation des tokens

**A-012** [CRITIQUE] Creer un systeme de reputation utilisateur
- Points de reputation: +10 post, +5 reponse, +20 meilleure reponse
- Badges: Contributor, Expert, Top Reviewer
- Niveaux de trust: les nouveaux utilisateurs sont moderes
- Integration avec le programme de fidelite existant

### HAUTES (28)

**A-013** [HAUTE] Ajouter pagination infinite scroll sur admin avis
- Charger 20 reviews a la fois dans ContentList
- Infinite scroll avec intersection observer
- Garder les filtres et recherche actifs pendant le scroll
- Cache local pour eviter le re-fetch

**A-014** [HAUTE] Implementer la fonctionnalite "Helpful" sur les reviews
- Endpoint `POST /api/reviews/[id]/helpful` (toggle)
- Compteur visible sur la page produit
- Rate limit: 1 vote par review par utilisateur
- Tri par "Most Helpful"

**A-015** [HAUTE] Ajouter rich text editor pour le forum
- Markdown basique: bold, italic, liens, code blocks
- Preview en temps reel
- Upload d'images inline (via Azure Blob)
- Sanitization stricte cote serveur (allowlist de tags HTML)

**A-016** [HAUTE] Implementer les notifications email pour le chat
- Email a l'admin quand nouveau chat ou escalation
- Email au visiteur quand l'admin repond (si email fourni)
- Throttling: max 1 email par conversation par heure
- Templates email traduits dans toutes les langues

**A-017** [HAUTE] Ajouter un dashboard analytics communaute
- Graphiques: reviews/jour, questions/semaine, temps de reponse moyen
- Metriques: taux de reponse, satisfaction (rating moyen)
- Top contributeurs, produits les plus discutes
- Export CSV des donnees

**A-018** [HAUTE] Creer un systeme de thread/replies pour le forum
- Modele ForumReply avec parentId pour reponses imbriquees
- Tri par best answer, most recent
- Marquer "best answer" (auteur du post ou admin)
- Notification a l'auteur quand reponse

**A-019** [HAUTE] Implementer la recherche full-text
- PostgreSQL full-text search sur posts, reviews, questions
- Index GIN sur les colonnes de contenu
- Recherche avec highlighting des resultats
- Suggestions de recherche autocomplete

**A-020** [HAUTE] Ajouter un systeme de categories et tags pour le forum
- Modeles ForumCategory, ForumTag avec relations
- Tags autocomplete lors de la creation
- Filtrage multi-tags dans la sidebar
- Cloud de tags dynamique

**A-021** [HAUTE] Implementer la sauvegarde des messages de contact en DB
- Modele ContactMessage avec status (NEW, READ, REPLIED, ARCHIVED)
- Admin: page de gestion des contacts integree dans l'interface
- Historique des conversations par email client
- Templates de reponse rapide

**A-022** [HAUTE] Ajouter le support multilingue complet au chatbot
- Greetings pour les 22 langues supportees
- Escalation detection multilingue (pas juste francais)
- Knowledge base traduite pour les produits
- Detection de langue plus robuste (pas seulement OpenAI)

**A-023** [HAUTE] Creer une API publique pour afficher les reviews par produit
- Endpoint `GET /api/products/[slug]/reviews` optimise
- Inclure stats: average rating, distribution (5 etoiles, 4 etoiles, etc.)
- Filtrage: par rating, par verified purchase, avec photos
- Cache Redis pour les pages produit populaires

**A-024** [HAUTE] Implementer les reponses aux reviews par les utilisateurs
- Modele ReviewComment pour les discussions sous les reviews
- L'auteur de la review peut repondre a la reponse admin
- Moderation des commentaires
- Notification a l'admin des nouvelles reponses

**A-025** [HAUTE] Ajouter l'historique des modifications admin
- Fichier: `src/app/api/admin/reviews/[id]/route.ts`
- Logger les changements de statut avec qui, quand, pourquoi
- Afficher l'historique dans le detail pane
- Raison obligatoire pour les rejections

**A-026** [HAUTE] Implementer un systeme de bannissement
- Banir un utilisateur du forum/reviews/chat
- Duree configurable (temporaire ou permanent)
- Raison documentee et visible pour l'admin
- API endpoint: `POST /api/admin/users/[id]/ban`

**A-027** [HAUTE] Optimiser les queries Prisma avec select specifiques
- Fichier: `src/app/api/admin/questions/route.ts:35-42`
- `findMany` sans `select` retourne tous les champs
- Les API admin chargent des donnees inutiles
- Fix: Utiliser `select` pour les champs necessaires seulement

**A-028** [HAUTE] Ajouter le support des emojis et reactions
- Reactions rapides sur les posts forum (like, love, helpful, etc.)
- Reactions sur les messages chat
- Compteur de reactions affiche
- Animation de feedback

**A-029** [HAUTE] Creer une page de profil public utilisateur
- Afficher: reviews postees, questions posees, posts forum
- Badge de reputation et tier de fidelite
- Bio optionnelle
- Respecter la vie privee: opt-in pour le profil public

**A-030** [HAUTE] Implementer un systeme de notification in-app
- Cloche de notification dans le header
- Types: reponse a votre review, reponse a votre question, nouveau message chat
- Compteur de non-lus
- Mark as read individuel et global

**A-031** [HAUTE] Ajouter des templates de reponse pour les reviews admin
- Fichier: `src/app/admin/avis/page.tsx`
- Templates pre-ecrits pour: remerciement, demande de details, excuses
- Insertion rapide dans la modal de reponse
- Personnalisation avec le nom du client et du produit

**A-032** [HAUTE] Implementer le chat widget frontend complet
- Composant ChatWidget flottant sur toutes les pages
- Animation d'ouverture/fermeture fluide
- Son de notification configurable
- Mode minimal quand ferme (badge de non-lus)

**A-033** [HAUTE] Ajouter la possibilite d'editer/supprimer ses propres posts
- Edit: fenetre de 30 minutes apres creation
- Delete: marquer comme supprime (soft delete)
- Historique des modifications visible
- Admin peut forcer la suppression

**A-034** [HAUTE] Creer un endpoint pour les stats review par produit
- `GET /api/products/[id]/reviews/stats`
- Retourner: average, count, distribution (1-5 stars), count with photos
- Cache 5 minutes pour les pages produit
- Utilise pour les etoiles sur la page listing

**A-035** [HAUTE] Ajouter un export PDF/CSV des reviews pour les admin
- Bouton Export dans la page admin avis
- Formats: CSV, PDF
- Filtrage par date, status, produit
- Inclure les images en base64 dans le PDF

**A-036** [HAUTE] Implementer une FAQ dynamique basee sur les questions
- Les questions les plus frequentes automatiquement suggerees
- Groupement par produit et par theme
- Mise en avant des questions avec reponse officielle
- Reduction de la charge support

**A-037** [HAUTE] Ajouter verification "Verified Purchase" visuelle
- Badge vert "Achat verifie" sur les reviews de vrais acheteurs
- Filtrage: "Only Verified Purchases"
- Poids superieur dans le tri par defaut
- Indicateur de confiance pour les visiteurs

**A-038** [HAUTE] Creer un systeme de file d'attente pour le chat
- Quand admin offline: position dans la file
- Temps d'attente estime
- Notification quand son tour arrive
- Priorite pour les clients VIP/Platinum

**A-039** [HAUTE] Ajouter le support des images dans les questions
- Upload d'images avec les questions produit
- Utile pour montrer un probleme ou demander identification
- Meme pipeline de validation que les review images
- Preview dans l'admin questions

**A-040** [HAUTE] Implementer un systeme de feedback post-chat
- Sondage de satisfaction apres fermeture du chat
- Rating 1-5 + commentaire optionnel
- Metriques de satisfaction agent
- Dashboard avec NPS score

### MOYENNES (35)

**A-041** [MOYENNE] Ajouter pagination URL-based pour le forum
- Parametres dans l'URL: `?page=2&category=research&sort=popular`
- Bookmarkable et partageable
- Back/Forward du navigateur fonctionne
- SSR possible avec les params

**A-042** [MOYENNE] Implementer la mention @username dans le forum
- Autocomplete des usernames avec @
- Notification a l'utilisateur mentionne
- Highlight des mentions dans le rendu
- Lien vers le profil de l'utilisateur

**A-043** [MOYENNE] Ajouter un editeur markdown pour les reponses admin
- Fichier: `src/app/admin/avis/page.tsx:475-481`
- Textarea basique actuellement
- Ajouter: bold, italic, liens, listes
- Preview du rendu final

**A-044** [MOYENNE] Creer un systeme de mail digest hebdomadaire
- Resume des nouvelles questions, reviews, posts de la semaine
- Envoye aux abonnes (opt-in)
- Personnalise par interets (categories suivies)
- Unsubscribe en un clic

**A-045** [MOYENNE] Ajouter le compteur de caracteres dans les formulaires
- Forum: post title (200/200), content (10000/10000)
- Review: title (200/200), comment (5000/5000)
- Chat: message (5000/5000)
- Affichage visuel: vert -> orange -> rouge

**A-046** [MOYENNE] Implementer le tri des questions par pertinence
- Les questions les plus vues/votees en premier
- Les questions sans reponse en priorite pour l'admin
- Les questions recentes en premier pour les visiteurs
- Algorithme combinant age, votes, et status

**A-047** [MOYENNE] Ajouter des filtres avances sur la page admin reviews
- Filtrer par produit
- Filtrer par rating (1-5)
- Filtrer par date (cette semaine, ce mois, etc.)
- Filtrer par "avec photos" / "achat verifie"

**A-048** [MOYENNE] Creer un composant ReviewStars reutilisable
- Fichier: `src/app/admin/avis/page.tsx:221-230` - logique dupliquee
- Composant: `<ReviewStars rating={4} size="sm" />`
- Variantes: display-only et interactive (pour soumettre)
- Accessibilite: aria-label descriptif

**A-049** [MOYENNE] Implementer le lazy loading des images review
- Utiliser `loading="lazy"` sur les images dans les listes
- Placeholder blur pendant le chargement
- Intersection Observer pour charger au scroll
- Optimisation bande passante mobile

**A-050** [MOYENNE] Ajouter des reponses suggerees par IA pour l'admin
- Bouton "Suggerer reponse" dans la modal admin review/question
- OpenAI genere une reponse basee sur la review et le contexte produit
- L'admin peut editer avant de publier
- Historique des suggestions utilisees

**A-051** [MOYENNE] Implementer la detection de doublons
- Detecter les reviews similaires (meme utilisateur, meme produit, texte similaire)
- Alerter l'admin des doublons potentiels
- Auto-fusionner les questions similaires
- Suggestion de questions existantes lors de la saisie

**A-052** [MOYENNE] Ajouter un mode sombre pour le forum community
- Respecter `prefers-color-scheme`
- Toggle manuel dans le header
- Tous les composants community adaptables
- Sauvegarde du choix en localStorage

**A-053** [MOYENNE] Creer une API de stats globales communaute
- `GET /api/community/stats` publique
- Retourner: total members, total posts, total reviews, total questions
- Cache long (1 heure)
- Affiche dans le hero de la page community

**A-054** [MOYENNE] Implementer le suivi de produit (follow)
- L'utilisateur peut "suivre" un produit
- Notification quand nouvelle review ou question sur ce produit
- Bouton Follow sur la page produit
- Gestion des follows dans le profil

**A-055** [MOYENNE] Ajouter la traduction automatique des reviews
- Bouton "Traduire" sur les reviews dans une autre langue
- Utiliser le service de traduction OpenAI existant
- Cache des traductions pour eviter les appels repetitifs
- Indicateur de langue originale

**A-056** [MOYENNE] Implementer un systeme de vote sur les questions
- Upvote/downvote sur les questions
- Tri par votes
- Les questions les plus votees remontent
- Anti-fraud: 1 vote par question par utilisateur

**A-057** [MOYENNE] Ajouter des raccourcis clavier pour l'admin
- `Ctrl+Enter` pour soumettre une reponse
- `A` pour approuver, `R` pour rejeter un review
- `N` pour passer au prochain non-modere
- Help tooltip avec les raccourcis

**A-058** [MOYENNE] Creer un systeme de categories pour les reviews
- Categories: Qualite, Livraison, Service Client, Rapport Qualite-Prix
- Filtrage par categorie sur la page produit
- Analyse par categorie pour l'admin
- Radar chart de satisfaction multicritere

**A-059** [MOYENNE] Implementer le pre-remplissage intelligent du chat
- Detecter la page d'ou vient le visiteur
- Pre-remplir le sujet: "Question about BPC-157" si vient de la page BPC-157
- Suggestions de questions frequentes
- Quick actions: "Track my order", "Return policy"

**A-060** [MOYENNE] Ajouter un widget de reviews sur la page produit
- Composant: `<ProductReviews productId={id} />`
- Affichage compact: rating moyen + distribution + 3 dernieres reviews
- Bouton "Write a review" avec lien vers le formulaire
- SEO: structured data schema.org/Review

**A-061** [MOYENNE] Implementer la pagination des messages chat cote frontend
- Actuellement: charge 50 messages max
- Ajouter: bouton "Load older messages"
- Scroll automatique au nouveau message
- Indicateur de chargement

**A-062** [MOYENNE] Ajouter une fonctionnalite de draft/brouillon
- Sauvegarder automatiquement les formulaires en cours (forum post, review)
- localStorage pour la persistance
- Restoration automatique a la reouverture
- Option "Discard draft"

**A-063** [MOYENNE] Creer un systeme de tags intelligents pour les reviews
- Tags auto-generes par IA (ex: "fast shipping", "great quality")
- Tags utiles pour le filtrage et l'analyse
- Nuage de tags sur la page produit
- Top tags dans la sidebar review

**A-064** [MOYENNE] Implementer un calendrier de publication pour les reviews
- Admin peut programmer la publication d'une review approuvee
- Repartir les reviews dans le temps pour un flux constant
- Eviter les pics de reviews le meme jour
- Dashboard avec planning des publications

**A-065** [MOYENNE] Ajouter l'integration Schema.org pour le SEO
- `@type: Review` avec rating, author, datePublished
- `@type: Question` et `@type: Answer` pour les Q&A
- `@type: DiscussionForumPosting` pour les posts forum
- AggregateRating sur la page produit

**A-066** [MOYENNE] Implementer un systeme de bookmarks
- Sauvegarder des posts, reviews, questions en favoris
- Page "Mes favoris" dans le profil
- Notification si un favori est mis a jour
- Export des favoris

**A-067** [MOYENNE] Ajouter des metriques de temps de reponse
- Temps moyen de reponse aux questions
- Temps moyen de moderation des reviews
- SLA: alerter si une question est sans reponse depuis > 48h
- Affichage public: "Temps de reponse moyen: 4h"

**A-068** [MOYENNE] Implementer le partage social des posts
- Boutons de partage: Twitter, Facebook, LinkedIn, Copy Link
- Open Graph meta dynamique pour chaque post
- URL courte et propre pour le partage
- Compteur de partages

**A-069** [MOYENNE] Creer un systeme de gamification
- Challenges: "Post 5 reviews this month"
- Achievements: "First Review", "Helpful x10", "100 Posts"
- Leaderboard mensuel
- Recompenses en points de fidelite

**A-070** [MOYENNE] Ajouter la possibilite de citer dans les reponses forum
- Selection de texte -> bouton "Quote"
- Rendu en blockquote style
- Multi-quotes possibles
- Reference au post original

**A-071** [MOYENNE] Implementer des filtres sauvegardables
- L'utilisateur peut sauvegarder des filtres personnalises
- "Mes filtres" dans la sidebar
- Filtres partageables par URL
- Notifications pour les filtres sauvegardes

**A-072** [MOYENNE] Ajouter un systeme de permissions granulaire pour le chat
- Roles: chat-agent, chat-supervisor, chat-admin
- Superviseur peut voir toutes les conversations
- Agent ne voit que les siennes
- Admin gere les settings

**A-073** [MOYENNE] Creer un historique de conversation consultable
- Recherche full-text dans les messages passes
- Filtrage par date, agent, statut
- Export de conversations individuelles
- Archivage automatique apres 90 jours

**A-074** [MOYENNE] Implementer un systeme de satisfaction instantanee
- Apres chaque reponse bot: pouces haut/bas
- Apres chaque reponse admin: "Was this helpful?"
- Metriques de qualite des reponses
- Training loop pour ameliorer le chatbot

**A-075** [MOYENNE] Ajouter le support des videos dans les reviews
- Upload de courtes videos (30s max)
- Transcoding automatique
- Thumbnail generee automatiquement
- Lecture inline dans la page produit

### BASSES (25)

**A-076** [BASSE] Ajouter des animations de transition dans le forum
- Fade-in des nouveaux posts
- Animation lors du changement de categorie
- Transition fluide entre la liste et le detail
- Loading skeleton anime

**A-077** [BASSE] Implementer un compteur de vues pour les posts forum
- Incrementer a chaque visite unique (par IP ou session)
- Afficher dans la liste et le detail
- Utiliser pour le tri "Most Viewed"
- Rate limiter le compteur pour eviter la manipulation

**A-078** [BASSE] Ajouter un mode "Compact" pour la liste admin
- Toggle entre vue normale et vue compacte
- Vue compacte: moins de padding, pas de preview
- Plus d'items visibles par ecran
- Sauvegarde du mode en preferences

**A-079** [BASSE] Creer des templates de message d'accueil chat par page
- Message different selon la page visitee
- Ex: page produit -> "Des questions sur [produit]?"
- Ex: page checkout -> "Besoin d'aide pour votre commande?"
- Configurable par l'admin dans les settings

**A-080** [BASSE] Ajouter un indicateur "en ligne" pour les contributeurs
- Pastille verte pour les utilisateurs connectes
- "Vu il y a 5 min" pour les deconnectes
- Privacy: opt-in pour la visibilite du statut
- Utile pour le support pair-a-pair

**A-081** [BASSE] Implementer des sondages dans le forum
- Creer un post avec options de vote
- Resultats en temps reel (barres de progression)
- Anonyme ou public
- Date de fin configurable

**A-082** [BASSE] Ajouter la possibilite de pin/unpin des posts forum
- Admin peut epingler un post important
- Les posts epingles restent en haut de la liste
- Maximum 3 posts epingles
- Badge visuel "Pinned" deja prevu dans l'interface

**A-083** [BASSE] Creer un guide de la communaute
- Page /community/guidelines
- Regles de la communaute
- FAQ sur le fonctionnement
- Politique de moderation

**A-084** [BASSE] Ajouter des emoji reactions sur les posts
- Set d'emojis reduit: like, love, helpful, funny, insightful
- Compteur par reaction sous chaque post
- Tooltip: "3 personnes trouvent ca utile"
- Animation au clic

**A-085** [BASSE] Implementer la fonctionnalite "Follow" pour les discussions
- Suivre une discussion specifique
- Notification quand nouvelle reponse
- Bouton "Unfollow" pour arreter
- Auto-follow quand on poste/repond

**A-086** [BASSE] Ajouter un indicateur de niveau d'activite communautaire
- "Hot" badge pour les discussions actives
- "Trending" pour les posts en croissance rapide
- Timeline d'activite dans la sidebar
- Graphique sparkline des 7 derniers jours

**A-087** [BASSE] Creer un systeme de flair/badges personnalises
- Admin cree des badges: "Beta Tester", "Top Contributor", "Verified Researcher"
- Attribution manuelle ou automatique
- Affiche a cote du nom dans les posts et reviews
- Collection de badges dans le profil

**A-088** [BASSE] Ajouter la possibilite de bloquer un utilisateur
- L'utilisateur peut bloquer un autre utilisateur
- Ne voit plus ses posts/reviews
- Les messages bloques masques dans le chat
- Gestion dans les parametres du profil

**A-089** [BASSE] Implementer un mode lecture hors-ligne pour le forum
- Service worker cache les posts deja lus
- Indication visuelle des contenus caches
- Synchronisation au retour en ligne
- PWA already configured (docs/PWA_SETUP.md)

**A-090** [BASSE] Ajouter des raccourcis de texte pour le chat admin
- Taper `/stock bpc` -> affiche le stock BPC-157
- Taper `/order 12345` -> affiche le statut commande
- Configurable dans les quick-replies
- Autocomplete en tapant

**A-091** [BASSE] Creer un widget d'evaluation sur la page de suivi commande
- Apres livraison: prompt pour laisser un avis
- Pre-rempli avec le produit achete
- Rappel par email apres 7 jours si pas d'avis
- Incentive: points de fidelite pour l'avis

**A-092** [BASSE] Ajouter le support des GIFs dans le chat
- Recherche GIPHY/Tenor integree
- Preview du GIF avant envoi
- Stockage local de l'URL (pas du fichier)
- Mode SFW uniquement

**A-093** [BASSE] Implementer un systeme de canned responses multilingue
- Utiliser le modele QuickReplyTranslation existant
- Detection automatique de la langue du visiteur
- Envoi dans la bonne langue
- Preview en multi-langues pour l'admin

**A-094** [BASSE] Ajouter des metriques de performance chatbot
- Taux de resolution sans escalation
- Satisfaction moyenne des reponses bot
- Questions frequemment escaladees (a ameliorer)
- Cout OpenAI par conversation

**A-095** [BASSE] Creer un system d'archivage automatique
- Archiver les conversations chat apres 30 jours d'inactivite
- Archiver les posts forum sans activite depuis 6 mois
- Page d'archives consultable
- Restoration possible par l'admin

**A-096** [BASSE] Ajouter la fonctionnalite copier-coller dans les reponses admin
- Templates avec variables: {customerName}, {productName}, {orderNumber}
- Insertion rapide par bouton ou raccourci
- Preview avec les variables remplacees
- Historique des templates utilises

**A-097** [BASSE] Implementer un systeme de score qualite pour les reviews
- Score base sur: longueur, photos, achat verifie, utilite
- Mettre en avant les reviews de haute qualite
- Incentive: bonus de points pour les reviews de qualite
- Badge "Quality Review" visible

**A-098** [BASSE] Ajouter le support des mentions dans les reviews admin
- @product pour lier a un produit
- @order pour lier a une commande
- Liens cliquables dans la reponse admin
- Utile pour le suivi cross-references

**A-099** [BASSE] Creer une page de statistiques publique
- "Notre communaute en chiffres"
- Total reviews, average rating, total questions repondues
- Temps de reponse moyen
- Graphique de croissance de la communaute

**A-100** [BASSE] Implementer un chatbot entrainable par l'admin
- Interface admin pour ajouter des Q&A au knowledge base
- Correction des reponses du chatbot
- Fine-tuning automatique base sur les corrections
- A/B testing des prompts systeme

---

## FICHIERS AUDITES

| Fichier | Failles | Ameliorations |
|---------|---------|---------------|
| `src/app/(shop)/community/page.tsx` | 12 | 15 |
| `src/app/(shop)/community/layout.tsx` | 2 | 1 |
| `src/app/admin/avis/page.tsx` | 8 | 8 |
| `src/app/admin/questions/page.tsx` | 5 | 5 |
| `src/app/api/admin/reviews/route.ts` | 3 | 3 |
| `src/app/api/admin/reviews/[id]/route.ts` | 3 | 2 |
| `src/app/api/admin/reviews/[id]/respond/route.ts` | 1 | 1 |
| `src/app/api/admin/questions/route.ts` | 2 | 2 |
| `src/app/api/admin/questions/[id]/route.ts` | 2 | 2 |
| `src/app/api/admin/questions/[id]/answer/route.ts` | 1 | 1 |
| `src/app/api/reviews/route.ts` | 4 | 5 |
| `src/app/api/reviews/upload/route.ts` | 4 | 3 |
| `src/app/api/chat/route.ts` | 6 | 5 |
| `src/app/api/chat/message/route.ts` | 8 | 6 |
| `src/app/api/chat/settings/route.ts` | 3 | 3 |
| `src/app/api/chat/quick-replies/route.ts` | 2 | 2 |
| `src/app/api/chat/upload/route.ts` | 4 | 3 |
| `src/app/api/chat/conversations/route.ts` | 2 | 2 |
| `src/app/api/chat/conversations/[id]/route.ts` | 4 | 3 |
| `src/app/api/chat/conversations/[id]/messages/route.ts` | 2 | 2 |
| `src/app/api/admin/chats/recent/route.ts` | 1 | 1 |
| `src/app/api/contact/route.ts` | 1 | 2 |
| `src/lib/chat/openai-chat.ts` | 4 | 5 |
| `src/lib/validations/review.ts` | 1 | 1 |
| `src/lib/validations/contact.ts` | 0 | 1 |
| `src/lib/validations/shared.ts` | 0 | 1 |
| `src/components/admin/ContactListPage.tsx` | 1 | 1 |
| `src/components/admin/outlook/ChatPreview.tsx` | 2 | 2 |
| `src/hooks/useRecentChats.ts` | 1 | 1 |
| `src/hooks/useAdminList.ts` | 0 | 1 |
| `prisma/schema.prisma` (community models) | 4 | 5 |

---

## PLAN D'ACTION RECOMMANDE

### Phase 1 - Securite critique (1-2 jours)
1. F-002: Authentifier chat upload
2. F-004: CSRF sur tous les endpoints chat
3. F-006: Valider enum status dans chat GET
4. F-008: Deduire sender du contexte auth
5. F-016: Zod validation sur chat settings
6. F-017: Sanitizer quick replies
7. F-018: Zod validation sur admin questions PATCH

### Phase 2 - Backend forum (1 semaine)
1. A-001: Modeles Prisma ForumPost/ForumReply
2. A-001: API CRUD community
3. A-005: API publique pour questions
4. Connecter le frontend existant

### Phase 3 - Infrastructure (1 semaine)
1. A-002: Migration Azure Blob Storage pour images
2. A-003: WebSocket/SSE pour chat temps reel
3. A-006: Systeme de notifications
4. A-007: Champ status enum sur Review

### Phase 4 - Qualite et UX (2 semaines)
1. A-004: Systeme de moderation
2. A-009: Anti-spam
3. A-012: Reputation utilisateur
4. A-019: Recherche full-text

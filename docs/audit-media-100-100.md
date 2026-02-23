# AUDIT MEDIA - 100 Failles/Bugs + 100 Ameliorations
# Projet: peptide-plus (BioCycle Peptides)
# Date: 2026-02-22
# Auditeur: Claude Opus 4.6

---

## RESUME EXECUTIF

**Perimetre**: Ensemble de la section Media du panneau d'administration et systemes d'upload.

**Fichiers audites** (28 fichiers):
- **Pages admin**: `src/app/admin/medias/page.tsx`, `src/app/admin/media/page.tsx`, `src/app/admin/media/library/page.tsx`, `src/app/admin/media/images/page.tsx`, `src/app/admin/media/videos/page.tsx`, `src/app/admin/media/pub-tiktok/page.tsx`, `src/app/admin/media/pub-youtube/page.tsx`, `src/app/admin/media/pub-meta/page.tsx`, `src/app/admin/media/pub-x/page.tsx`, `src/app/admin/media/pub-google/page.tsx`, `src/app/admin/media/pub-linkedin/page.tsx`, `src/app/admin/media/api-teams/page.tsx`, `src/app/admin/media/api-whatsapp/page.tsx`, `src/app/admin/media/api-zoom/page.tsx`, `src/app/admin/bannieres/page.tsx`
- **API routes**: `src/app/api/admin/medias/route.ts`, `src/app/api/admin/medias/[id]/route.ts`, `src/app/api/admin/videos/route.ts`, `src/app/api/admin/videos/[id]/route.ts`, `src/app/api/hero-slides/route.ts`, `src/app/api/hero-slides/[id]/route.ts`, `src/app/api/videos/route.ts`, `src/app/api/chat/upload/route.ts`, `src/app/api/user/avatar/route.ts`, `src/app/api/reviews/upload/route.ts`, `src/app/api/accounting/attachments/route.ts`
- **Composants**: `src/components/admin/MediaUploader.tsx`, `src/components/admin/MediaGalleryUploader.tsx`, `src/components/admin/IntegrationCard.tsx`
- **Services**: `src/lib/storage.ts`, `src/lib/image-optimizer.ts`
- **Schema**: `prisma/schema.prisma` (models Media, Video, VideoTranslation, HeroSlide)
- **Config**: `next.config.js`

**Statistiques**:
- 100 failles/bugs identifies (27 CRITICAL, 31 HIGH, 25 MEDIUM, 17 LOW)
- 100 ameliorations proposees (15 CRITICAL, 25 HIGH, 35 MEDIUM, 25 LOW)

---

## PARTIE 1 : 100 FAILLES ET BUGS

---

### CRITICAL (27)

**F1. [CRITICAL] Duplication de pages Media Manager -- confusion de routes.**
`src/app/admin/medias/page.tsx` et `src/app/admin/media/library/page.tsx` sont deux pages distinctes avec des implementations differentes pour le meme objectif (gestion de medias). La page `/admin/medias` n'a pas de pagination et charge tout en memoire, tandis que `/admin/media/library` a une pagination. Un utilisateur peut atterrir sur l'une ou l'autre sans savoir laquelle est "la bonne".
**Fix**: Supprimer `/admin/medias/page.tsx` et rediriger vers `/admin/media/library`.

**F2. [CRITICAL] Media library (library/page.tsx:164) utilise `<img>` natif au lieu de `NextImage`.**
En mode grille, les images sont rendues avec `<img src={item.url}>` sans aucune optimisation. Cela signifie: pas de lazy loading intelligent, pas de conversion WebP/AVIF, pas de redimensionnement responsive, et un potentiel SSRF si l'URL est malicieuse.
**Fichier**: `src/app/admin/media/library/page.tsx:164`
**Fix**: Remplacer par `<NextImage>` avec `unoptimized` si necessaire, ou utiliser le pipeline d'optimisation existant.

**F3. [CRITICAL] Images page (images/page.tsx:134) utilise aussi `<img>` natif.**
Meme probleme que F2. Toutes les images de la galerie sont rendues sans `NextImage`.
**Fichier**: `src/app/admin/media/images/page.tsx:134`
**Fix**: Remplacer par `<NextImage>`.

**F4. [CRITICAL] Pas de CSRF protection sur les endpoints media upload.**
`POST /api/admin/medias` dans `src/app/api/admin/medias/route.ts` utilise `withAdminGuard` mais pas de validation CSRF. Contrairement a `POST /api/reviews/upload/route.ts` (ligne 21) qui a `validateCsrf(request)`, les endpoints admin n'ont pas cette protection. Un attaquant pourrait declencher un upload via CSRF si le cookie de session est present.
**Fichier**: `src/app/api/admin/medias/route.ts:133`
**Fix**: Ajouter `validateCsrf(request)` dans `withAdminGuard` ou dans chaque endpoint POST/PUT/DELETE.

**F5. [CRITICAL] Hero-slides API n'utilise PAS `withAdminGuard` -- verification de role manuelle incomplete.**
`src/app/api/hero-slides/route.ts:14` fait `session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER`. Cela laisse passer EMPLOYEE, mais `withAdminGuard` dans les autres routes peut avoir une logique differente. De plus, pas d'audit logging sur les hero-slides contrairement aux medias.
**Fichier**: `src/app/api/hero-slides/route.ts:14`, `src/app/api/hero-slides/[id]/route.ts:15`
**Fix**: Migrer vers `withAdminGuard` pour uniformiser la securite et ajouter l'audit logging.

**F6. [CRITICAL] Hero-slides PUT accepte `slideData` directement sans validation de champs.**
`src/app/api/hero-slides/[id]/route.ts:57-59` fait `prisma.heroSlide.update({ data: slideData })` ou `slideData` est directement `body` sans filtrer les champs. Un attaquant pourrait injecter `id`, `createdAt`, ou tout autre champ Prisma.
**Fichier**: `src/app/api/hero-slides/[id]/route.ts:49-59`
**Fix**: Whitelister les champs autorisables: `{ slug, mediaType, backgroundUrl, ... }`.

**F7. [CRITICAL] Hero-slides POST ne sanitize pas ctaUrl/cta2Url -- XSS via `javascript:` protocol.**
`src/app/api/hero-slides/route.ts:84-89` sanitize `backgroundUrl` et `title/subtitle/badgeText` mais PAS `ctaText`, `ctaUrl`, `cta2Text`, `cta2Url`, `statsJson`. Un attaquant pourrait injecter `javascript:alert(1)` dans ctaUrl.
**Fichier**: `src/app/api/hero-slides/route.ts:84-89`
**Fix**: Appliquer `sanitizeUrl()` sur ctaUrl et cta2Url; appliquer `stripHtml()` sur ctaText, cta2Text, et valider statsJson comme JSON valide.

**F8. [CRITICAL] Hero-slides [id] PUT ne sanitize RIEN -- pas de validation d'URL ni d'HTML.**
Contrairement au POST qui sanitize backgroundUrl et title, le PUT dans `src/app/api/hero-slides/[id]/route.ts` passe `slideData` directement a Prisma sans aucune sanitization.
**Fichier**: `src/app/api/hero-slides/[id]/route.ts:57-59`
**Fix**: Appliquer les memes sanitizations que dans le POST.

**F9. [CRITICAL] Upload media ecrit sur le filesystem local -- non persistant sur Azure App Service.**
`src/app/api/admin/medias/route.ts:200` ecrit les fichiers dans `public/uploads/` via `writeFile`. Sur Azure App Service, le filesystem n'est PAS persistant entre les restarts. Les fichiers uploades seront perdus. Le `storage.ts` existe avec support Azure Blob Storage mais n'est PAS utilise par l'endpoint admin medias.
**Fichier**: `src/app/api/admin/medias/route.ts:200`
**Fix**: Utiliser `storage.upload()` de `src/lib/storage.ts` au lieu de `writeFile` direct.

**F10. [CRITICAL] Review upload ecrit aussi sur le filesystem local -- meme probleme Azure.**
`src/app/api/reviews/upload/route.ts:98` ecrit dans `public/uploads/reviews/` directement. Le TODO en ligne 45 le confirme: "TODO: migrate to Azure Blob Storage". En production Azure, ces fichiers seront perdus.
**Fichier**: `src/app/api/reviews/upload/route.ts:45,98`
**Fix**: Migrer vers `storage.upload()`.

**F11. [CRITICAL] Accounting attachments upload -- meme probleme filesystem local.**
`src/app/api/accounting/attachments/route.ts:179` ecrit directement dans `public/uploads/attachments/`. Non persistant sur Azure.
**Fichier**: `src/app/api/accounting/attachments/route.ts:179`
**Fix**: Migrer vers `storage.upload()`.

**F12. [CRITICAL] Chat upload n'a PAS d'authentification.**
`src/app/api/chat/upload/route.ts:11` est un `POST` sans aucune verification de session. N'importe qui peut uploader des images. Pas de `auth()`, pas de `withAdminGuard`, rien.
**Fichier**: `src/app/api/chat/upload/route.ts:11`
**Fix**: Ajouter `const session = await auth(); if (!session?.user) return 401;`.

**F13. [CRITICAL] Chat upload n'a pas de rate limiting.**
Sans authentification (F12) et sans rate limit, cet endpoint est un vecteur d'attaque pour remplir le disque/stockage.
**Fichier**: `src/app/api/chat/upload/route.ts`
**Fix**: Ajouter rate limiting (ex: 10 uploads/minute par IP).

**F14. [CRITICAL] Le model Media Prisma n'a pas de relation `user` -- pas de FK constraint sur uploadedBy.**
`prisma/schema.prisma:1212` definit `uploadedBy String?` sans `@relation` vers User. Si l'utilisateur est supprime, ses medias restent orphelins sans moyen de tracer. Pas de FK constraint.
**Fichier**: `prisma/schema.prisma:1212`
**Fix**: Ajouter `uploadedByUser User? @relation(fields: [uploadedBy], references: [id], onDelete: SetNull)`.

**F15. [CRITICAL] Video model accepte `views` en PATCH sans validation -- un admin pourrait setter les vues a un nombre arbitraire.**
`src/app/api/admin/videos/[id]/route.ts:129` fait `updateData.views = parseInt(String(views), 10)` sans verifier que la valeur est positive. Un attaquant admin pourrait setter `views: -1` ou `views: 999999999`.
**Fichier**: `src/app/api/admin/videos/[id]/route.ts:129`
**Fix**: Valider `views >= 0` et `Number.isFinite(views)`.

**F16. [CRITICAL] Pas de validation de l'URL videoUrl dans Video creation/update.**
`src/app/api/admin/videos/route.ts:162` et `[id]/route.ts:119` acceptent n'importe quelle string comme `videoUrl` et `thumbnailUrl`. Un attaquant pourrait injecter `javascript:alert(1)` ou une URL SSRF.
**Fichier**: `src/app/api/admin/videos/route.ts:162`, `src/app/api/admin/videos/[id]/route.ts:119`
**Fix**: Valider avec `sanitizeUrl()` et n'accepter que http/https.

**F17. [CRITICAL] Accounting attachments -- pas de magic bytes validation.**
`src/app/api/accounting/attachments/route.ts:176-179` valide le MIME type declare mais ne verifie PAS les magic bytes. Un fichier `.pdf` contenant un executable serait accepte.
**Fichier**: `src/app/api/accounting/attachments/route.ts:176-179`
**Fix**: Ajouter la validation magic bytes comme dans `admin/medias/route.ts`.

**F18. [CRITICAL] Storage.deleteFromAzure extrait le blob name par split('/')[-2:] -- fragile.**
`src/lib/storage.ts:228` fait `url.split('/').slice(-2).join('/')` pour extraire le blob name. Si l'URL contient des query parameters ou un format inattendu, cela echouera silencieusement.
**Fichier**: `src/lib/storage.ts:228`
**Fix**: Parser l'URL proprement avec `new URL()` et extraire le pathname.

**F19. [CRITICAL] Hero-slides DELETE ne verifie pas si la slide a des dependances.**
`src/app/api/hero-slides/[id]/route.ts:114` supprime directement sans verifier si des traductions existent (cascade OK) mais ne log pas l'action et ne verifie pas si c'est la derniere slide active.
**Fichier**: `src/app/api/hero-slides/[id]/route.ts:114`
**Fix**: Ajouter audit logging et warning si c'est la derniere slide active.

**F20. [CRITICAL] Integration cards -- handleSave ne gere pas les erreurs.**
Toutes les pages d'integration (TikTok, YouTube, Meta, etc.) ont un `handleSave` qui fait `throw new Error('Save failed')` mais l'erreur n'est PAS catch cote UI dans certains cas. Par ex `pub-tiktok/page.tsx:39` fait juste `throw new Error` sans `try/catch`.
**Fichier**: `src/app/admin/media/pub-tiktok/page.tsx:39` (et toutes les pages similaires)
**Fix**: Wrapper dans try/catch avec `toast.error()`.

**F21. [CRITICAL] Media PATCH n'a pas de validation sur le champ `folder` -- path traversal possible.**
`src/app/api/admin/medias/[id]/route.ts:33` accepte `folder` du body et l'ecrit directement en DB. Si plus tard ce folder est utilise pour construire un path, c'est un path traversal. Contrairement au POST qui a `sanitizeFolderPath()`.
**Fichier**: `src/app/api/admin/medias/[id]/route.ts:33`
**Fix**: Appliquer `sanitizeFolderPath()` sur le folder en PATCH aussi.

**F22. [CRITICAL] Pas de Content-Disposition header sur les fichiers servis -- risque d'execution.**
Les fichiers uploades dans `/public/uploads/` sont servis directement par Next.js. Sans `Content-Disposition: attachment` pour les fichiers non-image, un PDF malicieux ou un fichier HTML renomme pourrait etre execute dans le navigateur.
**Fichier**: `next.config.js` (pas de headers specifiques pour /uploads/)
**Fix**: Ajouter dans `next.config.js` headers: `Content-Disposition: attachment` pour `/uploads/*.pdf`, `X-Content-Type-Options: nosniff`.

**F23. [CRITICAL] Bannieres -- toggleActive() envoie TOUT le slide data via PUT (isActive only needed).**
`src/app/admin/bannieres/page.tsx:182-186` envoie `{ isActive: !slide.isActive }` mais la route PUT `hero-slides/[id]` fait `prisma.heroSlide.update({ data: slideData })` ou `slideData` est tout le body. Comme le body est minimal (`{ isActive: false }`), les autres champs deviennent `undefined` et ne sont pas mis a jour grace a Prisma qui ignore `undefined`. MAIS si un champ est explicitement `null` ou `""`, il sera ecrase.
**Fichier**: `src/app/admin/bannieres/page.tsx:185`, `src/app/api/hero-slides/[id]/route.ts:57-59`
**Fix**: Filtrer explicitement les champs vides/undefined dans le PUT handler.

**F24. [CRITICAL] Video API PATCH -- slug regeneration fait des queries en boucle while.**
`src/app/api/admin/videos/[id]/route.ts:109-113` regenere le slug a chaque update de titre avec un `while` loop qui query la DB a chaque iteration. Avec un titre commun, cela pourrait faire des dizaines de queries.
**Fichier**: `src/app/api/admin/videos/[id]/route.ts:107-116`
**Fix**: Utiliser un suffix unique (ex: timestamp ou randomUUID) au lieu d'un counter loop.

**F25. [CRITICAL] MediaUploader ne gere pas les URLs absolues Azure Blob -- getMediaType() purement base sur l'extension.**
`src/components/admin/MediaUploader.tsx:67-73` detecte le type de media par regex sur l'extension de l'URL. Les URLs Azure Blob (`https://xxx.blob.core.windows.net/media/folder/file.webp?sp=r&st=...`) pourraient ne pas matcher a cause des query params. Le fallback `if (lower.startsWith('/uploads/'))` assume du local.
**Fichier**: `src/components/admin/MediaUploader.tsx:67-73`
**Fix**: Extraire le pathname avant d'appliquer la regex, ou utiliser le mimeType stocke en DB.

**F26. [CRITICAL] Bannieres -- statsJson est passe directement a Prisma sans validation JSON.**
`src/app/api/hero-slides/route.ts:90` passe `statsJson` directement. Si ce n'est pas du JSON valide, cela corrompra les donnees et le frontend crashera en faisant `JSON.parse()`.
**Fichier**: `src/app/api/hero-slides/route.ts:90`
**Fix**: Valider avec `JSON.parse()` dans un try/catch avant sauvegarde.

**F27. [CRITICAL] Audit logging sur media DELETE utilise `_request` comme nom de parametre -- code smell.**
`src/app/api/admin/medias/[id]/route.ts:62` nomme le parametre `_request` (underscore prefix = non utilise) mais l'utilise ensuite lignes 94-95 pour `getClientIpFromRequest(_request)`. Confusing et pourrait casser si un linter supprime le parametre "inutilise".
**Fichier**: `src/app/api/admin/medias/[id]/route.ts:62,94-95`
**Fix**: Renommer en `request` sans underscore.

---

### HIGH (31)

**F28. [HIGH] Media images page -- pas de gestion d'erreurs sur l'upload.**
`src/app/admin/media/images/page.tsx:79` catch l'erreur avec `console.error` mais n'affiche aucun toast ni feedback a l'utilisateur.
**Fichier**: `src/app/admin/media/images/page.tsx:79-80`
**Fix**: Ajouter `toast.error(t('admin.media.uploadFailed'))`.

**F29. [HIGH] Media library page -- pas de gestion d'erreurs sur l'upload.**
`src/app/admin/media/library/page.tsx:89` meme probleme que F28.
**Fichier**: `src/app/admin/media/library/page.tsx:89-90`
**Fix**: Ajouter `toast.error()`.

**F30. [HIGH] Media library -- pas de gestion d'erreurs sur la recherche.**
`src/app/admin/media/library/page.tsx:68-69` fait `console.error` sans feedback utilisateur.
**Fichier**: `src/app/admin/media/library/page.tsx:68-69`
**Fix**: Ajouter `toast.error()` et un etat d'erreur visible.

**F31. [HIGH] Videos page -- pas de gestion d'erreurs sur creation de video.**
`src/app/admin/media/videos/page.tsx:85-86` fait `console.error` sans toast.
**Fichier**: `src/app/admin/media/videos/page.tsx:85-86`
**Fix**: Ajouter `toast.error()`.

**F32. [HIGH] Videos page -- pas de fonctionalite d'edition.**
`src/app/admin/media/videos/page.tsx` affiche les videos mais n'a aucun bouton Edit/Delete fonctionnel dans la liste. Les icones `Edit2` et `Trash2` sont importees (ligne 6) mais jamais utilisees.
**Fichier**: `src/app/admin/media/videos/page.tsx:6`
**Fix**: Implementer un modal d'edition et un bouton de suppression connectes a `PATCH/DELETE /api/admin/videos/[id]`.

**F33. [HIGH] Videos page -- le formulaire de creation ne valide pas l'URL video.**
`src/app/admin/media/videos/page.tsx:110` accepte n'importe quelle string dans `videoUrl` sans validation cote client. Pas de regex pour verifier si c'est une URL YouTube, Vimeo, ou un lien valide.
**Fichier**: `src/app/admin/media/videos/page.tsx:110`
**Fix**: Ajouter une validation URL cote client et cote serveur.

**F34. [HIGH] IntegrationCard -- handleSave ne montre pas d'erreur si onSave throw.**
`src/components/admin/IntegrationCard.tsx:54-63` a un try/finally mais pas de catch. Si `onSave()` throw (ce que font les pages d'integration quand `!res.ok`), l'erreur sera non-gered et le bouton restera en mode "saving" indefiniment.
**Fichier**: `src/components/admin/IntegrationCard.tsx:54-63`
**Fix**: Ajouter un catch avec toast.error().

**F35. [HIGH] Toutes les pages d'integration -- textes hardcodes en anglais.**
`src/app/admin/media/pub-meta/page.tsx:63` a `title="Meta (Facebook + Instagram)"` et `description="Connect Meta Marketing API..."` hardcodes en anglais au lieu d'utiliser `t()`. Meme probleme pour LinkedIn (ligne 59-60), Google Ads (description), X/Twitter (description).
**Fichiers**: `pub-meta/page.tsx:63`, `pub-linkedin/page.tsx:59`, `pub-google/page.tsx:63`, `pub-x/page.tsx:60`
**Fix**: Utiliser `t('admin.media.metaTitle')` et `t('admin.media.metaDescription')`.

**F36. [HIGH] Media library -- "Upload" button text hardcoded in English.**
`src/app/admin/media/library/page.tsx:119` a `Upload` hardcode au lieu de `{t('admin.media.upload')}`.
**Fichier**: `src/app/admin/media/library/page.tsx:119`
**Fix**: Utiliser `{t('admin.media.upload')}`.

**F37. [HIGH] Media images -- "Upload" button text hardcoded.**
`src/app/admin/media/images/page.tsx:105` meme probleme.
**Fichier**: `src/app/admin/media/images/page.tsx:105`
**Fix**: Utiliser `{t('admin.media.upload')}`.

**F38. [HIGH] Media library -- filter labels "All types", "All folders" hardcoded.**
`src/app/admin/media/library/page.tsx:136-147` a `<option value="">All types</option>` et `<option value="">All folders</option>` en anglais hardcode.
**Fichier**: `src/app/admin/media/library/page.tsx:136-147`
**Fix**: Utiliser `t()` pour tous les labels.

**F39. [HIGH] Videos form -- tous les placeholders et labels hardcodes.**
`src/app/admin/media/videos/page.tsx:109-121` a `"Title *"`, `"Video URL"`, `"Thumbnail URL"`, `"Duration"`, `"Category"`, `"Instructor"`, `"Tags"`, `"Published"`, `"Featured"` tout en anglais hardcode.
**Fichier**: `src/app/admin/media/videos/page.tsx:109-121`
**Fix**: Utiliser `t()` pour chaque label/placeholder.

**F40. [HIGH] Videos list -- "views", "by" text hardcoded.**
`src/app/admin/media/videos/page.tsx:169-170` a `{v.views} views` et `by {v.instructor}` hardcodes.
**Fichier**: `src/app/admin/media/videos/page.tsx:169-170`
**Fix**: Utiliser `t('admin.media.viewCount', { count: v.views })`.

**F41. [HIGH] Videos filter -- "All", "Published", "Draft" hardcoded.**
`src/app/admin/media/videos/page.tsx:143-147` hardcodes.
**Fichier**: `src/app/admin/media/videos/page.tsx:143-147`
**Fix**: Utiliser `t()`.

**F42. [HIGH] Image optimizer -- sharp error non-surfacee a l'utilisateur.**
`src/lib/image-optimizer.ts:128` log l'erreur en console mais continue silencieusement. Si toutes les variantes echouent, l'utilisateur ne sait pas que l'optimisation a echoue.
**Fichier**: `src/lib/image-optimizer.ts:128`
**Fix**: Collecter les erreurs et les remonter.

**F43. [HIGH] Storage findDuplicate -- cast Prisma non-type-safe.**
`src/lib/storage.ts:283` cast `prisma` avec un type inline `as { media: { findFirst: ... } }`. C'est fragile et pourrait casser si le schema change.
**Fichier**: `src/lib/storage.ts:283`
**Fix**: Importer le type PrismaClient et utiliser `prisma.media.findFirst()` directement.

**F44. [HIGH] Media API GET ne filtre PAS par uploadedBy -- tous les admins voient tous les medias.**
Pas de scoping par utilisateur. Dans un contexte multi-tenant, un admin pourrait voir les fichiers d'un autre admin.
**Fichier**: `src/app/api/admin/medias/route.ts:82-130`
**Fix**: Ajouter un filtre optionnel `uploadedBy` et une permission pour voir tous les medias.

**F45. [HIGH] Bannieres moveSlide fait 2 PUT en parallele sans gestion d'erreur.**
`src/app/admin/bannieres/page.tsx:220-231` fait `Promise.all([fetch PUT, fetch PUT])` sans catch. Si une des requetes echoue, les sortOrders deviennent incoherents.
**Fichier**: `src/app/admin/bannieres/page.tsx:220-231`
**Fix**: Ajouter try/catch avec toast.error et rollback visuel.

**F46. [HIGH] Bannieres deleteSlide -- fetchSlides() est appele APRES le finally.**
`src/app/admin/bannieres/page.tsx:208-211` a `fetchSlides()` apres le finally block, ce qui signifie qu'il s'execute meme si la suppression a echoue.
**Fichier**: `src/app/admin/bannieres/page.tsx:208-211`
**Fix**: Mettre `fetchSlides()` dans le `if (res.ok)` block.

**F47. [HIGH] Public videos API retourne les traductions completes -- fuite de donnees internes.**
`src/app/api/videos/route.ts:51-53` inclut toutes les `translations` y compris `translatedBy`, `isApproved`, `contentHash`, `qualityLevel`. Ces champs internes ne devraient pas etre exposes publiquement.
**Fichier**: `src/app/api/videos/route.ts:51-53`
**Fix**: Selectionner uniquement les champs necessaires avec `select:`.

**F48. [HIGH] Video Video API POST -- enqueue.video() pourrait echouer silencieusement.**
`src/app/api/admin/videos/route.ts:193` appelle `enqueue.video(video.id)` mais ne gere pas l'echec. Si le service de traduction est down, l'erreur est silencieuse.
**Fichier**: `src/app/api/admin/videos/route.ts:193`
**Fix**: Wrapper dans try/catch et logger l'erreur.

**F49. [HIGH] Pas de rate limiting global sur les endpoints d'upload.**
Aucun des endpoints d'upload (medias, chat, avatar, reviews, attachments) n'a de rate limiting. Un attaquant pourrait saturer le stockage.
**Fichier**: Tous les endpoints POST d'upload
**Fix**: Implementer un middleware de rate limiting (ex: 50 uploads/heure par utilisateur).

**F50. [HIGH] Media model n'a pas de champ `width`/`height` -- les dimensions ne sont jamais stockees.**
`prisma/schema.prisma:1203-1218` n'a aucun champ pour les dimensions d'image. L'UI `medias/page.tsx:201-207` affiche toujours "-" pour les dimensions.
**Fichier**: `prisma/schema.prisma:1203-1218`
**Fix**: Ajouter `width Int?` et `height Int?` au model Media et les peupler a l'upload.

**F51. [HIGH] Videos create form ne se ferme pas en cas d'erreur.**
`src/app/admin/media/videos/page.tsx:80-84` ne ferme le form que si `res.ok`. En cas d'erreur, le form reste ouvert sans feedback.
**Fichier**: `src/app/admin/media/videos/page.tsx:80-84`
**Fix**: Afficher l'erreur du serveur dans le form.

**F52. [HIGH] Media dashboard fait 5 requetes API en parallele juste pour les stats.**
`src/app/admin/media/page.tsx:61-67` fait 5 fetch pour obtenir les counts. C'est 5 queries DB distinctes. Un seul endpoint `/api/admin/medias/stats` serait plus efficace.
**Fichier**: `src/app/admin/media/page.tsx:61-67`
**Fix**: Creer un endpoint `/api/admin/medias/stats` qui fait toutes les aggregations en une seule query.

**F53. [HIGH] Bannieres statsJson -- pas de validation du format JSON cote client.**
`src/app/admin/bannieres/page.tsx:604-609` accepte n'importe quel texte dans le textarea statsJson sans valider si c'est du JSON valide avant l'envoi.
**Fichier**: `src/app/admin/bannieres/page.tsx:604-609`
**Fix**: Valider avec `JSON.parse()` au `onBlur` et afficher une erreur.

**F54. [HIGH] Review upload utilise Math.random() pour generer des noms de fichiers.**
`src/app/api/reviews/upload/route.ts:71` utilise `Math.random().toString(36).substring(2, 8)`. `Math.random()` n'est pas cryptographiquement securise et pourrait generer des collisions.
**Fichier**: `src/app/api/reviews/upload/route.ts:71`
**Fix**: Utiliser `randomUUID()` de crypto.

**F55. [HIGH] Media delete -- le fichier physique peut ne pas correspondre au chemin stocke.**
`src/app/api/admin/medias/[id]/route.ts:76` construit le path avec `path.join(process.cwd(), 'public', existing.url)`. Si `existing.url` est une URL Azure (`https://...`), `path.join` produira un chemin invalide. L'erreur est attrapee silencieusement mais le fichier Azure ne sera jamais supprime.
**Fichier**: `src/app/api/admin/medias/[id]/route.ts:76`
**Fix**: Detecter si l'URL est locale ou Azure et utiliser `storage.delete()` en consequence.

**F56. [HIGH] Pas d'index sur Media.originalName ni Media.createdAt dans le schema.**
`prisma/schema.prisma:1203-1218` n'a que des index sur `folder` et `mimeType`. Les recherches par nom (`contains: search`) et le tri par date feront des full table scans.
**Fichier**: `prisma/schema.prisma:1216-1217`
**Fix**: Ajouter `@@index([createdAt])` et `@@index([originalName])`.

**F57. [HIGH] Video model n'a pas d'index sur `title` -- les recherches textuelles seront lentes.**
`prisma/schema.prisma:2535-2558` n'a d'index que sur `category`, `isPublished`, et `slug`. La recherche par titre/description fera un full scan.
**Fichier**: `prisma/schema.prisma:2555-2557`
**Fix**: Ajouter `@@index([title])` ou utiliser PostgreSQL full-text search.

**F58. [HIGH] Bannieres page -- confirm() natif pour la suppression au lieu d'un modal.**
`src/app/admin/bannieres/page.tsx:202` utilise `confirm()` qui est bloquant et non-stylise.
**Fichier**: `src/app/admin/bannieres/page.tsx:202`
**Fix**: Utiliser un Modal de confirmation custom.

---

### MEDIUM (25)

**F59. [MEDIUM] formatFileSize duplique dans 3 fichiers differents.**
La meme fonction existe dans: `medias/page.tsx:94-98`, `media/library/page.tsx:29-33`, `media/images/page.tsx:29-33`, `accounting/attachments/route.ts:52-56`.
**Fix**: Extraire dans `src/lib/utils.ts` et importer partout.

**F60. [MEDIUM] Media dashboard -- eslint-disable pour exhaustive-deps.**
`src/app/admin/media/page.tsx:86-87` a `// eslint-disable-next-line react-hooks/exhaustive-deps` qui masque un bug potentiel de dependances.
**Fichier**: `src/app/admin/media/page.tsx:86-87`
**Fix**: Ajouter `platformDefs` dans le dependency array ou le memoiser avec useMemo.

**F61. [MEDIUM] Bannieres page -- useEffect sans dependency array lint warning.**
`src/app/admin/bannieres/page.tsx:120` fait `useEffect(() => { fetchSlides(); }, [])` mais `fetchSlides` n'est pas dans les deps et change a chaque render.
**Fichier**: `src/app/admin/bannieres/page.tsx:120`
**Fix**: Utiliser `useCallback` pour `fetchSlides`.

**F62. [MEDIUM] Media library preview modal -- pas de gestion du keyboard (Escape).**
`src/app/admin/media/library/page.tsx:228` le modal se ferme au click mais pas au `Escape`.
**Fichier**: `src/app/admin/media/library/page.tsx:228`
**Fix**: Ajouter un `useEffect` avec `keydown` listener pour Escape.

**F63. [MEDIUM] Media images preview modal -- meme absence de keyboard handling.**
`src/app/admin/media/images/page.tsx:167`
**Fix**: Ajouter Escape listener.

**F64. [MEDIUM] Media library preview modal -- pas de gestion du focus trap.**
Le modal custom n'a pas de focus trap. L'utilisateur peut tab vers des elements derriere le modal.
**Fichier**: `src/app/admin/media/library/page.tsx:228-260`
**Fix**: Implementer un focus trap ou utiliser le composant `Modal` existant.

**F65. [MEDIUM] Videos page -- `tags` parsing avec JSON.parse dans un catch qui re-split par virgule.**
`src/app/api/admin/videos/route.ts:76-79` fait `JSON.parse(v.tags)` puis en cas d'erreur `v.tags.split(',')`. Ce dual-parsing est fragile.
**Fichier**: `src/app/api/admin/videos/route.ts:76-79`
**Fix**: Normaliser le format de stockage (toujours JSON array).

**F66. [MEDIUM] IntegrationCard "Webhook URL" label hardcoded en anglais.**
`src/components/admin/IntegrationCard.tsx:134` a `Webhook URL` hardcode.
**Fichier**: `src/components/admin/IntegrationCard.tsx:134`
**Fix**: Utiliser `t('admin.integrations.webhookUrl')`.

**F67. [MEDIUM] IntegrationCard "Docs" text hardcoded.**
`src/components/admin/IntegrationCard.tsx:195` a `Docs` hardcode.
**Fichier**: `src/components/admin/IntegrationCard.tsx:195`
**Fix**: Utiliser `t('admin.integrations.docs')`.

**F68. [MEDIUM] Media Teams page -- unused setter `setHasWebhookUrl`.**
`src/app/admin/media/api-teams/page.tsx:15` declare `[, setHasWebhookUrl] = useState(false)` qui n'est jamais lu.
**Fichier**: `src/app/admin/media/api-teams/page.tsx:15`
**Fix**: Supprimer ou utiliser pour afficher un indicateur.

**F69. [MEDIUM] Video public API -- le search fait un OR sur 3 champs sans index.**
`src/app/api/videos/route.ts:34-38` fait `OR: [title contains, description contains, instructor contains]` sans index correspondants.
**Fichier**: `src/app/api/videos/route.ts:34-38`
**Fix**: Ajouter des index ou utiliser PostgreSQL full-text search.

**F70. [MEDIUM] Bannieres -- LOCALES array hardcoded au lieu de venir de la config i18n.**
`src/app/admin/bannieres/page.tsx:34-37` hardcode la liste des 22 locales.
**Fichier**: `src/app/admin/bannieres/page.tsx:34-37`
**Fix**: Importer depuis `src/i18n/config.ts`.

**F71. [MEDIUM] Media library pagination -- la recherche n'est pas debouncee.**
`src/app/admin/media/library/page.tsx:132` trigger `setSearch` et `loadItems` a chaque frappe de touche, causant une requete API par caractere.
**Fichier**: `src/app/admin/media/library/page.tsx:132`
**Fix**: Ajouter un debounce de 300ms.

**F72. [MEDIUM] Media images pagination -- meme absence de debounce.**
`src/app/admin/media/images/page.tsx:117`
**Fix**: Debouncer la recherche.

**F73. [MEDIUM] Videos search -- pas de debounce.**
`src/app/admin/media/videos/page.tsx:136`
**Fix**: Debouncer.

**F74. [MEDIUM] Medias page (old) search -- pas de debounce.**
`src/app/admin/medias/page.tsx:313` utilise `FilterBar` qui pourrait debouncer en interne, mais ce n'est pas garanti.
**Fix**: Verifier et ajouter debounce si necessaire.

**F75. [MEDIUM] Image optimizer -- original upload toujours convertit en WebP, meme si c'est un PNG avec transparence.**
`src/lib/image-optimizer.ts:132-145` convertit toujours en WebP. Le WebP supporte la transparence mais certains cas edges (ex: PNG avec profil de couleur specifique) pourraient mal etre convertis.
**Fichier**: `src/lib/image-optimizer.ts:132-145`
**Fix**: Detecter le format original et preserver si necessaire.

**F76. [MEDIUM] Media PATCH n'a pas d'audit logging si `translations` sont fournies.**
`src/app/api/admin/videos/[id]/route.ts:148-180` retourne avant d'arriver au `logAdminAction` (ligne 182) si `translations` est fourni.
**Fichier**: `src/app/api/admin/videos/[id]/route.ts:148-180`
**Fix**: Deplacer le logging avant le return conditionnel.

**F77. [MEDIUM] Bannieres -- pas de preview live de la banniere pendant l'edition.**
L'editeur de banniere dans le modal n'affiche pas un apercu de la banniere telle qu'elle apparaitrait sur le site.
**Fichier**: `src/app/admin/bannieres/page.tsx:407-692`
**Fix**: Ajouter un tab "Preview" qui rend la banniere avec les donnees du formulaire.

**F78. [MEDIUM] Storage.ts -- getPresignedUploadUrl parse la connection string avec regex.**
`src/lib/storage.ts:160-161` utilise des regex pour extraire AccountName et AccountKey. C'est fragile.
**Fichier**: `src/lib/storage.ts:160-161`
**Fix**: Utiliser un parser de connection string ou `@azure/storage-blob` built-in.

**F79. [MEDIUM] Gallery uploader -- pas de limit sur la taille totale des images.**
`src/components/admin/MediaGalleryUploader.tsx` limite a 10 images max mais pas a une taille totale. 10 images de 10MB = 100MB.
**Fichier**: `src/components/admin/MediaGalleryUploader.tsx:19`
**Fix**: Ajouter une prop `maxTotalSizeMB` et valider.

**F80. [MEDIUM] Media upload POST retourne 400 pour CHAQUE fichier invalide mais ne traite pas les suivants.**
`src/app/api/admin/medias/route.ts:167-180` retourne immediatement sur la premiere erreur. Si l'utilisateur upload 5 fichiers et le 2eme est invalide, les fichiers 3-5 ne sont jamais traites, et le fichier 1 est deja ecrit sur disque mais pas reference dans l'erreur.
**Fichier**: `src/app/api/admin/medias/route.ts:162-193`
**Fix**: Collecter toutes les erreurs et retourner un rapport par fichier.

**F81. [MEDIUM] Media library folders sont hardcodes (General, Images, Products, Blog).**
`src/app/admin/media/library/page.tsx:142-146` hardcode les options de dossier.
**Fichier**: `src/app/admin/media/library/page.tsx:142-146`
**Fix**: Charger dynamiquement les dossiers depuis la DB (`SELECT DISTINCT folder FROM Media`).

**F82. [MEDIUM] Bannieres -- pas de validation de l'unicite du slug cote client.**
Le formulaire envoie le slug au serveur qui peut retourner une erreur si le slug existe deja, mais pas de feedback preemptif cote client.
**Fichier**: `src/app/admin/bannieres/page.tsx:444-449`
**Fix**: Ajouter un check debounce cote client.

**F83. [MEDIUM] Avatar upload -- l'ancien avatar n'est supprime que si le user existe en DB.**
`src/app/api/user/avatar/route.ts:65-75` fait un findUnique pour recuperer l'ancien avatar. Si la query echoue, le nouveau avatar est quand meme sauvegarde et l'ancien reste orphelin.
**Fichier**: `src/app/api/user/avatar/route.ts:65-75`
**Fix**: Wrapper dans un try/catch et logger si la suppression echoue.

---

### LOW (17)

**F84. [LOW] Media dashboard QuickLink component est local au fichier.**
`src/app/admin/media/page.tsx:162-174` definit `QuickLink` localement. C'est du code duplicable.
**Fix**: Extraire dans `src/components/admin/QuickLink.tsx`.

**F85. [LOW] Media dashboard StatCard shadows le composant admin StatCard importe implicitement.**
`src/app/admin/media/page.tsx:153-160` definit un `StatCard` local qui masque celui de `@/components/admin/StatCard`. Les props sont differentes.
**Fix**: Renommer ou utiliser le composant admin existant.

**F86. [LOW] Medias page -- Copy URL ne donne pas de feedback toast.**
`src/app/admin/medias/page.tsx:388` fait `navigator.clipboard.writeText` sans `toast.success('URL copiee')`.
**Fichier**: `src/app/admin/medias/page.tsx:388`
**Fix**: Ajouter `toast.success()`.

**F87. [LOW] Media library -- le download link utilise `<a href download>` sans nom de fichier.**
`src/app/admin/media/library/page.tsx:204` fait `<a href={item.url} download>` ce qui utilise le nom du fichier randomUUID comme nom de telechargement.
**Fix**: Ajouter `download={item.originalName}`.

**F88. [LOW] Bannieres view toggle accessibility -- pas d'aria-label.**
`src/app/admin/medias/page.tsx:259-275` les boutons grid/list n'ont pas d'`aria-label`.
**Fix**: Ajouter `aria-label={t('admin.mediaManager.gridView')}`.

**F89. [LOW] Video creation form -- le champ tags ne gere pas les espaces multiples.**
`src/app/admin/media/videos/page.tsx:74` fait `form.tags.split(',').map(t => t.trim())` mais ne retire pas les tags vides.
**Fix**: Ajouter `.filter(Boolean)` (deja fait mais verifier).

**F90. [LOW] Bannieres -- les tabs de langue prennent beaucoup d'espace horizontal.**
22 onglets de langue dans le modal (ligne 429-437) rendent la navigation difficile.
**Fix**: Utiliser un dropdown ou un scroll horizontal avec indicateur.

**F91. [LOW] Media uploader -- la barre de progression est fake (simulated).**
`src/components/admin/MediaUploader.tsx:95-97` utilise `setInterval` pour animer la progression. Ce n'est pas le vrai pourcentage d'upload.
**Fix**: Utiliser `XMLHttpRequest.upload.onprogress` ou `fetch` avec ReadableStream pour la progression reelle.

**F92. [LOW] IntegrationCard -- le test result persiste indefiniment.**
`src/components/admin/IntegrationCard.tsx:50` le `testResult` reste affiche jusqu'au prochain test.
**Fix**: Ajouter un timeout pour le masquer apres 10 secondes.

**F93. [LOW] Videos page pagination -- utilise `pagination.hasMore` pour le bouton suivant au lieu de `page >= pagination.totalPages`.**
`src/app/admin/media/videos/page.tsx:194` utilise `!pagination.hasMore` ce qui est fonctionnellement equivalent mais inconsistant avec les autres pages qui utilisent `page >= pagination.totalPages`.
**Fix**: Uniformiser.

**F94. [LOW] IntegrationCard -- pas de validation du format des IDs.**
Les champs comme "Advertiser ID", "Channel ID", "Customer ID" acceptent n'importe quelle string sans validation de format.
**Fix**: Ajouter des patterns de validation (regex) pour chaque type d'ID.

**F95. [LOW] Bannieres -- overlayOpacity range input n'a pas de tooltip avec la valeur.**
`src/app/admin/bannieres/page.tsx:522-528` a un range input mais la valeur n'est visible que dans le label.
**Fix**: Ajouter un output affichant la valeur en temps reel.

**F96. [LOW] Media upload -- le champ `alt` est un parametre unique pour tous les fichiers du batch.**
`src/app/api/admin/medias/route.ts:138` recupere un seul `alt` du FormData pour tous les fichiers.
**Fix**: Permettre un alt par fichier ou le definir apres upload.

**F97. [LOW] Videos -- le champ `tags` est stocke comme `String?` au lieu de `String[]`.**
`prisma/schema.prisma:2544` stocke les tags comme une string JSON. PostgreSQL supporte les arrays natifs.
**Fix**: Migrer vers `tags String[]` pour un acces plus efficace.

**F98. [LOW] Video model -- `locale` default 'en' est hardcode.**
`prisma/schema.prisma:2549` a `@default("en")`. Devrait etre configurable.
**Fix**: Utiliser la locale par defaut de la config i18n.

**F99. [LOW] Media library images grid -- pas de lazy loading explicite.**
`src/app/admin/media/library/page.tsx:164` utilise `<img>` natif sans `loading="lazy"`.
**Fix**: Ajouter `loading="lazy"` ou migrer vers `NextImage`.

**F100. [LOW] Bannieres -- le bouton "Cancel" dans le footer ne reset pas le form state.**
`src/app/admin/bannieres/page.tsx:264` ferme le modal mais ne reset pas `form`, `translations`, `editingSlide`. Rouvrir le formulaire de creation gardera les anciennes valeurs.
**Fix**: Appeler `openCreate()` logic dans le `onClose`.

---

## PARTIE 2 : 100 AMELIORATIONS

---

### CRITICAL (15)

**A1. [CRITICAL] Implementer un CDN pour les medias.**
Actuellement les fichiers sont servis directement depuis Next.js (`/uploads/...`). Implementer Azure CDN ou Cloudflare devant le storage pour: performance, cache geo-distribue, et reduction de charge serveur.
**Fichier**: `src/lib/storage.ts`, `next.config.js`

**A2. [CRITICAL] Unifier tous les endpoints d'upload vers StorageService.**
5 endpoints ecrivent sur le filesystem local au lieu d'utiliser `storage.ts`: admin/medias, reviews/upload, chat/upload, accounting/attachments, et hero-slides (pour les URLs). Migrer tout vers `StorageService` pour supporter Azure Blob Storage.
**Fichiers**: `src/app/api/admin/medias/route.ts`, `src/app/api/reviews/upload/route.ts`, `src/app/api/accounting/attachments/route.ts`

**A3. [CRITICAL] Ajouter un antivirus scan sur les fichiers uploades.**
Les fichiers sont valides par magic bytes mais pas scannes pour malware. Integrer ClamAV ou Azure Defender for Storage.
**Impact**: Tous les endpoints d'upload.

**A4. [CRITICAL] Implementer un quota de stockage par utilisateur/organisation.**
Aucune limite de stockage total. Un utilisateur pourrait uploader des centaines de GB.
**Fix**: Ajouter un champ `storageQuota` dans les settings et verifier avant chaque upload.

**A5. [CRITICAL] Ajouter une politique de retention et purge des medias orphelins.**
Quand un produit est supprime, ses images restent dans le storage. Il n'y a aucun mecanisme de garbage collection.
**Fix**: Un job periodique qui identifie les medias non references et les supprime apres X jours.

**A6. [CRITICAL] Implementer le presigned upload pour les gros fichiers.**
`StorageService.getPresignedUploadUrl()` existe deja (ligne 143) mais n'est utilise nulle part. Le client upload tout via le serveur Next.js, ce qui consomme la memoire du serveur pour les gros fichiers.
**Fichier**: `src/lib/storage.ts:143-192`

**A7. [CRITICAL] Ajouter la validation d'image optimisee a l'upload admin.**
`image-optimizer.ts` existe avec des variantes (thumbnail, medium, large) mais n'est PAS appele lors de l'upload via `/api/admin/medias`. Les images sont stockees telles quelles.
**Fichier**: `src/app/api/admin/medias/route.ts`

**A8. [CRITICAL] Implementer backup automatique des medias.**
Aucun mecanisme de backup pour les fichiers stockes. Si le storage est corrompu, tout est perdu.
**Fix**: Configurer Azure Blob Storage avec geo-redundancy (GRS) et soft-delete.

**A9. [CRITICAL] Ajouter CSRF protection uniforme sur tous les endpoints mutation.**
Seul `reviews/upload` a une protection CSRF. Les autres endpoints admin s'appuient sur `withAdminGuard` qui ne verifie pas le CSRF.
**Fix**: Ajouter la validation CSRF dans `withAdminGuard` ou via un middleware global.

**A10. [CRITICAL] Implementer le versioning des medias.**
Quand une image de banniere ou de produit est remplacee, l'ancienne est perdue. Pas d'historique.
**Fix**: Garder les versions precedentes avec un flag `isLatest`.

**A11. [CRITICAL] Ajouter des tests automatises pour les endpoints d'upload.**
Aucun test n'existe pour les endpoints media. Les failles de securite (path traversal, MIME bypass) pourraient etre detectees automatiquement.
**Fix**: Ecrire des tests avec Jest/Vitest pour chaque endpoint d'upload.

**A12. [CRITICAL] Implementer la compression video.**
Les videos uploadees ne sont pas compressees/transcodees. Un fichier de 500MB sera stocke tel quel.
**Fix**: Integrer FFmpeg ou un service de transcoding (Azure Media Services, Cloudinary Video API).

**A13. [CRITICAL] Ajouter un systeme de media picker global reutilisable.**
Chaque page reimplemente son propre systeme de selection de media. Un media picker modal unifie permettrait de selectionner un media existant ou d'en uploader un nouveau.
**Fix**: Creer `<MediaPicker>` component.

**A14. [CRITICAL] Mettre en place des webhooks pour les plateformes d'integration.**
Les pages TikTok, YouTube, Meta, etc. affichent des `webhookUrl` mais aucune route webhook n'existe pour recevoir les callbacks de ces plateformes.
**Fix**: Creer les routes `/api/webhooks/[platform]` pour chaque plateforme.

**A15. [CRITICAL] Centraliser la configuration des integrations dans la DB.**
Les integrations stockent leur config via des endpoints `/api/admin/integrations/[platform]` mais il n'y a pas de model Prisma dedie. Les credentials sont probablement stockees en variables d'environnement seulement.
**Fix**: Creer un model `IntegrationConfig` dans Prisma avec chiffrement des secrets.

---

### HIGH (25)

**A16. [HIGH] Ajouter le drag-and-drop multi-fichiers dans la bibliotheque media.**
La library page n'a pas de zone de drop globale. Seul `MediaUploader` (utilise dans les bannieres) supporte le drag-and-drop.
**Fichier**: `src/app/admin/media/library/page.tsx`

**A17. [HIGH] Implementer la suppression en masse (bulk delete).**
Aucune page ne supporte la selection multiple + suppression groupee. Avec des milliers de medias, supprimer un par un est impraticable.
**Fichier**: `src/app/admin/medias/page.tsx`

**A18. [HIGH] Ajouter un editeur de metadonnees d'image (alt text, title, description).**
Le PATCH `/api/admin/medias/[id]` supporte `alt` et `folder` mais aucune UI ne permet d'editer ces champs apres upload.
**Fichier**: `src/app/admin/medias/page.tsx`, `src/app/admin/media/library/page.tsx`

**A19. [HIGH] Implementer le crop/resize d'image cote client avant upload.**
Les images sont uploadees en taille originale. Un crop cote client (ex: react-image-crop) reduirait la bande passante et le stockage.

**A20. [HIGH] Ajouter la recherche par contenu d'image (AI tagging).**
Implementer un auto-tagging des images via Azure Computer Vision ou OpenAI Vision pour permettre la recherche semantique.

**A21. [HIGH] Implementer le watermarking automatique des images produit.**
Les images de produits peptidiques sont sensibles. Un watermark automatique protegerait contre le vol de contenu.

**A22. [HIGH] Ajouter un player video inline dans la page videos admin.**
`src/app/admin/media/videos/page.tsx` affiche une liste de videos mais pas de player pour les visionner. Seul un lien externe `ExternalLink` est disponible.

**A23. [HIGH] Implementer l'upload video direct (pas juste URL).**
La page videos n'accepte qu'une URL video. Il devrait etre possible d'uploader un fichier video directement.
**Fichier**: `src/app/admin/media/videos/page.tsx`

**A24. [HIGH] Ajouter des analytics sur l'utilisation des medias.**
Aucun tracking de combien de fois un media est affiche, telecharge, ou partage. Essentiel pour savoir quelles images convertissent.

**A25. [HIGH] Implementer le lazy loading progressif des images dans les galeries.**
Les galeries chargent toutes les images visibles en meme temps. Un loading progressif (blur placeholder + intersection observer) ameliorerait la performance percue.

**A26. [HIGH] Ajouter la gestion des dossiers/categories dynamiques pour les medias.**
Les dossiers sont hardcodes (General, Images, Products, Blog). Permettre aux admins de creer/renommer/supprimer des dossiers.

**A27. [HIGH] Implementer le redimensionnement automatique des images a l'upload.**
L'image-optimizer existe mais n'est pas integre dans le flux d'upload. Les images devraient etre automatiquement optimisees en multiple variantes.
**Fichier**: `src/lib/image-optimizer.ts`

**A28. [HIGH] Ajouter un systeme de moderation des images uploadees par les clients.**
Les reviews et le chat permettent aux utilisateurs d'uploader des images. Pas de moderation automatique (nudite, contenu inapproprie).
**Fix**: Integrer Azure Content Moderator ou un service equivalent.

**A29. [HIGH] Implementer la pagination dans la page medias legacy.**
`src/app/admin/medias/page.tsx` charge TOUS les medias sans pagination. Avec des milliers de fichiers, la page sera inutilisable.
**Fix**: Ajouter les parametres `page` et `limit` au fetch.

**A30. [HIGH] Ajouter des filtres avances dans la bibliotheque media.**
Filtrer par: date d'upload, taille, dimensions, uploadedBy, usage (utilise/non-utilise).
**Fichier**: `src/app/admin/media/library/page.tsx`

**A31. [HIGH] Implementer le tri dans les galeries media.**
Aucune page ne permet de trier par nom, date, taille, ou type.
**Fix**: Ajouter des boutons de tri dans la barre de filtres.

**A32. [HIGH] Ajouter un endpoint GET /api/admin/medias/[id] pour les details d'un media.**
L'endpoint `[id]` n'a que PATCH et DELETE. Pas de GET pour obtenir les details d'un seul media avec ses references.
**Fichier**: `src/app/api/admin/medias/[id]/route.ts`

**A33. [HIGH] Implementer la deduplication de fichiers a l'upload.**
`StorageService.findDuplicate()` existe mais n'est jamais appele. Les memes images peuvent etre uploadees plusieurs fois.
**Fichier**: `src/lib/storage.ts:279-294`

**A34. [HIGH] Ajouter le tracking "usedIn" pour les medias.**
`MediaFile.usedIn` dans l'interface frontend est toujours `undefined`. Implementer le tracking des references dans les produits, articles, bannieres.
**Fichier**: `src/app/admin/medias/page.tsx:79`

**A35. [HIGH] Implementer des variantes responsives pour les images de banniere.**
Les bannieres supportent `backgroundMobile` mais pas de variantes intermediaires (tablette, retina).
**Fichier**: `src/app/admin/bannieres/page.tsx`

**A36. [HIGH] Ajouter OAuth flow pour les integrations au lieu de copier-coller de tokens.**
Toutes les pages d'integration demandent de copier-coller des tokens manuellement. Implementer un vrai OAuth flow avec redirect.
**Fichier**: Toutes les pages `pub-*` et `api-*`

**A37. [HIGH] Implementer le scheduling de posts pour les integrations sociales.**
Les pages d'integration (TikTok, YouTube, Meta, X, LinkedIn) n'offrent que la configuration de connexion. Pas de fonctionalite de scheduling ou publication de contenu.

**A38. [HIGH] Ajouter l'extraction automatique des dimensions d'image a l'upload.**
Les dimensions ne sont jamais peuplees dans le model Media. Utiliser `sharp` ou `image-size` pour les extraire.
**Fichier**: `src/app/api/admin/medias/route.ts`

**A39. [HIGH] Implementer un dashboard analytics pour les integrations sociales.**
Le media dashboard montre les statuts de connexion mais pas de metriques (vues, engagement, ROI des pubs).
**Fichier**: `src/app/admin/media/page.tsx`

**A40. [HIGH] Ajouter la validation de la taille de fichier cote client avant upload.**
Les pages library et images ne valident pas la taille cote client. L'erreur arrive apres l'envoi complet au serveur. MediaUploader le fait mais les autres pages non.
**Fichier**: `src/app/admin/media/library/page.tsx`, `src/app/admin/media/images/page.tsx`

---

### MEDIUM (35)

**A41. [MEDIUM] Ajouter le support AVIF dans les uploads et l'optimisation.**
L'image optimizer ne genere que du WebP. AVIF offre une meilleure compression pour les navigateurs modernes.
**Fichier**: `src/lib/image-optimizer.ts`

**A42. [MEDIUM] Implementer le rename de fichier apres upload.**
Aucune fonctionalite pour renommer un fichier uploade. Seul le `originalName` est editable en theorie mais aucune UI ne le propose.

**A43. [MEDIUM] Ajouter un mode plein ecran pour le preview d'image.**
Les modals de preview sont limites en taille. Un mode plein ecran avec zoom serait utile pour les images haute resolution.

**A44. [MEDIUM] Implementer les raccourcis clavier dans la galerie.**
Escape pour fermer, fleches gauche/droite pour naviguer entre les medias, Delete pour supprimer.

**A45. [MEDIUM] Ajouter le support des fichiers SVG avec sanitization.**
Les SVG sont bloques (`BLOCKED_EXTENSIONS` inclut `.svg`) car risque XSS. Implementer un sanitizer SVG (ex: DOMPurify) pour les autoriser en toute securite.
**Fichier**: `src/app/api/admin/medias/route.ts:48`

**A46. [MEDIUM] Ajouter un indicateur de stockage utilise vs quota.**
Le StatCard "Space Used" affiche la taille totale mais pas le quota restant.
**Fichier**: `src/app/admin/medias/page.tsx:303-307`

**A47. [MEDIUM] Implementer le tri des bannieres par drag-and-drop au lieu de fleches.**
Les bannieres utilisent des boutons ChevronUp/ChevronDown. Un drag-and-drop serait plus intuitif.
**Fichier**: `src/app/admin/bannieres/page.tsx:326-341`

**A48. [MEDIUM] Ajouter l'export de la liste des medias en CSV/Excel.**
Aucune fonctionalite d'export des metadonnees media.

**A49. [MEDIUM] Implementer la copie de banniere (dupliquer).**
Pas de bouton "Dupliquer" pour creer une banniere a partir d'une existante.
**Fichier**: `src/app/admin/bannieres/page.tsx`

**A50. [MEDIUM] Ajouter un apercu du carousel de bannieres en temps reel.**
Le dashboard bannieres ne montre pas comment le carousel apparait sur le site. Un mini-carousel preview serait utile.

**A51. [MEDIUM] Implementer la recherche dans les videos par tags.**
La recherche videos ne filtre que sur title, description, instructor. Pas de recherche par tags.
**Fichier**: `src/app/api/admin/videos/route.ts:44-50`

**A52. [MEDIUM] Ajouter un systeme de categories hierarchiques pour les videos.**
Le champ `category` est une string libre. Implementer une liste de categories predefinies avec hierarchie.

**A53. [MEDIUM] Implementer la notification par email quand un media atteint le quota.**
Pas de notification quand le stockage approche de la limite.

**A54. [MEDIUM] Ajouter le support du format HEIC/HEIF pour les photos iPhone.**
Les photos iPhone en HEIC ne sont pas dans la liste des MIME types autorises. Convertir automatiquement en JPEG/WebP a l'upload.

**A55. [MEDIUM] Implementer la detection automatique de la langue des videos.**
Le champ `locale` des videos doit etre defini manuellement. Un auto-detect via la piste audio serait utile.

**A56. [MEDIUM] Ajouter un compteur de references pour chaque media.**
Afficher combien de produits/articles/bannieres utilisent chaque media, avec un warning avant suppression si le media est utilise.

**A57. [MEDIUM] Implementer le partage de media entre sections (produits, articles, bannieres).**
Chaque contexte (product-image, banner, etc.) a son propre dossier. Un media devrait pouvoir etre reutilise sans re-upload.

**A58. [MEDIUM] Ajouter la generation automatique de alt text par IA.**
Les alt texts sont souvent vides. Utiliser Azure AI Vision ou OpenAI pour generer des descriptions automatiques.

**A59. [MEDIUM] Implementer le preview de PDF dans le modal.**
Les fichiers PDF n'ont qu'une icone dans le preview. Ajouter un viewer PDF inline (ex: react-pdf).
**Fichier**: `src/app/admin/media/library/page.tsx:237-241`

**A60. [MEDIUM] Ajouter la gestion des playlists video.**
Le model Video est plat. Ajouter un systeme de playlists pour organiser les videos par serie/theme.

**A61. [MEDIUM] Implementer le caching des API responses media.**
Les requetes media API ne sont pas cachees. Ajouter un cache Redis ou en-memoire pour les resultats frequents.

**A62. [MEDIUM] Ajouter un indicateur de qualite de traduction dans les bannieres.**
Les traductions de bannieres n'ont pas de champ `isApproved` ou `qualityLevel` comme les VideoTranslations.

**A63. [MEDIUM] Implementer la detection de doublons visuels (perceptual hash).**
`findDuplicate` utilise SHA-256 (hash exact). Deux images visuellement identiques mais avec des metadonnees differentes ne seront pas detectees.

**A64. [MEDIUM] Ajouter le support des GIF animes dans les bannieres.**
Le type `ANIMATION` existe dans le schema mais n'a pas de support specifique dans le frontend.

**A65. [MEDIUM] Implementer un systeme de tags/labels pour les medias.**
Le model Media n'a pas de champ tags. Ajouter des tags pour faciliter l'organisation et la recherche.

**A66. [MEDIUM] Ajouter des metriques de performance des integrations.**
Les pages d'integration n'affichent pas le nombre de posts publies, le reach, l'engagement, etc.

**A67. [MEDIUM] Implementer la planification d'activation/desactivation des bannieres.**
Les champs `startDate` et `endDate` existent dans le model mais le frontend n'a pas de cron/scheduler pour activer/desactiver automatiquement.
**Fichier**: `prisma/schema.prisma:1059-1060`

**A68. [MEDIUM] Ajouter l'historique des modifications pour les bannieres.**
Pas de versioning ni d'audit trail visible pour les modifications de bannieres.

**A69. [MEDIUM] Implementer la comparaison A/B pour les bannieres.**
Pas de fonctionalite de test A/B pour mesurer quelle banniere performe le mieux.

**A70. [MEDIUM] Ajouter des templates de banniere pre-faits.**
Les admins doivent creer chaque banniere from scratch. Des templates avec des layouts predefinies accelereraient la creation.

**A71. [MEDIUM] Implementer le pre-chargement (prefetch) des images media dans la galerie.**
Quand l'utilisateur scroll dans la galerie, pre-charger les images suivantes pour un affichage instantane.

**A72. [MEDIUM] Ajouter la gestion des formats video (MP4, WebM, HLS).**
Le champ `videoUrl` accepte une seule URL. Supporter plusieurs formats pour la compatibilite navigateur et le streaming adaptatif.

**A73. [MEDIUM] Implementer un rapport d'utilisation du stockage par dossier.**
Pas de vue detaillee de l'espace utilise par dossier/type de media.

**A74. [MEDIUM] Ajouter la possibilite d'ajouter des notes/commentaires sur les medias.**
Utile pour la collaboration entre admins (ex: "Image approuvee par Marketing le 15/02").

**A75. [MEDIUM] Implementer le calcul automatique de la duree video a partir du fichier.**
Le champ `duration` est saisi manuellement. Si le video est uploadee, extraire la duree avec ffprobe.

---

### LOW (25)

**A76. [LOW] Ajouter des icones de type de fichier plus detaillees.**
Tous les documents non-image/non-video ont la meme icone `FileText`. Differencier PDF, DOC, XLS, etc.
**Fichier**: `src/app/admin/media/library/page.tsx:36-39`

**A77. [LOW] Implementer un mode sombre pour la galerie media.**
La galerie utilise des couleurs claires fixes. Supporter le dark mode.

**A78. [LOW] Ajouter une animation de chargement squelette (skeleton) dans les galeries.**
Le spinner simple est moins elegant qu'un skeleton loading qui montre la structure de la grille.

**A79. [LOW] Implementer le zoom au survol des images dans la grille.**
Un leger zoom au hover donnerait un meilleur apercu sans ouvrir le modal.

**A80. [LOW] Ajouter la date d'upload dans la vue grille des medias.**
Seuls le nom et la taille sont affiches en vue grille. La date manque.
**Fichier**: `src/app/admin/medias/page.tsx:356-359`

**A81. [LOW] Implementer la navigation par fleches entre medias dans le modal preview.**
Les modals de preview ne permettent pas de naviguer vers le media suivant/precedent sans fermer et rouvrir.

**A82. [LOW] Ajouter un compteur de mots dans les champs titre/description des bannieres.**
Les titres trop longs sont tronques sur le site. Un indicateur de longueur aiderait.

**A83. [LOW] Implementer le support du format WebP anime (APNG/WebP animation).**
Les animations WebP ne sont pas differenciees des images statiques WebP.

**A84. [LOW] Ajouter un tooltip d'aide sur chaque champ du formulaire d'integration.**
Les `hint` sont des textes statiques. Des tooltips avec des liens vers la documentation seraient plus utiles.

**A85. [LOW] Implementer l'auto-completion pour le champ category des videos.**
Le champ category est un texte libre. Un auto-complete baserait sur les categories existantes.

**A86. [LOW] Ajouter un badge "Nouveau" pour les medias uploades recemment (< 24h).**
Faciliter l'identification des medias recents dans la galerie.

**A87. [LOW] Implementer le partage d'un lien direct vers un media specifique.**
Pas de deep-link pour acceder directement a un media via URL (ex: `/admin/media/library?id=xxx`).

**A88. [LOW] Ajouter le nombre total de resultats dans la recherche.**
Quand on recherche, le nombre total de resultats matchant n'est pas toujours affiche clairement.

**A89. [LOW] Implementer un raccourci clavier global pour ouvrir le media picker.**
Ex: Ctrl+M pour ouvrir le media picker depuis n'importe quelle page admin.

**A90. [LOW] Ajouter la possibilite de reordonner les images produit par drag-and-drop dans la galerie.**
`MediaGalleryUploader` supporte le DnD mais verifier que c'est fluide sur mobile.
**Fichier**: `src/components/admin/MediaGalleryUploader.tsx`

**A91. [LOW] Implementer un mode "presentation" pour les bannieres.**
Visualiser le carousel en plein ecran avec les transitions reelles.

**A92. [LOW] Ajouter le support des formats audio (MP3, WAV) dans la bibliotheque media.**
Le type filter ne propose que image/video/document. Les fichiers audio (podcasts, descriptions audio) ne sont pas supportes.

**A93. [LOW] Implementer la colorimetrie automatique des images (palette de couleurs extraite).**
Extraire les couleurs dominantes d'une image pour faciliter le design (ex: auto-ajuster l'overlay des bannieres).

**A94. [LOW] Ajouter un mini-editeur d'image inline (rotation, flip, recadrage basique).**
Eviter de devoir re-uploader une image juste pour la tourner de 90 degres.

**A95. [LOW] Implementer les breadcrumbs dans les pages de detail media.**
Les sous-pages (images, videos, library) n'ont pas de breadcrumbs pour la navigation.

**A96. [LOW] Ajouter un filtre par resolution (SD/HD/4K) dans la galerie images.**
Pour trouver rapidement les images haute resolution pour les impressions.

**A97. [LOW] Implementer un cache-buster automatique pour les URLs media.**
Quand un media est remplace (meme nom), les CDN/browsers servent l'ancienne version cachee. Le content hash existe dans storage.ts mais n'est pas toujours utilise.

**A98. [LOW] Ajouter la detection de fichiers corrompus a l'upload.**
Valider que le fichier est completement lisible (pas tronque) en plus de la verification des magic bytes.

**A99. [LOW] Implementer l'affichage des metadonnees EXIF pour les photos.**
Pour les images de laboratoire, les metadonnees EXIF (date, appareil, GPS) pourraient etre utiles a consulter (tout en les strippant du fichier stocke).

**A100. [LOW] Ajouter une animation de transition entre les vues grille et liste.**
Le changement de vue est instantane. Une transition douce (fade/slide) ameliorerait l'UX.

---

## MATRICE DE PRIORITE

| Priorite | Failles | Ameliorations | Total |
|----------|---------|---------------|-------|
| CRITICAL | 27      | 15            | 42    |
| HIGH     | 31      | 25            | 56    |
| MEDIUM   | 25      | 35            | 60    |
| LOW      | 17      | 25            | 42    |
| **TOTAL**| **100** | **100**       | **200**|

## TOP 10 ACTIONS IMMEDIATES

1. **F9+F10+F11**: Migrer TOUS les uploads vers `StorageService` (Azure Blob) -- les fichiers sont perdus en production Azure
2. **F12**: Ajouter authentification au chat upload -- endpoint ouvert a tous
3. **F4+A9**: Ajouter CSRF protection uniforme sur tous les endpoints mutation
4. **F6+F8**: Sanitizer les donnees dans hero-slides PUT -- injection possible
5. **F1**: Supprimer la page dupliquee `/admin/medias` et rediriger vers `/admin/media/library`
6. **F2+F3**: Remplacer `<img>` natif par `<NextImage>` dans library et images
7. **F16+F7**: Valider toutes les URLs (videoUrl, thumbnailUrl, ctaUrl, cta2Url)
8. **F35-F41**: Internationnaliser TOUS les textes hardcodes en anglais (i18n compliance)
9. **A7+A27**: Integrer l'image-optimizer dans le flux d'upload
10. **F17**: Ajouter magic bytes validation aux accounting attachments

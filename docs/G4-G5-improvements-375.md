# G4 Content & Communication + G5 Operations & Config
# 375 Ameliorations (25 par element de menu)
# Analyse basee sur le code reel du projet peptide-plus

---

## 1. MEDIAS (`src/app/admin/medias/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Upload factice - aucun fichier n'est reellement envoye au serveur.** `handleUpload()` (ligne 107-116) fait `await new Promise(r => setTimeout(r, 1500))` -- un simple `setTimeout` simule l'upload. Aucun `FormData`, aucun `fetch POST` vers l'API `/api/admin/medias`. Le bouton Upload est un leurre complet. **Fix**: implementer un vrai `POST /api/admin/medias` avec `FormData` multipart et appeler `fetchFiles()` apres.

2. **[C2] Suppression cote client uniquement, pas persistee.** `deleteFile()` (ligne 118-122) fait `setFiles(files.filter(...))` sans aucun `fetch DELETE` vers `/api/admin/medias/[id]`. Au prochain rechargement, le fichier reapparait. **Fix**: ajouter `await fetch('/api/admin/medias/${id}', { method: 'DELETE' })` avant la mise a jour du state.

3. **[C3] Pas de validation du type/taille de fichier a l'upload.** L'attribut `accept="image/*,video/*,.pdf"` (ligne 210) est purement cosmetic (contournable). Aucune verification cote serveur du MIME type, de la taille maximale, ou du contenu. **Fix**: valider cote serveur le MIME type (whitelist), limiter la taille (ex: 50MB), scanner les fichiers uploades.

4. **[C4] Vulnerability XSS via les noms de fichiers.** `file.name` est affiche directement dans le DOM (ligne 146, 316) sans sanitization. Un nom de fichier malicieux avec `<script>` ou `onerror=` dans un attribut pourrait executer du JS. **Fix**: sanitizer tous les noms de fichiers (echapper HTML, retirer les caracteres speciaux).

5. **[C5] Images externes non validees rendues avec `unoptimized`.** `NextImage` est utilise avec `unoptimized` (ligne 308, 368) et les URLs proviennent de la DB sans validation. Un attaquant pourrait injecter une URL malicieuse. **Fix**: valider les URLs d'images, utiliser un domaine whitelist dans `next.config.js` images.domains.

### HIGH
6. **[H1] Aucune pagination.** Tous les fichiers sont charges d'un coup (`fetchFiles` ligne 55). Avec des milliers de medias, la page sera inutilisable. **Fix**: implementer pagination cote API (offset/limit) et composant de pagination.

7. **[H2] Pas de drag-and-drop pour l'upload.** L'upload se fait uniquement via un `<input type="file">` cache (ligne 205-211). **Fix**: ajouter une zone de drop avec `onDragOver`/`onDrop` pour une meilleure UX.

8. **[H3] Aucune gestion d'erreurs utilisateur.** Les erreurs fetch sont logguees dans `console.error` (ligne 84) sans feedback utilisateur. **Fix**: ajouter `toast.error()` avec message i18n.

9. **[H4] Pas de bulk operations.** Impossible de selectionner plusieurs fichiers pour supprimer/deplacer. **Fix**: ajouter des checkboxes et une barre d'actions groupees.

10. **[H5] Les dimensions d'image ne sont jamais peuplees.** `dimensions` est toujours `undefined` (ligne 76) malgre l'existence d'une colonne dediee dans l'interface et le tableau. **Fix**: extraire les dimensions a l'upload (via `sharp` ou `image-size` cote serveur).

### MEDIUM
11. **[M1] Aucun tri des fichiers.** Pas de possibilite de trier par nom, date, taille ou type. **Fix**: ajouter `sortField`/`sortDirection` au state et logique de tri.

12. **[M2] `usedIn` jamais peuple.** Le champ d'utilisation (ligne 78, 172-174) affiche toujours `-`. **Fix**: tracker les references de medias dans les produits/articles et peupler ce champ.

13. **[M3] Pas de rename de fichier.** Aucune fonctionnalite pour renommer un fichier apres upload. **Fix**: ajouter un champ editable dans le modal de detail.

14. **[M4] Pas de support des dossiers/folders.** Tous les fichiers sont dans un seul niveau. **Fix**: ajouter une hierarchie de dossiers pour organiser les medias.

15. **[M5] Pas d'optimisation automatique des images.** Les images sont stockees telles quelles sans compression/redimensionnement. **Fix**: integrer `sharp` pour generer des thumbnails et versions optimisees.

### LOW
16. **[L1] Le `Copy` import (ligne 15) est importe mais le bouton copie l'URL sans feedback visuel.** **Fix**: ajouter `toast.success('URL copiee')` apres `navigator.clipboard.writeText`.

17. **[L2] Pas de preview video dans le modal.** Seules les images ont un preview (ligne 367-369). **Fix**: ajouter un `<video>` player pour les fichiers video.

18. **[L3] Accessibilite: boutons grid/list sans `aria-label`.** Les boutons toggle de vue (ligne 218-234) n'ont pas d'attribut `aria-label`. **Fix**: ajouter `aria-label={t('admin.mediaManager.gridView')}`.

19. **[L4] Pas de date de creation affichee en vue grid.** Seul le nom et la taille sont visibles. **Fix**: ajouter la date `uploadedAt` sous la taille.

20. **[L5] Pas de raccourci clavier pour la navigation.** **Fix**: supporter Escape pour fermer le modal, fleches pour naviguer entre fichiers.

21. **[L6] Pas de support du format WebP/AVIF.** L'accept du file input ne mentionne pas ces formats modernes. **Fix**: etendre l'accept et la whitelist.

22. **[L7] Le formatFileSize est reimplemente localement.** **Fix**: extraire dans un utilitaire partage `src/lib/utils.ts`.

23. **[L8] Pas d'indication visuelle de loading lors du delete.** **Fix**: ajouter un state de loading par fichier.

24. **[L9] La stat "Space Used" pourrait afficher la capacite restante si un quota est defini.** **Fix**: ajouter un quota configurable et afficher la progression.

25. **[L10] Pas de recherche par metadata (EXIF, dimensions, date).** **Fix**: etendre le filtre pour inclure les metadonnees.

---

## 2. EMAILS (`src/app/admin/emails/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le bouton Save des settings (ligne 369) n'appelle aucune API.** `<Button variant="primary" icon={Save}>` n'a pas de `onClick`. Les settings SMTP ne sont jamais persistees. **Fix**: ajouter un handler `handleSaveSettings()` qui POST vers `/api/admin/settings`.

2. **[C2] Le bouton "Send Test" (ligne 210-212) n'a pas de onClick.** Le bouton est purement decoratif. **Fix**: implementer un `onClick` qui appelle `/api/admin/emails/send` avec un email test.

3. **[C3] Le toggle template active/desactive n'est pas persiste.** `toggleTemplate()` (ligne 124-126) ne fait qu'un `setState` local. Au rechargement, l'etat revient a l'original. **Fix**: appeler `PATCH /api/admin/emails/${id}` avec `{ isActive }`.

4. **[C4] Le bouton Save et Preview dans le modal d'edition (ligne 383-389) n'ont pas de onClick.** L'edition de template est purement visuelle. **Fix**: implementer la sauvegarde via `PUT /api/admin/emails/${id}` et un apercu rendu HTML.

5. **[C5] XSS dans le rendu des templates.** Le `content` HTML des templates (ligne 398-403) est affiche dans un `<Textarea>` mais si un preview HTML etait implemente, le contenu non sanitize pourrait executer du JS. **Fix**: utiliser DOMPurify pour sanitizer le HTML avant tout rendu.

### HIGH
6. **[H1] Pas de variable templates.** Les templates email n'ont pas de systeme de variables ({{orderNumber}}, {{customerName}}). **Fix**: implementer un moteur de templates avec variables predifinies.

7. **[H2] L'editeur de template est un simple `<Textarea>`.** Editer du HTML brut est error-prone. **Fix**: integrer un editeur WYSIWYG (react-email, unlayer) ou au minimum un CodeMirror pour la coloration syntaxique.

8. **[H3] Les checkboxes d'automatisation (ligne 354-365) n'ont pas de handler onChange persiste.** Cocher/decocher ne sauvegarde rien. **Fix**: ajouter un handler qui appelle l'API settings.

9. **[H4] Les logs ne sont pas pagines.** Tous les logs sont charges en une seule requete. **Fix**: implementer pagination avec offset/limit.

10. **[H5] Pas de filtre par date pour les logs.** **Fix**: ajouter un date range picker.

### MEDIUM
11. **[M1] Le type de template est derive du nom par heuristique.** Ligne 94: `(t.name).toUpperCase().replace(/\s+/g, '_')` est fragile. **Fix**: stocker le type explicitement en DB.

12. **[M2] Pas de duplication de template.** **Fix**: ajouter un bouton "Dupliquer" pour creer un template a partir d'un existant.

13. **[M3] La stat "emailsSent24h" (ligne 228) montre le total, pas les dernieres 24h.** **Fix**: filtrer les logs par date dans le calcul.

14. **[M4] Le success rate (ligne 237) peut produire NaN si 0 sent + 0 failed.** Le `|| 0` rattrape mais affiche "0.0%" au lieu de "N/A". **Fix**: gerer le cas edge explicitement.

15. **[M5] Pas de retry pour les emails echoues.** **Fix**: ajouter un bouton "Renvoyer" sur les logs en FAILED.

### LOW
16. **[L1] Pas de recherche dans les logs.** **Fix**: ajouter un champ de recherche par email, sujet ou template.

17. **[L2] Le select SMTP provider (ligne 333-337) n'est pas bind a un state.** **Fix**: controller le composant et persister.

18. **[L3] Pas de statistiques d'ouverture/clic.** **Fix**: integrer le tracking d'ouverture via pixel et tracking de liens.

19. **[L4] L'email de test ne propose pas de choisir le destinataire.** **Fix**: ajouter un champ email dans le flow "Send Test".

20. **[L5] Aucun historique de modifications des templates.** **Fix**: ajouter un versioning.

21. **[L6] Pas de multilingual templates.** Les templates sont en une seule langue. **Fix**: supporter les templates par locale (22 langues).

22. **[L7] Pas de planification d'envoi.** **Fix**: ajouter un scheduler pour les emails marketing.

23. **[L8] `defaultValue` utilise dans les inputs du modal.** Ligne 395, 399: `defaultValue` ne se met pas a jour quand on change de template. **Fix**: utiliser `value` + `onChange` controlles.

24. **[L9] Les hardcoded sender emails (ligne 340-345) devraient venir de la DB.** **Fix**: charger les defaults depuis l'API settings.

25. **[L10] Pas d'export des logs.** **Fix**: ajouter un bouton CSV/Excel pour l'export des logs email.

---

## 3. SEO (`src/app/admin/seo/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Aucune sauvegarde des settings globales.** Il n'y a pas de bouton Save pour la section "Global Settings" et "Analytics Tracking". Les modifications restent en state local. **Fix**: ajouter un bouton Save avec `PUT /api/admin/seo`.

2. **[C2] Le bouton "Generate Sitemap" (ligne 114-117) n'a pas de onClick.** Purement decoratif. **Fix**: implementer l'appel vers une route API qui genere un sitemap.xml reel.

3. **[C3] Le bouton Save du modal d'edition SEO par page (ligne 281) n'a pas de onClick.** Les modifications SEO par page ne sont jamais persistees. **Fix**: appeler `PUT /api/admin/seo/pages/${id}`.

4. **[C4] Le toggle noIndex (ligne 96-98) n'est pas persiste.** Cliquer change le state local mais ne sauvegarde pas en DB. Une page peut etre desindexee accidentellement. **Fix**: appeler l'API avec le nouveau state.

5. **[C5] Google Analytics ID stocke en clair dans le state client.** Les identifiants de tracking (GA, GTM, Pixel) sont visibles dans le state React. **Fix**: masquer partiellement dans l'UI et valider le format.

### HIGH
6. **[H1] Le bouton "Edit" du robots.txt (ligne 241-243) n'a pas de onClick.** **Fix**: implementer un modal d'edition pour le robots.txt avec persistence.

7. **[H2] Aucun score SEO par page.** Pas d'analyse de la qualite SEO (titre trop court, description manquante, etc.). **Fix**: ajouter un scoring automatique avec des indicateurs visuels (vert/jaune/rouge).

8. **[H3] Le tableau des pages n'est pas pagine.** Pour un grand site, il deviendra inutilisable. **Fix**: ajouter pagination.

9. **[H4] Pas de detection automatique des pages du site.** Les pages SEO doivent etre ajoutees manuellement. **Fix**: scanner les routes Next.js automatiquement pour pre-peupler.

10. **[H5] La validation des ID analytiques est absente.** Aucune regex pour valider le format des GA ID (G-XXXXXXXXXX), GTM (GTM-XXXXXXX), Pixel. **Fix**: ajouter une validation avec feedback.

### MEDIUM
11. **[M1] Pas de preview SERP (Search Engine Results Page).** **Fix**: ajouter un preview visuel montrant comment la page apparaitra dans Google.

12. **[M2] Pas de gestion des redirections 301.** **Fix**: ajouter un tableau de redirections URL.

13. **[M3] Pas de structured data (JSON-LD).** **Fix**: ajouter un editeur de schema.org markup par page.

14. **[M4] Pas de canonical URL par page.** **Fix**: ajouter un champ canonical dans le formulaire.

15. **[M5] Le `keywords` (ligne 271) est un champ libre. Google l'ignore depuis 2009 mais il peut etre utile pour le search interne.** **Fix**: transformer en tag input pour mieux structurer.

### LOW
16. **[L1] Pas de verification de lien brise.** **Fix**: ajouter un outil de scan des broken links.

17. **[L2] Pas de support Open Graph avance (og:type, og:locale, etc.).** **Fix**: etendre les champs OG.

18. **[L3] Pas de Twitter Card configuration.** **Fix**: ajouter twitter:card, twitter:site, twitter:creator.

19. **[L4] Le robots.txt preview est hardcode (ligne 246-253).** **Fix**: le charger depuis le fichier reel public/robots.txt.

20. **[L5] Pas de verification de la presence du sitemap.xml.** **Fix**: verifier si le fichier existe et afficher le statut.

21. **[L6] Pas de hreflang pour le multilingual (22 langues!).** **Fix**: generer automatiquement les balises hreflang.

22. **[L7] Pas de suivi des positions Google.** **Fix**: integrer Google Search Console API.

23. **[L8] Le grid `grid-cols-3` (ligne 156) n'est pas responsive.** **Fix**: ajouter des breakpoints responsifs.

24. **[L9] Aucun bouton "Annuler" sur les settings globales.** **Fix**: ajouter un reset aux valeurs sauvegardees.

25. **[L10] La colonne "indexed" utilise un simple button sans toggle visuel clair.** **Fix**: remplacer par un switch/toggle uniforme avec le reste de l'admin.

---

## 4. WEBINAIRES (`src/app/admin/webinaires/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le formulaire de creation (ligne 217-243) n'a pas de handler de soumission.** Le bouton "Create" (ligne 211) n'a pas de `onClick`. Aucun webinaire ne peut etre cree. **Fix**: implementer `handleCreate()` qui POST vers `/api/admin/webinars`.

2. **[C2] Le bouton "Edit" (ligne 180) n'a pas de onClick.** **Fix**: ouvrir le formulaire pre-rempli et appeler `PUT /api/admin/webinars/${id}`.

3. **[C3] Le bouton "Cancel Webinar" (ligne 181) n'a pas de onClick.** **Fix**: implementer la logique d'annulation avec confirmation et notification aux inscrits.

4. **[C4] Le bouton "View Registered" (ligne 193) n'a pas de onClick.** **Fix**: implementer un modal ou page listant les inscrits avec export.

5. **[C5] `_editingWebinar` et `_setEditingWebinar` sont prefixes avec underscore (ligne 54) et suppresses par eslint.** Le state existe mais n'est jamais utilise. **Fix**: connecter au formulaire d'edition.

### HIGH
6. **[H1] Aucune validation du formulaire.** Les champs `required` sur `<FormField>` sont visuels uniquement. **Fix**: valider avant soumission (titre non vide, date future, duree > 0).

7. **[H2] Pas de notification email aux inscrits.** Quand un webinaire est modifie ou annule, aucun email n'est envoye. **Fix**: integrer avec le systeme d'emails.

8. **[H3] Pas de rappel automatique.** Aucun rappel envoye avant le debut du webinaire. **Fix**: ajouter un cron de rappel configurable.

9. **[H4] Avg attendance rate peut etre NaN.** Ligne 96-98: si aucun webinaire COMPLETED avec registeredCount > 0, la division par 0 donne NaN. Le `|| 0` a la fin ne s'applique qu'a la division finale. **Fix**: gerer le cas edge.

10. **[H5] Le lien `recordingUrl` (ligne 185-191) s'ouvre sans `rel="noopener noreferrer"`.** Vulnerability de tab-nabbing. **Fix**: ajouter `rel="noopener noreferrer"`.

### MEDIUM
11. **[M1] Pas de filtrage par statut.** Tous les webinaires sont affiches sans filtre. **Fix**: ajouter des onglets ou filtres par status.

12. **[M2] Pas de pagination.** **Fix**: implementer pagination.

13. **[M3] Pas de recherche.** **Fix**: ajouter un champ de recherche.

14. **[M4] Pas de fonctionnalite de duplication de webinaire.** **Fix**: ajouter "Dupliquer" pour recreer facilement un webinaire recurrent.

15. **[M5] Pas d'upload de thumbnail/banniere.** **Fix**: ajouter un champ image au formulaire.

### LOW
16. **[L1] Le statut "LIVE" utilise la variante `error` (rouge) (ligne 43).** Semantiquement confusant. **Fix**: utiliser une variante custom `live` (ex: rouge clignotant ou vert).

17. **[L2] Les heures ne sont pas en format local avec timezone.** **Fix**: afficher la timezone du webinaire.

18. **[L3] Pas d'integration Zoom/Teams/Google Meet.** **Fix**: ajouter des boutons d'integration pour creer automatiquement la reunion.

19. **[L4] Le `grid-cols-4` (ligne 122) n'est pas responsive.** **Fix**: ajouter des breakpoints (`grid-cols-2 md:grid-cols-4`).

20. **[L5] Pas d'affichage du taux de completion (combien sont restes jusqu'a la fin).** **Fix**: ajouter une metrique d'engagement.

21. **[L6] Pas de Q&A ou sondage integre.** **Fix**: ajouter des fonctionnalites interactives.

22. **[L7] Pas d'export de la liste des participants.** **Fix**: bouton export CSV.

23. **[L8] Pas de certificates de participation automatiques.** **Fix**: generer des PDF pour les participants.

24. **[L9] Pas de gestion des fuseaux horaires pour les participants internationaux.** **Fix**: afficher l'heure dans le fuseau du visiteur.

25. **[L10] Aucun tag ou categorie pour les webinaires.** **Fix**: ajouter un systeme de categorisation.

---

## 5. CHAT (`src/app/admin/chat/page.tsx` + `ChatDashboard.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Deux implementations de chat incompatibles dans le meme dossier.** `page.tsx` est un client component avec son propre systeme, `ChatDashboard.tsx` est un composant separe avec une architecture differente. Ils ne sont pas connectes. **Fix**: unifier en une seule implementation.

2. **[C2] `page.tsx` utilise `onKeyPress` (deprecated).** Ligne 422: `onKeyPress={handleKeyPress}` -- `onKeyPress` est deprecie dans React 17+. **Fix**: remplacer par `onKeyDown`.

3. **[C3] ChatDashboard.tsx contient du texte hardcode en francais.** Lignes 239, 264, 274, 322, 379-383, 483, 505, 521-522, 584 -- "Ouvertes", "En attente", "Aucune conversation", "Ouverte", "Fermee", "Ecrire une reponse...", "Envoyer", "Selectionnez une conversation", etc. Violation de la regle i18n. **Fix**: remplacer par des appels `t()`.

4. **[C4] ChatDashboard.tsx utilise des inline styles partout.** Des centaines de lignes avec `style={{...}}` au lieu de Tailwind CSS utilise dans le reste de l'admin. **Fix**: migrer vers Tailwind pour la coherence.

5. **[C5] XSS dans les messages chat.** `message.content` (ligne 394 de page.tsx, ligne 567 de ChatDashboard.tsx) est rendu directement avec `whitespace-pre-wrap`. Un visiteur pourrait injecter du HTML/JS. **Fix**: sanitizer le contenu des messages avec DOMPurify.

### HIGH
6. **[H1] Polling a 3s pour les messages + 10s pour les conversations.** (page.tsx lignes 97, 123) -- En production avec beaucoup de conversations, cela genere enormement de requetes. **Fix**: remplacer par WebSocket ou Server-Sent Events.

7. **[H2] Pas de notification sonore pour les nouveaux messages.** **Fix**: ajouter un son et une notification navigateur.

8. **[H3] Le `loadMessages` dans page.tsx depend des `conversations` dans le useCallback.** Ligne 102-116: la reference `conversations` change a chaque re-render, causant des re-renders en cascade. **Fix**: utiliser `conversationId` directement au lieu de chercher le visitorId.

9. **[H4] Pas de fonctionnalite de transfert de conversation.** **Fix**: ajouter la possibilite de transferer a un autre agent.

10. **[H5] Le emoji dans ChatDashboard "SelectionnezConversation" (ligne 520) n'est pas accessible.** `<p style={{fontSize: '48px'}}>💬</p>` -- pas semantique. **Fix**: utiliser un Icon component.

### MEDIUM
11. **[M1] Pas de typing indicator (indicateur de frappe).** **Fix**: implementer un indicateur "l'admin est en train d'ecrire...".

12. **[M2] Pas de support pour l'envoi de fichiers/images.** **Fix**: ajouter l'upload de fichiers dans le chat.

13. **[M3] `unreadCount` (page.tsx ligne 214) est calcule incorrectement.** Il somme `_count.messages` de toutes les conversations, pas les non-lus. **Fix**: utiliser un champ `unreadCount` dedie.

14. **[M4] Pas de canned responses/quick replies dans page.tsx.** (Elles existent dans ChatDashboard.tsx). **Fix**: unifier et implementer dans la version principale.

15. **[M5] Pas de recherche dans les conversations.** **Fix**: ajouter un champ de recherche par nom/email/contenu.

### LOW
16. **[L1] Pas de tag/label sur les conversations.** **Fix**: ajouter des tags pour categoriser (support, vente, retour, etc.).

17. **[L2] Le formatTimeAgo (ligne 197-209 de page.tsx) est reimplemente localement.** **Fix**: utiliser une librairie comme `date-fns/formatDistanceToNow`.

18. **[L3] Pas de fermeture/archivage de conversation dans page.tsx.** (Disponible dans ChatDashboard). **Fix**: ajouter dans page.tsx.

19. **[L4] Pas de statistiques de temps de reponse.** **Fix**: tracker le temps moyen de premiere reponse.

20. **[L5] La hauteur fixe `h-[calc(100vh-220px)]` (page.tsx ligne 253) est fragile.** **Fix**: utiliser flexbox ou une approche plus robuste.

21. **[L6] Pas de mode hors-ligne avec file d'attente de messages.** **Fix**: enqueue les messages si la connexion est perdue.

22. **[L7] Pas d'export de l'historique de conversation.** **Fix**: ajouter export PDF/texte.

23. **[L8] Pas de raccourcis clavier (ex: Ctrl+Enter pour envoyer).** **Fix**: supporter les raccourcis standard.

24. **[L9] Le CSS variables dans ChatDashboard (ex: `var(--gray-100)`) ne sont peut-etre pas definies.** **Fix**: verifier que ces variables CSS existent dans le theme global.

25. **[L10] Pas de support des reactions/emojis sur les messages.** **Fix**: ajouter un emoji picker.

---

## 6. AVIS/REVIEWS (`src/app/admin/avis/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le stat "With Photos" (ligne 179) est hardcode en anglais.** `label="With Photos"` viole la regle i18n. **Fix**: remplacer par `label={t('admin.reviews.withPhotos')}`.

2. **[C2] Les images de review sont rendues avec `unoptimized` et sans validation d'URL.** Lignes 243-258, 348-358: des URLs malicieuses pourraient etre injectees via les reviews. **Fix**: valider les URLs d'images et utiliser un domaine whitelist.

3. **[C3] Pas d'authentification verifiee sur les actions approve/reject.** Les appels `PATCH /api/admin/reviews/${id}` (ligne 86-89) n'incluent pas de verification CSRF. **Fix**: ajouter un token CSRF ou verifier le middleware d'auth.

4. **[C4] La reponse admin peut contenir du HTML non sanitize.** `adminResponse` (ligne 263) est rendu directement. **Fix**: echapper le contenu.

5. **[C5] Pas de rate limiting sur les actions de moderation.** Un admin pourrait accidentellement approver/rejeter en boucle. **Fix**: ajouter un debounce et une confirmation pour les actions de masse.

### HIGH
6. **[H1] Pas de pagination.** Toutes les reviews chargees d'un coup. **Fix**: pagination cote API.

7. **[H2] Pas de bulk moderation.** Impossible d'approver/rejeter plusieurs reviews a la fois. **Fix**: ajouter des checkboxes et actions groupees.

8. **[H3] Le `adminResponse` est soumis sans validation de longueur.** On peut soumettre une reponse vide ou extremement longue. **Fix**: valider min/max length.

9. **[H4] Pas de notification au client quand sa review est approuvee ou qu'une reponse est postee.** **Fix**: envoyer un email automatique.

10. **[H5] Pas de detection de contenu inapproprie.** **Fix**: integrer un filtre anti-spam/profanity.

### MEDIUM
11. **[M1] Pas de tri.** Les reviews ne sont pas triables par date, note, statut. **Fix**: ajouter des options de tri.

12. **[M2] Pas de filtre par produit.** **Fix**: ajouter un SelectFilter par produit.

13. **[M3] Le compteur d'images dans la liste (ligne 254) est redondant avec les thumbnails.** **Fix**: supprimer ou rendre plus discret.

14. **[M4] Pas de statistiques avancees (distribution des notes par produit).** **Fix**: ajouter un graphique de distribution.

15. **[M5] Pas de signalement de review par d'autres clients.** **Fix**: ajouter un mecanisme de flagging.

### LOW
16. **[L1] Pas de preview d'image en plein ecran dans le modal.** Les images sont petites (96x96). **Fix**: ajouter un lightbox.

17. **[L2] Le `updatingIds` Set (ligne 59) pourrait etre simplifie avec un seul ID.** **Fix**: simplifier si un seul update a la fois.

18. **[L3] Pas d'historique des modifications de statut.** **Fix**: logger qui a approuve/rejete et quand.

19. **[L4] Pas de template pour les reponses admin.** **Fix**: ajouter des reponses pre-ecrites.

20. **[L5] Le `isVerifiedPurchase` n'est pas filtrable.** **Fix**: ajouter un filtre "Achat verifie".

21. **[L6] Les etoiles utilisent une couleur fixe jaune sans support du dark mode.** **Fix**: utiliser des classes Tailwind adaptatives.

22. **[L7] Pas d'export des reviews.** **Fix**: ajouter export CSV.

23. **[L8] Pas de widget d'avis integrable dans le shop.** **Fix**: generer un composant de summary pour les pages produit.

24. **[L9] La review card n'affiche pas l'avatar du client.** **Fix**: ajouter l'image de profil.

25. **[L10] Pas de filtre par date de creation.** **Fix**: ajouter un date range picker.

---

## 7. QUESTIONS (`src/app/admin/questions/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] `togglePublic()` (ligne 83-85) ne persiste pas la modification.** Le changement public/prive est uniquement en state local. **Fix**: appeler `PATCH /api/admin/questions/${id}` avec `{ isPublic }`.

2. **[C2] `deleteQuestion()` (ligne 87-89) ne persiste pas la suppression.** Le `setQuestions(filter(...))` est local uniquement. **Fix**: appeler `DELETE /api/admin/questions/${id}` cote serveur.

3. **[C3] Le `confirm()` natif du navigateur (ligne 88) est bloquant et non personnalisable.** **Fix**: remplacer par un modal de confirmation custom avec i18n.

4. **[C4] `answeredBy` est hardcode a "Admin BioCycle" (ligne 74).** Devrait etre le nom de l'admin connecte. **Fix**: utiliser la session utilisateur.

5. **[C5] Pas de sanitization du contenu des reponses.** `answerText` est soumis et rendu directement. **Fix**: sanitizer avant le rendu.

### HIGH
6. **[H1] Pas de pagination.** **Fix**: implementer pagination cote API.

7. **[H2] Pas de notification au client quand sa question recoit une reponse.** **Fix**: envoyer un email automatique.

8. **[H3] Le formulaire de reponse n'a pas de validation de longueur.** **Fix**: ajouter min/max length.

9. **[H4] Pas de temps de reponse moyen dans les stats.** **Fix**: calculer et afficher le temps moyen entre question et reponse.

10. **[H5] Pas de filtre par produit.** **Fix**: ajouter un SelectFilter par produit.

### MEDIUM
11. **[M1] Pas de tri par date, produit ou statut.** **Fix**: ajouter des options de tri.

12. **[M2] Pas de reponses rapides/templates.** **Fix**: ajouter des reponses pre-ecrites pour les questions frequentes.

13. **[M3] Pas d'indicateur de priorite.** Les questions anciennes sans reponse ne sont pas mises en avant. **Fix**: ajouter un indicateur d'anciennete et d'urgence.

14. **[M4] La recherche ne couvre pas les reponses.** Ligne 96-99: seul `question` et `productName` sont recherches. **Fix**: inclure `answer`.

15. **[M5] Pas de comptage des questions par produit.** **Fix**: afficher quels produits ont le plus de questions.

### LOW
16. **[L1] Pas d'export des questions/reponses.** **Fix**: ajouter export CSV pour generer une FAQ.

17. **[L2] Le toggle public/prive utilise un `StatusBadge` cliquable, pas un vrai toggle.** **Fix**: utiliser un switch/toggle visuel coherent.

18. **[L3] Pas de detection de questions similaires/doublons.** **Fix**: alerter quand une question similaire existe deja.

19. **[L4] L'email du questionneur n'est pas affiche.** **Fix**: afficher l'email pour pouvoir contacter en prive.

20. **[L5] Pas de lien vers la page produit.** **Fix**: ajouter un lien direct vers le produit concerne.

21. **[L6] `answeredAt` est genere cote client avec `new Date().toISOString()` (ligne 75).** **Fix**: utiliser la date retournee par le serveur.

22. **[L7] Pas de preview de la question sur la page produit publique.** **Fix**: ajouter un lien "Voir sur le site".

23. **[L8] Les actions "Edit Answer" et "Delete" sont au meme niveau visuel.** **Fix**: differencier visuellement (la suppression devrait etre moins prominente).

24. **[L9] Pas de support pour les questions multilingues.** **Fix**: integrer avec le systeme de traduction.

25. **[L10] Pas de webhook/notification quand une nouvelle question est posee.** **Fix**: notifier les admins en temps reel.

---

## 8. TRADUCTIONS (`src/app/admin/traductions/`) - 25 Ameliorations

### CRITICAL
1. **[C1] Aucune gestion d'erreur sur `triggerTranslation()`.** Ligne 123-143: si l'API echoue, l'erreur `catch` affiche un message mais ne revert pas l'etat. **Fix**: ajouter un try/catch propre avec revert du state `translating`.

2. **[C2] Le force=false est hardcode dans triggerTranslation (ligne 127).** Impossible de forcer une re-traduction. **Fix**: ajouter une option "Force re-translate" (checkbox).

3. **[C3] Pas de verification d'authentification dans la page serveur.** `page.tsx` verifie la session (ligne 15-21) mais la verification de role est permissive (`EMPLOYEE || OWNER`). **Fix**: verifier que seuls les admins avec la permission `translations.manage` y accedent.

4. **[C4] Les jobs echoues n'ont pas de bouton de retry.** La table des jobs (ligne 374-404) affiche les erreurs mais aucun moyen de relancer. **Fix**: ajouter un bouton retry par job.

5. **[C5] La traduction automatique peut ecraser des traductions manuelles.** Aucun flag pour differencier traduction automatique vs humaine. **Fix**: ajouter un champ `source: 'auto' | 'manual'` et proteger les traductions manuelles.

### HIGH
6. **[H1] Pas de gestion des langues cibles.** Le dashboard ne montre pas quelles langues specifiques sont couvertes ou manquantes. **Fix**: ajouter un tableau par langue.

7. **[H2] Pas d'edition inline des traductions.** Impossible de corriger une traduction directement. **Fix**: ajouter un mode edition par entite/langue.

8. **[H3] Les emojis dans MODEL_ICONS (ligne 61-69) ne sont pas accessibles.** **Fix**: utiliser des Icons Lucide comme dans le reste de l'admin.

9. **[H4] Pas de cout estime de traduction.** Chaque traduction appelle probablement une API payante (DeepL, OpenAI). **Fix**: afficher le cout estime avant de lancer.

10. **[H5] Le refresh apres traduction est a `setTimeout(3000)` (ligne 134).** Si la traduction prend plus longtemps, les stats ne se mettent pas a jour. **Fix**: utiliser du polling ou un callback de completion.

### MEDIUM
11. **[M1] Pas de comparaison cote a cote (source vs traduit).** **Fix**: ajouter un mode de review avec texte source et traduction.

12. **[M2] Pas de detection de qualite de traduction.** **Fix**: integrer un score de qualite.

13. **[M3] Le queue dropdown (ligne 321-415) ne s'auto-refresh pas.** **Fix**: ajouter du polling quand la queue est ouverte.

14. **[M4] Pas de filtre par statut de couverture dans le tableau.** **Fix**: filtrer les modeles par couverture (< 50%, < 100%, 100%).

15. **[M5] Pas d'export du rapport de couverture.** **Fix**: ajouter un export CSV/PDF.

### LOW
16. **[L1] Le bouton "Translate All" est ambigue.** Il pourrait signifier "toutes les langues" ou "toutes les entites". **Fix**: clarifier le libelle.

17. **[L2] Le job ID est tronque a 12 caracteres (ligne 376).** **Fix**: ajouter un tooltip avec l'ID complet.

18. **[L3] Pas de glossaire/terminologie pour la coherence des traductions.** **Fix**: ajouter un glossaire par domaine.

19. **[L4] Pas d'historique des traductions modifiees.** **Fix**: logger les modifications.

20. **[L5] Les couleurs de la progress bar (ligne 284-289) ne suivent pas un standard.** **Fix**: uniformiser avec le design system.

21. **[L6] Le loading spinner utilise `Loader2` tandis que d'autres pages utilisent un `div.animate-spin`.** **Fix**: uniformiser le loading pattern.

22. **[L7] Pas de notification quand toutes les traductions sont terminees.** **Fix**: envoyer une notification browser/toast.

23. **[L8] Pas de support pour les traductions par lot avec priorite configurable.** **Fix**: ajouter un systeme de priorite dans le trigger.

24. **[L9] Les erreurs de traduction ne sont pas categorisees (rate limit, qualite, timeout).** **Fix**: classifier les types d'erreurs.

25. **[L10] Pas de mode "preview" pour voir comment une traduction s'affiche sur le site.** **Fix**: ajouter un lien vers la page publique dans la langue traduite.

---

## 9. PARAMETRES (`src/app/admin/parametres/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] L'onglet "Integrations" n'a pas de vrai statut de connexion.** Stripe et Resend montrent "Connected" (ligne 429, 472) mais c'est hardcode. **Fix**: verifier la validite des cles API en temps reel.

2. **[C2] Le `sessionTimeout` n'a pas de validation min/max.** Un admin pourrait mettre 0 ou 99999 minutes. **Fix**: valider: min 5, max 480 minutes.

3. **[C3] Le `maxLoginAttempts` n'a pas de borne inferieure.** Mettre 0 bloquerait tous les utilisateurs. **Fix**: valider: min 3, max 20.

4. **[C4] Les credentials des integrations (Stripe, PayPal) ne sont pas stockees de maniere securisee.** Le bouton "Configure" (ligne 442-444) n'a pas de onClick et aucune UI de configuration n'existe. **Fix**: implementer un flow securise pour les cles API.

5. **[C5] Le `parseInt` sans radix est utilise partout.** Lignes 82-89, 263, 306-307, 399, 406. `parseInt(value)` sans deuxieme argument peut causer des bugs. **Fix**: utiliser `parseInt(value, 10)` ou `Number(value)`.

### HIGH
6. **[H1] Pas de confirmation avant de sauvegarder des changements critiques.** Changer le `requireEmailVerification` ou `sessionTimeout` affecte tous les utilisateurs. **Fix**: ajouter une confirmation modale.

7. **[H2] Les toggles custom (ligne 160-164) ne sont pas accessibles.** Pas de `role="switch"`, pas d'`aria-checked`. **Fix**: utiliser un composant switch accessible.

8. **[H3] Pas de validation d'email pour `siteEmail` et `supportEmail`.** **Fix**: ajouter une validation de format email.

9. **[H4] Le `freeShippingThreshold` accepte des valeurs negatives.** **Fix**: ajouter `min={0}` sur l'input.

10. **[H5] Pas de versioning/audit des changements de settings.** **Fix**: logger qui a change quoi et quand dans l'audit log.

### MEDIUM
11. **[M1] L'onglet "Integrations" ne permet pas de configurer PayPal et Google Analytics.** Les boutons "Configure" sont non-fonctionnels. **Fix**: implementer les flows de configuration.

12. **[M2] Pas de settings par environnement (dev/staging/prod).** **Fix**: ajouter un indicateur d'environnement.

13. **[M3] Le timezone selector est limite a 4 fuseaux canadiens.** **Fix**: utiliser la liste IANA complete ou au moins les fuseaux majeurs.

14. **[M4] Pas de backup/restore des settings.** **Fix**: ajouter un export/import JSON des parametres.

15. **[M5] Le `orderPrefix` n'a pas de validation de format.** **Fix**: limiter a 2-5 caracteres alphanumeriques.

### LOW
16. **[L1] Pas de search dans les sections.** Avec 6 sections, la navigation est deja simple, mais une recherche serait utile avec plus de parametres. **Fix**: ajouter un search box.

17. **[L2] Les selects HTML natifs (`<select>`) ne suivent pas le design system.** **Fix**: utiliser un composant Select stylise.

18. **[L3] Le sticky sidebar (ligne 170) pourrait ne pas fonctionner correctement sur certains navigateurs.** **Fix**: tester et ajouter des fallbacks.

19. **[L4] Pas de reset aux valeurs par defaut.** **Fix**: ajouter un bouton "Reset defaults" par section.

20. **[L5] Le bouton Save est tout en bas.** Si on modifie une section, il faut scroller. **Fix**: ajouter un bouton save par section ou un sticky save bar.

21. **[L6] L'onglet "Security" ne mentionne pas 2FA.** **Fix**: ajouter la configuration de l'authentification a deux facteurs.

22. **[L7] Pas de parametres de maintenance mode.** **Fix**: ajouter un toggle pour mettre le site en maintenance.

23. **[L8] Pas de config pour les termes et conditions/politique de confidentialite.** **Fix**: ajouter des liens editables.

24. **[L9] Le phone input (ligne 221-225) n'a pas de masque de saisie.** **Fix**: utiliser un composant phone input avec formatage.

25. **[L10] Pas de test de connectivite SMTP.** **Fix**: ajouter un bouton "Test Connection" dans les integrations.

---

## 10. EMPLOYES (`src/app/admin/employes/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Pas de confirmation d'invitation par email.** L'endpoint `POST /api/admin/employees` cree l'employe mais rien n'indique qu'un email d'invitation est envoye. **Fix**: integrer avec le systeme d'email pour envoyer un lien d'activation.

2. **[C2] Pas de validation d'unicite de l'email avant creation.** Si l'email existe deja, l'erreur est generique. **Fix**: verifier l'unicite cote frontend avant soumission.

3. **[C3] Un EMPLOYEE peut potentiellement s'auto-promouvoir OWNER.** Le formulaire (ligne 300-307) ne verifie pas si l'editeur a le droit de changer le role. **Fix**: verifier les permissions cote serveur.

4. **[C4] La desactivation d'un employe ne revoque pas ses sessions actives.** `toggleActive` (ligne 84-107) toggle `isActive` mais les sessions existantes restent valides. **Fix**: invalider toutes les sessions de l'employe desactive.

5. **[C5] Les permissions assignees ne sont pas verifiees dans les routes API.** Les permissions sont stockees mais possiblement jamais enforced dans les middleware/routes. **Fix**: implementer un middleware de verification des permissions.

### HIGH
6. **[H1] Pas de suppression d'employe.** On peut desactiver mais jamais supprimer completement. **Fix**: ajouter un bouton de suppression avec confirmation et transfert des donnees.

7. **[H2] Le mot de passe initial n'est pas gere.** Aucun flow de creation de mot de passe pour le nouvel employe. **Fix**: generer un lien d'activation avec creation de mot de passe.

8. **[H3] Pas de filtrage/recherche dans la table.** **Fix**: ajouter un champ de recherche et des filtres par role/statut.

9. **[H4] L'historique des connexions (`lastLogin`) n'est qu'un seul timestamp.** **Fix**: ajouter un historique complet des connexions avec IP et user agent.

10. **[H5] Le `permissionKeys` (ligne 20-35) est hardcode dans le frontend.** Si de nouvelles permissions sont ajoutees cote serveur, le frontend ne les verra pas. **Fix**: charger les permissions disponibles depuis l'API.

### MEDIUM
11. **[M1] Pas de pagination pour la table d'employes.** Pour une petite equipe c'est OK, mais ne scale pas. **Fix**: ajouter pagination.

12. **[M2] L'avatar est une simple initiale (ligne 231-233).** **Fix**: supporter un vrai avatar (upload ou Gravatar).

13. **[M3] Pas de role intermediaire entre EMPLOYEE et OWNER.** **Fix**: ajouter MANAGER ou SUPERVISOR.

14. **[M4] Les permissions ne supportent pas le granulaire "read-only".** C'est `view` ou `manage`, pas de niveaux intermediaires. **Fix**: ajouter des niveaux (view, edit, delete, admin).

15. **[M5] Pas d'export de la liste des employes.** **Fix**: ajouter export CSV.

### LOW
16. **[L1] Le `MiniStat` component est defini inline (ligne 342-354).** **Fix**: deplacer dans un fichier composant partage.

17. **[L2] Le formulaire ne previent pas la soumission accidentelle avec Entree.** **Fix**: ajouter un handler `onSubmit` sur le form.

18. **[L3] Pas d'indicateur de force du mot de passe pour la creation.** **Fix**: non applicable ici puisqu'il n'y a pas de champ mot de passe, mais a ajouter au flow d'invitation.

19. **[L4] La date de `lastLogin` ne montre pas "Jamais" de maniere distincte.** **Fix**: utiliser un style visuel different pour les employes qui ne se sont jamais connectes.

20. **[L5] Pas de notes/commentaires sur un employe.** **Fix**: ajouter un champ notes internes.

21. **[L6] Le modal ne se ferme pas avec Escape.** **Fix**: verifier que le composant Modal gere nativement Escape.

22. **[L7] Pas de departement/equipe pour les employes.** **Fix**: ajouter un champ departement.

23. **[L8] Le compteur "3 permissions" (ligne 247) ne dit pas lesquelles.** **Fix**: ajouter un tooltip avec la liste.

24. **[L9] Pas de gestion des conges/absences.** **Fix**: ajouter un calendrier simple.

25. **[L10] Le toggle active/inactive ne montre pas de tooltip sur les OWNER desactives.** Le `cursor-not-allowed` est present mais pas d'explication. **Fix**: ajouter un tooltip "Les proprietaires ne peuvent pas etre desactives".

---

## 11. LIVRAISON (`src/app/admin/livraison/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le modal de creation/edition est un placeholder.** Ligne 340: `<p className="text-slate-500">{t('admin.shipping.inDevelopment')}</p>` -- Impossible de creer ou editer des zones de livraison. **Fix**: implementer le formulaire complet.

2. **[C2] Le bouton "Add Method" (ligne 295-298) est non-fonctionnel.** C'est un simple `<button>` sans `onClick`. **Fix**: implementer l'ajout de methode de livraison.

3. **[C3] `toggleMethodActive` (ligne 90-152) togge la zone entiere au lieu de la methode.** Le commentaire (ligne 91-95) explique que le modele DB n'a pas de ShippingMethod separe. **Fix**: creer une table `ShippingMethod` dans Prisma et implementer le toggle individuel.

4. **[C4] Les erreurs de fetch silencieuses.** `fetchZones` (ligne 54-63) catch les erreurs sans feedback utilisateur. **Fix**: ajouter un toast d'erreur.

5. **[C5] Pas de validation des prix de livraison.** Les prix sont affiches mais aucune validation (prix negatif, devise, etc.) n'est faite. **Fix**: valider cote serveur et frontend.

### HIGH
6. **[H1] Pas de calcul de frais de livraison dynamique.** Les prix sont fixes par zone. **Fix**: supporter des regles conditionnelles (poids, dimensions, montant commande).

7. **[H2] Pas de test de livraison.** Impossible de tester si un pays/code postal est correctement mappe a une zone. **Fix**: ajouter un simulateur "entrez une adresse, voyez les options".

8. **[H3] Le `getCountryName` (ligne 154-156) genere des cles i18n potentiellement inexistantes.** Si un code pays n'a pas de traduction, il affiche le code brut. **Fix**: fallback a `Intl.DisplayNames`.

9. **[H4] Pas de gestion des restrictions de livraison.** Impossible de bloquer certains produits pour certaines zones. **Fix**: ajouter des regles de restriction par produit/categorie.

10. **[H5] Les prix sont affiches en `$` hardcode (ligne 274, 277).** **Fix**: utiliser la devise configuree dans les settings.

### MEDIUM
11. **[M1] Pas de tracking integration.** Aucune integration avec les transporteurs (Postes Canada, UPS, FedEx). **Fix**: ajouter des integrations de suivi.

12. **[M2] Pas de duplication de zone.** **Fix**: ajouter "Dupliquer" pour creer des variantes.

13. **[M3] Pas de recherche de zone.** Avec beaucoup de zones, trouver la bonne sera difficile. **Fix**: ajouter un filtre.

14. **[M4] Pas d'historique des modifications de tarifs.** **Fix**: logger les changements de prix.

15. **[M5] Les jours de livraison sont en `min-max` mais pas en jours ouvrables vs calendrier.** **Fix**: preciser le type de jours.

### LOW
16. **[L1] Pas d'affichage sur une carte geographique.** **Fix**: ajouter une carte interactive montrant les zones.

17. **[L2] Le `StatCard` pour les methods (ligne 204-208) compte toutes les methodes, meme inactives.** **Fix**: compter uniquement les actives.

18. **[L3] Pas de support des taux de livraison en temps reel (API transporteur).** **Fix**: integrer les API de tarification en temps reel.

19. **[L4] Le toggle active/inactive de la zone pourrait desactiver accidentellement toutes les livraisons.** **Fix**: avertir si c'est la derniere zone active.

20. **[L5] Pas de support des points relais.** **Fix**: ajouter un type de methode "Point Relais".

21. **[L6] Les noms de pays sont traduits individuellement via i18n.** **Fix**: utiliser `Intl.DisplayNames` natif.

22. **[L7] Pas de gestion des jours feries affectant les delais.** **Fix**: integrer un calendrier de jours feries.

23. **[L8] Pas d'estimation de cout d'expedition pour le rapport.** **Fix**: ajouter un dashboard des couts d'expedition.

24. **[L9] Le `freeAbove` est optionnel mais affiche `-` quand absent.** **Fix**: afficher "Pas de livraison gratuite" pour plus de clarte.

25. **[L10] Pas de support des zones par code postal.** Seulement par pays. **Fix**: supporter le filtrage par plage de codes postaux.

---

## 12. RAPPORTS (`src/app/admin/rapports/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le bouton "Export PDF" (ligne 225-227) n'a pas de onClick.** Purement decoratif. **Fix**: implementer la generation PDF avec une librairie comme `jsPDF` ou `react-pdf`.

2. **[C2] La stat "Conversion Rate" affiche `pendingInvoices` au lieu d'un vrai taux de conversion.** Ligne 253-256: `value={dashboard ? \`${dashboard.pendingInvoices}\` : '-'}`. **Fix**: calculer le vrai taux (commandes / visites).

3. **[C3] Le `fetchData` est dans un `useEffect` sans cleanup.** Ligne 57-59: les requetes en vol ne sont pas annulees si le composant unmount. **Fix**: utiliser `AbortController`.

4. **[C4] `useMemo` est importe (ligne 3) mais jamais utilise.** Pas de memoization des calculs couteux. **Fix**: wrapper les calculs derives (totalRevenue, totalOrders, etc.) dans `useMemo`.

5. **[C5] Les donnees financieres sont exposees cote client sans verification de permission.** Les APIs d'accounting (`/api/accounting/dashboard`, etc.) sont appelees directement. **Fix**: verifier les permissions dans chaque route API.

### HIGH
6. **[H1] Le graphique de revenus est un simple bar chart CSS.** Ligne 268-287: pas de librairie de chart. **Fix**: utiliser Recharts ou Chart.js pour un graphique interactif.

7. **[H2] Pas d'export CSV des donnees.** **Fix**: ajouter un export CSV par section (ventes, produits, regions).

8. **[H3] Le `salesByRegion` est duplique.** Deux sections identiques (lignes 323-350 et 353-373) affichent les memes donnees. **Fix**: supprimer la duplication et fusionner.

9. **[H4] Le comparison avec la periode precedente fait un appel API supplementaire en cascade.** Ligne 139-149: `prevRes` est fetch apres les premiers resultats. **Fix**: faire en parallele avec `Promise.all`.

10. **[H5] Pas de filtre par categorie de produit.** **Fix**: ajouter des filtres par categorie, client, methode de paiement.

### MEDIUM
11. **[M1] Le tooltip du bar chart (ligne 275-279) n'est pas accessible au clavier.** **Fix**: supporter le focus clavier.

12. **[M2] Pas de rapport de marge beneficiaire.** **Fix**: ajouter le calcul revenus - couts.

13. **[M3] Les montants ne sont pas formates avec la devise configuree.** `$` est hardcode. **Fix**: utiliser `Intl.NumberFormat` avec la devise des settings.

14. **[M4] Pas de rapport d'inventaire (stock valorise).** **Fix**: ajouter un rapport croise inventaire/ventes.

15. **[M5] Le `getPeriodDates` (ligne 61-73) ne gere pas les mois avec nombres de jours differents.** **Fix**: utiliser `date-fns` pour des calculs de date robustes.

### LOW
16. **[L1] Pas de mode d'impression optimise.** **Fix**: ajouter une CSS d'impression.

17. **[L2] Pas de rapport de panier moyen par source de trafic.** **Fix**: integrer avec les analytics.

18. **[L3] Les couleurs des barres (sky-500) ne sont pas distinctes entre les sections.** **Fix**: utiliser des couleurs differentes par section.

19. **[L4] Pas de rapport de cohortes (retention clients).** **Fix**: ajouter un rapport de retention.

20. **[L5] Le graphique ne montre que les 30 derniers jours meme en mode 90d/1y.** Ligne 269: `salesData.slice(-30)`. **Fix**: adapter le nombre de barres a la periode.

21. **[L6] Pas de KPI personnalisables.** **Fix**: permettre a l'admin de choisir quels KPI afficher.

22. **[L7] Pas de rapport de retours/remboursements.** **Fix**: ajouter une section dediee.

23. **[L8] Les tendances (trends) ne sont pas colorees rouge/vert.** **Fix**: le StatCard le gere probablement, verifier.

24. **[L9] Pas de rapport emailing (taux d'ouverture, clics).** **Fix**: ajouter une section performance email.

25. **[L10] Pas de planification automatique de rapports.** **Fix**: permettre l'envoi automatique par email a intervalle regulier.

---

## 13. UAT (`src/app/admin/uat/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le modal de lancement (ligne 231-287) utilise une `div.fixed` au lieu du composant `<Modal>`.** Incoherent avec le reste de l'admin et potentiellement non-accessible. **Fix**: utiliser le composant `<Modal>` partage.

2. **[C2] Le polling a 2 secondes (ligne 126) est agressif.** Avec plusieurs onglets ouverts, cela pourrait surcharger le serveur. **Fix**: augmenter l'intervalle ou utiliser SSE.

3. **[C3] Le `confirm()` natif pour le cleanup (ligne 189) n'est pas i18n-compatible.** **Fix**: remplacer par un modal de confirmation custom.

4. **[C4] L'erreur de lancement (ligne 163) affiche `e.message` directement.** Pourrait exposer des details techniques. **Fix**: sanitizer les messages d'erreur.

5. **[C5] Le `StatusBadge` local (ligne 394-413) shadowe le composant importe de l'admin design system.** Meme nom, implementation differente. **Fix**: renommer en `UatStatusBadge` ou utiliser le composant partage.

### HIGH
6. **[H1] Pas de comparaison entre runs.** Impossible de comparer les resultats de deux runs. **Fix**: ajouter un mode diff.

7. **[H2] Les test cases ne sont pas retestables individuellement.** Seuls des runs complets sont possibles. **Fix**: ajouter un bouton "Rerun" par test case.

8. **[H3] Pas de notification quand un run est termine.** L'admin doit rester sur la page. **Fix**: envoyer une notification browser/email.

9. **[H4] Le bouton cleanup supprime les donnees sans export prealable.** **Fix**: proposer un export avant suppression.

10. **[H5] Pas de filtrage des test cases par status/region.** **Fix**: ajouter des filtres dans le panneau de detail.

### MEDIUM
11. **[M1] Le `TaxReportTable` n'a pas de tri.** **Fix**: rendre les colonnes triables.

12. **[M2] Pas de graphique visuel des resultats.** **Fix**: ajouter un pie chart passed/failed/skipped.

13. **[M3] Les erreurs ne sont pas copiables facilement.** **Fix**: ajouter un bouton "Copy error" pour le debugging.

14. **[M4] Le `SummaryCard` (ligne 529-536) est local.** **Fix**: factoriser ou utiliser `StatCard`.

15. **[M5] Le `expandedCase` ne supporte qu'un seul case ouvert a la fois.** **Fix**: supporter l'expansion multiple.

### LOW
16. **[L1] Les durations en ms sont peu lisibles.** `tc.durationMs + 'ms'` vs format humain. **Fix**: formater "1.2s" au lieu de "1234ms".

17. **[L2] Pas de pagination pour les runs.** **Fix**: paginer si le nombre de runs augmente.

18. **[L3] Le `ErrorCard` (ligne 733-780) est complexe et non-reutilisable.** **Fix**: simplifier et extraire.

19. **[L4] Pas de lien vers les commandes de test creees.** `tc.orderNumber` est affiche mais pas cliquable. **Fix**: ajouter un lien vers `/admin/commandes/${id}`.

20. **[L5] Le JSON afiche dans le contexte d'erreur (ligne 775) n'est pas syntaxiquement colore.** **Fix**: utiliser un composant JSON viewer.

21. **[L6] Pas de mode "dry run" pour valider sans creer de donnees.** **Fix**: ajouter une option.

22. **[L7] Le header n'utilise pas le composant `PageHeader` partage.** Ligne 213-228. **Fix**: utiliser `<PageHeader>` pour la coherence.

23. **[L8] Les montants de taxes utilisent le format `$` apres le nombre (canadien correct) mais pas partout.** **Fix**: uniformiser avec `Intl.NumberFormat`.

24. **[L9] Le tableau des runs ne montre pas le pourcentage de reussite.** **Fix**: ajouter une colonne "% passed".

25. **[L10] Pas de planification automatique des tests.** **Fix**: ajouter un scheduler pour lancer des tests UAT periodiques (ex: nightly).

---

## 14. PERMISSIONS (`src/app/admin/permissions/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le seed automatique (ligne 114-122) se declenche quand `permissions.length === 0`.** Si l'API retourne une erreur (vide par defaut), le seed est relance en boucle. **Fix**: ajouter un flag `seeded` pour eviter les appels multiples.

2. **[C2] Les appels API utilisent tous `POST` avec un champ `action`.** Lignes 133-139, 141-157, etc. -- Ce n'est pas RESTful et rend les permissions CSRF plus difficiles a gerer. **Fix**: utiliser les methodes HTTP appropriees (GET, PUT, DELETE, PATCH).

3. **[C3] Le `updateDefault` (ligne 132-139) fait un update optimiste sans rollback en cas d'erreur.** **Fix**: ajouter un catch avec rollback.

4. **[C4] Le `deleteGroup` (ligne 158-166) ne verifie pas si des utilisateurs sont encore dans le groupe.** **Fix**: avertir si le groupe contient des utilisateurs et proposer une reassignation.

5. **[C5] La recherche d'utilisateurs (ligne 95-100) expose potentiellement des donnees sensibles.** La route `/api/admin/permissions?tab=users&search=` pourrait etre exploitee. **Fix**: limiter les champs retournes et rate-limiter.

### HIGH
6. **[H1] Pas de cache pour les permissions chargees.** Chaque navigation recharge tout. **Fix**: utiliser SWR ou React Query.

7. **[H2] Le `saveGroup` (ligne 141-155) ne valide pas que le nom est non-vide.** **Fix**: ajouter une validation frontend.

8. **[H3] Le `toggleOverride` (ligne 168-181) n'a pas de confirmation.** Granter ou revoquer une permission devrait etre confirme. **Fix**: ajouter une confirmation.

9. **[H4] Pas de log d'audit pour les changements de permissions.** **Fix**: logger tous les changements dans l'audit trail.

10. **[H5] Les overrides n'ont pas de date d'expiration configurable.** L'interface `Override` a un champ `expiresAt` mais l'UI ne permet pas de le configurer. **Fix**: ajouter un date picker.

### MEDIUM
11. **[M1] Le search bar d'utilisateur n'a pas de debounce.** Chaque frappe de touche declenche un fetch. **Fix**: ajouter un debounce de 300ms.

12. **[M2] Pas de vue "Effective Permissions" pour un utilisateur.** Montrer les permissions finales (defaut + groupe + overrides). **Fix**: ajouter un recapitulatif.

13. **[M3] Les groupes ne montrent que 8 permissions max (ligne 361-369).** **Fix**: rendre expansible ou utiliser un modal pour tout voir.

14. **[M4] Le color picker HTML natif (ligne 409-413) est minimal.** **Fix**: utiliser un composant color picker plus riche.

15. **[M5] Pas d'import/export des configurations de permissions.** **Fix**: ajouter un export/import JSON.

### LOW
16. **[L1] Pas de recherche dans la liste des permissions (tab defaults).** Avec beaucoup de permissions, c'est difficile a naviguer. **Fix**: ajouter un filtre.

17. **[L2] Le casting `perm as unknown as Record<string, boolean>` (lignes 272, 276) est un code smell.** **Fix**: typer correctement l'objet Permission.

18. **[L3] Les tabs utilisent un style custom au lieu du pattern de tabs du reste de l'admin.** **Fix**: uniformiser avec le composant tabs partage.

19. **[L4] Pas de tooltip sur les checkboxes pour expliquer ce que chaque permission fait.** **Fix**: ajouter des descriptions.

20. **[L5] Le `fetchPermissions` n'a pas de gestion d'erreur.** Ligne 80-87: pas de try/catch. **Fix**: ajouter un error handling avec toast.

21. **[L6] L'user override ne montre pas le groupe de l'utilisateur.** **Fix**: afficher le groupe actuel pour contexte.

22. **[L7] Pas de mode "readonly" pour les employes non-proprietaires.** **Fix**: desactiver les controles si l'utilisateur n'est pas OWNER.

23. **[L8] Le bouton delete group n'a pas de texte (icon only).** Ligne 357. **Fix**: ajouter un label pour l'accessibilite.

24. **[L9] Pas de badge montrant combien d'overrides un utilisateur a.** **Fix**: afficher un compteur.

25. **[L10] Les permissions expandues (modules) ne sont pas memorisees entre navigations.** **Fix**: persister dans localStorage.

---

## 15. LOGS (`src/app/admin/logs/page.tsx`) - 25 Ameliorations

### CRITICAL
1. **[C1] Le bouton "Export" (ligne 184-186) n'a pas de onClick.** Purement decoratif. **Fix**: implementer l'export CSV/JSON des logs filtres.

2. **[C2] Le `JSON.stringify(log.details)` dans le filtre de recherche (ligne 81) est execute pour chaque log a chaque frappe.** Extremement couteux en performance. **Fix**: pre-stringifier les details ou limiter la recherche aux champs indexes.

3. **[C3] Pas de retention/purge des logs.** Les logs s'accumulent indefiniment. **Fix**: implementer une politique de retention configurable.

4. **[C4] L'auto-refresh ne se desactive pas automatiquement si le navigateur perd le focus.** Continue a poller meme quand l'onglet est en arriere-plan. **Fix**: utiliser `document.visibilityState`.

5. **[C5] Les logs contiennent potentiellement des donnees sensibles (details).** Le modal affiche tout avec `JSON.stringify(selectedLog, null, 2)` (ligne 248) incluant potentiellement des tokens, passwords, etc. **Fix**: masquer les champs sensibles.

### HIGH
6. **[H1] Pas de pagination.** Tous les logs sont charges d'un coup. Avec des milliers de logs, la page crashera. **Fix**: implementer server-side pagination.

7. **[H2] Pas de filtre par date.** Impossible de voir les logs d'une periode specifique. **Fix**: ajouter un date range picker.

8. **[H3] Le filtre "by action" est un champ texte libre.** Les actions devraient etre un select avec les types connus. **Fix**: charger les types d'actions depuis l'API et utiliser un SelectFilter.

9. **[H4] Pas de notifications en temps reel pour les erreurs.** **Fix**: ajouter des alertes push pour les logs ERROR.

10. **[H5] Le `DataTable` ne gere probablement pas le tri serveur.** `sortable: true` (ligne 112) est defini mais le tri se fait probablement cote client. **Fix**: implementer le tri cote serveur.

### MEDIUM
11. **[M1] Le `actionLabels` (ligne 95-106) est hardcode et incomplet.** Les actions non listees affichent la cle brute. **Fix**: charger dynamiquement ou couvrir toutes les actions possibles.

12. **[M2] Pas de groupement par session/utilisateur.** **Fix**: ajouter une vue groupee par utilisateur ou session.

13. **[M3] Le modal de detail est un simple JSON dump.** **Fix**: structurer l'affichage avec des champs nommes et colores.

14. **[M4] Pas de correlation d'evenements.** Impossible de suivre un parcours complet (login -> navigation -> achat). **Fix**: ajouter un ID de session/trace.

15. **[M5] La stat "total24h" (ligne 198) est trompeuse -- elle montre le total retourne par l'API, pas necessairement les 24 dernieres heures.** **Fix**: filtrer par date cote API.

### LOW
16. **[L1] Le `lastUpdated` timestamp (ligne 188-190) est dans le header, pas tres visible.** **Fix**: le rendre plus prominent.

17. **[L2] Pas de coloration syntaxique pour le JSON dans le modal.** **Fix**: utiliser un composant JSON viewer avec coloration.

18. **[L3] L'IP address est affichee mais pas geolocalisee.** **Fix**: ajouter un tooltip avec la geolocalisation approximative.

19. **[L4] Le User Agent est dans les details mais pas dans la table.** **Fix**: ajouter une colonne "Device" avec parsing du UA.

20. **[L5] Pas de sauvegarde des filtres.** Les filtres sont perdus au rechargement. **Fix**: persister dans l'URL (query params).

21. **[L6] Pas de log de niveau TRACE/VERBOSE.** Seulement INFO/WARNING/ERROR/DEBUG. **Fix**: supporter plus de niveaux.

22. **[L7] L'intervalle d'auto-refresh (10s) n'est pas configurable.** **Fix**: ajouter un selecteur d'intervalle (5s, 10s, 30s, 60s).

23. **[L8] Pas de fonctionnalite de "tail" en temps reel.** **Fix**: ajouter un mode live stream avec SSE.

24. **[L9] Le composant `Input` utilise pour le filtre action (ligne 221-227) n'a pas d'icone de recherche.** **Fix**: ajouter un icone Search.

25. **[L10] Pas de dashboard visuel des erreurs (graphique temporel).** **Fix**: ajouter un mini-graphique montrant la distribution des erreurs dans le temps.

---

# RESUME

| # | Menu Element | Critical | High | Medium | Low | Total |
|---|-------------|----------|------|--------|-----|-------|
| 1 | Medias | 5 | 5 | 5 | 10 | 25 |
| 2 | Emails | 5 | 5 | 5 | 10 | 25 |
| 3 | SEO | 5 | 5 | 5 | 10 | 25 |
| 4 | Webinaires | 5 | 5 | 5 | 10 | 25 |
| 5 | Chat | 5 | 5 | 5 | 10 | 25 |
| 6 | Avis/Reviews | 5 | 5 | 5 | 10 | 25 |
| 7 | Questions | 5 | 5 | 5 | 10 | 25 |
| 8 | Traductions | 5 | 5 | 5 | 10 | 25 |
| 9 | Parametres | 5 | 5 | 5 | 10 | 25 |
| 10 | Employes | 5 | 5 | 5 | 10 | 25 |
| 11 | Livraison | 5 | 5 | 5 | 10 | 25 |
| 12 | Rapports | 5 | 5 | 5 | 10 | 25 |
| 13 | UAT | 5 | 5 | 5 | 10 | 25 |
| 14 | Permissions | 5 | 5 | 5 | 10 | 25 |
| 15 | Logs | 5 | 5 | 5 | 10 | 25 |
| **TOTAL** | | **75** | **75** | **75** | **150** | **375** |

## Patterns recurrents identifies

1. **Boutons sans onClick (decoratifs)**: Medias upload, Emails send-test/save, SEO sitemap/save, Webinaires create/edit/cancel, Rapports export, Logs export. Represente ~15 fonctionnalites critiques manquantes.

2. **State local non persiste**: Medias delete, Emails toggle/settings, SEO noIndex/save, Questions togglePublic/delete, Livraison form. Les modifications sont perdues au rechargement.

3. **Pas de pagination**: 12/15 pages n'ont pas de pagination, ce qui causera des problemes de performance en production.

4. **Hardcoded i18n violations**: Chat Dashboard (texte francais hardcode), Reviews ("With Photos"), plusieurs labels.

5. **Pas de validation cote frontend**: La plupart des formulaires n'ont pas de validation (longueur, format, bornes numeriques).

6. **XSS potentiel**: Medias (noms de fichiers), Chat (messages), Reviews (contenu), Templates (HTML).

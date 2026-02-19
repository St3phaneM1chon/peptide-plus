# REGLE NON NEGOCIABLE: Deploiement Azure - peptide-plus

## OBLIGATION #1 - SEARCH BEFORE SOLVE

**Avant TOUT troubleshooting de build/deploy, CHERCHER d'abord:**

```bash
# 1. Memoire vectorielle (via TodoMaster)
curl -s -X POST "http://localhost:8002/api/vector/search?query=DESCRIPTION_ERREUR&limit=5"

# 2. Knowledge islands Azure
python3 /Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_knowledge_islands.py --briefing azure

# 3. Knowledge islands Next.js (si erreur build)
python3 /Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_knowledge_islands.py --briefing nextjs

# 4. Fichier de reference
# Lire: /Users/altittudes.vip/.claude-profiles/compte-b/projects/-Volumes-AI-Project/memory/deployment-azure-peptide.md
```

**Si la solution existe en memoire: l'appliquer DIRECTEMENT, sans re-investiguer.**
**Si la solution n'existe pas: debugger, puis sauvegarder l'apprentissage (voir Obligation #3).**

---

## OBLIGATION #2 - Checklist Pre-Deploiement

Avant chaque `git push` qui declenche un deploy Azure, verifier **dans cet ordre**:

### A. Schema DB sync (AVANT le deploy)
```bash
cd /Volumes/AI_Project/peptide-plus
npx prisma validate
npx prisma generate
npm run build  # Verifier que le build local passe
```
Si le schema local a change, appliquer en production:
```bash
DATABASE_URL='postgresql://...' npx prisma db push
```

### B. Variables d'environnement CI
Verifier que **toutes** les vars requises sont dans GitHub Secrets:
- `DATABASE_URL` (Azure PostgreSQL, pas localhost!)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `AZURE_WEBAPP_NAME`, `AZURE_PUBLISH_PROFILE`

### C. Lazy initialization des SDKs
**ANTIPATTERN**: Initialiser un SDK au top-level d'un module (crash si env var absente en CI)
```typescript
// MAUVAIS - crash au build si STRIPE_SECRET_KEY absent
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// BON - lazy init, ne crash qu'a l'appel
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}
```
Verifier: `grep -rn "new Stripe\|new PrismaClient\|createClient" src/lib/ --include="*.ts"`

### D. Generalisation des fixes
Si un fix est applique a un fichier (ex: lazy init dans `stripe.ts`), verifier TOUS les fichiers similaires:
```bash
grep -rn "process.env\." src/lib/ --include="*.ts" | grep -v "\.env"
```

### E. SSR/cookies safety
Les appels `cookies()` et `headers()` de Next.js ne fonctionnent que dans les Server Components.
Verifier: `grep -rn "cookies()\|headers()" src/ --include="*.ts" --include="*.tsx"`
Si utilise dans un fichier: verifier qu'il n'est PAS importe par un Client Component (`'use client'`).

---

## OBLIGATION #3 - Compte-Rendu Post-Deploiement

Apres **chaque** deploiement (reussi OU echoue), produire ce compte-rendu:

```markdown
## Deploy Report - YYYY-MM-DD HH:MM
- **Commit**: <sha>
- **Resultat**: SUCCESS / FAILURE
- **Erreurs rencontrees**: (liste)
- **Fixes appliques**: (liste avec fichiers modifies)
- **Verification post-deploy**: (URL testee, status)
- **Apprentissage**: (ce qu'on a appris de nouveau)
```

**Sauvegarder obligatoirement:**
1. En memoire vectorielle:
```bash
/opt/homebrew/bin/python3.13 /Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_vector_store.py \
  --add "Deploy peptide-plus YYYY-MM-DD: DESCRIPTION PROBLEME ET SOLUTION" \
  --id "learning-deploy-peptide-YYYY-MM-DD"
```
2. Dans le fichier de reference: ajouter au log dans `deployment-azure-peptide.md`

---

## OBLIGATION #4 - Ordering Pipeline

L'ordre des operations est **critique**. Toujours respecter:

1. `npx prisma validate` - Schema valide?
2. `npx prisma generate` - Client regenere?
3. `npm run build` - Build local OK?
4. Schema sync production (si schema change): `DATABASE_URL='...' npx prisma db push`
5. `git add && git commit && git push` - Deploy
6. Verification post-deploy: `curl -s https://SITE_URL/api/health`
7. Compte-rendu (voir Obligation #3)

**JAMAIS** deployer si le build local echoue.
**JAMAIS** deployer si le schema production n'est pas sync.

---

## KEDB - Known Error Database

### KB-PP-BUILD-001: PrismaClient crash en CI
- **Symptome**: `Error: @prisma/client did not initialize yet` ou `DATABASE_URL environment variable is not set`
- **Cause racine**: PrismaClient instancie au top-level d'un module, Node.js l'execute au `import` pendant le build CI ou DATABASE_URL absente dans GitHub Secrets
- **Fix**: Wraper dans une fonction lazy:
  ```typescript
  // src/lib/prisma.ts
  import { PrismaClient } from '@prisma/client'
  const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
  export const prisma = globalForPrisma.prisma || new PrismaClient()
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
  ```
- **Prevention**: Verifier que DATABASE_URL est dans GitHub Secrets. Utiliser le pattern global singleton.
- **Detecte**: 2026-02-19

### KB-PP-BUILD-002: Stripe SDK crash en CI
- **Symptome**: `Error: No API key provided` au build time
- **Cause racine**: `new Stripe(process.env.STRIPE_SECRET_KEY!)` au top-level, execute pendant `next build` meme si le code n'est utilise qu'en runtime
- **Fix**: Lazy init via fonction factory:
  ```typescript
  let _stripe: Stripe | null = null
  export function getStripe(): Stripe {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing')
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    }
    return _stripe
  }
  ```
- **Prevention**: JAMAIS instancier de SDK au top-level. Toujours lazy init. Chercher avec `grep -rn "new Stripe\|new.*Client(" src/lib/`.
- **Generalisation**: Ce pattern s'applique a TOUT SDK tiers (Stripe, SendGrid, Twilio, etc.)
- **Detecte**: 2026-02-19

### KB-PP-BUILD-003: cookies()/headers() crash SSR
- **Symptome**: `Dynamic server usage: Route couldn't be rendered statically` ou `cookies is not a function`
- **Cause racine**: `cookies()` de `next/headers` appele dans un contexte statique ou importe par un Client Component
- **Fix**: 1) S'assurer que le fichier est un Server Component (pas de `'use client'`). 2) Utiliser `dynamic = 'force-dynamic'` si necessaire. 3) Ne PAS importer de module utilisant `cookies()` dans un Client Component.
- **Prevention**: `grep -rn "cookies()\|headers()" src/` et verifier chaque fichier.
- **Detecte**: 2026-02-19

### KB-PP-BUILD-004: Schema drift (champ absent en production)
- **Symptome**: `Unknown column` ou `The column does not exist` en production, mais marche en local
- **Cause racine**: Schema Prisma modifie localement (`npx prisma db push`) mais pas applique en production
- **Fix**: Appliquer le schema en production AVANT le deploy:
  ```bash
  DATABASE_URL='postgresql://...' npx prisma db push
  ```
- **Prevention**: Inclure `prisma db push` dans le pipeline CI/CD ou verifier manuellement avant chaque push.
- **Exemple**: `Category.parentId` ajoute localement mais absent en production (2026-02-19)
- **Detecte**: 2026-02-19

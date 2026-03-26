# MOT MAGIQUE: "audit sécurité" ou "security audit"

## Declencheur
Quand l'utilisateur tape "audit sécurité", "security audit", ou "audit securite":
Lancer le pipeline d'audit de sécurité complet 14 domaines ci-dessous.

## Description
Audit Forge v5.0 — Scan de sécurité exhaustif de la plateforme Koraline/Attitudes.vip.
14 domaines, prompt anti-généralisation 4 couches, pipeline 3 passes (generator→critic→cross-module).

## Pipeline

### Phase 1: Scan des 14 domaines (5 agents paralleles max)

| Domaine | Poids risque | Fichiers cles |
|---------|-------------|---------------|
| auth + payment | 2.0 | src/app/api/auth/*, src/app/api/payments/*, src/lib/auth-*.ts |
| accounting | 1.5 | src/app/api/accounting/*, src/app/api/admin/accounting/* |
| ecommerce | 1.5 | src/app/api/cart/*, src/app/api/checkout/*, src/app/api/orders/* |
| CRM | 1.2 | src/app/api/admin/crm/*, src/lib/crm/* |
| VoIP/telephonie | 1.2 | src/app/api/voip/*, src/app/api/admin/voip/*, src/lib/voip/* |
| LMS (formation) | 1.2 | src/app/api/lms/*, src/app/api/admin/lms/*, src/lib/lms/* |
| loyalty + rewards | 1.0 | src/app/api/loyalty/*, src/app/api/gift-cards/*, src/app/api/referrals/* |
| marketing | 1.0 | src/app/api/admin/emails/campaigns/*, src/app/api/admin/promo-codes/* |
| media | 1.0 | src/app/api/admin/medias/*, src/app/api/admin/videos/*, src/lib/storage.ts |
| community + content | 1.0 | src/app/api/chat/*, src/app/api/community/*, src/app/api/blog/* |
| emails + communications | 1.0 | src/app/api/email/*, src/app/api/tracking/*, src/app/api/mailing-list/* |
| admin infra + system | 1.0 | src/app/api/admin/settings/*, src/app/api/cron/*, src/lib/admin-*.ts |
| user + profile | 1.0 | src/app/api/account/*, src/app/api/user/* |
| i18n + bridges cross-module | 1.0 | src/i18n/*, src/lib/translation.ts |

### Phase 2: Pour chaque domaine, verifier

**Securite (OWASP Top 10)**:
- Auth: identite ET permissions verifiees? (withAdminGuard/withUserGuard/auth())
- Input: TOUS parametres valides avec Zod?
- Output: reponse peut leaker PII (password, email, token)?
- Injection: inputs dans queries raw SQL?
- CSRF: mutations ont token CSRF?
- Rate limiting: route peut etre abusee?
- Webhooks: signature verifiee? (Ed25519/HMAC)

**Integrite donnees**:
- Transaction: operations multi-tables dans $transaction?
- Race condition: TOCTOU possible?
- Cross-tenant: IDs filtres par tenantId?
- Idempotence: meme requete 2x = meme resultat?

**Infrastructure**:
- Redis: rate limiting persiste entre redemarrages?
- Cookies: __Secure- prefix, HttpOnly, SameSite?
- Storage: uploads valides (magic bytes, taille, type)?
- Dependencies: npm audit clean?

### Phase 3: Corriger immediatement

- P0 (CRITICAL): Corriger AVANT de continuer
- P1 (HIGH): Corriger dans la meme session
- P2 (MEDIUM): Corriger si < 5 min, sinon documenter
- P3 (LOW): Documenter pour prochain audit

### Phase 4: Build + Commit

```bash
npx prisma validate && npx prisma generate
NODE_OPTIONS="--max-old-space-size=8192" npm run build
git add <fichiers modifies> && git commit
```

### Phase 5: Rapport

Produire un tableau recapitulatif:

| Domaine | Findings | Fixed | Score (0-100) | Grade |
|---------|----------|-------|---------------|-------|

Scoring: 100 - (Critical×10 + High×5 + Medium×2 + Low×1)
Grade: A>=90, B>=80, C>=70, D>=50, F<50

### Phase 6: Sauvegarde

1. Memoire vectorielle:
```bash
/opt/homebrew/bin/python3.13 Scripts/aurelia_vector_store.py \
  --add "Security audit YYYY-MM-DD: RESULTATS" \
  --id "learning-security-audit-YYYY-MM-DD"
```
2. Mettre a jour `memory/project_mega_audit_v2_complete.md`

## Resultats du dernier audit (2026-03-26)

**Score global: 98/100 (A)**

| Domaine | Findings | Fixed | Score |
|---------|----------|-------|-------|
| Auth | 12 | 12 (100%) | A |
| Payment | 9 | 9 (100%) | A |
| Accounting | 12 | 12 (100%) | A |
| Ecommerce | 9 | 9 (100%) | A |
| CRM | 15 | 15 (100%) | A |
| VoIP | 14 | 14 (100%) | A |
| LMS | 5 | 5 (100%) | A |
| Communications | 11 | 11 (100%) | A |
| Loyalty | 13 | 13 (100%) | A |
| Media | 3 | 3 (100%) | A |
| Admin/System | 3 | 3 (100%) | A |
| Marketing | 0 | - | A |
| User/Profile | 0 | - | A |
| i18n/Bridges | 0 | - | A |
| **TOTAL** | **106** | **106 (100%)** | **A** |

## Hebergement: Railway (PAS Azure)
- HTTPS end-to-end natif
- Cookies __Secure- actifs
- Redis via add-on Railway
- Deploy via git push (pas GitHub Actions)

## Cadence recommandee
- **Trimestriel**: audit securite complet (ce pipeline)
- **Hebdomadaire**: 1 domaine en rotation (voir mega-audit-recurring.md)
- **Pre-push**: checks deterministes (pre-push-audit.ts)

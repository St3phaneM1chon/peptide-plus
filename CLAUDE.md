# CLAUDE.md - peptide-plus (BioCycle Peptides)

## Project Overview
- **Stack**: Next.js 15 (App Router), TypeScript (strict), Prisma 5.22, PostgreSQL 15
- **Hosting**: Azure App Service + Azure PostgreSQL Flexible Server
- **CI/CD**: GitHub Actions → Azure deployment
- **i18n**: 22 languages, French reference, `useTranslations()` hook

## CRITICAL RULES

### 1. Prisma Schema - ALWAYS camelCase Relations
- ALL relation fields in `prisma/schema.prisma` MUST use camelCase
- `prisma db pull` generates PascalCase - ALWAYS rename to camelCase after pull
- After ANY schema change: `npx prisma generate && npm run build`
- NEVER commit a schema with PascalCase relation fields

### 2. Translation Integrity - MANDATORY
- **French is the reference language** - all text starts in `fr.json`
- ANY text change (even a comma) MUST update ALL 22 locale files
- NEVER add a `t('key')` call without adding the key to ALL locale files
- NEVER hardcode user-facing text in components - use `t()` always
- Run `grep -r "t('" src/ | grep -v node_modules` to verify keys exist

### 3. Structure Verification Before Changes
- ALWAYS read the current file/schema before modifying
- ALWAYS verify field names match between Prisma schema, API routes, and frontend
- When touching a model: verify `prisma/schema.prisma` + all `src/app/api/` routes using it
- When adding a page: add i18n keys FIRST, then write the component

### 4. Database Coherence
- Local DB: `postgresql://peptide:peptide123@localhost:5433/peptide_plus` (Docker)
- Production DB: Azure PostgreSQL (see .env)
- After schema changes, verify BOTH databases have matching structures
- Use `prisma db push` for dev, `prisma migrate` for production

### 5. Azure Deployment (NON NEGOCIABLE)
- **SEARCH BEFORE SOLVE**: Chercher en memoire vectorielle + knowledge islands AVANT tout troubleshooting
- **Checklist pre-deploy**: Build local, env CI, lazy init SDKs, schema sync, generalisation fixes
- **Compte-rendu post-deploy**: Obligatoire apres chaque deploy (reussi ou echoue) + sauvegarde vectorielle
- **KEDB**: 4 erreurs connues documentees (KB-PP-BUILD-001 a 004) dans `.claude/rules/deployment-azure.md`
- **Pipeline ordering**: Schema sync AVANT deploy, build local AVANT push
- **Reference complete**: `.claude/rules/deployment-azure.md` et `memory/deployment-azure-peptide.md`

## Architecture

### Directory Structure
```
src/
  app/
    (shop)/     - E-commerce pages (products, checkout, account)
    (public)/   - Corporate/info pages (about, blog, legal)
    api/        - API routes
    admin/      - Admin dashboard
    auth/       - Authentication pages
    dashboard/  - User dashboards (customer, employee, owner)
  components/   - Shared React components
  hooks/        - Custom React hooks
  i18n/         - Translation system (22 locales)
  lib/          - Business logic, services, utilities
prisma/
  schema.prisma - Database schema (115 tables)
```

### Translation System
- **Client hook**: `useTranslations()` from `src/hooks/useTranslations.ts`
- **Context hook**: `useI18n()` from `src/i18n/client.tsx`
- **Locale files**: `src/i18n/locales/{locale}.json`
- **Supported**: en, fr, ar, ar-dz, ar-lb, ar-ma, de, es, gcr, hi, ht, it, ko, pa, pl, pt, ru, sv, ta, tl, vi, zh

### Key Models
- Product, Category, Order, User (core e-commerce)
- JournalEntry, ChartOfAccount (accounting)
- Ambassador, Company (B2B)
- 14 Translation models (for DB content)

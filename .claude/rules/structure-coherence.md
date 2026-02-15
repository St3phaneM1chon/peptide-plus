# Structure Coherence Rules

## ALWAYS Verify Before Modifying
1. **Read the file** before editing - understand current structure
2. **Check schema** before touching API routes - verify field names
3. **Check API** before touching frontend - verify response shape
4. **Check i18n** before adding text - verify key exists

## When Working on a Feature
1. Prisma schema → API route → Frontend component → i18n keys
2. NEVER assume field names - always verify in schema.prisma
3. After adding Prisma fields: generate, build, verify
4. After adding API endpoints: test with curl/browser

## Database Consistency
- Both local and production databases must stay in sync
- After `prisma db push` locally, apply same migration to production
- Always verify table counts match between local and production
- Check Translation tables are populated (they were empty!)

## TypeScript Strict Mode
- Project uses `strict: true` in tsconfig.json
- ALL Prisma includes must match exact field names from schema
- Never use `any` to bypass type errors from Prisma
- Fix the root cause (schema mismatch) instead

## Code Style
- Components: PascalCase files, camelCase props
- API routes: `route.ts` with standard Next.js handlers
- Hooks: `use{Name}.ts` in `src/hooks/`
- Services: `{name}.service.ts` in `src/lib/`

# Prisma Schema Rules

## MANDATORY: camelCase Relation Fields
Every relation field in schema.prisma MUST use camelCase naming:
- ✅ `items OrderItem[]`
- ✅ `currency Currency @relation(...)`
- ❌ `OrderItem OrderItem[]`
- ❌ `Currency Currency @relation(...)`

## After `prisma db pull`
1. ALWAYS rename PascalCase relation fields to camelCase
2. Run `npx prisma format`
3. Run `npx prisma validate`
4. Run `npx prisma generate`
5. Run `npm run build` to verify

## After ANY schema change
1. `npx prisma generate` to regenerate client
2. `npm run build` to verify TypeScript compatibility
3. Verify frontend code matches new field names
4. If relation field added: check if code uses `include:` with old name

## Common Relation Naming Patterns
- Single relation: `user`, `product`, `order`, `category`
- Collection: `items`, `lines`, `messages`, `translations`
- Self-reference: `parent` (singular), `children` (plural)
- Disambiguated: Keep descriptive names like `assignedTo`, `purchaser`

## Phantom Fields
NEVER reference a field in code that doesn't exist in the schema.
Known phantom: `restockedAt` on Product model - DO NOT USE.

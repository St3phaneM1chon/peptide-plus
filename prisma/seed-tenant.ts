/**
 * MIGRATION SCRIPT: Initialize Multi-Tenant for BioCycle Peptides
 *
 * Phase 2 of the multi-tenant migration:
 * 1. Creates the "biocycle" tenant (first client)
 * 2. Creates the "attitudes" tenant (super-admin / platform)
 * 3. Sets tenantId = biocycle.id on ALL existing data
 *
 * Run with: npx tsx prisma/seed-tenant.ts
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('🏢 Starting multi-tenant migration...\n');

  // Step 1: Create BioCycle tenant (first client)
  const biocycle = await prisma.tenant.upsert({
    where: { slug: 'biocycle' },
    update: {},
    create: {
      slug: 'biocycle',
      name: 'BioCycle Peptides',
      domainCustom: 'biocyclepeptides.com',
      domainKoraline: 'biocycle.koraline.app',
      plan: 'pro',
      status: 'ACTIVE',
      logoUrl: '/images/logo.png',
      primaryColor: '#16a34a',
      secondaryColor: '#15803d',
      locale: 'fr',
      timezone: 'America/Toronto',
      currency: 'CAD',
      modulesEnabled: JSON.stringify([
        'commerce', 'catalogue', 'marketing', 'emails',
        'comptabilite', 'systeme', 'communaute', 'crm',
        'chat', 'blog', 'fidelite', 'ambassadeurs',
        'telephonie', 'media',
      ]),
      featuresFlags: JSON.stringify({
        marketplace: false,
        live_shopping: false,
        ai_repricing: false,
      }),
      maxEmployees: 50,
    },
  });
  console.log(`✅ Tenant "biocycle" created/verified: ${biocycle.id}`);

  // Step 2: Create Attitudes tenant (super-admin / platform)
  const attitudes = await prisma.tenant.upsert({
    where: { slug: 'attitudes' },
    update: {},
    create: {
      slug: 'attitudes',
      name: 'Attitudes VIP',
      domainCustom: 'attitudes.vip',
      domainKoraline: 'attitudes.koraline.app',
      plan: 'enterprise',
      status: 'ACTIVE',
      logoUrl: '/images/attitudes-logo.png',
      primaryColor: '#0066CC',
      secondaryColor: '#003366',
      locale: 'fr',
      timezone: 'America/Toronto',
      currency: 'CAD',
      modulesEnabled: JSON.stringify([
        'commerce', 'catalogue', 'marketing', 'emails',
        'comptabilite', 'systeme', 'communaute', 'crm',
        'chat', 'blog', 'fidelite', 'ambassadeurs',
        'telephonie', 'media',
      ]),
      featuresFlags: JSON.stringify({
        marketplace: true,
        live_shopping: false,
        ai_repricing: false,
        super_admin: true,
      }),
      maxEmployees: 100,
    },
  });
  console.log(`✅ Tenant "attitudes" created/verified: ${attitudes.id}`);

  // Step 3: Migrate ALL existing data to BioCycle tenant
  console.log('\n📦 Migrating existing data to BioCycle tenant...');

  // Get all table names that have tenantId column
  const tables: { table_name: string }[] = await prisma.$queryRaw`
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name
    WHERE c.column_name = 'tenantId'
      AND t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name != 'Tenant'
    ORDER BY c.table_name
  `;

  console.log(`Found ${tables.length} tables with tenantId column\n`);

  let totalUpdated = 0;

  for (const { table_name } of tables) {
    try {
      // Count rows with NULL tenantId
      const nullCount: { count: bigint }[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "${table_name}" WHERE "tenantId" IS NULL`
      );
      const count = Number(nullCount[0]?.count || 0);

      if (count > 0) {
        // Update all NULL tenantId to BioCycle
        await prisma.$executeRawUnsafe(
          `UPDATE "${table_name}" SET "tenantId" = $1 WHERE "tenantId" IS NULL`,
          biocycle.id
        );
        console.log(`  ✅ ${table_name}: ${count} rows → tenantId = biocycle`);
        totalUpdated += count;
      } else {
        console.log(`  ⏭️  ${table_name}: already migrated (0 NULL)`);
      }
    } catch (error) {
      console.error(`  ❌ ${table_name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n✅ Migration complete: ${totalUpdated} rows updated across ${tables.length} tables`);
  console.log(`\n📊 Summary:`);
  console.log(`  - BioCycle tenant ID: ${biocycle.id}`);
  console.log(`  - Attitudes tenant ID: ${attitudes.id}`);
  console.log(`  - Tables migrated: ${tables.length}`);
  console.log(`  - Rows updated: ${totalUpdated}`);
}

main()
  .then(() => {
    console.log('\n🎉 Multi-tenant migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

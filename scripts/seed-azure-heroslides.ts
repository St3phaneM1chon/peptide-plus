/**
 * Seed hero slides into Azure PostgreSQL from local database
 */

import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient();
const azurePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.AZURE_DATABASE_URL,
    },
  },
});

async function main() {
  console.log('📸 Migrating hero slides to Azure DB...\n');

  // 1. Get all slides from local DB
  const localSlides = await localPrisma.heroSlide.findMany({
    include: { translations: true },
    orderBy: { sortOrder: 'asc' },
  });

  console.log(`Found ${localSlides.length} slides locally\n`);

  // 2. Check if Azure already has slides
  const azureCount = await azurePrisma.heroSlide.count();
  if (azureCount > 0) {
    console.log(`⚠️  Azure already has ${azureCount} slides. Deleting them first...`);
    await azurePrisma.heroSlideTranslation.deleteMany({});
    await azurePrisma.heroSlide.deleteMany({});
    console.log('   Deleted existing slides.\n');
  }

  // 3. Create slides on Azure
  for (const slide of localSlides) {
    const { translations, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...slideData } = slide;

    await azurePrisma.heroSlide.create({
      data: {
        ...slideData,
        translations: {
          create: translations.map(({ id: _id, slideId: _slideId, createdAt: _createdAt, updatedAt: _updatedAt, ...t }) => t),
        },
      },
    });

    console.log(`✅ Slide "${slide.slug}" (order ${slide.sortOrder}): ${slide.title}`);
    console.log(`   ${translations.length} translations migrated`);
  }

  // 4. Verify
  const finalCount = await azurePrisma.heroSlide.count();
  const transCount = await azurePrisma.heroSlideTranslation.count();
  console.log(`\n🏁 Done! ${finalCount} slides, ${transCount} translations on Azure`);
}

main()
  .then(async () => {
    await localPrisma.$disconnect();
    await azurePrisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error:', e);
    await localPrisma.$disconnect();
    await azurePrisma.$disconnect();
    process.exit(1);
  });

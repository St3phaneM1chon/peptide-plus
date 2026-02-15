/**
 * Seed script to create sample product bundles
 * Run with: npx tsx scripts/seed-bundles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding product bundles...');

  // Get some products to use in bundles
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { formats: true },
    take: 10,
  });

  if (products.length < 2) {
    console.log('⚠️  Not enough products found. Please seed products first.');
    return;
  }

  console.log(`Found ${products.length} products to use in bundles`);

  // Create sample bundles
  const bundles = [
    {
      name: 'Muscle Recovery Stack',
      slug: 'muscle-recovery-stack',
      description: 'Complete recovery bundle with BPC-157 and TB-500 for optimal healing and tissue repair.',
      image: null,
      discount: 15,
      isActive: true,
      items: products.slice(0, 2).map((product, idx) => ({
        productId: product.id,
        formatId: product.formats[0]?.id || null,
        quantity: idx === 0 ? 2 : 1,
      })),
    },
    {
      name: 'Weight Loss Protocol',
      slug: 'weight-loss-protocol',
      description: 'Comprehensive weight loss bundle with GLP-1 peptides and metabolism support.',
      image: null,
      discount: 20,
      isActive: true,
      items: products.slice(2, 5).map((product) => ({
        productId: product.id,
        formatId: product.formats[0]?.id || null,
        quantity: 1,
      })),
    },
    {
      name: 'Beginner Starter Kit',
      slug: 'beginner-starter-kit',
      description: 'Everything you need to get started with peptide research. Includes peptides, accessories, and supplies.',
      image: null,
      discount: 10,
      isActive: true,
      items: products.slice(0, 3).map((product, idx) => ({
        productId: product.id,
        formatId: product.formats[0]?.id || null,
        quantity: idx === 0 ? 1 : 2,
      })),
    },
  ];

  for (const bundleData of bundles) {
    try {
      const bundle = await prisma.bundle.create({
        data: {
          name: bundleData.name,
          slug: bundleData.slug,
          description: bundleData.description,
          image: bundleData.image,
          discount: bundleData.discount,
          isActive: bundleData.isActive,
          items: {
            create: bundleData.items,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      console.log(`✅ Created bundle: ${bundle.name} (${bundle.items.length} items, ${bundle.discount}% off)`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`❌ Error creating bundle "${bundleData.name}":`, error.message);
      } else {
        console.error(`❌ Error creating bundle "${bundleData.name}":`, error);
      }
    }
  }

  console.log('✨ Bundle seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

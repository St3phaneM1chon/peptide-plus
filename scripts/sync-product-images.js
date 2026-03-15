/**
 * Sync Product.imageUrl → ProductImage records
 * For products that have imageUrl but no ProductImage entries,
 * creates a primary ProductImage record.
 *
 * Usage: DATABASE_URL="..." node scripts/sync-product-images.js
 */
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  // Find products with imageUrl but no ProductImage records
  const products = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      images: { select: { id: true, url: true, isPrimary: true } },
    },
  });

  console.log(`Total products with imageUrl: ${products.length}`);

  let created = 0;
  let skipped = 0;

  for (const p of products) {
    if (p.images.length === 0 && p.imageUrl) {
      await prisma.productImage.create({
        data: {
          productId: p.id,
          url: p.imageUrl,
          alt: p.name || '',
          sortOrder: 0,
          isPrimary: true,
        },
      });
      created++;
      console.log(`  CREATED: ${p.name} → ${p.imageUrl.substring(0, 60)}...`);
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped (already has images): ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

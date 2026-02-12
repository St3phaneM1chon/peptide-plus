/**
 * Fix product image URLs in Azure PostgreSQL
 * Updates old imageUrl paths to new /slug/main.png format
 * Also handles duplicate product cleanup
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.AZURE_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

// Map of slug -> correct imageUrl
const imageFixMap: Record<string, string> = {
  'nmn': '/images/products/nmn/main.png',
  'injection-pen': '/images/products/injection-pen/main.png',
  'melanotan-2': '/images/products/melanotan-2/main.png',
  'kisspeptin-10': '/images/products/kisspeptin-10/main.png',
  'pt-141': '/images/products/pt-141/main.png',
  'dihexa': '/images/products/dihexa/main.png',
  'semax': '/images/products/semax/main.png',
  'selank': '/images/products/selank/main.png',
  'thymalin': '/images/products/thymalin/main.png',
  'epithalon': '/images/products/epitalon/main.png',
  'follistatin-344': '/images/products/follistatin-344/main.png',
  'igf-1-lr3': '/images/products/igf-1-lr3/main.png',
  'tesamorelin': '/images/products/tesamorelin/main.png',
  'retatrutide': '/images/products/retatrutide/main.png',
  'insulin-syringes-u100': '/images/products/kit-seringues-insuline/main.png',
  'bacteriostatic-water': '/images/products/eau-bacteriostatique/main.png',
};

async function main() {
  console.log('🔧 Fixing product image URLs on Azure DB...\n');

  // 1. Fix image URLs
  for (const [slug, correctImageUrl] of Object.entries(imageFixMap)) {
    const product = await prisma.product.findUnique({ where: { slug } });
    if (!product) {
      console.log(`⚠️  Product "${slug}" not found, skipping`);
      continue;
    }

    if (product.imageUrl === correctImageUrl) {
      console.log(`✅ ${slug}: already correct`);
      continue;
    }

    await prisma.product.update({
      where: { slug },
      data: { imageUrl: correctImageUrl },
    });
    console.log(`🔄 ${slug}: ${product.imageUrl} → ${correctImageUrl}`);
  }

  // 2. Check for duplicates
  console.log('\n📋 Checking for duplicate products...');
  const duplicatePairs = [
    ['bacteriostatic-water', 'eau-bacteriostatique'],
    ['insulin-syringes-u100', 'kit-seringues-insuline'],
  ];

  for (const [oldSlug, newSlug] of duplicatePairs) {
    const oldProduct = await prisma.product.findUnique({ where: { slug: oldSlug } });
    const newProduct = await prisma.product.findUnique({ where: { slug: newSlug } });

    if (oldProduct && newProduct) {
      console.log(`⚠️  DUPLICATE: "${oldSlug}" AND "${newSlug}" both exist`);
      console.log(`   Old: id=${oldProduct.id}, name=${oldProduct.name}`);
      console.log(`   New: id=${newProduct.id}, name=${newProduct.name}`);

      // Check if old product has orders/purchases
      const oldOrders = await prisma.orderItem.count({
        where: { productId: oldProduct.id }
      });
      const oldPurchases = await prisma.purchase.count({
        where: { productId: oldProduct.id }
      });

      if (oldOrders === 0 && oldPurchases === 0) {
        // Safe to deactivate old product
        await prisma.product.update({
          where: { slug: oldSlug },
          data: { isActive: false },
        });
        console.log(`   → Deactivated "${oldSlug}" (no orders/purchases)`);
      } else {
        console.log(`   → "${oldSlug}" has ${oldOrders} orders, ${oldPurchases} purchases - keeping active`);
      }
    }
  }

  // 3. Verify
  console.log('\n📊 Verification...');
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true, imageUrl: true, name: true },
    orderBy: { name: 'asc' },
  });

  let defaultCount = 0;
  for (const p of allProducts) {
    const hasImage = p.imageUrl && !p.imageUrl.includes('peptide-default');
    if (!hasImage) defaultCount++;
    const status = hasImage ? '✅' : '❌';
    console.log(`${status} ${p.slug}: ${p.imageUrl}`);
  }

  console.log(`\n🏁 Done! ${allProducts.length} active products, ${defaultCount} still using default image`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error:', e);
    prisma.$disconnect();
    process.exit(1);
  });

// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const formats = await p.productFormat.findMany({
    where: { isActive: true },
    select: { id: true, name: true, imageUrl: true, product: { select: { slug: true } } },
  });

  let withImage = 0;
  let withoutImage = 0;
  for (const f of formats) {
    if (f.imageUrl) {
      withImage++;
      console.log(`  HAS IMAGE: ${f.product.slug} / ${f.name} -> ${f.imageUrl}`);
    } else {
      withoutImage++;
    }
  }
  console.log(`\nTotal formats: ${formats.length} | With image: ${withImage} | Without: ${withoutImage}`);

  // Check product gallery images
  const images = await p.productImage.findMany({
    select: { url: true, isPrimary: true, product: { select: { slug: true } } },
    orderBy: [{ product: { slug: 'asc' } }, { sortOrder: 'asc' }],
  });

  console.log(`\nProduct gallery images: ${images.length}`);
  const byProduct = new Map();
  for (const img of images) {
    const list = byProduct.get(img.product.slug) || [];
    list.push({ url: img.url, isPrimary: img.isPrimary });
    byProduct.set(img.product.slug, list);
  }
  for (const [slug, imgs] of byProduct) {
    console.log(`  ${slug}: ${imgs.length} images`);
    for (const img of imgs) {
      console.log(`    ${img.isPrimary ? 'PRIMARY' : '       '} ${img.url}`);
    }
  }
}

main().then(() => p.$disconnect());

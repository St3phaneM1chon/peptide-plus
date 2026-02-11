import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { formats: true },
  });

  let updated = 0;
  for (const product of products) {
    const hasGoodImage = product.imageUrl && product.imageUrl !== '/images/products/peptide-default.png';
    if (!hasGoodImage) continue;

    for (const format of product.formats) {
      const needsUpdate = !format.imageUrl
        || format.imageUrl.includes('peptide-default')
        || format.imageUrl.includes('/images/formats/');

      if (needsUpdate) {
        await prisma.productFormat.update({
          where: { id: format.id },
          data: { imageUrl: product.imageUrl },
        });
        updated++;
      }
    }
  }

  console.log('Formats updated to use product main image:', updated);
  await prisma.$disconnect();
}
main().catch(console.error);

// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const prods = await p.product.findMany({
    where: { isActive: true },
    select: { slug: true, description: true, shortDescription: true },
    orderBy: { slug: 'asc' },
  });

  let empty = 0;
  let filled = 0;
  for (const prod of prods) {
    const hasDesc = prod.description && prod.description.trim().length > 0;
    const hasShort = prod.shortDescription && prod.shortDescription.trim().length > 0;
    if (!hasDesc) {
      empty++;
      console.log(`  EMPTY desc: ${prod.slug} | shortDesc: ${hasShort ? 'YES' : 'NO'}`);
    } else {
      filled++;
    }
  }
  console.log(`\nTotal: ${prods.length} | With description: ${filled} | Without: ${empty}`);
}

main().then(() => p.$disconnect());

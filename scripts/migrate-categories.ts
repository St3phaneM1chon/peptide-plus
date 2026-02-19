/**
 * Migration Script: Restructure categories into hierarchy
 *
 * Reuses existing categories, creates missing ones, sets parentId
 * Reassigns products, removes NAD+/NMN, cleans up empty categories
 *
 * Usage: npx tsx scripts/migrate-categories.ts
 * Add --dry-run to preview without making changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function migrate() {
  console.log(DRY_RUN ? '🔍 DRY RUN MODE - No changes will be made\n' : '🚀 LIVE MODE - Making changes\n');
  const now = new Date();

  // ============================================================
  // STEP 1: Delete NAD+ and NMN products
  // ============================================================
  console.log('--- Step 1: Remove NAD+ and NMN products ---');

  const productsToDelete = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'NAD+', mode: 'insensitive' } },
        { name: { contains: 'NMN', mode: 'insensitive' } },
        { slug: { contains: 'nad-plus', mode: 'insensitive' } },
        { slug: { contains: 'nmn', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Found ${productsToDelete.length} products to delete:`);
  for (const p of productsToDelete) {
    console.log(`  - ${p.name} (${p.slug})`);
    if (!DRY_RUN) {
      await prisma.quantityDiscount.deleteMany({ where: { productId: p.id } });
      await prisma.productImage.deleteMany({ where: { productId: p.id } });
      await prisma.productFormat.deleteMany({ where: { productId: p.id } });
      await prisma.productTranslation.deleteMany({ where: { productId: p.id } });
      await prisma.review.deleteMany({ where: { productId: p.id } });
      await prisma.priceWatch.deleteMany({ where: { productId: p.id } });
      await prisma.stockAlert.deleteMany({ where: { productId: p.id } });
      await prisma.bundleItem.deleteMany({ where: { productId: p.id } });
      await prisma.upsellConfig.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
      console.log(`  ✅ Deleted`);
    }
  }

  // ============================================================
  // STEP 2: Create or find parent categories
  // ============================================================
  console.log('\n--- Step 2: Create/find parent categories ---');

  async function ensureCategory(slug: string, name: string, description: string, sortOrder: number, parentId: string | null): Promise<string> {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  Found existing: ${existing.name} (${slug}) → updating parentId=${parentId}, sortOrder=${sortOrder}`);
      if (!DRY_RUN) {
        await prisma.category.update({
          where: { id: existing.id },
          data: { parentId, sortOrder, name, description, isActive: true },
        });
      }
      return existing.id;
    } else {
      const id = generateId();
      console.log(`  Creating: ${name} (${slug}) parentId=${parentId}`);
      if (!DRY_RUN) {
        await prisma.category.create({
          data: { id, name, slug, description, parentId, sortOrder, isActive: true, updatedAt: now },
        });
      }
      return id;
    }
  }

  // Parent: Laboratory Equipment (new)
  const labEquipmentId = await ensureCategory(
    'laboratory-equipment',
    'Laboratory Equipment',
    'Professional laboratory equipment and accessories for research',
    1, null
  );

  // Parent: Peptides (reuse existing if slug matches, or create)
  const peptidesId = await ensureCategory(
    'peptides',
    'Peptides',
    'Premium research peptides, 99%+ purity, lab-tested',
    2, null
  );

  // ============================================================
  // STEP 3: Create/update subcategories
  // ============================================================
  console.log('\n--- Step 3: Create/update subcategories ---');

  // Lab Equipment subcategories
  const labEquipSubId = await ensureCategory('lab-equipment', 'Equipment', 'Laboratory equipment and supplies', 1, labEquipmentId);
  const labAccessSubId = await ensureCategory('lab-accessories', 'Accessories', 'Syringes, pens, bacteriostatic water and more', 2, labEquipmentId);

  // Peptide subcategories - reuse existing slugs where they match!
  const antiAgingId = await ensureCategory('anti-aging-longevity', 'Anti-Aging & Longevity', 'Peptides for anti-aging and longevity research', 1, peptidesId);
  const weightLossId = await ensureCategory('weight-loss', 'Weight Loss', 'Peptides for weight management research', 2, peptidesId);
  const skinHealthId = await ensureCategory('skin-health', 'Skin Health', 'Peptides for skin health and pigmentation research', 3, peptidesId);
  const sexualHealthId = await ensureCategory('sexual-health', 'Sexual Health', 'Peptides for sexual health research', 4, peptidesId);
  const cognitiveId = await ensureCategory('cognitive-health', 'Cognitive Health', 'Peptides for cognitive enhancement research', 5, peptidesId);
  const growthMetabId = await ensureCategory('growth-metabolism', 'Growth & Metabolism', 'Growth hormone secretagogues and metabolic peptides', 6, peptidesId);
  const muscleGrowthId = await ensureCategory('muscle-growth', 'Muscle Growth', 'Peptides for muscle growth research', 7, peptidesId);
  const recoveryId = await ensureCategory('recovery-repair', 'Recovery & Repair', 'Peptides for tissue recovery and repair research', 8, peptidesId);

  // ============================================================
  // STEP 4: Reassign products
  // ============================================================
  console.log('\n--- Step 4: Reassign products to subcategories ---');

  // Handle the old "cognitive-brain" slug → move its products to "cognitive-health"
  const oldCognitive = await prisma.category.findUnique({ where: { slug: 'cognitive-brain' } });
  if (oldCognitive && oldCognitive.id !== cognitiveId) {
    const cogProducts = await prisma.product.findMany({ where: { categoryId: oldCognitive.id } });
    console.log(`  Moving ${cogProducts.length} products from cognitive-brain → cognitive-health`);
    if (!DRY_RUN) {
      await prisma.product.updateMany({ where: { categoryId: oldCognitive.id }, data: { categoryId: cognitiveId } });
    }
  }

  // Handle "peptide-blends" (Mélanges & Blends) → recovery-repair
  const oldBlends = await prisma.category.findUnique({ where: { slug: 'peptide-blends' } });
  if (oldBlends) {
    const blendProducts = await prisma.product.findMany({
      where: { categoryId: oldBlends.id },
      select: { id: true, name: true },
    });
    for (const p of blendProducts) {
      // BPC-157 + TB-500 Blend → recovery-repair
      if (p.name.includes('BPC') || p.name.includes('TB')) {
        console.log(`  ${p.name} → recovery-repair`);
        if (!DRY_RUN) await prisma.product.update({ where: { id: p.id }, data: { categoryId: recoveryId } });
      } else {
        console.log(`  ${p.name} → recovery-repair (blend default)`);
        if (!DRY_RUN) await prisma.product.update({ where: { id: p.id }, data: { categoryId: recoveryId } });
      }
    }
  }

  // Handle "accessories" → lab-accessories
  const oldAccessories = await prisma.category.findUnique({ where: { slug: 'accessories' } });
  if (oldAccessories && oldAccessories.id !== labAccessSubId) {
    const accProducts = await prisma.product.findMany({ where: { categoryId: oldAccessories.id } });
    console.log(`  Moving ${accProducts.length} products from accessories → lab-accessories`);
    if (!DRY_RUN) {
      await prisma.product.updateMany({ where: { categoryId: oldAccessories.id }, data: { categoryId: labAccessSubId } });
    }
  }

  // Handle "supplements" → remove (NAD+ and NMN already deleted, any remaining → check)
  const oldSupplements = await prisma.category.findUnique({ where: { slug: 'supplements' } });
  if (oldSupplements) {
    const suppProducts = await prisma.product.findMany({
      where: { categoryId: oldSupplements.id },
      select: { id: true, name: true },
    });
    if (suppProducts.length > 0) {
      console.log(`  ⚠️  Remaining supplements (after NAD+/NMN deletion):`);
      for (const p of suppProducts) {
        console.log(`     - ${p.name} → will need manual assignment`);
      }
    }
  }

  // Now reassign any remaining products that might be in old categories using name matching
  const productMapping: [string, string[]][] = [
    [antiAgingId, ['Epithalon', 'Epitalon', 'Thymalin', 'SS-31', 'Elamipretide']],
    [weightLossId, ['Semaglutide', 'Tirzepatide', 'Retatrutide', 'AOD-9604']],
    [skinHealthId, ['GHK-Cu', 'GHK', 'Melanotan II', 'Melanotan']],
    [sexualHealthId, ['PT-141', 'Kisspeptin']],
    [cognitiveId, ['Dihexa', 'Semax', 'Selank', 'MOTS-c', 'MOTS']],
    [growthMetabId, ['CJC-1295', 'Ipamorelin', 'Tesamorelin', 'MK-677', 'Ibutamoren']],
    [muscleGrowthId, ['Follistatin', 'IGF-1', 'IGF1']],
    [recoveryId, ['BPC-157', 'BPC157', 'TB-500', 'TB500']],
    [labAccessSubId, ['Bactériostatique', 'Bacteriostatic', 'Syringe', 'Seringue', 'Stylo', 'Insulin', 'Injection Pen']],
  ];

  // Get remaining un-assigned products (in categories without parentId that aren't parents themselves)
  const keepCatIds = new Set([labEquipmentId, peptidesId, labEquipSubId, labAccessSubId, antiAgingId, weightLossId, skinHealthId, sexualHealthId, cognitiveId, growthMetabId, muscleGrowthId, recoveryId]);
  const remainingProducts = await prisma.product.findMany({
    where: { categoryId: { notIn: [...keepCatIds] } },
    select: { id: true, name: true, categoryId: true, productType: true },
  });

  let reassigned = 0;
  for (const p of remainingProducts) {
    let targetId: string | null = null;

    for (const [catId, patterns] of productMapping) {
      for (const pattern of patterns) {
        if (p.name.toLowerCase().includes(pattern.toLowerCase())) {
          targetId = catId;
          break;
        }
      }
      if (targetId) break;
    }

    if (!targetId) {
      if (p.productType === 'LAB_SUPPLY') targetId = labEquipSubId;
      else if (p.productType === 'ACCESSORY') targetId = labAccessSubId;
    }

    if (targetId) {
      console.log(`  ${p.name} → reassigned`);
      if (!DRY_RUN) {
        await prisma.product.update({ where: { id: p.id }, data: { categoryId: targetId } });
      }
      reassigned++;
    } else {
      console.log(`  ⚠️  No mapping for: ${p.name} (type: ${p.productType})`);
    }
  }
  console.log(`  Reassigned ${reassigned} remaining products`);

  // ============================================================
  // STEP 5: Clean up empty categories
  // ============================================================
  console.log('\n--- Step 5: Clean up empty old categories ---');

  const allCategories = await prisma.category.findMany({
    include: { _count: { select: { products: true, children: true } } },
  });

  for (const cat of allCategories) {
    if (!keepCatIds.has(cat.id) && cat._count.products === 0 && cat._count.children === 0) {
      console.log(`  Deleting empty: ${cat.name} (${cat.slug})`);
      if (!DRY_RUN) {
        await prisma.categoryTranslation.deleteMany({ where: { categoryId: cat.id } });
        await prisma.category.delete({ where: { id: cat.id } });
      }
    }
  }

  // ============================================================
  // STEP 6: Final summary
  // ============================================================
  console.log('\n--- Final Summary ---');
  const parents = await prisma.category.findMany({
    where: { parentId: null },
    include: {
      _count: { select: { products: true } },
      children: {
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  let totalProducts = 0;
  for (const parent of parents) {
    const childCount = parent.children.reduce((s, c) => s + c._count.products, 0);
    totalProducts += parent._count.products + childCount;
    console.log(`📁 ${parent.name} (${parent.slug}) — ${parent._count.products} direct, ${childCount} in children`);
    for (const child of parent.children) {
      console.log(`   └── ${child.name} (${child.slug}): ${child._count.products} products`);
    }
  }
  console.log(`\nTotal: ${totalProducts} products in ${parents.length} parent + ${parents.reduce((s, p) => s + p.children.length, 0)} sub categories`);
  console.log('\n✅ Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

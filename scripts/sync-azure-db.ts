/**
 * Full sync of local database to Azure PostgreSQL
 * Compares all tables and syncs missing data
 * SAFE: Does not delete existing data with orders/purchases
 */

/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const local = new PrismaClient();
const azure = new PrismaClient({
  datasources: { db: { url: process.env.AZURE_DATABASE_URL } },
});

async function compareAndSync() {
  console.log('🔄 FULL DATABASE SYNC: Local → Azure\n');
  console.log('='.repeat(60));

  // 1. Categories
  console.log('\n📁 CATEGORIES');
  const localCats = await local.category.findMany();
  const azureCats = await azure.category.findMany();
  console.log(`  Local: ${localCats.length} | Azure: ${azureCats.length}`);

  const azureCatSlugs = new Set(azureCats.map(c => c.slug));
  const missingCats = localCats.filter(c => !azureCatSlugs.has(c.slug));
  for (const cat of missingCats) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = cat;
    await azure.category.create({ data });
    console.log(`  ✅ Added category: ${cat.name}`);
  }
  if (missingCats.length === 0) console.log('  ✅ All categories synced');

  // 2. Products (update existing, add missing)
  console.log('\n📦 PRODUCTS');
  const localProds = await local.product.findMany({ include: { formats: true, images: true } });
  const azureProds = await azure.product.findMany({ select: { slug: true, id: true } });
  const azureProdMap = new Map(azureProds.map(p => [p.slug, p.id]));
  console.log(`  Local: ${localProds.length} | Azure: ${azureProds.length}`);

  let addedProds = 0, updatedProds = 0;
  for (const prod of localProds) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, formats, images, ...prodData } = prod;
    const azureId = azureProdMap.get(prod.slug);

    if (!azureId) {
      // Product doesn't exist on Azure - get the categoryId on Azure
      const _azureCat = await azure.category.findFirst({ where: { slug: { not: undefined } } });
      if (prod.categoryId) {
        const localCat = await local.category.findUnique({ where: { id: prod.categoryId } });
        if (localCat) {
          const azureCatMatch = await azure.category.findFirst({ where: { slug: localCat.slug } });
          if (azureCatMatch) {
            prodData.categoryId = azureCatMatch.id;
          }
        }
      }

      await azure.product.create({
        data: {
          ...prodData,
          formats: {
            create: formats.map(({ id: _id, productId: _productId, createdAt: _createdAt, updatedAt: _updatedAt, ...f }) => f),
          },
          images: {
            create: images.map(({ id: _id, productId: _productId, createdAt: _createdAt, updatedAt: _updatedAt, ...i }) => i),
          },
        },
      });
      addedProds++;
      console.log(`  ✅ Added product: ${prod.name}`);
    } else {
      // Update imageUrl and basic info
      await azure.product.update({
        where: { id: azureId },
        data: { imageUrl: prod.imageUrl },
      });

      // Sync formats if missing
      const azureFormats = await azure.productFormat.findMany({ where: { productId: azureId } });
      if (azureFormats.length === 0 && formats.length > 0) {
        for (const fmt of formats) {
          const { id: _id, productId: _productId, createdAt: _createdAt, updatedAt: _updatedAt, ...fmtData } = fmt;
          await azure.productFormat.create({ data: { ...fmtData, productId: azureId } });
        }
        console.log(`  🔄 Added ${formats.length} formats for: ${prod.slug}`);
      }

      // Sync images if missing
      const azureImages = await azure.productImage.findMany({ where: { productId: azureId } });
      if (azureImages.length === 0 && images.length > 0) {
        for (const img of images) {
          const { id: _id, productId: _productId, createdAt: _createdAt, updatedAt: _updatedAt, ...imgData } = img;
          await azure.productImage.create({ data: { ...imgData, productId: azureId } });
        }
        console.log(`  🔄 Added ${images.length} images for: ${prod.slug}`);
      }

      updatedProds++;
    }
  }
  console.log(`  📊 Added: ${addedProds}, Updated: ${updatedProds}`);

  // 3. FAQs
  console.log('\n❓ FAQs');
  const localFaqs = await (local as any).faq.findMany({ include: { translations: true } });
  const azureFaqs = await (azure as any).faq.findMany();
  console.log(`  Local: ${localFaqs.length} | Azure: ${azureFaqs.length}`);

  if (azureFaqs.length === 0 && localFaqs.length > 0) {
    for (const faq of localFaqs) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, translations, ...faqData } = faq;
      await (azure as any).faq.create({
        data: {
          ...faqData,
          translations: {
            create: translations.map(({ id: _id, faqId: _faqId, createdAt: _createdAt, updatedAt: _updatedAt, ...t }) => t),
          },
        },
      });
    }
    console.log(`  ✅ Synced ${localFaqs.length} FAQs`);
  } else {
    console.log('  ✅ FAQs already synced');
  }

  // 4. Pages
  console.log('\n📄 PAGES');
  const localPages = await local.page.findMany({ include: { translations: true } });
  const azurePages = await azure.page.findMany();
  console.log(`  Local: ${localPages.length} | Azure: ${azurePages.length}`);

  if (azurePages.length === 0 && localPages.length > 0) {
    for (const page of localPages) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, translations, ...pageData } = page;
      await azure.page.create({
        data: {
          ...pageData,
          translations: {
            create: translations.map(({ id: _id, pageId: _pageId, createdAt: _createdAt, updatedAt: _updatedAt, ...t }) => t),
          },
        },
      });
    }
    console.log(`  ✅ Synced ${localPages.length} pages`);
  } else {
    console.log('  ✅ Pages already synced');
  }

  // 5. Hero Slides (already done but verify)
  console.log('\n🎠 HERO SLIDES');
  const azureSlides = await azure.heroSlide.count();
  const azureSlideTrans = await azure.heroSlideTranslation.count();
  console.log(`  Azure: ${azureSlides} slides, ${azureSlideTrans} translations ✅`);

  // 6. Shipping Zones
  console.log('\n🚚 SHIPPING ZONES');
  const localZones = await local.shippingZone.findMany();
  const azureZones = await azure.shippingZone.findMany();
  console.log(`  Local: ${localZones.length} | Azure: ${azureZones.length}`);

  if (azureZones.length === 0 && localZones.length > 0) {
    for (const zone of localZones) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...zoneData } = zone;
      await azure.shippingZone.create({ data: zoneData });
    }
    console.log(`  ✅ Synced ${localZones.length} zones`);
  } else {
    console.log('  ✅ Shipping zones already synced');
  }

  // 7. Discount codes
  console.log('\n🎫 DISCOUNTS');
  const localDiscounts = await local.discount.findMany();
  const azureDiscounts = await azure.discount.findMany();
  console.log(`  Local: ${localDiscounts.length} | Azure: ${azureDiscounts.length}`);

  if (azureDiscounts.length < localDiscounts.length) {
    const azureDiscountCodes = new Set(azureDiscounts.map((d: any) => d.name));
    for (const disc of localDiscounts) {
      if (!azureDiscountCodes.has(disc.name)) {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...discData } = disc;
        await azure.discount.create({ data: discData });
        console.log(`  ✅ Added discount: ${disc.name}`);
      }
    }
  } else {
    console.log('  ✅ Discounts already synced');
  }

  // 8. Accounting data
  console.log('\n💰 ACCOUNTING');
  const localAccounts = await local.chartOfAccount.findMany();
  const azureAccounts = await azure.chartOfAccount.findMany();
  console.log(`  Chart of Accounts - Local: ${localAccounts.length} | Azure: ${azureAccounts.length}`);

  if (azureAccounts.length === 0 && localAccounts.length > 0) {
    for (const acc of localAccounts) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...accData } = acc;
      await azure.chartOfAccount.create({ data: accData });
    }
    console.log(`  ✅ Synced ${localAccounts.length} accounts`);
  } else {
    console.log('  ✅ Chart of accounts already synced');
  }

  const localPeriods = await local.accountingPeriod.findMany();
  const azurePeriods = await azure.accountingPeriod.findMany();
  console.log(`  Periods - Local: ${localPeriods.length} | Azure: ${azurePeriods.length}`);

  if (azurePeriods.length === 0 && localPeriods.length > 0) {
    for (const per of localPeriods) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...perData } = per;
      await azure.accountingPeriod.create({ data: perData });
    }
    console.log(`  ✅ Synced ${localPeriods.length} periods`);
  }

  // 9. Site Settings
  console.log('\n⚙️ SITE SETTINGS');
  const localSettings = await local.siteSetting.findMany();
  const azureSettings = await azure.siteSetting.findMany();
  console.log(`  Local: ${localSettings.length} | Azure: ${azureSettings.length}`);

  if (azureSettings.length === 0 && localSettings.length > 0) {
    for (const setting of localSettings) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...settingData } = setting;
      await azure.siteSetting.create({ data: settingData });
    }
    console.log(`  ✅ Synced ${localSettings.length} settings`);
  } else {
    console.log('  ✅ Settings already synced');
  }

  // 10. Permission Groups
  console.log('\n🔐 PERMISSIONS');
  const localPermGroups = await local.permissionGroup.findMany({ include: { permissions: true } });
  const azurePermGroups = await azure.permissionGroup.findMany();
  console.log(`  Local: ${localPermGroups.length} | Azure: ${azurePermGroups.length}`);

  if (azurePermGroups.length === 0 && localPermGroups.length > 0) {
    for (const pg of localPermGroups) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, permissions, ...pgData } = pg;
      await azure.permissionGroup.create({
        data: {
          ...pgData,
          permissions: {
            create: permissions.map(({ id: _id, groupId: _groupId, createdAt: _createdAt, ...p }: any) => p),
          },
        },
      });
    }
    console.log(`  ✅ Synced ${localPermGroups.length} permission groups`);
  } else {
    console.log('  ✅ Permissions already synced');
  }

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('🏁 SYNC COMPLETE');

  const finalProds = await azure.product.count({ where: { isActive: true } });
  const finalFmts = await azure.productFormat.count();
  const finalImgs = await azure.productImage.count();
  const finalCats = await azure.category.count();
  const finalFaqs = await (azure as any).faq.count();
  const finalPages = await azure.page.count();
  const finalSlides = await azure.heroSlide.count();

  console.log(`\n📊 Azure Database Final State:`);
  console.log(`  Products (active): ${finalProds}`);
  console.log(`  Product Formats: ${finalFmts}`);
  console.log(`  Product Images: ${finalImgs}`);
  console.log(`  Categories: ${finalCats}`);
  console.log(`  FAQs: ${finalFaqs}`);
  console.log(`  Pages: ${finalPages}`);
  console.log(`  Hero Slides: ${finalSlides}`);
}

compareAndSync()
  .then(async () => {
    await local.$disconnect();
    await azure.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e.message);
    await local.$disconnect();
    await azure.$disconnect();
    process.exit(1);
  });

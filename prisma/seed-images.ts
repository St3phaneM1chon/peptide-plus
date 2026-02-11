/**
 * Script to update product and format images in the database
 * using the image manifest from public/images/products/image-manifest.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Manifest slug → DB slug mapping (for products with different slugs)
const slugMap: Record<string, string> = {
  'eau-bacteriostatique': 'bacteriostatic-water',
  'epitalon': 'epithalon',
  'kit-seringues-insuline': 'insulin-syringes-u100',
};

interface ManifestFormat {
  sku: string;
  image: string;
}

interface ManifestEntry {
  slug: string;
  main_image: string;
  formats: ManifestFormat[];
}

async function main() {
  console.log('🖼️  Updating product images from manifest...\n');

  // Read the manifest
  const manifestPath = path.join(__dirname, '../public/images/products/image-manifest.json');
  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  let productsUpdated = 0;
  let formatsUpdated = 0;
  let imagesCreated = 0;

  for (const entry of manifest) {
    const dbSlug = slugMap[entry.slug] || entry.slug;

    // Find the product in DB
    const product = await prisma.product.findUnique({
      where: { slug: dbSlug },
      include: { formats: true, images: true },
    });

    if (!product) {
      console.log(`⚠️  Product not found for slug "${dbSlug}" (manifest: "${entry.slug}")`);
      continue;
    }

    // 1. Update product imageUrl
    await prisma.product.update({
      where: { id: product.id },
      data: { imageUrl: entry.main_image },
    });
    productsUpdated++;
    console.log(`✅ ${product.name}: imageUrl → ${entry.main_image}`);

    // 2. Create/update ProductImage records
    // First, delete existing images to avoid duplicates
    if (product.images.length > 0) {
      await prisma.productImage.deleteMany({
        where: { productId: product.id },
      });
    }

    // Create main image as primary
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: entry.main_image,
        alt: product.name,
        isPrimary: true,
        sortOrder: 0,
      },
    });
    imagesCreated++;

    // Create format images in gallery
    for (let i = 0; i < entry.formats.length; i++) {
      const fmt = entry.formats[i];
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: fmt.image,
          alt: `${product.name} - ${fmt.sku}`,
          isPrimary: false,
          sortOrder: i + 1,
        },
      });
      imagesCreated++;
    }

    // 3. Update format imageUrl by matching SKU
    for (const manifestFmt of entry.formats) {
      // Try matching: manifest SKU "BPC157-5MG" → DB SKU "PP-BPC157-5MG"
      const dbSku = `PP-${manifestFmt.sku}`;

      const matchingFormat = product.formats.find(f => {
        if (!f.sku) return false;
        // Direct match
        if (f.sku === manifestFmt.sku) return true;
        // Match with PP- prefix
        if (f.sku === dbSku) return true;
        // Case-insensitive match
        if (f.sku.toUpperCase() === manifestFmt.sku.toUpperCase()) return true;
        if (f.sku.toUpperCase() === dbSku.toUpperCase()) return true;
        return false;
      });

      if (matchingFormat) {
        await prisma.productFormat.update({
          where: { id: matchingFormat.id },
          data: { imageUrl: manifestFmt.image },
        });
        formatsUpdated++;
        console.log(`   📦 Format ${matchingFormat.name} (${matchingFormat.sku}): imageUrl → ${manifestFmt.image}`);
      } else {
        console.log(`   ⚠️  No format match for manifest SKU "${manifestFmt.sku}" (tried "${dbSku}")`);
      }
    }
  }

  // 4. For products without manifest entries, try to set imageUrl from slug-based directory
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });

  for (const product of allProducts) {
    // Skip products already updated (have non-default imageUrl)
    if (product.imageUrl && !product.imageUrl.includes('peptide-default.png')) {
      continue;
    }

    // Check if there's a directory for this product
    const imageDir = path.join(__dirname, '../public/images/products', product.slug);
    if (fs.existsSync(imageDir)) {
      const mainImage = path.join(imageDir, 'main.png');
      if (fs.existsSync(mainImage)) {
        const imageUrl = `/images/products/${product.slug}/main.png`;
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl },
        });
        productsUpdated++;
        console.log(`✅ ${product.name}: imageUrl → ${imageUrl} (from directory)`);
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Products updated: ${productsUpdated}`);
  console.log(`   Formats updated: ${formatsUpdated}`);
  console.log(`   Gallery images created: ${imagesCreated}`);

  await prisma.$disconnect();
}

main().catch(console.error);

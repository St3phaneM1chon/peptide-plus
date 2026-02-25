export const dynamic = 'force-dynamic';

/**
 * Admin Product Duplicate API
 * POST /api/admin/products/[id]/duplicate
 * Creates a copy of an existing product with "(Copy)" appended to the name
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }>; session: unknown }
  ) => {
    try {
      const { id } = await params;

      // Fetch the source product with formats
      const source = await prisma.product.findUnique({
        where: { id },
        include: {
          formats: true,
        },
      });

      if (!source) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // Generate unique slug
      const baseSlug = `${source.slug}-copy`;
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.product.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create the duplicate product
      const duplicate = await prisma.product.create({
        data: {
          name: `${source.name} (Copy)`,
          slug,
          productType: source.productType,
          categoryId: source.categoryId,
          description: source.description,
          shortDescription: source.shortDescription,
          price: source.price,
          compareAtPrice: source.compareAtPrice,
          purity: source.purity,
          aminoSequence: source.aminoSequence,
          molecularWeight: source.molecularWeight,
          casNumber: source.casNumber,
          molecularFormula: source.molecularFormula,
          storageConditions: source.storageConditions,
          imageUrl: source.imageUrl,
          videoUrl: source.videoUrl,
          certificateUrl: source.certificateUrl,
          certificateName: source.certificateName,
          dataSheetUrl: source.dataSheetUrl,
          dataSheetName: source.dataSheetName,
          coaUrl: source.coaUrl,
          msdsUrl: source.msdsUrl,
          hplcUrl: source.hplcUrl,
          sku: source.sku ? `${source.sku}-COPY` : null,
          manufacturer: source.manufacturer,
          origin: source.origin,
          trackInventory: source.trackInventory,
          allowBackorder: source.allowBackorder,
          weight: source.weight,
          dimensions: source.dimensions,
          isActive: false, // Duplicate starts as inactive
          isFeatured: false,
          isNew: false,
          isBestseller: false,
          // Create formats as well
          formats: {
            create: source.formats.map((f) => ({
              name: f.name,
              formatType: f.formatType,
              price: f.price,
              comparePrice: f.comparePrice,
              sku: f.sku ? `${f.sku}-COPY` : null,
              stockQuantity: 0, // Start with 0 stock
              lowStockThreshold: f.lowStockThreshold,
              availability: 'OUT_OF_STOCK',
              dosageMg: f.dosageMg,
              volumeMl: f.volumeMl,
              unitCount: f.unitCount,
              isActive: f.isActive,
              sortOrder: f.sortOrder,
            })),
          },
        },
        include: {
          formats: true,
          category: { select: { id: true, name: true } },
        },
      });

      logger.info('Product duplicated', {
        sourceId: id,
        duplicateId: duplicate.id,
        name: duplicate.name,
      });

      return NextResponse.json({ product: duplicate }, { status: 201 });
    } catch (error) {
      logger.error('Product duplicate error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

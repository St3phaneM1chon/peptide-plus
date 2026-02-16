export const dynamic = 'force-dynamic';
/**
 * API - Product Search
 * Supports: ?q=query&category=slug&minPrice=0&maxPrice=500&inStock=true&purity=99&sort=relevance&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { withTranslations, getTranslatedFields } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';
    const category = searchParams.get('category');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const inStock = searchParams.get('inStock');
    const purity = searchParams.get('purity');
    const sort = searchParams.get('sort') || 'relevance';
    const limit = parseInt(searchParams.get('limit') || '50');
    const locale = searchParams.get('locale') || defaultLocale;

    // Build where clause
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    // Text search across name, description, subtitle
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { subtitle: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { shortDescription: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category) {
      where.category = { slug: category };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        (where.price as Prisma.DecimalFilter).gte = parseFloat(minPrice);
      }
      if (maxPrice) {
        (where.price as Prisma.DecimalFilter).lte = parseFloat(maxPrice);
      }
    }

    // Purity filter
    if (purity) {
      where.purity = { gte: parseFloat(purity) };
    }

    // Build orderBy
    let orderBy: Prisma.ProductOrderByWithRelationInput;
    switch (sort) {
      case 'price-asc':
        orderBy = { price: 'asc' };
        break;
      case 'price-desc':
        orderBy = { price: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'relevance':
      default:
        orderBy = { isFeatured: 'desc' };
        break;
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy,
      take: limit,
    });

    // In-stock filter (post-query since it depends on formats)
    if (inStock === 'true') {
      products = products.filter((p) =>
        p.formats.some((f) => f.stockQuantity > 0)
      );
    }

    // Apply translations
    if (locale !== defaultLocale) {
      products = await withTranslations(products, 'Product', locale);

      // Translate nested category names on products
      const categoryIds = [...new Set(products.map(p => (p as Record<string, unknown> & { category?: { id: string } }).category?.id).filter(Boolean))] as string[];
      const categoryTranslations = new Map<string, Record<string, string>>();
      await Promise.all(
        categoryIds.map(async (catId) => {
          const translated = await getTranslatedFields('Category', catId, locale);
          if (translated) categoryTranslations.set(catId, translated);
        })
      );
      products = products.map(p => {
        const product = p as Record<string, unknown> & { category?: { id: string; name: string; slug: string } };
        if (product.category && categoryTranslations.has(product.category.id)) {
          const catTrans = categoryTranslations.get(product.category.id)!;
          return { ...p, category: { ...product.category, name: catTrans.name || product.category.name } };
        }
        return p;
      });
    }

    // Get categories with product counts for facets
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { products: { where: { isActive: true } } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Translate category facet names
    let translatedCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.products,
    }));
    if (locale !== defaultLocale) {
      translatedCategories = await Promise.all(
        translatedCategories.map(async (c) => {
          const trans = await getTranslatedFields('Category', c.id, locale);
          return { ...c, name: trans?.name || c.name };
        })
      );
    }

    return NextResponse.json(
      {
        products,
        categories: translatedCategories,
        total: products.length,
        query: q,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}

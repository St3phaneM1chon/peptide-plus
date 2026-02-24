export const dynamic = 'force-dynamic';

/**
 * Admin Global Search API
 * GET /api/admin/search?q=term&limit=5
 *
 * Searches across products, orders, users, journal entries, and categories.
 * Returns grouped results by entity type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

interface SearchResult {
  id: string;
  type: 'product' | 'order' | 'user' | 'journal_entry' | 'category';
  title: string;
  subtitle?: string;
  url: string;
}

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20);

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [], total: 0 });
    }

    const results: SearchResult[] = [];

    // Search in parallel across entities
    const [products, orders, users, entries, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, sku: true, price: true },
        take: limit,
      }),

      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: { id: true, orderNumber: true, status: true, total: true, user: { select: { name: true, email: true } } },
        take: limit,
      }),

      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        take: limit,
      }),

      prisma.journalEntry.findMany({
        where: {
          OR: [
            { entryNumber: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, entryNumber: true, description: true, type: true },
        take: limit,
      }),

      prisma.category.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true },
        take: limit,
      }),
    ]);

    // Map products
    for (const p of products) {
      results.push({
        id: p.id,
        type: 'product',
        title: p.name,
        subtitle: p.sku || undefined,
        url: `/admin/produits?id=${p.id}`,
      });
    }

    // Map orders
    for (const o of orders) {
      results.push({
        id: o.id,
        type: 'order',
        title: o.orderNumber || o.id,
        subtitle: `${o.status} - ${o.user?.name || o.user?.email || ''}`,
        url: `/admin/commandes?id=${o.id}`,
      });
    }

    // Map users
    for (const u of users) {
      results.push({
        id: u.id,
        type: 'user',
        title: u.name || u.email || u.id,
        subtitle: `${u.role} - ${u.email}`,
        url: `/admin/customers/${u.id}`,
      });
    }

    // Map journal entries
    for (const e of entries) {
      results.push({
        id: e.id,
        type: 'journal_entry',
        title: e.entryNumber || e.id,
        subtitle: e.description || e.type || undefined,
        url: `/admin/comptabilite?entry=${e.id}`,
      });
    }

    // Map categories
    for (const c of categories) {
      results.push({
        id: c.id,
        type: 'category',
        title: c.name,
        subtitle: c.slug || undefined,
        url: `/admin/produits?category=${c.id}`,
      });
    }

    return NextResponse.json({
      results,
      total: results.length,
      query: q,
    });
  } catch (error) {
    logger.error('Admin search error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

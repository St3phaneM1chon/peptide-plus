export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const createWishlistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

const renameWishlistSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
});

/**
 * GET /api/account/wishlists
 * Returns all wishlists for the authenticated user with item counts
 */
export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  try {

    const wishlists = await prisma.wishlistCollection.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    // Ensure user has at least one default wishlist
    if (wishlists.length === 0) {
      const defaultWishlist = await prisma.wishlistCollection.create({
        data: {
          userId: session.user.id,
          name: 'My Wishlist',
          isDefault: true,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });
      return NextResponse.json({ wishlists: [defaultWishlist] });
    }

    return NextResponse.json({ wishlists });
  } catch (error) {
    logger.error('Error fetching wishlists', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch wishlists' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });

/**
 * POST /api/account/wishlists
 * Create a new wishlist
 * Body: { name: string }
 */
export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/account/wishlists');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    const body = await request.json();
    const parsed = createWishlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name } = parsed.data;

    const wishlist = await prisma.wishlistCollection.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        isDefault: false,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(
      { wishlist, message: 'Wishlist created' },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating wishlist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to create wishlist' },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/account/wishlists
 * Rename a wishlist
 * Body: { id: string, name: string }
 */
export const PATCH = withUserGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/account/wishlists');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    const body = await request.json();
    const parsed = renameWishlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, name } = parsed.data;

    // Verify ownership
    const wishlist = await prisma.wishlistCollection.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.wishlistCollection.update({
      where: { id },
      data: { name: name.trim() },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({
      wishlist: updated,
      message: 'Wishlist renamed',
    });
  } catch (error) {
    logger.error('Error renaming wishlist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to rename wishlist' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/account/wishlists?id=...
 * Delete a wishlist (cannot delete default, items moved to default)
 */
export const DELETE = withUserGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/account/wishlists');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Wishlist ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership and check if default
    const wishlist = await prisma.wishlistCollection.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        items: true,
      },
    });

    if (!wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    if (wishlist.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default wishlist' },
        { status: 400 }
      );
    }

    // Find or create default wishlist
    let defaultWishlist = await prisma.wishlistCollection.findFirst({
      where: {
        userId: session.user.id,
        isDefault: true,
      },
    });

    if (!defaultWishlist) {
      defaultWishlist = await prisma.wishlistCollection.create({
        data: {
          userId: session.user.id,
          name: 'My Wishlist',
          isDefault: true,
        },
      });
    }

    // Move items to default wishlist
    // N+1 FIX: Use a transaction with batch operations instead of individual upserts in a loop
    if (wishlist.items.length > 0) {
      // First, find which products already exist in the default collection
      const productIds = wishlist.items.map((item) => item.productId);
      const existingInDefault = await prisma.wishlistItem.findMany({
        where: {
          collectionId: defaultWishlist.id,
          productId: { in: productIds },
        },
        select: { productId: true },
      });
      const existingProductIds = new Set(existingInDefault.map((e) => e.productId));

      // Only create items that don't already exist in the default collection
      const itemsToCreate = wishlist.items
        .filter((item) => !existingProductIds.has(item.productId))
        .map((item) => ({
          collectionId: defaultWishlist.id,
          productId: item.productId,
        }));

      if (itemsToCreate.length > 0) {
        await prisma.wishlistItem.createMany({
          data: itemsToCreate,
          skipDuplicates: true,
        });
      }
    }

    // Delete the wishlist (cascade will delete items)
    await prisma.wishlistCollection.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Wishlist deleted',
      movedItems: wishlist.items.length,
    });
  } catch (error) {
    logger.error('Error deleting wishlist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete wishlist' },
      { status: 500 }
    );
  }
});

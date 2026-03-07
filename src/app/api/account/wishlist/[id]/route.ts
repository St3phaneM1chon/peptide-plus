export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/account/wishlist/[id]
 * Removes a wishlist item by its ID, verifying ownership
 */
export const DELETE = withUserGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;

    // Find the wishlist item and verify ownership
    const wishlistItem = await db.wishlist.findUnique({
      where: { id },
    });

    if (!wishlistItem) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      );
    }

    if (wishlistItem.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the wishlist item
    await db.wishlist.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Removed from wishlist' });
  } catch (error) {
    logger.error('Error removing from wishlist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to remove from wishlist' },
      { status: 500 }
    );
  }
});

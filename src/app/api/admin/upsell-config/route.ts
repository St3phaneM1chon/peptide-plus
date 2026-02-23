export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { db } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET — List all upsell configs
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const configs = await db.upsellConfig.findMany({
      include: {
        product: { select: { id: true, name: true, slug: true, imageUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      configs: configs.map((c) => ({
        id: c.id,
        productId: c.productId,
        productName: c.product?.name || null,
        productSlug: c.product?.slug || null,
        productImage: c.product?.imageUrl || null,
        isEnabled: c.isEnabled,
        showQuantityDiscount: c.showQuantityDiscount,
        showSubscription: c.showSubscription,
        displayRule: c.displayRule,
        quantityTitle: c.quantityTitle,
        quantitySubtitle: c.quantitySubtitle,
        subscriptionTitle: c.subscriptionTitle,
        subscriptionSubtitle: c.subscriptionSubtitle,
        suggestedQuantity: c.suggestedQuantity,
        suggestedFrequency: c.suggestedFrequency,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Error fetching upsell configs', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
});

// POST — Create or update upsell config (upsert on productId)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const {
      productId,
      isEnabled,
      showQuantityDiscount,
      showSubscription,
      displayRule,
      quantityTitle,
      quantitySubtitle,
      subscriptionTitle,
      subscriptionSubtitle,
      suggestedQuantity,
      suggestedFrequency,
    } = body;

    const data = {
      isEnabled: isEnabled ?? true,
      showQuantityDiscount: showQuantityDiscount ?? true,
      showSubscription: showSubscription ?? true,
      displayRule: displayRule || 'ALWAYS',
      quantityTitle: quantityTitle || null,
      quantitySubtitle: quantitySubtitle || null,
      subscriptionTitle: subscriptionTitle || null,
      subscriptionSubtitle: subscriptionSubtitle || null,
      suggestedQuantity: suggestedQuantity ? Number(suggestedQuantity) : null,
      suggestedFrequency: suggestedFrequency || null,
    };

    // productId can be null for global config, or a string for product-specific
    const pId = productId || null;

    let config;
    if (pId) {
      // Product-specific config: upsert on productId
      config = await db.upsellConfig.upsert({
        where: { productId: pId },
        create: { productId: pId, ...data },
        update: data,
      });
    } else {
      // Global config: find existing or create
      const existing = await db.upsellConfig.findFirst({
        where: { productId: null },
      });
      if (existing) {
        config = await db.upsellConfig.update({
          where: { id: existing.id },
          data,
        });
      } else {
        config = await db.upsellConfig.create({
          data: { productId: null, ...data },
        });
      }
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPSERT_UPSELL_CONFIG',
      targetType: 'UpsellConfig',
      targetId: config.id,
      newValue: { productId: pId, ...data },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ config });
  } catch (error) {
    logger.error('Error saving upsell config', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
});

// FIX: FLAW-008 - PUT handler for updating existing upsell config by ID
// Prevents duplicates by using explicit update instead of always creating new records.
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await request.json();
    const {
      isEnabled,
      showQuantityDiscount,
      showSubscription,
      displayRule,
      quantityTitle,
      quantitySubtitle,
      subscriptionTitle,
      subscriptionSubtitle,
      suggestedQuantity,
      suggestedFrequency,
    } = body;

    const data = {
      isEnabled: isEnabled ?? true,
      showQuantityDiscount: showQuantityDiscount ?? true,
      showSubscription: showSubscription ?? true,
      displayRule: displayRule || 'ALWAYS',
      quantityTitle: quantityTitle || null,
      quantitySubtitle: quantitySubtitle || null,
      subscriptionTitle: subscriptionTitle || null,
      subscriptionSubtitle: subscriptionSubtitle || null,
      suggestedQuantity: suggestedQuantity ? Number(suggestedQuantity) : null,
      suggestedFrequency: suggestedFrequency || null,
    };

    const config = await db.upsellConfig.update({
      where: { id },
      data,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_UPSELL_CONFIG',
      targetType: 'UpsellConfig',
      targetId: config.id,
      newValue: data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ config });
  } catch (error) {
    logger.error('Error updating upsell config', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
});

// DELETE — Delete an upsell config by ID
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.upsellConfig.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_UPSELL_CONFIG',
      targetType: 'UpsellConfig',
      targetId: id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting upsell config', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
});

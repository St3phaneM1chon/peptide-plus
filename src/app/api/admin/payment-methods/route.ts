export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createPaymentMethodSchema = z.object({
  countryCode: z.string().min(2).max(5),
  methodType: z.string().min(1).max(50),
  provider: z.string().min(1).max(100),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
  minAmount: z.number().positive().nullable().optional(),
  maxAmount: z.number().positive().nullable().optional(),
});

/**
 * GET /api/admin/payment-methods
 * List all payment method configurations
 */
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const configs = await prisma.paymentMethodConfig.findMany({
      orderBy: [
        { countryCode: 'asc' },
        { sortOrder: 'asc' },
      ],
    });

    return NextResponse.json({
      configs: configs.map((c) => ({
        id: c.id,
        countryCode: c.countryCode,
        methodType: c.methodType,
        provider: c.provider,
        isActive: c.isActive,
        sortOrder: c.sortOrder,
        minAmount: c.minAmount ? Number(c.minAmount) : null,
        maxAmount: c.maxAmount ? Number(c.maxAmount) : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Get payment method configs error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching payment method configurations' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/payment-methods
 * Create or update a payment method configuration
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = createPaymentMethodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const {
      countryCode,
      methodType,
      provider,
      isActive,
      sortOrder,
      minAmount,
      maxAmount,
    } = parsed.data;

    // Check if configuration already exists
    const existing = await prisma.paymentMethodConfig.findUnique({
      where: {
        countryCode_methodType: {
          countryCode,
          methodType,
        },
      },
    });

    let config;

    if (existing) {
      // Update existing configuration
      config = await prisma.paymentMethodConfig.update({
        where: { id: existing.id },
        data: {
          provider,
          isActive,
          sortOrder,
          minAmount: minAmount ?? null,
          maxAmount: maxAmount ?? null,
        },
      });
    } else {
      // Create new configuration
      config = await prisma.paymentMethodConfig.create({
        data: {
          countryCode,
          methodType,
          provider,
          isActive,
          sortOrder,
          minAmount: minAmount ?? null,
          maxAmount: maxAmount ?? null,
        },
      });
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: existing ? 'UPDATE_PAYMENT_METHOD' : 'CREATE_PAYMENT_METHOD',
      targetType: 'PaymentMethodConfig',
      targetId: config.id,
      ...(existing ? { previousValue: { provider: existing.provider, isActive: existing.isActive } } : {}),
      newValue: { countryCode, methodType, provider, isActive },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        config: {
          id: config.id,
          countryCode: config.countryCode,
          methodType: config.methodType,
          provider: config.provider,
          isActive: config.isActive,
          sortOrder: config.sortOrder,
          minAmount: config.minAmount ? Number(config.minAmount) : null,
          maxAmount: config.maxAmount ? Number(config.maxAmount) : null,
          createdAt: config.createdAt.toISOString(),
          updatedAt: config.updatedAt.toISOString(),
        },
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    logger.error('Create/update payment method config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error saving payment method configuration' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/payment-methods
 * Delete a payment method configuration
 */
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    await prisma.paymentMethodConfig.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_PAYMENT_METHOD',
      targetType: 'PaymentMethodConfig',
      targetId: id,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete payment method config error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error deleting payment method configuration' },
      { status: 500 }
    );
  }
});

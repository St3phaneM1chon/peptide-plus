export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/payment-methods
 * List all payment method configurations
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    console.error('Get payment method configs error:', error);
    return NextResponse.json(
      { error: 'Error fetching payment method configurations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/payment-methods
 * Create or update a payment method configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      countryCode,
      methodType,
      provider,
      isActive = true,
      sortOrder = 0,
      minAmount,
      maxAmount,
    } = body;

    // Validate required fields
    if (!countryCode || !methodType || !provider) {
      return NextResponse.json(
        { error: 'countryCode, methodType, and provider are required' },
        { status: 400 }
      );
    }

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
          minAmount: minAmount ? minAmount : null,
          maxAmount: maxAmount ? maxAmount : null,
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
          minAmount: minAmount ? minAmount : null,
          maxAmount: maxAmount ? maxAmount : null,
        },
      });
    }

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
    console.error('Create/update payment method config error:', error);
    return NextResponse.json(
      { error: 'Error saving payment method configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/payment-methods
 * Delete a payment method configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete payment method config error:', error);
    return NextResponse.json(
      { error: 'Error deleting payment method configuration' },
      { status: 500 }
    );
  }
}

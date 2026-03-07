export const dynamic = 'force-dynamic';

/**
 * Admin Ambassador Detail API
 * GET    - Get ambassador details with commissions and payouts
 * PUT    - Update ambassador (tier, commissionRate, status, etc.)
 * DELETE - Soft delete (set status to INACTIVE)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateAmbassadorSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const GET = withAdminGuard(async (_request, context) => {
  try {
    const params = await context.params;
    const id = params?.id as string;

    const ambassador = await prisma.ambassador.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { commissions: true, payouts: true } },
      },
    });

    if (!ambassador) {
      return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 });
    }

    return NextResponse.json(ambassador);
  } catch (error) {
    logger.error('Admin ambassador GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request, context) => {
  try {
    const params = await context.params;
    const id = params?.id as string;

    const body = await request.json();
    const parsed = updateAmbassadorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check ambassador exists
    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 });
    }

    // If email is being changed, check uniqueness
    if (parsed.data.email && parsed.data.email !== existing.email) {
      const emailExists = await prisma.ambassador.findUnique({ where: { email: parsed.data.email } });
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already associated with another ambassador' },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.ambassador.update({
      where: { id },
      data: parsed.data,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Admin ambassador PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAdminGuard(async (_request, context) => {
  try {
    const params = await context.params;
    const id = params?.id as string;

    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassador not found' }, { status: 404 });
    }

    // Soft delete — set status to INACTIVE
    await prisma.ambassador.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    return NextResponse.json({ success: true, message: 'Ambassador deactivated' });
  } catch (error) {
    logger.error('Admin ambassador DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

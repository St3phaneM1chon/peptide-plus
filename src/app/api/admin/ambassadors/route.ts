export const dynamic = 'force-dynamic';

/**
 * Admin Ambassadors API
 * GET - List ambassadors with pagination and search
 * POST - Create a new ambassador
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createAmbassadorSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  referralCode: z.string().min(3, 'Referral code must be at least 3 characters'),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).default('BRONZE'),
  commissionRate: z.number().min(0).max(100).default(10),
});

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { referralCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      prisma.ambassador.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
          referralCode: true,
          tier: true,
          commissionRate: true,
          status: true,
          totalReferrals: true,
          totalEarnings: true,
          joinedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { commissions: true } },
        },
      }),
      prisma.ambassador.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin ambassadors GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createAmbassadorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { userId, name, email, referralCode, phone, tier, commissionRate } = parsed.data;

    // Check unique referral code
    const existing = await prisma.ambassador.findUnique({ where: { referralCode } });
    if (existing) {
      return NextResponse.json(
        { error: 'Referral code already in use' },
        { status: 409 }
      );
    }

    // Check unique email if provided
    if (email) {
      const emailExists = await prisma.ambassador.findUnique({ where: { email } });
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already associated with an ambassador' },
          { status: 409 }
        );
      }
    }

    const ambassador = await prisma.ambassador.create({
      data: {
        userId,
        name,
        email,
        phone,
        referralCode,
        tier,
        commissionRate,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(ambassador, { status: 201 });
  } catch (error) {
    logger.error('Admin ambassadors POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

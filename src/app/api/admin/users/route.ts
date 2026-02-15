export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const tier = searchParams.get('tier');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (tier) where.loyaltyTier = tier;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        phone: true,
        locale: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        loyaltyTier: true,
        referralCode: true,
        createdAt: true,
        _count: {
          select: { purchases: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totalSpent from orders
    const usersWithSpent = await Promise.all(
      users.map(async (user) => {
        const orderTotal = await prisma.order.aggregate({
          where: { userId: user.id, paymentStatus: 'PAID' },
          _sum: { total: true },
        });
        return {
          ...user,
          totalSpent: Number(orderTotal._sum.total || 0),
        };
      })
    );

    return NextResponse.json({ users: usersWithSpent });
  } catch (error) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ users: [] });
  }
}

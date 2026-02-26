/**
 * Public API v1 - Customers (list)
 * GET /api/v1/customers - List customers (users with role CUSTOMER)
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const search = url.searchParams.get('search');
  const loyaltyTier = url.searchParams.get('loyaltyTier');
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    role: 'CUSTOMER',
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (loyaltyTier) where.loyaltyTier = loyaltyTier;

  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'email', 'loyaltyPoints'];
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderByField]: sortOrder },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        locale: true,
        timezone: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        loyaltyTier: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return jsonSuccess(customers, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}, 'customers:read');

/**
 * Public API v1 - Customers (single)
 * GET /api/v1/customers/:id - Get a single customer by ID or email
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (_request: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) {
    return jsonError('Customer ID is required', 400);
  }

  // Try by ID first, then by email
  const customer = await prisma.user.findFirst({
    where: {
      OR: [{ id }, { email: id }],
      role: 'CUSTOMER',
    },
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
      stripeCustomerId: true,
      createdAt: true,
      updatedAt: true,
      addresses: {
        select: {
          id: true,
          label: true,
          recipientName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          phone: true,
          isDefault: true,
        },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          orders: true,
          reviews: true,
          wishlistCollections: true,
        },
      },
    },
  });

  if (!customer) {
    return jsonError('Customer not found', 404);
  }

  return jsonSuccess(customer);
}, 'customers:read');

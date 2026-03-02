export const dynamic = 'force-dynamic';

/**
 * Phone Numbers API
 * GET  - List all phone numbers (DIDs)
 * POST - Add a phone number
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

const phoneNumberSchema = z.object({
  connectionId: z.string().cuid(),
  number: z.string().regex(/^\+\d{10,15}$/, 'Must be E.164 format (e.g., +15145551234)'),
  displayName: z.string().optional(),
  country: z.string().length(2),
  type: z.enum(['LOCAL', 'TOLL_FREE', 'MOBILE']).default('LOCAL'),
  routeToIvr: z.string().optional(),
  routeToQueue: z.string().optional(),
  routeToExt: z.string().optional(),
  monthlyCost: z.number().positive().optional(),
});

export const GET = withAdminGuard(async () => {
  const phoneNumbers = await prisma.phoneNumber.findMany({
    include: {
      connection: { select: { provider: true, isEnabled: true } },
      _count: { select: { callLogs: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ phoneNumbers });
}, { skipCsrf: true });

export const POST = withAdminGuard(async (request) => {
  const body = await request.json();
  const parsed = phoneNumberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check if number already exists
  const existing = await prisma.phoneNumber.findUnique({
    where: { number: parsed.data.number },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Number ${parsed.data.number} already registered` },
      { status: 409 }
    );
  }

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      connectionId: parsed.data.connectionId,
      number: parsed.data.number,
      displayName: parsed.data.displayName || null,
      country: parsed.data.country,
      type: parsed.data.type,
      routeToIvr: parsed.data.routeToIvr || null,
      routeToQueue: parsed.data.routeToQueue || null,
      routeToExt: parsed.data.routeToExt || null,
      monthlyCost: parsed.data.monthlyCost || null,
    },
  });

  return NextResponse.json({ phoneNumber }, { status: 201 });
});

export const DELETE = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await prisma.phoneNumber.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
});

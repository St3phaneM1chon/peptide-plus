export const dynamic = 'force-dynamic';

// TODO: F-084 - DELETE requires OWNER but PATCH allows EMPLOYEE (can soft-delete via INACTIVE); document or align permissions

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING', 'INACTIVE'] as const;
const VALID_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;

const updateAmbassadorSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  tier: z.enum(VALID_TIERS).optional(),
  commissionRate: z.number().min(0).max(100).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const ambassador = await prisma.ambassador.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!ambassador) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ ambassador });
  } catch (error) {
    logger.error('Get ambassador error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/ambassadors');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = updateAmbassadorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check ambassador exists
    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    // Build update data from validated fields
    const updateData: Record<string, unknown> = {};
    const { status, tier, commissionRate } = parsed.data;

    if (status !== undefined) updateData.status = status;
    if (tier !== undefined) updateData.tier = tier;
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;

    const ambassador = await prisma.ambassador.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_AMBASSADOR',
        entityType: 'Ambassador',
        entityId: id,
        details: JSON.stringify({ changes: updateData }),
      },
    }).catch(() => {});

    return NextResponse.json({ ambassador });
  } catch (error) {
    logger.error('Update ambassador error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/ambassadors');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user || !['OWNER'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Ambassadeur non trouvé' }, { status: 404 });
    }

    // Soft delete: set status to INACTIVE
    await prisma.ambassador.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_AMBASSADOR',
        entityType: 'Ambassador',
        entityId: id,
        details: JSON.stringify({ name: existing.name }),
      },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete ambassador error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

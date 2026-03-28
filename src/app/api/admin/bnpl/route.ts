export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const bnplProviders = ['afterpay', 'klarna', 'sezzle', 'paybright'] as const;

const createBnplSchema = z.object({
  provider: z.enum(bnplProviders),
  isActive: z.boolean().optional().default(true),
  config: z.record(z.unknown()).optional().default({}),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
});

/**
 * GET /api/admin/bnpl
 * List all BNPL providers for the current tenant
 */
export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const providers = await prisma.bnplProvider.findMany({
      orderBy: { provider: 'asc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      providers: providers.map((p) => ({
        ...p,
        minAmount: p.minAmount ? Number(p.minAmount) : null,
        maxAmount: p.maxAmount ? Number(p.maxAmount) : null,
      })),
    });
  } catch (error) {
    logger.error('[BNPL] Failed to list providers', { error: error instanceof Error ? error.message : String(error), userId: session.user?.id });
    return NextResponse.json({ success: false, error: { message: 'Failed to load BNPL providers' } }, { status: 500 });
  }
});

/**
 * POST /api/admin/bnpl
 * Create or update a BNPL provider configuration
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const data = createBnplSchema.parse(body);

    // Get tenant ID from session or default
    const tenantId = (session as unknown as { tenantId?: string }).tenantId || 'default';

    const provider = await prisma.bnplProvider.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: data.provider,
        },
      },
      update: {
        isActive: data.isActive,
        config: data.config ? JSON.parse(JSON.stringify(data.config)) : undefined,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
      },
      create: {
        tenantId,
        provider: data.provider,
        isActive: data.isActive,
        config: data.config ? JSON.parse(JSON.stringify(data.config)) : undefined,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount,
      },
    });

    await logAdminAction({
      adminUserId: session.user?.id || '',
      action: 'BNPL_PROVIDER_UPSERT',
      targetType: 'BnplProvider',
      targetId: provider.id,
      newValue: { provider: data.provider, isActive: data.isActive },
      ipAddress: getClientIpFromRequest(request),
    });

    return NextResponse.json({
      success: true,
      provider: {
        ...provider,
        minAmount: provider.minAmount ? Number(provider.minAmount) : null,
        maxAmount: provider.maxAmount ? Number(provider.maxAmount) : null,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: { message: 'Validation error', details: error.errors } }, { status: 400 });
    }
    logger.error('[BNPL] Failed to upsert provider', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: { message: 'Failed to save BNPL provider' } }, { status: 500 });
  }
});

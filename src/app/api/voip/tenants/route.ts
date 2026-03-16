export const dynamic = 'force-dynamic';

/**
 * Tenant Management API
 * GET  — List tenants, get config/stats, onboarding status
 * POST — Create tenant, onboard, provision brands, assign DID
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  resolveTenant,
  getTenantVoipConfig,
  getTenantCallStats,
} from '@/lib/voip/tenant-context';
import {
  onboardTenant,
  provisionAttitudesBrands,
  getOnboardingStatus,
} from '@/lib/voip/tenant-onboarding';

const tenantPostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('onboard'),
    name: z.string().min(1, 'name is required'),
    slug: z.string().min(1, 'slug is required'),
    contactEmail: z.string().email('valid contactEmail is required'),
    phone: z.string().optional(),
    assignDid: z.string().optional(),
    brandKey: z.string().optional(),
  }),
  z.object({
    action: z.literal('provision-brands'),
    contactEmail: z.string().email('contactEmail is required'),
  }),
  z.object({
    action: z.literal('assign-did'),
    companyId: z.string().min(1, 'companyId is required'),
    phoneNumber: z.string().min(1, 'phoneNumber is required'),
  }),
]);

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = request.nextUrl;
    const view = searchParams.get('view');
    const companyId = searchParams.get('companyId');

    // Resolve caller's tenant
    const tenant = await resolveTenant(session.user.id, companyId);

    switch (view) {
      case 'config': {
        if (!tenant) {
          return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
        }
        const config = await getTenantVoipConfig(tenant.companyId);
        return NextResponse.json({ data: config });
      }

      case 'stats': {
        if (!tenant) {
          return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
        }
        const since = searchParams.get('since');
        const stats = await getTenantCallStats(tenant.companyId, {
          since: since ? new Date(since) : undefined,
        });
        return NextResponse.json({ data: stats });
      }

      case 'onboarding': {
        if (!tenant) {
          return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
        }
        const status = await getOnboardingStatus(tenant.companyId);
        return NextResponse.json({ data: status });
      }

      case 'all': {
        // Admin: list all companies with VoIP config
        const companies = await prisma.company.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            contactEmail: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                companyCalls: true,
                dialerCampaigns: true,
                callQueues: true,
                ivrMenus: true,
                coachingSessions: true,
              },
            },
          },
          orderBy: { name: 'asc' },
          take: 100,
        });
        return NextResponse.json({ data: companies });
      }

      default: {
        // Default: return caller's tenant info
        if (!tenant) {
          return NextResponse.json({ data: null, message: 'No tenant associated' });
        }
        const config = await getTenantVoipConfig(tenant.companyId);
        return NextResponse.json({
          data: {
            ...tenant,
            voipConfig: config,
          },
        });
      }
    }
  } catch (error) {
    logger.error('[VoIP/Tenants] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const raw = await request.json();
    const parsed = tenantPostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { action } = parsed.data;

    switch (action) {
      case 'onboard': {
        const { name, slug, contactEmail, phone, assignDid, brandKey } = parsed.data;
        const result = await onboardTenant({
          ownerId: session.user.id,
          name,
          slug,
          contactEmail,
          phone,
          assignDid,
          brandKey,
        });
        return NextResponse.json({ data: result }, { status: 201 });
      }

      case 'provision-brands': {
        const { contactEmail } = parsed.data;
        const results = await provisionAttitudesBrands(session.user.id, contactEmail);
        return NextResponse.json({ data: results }, { status: 201 });
      }

      case 'assign-did': {
        const { companyId: targetCompanyId, phoneNumber } = parsed.data;
        // Verify caller has access
        const tenant = await resolveTenant(session.user.id, targetCompanyId);
        if (!tenant?.isAdmin) {
          return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const updated = await prisma.phoneNumber.updateMany({
          where: { number: phoneNumber },
          data: { companyId: targetCompanyId },
        });

        if (updated.count === 0) {
          return NextResponse.json({ error: 'Phone number not found' }, { status: 404 });
        }

        return NextResponse.json({ status: 'assigned', phoneNumber });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const dynamic = 'force-dynamic';

/**
 * Tenant Management API
 * GET  — List tenants, get config/stats, onboarding status
 * POST — Create tenant, onboard, provision brands, assign DID
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
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

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'onboard': {
        const { name, slug, contactEmail, phone, assignDid, brandKey } = body;
        if (!name || !slug || !contactEmail) {
          return NextResponse.json(
            { error: 'name, slug, contactEmail required' },
            { status: 400 }
          );
        }
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
        const { contactEmail } = body;
        if (!contactEmail) {
          return NextResponse.json({ error: 'contactEmail required' }, { status: 400 });
        }
        const results = await provisionAttitudesBrands(session.user.id, contactEmail);
        return NextResponse.json({ data: results }, { status: 201 });
      }

      case 'assign-did': {
        const { companyId: targetCompanyId, phoneNumber } = body;
        if (!targetCompanyId || !phoneNumber) {
          return NextResponse.json(
            { error: 'companyId and phoneNumber required' },
            { status: 400 }
          );
        }
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
}

/**
 * API: GET /api/tenant
 * Returns the tenant branding config for the current domain.
 * Used by the sign-in page and other pages that need tenant branding.
 * No authentication required — branding is public information.
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.headers.get('x-tenant-slug') || 'biocycle';

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        font: true,
        plan: true,
        locale: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: {
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        font: tenant.font,
      },
      plan: tenant.plan,
      locale: tenant.locale,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

/**
 * Bundle detail API
 * GET /api/lms/bundles/[slug] — Get bundle with courses and pricing
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBundleBySlug, resolvePricing } from '@/lib/lms/lms-service';
import { prisma } from '@/lib/db';

export async function GET(
_request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // FIX P0: Never trust client-supplied tenant or corporate IDs
  let tenantId: string | null = null;
  try {
    const { getCurrentTenantIdFromContext } = await import('@/lib/db');
    tenantId = getCurrentTenantIdFromContext();
  } catch {
    const tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' }, select: { id: true } });
    tenantId = tenant?.id ?? null;
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const bundle = await getBundleBySlug(tenantId, slug);
  if (!bundle) {
    return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
  }

  // FIX P0: Corporate pricing only for authenticated users with verified corporate account
  // Public catalog shows individual pricing only
  const pricing = await resolvePricing(
    { price: bundle.price, corporatePrice: bundle.corporatePrice, currency: bundle.currency },
    null // Corporate pricing resolved at checkout, not in public catalog
  );

  return NextResponse.json({
    data: {
      ...bundle,
      pricing,
    },
  });
}

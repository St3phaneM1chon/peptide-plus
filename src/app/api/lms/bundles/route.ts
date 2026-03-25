export const dynamic = 'force-dynamic';

/**
 * Public bundle catalog API
 * GET /api/lms/bundles — List available course bundles
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBundles } from '@/lib/lms/lms-service';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest) {
  // FIX P0: Never trust client-supplied tenant ID. Use server-side tenant resolution.
  let tenantId: string | null = null;
  try {
    const { getCurrentTenantIdFromContext } = await import('@/lib/db');
    tenantId = getCurrentTenantIdFromContext();
  } catch {
    // Fallback: use first active tenant (public catalog)
    const tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' }, select: { id: true } });
    tenantId = tenant?.id ?? null;
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const bundles = await getBundles(tenantId);
  return NextResponse.json({ data: bundles });
}

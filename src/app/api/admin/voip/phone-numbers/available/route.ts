export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/voip/phone-numbers/available
 * Returns active phone numbers with their assignment status
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    // Find the company to filter owned phone numbers
    // Single-tenant: find by owner, or fall back to first active company
    const userCompany = await prisma.company.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    }) ?? await prisma.company.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    const phoneNumbers = await prisma.phoneNumber.findMany({
      where: {
        isActive: true,
        // Only show phone numbers owned by the admin's company
        ...(userCompany ? { companyId: userCompany.id } : { companyId: { not: null } }),
      },
      select: {
        id: true,
        number: true,
        displayName: true,
        country: true,
        routeToExt: true,
      },
      orderBy: { number: 'asc' },
    });

    // Check which extensions are assigned to get assignment status
    const extensions = phoneNumbers
      .map(p => p.routeToExt)
      .filter((ext): ext is string => !!ext);

    const assignedExtensions = extensions.length > 0
      ? await prisma.sipExtension.findMany({
          where: { extension: { in: extensions } },
          select: { extension: true, userId: true },
        })
      : [];

    const assignedExtSet = new Set(assignedExtensions.map(e => e.extension));

    return NextResponse.json({
      phoneNumbers: phoneNumbers.map(p => ({
        id: p.id,
        number: p.number,
        displayName: p.displayName,
        country: p.country,
        isAssigned: !!(p.routeToExt && assignedExtSet.has(p.routeToExt)),
      })),
    });
  } catch (error) {
    logger.error('Available phone numbers GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

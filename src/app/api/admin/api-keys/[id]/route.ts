/**
 * Admin API - API Key Management (single key)
 * DELETE /api/admin/api-keys/:id - Revoke (soft-delete) an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const DELETE = withAdminGuard(async (_request: NextRequest, { params }) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ success: false, error: 'API key ID is required' }, { status: 400 });
  }

  const existing = await prisma.apiKey.findUnique({
    where: { id },
    select: { id: true, isActive: true, deletedAt: true },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
  }

  if (existing.deletedAt) {
    return NextResponse.json({ success: false, error: 'API key already revoked' }, { status: 400 });
  }

  // Soft-delete: mark as inactive and set deletedAt
  await prisma.apiKey.update({
    where: { id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message: 'API key revoked successfully' });
});

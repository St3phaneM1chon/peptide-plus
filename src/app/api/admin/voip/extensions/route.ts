export const dynamic = 'force-dynamic';

/**
 * SIP Extensions API
 * GET  - List all SIP extensions
 * POST - Create a new SIP extension for a user
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { encryptToken, decryptToken } from '@/lib/platform/crypto';

const extensionSchema = z.object({
  userId: z.string().cuid(),
  extension: z.string().min(3).max(6),
  sipUsername: z.string().min(1),
  sipPassword: z.string().min(8),
  sipDomain: z.string().min(1),
  fusionExtId: z.string().optional(),
  fusionDomainId: z.string().optional(),
});

export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const where = userId ? { userId } : {};

  const extensions = await prisma.sipExtension.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { callsAsAgent: true, voicemails: true } },
    },
    orderBy: { extension: 'asc' },
  });

  // Mask credentials in response
  const masked = extensions.map((ext) => ({
    id: ext.id,
    userId: ext.userId,
    userName: ext.user?.name || ext.user?.email,
    extension: ext.extension,
    sipDomain: ext.sipDomain,
    isRegistered: ext.isRegistered,
    lastSeenAt: ext.lastSeenAt,
    status: ext.status,
    fusionExtId: ext.fusionExtId,
    callCount: ext._count.callsAsAgent,
    voicemailCount: ext._count.voicemails,
    createdAt: ext.createdAt,
  }));

  return NextResponse.json({ extensions: masked });
}, { skipCsrf: true });

export const POST = withAdminGuard(async (request) => {
  const body = await request.json();
  const parsed = extensionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check if extension already exists
  const existing = await prisma.sipExtension.findUnique({
    where: { extension: parsed.data.extension },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Extension ${parsed.data.extension} already exists` },
      { status: 409 }
    );
  }

  const ext = await prisma.sipExtension.create({
    data: {
      userId: parsed.data.userId,
      extension: parsed.data.extension,
      sipUsername: encryptToken(parsed.data.sipUsername) || '',
      sipPassword: encryptToken(parsed.data.sipPassword) || '',
      sipDomain: parsed.data.sipDomain,
      fusionExtId: parsed.data.fusionExtId || null,
      fusionDomainId: parsed.data.fusionDomainId || null,
    },
  });

  return NextResponse.json({
    extension: {
      id: ext.id,
      extension: ext.extension,
      sipDomain: ext.sipDomain,
      status: ext.status,
    },
  }, { status: 201 });
});

export const DELETE = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await prisma.sipExtension.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
});

/**
 * Get decrypted SIP credentials for WebRTC registration (called by softphone).
 * Only returns credentials for the authenticated user's own extension.
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const action = body.action;

  if (action === 'get-credentials') {
    const ext = await prisma.sipExtension.findFirst({
      where: { userId: session.user.id },
    });

    if (!ext) {
      return NextResponse.json({ error: 'No extension assigned' }, { status: 404 });
    }

    return NextResponse.json({
      extension: ext.extension,
      sipUsername: decryptToken(ext.sipUsername),
      sipPassword: decryptToken(ext.sipPassword),
      sipDomain: ext.sipDomain,
      wsUrl: `wss://${ext.sipDomain}:7443`,
    });
  }

  if (action === 'update-status') {
    const status = body.status;
    if (!['ONLINE', 'BUSY', 'DND', 'AWAY', 'OFFLINE'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await prisma.sipExtension.updateMany({
      where: { userId: session.user.id },
      data: {
        status,
        isRegistered: status !== 'OFFLINE',
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ updated: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});

export const dynamic = 'force-dynamic';

/**
 * Voicemail Detail API
 * GET    — Get voicemail details
 * PUT    — Mark as read/archive
 * DELETE — Delete voicemail
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { markVoicemailRead, archiveVoicemail } from '@/lib/voip/voicemail-engine';
import { AuditLogger } from '@/lib/voip/audit-log';

const voicemailUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

const auditLogger = new AuditLogger({ flushSize: 10, flushIntervalMs: 60_000 });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const { id } = await params;

    const voicemail = await prisma.voicemail.findUnique({
      where: { id },
      include: {
        extension: {
          select: { extension: true, user: { select: { name: true } } },
        },
        client: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!voicemail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Log voicemail listen event for HIPAA compliance
    await auditLogger.log({
      userId: session.user.id,
      action: 'voicemail.listen',
      resource: 'Voicemail',
      resourceId: id,
      ipAddress: _request.headers.get('x-forwarded-for') || _request.headers.get('x-real-ip') || undefined,
      userAgent: _request.headers.get('user-agent') || undefined,
      result: 'success',
      details: {
        callerNumber: voicemail.callerNumber,
        extensionId: voicemail.extensionId,
      },
    });

    return NextResponse.json({ data: voicemail });
  } catch (error) {
    console.error('[voip/voicemail GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const { id } = await params;
    const raw = await request.json();
    const parsed = voicemailUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    const { isRead, isArchived } = parsed.data;

    // Use voicemail-engine functions for state changes (they handle
    // business logic consistently, matching the recording engine pattern)
    if (isRead === true) {
      await markVoicemailRead(id);
    }
    if (isArchived === true) {
      await archiveVoicemail(id);
    }

    // For other partial updates (e.g., marking unread), fall back to direct Prisma
    if (isRead === false || (isRead === undefined && isArchived === undefined)) {
      await prisma.voicemail.update({
        where: { id },
        data: {
          ...(isRead !== undefined ? { isRead } : {}),
          ...(isArchived !== undefined ? { isArchived } : {}),
        },
      });
    }

    const voicemail = await prisma.voicemail.findUnique({ where: { id } });

    return NextResponse.json({ data: voicemail });
  } catch (error) {
    console.error('[voip/voicemail PUT] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
    const { id } = await params;

    await prisma.voicemail.delete({ where: { id } });

    // Log voicemail deletion for HIPAA compliance
    await auditLogger.log({
      userId: session.user.id,
      action: 'voicemail.delete',
      resource: 'Voicemail',
      resourceId: id,
      ipAddress: _request.headers.get('x-forwarded-for') || _request.headers.get('x-real-ip') || undefined,
      userAgent: _request.headers.get('user-agent') || undefined,
      result: 'success',
    });

    return NextResponse.json({ status: 'deleted' });
  } catch (error) {
    console.error('[voip/voicemail DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

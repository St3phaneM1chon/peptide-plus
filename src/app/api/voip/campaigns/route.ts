export const dynamic = 'force-dynamic';

/**
 * Dialer Campaign Management API
 * GET  — List campaigns with stats
 * POST — Create campaign with contact list
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { markCampaignDncl } from '@/lib/voip/dncl';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');

    const campaigns = await prisma.dialerCampaign.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(status ? { status: status as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED' } : {}),
      },
      include: {
        _count: {
          select: {
            dialerList: true,
            dispositions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ data: campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      companyId,
      name,
      description,
      callerIdNumber,
      maxConcurrent = 1,
      useAmd = true,
      scriptTitle,
      scriptBody,
      startTime,
      endTime,
      timezone = 'America/Montreal',
      activeDays = ['mon', 'tue', 'wed', 'thu', 'fri'],
      contacts = [],
    } = body;

    if (!companyId || !name || !callerIdNumber) {
      return NextResponse.json(
        { error: 'companyId, name, and callerIdNumber required' },
        { status: 400 }
      );
    }

    const campaign = await prisma.dialerCampaign.create({
      data: {
        companyId,
        name,
        description,
        callerIdNumber,
        maxConcurrent,
        useAmd,
        scriptTitle,
        scriptBody,
        startTime,
        endTime,
        timezone,
        activeDays,
        totalContacts: contacts.length,
        dialerList: {
          create: contacts.map((c: {
            phoneNumber: string;
            firstName?: string;
            lastName?: string;
            email?: string;
            customFields?: Record<string, unknown>;
          }) => ({
            phoneNumber: c.phoneNumber,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.email,
            customFields: c.customFields || undefined,
          })),
        },
      },
      include: {
        _count: { select: { dialerList: true } },
      },
    });

    // Pre-check DNCL for all contacts
    if (contacts.length > 0) {
      const blocked = await markCampaignDncl(campaign.id);
      if (blocked > 0) {
        return NextResponse.json({
          data: campaign,
          dnclBlocked: blocked,
          message: `${blocked} contacts flagged as DNCL`,
        }, { status: 201 });
      }
    }

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

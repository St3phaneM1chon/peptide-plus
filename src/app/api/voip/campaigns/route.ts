export const dynamic = 'force-dynamic';

/**
 * Dialer Campaign Management API
 * GET  — List campaigns with stats
 * POST — Create campaign with contact list
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
    const raw = await request.json();
    const parsed = z.object({
      companyId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      callerIdNumber: z.string().min(1),
      maxConcurrent: z.number().int().positive().optional().default(1),
      useAmd: z.boolean().optional().default(true),
      scriptTitle: z.string().optional(),
      scriptBody: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      timezone: z.string().optional().default('America/Montreal'),
      activeDays: z.array(z.string()).optional().default(['mon', 'tue', 'wed', 'thu', 'fri']),
      contacts: z.array(z.object({
        phoneNumber: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(),
        customFields: z.record(z.unknown()).optional(),
      })).optional().default([]),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
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
      contacts,
    } = parsed.data;

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
            customFields: c.customFields ? JSON.parse(JSON.stringify(c.customFields)) : undefined,
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

export const dynamic = 'force-dynamic';

/**
 * IVR Menu Management API
 * GET  — List IVR menus
 * POST — Create IVR menu with options
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { buildGreetingText } from '@/lib/voip/ivr-engine';
import {
  ConversationalIVR,
  type ConversationalIVRConfig,
} from '@/lib/voip/conversational-ivr';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const companyId = searchParams.get('companyId');

    const menus = await prisma.ivrMenu.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        isActive: true,
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Check if client is requesting conversational IVR info
    const mode = searchParams.get('mode');

    if (mode === 'conversational') {
      // Return conversational IVR capabilities alongside DTMF menus
      const conversationalIvr = new ConversationalIVR({
        language: 'fr',
      } satisfies ConversationalIVRConfig);

      return NextResponse.json({
        data: menus,
        conversational: {
          available: true,
          greeting: conversationalIvr.getGreeting(),
          description: 'AI-powered natural language IVR using GPT. Callers speak naturally instead of pressing keys.',
          fallbackToKeypad: true,
        },
      });
    }

    // Enrich each menu with a preview of the auto-generated greeting text
    const enriched = menus.map(m => ({
      ...m,
      generatedGreeting: m.greetingText || buildGreetingText(m.options),
    }));

    return NextResponse.json({ data: enriched });
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
      greetingText: z.string().optional(),
      language: z.string().optional().default('fr-CA'),
      inputTimeout: z.number().int().optional().default(5),
      maxRetries: z.number().int().optional().default(3),
      timeoutAction: z.string().optional().default('replay'),
      timeoutTarget: z.string().optional(),
      businessHoursStart: z.string().optional(),
      businessHoursEnd: z.string().optional(),
      afterHoursMenuId: z.string().optional(),
      options: z.array(z.object({
        digit: z.string(),
        label: z.string(),
        action: z.string(),
        target: z.string(),
        announcement: z.string().optional(),
        sortOrder: z.number().int().optional(),
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
      greetingText,
      language,
      inputTimeout,
      maxRetries,
      timeoutAction,
      timeoutTarget,
      businessHoursStart,
      businessHoursEnd,
      afterHoursMenuId,
      options,
    } = parsed.data;

    const menu = await prisma.ivrMenu.create({
      data: {
        companyId,
        name,
        description,
        greetingText,
        language,
        inputTimeout,
        maxRetries,
        timeoutAction,
        timeoutTarget,
        businessHoursStart,
        businessHoursEnd,
        afterHoursMenuId,
        options: {
          create: options.map((opt: {
            digit: string;
            label: string;
            action: string;
            target: string;
            announcement?: string;
            sortOrder?: number;
          }, idx: number) => ({
            digit: opt.digit,
            label: opt.label,
            action: opt.action,
            target: opt.target,
            announcement: opt.announcement,
            sortOrder: opt.sortOrder ?? idx,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({ data: menu }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

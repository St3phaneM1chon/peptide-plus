export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Campaigns API
 * GET - List all campaigns
 * POST - Create a new campaign (draft, scheduled, or sent)
 *
 * FIX: FLAW-002 - These routes were missing; the admin page fetched from them but they didn't exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const createCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT']).default('DRAFT'),
  scheduledFor: z.string().datetime().optional(),
  abTestConfig: z.object({
    enabled: z.boolean(),
    testType: z.enum(['subject', 'content']),
    variantA: z.object({
      subject: z.string().optional(),
      htmlContent: z.string().optional(),
    }),
    variantB: z.object({
      subject: z.string().optional(),
      htmlContent: z.string().optional(),
    }),
    splitPercentage: z.number().min(10).max(50),
    waitDurationMinutes: z.number().min(5).max(1440),
    winningMetric: z.enum(['open_rate', 'click_rate', 'conversion_rate']),
  }).optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100', 10)), 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    const formatted = campaigns.map((c) => {
      let parsedStats: Record<string, unknown> = {};
      if (c.stats) {
        try {
          parsedStats = JSON.parse(c.stats);
        } catch { /* ignore invalid JSON */ }
      }

      // Extract A/B test config
      let abTestConfig: Record<string, unknown> | undefined;
      if (c.abTestConfig) {
        try {
          abTestConfig = JSON.parse(c.abTestConfig);
        } catch { /* ignore invalid JSON */ }
      }

      // Extract A/B test result from stats
      const abTestResult = parsedStats.abTest as Record<string, unknown> | undefined;

      const sent = typeof parsedStats.sent === 'number' ? parsedStats.sent : 0;

      return {
        id: c.id,
        subject: c.subject,
        content: c.htmlContent,
        status: c.status,
        scheduledFor: c.scheduledAt?.toISOString() || null,
        sentAt: c.sentAt?.toISOString() || null,
        recipientCount: (typeof parsedStats.totalRecipients === 'number' ? parsedStats.totalRecipients : 0) || sent,
        openRate: sent > 0
          ? Math.round(((typeof parsedStats.opened === 'number' ? parsedStats.opened : 0)) / sent * 100)
          : undefined,
        clickRate: sent > 0
          ? Math.round(((typeof parsedStats.clicked === 'number' ? parsedStats.clicked : 0)) / sent * 100)
          : undefined,
        createdAt: c.createdAt.toISOString(),
        abTestConfig: abTestConfig || undefined,
        abTestResult: abTestResult || undefined,
      };
    });

    return NextResponse.json({
      campaigns: formatted,
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error('Admin newsletter campaigns GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', campaigns: [] },
      { status: 500 }
    );
  }
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { subject, content, status, scheduledFor, abTestConfig } = parsed.data;

    const campaign = await prisma.emailCampaign.create({
      data: {
        name: subject,
        subject,
        htmlContent: content,
        status: status === 'SENT' ? 'SCHEDULED' : status,
        scheduledAt: status === 'SENT'
          ? new Date()
          : scheduledFor
            ? new Date(scheduledFor)
            : null,
        sentAt: null,
        createdBy: session.user.id,
        abTestConfig: abTestConfig ? JSON.stringify(abTestConfig) : null,
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    logger.error('Admin newsletter campaigns POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to create campaign' },
      { status: 500 }
    );
  }
});

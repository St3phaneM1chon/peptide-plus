export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/newsletter/campaigns
 * List newsletter campaigns
 *
 * Note: There is no NewsletterCampaign Prisma model yet.
 * This returns an empty array until the model is added.
 * The admin page expects: { campaigns: Campaign[] }
 * where Campaign has: id, subject, content, status, scheduledFor, sentAt,
 *   recipientCount, openRate, clickRate
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Provide subscriber stats alongside campaigns for context
    const totalActive = await prisma.newsletterSubscriber.count({
      where: { isActive: true },
    });

    // TODO: Replace with real campaign data once NewsletterCampaign model is added to schema
    // For now, return empty campaigns array - the page handles this gracefully
    return NextResponse.json({
      campaigns: [],
      meta: {
        totalActiveSubscribers: totalActive,
      },
    });
  } catch (error) {
    console.error('Get newsletter campaigns error:', error);
    return NextResponse.json(
      { error: 'Error fetching campaigns' },
      { status: 500 }
    );
  }
}

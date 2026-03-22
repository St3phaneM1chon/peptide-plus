export const dynamic = 'force-dynamic';

/**
 * Customer Communications Timeline API
 * GET /api/admin/customers/[id]/communications
 *
 * Returns a unified communication timeline for a customer:
 * calls, voicemails, and CRM activities (emails, SMS, notes, meetings).
 *
 * Query params:
 *   ?limit=50        Max items to return (default 50, max 200)
 *   ?offset=0        Pagination offset (default 0)
 *   ?type=all        Filter: all | call | voicemail | email | sms | note | meeting
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineItem {
  id: string;
  type: string;
  date: string;
  [key: string]: unknown;
}

const VALID_TYPES = ['all', 'call', 'voicemail', 'email', 'sms', 'note', 'meeting'] as const;

// ---------------------------------------------------------------------------
// GET: Unified communication timeline
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
    const typeFilter = (url.searchParams.get('type') || 'all') as typeof VALID_TYPES[number];

    if (!VALID_TYPES.includes(typeFilter)) {
      return apiError(
        `Invalid type filter. Valid values: ${VALID_TYPES.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
        { status: 400, request }
      );
    }

    // Verify customer exists
    const customer = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true },
    });

    if (!customer) {
      return apiError('Customer not found', ErrorCode.NOT_FOUND, { request });
    }

    // ---------------------------------------------------------------------------
    // Fetch data in parallel based on type filter
    // ---------------------------------------------------------------------------

    const fetchCalls = typeFilter === 'all' || typeFilter === 'call';
    const fetchVoicemails = typeFilter === 'all' || typeFilter === 'voicemail';
    const fetchActivities = typeFilter === 'all' || ['email', 'sms', 'note', 'meeting'].includes(typeFilter);

    const [calls, voicemails, activities, stats] = await Promise.all([
      // Calls
      fetchCalls
        ? prisma.callLog.findMany({
            where: { clientId: id },
            include: {
              recording: {
                select: {
                  id: true,
                  blobUrl: true,
                  durationSec: true,
                },
              },
              transcription: {
                select: {
                  id: true,
                  fullText: true,
                  summary: true,
                  sentiment: true,
                  keywords: true,
                },
              },
            },
            orderBy: { startedAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),

      // Voicemails
      fetchVoicemails
        ? prisma.voicemail.findMany({
            where: { clientId: id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),

      // CRM Activities (email, sms, note, meeting — excluding CALL type to avoid duplicates)
      fetchActivities
        ? prisma.crmActivity.findMany({
            where: {
              contactId: id,
              type: typeFilter !== 'all'
                ? typeFilter.toUpperCase() as 'EMAIL' | 'SMS' | 'NOTE' | 'MEETING'
                : { in: ['EMAIL', 'SMS', 'NOTE', 'MEETING', 'STATUS_CHANGE'] },
            },
            include: {
              performedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          })
        : Promise.resolve([]),

      // Stats (always fetched)
      Promise.all([
        prisma.callLog.count({ where: { clientId: id } }),
        prisma.voicemail.count({ where: { clientId: id } }),
        prisma.crmActivity.count({
          where: {
            contactId: id,
            type: { in: ['EMAIL', 'SMS', 'NOTE', 'MEETING', 'STATUS_CHANGE'] },
          },
        }),
        prisma.callLog.findFirst({
          where: { clientId: id },
          orderBy: { startedAt: 'desc' },
          select: { startedAt: true },
        }),
      ]),
    ]);

    const [totalCalls, totalVoicemails, totalActivities, lastCall] = stats;

    // ---------------------------------------------------------------------------
    // Merge into unified timeline
    // ---------------------------------------------------------------------------

    const timeline: TimelineItem[] = [
      // Calls
      ...calls.map((c) => ({
        id: c.id,
        type: 'call' as const,
        date: c.startedAt.toISOString(),
        direction: c.direction,
        status: c.status,
        duration: c.duration,
        callerNumber: c.callerNumber,
        callerName: c.callerName,
        calledNumber: c.calledNumber,
        agentNotes: c.agentNotes,
        disposition: c.disposition,
        tags: c.tags,
        recording: c.recording
          ? {
              id: c.recording.id,
              url: c.recording.blobUrl,
              duration: c.recording.durationSec,
            }
          : null,
        transcription: c.transcription
          ? {
              summary: c.transcription.summary,
              sentiment: c.transcription.sentiment,
              keywords: c.transcription.keywords,
              fullText: c.transcription.fullText?.substring(0, 500),
            }
          : null,
      })),

      // Voicemails
      ...voicemails.map((v) => ({
        id: v.id,
        type: 'voicemail' as const,
        date: v.createdAt.toISOString(),
        callerNumber: v.callerNumber,
        callerName: v.callerName,
        duration: v.durationSec,
        transcription: v.transcription
          ? { summary: v.transcription, fullText: v.transcription }
          : null,
        isRead: v.isRead,
        audioUrl: v.blobUrl,
      })),

      // CRM Activities
      ...activities.map((a) => ({
        id: a.id,
        type: a.type.toLowerCase(),
        date: a.createdAt.toISOString(),
        title: a.title,
        description: a.description,
        performedBy: a.performedBy?.name || null,
        metadata: a.metadata,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return apiSuccess(
      {
        timeline,
        stats: {
          totalCalls,
          totalVoicemails,
          totalActivities,
          lastContactDate: lastCall?.startedAt?.toISOString() || null,
        },
      },
      { request }
    );
  } catch (error) {
    logger.error('[customers/[id]/communications] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch communications', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'users.view' });

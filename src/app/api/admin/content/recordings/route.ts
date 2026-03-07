export const dynamic = 'force-dynamic';

/**
 * Unified Content Search API
 * GET /api/admin/content/recordings - Search across recordings, transcriptions, and chat
 *
 * Query params:
 *   q        - Full-text search query
 *   type     - Filter: "audio" | "video" | "chat" | "all" (default: "all")
 *   from     - Start date (ISO string)
 *   to       - End date (ISO string)
 *   page     - Page number (default: 1)
 *   limit    - Results per page (default: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'all';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const results: Array<{
      id: string;
      type: 'audio' | 'video' | 'chat';
      title: string;
      description: string | null;
      date: string;
      duration: number | null;
      url: string | null;
      sentiment: string | null;
      metadata: Record<string, unknown>;
    }> = [];

    // --- Audio & Video Recordings ---
    if (type === 'all' || type === 'audio' || type === 'video') {
      const recordingWhere: Record<string, unknown> = {
        isUploaded: true,
      };

      if (type === 'audio') recordingWhere.isVideo = false;
      if (type === 'video') recordingWhere.isVideo = true;

      if (Object.keys(dateFilter).length > 0) {
        recordingWhere.createdAt = dateFilter;
      }

      if (q) {
        recordingWhere.OR = [
          { callLog: { callerName: { contains: q, mode: 'insensitive' } } },
          { callLog: { callerNumber: { contains: q, mode: 'insensitive' } } },
          { callLog: { calledNumber: { contains: q, mode: 'insensitive' } } },
          { transcription: { fullText: { contains: q, mode: 'insensitive' } } },
          { transcription: { summary: { contains: q, mode: 'insensitive' } } },
        ];
      }

      const [recordings, recordingCount] = await Promise.all([
        prisma.callRecording.findMany({
          where: recordingWhere,
          include: {
            callLog: {
              select: {
                callerNumber: true,
                callerName: true,
                calledNumber: true,
                direction: true,
                startedAt: true,
              },
            },
            transcription: {
              select: { summary: true, sentiment: true, keywords: true },
            },
            videoRoom: {
              select: { displayName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.callRecording.count({ where: recordingWhere }),
      ]);

      for (const rec of recordings) {
        const isVideoRec = rec.isVideo;
        results.push({
          id: rec.id,
          type: isVideoRec ? 'video' : 'audio',
          title: rec.videoRoom?.displayName
            || `${rec.callLog?.callerName || rec.callLog?.callerNumber || 'Unknown'} → ${rec.callLog?.calledNumber || 'Unknown'}`,
          description: rec.transcription?.summary || null,
          date: rec.createdAt.toISOString(),
          duration: rec.durationSec,
          url: rec.blobUrl,
          sentiment: rec.transcription?.sentiment || null,
          metadata: {
            format: rec.format,
            fileSize: rec.fileSize,
            direction: rec.callLog?.direction,
            keywords: rec.transcription?.keywords || [],
            isVideo: rec.isVideo,
            resolution: rec.resolution,
          },
        });
      }

      // Add count to response
      if (type !== 'all') {
        return NextResponse.json({
          results,
          total: recordingCount,
          page,
          limit,
          totalPages: Math.ceil(recordingCount / limit),
        });
      }
    }

    // --- Chat Conversations ---
    if (type === 'all' || type === 'chat') {
      const chatWhere: Record<string, unknown> = {};

      if (Object.keys(dateFilter).length > 0) {
        chatWhere.lastMessageAt = dateFilter;
      }

      if (q) {
        chatWhere.OR = [
          { visitorName: { contains: q, mode: 'insensitive' } },
          { visitorEmail: { contains: q, mode: 'insensitive' } },
          { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
        ];
      }

      const [conversations, chatCount] = await Promise.all([
        prisma.chatConversation.findMany({
          where: chatWhere,
          include: {
            messages: {
              select: { content: true, sender: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            _count: { select: { messages: true } },
          },
          orderBy: { lastMessageAt: 'desc' },
          skip: type === 'chat' ? skip : 0,
          take: type === 'chat' ? limit : Math.max(5, limit - results.length),
        }),
        prisma.chatConversation.count({ where: chatWhere }),
      ]);

      for (const conv of conversations) {
        results.push({
          id: conv.id,
          type: 'chat',
          title: conv.visitorName || conv.visitorEmail || `Visitor ${conv.visitorId.slice(0, 8)}`,
          description: conv.messages[0]?.content?.slice(0, 100) || null,
          date: conv.lastMessageAt.toISOString(),
          duration: null,
          url: null,
          sentiment: null,
          metadata: {
            messageCount: conv._count.messages,
            status: conv.status,
            language: conv.visitorLanguage,
          },
        });
      }

      if (type === 'chat') {
        return NextResponse.json({
          results,
          total: chatCount,
          page,
          limit,
          totalPages: Math.ceil(chatCount / limit),
        });
      }
    }

    // For type=all, sort combined results by date
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      results: results.slice(0, limit),
      total: results.length,
      page,
      limit,
    });
  } catch (err) {
    logger.error('[content:recordings] Search error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

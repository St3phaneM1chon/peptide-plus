export const dynamic = 'force-dynamic';

/**
 * WhatsApp Meeting Notification API
 * POST - Send a WhatsApp message with training video link
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendTextMessage } from '@/lib/integrations/whatsapp';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { phoneNumber, videoTitle, videoUrl, clientName } = body as {
      phoneNumber?: string;
      videoTitle?: string;
      videoUrl?: string;
      clientName?: string;
    };

    if (!phoneNumber || !videoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: phoneNumber, videoUrl' },
        { status: 400 },
      );
    }

    const message = [
      `Hello${clientName ? ` ${clientName}` : ''},`,
      '',
      `Your private training session${videoTitle ? ` "${videoTitle}"` : ''} is now available.`,
      '',
      `Watch here: ${videoUrl}`,
      '',
      'Thank you,',
      'BioCycle Peptides',
    ].join('\n');

    const result = await sendTextMessage(phoneNumber, message);

    return NextResponse.json({
      success: true,
      messageId: result?.messages?.[0]?.id || null,
    });
  } catch (error) {
    logger.error('[WhatsAppNotify] Send error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send WhatsApp message' },
      { status: 500 },
    );
  }
});

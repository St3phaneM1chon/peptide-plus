export const dynamic = 'force-dynamic';

/**
 * WhatsApp Meeting Notification API
 * POST - Send a WhatsApp message with training video link
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendTextMessage } from '@/lib/integrations/whatsapp';
import { logger } from '@/lib/logger';

const notifyWhatsAppSchema = z.object({
  phoneNumber: z.string().min(1).max(20).regex(/^\+?[0-9\s\-()]+$/, 'Invalid phone number format'),
  videoTitle: z.string().max(500).trim().optional(),
  videoUrl: z.string().url().max(2000),
  clientName: z.string().max(200).trim().optional(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = notifyWhatsAppSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { phoneNumber, videoTitle, videoUrl, clientName } = parsed.data;

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
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});

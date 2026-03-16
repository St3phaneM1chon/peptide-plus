export const dynamic = 'force-dynamic';

/**
 * WebRTC Token API
 * POST /api/admin/voip/webrtc-token
 *
 * Generates a Telnyx WebRTC credential token for the browser softphone.
 * The client uses this token to authenticate with the TelnyxRTC SDK.
 *
 * Requires admin session (EMPLOYEE or OWNER role).
 */

import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { generateWebRtcToken } from '@/lib/telnyx';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// POST: Generate a WebRTC token for Telnyx softphone
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    // Fetch the active Telnyx VoIP connection to get the connectionId
    const connection = await prisma.voipConnection.findFirst({
      where: { provider: 'telnyx', isEnabled: true },
      select: { id: true, accountSid: true },
    });

    if (!connection) {
      return apiError(
        'No active Telnyx VoIP connection found. Please configure a Telnyx connection in VoIP settings.',
        ErrorCode.NOT_FOUND,
        { request, status: 404 }
      );
    }

    // Use accountSid as the Telnyx connection ID (configured during VoIP setup),
    // or fall back to the TELNYX_CONNECTION_ID env var.
    const connectionId = connection.accountSid || process.env.TELNYX_CONNECTION_ID;

    if (!connectionId) {
      return apiError(
        'Telnyx connection ID is not configured. Set accountSid on the VoIP connection or TELNYX_CONNECTION_ID env var.',
        ErrorCode.VALIDATION_ERROR,
        { request, status: 422 }
      );
    }

    // Generate the WebRTC credential token via Telnyx API
    const result = await generateWebRtcToken(connectionId);

    const tokenData = result.data as Record<string, unknown> | undefined;

    logger.info('[voip/webrtc-token] WebRTC token generated', {
      connectionId,
      tokenId: tokenData?.id,
    });

    return apiSuccess(
      {
        token: tokenData?.token,
        tokenId: tokenData?.id,
        sip_username: tokenData?.sip_username,
        sip_password: tokenData?.sip_password,
        connectionId,
      },
      { request, status: 201 }
    );
  } catch (error) {
    logger.error('[voip/webrtc-token] Failed to generate WebRTC token', {
      error: error instanceof Error ? error.message : String(error),
    });

    return apiError(
      'Failed to generate WebRTC token. Check Telnyx API key and connection configuration.',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}, { skipCsrf: false });

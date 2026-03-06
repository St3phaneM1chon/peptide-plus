export const dynamic = 'force-dynamic';

/**
 * Public VoIP API — Tenant-Scoped External Integration
 *
 * Authentication: API key via X-API-Key header (stored on Company record)
 * All responses scoped to the authenticated tenant.
 *
 * Endpoints (via action parameter):
 * - call/initiate: Start an outbound call
 * - call/status: Get call status by ID
 * - calls/list: List recent calls
 * - recordings/list: List recordings
 * - dncl/check: Check DNCL status
 * - schema: OpenAPI JSON schema
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as telnyx from '@/lib/telnyx';
import { checkDncl } from '@/lib/voip/dncl';

// ── API Key Auth ──────────────────

async function authenticateApiKey(request: NextRequest): Promise<{
  companyId: string;
  companyName: string;
} | null> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) return null;

  // API key format: company_slug:random_secret
  const parts = apiKey.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [slug, secret] = parts;

  const company = await prisma.company.findFirst({
    where: {
      slug,
      isActive: true,
    },
    select: { id: true, name: true, slug: true, apiKeyHash: true },
  });

  if (!company) return null;

  // Verify the secret portion against stored hash
  // If apiKeyHash is not set yet (migration), accept slug-only temporarily
  if (company.apiKeyHash) {
    const { createHmac } = await import('crypto');
    const salt = process.env.API_KEY_SALT;
    if (!salt) {
      console.error('[VoIP Public API] API_KEY_SALT environment variable is not configured');
      return null;
    }
    const { timingSafeEqual } = await import('crypto');
    const hash = createHmac('sha256', salt)
      .update(secret)
      .digest('hex');
    try {
      if (!timingSafeEqual(Buffer.from(hash), Buffer.from(company.apiKeyHash))) return null;
    } catch {
      return null;
    }
  }

  return { companyId: company.id, companyName: company.name };
}

// ── Handlers ──────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    // Schema endpoint is public
    if (action === 'schema') {
      return NextResponse.json(OPENAPI_SCHEMA);
    }

    const tenant = await authenticateApiKey(request);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use X-API-Key header.' },
        { status: 401 }
      );
    }

    switch (action) {
      case 'calls': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const calls = await prisma.callLog.findMany({
          where: { companyId: tenant.companyId },
          select: {
            id: true,
            direction: true,
            status: true,
            callerNumber: true,
            calledNumber: true,
            startedAt: true,
            duration: true,
            disposition: true,
          },
          orderBy: { startedAt: 'desc' },
          take: Math.min(limit, 100),
        });
        return NextResponse.json({ data: calls, tenant: tenant.companyName });
      }

      case 'call-status': {
        const callId = searchParams.get('callId');
        if (!callId) {
          return NextResponse.json({ error: 'callId required' }, { status: 400 });
        }
        const call = await prisma.callLog.findFirst({
          where: { id: callId, companyId: tenant.companyId },
          include: {
            recording: { select: { id: true, blobUrl: true, durationSec: true } },
            transcription: { select: { id: true } },
          },
        });
        if (!call) {
          return NextResponse.json({ error: 'Call not found' }, { status: 404 });
        }
        return NextResponse.json({ data: call });
      }

      case 'recordings': {
        const recordings = await prisma.callRecording.findMany({
          where: {
            callLog: { companyId: tenant.companyId },
          },
          select: {
            id: true,
            blobUrl: true,
            durationSec: true,
            createdAt: true,
            callLogId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        return NextResponse.json({ data: recordings });
      }

      case 'dncl-check': {
        const phone = searchParams.get('phone');
        if (!phone) {
          return NextResponse.json({ error: 'phone required' }, { status: 400 });
        }
        const blocked = await checkDncl(phone);
        return NextResponse.json({ data: { phone, blocked } });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action. Use ?action=calls|call-status|recordings|dncl-check|schema' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[VoIP Public API]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await authenticateApiKey(request);
    if (!tenant) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use X-API-Key header.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'call-initiate': {
        const { to, from, webhookUrl: customWebhook } = body;
        if (!to) {
          return NextResponse.json({ error: 'to (phone number) required' }, { status: 400 });
        }
        if (!/^\+[1-9]\d{6,14}$/.test(to)) {
          return NextResponse.json({ error: 'to must be E.164 format (+1234567890)' }, { status: 400 });
        }
        if (from && !/^\+[1-9]\d{6,14}$/.test(from)) {
          return NextResponse.json({ error: 'from must be E.164 format (+1234567890)' }, { status: 400 });
        }

        // Verify caller ID belongs to tenant
        if (from) {
          const owned = await prisma.phoneNumber.findFirst({
            where: { number: from, companyId: tenant.companyId },
          });
          if (!owned) {
            return NextResponse.json(
              { error: 'Caller ID not owned by your tenant' },
              { status: 403 }
            );
          }
        }

        const connectionId = process.env.TELNYX_CONNECTION_ID;
        if (!connectionId) {
          console.error('[VoIP Public API] TELNYX_CONNECTION_ID not configured');
          return NextResponse.json({ error: 'Call service temporarily unavailable' }, { status: 503 });
        }
        const callerIdNumber = from || process.env.TELNYX_DEFAULT_CALLER_ID;
        if (!callerIdNumber) {
          return NextResponse.json({ error: 'Caller ID required (provide from or set TELNYX_DEFAULT_CALLER_ID)' }, { status: 400 });
        }
        const webhookUrl = customWebhook || `${process.env.NEXT_PUBLIC_APP_URL}/api/voip/webhooks/telnyx`;

        const result = await telnyx.dialCall({
          to,
          from: callerIdNumber,
          connectionId,
          webhookUrl,
          clientState: JSON.stringify({
            publicApi: true,
            companyId: tenant.companyId,
          }),
          timeout: 30,
        });

        const callControlId = result.data.call_control_id;

        return NextResponse.json({
          data: { callControlId, to, from: callerIdNumber },
        }, { status: 201 });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action. Use action=call-initiate' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[VoIP Public API]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── OpenAPI Schema ──────────────────

const OPENAPI_SCHEMA = {
  openapi: '3.0.3',
  info: {
    title: 'Attitudes VIP — VoIP Public API',
    version: '1.0.0',
    description: 'Tenant-scoped VoIP API for external integrations. Authenticate with X-API-Key header.',
    contact: { email: 'admin@attitudesvip.com' },
  },
  servers: [
    { url: '/api/voip/public', description: 'Production' },
  ],
  security: [{ apiKey: [] }],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
  paths: {
    '/?action=calls': {
      get: {
        summary: 'List recent calls',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { '200': { description: 'Call list' } },
      },
    },
    '/?action=call-status': {
      get: {
        summary: 'Get call status',
        parameters: [
          { name: 'callId', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Call detail' } },
      },
    },
    '/?action=recordings': {
      get: {
        summary: 'List recordings',
        responses: { '200': { description: 'Recording list' } },
      },
    },
    '/?action=dncl-check': {
      get: {
        summary: 'Check DNCL status',
        parameters: [
          { name: 'phone', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'DNCL status' } },
      },
    },
    '/': {
      post: {
        summary: 'Initiate outbound call',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action', 'to'],
                properties: {
                  action: { type: 'string', enum: ['call-initiate'] },
                  to: { type: 'string', description: 'Destination phone (E.164)' },
                  from: { type: 'string', description: 'Caller ID (must be owned by tenant)' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'Call initiated' } },
      },
    },
  },
};

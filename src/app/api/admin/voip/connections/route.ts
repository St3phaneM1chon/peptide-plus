export const dynamic = 'force-dynamic';

/**
 * VoIP Connections API
 * GET  - List all VoIP provider connections
 * POST - Create/update a VoIP connection
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  listVoipConnections,
  upsertVoipConnection,
  testVoipConnection,
  deleteVoipConnection,
} from '@/lib/voip/connection';

const connectionSchema = z.object({
  provider: z.enum(['telnyx', 'voipms', 'fusionpbx']),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  accountSid: z.string().optional(),
  pbxHost: z.string().optional(),
  pbxPort: z.number().int().min(1).max(65535).optional(),
  eslPassword: z.string().optional(),
  isEnabled: z.boolean().optional(),
});

export const GET = withAdminGuard(async () => {
  const connections = await listVoipConnections();
  return NextResponse.json({ connections });
}, { skipCsrf: true });

export const POST = withAdminGuard(async (request, { session }) => {
  const body = await request.json();
  const parsed = connectionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const connection = await upsertVoipConnection(parsed.data, session.user.id);
  return NextResponse.json({ connection }, { status: 201 });
});

export const DELETE = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  if (!provider) {
    return NextResponse.json({ error: 'provider required' }, { status: 400 });
  }

  await deleteVoipConnection(provider);
  return NextResponse.json({ deleted: true });
});

// Test connection endpoint via query param ?action=test&provider=xxx
export const PUT = withAdminGuard(async (request) => {
  const body = await request.json();
  const provider = body.provider;

  if (!provider) {
    return NextResponse.json({ error: 'provider required' }, { status: 400 });
  }

  const result = await testVoipConnection(provider);
  return NextResponse.json(result);
});

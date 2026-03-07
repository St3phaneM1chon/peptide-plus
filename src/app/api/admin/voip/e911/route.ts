export const dynamic = 'force-dynamic';

/**
 * E911 Emergency Address Management API
 *
 * POST /api/admin/voip/e911 — Validate or register an E911 address
 * GET  /api/admin/voip/e911 — Get E911 status for a phone number
 *
 * Wires into: src/lib/voip/e911.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  validateE911Address,
  registerE911,
  getE911Status,
  removeE911,
  type E911Address,
} from '@/lib/voip/e911';

const e911AddressSchema = z.object({
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().optional(),
});

const e911PostSchema = z.object({
  action: z.enum(['validate', 'register', 'remove']),
  phoneNumberId: z.string().optional(),
  address: e911AddressSchema.optional(),
});

/**
 * GET - Get E911 registration status for a phone number.
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const phoneNumberId = searchParams.get('phoneNumberId');

    if (!phoneNumberId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: phoneNumberId' },
        { status: 400 },
      );
    }

    const status = await getE911Status(phoneNumberId);

    return NextResponse.json({ data: status });
  } catch (error) {
    logger.error('[E911 API] Failed to get status', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get E911 status' }, { status: 500 });
  }
});

/**
 * POST - Validate or register an E911 address.
 *
 * Body:
 * - action: 'validate' | 'register' | 'remove'
 * - phoneNumberId: string (required for register/remove)
 * - address: E911Address (required for validate/register)
 */
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const raw = await request.json();
    const parsed = e911PostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, phoneNumberId, address: rawAddress } = parsed.data;
    const address = rawAddress as unknown as E911Address | undefined;

    if (action === 'validate') {
      if (!address) {
        return NextResponse.json(
          { error: 'Missing required field: address' },
          { status: 400 },
        );
      }

      const result = await validateE911Address(address);
      return NextResponse.json({ data: result });
    }

    if (action === 'register') {
      if (!phoneNumberId || !address) {
        return NextResponse.json(
          { error: 'Missing required fields: phoneNumberId, address' },
          { status: 400 },
        );
      }

      const registration = await registerE911(phoneNumberId, address);
      return NextResponse.json({ data: registration }, { status: 201 });
    }

    if (action === 'remove') {
      if (!phoneNumberId) {
        return NextResponse.json(
          { error: 'Missing required field: phoneNumberId' },
          { status: 400 },
        );
      }

      const success = await removeE911(phoneNumberId);
      return NextResponse.json({ data: { success } });
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be: validate, register, or remove' },
      { status: 400 },
    );
  } catch (error) {
    logger.error('[E911 API] Operation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'E911 operation failed' }, { status: 500 });
  }
});

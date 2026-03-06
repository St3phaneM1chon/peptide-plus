export const dynamic = 'force-dynamic';

/**
 * DNCL (Do Not Call List) Management API
 * GET  — Stats and search
 * POST — Check, import, add, remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import {
  checkDncl,
  bulkCheckDncl,
  importDnclList,
  addToDncl,
  removeFromDncl,
  getDnclStats,
} from '@/lib/voip/dncl';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getDnclStats();
    return NextResponse.json({ data: stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'check': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        const blocked = await checkDncl(body.phoneNumber);
        return NextResponse.json({ data: { phoneNumber: body.phoneNumber, blocked } });
      }

      case 'bulk-check': {
        if (!body.phoneNumbers?.length) {
          return NextResponse.json({ error: 'phoneNumbers array required' }, { status: 400 });
        }
        const blockedSet = await bulkCheckDncl(body.phoneNumbers);
        return NextResponse.json({
          data: {
            checked: body.phoneNumbers.length,
            blocked: [...blockedSet],
          },
        });
      }

      case 'import': {
        if (!body.phoneNumbers?.length) {
          return NextResponse.json({ error: 'phoneNumbers array required' }, { status: 400 });
        }
        const result = await importDnclList(body.phoneNumbers, body.source || 'crtc');
        return NextResponse.json({ data: result });
      }

      case 'add': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        await addToDncl(body.phoneNumber, body.reason);
        return NextResponse.json({ status: 'added' });
      }

      case 'remove': {
        if (!body.phoneNumber) {
          return NextResponse.json({ error: 'phoneNumber required' }, { status: 400 });
        }
        const removed = await removeFromDncl(body.phoneNumber);
        if (!removed) {
          return NextResponse.json(
            { error: 'Number not found or cannot be removed (CRTC entries are permanent)' },
            { status: 400 }
          );
        }
        return NextResponse.json({ status: 'removed' });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';

const syncItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  method: z.string(),
  body: z.string(),
  timestamp: z.number(),
});

const syncSchema = z.object({
  items: z.array(syncItemSchema),
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const result = syncSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }
    const { items } = result.data;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const item of items) {
      try {
        const url = new URL(item.url, request.url);
        const res = await fetch(url.toString(), {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        });
        results.push({ id: item.id, success: res.ok, error: res.ok ? undefined : `Status ${res.status}` });
      } catch (err) {
        results.push({ id: item.id, success: false, error: 'Erreur réseau' });
      }
    }

    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur synchronisation' }, { status: 500 });
  }
});

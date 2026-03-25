export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { getXpSummary } from '@/lib/lms/xp-service';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const summary = await getXpSummary(tenantId, session.user.id);
  return NextResponse.json({ data: summary });
}, { skipCsrf: true });

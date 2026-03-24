export const dynamic = 'force-dynamic';

/**
 * AI Course Recommendations API
 * GET /api/lms/recommendations — Get personalized course suggestions
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { getRecommendations } from '@/lib/lms/ai-recommendations';

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 20);

  const recommendations = await getRecommendations(tenantId, session.user.id, limit);
  return NextResponse.json({ data: recommendations });
}, { skipCsrf: true });

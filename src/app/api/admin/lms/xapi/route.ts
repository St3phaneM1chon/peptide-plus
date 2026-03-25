export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess } from '@/lib/api-response';
import { queryStatements, exportStatements } from '@/lib/lms/xapi-service';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);

  const format = searchParams.get('format'); // 'export' for standard xAPI JSON
  const actorId = searchParams.get('actorId') ?? undefined;
  const verb = searchParams.get('verb') ?? undefined;
  const objectType = searchParams.get('objectType') ?? undefined;
  const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 500);

  if (format === 'export') {
    const statements = await exportStatements(tenantId, since);
    return apiSuccess({ statements, count: statements.length, format: 'xAPI 2.0' }, { request });
  }

  const statements = await queryStatements(tenantId, { actorId, verb, objectType, since, limit });
  return apiSuccess({ statements, count: statements.length }, { request });
});

export const dynamic = 'force-dynamic';

/**
 * CRM Compliance API
 * GET: Compliance stats + calling rules
 * POST: Import DNCL list, record consent, update calling rules
 */

import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import {
  getComplianceStats,
  importDnclList,
  recordConsent,
  revokeConsent,
  addToInternalDnc,
} from '@/lib/crm/dnc-compliance';

export const GET = withAdminGuard(async (request) => {
  const url = new URL(request.url);
  const section = url.searchParams.get('section');

  if (section === 'stats') {
    const stats = await getComplianceStats();
    return apiSuccess(stats, { request });
  }

  if (section === 'calling-rules') {
    const rules = await prisma.callingRule.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return apiSuccess(rules, { request });
  }

  if (section === 'consent') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const phone = url.searchParams.get('phone');
    const email = url.searchParams.get('email');

    const where: Record<string, unknown> = {};
    if (phone) where.phone = phone;
    if (email) where.email = email;

    const whereInput = where as Prisma.CrmConsentRecordWhereInput;
    const [records, total] = await Promise.all([
      prisma.crmConsentRecord.findMany({
        where: whereInput,
        orderBy: { grantedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.crmConsentRecord.count({
        where: whereInput,
      }),
    ]);

    return apiSuccess({ records, total, page, pageSize }, { request });
  }

  if (section === 'dnc') {
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

    const [records, total] = await Promise.all([
      prisma.smsOptOut.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsOptOut.count(),
    ]);

    return apiSuccess({ records, total, page, pageSize }, { request });
  }

  // Default: return stats
  const stats = await getComplianceStats();
  return apiSuccess(stats, { request });
});

export const POST = withAdminGuard(async (request) => {
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case 'import-dncl': {
      const { phoneNumbers, source } = body;
      if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
        return apiError('phoneNumbers array required', 'VALIDATION_ERROR', { status: 400 });
      }
      const result = await importDnclList(phoneNumbers, source);
      return apiSuccess(result, { request });
    }

    case 'add-dnc': {
      const { phone, reason } = body;
      if (!phone) return apiError('phone required', 'VALIDATION_ERROR', { status: 400 });
      await addToInternalDnc(phone, reason);
      return apiSuccess({ phone, status: 'added' }, { request });
    }

    case 'record-consent': {
      const id = await recordConsent(body);
      return apiSuccess({ id }, { request, status: 201 });
    }

    case 'revoke-consent': {
      const { phone, email, channel } = body;
      const count = await revokeConsent({ phone, email }, channel);
      return apiSuccess({ revoked: count }, { request });
    }

    case 'create-calling-rule': {
      const rule = await prisma.callingRule.create({
        data: {
          name: body.name || 'Default',
          timezone: body.timezone || 'America/Toronto',
          startHour: body.startHour ?? 9,
          endHour: body.endHour ?? 21,
          endMinute: body.endMinute ?? 30,
          weekendAllowed: body.weekendAllowed ?? false,
          holidayAllowed: body.holidayAllowed ?? false,
          maxAttemptsPerDay: body.maxAttemptsPerDay ?? 3,
          maxAttemptsTotal: body.maxAttemptsTotal ?? 10,
          retryIntervalMin: body.retryIntervalMin ?? 60,
        },
      });
      return apiSuccess(rule, { request, status: 201 });
    }

    default:
      return apiError('Unknown action', 'VALIDATION_ERROR', { status: 400 });
  }
});

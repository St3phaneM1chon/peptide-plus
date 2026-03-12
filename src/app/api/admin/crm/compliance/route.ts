export const dynamic = 'force-dynamic';

/**
 * CRM Compliance API
 * GET: Compliance stats + calling rules
 * POST: Import DNCL list, record consent, update calling rules
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
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
}, { requiredPermission: 'crm.compliance.manage' });

const importDnclSchema = z.object({
  action: z.literal('import-dncl'),
  phoneNumbers: z.array(z.string().max(30)).min(1).max(10000),
  source: z.string().max(200).optional(),
});

const addDncSchema = z.object({
  action: z.literal('add-dnc'),
  phone: z.string().min(1).max(30),
  reason: z.string().max(500).optional(),
});

const recordConsentSchema = z.object({
  action: z.literal('record-consent'),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(320).optional(),
  channel: z.string().max(50).optional(),
  consentType: z.string().max(100).optional(),
  source: z.string().max(200).optional(),
});

const revokeConsentSchema = z.object({
  action: z.literal('revoke-consent'),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(320).optional(),
  channel: z.string().max(50).optional(),
});

const createCallingRuleSchema = z.object({
  action: z.literal('create-calling-rule'),
  name: z.string().max(255).optional(),
  timezone: z.string().max(100).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  endHour: z.number().int().min(0).max(23).optional(),
  endMinute: z.number().int().min(0).max(59).optional(),
  weekendAllowed: z.boolean().optional(),
  holidayAllowed: z.boolean().optional(),
  maxAttemptsPerDay: z.number().int().min(1).max(100).optional(),
  maxAttemptsTotal: z.number().int().min(1).max(1000).optional(),
  retryIntervalMin: z.number().int().min(1).max(10080).optional(),
});

const complianceActionSchema = z.discriminatedUnion('action', [
  importDnclSchema,
  addDncSchema,
  recordConsentSchema,
  revokeConsentSchema,
  createCallingRuleSchema,
]);

export const POST = withAdminGuard(async (request) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400 });
  }

  const parsed = complianceActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError(
      parsed.error.errors[0]?.message || 'Invalid compliance data',
      'VALIDATION_ERROR',
      { status: 400 }
    );
  }

  const data = parsed.data;

  switch (data.action) {
    case 'import-dncl': {
      const result = await importDnclList(data.phoneNumbers, data.source);
      return apiSuccess(result, { request });
    }

    case 'add-dnc': {
      await addToInternalDnc(data.phone, data.reason);
      return apiSuccess({ phone: data.phone, status: 'added' }, { request });
    }

    case 'record-consent': {
      const id = await recordConsent({
        phone: data.phone,
        email: data.email,
        type: data.consentType || 'general',
        source: data.source || 'admin',
        channel: data.channel as 'PHONE' | 'EMAIL' | 'SMS' | 'ALL' | undefined,
      });
      return apiSuccess({ id }, { request, status: 201 });
    }

    case 'revoke-consent': {
      const { phone, email, channel } = data;
      const count = await revokeConsent({ phone, email }, channel as 'PHONE' | 'EMAIL' | 'SMS' | 'ALL' | undefined);
      return apiSuccess({ revoked: count }, { request });
    }

    case 'create-calling-rule': {
      const rule = await prisma.callingRule.create({
        data: {
          name: data.name || 'Default',
          timezone: data.timezone || 'America/Toronto',
          startHour: data.startHour ?? 9,
          endHour: data.endHour ?? 21,
          endMinute: data.endMinute ?? 30,
          weekendAllowed: data.weekendAllowed ?? false,
          holidayAllowed: data.holidayAllowed ?? false,
          maxAttemptsPerDay: data.maxAttemptsPerDay ?? 3,
          maxAttemptsTotal: data.maxAttemptsTotal ?? 10,
          retryIntervalMin: data.retryIntervalMin ?? 60,
        },
      });
      return apiSuccess(rule, { request, status: 201 });
    }

    default:
      return apiError('Unknown action', 'VALIDATION_ERROR', { status: 400 });
  }
}, { requiredPermission: 'crm.compliance.manage' });

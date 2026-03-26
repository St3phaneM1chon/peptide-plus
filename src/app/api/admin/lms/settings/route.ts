export const dynamic = 'force-dynamic';

/**
 * Admin LMS Settings API
 * GET   /api/admin/lms/settings — Get LMS settings for tenant
 * PATCH /api/admin/lms/settings — Update LMS settings
 *
 * No dedicated LmsSetting model exists in the schema. Settings are stored in
 * the Tenant.featuresFlags JSON field under the "lms" key. This keeps the
 * approach lightweight without requiring a schema migration.
 *
 * Shape of Tenant.featuresFlags.lms:
 * {
 *   enableSelfEnrollment: boolean,
 *   enableCertificates: boolean,
 *   enableGamification: boolean,
 *   enableAiTutor: boolean,
 *   enableLiveSessions: boolean,
 *   enablePeerReview: boolean,
 *   defaultPassingScore: number,     // 0-100
 *   requireSequentialProgress: boolean,
 *   maxEnrollmentsPerCourse: number | null,
 *   brandingLogoUrl: string | null,
 *   brandingPrimaryColor: string | null,
 *   customCss: string | null,
 * }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

// Default LMS settings — returned when no settings have been saved yet
const DEFAULT_LMS_SETTINGS = {
  enableSelfEnrollment: true,
  enableCertificates: true,
  enableGamification: true,
  enableAiTutor: false,
  enableLiveSessions: false,
  enablePeerReview: false,
  defaultPassingScore: 70,
  requireSequentialProgress: false,
  maxEnrollmentsPerCourse: null as number | null,
  brandingLogoUrl: null as string | null,
  brandingPrimaryColor: null as string | null,
  customCss: null as string | null,
};

const updateSettingsSchema = z.object({
  enableSelfEnrollment: z.boolean().optional(),
  enableCertificates: z.boolean().optional(),
  enableGamification: z.boolean().optional(),
  enableAiTutor: z.boolean().optional(),
  enableLiveSessions: z.boolean().optional(),
  enablePeerReview: z.boolean().optional(),
  defaultPassingScore: z.number().int().min(0).max(100).optional(),
  requireSequentialProgress: z.boolean().optional(),
  maxEnrollmentsPerCourse: z.number().int().min(1).nullable().optional(),
  brandingLogoUrl: z.string().url().nullable().optional(),
  brandingPrimaryColor: z.string().max(20).nullable().optional(),
  customCss: z.string().max(10000).nullable().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featuresFlags: true },
  });

  const flags = (tenant?.featuresFlags ?? {}) as Record<string, unknown>;
  const lmsSettings = {
    ...DEFAULT_LMS_SETTINGS,
    ...((flags.lms as Record<string, unknown>) ?? {}),
  };

  return apiSuccess(lmsSettings, { request });
});

export const PATCH = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  // Read existing flags
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { featuresFlags: true },
  });
  if (!tenant) {
    return apiError('Tenant not found', ErrorCode.NOT_FOUND, { request, status: 404 });
  }

  const existingFlags = (tenant.featuresFlags ?? {}) as Record<string, unknown>;
  const existingLms = (existingFlags.lms ?? {}) as Record<string, unknown>;

  // Merge new settings into existing
  const updatedLms = { ...DEFAULT_LMS_SETTINGS, ...existingLms, ...parsed.data };
  const updatedFlags = { ...existingFlags, lms: updatedLms };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { featuresFlags: updatedFlags },
  });

  return apiSuccess(updatedLms, { request });
});

// Admin pages send PUT for updates — alias to PATCH handler
export const PUT = PATCH;

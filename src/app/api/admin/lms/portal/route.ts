export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';

const portalSchema = z.object({
  subdomain: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, numbers, and hyphens only')
    .optional(),
  customDomain: z.string().max(253).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
  heroImageUrl: z.string().url().nullable().optional(),
  welcomeMessage: z.string().max(2000).nullable().optional(),
  footerText: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  ssoEnabled: z.boolean().optional(),
  ssoProvider: z.string().max(50).nullable().optional(),
  ssoConfig: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  // Additional UI-only fields stored in ssoConfig
  ssoProviderUrl: z.string().url().nullable().optional(),
  registrationOpen: z.boolean().optional(),
  catalogVisible: z.boolean().optional(),
  customCss: z.string().max(10000).nullable().optional(),
  portalName: z.string().max(200).nullable().optional(),
});

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;

  const portal = await prisma.tenantLmsPortal.findUnique({
    where: { tenantId },
  });

  if (!portal) {
    return apiSuccess(
      {
        portal: null,
        defaults: {
          primaryColor: '#0066CC',
          secondaryColor: '#003366',
          ssoEnabled: false,
          isActive: true,
        },
      },
      { request }
    );
  }

  // Extract UI fields from ssoConfig
  const ssoConfig = (portal.ssoConfig as Record<string, unknown>) ?? {};

  return apiSuccess(
    {
      portal: {
        ...portal,
        ssoProviderUrl: ssoConfig.providerUrl ?? null,
        registrationOpen: ssoConfig.registrationOpen ?? true,
        catalogVisible: ssoConfig.catalogVisible ?? true,
        customCss: ssoConfig.customCss ?? null,
        portalName: ssoConfig.portalName ?? null,
      },
    },
    { request }
  );
});

export const PUT = withAdminGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  const body = await request.json();

  const parsed = portalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '),
      ErrorCode.VALIDATION_ERROR,
      { request }
    );
  }

  const {
    ssoProviderUrl,
    registrationOpen,
    catalogVisible,
    customCss,
    portalName,
    ...dbFields
  } = parsed.data;

  // If subdomain is being changed, check uniqueness
  if (dbFields.subdomain) {
    const existing = await prisma.tenantLmsPortal.findFirst({
      where: {
        subdomain: dbFields.subdomain,
        NOT: { tenantId },
      },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        'This subdomain is already in use',
        ErrorCode.VALIDATION_ERROR,
        { request }
      );
    }
  }

  // Build ssoConfig with UI-only fields
  const existingPortal = await prisma.tenantLmsPortal.findUnique({
    where: { tenantId },
    select: { ssoConfig: true },
  });

  const existingConfig = (existingPortal?.ssoConfig as Record<string, unknown>) ?? {};
  const ssoConfig = {
    ...existingConfig,
    ...(ssoProviderUrl !== undefined && { providerUrl: ssoProviderUrl }),
    ...(registrationOpen !== undefined && { registrationOpen }),
    ...(catalogVisible !== undefined && { catalogVisible }),
    ...(customCss !== undefined && { customCss }),
    ...(portalName !== undefined && { portalName }),
  };

  const portal = await prisma.tenantLmsPortal.upsert({
    where: { tenantId },
    create: {
      tenantId,
      subdomain: dbFields.subdomain ?? tenantId.slice(0, 20).toLowerCase(),
      primaryColor: dbFields.primaryColor ?? '#0066CC',
      secondaryColor: dbFields.secondaryColor ?? '#003366',
      logoUrl: dbFields.logoUrl ?? null,
      faviconUrl: dbFields.faviconUrl ?? null,
      heroImageUrl: dbFields.heroImageUrl ?? null,
      customDomain: dbFields.customDomain ?? null,
      welcomeMessage: dbFields.welcomeMessage ?? null,
      footerText: dbFields.footerText ?? null,
      isActive: dbFields.isActive ?? true,
      ssoEnabled: dbFields.ssoEnabled ?? false,
      ssoProvider: dbFields.ssoProvider ?? null,
      ssoConfig,
      webhookUrl: dbFields.webhookUrl ?? null,
    },
    update: {
      ...(dbFields.subdomain !== undefined && { subdomain: dbFields.subdomain }),
      ...(dbFields.primaryColor !== undefined && { primaryColor: dbFields.primaryColor }),
      ...(dbFields.secondaryColor !== undefined && { secondaryColor: dbFields.secondaryColor }),
      ...(dbFields.logoUrl !== undefined && { logoUrl: dbFields.logoUrl }),
      ...(dbFields.faviconUrl !== undefined && { faviconUrl: dbFields.faviconUrl }),
      ...(dbFields.heroImageUrl !== undefined && { heroImageUrl: dbFields.heroImageUrl }),
      ...(dbFields.customDomain !== undefined && { customDomain: dbFields.customDomain }),
      ...(dbFields.welcomeMessage !== undefined && { welcomeMessage: dbFields.welcomeMessage }),
      ...(dbFields.footerText !== undefined && { footerText: dbFields.footerText }),
      ...(dbFields.isActive !== undefined && { isActive: dbFields.isActive }),
      ...(dbFields.ssoEnabled !== undefined && { ssoEnabled: dbFields.ssoEnabled }),
      ...(dbFields.ssoProvider !== undefined && { ssoProvider: dbFields.ssoProvider }),
      ...(dbFields.webhookUrl !== undefined && { webhookUrl: dbFields.webhookUrl }),
      ssoConfig,
    },
  });

  return apiSuccess({ portal }, { request });
});

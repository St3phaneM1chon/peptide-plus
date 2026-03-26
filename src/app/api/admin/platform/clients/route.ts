/**
 * API: /api/admin/platform/clients
 * Super-admin only — Full client management for Koraline SaaS.
 * GET: List all tenants with stats (users, products, orders, courses) + MRR
 * POST: Full client creation with all fields (company, contacts, address, fiscal, branding)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';
import { KORALINE_PLANS, KORALINE_MODULES, type KoralinePlan, type KoralineModule } from '@/lib/stripe-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSuperAdmin(session: { user: { role?: string; tenantId?: string } }): boolean {
  return session.user.role === 'OWNER' && session.user.tenantId === process.env.PLATFORM_TENANT_ID;
}

function generateRandomPassword(length = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const bytes = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

function computeMRR(plan: string, modulesEnabled: string[]): number {
  const planPrice = KORALINE_PLANS[plan as KoralinePlan]?.monthlyPrice || 0;
  const modulePrice = modulesEnabled.reduce((sum, key) => {
    return sum + (KORALINE_MODULES[key as KoralineModule]?.monthlyPrice || 0);
  }, 0);
  return planPrice + modulePrice;
}

// ---------------------------------------------------------------------------
// GET — List tenants with stats
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { session }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate counts per tenant
    const [userCounts, orderCounts, productCounts] = await Promise.all([
      prisma.user.groupBy({ by: ['tenantId'], _count: { id: true } }),
      prisma.order.groupBy({ by: ['tenantId'], _count: { id: true } }),
      prisma.product.groupBy({ by: ['tenantId'], _count: { id: true } }),
    ]);

    const userMap = new Map(userCounts.map(u => [u.tenantId, u._count.id]));
    const orderMap = new Map(orderCounts.map(o => [o.tenantId, o._count.id]));
    const productMap = new Map(productCounts.map(p => [p.tenantId, p._count.id]));

    const tenantsWithStats = tenants.map(tenant => {
      const modules = Array.isArray(tenant.modulesEnabled)
        ? (tenant.modulesEnabled as string[])
        : (() => { try { return JSON.parse(tenant.modulesEnabled as string) as string[]; } catch { return []; } })();

      return {
        ...tenant,
        stats: {
          users: userMap.get(tenant.id) || 0,
          orders: orderMap.get(tenant.id) || 0,
          products: productMap.get(tenant.id) || 0,
        },
        mrr: computeMRR(tenant.plan, modules),
      };
    });

    return NextResponse.json({ tenants: tenantsWithStats, total: tenants.length });
  } catch (error) {
    logger.error('Failed to list clients', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// POST — Create a new client (tenant + owner user)
// ---------------------------------------------------------------------------

const createClientSchema = z.object({
  // Company
  companyName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  shortDescription: z.string().max(200).optional(),
  longDescription: z.string().max(2000).optional(),
  industry: z.string().max(50).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),

  // Owner
  ownerName: z.string().min(1).max(200),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().max(30).optional(),
  ownerTitle: z.string().max(100).optional(),

  // Department contacts
  contactFinanceName: z.string().max(200).optional(),
  contactFinanceEmail: z.string().email().optional().or(z.literal('')),
  contactFinancePhone: z.string().max(30).optional(),
  contactSupportName: z.string().max(200).optional(),
  contactSupportEmail: z.string().email().optional().or(z.literal('')),
  contactSupportPhone: z.string().max(30).optional(),
  contactTechName: z.string().max(200).optional(),
  contactTechEmail: z.string().email().optional().or(z.literal('')),
  contactTechPhone: z.string().max(30).optional(),
  contactMarketingName: z.string().max(200).optional(),
  contactMarketingEmail: z.string().email().optional().or(z.literal('')),
  contactMarketingPhone: z.string().max(30).optional(),

  // Address
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).default('CA'),

  // Plan & Modules
  plan: z.enum(['essential', 'pro', 'enterprise']).default('essential'),
  modulesEnabled: z.array(z.string()).optional(),

  // Branding
  primaryColor: z.string().max(20).default('#0066CC'),
  secondaryColor: z.string().max(20).default('#003366'),
  font: z.string().max(50).default('Inter'),

  // Domain
  domainCustom: z.string().max(200).optional().or(z.literal('')),

  // Fiscal
  taxProvince: z.string().max(5).optional(),
  taxGstNumber: z.string().max(30).optional(),
  taxQstNumber: z.string().max(30).optional(),
  taxHstNumber: z.string().max(30).optional(),
  taxPstNumber: z.string().max(30).optional(),
});

export const POST = withAdminGuard(async (request, { session }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json({ error: `Le slug "${data.slug}" est deja utilise` }, { status: 409 });
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email: data.ownerEmail.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ error: `Un utilisateur avec l'email "${data.ownerEmail}" existe deja` }, { status: 409 });
    }

    // Generate password + reset token
    const temporaryPassword = generateRandomPassword(16);
    const hashedPassword = hashSync(temporaryPassword, 10);
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Resolve included modules from plan
    const planInfo = KORALINE_PLANS[data.plan];
    const baseModules = planInfo?.includedModules || ['commerce', 'catalogue', 'marketing', 'emails', 'comptabilite', 'systeme'];
    const allModules = [...new Set([...baseModules, ...(data.modulesEnabled || [])])];

    // Create tenant + owner in transaction
    const [tenant, ownerUser] = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          slug: data.slug,
          name: data.companyName,
          legalName: data.legalName || null,
          shortDescription: data.shortDescription || null,
          longDescription: data.longDescription || null,
          industry: data.industry || null,
          logoUrl: data.logoUrl || null,
          domainCustom: data.domainCustom || null,
          domainKoraline: `${data.slug}.koraline.app`,
          domainVerified: false,
          plan: data.plan,
          status: 'ACTIVE',
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
          font: data.font,
          modulesEnabled: JSON.stringify(allModules),
          featuresFlags: JSON.stringify({}),
          // Contacts
          contactFinanceName: data.contactFinanceName || null,
          contactFinanceEmail: data.contactFinanceEmail || null,
          contactFinancePhone: data.contactFinancePhone || null,
          contactSupportName: data.contactSupportName || null,
          contactSupportEmail: data.contactSupportEmail || null,
          contactSupportPhone: data.contactSupportPhone || null,
          contactTechName: data.contactTechName || null,
          contactTechEmail: data.contactTechEmail || null,
          contactTechPhone: data.contactTechPhone || null,
          contactMarketingName: data.contactMarketingName || null,
          contactMarketingEmail: data.contactMarketingEmail || null,
          contactMarketingPhone: data.contactMarketingPhone || null,
          // Address
          address: data.address || null,
          city: data.city || null,
          province: data.province || data.taxProvince || 'QC',
          postalCode: data.postalCode || null,
          country: data.country,
          // Fiscal
          taxProvince: data.taxProvince || 'QC',
          taxGstNumber: data.taxGstNumber || null,
          taxQstNumber: data.taxQstNumber || null,
          taxHstNumber: data.taxHstNumber || null,
          taxPstNumber: data.taxPstNumber || null,
        },
      });

      const newUser = await tx.user.create({
        data: {
          email: data.ownerEmail.toLowerCase().trim(),
          name: data.ownerName,
          role: 'OWNER',
          tenantId: newTenant.id,
          password: hashedPassword,
          locale: 'fr',
          resetToken,
          resetTokenExpiry,
        },
      });

      // Update tenant with owner reference
      await tx.tenant.update({
        where: { id: newTenant.id },
        data: { ownerUserId: newUser.id },
      });

      // Create tenant event
      await tx.tenantEvent.create({
        data: {
          tenantId: newTenant.id,
          type: 'CREATED',
          actor: session.user.email || 'super-admin',
          details: { plan: data.plan, modules: allModules, ownerEmail: data.ownerEmail },
        },
      });

      return [newTenant, newUser] as const;
    });

    logger.info('New client created', {
      tenantId: tenant.id,
      slug: tenant.slug,
      plan: data.plan,
      ownerEmail: ownerUser.email,
    });

    // Send welcome email (non-blocking)
    const baseUrl = process.env.NEXTAUTH_URL || `https://${data.slug}.koraline.app`;
    const resetPasswordUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

    sendEmail({
      to: { email: ownerUser.email, name: ownerUser.name || undefined },
      subject: 'Bienvenue sur Koraline — Votre compte est pret',
      html: `<p>Votre espace ${tenant.name} a ete cree. Connectez-vous sur ${data.slug}.koraline.app avec votre email et le mot de passe temporaire ci-dessous, puis changez-le immediatement.</p><p>Mot de passe: <code>${temporaryPassword}</code></p><p><a href="${resetPasswordUrl}">Definir mon mot de passe</a></p>`,
      emailType: 'transactional',
    }).catch((err) => {
      logger.error('Failed to send welcome email', { tenantId: tenant.id, error: err instanceof Error ? err.message : String(err) });
    });

    return NextResponse.json({ tenant, ownerId: ownerUser.id }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create client', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

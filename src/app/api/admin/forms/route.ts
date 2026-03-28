export const dynamic = 'force-dynamic';

/**
 * Admin Forms API — CRUD for FormDefinition
 * GET  — List all forms (with submission counts)
 * POST — Create a new form definition
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ── Helpers ──────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Field definition validation ──────────────────────────────────

const fieldDefinitionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'text', 'email', 'phone', 'number', 'textarea',
    'select', 'radio', 'checkbox', 'date', 'file',
    'hidden', 'rating',
  ]),
  label: z.string().min(1).max(200),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    patternMessage: z.string().optional(),
  }).optional(),
  options: z.array(z.object({
    label: z.string().min(1),
    value: z.string().min(1),
  })).optional(),
  defaultValue: z.string().optional(),
  helpText: z.string().max(500).optional(),
  width: z.enum(['full', 'half']).default('full'),
});

const formSettingsSchema = z.object({
  notifyEmails: z.array(z.string().email()).default([]),
  redirectUrl: z.string().url().optional().or(z.literal('')),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  successMessage: z.string().max(1000).optional(),
  recaptcha: z.boolean().default(false),
}).default({});

const createFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).nullish(),
  fields: z.array(fieldDefinitionSchema).min(1, 'At least one field is required'),
  settings: formSettingsSchema,
  isActive: z.boolean().default(true),
});

// ── GET /api/admin/forms ─────────────────────────────────────────

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const forms = await prisma.formDefinition.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        fields: true,
        settings: true,
        isActive: true,
        submitCount: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ forms });
  } catch (error) {
    logger.error('[Admin Forms GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
});

// ── POST /api/admin/forms ────────────────────────────────────────

export const POST = withAdminGuard(async (request, ctx) => {
  try {
    const body = await request.json();
    const data = createFormSchema.parse(body);

    // Generate slug
    let slug = slugify(data.name);
    const existing = await prisma.formDefinition.findFirst({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const session = ctx?.session;
    const form = await prisma.formDefinition.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        fields: data.fields as unknown as Prisma.InputJsonValue,
        settings: data.settings as unknown as Prisma.InputJsonValue,
        isActive: data.isActive,
        createdById: session?.user?.id ?? '',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        fields: true,
        settings: true,
        isActive: true,
        submitCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'CREATE_FORM',
        targetType: 'FormDefinition',
        targetId: form.id,
        newValue: { name: form.name, slug: form.slug, fieldCount: data.fields.length },
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Admin Forms POST]', { error });
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }
});

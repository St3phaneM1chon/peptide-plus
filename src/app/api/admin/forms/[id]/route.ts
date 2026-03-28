export const dynamic = 'force-dynamic';

/**
 * Admin Forms [id] API
 * GET    — Get a single form by ID (with full fields + settings)
 * PUT    — Update form definition
 * DELETE — Delete form (cascades to submissions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ── Field definition validation (same as parent route) ───────────

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

const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullish(),
  fields: z.array(fieldDefinitionSchema).min(1).optional(),
  settings: formSettingsSchema.optional(),
  isActive: z.boolean().optional(),
});

function extractId(ctx: unknown): string | null {
  // Next.js 15 dynamic route params
  if (ctx && typeof ctx === 'object' && 'params' in ctx) {
    const p = (ctx as Record<string, unknown>).params;
    // params may be a Promise (Next 15) or plain object
    if (p && typeof p === 'object' && 'id' in (p as Record<string, unknown>)) {
      return (p as Record<string, string>).id;
    }
  }
  return null;
}

// ── GET /api/admin/forms/[id] ────────────────────────────────────

export const GET = withAdminGuard(async (_request: NextRequest, ctx) => {
  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const id = params?.id || extractId(ctx);
    if (!id) {
      return NextResponse.json({ error: 'Form ID required' }, { status: 400 });
    }

    const form = await prisma.formDefinition.findUnique({
      where: { id },
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
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json({ form });
  } catch (error) {
    logger.error('[Admin Forms GET [id]]', { error });
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
});

// ── PUT /api/admin/forms/[id] ────────────────────────────────────

export const PUT = withAdminGuard(async (request: NextRequest, ctx) => {
  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const id = params?.id || extractId(ctx);
    if (!id) {
      return NextResponse.json({ error: 'Form ID required' }, { status: 400 });
    }

    const body = await request.json();
    const data = updateFormSchema.parse(body);

    const existing = await prisma.formDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.fields !== undefined) updateData.fields = data.fields as unknown as Prisma.InputJsonValue;
    if (data.settings !== undefined) updateData.settings = data.settings as unknown as Prisma.InputJsonValue;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const form = await prisma.formDefinition.update({
      where: { id },
      data: updateData,
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
    const session = ctx?.session;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_FORM',
        targetType: 'FormDefinition',
        targetId: form.id,
        previousValue: { name: existing.name, isActive: existing.isActive },
        newValue: { name: form.name, isActive: form.isActive },
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ form });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    logger.error('[Admin Forms PUT [id]]', { error });
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
});

// ── DELETE /api/admin/forms/[id] ─────────────────────────────────

export const DELETE = withAdminGuard(async (request: NextRequest, ctx) => {
  try {
    const params = ctx?.params ? (typeof ctx.params.then === 'function' ? await ctx.params : ctx.params) : {};
    const id = params?.id || extractId(ctx);
    if (!id) {
      return NextResponse.json({ error: 'Form ID required' }, { status: 400 });
    }

    const existing = await prisma.formDefinition.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    await prisma.formDefinition.delete({ where: { id } });

    // Audit
    const session = ctx?.session;
    if (session?.user?.id) {
      await logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_FORM',
        targetType: 'FormDefinition',
        targetId: id,
        previousValue: { name: existing.name, slug: existing.slug },
        ipAddress: getClientIpFromRequest(request),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Admin Forms DELETE [id]]', { error });
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
});

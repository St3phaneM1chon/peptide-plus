export const dynamic = 'force-dynamic';

/**
 * Public Form API
 * GET  — Get form definition by slug (public, no auth)
 * POST — Submit form data (public, rate-limited)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';

// ── Rate limiter key helper ──────────────────────────────────────

function getIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim());
    const last = ips[ips.length - 1];
    if (last) return last;
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

// ── Field validation ─────────────────────────────────────────────

interface FieldDef {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternMessage?: string;
  };
  options?: { label: string; value: string }[];
}

function validateSubmission(
  fields: FieldDef[],
  data: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (field.type === 'hidden') continue;
    const value = data[field.id];
    const strValue = typeof value === 'string' ? value.trim() : '';

    // Required check
    if (field.required && !strValue && field.type !== 'checkbox') {
      errors[field.id] = `${field.label} is required`;
      continue;
    }

    if (!strValue && field.type !== 'checkbox') continue; // optional and empty

    // Type-specific validation
    if (field.type === 'email' && strValue) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(strValue)) {
        errors[field.id] = 'Invalid email address';
      }
    }

    if (field.type === 'phone' && strValue) {
      const phoneRe = /^[+]?[\d\s()-]{7,20}$/;
      if (!phoneRe.test(strValue)) {
        errors[field.id] = 'Invalid phone number';
      }
    }

    if (field.type === 'number' && strValue) {
      const num = Number(strValue);
      if (isNaN(num)) {
        errors[field.id] = 'Must be a number';
      } else if (field.validation?.min !== undefined && num < field.validation.min) {
        errors[field.id] = `Minimum value is ${field.validation.min}`;
      } else if (field.validation?.max !== undefined && num > field.validation.max) {
        errors[field.id] = `Maximum value is ${field.validation.max}`;
      }
    }

    if (field.type === 'rating' && strValue) {
      const rating = Number(strValue);
      if (isNaN(rating) || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        errors[field.id] = 'Rating must be between 1 and 5';
      }
    }

    if ((field.type === 'select' || field.type === 'radio') && strValue && field.options) {
      const validValues = field.options.map(o => o.value);
      if (!validValues.includes(strValue)) {
        errors[field.id] = 'Invalid selection';
      }
    }

    // String length validation
    if (field.validation && strValue) {
      if (field.validation.minLength && strValue.length < field.validation.minLength) {
        errors[field.id] = `Minimum ${field.validation.minLength} characters`;
      }
      if (field.validation.maxLength && strValue.length > field.validation.maxLength) {
        errors[field.id] = `Maximum ${field.validation.maxLength} characters`;
      }
      if (field.validation.pattern) {
        try {
          const re = new RegExp(field.validation.pattern);
          if (!re.test(strValue)) {
            errors[field.id] = field.validation.patternMessage || 'Invalid format';
          }
        } catch {
          // ignore invalid regex
        }
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── GET /api/forms/[slug] ────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    const slug = params.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Slug required' }, { status: 400 });
    }

    const form = await prisma.formDefinition.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        fields: true,
        settings: true,
      },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Strip sensitive settings from public response
    const publicSettings = {
      successMessage: (form.settings as unknown as Record<string, unknown>)?.successMessage,
      redirectUrl: (form.settings as unknown as Record<string, unknown>)?.redirectUrl,
    };

    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        slug: form.slug,
        description: form.description,
        fields: form.fields,
        settings: publicSettings,
      },
    });
  } catch (error) {
    logger.error('[Public Form GET]', { error });
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
}

// ── POST /api/forms/[slug] ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limit: 10 submissions per minute per IP
    const ip = getIp(request);
    const rlResult = await checkRateLimit(ip, '/api/forms/submit').catch(() => null);
    if (rlResult && !rlResult.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const params = await context.params;
    const slug = params.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Slug required' }, { status: 400 });
    }

    const form = await prisma.formDefinition.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true,
        tenantId: true,
        fields: true,
        settings: true,
      },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
    }

    const body = await request.json();
    const submittedData = body.data;
    if (!submittedData || typeof submittedData !== 'object') {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    // Validate against field definitions
    const fieldDefs = (form.fields as unknown as FieldDef[]) || [];
    const { valid, errors } = validateSubmission(fieldDefs, submittedData);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', fieldErrors: errors }, { status: 400 });
    }

    // Sanitize: only keep data for known field IDs
    const fieldIds = new Set(fieldDefs.map(f => f.id));
    const cleanData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(submittedData)) {
      if (fieldIds.has(key)) {
        cleanData[key] = typeof val === 'string' ? val.trim() : val;
      }
    }

    // Create submission + increment counter in a transaction
    const userAgent = request.headers.get('user-agent') || undefined;

    const [submission] = await prisma.$transaction([
      prisma.formSubmission.create({
        data: {
          formId: form.id,
          tenantId: form.tenantId,
          data: cleanData as unknown as Prisma.InputJsonValue,
          ip: ip || undefined,
          userAgent,
        },
        select: { id: true, createdAt: true },
      }),
      prisma.formDefinition.update({
        where: { id: form.id },
        data: { submitCount: { increment: 1 } },
      }),
    ]);

    const settings = form.settings as unknown as Record<string, unknown>;
    const successMessage = (settings?.successMessage as string) || 'Thank you for your submission!';
    const redirectUrl = (settings?.redirectUrl as string) || undefined;

    // Auto-create CRM lead from form submission (fire-and-forget)
    if (form.tenantId) {
      const emailField = fieldDefs.find(f => f.type === 'email');
      const nameField = fieldDefs.find(f => f.type === 'text' && /name|nom/i.test(f.label || f.id));
      const phoneField = fieldDefs.find(f => f.type === 'phone' || (f.type === 'text' && /phone|tel/i.test(f.label || f.id)));
      const email = emailField ? (cleanData[emailField.id] as string) : undefined;
      const name = nameField ? (cleanData[nameField.id] as string) : undefined;

      if (email) {
        try {
          // Check for existing lead with same email (dedup)
          const existingLead = await prisma.crmLead.findFirst({
            where: { tenantId: form.tenantId, email },
            select: { id: true },
          });

          if (!existingLead) {
            await prisma.crmLead.create({
              data: {
                tenantId: form.tenantId,
                email,
                contactName: name || email.split('@')[0],
                phone: phoneField ? (cleanData[phoneField.id] as string) || null : null,
                source: 'WEB',
                status: 'NEW',
                tags: [`form:${slug}`],
                customFields: cleanData as unknown as Prisma.InputJsonValue,
              },
            });
          }

          // Dispatch cross-module event for workflow triggers
          const { dispatchModuleEvent } = await import('@/lib/events/cross-module-dispatcher');
          await dispatchModuleEvent({
            type: 'FORM_SUBMITTED',
            tenantId: form.tenantId,
            entityId: submission.id,
            data: { formSlug: slug, email, name },
          });
        } catch (crmError) {
          // Non-blocking: form submission succeeds even if CRM fails
          logger.warn('[Form→CRM] Lead creation failed', {
            formId: form.id,
            error: crmError instanceof Error ? crmError.message : String(crmError),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      message: successMessage,
      redirectUrl,
    }, { status: 201 });
  } catch (error) {
    logger.error('[Public Form POST]', { error });
    return NextResponse.json({ error: 'Failed to submit form' }, { status: 500 });
  }
}

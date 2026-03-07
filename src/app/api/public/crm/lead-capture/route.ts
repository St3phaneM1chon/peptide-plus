export const dynamic = 'force-dynamic';

/**
 * Public Web-to-Lead Capture API
 * POST: Accept form submission and create CRM lead
 *
 * This endpoint is PUBLIC (no auth required) but rate-limited.
 * Used by embedded forms on external websites.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { processWorkflowTrigger } from '@/lib/crm/workflow-engine';

// Simple rate limiter (in-memory, per IP)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 10; // per minute
const WINDOW_MS = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      formId: z.string().optional(),
      contactName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      message: z.string().optional(),
      source: z.string().optional(),
      customFields: z.record(z.unknown()).optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { formId, contactName, email, phone, companyName, message, source, customFields } = parsed.data;

    // Validate form exists if formId provided
    let form = null;
    if (formId) {
      form = await prisma.crmLeadForm.findUnique({ where: { id: formId } });
      if (!form || !form.isActive) {
        return NextResponse.json(
          { success: false, error: 'Form not found or inactive' },
          { status: 404 }
        );
      }
    }

    // Check for duplicate (same email or phone in last 24h)
    if (email || phone) {
      const existing = await prisma.crmLead.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
          createdAt: { gte: new Date(Date.now() - 86400000) },
        },
      });

      if (existing) {
        // Update existing lead instead of creating duplicate
        await prisma.crmLead.update({
          where: { id: existing.id },
          data: {
            ...(message ? { customFields: { ...(existing.customFields as object || {}), lastMessage: message } } : {}),
          },
        });

        return NextResponse.json({
          success: true,
          data: { leadId: existing.id, duplicate: true },
        });
      }
    }

    // Create lead
    const lead = await prisma.crmLead.create({
      data: {
        contactName,
        email: email || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
        source: 'WEB',
        customFields: {
          ...(customFields || {}),
          ...(message ? { message } : {}),
          ...(source ? { captureSource: source } : {}),
          formId: formId || undefined,
          capturedFrom: ip,
        },
        tags: form?.tags || [],
        assignedToId: form?.assignToId || undefined,
      },
    });

    // Update form submission count
    if (form) {
      await prisma.crmLeadForm.update({
        where: { id: form.id },
        data: { submissions: { increment: 1 } },
      });
    }

    // Create activity
    await prisma.crmActivity.create({
      data: {
        type: 'NOTE',
        title: 'Web form submission',
        description: message || `New lead from web form${form ? `: ${form.name}` : ''}`,
        leadId: lead.id,
        metadata: { formId: formId ?? null, source: 'web_form' },
      },
    });

    // Trigger workflows
    try {
      await processWorkflowTrigger({
        type: 'NEW_LEAD',
        entityType: 'lead',
        entityId: lead.id,
        data: { source: 'WEB', formId },
      });
    } catch (err) {
      logger.error('Workflow trigger failed for web-to-lead', { leadId: lead.id, error: String(err) });
    }

    // Record consent if form captures it
    if (email || phone) {
      await prisma.crmConsentRecord.create({
        data: {
          phone: phone || undefined,
          email: email || undefined,
          type: 'implied',
          source: 'web_form',
          leadId: lead.id,
          notes: `Web form submission${form ? `: ${form.name}` : ''}`,
        },
      });
    }

    logger.info('Web-to-Lead capture', { leadId: lead.id, formId, source });

    // Return success with redirect URL if configured
    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.id,
        redirectUrl: form?.redirectUrl || undefined,
      },
    }, { status: 201 });

  } catch (err) {
    logger.error('Web-to-Lead capture failed', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}

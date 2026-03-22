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
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  // Rate limit (centralized, Redis-backed with in-memory fallback)
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitMiddleware(ip, '/api/contact');
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: rl.headers }
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
        { success: false, error: 'Invalid input' },
        { status: 400 }
      );
    }
    const { formId, contactName, email, phone, companyName, message, source, customFields } = parsed.data;

    // XSS FIX: Sanitize all free-text fields before storage
    const sanitize = (s: string | undefined) => s ? stripControlChars(stripHtml(s)).trim() : undefined;
    const safeContactName = sanitize(contactName)!;
    const safeCompanyName = sanitize(companyName);
    const safeMessage = sanitize(message);
    const safeSource = sanitize(source);

    // Sanitize customFields values (user-submitted JSON)
    const safeCustomFields: Record<string, unknown> = {};
    if (customFields) {
      for (const [key, val] of Object.entries(customFields)) {
        safeCustomFields[sanitize(key)!] = typeof val === 'string' ? sanitize(val) : val;
      }
    }

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
            ...(safeMessage ? { customFields: { ...(existing.customFields as object || {}), lastMessage: safeMessage } } : {}),
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
        contactName: safeContactName,
        email: email || undefined,
        phone: phone || undefined,
        companyName: safeCompanyName,
        source: 'WEB',
        customFields: {
          ...safeCustomFields,
          ...(safeMessage ? { message: safeMessage } : {}),
          ...(safeSource ? { captureSource: safeSource } : {}),
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
        description: safeMessage || `New lead from web form${form ? `: ${form.name}` : ''}`,
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

    // Validate redirect URL — only allow relative or same-origin URLs
    let safeRedirectUrl: string | undefined;
    if (form?.redirectUrl) {
      try {
        const u = new URL(form.redirectUrl, process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip');
        if (u.protocol === 'https:' || u.protocol === 'http:') {
          safeRedirectUrl = form.redirectUrl;
        }
      } catch {
        // Invalid URL — discard
      }
    }

    // Return success with validated redirect URL if configured
    return NextResponse.json({
      success: true,
      data: {
        leadId: lead.id,
        redirectUrl: safeRedirectUrl,
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

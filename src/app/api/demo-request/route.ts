export const dynamic = 'force-dynamic';

/**
 * POST /api/demo-request — Create a CRM lead from demo request form
 *
 * FIX A10-P0-001: Wire demo page form to CRM lead creation.
 * Public endpoint (no auth required) with rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const demoRequestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  company: z.string().min(1).max(200),
  phone: z.string().max(30).optional().default(''),
  employees: z.string().max(20).optional().default(''),
  needs: z.string().max(50).optional().default(''),
  message: z.string().max(2000).optional().default(''),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit check (uses centralized rate limiter — 'contact' bucket: 3/hour)
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/contact');
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error!.message },
        { status: 429, headers: rl.headers }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = demoRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // XSS FIX: Sanitize all free-text fields before storage
    const safeFirstName = stripControlChars(stripHtml(data.firstName)).trim();
    const safeLastName = stripControlChars(stripHtml(data.lastName)).trim();
    const safeCompany = stripControlChars(stripHtml(data.company)).trim();
    const safeEmployees = stripControlChars(stripHtml(data.employees)).trim();
    const safeNeeds = stripControlChars(stripHtml(data.needs)).trim();
    const safeMessage = stripControlChars(stripHtml(data.message)).trim();

    // Create CRM Lead
    const lead = await prisma.crmLead.create({
      data: {
        contactName: `${safeFirstName} ${safeLastName}`,
        companyName: safeCompany,
        email: data.email,
        phone: data.phone || null,
        source: 'WEB',
        status: 'NEW',
        temperature: 'WARM',
        score: 30,
        tags: ['demo-request'],
        customFields: {
          employees: safeEmployees,
          needs: safeNeeds,
          message: safeMessage,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    logger.info('[demo-request] CRM lead created from demo form', {
      leadId: lead.id,
      email: data.email,
      company: data.company,
    });

    return NextResponse.json({
      success: true,
      message: 'Demande de démo enregistrée. Un membre de notre équipe vous contactera sous 24h.',
    });
  } catch (error) {
    logger.error('[demo-request] Failed to create demo request', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: 'Une erreur est survenue. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}

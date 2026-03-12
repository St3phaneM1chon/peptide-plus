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

// Rate limiting: max 5 demo requests per IP per hour
const rateLimit = new Map<string, { count: number; resetAt: number }>();

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
    // Rate limit check
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    const entry = rateLimit.get(ip);
    if (entry && entry.resetAt > now) {
      if (entry.count >= 5) {
        return NextResponse.json(
          { error: 'Trop de demandes. Veuillez réessayer plus tard.' },
          { status: 429 }
        );
      }
      entry.count++;
    } else {
      rateLimit.set(ip, { count: 1, resetAt: now + 3600_000 });
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

    // Create CRM Lead
    const lead = await prisma.crmLead.create({
      data: {
        contactName: `${data.firstName} ${data.lastName}`,
        companyName: data.company,
        email: data.email,
        phone: data.phone || null,
        source: 'WEB',
        status: 'NEW',
        temperature: 'WARM',
        score: 30,
        tags: ['demo-request'],
        customFields: {
          employees: data.employees,
          needs: data.needs,
          message: data.message,
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

export const dynamic = 'force-dynamic';
/**
 * API - QUICK REPLIES
 * Gestion des réponses rapides pré-configurées
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const quickReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  category: z.string().max(50).optional(),
  sortOrder: z.number().optional(),
});

// GET - Liste des réponses rapides
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (![UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const quickReplies = await prisma.quickReply.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    return NextResponse.json({ quickReplies });
  } catch (error) {
    logger.error('Error fetching quick replies', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Créer une réponse rapide
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting + CSRF
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/chat/quick-replies');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (![UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = quickReplySchema.parse(body);

    // FIX F-017/F-046: Sanitize quick reply content to prevent stored XSS
    const sanitizedTitle = stripControlChars(stripHtml(data.title)).trim();
    const sanitizedContent = stripControlChars(stripHtml(data.content)).trim();

    if (!sanitizedTitle || !sanitizedContent) {
      return NextResponse.json({ error: 'Title and content cannot be empty after sanitization' }, { status: 400 });
    }

    const quickReply = await prisma.quickReply.create({
      data: {
        title: sanitizedTitle,
        content: sanitizedContent,
        category: data.category,
        sortOrder: data.sortOrder || 0,
      },
    });

    return NextResponse.json({ quickReply }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    logger.error('Error creating quick reply', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

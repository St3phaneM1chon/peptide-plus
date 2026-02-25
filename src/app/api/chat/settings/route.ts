export const dynamic = 'force-dynamic';

// F088 FIX: widgetPosition validated via Zod z.enum(['bottom-right', 'bottom-left']) in chatSettingsSchema

/**
 * API Chat Settings
 * GET /api/chat/settings - Obtenir les paramètres
 * PUT /api/chat/settings - Mettre à jour les paramètres
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

// FIX F-016: Zod schema for chat settings validation
const chatSettingsSchema = z.object({
  isAdminOnline: z.boolean().optional(),
  adminLanguage: z.string().min(2).max(10).optional(),
  chatbotEnabled: z.boolean().optional(),
  chatbotGreeting: z.string().max(2000).nullable().optional(),
  chatbotPrompt: z.string().max(5000).nullable().optional(),
  notifyEmail: z.string().email().max(255).nullable().optional(),
  notifyOnNewChat: z.boolean().optional(),
  notifyOnEscalation: z.boolean().optional(),
  widgetColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional(),
  widgetPosition: z.enum(['bottom-right', 'bottom-left']).optional(),
}).strict(); // strict() rejects unknown fields

// GET - Obtenir les settings (public pour widget, complet pour admin)
export async function GET(_request: Request) {
  try {
    const session = await auth();
    const isAdmin = session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string);

    // F-031 FIX: Use Prisma select for non-admin response
    // Non-admin users get a query that only selects safe public fields at DB level,
    // preventing any sensitive data (chatbotPrompt, notifyEmail, etc.) from being fetched.
    if (!isAdmin) {
      let publicSettings = await db.chatSettings.findUnique({
        where: { id: 'default' },
        select: {
          isAdminOnline: true,
          chatbotEnabled: true,
          widgetColor: true,
          widgetPosition: true,
        },
      });

      if (!publicSettings) {
        // Create defaults then re-query with select
        await db.chatSettings.create({
          data: {
            id: 'default',
            isAdminOnline: false,
            adminLanguage: 'fr',
            chatbotEnabled: true,
            chatbotGreeting: null,
            notifyEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com',
            notifyOnNewChat: true,
            notifyOnEscalation: true,
            widgetColor: '#f97316',
            widgetPosition: 'bottom-right',
          },
        });
        publicSettings = {
          isAdminOnline: false,
          chatbotEnabled: true,
          widgetColor: '#f97316',
          widgetPosition: 'bottom-right',
        };
      }

      return NextResponse.json(publicSettings);
    }

    // Admin path: fetch all fields
    let settings = await db.chatSettings.findUnique({
      where: { id: 'default' },
    });

    // Créer les settings par défaut si inexistants
    if (!settings) {
      settings = await db.chatSettings.create({
        data: {
          id: 'default',
          isAdminOnline: false,
          adminLanguage: 'fr',
          chatbotEnabled: true,
          chatbotGreeting: null,
          notifyEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com',
          notifyOnNewChat: true,
          notifyOnEscalation: true,
          // F-053 FIX: Align default with Prisma schema (#f97316)
          widgetColor: '#f97316',
          widgetPosition: 'bottom-right',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Get settings error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Mettre à jour les settings (admin only)
export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Rate limiting + CSRF
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/chat/settings');
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

    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // FIX F-016: Validate input with Zod schema (rejects unknown fields via strict())
    const parsed = chatSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const {
      isAdminOnline,
      adminLanguage,
      chatbotEnabled,
      chatbotGreeting,
      chatbotPrompt,
      notifyEmail,
      notifyOnNewChat,
      notifyOnEscalation,
      widgetColor,
      widgetPosition,
    } = parsed.data;

    // FIX F-015: chatbotPrompt modification restricted to OWNER only
    if (chatbotPrompt !== undefined && session.user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only the owner can modify the chatbot prompt' },
        { status: 403 }
      );
    }

    // FIX F-017/F-046: Sanitize string fields before storage
    const sanitizedGreeting = chatbotGreeting !== undefined
      ? (chatbotGreeting ? stripControlChars(stripHtml(chatbotGreeting)).trim() || null : null)
      : undefined;
    const sanitizedPrompt = chatbotPrompt !== undefined
      ? (chatbotPrompt ? stripControlChars(stripHtml(chatbotPrompt)).trim() || null : null)
      : undefined;

    const settings = await db.chatSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(isAdminOnline !== undefined && { isAdminOnline }),
        ...(adminLanguage && { adminLanguage }),
        ...(chatbotEnabled !== undefined && { chatbotEnabled }),
        ...(sanitizedGreeting !== undefined && { chatbotGreeting: sanitizedGreeting }),
        ...(sanitizedPrompt !== undefined && { chatbotPrompt: sanitizedPrompt }),
        ...(notifyEmail !== undefined && { notifyEmail }),
        ...(notifyOnNewChat !== undefined && { notifyOnNewChat }),
        ...(notifyOnEscalation !== undefined && { notifyOnEscalation }),
        ...(widgetColor && { widgetColor }),
        ...(widgetPosition && { widgetPosition }),
      },
      create: {
        id: 'default',
        isAdminOnline: isAdminOnline ?? false,
        adminLanguage: adminLanguage || 'fr',
        chatbotEnabled: chatbotEnabled ?? true,
        chatbotGreeting: sanitizedGreeting ?? null,
        chatbotPrompt: sanitizedPrompt ?? null,
        notifyEmail,
        notifyOnNewChat: notifyOnNewChat ?? true,
        notifyOnEscalation: notifyOnEscalation ?? true,
        // F-053 FIX: Align default with Prisma schema (#f97316)
        widgetColor: widgetColor || '#f97316',
        widgetPosition: widgetPosition || 'bottom-right',
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Update settings error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

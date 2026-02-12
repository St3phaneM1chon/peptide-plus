/**
 * API Chat Settings
 * GET /api/chat/settings - Obtenir les paramètres
 * PUT /api/chat/settings - Mettre à jour les paramètres
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

// GET - Obtenir les settings (public pour widget, complet pour admin)
export async function GET(_request: Request) {
  try {
    const session = await auth();
    const isAdmin = session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string);

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
          widgetColor: '#CC5500',
          widgetPosition: 'bottom-right',
        },
      });
    }

    // Pour les non-admin, retourner seulement les infos publiques
    if (!isAdmin) {
      return NextResponse.json({
        isAdminOnline: settings.isAdminOnline,
        chatbotEnabled: settings.chatbotEnabled,
        widgetColor: settings.widgetColor,
        widgetPosition: settings.widgetPosition,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Mettre à jour les settings (admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
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
    } = body;

    const settings = await db.chatSettings.upsert({
      where: { id: 'default' },
      update: {
        ...(isAdminOnline !== undefined && { isAdminOnline }),
        ...(adminLanguage && { adminLanguage }),
        ...(chatbotEnabled !== undefined && { chatbotEnabled }),
        ...(chatbotGreeting !== undefined && { chatbotGreeting }),
        ...(chatbotPrompt !== undefined && { chatbotPrompt }),
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
        chatbotGreeting,
        chatbotPrompt,
        notifyEmail,
        notifyOnNewChat: notifyOnNewChat ?? true,
        notifyOnEscalation: notifyOnEscalation ?? true,
        widgetColor: widgetColor || '#CC5500',
        widgetPosition: widgetPosition || 'bottom-right',
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

/**
 * API Chat Messages
 * POST /api/chat/message - Envoyer un message
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { translateMessage, getChatbotResponse, detectLanguage } from '@/lib/chat/openai-chat';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // BE-SEC-14: Rate limit chat messages - 20 per user/visitor per hour (prevents OpenAI cost explosion)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const session = await auth();
    const rl = await rateLimitMiddleware(ip, '/api/chat/message', session?.user?.id);
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json();
    const { conversationId, content: rawContent, sender, visitorId } = body;

    if (!conversationId || !rawContent) {
      return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 });
    }

    // BE-SEC-03: Strip HTML from chat messages to prevent stored XSS
    // BE-SEC-05: Enforce max length on chat messages (5000 chars)
    const contentStr = String(rawContent);
    if (contentStr.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
    }
    const content = contentStr.replace(/<[^>]*>/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

    if (!content) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    // Vérifier autorisation (session already fetched above for rate limiting)
    const isAdmin = session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string);

    // Vérifier la conversation avec contrôle d'accès
    let conversation;

    if (isAdmin) {
      // Les admins peuvent accéder à toutes les conversations
      conversation = await db.chatConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
        },
      });
    } else if (sender === 'VISITOR' && visitorId) {
      // Les visiteurs ne peuvent accéder qu'à leur propre conversation via visitorId
      conversation = await db.chatConversation.findFirst({
        where: { id: conversationId, visitorId: visitorId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
        },
      });
    } else if (session?.user?.id) {
      // Utilisateur connecté : vérifier qu'il est propriétaire de la conversation
      conversation = await db.chatConversation.findFirst({
        where: { id: conversationId, userId: session.user.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 20,
          },
        },
      });
    } else {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (sender === 'ADMIN' && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtenir les settings
    const settings = await db.chatSettings.findUnique({
      where: { id: 'default' },
    });

    const adminLanguage = settings?.adminLanguage || 'fr';
    const visitorLanguage = conversation.visitorLanguage;

    let messageToSave: {
      content: string;
      contentOriginal?: string;
      language: string;
      translatedTo?: string;
    };

    let botResponse: {
      content: string;
      shouldEscalate: boolean;
    } | null = null;

    if (sender === 'VISITOR') {
      // Message du visiteur
      // Détecter la langue si pas déjà connue
      const detectedLang = await detectLanguage(content);
      
      // Mettre à jour la langue du visiteur si différente
      if (detectedLang !== conversation.visitorLanguage) {
        await db.chatConversation.update({
          where: { id: conversationId },
          data: { visitorLanguage: detectedLang },
        });
      }

      // Traduire pour l'admin (vers français)
      const translation = await translateMessage(content, adminLanguage, detectedLang);
      
      messageToSave = {
        content: translation.translatedText, // Version traduite pour l'admin
        contentOriginal: content, // Message original
        language: detectedLang,
        translatedTo: adminLanguage,
      };

      // Si admin absent et chatbot activé, générer réponse auto
      if (!settings?.isAdminOnline && settings?.chatbotEnabled !== false) {
        // Préparer l'historique pour le chatbot
        const history = conversation.messages.map(m => ({
          role: (m.sender === 'VISITOR' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.contentOriginal || m.content,
        }));

        const chatbotResult = await getChatbotResponse(content, history, detectedLang);
        
        botResponse = {
          content: chatbotResult.message,
          shouldEscalate: chatbotResult.shouldEscalate,
        };

        // Si escalade nécessaire, changer le statut
        if (chatbotResult.shouldEscalate) {
          await db.chatConversation.update({
            where: { id: conversationId },
            data: { status: 'WAITING_ADMIN' },
          });
        }
      }
    } else if (sender === 'ADMIN') {
      // Message de l'admin (en français)
      // Traduire vers la langue du visiteur
      const translation = await translateMessage(content, visitorLanguage, adminLanguage);
      
      messageToSave = {
        content: translation.translatedText, // Version traduite pour le visiteur
        contentOriginal: content, // Message original de l'admin
        language: adminLanguage,
        translatedTo: visitorLanguage,
      };
    } else {
      return NextResponse.json({ error: 'Invalid sender' }, { status: 400 });
    }

    // Sauvegarder le message
    const savedMessage = await db.chatMessage.create({
      data: {
        conversationId,
        content: messageToSave.content,
        contentOriginal: messageToSave.contentOriginal,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum type mismatch
        sender: sender as any,
        senderName: sender === 'ADMIN' ? (session?.user?.name || 'Support') : undefined,
        language: messageToSave.language,
        translatedTo: messageToSave.translatedTo,
        isFromBot: false,
      },
    });

    // Mettre à jour le timestamp de la conversation
    await db.chatConversation.update({
      where: { id: conversationId },
      data: { 
        lastMessageAt: new Date(),
        isOnline: sender === 'VISITOR' ? true : conversation.isOnline,
      },
    });

    // Si réponse du bot, la sauvegarder aussi
    let savedBotMessage = null;
    if (botResponse) {
      savedBotMessage = await db.chatMessage.create({
        data: {
          conversationId,
          content: botResponse.content,
          sender: 'BOT',
          senderName: 'BioCycle Assistant',
          language: conversation.visitorLanguage,
          isFromBot: true,
        },
      });

      // Mettre à jour timestamp
      await db.chatConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });
    }

    return NextResponse.json({
      message: savedMessage,
      botMessage: savedBotMessage,
      escalated: botResponse?.shouldEscalate || false,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

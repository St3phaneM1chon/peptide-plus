export const dynamic = 'force-dynamic';

// TODO: F-092 - Validate message language code against ISO 639-1 list before storing

/**
 * API Chat Messages
 * POST /api/chat/message - Envoyer un message
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { translateMessage, getChatbotResponse, detectLanguage } from '@/lib/chat/openai-chat';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

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

    // FIX F-004/F-017: CSRF protection on chat message
    // Note: For chat widget (visitors), CSRF may not always be present.
    // Rate limiting already protects against abuse from unauthenticated users.
    if (session?.user) {
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        // Authenticated users MUST provide valid CSRF
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { conversationId, content: rawContent, sender, visitorId } = body;

    // Image/file attachment fields
    // FIX F-068: Validate messageType against allowed enum
    const validMessageTypes = ['TEXT', 'IMAGE', 'FILE'];
    const rawMessageType = body.type || 'TEXT';
    const messageType = validMessageTypes.includes(rawMessageType) ? rawMessageType : 'TEXT';
    // FIX F-020: Validate attachmentUrl
    const rawAttachmentUrl = body.attachmentUrl || null;
    const attachmentUrl = rawAttachmentUrl && typeof rawAttachmentUrl === 'string' && (rawAttachmentUrl.startsWith('http://') || rawAttachmentUrl.startsWith('https://')) ? rawAttachmentUrl : null;
    const attachmentName = body.attachmentName || null;
    const attachmentSize = body.attachmentSize ? parseInt(String(body.attachmentSize)) : null;

    if (!conversationId || !rawContent) {
      return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 });
    }

    // BE-SEC-03: Strip HTML from chat messages to prevent stored XSS
    // BE-SEC-05: Enforce max length on chat messages (5000 chars)
    const contentStr = String(rawContent);
    if (contentStr.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
    }
    // FIX F-054: Use proper stripHtml from sanitize module instead of fragile regex
    const content = stripControlChars(stripHtml(contentStr)).trim();

    // FIX: F-071 - Clearer error when content is empty after sanitization
    if (!content) {
      return NextResponse.json({ error: 'Message content cannot be empty after removing HTML/formatting' }, { status: 400 });
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

    // FIX F-048: Prevent sending messages to closed conversations
    if (conversation.status === 'CLOSED' || conversation.status === 'ARCHIVED') {
      return NextResponse.json({ error: 'Conversation is closed' }, { status: 400 });
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
      // TODO: F-075 - Use atomic update to prevent race condition when concurrent messages detect different languages
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
        // FIX F-044: Use last 20 messages (not first 20) for bot context
        // Messages are loaded with orderBy asc, take 20, which gets first 20.
        // We need the LAST messages for relevant context. Reverse-sort, take 20, then reverse back.
        const recentMessages = [...conversation.messages].slice(-20);
        const history = recentMessages.map(m => ({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum type mismatch
        type: messageType as any,
        attachmentUrl,
        attachmentName,
        attachmentSize,
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
    // FIX: F-062 - Removed duplicate lastMessageAt update; the update above already covers this
    let savedBotMessage = null;
    if (botResponse) {
      savedBotMessage = await db.chatMessage.create({
        data: {
          conversationId,
          // FIX F-034: Sanitize bot response to prevent prompt injection XSS
          content: stripHtml(botResponse.content),
          sender: 'BOT',
          senderName: 'BioCycle Assistant',
          language: conversation.visitorLanguage,
          isFromBot: true,
        },
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

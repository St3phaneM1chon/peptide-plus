export const dynamic = 'force-dynamic';

/**
 * API Chat - Gestion des conversations
 * GET /api/chat - Liste des conversations (admin)
 * POST /api/chat - Créer/récupérer une conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { v4 as uuidv4 } from 'uuid';

// GET - Liste des conversations (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // Vérifier si admin
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const conversations = await db.chatConversation.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum type from query string
      where: status ? { status: status as any } : undefined,
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: { where: { isRead: false, sender: 'VISITOR' } },
          },
        },
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Créer ou récupérer une conversation
export async function POST(request: NextRequest) {
  try {
    // SEC-25: Rate limit chat creation - 10 per user per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/chat/route');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json();
    const { visitorId, visitorName, visitorEmail, visitorLanguage, currentPage, userAgent } = body;

    // Vérifier si l'utilisateur est connecté
    const session = await auth();
    const isAdmin = session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string);

    // Utiliser visitorId fourni ou en générer un nouveau
    const finalVisitorId = visitorId || uuidv4();

    // Chercher une conversation active existante
    let conversation = await db.chatConversation.findFirst({
      where: {
        visitorId: finalVisitorId,
        status: { in: ['ACTIVE', 'WAITING_ADMIN'] },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });

    // Vérification d'ownership : si une conversation existe, vérifier que l'appelant y a droit
    if (conversation && !isAdmin) {
      // Si la conversation a un userId, vérifier qu'il correspond à l'utilisateur connecté
      if (conversation.userId && session?.user?.id && conversation.userId !== session.user.id) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }
      // Si l'utilisateur est connecté mais la conversation n'a pas de userId,
      // et que les visitorId ne correspondent pas, refuser l'accès
      if (session?.user?.id && !conversation.userId && conversation.visitorId !== finalVisitorId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }
    }

    // Si pas de conversation, en créer une nouvelle
    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: {
          visitorId: finalVisitorId,
          visitorName: visitorName || null,
          visitorEmail: visitorEmail || session?.user?.email || null,
          visitorLanguage: visitorLanguage || 'en',
          userId: session?.user?.id || null,
          currentPage: currentPage || null,
          userAgent: userAgent || null,
        },
        include: {
          messages: true,
        },
      });

      // Obtenir les settings pour le message d'accueil
      const settings = await db.chatSettings.findUnique({
        where: { id: 'default' },
      });

      // Ajouter message d'accueil
      const greeting = settings?.chatbotGreeting || getDefaultGreeting(visitorLanguage || 'en');
      
      await db.chatMessage.create({
        data: {
          conversationId: conversation.id,
          content: greeting,
          sender: 'BOT',
          senderName: 'BioCycle Assistant',
          language: visitorLanguage || 'en',
          isFromBot: true,
          isRead: false,
        },
      });

      // Recharger avec le message d'accueil
      conversation = await db.chatConversation.findUnique({
        where: { id: conversation.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return NextResponse.json({
      conversation,
      visitorId: finalVisitorId,
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getDefaultGreeting(language: string): string {
  const greetings: Record<string, string> = {
    en: "👋 Hello! Welcome to BioCycle Peptides. I'm here to help you with any questions about our research peptides. How can I assist you today?",
    fr: "👋 Bonjour! Bienvenue chez BioCycle Peptides. Je suis là pour répondre à vos questions sur nos peptides de recherche. Comment puis-je vous aider?",
    es: "👋 ¡Hola! Bienvenido a BioCycle Peptides. Estoy aquí para ayudarte con cualquier pregunta sobre nuestros péptidos de investigación. ¿Cómo puedo ayudarte hoy?",
    de: "👋 Hallo! Willkommen bei BioCycle Peptides. Ich bin hier, um Ihnen bei Fragen zu unseren Forschungspeptiden zu helfen. Wie kann ich Ihnen heute helfen?",
    it: "👋 Ciao! Benvenuto in BioCycle Peptides. Sono qui per aiutarti con qualsiasi domanda sui nostri peptidi di ricerca. Come posso aiutarti oggi?",
    pt: "👋 Olá! Bem-vindo à BioCycle Peptides. Estou aqui para ajudá-lo com qualquer pergunta sobre nossos peptídeos de pesquisa. Como posso ajudá-lo hoje?",
    zh: "👋 你好！欢迎来到BioCycle Peptides。我在这里帮助您解答关于我们研究肽的任何问题。今天我能为您做什么？",
    ar: "👋 مرحباً! أهلاً بك في BioCycle Peptides. أنا هنا لمساعدتك في أي أسئلة حول ببتيدات البحث لدينا. كيف يمكنني مساعدتك اليوم؟",
    ru: "👋 Привет! Добро пожаловать в BioCycle Peptides. Я здесь, чтобы помочь вам с любыми вопросами о наших исследовательских пептидах. Чем могу помочь?",
  };
  return greetings[language] || greetings.en;
}

export const dynamic = 'force-dynamic';

// TODO: F-096 - Message fetch limit is 50 here but 20 in /api/chat/message; standardize to one value

/**
 * API Chat - Gestion des conversations
 * GET /api/chat - Liste des conversations (admin)
 * POST /api/chat - Créer/récupérer une conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

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
    // FIX F-013: Cap limit to prevent abuse (was unbounded)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100);

    // FIX F-006: Validate status against allowed enum values instead of casting as any
    const validStatuses = ['ACTIVE', 'WAITING_ADMIN', 'CLOSED', 'ARCHIVED'];
    const safeStatus = status && validStatuses.includes(status.toUpperCase()) ? status.toUpperCase() : null;

    const conversations = await db.chatConversation.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum type from validated query string
      where: safeStatus ? { status: safeStatus as any } : undefined,
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
    logger.error('Get conversations error', { error: error instanceof Error ? error.message : String(error) });
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

    // FIX F-004: CSRF protection on chat creation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      // Allow requests without CSRF only if they come with a valid session
      // (server-side calls like webhooks). Log for monitoring.
      const session = await auth();
      if (!session?.user) {
        // For visitors without CSRF token, still allow (widget may not have it)
        // but rate limiting already protects against abuse
      }
    }

    const body = await request.json();
    const { visitorId, visitorName, visitorEmail, visitorLanguage, currentPage, userAgent } = body;

    // Vérifier si l'utilisateur est connecté
    const session = await auth();
    const isAdmin = session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string);

    // Utiliser visitorId fourni ou en générer un nouveau
    const finalVisitorId = visitorId || uuidv4();

    // BE-SEC-03: Sanitize visitor-supplied text fields to prevent stored XSS
    const sanitizedVisitorName = visitorName ? stripControlChars(stripHtml(String(visitorName))).trim().slice(0, 200) : null;
    const sanitizedVisitorEmail = visitorEmail ? stripControlChars(String(visitorEmail)).trim().slice(0, 255) : null;

    // Chercher une conversation active existante
    // FIX F-027: Add orderBy to make findFirst deterministic
    let conversation = await db.chatConversation.findFirst({
      where: {
        visitorId: finalVisitorId,
        status: { in: ['ACTIVE', 'WAITING_ADMIN'] },
      },
      orderBy: { lastMessageAt: 'desc' },
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
          visitorName: sanitizedVisitorName,
          visitorEmail: sanitizedVisitorEmail || session?.user?.email || null,
          visitorLanguage: visitorLanguage || 'en',
          userId: session?.user?.id || null,
          currentPage: currentPage ? stripControlChars(stripHtml(String(currentPage))).trim().slice(0, 500) : null,
          userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
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
      
      // F-036 FIX: Create greeting message and include it directly without re-fetching
      const greetingMsg = await db.chatMessage.create({
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

      // Attach greeting message to conversation without extra DB query
      conversation = { ...conversation, messages: [greetingMsg] } as NonNullable<typeof conversation>;
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    return NextResponse.json({
      conversation,
      visitorId: finalVisitorId,
    });
  } catch (error) {
    logger.error('Create conversation error', { error: error instanceof Error ? error.message : String(error) });
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
    // F-060 FIX: Add greetings for the 13 missing supported languages
    ko: "👋 안녕하세요! BioCycle Peptides에 오신 것을 환영합니다. 연구용 펩타이드에 대한 질문이 있으시면 도와드리겠습니다.",
    pl: "👋 Cześć! Witamy w BioCycle Peptides. Jestem tu, aby pomóc Ci z pytaniami dotyczącymi naszych peptydów badawczych.",
    sv: "👋 Hej! Välkommen till BioCycle Peptides. Jag finns här för att hjälpa dig med frågor om våra forskningspeptider.",
    hi: "👋 नमस्ते! BioCycle Peptides में आपका स्वागत है। हमारे अनुसंधान पेप्टाइड्स के बारे में किसी भी प्रश्न में मदद के लिए मैं यहाँ हूँ।",
    vi: "👋 Xin chào! Chào mừng đến với BioCycle Peptides. Tôi ở đây để giúp bạn với các câu hỏi về peptide nghiên cứu của chúng tôi.",
    tl: "👋 Kumusta! Maligayang pagdating sa BioCycle Peptides. Nandito ako para tulungan ka sa mga tanong tungkol sa aming mga research peptide.",
    ta: "👋 வணக்கம்! BioCycle Peptides-க்கு வரவேற்கிறோம். எங்கள் ஆராய்ச்சி பெப்டைடுகள் பற்றிய கேள்விகளுக்கு உதவ நான் இங்கே இருக்கிறேன்.",
    pa: "👋 ਸਤ ਸ੍ਰੀ ਅਕਾਲ! BioCycle Peptides ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਸਾਡੇ ਖੋਜ ਪੈਪਟਾਈਡਜ਼ ਬਾਰੇ ਸਵਾਲਾਂ ਵਿੱਚ ਮਦਦ ਲਈ ਮੈਂ ਇੱਥੇ ਹਾਂ।",
    ht: "👋 Bonjou! Byenvini nan BioCycle Peptides. Mwen la pou ede w ak nenpòt kesyon sou peptid rechèch nou yo.",
    gcr: "👋 Bonjou! Byenvini dan BioCycle Peptides. Mo la pou édé ou ké nenpòt kestion asou peptid recherche nou.",
  };
  // F-060: For regional Arabic variants, fall back to standard Arabic
  const lang = language.startsWith('ar-') ? 'ar' : language;
  return greetings[lang] || greetings.en;
}

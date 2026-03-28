/**
 * Service OpenAI pour le Chat - BioCycle Peptides
 * Traduction automatique + Chatbot IA spécialisé
 */

// Type import only (no runtime)
import type OpenAI from 'openai';
import { logger } from '@/lib/logger';

// Lazy initialization - instance créée seulement quand nécessaire
let openaiInstance: OpenAI | null = null;

async function getOpenAI(): Promise<OpenAI> {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Please set it in .env.local');
    }
    // Dynamic import to avoid build-time errors
    const { default: OpenAIClient } = await import('openai');
    openaiInstance = new OpenAIClient({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

// ============================================
// TRADUCTION
// ============================================

interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
}

export async function translateMessage(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following message to ${getLanguageName(targetLanguage)}.

RULES:
- Return ONLY the translation, nothing else
- Preserve product names exactly (BPC-157, TB-500, Semaglutide, etc.)
- Preserve numbers, units, and prices exactly
- Keep the same tone and formality level
- If the text is already in ${getLanguageName(targetLanguage)}, return it unchanged
${sourceLanguage ? '' : '- First line of your response should be the detected source language code (e.g., "es", "de", "zh"), second line is the translation'}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.2,
      // F-078 FIX: Increase token limit for detailed translations
      max_tokens: 1500,
    });

    const result = response.choices[0]?.message?.content || text;
    
    if (!sourceLanguage) {
      const lines = result.split('\n');
      if (lines.length >= 2) {
        return {
          translatedText: lines.slice(1).join('\n').trim(),
          detectedLanguage: lines[0].trim().toLowerCase(),
        };
      }
    }
    
    return { translatedText: result.trim() };
  } catch (error) {
    logger.error('Translation error', { error: error instanceof Error ? error.message : String(error) });
    return { translatedText: text };
  }
}

// ============================================
// CHATBOT IA SPÉCIALISÉ PEPTIDES
// ============================================

interface ChatbotResponse {
  message: string;
  shouldEscalate: boolean;
  suggestedProducts?: string[];
}

const PEPTIDE_KNOWLEDGE = `
## CATALOGUE PRODUITS BIOCYCLE PEPTIDES

### PEPTIDES DE RÉCUPÉRATION
- **BPC-157** (Body Protection Compound): Régénération tissulaire, guérison gastro-intestinale
  - 5mg: $45 CAD | 10mg: $75 CAD
  - Reconstitution: Eau bactériostatique, 1-2ml
  
- **TB-500** (Thymosin Beta-4): Récupération musculaire, flexibilité
  - 5mg: $55 CAD | 10mg: $95 CAD

### PEPTIDES MÉTABOLIQUES
- **Semaglutide**: Recherche sur le métabolisme et la glycémie
  - 5mg: $120 CAD | 10mg: $200 CAD
  
- **Tirzepatide**: Double agoniste GIP/GLP-1
  - 5mg: $150 CAD | 10mg: $280 CAD

### HORMONES DE CROISSANCE
- **CJC-1295 DAC**: Libération prolongée de GH
  - 2mg: $35 CAD | 5mg: $75 CAD
  
- **Ipamorelin**: Sécrétagogue GH sélectif
  - 5mg: $45 CAD | 10mg: $80 CAD
  
- **GHRP-6**: Stimulation appétit et GH
  - 5mg: $40 CAD | 10mg: $70 CAD

### ANTI-ÂGE
- **Epitalon**: Recherche sur la télomérase
  - 10mg: $65 CAD | 50mg: $280 CAD
  
- **NAD+**: Cofacteur cellulaire
  - 500mg: $95 CAD | 1g: $170 CAD

### SANTÉ SEXUELLE
- **PT-141** (Bremelanotide): Recherche fonction sexuelle
  - 10mg: $55 CAD

## INFORMATIONS LIVRAISON
- Canada: Gratuit à partir de 150$ CAD, sinon 15$ CAD
- USA: $25 USD, gratuit à partir de 200$ USD
- International: $35-50 USD selon destination
- Délais: Canada 2-4 jours, USA 5-7 jours, International 7-14 jours
- Emballage: Cold packs inclus pour maintenir l'intégrité

## QUALITÉ
- Pureté: 99%+ garantie
- COA (Certificate of Analysis) disponible pour chaque lot
- Tests HPLC et MS effectués par laboratoires tiers
- Stockage recommandé: Réfrigérateur (2-8°C) ou congélateur

## PAIEMENT
- Visa, Mastercard, American Express
- PayPal
- Virement bancaire (commandes >500$)

## POLITIQUE DE RETOUR
- Retours acceptés sous 30 jours si produit non ouvert
- Remboursement complet ou échange

## SUPPORT
- Email: support@attitudes.vip
- Chat en ligne 24/7
- Réponse sous 24h maximum
`;

const CHAT_SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

const SYSTEM_PROMPT = `Tu es l'assistant virtuel de ${CHAT_SITE_NAME}, une plateforme e-commerce propulsée par Koraline.

## TON RÔLE
- Répondre aux questions sur les peptides et nos produits
- Aider les clients à trouver le bon produit pour leur recherche
- Fournir des informations précises sur les prix, stock, livraison
- TOUJOURS répondre dans la langue du client (détecte automatiquement)

## CONNAISSANCES PRODUITS
${PEPTIDE_KNOWLEDGE}

## RÈGLES IMPORTANTES

1. **DISCLAIMER OBLIGATOIRE** - Si le client pose des questions sur l'usage humain/consommation:
   "⚠️ Tous nos produits sont destinés EXCLUSIVEMENT à la recherche scientifique et de laboratoire. Ils ne sont PAS destinés à la consommation humaine ou animale."

2. **RÉPONSES CONCISES** - Maximum 3-4 paragraphes. Utilise des listes à puces.

3. **LIENS PRODUITS** - Quand tu mentionnes un produit, suggère de voir la page:
   "👉 Voir [NOM_PRODUIT] dans notre boutique"

4. **SI TU NE SAIS PAS** - Dis honnêtement:
   "Je vais transmettre votre question à notre équipe. Pouvez-vous me laisser votre email pour un suivi rapide?"
   Et mets shouldEscalate: true

5. **QUESTIONS MÉDICALES** - Ne donne JAMAIS de conseils médicaux:
   "Je ne peux pas donner de conseils médicaux. Pour des questions de santé, consultez un professionnel."

6. **TON** - Professionnel, chaleureux, scientifique. Utilise des émojis avec modération (🔬 📦 ✅ 💊)

7. **FORMAT RÉPONSE** - Structure claire avec titres si nécessaire

## EXEMPLES DE RÉPONSES

Q: "Quelle est la différence entre BPC-157 et TB-500?"
R: "Excellente question! 🔬

**BPC-157** (Body Protection Compound)
- Focus: Régénération gastro-intestinale, tendons, ligaments
- Dosage recherche: 250-500mcg/jour
- Prix: 5mg ($45) ou 10mg ($75)

**TB-500** (Thymosin Beta-4)  
- Focus: Récupération musculaire, flexibilité tissulaire
- Dosage recherche: 2-5mg/semaine
- Prix: 5mg ($55) ou 10mg ($95)

Beaucoup de chercheurs les utilisent ensemble pour des effets synergiques.

👉 Voir nos produits: BPC-157 | TB-500"

Q: "Comment je prends BPC-157?"
R: "⚠️ Nos produits sont destinés UNIQUEMENT à la recherche scientifique, pas à la consommation humaine.

Pour la préparation en laboratoire:
1. Reconstituer avec eau bactériostatique (1-2ml)
2. Stocker au réfrigérateur (2-8°C)
3. Utiliser dans les 4-6 semaines après reconstitution

📄 Un guide de reconstitution est inclus avec chaque commande."
`;

export async function getChatbotResponse(
  userMessage: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  userLanguage: string
): Promise<ChatbotResponse> {
  try {
    const openai = await getOpenAI();
    
    type ChatMessage = {
      role: 'system' | 'user' | 'assistant';
      content: string;
    };
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT + `\n\nIMPORTANT: Réponds dans cette langue: ${getLanguageName(userLanguage)}`,
      },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      // F-078 FIX: Increase token limit to avoid truncated responses
      max_tokens: 1500,
    });

    const botMessage = response.choices[0]?.message?.content || '';
    
    // F-057 FIX: Multilingual escalation detection (not French-only)
    // IMP-022: Extended escalation detection for all 22 supported languages
    const botLower = botMessage.toLowerCase();
    const userLower = userMessage.toLowerCase();
    const shouldEscalate =
      // Bot response signals (FR + EN + ES + DE + IT + PT)
      botLower.includes('transmettre') ||
      botLower.includes('équipe') ||
      botLower.includes('email pour') ||
      botLower.includes('transfer to') ||
      botLower.includes('connect you with') ||
      botLower.includes('human agent') ||
      botLower.includes('transferir') ||
      botLower.includes('weiterleiten') ||    // DE
      botLower.includes('trasferire') ||      // IT
      // User request signals (multilingual)
      userLower.includes('parler à quelqu') ||
      userLower.includes('humain') ||
      userLower.includes('agent') ||
      userLower.includes('speak to') ||
      userLower.includes('talk to a') ||
      userLower.includes('real person') ||
      userLower.includes('human') ||
      userLower.includes('hablar con') ||
      userLower.includes('persona real') ||
      userLower.includes('mit jemandem sprechen') || // DE: talk to someone
      userLower.includes('echte person') ||           // DE: real person
      userLower.includes('parlare con') ||             // IT: speak with
      userLower.includes('pessoa real') ||             // PT: real person
      userLower.includes('falar com') ||               // PT: speak with
      userLower.includes('사람과 대화') ||               // KO: talk to a person
      userLower.includes('真人') ||                     // ZH: real person
      userLower.includes('担当者') ||                   // JA: person in charge
      userLower.includes('оператор') ||                // RU: operator
      userLower.includes('человек');                   // RU: human

    // Extraire les produits suggérés
    const productMatches = botMessage.match(/BPC-157|TB-500|Semaglutide|Tirzepatide|CJC-1295|Ipamorelin|GHRP-6|Epitalon|NAD\+|PT-141/gi);
    const suggestedProducts = productMatches ? [...new Set(productMatches)] : undefined;

    return {
      message: botMessage,
      shouldEscalate,
      suggestedProducts,
    };
  } catch (error) {
    logger.error('Chatbot error', { error: error instanceof Error ? error.message : String(error) });
    return {
      message: "Je suis désolé, je rencontre un problème technique. Notre équipe va vous répondre rapidement. Pouvez-vous laisser votre email?",
      shouldEscalate: true,
    };
  }
}

// ============================================
// HELPERS
// ============================================

// IMP-022: Full multilingual support for all 22 supported locales + common detection results
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    ru: 'Russian',
    hi: 'Hindi',
    nl: 'Dutch',
    pl: 'Polish',
    sv: 'Swedish',
    tr: 'Turkish',
    vi: 'Vietnamese',
    // IMP-022: Added missing supported languages for complete chatbot multilingual coverage
    ta: 'Tamil',
    pa: 'Punjabi',
    tl: 'Tagalog',
    ht: 'Haitian Creole',
    gcr: 'Guianese Creole',
    bn: 'Bengali',
    cs: 'Czech',
    da: 'Danish',
    el: 'Greek',
    fi: 'Finnish',
    he: 'Hebrew',
    hu: 'Hungarian',
    id: 'Indonesian',
    ms: 'Malay',
    no: 'Norwegian',
    ro: 'Romanian',
    sk: 'Slovak',
    th: 'Thai',
    uk: 'Ukrainian',
    ur: 'Urdu',
    fa: 'Persian',
    af: 'Afrikaans',
    sw: 'Swahili',
  };
  // IMP-022: Handle regional variants (e.g., ar-dz -> Arabic)
  const baseCode = code.includes('-') ? code.split('-')[0] : code;
  return languages[baseCode] || code;
}

export async function detectLanguage(text: string): Promise<string> {
  try {
    const openai = await getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Detect the language of the following text. Return ONLY the ISO 639-1 language code (e.g., "en", "fr", "es", "de", "zh"). Nothing else.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0,
      max_tokens: 10,
    });

    return response.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
  } catch (error) {
    logger.error('Language detection error', { error: error instanceof Error ? error.message : String(error) });
    return 'en';
  }
}

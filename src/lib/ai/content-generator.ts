/**
 * AI Content Generator — Koraline Page Builder
 *
 * Generates professional page copy: hero headlines, feature descriptions,
 * about page content, CTA text, and FAQ entries.
 *
 * Uses the same lazy-init AI layer as copilot-service.ts:
 *   Claude (preferred) → OpenAI (fallback) → static template strings.
 *
 * KB-PP-BUILD-002: All SDK access through lazy init factories.
 */

// ---------------------------------------------------------------------------
// Lazy AI SDK setup (same pattern as design-suggestions.ts)
// ---------------------------------------------------------------------------

type AnthropicClient = import('@anthropic-ai/sdk').default;
type OpenAIClient = import('openai').default;

let _anthropic: AnthropicClient | null = null;
let _openai: OpenAIClient | null = null;

function usesClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function getAnthropic(): Promise<AnthropicClient> {
  if (_anthropic) return _anthropic;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function getOpenAI(): Promise<OpenAIClient> {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
  }
  const { default: OpenAISDK } = await import('openai');
  _openai = new OpenAISDK({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const CLAUDE_FAST = 'claude-haiku-4-5-20251001';
const GPT_FAST = 'gpt-4o-mini';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function aiComplete(messages: ChatMessage[], maxTokens = 1000): Promise<string> {
  if (usesClaude()) {
    const anthropic = await getAnthropic();
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const nonSystem = messages.filter(m => m.role !== 'system');
    const res = await anthropic.messages.create({
      model: CLAUDE_FAST,
      max_tokens: maxTokens,
      temperature: 0.5,
      system: systemMsg,
      messages: nonSystem.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });
    const block = res.content[0];
    return (block && 'text' in block ? block.text : '') || '';
  }
  const openai = await getOpenAI();
  const completion = await openai.chat.completions.create({
    model: GPT_FAST,
    messages,
    temperature: 0.5,
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content || '';
}

function hasAiKey(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ContentTone = 'professional' | 'friendly' | 'bold' | 'minimal' | 'luxury';
export type ContentLength = 'short' | 'medium' | 'long';

export interface HeroContent {
  headline: string;
  subtitle: string;
  ctaLabel: string;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface GeneratedContent {
  hero?: HeroContent;
  features?: FeatureItem[];
  about?: string;
  cta?: { headline: string; subtitle: string; buttonLabel: string };
  faq?: FaqItem[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const CONTENT_SYSTEM = `You are a professional copywriter for a website builder platform.
You write conversion-optimized web copy that is clear, persuasive, and tailored to the business.

RULES:
- Return valid JSON only — no markdown fences, no explanation
- Never use placeholder text like "Lorem ipsum" or "[Your Brand]"
- Use the provided topic/business name in copy naturally
- Match the requested tone precisely
- Be specific and vivid — avoid generic fluff
- Use power words that drive action
- Keep headlines under 12 words
- Keep CTA labels under 5 words`;

// ---------------------------------------------------------------------------
// Public API — generatePageContent
// ---------------------------------------------------------------------------

/**
 * Generate page content using AI (with rule-based fallback).
 */
export async function generatePageContent(
  topic: string,
  tone: ContentTone = 'professional',
  length: ContentLength = 'medium',
  sections: string[] = ['hero', 'features', 'cta'],
): Promise<GeneratedContent> {
  if (!hasAiKey()) {
    return buildFallbackContent(topic, tone, sections);
  }

  try {
    const prompt = buildContentPrompt(topic, tone, length, sections);
    const raw = await aiComplete([
      { role: 'system', content: CONTENT_SYSTEM },
      { role: 'user', content: prompt },
    ], 1500);

    return parseContentResponse(raw, topic, tone, sections);
  } catch {
    return buildFallbackContent(topic, tone, sections);
  }
}

/**
 * Improve existing text — rewrite for clarity, impact, and tone.
 */
export async function improveText(
  text: string,
  instruction: string = 'Make it more engaging and professional',
  tone: ContentTone = 'professional',
): Promise<string> {
  if (!hasAiKey()) {
    // Can't improve without AI — return original
    return text;
  }

  try {
    const result = await aiComplete([
      {
        role: 'system',
        content: `You are a professional copywriter. Rewrite the given text according to the instruction.
Tone: ${tone}. Return ONLY the improved text — no quotes, no explanation, no labels.`,
      },
      {
        role: 'user',
        content: `Text to improve:\n"${text}"\n\nInstruction: ${instruction}`,
      },
    ], 500);

    return result.trim() || text;
  } catch {
    return text;
  }
}

/**
 * Generate a single section's content.
 */
export async function generateSectionContent(
  sectionType: string,
  topic: string,
  tone: ContentTone = 'professional',
): Promise<Record<string, unknown>> {
  if (!hasAiKey()) {
    return getFallbackSection(sectionType, topic);
  }

  try {
    const raw = await aiComplete([
      { role: 'system', content: CONTENT_SYSTEM },
      {
        role: 'user',
        content: `Generate content for a "${sectionType}" section about "${topic}".
Tone: ${tone}.

Return a JSON object with the appropriate fields for this section type.
Section types and their fields:
- hero: { "headline": "...", "subtitle": "...", "ctaLabel": "..." }
- features: { "title": "...", "items": [{ "icon": "emoji", "title": "...", "description": "..." }] } (3-6 items)
- cta: { "title": "...", "subtitle": "...", "ctaLabel": "..." }
- faq_accordion: { "title": "...", "items": [{ "question": "...", "answer": "..." }] } (5-8 items)
- testimonials: { "title": "..." }
- stats: { "items": [{ "value": "...", "label": "..." }] } (3-5 items)
- text_image: { "title": "...", "content": "HTML paragraph text" }
- newsletter: { "title": "...", "subtitle": "..." }
- team: { "title": "..." }
- pricing_table: { "title": "...", "plans": [{ "name": "...", "price": "...", "features": ["..."] }] } (2-3 plans)

Return only the JSON for the "${sectionType}" section.`,
      },
    ], 1000);

    const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    // Inject the type field
    return { type: sectionType, ...parsed };
  } catch {
    return getFallbackSection(sectionType, topic);
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildContentPrompt(
  topic: string,
  tone: ContentTone,
  length: ContentLength,
  sections: string[],
): string {
  const lengthGuide = {
    short: 'Keep all text very concise — single sentences where possible.',
    medium: 'Use moderate length — 1-2 sentences per element.',
    long: 'Use rich, detailed descriptions — 2-3 sentences per element.',
  };

  const sectionSpecs = sections.map(s => {
    switch (s) {
      case 'hero':
        return '"hero": { "headline": "...", "subtitle": "...", "ctaLabel": "..." }';
      case 'features':
        return '"features": [{ "icon": "emoji", "title": "...", "description": "..." }] (4-6 items)';
      case 'about':
        return '"about": "2-3 paragraph about text as a single string"';
      case 'cta':
        return '"cta": { "headline": "...", "subtitle": "...", "buttonLabel": "..." }';
      case 'faq':
        return '"faq": [{ "question": "...", "answer": "..." }] (5-8 items)';
      default:
        return `"${s}": { "title": "...", "description": "..." }`;
    }
  });

  return `Generate website content for: "${topic}"
Tone: ${tone}
${lengthGuide[length]}

Return a JSON object with these sections:
{
  ${sectionSpecs.join(',\n  ')}
}`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseContentResponse(
  raw: string,
  topic: string,
  tone: ContentTone,
  sections: string[],
): GeneratedContent {
  try {
    const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const result: GeneratedContent = {};

    if (sections.includes('hero') && parsed.hero) {
      result.hero = {
        headline: parsed.hero.headline || '',
        subtitle: parsed.hero.subtitle || '',
        ctaLabel: parsed.hero.ctaLabel || 'Get Started',
      };
    }

    if (sections.includes('features') && Array.isArray(parsed.features)) {
      result.features = parsed.features.map((f: Record<string, string>) => ({
        icon: f.icon || '✨',
        title: f.title || '',
        description: f.description || '',
      }));
    }

    if (sections.includes('about') && parsed.about) {
      result.about = String(parsed.about);
    }

    if (sections.includes('cta') && parsed.cta) {
      result.cta = {
        headline: parsed.cta.headline || '',
        subtitle: parsed.cta.subtitle || '',
        buttonLabel: parsed.cta.buttonLabel || 'Get Started',
      };
    }

    if (sections.includes('faq') && Array.isArray(parsed.faq)) {
      result.faq = parsed.faq.map((f: Record<string, string>) => ({
        question: f.question || '',
        answer: f.answer || '',
      }));
    }

    return result;
  } catch {
    return buildFallbackContent(topic, tone, sections);
  }
}

// ---------------------------------------------------------------------------
// Fallback content (no AI needed)
// ---------------------------------------------------------------------------

const TONE_ADJECTIVES: Record<ContentTone, string[]> = {
  professional: ['Trusted', 'Reliable', 'Expert'],
  friendly: ['Welcome', 'Discover', 'Easy'],
  bold: ['Powerful', 'Revolutionary', 'Unstoppable'],
  minimal: ['Simple', 'Clean', 'Essential'],
  luxury: ['Exquisite', 'Premium', 'Refined'],
};

function buildFallbackContent(
  topic: string,
  tone: ContentTone,
  sections: string[],
): GeneratedContent {
  const adj = TONE_ADJECTIVES[tone] || TONE_ADJECTIVES.professional;
  const result: GeneratedContent = {};

  if (sections.includes('hero')) {
    result.hero = {
      headline: `${adj[0]} ${topic} Solutions`,
      subtitle: `Discover what makes our ${topic.toLowerCase()} services stand out. Quality, expertise, and dedication to your success.`,
      ctaLabel: 'Get Started',
    };
  }

  if (sections.includes('features')) {
    result.features = [
      { icon: '🎯', title: `${adj[1]} Approach`, description: `Our ${topic.toLowerCase()} methodology is designed for real results.` },
      { icon: '⚡', title: 'Fast & Efficient', description: 'Streamlined processes that save you time and deliver quickly.' },
      { icon: '🛡️', title: `${adj[0]} Quality`, description: 'Every detail is carefully crafted to meet the highest standards.' },
      { icon: '🤝', title: 'Dedicated Support', description: 'Our team is here to help you every step of the way.' },
    ];
  }

  if (sections.includes('about')) {
    result.about = `We are passionate about ${topic.toLowerCase()}. With years of experience and a commitment to excellence, we deliver solutions that make a real difference. Our team combines expertise with genuine care for every client we serve.\n\nWhether you are just starting out or looking to take the next step, we have the knowledge and resources to help you succeed.`;
  }

  if (sections.includes('cta')) {
    result.cta = {
      headline: `Ready to Get Started with ${topic}?`,
      subtitle: 'Take the first step today. No commitment required.',
      buttonLabel: 'Start Now',
    };
  }

  if (sections.includes('faq')) {
    result.faq = [
      { question: `What is ${topic}?`, answer: `${topic} is our core offering designed to help you achieve your goals efficiently and professionally.` },
      { question: 'How do I get started?', answer: 'Simply click the "Get Started" button or contact our team. We\'ll guide you through every step.' },
      { question: 'What makes you different?', answer: `Our ${adj[0].toLowerCase()} approach, combined with dedicated support and proven results, sets us apart.` },
      { question: 'Do you offer a free trial?', answer: 'Yes! We offer a risk-free trial so you can experience the quality of our service firsthand.' },
      { question: 'How can I contact support?', answer: 'Our support team is available via the contact form, email, or phone during business hours.' },
    ];
  }

  return result;
}

function getFallbackSection(sectionType: string, topic: string): Record<string, unknown> {
  switch (sectionType) {
    case 'hero':
      return {
        type: 'hero',
        title: `Welcome to ${topic}`,
        subtitle: 'Discover what we can do for you.',
        ctaLabel: 'Learn More',
        ctaHref: '/',
      };
    case 'features':
      return {
        type: 'features',
        title: 'Our Strengths',
        items: [
          { icon: '🎯', title: 'Precision', description: `Expert ${topic.toLowerCase()} tailored to your needs.` },
          { icon: '⚡', title: 'Speed', description: 'Fast delivery without compromising quality.' },
          { icon: '🛡️', title: 'Reliability', description: 'Consistent results you can depend on.' },
        ],
      };
    case 'cta':
      return {
        type: 'cta',
        title: `Ready to Start with ${topic}?`,
        subtitle: 'Take the first step today.',
        ctaLabel: 'Get Started',
        ctaHref: '/',
      };
    case 'faq_accordion':
      return {
        type: 'faq_accordion',
        title: 'Frequently Asked Questions',
        items: [
          { question: `What is ${topic}?`, answer: `${topic} is our core service designed to help you succeed.` },
          { question: 'How do I get started?', answer: 'Contact us or click Get Started above.' },
        ],
      };
    case 'stats':
      return {
        type: 'stats',
        items: [
          { value: '500+', label: 'Happy Clients' },
          { value: '10K+', label: 'Projects Delivered' },
          { value: '99%', label: 'Satisfaction Rate' },
        ],
      };
    case 'testimonials':
      return { type: 'testimonials', title: 'What Our Clients Say' };
    case 'newsletter':
      return { type: 'newsletter', title: 'Stay Updated', subtitle: `Get the latest ${topic.toLowerCase()} news and updates.` };
    case 'text_image':
      return { type: 'text_image', title: `About ${topic}`, content: `<p>Learn more about our ${topic.toLowerCase()} services and how we can help you achieve your goals.</p>`, imageUrl: '', layout: 'image_right' };
    case 'team':
      return { type: 'team', title: 'Meet the Team', members: [] };
    case 'pricing_table':
      return {
        type: 'pricing_table',
        title: 'Our Plans',
        plans: [
          { name: 'Starter', price: '$29/mo', features: ['Basic features', 'Email support'] },
          { name: 'Professional', price: '$79/mo', features: ['All features', 'Priority support', 'Analytics'] },
          { name: 'Enterprise', price: 'Custom', features: ['Everything', 'Dedicated manager', 'SLA'] },
        ],
      };
    default:
      return { type: sectionType, title: topic };
  }
}

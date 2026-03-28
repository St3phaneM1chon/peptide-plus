/**
 * AI Design Suggestions Service — Koraline Page Builder
 *
 * Generates industry-aware design recommendations: color palettes,
 * section layout order, content hints, and font pairings.
 *
 * Uses the same lazy-init AI layer as copilot-service.ts:
 *   Claude (preferred) → OpenAI (fallback) → rule-based static templates.
 *
 * KB-PP-BUILD-002: All SDK access through lazy init factories.
 */

// ---------------------------------------------------------------------------
// Lazy AI SDK setup (mirrors copilot-service.ts pattern)
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

async function aiComplete(messages: ChatMessage[], maxTokens = 1200): Promise<string> {
  if (usesClaude()) {
    const anthropic = await getAnthropic();
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const nonSystem = messages.filter(m => m.role !== 'system');
    const res = await anthropic.messages.create({
      model: CLAUDE_FAST,
      max_tokens: maxTokens,
      temperature: 0.4,
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
    temperature: 0.4,
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

export type Industry = 'restaurant' | 'fitness' | 'education' | 'legal' | 'creative' | 'tech' | 'healthcare' | 'retail' | 'general';

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
}

export interface FontPairing {
  heading: string;
  body: string;
  accent?: string;
}

export interface SectionSuggestion {
  type: string;
  reason: string;
}

export interface ContentHint {
  section: string;
  headline: string;
  description: string;
}

export interface DesignSuggestions {
  colorPalette: ColorPalette;
  fontPairing: FontPairing;
  sectionOrder: SectionSuggestion[];
  contentHints: ContentHint[];
}

// ---------------------------------------------------------------------------
// Rule-based fallback templates (no AI needed)
// ---------------------------------------------------------------------------

const INDUSTRY_PALETTES: Record<Industry, ColorPalette> = {
  restaurant: { primary: '#C0392B', secondary: '#2C3E50', accent: '#E67E22', background: '#FDF6F0', text: '#1A1A2E', muted: '#7F8C8D' },
  fitness:    { primary: '#1ABC9C', secondary: '#2C3E50', accent: '#F39C12', background: '#F7FFFE', text: '#1A1A2E', muted: '#95A5A6' },
  education:  { primary: '#2980B9', secondary: '#34495E', accent: '#9B59B6', background: '#F5F8FC', text: '#1A1A2E', muted: '#7F8C8D' },
  legal:      { primary: '#1B2A4A', secondary: '#34495E', accent: '#C0A062', background: '#FAFBFC', text: '#1A1A2E', muted: '#6C7A89' },
  creative:   { primary: '#8E44AD', secondary: '#2C3E50', accent: '#E74C3C', background: '#FAF5FF', text: '#1A1A2E', muted: '#95A5A6' },
  tech:       { primary: '#0066CC', secondary: '#003366', accent: '#00C2CB', background: '#F5F9FF', text: '#1A1A2E', muted: '#6C7A89' },
  healthcare: { primary: '#27AE60', secondary: '#2C3E50', accent: '#3498DB', background: '#F0FFF4', text: '#1A1A2E', muted: '#7F8C8D' },
  retail:     { primary: '#E74C3C', secondary: '#2C3E50', accent: '#F1C40F', background: '#FFFAF5', text: '#1A1A2E', muted: '#95A5A6' },
  general:    { primary: '#3498DB', secondary: '#2C3E50', accent: '#E67E22', background: '#FAFBFC', text: '#1A1A2E', muted: '#7F8C8D' },
};

const INDUSTRY_FONTS: Record<Industry, FontPairing> = {
  restaurant: { heading: 'Playfair Display', body: 'Lato', accent: 'Dancing Script' },
  fitness:    { heading: 'Oswald', body: 'Open Sans' },
  education:  { heading: 'Merriweather', body: 'Source Sans Pro' },
  legal:      { heading: 'Cormorant Garamond', body: 'Inter' },
  creative:   { heading: 'Poppins', body: 'DM Sans' },
  tech:       { heading: 'Inter', body: 'Inter' },
  healthcare: { heading: 'Nunito', body: 'Open Sans' },
  retail:     { heading: 'Montserrat', body: 'Raleway' },
  general:    { heading: 'Inter', body: 'Inter' },
};

const INDUSTRY_SECTIONS: Record<Industry, SectionSuggestion[]> = {
  restaurant: [
    { type: 'hero', reason: 'Showcase your signature dish or ambiance' },
    { type: 'gallery', reason: 'Display your food and interior' },
    { type: 'features', reason: 'Highlight what makes your restaurant unique' },
    { type: 'testimonials', reason: 'Build trust with diner reviews' },
    { type: 'map', reason: 'Help customers find your location' },
    { type: 'contact_form', reason: 'Reservations and inquiries' },
  ],
  fitness: [
    { type: 'hero', reason: 'Energetic banner with your key offer' },
    { type: 'features', reason: 'List your programs and classes' },
    { type: 'pricing_table', reason: 'Transparent membership options' },
    { type: 'team', reason: 'Present your trainers and coaches' },
    { type: 'testimonials', reason: 'Success stories from members' },
    { type: 'cta', reason: 'Free trial or consultation CTA' },
  ],
  education: [
    { type: 'hero', reason: 'Welcome students and introduce your institution' },
    { type: 'featured_courses', reason: 'Showcase top courses or programs' },
    { type: 'features', reason: 'Your teaching methodology and advantages' },
    { type: 'stats', reason: 'Student success metrics' },
    { type: 'team', reason: 'Faculty and educators' },
    { type: 'faq_accordion', reason: 'Common enrollment questions' },
    { type: 'newsletter', reason: 'Updates and open house announcements' },
  ],
  legal: [
    { type: 'hero', reason: 'Establish authority and trust' },
    { type: 'features', reason: 'Practice areas and specializations' },
    { type: 'team', reason: 'Attorney profiles and credentials' },
    { type: 'testimonials', reason: 'Client success stories' },
    { type: 'faq_accordion', reason: 'Common legal questions' },
    { type: 'contact_form', reason: 'Case evaluation or consultation' },
  ],
  creative: [
    { type: 'hero', reason: 'Bold visual statement of your creative vision' },
    { type: 'gallery', reason: 'Portfolio showcase' },
    { type: 'video', reason: 'Showreel or project walkthrough' },
    { type: 'features', reason: 'Services offered' },
    { type: 'testimonials', reason: 'Client endorsements' },
    { type: 'cta', reason: 'Start a project together' },
  ],
  tech: [
    { type: 'hero', reason: 'Product value proposition' },
    { type: 'features', reason: 'Key capabilities and differentiators' },
    { type: 'stats', reason: 'Adoption numbers, uptime, performance' },
    { type: 'pricing_table', reason: 'Transparent SaaS pricing tiers' },
    { type: 'testimonials', reason: 'Customer logos and quotes' },
    { type: 'logo_carousel', reason: 'Technology partners and integrations' },
    { type: 'faq_accordion', reason: 'Technical and billing questions' },
    { type: 'newsletter', reason: 'Product updates and release notes' },
  ],
  healthcare: [
    { type: 'hero', reason: 'Reassuring welcome with key services' },
    { type: 'features', reason: 'Services and specialties' },
    { type: 'team', reason: 'Medical staff and qualifications' },
    { type: 'testimonials', reason: 'Patient testimonials' },
    { type: 'faq_accordion', reason: 'Insurance, hours, and common questions' },
    { type: 'map', reason: 'Clinic location and directions' },
    { type: 'contact_form', reason: 'Appointment requests' },
  ],
  retail: [
    { type: 'hero', reason: 'Hero banner with seasonal promotion' },
    { type: 'featured_products', reason: 'Bestsellers and new arrivals' },
    { type: 'features', reason: 'Shipping, returns, guarantees' },
    { type: 'testimonials', reason: 'Customer reviews' },
    { type: 'stats', reason: 'Happy customers, orders fulfilled' },
    { type: 'newsletter', reason: 'Exclusive deals and launches' },
    { type: 'cta', reason: 'Shop now or seasonal sale CTA' },
  ],
  general: [
    { type: 'hero', reason: 'Main value proposition' },
    { type: 'features', reason: 'Key benefits or services' },
    { type: 'testimonials', reason: 'Social proof' },
    { type: 'cta', reason: 'Primary conversion action' },
    { type: 'faq_accordion', reason: 'Common questions' },
    { type: 'contact_form', reason: 'Get in touch' },
  ],
};

const INDUSTRY_HINTS: Record<Industry, ContentHint[]> = {
  restaurant: [
    { section: 'hero', headline: 'A Culinary Experience Like No Other', description: 'Invite visitors to discover your menu, ambiance, and passion for food.' },
    { section: 'features', headline: 'Why Choose Us', description: 'Fresh local ingredients, award-winning chef, intimate atmosphere, private dining.' },
    { section: 'cta', headline: 'Reserve Your Table', description: 'Encourage immediate booking with a simple reservation CTA.' },
  ],
  fitness: [
    { section: 'hero', headline: 'Transform Your Body, Transform Your Life', description: 'Motivate visitors with an energetic headline and a clear offer (free trial, assessment).' },
    { section: 'features', headline: 'Our Programs', description: 'Group classes, personal training, nutrition coaching, recovery sessions.' },
    { section: 'cta', headline: 'Start Your Free Trial', description: 'Low-commitment entry point to convert visitors into members.' },
  ],
  education: [
    { section: 'hero', headline: 'Learn. Grow. Succeed.', description: 'Position your institution as the path to professional and personal growth.' },
    { section: 'features', headline: 'Our Approach', description: 'Small class sizes, hands-on learning, industry partnerships, flexible schedules.' },
    { section: 'stats', headline: 'Our Impact', description: '95% graduation rate, 2,000+ alumni, 50+ programs, 98% employer satisfaction.' },
  ],
  legal: [
    { section: 'hero', headline: 'Experienced Legal Counsel You Can Trust', description: 'Convey authority, experience, and client-first approach.' },
    { section: 'features', headline: 'Practice Areas', description: 'Corporate law, real estate, family law, immigration, litigation.' },
    { section: 'cta', headline: 'Schedule a Consultation', description: 'Offer a free initial consultation to lower the barrier.' },
  ],
  creative: [
    { section: 'hero', headline: 'We Create. You Inspire.', description: 'Bold creative statement that reflects your studio identity.' },
    { section: 'gallery', headline: 'Selected Work', description: 'Curated portfolio of your best projects across different disciplines.' },
    { section: 'cta', headline: 'Let\'s Build Something Amazing', description: 'Invite collaboration with an enthusiastic, approachable tone.' },
  ],
  tech: [
    { section: 'hero', headline: 'The Platform That Scales With You', description: 'Clear value prop: what you do, for whom, and the key benefit.' },
    { section: 'features', headline: 'Powerful Features', description: 'API-first, real-time analytics, enterprise security, 99.9% uptime.' },
    { section: 'pricing_table', headline: 'Simple, Transparent Pricing', description: 'Free tier, Pro, and Enterprise with clear feature breakdown.' },
  ],
  healthcare: [
    { section: 'hero', headline: 'Your Health, Our Priority', description: 'Reassuring and professional tone. Highlight your specialties.' },
    { section: 'features', headline: 'Our Services', description: 'Family medicine, pediatrics, mental health, preventive care, telemedicine.' },
    { section: 'cta', headline: 'Book Your Appointment', description: 'Easy online booking with available time slots.' },
  ],
  retail: [
    { section: 'hero', headline: 'Discover Our Collection', description: 'Seasonal or evergreen hero with featured category or promotion.' },
    { section: 'featured_products', headline: 'Bestsellers', description: 'Show your top-performing products to build confidence.' },
    { section: 'cta', headline: 'Shop the Sale', description: 'Time-sensitive promotion to drive urgency and conversions.' },
  ],
  general: [
    { section: 'hero', headline: 'Welcome to [Your Brand]', description: 'Clear statement of who you are and what value you provide.' },
    { section: 'features', headline: 'What We Offer', description: 'Three to six key benefits or services, each with a short description.' },
    { section: 'cta', headline: 'Get Started Today', description: 'Single clear action you want the visitor to take.' },
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate design suggestions for a page.
 *
 * If an AI key is available, returns enriched, contextual suggestions.
 * Otherwise returns high-quality rule-based templates.
 */
export async function generateDesignSuggestions(
  pageType: string,
  industry: Industry,
  existingSections: string[] = [],
): Promise<DesignSuggestions> {
  // Always start with rule-based defaults
  const fallback: DesignSuggestions = {
    colorPalette: INDUSTRY_PALETTES[industry] ?? INDUSTRY_PALETTES.general,
    fontPairing: INDUSTRY_FONTS[industry] ?? INDUSTRY_FONTS.general,
    sectionOrder: (INDUSTRY_SECTIONS[industry] ?? INDUSTRY_SECTIONS.general)
      .filter(s => !existingSections.includes(s.type)),
    contentHints: INDUSTRY_HINTS[industry] ?? INDUSTRY_HINTS.general,
  };

  if (!hasAiKey()) return fallback;

  try {
    const prompt = buildDesignPrompt(pageType, industry, existingSections);
    const raw = await aiComplete([
      { role: 'system', content: DESIGN_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ], 1500);

    return parseDesignResponse(raw, fallback);
  } catch {
    // AI unavailable or error — return rule-based suggestions
    return fallback;
  }
}

/**
 * Get available section types for an industry, ordered by relevance.
 */
export function getRecommendedSections(industry: Industry): SectionSuggestion[] {
  return INDUSTRY_SECTIONS[industry] ?? INDUSTRY_SECTIONS.general;
}

/**
 * Get the color palette for an industry (rule-based, no AI call).
 */
export function getIndustryPalette(industry: Industry): ColorPalette {
  return INDUSTRY_PALETTES[industry] ?? INDUSTRY_PALETTES.general;
}

// ---------------------------------------------------------------------------
// AI prompts
// ---------------------------------------------------------------------------

const DESIGN_SYSTEM_PROMPT = `You are a senior web designer AI assistant for a website builder platform.
You help users create professional, conversion-optimized websites.

RULES:
- Return valid JSON only — no markdown fences, no explanation text
- Be specific and actionable
- Tailor suggestions to the industry and page type
- Suggest realistic, professional content — never lorem ipsum
- Colors must be valid hex codes
- Font names must be real Google Fonts`;

function buildDesignPrompt(pageType: string, industry: Industry, existing: string[]): string {
  return `Generate design suggestions for a ${pageType} page in the ${industry} industry.

Current sections already on the page: ${existing.length > 0 ? existing.join(', ') : 'none'}

Return a JSON object with this exact structure:
{
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex",
    "muted": "#hex"
  },
  "fontPairing": {
    "heading": "Font Name",
    "body": "Font Name",
    "accent": "Font Name or null"
  },
  "sectionOrder": [
    { "type": "section_type", "reason": "Why this section matters" }
  ],
  "contentHints": [
    { "section": "section_type", "headline": "Suggested headline", "description": "What content to put here" }
  ]
}

Available section types: hero, featured_products, featured_courses, testimonials, features, cta, stats, newsletter, custom_html, text_image, gallery, video, team, pricing_table, faq_accordion, contact_form, map, countdown, logo_carousel.

Only suggest sections NOT already on the page. Suggest 4-8 sections in optimal order for conversion.
Include 3-5 content hints for the most important sections.`;
}

// ---------------------------------------------------------------------------
// Response parsing with fallback
// ---------------------------------------------------------------------------

function parseDesignResponse(raw: string, fallback: DesignSuggestions): DesignSuggestions {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      colorPalette: validatePalette(parsed.colorPalette) ? parsed.colorPalette : fallback.colorPalette,
      fontPairing: parsed.fontPairing?.heading ? parsed.fontPairing : fallback.fontPairing,
      sectionOrder: Array.isArray(parsed.sectionOrder) ? parsed.sectionOrder : fallback.sectionOrder,
      contentHints: Array.isArray(parsed.contentHints) ? parsed.contentHints : fallback.contentHints,
    };
  } catch {
    return fallback;
  }
}

function validatePalette(p: unknown): p is ColorPalette {
  if (!p || typeof p !== 'object') return false;
  const palette = p as Record<string, unknown>;
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  return (
    typeof palette.primary === 'string' && hexRe.test(palette.primary) &&
    typeof palette.secondary === 'string' && hexRe.test(palette.secondary) &&
    typeof palette.accent === 'string' && hexRe.test(palette.accent) &&
    typeof palette.background === 'string' && hexRe.test(palette.background) &&
    typeof palette.text === 'string' && hexRe.test(palette.text) &&
    typeof palette.muted === 'string' && hexRe.test(palette.muted)
  );
}

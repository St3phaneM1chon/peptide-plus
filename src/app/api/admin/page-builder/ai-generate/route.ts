export const dynamic = 'force-dynamic';

/**
 * AI Page Section Generator — Aurelia Page Designer
 * POST /api/admin/page-builder/ai-generate
 *
 * Generates page sections from a natural language prompt using Claude.
 * Returns an array of Koraline sections that can be inserted into the page builder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const requestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  context: z.string().optional(), // Industry, existing page context
  language: z.string().default('fr'),
  mode: z.enum(['generate', 'modify', 'enhance']).default('generate'),
  existingSections: z.any().optional(), // Current sections for modify/enhance mode
});

// Available section types for the AI to use
const AVAILABLE_SECTIONS = `
Available section types (use exact type names):
- hero: Hero banner (title, subtitle, ctaText, ctaUrl, variant: centered|left|split|fullscreen|gradient)
- features: Feature grid (title, subtitle, columns: 2|3|4, items: [{icon, title, description}])
- cta: Call to action (title, subtitle, buttonText, buttonUrl, backgroundColor, textColor)
- text_image: Text + Image (title, content, imageUrl, layout: imageRight|imageLeft)
- text: Text block (content, align: left|center|right)
- gallery: Image gallery (title, columns: 2|3|4, images: [{url, alt, caption}])
- video: Video embed (title, videoUrl)
- background_video: Vidéo de fond (title, subtitle, videoUrl, overlayOpacity, ctaText, ctaUrl, height)
- team: Team members (title, members: [{name, role, imageUrl}])
- testimonials: Testimonials (title, items: [{quote, author, role}])
- stats: Statistics (items: [{value, label}])
- pricing_table: Pricing plans (title, plans: [{name, price, period, features, ctaText, highlighted}])
- faq_accordion: FAQ (title, items: [{question, answer}])
- contact_form: Contact form (title, subtitle)
- newsletter: Newsletter signup (title, subtitle, buttonText)
- map: Google Maps (title, embedUrl, height)
- countdown: Countdown timer (title, targetDate)
- logo_carousel: Partner logos (title, logos: [{url, name}])
- process_steps: Étapes/Processus (title, subtitle, steps: [{icon, title, description}])
- tabs: Onglets (tabs: [{title, content}])
- accordion: Accordéon (items: [{title, content}])
- social_links: Réseaux sociaux (title, facebook, instagram, twitter, linkedin, tiktok, youtube)
- spacer: Espace (height: 1rem|2rem|4rem|6rem)
- divider: Séparateur (style: solid|dotted|dashed|gradient)

Each section should have: { id: "sec_XXX", type: "TYPE", data: { ...props, animation: "none|fadeIn|slideUp|slideLeft|slideRight|scale|bounce|parallax" } }

ANIMATION GUIDE:
- hero: fadeIn or parallax
- features: slideUp (stagger effect on grid items)
- cta: fadeIn
- testimonials: fadeIn
- stats: slideUp
- team: slideUp
- gallery: fadeIn
- pricing_table: slideUp
- faq_accordion: fadeIn
- newsletter: fadeIn
- countdown: fadeIn
`;

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { prompt, context, language, mode, existingSections } = requestSchema.parse(body);

    // Use Anthropic Claude if available, otherwise fall back to OpenAI
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!anthropicKey && !openaiKey) {
      return NextResponse.json({ error: 'Aucune clé API IA configurée' }, { status: 503 });
    }

    const systemPrompt = `Tu es Aurelia, l'assistante IA de la Suite Koraline — une designer web experte. Tu génères des sections de page web en JSON.
${AVAILABLE_SECTIONS}

RULES:
- Respond ONLY with a valid JSON array of sections. NO markdown, NO explanation, NO backticks.
- Each section must have id (sec_XXX), type, and data
- Use French text content (Québec French — tu/vous selon le contexte)
- Write compelling, professional marketing copy — pas de texte générique
- Adapt le ton au secteur: formel pour avocats/comptables, chaleureux pour restaurants/spas
- Use appropriate animations per the ANIMATION GUIDE above
- Generate 4-8 sections that form a complete, conversion-optimized page
- Use emojis as icons in features (🚀, 💡, 🔒, etc.)
- Prices in CAD ($)
- Start with a hero, end with a CTA or contact_form
- Add stats or testimonials for social proof
- For e-commerce: include featured_products. For courses: include featured_courses
- Color scheme suggestions: dark hero (#0f172a/#1e293b), accent CTA (#2563eb), light testimonials (#f8fafc)
- Include SEO-friendly headings and descriptions
- Make phone numbers use format +1 (XXX) XXX-XXXX
- For addresses, use plausible Québec addresses`;

    let userPrompt: string;
    if (mode === 'modify' && existingSections) {
      userPrompt = `Sections actuelles de la page:\n${JSON.stringify(existingSections, null, 1)}\n\nModification demandée: ${prompt}\n\nRetourne le JSON array complet des sections (modifiées + existantes). Réponds UNIQUEMENT avec le JSON array.`;
    } else if (mode === 'enhance' && existingSections) {
      userPrompt = `Sections actuelles:\n${JSON.stringify(existingSections, null, 1)}\n\nAméliore cette page: ${prompt}\n\nRetourne le JSON array complet des sections améliorées. Réponds UNIQUEMENT avec le JSON array.`;
    } else {
      userPrompt = `${context ? `Contexte: ${context}\n` : ''}Crée les sections de page pour: ${prompt}\n\nLangue: ${language === 'fr' ? 'français québécois' : 'English'}\n\nRéponds UNIQUEMENT avec le JSON array, sans markdown ni explication.`;
    }

    let sections: unknown[] = [];

    if (anthropicKey) {
      // Use Claude
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '[]';
        try {
          // Extract JSON from response (might be wrapped in markdown)
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          sections = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
          logger.warn('[AI Generate] Failed to parse Claude response', { text: text.slice(0, 200) });
        }
      }
    } else if (openaiKey) {
      // Fallback to OpenAI
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '[]';
        try {
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          sections = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
          logger.warn('[AI Generate] Failed to parse OpenAI response', { text: text.slice(0, 200) });
        }
      }
    }

    // Validate and clean sections
    const cleanSections = (sections as Array<{ id?: string; type?: string; data?: Record<string, unknown> }>)
      .filter(s => s && typeof s === 'object' && s.type && s.data)
      .map((s, i) => ({
        id: s.id || `sec_ai_${Date.now()}_${i}`,
        type: s.type!,
        data: s.data!,
      }));

    logger.info('[AI Generate] Sections generated', {
      prompt: prompt.slice(0, 100),
      count: cleanSections.length,
    });

    return NextResponse.json({
      sections: cleanSections,
      prompt,
      model: anthropicKey ? 'claude' : 'openai',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Prompt invalide', details: error.errors }, { status: 400 });
    }
    logger.error('[AI Generate] Failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur de génération' }, { status: 500 });
  }
});

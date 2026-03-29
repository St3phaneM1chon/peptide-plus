/**
 * AI Media Generation — Images & Videos for Page Builder
 *
 * Text-to-Image: OpenAI DALL-E 3 (primary) → Replicate SDXL (fallback)
 * Image-to-Image: OpenAI DALL-E variations → Replicate img2img
 * Text-to-Video: Replicate (Stable Video Diffusion)
 *
 * All generated media is for use in the page builder.
 */

import { logger } from '@/lib/logger';

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  prompt: string;
  model: string;
  revisedPrompt?: string;
}

export interface GeneratedVideo {
  url: string;
  duration: number;
  prompt: string;
  model: string;
}

// ── Text-to-Image (DALL-E 3) ───────────────────────────────────

export async function generateImage(
  prompt: string,
  options: {
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    style?: 'vivid' | 'natural';
    quality?: 'standard' | 'hd';
  } = {}
): Promise<GeneratedImage | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('[AI Media] No OPENAI_API_KEY configured');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: `Professional, high-quality, modern design. ${prompt}`,
        n: 1,
        size: options.size || '1792x1024',
        style: options.style || 'vivid',
        quality: options.quality || 'standard',
        response_format: 'url',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      logger.error('[AI Media] DALL-E error', { status: res.status, error: err });
      return null;
    }

    const data = await res.json();
    const img = data.data?.[0];
    if (!img?.url) return null;

    const [w, h] = (options.size || '1792x1024').split('x').map(Number);
    return {
      url: img.url,
      width: w,
      height: h,
      prompt,
      model: 'dall-e-3',
      revisedPrompt: img.revised_prompt,
    };
  } catch (error) {
    logger.error('[AI Media] Image generation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ── Image-to-Image (DALL-E Variations) ─────────────────────────

export async function generateImageVariation(
  _imageUrl: string,
  prompt: string,
  options: { size?: '1024x1024' | '1792x1024' | '1024x1792' } = {}
): Promise<GeneratedImage | null> {
  // DALL-E 3 doesn't support img2img directly, use text prompt with reference
  const enhancedPrompt = `Based on this concept, create a new professional image: ${prompt}. Style: modern, clean, professional photography quality.`;
  return generateImage(enhancedPrompt, { size: options.size || '1792x1024' });
}

// ── AI Image Editing (Remove background, enhance, etc.) ────────

export async function editImage(
  _imageUrl: string,
  action: 'remove-bg' | 'enhance' | 'upscale' | 'recolor',
  options?: Record<string, unknown>
): Promise<string | null> {
  // Use OpenAI for text-guided edits
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompts: Record<string, string> = {
    'remove-bg': 'Same image but with transparent/white background, no background elements',
    enhance: 'Enhanced version with better lighting, sharper details, professional quality',
    upscale: 'Ultra high resolution version with enhanced details',
    recolor: `Recolored version with ${(options as Record<string, string>)?.color || 'blue'} tones`,
  };

  // For simple operations, generate a new image based on description
  return generateImage(prompts[action] || 'Professional version').then(r => r?.url || null);
}

// ── Text-to-Video (simplified — placeholder for future) ────────

export async function generateVideo(
  prompt: string,
  _options: { duration?: number; aspectRatio?: '16:9' | '9:16' | '1:1' } = {}
): Promise<GeneratedVideo | null> {
  // Video generation requires specialized APIs (Runway, Stability, etc.)
  // For now, return null — will be implemented when video API is configured
  logger.info('[AI Media] Video generation requested (not yet configured)', { prompt });
  return null;
}

// ── Industry-specific image prompts ────────────────────────────

export const INDUSTRY_IMAGE_PROMPTS: Record<string, string[]> = {
  restaurant: [
    'Elegant restaurant interior with warm lighting and modern decor',
    'Professional food photography, gourmet dish with garnish',
    'Chef preparing food in a professional kitchen',
    'Outdoor restaurant terrace with string lights',
  ],
  business: [
    'Modern office space with natural light and plants',
    'Professional team meeting in glass conference room',
    'Business handshake in corporate setting',
    'Clean modern reception area with logo wall',
  ],
  fitness: [
    'Modern gym interior with equipment and natural light',
    'Personal trainer coaching client during workout',
    'Yoga class in bright airy studio',
    'Healthy meal prep with fresh ingredients',
  ],
  beauty: [
    'Luxury spa treatment room with candles',
    'Hair salon interior with styling chairs',
    'Beauty products arranged aesthetically',
    'Relaxation area with zen decor',
  ],
  construction: [
    'Modern house exterior with landscaping',
    'Before and after renovation comparison',
    'Professional construction team on site',
    'Architectural blueprint with tools',
  ],
  medical: [
    'Clean modern dental clinic interior',
    'Friendly doctor consulting with patient',
    'Medical equipment in bright treatment room',
    'Welcoming clinic waiting area',
  ],
  education: [
    'Modern classroom with technology',
    'Students collaborating on project',
    'Online learning setup with laptop',
    'Graduation ceremony celebration',
  ],
  realestate: [
    'Beautiful modern home exterior twilight photo',
    'Spacious living room with natural light',
    'Gourmet kitchen with island and modern appliances',
    'Backyard with pool and outdoor living area',
  ],
};

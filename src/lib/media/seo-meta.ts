/**
 * SEO Meta Tags Auto-Generator
 * C-14: Automatically generates meta tags for videos and content.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SEOMeta {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogType: string;
  ogImage?: string;
  twitterCard: string;
  canonical?: string;
  jsonLd: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Video SEO Meta Generator
// ---------------------------------------------------------------------------

/**
 * Generate SEO meta tags for a video.
 */
export function generateVideoSEO(video: {
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  duration?: string | null;
  tags?: string | null;
  instructor?: string | null;
  slug: string;
}): SEOMeta {
  const siteName = 'BioCycle Peptides';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';

  // Parse tags
  let keywords: string[] = [];
  if (video.tags) {
    try {
      const parsed = JSON.parse(video.tags);
      keywords = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      keywords = video.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  // Add default keywords
  keywords = [...new Set([...keywords, 'peptides', 'research', 'biocycle', 'laboratory'])];

  // Generate description (max 160 chars for SEO)
  const rawDesc = video.description || video.title;
  const seoDescription = rawDesc.length > 157 ? rawDesc.slice(0, 157) + '...' : rawDesc;

  // Generate JSON-LD structured data (VideoObject schema)
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: seoDescription,
    thumbnailUrl: video.thumbnailUrl || undefined,
    contentUrl: video.videoUrl || undefined,
    uploadDate: new Date().toISOString(),
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: baseUrl,
    },
  };

  if (video.duration) jsonLd.duration = video.duration;
  if (video.instructor) jsonLd.author = { '@type': 'Person', name: video.instructor };

  return {
    title: `${video.title} | ${siteName}`,
    description: seoDescription,
    keywords,
    ogTitle: video.title,
    ogDescription: seoDescription,
    ogType: 'video.other',
    ogImage: video.thumbnailUrl || undefined,
    twitterCard: 'summary_large_image',
    canonical: `${baseUrl}/videos/${video.slug}`,
    jsonLd,
  };
}

/**
 * Generate meta tags as HTML string (for server-side injection).
 */
export function seoMetaToHtml(meta: SEOMeta): string {
  const tags: string[] = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="keywords" content="${escapeHtml(meta.keywords.join(', '))}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.ogDescription)}" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta name="twitter:card" content="${meta.twitterCard}" />`,
  ];

  if (meta.ogImage) tags.push(`<meta property="og:image" content="${escapeHtml(meta.ogImage)}" />`);
  if (meta.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  tags.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`);

  return tags.join('\n');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

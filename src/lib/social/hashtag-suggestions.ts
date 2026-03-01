/**
 * AI Hashtag Suggestions
 * C-21: Suggests relevant hashtags for social media posts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HashtagSuggestion {
  tag: string;
  category: 'brand' | 'product' | 'industry' | 'trending' | 'niche';
  priority: number; // 1-10
}

// ---------------------------------------------------------------------------
// Static hashtag database (curated for peptide/biotech industry)
// ---------------------------------------------------------------------------

const BRAND_HASHTAGS: HashtagSuggestion[] = [
  { tag: '#BioCyclePeptides', category: 'brand', priority: 10 },
  { tag: '#BioCycle', category: 'brand', priority: 9 },
  { tag: '#PeptideResearch', category: 'brand', priority: 8 },
];

const INDUSTRY_HASHTAGS: HashtagSuggestion[] = [
  { tag: '#Peptides', category: 'industry', priority: 9 },
  { tag: '#ResearchPeptides', category: 'industry', priority: 8 },
  { tag: '#Biotech', category: 'industry', priority: 7 },
  { tag: '#LifeScience', category: 'industry', priority: 7 },
  { tag: '#Laboratory', category: 'industry', priority: 6 },
  { tag: '#Science', category: 'industry', priority: 6 },
  { tag: '#Research', category: 'industry', priority: 7 },
  { tag: '#Biochemistry', category: 'industry', priority: 6 },
  { tag: '#MolecularBiology', category: 'industry', priority: 5 },
  { tag: '#DrugDiscovery', category: 'industry', priority: 5 },
];

const PRODUCT_KEYWORDS: Record<string, HashtagSuggestion[]> = {
  bpc: [
    { tag: '#BPC157', category: 'product', priority: 9 },
    { tag: '#GutHealth', category: 'niche', priority: 7 },
    { tag: '#Healing', category: 'niche', priority: 6 },
  ],
  tb: [
    { tag: '#TB500', category: 'product', priority: 9 },
    { tag: '#Thymosin', category: 'product', priority: 8 },
    { tag: '#Recovery', category: 'niche', priority: 7 },
  ],
  semaglutide: [
    { tag: '#Semaglutide', category: 'product', priority: 9 },
    { tag: '#GLP1', category: 'product', priority: 8 },
    { tag: '#WeightLoss', category: 'niche', priority: 7 },
  ],
  tirzepatide: [
    { tag: '#Tirzepatide', category: 'product', priority: 9 },
    { tag: '#GIP', category: 'product', priority: 7 },
  ],
  mk677: [
    { tag: '#MK677', category: 'product', priority: 9 },
    { tag: '#Ibutamoren', category: 'product', priority: 8 },
    { tag: '#GrowthHormone', category: 'niche', priority: 7 },
  ],
  pt141: [
    { tag: '#PT141', category: 'product', priority: 9 },
    { tag: '#Bremelanotide', category: 'product', priority: 8 },
  ],
  ghk: [
    { tag: '#GHKCu', category: 'product', priority: 9 },
    { tag: '#CopperPeptide', category: 'product', priority: 8 },
    { tag: '#Skincare', category: 'niche', priority: 7 },
    { tag: '#AntiAging', category: 'niche', priority: 7 },
  ],
};

const PLATFORM_BEST_PRACTICES: Record<string, { maxHashtags: number; style: string }> = {
  instagram: { maxHashtags: 30, style: 'many' },
  facebook:  { maxHashtags: 5, style: 'few' },
  twitter:   { maxHashtags: 3, style: 'minimal' },
  tiktok:    { maxHashtags: 8, style: 'trending' },
  linkedin:  { maxHashtags: 5, style: 'professional' },
};

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Suggest hashtags based on post content and platform.
 */
export function suggestHashtags(
  content: string,
  platform: string,
  options?: { maxResults?: number },
): HashtagSuggestion[] {
  const contentLower = content.toLowerCase();
  const platformConfig = PLATFORM_BEST_PRACTICES[platform] || { maxHashtags: 10, style: 'many' };
  const maxResults = options?.maxResults || platformConfig.maxHashtags;

  const suggestions: HashtagSuggestion[] = [...BRAND_HASHTAGS];

  // Match product-specific hashtags
  for (const [keyword, tags] of Object.entries(PRODUCT_KEYWORDS)) {
    if (contentLower.includes(keyword)) {
      suggestions.push(...tags);
    }
  }

  // Add industry hashtags
  suggestions.push(...INDUSTRY_HASHTAGS);

  // Content-based keyword extraction (simple TF approach)
  const words = contentLower.match(/\b[a-z]{4,}\b/g) || [];
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // Generate hashtags from high-frequency content words
  const contentHashtags = Array.from(wordFreq.entries())
    .filter(([word, freq]) => freq >= 2 && !['this', 'that', 'with', 'from', 'have', 'been', 'will', 'your'].includes(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]): HashtagSuggestion => ({
      tag: `#${word.charAt(0).toUpperCase() + word.slice(1)}`,
      category: 'niche',
      priority: 3,
    }));

  suggestions.push(...contentHashtags);

  // Deduplicate and sort by priority
  const seen = new Set<string>();
  const unique = suggestions.filter((s) => {
    const lower = s.tag.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  unique.sort((a, b) => b.priority - a.priority);

  return unique.slice(0, maxResults);
}

/**
 * Format suggestions as a string ready to append to a post.
 */
export function formatHashtags(suggestions: HashtagSuggestion[]): string {
  return suggestions.map((s) => s.tag).join(' ');
}

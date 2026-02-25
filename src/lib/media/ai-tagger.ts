/**
 * AI Image Auto-Tagging
 * Generate tags and alt text from filename and context
 */

const PRODUCT_KEYWORDS: Record<string, string[]> = {
  peptide: ['research peptide', 'laboratory', 'science', 'biochemistry'],
  bpc: ['bpc-157', 'healing', 'recovery', 'research'],
  tb: ['tb-500', 'thymosin', 'recovery', 'research'],
  gh: ['growth hormone', 'secretagogue', 'research'],
  melanotan: ['melanotan', 'tanning peptide', 'research'],
  ipamorelin: ['ipamorelin', 'growth hormone', 'research'],
  sermorelin: ['sermorelin', 'growth hormone', 'research'],
  cjc: ['cjc-1295', 'growth hormone', 'research'],
  pt: ['pt-141', 'bremelanotide', 'research'],
  semaglutide: ['semaglutide', 'glp-1', 'research'],
};

export function generateTags(filename: string, productName?: string, category?: string): string[] {
  const tags = new Set<string>();
  const lower = (filename + ' ' + (productName || '') + ' ' + (category || '')).toLowerCase();

  // Match known peptide keywords
  for (const [key, related] of Object.entries(PRODUCT_KEYWORDS)) {
    if (lower.includes(key)) {
      related.forEach((t) => tags.add(t));
    }
  }

  // Generic tags from filename
  if (lower.includes('vial') || lower.includes('fiole')) tags.add('vial');
  if (lower.includes('powder') || lower.includes('poudre')) tags.add('powder');
  if (lower.includes('label') || lower.includes('étiquette')) tags.add('label');
  if (lower.includes('box') || lower.includes('boîte')) tags.add('packaging');
  if (lower.includes('lab') || lower.includes('labo')) tags.add('laboratory');
  if (lower.includes('certificate') || lower.includes('certificat') || lower.includes('coa')) tags.add('certificate');
  if (lower.includes('hplc')) tags.add('hplc analysis');

  // Category tags
  if (category) tags.add(category.toLowerCase());
  if (productName) tags.add(productName.toLowerCase());

  // Always add brand
  tags.add('biocycle peptides');

  return Array.from(tags);
}

export function generateAltText(filename: string, productName?: string): string {
  if (productName) {
    return `${productName} - BioCycle Peptides research product`;
  }
  const cleaned = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return `${cleaned} - BioCycle Peptides`.substring(0, 125);
}

export function suggestMetaDescription(productName: string, tags: string[]): string {
  const tagText = tags.slice(0, 3).join(', ');
  return `${productName} by BioCycle Peptides. ${tagText}. High-quality research peptides with Certificate of Analysis.`.substring(0, 160);
}

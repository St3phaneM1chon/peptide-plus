/**
 * GLOSSAIRE PEPTIDES - Termes à préserver lors de la traduction
 * BioCycle Peptides - Terminologie scientifique
 *
 * Ces termes sont injectés dans le system prompt de GPT-4o-mini
 * pour garantir leur préservation exacte dans toutes les langues.
 */

// Noms de peptides - JAMAIS traduits
export const PEPTIDE_NAMES = [
  'BPC-157',
  'TB-500',
  'Semaglutide',
  'Tirzepatide',
  'CJC-1295',
  'CJC-1295 DAC',
  'Ipamorelin',
  'GHRP-6',
  'GHRP-2',
  'Epitalon',
  'NAD+',
  'PT-141',
  'Bremelanotide',
  'Melanotan II',
  'GHK-Cu',
  'Thymosin Alpha-1',
  'Thymosin Beta-4',
  'Sermorelin',
  'Tesamorelin',
  'AOD-9604',
  'Fragment 176-191',
  'MOTs-c',
  'Humanin',
  'SS-31',
  'Selank',
  'Semax',
  'Dihexa',
  'Cerebrolysin',
  'LL-37',
  'KPV',
  'Retatrutide',
  'Survodutide',
  'Oxytocin',
  'Pentosan Polysulfate',
];

// Termes scientifiques - préserver dans toutes langues
export const SCIENTIFIC_TERMS = [
  'HPLC',
  'COA',
  'GMP',
  'USP',
  'pH',
  'Da',
  'kDa',
  'mg',
  'mcg',
  'µg',
  'ml',
  'mL',
  'IU',
  'nm',
  'IC50',
  'EC50',
  'LD50',
  'GLP-1',
  'GIP',
  'GH',
  'IGF-1',
  'mTOR',
  'AMPK',
  'NF-κB',
  'TNF-α',
  'IL-6',
  'IL-10',
  'VEGF',
  'EGF',
  'FGF',
  'TGF-β',
  'BDNF',
  'NGF',
  'NO',
  'ROS',
  'ATP',
  'DNA',
  'RNA',
  'mRNA',
  'CAS',
];

// Unités et mesures - JAMAIS traduites
export const UNITS = [
  'CAD',
  'USD',
  'mg/mL',
  'mg/vial',
  'mcg/dose',
  '°C',
  '°F',
  'mg',
  'µg',
  'mL',
  'IU',
];

// Noms de marque / entreprise
export const BRAND_TERMS = [
  'BioCycle Peptides',
  'BioCycle',
  'Peptide Plus+',
  'AureliaPay',
];

// Formules chimiques - extraites dynamiquement des produits
export const FORMULA_PATTERN = /C\d+H\d+N\d+O\d+S?\d*/g;

// CAS Number pattern
export const CAS_PATTERN = /\d{2,7}-\d{2}-\d/g;

/**
 * Génère la section glossaire du system prompt
 */
export function buildGlossaryPrompt(): string {
  return `
## GLOSSARY - Terms to PRESERVE exactly (DO NOT translate):

### Peptide Names (keep exactly as written):
${PEPTIDE_NAMES.join(', ')}

### Scientific Terms & Abbreviations:
${SCIENTIFIC_TERMS.join(', ')}

### Units & Measurements:
${UNITS.join(', ')}

### Brand Names:
${BRAND_TERMS.join(', ')}

### Patterns to preserve:
- Chemical formulas (e.g., C₆₃H₉₈N₁₈O₁₃S)
- CAS numbers (e.g., 137525-51-0)
- Purity percentages (e.g., 99.43%)
- Dosages (e.g., 5mg, 10mg, 250mcg)
- Prices (e.g., $45 CAD, $120 USD)
- URLs and email addresses
- HTML/Markdown formatting tags
`.trim();
}

/**
 * Génère le system prompt complet pour la traduction
 */
export function buildTranslationSystemPrompt(targetLanguage: string, context: 'product' | 'article' | 'general' = 'general'): string {
  const contextInstructions: Record<string, string> = {
    product: `You are translating product descriptions for a Canadian peptide research supply company.
Maintain a professional, scientific tone. Preserve all technical specifications exactly.
Keep product benefits clear and factual. This is for research purposes only.`,

    article: `You are translating scientific research articles about peptides.
Maintain academic/scientific register. Preserve all citations, references, and technical terminology.
Keep the same paragraph structure and formatting.`,

    general: `You are translating content for a Canadian peptide research supply company.
Maintain the same tone, formality level, and formatting as the source text.`,
  };

  return `${contextInstructions[context]}

Target language: ${targetLanguage}

## CRITICAL RULES:
1. Return ONLY the translation - no explanations, no notes, no preamble
2. Preserve ALL items listed in the glossary below exactly as they appear
3. Preserve ALL HTML/Markdown formatting tags
4. Preserve ALL numbers, units, prices, and measurements exactly
5. If the source text is already in the target language, return it unchanged
6. Maintain the same paragraph breaks and formatting structure
7. For scientific terms with no standard translation in the target language, keep the English term

${buildGlossaryPrompt()}
`.trim();
}

/**
 * Map des locales vers noms de langue pour le prompt
 */
export const LOCALE_TO_LANGUAGE: Record<string, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese (Brazilian)',
  zh: 'Simplified Chinese (Mandarin)',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Modern Standard Arabic',
  'ar-ma': 'Moroccan Arabic (Darija)',
  'ar-dz': 'Algerian Arabic (Darja)',
  'ar-lb': 'Lebanese Arabic',
  ru: 'Russian',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  ta: 'Tamil',
  pa: 'Punjabi (Gurmukhi script)',
  tl: 'Filipino/Tagalog',
  ht: 'Haitian Creole',
  gcr: 'Guadeloupean Creole (Kréyòl Gwadloupéyen)',
};

export function getLanguageName(locale: string): string {
  return LOCALE_TO_LANGUAGE[locale] || locale;
}

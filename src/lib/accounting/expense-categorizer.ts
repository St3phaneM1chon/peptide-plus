/**
 * AI Expense Categorization
 * Auto-categorize expenses by vendor/amount patterns, learns from corrections
 */

export interface ExpenseCategory {
  code: string;
  name: string;
  nameFr: string;
  keywords: string[];
  amountRange?: { min: number; max: number };
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { code: 'COGS', name: 'Cost of Goods Sold', nameFr: 'Coût des marchandises', keywords: ['peptide', 'raw material', 'matière première', 'chemical', 'chimique', 'lab supply', 'synthesis'] },
  { code: 'SHIPPING', name: 'Shipping & Delivery', nameFr: 'Livraison', keywords: ['canada post', 'postes canada', 'purolator', 'fedex', 'ups', 'dhl', 'shipping', 'livraison', 'courrier'] },
  { code: 'MARKETING', name: 'Marketing & Advertising', nameFr: 'Marketing & Publicité', keywords: ['google ads', 'facebook', 'meta', 'instagram', 'advertising', 'publicité', 'seo', 'marketing'] },
  { code: 'SOFTWARE', name: 'Software & Subscriptions', nameFr: 'Logiciels & Abonnements', keywords: ['stripe', 'azure', 'github', 'vercel', 'cloudflare', 'saas', 'subscription', 'abonnement', 'software', 'logiciel'] },
  { code: 'RENT', name: 'Rent & Utilities', nameFr: 'Loyer & Services', keywords: ['rent', 'loyer', 'hydro', 'electricity', 'électricité', 'internet', 'bell', 'videotron', 'telus'] },
  { code: 'PROFESSIONAL', name: 'Professional Services', nameFr: 'Services professionnels', keywords: ['comptable', 'accountant', 'lawyer', 'avocat', 'consultant', 'legal', 'juridique', 'notaire'] },
  { code: 'OFFICE', name: 'Office Supplies', nameFr: 'Fournitures de bureau', keywords: ['staples', 'bureau en gros', 'office', 'bureau', 'paper', 'papier', 'printer', 'imprimante'] },
  { code: 'INSURANCE', name: 'Insurance', nameFr: 'Assurances', keywords: ['insurance', 'assurance', 'desjardins', 'intact', 'aviva', 'coverage'] },
  { code: 'BANK', name: 'Bank Fees', nameFr: 'Frais bancaires', keywords: ['bank fee', 'frais bancaire', 'service charge', 'frais de service', 'interest', 'intérêt'] },
  { code: 'EQUIPMENT', name: 'Equipment', nameFr: 'Équipement', keywords: ['equipment', 'équipement', 'machine', 'freezer', 'congélateur', 'lab', 'laboratoire'] },
  { code: 'TRAVEL', name: 'Travel & Meals', nameFr: 'Déplacements & Repas', keywords: ['uber', 'taxi', 'hotel', 'hôtel', 'flight', 'vol', 'restaurant', 'repas', 'meal', 'air canada'] },
  { code: 'PAYROLL', name: 'Payroll & Benefits', nameFr: 'Salaires & Avantages', keywords: ['salary', 'salaire', 'payroll', 'paie', 'bonus', 'benefits', 'avantages', 'rrsp', 'reer'] },
  { code: 'TAX', name: 'Taxes & Government', nameFr: 'Taxes & Gouvernement', keywords: ['tax', 'taxe', 'gst', 'tps', 'qst', 'tvq', 'revenu québec', 'cra', 'arc', 'government', 'gouvernement'] },
  { code: 'OTHER', name: 'Other', nameFr: 'Autres', keywords: [] },
];

export function categorizeExpense(description: string, amount?: number): { category: ExpenseCategory; confidence: number } {
  const normalizedDesc = description.toLowerCase();
  let bestMatch: ExpenseCategory = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]; // OTHER
  let bestScore = 0;

  for (const cat of EXPENSE_CATEGORIES) {
    if (cat.code === 'OTHER') continue;

    let score = 0;
    for (const keyword of cat.keywords) {
      if (normalizedDesc.includes(keyword.toLowerCase())) {
        score += keyword.length; // longer keyword matches = more specific = higher score
      }
    }

    // Amount range bonus
    if (cat.amountRange && amount !== undefined) {
      if (amount >= cat.amountRange.min && amount <= cat.amountRange.max) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = cat;
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.95, 0.4 + bestScore * 0.05) : 0.1;
  return { category: bestMatch, confidence };
}

export function getCategoryByCode(code: string): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.find(c => c.code === code);
}

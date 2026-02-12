/**
 * UAT Test Scenarios — Comprehensive Matrix
 *
 * 50+ scenarios under $150 (with shipping)
 * 50+ scenarios over $150 (free shipping)
 * All 13 Canadian provinces + US states + international
 * Single & multi-product combinations
 */

export interface UatScenarioItem {
  quantity: number;
  priceRange: 'cheap' | 'mid' | 'expensive' | 'exact' | 'all';
  exactPrice?: number;
}

export interface UatScenario {
  code: string;
  name: string;
  region: string;
  country: string;
  province: string;
  isInternational: boolean;
  currency: string; // CAD, USD, EUR, GBP, MXN, BRL
  items: UatScenarioItem[];
  shipping: { required: boolean; amount?: number };
  expectedTaxRates: {
    tps?: number;
    tvq?: number;
    tvh?: number;
    pst?: number;
    gst?: number;
  };
  postActions?: ('refund' | 'reship')[];
}

// =====================================================
// TAX RATES LOOKUP
// =====================================================

const CA_TAX_RATES: Record<string, UatScenario['expectedTaxRates']> = {
  QC: { tps: 0.05, tvq: 0.09975 },
  ON: { tvh: 0.13 },
  BC: { tps: 0.05, pst: 0.07 },
  AB: { tps: 0.05 },
  SK: { tps: 0.05, pst: 0.06 },
  MB: { tps: 0.05, pst: 0.07 },
  NS: { tvh: 0.14 },
  NB: { tvh: 0.15 },
  NL: { tvh: 0.15 },
  PE: { tvh: 0.15 },
  NT: { tps: 0.05 },
  YT: { tps: 0.05 },
  NU: { tps: 0.05 },
};

const CA_PROVINCES = Object.keys(CA_TAX_RATES);

const PROVINCE_NAMES: Record<string, string> = {
  QC: 'Quebec', ON: 'Ontario', BC: 'Colombie-Britannique', AB: 'Alberta',
  SK: 'Saskatchewan', MB: 'Manitoba', NS: 'Nouvelle-Ecosse', NB: 'Nouveau-Brunswick',
  NL: 'Terre-Neuve', PE: 'Ile-du-Prince-Edouard', NT: 'Territoires du Nord-Ouest',
  YT: 'Yukon', NU: 'Nunavut',
};

const US_STATES = ['NY', 'CA', 'TX', 'FL', 'OR', 'WA', 'IL', 'MT', 'DE', 'NH'] as const;
const US_STATE_NAMES: Record<string, string> = {
  NY: 'New York', CA: 'Californie', TX: 'Texas', FL: 'Floride', OR: 'Oregon',
  WA: 'Washington', IL: 'Illinois', MT: 'Montana', DE: 'Delaware', NH: 'New Hampshire',
};

interface IntlDef { code: string; country: string; province: string; name: string; shipCost: number; currency: string }
const INTL_COUNTRIES: IntlDef[] = [
  { code: 'FR', country: 'FR', province: 'IDF', name: 'France', shipCost: 30, currency: 'EUR' },
  { code: 'GB', country: 'GB', province: 'LDN', name: 'Angleterre', shipCost: 30, currency: 'GBP' },
  { code: 'DE', country: 'DE', province: 'BY', name: 'Allemagne', shipCost: 30, currency: 'EUR' },
  { code: 'MX', country: 'MX', province: 'CDMX', name: 'Mexique', shipCost: 25, currency: 'MXN' },
  { code: 'BR', country: 'BR', province: 'SP', name: 'Bresil', shipCost: 40, currency: 'BRL' },
];

// =====================================================
// HELPERS
// =====================================================

function makeCA(
  code: string, name: string, province: string,
  items: UatScenarioItem[], shipping: { required: boolean; amount?: number },
  postActions?: ('refund' | 'reship')[]
): UatScenario {
  return {
    code, name, region: province, country: 'CA', province,
    isInternational: false, currency: 'CAD', items, shipping,
    expectedTaxRates: CA_TAX_RATES[province],
    postActions,
  };
}

function makeUS(
  code: string, name: string, state: string,
  items: UatScenarioItem[], shipping: { required: boolean; amount?: number }
): UatScenario {
  return {
    code, name, region: `US-${state}`, country: 'US', province: state,
    isInternational: true, currency: 'USD', items, shipping,
    expectedTaxRates: {},
  };
}

function makeIntl(
  code: string, name: string, def: IntlDef,
  items: UatScenarioItem[], shipping: { required: boolean; amount?: number }
): UatScenario {
  return {
    code, name, region: def.code, country: def.country, province: def.province,
    isInternational: true, currency: def.currency, items, shipping,
    expectedTaxRates: {},
  };
}

// Items that total UNDER $150
const UNDER_150_SINGLE: UatScenarioItem[] = [{ quantity: 1, priceRange: 'exact', exactPrice: 89.99 }];
const UNDER_150_SINGLE_B: UatScenarioItem[] = [{ quantity: 1, priceRange: 'exact', exactPrice: 49.99 }];
const UNDER_150_SINGLE_C: UatScenarioItem[] = [{ quantity: 1, priceRange: 'exact', exactPrice: 129.99 }];
const UNDER_150_MULTI_2: UatScenarioItem[] = [
  { quantity: 1, priceRange: 'exact', exactPrice: 45.00 },
  { quantity: 1, priceRange: 'exact', exactPrice: 55.00 },
];
const UNDER_150_MULTI_3: UatScenarioItem[] = [
  { quantity: 1, priceRange: 'exact', exactPrice: 29.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 39.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 35.00 },
];
const UNDER_150_MULTI_4: UatScenarioItem[] = [
  { quantity: 1, priceRange: 'exact', exactPrice: 19.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 29.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 24.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 34.99 },
];
const UNDER_150_CHEAP_QTY: UatScenarioItem[] = [{ quantity: 3, priceRange: 'exact', exactPrice: 29.99 }];

// Items that total OVER $150
const OVER_150_SINGLE: UatScenarioItem[] = [{ quantity: 1, priceRange: 'exact', exactPrice: 199.99 }];
const OVER_150_SINGLE_B: UatScenarioItem[] = [{ quantity: 1, priceRange: 'exact', exactPrice: 299.99 }];
const OVER_150_SINGLE_C: UatScenarioItem[] = [{ quantity: 1, priceRange: 'exact', exactPrice: 449.99 }];
const OVER_150_MULTI_2: UatScenarioItem[] = [
  { quantity: 1, priceRange: 'exact', exactPrice: 89.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 89.99 },
];
const OVER_150_MULTI_3: UatScenarioItem[] = [
  { quantity: 1, priceRange: 'exact', exactPrice: 59.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 69.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 49.99 },
];
const OVER_150_MULTI_4: UatScenarioItem[] = [
  { quantity: 1, priceRange: 'exact', exactPrice: 49.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 39.99 },
  { quantity: 1, priceRange: 'exact', exactPrice: 45.00 },
  { quantity: 1, priceRange: 'exact', exactPrice: 55.00 },
];
const OVER_150_EXPENSIVE: UatScenarioItem[] = [{ quantity: 1, priceRange: 'expensive' }];
const OVER_150_MID_QTY: UatScenarioItem[] = [{ quantity: 3, priceRange: 'exact', exactPrice: 69.99 }];

// Shipping
const SHIP_15 = { required: true, amount: 15 } as const;
const SHIP_20 = { required: true, amount: 20 } as const;
const SHIP_25 = { required: true, amount: 25 } as const;
const FREE_SHIP = { required: false } as const;

// =====================================================
// CANADA — UNDER $150 WITH SHIPPING (52 scenarios)
// =====================================================

const CA_UNDER_150: UatScenario[] = [
  // Every province: single item ~$90 + $15 shipping
  ...CA_PROVINCES.map(p =>
    makeCA(`${p}_U150_S1`, `${PROVINCE_NAMES[p]} - 1 produit <150$ + livraison`, p, UNDER_150_SINGLE, SHIP_15)
  ),
  // Every province: 2 items ~$100 + $15 shipping
  ...CA_PROVINCES.map(p =>
    makeCA(`${p}_U150_M2`, `${PROVINCE_NAMES[p]} - 2 produits <150$ + livraison`, p, UNDER_150_MULTI_2, SHIP_15)
  ),
  // QC/ON/BC/AB: 3 items ~$105 + $15 shipping
  makeCA('QC_U150_M3', 'Quebec - 3 produits <150$ + livraison', 'QC', UNDER_150_MULTI_3, SHIP_15),
  makeCA('ON_U150_M3', 'Ontario - 3 produits <150$ + livraison', 'ON', UNDER_150_MULTI_3, SHIP_15),
  makeCA('BC_U150_M3', 'BC - 3 produits <150$ + livraison', 'BC', UNDER_150_MULTI_3, SHIP_15),
  makeCA('AB_U150_M3', 'Alberta - 3 produits <150$ + livraison', 'AB', UNDER_150_MULTI_3, SHIP_15),
  // QC/ON/BC: 4 items ~$110 + $15 shipping
  makeCA('QC_U150_M4', 'Quebec - 4 produits <150$ + livraison', 'QC', UNDER_150_MULTI_4, SHIP_15),
  makeCA('ON_U150_M4', 'Ontario - 4 produits <150$ + livraison', 'ON', UNDER_150_MULTI_4, SHIP_15),
  makeCA('BC_U150_M4', 'BC - 4 produits <150$ + livraison', 'BC', UNDER_150_MULTI_4, SHIP_15),
  // QC/ON: petit panier ~$50 + $15 shipping
  makeCA('QC_U150_CHEAP', 'Quebec - Petit panier ~50$ + livraison', 'QC', UNDER_150_SINGLE_B, SHIP_15),
  makeCA('ON_U150_CHEAP', 'Ontario - Petit panier ~50$ + livraison', 'ON', UNDER_150_SINGLE_B, SHIP_15),
  // QC/ON: panier ~$130 + $15 shipping
  makeCA('QC_U150_HIGH', 'Quebec - Panier ~130$ + livraison', 'QC', UNDER_150_SINGLE_C, SHIP_15),
  makeCA('ON_U150_HIGH', 'Ontario - Panier ~130$ + livraison', 'ON', UNDER_150_SINGLE_C, SHIP_15),
  // QC: 3x meme produit ~$90 + $15 shipping
  makeCA('QC_U150_QTY', 'Quebec - 3x meme produit <150$ + livraison', 'QC', UNDER_150_CHEAP_QTY, SHIP_15),
  // QC/ON: livraison $25
  makeCA('QC_U150_SHIP25', 'Quebec - <150$ + livraison $25', 'QC', UNDER_150_SINGLE_B, SHIP_25),
  makeCA('ON_U150_SHIP25', 'Ontario - <150$ + livraison $25', 'ON', UNDER_150_SINGLE_B, SHIP_25),
];

// =====================================================
// CANADA — OVER $150 FREE SHIPPING (52 scenarios)
// =====================================================

const CA_OVER_150: UatScenario[] = [
  // Every province: single expensive item, free shipping
  ...CA_PROVINCES.map(p =>
    makeCA(`${p}_O150_S1`, `${PROVINCE_NAMES[p]} - 1 produit >150$ livraison gratuite`, p, OVER_150_SINGLE, FREE_SHIP)
  ),
  // Every province: 2 items ~$180, free shipping
  ...CA_PROVINCES.map(p =>
    makeCA(`${p}_O150_M2`, `${PROVINCE_NAMES[p]} - 2 produits >150$ livraison gratuite`, p, OVER_150_MULTI_2, FREE_SHIP)
  ),
  // QC/ON/BC/AB: 3 items ~$180, free shipping
  makeCA('QC_O150_M3', 'Quebec - 3 produits >150$ livraison gratuite', 'QC', OVER_150_MULTI_3, FREE_SHIP),
  makeCA('ON_O150_M3', 'Ontario - 3 produits >150$ livraison gratuite', 'ON', OVER_150_MULTI_3, FREE_SHIP),
  makeCA('BC_O150_M3', 'BC - 3 produits >150$ livraison gratuite', 'BC', OVER_150_MULTI_3, FREE_SHIP),
  makeCA('AB_O150_M3', 'Alberta - 3 produits >150$ livraison gratuite', 'AB', OVER_150_MULTI_3, FREE_SHIP),
  // QC/ON/BC: 4 items ~$190, free shipping
  makeCA('QC_O150_M4', 'Quebec - 4 produits >150$ livraison gratuite', 'QC', OVER_150_MULTI_4, FREE_SHIP),
  makeCA('ON_O150_M4', 'Ontario - 4 produits >150$ livraison gratuite', 'ON', OVER_150_MULTI_4, FREE_SHIP),
  makeCA('BC_O150_M4', 'BC - 4 produits >150$ livraison gratuite', 'BC', OVER_150_MULTI_4, FREE_SHIP),
  // QC/ON: ~$300, free shipping
  makeCA('QC_O150_HIGH', 'Quebec - Panier ~300$ livraison gratuite', 'QC', OVER_150_SINGLE_B, FREE_SHIP),
  makeCA('ON_O150_HIGH', 'Ontario - Panier ~300$ livraison gratuite', 'ON', OVER_150_SINGLE_B, FREE_SHIP),
  // QC/ON: ~$450, free shipping
  makeCA('QC_O150_PREMIUM', 'Quebec - Panier premium ~450$ livraison gratuite', 'QC', OVER_150_SINGLE_C, FREE_SHIP),
  makeCA('ON_O150_PREMIUM', 'Ontario - Panier premium ~450$ livraison gratuite', 'ON', OVER_150_SINGLE_C, FREE_SHIP),
  // QC: produit le + cher, free shipping
  makeCA('QC_O150_MAX', 'Quebec - Produit le plus cher livraison gratuite', 'QC', OVER_150_EXPENSIVE, FREE_SHIP),
  // QC/ON: 3x meme produit ~$210, free shipping
  makeCA('QC_O150_QTY', 'Quebec - 3x meme produit >150$ livraison gratuite', 'QC', OVER_150_MID_QTY, FREE_SHIP),
  makeCA('ON_O150_QTY', 'Ontario - 3x meme produit >150$ livraison gratuite', 'ON', OVER_150_MID_QTY, FREE_SHIP),
];

// =====================================================
// USA — UNDER $150 WITH SHIPPING (10 scenarios)
// =====================================================

const US_UNDER_150: UatScenario[] = US_STATES.map(st =>
  makeUS(`US_${st}_U150`, `USA ${US_STATE_NAMES[st]} - <150$ + livraison`, st, UNDER_150_SINGLE, SHIP_20)
);

// =====================================================
// USA — OVER $150 FREE SHIPPING (10 scenarios)
// =====================================================

const US_OVER_150: UatScenario[] = US_STATES.map(st =>
  makeUS(`US_${st}_O150`, `USA ${US_STATE_NAMES[st]} - >150$ livraison gratuite`, st, OVER_150_SINGLE, FREE_SHIP)
);

// =====================================================
// INTERNATIONAL — UNDER $150 WITH SHIPPING (5 scenarios)
// =====================================================

const INTL_UNDER_150: UatScenario[] = INTL_COUNTRIES.map(def =>
  makeIntl(`${def.code}_U150`, `${def.name} - <150$ + livraison`, def, UNDER_150_SINGLE, { required: true, amount: def.shipCost })
);

// =====================================================
// INTERNATIONAL — OVER $150 FREE SHIPPING (5 scenarios)
// =====================================================

const INTL_OVER_150: UatScenario[] = INTL_COUNTRIES.map(def =>
  makeIntl(`${def.code}_O150`, `${def.name} - >150$ livraison gratuite`, def, OVER_150_SINGLE, FREE_SHIP)
);

// =====================================================
// EDGE CASES & SPECIAL SCENARIOS (18 scenarios)
// =====================================================

const EDGE_CASES: UatScenario[] = [
  // Rounding tests
  makeCA('ROUND_QC_333', 'Arrondi QC: 3x 33.33$', 'QC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 33.33 }, { quantity: 1, priceRange: 'exact', exactPrice: 33.33 }, { quantity: 1, priceRange: 'exact', exactPrice: 33.33 }],
    SHIP_15),
  makeCA('ROUND_ON_1429', 'Arrondi ON: 7x 14.29$', 'ON',
    Array(7).fill({ quantity: 1, priceRange: 'exact', exactPrice: 14.29 }),
    FREE_SHIP),
  makeCA('ROUND_BC_1999', 'Arrondi BC: 19.99$', 'BC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 19.99 }],
    SHIP_15),

  // Boundary: exactly at $150 threshold
  makeCA('QC_BOUNDARY_149', 'Quebec - Juste sous 150$ (149.99)', 'QC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 149.99 }],
    SHIP_15),
  makeCA('QC_BOUNDARY_150', 'Quebec - Exactement 150$', 'QC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 150.00 }],
    FREE_SHIP),
  makeCA('ON_BOUNDARY_149', 'Ontario - Juste sous 150$ (149.99)', 'ON',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 149.99 }],
    SHIP_15),
  makeCA('ON_BOUNDARY_150', 'Ontario - Exactement 150$', 'ON',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 150.00 }],
    FREE_SHIP),

  // Min/Max orders
  makeCA('QC_MIN_001', 'Quebec - Commande minimale 0.01$', 'QC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 0.01 }],
    { required: false }),
  makeCA('QC_MAX_9999', 'Quebec - Commande max 9999.99$', 'QC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 9999.99 }],
    FREE_SHIP),

  // Refund scenarios
  makeCA('QC_REFUND_U150', 'Quebec - Remboursement <150$', 'QC', UNDER_150_SINGLE, SHIP_15, ['refund']),
  makeCA('ON_REFUND_U150', 'Ontario - Remboursement <150$', 'ON', UNDER_150_SINGLE, SHIP_15, ['refund']),
  makeCA('BC_REFUND_O150', 'BC - Remboursement >150$', 'BC', OVER_150_SINGLE, FREE_SHIP, ['refund']),
  makeCA('QC_REFUND_MULTI', 'Quebec - Remboursement multi-produits', 'QC', OVER_150_MULTI_3, FREE_SHIP, ['refund']),

  // Reship scenarios
  makeCA('QC_RESHIP_U150', 'Quebec - Re-expedition <150$', 'QC', UNDER_150_SINGLE, SHIP_15, ['reship']),
  makeCA('ON_RESHIP_O150', 'Ontario - Re-expedition >150$', 'ON', OVER_150_SINGLE, FREE_SHIP, ['reship']),

  // Zero tax product
  makeCA('QC_ZERO_PRICE', 'Quebec - Produit a 0$', 'QC',
    [{ quantity: 1, priceRange: 'exact', exactPrice: 0 }],
    { required: false }),

  // All products
  makeCA('QC_ALL_ITEMS', 'Quebec - Tous les produits disponibles', 'QC',
    [{ quantity: 1, priceRange: 'all' }],
    FREE_SHIP),

  // Shipping cost variations
  makeCA('QC_SHIP_25', 'Quebec - Livraison $25', 'QC', UNDER_150_SINGLE_B, SHIP_25),
];

// =====================================================
// COMBINED EXPORTS
// =====================================================

/** All Canadian scenarios (under + over + edge) */
export const CANADIAN_SCENARIOS: UatScenario[] = [
  ...CA_UNDER_150,
  ...CA_OVER_150,
  ...EDGE_CASES,
];

/** All international scenarios (US + other) */
export const INTERNATIONAL_SCENARIOS: UatScenario[] = [
  ...US_UNDER_150,
  ...US_OVER_150,
  ...INTL_UNDER_150,
  ...INTL_OVER_150,
];

/**
 * Get all scenarios based on canadaOnly flag
 */
export function getScenarios(canadaOnly: boolean): UatScenario[] {
  if (canadaOnly) {
    return CANADIAN_SCENARIOS;
  }
  return [...CANADIAN_SCENARIOS, ...INTERNATIONAL_SCENARIOS];
}

/**
 * Summary stats
 */
export function getScenarioStats(canadaOnly: boolean) {
  const scenarios = getScenarios(canadaOnly);
  const under150 = scenarios.filter(s => s.shipping.required);
  const over150 = scenarios.filter(s => !s.shipping.required);
  const regions = new Set(scenarios.map(s => s.region));

  return {
    total: scenarios.length,
    under150: under150.length,
    over150: over150.length,
    regions: regions.size,
    countries: new Set(scenarios.map(s => s.country)).size,
    withRefund: scenarios.filter(s => s.postActions?.includes('refund')).length,
    withReship: scenarios.filter(s => s.postActions?.includes('reship')).length,
  };
}

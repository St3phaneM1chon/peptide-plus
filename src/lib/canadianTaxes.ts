/**
 * CANADIAN & US TAX SYSTEM
 * Calcul des taxes basé sur la province/état de livraison du client
 * 
 * CANADA:
 * Les taxes sont déterminées par la province du CLIENT (lieu de fourniture)
 * Pour les biens physiques: utiliser l'adresse de LIVRAISON
 * 
 * USA (Exportations):
 * Les exportations du Canada vers les USA sont DÉTAXÉES (zero-rated)
 * - 0% GST/HST/PST/QST
 * - L'entreprise peut réclamer ses CTI (crédits de taxe sur intrants)
 * - Les taxes de vente américaines sont gérées par les marketplaces OU
 *   l'entreprise doit s'inscrire si elle dépasse les seuils de nexus
 */

// Exchange rate CAD to USD (should be fetched from API in production)
export const CAD_TO_USD_RATE = 0.73; // Approximate rate - update regularly
export const USD_TO_CAD_RATE = 1.37;

export interface ProvinceTaxInfo {
  code: string;
  name: string;
  nameFr: string;
  country: 'CA' | 'US';
  taxType: 'HST' | 'GST_PST' | 'GST_QST' | 'GST_RST' | 'GST_ONLY' | 'EXPORT_ZERO';
  gst: number;        // Federal GST rate
  hst?: number;       // Combined HST rate (replaces GST in HST provinces)
  pst?: number;       // Provincial Sales Tax
  qst?: number;       // Quebec Sales Tax
  rst?: number;       // Retail Sales Tax (Manitoba)
  totalRate: number;  // Total combined rate
}

// =====================================================
// CANADIAN PROVINCES
// =====================================================
export const CANADIAN_PROVINCES: Record<string, ProvinceTaxInfo> = {
  // HST Provinces (Combined federal + provincial)
  ON: {
    code: 'ON',
    name: 'Ontario',
    nameFr: 'Ontario',
    country: 'CA',
    taxType: 'HST',
    gst: 0,
    hst: 0.13,
    totalRate: 0.13,
  },
  NB: {
    code: 'NB',
    name: 'New Brunswick',
    nameFr: 'Nouveau-Brunswick',
    country: 'CA',
    taxType: 'HST',
    gst: 0,
    hst: 0.15,
    totalRate: 0.15,
  },
  NS: {
    code: 'NS',
    name: 'Nova Scotia',
    nameFr: 'Nouvelle-Écosse',
    country: 'CA',
    taxType: 'HST',
    gst: 0,
    hst: 0.14,
    totalRate: 0.14,
  },
  NL: {
    code: 'NL',
    name: 'Newfoundland and Labrador',
    nameFr: 'Terre-Neuve-et-Labrador',
    country: 'CA',
    taxType: 'HST',
    gst: 0,
    hst: 0.15,
    totalRate: 0.15,
  },
  PE: {
    code: 'PE',
    name: 'Prince Edward Island',
    nameFr: 'Île-du-Prince-Édouard',
    country: 'CA',
    taxType: 'HST',
    gst: 0,
    hst: 0.15,
    totalRate: 0.15,
  },

  // GST + PST Provinces
  BC: {
    code: 'BC',
    name: 'British Columbia',
    nameFr: 'Colombie-Britannique',
    country: 'CA',
    taxType: 'GST_PST',
    gst: 0.05,
    pst: 0.07,
    totalRate: 0.12,
  },
  SK: {
    code: 'SK',
    name: 'Saskatchewan',
    nameFr: 'Saskatchewan',
    country: 'CA',
    taxType: 'GST_PST',
    gst: 0.05,
    pst: 0.06,
    totalRate: 0.11,
  },

  // GST + RST (Manitoba)
  MB: {
    code: 'MB',
    name: 'Manitoba',
    nameFr: 'Manitoba',
    country: 'CA',
    taxType: 'GST_RST',
    gst: 0.05,
    rst: 0.07,
    totalRate: 0.12,
  },

  // GST + QST (Quebec)
  QC: {
    code: 'QC',
    name: 'Quebec',
    nameFr: 'Québec',
    country: 'CA',
    taxType: 'GST_QST',
    gst: 0.05,
    qst: 0.09975,
    totalRate: 0.14975,
  },

  // GST Only Provinces/Territories
  AB: {
    code: 'AB',
    name: 'Alberta',
    nameFr: 'Alberta',
    country: 'CA',
    taxType: 'GST_ONLY',
    gst: 0.05,
    totalRate: 0.05,
  },
  YT: {
    code: 'YT',
    name: 'Yukon',
    nameFr: 'Yukon',
    country: 'CA',
    taxType: 'GST_ONLY',
    gst: 0.05,
    totalRate: 0.05,
  },
  NT: {
    code: 'NT',
    name: 'Northwest Territories',
    nameFr: 'Territoires du Nord-Ouest',
    country: 'CA',
    taxType: 'GST_ONLY',
    gst: 0.05,
    totalRate: 0.05,
  },
  NU: {
    code: 'NU',
    name: 'Nunavut',
    nameFr: 'Nunavut',
    country: 'CA',
    taxType: 'GST_ONLY',
    gst: 0.05,
    totalRate: 0.05,
  },
};

// =====================================================
// US STATES - EXPORTS (Zero-rated from Canada)
// Note: US sales taxes are NOT collected by Canadian sellers
// unless they have nexus (>$100k sales or physical presence)
// Marketplaces (Amazon, eBay) collect US taxes automatically
// =====================================================
export const US_STATES: Record<string, ProvinceTaxInfo> = {
  // All US states are zero-rated for Canadian exports
  AL: { code: 'AL', name: 'Alabama', nameFr: 'Alabama', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AK: { code: 'AK', name: 'Alaska', nameFr: 'Alaska', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AZ: { code: 'AZ', name: 'Arizona', nameFr: 'Arizona', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AR: { code: 'AR', name: 'Arkansas', nameFr: 'Arkansas', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CA: { code: 'CA', name: 'California', nameFr: 'Californie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CO: { code: 'CO', name: 'Colorado', nameFr: 'Colorado', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CT: { code: 'CT', name: 'Connecticut', nameFr: 'Connecticut', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  DE: { code: 'DE', name: 'Delaware', nameFr: 'Delaware', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  FL: { code: 'FL', name: 'Florida', nameFr: 'Floride', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  GA: { code: 'GA', name: 'Georgia', nameFr: 'Géorgie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  HI: { code: 'HI', name: 'Hawaii', nameFr: 'Hawaï', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  ID: { code: 'ID', name: 'Idaho', nameFr: 'Idaho', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IL: { code: 'IL', name: 'Illinois', nameFr: 'Illinois', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IN: { code: 'IN', name: 'Indiana', nameFr: 'Indiana', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IA: { code: 'IA', name: 'Iowa', nameFr: 'Iowa', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  KS: { code: 'KS', name: 'Kansas', nameFr: 'Kansas', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  KY: { code: 'KY', name: 'Kentucky', nameFr: 'Kentucky', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LA: { code: 'LA', name: 'Louisiana', nameFr: 'Louisiane', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  ME: { code: 'ME', name: 'Maine', nameFr: 'Maine', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MD: { code: 'MD', name: 'Maryland', nameFr: 'Maryland', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MA: { code: 'MA', name: 'Massachusetts', nameFr: 'Massachusetts', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MI: { code: 'MI', name: 'Michigan', nameFr: 'Michigan', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MN: { code: 'MN', name: 'Minnesota', nameFr: 'Minnesota', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MS: { code: 'MS', name: 'Mississippi', nameFr: 'Mississippi', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MO: { code: 'MO', name: 'Missouri', nameFr: 'Missouri', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MT: { code: 'MT', name: 'Montana', nameFr: 'Montana', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NE: { code: 'NE', name: 'Nebraska', nameFr: 'Nebraska', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NV: { code: 'NV', name: 'Nevada', nameFr: 'Nevada', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NH: { code: 'NH', name: 'New Hampshire', nameFr: 'New Hampshire', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NJ: { code: 'NJ', name: 'New Jersey', nameFr: 'New Jersey', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NM: { code: 'NM', name: 'New Mexico', nameFr: 'Nouveau-Mexique', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NY: { code: 'NY', name: 'New York', nameFr: 'New York', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NC: { code: 'NC', name: 'North Carolina', nameFr: 'Caroline du Nord', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  ND: { code: 'ND', name: 'North Dakota', nameFr: 'Dakota du Nord', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  OH: { code: 'OH', name: 'Ohio', nameFr: 'Ohio', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  OK: { code: 'OK', name: 'Oklahoma', nameFr: 'Oklahoma', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  OR: { code: 'OR', name: 'Oregon', nameFr: 'Oregon', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PA: { code: 'PA', name: 'Pennsylvania', nameFr: 'Pennsylvanie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  RI: { code: 'RI', name: 'Rhode Island', nameFr: 'Rhode Island', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SC: { code: 'SC', name: 'South Carolina', nameFr: 'Caroline du Sud', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SD: { code: 'SD', name: 'South Dakota', nameFr: 'Dakota du Sud', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TN: { code: 'TN', name: 'Tennessee', nameFr: 'Tennessee', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TX: { code: 'TX', name: 'Texas', nameFr: 'Texas', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  UT: { code: 'UT', name: 'Utah', nameFr: 'Utah', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VT: { code: 'VT', name: 'Vermont', nameFr: 'Vermont', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VA: { code: 'VA', name: 'Virginia', nameFr: 'Virginie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  WA: { code: 'WA', name: 'Washington', nameFr: 'Washington', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  WV: { code: 'WV', name: 'West Virginia', nameFr: 'Virginie-Occidentale', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  WI: { code: 'WI', name: 'Wisconsin', nameFr: 'Wisconsin', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  WY: { code: 'WY', name: 'Wyoming', nameFr: 'Wyoming', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  DC: { code: 'DC', name: 'District of Columbia', nameFr: 'District de Columbia', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// MEXICO - EXPORTS (Zero-rated from Canada, CPTPP member)
// =====================================================
export const MEXICO_STATES: Record<string, ProvinceTaxInfo> = {
  MX: { code: 'MX', name: 'Mexico', nameFr: 'Mexique', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// CENTRAL AMERICA - EXPORTS (Zero-rated from Canada)
// Countries with FTA: Costa Rica, Panama, Honduras
// =====================================================
export const CENTRAL_AMERICA: Record<string, ProvinceTaxInfo> = {
  CR: { code: 'CR', name: 'Costa Rica', nameFr: 'Costa Rica', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PA: { code: 'PA', name: 'Panama', nameFr: 'Panama', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  HN: { code: 'HN', name: 'Honduras', nameFr: 'Honduras', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  GT: { code: 'GT', name: 'Guatemala', nameFr: 'Guatemala', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SV: { code: 'SV', name: 'El Salvador', nameFr: 'El Salvador', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NI: { code: 'NI', name: 'Nicaragua', nameFr: 'Nicaragua', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BZ: { code: 'BZ', name: 'Belize', nameFr: 'Belize', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// SOUTH AMERICA - EXPORTS (Zero-rated from Canada)
// Countries with FTA: Chile, Peru, Colombia (CPTPP + bilateral)
// NOTE: Brazil is EXCLUDED due to extremely complex tax system (70%+ cumulative taxes)
// =====================================================
export const SOUTH_AMERICA: Record<string, ProvinceTaxInfo> = {
  // Countries WITH Free Trade Agreements (best access)
  CL: { code: 'CL', name: 'Chile', nameFr: 'Chili', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PE: { code: 'PE', name: 'Peru', nameFr: 'Pérou', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CO: { code: 'CO', name: 'Colombia', nameFr: 'Colombie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Countries WITHOUT FTA (standard tariffs apply at destination)
  AR: { code: 'AR', name: 'Argentina', nameFr: 'Argentine', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  EC: { code: 'EC', name: 'Ecuador', nameFr: 'Équateur', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  UY: { code: 'UY', name: 'Uruguay', nameFr: 'Uruguay', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PY: { code: 'PY', name: 'Paraguay', nameFr: 'Paraguay', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BO: { code: 'BO', name: 'Bolivia', nameFr: 'Bolivie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VE: { code: 'VE', name: 'Venezuela', nameFr: 'Venezuela', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  GY: { code: 'GY', name: 'Guyana', nameFr: 'Guyana', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SR: { code: 'SR', name: 'Suriname', nameFr: 'Suriname', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // BRAZIL IS INTENTIONALLY EXCLUDED - Tax system too complex (70%+ cumulative taxes)
};

// =====================================================
// CARIBBEAN - EXPORTS (Zero-rated from Canada)
// CARIBCAN program provides preferential trade relations
// =====================================================
export const CARIBBEAN: Record<string, ProvinceTaxInfo> = {
  // CARIBCAN Member Countries
  JM: { code: 'JM', name: 'Jamaica', nameFr: 'Jamaïque', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TT: { code: 'TT', name: 'Trinidad and Tobago', nameFr: 'Trinité-et-Tobago', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BB: { code: 'BB', name: 'Barbados', nameFr: 'Barbade', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BS: { code: 'BS', name: 'Bahamas', nameFr: 'Bahamas', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AG: { code: 'AG', name: 'Antigua and Barbuda', nameFr: 'Antigua-et-Barbuda', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  GD: { code: 'GD', name: 'Grenada', nameFr: 'Grenade', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LC: { code: 'LC', name: 'Saint Lucia', nameFr: 'Sainte-Lucie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VC: { code: 'VC', name: 'Saint Vincent and the Grenadines', nameFr: 'Saint-Vincent-et-les-Grenadines', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  KN: { code: 'KN', name: 'Saint Kitts and Nevis', nameFr: 'Saint-Kitts-et-Nevis', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  DM: { code: 'DM', name: 'Dominica', nameFr: 'Dominique', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Other Caribbean
  DO: { code: 'DO', name: 'Dominican Republic', nameFr: 'République dominicaine', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  HT: { code: 'HT', name: 'Haiti', nameFr: 'Haïti', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CU: { code: 'CU', name: 'Cuba', nameFr: 'Cuba', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PR: { code: 'PR', name: 'Puerto Rico', nameFr: 'Porto Rico', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AW: { code: 'AW', name: 'Aruba', nameFr: 'Aruba', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CW: { code: 'CW', name: 'Curaçao', nameFr: 'Curaçao', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CAYMAN: { code: 'CAYMAN', name: 'Cayman Islands', nameFr: 'Îles Caïmans', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TC: { code: 'TC', name: 'Turks and Caicos Islands', nameFr: 'Îles Turks-et-Caïcos', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VI: { code: 'VI', name: 'U.S. Virgin Islands', nameFr: 'Îles Vierges américaines', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VG: { code: 'VG', name: 'British Virgin Islands', nameFr: 'Îles Vierges britanniques', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  GP: { code: 'GP', name: 'Guadeloupe', nameFr: 'Guadeloupe', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MQ: { code: 'MQ', name: 'Martinique', nameFr: 'Martinique', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// EUROPEAN UNION - CETA Agreement (99% tariffs eliminated)
// All exports zero-rated from Canada
// Destination VAT: 15-27% depending on country
// =====================================================
export const EUROPEAN_UNION: Record<string, ProvinceTaxInfo> = {
  // Western Europe
  FR: { code: 'FR', name: 'France', nameFr: 'France', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  DE: { code: 'DE', name: 'Germany', nameFr: 'Allemagne', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IT: { code: 'IT', name: 'Italy', nameFr: 'Italie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  ES: { code: 'ES', name: 'Spain', nameFr: 'Espagne', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PT: { code: 'PT', name: 'Portugal', nameFr: 'Portugal', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NL: { code: 'NL', name: 'Netherlands', nameFr: 'Pays-Bas', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BE: { code: 'BE', name: 'Belgium', nameFr: 'Belgique', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LU: { code: 'LU', name: 'Luxembourg', nameFr: 'Luxembourg', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AT: { code: 'AT', name: 'Austria', nameFr: 'Autriche', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IE: { code: 'IE', name: 'Ireland', nameFr: 'Irlande', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Northern Europe
  SE: { code: 'SE', name: 'Sweden', nameFr: 'Suède', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  DK: { code: 'DK', name: 'Denmark', nameFr: 'Danemark', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  FI: { code: 'FI', name: 'Finland', nameFr: 'Finlande', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Eastern Europe
  PL: { code: 'PL', name: 'Poland', nameFr: 'Pologne', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CZ: { code: 'CZ', name: 'Czech Republic', nameFr: 'République tchèque', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SK: { code: 'SK', name: 'Slovakia', nameFr: 'Slovaquie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  HU: { code: 'HU', name: 'Hungary', nameFr: 'Hongrie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  RO: { code: 'RO', name: 'Romania', nameFr: 'Roumanie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BG: { code: 'BG', name: 'Bulgaria', nameFr: 'Bulgarie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  HR: { code: 'HR', name: 'Croatia', nameFr: 'Croatie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SI: { code: 'SI', name: 'Slovenia', nameFr: 'Slovénie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Baltic States
  EE: { code: 'EE', name: 'Estonia', nameFr: 'Estonie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LV: { code: 'LV', name: 'Latvia', nameFr: 'Lettonie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LT: { code: 'LT', name: 'Lithuania', nameFr: 'Lituanie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Mediterranean
  GR: { code: 'GR', name: 'Greece', nameFr: 'Grèce', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  CY: { code: 'CY', name: 'Cyprus', nameFr: 'Chypre', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MT: { code: 'MT', name: 'Malta', nameFr: 'Malte', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// UNITED KINGDOM - TCA Agreement (99% tariffs eliminated)
// Post-Brexit separate from EU
// =====================================================
export const UNITED_KINGDOM: Record<string, ProvinceTaxInfo> = {
  GB: { code: 'GB', name: 'United Kingdom', nameFr: 'Royaume-Uni', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// OTHER EUROPE (non-EU, non-UK)
// =====================================================
export const OTHER_EUROPE: Record<string, ProvinceTaxInfo> = {
  CH: { code: 'CH', name: 'Switzerland', nameFr: 'Suisse', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NO: { code: 'NO', name: 'Norway', nameFr: 'Norvège', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IS: { code: 'IS', name: 'Iceland', nameFr: 'Islande', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  UA: { code: 'UA', name: 'Ukraine', nameFr: 'Ukraine', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// MIDDLE EAST - GCC + Others
// =====================================================
export const MIDDLE_EAST: Record<string, ProvinceTaxInfo> = {
  // GCC Countries (Gulf Cooperation Council)
  AE: { code: 'AE', name: 'United Arab Emirates', nameFr: 'Émirats arabes unis', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SA: { code: 'SA', name: 'Saudi Arabia', nameFr: 'Arabie saoudite', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  QA: { code: 'QA', name: 'Qatar', nameFr: 'Qatar', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  KW: { code: 'KW', name: 'Kuwait', nameFr: 'Koweït', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  OM: { code: 'OM', name: 'Oman', nameFr: 'Oman', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BH: { code: 'BH', name: 'Bahrain', nameFr: 'Bahreïn', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Other Middle East (with FTA)
  IL: { code: 'IL', name: 'Israel', nameFr: 'Israël', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  JO: { code: 'JO', name: 'Jordan', nameFr: 'Jordanie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  // Other Middle East (no FTA)
  TR: { code: 'TR', name: 'Turkey', nameFr: 'Turquie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LB: { code: 'LB', name: 'Lebanon', nameFr: 'Liban', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  EG: { code: 'EG', name: 'Egypt', nameFr: 'Égypte', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IQ: { code: 'IQ', name: 'Iraq', nameFr: 'Irak', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IR: { code: 'IR', name: 'Iran', nameFr: 'Iran', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// NORTH AFRICA
// =====================================================
export const NORTH_AFRICA: Record<string, ProvinceTaxInfo> = {
  MA: { code: 'MA', name: 'Morocco', nameFr: 'Maroc', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  DZ: { code: 'DZ', name: 'Algeria', nameFr: 'Algérie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TN: { code: 'TN', name: 'Tunisia', nameFr: 'Tunisie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LY: { code: 'LY', name: 'Libya', nameFr: 'Libye', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// ASIA-PACIFIC - CPTPP Members
// =====================================================
export const ASIA_PACIFIC_CPTPP: Record<string, ProvinceTaxInfo> = {
  JP: { code: 'JP', name: 'Japan', nameFr: 'Japon', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  AU: { code: 'AU', name: 'Australia', nameFr: 'Australie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  NZ: { code: 'NZ', name: 'New Zealand', nameFr: 'Nouvelle-Zélande', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  SG: { code: 'SG', name: 'Singapore', nameFr: 'Singapour', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MY: { code: 'MY', name: 'Malaysia', nameFr: 'Malaisie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  VN: { code: 'VN', name: 'Vietnam', nameFr: 'Vietnam', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BN: { code: 'BN', name: 'Brunei', nameFr: 'Brunei', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// =====================================================
// ASIA - OTHER (RCEP members without CPTPP, no Canada FTA)
// =====================================================
export const ASIA_OTHER: Record<string, ProvinceTaxInfo> = {
  CN: { code: 'CN', name: 'China', nameFr: 'Chine', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  KR: { code: 'KR', name: 'South Korea', nameFr: 'Corée du Sud', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  IN: { code: 'IN', name: 'India', nameFr: 'Inde', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  ID: { code: 'ID', name: 'Indonesia', nameFr: 'Indonésie', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TH: { code: 'TH', name: 'Thailand', nameFr: 'Thaïlande', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PH: { code: 'PH', name: 'Philippines', nameFr: 'Philippines', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  PK: { code: 'PK', name: 'Pakistan', nameFr: 'Pakistan', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  BD: { code: 'BD', name: 'Bangladesh', nameFr: 'Bangladesh', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LK: { code: 'LK', name: 'Sri Lanka', nameFr: 'Sri Lanka', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  MM: { code: 'MM', name: 'Myanmar', nameFr: 'Myanmar', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  KH: { code: 'KH', name: 'Cambodia', nameFr: 'Cambodge', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  LA: { code: 'LA', name: 'Laos', nameFr: 'Laos', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  HK: { code: 'HK', name: 'Hong Kong', nameFr: 'Hong Kong', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
  TW: { code: 'TW', name: 'Taiwan', nameFr: 'Taïwan', country: 'US', taxType: 'EXPORT_ZERO', gst: 0, totalRate: 0 },
};

// Combined regions lookup
export const ALL_REGIONS: Record<string, ProvinceTaxInfo> = {
  ...CANADIAN_PROVINCES,
  ...US_STATES,
  ...MEXICO_STATES,
  ...CENTRAL_AMERICA,
  ...SOUTH_AMERICA,
  ...CARIBBEAN,
  ...EUROPEAN_UNION,
  ...UNITED_KINGDOM,
  ...OTHER_EUROPE,
  ...MIDDLE_EAST,
  ...NORTH_AFRICA,
  ...ASIA_PACIFIC_CPTPP,
  ...ASIA_OTHER,
};

export interface TaxBreakdown {
  province: ProvinceTaxInfo;
  subtotal: number;
  subtotalUSD: number;
  gstAmount: number;
  hstAmount: number;
  pstAmount: number;
  qstAmount: number;
  rstAmount: number;
  totalTax: number;
  totalTaxUSD: number;
  grandTotal: number;
  grandTotalUSD: number;
  isExport: boolean;
  // Labels for display
  federalTaxLabel: string;
  federalTaxRate: string;
  provincialTaxLabel: string | null;
  provincialTaxRate: string | null;
}

// Supported country codes
export type SupportedCountry = 'CA' | 'US' | 'MX' | 'LATAM' | 'CARIB';

// Shipping rates by region
export interface ShippingRates {
  region: string;
  regionFr: string;
  baseRate: number;        // CAD
  freeShippingThreshold: number | null;  // null = no free shipping
  estimatedDays: string;
  requiresCERS: boolean;   // Canadian Export Reporting System required for >$2000 CAD
  hasFTA: boolean;         // Has Free Trade Agreement
  ftaName?: string;        // Name of the FTA
}

export const SHIPPING_RATES: Record<string, ShippingRates> = {
  CA: {
    region: 'Canada',
    regionFr: 'Canada',
    baseRate: 15,
    freeShippingThreshold: 200,  // Free shipping over $200 CAD in Canada
    estimatedDays: '2-5',
    requiresCERS: false,
    hasFTA: true,
  },
  US: {
    region: 'United States',
    regionFr: 'États-Unis',
    baseRate: 25,
    freeShippingThreshold: null,
    estimatedDays: '5-10',
    requiresCERS: false,
    hasFTA: true,
    ftaName: 'CUSMA/USMCA',
  },
  MX: {
    region: 'Mexico',
    regionFr: 'Mexique',
    baseRate: 35,
    freeShippingThreshold: null,
    estimatedDays: '7-14',
    requiresCERS: true,
    hasFTA: true,
    ftaName: 'CPTPP + CUSMA',
  },
  LATAM: {
    region: 'Latin America',
    regionFr: 'Amérique latine',
    baseRate: 45,
    freeShippingThreshold: null,
    estimatedDays: '10-20',
    requiresCERS: true,
    hasFTA: false, // Some have FTA, some don't
  },
  CARIB: {
    region: 'Caribbean',
    regionFr: 'Caraïbes',
    baseRate: 40,
    freeShippingThreshold: null,
    estimatedDays: '7-15',
    requiresCERS: true,
    hasFTA: false, // CARIBCAN is preferential but not full FTA
    ftaName: 'CARIBCAN',
  },
  EU: {
    region: 'European Union',
    regionFr: 'Union européenne',
    baseRate: 50,
    freeShippingThreshold: null,
    estimatedDays: '7-14',
    requiresCERS: true,
    hasFTA: true,
    ftaName: 'CETA (99% tariffs eliminated)',
  },
  UK: {
    region: 'United Kingdom',
    regionFr: 'Royaume-Uni',
    baseRate: 45,
    freeShippingThreshold: null,
    estimatedDays: '7-12',
    requiresCERS: true,
    hasFTA: true,
    ftaName: 'TCA (99% tariffs eliminated)',
  },
  EUROPE_OTHER: {
    region: 'Other Europe',
    regionFr: 'Autre Europe',
    baseRate: 55,
    freeShippingThreshold: null,
    estimatedDays: '10-18',
    requiresCERS: true,
    hasFTA: false,
  },
  MENA: {
    region: 'Middle East & North Africa',
    regionFr: 'Moyen-Orient et Afrique du Nord',
    baseRate: 60,
    freeShippingThreshold: null,
    estimatedDays: '10-20',
    requiresCERS: true,
    hasFTA: false, // Israel and Jordan have FTAs
  },
  ASIA_CPTPP: {
    region: 'Asia-Pacific (CPTPP)',
    regionFr: 'Asie-Pacifique (PTPGP)',
    baseRate: 55,
    freeShippingThreshold: null,
    estimatedDays: '10-18',
    requiresCERS: true,
    hasFTA: true,
    ftaName: 'CPTPP (90% tariffs eliminated)',
  },
  ASIA_OTHER: {
    region: 'Asia (Other)',
    regionFr: 'Asie (Autre)',
    baseRate: 65,
    freeShippingThreshold: null,
    estimatedDays: '14-25',
    requiresCERS: true,
    hasFTA: false,
  },
};

// Map country codes to shipping regions
export function getShippingRegion(countryCode: string): string {
  if (countryCode === 'CA') return 'CA';
  if (US_STATES[countryCode] || countryCode === 'US') return 'US';
  if (MEXICO_STATES[countryCode] || countryCode === 'MX') return 'MX';
  if (CENTRAL_AMERICA[countryCode] || SOUTH_AMERICA[countryCode]) return 'LATAM';
  if (CARIBBEAN[countryCode]) return 'CARIB';
  if (EUROPEAN_UNION[countryCode]) return 'EU';
  if (UNITED_KINGDOM[countryCode] || countryCode === 'GB') return 'UK';
  if (OTHER_EUROPE[countryCode]) return 'EUROPE_OTHER';
  if (MIDDLE_EAST[countryCode] || NORTH_AFRICA[countryCode]) return 'MENA';
  if (ASIA_PACIFIC_CPTPP[countryCode]) return 'ASIA_CPTPP';
  if (ASIA_OTHER[countryCode]) return 'ASIA_OTHER';
  return 'ASIA_OTHER'; // Default for unknown international
}

/**
 * Calculate taxes based on shipping province/state/country
 * For all exports outside Canada: 0% tax (zero-rated export)
 */
export function calculateTaxes(subtotal: number, regionCode: string, country: string = 'CA'): TaxBreakdown {
  // Determine the region info
  let province: ProvinceTaxInfo;
  const isExport = country !== 'CA';
  
  if (country === 'CA') {
    province = CANADIAN_PROVINCES[regionCode.toUpperCase()] || CANADIAN_PROVINCES.QC;
  } else {
    // Try to find the region in all international regions
    province = ALL_REGIONS[regionCode.toUpperCase()] || 
               US_STATES[regionCode.toUpperCase()] ||
               CENTRAL_AMERICA[regionCode.toUpperCase()] ||
               SOUTH_AMERICA[regionCode.toUpperCase()] ||
               CARIBBEAN[regionCode.toUpperCase()] ||
               { code: regionCode, name: regionCode, nameFr: regionCode, country: 'US' as const, taxType: 'EXPORT_ZERO' as const, gst: 0, totalRate: 0 };
  }
  
  let gstAmount = 0;
  let hstAmount = 0;
  let pstAmount = 0;
  let qstAmount = 0;
  let rstAmount = 0;
  let federalTaxLabel = '';
  let federalTaxRate = '';
  let provincialTaxLabel: string | null = null;
  let provincialTaxRate: string | null = null;

  // US exports are zero-rated - no Canadian taxes
  if (isExport || province.taxType === 'EXPORT_ZERO') {
    federalTaxLabel = 'Tax';
    federalTaxRate = '0%';
  } else {
    switch (province.taxType) {
      case 'HST':
        hstAmount = subtotal * (province.hst || 0);
        federalTaxLabel = 'HST';
        federalTaxRate = `${((province.hst || 0) * 100).toFixed(0)}%`;
        break;

      case 'GST_PST':
        gstAmount = subtotal * province.gst;
        pstAmount = subtotal * (province.pst || 0);
        federalTaxLabel = 'GST';
        federalTaxRate = `${(province.gst * 100).toFixed(0)}%`;
        provincialTaxLabel = 'PST';
        provincialTaxRate = `${((province.pst || 0) * 100).toFixed(0)}%`;
        break;

      case 'GST_QST':
        gstAmount = subtotal * province.gst;
        qstAmount = subtotal * (province.qst || 0);
        federalTaxLabel = 'TPS/GST';
        federalTaxRate = `${(province.gst * 100).toFixed(0)}%`;
        provincialTaxLabel = 'TVQ/QST';
        provincialTaxRate = `${((province.qst || 0) * 100).toFixed(3)}%`;
        break;

      case 'GST_RST':
        gstAmount = subtotal * province.gst;
        rstAmount = subtotal * (province.rst || 0);
        federalTaxLabel = 'GST';
        federalTaxRate = `${(province.gst * 100).toFixed(0)}%`;
        provincialTaxLabel = 'RST';
        provincialTaxRate = `${((province.rst || 0) * 100).toFixed(0)}%`;
        break;

      case 'GST_ONLY':
      default:
        gstAmount = subtotal * province.gst;
        federalTaxLabel = 'GST';
        federalTaxRate = `${(province.gst * 100).toFixed(0)}%`;
        break;
    }
  }

  const totalTax = gstAmount + hstAmount + pstAmount + qstAmount + rstAmount;
  const grandTotal = subtotal + totalTax;

  return {
    province,
    subtotal,
    subtotalUSD: subtotal * CAD_TO_USD_RATE,
    gstAmount,
    hstAmount,
    pstAmount,
    qstAmount,
    rstAmount,
    totalTax,
    totalTaxUSD: totalTax * CAD_TO_USD_RATE,
    grandTotal,
    grandTotalUSD: grandTotal * CAD_TO_USD_RATE,
    isExport,
    federalTaxLabel,
    federalTaxRate,
    provincialTaxLabel,
    provincialTaxRate,
  };
}

/**
 * Calculate shipping cost based on destination country/region
 */
export function calculateShipping(subtotal: number, countryOrRegion: string): { 
  shippingCAD: number; 
  shippingUSD: number; 
  isFree: boolean;
  estimatedDays: string;
  requiresCERS: boolean;
  regionName: string;
} {
  const region = getShippingRegion(countryOrRegion);
  const rates = SHIPPING_RATES[region] || SHIPPING_RATES.LATAM;
  
  // Check for free shipping (only for Canada)
  const isFree = rates.freeShippingThreshold !== null && subtotal >= rates.freeShippingThreshold;
  const shippingCAD = isFree ? 0 : rates.baseRate;
  
  return {
    shippingCAD,
    shippingUSD: shippingCAD * CAD_TO_USD_RATE,
    isFree,
    estimatedDays: rates.estimatedDays,
    requiresCERS: rates.requiresCERS,
    regionName: rates.region,
  };
}

/**
 * Convert CAD to USD
 */
export function cadToUsd(amountCAD: number): number {
  return amountCAD * CAD_TO_USD_RATE;
}

/**
 * Convert USD to CAD
 */
export function usdToCad(amountUSD: number): number {
  return amountUSD * USD_TO_CAD_RATE;
}

/**
 * Get all provinces as array for dropdown
 */
export function getProvincesList(lang: 'en' | 'fr' = 'en', country: 'CA' | 'US' | 'ALL' = 'CA'): Array<{ 
  code: string; 
  name: string; 
  taxRate: string;
  country: 'CA' | 'US';
}> {
  let regions: ProvinceTaxInfo[];
  
  if (country === 'CA') {
    regions = Object.values(CANADIAN_PROVINCES);
  } else if (country === 'US') {
    regions = Object.values(US_STATES);
  } else {
    regions = [...Object.values(CANADIAN_PROVINCES), ...Object.values(US_STATES)];
  }
  
  return regions.map((p) => ({
    code: p.code,
    name: lang === 'fr' ? p.nameFr : p.name,
    taxRate: p.taxType === 'EXPORT_ZERO' 
      ? '0%' 
      : `${(p.totalRate * 100).toFixed(p.code === 'QC' ? 3 : 0)}%`,
    country: p.country,
  }));
}

/**
 * Get countries list grouped by region
 */
export function getCountriesList(lang: 'en' | 'fr' = 'en'): Array<{ 
  code: string; 
  name: string; 
  group: string;
  hasFTA: boolean;  // Has Free Trade Agreement with Canada
  ftaName?: string;
}> {
  const isFr = lang === 'fr';
  
  return [
    // ============== NORTH AMERICA ==============
    { code: 'CA', name: 'Canada', group: isFr ? 'Amérique du Nord' : 'North America', hasFTA: true },
    { code: 'US', name: isFr ? 'États-Unis' : 'United States', group: isFr ? 'Amérique du Nord' : 'North America', hasFTA: true, ftaName: 'CUSMA' },
    { code: 'MX', name: isFr ? 'Mexique' : 'Mexico', group: isFr ? 'Amérique du Nord' : 'North America', hasFTA: true, ftaName: 'CUSMA + CPTPP' },
    
    // ============== EUROPEAN UNION (CETA) ==============
    { code: 'FR', name: 'France', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'DE', name: isFr ? 'Allemagne' : 'Germany', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'IT', name: isFr ? 'Italie' : 'Italy', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'ES', name: isFr ? 'Espagne' : 'Spain', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'PT', name: 'Portugal', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'NL', name: isFr ? 'Pays-Bas' : 'Netherlands', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'BE', name: isFr ? 'Belgique' : 'Belgium', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'AT', name: isFr ? 'Autriche' : 'Austria', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'IE', name: isFr ? 'Irlande' : 'Ireland', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'SE', name: isFr ? 'Suède' : 'Sweden', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'DK', name: isFr ? 'Danemark' : 'Denmark', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'FI', name: isFr ? 'Finlande' : 'Finland', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'PL', name: isFr ? 'Pologne' : 'Poland', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'CZ', name: isFr ? 'République tchèque' : 'Czech Republic', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'GR', name: isFr ? 'Grèce' : 'Greece', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'RO', name: isFr ? 'Roumanie' : 'Romania', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    { code: 'HU', name: isFr ? 'Hongrie' : 'Hungary', group: isFr ? 'Union européenne (AECG)' : 'European Union (CETA)', hasFTA: true, ftaName: 'CETA' },
    
    // ============== UNITED KINGDOM (TCA) ==============
    { code: 'GB', name: isFr ? 'Royaume-Uni' : 'United Kingdom', group: isFr ? 'Royaume-Uni (ACC)' : 'United Kingdom (TCA)', hasFTA: true, ftaName: 'TCA' },
    
    // ============== OTHER EUROPE ==============
    { code: 'CH', name: isFr ? 'Suisse' : 'Switzerland', group: isFr ? 'Autre Europe' : 'Other Europe', hasFTA: false },
    { code: 'NO', name: isFr ? 'Norvège' : 'Norway', group: isFr ? 'Autre Europe' : 'Other Europe', hasFTA: false },
    { code: 'IS', name: isFr ? 'Islande' : 'Iceland', group: isFr ? 'Autre Europe' : 'Other Europe', hasFTA: false },
    { code: 'UA', name: 'Ukraine', group: isFr ? 'Autre Europe' : 'Other Europe', hasFTA: false },
    
    // ============== ASIA-PACIFIC (CPTPP) ==============
    { code: 'JP', name: isFr ? 'Japon' : 'Japan', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    { code: 'AU', name: isFr ? 'Australie' : 'Australia', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    { code: 'NZ', name: isFr ? 'Nouvelle-Zélande' : 'New Zealand', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    { code: 'SG', name: 'Singapour', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    { code: 'MY', name: isFr ? 'Malaisie' : 'Malaysia', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    { code: 'VN', name: 'Vietnam', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    { code: 'BN', name: isFr ? 'Brunei' : 'Brunei', group: isFr ? 'Asie-Pacifique (PTPGP)' : 'Asia-Pacific (CPTPP)', hasFTA: true, ftaName: 'CPTPP' },
    
    // ============== ASIA (OTHER) ==============
    { code: 'CN', name: isFr ? 'Chine' : 'China', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'KR', name: isFr ? 'Corée du Sud' : 'South Korea', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'IN', name: isFr ? 'Inde' : 'India', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'ID', name: isFr ? 'Indonésie' : 'Indonesia', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'TH', name: isFr ? 'Thaïlande' : 'Thailand', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'PH', name: 'Philippines', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'HK', name: 'Hong Kong', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    { code: 'TW', name: isFr ? 'Taïwan' : 'Taiwan', group: isFr ? 'Asie (Autre)' : 'Asia (Other)', hasFTA: false },
    
    // ============== MIDDLE EAST ==============
    { code: 'AE', name: isFr ? 'Émirats arabes unis' : 'United Arab Emirates', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'SA', name: isFr ? 'Arabie saoudite' : 'Saudi Arabia', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'IL', name: isFr ? 'Israël' : 'Israel', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: true, ftaName: 'CIFTA' },
    { code: 'JO', name: isFr ? 'Jordanie' : 'Jordan', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: true, ftaName: 'Canada-Jordan FTA' },
    { code: 'QA', name: 'Qatar', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'KW', name: isFr ? 'Koweït' : 'Kuwait', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'OM', name: 'Oman', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'BH', name: isFr ? 'Bahreïn' : 'Bahrain', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'TR', name: isFr ? 'Turquie' : 'Turkey', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'LB', name: isFr ? 'Liban' : 'Lebanon', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    { code: 'EG', name: isFr ? 'Égypte' : 'Egypt', group: isFr ? 'Moyen-Orient' : 'Middle East', hasFTA: false },
    
    // ============== NORTH AFRICA ==============
    { code: 'MA', name: isFr ? 'Maroc' : 'Morocco', group: isFr ? 'Afrique du Nord' : 'North Africa', hasFTA: false },
    { code: 'DZ', name: isFr ? 'Algérie' : 'Algeria', group: isFr ? 'Afrique du Nord' : 'North Africa', hasFTA: false },
    { code: 'TN', name: isFr ? 'Tunisie' : 'Tunisia', group: isFr ? 'Afrique du Nord' : 'North Africa', hasFTA: false },
    
    // ============== CENTRAL AMERICA ==============
    { code: 'CR', name: 'Costa Rica', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: true, ftaName: 'CCRFTA' },
    { code: 'PA', name: 'Panama', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: true, ftaName: 'CPAFTA' },
    { code: 'HN', name: 'Honduras', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: true, ftaName: 'CHFTA' },
    { code: 'GT', name: 'Guatemala', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: false },
    { code: 'SV', name: 'El Salvador', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: false },
    { code: 'NI', name: 'Nicaragua', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: false },
    { code: 'BZ', name: 'Belize', group: isFr ? 'Amérique centrale' : 'Central America', hasFTA: false },
    
    // ============== SOUTH AMERICA ==============
    { code: 'CL', name: isFr ? 'Chili' : 'Chile', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: true, ftaName: 'CCFTA + CPTPP' },
    { code: 'PE', name: isFr ? 'Pérou' : 'Peru', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: true, ftaName: 'CPFTA + CPTPP' },
    { code: 'CO', name: isFr ? 'Colombie' : 'Colombia', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: true, ftaName: 'CCoFTA' },
    { code: 'AR', name: isFr ? 'Argentine' : 'Argentina', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: false },
    { code: 'EC', name: isFr ? 'Équateur' : 'Ecuador', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: false },
    { code: 'UY', name: 'Uruguay', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: false },
    { code: 'PY', name: 'Paraguay', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: false },
    { code: 'BO', name: isFr ? 'Bolivie' : 'Bolivia', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: false },
    { code: 'VE', name: 'Venezuela', group: isFr ? 'Amérique du Sud' : 'South America', hasFTA: false },
    // NOTE: Brazil excluded - tax system too complex (70%+ cumulative taxes)
    
    // ============== CARIBBEAN ==============
    { code: 'JM', name: isFr ? 'Jamaïque' : 'Jamaica', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'TT', name: isFr ? 'Trinité-et-Tobago' : 'Trinidad and Tobago', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'BB', name: isFr ? 'Barbade' : 'Barbados', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'BS', name: 'Bahamas', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'DO', name: isFr ? 'République dominicaine' : 'Dominican Republic', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'HT', name: isFr ? 'Haïti' : 'Haiti', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'CU', name: 'Cuba', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'PR', name: 'Puerto Rico', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'GP', name: 'Guadeloupe', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
    { code: 'MQ', name: 'Martinique', group: isFr ? 'Caraïbes' : 'Caribbean', hasFTA: false },
  ];
}

/**
 * Format tax amount for display
 */
export function formatTaxAmount(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * EXHAUSTIVE Address format configuration for ALL countries we ship to
 * Based on UPU (Universal Postal Union) standards and local postal requirements
 * 
 * CRITICAL: Incorrect addressing can result in:
 * - Returned packages (shipping cost lost)
 * - Lost packages (product + shipping cost lost)
 * - Customs delays and additional fees
 * - Customer dissatisfaction and chargebacks
 */
export interface AddressFormat {
  postalCodeLabel: string;
  postalCodeLabelFr: string;
  postalCodePlaceholder: string;
  postalCodePattern: string;  // Regex pattern for validation
  postalCodeExample: string;
  postalCodeRequired: boolean;  // Is postal code mandatory?
  regionLabel: string;
  regionLabelFr: string;
  regionRequired: boolean;  // Is region/state/province mandatory?
  hasRegionList: boolean;
  regions?: Array<{ code: string; name: string; nameFr?: string }>;
  // Additional fields that may be required
  additionalFields?: {
    colonia?: boolean;  // Mexico neighborhood
    district?: boolean;  // For UAE, Saudi Arabia, etc.
    suburb?: boolean;  // Australia, NZ
  };
  notes?: string;  // Special instructions for this country
}

const ADDRESS_FORMATS: Record<string, AddressFormat> = {
  // ==================== NORTH AMERICA ====================
  CA: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: 'H2X 1Y4',
    postalCodePattern: '^[A-Za-z]\\d[A-Za-z][ -]?\\d[A-Za-z]\\d$',
    postalCodeExample: 'H2X 1Y4',
    postalCodeRequired: true,
    regionLabel: 'Province',
    regionLabelFr: 'Province',
    regionRequired: true,
    hasRegionList: true,
    notes: 'Format: A1A 1A1. Province required for tax calculation.',
  },
  US: {
    postalCodeLabel: 'ZIP Code',
    postalCodeLabelFr: 'Code ZIP',
    postalCodePlaceholder: '10001',
    postalCodePattern: '^\\d{5}(-\\d{4})?$',
    postalCodeExample: '10001 or 10001-1234',
    postalCodeRequired: true,
    regionLabel: 'State',
    regionLabelFr: 'État',
    regionRequired: true,
    hasRegionList: true,
    notes: '5-digit ZIP required. ZIP+4 optional but recommended.',
  },
  MX: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '06700',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '06700',
    postalCodeRequired: true,
    regionLabel: 'State (Estado)',
    regionLabelFr: 'État (Estado)',
    regionRequired: true,
    hasRegionList: true,
    additionalFields: { colonia: true },
    notes: 'Colonia (neighborhood) is CRITICAL for Mexico deliveries.',
    regions: [
      { code: 'AGS', name: 'Aguascalientes' },
      { code: 'BC', name: 'Baja California' },
      { code: 'BCS', name: 'Baja California Sur' },
      { code: 'CAMP', name: 'Campeche' },
      { code: 'CHIS', name: 'Chiapas' },
      { code: 'CHIH', name: 'Chihuahua' },
      { code: 'CDMX', name: 'Ciudad de México' },
      { code: 'COAH', name: 'Coahuila' },
      { code: 'COL', name: 'Colima' },
      { code: 'DGO', name: 'Durango' },
      { code: 'GTO', name: 'Guanajuato' },
      { code: 'GRO', name: 'Guerrero' },
      { code: 'HGO', name: 'Hidalgo' },
      { code: 'JAL', name: 'Jalisco' },
      { code: 'MEX', name: 'Estado de México' },
      { code: 'MICH', name: 'Michoacán' },
      { code: 'MOR', name: 'Morelos' },
      { code: 'NAY', name: 'Nayarit' },
      { code: 'NL', name: 'Nuevo León' },
      { code: 'OAX', name: 'Oaxaca' },
      { code: 'PUE', name: 'Puebla' },
      { code: 'QRO', name: 'Querétaro' },
      { code: 'QROO', name: 'Quintana Roo' },
      { code: 'SLP', name: 'San Luis Potosí' },
      { code: 'SIN', name: 'Sinaloa' },
      { code: 'SON', name: 'Sonora' },
      { code: 'TAB', name: 'Tabasco' },
      { code: 'TAMPS', name: 'Tamaulipas' },
      { code: 'TLAX', name: 'Tlaxcala' },
      { code: 'VER', name: 'Veracruz' },
      { code: 'YUC', name: 'Yucatán' },
      { code: 'ZAC', name: 'Zacatecas' },
    ],
  },
  
  // ==================== EUROPEAN UNION (CETA) ====================
  FR: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '75001',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '75001',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'City name in CAPITALS. Department encoded in postal code (first 2 digits).',
  },
  DE: {
    postalCodeLabel: 'Postleitzahl (PLZ)',
    postalCodeLabelFr: 'Code postal (PLZ)',
    postalCodePlaceholder: '10115',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '10115',
    postalCodeRequired: true,
    regionLabel: 'Bundesland (optional)',
    regionLabelFr: 'Land (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'PLZ goes BEFORE city name. Recipient name must match mailbox/doorbell.',
  },
  IT: {
    postalCodeLabel: 'CAP',
    postalCodeLabelFr: 'Code postal (CAP)',
    postalCodePlaceholder: '00100',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '00100',
    postalCodeRequired: true,
    regionLabel: 'Province (2-letter code)',
    regionLabelFr: 'Province (code 2 lettres)',
    regionRequired: true,  // Province code required in Italy!
    hasRegionList: true,
    notes: 'Province 2-letter code after city name (e.g., Roma RM).',
    regions: [
      { code: 'AG', name: 'Agrigento' }, { code: 'AL', name: 'Alessandria' },
      { code: 'AN', name: 'Ancona' }, { code: 'AO', name: 'Aosta' },
      { code: 'AR', name: 'Arezzo' }, { code: 'AP', name: 'Ascoli Piceno' },
      { code: 'AT', name: 'Asti' }, { code: 'AV', name: 'Avellino' },
      { code: 'BA', name: 'Bari' }, { code: 'BT', name: 'Barletta-Andria-Trani' },
      { code: 'BL', name: 'Belluno' }, { code: 'BN', name: 'Benevento' },
      { code: 'BG', name: 'Bergamo' }, { code: 'BI', name: 'Biella' },
      { code: 'BO', name: 'Bologna' }, { code: 'BZ', name: 'Bolzano' },
      { code: 'BS', name: 'Brescia' }, { code: 'BR', name: 'Brindisi' },
      { code: 'CA', name: 'Cagliari' }, { code: 'CL', name: 'Caltanissetta' },
      { code: 'CB', name: 'Campobasso' }, { code: 'CE', name: 'Caserta' },
      { code: 'CT', name: 'Catania' }, { code: 'CZ', name: 'Catanzaro' },
      { code: 'CH', name: 'Chieti' }, { code: 'CO', name: 'Como' },
      { code: 'CS', name: 'Cosenza' }, { code: 'CR', name: 'Cremona' },
      { code: 'KR', name: 'Crotone' }, { code: 'CN', name: 'Cuneo' },
      { code: 'EN', name: 'Enna' }, { code: 'FM', name: 'Fermo' },
      { code: 'FE', name: 'Ferrara' }, { code: 'FI', name: 'Firenze' },
      { code: 'FG', name: 'Foggia' }, { code: 'FC', name: 'Forlì-Cesena' },
      { code: 'FR', name: 'Frosinone' }, { code: 'GE', name: 'Genova' },
      { code: 'GO', name: 'Gorizia' }, { code: 'GR', name: 'Grosseto' },
      { code: 'IM', name: 'Imperia' }, { code: 'IS', name: 'Isernia' },
      { code: 'SP', name: 'La Spezia' }, { code: 'AQ', name: "L'Aquila" },
      { code: 'LT', name: 'Latina' }, { code: 'LE', name: 'Lecce' },
      { code: 'LC', name: 'Lecco' }, { code: 'LI', name: 'Livorno' },
      { code: 'LO', name: 'Lodi' }, { code: 'LU', name: 'Lucca' },
      { code: 'MC', name: 'Macerata' }, { code: 'MN', name: 'Mantova' },
      { code: 'MS', name: 'Massa-Carrara' }, { code: 'MT', name: 'Matera' },
      { code: 'ME', name: 'Messina' }, { code: 'MI', name: 'Milano' },
      { code: 'MO', name: 'Modena' }, { code: 'MB', name: 'Monza e Brianza' },
      { code: 'NA', name: 'Napoli' }, { code: 'NO', name: 'Novara' },
      { code: 'NU', name: 'Nuoro' }, { code: 'OR', name: 'Oristano' },
      { code: 'PD', name: 'Padova' }, { code: 'PA', name: 'Palermo' },
      { code: 'PR', name: 'Parma' }, { code: 'PV', name: 'Pavia' },
      { code: 'PG', name: 'Perugia' }, { code: 'PU', name: 'Pesaro e Urbino' },
      { code: 'PE', name: 'Pescara' }, { code: 'PC', name: 'Piacenza' },
      { code: 'PI', name: 'Pisa' }, { code: 'PT', name: 'Pistoia' },
      { code: 'PN', name: 'Pordenone' }, { code: 'PZ', name: 'Potenza' },
      { code: 'PO', name: 'Prato' }, { code: 'RG', name: 'Ragusa' },
      { code: 'RA', name: 'Ravenna' }, { code: 'RC', name: 'Reggio Calabria' },
      { code: 'RE', name: 'Reggio Emilia' }, { code: 'RI', name: 'Rieti' },
      { code: 'RN', name: 'Rimini' }, { code: 'RM', name: 'Roma' },
      { code: 'RO', name: 'Rovigo' }, { code: 'SA', name: 'Salerno' },
      { code: 'SS', name: 'Sassari' }, { code: 'SV', name: 'Savona' },
      { code: 'SI', name: 'Siena' }, { code: 'SR', name: 'Siracusa' },
      { code: 'SO', name: 'Sondrio' }, { code: 'SU', name: 'Sud Sardegna' },
      { code: 'TA', name: 'Taranto' }, { code: 'TE', name: 'Teramo' },
      { code: 'TR', name: 'Terni' }, { code: 'TO', name: 'Torino' },
      { code: 'TP', name: 'Trapani' }, { code: 'TN', name: 'Trento' },
      { code: 'TV', name: 'Treviso' }, { code: 'TS', name: 'Trieste' },
      { code: 'UD', name: 'Udine' }, { code: 'VA', name: 'Varese' },
      { code: 'VE', name: 'Venezia' }, { code: 'VB', name: 'Verbano-Cusio-Ossola' },
      { code: 'VC', name: 'Vercelli' }, { code: 'VR', name: 'Verona' },
      { code: 'VV', name: 'Vibo Valentia' }, { code: 'VI', name: 'Vicenza' },
      { code: 'VT', name: 'Viterbo' },
    ],
  },
  ES: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '28001',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '28001',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,  // Province encoded in postal code (first 2 digits)
    hasRegionList: false,
    notes: 'Province identified by first 2 digits of postal code.',
  },
  PT: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1000-001',
    postalCodePattern: '^\\d{4}-\\d{3}$',
    postalCodeExample: '1000-001',
    postalCodeRequired: true,
    regionLabel: 'District (optional)',
    regionLabelFr: 'District (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: NNNN-NNN. Hyphen required.',
  },
  NL: {
    postalCodeLabel: 'Postcode',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1012 AB',
    postalCodePattern: '^\\d{4}\\s?[A-Z]{2}$',
    postalCodeExample: '1012 AB',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: NNNN AA. City in CAPITALS. Double space between postcode and city.',
  },
  BE: {
    postalCodeLabel: 'Code Postal / Postcode',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1000',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1000',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits. No province needed.',
  },
  AT: {
    postalCodeLabel: 'Postleitzahl (PLZ)',
    postalCodeLabelFr: 'Code postal (PLZ)',
    postalCodePlaceholder: '1010',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1010',
    postalCodeRequired: true,
    regionLabel: 'Bundesland (optional)',
    regionLabelFr: 'Land (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits. PLZ before city name.',
  },
  IE: {
    postalCodeLabel: 'Eircode',
    postalCodeLabelFr: 'Eircode',
    postalCodePlaceholder: 'D02 X285',
    postalCodePattern: '^[A-Z]\\d{2}\\s?[A-Z0-9]{4}$',
    postalCodeExample: 'D02 X285',
    postalCodeRequired: true,
    regionLabel: 'County (optional)',
    regionLabelFr: 'Comté (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Eircode is unique to each property. Format: A65 F4E2.',
  },
  SE: {
    postalCodeLabel: 'Postnummer',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '111 22',
    postalCodePattern: '^\\d{3}\\s?\\d{2}$',
    postalCodeExample: '111 22',
    postalCodeRequired: true,
    regionLabel: 'County (optional)',
    regionLabelFr: 'Comté (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: NNN NN. Space optional but recommended.',
  },
  DK: {
    postalCodeLabel: 'Postnummer',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1000',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1000',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits. City in CAPITALS.',
  },
  FI: {
    postalCodeLabel: 'Postinumero',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '00100',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '00100',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits. City in CAPITALS.',
  },
  PL: {
    postalCodeLabel: 'Kod Pocztowy',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '00-001',
    postalCodePattern: '^\\d{2}-\\d{3}$',
    postalCodeExample: '00-001',
    postalCodeRequired: true,
    regionLabel: 'Voivodeship (optional)',
    regionLabelFr: 'Voïvodie (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: NN-NNN. Hyphen required.',
  },
  CZ: {
    postalCodeLabel: 'PSČ',
    postalCodeLabelFr: 'Code postal (PSČ)',
    postalCodePlaceholder: '110 00',
    postalCodePattern: '^\\d{3}\\s?\\d{2}$',
    postalCodeExample: '110 00',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: NNN NN. Space in middle.',
  },
  GR: {
    postalCodeLabel: 'Postal Code (ΤΚ)',
    postalCodeLabelFr: 'Code postal (ΤΚ)',
    postalCodePlaceholder: '104 31',
    postalCodePattern: '^\\d{3}\\s?\\d{2}$',
    postalCodeExample: '104 31',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: NNN NN. City in CAPITALS.',
  },
  RO: {
    postalCodeLabel: 'Cod Poștal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '010001',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '010001',
    postalCodeRequired: true,
    regionLabel: 'County (optional)',
    regionLabelFr: 'Județ (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '6 digits, no spaces.',
  },
  HU: {
    postalCodeLabel: 'Irányítószám',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1051',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1051',
    postalCodeRequired: true,
    regionLabel: 'County (optional)',
    regionLabelFr: 'Comté (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits. City in CAPITALS.',
  },
  
  // ==================== UNITED KINGDOM ====================
  GB: {
    postalCodeLabel: 'Postcode',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: 'SW1A 1AA',
    postalCodePattern: '^[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}$',
    postalCodeExample: 'SW1A 1AA',
    postalCodeRequired: true,
    regionLabel: 'County (optional)',
    regionLabelFr: 'Comté (optionnel)',
    regionRequired: false,  // County NOT required if postcode is provided
    hasRegionList: false,
    notes: 'Postcode + Town is sufficient. County not needed. Town in CAPITALS.',
  },
  
  // ==================== OTHER EUROPE ====================
  CH: {
    postalCodeLabel: 'PLZ / NPA / CAP',
    postalCodeLabelFr: 'NPA / Code postal',
    postalCodePlaceholder: '8001',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '8001',
    postalCodeRequired: true,
    regionLabel: 'Canton (optional)',
    regionLabelFr: 'Canton (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits. Three official languages (DE/FR/IT). Canton not required.',
  },
  NO: {
    postalCodeLabel: 'Postnummer',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '0001',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '0001',
    postalCodeRequired: true,
    regionLabel: 'County (optional)',
    regionLabelFr: 'Comté (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits. City in CAPITALS.',
  },
  IS: {
    postalCodeLabel: 'Póstnúmer',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '101',
    postalCodePattern: '^\\d{3}$',
    postalCodeExample: '101',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '3 digits only.',
  },
  UA: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '01001',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '01001',
    postalCodeRequired: true,
    regionLabel: 'Oblast (optional)',
    regionLabelFr: 'Oblast (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits. Write address in Latin characters.',
  },
  
  // ==================== ASIA-PACIFIC (CPTPP) ====================
  JP: {
    postalCodeLabel: '〒 Postal Code (郵便番号)',
    postalCodeLabelFr: 'Code postal (郵便番号)',
    postalCodePlaceholder: '100-0001',
    postalCodePattern: '^\\d{3}-\\d{4}$',
    postalCodeExample: '100-0001',
    postalCodeRequired: true,
    regionLabel: 'Prefecture (都道府県)',
    regionLabelFr: 'Préfecture (都道府県)',
    regionRequired: true,  // Prefecture required in Japan
    hasRegionList: true,
    notes: 'Format: NNN-NNNN. Prefecture required. Address order: large to small.',
    regions: [
      { code: 'HOKKAIDO', name: 'Hokkaido (北海道)' },
      { code: 'AOMORI', name: 'Aomori (青森県)' },
      { code: 'IWATE', name: 'Iwate (岩手県)' },
      { code: 'MIYAGI', name: 'Miyagi (宮城県)' },
      { code: 'AKITA', name: 'Akita (秋田県)' },
      { code: 'YAMAGATA', name: 'Yamagata (山形県)' },
      { code: 'FUKUSHIMA', name: 'Fukushima (福島県)' },
      { code: 'IBARAKI', name: 'Ibaraki (茨城県)' },
      { code: 'TOCHIGI', name: 'Tochigi (栃木県)' },
      { code: 'GUNMA', name: 'Gunma (群馬県)' },
      { code: 'SAITAMA', name: 'Saitama (埼玉県)' },
      { code: 'CHIBA', name: 'Chiba (千葉県)' },
      { code: 'TOKYO', name: 'Tokyo (東京都)' },
      { code: 'KANAGAWA', name: 'Kanagawa (神奈川県)' },
      { code: 'NIIGATA', name: 'Niigata (新潟県)' },
      { code: 'TOYAMA', name: 'Toyama (富山県)' },
      { code: 'ISHIKAWA', name: 'Ishikawa (石川県)' },
      { code: 'FUKUI', name: 'Fukui (福井県)' },
      { code: 'YAMANASHI', name: 'Yamanashi (山梨県)' },
      { code: 'NAGANO', name: 'Nagano (長野県)' },
      { code: 'GIFU', name: 'Gifu (岐阜県)' },
      { code: 'SHIZUOKA', name: 'Shizuoka (静岡県)' },
      { code: 'AICHI', name: 'Aichi (愛知県)' },
      { code: 'MIE', name: 'Mie (三重県)' },
      { code: 'SHIGA', name: 'Shiga (滋賀県)' },
      { code: 'KYOTO', name: 'Kyoto (京都府)' },
      { code: 'OSAKA', name: 'Osaka (大阪府)' },
      { code: 'HYOGO', name: 'Hyogo (兵庫県)' },
      { code: 'NARA', name: 'Nara (奈良県)' },
      { code: 'WAKAYAMA', name: 'Wakayama (和歌山県)' },
      { code: 'TOTTORI', name: 'Tottori (鳥取県)' },
      { code: 'SHIMANE', name: 'Shimane (島根県)' },
      { code: 'OKAYAMA', name: 'Okayama (岡山県)' },
      { code: 'HIROSHIMA', name: 'Hiroshima (広島県)' },
      { code: 'YAMAGUCHI', name: 'Yamaguchi (山口県)' },
      { code: 'TOKUSHIMA', name: 'Tokushima (徳島県)' },
      { code: 'KAGAWA', name: 'Kagawa (香川県)' },
      { code: 'EHIME', name: 'Ehime (愛媛県)' },
      { code: 'KOCHI', name: 'Kochi (高知県)' },
      { code: 'FUKUOKA', name: 'Fukuoka (福岡県)' },
      { code: 'SAGA', name: 'Saga (佐賀県)' },
      { code: 'NAGASAKI', name: 'Nagasaki (長崎県)' },
      { code: 'KUMAMOTO', name: 'Kumamoto (熊本県)' },
      { code: 'OITA', name: 'Oita (大分県)' },
      { code: 'MIYAZAKI', name: 'Miyazaki (宮崎県)' },
      { code: 'KAGOSHIMA', name: 'Kagoshima (鹿児島県)' },
      { code: 'OKINAWA', name: 'Okinawa (沖縄県)' },
    ],
  },
  AU: {
    postalCodeLabel: 'Postcode',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '2000',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '2000',
    postalCodeRequired: true,
    regionLabel: 'State/Territory',
    regionLabelFr: 'État/Territoire',
    regionRequired: true,  // State REQUIRED in Australia
    hasRegionList: true,
    additionalFields: { suburb: true },
    notes: 'Suburb + State + Postcode on same line, all in CAPITALS.',
    regions: [
      { code: 'NSW', name: 'New South Wales', nameFr: 'Nouvelle-Galles du Sud' },
      { code: 'VIC', name: 'Victoria' },
      { code: 'QLD', name: 'Queensland' },
      { code: 'WA', name: 'Western Australia', nameFr: 'Australie-Occidentale' },
      { code: 'SA', name: 'South Australia', nameFr: 'Australie-Méridionale' },
      { code: 'TAS', name: 'Tasmania', nameFr: 'Tasmanie' },
      { code: 'ACT', name: 'Australian Capital Territory' },
      { code: 'NT', name: 'Northern Territory', nameFr: 'Territoire du Nord' },
    ],
  },
  NZ: {
    postalCodeLabel: 'Postcode',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1010',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1010',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    additionalFields: { suburb: true },
    notes: 'Suburb on separate line before city. 4-digit postcode.',
  },
  SG: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '569933',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '569933',
    postalCodeRequired: true,
    regionLabel: 'District (optional)',
    regionLabelFr: 'District (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '6-digit code unique to each building. No region needed.',
  },
  MY: {
    postalCodeLabel: 'Postcode',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '50000',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '50000',
    postalCodeRequired: true,
    regionLabel: 'State',
    regionLabelFr: 'État',
    regionRequired: true,  // State required in Malaysia
    hasRegionList: true,
    notes: '5-digit postcode. State required.',
    regions: [
      { code: 'JHR', name: 'Johor' },
      { code: 'KDH', name: 'Kedah' },
      { code: 'KTN', name: 'Kelantan' },
      { code: 'MLK', name: 'Melaka' },
      { code: 'NSN', name: 'Negeri Sembilan' },
      { code: 'PHG', name: 'Pahang' },
      { code: 'PRK', name: 'Perak' },
      { code: 'PLS', name: 'Perlis' },
      { code: 'PNG', name: 'Penang' },
      { code: 'SBH', name: 'Sabah' },
      { code: 'SWK', name: 'Sarawak' },
      { code: 'SGR', name: 'Selangor' },
      { code: 'TRG', name: 'Terengganu' },
      { code: 'KUL', name: 'Kuala Lumpur' },
      { code: 'LBN', name: 'Labuan' },
      { code: 'PJY', name: 'Putrajaya' },
    ],
  },
  VN: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '100000',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '100000',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '6 digits. City name sufficient.',
  },
  BN: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: 'BB3713',
    postalCodePattern: '^[A-Z]{2}\\d{4}$',
    postalCodeExample: 'BB3713',
    postalCodeRequired: true,
    regionLabel: 'District (optional)',
    regionLabelFr: 'District (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: 2 letters + 4 digits (e.g., BB3713).',
  },
  
  // ==================== ASIA (OTHER) ====================
  CN: {
    postalCodeLabel: 'Postal Code (邮政编码)',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '100000',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '100000',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '6 digits. Write in Chinese characters preferred.',
  },
  KR: {
    postalCodeLabel: 'Postal Code (우편번호)',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '03051',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '03051',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits (changed from 6 in 2015). Road name address system.',
  },
  IN: {
    postalCodeLabel: 'PIN Code',
    postalCodeLabelFr: 'Code PIN',
    postalCodePlaceholder: '110001',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '110001',
    postalCodeRequired: true,
    regionLabel: 'State',
    regionLabelFr: 'État',
    regionRequired: true,  // State required in India
    hasRegionList: true,
    notes: '6-digit PIN Code. State required.',
    regions: [
      { code: 'AN', name: 'Andaman and Nicobar Islands' },
      { code: 'AP', name: 'Andhra Pradesh' },
      { code: 'AR', name: 'Arunachal Pradesh' },
      { code: 'AS', name: 'Assam' },
      { code: 'BR', name: 'Bihar' },
      { code: 'CH', name: 'Chandigarh' },
      { code: 'CT', name: 'Chhattisgarh' },
      { code: 'DN', name: 'Dadra and Nagar Haveli' },
      { code: 'DD', name: 'Daman and Diu' },
      { code: 'DL', name: 'Delhi' },
      { code: 'GA', name: 'Goa' },
      { code: 'GJ', name: 'Gujarat' },
      { code: 'HR', name: 'Haryana' },
      { code: 'HP', name: 'Himachal Pradesh' },
      { code: 'JK', name: 'Jammu and Kashmir' },
      { code: 'JH', name: 'Jharkhand' },
      { code: 'KA', name: 'Karnataka' },
      { code: 'KL', name: 'Kerala' },
      { code: 'LA', name: 'Ladakh' },
      { code: 'LD', name: 'Lakshadweep' },
      { code: 'MP', name: 'Madhya Pradesh' },
      { code: 'MH', name: 'Maharashtra' },
      { code: 'MN', name: 'Manipur' },
      { code: 'ML', name: 'Meghalaya' },
      { code: 'MZ', name: 'Mizoram' },
      { code: 'NL', name: 'Nagaland' },
      { code: 'OR', name: 'Odisha' },
      { code: 'PY', name: 'Puducherry' },
      { code: 'PB', name: 'Punjab' },
      { code: 'RJ', name: 'Rajasthan' },
      { code: 'SK', name: 'Sikkim' },
      { code: 'TN', name: 'Tamil Nadu' },
      { code: 'TG', name: 'Telangana' },
      { code: 'TR', name: 'Tripura' },
      { code: 'UP', name: 'Uttar Pradesh' },
      { code: 'UT', name: 'Uttarakhand' },
      { code: 'WB', name: 'West Bengal' },
    ],
  },
  ID: {
    postalCodeLabel: 'Kode Pos',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '10110',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '10110',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  TH: {
    postalCodeLabel: 'Postal Code (รหัสไปรษณีย์)',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '10110',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '10110',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  PH: {
    postalCodeLabel: 'ZIP Code',
    postalCodeLabelFr: 'Code ZIP',
    postalCodePlaceholder: '1000',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1000',
    postalCodeRequired: true,
    regionLabel: 'Province/City',
    regionLabelFr: 'Province/Ville',
    regionRequired: true,  // Province required in Philippines
    hasRegionList: false,
    notes: '4-digit ZIP. Province or city required.',
  },
  HK: {
    postalCodeLabel: 'Postal Code (not used)',
    postalCodeLabelFr: 'Code postal (non utilisé)',
    postalCodePlaceholder: '',
    postalCodePattern: '^$',
    postalCodeExample: 'Not required',
    postalCodeRequired: false,  // Hong Kong has NO postal codes!
    regionLabel: 'District',
    regionLabelFr: 'District',
    regionRequired: true,  // District is required instead
    hasRegionList: true,
    notes: 'Hong Kong does NOT use postal codes. District required.',
    regions: [
      { code: 'HK', name: 'Hong Kong Island' },
      { code: 'KLN', name: 'Kowloon' },
      { code: 'NT', name: 'New Territories' },
    ],
  },
  TW: {
    postalCodeLabel: 'Postal Code (郵遞區號)',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '10001',
    postalCodePattern: '^\\d{3,5}$',
    postalCodeExample: '10001',
    postalCodeRequired: true,
    regionLabel: 'County/City (縣市)',
    regionLabelFr: 'Comté/Ville',
    regionRequired: true,  // County/City required in Taiwan
    hasRegionList: false,
    notes: '3 or 5 digit postal code. County/City required.',
  },
  
  // ==================== MIDDLE EAST ====================
  AE: {
    postalCodeLabel: 'Postal Code / Makani (optional)',
    postalCodeLabelFr: 'Code postal / Makani (optionnel)',
    postalCodePlaceholder: '',
    postalCodePattern: '^(\\d{10})?$',
    postalCodeExample: 'Makani: 1234567890',
    postalCodeRequired: false,  // UAE does NOT have traditional postal codes
    regionLabel: 'Emirate',
    regionLabelFr: 'Émirat',
    regionRequired: true,  // Emirate is required!
    hasRegionList: true,
    additionalFields: { district: true },
    notes: 'UAE has NO traditional postal codes. Makani number optional (10 digits). Emirate required.',
    regions: [
      { code: 'AUH', name: 'Abu Dhabi', nameFr: 'Abou Dabi' },
      { code: 'DXB', name: 'Dubai', nameFr: 'Dubaï' },
      { code: 'SHJ', name: 'Sharjah', nameFr: 'Charjah' },
      { code: 'AJM', name: 'Ajman' },
      { code: 'UAQ', name: 'Umm Al Quwain' },
      { code: 'RAK', name: 'Ras Al Khaimah' },
      { code: 'FUJ', name: 'Fujairah', nameFr: 'Fujaïrah' },
    ],
  },
  SA: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '12345',
    postalCodePattern: '^\\d{5}(-\\d{4})?$',
    postalCodeExample: '12345 or 12345-1234',
    postalCodeRequired: true,
    regionLabel: 'City',
    regionLabelFr: 'Ville',
    regionRequired: true,
    hasRegionList: false,
    additionalFields: { district: true },
    notes: '5 digits (optionally +4). District name required.',
  },
  IL: {
    postalCodeLabel: 'Postal Code (מיקוד)',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1234567',
    postalCodePattern: '^\\d{7}$',
    postalCodeExample: '1234567',
    postalCodeRequired: true,
    regionLabel: 'District (optional)',
    regionLabelFr: 'District (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '7 digits.',
  },
  JO: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '11110',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '11110',
    postalCodeRequired: true,
    regionLabel: 'Governorate (optional)',
    regionLabelFr: 'Gouvernorat (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  QA: {
    postalCodeLabel: 'Postal Code (optional)',
    postalCodeLabelFr: 'Code postal (optionnel)',
    postalCodePlaceholder: '',
    postalCodePattern: '^$',
    postalCodeExample: 'Not commonly used',
    postalCodeRequired: false,  // Qatar rarely uses postal codes
    regionLabel: 'Zone/Municipality',
    regionLabelFr: 'Zone/Municipalité',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Qatar does not commonly use postal codes. PO Box often used.',
  },
  KW: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '12345',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '12345',
    postalCodeRequired: true,
    regionLabel: 'Governorate (optional)',
    regionLabelFr: 'Gouvernorat (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  OM: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '100',
    postalCodePattern: '^\\d{3}$',
    postalCodeExample: '100',
    postalCodeRequired: true,
    regionLabel: 'Governorate (optional)',
    regionLabelFr: 'Gouvernorat (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '3 digits.',
  },
  BH: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1234',
    postalCodePattern: '^\\d{3,4}$',
    postalCodeExample: '1234',
    postalCodeRequired: true,
    regionLabel: 'Block/Road',
    regionLabelFr: 'Bloc/Route',
    regionRequired: true,  // Block and Road numbers required in Bahrain
    hasRegionList: false,
    notes: '3-4 digits. Block and Road numbers are important.',
  },
  TR: {
    postalCodeLabel: 'Posta Kodu',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '34000',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '34000',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  LB: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1100',
    postalCodePattern: '^\\d{4}(\\s?\\d{4})?$',
    postalCodeExample: '1100 or 1100 2010',
    postalCodeRequired: true,
    regionLabel: 'Governorate (optional)',
    regionLabelFr: 'Gouvernorat (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 or 8 digits.',
  },
  EG: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '12345',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '12345',
    postalCodeRequired: true,
    regionLabel: 'Governorate (optional)',
    regionLabelFr: 'Gouvernorat (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  
  // ==================== NORTH AFRICA ====================
  MA: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '20000',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '20000',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  DZ: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '16000',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '16000',
    postalCodeRequired: true,
    regionLabel: 'Wilaya (optional)',
    regionLabelFr: 'Wilaya (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  TN: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1000',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1000',
    postalCodeRequired: true,
    regionLabel: 'Governorate (optional)',
    regionLabelFr: 'Gouvernorat (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits.',
  },
  
  // ==================== CENTRAL AMERICA ====================
  CR: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '10101',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '10101',
    postalCodeRequired: true,
    regionLabel: 'Province',
    regionLabelFr: 'Province',
    regionRequired: true,  // Province required in Costa Rica
    hasRegionList: true,
    notes: '5 digits. Province required.',
    regions: [
      { code: 'SJ', name: 'San José' },
      { code: 'A', name: 'Alajuela' },
      { code: 'C', name: 'Cartago' },
      { code: 'H', name: 'Heredia' },
      { code: 'G', name: 'Guanacaste' },
      { code: 'P', name: 'Puntarenas' },
      { code: 'L', name: 'Limón' },
    ],
  },
  PA: {
    postalCodeLabel: 'Postal Code (optional)',
    postalCodeLabelFr: 'Code postal (optionnel)',
    postalCodePlaceholder: '',
    postalCodePattern: '^(\\d{6})?$',
    postalCodeExample: 'Optional',
    postalCodeRequired: false,  // Panama rarely uses postal codes
    regionLabel: 'Province/District',
    regionLabelFr: 'Province/District',
    regionRequired: true,  // Province required
    hasRegionList: true,
    notes: 'Panama rarely uses postal codes. Province/District required.',
    regions: [
      { code: 'BOC', name: 'Bocas del Toro' },
      { code: 'CHI', name: 'Chiriquí' },
      { code: 'COC', name: 'Coclé' },
      { code: 'COL', name: 'Colón' },
      { code: 'DAR', name: 'Darién' },
      { code: 'HER', name: 'Herrera' },
      { code: 'SAN', name: 'Los Santos' },
      { code: 'PAN', name: 'Panamá' },
      { code: 'POE', name: 'Panamá Oeste' },
      { code: 'VER', name: 'Veraguas' },
      { code: 'EMB', name: 'Emberá-Wounaan' },
      { code: 'KYB', name: 'Guna Yala' },
      { code: 'NGB', name: 'Ngäbe-Buglé' },
    ],
  },
  HN: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '11101',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '11101',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  GT: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '01001',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '01001',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  SV: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1101',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1101',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits.',
  },
  NI: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '11001',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '11001',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  BZ: {
    postalCodeLabel: 'Postal Code (not used)',
    postalCodeLabelFr: 'Code postal (non utilisé)',
    postalCodePlaceholder: '',
    postalCodePattern: '^$',
    postalCodeExample: 'Not used',
    postalCodeRequired: false,  // Belize has NO postal codes
    regionLabel: 'District',
    regionLabelFr: 'District',
    regionRequired: true,  // District required
    hasRegionList: true,
    notes: 'Belize does NOT use postal codes. District required.',
    regions: [
      { code: 'BZ', name: 'Belize' },
      { code: 'CY', name: 'Cayo' },
      { code: 'CZL', name: 'Corozal' },
      { code: 'OW', name: 'Orange Walk' },
      { code: 'SC', name: 'Stann Creek' },
      { code: 'TOL', name: 'Toledo' },
    ],
  },
  
  // ==================== SOUTH AMERICA ====================
  CL: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '8320000',
    postalCodePattern: '^\\d{7}$',
    postalCodeExample: '8320000',
    postalCodeRequired: true,
    regionLabel: 'Region (optional)',
    regionLabelFr: 'Région (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '7 digits.',
  },
  PE: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '15001',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '15001',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  CO: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '111121',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '111121',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '6 digits.',
  },
  AR: {
    postalCodeLabel: 'CPA (Código Postal)',
    postalCodeLabelFr: 'Code postal (CPA)',
    postalCodePlaceholder: 'C1425ABC',
    postalCodePattern: '^[A-Z]\\d{4}[A-Z]{3}$',
    postalCodeExample: 'C1425ABC',
    postalCodeRequired: true,
    regionLabel: 'Province',
    regionLabelFr: 'Province',
    regionRequired: true,  // Province required in Argentina
    hasRegionList: true,
    notes: 'CPA format: 1 letter + 4 digits + 3 letters (e.g., C1425ABC). Province required.',
    regions: [
      { code: 'C', name: 'Ciudad de Buenos Aires' },
      { code: 'B', name: 'Buenos Aires' },
      { code: 'K', name: 'Catamarca' },
      { code: 'H', name: 'Chaco' },
      { code: 'U', name: 'Chubut' },
      { code: 'X', name: 'Córdoba' },
      { code: 'W', name: 'Corrientes' },
      { code: 'E', name: 'Entre Ríos' },
      { code: 'P', name: 'Formosa' },
      { code: 'Y', name: 'Jujuy' },
      { code: 'L', name: 'La Pampa' },
      { code: 'F', name: 'La Rioja' },
      { code: 'M', name: 'Mendoza' },
      { code: 'N', name: 'Misiones' },
      { code: 'Q', name: 'Neuquén' },
      { code: 'R', name: 'Río Negro' },
      { code: 'A', name: 'Salta' },
      { code: 'J', name: 'San Juan' },
      { code: 'D', name: 'San Luis' },
      { code: 'Z', name: 'Santa Cruz' },
      { code: 'S', name: 'Santa Fe' },
      { code: 'G', name: 'Santiago del Estero' },
      { code: 'V', name: 'Tierra del Fuego' },
      { code: 'T', name: 'Tucumán' },
    ],
  },
  EC: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '170150',
    postalCodePattern: '^\\d{6}$',
    postalCodeExample: '170150',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '6 digits.',
  },
  UY: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '11000',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '11000',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  PY: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1209',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1209',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits.',
  },
  BO: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '0101',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '0101',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits.',
  },
  VE: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '1010',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '1010',
    postalCodeRequired: true,
    regionLabel: 'State (optional)',
    regionLabelFr: 'État (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits.',
  },
  
  // ==================== CARIBBEAN ====================
  JM: {
    postalCodeLabel: 'Postal Code (optional)',
    postalCodeLabelFr: 'Code postal (optionnel)',
    postalCodePlaceholder: '',
    postalCodePattern: '^(\\d{2})?$',
    postalCodeExample: 'Rarely used',
    postalCodeRequired: false,  // Jamaica rarely uses postal codes
    regionLabel: 'Parish',
    regionLabelFr: 'Paroisse',
    regionRequired: true,  // Parish required
    hasRegionList: true,
    notes: 'Jamaica rarely uses postal codes. Parish is required.',
    regions: [
      { code: 'KN', name: 'Kingston' },
      { code: 'AN', name: 'St. Andrew' },
      { code: 'TH', name: 'St. Thomas' },
      { code: 'PD', name: 'Portland' },
      { code: 'MY', name: 'St. Mary' },
      { code: 'AN', name: 'St. Ann' },
      { code: 'TR', name: 'Trelawny' },
      { code: 'SJ', name: 'St. James' },
      { code: 'HN', name: 'Hanover' },
      { code: 'WM', name: 'Westmoreland' },
      { code: 'EL', name: 'St. Elizabeth' },
      { code: 'MN', name: 'Manchester' },
      { code: 'CL', name: 'Clarendon' },
      { code: 'CT', name: 'St. Catherine' },
    ],
  },
  TT: {
    postalCodeLabel: 'Postal Code (optional)',
    postalCodeLabelFr: 'Code postal (optionnel)',
    postalCodePlaceholder: '',
    postalCodePattern: '^(\\d{6})?$',
    postalCodeExample: 'Rarely used',
    postalCodeRequired: false,  // T&T rarely uses postal codes
    regionLabel: 'Region',
    regionLabelFr: 'Région',
    regionRequired: true,  // Region required
    hasRegionList: false,
    notes: 'Trinidad and Tobago rarely uses postal codes. Region/City required.',
  },
  BB: {
    postalCodeLabel: 'Postal Code',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: 'BB15028',
    postalCodePattern: '^BB\\d{5}$',
    postalCodeExample: 'BB15028',
    postalCodeRequired: true,
    regionLabel: 'Parish (optional)',
    regionLabelFr: 'Paroisse (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'Format: BB + 5 digits.',
  },
  BS: {
    postalCodeLabel: 'Postal Code (not used)',
    postalCodeLabelFr: 'Code postal (non utilisé)',
    postalCodePlaceholder: '',
    postalCodePattern: '^$',
    postalCodeExample: 'Not used',
    postalCodeRequired: false,  // Bahamas has NO postal codes
    regionLabel: 'Island',
    regionLabelFr: 'Île',
    regionRequired: true,  // Island required
    hasRegionList: true,
    notes: 'Bahamas does NOT use postal codes. Island required.',
    regions: [
      { code: 'NP', name: 'New Providence' },
      { code: 'GB', name: 'Grand Bahama' },
      { code: 'AB', name: 'Abaco' },
      { code: 'AN', name: 'Andros' },
      { code: 'EL', name: 'Eleuthera' },
      { code: 'EX', name: 'Exuma' },
      { code: 'LI', name: 'Long Island' },
      { code: 'BI', name: 'Bimini' },
      { code: 'CI', name: 'Cat Island' },
    ],
  },
  DO: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '10101',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '10101',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  HT: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '6110',
    postalCodePattern: '^\\d{4}$',
    postalCodeExample: '6110',
    postalCodeRequired: true,
    regionLabel: 'Department (optional)',
    regionLabelFr: 'Département (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '4 digits.',
  },
  CU: {
    postalCodeLabel: 'Código Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '10100',
    postalCodePattern: '^\\d{5}$',
    postalCodeExample: '10100',
    postalCodeRequired: true,
    regionLabel: 'Province (optional)',
    regionLabelFr: 'Province (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: '5 digits.',
  },
  PR: {
    postalCodeLabel: 'ZIP Code',
    postalCodeLabelFr: 'Code ZIP',
    postalCodePlaceholder: '00901',
    postalCodePattern: '^\\d{5}(-\\d{4})?$',
    postalCodeExample: '00901',
    postalCodeRequired: true,
    regionLabel: 'Municipality (optional)',
    regionLabelFr: 'Municipalité (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'US territory. 5 or 9 digit ZIP. All PR ZIPs start with 00.',
  },
  GP: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '97100',
    postalCodePattern: '^971\\d{2}$',
    postalCodeExample: '97100',
    postalCodeRequired: true,
    regionLabel: 'Commune (optional)',
    regionLabelFr: 'Commune (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'French territory. All postal codes start with 971.',
  },
  MQ: {
    postalCodeLabel: 'Code Postal',
    postalCodeLabelFr: 'Code postal',
    postalCodePlaceholder: '97200',
    postalCodePattern: '^972\\d{2}$',
    postalCodeExample: '97200',
    postalCodeRequired: true,
    regionLabel: 'Commune (optional)',
    regionLabelFr: 'Commune (optionnel)',
    regionRequired: false,
    hasRegionList: false,
    notes: 'French territory. All postal codes start with 972.',
  },
};

// Default format for countries not in the list
const DEFAULT_ADDRESS_FORMAT: AddressFormat = {
  postalCodeLabel: 'Postal Code',
  postalCodeLabelFr: 'Code postal',
  postalCodePlaceholder: '',
  postalCodePattern: '^[A-Za-z0-9\\s-]{0,15}$',
  postalCodeExample: '',
  postalCodeRequired: false,  // Default to not required for unknown countries
  regionLabel: 'Region/State',
  regionLabelFr: 'Région/État',
  regionRequired: false,
  hasRegionList: false,
  notes: 'Unknown country format - verify address with customer.',
};

/**
 * Get address format for a specific country
 */
export function getAddressFormat(countryCode: string, lang: 'en' | 'fr' = 'en'): {
  postalCodeLabel: string;
  postalCodePlaceholder: string;
  postalCodePattern: string;
  postalCodeExample: string;
  postalCodeRequired: boolean;
  regionLabel: string;
  regionRequired: boolean;
  hasRegionList: boolean;
  regions?: Array<{ code: string; name: string }>;
  notes?: string;
  additionalFields?: {
    colonia?: boolean;
    district?: boolean;
    suburb?: boolean;
  };
} {
  const format = ADDRESS_FORMATS[countryCode] || DEFAULT_ADDRESS_FORMAT;
  const isFr = lang === 'fr';
  
  return {
    postalCodeLabel: isFr ? format.postalCodeLabelFr : format.postalCodeLabel,
    postalCodePlaceholder: format.postalCodePlaceholder,
    postalCodePattern: format.postalCodePattern,
    postalCodeExample: format.postalCodeExample,
    postalCodeRequired: format.postalCodeRequired,
    regionLabel: isFr ? format.regionLabelFr : format.regionLabel,
    regionRequired: format.regionRequired,
    hasRegionList: format.hasRegionList,
    regions: format.regions?.map(r => ({
      code: r.code,
      name: isFr && r.nameFr ? r.nameFr : r.name,
    })),
    notes: format.notes,
    additionalFields: format.additionalFields,
  };
}

/**
 * Validate postal code format for a specific country
 */
export function validatePostalCode(postalCode: string, countryCode: string): boolean {
  const format = ADDRESS_FORMATS[countryCode] || DEFAULT_ADDRESS_FORMAT;
  const regex = new RegExp(format.postalCodePattern, 'i');
  return regex.test(postalCode.trim());
}

/**
 * Validate Canadian postal code and extract province
 */
export function getProvinceFromPostalCode(postalCode: string): string | null {
  const prefix = postalCode.trim().toUpperCase().charAt(0);
  
  const postalPrefixMap: Record<string, string> = {
    'A': 'NL', // Newfoundland and Labrador
    'B': 'NS', // Nova Scotia
    'C': 'PE', // Prince Edward Island
    'E': 'NB', // New Brunswick
    'G': 'QC', // Quebec (East)
    'H': 'QC', // Quebec (Montreal area)
    'J': 'QC', // Quebec (West)
    'K': 'ON', // Ontario (East)
    'L': 'ON', // Ontario (Central)
    'M': 'ON', // Ontario (Toronto)
    'N': 'ON', // Ontario (Southwest)
    'P': 'ON', // Ontario (North)
    'R': 'MB', // Manitoba
    'S': 'SK', // Saskatchewan
    'T': 'AB', // Alberta
    'V': 'BC', // British Columbia
    'X': 'NT', // Northwest Territories / Nunavut
    'Y': 'YT', // Yukon
  };

  return postalPrefixMap[prefix] || null;
}

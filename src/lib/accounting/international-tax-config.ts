// =============================================================================
// International VAT / GST / Sales Tax Configuration (T2-8)
// Comprehensive reference for international tax rates, thresholds, and rules.
// Covers EU-27, UK, EEA, major Asia-Pacific, Americas, and Middle East/Africa.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Core Types
// -----------------------------------------------------------------------------

export interface InternationalTaxRate {
  countryCode: string;         // ISO 3166-1 alpha-2
  countryName: string;
  countryNameFr: string;
  region: TaxRegion;
  standardRate: number;        // e.g., 0.20 for 20%
  reducedRate?: number;        // Most common reduced rate
  superReducedRate?: number;   // Super-reduced (e.g., FR 2.1%, ES 4%)
  parkingRate?: number;        // Parking rate (only a few EU countries)
  zeroRated: boolean;          // Whether zero-rated supplies exist
  currency: string;            // ISO 4217 currency code
  vatRegistrationThreshold?: number; // In local currency, for non-resident sellers
  vatNumberFormat?: string;    // Regex pattern for VAT number validation
  isEU: boolean;               // EU member state (for reverse charge logic)
  digitalServicesRules?: DigitalServicesRule;
  effectiveDate: string;       // When these rates took effect (YYYY-MM-DD)
  notes?: string;
}

export type TaxRegion =
  | 'EU'
  | 'EEA'          // EEA non-EU (Norway, Iceland, Liechtenstein)
  | 'UK'
  | 'EFTA'         // Switzerland
  | 'ASIA_PACIFIC'
  | 'AMERICAS'
  | 'MIDDLE_EAST'
  | 'AFRICA'
  | 'OTHER';

export interface DigitalServicesRule {
  /** Whether digital services are taxed at destination (most countries: yes) */
  destinationPrinciple: boolean;
  /** Threshold below which simplified rules may apply (EUR or local) */
  microBusinessThreshold?: number;
  /** One-Stop-Shop available (EU OSS, UK, etc.) */
  ossAvailable: boolean;
}

/** B2B reverse charge eligibility info */
export interface ReverseChargeRule {
  /** Regions where reverse charge applies for B2B cross-border */
  applicableRegions: TaxRegion[];
  /** If true, valid VAT ID required to apply reverse charge */
  requiresVATValidation: boolean;
  /** EU VIES validation endpoint pattern */
  validationEndpoint?: string;
}

// -----------------------------------------------------------------------------
// 2. EU Member States VAT Rates (27 countries, as of 2025)
// -----------------------------------------------------------------------------

const EU_TAX_RATES: InternationalTaxRate[] = [
  {
    countryCode: 'AT', countryName: 'Austria', countryNameFr: 'Autriche',
    region: 'EU', standardRate: 0.20, reducedRate: 0.10, superReducedRate: undefined,
    parkingRate: 0.13, zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 35000,
    vatNumberFormat: '^ATU\\d{8}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'BE', countryName: 'Belgium', countryNameFr: 'Belgique',
    region: 'EU', standardRate: 0.21, reducedRate: 0.06, superReducedRate: undefined,
    parkingRate: 0.12, zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 25000,
    vatNumberFormat: '^BE0\\d{9}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'BG', countryName: 'Bulgaria', countryNameFr: 'Bulgarie',
    region: 'EU', standardRate: 0.20, reducedRate: 0.09, zeroRated: true,
    currency: 'BGN', vatRegistrationThreshold: 50000, vatNumberFormat: '^BG\\d{9,10}$',
    isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'HR', countryName: 'Croatia', countryNameFr: 'Croatie',
    region: 'EU', standardRate: 0.25, reducedRate: 0.13, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 40000,
    vatNumberFormat: '^HR\\d{11}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'CY', countryName: 'Cyprus', countryNameFr: 'Chypre',
    region: 'EU', standardRate: 0.19, reducedRate: 0.09, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 15600,
    vatNumberFormat: '^CY\\d{8}[A-Z]$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'CZ', countryName: 'Czech Republic', countryNameFr: 'Republique tcheque',
    region: 'EU', standardRate: 0.21, reducedRate: 0.12, zeroRated: true,
    currency: 'CZK', vatRegistrationThreshold: 2000000, vatNumberFormat: '^CZ\\d{8,10}$',
    isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'DK', countryName: 'Denmark', countryNameFr: 'Danemark',
    region: 'EU', standardRate: 0.25, reducedRate: undefined, zeroRated: true,
    currency: 'DKK', vatRegistrationThreshold: 50000, vatNumberFormat: '^DK\\d{8}$',
    isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Denmark has no reduced VAT rate',
  },
  {
    countryCode: 'EE', countryName: 'Estonia', countryNameFr: 'Estonie',
    region: 'EU', standardRate: 0.22, reducedRate: 0.09, zeroRated: true,
    currency: 'EUR', vatRegistrationThreshold: 40000, vatNumberFormat: '^EE\\d{9}$',
    isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'FI', countryName: 'Finland', countryNameFr: 'Finlande',
    region: 'EU', standardRate: 0.255, reducedRate: 0.14, superReducedRate: 0.10,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 15000,
    vatNumberFormat: '^FI\\d{8}$', isEU: true, effectiveDate: '2025-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Finland increased standard rate from 24% to 25.5% on 2025-01-01',
  },
  {
    countryCode: 'FR', countryName: 'France', countryNameFr: 'France',
    region: 'EU', standardRate: 0.20, reducedRate: 0.055, superReducedRate: 0.021,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 85800,
    vatNumberFormat: '^FR[A-Z0-9]{2}\\d{9}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'DE', countryName: 'Germany', countryNameFr: 'Allemagne',
    region: 'EU', standardRate: 0.19, reducedRate: 0.07, zeroRated: true,
    currency: 'EUR', vatRegistrationThreshold: 22000, vatNumberFormat: '^DE\\d{9}$',
    isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'GR', countryName: 'Greece', countryNameFr: 'Grece',
    region: 'EU', standardRate: 0.24, reducedRate: 0.13, superReducedRate: 0.06,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 10000,
    vatNumberFormat: '^EL\\d{9}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Greece uses EL prefix for VAT numbers (not GR)',
  },
  {
    countryCode: 'HU', countryName: 'Hungary', countryNameFr: 'Hongrie',
    region: 'EU', standardRate: 0.27, reducedRate: 0.18, superReducedRate: 0.05,
    zeroRated: true, currency: 'HUF', vatRegistrationThreshold: 12000000,
    vatNumberFormat: '^HU\\d{8}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Hungary has the highest standard VAT rate in the EU',
  },
  {
    countryCode: 'IE', countryName: 'Ireland', countryNameFr: 'Irlande',
    region: 'EU', standardRate: 0.23, reducedRate: 0.135, superReducedRate: 0.048,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 37500,
    vatNumberFormat: '^IE\\d{7}[A-Z]{1,2}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'IT', countryName: 'Italy', countryNameFr: 'Italie',
    region: 'EU', standardRate: 0.22, reducedRate: 0.10, superReducedRate: 0.04,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 65000,
    vatNumberFormat: '^IT\\d{11}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'LV', countryName: 'Latvia', countryNameFr: 'Lettonie',
    region: 'EU', standardRate: 0.21, reducedRate: 0.12, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 40000,
    vatNumberFormat: '^LV\\d{11}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'LT', countryName: 'Lithuania', countryNameFr: 'Lituanie',
    region: 'EU', standardRate: 0.21, reducedRate: 0.09, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 45000,
    vatNumberFormat: '^LT(\\d{9}|\\d{12})$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'LU', countryName: 'Luxembourg', countryNameFr: 'Luxembourg',
    region: 'EU', standardRate: 0.17, reducedRate: 0.08, superReducedRate: 0.03,
    parkingRate: 0.14, zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 35000,
    vatNumberFormat: '^LU\\d{8}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Luxembourg has the lowest standard VAT rate in the EU',
  },
  {
    countryCode: 'MT', countryName: 'Malta', countryNameFr: 'Malte',
    region: 'EU', standardRate: 0.18, reducedRate: 0.07, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 35000,
    vatNumberFormat: '^MT\\d{8}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'NL', countryName: 'Netherlands', countryNameFr: 'Pays-Bas',
    region: 'EU', standardRate: 0.21, reducedRate: 0.09, zeroRated: true,
    currency: 'EUR', vatRegistrationThreshold: 20000, vatNumberFormat: '^NL\\d{9}B\\d{2}$',
    isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'PL', countryName: 'Poland', countryNameFr: 'Pologne',
    region: 'EU', standardRate: 0.23, reducedRate: 0.08, superReducedRate: 0.05,
    zeroRated: true, currency: 'PLN', vatRegistrationThreshold: 200000,
    vatNumberFormat: '^PL\\d{10}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'PT', countryName: 'Portugal', countryNameFr: 'Portugal',
    region: 'EU', standardRate: 0.23, reducedRate: 0.13, superReducedRate: 0.06,
    parkingRate: 0.13, zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 12500,
    vatNumberFormat: '^PT\\d{9}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'RO', countryName: 'Romania', countryNameFr: 'Roumanie',
    region: 'EU', standardRate: 0.19, reducedRate: 0.09, superReducedRate: 0.05,
    zeroRated: true, currency: 'RON', vatRegistrationThreshold: 300000,
    vatNumberFormat: '^RO\\d{2,10}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'SK', countryName: 'Slovakia', countryNameFr: 'Slovaquie',
    region: 'EU', standardRate: 0.23, reducedRate: 0.10, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 49790,
    vatNumberFormat: '^SK\\d{10}$', isEU: true, effectiveDate: '2025-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Slovakia increased standard rate from 20% to 23% on 2025-01-01',
  },
  {
    countryCode: 'SI', countryName: 'Slovenia', countryNameFr: 'Slovenie',
    region: 'EU', standardRate: 0.22, reducedRate: 0.095, superReducedRate: 0.05,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 50000,
    vatNumberFormat: '^SI\\d{8}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
  {
    countryCode: 'ES', countryName: 'Spain', countryNameFr: 'Espagne',
    region: 'EU', standardRate: 0.21, reducedRate: 0.10, superReducedRate: 0.04,
    zeroRated: true, currency: 'EUR', vatRegistrationThreshold: 0,
    vatNumberFormat: '^ES[A-Z0-9]\\d{7}[A-Z0-9]$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
    notes: 'Spain has no domestic VAT registration threshold (all businesses must register)',
  },
  {
    countryCode: 'SE', countryName: 'Sweden', countryNameFr: 'Suede',
    region: 'EU', standardRate: 0.25, reducedRate: 0.12, superReducedRate: 0.06,
    zeroRated: true, currency: 'SEK', vatRegistrationThreshold: 80000,
    vatNumberFormat: '^SE\\d{12}$', isEU: true, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: true, microBusinessThreshold: 10000 },
  },
];

// -----------------------------------------------------------------------------
// 3. Non-EU European Countries
// -----------------------------------------------------------------------------

const NON_EU_EUROPE_TAX_RATES: InternationalTaxRate[] = [
  {
    countryCode: 'GB', countryName: 'United Kingdom', countryNameFr: 'Royaume-Uni',
    region: 'UK', standardRate: 0.20, reducedRate: 0.05, zeroRated: true,
    currency: 'GBP', vatRegistrationThreshold: 90000,
    vatNumberFormat: '^GB(\\d{9}|\\d{12}|GD\\d{3}|HA\\d{3})$', isEU: false,
    effectiveDate: '2024-04-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: undefined },
    notes: 'UK threshold raised to GBP 90,000 from April 2024. Non-resident sellers must register if selling to UK consumers.',
  },
  {
    countryCode: 'CH', countryName: 'Switzerland', countryNameFr: 'Suisse',
    region: 'EFTA', standardRate: 0.081, reducedRate: 0.026, superReducedRate: 0.0,
    zeroRated: false, currency: 'CHF', vatRegistrationThreshold: 100000,
    vatNumberFormat: '^CHE\\d{9}(MWST|TVA|IVA)$', isEU: false, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: undefined },
    notes: 'Swiss VAT rate 8.1% since Jan 2024. No zero-rate, only exempt supplies.',
  },
  {
    countryCode: 'NO', countryName: 'Norway', countryNameFr: 'Norvege',
    region: 'EEA', standardRate: 0.25, reducedRate: 0.15, superReducedRate: 0.12,
    zeroRated: true, currency: 'NOK', vatRegistrationThreshold: 50000,
    vatNumberFormat: '^\\d{9}MVA$', isEU: false, effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: undefined },
    notes: 'Norway VOEC scheme for foreign sellers of low-value goods and digital services',
  },
  {
    countryCode: 'IS', countryName: 'Iceland', countryNameFr: 'Islande',
    region: 'EEA', standardRate: 0.24, reducedRate: 0.11, zeroRated: true,
    currency: 'ISK', vatRegistrationThreshold: 2000000, isEU: false,
    effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: undefined },
  },
  {
    countryCode: 'LI', countryName: 'Liechtenstein', countryNameFr: 'Liechtenstein',
    region: 'EEA', standardRate: 0.081, reducedRate: 0.026, zeroRated: false,
    currency: 'CHF', vatRegistrationThreshold: 100000, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'Liechtenstein uses Swiss VAT system',
  },
  {
    countryCode: 'TR', countryName: 'Turkey', countryNameFr: 'Turquie',
    region: 'OTHER', standardRate: 0.20, reducedRate: 0.10, superReducedRate: 0.01,
    zeroRated: true, currency: 'TRY', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-07-01',
    notes: 'Turkey standard KDV rate increased to 20% in July 2023',
  },
];

// -----------------------------------------------------------------------------
// 4. Asia-Pacific Tax Rates
// -----------------------------------------------------------------------------

const ASIA_PACIFIC_TAX_RATES: InternationalTaxRate[] = [
  {
    countryCode: 'AU', countryName: 'Australia', countryNameFr: 'Australie',
    region: 'ASIA_PACIFIC', standardRate: 0.10, reducedRate: undefined, zeroRated: true,
    currency: 'AUD', vatRegistrationThreshold: 75000, isEU: false,
    effectiveDate: '2000-07-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: 75000 },
    notes: 'GST. Non-resident sellers must register if AU turnover exceeds AUD 75,000',
  },
  {
    countryCode: 'NZ', countryName: 'New Zealand', countryNameFr: 'Nouvelle-Zelande',
    region: 'ASIA_PACIFIC', standardRate: 0.15, reducedRate: undefined, zeroRated: true,
    currency: 'NZD', vatRegistrationThreshold: 60000, isEU: false,
    effectiveDate: '2010-10-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: 60000 },
    notes: 'GST. Foreign sellers of remote services must register if NZD 60K threshold exceeded',
  },
  {
    countryCode: 'JP', countryName: 'Japan', countryNameFr: 'Japon',
    region: 'ASIA_PACIFIC', standardRate: 0.10, reducedRate: 0.08, zeroRated: true,
    currency: 'JPY', vatRegistrationThreshold: 10000000, isEU: false,
    effectiveDate: '2019-10-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: undefined },
    notes: 'JCT (Japanese Consumption Tax). Reduced rate applies to food and newspapers.',
  },
  {
    countryCode: 'KR', countryName: 'South Korea', countryNameFr: 'Coree du Sud',
    region: 'ASIA_PACIFIC', standardRate: 0.10, reducedRate: undefined, zeroRated: true,
    currency: 'KRW', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: undefined },
    notes: 'Korean VAT. Flat 10% rate with no reduced rate.',
  },
  {
    countryCode: 'SG', countryName: 'Singapore', countryNameFr: 'Singapour',
    region: 'ASIA_PACIFIC', standardRate: 0.09, reducedRate: undefined, zeroRated: true,
    currency: 'SGD', vatRegistrationThreshold: 1000000, isEU: false,
    effectiveDate: '2024-01-01',
    digitalServicesRules: { destinationPrinciple: true, ossAvailable: false, microBusinessThreshold: 100000 },
    notes: 'GST increased to 9% from Jan 2024. OVR (Overseas Vendor Registration) for remote services.',
  },
  {
    countryCode: 'IN', countryName: 'India', countryNameFr: 'Inde',
    region: 'ASIA_PACIFIC', standardRate: 0.18, reducedRate: 0.12, superReducedRate: 0.05,
    zeroRated: true, currency: 'INR', vatRegistrationThreshold: 2000000, isEU: false,
    effectiveDate: '2017-07-01',
    notes: 'GST with multiple slabs: 5%, 12%, 18%, 28%. 18% is most common for services.',
  },
  {
    countryCode: 'MY', countryName: 'Malaysia', countryNameFr: 'Malaisie',
    region: 'ASIA_PACIFIC', standardRate: 0.08, reducedRate: undefined, zeroRated: true,
    currency: 'MYR', vatRegistrationThreshold: 500000, isEU: false,
    effectiveDate: '2024-03-01',
    notes: 'SST (Sales and Service Tax). Service tax 8% from March 2024 (was 6%).',
  },
  {
    countryCode: 'TH', countryName: 'Thailand', countryNameFr: 'Thailande',
    region: 'ASIA_PACIFIC', standardRate: 0.07, reducedRate: undefined, zeroRated: true,
    currency: 'THB', vatRegistrationThreshold: 1800000, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'Thai VAT. Reduced from statutory 10% to 7% (extended repeatedly).',
  },
  {
    countryCode: 'TW', countryName: 'Taiwan', countryNameFr: 'Taiwan',
    region: 'ASIA_PACIFIC', standardRate: 0.05, reducedRate: undefined, zeroRated: true,
    currency: 'TWD', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'Business Tax. Flat 5% on most goods and services.',
  },
  {
    countryCode: 'HK', countryName: 'Hong Kong', countryNameFr: 'Hong Kong',
    region: 'ASIA_PACIFIC', standardRate: 0.0, reducedRate: undefined, zeroRated: false,
    currency: 'HKD', vatRegistrationThreshold: undefined, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'Hong Kong has no VAT/GST/sales tax.',
  },
  {
    countryCode: 'PH', countryName: 'Philippines', countryNameFr: 'Philippines',
    region: 'ASIA_PACIFIC', standardRate: 0.12, reducedRate: undefined, zeroRated: true,
    currency: 'PHP', vatRegistrationThreshold: 3000000, isEU: false,
    effectiveDate: '2024-01-01',
  },
  {
    countryCode: 'ID', countryName: 'Indonesia', countryNameFr: 'Indonesie',
    region: 'ASIA_PACIFIC', standardRate: 0.11, reducedRate: undefined, zeroRated: true,
    currency: 'IDR', vatRegistrationThreshold: 4800000000, isEU: false,
    effectiveDate: '2022-04-01',
    notes: 'PPN. Rate increased to 11% in April 2022; planned increase to 12% in 2025.',
  },
  {
    countryCode: 'VN', countryName: 'Vietnam', countryNameFr: 'Vietnam',
    region: 'ASIA_PACIFIC', standardRate: 0.10, reducedRate: 0.05, zeroRated: true,
    currency: 'VND', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
  },
];

// -----------------------------------------------------------------------------
// 5. Americas Tax Rates (non-Canada)
// -----------------------------------------------------------------------------

const AMERICAS_TAX_RATES: InternationalTaxRate[] = [
  {
    countryCode: 'US', countryName: 'United States', countryNameFr: 'Etats-Unis',
    region: 'AMERICAS', standardRate: 0.0, reducedRate: undefined, zeroRated: false,
    currency: 'USD', vatRegistrationThreshold: undefined, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'No federal VAT/GST. State/local sales tax varies (0-10.25%). Nexus rules apply. ' +
           'Canadian exports to US are zero-rated for GST/HST purposes. ' +
           'US sales tax obligations depend on economic nexus thresholds per state.',
  },
  {
    countryCode: 'MX', countryName: 'Mexico', countryNameFr: 'Mexique',
    region: 'AMERICAS', standardRate: 0.16, reducedRate: 0.0, zeroRated: true,
    currency: 'MXN', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'IVA. 0% rate on food, medicine, books. Border zone reduced to 8% for some goods.',
  },
  {
    countryCode: 'BR', countryName: 'Brazil', countryNameFr: 'Bresil',
    region: 'AMERICAS', standardRate: 0.17, reducedRate: undefined, zeroRated: true,
    currency: 'BRL', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'Complex multi-tax system (ICMS, ISS, PIS, COFINS). 17% is approximate standard ICMS.',
  },
  {
    countryCode: 'AR', countryName: 'Argentina', countryNameFr: 'Argentine',
    region: 'AMERICAS', standardRate: 0.21, reducedRate: 0.105, zeroRated: true,
    currency: 'ARS', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'IVA. Digital services from abroad subject to 21% withholding.',
  },
  {
    countryCode: 'CL', countryName: 'Chile', countryNameFr: 'Chili',
    region: 'AMERICAS', standardRate: 0.19, reducedRate: undefined, zeroRated: true,
    currency: 'CLP', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'IVA. Flat rate, no reduced rates.',
  },
  {
    countryCode: 'CO', countryName: 'Colombia', countryNameFr: 'Colombie',
    region: 'AMERICAS', standardRate: 0.19, reducedRate: 0.05, zeroRated: true,
    currency: 'COP', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'IVA. 5% reduced rate for certain goods.',
  },
  {
    countryCode: 'PE', countryName: 'Peru', countryNameFr: 'Perou',
    region: 'AMERICAS', standardRate: 0.18, reducedRate: undefined, zeroRated: true,
    currency: 'PEN', vatRegistrationThreshold: 0, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'IGV (18% = 16% IGV + 2% IPM municipal tax).',
  },
];

// -----------------------------------------------------------------------------
// 6. Middle East & Africa Tax Rates
// -----------------------------------------------------------------------------

const MIDDLE_EAST_AFRICA_TAX_RATES: InternationalTaxRate[] = [
  {
    countryCode: 'AE', countryName: 'United Arab Emirates', countryNameFr: 'Emirats arabes unis',
    region: 'MIDDLE_EAST', standardRate: 0.05, reducedRate: undefined, zeroRated: true,
    currency: 'AED', vatRegistrationThreshold: 375000, isEU: false,
    effectiveDate: '2018-01-01',
    notes: 'VAT introduced in 2018. Zero-rated: exports, international transport, first residential supply.',
  },
  {
    countryCode: 'SA', countryName: 'Saudi Arabia', countryNameFr: 'Arabie saoudite',
    region: 'MIDDLE_EAST', standardRate: 0.15, reducedRate: undefined, zeroRated: true,
    currency: 'SAR', vatRegistrationThreshold: 375000, isEU: false,
    effectiveDate: '2020-07-01',
    notes: 'VAT increased from 5% to 15% in July 2020.',
  },
  {
    countryCode: 'IL', countryName: 'Israel', countryNameFr: 'Israel',
    region: 'MIDDLE_EAST', standardRate: 0.17, reducedRate: undefined, zeroRated: true,
    currency: 'ILS', vatRegistrationThreshold: 120000, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'Ma\'am (VAT). Eilat is a VAT-free zone.',
  },
  {
    countryCode: 'ZA', countryName: 'South Africa', countryNameFr: 'Afrique du Sud',
    region: 'AFRICA', standardRate: 0.15, reducedRate: undefined, zeroRated: true,
    currency: 'ZAR', vatRegistrationThreshold: 1000000, isEU: false,
    effectiveDate: '2018-04-01',
    notes: 'VAT. Zero-rated basic foodstuffs. Electronic services from abroad are subject to VAT.',
  },
  {
    countryCode: 'NG', countryName: 'Nigeria', countryNameFr: 'Nigeria',
    region: 'AFRICA', standardRate: 0.075, reducedRate: undefined, zeroRated: true,
    currency: 'NGN', vatRegistrationThreshold: 25000000, isEU: false,
    effectiveDate: '2020-02-01',
    notes: 'VAT. Rate increased from 5% to 7.5% in February 2020.',
  },
  {
    countryCode: 'KE', countryName: 'Kenya', countryNameFr: 'Kenya',
    region: 'AFRICA', standardRate: 0.16, reducedRate: 0.08, zeroRated: true,
    currency: 'KES', vatRegistrationThreshold: 5000000, isEU: false,
    effectiveDate: '2024-01-01',
  },
  {
    countryCode: 'EG', countryName: 'Egypt', countryNameFr: 'Egypte',
    region: 'AFRICA', standardRate: 0.14, reducedRate: undefined, zeroRated: true,
    currency: 'EGP', vatRegistrationThreshold: 500000, isEU: false,
    effectiveDate: '2024-01-01',
  },
  {
    countryCode: 'MA', countryName: 'Morocco', countryNameFr: 'Maroc',
    region: 'AFRICA', standardRate: 0.20, reducedRate: 0.10, superReducedRate: 0.07,
    zeroRated: true, currency: 'MAD', vatRegistrationThreshold: 500000, isEU: false,
    effectiveDate: '2024-01-01',
    notes: 'TVA. Multiple reduced rates: 7%, 10%, 14%, 20%.',
  },
];

// -----------------------------------------------------------------------------
// 7. Combined International Tax Rates
// -----------------------------------------------------------------------------

export const INTERNATIONAL_TAX_RATES: InternationalTaxRate[] = [
  ...EU_TAX_RATES,
  ...NON_EU_EUROPE_TAX_RATES,
  ...ASIA_PACIFIC_TAX_RATES,
  ...AMERICAS_TAX_RATES,
  ...MIDDLE_EAST_AFRICA_TAX_RATES,
];

// -----------------------------------------------------------------------------
// 8. Lookup Maps (for fast O(1) access)
// -----------------------------------------------------------------------------

/** Map from country code to tax rate config */
const TAX_RATE_MAP: Map<string, InternationalTaxRate> = new Map(
  INTERNATIONAL_TAX_RATES.map((rate) => [rate.countryCode, rate])
);

/** Set of EU country codes for fast membership check */
export const EU_COUNTRY_CODES: Set<string> = new Set(
  INTERNATIONAL_TAX_RATES.filter((r) => r.isEU).map((r) => r.countryCode)
);

// -----------------------------------------------------------------------------
// 9. Reverse Charge Rules
// -----------------------------------------------------------------------------

export const REVERSE_CHARGE_RULES: ReverseChargeRule = {
  applicableRegions: ['EU', 'EEA', 'UK'],
  requiresVATValidation: true,
  validationEndpoint: 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number',
};

// -----------------------------------------------------------------------------
// 10. Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get the tax rate configuration for a country.
 * @param countryCode - ISO 3166-1 alpha-2 code (e.g., 'FR', 'DE', 'JP')
 * @returns The InternationalTaxRate entry or undefined if not found.
 */
export function getInternationalTaxRate(countryCode: string): InternationalTaxRate | undefined {
  return TAX_RATE_MAP.get(countryCode.toUpperCase());
}

/**
 * Check if a country is an EU member state.
 */
export function isEUCountry(countryCode: string): boolean {
  return EU_COUNTRY_CODES.has(countryCode.toUpperCase());
}

/**
 * Check if B2B reverse charge applies for a given country and buyer context.
 * Reverse charge means the buyer accounts for VAT (seller charges 0%).
 *
 * For Attitudes VIP (Canadian seller):
 * - Selling B2B to EU: reverse charge applies if buyer has valid VAT ID
 * - Selling B2C to EU: destination VAT applies (seller must register or use OSS)
 * - Selling to UK B2B: reverse charge may apply (buyer self-accounts)
 * - Selling to non-EU/UK: typically no VAT (export zero-rated)
 */
export function isReverseChargeApplicable(
  countryCode: string,
  buyerVatId?: string
): boolean {
  const code = countryCode.toUpperCase();
  const rate = TAX_RATE_MAP.get(code);
  if (!rate) return false;

  // Reverse charge only applies in EU, EEA, and UK regions
  const applicableRegions: TaxRegion[] = ['EU', 'EEA', 'UK'];
  if (!applicableRegions.includes(rate.region)) return false;

  // Buyer must have a VAT ID
  if (!buyerVatId || buyerVatId.trim().length === 0) return false;

  return true;
}

/**
 * Validate a VAT number format (basic format check, not VIES validation).
 * For actual VIES validation, call the EU VIES API.
 *
 * @param vatNumber - The VAT number to validate
 * @param countryCode - Expected country code
 * @returns Whether the format is valid
 */
export function validateVATNumberFormat(
  vatNumber: string,
  countryCode: string
): boolean {
  const code = countryCode.toUpperCase();
  const rate = TAX_RATE_MAP.get(code);
  if (!rate || !rate.vatNumberFormat) return false;

  try {
    const regex = new RegExp(rate.vatNumberFormat);
    return regex.test(vatNumber.trim().replace(/\s/g, ''));
  } catch {
    return false;
  }
}

/**
 * Get all countries in a specific tax region.
 */
export function getCountriesByRegion(region: TaxRegion): InternationalTaxRate[] {
  return INTERNATIONAL_TAX_RATES.filter((r) => r.region === region);
}

/**
 * Get all EU countries with their VAT rates.
 */
export function getEUCountries(): InternationalTaxRate[] {
  return INTERNATIONAL_TAX_RATES.filter((r) => r.isEU);
}

/**
 * Get all supported countries as a flat list for dropdowns.
 */
export function getSupportedCountries(): Array<{
  code: string;
  name: string;
  nameFr: string;
  region: TaxRegion;
  standardRate: number;
  isEU: boolean;
}> {
  return INTERNATIONAL_TAX_RATES.map((r) => ({
    code: r.countryCode,
    name: r.countryName,
    nameFr: r.countryNameFr,
    region: r.region,
    standardRate: r.standardRate,
    isEU: r.isEU,
  }));
}

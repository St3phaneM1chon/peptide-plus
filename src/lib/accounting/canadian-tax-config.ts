// =============================================================================
// Canadian Tax Configuration Data
// Comprehensive reference for GST/PST/HST, CCA, payroll, corporate tax,
// fiscal deadlines, deductibility rules, document retention, and tax credits.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Provincial Tax Rates
// -----------------------------------------------------------------------------

export interface ProvincialTaxRate {
  provinceCode: string;
  provinceName: string;
  provinceNameFr: string;
  gstRate: number;       // Federal GST (always 5%)
  pstRate: number;       // Provincial sales tax (PST/QST/RST)
  hstRate: number;       // Harmonized (0 if separate GST+PST)
  totalRate: number;     // Combined rate
  pstName: string;       // "QST", "PST", "RST", "HST", "N/A"
  pstRegistrationThreshold: number; // Annual revenue threshold
  effectiveDate: string; // When these rates took effect
}

export const PROVINCIAL_TAX_RATES: ProvincialTaxRate[] = [
  { provinceCode: 'QC', provinceName: 'Quebec', provinceNameFr: 'Quebec', gstRate: 5, pstRate: 9.975, hstRate: 0, totalRate: 14.975, pstName: 'QST', pstRegistrationThreshold: 30000, effectiveDate: '2013-01-01' },
  { provinceCode: 'ON', provinceName: 'Ontario', provinceNameFr: 'Ontario', gstRate: 0, pstRate: 0, hstRate: 13, totalRate: 13, pstName: 'HST', pstRegistrationThreshold: 30000, effectiveDate: '2010-07-01' },
  { provinceCode: 'AB', provinceName: 'Alberta', provinceNameFr: 'Alberta', gstRate: 5, pstRate: 0, hstRate: 0, totalRate: 5, pstName: 'N/A', pstRegistrationThreshold: 0, effectiveDate: '1991-01-01' },
  { provinceCode: 'BC', provinceName: 'British Columbia', provinceNameFr: 'Colombie-Britannique', gstRate: 5, pstRate: 7, hstRate: 0, totalRate: 12, pstName: 'PST', pstRegistrationThreshold: 10000, effectiveDate: '2013-04-01' },
  { provinceCode: 'SK', provinceName: 'Saskatchewan', provinceNameFr: 'Saskatchewan', gstRate: 5, pstRate: 6, hstRate: 0, totalRate: 11, pstName: 'PST', pstRegistrationThreshold: 0, effectiveDate: '2017-03-23' },
  { provinceCode: 'MB', provinceName: 'Manitoba', provinceNameFr: 'Manitoba', gstRate: 5, pstRate: 7, hstRate: 0, totalRate: 12, pstName: 'RST', pstRegistrationThreshold: 10000, effectiveDate: '2019-07-01' },
  { provinceCode: 'NB', provinceName: 'New Brunswick', provinceNameFr: 'Nouveau-Brunswick', gstRate: 0, pstRate: 0, hstRate: 15, totalRate: 15, pstName: 'HST', pstRegistrationThreshold: 30000, effectiveDate: '2016-07-01' },
  { provinceCode: 'NL', provinceName: 'Newfoundland and Labrador', provinceNameFr: 'Terre-Neuve-et-Labrador', gstRate: 0, pstRate: 0, hstRate: 15, totalRate: 15, pstName: 'HST', pstRegistrationThreshold: 30000, effectiveDate: '2016-07-01' },
  { provinceCode: 'NS', provinceName: 'Nova Scotia', provinceNameFr: 'Nouvelle-Ecosse', gstRate: 0, pstRate: 0, hstRate: 14, totalRate: 14, pstName: 'HST', pstRegistrationThreshold: 30000, effectiveDate: '2025-04-01' },
  { provinceCode: 'PE', provinceName: 'Prince Edward Island', provinceNameFr: 'Ile-du-Prince-Edouard', gstRate: 0, pstRate: 0, hstRate: 15, totalRate: 15, pstName: 'HST', pstRegistrationThreshold: 30000, effectiveDate: '2013-04-01' },
  { provinceCode: 'YT', provinceName: 'Yukon', provinceNameFr: 'Yukon', gstRate: 5, pstRate: 0, hstRate: 0, totalRate: 5, pstName: 'N/A', pstRegistrationThreshold: 0, effectiveDate: '1991-01-01' },
  { provinceCode: 'NT', provinceName: 'Northwest Territories', provinceNameFr: 'Territoires du Nord-Ouest', gstRate: 5, pstRate: 0, hstRate: 0, totalRate: 5, pstName: 'N/A', pstRegistrationThreshold: 0, effectiveDate: '1991-01-01' },
  { provinceCode: 'NU', provinceName: 'Nunavut', provinceNameFr: 'Nunavut', gstRate: 5, pstRate: 0, hstRate: 0, totalRate: 5, pstName: 'N/A', pstRegistrationThreshold: 0, effectiveDate: '1999-04-01' },
];

// -----------------------------------------------------------------------------
// 2. CCA Classes (Capital Cost Allowance)
// -----------------------------------------------------------------------------

export interface CCAClass {
  classNumber: number;
  rate: number;          // Percentage (declining balance usually)
  method: 'declining' | 'straight-line' | 'lease-term';
  description: string;
  descriptionFr: string;
  examples: string[];
  halfYearRule: boolean;
  aiiEligible: boolean;  // Accelerated Investment Incentive
  superDeduction: boolean; // 100% immediate expensing (Budget 2025)
}

export const CCA_CLASSES: CCAClass[] = [
  { classNumber: 1, rate: 4, method: 'declining', description: 'Buildings acquired after 1987', descriptionFr: 'Batiments acquis apres 1987', examples: ['Commercial buildings', 'Warehouses'], halfYearRule: true, aiiEligible: true, superDeduction: false },
  { classNumber: 8, rate: 20, method: 'declining', description: 'Miscellaneous tangible property', descriptionFr: 'Biens corporels divers', examples: ['Furniture', 'Fixtures', 'Phones', 'Tools >$500'], halfYearRule: true, aiiEligible: true, superDeduction: false },
  { classNumber: 10, rate: 30, method: 'declining', description: 'Motor vehicles', descriptionFr: 'Vehicules moteur', examples: ['Cars', 'Trucks', 'Vans'], halfYearRule: true, aiiEligible: true, superDeduction: false },
  { classNumber: 10.1, rate: 30, method: 'declining', description: 'Passenger vehicles >$37,000', descriptionFr: 'Voitures de tourisme >37 000$', examples: ['Luxury passenger vehicles'], halfYearRule: true, aiiEligible: true, superDeduction: false },
  { classNumber: 12, rate: 100, method: 'declining', description: 'Small tools, software', descriptionFr: 'Petits outils, logiciels', examples: ['Tools <$500', 'Computer software (not systems)', 'Uniforms', 'Cutlery'], halfYearRule: true, aiiEligible: false, superDeduction: false },
  { classNumber: 13, rate: 0, method: 'lease-term', description: 'Leasehold improvements', descriptionFr: 'Ameliorations locatives', examples: ['Renovations to rented premises'], halfYearRule: false, aiiEligible: true, superDeduction: false },
  { classNumber: 14, rate: 0, method: 'straight-line', description: 'Patents, franchises (limited life)', descriptionFr: 'Brevets, franchises (duree limitee)', examples: ['Patents', 'Licenses', 'Franchises with expiry'], halfYearRule: false, aiiEligible: false, superDeduction: false },
  { classNumber: 14.1, rate: 5, method: 'declining', description: 'Eligible capital property', descriptionFr: 'Immobilisations admissibles', examples: ['Goodwill', 'Customer lists', 'Trademarks', 'Incorporation costs'], halfYearRule: true, aiiEligible: true, superDeduction: false },
  { classNumber: 43, rate: 30, method: 'declining', description: 'Manufacturing & processing equipment', descriptionFr: 'Equipement fabrication et transformation', examples: ['Manufacturing machinery', 'Processing equipment'], halfYearRule: true, aiiEligible: true, superDeduction: true },
  { classNumber: 46, rate: 30, method: 'declining', description: 'Data network infrastructure', descriptionFr: 'Infrastructure reseau donnees', examples: ['Network equipment', 'Switches', 'Routers'], halfYearRule: true, aiiEligible: true, superDeduction: true },
  { classNumber: 50, rate: 55, method: 'declining', description: 'Computer hardware', descriptionFr: 'Materiel informatique', examples: ['Computers', 'Servers', 'Tablets', 'Printers'], halfYearRule: true, aiiEligible: true, superDeduction: true },
  { classNumber: 52, rate: 100, method: 'declining', description: 'General purpose electronic equipment', descriptionFr: 'Equipement electronique general', examples: ['Computer equipment acquired after Jan 27, 2009 and before Feb 2011'], halfYearRule: false, aiiEligible: false, superDeduction: false },
  { classNumber: 54, rate: 30, method: 'declining', description: 'Zero-emission vehicles', descriptionFr: 'Vehicules zero emission', examples: ['Electric vehicles (cap $61K)', 'Hydrogen fuel cell vehicles'], halfYearRule: true, aiiEligible: true, superDeduction: true },
  { classNumber: 55, rate: 40, method: 'declining', description: 'Zero-emission vehicles (no cap)', descriptionFr: 'Vehicules zero emission (sans plafond)', examples: ['Electric delivery trucks', 'ZEV >$61K'], halfYearRule: true, aiiEligible: true, superDeduction: true },
  { classNumber: 56, rate: 30, method: 'declining', description: 'Zero-emission automotive equipment', descriptionFr: 'Equipement automobile zero emission', examples: ['Charging stations', 'Battery storage'], halfYearRule: true, aiiEligible: true, superDeduction: true },
];

// -----------------------------------------------------------------------------
// 3. Fiscal Calendar (Deadlines)
// -----------------------------------------------------------------------------

export interface FiscalDeadline {
  id: string;
  month: number;       // 1-12 (0 = recurring every month)
  day: number;         // 1-31
  title: string;
  titleFr: string;
  description: string;
  descriptionFr: string;
  authority: 'CRA' | 'RQ' | 'BOTH' | 'SERVICE_CANADA';
  category: 'payroll' | 'corporate_tax' | 'sales_tax' | 'information_return' | 'installment';
  frequency: 'monthly' | 'quarterly' | 'annual';
  applicableProvinces: string[]; // empty = all
  penaltyInfo?: string;
}

export const FISCAL_DEADLINES: FiscalDeadline[] = [
  // January
  { id: 'payroll-dec-remit', month: 1, day: 15, title: 'December payroll remittance', titleFr: 'Remise paie decembre', description: 'Remit December source deductions', descriptionFr: 'Remettre les retenues a la source de decembre', authority: 'CRA', category: 'payroll', frequency: 'monthly', applicableProvinces: [] },
  { id: 'corp-tax-q4', month: 1, day: 31, title: 'Corporate tax installment', titleFr: 'Acompte impot corporatif', description: 'Monthly corporate tax installment (if >$3,000 annual tax)', descriptionFr: 'Acompte mensuel impot corporatif (si >3 000$ impot annuel)', authority: 'CRA', category: 'installment', frequency: 'monthly', applicableProvinces: [] },
  // February
  { id: 't4-filing', month: 2, day: 28, title: 'T4/T4A filing deadline', titleFr: 'Date limite T4/T4A', description: 'File T4 and T4A information returns and summaries', descriptionFr: 'Produire les feuillets T4 et T4A et sommaires', authority: 'CRA', category: 'information_return', frequency: 'annual', applicableProvinces: [] },
  { id: 'rl1-filing', month: 2, day: 28, title: 'RL-1 filing deadline', titleFr: 'Date limite RL-1', description: 'File RL-1 slips and summary for Quebec employees', descriptionFr: 'Produire les feuillets RL-1 et sommaire pour employes du Quebec', authority: 'RQ', category: 'information_return', frequency: 'annual', applicableProvinces: ['QC'] },
  { id: 't5-filing', month: 2, day: 28, title: 'T5 filing deadline', titleFr: 'Date limite T5', description: 'File T5 investment income returns', descriptionFr: 'Produire les feuillets T5 revenus de placement', authority: 'CRA', category: 'information_return', frequency: 'annual', applicableProvinces: [] },
  // March
  { id: 'corp-install-q1', month: 3, day: 31, title: 'Q1 corporate installment', titleFr: 'Acompte trimestriel T1', description: 'Quarterly corporate tax installment', descriptionFr: 'Acompte trimestriel impot corporatif', authority: 'CRA', category: 'installment', frequency: 'quarterly', applicableProvinces: [] },
  // April
  { id: 'gst-annual-mar', month: 4, day: 30, title: 'GST/QST annual return (Mar year-end)', titleFr: 'Declaration annuelle TPS/TVQ (fin mars)', description: 'Annual GST/HST and QST return for March 31 fiscal year-end', descriptionFr: 'Declaration annuelle TPS/TVH et TVQ pour fin d exercice 31 mars', authority: 'BOTH', category: 'sales_tax', frequency: 'annual', applicableProvinces: [] },
  // June
  { id: 't2-dec-yearend', month: 6, day: 30, title: 'T2 corporate return (Dec year-end)', titleFr: 'Declaration T2 (fin decembre)', description: 'Federal corporate tax return for December 31 year-end (6 months after)', descriptionFr: 'Declaration impot corporatif federal pour fin d exercice 31 decembre', authority: 'CRA', category: 'corporate_tax', frequency: 'annual', applicableProvinces: [] },
  { id: 'co17-dec-yearend', month: 6, day: 30, title: 'CO-17 provincial return (Dec year-end)', titleFr: 'Declaration CO-17 (fin decembre)', description: 'Quebec provincial corporate tax return for December 31 year-end', descriptionFr: 'Declaration impot corporatif provincial Quebec fin decembre', authority: 'RQ', category: 'corporate_tax', frequency: 'annual', applicableProvinces: ['QC'] },
  { id: 'gst-annual-dec', month: 6, day: 30, title: 'GST/QST annual return (Dec year-end)', titleFr: 'Declaration annuelle TPS/TVQ (fin decembre)', description: 'Annual GST/HST and QST return for December 31 fiscal year-end', descriptionFr: 'Declaration annuelle TPS/TVH et TVQ pour fin d exercice 31 decembre', authority: 'BOTH', category: 'sales_tax', frequency: 'annual', applicableProvinces: [] },
  // Monthly (recurring)
  { id: 'payroll-monthly', month: 0, day: 15, title: 'Monthly payroll remittance', titleFr: 'Remise mensuelle paie', description: 'Source deductions due by 15th of following month', descriptionFr: 'Retenues a la source dues le 15 du mois suivant', authority: 'BOTH', category: 'payroll', frequency: 'monthly', applicableProvinces: [] },
  { id: 'gst-monthly', month: 0, day: 30, title: 'Monthly GST/QST return', titleFr: 'Declaration mensuelle TPS/TVQ', description: 'Monthly GST/HST and QST return and remittance', descriptionFr: 'Declaration et remise mensuelles TPS/TVH et TVQ', authority: 'BOTH', category: 'sales_tax', frequency: 'monthly', applicableProvinces: [] },
];

// -----------------------------------------------------------------------------
// 4. Corporate Tax Rates
// -----------------------------------------------------------------------------

export interface CorporateTaxRate {
  province: string;
  federalSmallBusiness: number;  // SBD rate (first $500K)
  federalGeneral: number;        // General rate
  provincialSmallBusiness: number;
  provincialGeneral: number;
  combinedSmallBusiness: number;
  combinedGeneral: number;
  smallBusinessLimit: number;    // Usually $500,000
  conditions?: string;
  effectiveDate: string;
}

export const CORPORATE_TAX_RATES: CorporateTaxRate[] = [
  { province: 'QC', federalSmallBusiness: 9, federalGeneral: 15, provincialSmallBusiness: 3.2, provincialGeneral: 11.5, combinedSmallBusiness: 12.2, combinedGeneral: 26.5, smallBusinessLimit: 500000, conditions: '5,500 heures remunerees', effectiveDate: '2024-01-01' },
  { province: 'ON', federalSmallBusiness: 9, federalGeneral: 15, provincialSmallBusiness: 3.2, provincialGeneral: 11.5, combinedSmallBusiness: 12.2, combinedGeneral: 26.5, smallBusinessLimit: 500000, effectiveDate: '2020-01-01' },
  { province: 'AB', federalSmallBusiness: 9, federalGeneral: 15, provincialSmallBusiness: 2, provincialGeneral: 8, combinedSmallBusiness: 11, combinedGeneral: 23, smallBusinessLimit: 500000, effectiveDate: '2020-01-01' },
  { province: 'BC', federalSmallBusiness: 9, federalGeneral: 15, provincialSmallBusiness: 2, provincialGeneral: 12, combinedSmallBusiness: 11, combinedGeneral: 27, smallBusinessLimit: 500000, effectiveDate: '2018-01-01' },
];

// -----------------------------------------------------------------------------
// 5. Payroll Rates Quebec 2026
// -----------------------------------------------------------------------------

export interface PayrollRate {
  id: string;
  name: string;
  nameFr: string;
  employeeRate: number;
  employerRate: number;
  maxInsurableEarnings: number;
  annualExemption: number;
  maxContributionEmployee: number;
  maxContributionEmployer: number;
  authority: string;
}

// FIX: F099 - These rates are specific to fiscal year 2026. TODO: Add year parameter
// and load rates from DB/config for automatic annual updates.
export const PAYROLL_RATES_QC_2026: PayrollRate[] = [
  { id: 'qpp-base', name: 'QPP Base', nameFr: 'RRQ de base', employeeRate: 5.30, employerRate: 5.30, maxInsurableEarnings: 74600, annualExemption: 3500, maxContributionEmployee: 3768, maxContributionEmployer: 3768, authority: 'RQ' },
  { id: 'qpp2', name: 'QPP2', nameFr: 'RRQ2', employeeRate: 4.00, employerRate: 4.00, maxInsurableEarnings: 85000, annualExemption: 74600, maxContributionEmployee: 416, maxContributionEmployer: 416, authority: 'RQ' },
  { id: 'ei', name: 'Employment Insurance', nameFr: 'Assurance-emploi', employeeRate: 1.63, employerRate: 2.282, maxInsurableEarnings: 68900, annualExemption: 0, maxContributionEmployee: 1123, maxContributionEmployer: 1572, authority: 'CRA' },
  { id: 'rqap', name: 'QPIP', nameFr: 'RQAP', employeeRate: 0.455, employerRate: 0.636, maxInsurableEarnings: 103000, annualExemption: 0, maxContributionEmployee: 469, maxContributionEmployer: 655, authority: 'RQ' },
  { id: 'fss', name: 'Health Services Fund', nameFr: 'FSS', employeeRate: 0, employerRate: 1.65, maxInsurableEarnings: 0, annualExemption: 0, maxContributionEmployee: 0, maxContributionEmployer: 0, authority: 'RQ' },
  { id: 'cnt', name: 'Labour Standards', nameFr: 'CNT', employeeRate: 0, employerRate: 0.07, maxInsurableEarnings: 103000, annualExemption: 0, maxContributionEmployee: 0, maxContributionEmployer: 72, authority: 'RQ' },
  { id: 'formation', name: 'Workforce Skills Development', nameFr: 'Formation 1%', employeeRate: 0, employerRate: 1.0, maxInsurableEarnings: 0, annualExemption: 0, maxContributionEmployee: 0, maxContributionEmployer: 0, authority: 'RQ' },
];

// -----------------------------------------------------------------------------
// 6. Deductibility Rules
// -----------------------------------------------------------------------------

export interface DeductibilityRule {
  category: string;
  categoryFr: string;
  deductiblePercent: number;
  examples: string[];
  examplesFr: string[];
  notes?: string;
  ircSection?: string;
}

export const DEDUCTIBILITY_RULES: DeductibilityRule[] = [
  { category: 'Fully deductible', categoryFr: 'Entierement deductible', deductiblePercent: 100, examples: ['Salaries', 'Commercial rent', 'Insurance', 'Professional fees', 'Advertising', 'Supplies', 'Software', 'Travel', 'Shipping', 'Repairs'], examplesFr: ['Salaires', 'Loyer commercial', 'Assurances', 'Honoraires', 'Publicite', 'Fournitures', 'Logiciels', 'Voyages', 'Livraison', 'Reparations'] },
  { category: 'Partially deductible', categoryFr: 'Partiellement deductible', deductiblePercent: 50, examples: ['Business meals', 'Client entertainment'], examplesFr: ['Repas affaires', 'Divertissement clients'], notes: '50% of reasonable amounts' },
  { category: 'Non-deductible', categoryFr: 'Non deductible', deductiblePercent: 0, examples: ['Fines/penalties', 'Personal expenses', 'Home-to-work commuting', 'Political donations', 'Social/sports club dues', 'Life insurance premiums', 'Income taxes', 'Capital expenditures'], examplesFr: ['Amendes/penalites', 'Depenses personnelles', 'Transport domicile-bureau', 'Dons politiques', 'Cotisations clubs sociaux/sportifs', 'Primes assurance-vie', 'Impots sur le revenu', 'Depenses en capital'], notes: 'Capital expenditures go through CCA instead' },
];

// -----------------------------------------------------------------------------
// 7. Document Retention Rules
// -----------------------------------------------------------------------------

export interface RetentionRule {
  documentType: string;
  documentTypeFr: string;
  retentionYears: number; // 0 = permanent
  authority: string;
  legalReference: string;
}

export const DOCUMENT_RETENTION_RULES: RetentionRule[] = [
  { documentType: 'General accounting records', documentTypeFr: 'Registres comptables generaux', retentionYears: 6, authority: 'CRA', legalReference: 's.230(4) ITA' },
  { documentType: 'T2 corporate returns', documentTypeFr: 'Declarations T2', retentionYears: 6, authority: 'CRA', legalReference: 'IT-Folio S4-F14-C1' },
  { documentType: 'GST/QST records', documentTypeFr: 'Registres TPS/TVQ', retentionYears: 6, authority: 'CRA/RQ', legalReference: 's.286 ETA' },
  { documentType: 'Payroll records', documentTypeFr: 'Registres de paie', retentionYears: 6, authority: 'CRA/RQ', legalReference: 's.230(4) ITA' },
  { documentType: 'T4/RL-1 copies', documentTypeFr: 'Copies T4/RL-1', retentionYears: 6, authority: 'CRA/RQ', legalReference: 's.230(4) ITA' },
  { documentType: 'ROE', documentTypeFr: 'RE', retentionYears: 6, authority: 'Service Canada', legalReference: 'EI Act s.87' },
  { documentType: 'Articles of incorporation', documentTypeFr: 'Acte constitutif', retentionYears: 0, authority: 'Corporate law', legalReference: 'CBCA/QBCA' },
  { documentType: 'Board minutes', documentTypeFr: 'PV assemblees', retentionYears: 0, authority: 'Corporate law', legalReference: 'CBCA s.20' },
  { documentType: 'Share register', documentTypeFr: 'Registre actions', retentionYears: 0, authority: 'Corporate law', legalReference: 'CBCA s.50' },
];

// -----------------------------------------------------------------------------
// 8. Tax Credits
// -----------------------------------------------------------------------------

export interface TaxCredit {
  id: string;
  name: string;
  nameFr: string;
  jurisdiction: 'federal' | 'quebec' | 'both';
  rate: number;
  enhancedRate?: number;
  limit?: number;
  enhancedLimit?: number;
  refundable: boolean;
  form: string;
  description: string;
  effectiveDate: string;
}

export const TAX_CREDITS: TaxCredit[] = [
  { id: 'sred-federal', name: 'SR&ED Federal', nameFr: 'RS&DE federal', jurisdiction: 'federal', rate: 15, enhancedRate: 35, limit: 6000000, enhancedLimit: 2100000, refundable: true, form: 'T661', description: 'Scientific Research and Experimental Development', effectiveDate: '2025-03-01' },
  { id: 'cric-quebec', name: 'CRIC Quebec', nameFr: 'CRIC Quebec', jurisdiction: 'quebec', rate: 20, enhancedRate: 30, limit: 1000000, refundable: true, form: 'CO-17', description: 'Credit d investissement et d innovation', effectiveDate: '2025-03-25' },
  { id: 'apprenticeship', name: 'Apprenticeship Job Creation', nameFr: 'Credit apprentissage', jurisdiction: 'federal', rate: 10, limit: 2000, refundable: false, form: 'T2 Schedule 31', description: 'Credit for employing apprentices', effectiveDate: '2006-01-01' },
  { id: 'clean-tech', name: 'Clean Technology ITC', nameFr: 'Credit tech propre', jurisdiction: 'federal', rate: 30, refundable: true, form: 'T2 Schedule', description: 'Credit for clean technology equipment', effectiveDate: '2024-01-01' },
];

// -----------------------------------------------------------------------------
// 9. Helper Functions
// -----------------------------------------------------------------------------

/**
 * Find the tax rate configuration for a given province/territory code.
 *
 * FIX: F005 - When `asOfDate` is provided, only rates whose `effectiveDate`
 * is on or before that date are considered. This correctly handles NS HST
 * dropping from 15% to 14% on 2025-04-01 (and any future rate changes).
 * If multiple entries exist for the same province, the one with the latest
 * effectiveDate that is still <= asOfDate wins.
 *
 * @param provinceCode - Two-letter province code (e.g. 'QC', 'ON', 'AB')
 * @param asOfDate - Optional transaction date for effectiveDate filtering
 * @returns The ProvincialTaxRate entry or undefined if not found.
 */
export function getTaxRateForProvince(
  provinceCode: string,
  asOfDate?: Date
): ProvincialTaxRate | undefined {
  const code = provinceCode.toUpperCase();
  const candidates = PROVINCIAL_TAX_RATES.filter(
    (rate) => rate.provinceCode === code
  );

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1 || !asOfDate) return candidates[candidates.length - 1];

  // FIX: F005 - Filter by effectiveDate <= asOfDate and pick the most recent
  const dateStr = asOfDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const applicable = candidates
    .filter((r) => r.effectiveDate <= dateStr)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  return applicable.length > 0 ? applicable[applicable.length - 1] : candidates[0];
}

/**
 * Calculate sales tax on an amount based on origin and destination provinces.
 *
 * Canadian sales tax is generally charged based on the destination (place of
 * supply) for goods shipped to the customer. This function uses the
 * destination province rate. The `fromProvince` parameter is accepted for
 * future place-of-supply rule refinements but the current implementation
 * applies destination-based taxation.
 *
 * FIX: F005 - Added optional `asOfDate` parameter so the correct rate is
 * selected when a province has had rate changes (e.g. NS HST 15% -> 14%
 * effective 2025-04-01).
 *
 * @param amount - The pre-tax amount in CAD.
 * @param fromProvince - Province code where the seller is located.
 * @param toProvince - Province code where the buyer is located (destination).
 * @param asOfDate - Optional transaction date for effectiveDate-based rate lookup.
 * @returns Breakdown of GST, PST, HST and total tax.
 */
export function calculateSalesTax(
  amount: number,
  _fromProvince: string,
  toProvince: string,
  asOfDate?: Date
): { gst: number; pst: number; hst: number; total: number } {
  const rate = getTaxRateForProvince(toProvince, asOfDate);

  if (!rate) {
    return { gst: 0, pst: 0, hst: 0, total: 0 };
  }

  // HST provinces: a single harmonized rate replaces separate GST + PST
  if (rate.hstRate > 0) {
    const hst = Math.round(amount * (rate.hstRate / 100) * 100) / 100;
    return { gst: 0, pst: 0, hst, total: hst };
  }

  // Separate GST + PST/QST/RST provinces
  const gst = Math.round(amount * (rate.gstRate / 100) * 100) / 100;
  const pst = Math.round(amount * (rate.pstRate / 100) * 100) / 100;
  const total = Math.round((gst + pst) * 100) / 100;

  return { gst, pst, hst: 0, total };
}

/**
 * Find a CCA class by its class number.
 * @param classNumber - The CCA class number (e.g. 1, 8, 10, 10.1, 50).
 * @returns The CCAClass entry or undefined if not found.
 */
export function getCCAClass(classNumber: number): CCAClass | undefined {
  return CCA_CLASSES.find((c) => c.classNumber === classNumber);
}

/**
 * Calculate the Capital Cost Allowance deduction for a given asset.
 *
 * Supports the half-year rule (50% of the addition in year of acquisition)
 * and the Accelerated Investment Incentive (AII) which allows 1.5x the
 * normal first-year deduction for eligible property.
 *
 * For classes with method 'lease-term' or 'straight-line' and rate 0,
 * this function returns 0 since those require additional inputs (lease
 * duration, patent life) that are outside the scope of this helper.
 *
 * @param cost - The capital cost of the asset in CAD.
 * @param classNumber - The CCA class number.
 * @param yearOfAcquisition - True if this is the first year (half-year rule may apply).
 * @param aiiApplies - True if the Accelerated Investment Incentive applies.
 * @returns The CCA deduction amount for the year.
 */
export function calculateCCA(
  cost: number,
  classNumber: number,
  yearOfAcquisition: boolean,
  aiiApplies: boolean
): number {
  const ccaClass = getCCAClass(classNumber);
  if (!ccaClass) {
    return 0;
  }

  // Classes with rate 0 (lease-term, straight-line without rate) need
  // additional context that this generic helper cannot provide.
  if (ccaClass.rate === 0) {
    return 0;
  }

  const rate = ccaClass.rate / 100;
  let effectiveCost = cost;

  if (yearOfAcquisition) {
    if (aiiApplies && ccaClass.aiiEligible) {
      // AII: 1.5x the normal rate in the first year (no half-year reduction)
      effectiveCost = cost * 1.5;
    } else if (ccaClass.halfYearRule) {
      // Standard half-year rule: only 50% of the net addition is available
      effectiveCost = cost * 0.5;
    }
  }

  const deduction = Math.round(effectiveCost * rate * 100) / 100;

  // CCA cannot exceed the original cost of the asset
  return Math.min(deduction, cost);
}

/**
 * Get upcoming fiscal deadlines within a given number of days from today.
 *
 * For recurring monthly deadlines (month === 0), the function generates
 * occurrences for every month within the lookahead window. Annual and
 * quarterly deadlines are matched against their specific month/day.
 *
 * @param daysAhead - Number of days to look ahead from today.
 * @returns Array of FiscalDeadline entries whose dates fall within the window.
 */
export function getUpcomingDeadlines(daysAhead: number): FiscalDeadline[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);

  const currentYear = today.getFullYear();
  const results: FiscalDeadline[] = [];

  for (const deadline of FISCAL_DEADLINES) {
    if (deadline.month === 0) {
      // Recurring monthly deadline: check each month in the window
      for (let m = 0; m < 12; m++) {
        const candidateDate = new Date(currentYear, m, deadline.day);
        if (candidateDate >= today && candidateDate <= endDate) {
          results.push(deadline);
          break; // Only include once per lookahead to avoid duplicates in output
        }
      }
      // Also check next year January in case window crosses year boundary
      const nextYearCandidate = new Date(currentYear + 1, 0, deadline.day);
      if (nextYearCandidate >= today && nextYearCandidate <= endDate) {
        // Avoid duplicate if already added
        if (!results.includes(deadline)) {
          results.push(deadline);
        }
      }
    } else {
      // Specific month deadline
      const candidateDate = new Date(currentYear, deadline.month - 1, deadline.day);
      if (candidateDate >= today && candidateDate <= endDate) {
        results.push(deadline);
      } else {
        // Check next year in case the deadline already passed this year
        const nextYearCandidate = new Date(currentYear + 1, deadline.month - 1, deadline.day);
        if (nextYearCandidate >= today && nextYearCandidate <= endDate) {
          results.push(deadline);
        }
      }
    }
  }

  return results;
}

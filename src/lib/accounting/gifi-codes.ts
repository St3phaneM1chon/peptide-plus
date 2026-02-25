// =============================================================================
// GIFI Codes - General Index of Financial Information
// Canadian Revenue Agency (CRA) standard classification for T2 corporate
// tax returns (Schedule 100, 125, 141)
// =============================================================================

/**
 * Represents a single GIFI (General Index of Financial Information) code
 * used by the CRA for standardized financial statement reporting.
 */
export interface GifiCode {
  /** The numeric GIFI code (e.g., "1001") */
  code: string;
  /** English name of the financial line item */
  nameEn: string;
  /** French name of the financial line item */
  nameFr: string;
  /** High-level category grouping */
  category: string;
  /** The GIFI range this code belongs to (e.g., "1000-1599") */
  range: string;
}

/**
 * Template for mapping internal chart of accounts to GIFI codes,
 * with optional CCA (Capital Cost Allowance) class information.
 */
export interface ChartOfAccountTemplate {
  /** Internal account number */
  number: string;
  /** French account name */
  name: string;
  /** English account name */
  nameEn: string;
  /** Corresponding GIFI code */
  gifiCode: string;
  /** Account type */
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  /** Whether this is a contra account (reduces its parent category) */
  isContra?: boolean;
  /** CCA class number for depreciable assets */
  ccaClass?: number;
  /** CCA rate (percentage) for the asset class */
  ccaRate?: number;
  /** Deductible percentage (e.g., 50 for meals & entertainment) */
  deductiblePercent?: number;
}

// =============================================================================
// GIFI Categories - Major groupings with their code ranges
// =============================================================================

export const GIFI_CATEGORIES = {
  CURRENT_ASSETS: { name: 'Current Assets', nameFr: 'Actifs courants', range: '1000-1599' },
  LONG_TERM_ASSETS: { name: 'Long-Term Assets', nameFr: 'Actifs a long terme', range: '1600-2599' },
  CURRENT_LIABILITIES: { name: 'Current Liabilities', nameFr: 'Passifs courants', range: '2600-3139' },
  LONG_TERM_LIABILITIES: { name: 'Long-Term Liabilities', nameFr: 'Passifs a long terme', range: '3140-3449' },
  EQUITY: { name: 'Equity', nameFr: 'Capitaux propres', range: '3450-3620' },
  REVENUE: { name: 'Revenue', nameFr: 'Revenus', range: '7000-8089' },
  COST_OF_SALES: { name: 'Cost of Sales', nameFr: 'Cout des ventes', range: '8090-8518' },
  OPERATING_EXPENSES: { name: 'Operating Expenses', nameFr: 'Charges d\'exploitation', range: '8519-9369' },
  INCOME_TAX: { name: 'Income Tax', nameFr: 'Impot sur le revenu', range: '9975-9999' },
} as const;

export type GifiCategoryKey = keyof typeof GIFI_CATEGORIES;

// =============================================================================
// Helper to determine category from a numeric GIFI code
// =============================================================================

function categoryForCode(code: string): { category: GifiCategoryKey; range: string } {
  const num = parseInt(code, 10);
  if (num >= 1000 && num <= 1599) return { category: 'CURRENT_ASSETS', range: '1000-1599' };
  if (num >= 1600 && num <= 2599) return { category: 'LONG_TERM_ASSETS', range: '1600-2599' };
  if (num >= 2600 && num <= 3139) return { category: 'CURRENT_LIABILITIES', range: '2600-3139' };
  if (num >= 3140 && num <= 3449) return { category: 'LONG_TERM_LIABILITIES', range: '3140-3449' };
  if (num >= 3450 && num <= 3620) return { category: 'EQUITY', range: '3450-3620' };
  // FIX: F071 - Range label was inaccurate ('3450-3620' for codes 3621-3849).
  // CRA GIFI codes 3621-3849 are indeed EQUITY but form their own sub-range.
  if (num >= 3621 && num <= 3849) return { category: 'EQUITY', range: '3621-3849' };
  if (num >= 7000 && num <= 8089) return { category: 'REVENUE', range: '7000-8089' };
  if (num >= 8090 && num <= 8518) return { category: 'COST_OF_SALES', range: '8090-8518' };
  if (num >= 8519 && num <= 9369) return { category: 'OPERATING_EXPENSES', range: '8519-9369' };
  if (num >= 9975 && num <= 9999) return { category: 'INCOME_TAX', range: '9975-9999' };
  // Fallback for codes in gaps (e.g., 9370-9974 are other expenses)
  if (num >= 9370 && num <= 9974) return { category: 'OPERATING_EXPENSES', range: '8519-9369' };
  return { category: 'CURRENT_ASSETS', range: '1000-1599' };
}

// =============================================================================
// GIFI_CODES - Comprehensive list of commonly used GIFI codes
// =============================================================================

export const GIFI_CODES: GifiCode[] = [
  // ---------------------------------------------------------------------------
  // CURRENT ASSETS (1000-1599)
  // ---------------------------------------------------------------------------
  { code: '1001', nameEn: 'Cash and deposits', nameFr: 'Encaisse et depots', ...spread('1001') },
  { code: '1002', nameEn: 'Short-term investments', nameFr: 'Placements a court terme', ...spread('1002') },
  { code: '1003', nameEn: 'Canadian government securities', nameFr: 'Titres du gouvernement canadien', ...spread('1003') },
  { code: '1004', nameEn: 'Other securities', nameFr: 'Autres titres', ...spread('1004') },
  { code: '1006', nameEn: 'Accrued revenue', nameFr: 'Revenus courus', ...spread('1006') },
  { code: '1007', nameEn: 'Cash surrender value of life insurance', nameFr: 'Valeur de rachat assurance-vie', ...spread('1007') },
  { code: '1060', nameEn: 'Accounts receivable', nameFr: 'Comptes clients', ...spread('1060') },
  { code: '1061', nameEn: 'Allowance for doubtful accounts', nameFr: 'Provision pour creances douteuses', ...spread('1061') },
  { code: '1062', nameEn: 'Loans receivable - shareholders', nameFr: 'Prets a recevoir - actionnaires', ...spread('1062') },
  { code: '1063', nameEn: 'Loans receivable - related parties', nameFr: 'Prets a recevoir - parties liees', ...spread('1063') },
  { code: '1066', nameEn: 'Other receivables', nameFr: 'Autres debiteurs', ...spread('1066') },
  { code: '1120', nameEn: 'Inventories', nameFr: 'Stocks', ...spread('1120') },
  { code: '1121', nameEn: 'Raw materials', nameFr: 'Matieres premieres', ...spread('1121') },
  { code: '1122', nameEn: 'Work in progress', nameFr: 'Produits en cours', ...spread('1122') },
  { code: '1123', nameEn: 'Finished goods', nameFr: 'Produits finis', ...spread('1123') },
  { code: '1124', nameEn: 'Goods in transit', nameFr: 'Marchandises en transit', ...spread('1124') },
  { code: '1125', nameEn: 'Inventory reserve', nameFr: 'Provision pour depreciation des stocks', ...spread('1125') },
  { code: '1180', nameEn: 'Prepaid expenses', nameFr: 'Frais payes d\'avance', ...spread('1180') },
  { code: '1181', nameEn: 'Tax instalments', nameFr: 'Acomptes provisionnels d\'impot', ...spread('1181') },
  { code: '1300', nameEn: 'Other current assets', nameFr: 'Autres actifs courants', ...spread('1300') },
  { code: '1301', nameEn: 'Due from related parties', nameFr: 'Du par des parties liees', ...spread('1301') },
  { code: '1302', nameEn: 'Due from shareholders', nameFr: 'Du par des actionnaires', ...spread('1302') },
  { code: '1303', nameEn: 'Due from directors', nameFr: 'Du par des administrateurs', ...spread('1303') },

  // ---------------------------------------------------------------------------
  // LONG-TERM ASSETS (1600-2599)
  // ---------------------------------------------------------------------------
  // Investments
  { code: '1600', nameEn: 'Long-term investments', nameFr: 'Placements a long terme', ...spread('1600') },
  { code: '1601', nameEn: 'Investments in associated companies', nameFr: 'Placements dans des societes associees', ...spread('1601') },
  { code: '1602', nameEn: 'Investments in joint ventures', nameFr: 'Placements dans des coentreprises', ...spread('1602') },
  { code: '1603', nameEn: 'Investments in subsidiaries', nameFr: 'Placements dans des filiales', ...spread('1603') },
  { code: '1690', nameEn: 'Other long-term investments', nameFr: 'Autres placements a long terme', ...spread('1690') },

  // Intangible assets
  { code: '2010', nameEn: 'Goodwill', nameFr: 'Achalandage', ...spread('2010') },
  { code: '2011', nameEn: 'Accumulated amortization - goodwill', nameFr: 'Amortissement cumule - achalandage', ...spread('2011') },
  { code: '2020', nameEn: 'Trademarks and trade names', nameFr: 'Marques de commerce et noms commerciaux', ...spread('2020') },
  { code: '2030', nameEn: 'Patents', nameFr: 'Brevets', ...spread('2030') },
  { code: '2040', nameEn: 'Franchise rights', nameFr: 'Droits de franchise', ...spread('2040') },
  { code: '2050', nameEn: 'Copyrights', nameFr: 'Droits d\'auteur', ...spread('2050') },
  { code: '2060', nameEn: 'Customer lists', nameFr: 'Listes de clients', ...spread('2060') },
  { code: '2070', nameEn: 'Licences and permits', nameFr: 'Licences et permis', ...spread('2070') },
  { code: '2100', nameEn: 'Software', nameFr: 'Logiciels', ...spread('2100') },
  { code: '2130', nameEn: 'Research and development costs', nameFr: 'Frais de recherche et developpement', ...spread('2130') },
  { code: '2140', nameEn: 'Deferred development costs', nameFr: 'Frais de developpement reportes', ...spread('2140') },
  { code: '2170', nameEn: 'Accumulated depreciation on tangible capital assets', nameFr: 'Amortissement cumule sur immobilisations corporelles', ...spread('2170') },
  { code: '2178', nameEn: 'Other intangible assets', nameFr: 'Autres actifs incorporels', ...spread('2178') },
  { code: '2179', nameEn: 'Accumulated amortization - other intangible assets', nameFr: 'Amortissement cumule - autres actifs incorporels', ...spread('2179') },
  { code: '2180', nameEn: 'Resource properties', nameFr: 'Avoirs miniers', ...spread('2180') },

  // Tangible capital assets
  { code: '2400', nameEn: 'Land', nameFr: 'Terrain', ...spread('2400') },
  { code: '2410', nameEn: 'Buildings', nameFr: 'Batiments', ...spread('2410') },
  { code: '2411', nameEn: 'Accumulated depreciation - buildings', nameFr: 'Amortissement cumule - batiments', ...spread('2411') },
  { code: '2420', nameEn: 'Machinery and equipment', nameFr: 'Machinerie et equipement', ...spread('2420') },
  { code: '2421', nameEn: 'Accumulated depreciation - machinery and equipment', nameFr: 'Amortissement cumule - machinerie et equipement', ...spread('2421') },
  { code: '2422', nameEn: 'Computer equipment', nameFr: 'Materiel informatique', ...spread('2422') },
  { code: '2423', nameEn: 'Accumulated depreciation - computer equipment', nameFr: 'Amortissement cumule - materiel informatique', ...spread('2423') },
  { code: '2430', nameEn: 'Furniture and fixtures', nameFr: 'Mobilier et agencements', ...spread('2430') },
  { code: '2431', nameEn: 'Accumulated depreciation - furniture and fixtures', nameFr: 'Amortissement cumule - mobilier et agencements', ...spread('2431') },
  { code: '2432', nameEn: 'Leasehold improvements', nameFr: 'Ameliorations locatives', ...spread('2432') },
  { code: '2433', nameEn: 'Accumulated amortization - leasehold improvements', nameFr: 'Amortissement cumule - ameliorations locatives', ...spread('2433') },
  { code: '2450', nameEn: 'Motor vehicles', nameFr: 'Vehicules', ...spread('2450') },
  { code: '2451', nameEn: 'Accumulated depreciation - motor vehicles', nameFr: 'Amortissement cumule - vehicules', ...spread('2451') },
  { code: '2460', nameEn: 'Other tangible capital assets', nameFr: 'Autres immobilisations corporelles', ...spread('2460') },
  { code: '2461', nameEn: 'Accumulated depreciation - other tangible capital assets', nameFr: 'Amortissement cumule - autres immobilisations corporelles', ...spread('2461') },
  { code: '2500', nameEn: 'Construction in progress', nameFr: 'Construction en cours', ...spread('2500') },

  // Other long-term assets
  { code: '2540', nameEn: 'Deferred charges', nameFr: 'Frais reportes', ...spread('2540') },
  { code: '2550', nameEn: 'Other long-term assets', nameFr: 'Autres actifs a long terme', ...spread('2550') },
  { code: '2560', nameEn: 'Right-of-use assets', nameFr: 'Actifs au titre du droit d\'utilisation', ...spread('2560') },
  { code: '2599', nameEn: 'Total assets', nameFr: 'Total de l\'actif', ...spread('2599') },

  // ---------------------------------------------------------------------------
  // CURRENT LIABILITIES (2600-3139)
  // ---------------------------------------------------------------------------
  { code: '2600', nameEn: 'Bank overdraft', nameFr: 'Decouvert bancaire', ...spread('2600') },
  { code: '2601', nameEn: 'Demand loans', nameFr: 'Emprunts a vue', ...spread('2601') },
  { code: '2620', nameEn: 'Accounts payable and accrued liabilities', nameFr: 'Comptes fournisseurs et charges a payer', ...spread('2620') },
  { code: '2621', nameEn: 'Accounts payable - trade', nameFr: 'Comptes fournisseurs - commerce', ...spread('2621') },
  { code: '2680', nameEn: 'Accrued liabilities', nameFr: 'Charges a payer', ...spread('2680') },
  { code: '2681', nameEn: 'Wages and salaries payable', nameFr: 'Salaires a payer', ...spread('2681') },
  { code: '2682', nameEn: 'Interest payable', nameFr: 'Interets a payer', ...spread('2682') },
  { code: '2700', nameEn: 'Current portion of long-term debt', nameFr: 'Portion courante de la dette a long terme', ...spread('2700') },
  { code: '2780', nameEn: 'Income taxes payable', nameFr: 'Impots sur le revenu a payer', ...spread('2780') },
  { code: '2781', nameEn: 'Federal income tax payable', nameFr: 'Impot federal sur le revenu a payer', ...spread('2781') },
  { code: '2782', nameEn: 'Provincial income tax payable', nameFr: 'Impot provincial sur le revenu a payer', ...spread('2782') },
  { code: '2800', nameEn: 'Deferred revenue', nameFr: 'Produits reportes', ...spread('2800') },
  { code: '2810', nameEn: 'Customer deposits', nameFr: 'Depots de clients', ...spread('2810') },
  { code: '2860', nameEn: 'Due to shareholders', nameFr: 'Du aux actionnaires', ...spread('2860') },
  { code: '2861', nameEn: 'Due to related parties', nameFr: 'Du aux parties liees', ...spread('2861') },
  { code: '2862', nameEn: 'Due to directors', nameFr: 'Du aux administrateurs', ...spread('2862') },
  { code: '2900', nameEn: 'Current portion of lease obligations', nameFr: 'Portion courante des obligations locatives', ...spread('2900') },
  { code: '2960', nameEn: 'Dividends payable', nameFr: 'Dividendes a payer', ...spread('2960') },
  { code: '3000', nameEn: 'Other current liabilities', nameFr: 'Autres passifs courants', ...spread('3000') },
  { code: '3040', nameEn: 'Sales tax payable', nameFr: 'Taxes de vente a payer', ...spread('3040') },
  { code: '3050', nameEn: 'Payroll taxes payable', nameFr: 'Charges sociales a payer', ...spread('3050') },
  { code: '3060', nameEn: 'Source deductions payable', nameFr: 'Retenues a la source a payer', ...spread('3060') },
  { code: '3100', nameEn: 'Current portion of provisions', nameFr: 'Portion courante des provisions', ...spread('3100') },
  { code: '3139', nameEn: 'Total current liabilities', nameFr: 'Total des passifs courants', ...spread('3139') },

  // ---------------------------------------------------------------------------
  // LONG-TERM LIABILITIES (3140-3449)
  // ---------------------------------------------------------------------------
  { code: '3140', nameEn: 'Long-term debt', nameFr: 'Dette a long terme', ...spread('3140') },
  { code: '3141', nameEn: 'Mortgage payable', nameFr: 'Hypotheque a payer', ...spread('3141') },
  { code: '3142', nameEn: 'Bank loans - long-term', nameFr: 'Emprunts bancaires - long terme', ...spread('3142') },
  { code: '3145', nameEn: 'Bonds and debentures payable', nameFr: 'Obligations et debentures a payer', ...spread('3145') },
  { code: '3150', nameEn: 'Shareholder loans', nameFr: 'Prets d\'actionnaires', ...spread('3150') },
  { code: '3151', nameEn: 'Director loans', nameFr: 'Prets d\'administrateurs', ...spread('3151') },
  { code: '3160', nameEn: 'Long-term lease obligations', nameFr: 'Obligations locatives a long terme', ...spread('3160') },
  { code: '3200', nameEn: 'Deferred tax liabilities', nameFr: 'Passifs d\'impots differes', ...spread('3200') },
  { code: '3250', nameEn: 'Pension and post-retirement obligations', nameFr: 'Obligations de retraite et post-emploi', ...spread('3250') },
  { code: '3300', nameEn: 'Provisions - long-term', nameFr: 'Provisions - long terme', ...spread('3300') },
  { code: '3400', nameEn: 'Other long-term liabilities', nameFr: 'Autres passifs a long terme', ...spread('3400') },
  { code: '3449', nameEn: 'Total long-term liabilities', nameFr: 'Total des passifs a long terme', ...spread('3449') },

  // ---------------------------------------------------------------------------
  // EQUITY (3450-3620)
  // ---------------------------------------------------------------------------
  { code: '3450', nameEn: 'Preferred shares', nameFr: 'Actions privilegiees', ...spread('3450') },
  { code: '3500', nameEn: 'Common shares / Share capital', nameFr: 'Actions ordinaires / Capital-actions', ...spread('3500') },
  { code: '3520', nameEn: 'Contributed surplus', nameFr: 'Surplus d\'apport', ...spread('3520') },
  { code: '3560', nameEn: 'Opening retained earnings', nameFr: 'Benefices non repartis d\'ouverture', ...spread('3560') },
  { code: '3600', nameEn: 'Retained earnings', nameFr: 'Benefices non repartis', ...spread('3600') },
  { code: '3610', nameEn: 'Accumulated other comprehensive income', nameFr: 'Cumul des autres elements du resultat global', ...spread('3610') },
  { code: '3620', nameEn: 'Total equity', nameFr: 'Total des capitaux propres', ...spread('3620') },

  // Equity adjustments (extended range commonly used)
  { code: '3680', nameEn: 'Treasury shares', nameFr: 'Actions auto-detenues', ...spread('3680') },
  { code: '3700', nameEn: 'Current year net income/loss', nameFr: 'Resultat net de l\'exercice', ...spread('3700') },
  { code: '3701', nameEn: 'Dividends declared', nameFr: 'Dividendes declares', ...spread('3701') },

  // ---------------------------------------------------------------------------
  // REVENUE (7000-8089)
  // ---------------------------------------------------------------------------
  { code: '7000', nameEn: 'Trade sales of goods and services', nameFr: 'Ventes commerciales de biens et services', ...spread('7000') },
  { code: '7010', nameEn: 'Sales to related parties', nameFr: 'Ventes a des parties liees', ...spread('7010') },
  { code: '8000', nameEn: 'Sales of goods and services', nameFr: 'Ventes de marchandises et services', ...spread('8000') },
  { code: '8001', nameEn: 'Gross sales', nameFr: 'Ventes brutes', ...spread('8001') },
  { code: '8002', nameEn: 'Sales discounts', nameFr: 'Escomptes sur ventes', ...spread('8002') },
  { code: '8003', nameEn: 'Sales returns and allowances', nameFr: 'Retours et rabais sur ventes', ...spread('8003') },
  { code: '8020', nameEn: 'Rental revenue', nameFr: 'Revenus de location', ...spread('8020') },
  { code: '8030', nameEn: 'Commission revenue', nameFr: 'Revenus de commissions', ...spread('8030') },
  { code: '8040', nameEn: 'Sales of services', nameFr: 'Ventes de services', ...spread('8040') },
  { code: '8050', nameEn: 'Management fee revenue', nameFr: 'Revenus de frais de gestion', ...spread('8050') },
  { code: '8060', nameEn: 'Interest and investment income', nameFr: 'Interets et revenus de placement', ...spread('8060') },
  { code: '8070', nameEn: 'Dividend income', nameFr: 'Revenus de dividendes', ...spread('8070') },
  { code: '8080', nameEn: 'Royalty income', nameFr: 'Revenus de redevances', ...spread('8080') },
  { code: '8089', nameEn: 'Other revenue', nameFr: 'Autres revenus', ...spread('8089') },

  // ---------------------------------------------------------------------------
  // COST OF SALES (8090-8518)
  // ---------------------------------------------------------------------------
  { code: '8090', nameEn: 'Opening inventories', nameFr: 'Stocks d\'ouverture', ...spread('8090') },
  { code: '8091', nameEn: 'Closing inventories', nameFr: 'Stocks de cloture', ...spread('8091') },
  { code: '8100', nameEn: 'Cost of goods sold', nameFr: 'Cout des marchandises vendues', ...spread('8100') },
  { code: '8210', nameEn: 'Gain or loss on disposal of assets', nameFr: 'Gain ou perte sur disposition d\'actifs', ...spread('8210') },
  { code: '8230', nameEn: 'Foreign exchange gain/loss', nameFr: 'Gain/perte de change', ...spread('8230') },
  { code: '8320', nameEn: 'Purchases / Cost of sales', nameFr: 'Achats / Cout des ventes', ...spread('8320') },
  { code: '8321', nameEn: 'Purchase discounts', nameFr: 'Escomptes sur achats', ...spread('8321') },
  { code: '8322', nameEn: 'Purchase returns and allowances', nameFr: 'Retours et rabais sur achats', ...spread('8322') },
  { code: '8323', nameEn: 'Freight in', nameFr: 'Fret a l\'achat', ...spread('8323') },
  { code: '8324', nameEn: 'Customs duties', nameFr: 'Droits de douane', ...spread('8324') },
  { code: '8340', nameEn: 'Direct labour', nameFr: 'Main-d\'oeuvre directe', ...spread('8340') },
  { code: '8341', nameEn: 'Direct materials', nameFr: 'Matieres premieres directes', ...spread('8341') },
  { code: '8350', nameEn: 'Manufacturing overhead', nameFr: 'Frais generaux de fabrication', ...spread('8350') },
  { code: '8400', nameEn: 'Subcontracts', nameFr: 'Sous-traitance', ...spread('8400') },
  { code: '8500', nameEn: 'Cost of services', nameFr: 'Cout des services', ...spread('8500') },
  { code: '8518', nameEn: 'Other cost of sales', nameFr: 'Autres couts des ventes', ...spread('8518') },

  // ---------------------------------------------------------------------------
  // OPERATING EXPENSES (8519-9369)
  // ---------------------------------------------------------------------------
  { code: '8519', nameEn: 'Total operating expenses', nameFr: 'Total des charges d\'exploitation', ...spread('8519') },
  { code: '8520', nameEn: 'Advertising and promotion', nameFr: 'Publicite et promotion', ...spread('8520') },
  { code: '8590', nameEn: 'Bad debts', nameFr: 'Mauvaises creances', ...spread('8590') },
  { code: '8610', nameEn: 'Delivery, shipping, and warehouse', nameFr: 'Livraison, expedition et entreposage', ...spread('8610') },
  { code: '8620', nameEn: 'Fuel costs (not motor vehicle)', nameFr: 'Frais de combustible (sauf vehicule)', ...spread('8620') },
  { code: '8640', nameEn: 'Insurance', nameFr: 'Assurances', ...spread('8640') },
  { code: '8670', nameEn: 'Interest - long-term debt', nameFr: 'Interets - dette a long terme', ...spread('8670') },
  { code: '8690', nameEn: 'Interest - mortgage', nameFr: 'Interets - hypotheque', ...spread('8690') },
  { code: '8710', nameEn: 'Interest expense - other', nameFr: 'Interets debiteurs - autres', ...spread('8710') },
  { code: '8740', nameEn: 'Business taxes, licences, memberships', nameFr: 'Taxes d\'affaires, licences, cotisations', ...spread('8740') },
  { code: '8750', nameEn: 'Property taxes', nameFr: 'Taxes foncieres', ...spread('8750') },
  { code: '8760', nameEn: 'Management and administration fees', nameFr: 'Frais de gestion et d\'administration', ...spread('8760') },
  { code: '8764', nameEn: 'Meals and entertainment', nameFr: 'Repas et divertissement', ...spread('8764') },
  { code: '8810', nameEn: 'Motor vehicle expenses', nameFr: 'Frais de vehicule automobile', ...spread('8810') },
  { code: '8860', nameEn: 'Office stationery and supplies', nameFr: 'Papeterie et fournitures de bureau', ...spread('8860') },
  { code: '8871', nameEn: 'Professional fees - legal', nameFr: 'Honoraires professionnels - juridiques', ...spread('8871') },
  { code: '8870', nameEn: 'Professional fees - accounting', nameFr: 'Honoraires professionnels - comptabilite', ...spread('8870') },
  { code: '8910', nameEn: 'Rent', nameFr: 'Loyer', ...spread('8910') },
  { code: '8960', nameEn: 'Repairs and maintenance', nameFr: 'Reparations et entretien', ...spread('8960') },
  { code: '9010', nameEn: 'Salaries, wages, and benefits', nameFr: 'Salaires, traitements et avantages sociaux', ...spread('9010') },
  { code: '9060', nameEn: 'Salaries and wages', nameFr: 'Salaires et traitements', ...spread('9060') },
  { code: '9100', nameEn: 'Employee benefits', nameFr: 'Avantages sociaux', ...spread('9100') },
  { code: '9105', nameEn: 'Employer portion of CPP/QPP', nameFr: 'Part de l\'employeur au RPC/RRQ', ...spread('9105') },
  { code: '9110', nameEn: 'Employer portion of EI', nameFr: 'Part de l\'employeur a l\'AE', ...spread('9110') },
  { code: '9120', nameEn: 'Advertising', nameFr: 'Publicite et marketing', ...spread('9120') },
  { code: '9130', nameEn: 'Commission expenses', nameFr: 'Frais de commissions', ...spread('9130') },
  { code: '9150', nameEn: 'Professional fees', nameFr: 'Honoraires professionnels', ...spread('9150') },
  { code: '9170', nameEn: 'Depreciation of tangible assets', nameFr: 'Amortissement des immobilisations corporelles', ...spread('9170') },
  { code: '9172', nameEn: 'Amortization of intangible assets', nameFr: 'Amortissement des actifs incorporels', ...spread('9172') },
  { code: '9175', nameEn: 'Amortization of leasehold improvements', nameFr: 'Amortissement des ameliorations locatives', ...spread('9175') },
  { code: '9180', nameEn: 'Rent', nameFr: 'Loyer', ...spread('9180') },
  { code: '9200', nameEn: 'Insurance', nameFr: 'Assurances', ...spread('9200') },
  { code: '9220', nameEn: 'Utilities', nameFr: 'Services publics', ...spread('9220') },
  { code: '9224', nameEn: 'Telephone and telecommunications', nameFr: 'Telephone et telecommunications', ...spread('9224') },
  { code: '9230', nameEn: 'Computer and IT expenses', nameFr: 'Frais informatiques', ...spread('9230') },
  { code: '9240', nameEn: 'Consulting fees', nameFr: 'Frais de consultation', ...spread('9240') },
  { code: '9270', nameEn: 'Office expenses', nameFr: 'Fournitures de bureau', ...spread('9270') },
  { code: '9275', nameEn: 'Bank charges and service fees', nameFr: 'Frais bancaires et de service', ...spread('9275') },
  { code: '9280', nameEn: 'Postage and courier', nameFr: 'Frais postaux et messagerie', ...spread('9280') },
  { code: '9284', nameEn: 'Travel expenses', nameFr: 'Frais de deplacement', ...spread('9284') },
  { code: '9286', nameEn: 'Vehicle expenses', nameFr: 'Frais de vehicule', ...spread('9286') },
  { code: '9300', nameEn: 'Training and development', nameFr: 'Formation et perfectionnement', ...spread('9300') },
  { code: '9310', nameEn: 'Security', nameFr: 'Securite', ...spread('9310') },
  { code: '9340', nameEn: 'Cleaning and janitorial', nameFr: 'Nettoyage et entretien menager', ...spread('9340') },
  { code: '9350', nameEn: 'Research and development expenses', nameFr: 'Frais de recherche et developpement', ...spread('9350') },
  { code: '9369', nameEn: 'Other operating expenses', nameFr: 'Autres charges d\'exploitation', ...spread('9369') },

  // ---------------------------------------------------------------------------
  // INCOME TAX (9975-9999)
  // ---------------------------------------------------------------------------
  { code: '9975', nameEn: 'Current income tax expense - federal', nameFr: 'Charge d\'impot exigible - federal', ...spread('9975') },
  { code: '9976', nameEn: 'Current income tax expense - provincial', nameFr: 'Charge d\'impot exigible - provincial', ...spread('9976') },
  { code: '9980', nameEn: 'Deferred income tax expense (recovery)', nameFr: 'Charge (recouvrement) d\'impots differes', ...spread('9980') },
  { code: '9990', nameEn: 'Income tax expense', nameFr: 'Charge d\'impot sur le revenu', ...spread('9990') },
  { code: '9999', nameEn: 'Net income/loss after tax', nameFr: 'Benefice net/perte nette apres impot', ...spread('9999') },
];

/**
 * Helper used during GIFI_CODES construction to derive category and range
 * from the code. This is used with the spread operator above.
 */
function spread(code: string): { category: string; range: string } {
  const { category, range } = categoryForCode(code);
  return { category, range };
}

// =============================================================================
// RECOMMENDED CHART OF ACCOUNTS
// Internal account numbers mapped to GIFI codes with CCA classes
// Tailored for a Canadian e-commerce company (peptide-plus)
// =============================================================================

export const RECOMMENDED_CHART_OF_ACCOUNTS: ChartOfAccountTemplate[] = [
  // ===========================================================================
  // ASSETS
  // ===========================================================================
  { number: '1001', name: 'Compte bancaire operations', nameEn: 'Operating bank account', gifiCode: '1001', type: 'ASSET' },
  { number: '1002', name: 'Compte epargne', nameEn: 'Savings account', gifiCode: '1001', type: 'ASSET' },
  { number: '1010', name: 'Petite caisse', nameEn: 'Petty cash', gifiCode: '1001', type: 'ASSET' },
  { number: '1100', name: 'Comptes clients', nameEn: 'Accounts receivable', gifiCode: '1060', type: 'ASSET' },
  { number: '1110', name: 'Provision creances douteuses', nameEn: 'Allowance for doubtful accounts', gifiCode: '1061', type: 'ASSET', isContra: true },
  { number: '1200', name: 'Stocks produits finis', nameEn: 'Finished goods inventory', gifiCode: '1120', type: 'ASSET' },
  { number: '1300', name: 'Frais payes d avance', nameEn: 'Prepaid expenses', gifiCode: '1180', type: 'ASSET' },
  { number: '1400', name: 'TPS/TVH a recevoir', nameEn: 'GST/HST receivable', gifiCode: '1300', type: 'ASSET' },
  { number: '1410', name: 'TVQ a recevoir', nameEn: 'QST receivable', gifiCode: '1300', type: 'ASSET' },
  { number: '1500', name: 'Materiel informatique', nameEn: 'Computer equipment', gifiCode: '2420', type: 'ASSET', ccaClass: 50, ccaRate: 55 },
  { number: '1510', name: 'Mobilier et agencements', nameEn: 'Furniture and fixtures', gifiCode: '2430', type: 'ASSET', ccaClass: 8, ccaRate: 20 },
  { number: '1520', name: 'Vehicules', nameEn: 'Motor vehicles', gifiCode: '2450', type: 'ASSET', ccaClass: 10, ccaRate: 30 },
  { number: '1530', name: 'Ameliorations locatives', nameEn: 'Leasehold improvements', gifiCode: '2432', type: 'ASSET', ccaClass: 13 },
  { number: '1600', name: 'Amort. cumule informatique', nameEn: 'Accumulated depreciation - computer', gifiCode: '2170', type: 'ASSET', isContra: true },
  { number: '1610', name: 'Amort. cumule mobilier', nameEn: 'Accumulated depreciation - furniture', gifiCode: '2170', type: 'ASSET', isContra: true },
  { number: '1700', name: 'Developpement site web', nameEn: 'Website development', gifiCode: '2178', type: 'ASSET', ccaClass: 12, ccaRate: 100 },
  { number: '1720', name: 'Achalandage', nameEn: 'Goodwill', gifiCode: '2178', type: 'ASSET', ccaClass: 14.1, ccaRate: 5 },

  // ===========================================================================
  // LIABILITIES
  // ===========================================================================
  { number: '2000', name: 'Comptes fournisseurs', nameEn: 'Accounts payable', gifiCode: '2620', type: 'LIABILITY' },
  { number: '2010', name: 'Charges a payer', nameEn: 'Accrued liabilities', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2020', name: 'TPS/TVH a payer', nameEn: 'GST/HST payable', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2030', name: 'TVQ a payer', nameEn: 'QST payable', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2040', name: 'Impot federal a payer', nameEn: 'Federal income tax payable', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2050', name: 'Impot provincial a payer', nameEn: 'Provincial income tax payable', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2060', name: 'Retenues source a payer', nameEn: 'Source deductions payable', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2070', name: 'CNESST a payer', nameEn: 'CNESST payable', gifiCode: '2680', type: 'LIABILITY' },
  { number: '2080', name: 'Vacances a payer', nameEn: 'Vacation pay payable', gifiCode: '2680', type: 'LIABILITY' },

  // ===========================================================================
  // EQUITY
  // ===========================================================================
  { number: '3000', name: 'Actions ordinaires', nameEn: 'Common shares', gifiCode: '3500', type: 'EQUITY' },
  { number: '3100', name: 'Benefices non repartis', nameEn: 'Retained earnings', gifiCode: '3600', type: 'EQUITY' },
  { number: '3300', name: 'Dividendes declares', nameEn: 'Dividends declared', gifiCode: '3701', type: 'EQUITY' },

  // ===========================================================================
  // REVENUE
  // ===========================================================================
  { number: '4000', name: 'Ventes de produits', nameEn: 'Product sales', gifiCode: '8000', type: 'REVENUE' },
  { number: '4010', name: 'Revenus livraison', nameEn: 'Shipping revenue', gifiCode: '8089', type: 'REVENUE' },

  // ===========================================================================
  // COST OF SALES
  // ===========================================================================
  { number: '5000', name: 'Achats marchandises', nameEn: 'Purchases', gifiCode: '8320', type: 'EXPENSE' },
  { number: '5010', name: 'Fret a l achat', nameEn: 'Freight in', gifiCode: '8320', type: 'EXPENSE' },
  { number: '5020', name: 'Droits de douane', nameEn: 'Customs duties', gifiCode: '8320', type: 'EXPENSE' },

  // ===========================================================================
  // OPERATING EXPENSES
  // ===========================================================================
  { number: '6000', name: 'Salaires et traitements', nameEn: 'Salaries and wages', gifiCode: '9060', type: 'EXPENSE' },
  { number: '6020', name: 'Charges sociales employeur', nameEn: 'Employer payroll taxes', gifiCode: '9100', type: 'EXPENSE' },
  { number: '6100', name: 'Loyer', nameEn: 'Rent', gifiCode: '9180', type: 'EXPENSE' },
  { number: '6110', name: 'Services publics', nameEn: 'Utilities', gifiCode: '9220', type: 'EXPENSE' },
  { number: '6120', name: 'Assurances', nameEn: 'Insurance', gifiCode: '9200', type: 'EXPENSE' },
  { number: '6200', name: 'Fournitures bureau', nameEn: 'Office supplies', gifiCode: '9270', type: 'EXPENSE' },
  { number: '6300', name: 'Publicite et marketing', nameEn: 'Advertising and marketing', gifiCode: '9120', type: 'EXPENSE' },
  { number: '6400', name: 'Honoraires comptable', nameEn: 'Accounting fees', gifiCode: '9150', type: 'EXPENSE' },
  { number: '6420', name: 'Frais bancaires', nameEn: 'Bank charges', gifiCode: '9270', type: 'EXPENSE' },
  { number: '6430', name: 'Frais Stripe/paiement', nameEn: 'Payment processing fees', gifiCode: '9270', type: 'EXPENSE' },
  { number: '6500', name: 'Voyages', nameEn: 'Travel', gifiCode: '9200', type: 'EXPENSE' },
  { number: '6510', name: 'Repas et divertissement 50%', nameEn: 'Meals and entertainment 50%', gifiCode: '9200', type: 'EXPENSE', deductiblePercent: 50 },
  { number: '6600', name: 'Amortissement', nameEn: 'Depreciation', gifiCode: '9170', type: 'EXPENSE' },

  // ===========================================================================
  // OTHER INCOME/EXPENSE
  // ===========================================================================
  { number: '7010', name: 'Interets debiteurs', nameEn: 'Interest expense', gifiCode: '8710', type: 'EXPENSE' },
  { number: '7020', name: 'Gain/perte change', nameEn: 'Foreign exchange gain/loss', gifiCode: '8230', type: 'REVENUE' },

  // ===========================================================================
  // INCOME TAX
  // ===========================================================================
  { number: '8000', name: 'Charge impot federal', nameEn: 'Federal income tax', gifiCode: '9990', type: 'EXPENSE' },
  { number: '8010', name: 'Charge impot provincial', nameEn: 'Provincial income tax', gifiCode: '9990', type: 'EXPENSE' },
];

// =============================================================================
// Lookup Functions
// =============================================================================

/**
 * Look up a GIFI code by its numeric code string.
 * Returns undefined if the code is not found.
 */
export function getGifiCode(code: string): GifiCode | undefined {
  return GIFI_CODES.find((g) => g.code === code);
}

/**
 * Return all GIFI codes belonging to a given category key.
 * Category must be one of the keys in GIFI_CATEGORIES
 * (e.g., "CURRENT_ASSETS", "REVENUE", etc.).
 */
export function getGifiCodesForCategory(category: string): GifiCode[] {
  const cat = GIFI_CATEGORIES[category as GifiCategoryKey];
  if (!cat) return [];
  return GIFI_CODES.filter((g) => g.category === category);
}

// =============================================================================
// Smart GIFI Code Suggestion Engine
// =============================================================================

/** Keyword-to-GIFI mapping for the suggestion engine */
interface KeywordMapping {
  keywords: string[];
  gifiCode: string;
  accountTypes?: string[];
}

const KEYWORD_MAPPINGS: KeywordMapping[] = [
  // Cash and bank
  { keywords: ['cash', 'bank', 'encaisse', 'bancaire', 'caisse', 'petty'], gifiCode: '1001', accountTypes: ['ASSET'] },
  { keywords: ['investment', 'placement', 'short-term', 'court terme'], gifiCode: '1002', accountTypes: ['ASSET'] },
  { keywords: ['long-term investment', 'placement long terme'], gifiCode: '1600', accountTypes: ['ASSET'] },

  // Receivables
  { keywords: ['receivable', 'clients', 'debiteur', 'a recevoir'], gifiCode: '1060', accountTypes: ['ASSET'] },
  { keywords: ['doubtful', 'allowance', 'provision', 'creances douteuses', 'bad debt reserve'], gifiCode: '1061', accountTypes: ['ASSET'] },
  { keywords: ['gst', 'hst', 'tps', 'tvh'], gifiCode: '1300', accountTypes: ['ASSET'] },
  { keywords: ['qst', 'tvq'], gifiCode: '1300', accountTypes: ['ASSET'] },

  // Inventory
  { keywords: ['inventory', 'stock', 'inventaire', 'merchandise', 'marchandise', 'goods'], gifiCode: '1120', accountTypes: ['ASSET'] },
  { keywords: ['raw material', 'matiere premiere'], gifiCode: '1121', accountTypes: ['ASSET'] },
  { keywords: ['work in progress', 'en cours'], gifiCode: '1122', accountTypes: ['ASSET'] },
  { keywords: ['finished goods', 'produits finis'], gifiCode: '1123', accountTypes: ['ASSET'] },

  // Prepaid
  { keywords: ['prepaid', 'paye d avance', 'payes d avance', 'prepayes'], gifiCode: '1180', accountTypes: ['ASSET'] },

  // Fixed assets
  { keywords: ['land', 'terrain'], gifiCode: '2400', accountTypes: ['ASSET'] },
  { keywords: ['building', 'batiment', 'immeuble'], gifiCode: '2410', accountTypes: ['ASSET'] },
  { keywords: ['machinery', 'equipment', 'machinerie', 'equipement', 'computer', 'informatique', 'serveur'], gifiCode: '2420', accountTypes: ['ASSET'] },
  { keywords: ['furniture', 'fixture', 'mobilier', 'agencement', 'meuble'], gifiCode: '2430', accountTypes: ['ASSET'] },
  { keywords: ['leasehold', 'amelioration locative', 'locatif'], gifiCode: '2432', accountTypes: ['ASSET'] },
  { keywords: ['vehicle', 'vehicule', 'auto', 'automobile', 'car', 'truck', 'camion'], gifiCode: '2450', accountTypes: ['ASSET'] },
  { keywords: ['depreciation', 'amortissement cumule', 'accumulated depreciation', 'amort cumule'], gifiCode: '2170', accountTypes: ['ASSET'] },

  // Intangibles
  { keywords: ['goodwill', 'achalandage'], gifiCode: '2010', accountTypes: ['ASSET'] },
  { keywords: ['software', 'logiciel', 'website', 'site web', 'intangible', 'incorporel', 'patent', 'brevet', 'trademark', 'marque'], gifiCode: '2178', accountTypes: ['ASSET'] },

  // Payables
  { keywords: ['payable', 'fournisseur', 'accounts payable', 'comptes fournisseurs', 'trade payable'], gifiCode: '2620', accountTypes: ['LIABILITY'] },
  { keywords: ['accrued', 'charges a payer', 'a payer', 'retenue', 'source deduction', 'cnesst', 'vacation', 'vacances'], gifiCode: '2680', accountTypes: ['LIABILITY'] },
  { keywords: ['deferred revenue', 'produits reportes', 'unearned', 'deposit', 'depot client'], gifiCode: '2800', accountTypes: ['LIABILITY'] },
  { keywords: ['current portion', 'portion courante'], gifiCode: '2700', accountTypes: ['LIABILITY'] },

  // Long-term liabilities
  { keywords: ['long-term debt', 'dette long terme', 'mortgage', 'hypotheque', 'loan', 'emprunt'], gifiCode: '3140', accountTypes: ['LIABILITY'] },
  { keywords: ['shareholder loan', 'pret actionnaire', 'director loan', 'pret administrateur'], gifiCode: '3150', accountTypes: ['LIABILITY'] },
  { keywords: ['lease obligation', 'obligation locative'], gifiCode: '3160', accountTypes: ['LIABILITY'] },
  { keywords: ['deferred tax', 'impot differe'], gifiCode: '3200', accountTypes: ['LIABILITY'] },

  // Equity
  { keywords: ['share', 'action', 'capital', 'common', 'ordinaire', 'preferred', 'privilegiee'], gifiCode: '3500', accountTypes: ['EQUITY'] },
  { keywords: ['retained', 'benefices non repartis', 'earnings', 'resultat'], gifiCode: '3600', accountTypes: ['EQUITY'] },
  { keywords: ['dividend', 'dividende'], gifiCode: '3701', accountTypes: ['EQUITY'] },
  { keywords: ['contributed surplus', 'surplus d apport'], gifiCode: '3520', accountTypes: ['EQUITY'] },

  // Revenue
  { keywords: ['sale', 'vente', 'revenue', 'revenu', 'product sale', 'vente produit'], gifiCode: '8000', accountTypes: ['REVENUE'] },
  { keywords: ['service revenue', 'vente service', 'consulting revenue'], gifiCode: '8040', accountTypes: ['REVENUE'] },
  { keywords: ['rental income', 'revenu location'], gifiCode: '8020', accountTypes: ['REVENUE'] },
  { keywords: ['commission income', 'revenu commission'], gifiCode: '8030', accountTypes: ['REVENUE'] },
  { keywords: ['interest income', 'revenu interet', 'investment income', 'revenu placement'], gifiCode: '8060', accountTypes: ['REVENUE'] },
  { keywords: ['other revenue', 'autres revenus', 'miscellaneous income', 'revenu divers'], gifiCode: '8089', accountTypes: ['REVENUE'] },

  // Cost of sales
  { keywords: ['purchase', 'achat', 'cost of goods', 'cout marchandise', 'cogs', 'freight in', 'fret achat', 'customs', 'douane'], gifiCode: '8320', accountTypes: ['EXPENSE'] },
  { keywords: ['direct labour', 'main oeuvre directe', 'direct labor'], gifiCode: '8340', accountTypes: ['EXPENSE'] },
  { keywords: ['manufacturing', 'fabrication'], gifiCode: '8350', accountTypes: ['EXPENSE'] },
  { keywords: ['subcontract', 'sous-traitance', 'sous traitance'], gifiCode: '8400', accountTypes: ['EXPENSE'] },

  // Operating expenses
  { keywords: ['salary', 'wage', 'salaire', 'traitement', 'payroll', 'remuneration'], gifiCode: '9060', accountTypes: ['EXPENSE'] },
  { keywords: ['benefit', 'avantage social', 'cpp', 'qpp', 'rrq', 'rpc', 'ei', 'ae', 'employer contribution'], gifiCode: '9100', accountTypes: ['EXPENSE'] },
  { keywords: ['advertising', 'marketing', 'publicite', 'promotion', 'ad spend'], gifiCode: '9120', accountTypes: ['EXPENSE'] },
  { keywords: ['professional fee', 'honoraire', 'accounting', 'legal', 'comptable', 'juridique', 'avocat', 'notaire'], gifiCode: '9150', accountTypes: ['EXPENSE'] },
  { keywords: ['depreciation expense', 'amortissement', 'depreciation charge'], gifiCode: '9170', accountTypes: ['EXPENSE'] },
  { keywords: ['rent', 'loyer', 'lease payment', 'paiement bail'], gifiCode: '9180', accountTypes: ['EXPENSE'] },
  { keywords: ['insurance', 'assurance'], gifiCode: '9200', accountTypes: ['EXPENSE'] },
  { keywords: ['utility', 'utilities', 'service public', 'hydro', 'electricity', 'electricite', 'gas', 'water', 'eau'], gifiCode: '9220', accountTypes: ['EXPENSE'] },
  { keywords: ['telephone', 'telecom', 'internet', 'cell', 'mobile'], gifiCode: '9224', accountTypes: ['EXPENSE'] },
  { keywords: ['office', 'bureau', 'stationery', 'papeterie', 'supply', 'fourniture'], gifiCode: '9270', accountTypes: ['EXPENSE'] },
  { keywords: ['bank charge', 'frais bancaire', 'service fee', 'stripe', 'payment processing', 'frais paiement'], gifiCode: '9275', accountTypes: ['EXPENSE'] },
  { keywords: ['travel', 'voyage', 'deplacement', 'trip'], gifiCode: '9284', accountTypes: ['EXPENSE'] },
  { keywords: ['meal', 'entertainment', 'repas', 'divertissement', 'restaurant'], gifiCode: '8764', accountTypes: ['EXPENSE'] },
  { keywords: ['bad debt', 'mauvaise creance', 'write-off', 'radiation'], gifiCode: '8590', accountTypes: ['EXPENSE'] },
  { keywords: ['delivery', 'shipping', 'livraison', 'expedition', 'warehouse', 'entreposage'], gifiCode: '8610', accountTypes: ['EXPENSE'] },
  { keywords: ['repair', 'maintenance', 'reparation', 'entretien'], gifiCode: '8960', accountTypes: ['EXPENSE'] },
  { keywords: ['training', 'formation', 'development', 'perfectionnement'], gifiCode: '9300', accountTypes: ['EXPENSE'] },
  { keywords: ['consulting', 'consultation'], gifiCode: '9240', accountTypes: ['EXPENSE'] },
  { keywords: ['computer expense', 'it expense', 'informatique', 'hosting', 'hebergement', 'saas', 'cloud'], gifiCode: '9230', accountTypes: ['EXPENSE'] },
  { keywords: ['research', 'recherche', 'r&d', 'development cost'], gifiCode: '9350', accountTypes: ['EXPENSE'] },

  // Interest and FX
  { keywords: ['interest expense', 'interet debiteur', 'interest charge', 'finance cost', 'frais financier'], gifiCode: '8710' },
  { keywords: ['foreign exchange', 'change', 'fx', 'currency', 'devise'], gifiCode: '8230' },

  // Income tax
  { keywords: ['income tax', 'impot revenu', 'tax expense', 'charge impot', 'impot federal', 'impot provincial'], gifiCode: '9990', accountTypes: ['EXPENSE'] },
];

/**
 * Suggests the best GIFI code based on an account name and optional account type.
 * Uses keyword matching with scoring to find the most relevant GIFI code.
 *
 * @param accountName - The name of the account (in English or French)
 * @param accountType - Optional account type to narrow results ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
 * @returns The best matching GifiCode, or undefined if no match found
 */
export function suggestGifiCode(accountName: string, accountType?: string): GifiCode | undefined {
  const normalizedName = accountName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let bestMatch: { mapping: KeywordMapping; score: number } | null = null;

  for (const mapping of KEYWORD_MAPPINGS) {
    // If accountType is provided, filter by it
    if (accountType && mapping.accountTypes && !mapping.accountTypes.includes(accountType)) {
      continue;
    }

    let score = 0;
    for (const keyword of mapping.keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedName.includes(normalizedKeyword)) {
        // Longer keyword matches are more specific and score higher
        score += normalizedKeyword.length;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { mapping, score };
    }
  }

  if (bestMatch) {
    return getGifiCode(bestMatch.mapping.gifiCode);
  }

  return undefined;
}

// =============================================================================
// IMP-A028: GIFI Auto-Validation
// Validates that a GIFI code is valid, exists in the CRA reference, and is
// consistent with the expected account type.
// =============================================================================

export interface GifiValidationResult {
  valid: boolean;
  code: string;
  gifiEntry?: GifiCode;
  errors: string[];
  warnings: string[];
  suggestedCode?: string;
}

/**
 * Validates a GIFI code for correctness and consistency with an account type.
 *
 * Checks performed:
 * 1. Format: must be a 4-digit numeric string
 * 2. Existence: must be in the GIFI_CODES reference list
 * 3. Type consistency: GIFI range must match the account type (e.g., ASSET accounts
 *    should use codes 1000-2599, not 8000+)
 * 4. Suggestion: if invalid, suggests a better code based on account name
 *
 * @param gifiCode - The GIFI code to validate
 * @param accountType - The account type ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
 * @param accountName - Optional account name for suggestion if code is invalid
 */
export function validateGifiCode(
  gifiCode: string,
  accountType?: string,
  accountName?: string,
): GifiValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Format check: must be a 4-digit numeric string
  if (!/^\d{4}$/.test(gifiCode)) {
    errors.push(`Le code GIFI "${gifiCode}" doit etre un nombre de 4 chiffres (ex: 1001)`);
    return {
      valid: false,
      code: gifiCode,
      errors,
      warnings,
      suggestedCode: accountName ? suggestGifiCode(accountName, accountType)?.code : undefined,
    };
  }

  // 2. Existence check: must be in the reference list
  const gifiEntry = getGifiCode(gifiCode);
  if (!gifiEntry) {
    warnings.push(`Le code GIFI "${gifiCode}" n'est pas dans la liste de reference CRA. Verifiez qu'il est valide.`);
  }

  // 3. Type consistency check: GIFI range must match account type
  if (accountType) {
    const num = parseInt(gifiCode, 10);
    const typeRanges: Record<string, { min: number; max: number; label: string }[]> = {
      ASSET: [{ min: 1000, max: 2599, label: 'Actifs (1000-2599)' }],
      LIABILITY: [{ min: 2600, max: 3449, label: 'Passifs (2600-3449)' }],
      EQUITY: [{ min: 3450, max: 3849, label: 'Capitaux propres (3450-3849)' }],
      REVENUE: [{ min: 7000, max: 8089, label: 'Revenus (7000-8089)' }],
      EXPENSE: [
        { min: 8090, max: 8518, label: 'Cout des ventes (8090-8518)' },
        { min: 8519, max: 9974, label: 'Charges d\'exploitation (8519-9974)' },
        { min: 9975, max: 9999, label: 'Impots (9975-9999)' },
      ],
    };

    const allowedRanges = typeRanges[accountType];
    if (allowedRanges) {
      const inRange = allowedRanges.some(r => num >= r.min && num <= r.max);
      if (!inRange) {
        const expectedLabels = allowedRanges.map(r => r.label).join(' ou ');
        errors.push(
          `Le code GIFI ${gifiCode} n'est pas dans la plage attendue pour un compte de type ${accountType}. ` +
          `Plages attendues: ${expectedLabels}`
        );
      }
    }
  }

  // 4. If errors, suggest a better code based on account name
  let suggestedCode: string | undefined;
  if (errors.length > 0 && accountName) {
    const suggestion = suggestGifiCode(accountName, accountType);
    if (suggestion && suggestion.code !== gifiCode) {
      suggestedCode = suggestion.code;
    }
  }

  return {
    valid: errors.length === 0,
    code: gifiCode,
    gifiEntry: gifiEntry || undefined,
    errors,
    warnings,
    suggestedCode,
  };
}

/**
 * Batch-validates an array of chart-of-account to GIFI code mappings.
 * Returns a summary of all validation issues found.
 *
 * @param mappings - Array of { gifiCode, accountType?, accountName? } objects
 */
export function validateGifiMappings(
  mappings: Array<{ gifiCode: string; accountType?: string; accountName?: string }>
): {
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  results: GifiValidationResult[];
} {
  const results = mappings.map(m => validateGifiCode(m.gifiCode, m.accountType, m.accountName));
  return {
    totalChecked: results.length,
    validCount: results.filter(r => r.valid).length,
    invalidCount: results.filter(r => !r.valid).length,
    warningCount: results.filter(r => r.warnings.length > 0).length,
    results,
  };
}

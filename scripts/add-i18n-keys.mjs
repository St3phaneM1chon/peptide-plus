#!/usr/bin/env node
/**
 * Add new i18n keys for the comptabilite/immobilisations, calendrier-fiscal,
 * and parametres pages to all 22 locale files.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LOCALES_DIR = join(import.meta.dirname, '..', 'src', 'i18n', 'locales');
const ALL_LOCALES = [
  'en', 'fr', 'ar', 'ar-dz', 'ar-lb', 'ar-ma',
  'de', 'es', 'gcr', 'hi', 'ht', 'it',
  'ko', 'pa', 'pl', 'pt', 'ru', 'sv',
  'ta', 'tl', 'vi', 'zh',
];

// ---------------------------------------------------------------------------
// New keys: French values
// ---------------------------------------------------------------------------
const FR_KEYS = {
  // ========== admin.accounting.assets (immobilisations page) ==========
  'admin.accounting.assets.title': 'Immobilisations',
  'admin.accounting.assets.subtitle': 'Gestion des actifs immobilises et amortissement DPA',
  'admin.accounting.assets.newAsset': 'Nouvelle immobilisation',
  'admin.accounting.assets.totalAssets': 'Total actifs',
  'admin.accounting.assets.acquisitionCost': "Cout d'acquisition",
  'admin.accounting.assets.netBookValue': 'Valeur comptable nette',
  'admin.accounting.assets.totalDepreciation': 'Amortissement cumule',
  'admin.accounting.assets.searchPlaceholder': 'Rechercher un actif...',
  'admin.accounting.assets.refresh': 'Actualiser',
  'admin.accounting.assets.allStatuses': 'Tous les statuts',
  'admin.accounting.assets.allCcaClasses': 'Toutes les classes',
  'admin.accounting.assets.classLabel': 'Classe',
  'admin.accounting.assets.colName': 'Nom',
  'admin.accounting.assets.colCcaClass': 'Classe DPA',
  'admin.accounting.assets.colCost': 'Cout',
  'admin.accounting.assets.colBookValue': 'Valeur comptable',
  'admin.accounting.assets.colAccumDepr': 'Amort. cumule',
  'admin.accounting.assets.colStatus': 'Statut',
  'admin.accounting.assets.noAssetsFound': 'Aucune immobilisation trouvee',
  'admin.accounting.assets.calculateCca': 'Calculer DPA',
  'admin.accounting.assets.dispose': 'Disposer',
  'admin.accounting.assets.depreciationHistory': "Historique d'amortissement",
  'admin.accounting.assets.noDepreciation': 'Aucun amortissement enregistre',
  'admin.accounting.assets.year': 'Annee',
  'admin.accounting.assets.opening': 'ouverture',
  'admin.accounting.assets.closing': 'fermeture',
  'admin.accounting.assets.details': 'Details',
  'admin.accounting.assets.method': 'Methode',
  'admin.accounting.assets.halfYearRule': 'Regle de 50% (demi-annee)',
  'admin.accounting.assets.halfYearRuleDesc': "Applique 50% du taux la premiere annee d'acquisition",
  'admin.accounting.assets.superDeduction': 'Super deduction',
  'admin.accounting.assets.assetAccount': "Compte d'actif",
  'admin.accounting.assets.deprAccount': 'Compte amort.',
  'admin.accounting.assets.expenseAccount': 'Compte charge',
  'admin.accounting.assets.disposal': 'Disposition',
  'admin.accounting.assets.proceeds': 'Produit',
  'admin.accounting.assets.gainLoss': 'Gain/Perte',
  'admin.accounting.assets.editAsset': "Modifier l'immobilisation",
  'admin.accounting.assets.newAssetTitle': 'Nouvelle immobilisation',
  'admin.accounting.assets.cancel': 'Annuler',
  'admin.accounting.assets.update': 'Mettre a jour',
  'admin.accounting.assets.create': 'Creer',
  'admin.accounting.assets.optionalDescription': 'Description optionnelle',
  'admin.accounting.assets.serialNumber': 'No Serie',
  'admin.accounting.assets.location': 'Emplacement',
  'admin.accounting.assets.acquisitionDate': "Date d'acquisition",
  'admin.accounting.assets.acquisitionCostField': "Cout d'acquisition ($)",
  'admin.accounting.assets.residualValue': 'Valeur residuelle ($)',
  'admin.accounting.assets.ccaClassField': 'Classe DPA',
  'admin.accounting.assets.selectClass': '-- Choisir une classe --',
  'admin.accounting.assets.ccaRate': 'Taux DPA (%)',
  'admin.accounting.assets.methodDeclining': 'Solde degressif',
  'admin.accounting.assets.methodStraight': 'Lineaire',
  'admin.accounting.assets.methodLease': 'Duree du bail',
  'admin.accounting.assets.aiiLabel': "Incitatif a l'investissement accelere (IIA)",
  'admin.accounting.assets.aiiDesc': '1.5x le taux normal la premiere annee (remplace la regle de 50%)',
  'admin.accounting.assets.superDeductionLabel': 'Super deduction (100%)',
  'admin.accounting.assets.superDeductionDesc': 'Passation immediate en charges completes (Budget 2025)',
  'admin.accounting.assets.gifiCode': 'Code GIFI',
  'admin.accounting.assets.accumDeprAccount': "Compte d'amortissement cumule",
  'admin.accounting.assets.deprExpenseAccount': 'Compte de charge (amortissement)',
  'admin.accounting.assets.select': '-- Choisir --',
  'admin.accounting.assets.optionalNotes': 'Notes optionnelles',
  'admin.accounting.assets.disposeAsset': "Disposer de l'immobilisation",
  'admin.accounting.assets.confirmDisposal': 'Confirmer la disposition',
  'admin.accounting.assets.warning': 'Attention',
  'admin.accounting.assets.disposeWarning': 'Vous allez disposer de "{name}" (valeur comptable: {value}). Cette action est irreversible.',
  'admin.accounting.assets.disposalDate': 'Date de disposition',
  'admin.accounting.assets.disposalProceeds': 'Produit de disposition ($)',
  'admin.accounting.assets.estimatedGainLoss': 'Gain/Perte estime',
  'admin.accounting.assets.calculateCcaTitle': 'Calculer la DPA',
  'admin.accounting.assets.calculate': 'Calculer',
  'admin.accounting.assets.fiscalYear': 'Annee fiscale',
  'admin.accounting.assets.periodStart': 'Debut de periode',
  'admin.accounting.assets.periodEnd': 'Fin de periode',
  'admin.accounting.assets.yes': 'Oui',
  'admin.accounting.assets.no': 'Non',

  // ========== admin.accounting.fiscal (calendrier-fiscal page - new keys) ==========
  'admin.accounting.fiscal.catPayroll': 'Paie',
  'admin.accounting.fiscal.catCorporateTax': 'Impot corporatif',
  'admin.accounting.fiscal.catSalesTax': 'Taxes de vente',
  'admin.accounting.fiscal.catInformationReturn': 'Declaration',
  'admin.accounting.fiscal.catInstallment': 'Acompte provisionnel',
  'admin.accounting.fiscal.catOther': 'Autre',
  'admin.accounting.fiscal.authRQ': 'Revenu Quebec',
  'admin.accounting.fiscal.freqOnce': 'Une fois',
  'admin.accounting.fiscal.freqMonthly': 'Mensuel',
  'admin.accounting.fiscal.freqQuarterly': 'Trimestriel',
  'admin.accounting.fiscal.freqAnnual': 'Annuel',
  'admin.accounting.fiscal.descriptionEn': 'Description (EN)',
  'admin.accounting.fiscal.descriptionFr': 'Description (FR)',

  // ========== admin.accountingSettings (parametres page - new retention rows) ==========
  'admin.accountingSettings.retGeneralRecords': 'Registres comptables generaux',
  'admin.accountingSettings.retT2Returns': 'Declarations T2',
  'admin.accountingSettings.retGstQstRecords': 'Registres TPS/TVQ',
  'admin.accountingSettings.retPayrollRecords': 'Registres de paie',
  'admin.accountingSettings.retT4Rl1': 'Copies T4/RL-1',
  'admin.accountingSettings.retRoe': 'RE',
  'admin.accountingSettings.retArticlesIncorp': 'Acte constitutif',
  'admin.accountingSettings.retBoardMinutes': 'PV assemblees',
  'admin.accountingSettings.retShareRegister': 'Registre actions',
  'admin.accountingSettings.retCorporateLaw': 'Droit corporatif',
};

// ---------------------------------------------------------------------------
// New keys: English values
// ---------------------------------------------------------------------------
const EN_KEYS = {
  // ========== admin.accounting.assets ==========
  'admin.accounting.assets.title': 'Fixed Assets',
  'admin.accounting.assets.subtitle': 'Fixed asset management and CCA depreciation',
  'admin.accounting.assets.newAsset': 'New Asset',
  'admin.accounting.assets.totalAssets': 'Total Assets',
  'admin.accounting.assets.acquisitionCost': 'Acquisition Cost',
  'admin.accounting.assets.netBookValue': 'Net Book Value',
  'admin.accounting.assets.totalDepreciation': 'Total Depreciation',
  'admin.accounting.assets.searchPlaceholder': 'Search assets...',
  'admin.accounting.assets.refresh': 'Refresh',
  'admin.accounting.assets.allStatuses': 'All Statuses',
  'admin.accounting.assets.allCcaClasses': 'All CCA Classes',
  'admin.accounting.assets.classLabel': 'Class',
  'admin.accounting.assets.colName': 'Name',
  'admin.accounting.assets.colCcaClass': 'CCA Class',
  'admin.accounting.assets.colCost': 'Cost',
  'admin.accounting.assets.colBookValue': 'Book Value',
  'admin.accounting.assets.colAccumDepr': 'Accum. Depr.',
  'admin.accounting.assets.colStatus': 'Status',
  'admin.accounting.assets.noAssetsFound': 'No fixed assets found',
  'admin.accounting.assets.calculateCca': 'Calculate CCA',
  'admin.accounting.assets.dispose': 'Dispose',
  'admin.accounting.assets.depreciationHistory': 'Depreciation History',
  'admin.accounting.assets.noDepreciation': 'No depreciation recorded',
  'admin.accounting.assets.year': 'Year',
  'admin.accounting.assets.opening': 'opening',
  'admin.accounting.assets.closing': 'closing',
  'admin.accounting.assets.details': 'Details',
  'admin.accounting.assets.method': 'Method',
  'admin.accounting.assets.halfYearRule': 'Half-Year Rule',
  'admin.accounting.assets.halfYearRuleDesc': 'Applies 50% of the rate in the first year of acquisition',
  'admin.accounting.assets.superDeduction': 'Super Deduction',
  'admin.accounting.assets.assetAccount': 'Asset Account',
  'admin.accounting.assets.deprAccount': 'Depr. Account',
  'admin.accounting.assets.expenseAccount': 'Expense Account',
  'admin.accounting.assets.disposal': 'Disposal',
  'admin.accounting.assets.proceeds': 'Proceeds',
  'admin.accounting.assets.gainLoss': 'Gain/Loss',
  'admin.accounting.assets.editAsset': 'Edit Fixed Asset',
  'admin.accounting.assets.newAssetTitle': 'New Fixed Asset',
  'admin.accounting.assets.cancel': 'Cancel',
  'admin.accounting.assets.update': 'Update',
  'admin.accounting.assets.create': 'Create',
  'admin.accounting.assets.optionalDescription': 'Optional description',
  'admin.accounting.assets.serialNumber': 'Serial Number',
  'admin.accounting.assets.location': 'Location',
  'admin.accounting.assets.acquisitionDate': 'Acquisition Date',
  'admin.accounting.assets.acquisitionCostField': 'Acquisition Cost ($)',
  'admin.accounting.assets.residualValue': 'Residual Value ($)',
  'admin.accounting.assets.ccaClassField': 'CCA Class',
  'admin.accounting.assets.selectClass': '-- Select a class --',
  'admin.accounting.assets.ccaRate': 'CCA Rate (%)',
  'admin.accounting.assets.methodDeclining': 'Declining Balance',
  'admin.accounting.assets.methodStraight': 'Straight Line',
  'admin.accounting.assets.methodLease': 'Lease Term',
  'admin.accounting.assets.aiiLabel': 'Accelerated Investment Incentive (AII)',
  'admin.accounting.assets.aiiDesc': '1.5x the normal rate in the first year (replaces half-year rule)',
  'admin.accounting.assets.superDeductionLabel': 'Super Deduction (100%)',
  'admin.accounting.assets.superDeductionDesc': '100% immediate expensing (Budget 2025)',
  'admin.accounting.assets.gifiCode': 'GIFI Code',
  'admin.accounting.assets.accumDeprAccount': 'Accumulated Depreciation Account',
  'admin.accounting.assets.deprExpenseAccount': 'Depreciation Expense Account',
  'admin.accounting.assets.select': '-- Select --',
  'admin.accounting.assets.optionalNotes': 'Optional notes',
  'admin.accounting.assets.disposeAsset': 'Dispose Fixed Asset',
  'admin.accounting.assets.confirmDisposal': 'Confirm Disposal',
  'admin.accounting.assets.warning': 'Warning',
  'admin.accounting.assets.disposeWarning': 'You are about to dispose of "{name}" (book value: {value}). This action is irreversible.',
  'admin.accounting.assets.disposalDate': 'Disposal Date',
  'admin.accounting.assets.disposalProceeds': 'Disposal Proceeds ($)',
  'admin.accounting.assets.estimatedGainLoss': 'Estimated Gain/Loss',
  'admin.accounting.assets.calculateCcaTitle': 'Calculate CCA',
  'admin.accounting.assets.calculate': 'Calculate',
  'admin.accounting.assets.fiscalYear': 'Fiscal Year',
  'admin.accounting.assets.periodStart': 'Period Start',
  'admin.accounting.assets.periodEnd': 'Period End',
  'admin.accounting.assets.yes': 'Yes',
  'admin.accounting.assets.no': 'No',

  // ========== admin.accounting.fiscal ==========
  'admin.accounting.fiscal.catPayroll': 'Payroll',
  'admin.accounting.fiscal.catCorporateTax': 'Corporate Tax',
  'admin.accounting.fiscal.catSalesTax': 'Sales Tax',
  'admin.accounting.fiscal.catInformationReturn': 'Information Return',
  'admin.accounting.fiscal.catInstallment': 'Installment',
  'admin.accounting.fiscal.catOther': 'Other',
  'admin.accounting.fiscal.authRQ': 'Revenu Quebec',
  'admin.accounting.fiscal.freqOnce': 'Once',
  'admin.accounting.fiscal.freqMonthly': 'Monthly',
  'admin.accounting.fiscal.freqQuarterly': 'Quarterly',
  'admin.accounting.fiscal.freqAnnual': 'Annual',
  'admin.accounting.fiscal.descriptionEn': 'Description (EN)',
  'admin.accounting.fiscal.descriptionFr': 'Description (FR)',

  // ========== admin.accountingSettings ==========
  'admin.accountingSettings.retGeneralRecords': 'General accounting records',
  'admin.accountingSettings.retT2Returns': 'T2 corporate returns',
  'admin.accountingSettings.retGstQstRecords': 'GST/QST records',
  'admin.accountingSettings.retPayrollRecords': 'Payroll records',
  'admin.accountingSettings.retT4Rl1': 'T4/RL-1 copies',
  'admin.accountingSettings.retRoe': 'ROE',
  'admin.accountingSettings.retArticlesIncorp': 'Articles of incorporation',
  'admin.accountingSettings.retBoardMinutes': 'Board minutes',
  'admin.accountingSettings.retShareRegister': 'Share register',
  'admin.accountingSettings.retCorporateLaw': 'Corporate law',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set a deeply nested key using dot notation.
 * e.g., setNestedKey(obj, 'admin.accounting.assets.title', 'Fixed Assets')
 */
function setNestedKey(obj, dottedKey, value) {
  const parts = dottedKey.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object' || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  // Only set if not already present (don't overwrite existing translations)
  if (!(lastKey in current)) {
    current[lastKey] = value;
  }
}

/**
 * Check if a deeply nested key exists
 */
function hasNestedKey(obj, dottedKey) {
  const parts = dottedKey.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return false;
    if (!(part in current)) return false;
    current = current[part];
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let totalAdded = 0;
let totalSkipped = 0;

for (const locale of ALL_LOCALES) {
  const filePath = join(LOCALES_DIR, `${locale}.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`  ERROR reading ${locale}.json: ${err.message}`);
    continue;
  }

  const keysToAdd = locale === 'fr' ? FR_KEYS : EN_KEYS;
  let added = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(keysToAdd)) {
    if (hasNestedKey(data, key)) {
      skipped++;
    } else {
      setNestedKey(data, key, value);
      added++;
    }
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  ${locale}.json: +${added} keys added, ${skipped} skipped (already exist)`);
  totalAdded += added;
  totalSkipped += skipped;
}

console.log(`\nDone! Total: ${totalAdded} keys added across ${ALL_LOCALES.length} locales. ${totalSkipped} skipped.`);
console.log(`New key count per locale: ${Object.keys(FR_KEYS).length}`);

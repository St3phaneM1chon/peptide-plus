/**
 * Seed Accounting Data
 * Chart of Accounts (NCECF Quebec structure), Accounting Settings, Periods 2026
 */

import { PrismaClient, AccountType } from '@prisma/client';

const prisma = new PrismaClient();

interface AccountSeed {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  description?: string;
  isSystem?: boolean;
  parentCode?: string;
}

const CHART_OF_ACCOUNTS: AccountSeed[] = [
  // =============================================
  // ASSETS (1000-1999)
  // =============================================
  // Cash & Bank
  { code: '1000', name: 'Encaisse et équivalents', type: 'ASSET', normalBalance: 'DEBIT', description: 'Comptes de trésorerie' },
  { code: '1010', name: 'Compte bancaire principal (CAD)', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true, parentCode: '1000' },
  { code: '1020', name: 'Compte bancaire USD', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000' },
  { code: '1030', name: 'Compte PayPal', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true, parentCode: '1000' },
  { code: '1040', name: 'Compte Stripe', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true, parentCode: '1000' },
  { code: '1050', name: 'Petite caisse', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1000' },

  // Accounts Receivable
  { code: '1100', name: 'Comptes clients', type: 'ASSET', normalBalance: 'DEBIT', description: 'Comptes à recevoir' },
  { code: '1110', name: 'Comptes clients Canada', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100' },
  { code: '1120', name: 'Comptes clients USA', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100' },
  { code: '1130', name: 'Comptes clients internationaux', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1100' },
  { code: '1190', name: 'Provision pour créances douteuses', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '1100' },

  // Inventory
  { code: '1200', name: 'Stocks', type: 'ASSET', normalBalance: 'DEBIT', description: 'Inventaire de marchandises' },
  { code: '1210', name: 'Stock de marchandises', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true, parentCode: '1200' },
  { code: '1220', name: 'Stock en transit', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1200' },
  { code: '1230', name: 'Provision pour désuétude', type: 'ASSET', normalBalance: 'CREDIT', parentCode: '1200' },

  // Prepaid & Other Current Assets
  { code: '1300', name: 'Charges payées d\'avance', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '1310', name: 'TPS à recevoir (CTI)', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true },
  { code: '1320', name: 'TVQ à recevoir (RTI)', type: 'ASSET', normalBalance: 'DEBIT', isSystem: true },

  // Fixed Assets
  { code: '1500', name: 'Immobilisations', type: 'ASSET', normalBalance: 'DEBIT', description: 'Actifs à long terme' },
  { code: '1510', name: 'Équipement informatique', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1520', name: 'Mobilier et agencement', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1530', name: 'Équipement de laboratoire', type: 'ASSET', normalBalance: 'DEBIT', parentCode: '1500' },
  { code: '1590', name: 'Amortissement cumulé', type: 'ASSET', normalBalance: 'CREDIT', isSystem: true, parentCode: '1500' },

  // =============================================
  // LIABILITIES (2000-2999)
  // =============================================
  // Accounts Payable
  { code: '2000', name: 'Comptes fournisseurs', type: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '2010', name: 'Charges à payer', type: 'LIABILITY', normalBalance: 'CREDIT' },

  // Tax Payables
  { code: '2100', name: 'Taxes à payer', type: 'LIABILITY', normalBalance: 'CREDIT', description: 'Taxes de vente perçues' },
  { code: '2110', name: 'TPS à payer', type: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true, parentCode: '2100' },
  { code: '2120', name: 'TVQ à payer', type: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true, parentCode: '2100' },
  { code: '2130', name: 'TVH à payer', type: 'LIABILITY', normalBalance: 'CREDIT', isSystem: true, parentCode: '2100' },
  { code: '2140', name: 'Taxes internationales à payer', type: 'LIABILITY', normalBalance: 'CREDIT', parentCode: '2100' },

  // Other Liabilities
  { code: '2200', name: 'Salaires et charges sociales à payer', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2300', name: 'Revenus reportés', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2400', name: 'Emprunts à court terme', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '2500', name: 'Emprunts à long terme', type: 'LIABILITY', normalBalance: 'CREDIT' },

  // =============================================
  // EQUITY (3000-3999)
  // =============================================
  { code: '3000', name: 'Capital-actions', type: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '3100', name: 'Bénéfices non répartis', type: 'EQUITY', normalBalance: 'CREDIT', isSystem: true },
  { code: '3200', name: 'Apports du propriétaire', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '3300', name: 'Retraits du propriétaire', type: 'EQUITY', normalBalance: 'DEBIT' },

  // =============================================
  // REVENUE (4000-4999)
  // =============================================
  { code: '4000', name: 'Ventes', type: 'REVENUE', normalBalance: 'CREDIT', description: 'Revenus de ventes' },
  { code: '4010', name: 'Ventes Canada', type: 'REVENUE', normalBalance: 'CREDIT', isSystem: true, parentCode: '4000' },
  { code: '4020', name: 'Ventes USA', type: 'REVENUE', normalBalance: 'CREDIT', isSystem: true, parentCode: '4000' },
  { code: '4030', name: 'Ventes Europe', type: 'REVENUE', normalBalance: 'CREDIT', isSystem: true, parentCode: '4000' },
  { code: '4040', name: 'Ventes autres pays', type: 'REVENUE', normalBalance: 'CREDIT', isSystem: true, parentCode: '4000' },
  { code: '4100', name: 'Frais de livraison facturés', type: 'REVENUE', normalBalance: 'CREDIT', isSystem: true },
  { code: '4200', name: 'Revenus d\'abonnement', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '4900', name: 'Remises et retours', type: 'REVENUE', normalBalance: 'DEBIT', isSystem: true, description: 'Contre-revenu' },

  // =============================================
  // COGS (5000-5999)
  // =============================================
  { code: '5000', name: 'Coût des marchandises vendues', type: 'EXPENSE', normalBalance: 'DEBIT', description: 'CMV' },
  { code: '5010', name: 'Achats de marchandises', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true, parentCode: '5000' },
  { code: '5100', name: 'Droits de douane et import', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5000' },
  { code: '5200', name: 'Frais de livraison entrants', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '5000' },
  { code: '5900', name: 'Ajustement de stock', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true, parentCode: '5000' },

  // =============================================
  // OPERATING EXPENSES (6000-6999)
  // =============================================
  // Shipping
  { code: '6000', name: 'Frais d\'expédition', type: 'EXPENSE', normalBalance: 'DEBIT', description: 'Livraisons sortantes' },
  { code: '6010', name: 'Frais Postes Canada', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6020', name: 'Frais UPS/FedEx', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },
  { code: '6030', name: 'Frais expédition internationale', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6000' },

  // Payment Processing Fees
  { code: '6100', name: 'Frais de traitement des paiements', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6110', name: 'Frais Stripe', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true, parentCode: '6100' },
  { code: '6120', name: 'Frais PayPal', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true, parentCode: '6100' },
  { code: '6130', name: 'Frais bancaires', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6100' },

  // Marketing
  { code: '6200', name: 'Marketing et publicité', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6210', name: 'Marketing Google Ads', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },
  { code: '6220', name: 'Marketing Facebook/Meta', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },
  { code: '6230', name: 'Marketing influenceurs', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },
  { code: '6240', name: 'Promotions et remises', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6200' },

  // Technology
  { code: '6300', name: 'Technologie et hébergement', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6310', name: 'Hébergement Azure/Cloud', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6300' },
  { code: '6320', name: 'Domaines et SSL', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6300' },
  { code: '6330', name: 'Services SaaS (logiciels)', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6300' },

  // Office & Admin
  { code: '6400', name: 'Frais de bureau', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6410', name: 'Loyer', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6400' },
  { code: '6420', name: 'Fournitures de bureau', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6400' },
  { code: '6430', name: 'Télécommunications', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6400' },
  { code: '6440', name: 'Assurances', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6400' },

  // Personnel
  { code: '6500', name: 'Salaires et avantages', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6510', name: 'Salaires', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6500' },
  { code: '6520', name: 'Charges sociales (RRQ, AE, RQAP)', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6500' },
  { code: '6530', name: 'Avantages sociaux', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6500' },
  { code: '6540', name: 'Formation', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6500' },

  // R&D
  { code: '6600', name: 'Recherche et développement', type: 'EXPENSE', normalBalance: 'DEBIT' },

  // Professional Services
  { code: '6700', name: 'Services professionnels', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '6710', name: 'Honoraires comptables', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6700' },
  { code: '6720', name: 'Honoraires juridiques', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6700' },
  { code: '6730', name: 'Honoraires consultants', type: 'EXPENSE', normalBalance: 'DEBIT', parentCode: '6700' },

  // Depreciation
  { code: '6800', name: 'Amortissement', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true },

  // Inventory Losses
  { code: '6900', name: 'Pertes sur stocks', type: 'EXPENSE', normalBalance: 'DEBIT', isSystem: true, description: 'Pertes inventaire (colis perdus, produits endommages)' },

  // =============================================
  // OTHER INCOME/EXPENSE (7000-7999)
  // =============================================
  { code: '7000', name: 'Gains/pertes de change', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '7100', name: 'Revenus d\'intérêts', type: 'REVENUE', normalBalance: 'CREDIT' },
  { code: '7200', name: 'Charges d\'intérêts', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '7300', name: 'Gains/pertes extraordinaires', type: 'EXPENSE', normalBalance: 'DEBIT' },
];

export async function seedAccounting() {
  console.log('📊 Seed comptabilité...');

  // 1. Chart of Accounts
  console.log('  📋 Plan comptable (~80 comptes)...');

  // First pass: create all accounts without parents
  for (const acct of CHART_OF_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { code: acct.code },
      update: {
        name: acct.name,
        type: acct.type,
        normalBalance: acct.normalBalance,
        description: acct.description || null,
        isSystem: acct.isSystem || false,
      },
      create: {
        code: acct.code,
        name: acct.name,
        type: acct.type,
        normalBalance: acct.normalBalance,
        description: acct.description || null,
        isSystem: acct.isSystem || false,
      },
    });
  }

  // Second pass: set parent relationships
  for (const acct of CHART_OF_ACCOUNTS) {
    if (acct.parentCode) {
      const parent = await prisma.chartOfAccount.findUnique({
        where: { code: acct.parentCode },
        select: { id: true },
      });
      if (parent) {
        await prisma.chartOfAccount.update({
          where: { code: acct.code },
          data: { parentId: parent.id },
        });
      }
    }
  }

  const accountCount = await prisma.chartOfAccount.count();
  console.log(`  ✅ ${accountCount} comptes créés`);

  // 2. Accounting Settings
  console.log('  ⚙️ Paramètres comptables...');
  await prisma.accountingSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: 'BioCycle Peptides Inc.',
      companyAddress: '1234 Rue Sainte-Catherine',
      companyCity: 'Montréal',
      companyProvince: 'QC',
      companyPostalCode: 'H2L 2K1',
      companyPhone: '+1 (514) 555-0123',
      companyEmail: 'comptabilite@biocyclepeptides.ca',
      tpsNumber: '123456789RT0001',
      tvqNumber: '1234567890TQ0001',
      neq: '1234567890',
      fiscalYearStart: 1,
      accountingMethod: 'ACCRUAL',
      defaultCurrency: 'CAD',
      taxFilingFrequency: 'QUARTERLY',
      autoCreateSaleEntries: true,
      autoReconcileStripe: true,
    },
  });
  console.log('  ✅ Paramètres comptables créés');

  // 3. Accounting Periods for 2026
  console.log('  📅 Périodes comptables 2026...');
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  for (let i = 0; i < 12; i++) {
    const month = i + 1;
    const code = `2026-${String(month).padStart(2, '0')}`;
    const startDate = new Date(2026, i, 1);
    const endDate = new Date(2026, i + 1, 0); // Last day of month

    await prisma.accountingPeriod.upsert({
      where: { code },
      update: {},
      create: {
        name: `${months[i]} 2026`,
        code,
        startDate,
        endDate,
        status: month <= new Date().getMonth() + 1 ? 'OPEN' : 'OPEN',
      },
    });
  }
  console.log('  ✅ 12 périodes 2026 créées');

  // 4. Bank accounts
  console.log('  🏦 Comptes bancaires...');

  const stripeAccount = await prisma.chartOfAccount.findUnique({ where: { code: '1040' } });
  const paypalAccount = await prisma.chartOfAccount.findUnique({ where: { code: '1030' } });
  const bankMainAccount = await prisma.chartOfAccount.findUnique({ where: { code: '1010' } });

  if (stripeAccount) {
    await prisma.bankAccount.upsert({
      where: { id: 'stripe-main' },
      update: {},
      create: {
        id: 'stripe-main',
        name: 'Compte Stripe',
        institution: 'Stripe',
        type: 'STRIPE',
        currency: 'CAD',
        chartAccountId: stripeAccount.id,
        isActive: true,
      },
    });
  }

  if (paypalAccount) {
    await prisma.bankAccount.upsert({
      where: { id: 'paypal-main' },
      update: {},
      create: {
        id: 'paypal-main',
        name: 'Compte PayPal',
        institution: 'PayPal',
        type: 'PAYPAL',
        currency: 'CAD',
        chartAccountId: paypalAccount.id,
        isActive: true,
      },
    });
  }

  if (bankMainAccount) {
    await prisma.bankAccount.upsert({
      where: { id: 'desjardins-main' },
      update: {},
      create: {
        id: 'desjardins-main',
        name: 'Compte principal Desjardins',
        accountNumber: '****4567',
        institution: 'Desjardins',
        type: 'CHECKING',
        currency: 'CAD',
        chartAccountId: bankMainAccount.id,
        isActive: true,
        isDefault: true,
      },
    });
  }
  console.log('  ✅ 3 comptes bancaires créés');

  console.log('✅ Seed comptabilité terminé!');
}

// Allow standalone execution
if (require.main === module) {
  seedAccounting()
    .catch((e) => {
      console.error('❌ Erreur seed comptabilité:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

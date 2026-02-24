/**
 * Seed data only - production data comes from the database with full translations.
 *
 * BUG-088 NOTE: All descriptions in this file are in English because this is static
 * seed/fallback data used during development and initial database seeding.
 * In production, product content is fetched from PostgreSQL via Prisma and translated
 * dynamically using the Translation models (ProductTranslation) with withTranslation().
 * No translation keys are needed here.
 *
 * Utilisees par la page d'accueil (fallback) et le seeding initial.
 * Structure alignee avec le schema Prisma.
 */

// Types de format disponibles
export type FormatType = 
  | 'vial_2ml' 
  | 'vial_10ml' 
  | 'cartridge_3ml' 
  | 'cartridge_kit_12' 
  | 'capsules_30' 
  | 'capsules_60' 
  | 'capsules_120' 
  | 'pack_2'
  | 'pack_5' 
  | 'pack_10' 
  | 'box_50'
  | 'box_100'
  | 'powder_500g'
  | 'powder_1kg'
  | 'gummies_60'
  | 'gummies_120'
  | 'accessory'
  | 'kit';

// Types de produit
export type ProductType = 'PEPTIDE' | 'SUPPLEMENT' | 'ACCESSORY' | 'BUNDLE';

// Statut de stock
export type StockStatus = 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED' | 'COMING_SOON' | 'PRE_ORDER';

// Interface Format
export interface ProductFormat {
  id: string;
  name: string;
  nameKey: string;        // Clé de traduction (formats.xxx)
  type: FormatType;
  dosageMg?: number;
  volumeMl?: number;
  unitCount?: number;
  price: number;
  comparePrice?: number;  // Prix barré (rabais)
  sku: string;
  inStock: boolean;
  stockQuantity: number;
  availability: StockStatus;
  image?: string;
  isDefault?: boolean;
}

// Interface Produit
export interface Product {
  id: string;
  name: string;
  nameKey: string;        // Clé de traduction (products.xxx)
  subtitle?: string;
  slug: string;
  shortDescription: string;
  description: string;
  specifications: string;
  productType: ProductType;
  price: number;          // Prix de base (minimum)
  comparePrice?: number;  // Prix barré global
  purity?: number;
  avgMass?: string;
  molecularWeight?: number;
  casNumber?: string;
  molecularFormula?: string;
  storageConditions?: string;
  categoryId: string;
  categoryName: string;
  categoryKey: string;    // Clé de traduction (categories.xxx)
  categorySlug: string;
  isNew?: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
  formats: ProductFormat[];
  images?: {
    id: string;
    url: string;
    alt: string;
    isPrimary?: boolean;
  }[];
  relatedProductIds?: string[];
}

// Interface Produit lié (simplifié)
export interface RelatedProduct {
  id: string;
  name: string;
  nameKey: string;
  slug: string;
  price: number;
  purity?: number;
  imageUrl?: string;
}

// =====================================================
// CATÉGORIES
// =====================================================

export const categories = [
  { id: 'cat-peptides', name: 'Peptides', nameKey: 'peptides', slug: 'peptides' },
  { id: 'cat-weight-loss', name: 'Weight Loss', nameKey: 'weightLoss', slug: 'weight-loss' },
  { id: 'cat-recovery', name: 'Recovery', nameKey: 'recovery', slug: 'recovery' },
  { id: 'cat-muscle-growth', name: 'Muscle Growth', nameKey: 'muscleGrowth', slug: 'muscle-growth' },
  { id: 'cat-supplements', name: 'Supplements', nameKey: 'supplements', slug: 'supplements' },
  { id: 'cat-accessories', name: 'Accessories', nameKey: 'accessories', slug: 'accessories' },
];

// =====================================================
// TOUS LES FORMATS DISPONIBLES (MASTER LIST)
// =====================================================

export const allFormats: { type: FormatType; nameKey: string; defaultName: string }[] = [
  { type: 'vial_2ml', nameKey: 'vial2ml', defaultName: '2ml Vial' },
  { type: 'vial_10ml', nameKey: 'vial10ml', defaultName: '10ml Vial' },
  { type: 'cartridge_3ml', nameKey: 'cartridge3ml', defaultName: '3ml Cartridge' },
  { type: 'cartridge_kit_12', nameKey: 'kit12', defaultName: 'Kit of 12 Cartridges' },
  { type: 'pack_2', nameKey: 'pack2', defaultName: 'Pack of 2' },
  { type: 'pack_5', nameKey: 'pack5', defaultName: 'Pack of 5' },
  { type: 'pack_10', nameKey: 'pack10', defaultName: 'Pack of 10' },
  { type: 'box_50', nameKey: 'box50', defaultName: 'Box of 50' },
  { type: 'box_100', nameKey: 'box100', defaultName: 'Box of 100' },
  { type: 'capsules_30', nameKey: 'capsules30', defaultName: '30 Capsules' },
  { type: 'capsules_60', nameKey: 'capsules60', defaultName: '60 Capsules' },
  { type: 'capsules_120', nameKey: 'capsules120', defaultName: '120 Capsules' },
  { type: 'powder_500g', nameKey: 'powder500g', defaultName: '500g Powder' },
  { type: 'powder_1kg', nameKey: 'powder1kg', defaultName: '1kg Powder' },
  { type: 'gummies_60', nameKey: 'gummies60', defaultName: '60 Gummies' },
  { type: 'gummies_120', nameKey: 'gummies120', defaultName: '120 Gummies' },
  { type: 'accessory', nameKey: 'single', defaultName: 'Single Unit' },
  { type: 'kit', nameKey: 'kit', defaultName: 'Kit' },
];

// =====================================================
// PRODUITS
// =====================================================

export const products: Product[] = [
  // ==================== PEPTIDES ====================
  {
    id: 'prod-tesamorelin',
    name: 'Tesamorelin',
    nameKey: 'tesamorelin',
    subtitle: 'GHRH Analog',
    slug: 'tesamorelin',
    shortDescription: 'Growth hormone releasing hormone analog for metabolic and body composition research.',
    description: `Tesamorelin is a synthetic analog of growth hormone releasing hormone (GHRH). It is extensively studied for its effects on growth hormone secretion and body composition.

Research applications:
- Growth hormone stimulation
- Body composition studies
- Metabolic research
- Lipodystrophy studies

All batches are third-party tested with certificates of analysis available upon request.`,
    specifications: `Purity: ≥99.60% (HPLC)
Form: White lyophilized powder
Solubility: Soluble in sterile water
Storage: 2-8°C (refrigerated)
Stability: 24 months at -20°C`,
    productType: 'PEPTIDE',
    price: 65,
    purity: 99.60,
    avgMass: '23.84 mg',
    molecularWeight: 5135.9,
    casNumber: '218949-48-5',
    molecularFormula: 'C221H366N72O67S1',
    storageConditions: '2-8°C',
    categoryId: 'cat-peptides',
    categoryName: 'Peptides',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isBestseller: true,
    isFeatured: true,
    formats: [
      { id: 'f-tesa-1', name: '5mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 5, price: 65, sku: 'PP-TESA-5MG', inStock: true, stockQuantity: 150, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-tesa-2', name: '10mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 10, price: 110, sku: 'PP-TESA-10MG', inStock: true, stockQuantity: 100, availability: 'IN_STOCK' },
      { id: 'f-tesa-3', name: '10mg Cartridge 3ml', nameKey: 'cartridge3ml', type: 'cartridge_3ml', dosageMg: 10, volumeMl: 3, price: 145, sku: 'PP-TESA-CART', inStock: true, stockQuantity: 50, availability: 'IN_STOCK' },
      { id: 'f-tesa-4', name: '10mg x 12 Kit', nameKey: 'kit12', type: 'cartridge_kit_12', dosageMg: 120, unitCount: 12, price: 1200, comparePrice: 1450, sku: 'PP-TESA-KIT12', inStock: true, stockQuantity: 20, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-semaglutide', 'prod-tirzepatide'],
  },
  {
    id: 'prod-semaglutide',
    name: 'Semaglutide',
    nameKey: 'semaglutide',
    subtitle: 'GLP-1 Receptor Agonist',
    slug: 'semaglutide',
    shortDescription: 'High-purity GLP-1 agonist peptide for metabolic research. Third-party tested at 99.64% purity.',
    description: `Semaglutide is a glucagon-like peptide-1 (GLP-1) analog at the forefront of modern metabolic research.

Research applications:
- Glucose metabolism studies
- Appetite regulation research
- Pancreatic function studies
- Hormonal signaling research

Each batch undergoes rigorous third-party testing to ensure the highest quality for research purposes.`,
    specifications: `Purity: ≥99.64% (HPLC)
Form: White lyophilized powder
Storage: -20°C (freezer)
Stability: 24 months at -20°C
Reconstitution: Bacteriostatic water`,
    productType: 'PEPTIDE',
    price: 50,
    purity: 99.64,
    avgMass: '10.85 mg',
    molecularWeight: 4113.58,
    storageConditions: '-20°C',
    categoryId: 'cat-weight-loss',
    categoryName: 'Weight Loss',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isBestseller: true,
    isFeatured: true,
    formats: [
      { id: 'f-sema-1', name: '5mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 5, price: 50, sku: 'PP-SEMA-5MG', inStock: true, stockQuantity: 200, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-sema-2', name: '10mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 10, price: 90, sku: 'PP-SEMA-10MG', inStock: true, stockQuantity: 150, availability: 'IN_STOCK' },
      { id: 'f-sema-3', name: '10mg Cartridge 3ml', nameKey: 'cartridge3ml', type: 'cartridge_3ml', dosageMg: 10, volumeMl: 3, price: 125, sku: 'PP-SEMA-CART', inStock: true, stockQuantity: 70, availability: 'IN_STOCK' },
      { id: 'f-sema-4', name: '10mg x 12 Kit', nameKey: 'kit12', type: 'cartridge_kit_12', dosageMg: 120, unitCount: 12, price: 1100, comparePrice: 1320, sku: 'PP-SEMA-KIT12', inStock: true, stockQuantity: 15, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-tirzepatide', 'prod-retatrutide'],
  },
  {
    id: 'prod-tirzepatide',
    name: 'Tirzepatide',
    nameKey: 'tirzepatide',
    subtitle: 'Dual GIP/GLP-1 Agonist',
    slug: 'tirzepatide',
    shortDescription: 'Innovative dual agonist peptide for advanced metabolic research. 99.74% HPLC verified purity.',
    description: `Tirzepatide is an innovative peptide acting as a dual agonist of GIP and GLP-1 receptors, representing a significant advancement in metabolic research.

Research applications:
- Dual receptor activation studies
- Advanced metabolic research
- Glucose homeostasis
- Body composition studies`,
    specifications: `Purity: ≥99.74% (HPLC)
Form: White lyophilized powder
Storage: -20°C`,
    productType: 'PEPTIDE',
    price: 60,
    purity: 99.74,
    avgMass: '10.12 mg',
    molecularWeight: 4813.45,
    storageConditions: '-20°C',
    categoryId: 'cat-weight-loss',
    categoryName: 'Weight Loss',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isNew: true,
    isFeatured: true,
    formats: [
      { id: 'f-tirz-1', name: '5mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 5, price: 60, sku: 'PP-TIRZ-5MG', inStock: true, stockQuantity: 150, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-tirz-2', name: '10mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 10, price: 108, sku: 'PP-TIRZ-10MG', inStock: true, stockQuantity: 100, availability: 'IN_STOCK' },
      { id: 'f-tirz-3', name: '10mg Cartridge 3ml', nameKey: 'cartridge3ml', type: 'cartridge_3ml', dosageMg: 10, volumeMl: 3, price: 150, sku: 'PP-TIRZ-CART', inStock: true, stockQuantity: 70, availability: 'IN_STOCK' },
      { id: 'f-tirz-4', name: '10mg x 12 Kit', nameKey: 'kit12', type: 'cartridge_kit_12', dosageMg: 120, unitCount: 12, price: 1300, comparePrice: 1560, sku: 'PP-TIRZ-KIT12', inStock: true, stockQuantity: 10, availability: 'LIMITED' },
    ],
    relatedProductIds: ['prod-semaglutide', 'prod-retatrutide'],
  },
  {
    id: 'prod-retatrutide',
    name: 'Retatrutide',
    nameKey: 'retatrutide',
    subtitle: 'Triple Agonist (GIP/GLP-1/Glucagon)',
    slug: 'retatrutide',
    shortDescription: 'Next-generation triple agonist peptide. The most advanced compound for metabolic research.',
    description: `Retatrutide is a revolutionary triple agonist targeting GIP, GLP-1, and glucagon receptors simultaneously. This represents the cutting edge of metabolic research compounds.

Research applications:
- Triple receptor activation
- Advanced metabolic studies
- Energy expenditure research
- Next-generation compound studies`,
    specifications: `Purity: ≥99.30% (HPLC)
Form: White lyophilized powder
Storage: -20°C`,
    productType: 'PEPTIDE',
    price: 90,
    purity: 99.30,
    avgMass: '10.46 mg',
    storageConditions: '-20°C',
    categoryId: 'cat-weight-loss',
    categoryName: 'Weight Loss',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isNew: true,
    formats: [
      { id: 'f-reta-1', name: '5mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 5, price: 90, sku: 'PP-RETA-5MG', inStock: true, stockQuantity: 100, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-reta-2', name: '10mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 10, price: 165, sku: 'PP-RETA-10MG', inStock: true, stockQuantity: 60, availability: 'IN_STOCK' },
      { id: 'f-reta-3', name: '10mg Cartridge 3ml', nameKey: 'cartridge3ml', type: 'cartridge_3ml', dosageMg: 10, volumeMl: 3, price: 195, sku: 'PP-RETA-CART', inStock: true, stockQuantity: 40, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-semaglutide', 'prod-tirzepatide'],
  },
  {
    id: 'prod-bpc157',
    name: 'BPC-157',
    nameKey: 'bpc157',
    subtitle: 'Body Protection Compound-157',
    slug: 'bpc-157',
    shortDescription: 'High-purity pentadecapeptide for tissue recovery research. Lab tested with 99.83% purity.',
    description: `BPC-157 is a pentadecapeptide composed of 15 amino acids. It is a partial sequence of the body protection compound (BPC) discovered in human gastric juice.

Research applications:
- Tendon and ligament regeneration
- Accelerated wound healing
- Gastric protection
- Anti-inflammatory effects

All batches are third-party tested with certificates of analysis available upon request.`,
    specifications: `Sequence: Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val
Purity: ≥99.83% (HPLC)
Form: White lyophilized powder
Solubility: Soluble in sterile water
Storage: 2-8°C (refrigerated)
Stability: 24 months at -20°C`,
    productType: 'PEPTIDE',
    price: 40,
    purity: 99.83,
    avgMass: '5.21 mg',
    molecularWeight: 1419.53,
    casNumber: '137525-51-0',
    molecularFormula: 'C62H98N16O22',
    storageConditions: '2-8°C',
    categoryId: 'cat-recovery',
    categoryName: 'Recovery',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isBestseller: true,
    isFeatured: true,
    formats: [
      { id: 'f-bpc-1', name: '5mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 5, price: 40, sku: 'PP-BPC-5MG', inStock: true, stockQuantity: 200, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-bpc-2', name: '10mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 10, price: 70, sku: 'PP-BPC-10MG', inStock: true, stockQuantity: 150, availability: 'IN_STOCK' },
      { id: 'f-bpc-3', name: '10mg Cartridge 3ml', nameKey: 'cartridge3ml', type: 'cartridge_3ml', dosageMg: 10, volumeMl: 3, price: 95, sku: 'PP-BPC-CART', inStock: true, stockQuantity: 80, availability: 'IN_STOCK' },
      { id: 'f-bpc-4', name: '5mg x 10 Pack', nameKey: 'pack10', type: 'pack_10', dosageMg: 50, unitCount: 10, price: 320, comparePrice: 400, sku: 'PP-BPC-5MG-10PK', inStock: true, stockQuantity: 30, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-tb500', 'prod-bpc157-tb500'],
  },
  {
    id: 'prod-tb500',
    name: 'TB-500',
    nameKey: 'tb500',
    subtitle: 'Thymosin Beta-4',
    slug: 'tb-500',
    shortDescription: '43-amino acid peptide for tissue repair research. Premium quality, 99.43% pure.',
    description: `TB-500 (Thymosin Beta-4) is a peptide naturally present in the human body, known for its crucial role in cellular regeneration and healing.

Research areas:
- Muscle repair
- Angiogenesis
- Inflammation reduction
- Cell migration`,
    specifications: `Sequence: 43 amino acids
Purity: ≥99.43% (HPLC)
Form: Lyophilized powder
Storage: 2-8°C`,
    productType: 'PEPTIDE',
    price: 40,
    purity: 99.43,
    avgMass: '5.08 mg',
    molecularWeight: 4963.44,
    casNumber: '77591-33-4',
    storageConditions: '2-8°C',
    categoryId: 'cat-recovery',
    categoryName: 'Recovery',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isBestseller: true,
    formats: [
      { id: 'f-tb-1', name: '5mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 5, price: 40, sku: 'PP-TB500-5MG', inStock: true, stockQuantity: 180, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-tb-2', name: '10mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 10, price: 75, sku: 'PP-TB500-10MG', inStock: true, stockQuantity: 100, availability: 'IN_STOCK' },
      { id: 'f-tb-3', name: '5mg x 10 Pack', nameKey: 'pack10', type: 'pack_10', dosageMg: 50, unitCount: 10, price: 320, comparePrice: 400, sku: 'PP-TB500-5MG-10PK', inStock: true, stockQuantity: 25, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-bpc157', 'prod-bpc157-tb500'],
  },
  {
    id: 'prod-bpc157-tb500',
    name: 'BPC-157 / TB-500 Healing Blend',
    nameKey: 'bpc157Tb500Blend',
    subtitle: 'Synergistic Recovery Blend',
    slug: 'bpc-157-tb-500-blend',
    shortDescription: 'Synergistic combination for optimal recovery research. Pre-mixed 1:1 ratio.',
    description: `This blend combines BPC-157 and TB-500 in an optimal ratio (1:1) to maximize regenerative effects in research.

Benefits of the blend:
- Synergy of both peptides
- Simplified reconstitution
- Optimized dosing`,
    specifications: `Composition: BPC-157 + TB-500 (1:1 ratio)
Purity: ≥99.40% (HPLC)
Form: White lyophilized powder
Storage: 2-8°C`,
    productType: 'PEPTIDE',
    price: 70,
    purity: 99.40,
    avgMass: '7.13 mg',
    storageConditions: '2-8°C',
    categoryId: 'cat-recovery',
    categoryName: 'Recovery',
    categoryKey: 'peptides',
    categorySlug: 'peptides',
    isBestseller: true,
    formats: [
      { id: 'f-blend-1', name: '6mg/6mg Vial', nameKey: 'vial2ml', type: 'vial_2ml', dosageMg: 12, price: 70, sku: 'PP-BLEND-12MG', inStock: true, stockQuantity: 120, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-blend-2', name: '12mg Cartridge 3ml', nameKey: 'cartridge3ml', type: 'cartridge_3ml', dosageMg: 12, volumeMl: 3, price: 95, sku: 'PP-BLEND-CART', inStock: true, stockQuantity: 60, availability: 'IN_STOCK' },
      { id: 'f-blend-3', name: '12mg x 10 Pack', nameKey: 'pack10', type: 'pack_10', dosageMg: 120, unitCount: 10, price: 560, comparePrice: 700, sku: 'PP-BLEND-10PK', inStock: true, stockQuantity: 20, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-bpc157', 'prod-tb500'],
  },
  
  // ==================== SUPPLEMENTS ====================
  {
    id: 'prod-creatine-powder',
    name: 'Creatine Monohydrate Powder',
    nameKey: 'creatinePowder',
    subtitle: 'Pure Micronized Creatine',
    slug: 'creatine-powder',
    shortDescription: 'Premium quality micronized creatine monohydrate. 100% pure, unflavored.',
    description: `Pure micronized creatine monohydrate for enhanced absorption and mixing. Third-party tested for purity.

Benefits:
- Increased strength and power
- Enhanced muscle recovery
- Improved athletic performance
- 100% pure, no fillers`,
    specifications: `Form: Micronized powder
Purity: 99.9%
Serving size: 5g
Flavor: Unflavored`,
    productType: 'SUPPLEMENT',
    price: 35,
    categoryId: 'cat-supplements',
    categoryName: 'Supplements',
    categoryKey: 'supplements',
    categorySlug: 'supplements',
    isFeatured: true,
    formats: [
      { id: 'f-creat-1', name: '500g Powder', nameKey: 'powder500g', type: 'powder_500g', price: 35, sku: 'PP-CREAT-500G', inStock: true, stockQuantity: 100, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-creat-2', name: '1kg Powder', nameKey: 'powder1kg', type: 'powder_1kg', price: 55, comparePrice: 70, sku: 'PP-CREAT-1KG', inStock: true, stockQuantity: 80, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-creatine-gummies', 'prod-nad-plus'],
  },
  {
    id: 'prod-creatine-gummies',
    name: 'Creatine Gummies',
    nameKey: 'creatineGummies',
    subtitle: 'Delicious Creatine Delivery',
    slug: 'creatine-gummies',
    shortDescription: 'Great-tasting creatine gummies for convenient supplementation. No mixing required.',
    description: `Convenient and delicious way to get your daily creatine. Perfect for those who don't like powder mixing.

Benefits:
- Easy to take anywhere
- Great taste
- Precise dosing
- No mixing required`,
    specifications: `Creatine per serving: 3g (6 gummies)
Flavor: Mixed Berry
Sugar: 2g per serving`,
    productType: 'SUPPLEMENT',
    price: 29,
    categoryId: 'cat-supplements',
    categoryName: 'Supplements',
    categoryKey: 'supplements',
    categorySlug: 'supplements',
    formats: [
      { id: 'f-gum-1', name: '60 Gummies', nameKey: 'gummies60', type: 'gummies_60', unitCount: 60, price: 29, sku: 'PP-GUMMY-60', inStock: true, stockQuantity: 150, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-gum-2', name: '120 Gummies', nameKey: 'gummies120', type: 'gummies_120', unitCount: 120, price: 49, comparePrice: 58, sku: 'PP-GUMMY-120', inStock: true, stockQuantity: 100, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-creatine-powder', 'prod-nad-plus'],
  },
  {
    id: 'prod-nad-plus',
    name: 'NAD+ 500mg',
    nameKey: 'nadPlus',
    subtitle: 'Nicotinamide Adenine Dinucleotide',
    slug: 'nad-plus',
    shortDescription: 'High-potency NAD+ supplement for cellular energy and longevity support.',
    description: `Premium NAD+ supplement to support cellular energy production and healthy aging.

Benefits:
- Supports cellular energy (ATP production)
- Promotes healthy aging
- Supports cognitive function
- Third-party tested`,
    specifications: `NAD+ per capsule: 500mg
Form: Vegetable capsules
Serving: 1 capsule daily`,
    productType: 'SUPPLEMENT',
    price: 65,
    categoryId: 'cat-supplements',
    categoryName: 'Supplements',
    categoryKey: 'supplements',
    categorySlug: 'supplements',
    formats: [
      { id: 'f-nad-1', name: '30 Capsules', nameKey: 'capsules30', type: 'capsules_30', unitCount: 30, price: 65, sku: 'PP-NAD-30', inStock: true, stockQuantity: 80, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-nad-2', name: '60 Capsules', nameKey: 'capsules60', type: 'capsules_60', unitCount: 60, price: 110, comparePrice: 130, sku: 'PP-NAD-60', inStock: true, stockQuantity: 60, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-nac', 'prod-creatine-powder'],
  },
  {
    id: 'prod-nac',
    name: 'NAC 600mg',
    nameKey: 'nac',
    subtitle: 'N-Acetyl Cysteine',
    slug: 'nac',
    shortDescription: 'Powerful antioxidant precursor to glutathione. Supports liver and respiratory health.',
    description: `N-Acetyl Cysteine is a powerful antioxidant and precursor to glutathione, the body's master antioxidant.

Benefits:
- Powerful antioxidant support
- Liver detoxification
- Respiratory health
- Immune support`,
    specifications: `NAC per capsule: 600mg
Form: Vegetable capsules
Serving: 1-2 capsules daily`,
    productType: 'SUPPLEMENT',
    price: 25,
    categoryId: 'cat-supplements',
    categoryName: 'Supplements',
    categoryKey: 'supplements',
    categorySlug: 'supplements',
    formats: [
      { id: 'f-nac-1', name: '60 Capsules', nameKey: 'capsules60', type: 'capsules_60', unitCount: 60, price: 25, sku: 'PP-NAC-60', inStock: true, stockQuantity: 200, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-nac-2', name: '120 Capsules', nameKey: 'capsules120', type: 'capsules_120', unitCount: 120, price: 40, comparePrice: 50, sku: 'PP-NAC-120', inStock: true, stockQuantity: 150, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-nad-plus', 'prod-creatine-powder'],
  },
  
  // ==================== ACCESSORIES ====================
  {
    id: 'prod-injection-pen',
    name: 'Injection Pen',
    nameKey: 'injectionPen',
    subtitle: 'Precision Dosing Device',
    slug: 'injection-pen',
    shortDescription: 'High-quality injection pen for precise dosing. Compatible with 3ml cartridges.',
    description: `Professional-grade injection pen designed for precise dosing and ease of use. Compatible with all standard 3ml cartridges.

Features:
- Precise dose dial (0.1ml increments)
- Ergonomic design
- Durable construction
- Easy cartridge replacement`,
    specifications: `Compatible cartridges: 3ml
Dose increments: 0.1ml
Material: Medical-grade plastic
Includes: Pen, instructions`,
    productType: 'ACCESSORY',
    price: 45,
    categoryId: 'cat-accessories',
    categoryName: 'Accessories',
    categoryKey: 'accessories',
    categorySlug: 'accessories',
    isFeatured: true,
    formats: [
      { id: 'f-pen-1', name: 'Single Pen', nameKey: 'single', type: 'accessory', price: 45, sku: 'PP-PEN-1', inStock: true, stockQuantity: 200, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-pen-2', name: 'Pack of 2', nameKey: 'pack2', type: 'pack_2', unitCount: 2, price: 80, comparePrice: 90, sku: 'PP-PEN-2PK', inStock: true, stockQuantity: 100, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-empty-cartridges', 'prod-pen-needles'],
  },
  {
    id: 'prod-empty-cartridges',
    name: 'Empty Cartridges 3ml',
    nameKey: 'emptyCartridges',
    subtitle: 'Sterile Cartridges',
    slug: 'empty-cartridges',
    shortDescription: 'Sterile empty cartridges for peptide reconstitution. Compatible with injection pens.',
    description: `Medical-grade sterile cartridges for reconstituting and storing peptides. Compatible with standard injection pens.

Features:
- Sterile sealed
- 3ml capacity
- Clear glass for visibility
- Rubber stopper included`,
    specifications: `Volume: 3ml
Material: Borosilicate glass
Sterility: Gamma irradiated
Closure: Rubber stopper + aluminum cap`,
    productType: 'ACCESSORY',
    price: 15,
    categoryId: 'cat-accessories',
    categoryName: 'Accessories',
    categoryKey: 'accessories',
    categorySlug: 'accessories',
    formats: [
      { id: 'f-cart-1', name: 'Pack of 5', nameKey: 'pack5', type: 'pack_5', unitCount: 5, price: 15, sku: 'PP-CART-5', inStock: true, stockQuantity: 300, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-cart-2', name: 'Pack of 10', nameKey: 'pack10', type: 'pack_10', unitCount: 10, price: 25, comparePrice: 30, sku: 'PP-CART-10', inStock: true, stockQuantity: 200, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-injection-pen', 'prod-pen-needles'],
  },
  {
    id: 'prod-pen-needles',
    name: 'Pen Needles 32G',
    nameKey: 'penNeedles',
    subtitle: 'Ultra-Fine Needles',
    slug: 'pen-needles',
    shortDescription: 'Ultra-fine 32G pen needles for comfortable injections. Universal fit.',
    description: `Ultra-fine pen needles designed for minimal discomfort. Compatible with most injection pens.

Features:
- 32G ultra-fine gauge
- 4mm length (subcutaneous)
- Triple-bevel technology
- Silicone coated`,
    specifications: `Gauge: 32G
Length: 4mm
Compatibility: Universal
Sterility: EO sterilized`,
    productType: 'ACCESSORY',
    price: 12,
    categoryId: 'cat-accessories',
    categoryName: 'Accessories',
    categoryKey: 'accessories',
    categorySlug: 'accessories',
    formats: [
      { id: 'f-need-1', name: 'Box of 50', nameKey: 'box50', type: 'box_50', unitCount: 50, price: 12, sku: 'PP-NEEDLE-50', inStock: true, stockQuantity: 500, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-need-2', name: 'Box of 100', nameKey: 'box100', type: 'box_100', unitCount: 100, price: 20, comparePrice: 24, sku: 'PP-NEEDLE-100', inStock: true, stockQuantity: 300, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-injection-pen', 'prod-syringes-u100'],
  },
  {
    id: 'prod-syringes-u100',
    name: 'Syringes U100',
    nameKey: 'syringesU100',
    subtitle: 'Insulin Syringes',
    slug: 'syringes-u100',
    shortDescription: 'Precision U100 insulin syringes with attached needles. For accurate dosing.',
    description: `High-quality U100 insulin syringes with permanently attached needles for precise dosing.

Features:
- 1ml capacity
- 29G attached needle
- Clear barrel with U100 markings
- Latex-free`,
    specifications: `Volume: 1ml
Needle: 29G x 12.7mm
Markings: U100 (2 unit increments)
Sterility: EO sterilized`,
    productType: 'ACCESSORY',
    price: 10,
    categoryId: 'cat-accessories',
    categoryName: 'Accessories',
    categoryKey: 'accessories',
    categorySlug: 'accessories',
    formats: [
      { id: 'f-syr-1', name: 'Box of 50', nameKey: 'box50', type: 'box_50', unitCount: 50, price: 10, sku: 'PP-SYR-50', inStock: true, stockQuantity: 400, availability: 'IN_STOCK', isDefault: true },
      { id: 'f-syr-2', name: 'Box of 100', nameKey: 'box100', type: 'box_100', unitCount: 100, price: 18, comparePrice: 20, sku: 'PP-SYR-100', inStock: true, stockQuantity: 250, availability: 'IN_STOCK' },
    ],
    relatedProductIds: ['prod-pen-needles', 'prod-injection-pen'],
  },
];

// =====================================================
// FONCTIONS UTILITAIRES
// =====================================================

/**
 * Récupère un produit par son slug
 */
export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug);
}

/**
 * Récupère un produit par son ID
 */
export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id);
}

/**
 * Récupère les produits par catégorie
 */
export function getProductsByCategory(categorySlug: string): Product[] {
  return products.filter(p => p.categorySlug === categorySlug);
}

/**
 * Récupère les produits featured
 */
export function getFeaturedProducts(limit?: number): Product[] {
  const featured = products.filter(p => p.isFeatured);
  return limit ? featured.slice(0, limit) : featured;
}

/**
 * Récupère les best-sellers
 */
export function getBestsellers(limit?: number): Product[] {
  const bestsellers = products.filter(p => p.isBestseller);
  return limit ? bestsellers.slice(0, limit) : bestsellers;
}

/**
 * Récupère les nouveaux produits
 */
export function getNewProducts(limit?: number): Product[] {
  const newProducts = products.filter(p => p.isNew);
  return limit ? newProducts.slice(0, limit) : newProducts;
}

/**
 * Récupère les produits par type
 */
export function getProductsByType(type: ProductType, limit?: number): Product[] {
  const filtered = products.filter(p => p.productType === type);
  return limit ? filtered.slice(0, limit) : filtered;
}

/**
 * Récupère les produits liés
 */
export function getRelatedProducts(product: Product): RelatedProduct[] {
  if (!product.relatedProductIds || product.relatedProductIds.length === 0) {
    return [];
  }
  
  const related: RelatedProduct[] = [];
  for (const id of product.relatedProductIds) {
    const p = getProductById(id);
    if (p) {
      related.push({
        id: p.id,
        name: p.name,
        nameKey: p.nameKey,
        slug: p.slug,
        price: p.price,
        purity: p.purity,
        imageUrl: p.images?.[0]?.url,
      });
    }
  }
  return related;
}

/**
 * Récupère le format par défaut d'un produit
 */
export function getDefaultFormat(product: Product): ProductFormat | undefined {
  return product.formats.find(f => f.isDefault) || product.formats.find(f => f.inStock) || product.formats[0];
}

/**
 * Vérifie si un produit a des rabais
 */
export function hasDiscount(product: Product): boolean {
  return product.formats.some(f => f.comparePrice && f.comparePrice > f.price);
}

/**
 * Calcule le pourcentage de réduction
 */
export function calculateDiscountPercent(price: number, comparePrice: number): number {
  if (!comparePrice || comparePrice <= price) return 0;
  return Math.round(((comparePrice - price) / comparePrice) * 100);
}

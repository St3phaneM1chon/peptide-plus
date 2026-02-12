import { PrismaClient, ProductType, FormatType, DiscountType, StockStatus } from '@prisma/client';
import { seedAccounting } from './seed-accounting';

const prisma = new PrismaClient();

// Helper pour créer tous les formats standards pour un peptide
async function createAllFormats(productId: string, _baseName: string, baseSku: string, basePrice: number) {
  const formats = [
    // Vials individuels
    { type: FormatType.VIAL_2ML, name: '5mg Vial', dosage: 5, price: basePrice, sku: `${baseSku}-5MG`, stock: 150, default: true, sort: 1, image: '/images/formats/vial-2ml.png' },
    { type: FormatType.VIAL_2ML, name: '10mg Vial', dosage: 10, price: basePrice * 1.8, sku: `${baseSku}-10MG`, stock: 100, sort: 2, image: '/images/formats/vial-2ml.png' },
    { type: FormatType.VIAL_10ML, name: '20mg Vial (10ml)', dosage: 20, price: basePrice * 3.2, sku: `${baseSku}-20MG`, stock: 50, sort: 3, image: '/images/formats/vial-10ml.png' },
    // Cartouches
    { type: FormatType.CARTRIDGE_3ML, name: '5mg Cartridge (3ml)', dosage: 5, price: basePrice * 1.5, sku: `${baseSku}-5MG-CART`, stock: 80, sort: 4, image: '/images/formats/cartridge.png' },
    { type: FormatType.CARTRIDGE_3ML, name: '10mg Cartridge (3ml)', dosage: 10, price: basePrice * 2.5, sku: `${baseSku}-10MG-CART`, stock: 60, sort: 5, image: '/images/formats/cartridge.png' },
    // Kit de 12 cartouches
    { type: FormatType.KIT_12, name: '5mg x 12 Cartridges Kit', dosage: 60, units: 12, price: basePrice * 15, comparePrice: basePrice * 18, sku: `${baseSku}-5MG-KIT12`, stock: 20, sort: 6, image: '/images/formats/kit-12.png' },
    { type: FormatType.KIT_12, name: '10mg x 12 Cartridges Kit', dosage: 120, units: 12, price: basePrice * 25, comparePrice: basePrice * 30, sku: `${baseSku}-10MG-KIT12`, stock: 15, sort: 7, image: '/images/formats/kit-12.png' },
    // Packs de vials
    { type: FormatType.PACK_5, name: '5mg x 5 Vials Pack', dosage: 25, units: 5, price: basePrice * 4.5, comparePrice: basePrice * 5, sku: `${baseSku}-5MG-5PK`, stock: 40, sort: 8, image: '/images/formats/pack-5.png' },
    { type: FormatType.PACK_10, name: '5mg x 10 Vials Pack', dosage: 50, units: 10, price: basePrice * 8, comparePrice: basePrice * 10, sku: `${baseSku}-5MG-10PK`, stock: 25, sort: 9, image: '/images/formats/pack-10.png' },
  ];

  for (const format of formats) {
    await prisma.productFormat.create({
      data: {
        productId,
        formatType: format.type,
        name: format.name,
        dosageMg: format.dosage,
        unitCount: format.units,
        price: format.price,
        comparePrice: format.comparePrice,
        sku: format.sku,
        stockQuantity: format.stock,
        lowStockThreshold: 10,
        isDefault: format.default || false,
        sortOrder: format.sort,
        imageUrl: format.image,
        availability: StockStatus.IN_STOCK,
      },
    });
  }
}

// Helper pour créer formats avec capsules
async function createCapsuleFormats(productId: string, baseSku: string, basePrice: number) {
  const formats = [
    { type: FormatType.CAPSULE_60, name: '60 Capsules', units: 60, price: basePrice, sku: `${baseSku}-60CAP`, stock: 100, default: true, sort: 1, image: '/images/formats/capsules-60.png' },
    { type: FormatType.CAPSULE_120, name: '120 Capsules', units: 120, price: basePrice * 1.8, sku: `${baseSku}-120CAP`, stock: 50, sort: 2, image: '/images/formats/capsules-120.png' },
    { type: FormatType.PACK_5, name: '60 Capsules x 5 Pack', units: 300, price: basePrice * 4.2, comparePrice: basePrice * 5, sku: `${baseSku}-60CAP-5PK`, stock: 20, sort: 3, image: '/images/formats/pack-5.png' },
  ];

  for (const format of formats) {
    await prisma.productFormat.create({
      data: {
        productId,
        formatType: format.type,
        name: format.name,
        unitCount: format.units,
        price: format.price,
        comparePrice: format.comparePrice,
        sku: format.sku,
        stockQuantity: format.stock,
        lowStockThreshold: 10,
        isDefault: format.default || false,
        sortOrder: format.sort,
        imageUrl: format.image,
        availability: StockStatus.IN_STOCK,
      },
    });
  }
}

async function main() {
  console.log('🌱 Début du seeding Peptide Plus+...');

  // =====================================================
  // DEVISES
  // =====================================================
  console.log('💱 Création des devises...');
  
  await Promise.all([
    prisma.currency.upsert({
      where: { code: 'CAD' },
      update: {},
      create: {
        code: 'CAD',
        name: 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1.000000,
        isDefault: true,
        isActive: true,
      },
    }),
    prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: {
        code: 'USD',
        name: 'Dollar américain',
        symbol: '$',
        exchangeRate: 0.740000,
        isDefault: false,
        isActive: true,
      },
    }),
    prisma.currency.upsert({
      where: { code: 'EUR' },
      update: {},
      create: {
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        exchangeRate: 0.680000,
        isDefault: false,
        isActive: true,
      },
    }),
  ]);

  // =====================================================
  // ZONES DE LIVRAISON
  // =====================================================
  console.log('🚚 Création des zones de livraison...');

  await prisma.shippingZone.deleteMany({});
  
  await Promise.all([
    prisma.shippingZone.create({
      data: {
        name: 'Canada',
        countries: JSON.stringify(['CA']),
        baseFee: 15.00,
        perItemFee: 2.00,
        freeShippingThreshold: 200.00,
        estimatedDaysMin: 2,
        estimatedDaysMax: 5,
        isActive: true,
        sortOrder: 1,
        notes: 'Livraison gratuite pour les commandes de plus de 200$',
      },
    }),
    prisma.shippingZone.create({
      data: {
        name: 'États-Unis',
        countries: JSON.stringify(['US']),
        baseFee: 25.00,
        perItemFee: 3.00,
        freeShippingThreshold: 300.00,
        estimatedDaysMin: 5,
        estimatedDaysMax: 10,
        isActive: true,
        sortOrder: 2,
      },
    }),
    prisma.shippingZone.create({
      data: {
        name: 'Europe',
        countries: JSON.stringify(['FR', 'DE', 'GB', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT']),
        baseFee: 45.00,
        perItemFee: 5.00,
        freeShippingThreshold: 500.00,
        estimatedDaysMin: 7,
        estimatedDaysMax: 14,
        isActive: true,
        sortOrder: 3,
      },
    }),
    prisma.shippingZone.create({
      data: {
        name: 'Australie & Nouvelle-Zélande',
        countries: JSON.stringify(['AU', 'NZ']),
        baseFee: 55.00,
        perItemFee: 6.00,
        freeShippingThreshold: null,
        estimatedDaysMin: 10,
        estimatedDaysMax: 21,
        isActive: true,
        sortOrder: 4,
      },
    }),
  ]);

  // =====================================================
  // CATÉGORIES
  // =====================================================
  console.log('📁 Création des catégories...');

  const categories = {
    recovery: await prisma.category.upsert({
      where: { slug: 'recovery-repair' },
      update: {},
      create: {
        name: 'Récupération & Réparation',
        slug: 'recovery-repair',
        description: 'Peptides pour la récupération tissulaire, la guérison et la réparation musculaire.',
        imageUrl: '/images/categories/recovery.jpg',
        sortOrder: 1,
        isActive: true,
      },
    }),
    muscle: await prisma.category.upsert({
      where: { slug: 'muscle-growth' },
      update: {},
      create: {
        name: 'Croissance Musculaire',
        slug: 'muscle-growth',
        description: 'Peptides stimulant la croissance musculaire et la force.',
        imageUrl: '/images/categories/muscle.jpg',
        sortOrder: 2,
        isActive: true,
      },
    }),
    weightLoss: await prisma.category.upsert({
      where: { slug: 'weight-loss' },
      update: {},
      create: {
        name: 'Perte de Poids',
        slug: 'weight-loss',
        description: 'Peptides agonistes GLP-1 et autres pour la gestion du poids.',
        imageUrl: '/images/categories/weight-loss.jpg',
        sortOrder: 3,
        isActive: true,
      },
    }),
    antiAging: await prisma.category.upsert({
      where: { slug: 'anti-aging-longevity' },
      update: {},
      create: {
        name: 'Anti-Âge & Longévité',
        slug: 'anti-aging-longevity',
        description: 'Peptides pour la longévité, les télomères et le vieillissement cellulaire.',
        imageUrl: '/images/categories/anti-aging.jpg',
        sortOrder: 4,
        isActive: true,
      },
    }),
    cognitive: await prisma.category.upsert({
      where: { slug: 'cognitive-brain' },
      update: {},
      create: {
        name: 'Santé Cognitive',
        slug: 'cognitive-brain',
        description: 'Peptides nootropiques pour la cognition et la santé cérébrale.',
        imageUrl: '/images/categories/cognitive.jpg',
        sortOrder: 5,
        isActive: true,
      },
    }),
    sexual: await prisma.category.upsert({
      where: { slug: 'sexual-health' },
      update: {},
      create: {
        name: 'Santé Sexuelle',
        slug: 'sexual-health',
        description: 'Peptides pour la fonction sexuelle et la libido.',
        imageUrl: '/images/categories/sexual.jpg',
        sortOrder: 6,
        isActive: true,
      },
    }),
    skin: await prisma.category.upsert({
      where: { slug: 'skin-health' },
      update: {},
      create: {
        name: 'Santé de la Peau',
        slug: 'skin-health',
        description: 'Peptides pour le bronzage, la peau et les cheveux.',
        imageUrl: '/images/categories/skin.jpg',
        sortOrder: 7,
        isActive: true,
      },
    }),
    blends: await prisma.category.upsert({
      where: { slug: 'peptide-blends' },
      update: {},
      create: {
        name: 'Mélanges & Blends',
        slug: 'peptide-blends',
        description: 'Combinaisons synergiques de peptides pré-mélangés.',
        imageUrl: '/images/categories/blends.jpg',
        sortOrder: 8,
        isActive: true,
      },
    }),
    supplements: await prisma.category.upsert({
      where: { slug: 'supplements' },
      update: {},
      create: {
        name: 'Suppléments',
        slug: 'supplements',
        description: 'NAD+, Créatine, Gummies et autres suppléments.',
        imageUrl: '/images/categories/supplements.jpg',
        sortOrder: 9,
        isActive: true,
      },
    }),
    accessories: await prisma.category.upsert({
      where: { slug: 'accessories' },
      update: {},
      create: {
        name: 'Accessoires',
        slug: 'accessories',
        description: 'Stylos d\'injection, solvants, aiguilles et accessoires.',
        imageUrl: '/images/categories/accessories.jpg',
        sortOrder: 10,
        isActive: true,
      },
    }),
    bundles: await prisma.category.upsert({
      where: { slug: 'protocol-bundles' },
      update: {},
      create: {
        name: 'Protocoles & Bundles',
        slug: 'protocol-bundles',
        description: 'Protocoles mensuels complets par objectif.',
        imageUrl: '/images/categories/bundles.jpg',
        sortOrder: 11,
        isActive: true,
      },
    }),
  };

  // =====================================================
  // PRODUITS - Supprimer les anciens formats
  // =====================================================
  console.log('🗑️ Suppression des anciens formats...');
  await prisma.productFormat.deleteMany({});

  // =====================================================
  // PRODUITS - RÉCUPÉRATION & RÉPARATION
  // =====================================================
  console.log('💊 Création des produits - Récupération...');

  // BPC-157
  const bpc157 = await prisma.product.upsert({
    where: { slug: 'bpc-157' },
    update: {},
    create: {
      name: 'BPC-157',
      subtitle: 'Body Protection Compound-157',
      slug: 'bpc-157',
      shortDescription: 'Pentadecapeptide de haute pureté pour la récupération tissulaire.',
      description: `BPC-157 est un pentadecapeptide composé de 15 acides aminés. Il s'agit d'une séquence partielle de la protéine de protection corporelle (BPC) découverte dans le suc gastrique humain. Ce peptide est étudié pour ses propriétés régénératrices remarquables sur les tissus.`,
      specifications: JSON.stringify({
        sequence: 'Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val',
        purity: '≥99% (HPLC)',
        form: 'Poudre lyophilisée',
        storage: '2-8°C'
      }),
      productType: ProductType.PEPTIDE,
      price: 40.00,
      purity: 99.83,
      molecularWeight: 1419.53,
      casNumber: '137525-51-0',
      molecularFormula: 'C62H98N16O22',
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.recovery.id,
      isFeatured: true,
      isNew: false,
      isBestseller: true,
      tags: JSON.stringify(['recovery', 'healing', 'gut', 'tissue']),
    },
  });
  await createAllFormats(bpc157.id, 'BPC-157', 'PP-BPC157', 40);

  // TB-500
  const tb500 = await prisma.product.upsert({
    where: { slug: 'tb-500' },
    update: {},
    create: {
      name: 'TB-500',
      subtitle: 'Thymosin Beta-4',
      slug: 'tb-500',
      shortDescription: 'Peptide de 43 acides aminés pour la réparation tissulaire.',
      description: `TB-500 (Thymosin Beta-4) est un peptide naturellement présent dans le corps humain, connu pour son rôle dans la régénération cellulaire et la cicatrisation.`,
      productType: ProductType.PEPTIDE,
      price: 40.00,
      purity: 99.43,
      molecularWeight: 4963.44,
      casNumber: '77591-33-4',
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.recovery.id,
      isFeatured: true,
      isBestseller: true,
      tags: JSON.stringify(['recovery', 'healing', 'tissue', 'inflammation']),
    },
  });
  await createAllFormats(tb500.id, 'TB-500', 'PP-TB500', 40);

  // =====================================================
  // PRODUITS - PERTE DE POIDS
  // =====================================================
  console.log('💊 Création des produits - Perte de poids...');

  const semaglutide = await prisma.product.upsert({
    where: { slug: 'semaglutide' },
    update: {},
    create: {
      name: 'Semaglutide',
      subtitle: 'Agoniste GLP-1',
      slug: 'semaglutide',
      shortDescription: 'Peptide agoniste du récepteur GLP-1 pour la recherche métabolique.',
      description: `Semaglutide est un analogue du peptide-1 de type glucagon (GLP-1) utilisé dans la recherche sur le métabolisme et la régulation glycémique.`,
      productType: ProductType.PEPTIDE,
      price: 50.00,
      purity: 99.39,
      molecularWeight: 4113.58,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.weightLoss.id,
      isFeatured: true,
      isNew: false,
      isBestseller: true,
      tags: JSON.stringify(['weight-loss', 'glp-1', 'metabolism']),
    },
  });
  await createAllFormats(semaglutide.id, 'Semaglutide', 'PP-SEMA', 50);

  const tirzepatide = await prisma.product.upsert({
    where: { slug: 'tirzepatide' },
    update: {},
    create: {
      name: 'Tirzepatide',
      subtitle: 'Double agoniste GIP/GLP-1',
      slug: 'tirzepatide',
      shortDescription: 'Peptide double agoniste pour la recherche métabolique avancée.',
      productType: ProductType.PEPTIDE,
      price: 60.00,
      purity: 99.74,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.weightLoss.id,
      isFeatured: true,
      isNew: true,
      tags: JSON.stringify(['weight-loss', 'glp-1', 'gip', 'metabolism']),
    },
  });
  await createAllFormats(tirzepatide.id, 'Tirzepatide', 'PP-TIRZ', 60);

  const retatrutide = await prisma.product.upsert({
    where: { slug: 'retatrutide' },
    update: {},
    create: {
      name: 'Retatrutide',
      subtitle: 'Triple agoniste GIP/GLP-1/Glucagon',
      slug: 'retatrutide',
      shortDescription: 'Peptide triple agoniste de nouvelle génération.',
      productType: ProductType.PEPTIDE,
      price: 90.00,
      purity: 99.30,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.weightLoss.id,
      isFeatured: true,
      isNew: true,
      tags: JSON.stringify(['weight-loss', 'triple-agonist', 'metabolism']),
    },
  });
  await createAllFormats(retatrutide.id, 'Retatrutide', 'PP-RETA', 90);

  // =====================================================
  // PRODUITS - CROISSANCE MUSCULAIRE
  // =====================================================
  console.log('💊 Création des produits - Croissance musculaire...');

  const ipamorelin = await prisma.product.upsert({
    where: { slug: 'ipamorelin' },
    update: {},
    create: {
      name: 'Ipamorelin',
      subtitle: 'GHRP sélectif',
      slug: 'ipamorelin',
      shortDescription: 'Peptide sécrétagogue de l\'hormone de croissance.',
      productType: ProductType.PEPTIDE,
      price: 27.00,
      purity: 99.50,
      molecularWeight: 711.85,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.muscle.id,
      isFeatured: true,
      tags: JSON.stringify(['growth', 'muscle', 'ghrp']),
    },
  });
  await createAllFormats(ipamorelin.id, 'Ipamorelin', 'PP-IPAM', 27);

  const cjc1295 = await prisma.product.upsert({
    where: { slug: 'cjc-1295-dac' },
    update: {},
    create: {
      name: 'CJC-1295 DAC',
      subtitle: 'Modified GRF(1-29) with Drug Affinity Complex',
      slug: 'cjc-1295-dac',
      shortDescription: 'Peptide GHRH modifié avec demi-vie prolongée.',
      productType: ProductType.PEPTIDE,
      price: 45.00,
      purity: 99.60,
      molecularWeight: 3647.28,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.muscle.id,
      isFeatured: true,
      tags: JSON.stringify(['growth', 'ghrh', 'muscle']),
    },
  });
  await createAllFormats(cjc1295.id, 'CJC-1295 DAC', 'PP-CJC', 45);

  const tesamorelin = await prisma.product.upsert({
    where: { slug: 'tesamorelin' },
    update: {},
    create: {
      name: 'Tesamorelin',
      subtitle: 'GHRH Analog',
      slug: 'tesamorelin',
      shortDescription: 'Analogue de GHRH pour la recherche sur la composition corporelle.',
      productType: ProductType.PEPTIDE,
      price: 65.00,
      purity: 99.60,
      molecularWeight: 5135.87,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.muscle.id,
      isFeatured: true,
      tags: JSON.stringify(['growth', 'ghrh', 'fat-loss']),
    },
  });
  await createAllFormats(tesamorelin.id, 'Tesamorelin', 'PP-TESA', 65);

  const igf1lr3 = await prisma.product.upsert({
    where: { slug: 'igf-1-lr3' },
    update: {},
    create: {
      name: 'IGF-1 LR3',
      subtitle: 'Long R3 Insulin-like Growth Factor',
      slug: 'igf-1-lr3',
      shortDescription: 'Facteur de croissance analogue à l\'insuline modifié.',
      productType: ProductType.PEPTIDE,
      price: 75.00,
      purity: 99.51,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.muscle.id,
      isFeatured: true,
      tags: JSON.stringify(['growth', 'muscle', 'igf']),
    },
  });
  await createAllFormats(igf1lr3.id, 'IGF-1 LR3', 'PP-IGF1LR3', 75);

  const follistatin344 = await prisma.product.upsert({
    where: { slug: 'follistatin-344' },
    update: {},
    create: {
      name: 'Follistatin 344',
      subtitle: 'Myostatin Inhibitor',
      slug: 'follistatin-344',
      shortDescription: 'Protéine inhibitrice de la myostatine.',
      productType: ProductType.PEPTIDE,
      price: 120.00,
      purity: 99.20,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.muscle.id,
      isFeatured: false,
      tags: JSON.stringify(['muscle', 'myostatin', 'growth']),
    },
  });
  await createAllFormats(follistatin344.id, 'Follistatin 344', 'PP-FOLL', 120);

  // =====================================================
  // PRODUITS - ANTI-ÂGE & LONGÉVITÉ
  // =====================================================
  console.log('💊 Création des produits - Anti-âge...');

  const epithalon = await prisma.product.upsert({
    where: { slug: 'epithalon' },
    update: {},
    create: {
      name: 'Epithalon',
      subtitle: 'Epitalon - Activateur de télomérase',
      slug: 'epithalon',
      shortDescription: 'Tétrapeptide pour la recherche sur les télomères.',
      productType: ProductType.PEPTIDE,
      price: 28.00,
      purity: 99.20,
      molecularWeight: 390.35,
      casNumber: '307297-39-8',
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.antiAging.id,
      isFeatured: true,
      tags: JSON.stringify(['longevity', 'telomeres', 'anti-aging']),
    },
  });
  await createAllFormats(epithalon.id, 'Epithalon', 'PP-EPIT', 28);

  const thymalin = await prisma.product.upsert({
    where: { slug: 'thymalin' },
    update: {},
    create: {
      name: 'Thymalin',
      subtitle: 'Thymic Peptide',
      slug: 'thymalin',
      shortDescription: 'Peptide thymique pour la recherche immunitaire.',
      productType: ProductType.PEPTIDE,
      price: 35.00,
      purity: 99.10,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.antiAging.id,
      isFeatured: false,
      tags: JSON.stringify(['immune', 'thymus', 'anti-aging']),
    },
  });
  await createAllFormats(thymalin.id, 'Thymalin', 'PP-THYM', 35);

  // =====================================================
  // PRODUITS - SANTÉ COGNITIVE
  // =====================================================
  console.log('💊 Création des produits - Cognition...');

  const selank = await prisma.product.upsert({
    where: { slug: 'selank' },
    update: {},
    create: {
      name: 'Selank',
      subtitle: 'Peptide anxiolytique',
      slug: 'selank',
      shortDescription: 'Peptide nootropique pour la recherche cognitive.',
      productType: ProductType.PEPTIDE,
      price: 22.00,
      purity: 99.10,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.cognitive.id,
      isFeatured: false,
      tags: JSON.stringify(['cognitive', 'nootropic', 'anxiety']),
    },
  });
  await createAllFormats(selank.id, 'Selank', 'PP-SELANK', 22);

  // Selank Nasal Spray
  await prisma.productFormat.create({
    data: {
      productId: selank.id,
      formatType: FormatType.NASAL_SPRAY,
      name: '10ml Nasal Spray',
      volumeMl: 10,
      price: 45.00,
      sku: 'PP-SELANK-SPRAY',
      stockQuantity: 50,
      lowStockThreshold: 10,
      sortOrder: 10,
      imageUrl: '/images/formats/nasal-spray.png',
      availability: StockStatus.IN_STOCK,
    },
  });

  const semax = await prisma.product.upsert({
    where: { slug: 'semax' },
    update: {},
    create: {
      name: 'Semax',
      subtitle: 'Peptide nootropique',
      slug: 'semax',
      shortDescription: 'Peptide synthétique dérivé de l\'ACTH.',
      productType: ProductType.PEPTIDE,
      price: 40.00,
      purity: 99.30,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.cognitive.id,
      tags: JSON.stringify(['cognitive', 'nootropic', 'focus']),
    },
  });
  await createAllFormats(semax.id, 'Semax', 'PP-SEMAX', 40);

  // Semax Nasal Spray
  await prisma.productFormat.create({
    data: {
      productId: semax.id,
      formatType: FormatType.NASAL_SPRAY,
      name: '10ml Nasal Spray',
      volumeMl: 10,
      price: 65.00,
      sku: 'PP-SEMAX-SPRAY',
      stockQuantity: 40,
      lowStockThreshold: 10,
      sortOrder: 10,
      imageUrl: '/images/formats/nasal-spray.png',
      availability: StockStatus.IN_STOCK,
    },
  });

  const dihexa = await prisma.product.upsert({
    where: { slug: 'dihexa' },
    update: {},
    create: {
      name: 'Dihexa',
      subtitle: 'PNB-0408',
      slug: 'dihexa',
      shortDescription: 'Peptide pour la recherche sur la neuroplasticité.',
      productType: ProductType.PEPTIDE,
      price: 55.00,
      purity: 99.40,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.cognitive.id,
      isFeatured: true,
      tags: JSON.stringify(['cognitive', 'brain', 'memory']),
    },
  });
  await createAllFormats(dihexa.id, 'Dihexa', 'PP-DIHEXA', 55);

  // =====================================================
  // PRODUITS - SANTÉ SEXUELLE
  // =====================================================
  console.log('💊 Création des produits - Santé sexuelle...');

  const pt141 = await prisma.product.upsert({
    where: { slug: 'pt-141' },
    update: {},
    create: {
      name: 'PT-141',
      subtitle: 'Bremelanotide',
      slug: 'pt-141',
      shortDescription: 'Peptide agoniste des récepteurs mélanocortines.',
      productType: ProductType.PEPTIDE,
      price: 42.00,
      purity: 99.40,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.sexual.id,
      isFeatured: true,
      tags: JSON.stringify(['sexual', 'libido', 'melanocortin']),
    },
  });
  await createAllFormats(pt141.id, 'PT-141', 'PP-PT141', 42);

  const kisspeptin = await prisma.product.upsert({
    where: { slug: 'kisspeptin-10' },
    update: {},
    create: {
      name: 'Kisspeptin-10',
      subtitle: 'Metastin',
      slug: 'kisspeptin-10',
      shortDescription: 'Peptide pour la recherche sur la fonction reproductive.',
      productType: ProductType.PEPTIDE,
      price: 48.00,
      purity: 99.30,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.sexual.id,
      isFeatured: false,
      tags: JSON.stringify(['reproductive', 'hormone', 'fertility']),
    },
  });
  await createAllFormats(kisspeptin.id, 'Kisspeptin-10', 'PP-KISS', 48);

  // =====================================================
  // PRODUITS - SANTÉ DE LA PEAU
  // =====================================================
  console.log('💊 Création des produits - Peau...');

  const ghkcu = await prisma.product.upsert({
    where: { slug: 'ghk-cu' },
    update: {},
    create: {
      name: 'GHK-Cu',
      subtitle: 'Copper Peptide',
      slug: 'ghk-cu',
      shortDescription: 'Tripeptide cuivrique pour la régénération cutanée.',
      productType: ProductType.PEPTIDE,
      price: 50.00,
      purity: 99.50,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.skin.id,
      isFeatured: true,
      tags: JSON.stringify(['skin', 'copper', 'regeneration', 'hair']),
    },
  });
  await createAllFormats(ghkcu.id, 'GHK-Cu', 'PP-GHKCU', 50);

  // GHK-Cu Cream
  await prisma.productFormat.create({
    data: {
      productId: ghkcu.id,
      formatType: FormatType.CREAM,
      name: '50ml Topical Cream',
      volumeMl: 50,
      price: 85.00,
      sku: 'PP-GHKCU-CREAM',
      stockQuantity: 30,
      lowStockThreshold: 5,
      sortOrder: 10,
      imageUrl: '/images/formats/cream.png',
      availability: StockStatus.IN_STOCK,
    },
  });

  const melanotan2 = await prisma.product.upsert({
    where: { slug: 'melanotan-2' },
    update: {},
    create: {
      name: 'Melanotan II',
      subtitle: 'MT2 - Peptide de bronzage',
      slug: 'melanotan-2',
      shortDescription: 'Analogue synthétique de l\'alpha-MSH.',
      productType: ProductType.PEPTIDE,
      price: 28.00,
      purity: 99.73,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.skin.id,
      isFeatured: true,
      tags: JSON.stringify(['skin', 'tanning', 'melanocortin']),
    },
  });
  await createAllFormats(melanotan2.id, 'Melanotan II', 'PP-MT2', 28);

  // =====================================================
  // PRODUITS - BLENDS
  // =====================================================
  console.log('💊 Création des produits - Blends...');

  const healingBlend = await prisma.product.upsert({
    where: { slug: 'bpc-157-tb-500-blend' },
    update: {},
    create: {
      name: 'BPC-157 + TB-500 Blend',
      subtitle: 'Healing Blend',
      slug: 'bpc-157-tb-500-blend',
      shortDescription: 'Combinaison synergique pour la récupération optimale.',
      description: 'Ce blend combine BPC-157 et TB-500 dans un rapport optimal pour maximiser les effets régénératifs.',
      productType: ProductType.PEPTIDE,
      price: 70.00,
      purity: 99.40,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.blends.id,
      isFeatured: true,
      isBestseller: true,
      tags: JSON.stringify(['blend', 'recovery', 'healing']),
    },
  });
  await createAllFormats(healingBlend.id, 'Healing Blend', 'PP-HEAL', 70);

  const cjcIpaBlend = await prisma.product.upsert({
    where: { slug: 'cjc-1295-ipamorelin-blend' },
    update: {},
    create: {
      name: 'CJC-1295 + Ipamorelin',
      subtitle: 'Growth Hormone Blend',
      slug: 'cjc-1295-ipamorelin-blend',
      shortDescription: 'Combinaison pour stimulation de la GH.',
      productType: ProductType.PEPTIDE,
      price: 90.00,
      purity: 99.30,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.blends.id,
      isFeatured: true,
      tags: JSON.stringify(['blend', 'growth', 'hormone']),
    },
  });
  await createAllFormats(cjcIpaBlend.id, 'CJC-Ipa Blend', 'PP-CJCIPA', 90);

  // =====================================================
  // PRODUITS - ACCESSOIRES
  // =====================================================
  console.log('🔧 Création des produits - Accessoires...');

  const bacWater = await prisma.product.upsert({
    where: { slug: 'bacteriostatic-water' },
    update: {},
    create: {
      name: 'Eau Bactériostatique',
      subtitle: 'BAC Water pour reconstitution',
      slug: 'bacteriostatic-water',
      shortDescription: 'Eau stérile avec 0.9% d\'alcool benzylique.',
      productType: ProductType.ACCESSORY,
      price: 13.00,
      requiresShipping: true,
      imageUrl: '/images/products/bac-water.png',
      categoryId: categories.accessories.id,
      tags: JSON.stringify(['accessory', 'water', 'reconstitution']),
    },
  });

  await Promise.all([
    prisma.productFormat.create({
      data: {
        productId: bacWater.id,
        formatType: FormatType.ACCESSORY,
        name: '10ml Vial',
        volumeMl: 10,
        price: 13.00,
        sku: 'PP-BAC-10ML',
        stockQuantity: 500,
        isDefault: true,
        sortOrder: 1,
        imageUrl: '/images/formats/bac-water-10ml.png',
        availability: StockStatus.IN_STOCK,
      },
    }),
    prisma.productFormat.create({
      data: {
        productId: bacWater.id,
        formatType: FormatType.ACCESSORY,
        name: '30ml Vial',
        volumeMl: 30,
        price: 25.00,
        sku: 'PP-BAC-30ML',
        stockQuantity: 200,
        sortOrder: 2,
        imageUrl: '/images/formats/bac-water-30ml.png',
        availability: StockStatus.IN_STOCK,
      },
    }),
    prisma.productFormat.create({
      data: {
        productId: bacWater.id,
        formatType: FormatType.PACK_10,
        name: '10ml x 10 Pack',
        volumeMl: 100,
        unitCount: 10,
        price: 100.00,
        comparePrice: 130.00,
        sku: 'PP-BAC-10ML-10PK',
        stockQuantity: 50,
        sortOrder: 3,
        imageUrl: '/images/formats/pack-10.png',
        availability: StockStatus.IN_STOCK,
      },
    }),
  ]);

  const insulinSyringes = await prisma.product.upsert({
    where: { slug: 'insulin-syringes-u100' },
    update: {},
    create: {
      name: 'Seringues U100',
      subtitle: 'Aiguilles d\'injection 29G',
      slug: 'insulin-syringes-u100',
      shortDescription: 'Seringues à insuline 1ml avec aiguille 29G.',
      productType: ProductType.ACCESSORY,
      price: 15.00,
      requiresShipping: true,
      imageUrl: '/images/products/syringes.png',
      categoryId: categories.accessories.id,
      tags: JSON.stringify(['accessory', 'syringe', 'injection']),
    },
  });

  await Promise.all([
    prisma.productFormat.create({
      data: {
        productId: insulinSyringes.id,
        formatType: FormatType.ACCESSORY,
        name: 'Box of 10',
        unitCount: 10,
        price: 15.00,
        sku: 'PP-SYR-10PK',
        stockQuantity: 300,
        isDefault: true,
        sortOrder: 1,
        imageUrl: '/images/formats/syringes-10.png',
        availability: StockStatus.IN_STOCK,
      },
    }),
    prisma.productFormat.create({
      data: {
        productId: insulinSyringes.id,
        formatType: FormatType.ACCESSORY,
        name: 'Box of 50',
        unitCount: 50,
        price: 45.00,
        comparePrice: 50.00,
        sku: 'PP-SYR-50PK',
        stockQuantity: 100,
        sortOrder: 2,
        imageUrl: '/images/formats/syringes-50.png',
        availability: StockStatus.IN_STOCK,
      },
    }),
    prisma.productFormat.create({
      data: {
        productId: insulinSyringes.id,
        formatType: FormatType.ACCESSORY,
        name: 'Box of 100',
        unitCount: 100,
        price: 75.00,
        comparePrice: 100.00,
        sku: 'PP-SYR-100PK',
        stockQuantity: 50,
        sortOrder: 3,
        imageUrl: '/images/formats/syringes-100.png',
        availability: StockStatus.IN_STOCK,
      },
    }),
  ]);

  const injectionPen = await prisma.product.upsert({
    where: { slug: 'injection-pen' },
    update: {},
    create: {
      name: 'Stylo d\'Injection',
      subtitle: 'Pen for Cartridges',
      slug: 'injection-pen',
      shortDescription: 'Stylo réutilisable pour cartouches 3ml.',
      productType: ProductType.ACCESSORY,
      price: 35.00,
      requiresShipping: true,
      imageUrl: '/images/products/injection-pen.png',
      categoryId: categories.accessories.id,
      isFeatured: true,
      tags: JSON.stringify(['accessory', 'pen', 'injection']),
    },
  });

  await prisma.productFormat.create({
    data: {
      productId: injectionPen.id,
      formatType: FormatType.ACCESSORY,
      name: 'Single Pen',
      unitCount: 1,
      price: 35.00,
      sku: 'PP-PEN-1',
      stockQuantity: 150,
      isDefault: true,
      sortOrder: 1,
      imageUrl: '/images/formats/pen.png',
      availability: StockStatus.IN_STOCK,
    },
  });

  // =====================================================
  // PRODUITS - SUPPLÉMENTS
  // =====================================================
  console.log('💊 Création des produits - Suppléments...');

  const nad = await prisma.product.upsert({
    where: { slug: 'nad-plus' },
    update: {},
    create: {
      name: 'NAD+',
      subtitle: 'Nicotinamide Adenine Dinucleotide',
      slug: 'nad-plus',
      shortDescription: 'Coenzyme essentiel pour le métabolisme cellulaire.',
      productType: ProductType.SUPPLEMENT,
      price: 38.00,
      purity: 99.00,
      storageConditions: '-20°C',
      imageUrl: '/images/products/peptide-default.png',
      categoryId: categories.supplements.id,
      isFeatured: true,
      tags: JSON.stringify(['supplement', 'longevity', 'energy']),
    },
  });
  await createAllFormats(nad.id, 'NAD+', 'PP-NAD', 38);

  const nmn = await prisma.product.upsert({
    where: { slug: 'nmn' },
    update: {},
    create: {
      name: 'NMN',
      subtitle: 'Nicotinamide Mononucleotide',
      slug: 'nmn',
      shortDescription: 'Précurseur du NAD+ pour la recherche sur la longévité.',
      productType: ProductType.CAPSULE,
      price: 55.00,
      purity: 99.00,
      storageConditions: '2-8°C',
      imageUrl: '/images/products/nmn.png',
      categoryId: categories.supplements.id,
      isFeatured: true,
      tags: JSON.stringify(['supplement', 'longevity', 'nad']),
    },
  });
  await createCapsuleFormats(nmn.id, 'PP-NMN', 55);

  // =====================================================
  // CODES PROMO
  // =====================================================
  console.log('🎟️ Création des codes promo...');

  await prisma.promoCode.deleteMany({});
  await Promise.all([
    prisma.promoCode.create({
      data: {
        code: 'WELCOME10',
        description: 'Réduction de bienvenue pour les nouveaux clients',
        type: DiscountType.PERCENTAGE,
        value: 10,
        firstOrderOnly: true,
        isActive: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'PEPTIDE20',
        description: 'Réduction de 20% sur toute la commande',
        type: DiscountType.PERCENTAGE,
        value: 20,
        minOrderAmount: 200,
        usageLimit: 100,
        isActive: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'SAVE25',
        description: 'Économisez 25$ sur les commandes de 150$+',
        type: DiscountType.FIXED_AMOUNT,
        value: 25,
        minOrderAmount: 150,
        isActive: true,
      },
    }),
    prisma.promoCode.create({
      data: {
        code: 'BULK15',
        description: '15% de réduction sur les kits et packs',
        type: DiscountType.PERCENTAGE,
        value: 15,
        minOrderAmount: 300,
        isActive: true,
      },
    }),
  ]);

  // =====================================================
  // ADMIN USER
  // =====================================================
  console.log('👤 Création de l\'utilisateur admin...');

  await prisma.user.upsert({
    where: { email: 'admin@peptideplus.ca' },
    update: {},
    create: {
      email: 'admin@peptideplus.ca',
      name: 'Admin Peptide Plus+',
      role: 'OWNER',
      emailVerified: new Date(),
      locale: 'fr',
    },
  });

  // =====================================================
  // COMPTABILITÉ (Plan comptable, Paramètres, Périodes)
  // =====================================================
  await seedAccounting();

  // Count totals
  const productCount = await prisma.product.count();
  const formatCount = await prisma.productFormat.count();
  const accountCount = await prisma.chartOfAccount.count();

  console.log('✅ Seeding terminé avec succès!');
  console.log(`
📊 Résumé:
- 3 devises
- 4 zones de livraison
- ${Object.keys(categories).length} catégories
- ${productCount} produits
- ${formatCount} formats/variantes
- ${accountCount} comptes comptables
- 4 codes promo
- 1 admin
  `);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

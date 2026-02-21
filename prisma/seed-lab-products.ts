import { PrismaClient, ProductType, FormatType, StockStatus } from '@prisma/client';

const prisma = new PrismaClient();

// =====================================================
// HELPER: Create a single ACCESSORY format for a lab product
// =====================================================
async function createLabFormat(
  productId: string,
  sku: string,
  price: number,
  stock: number
) {
  await prisma.productFormat.create({
    data: {
      productId,
      formatType: FormatType.ACCESSORY,
      name: 'Unite standard',
      price,
      sku,
      stockQuantity: stock,
      lowStockThreshold: 10,
      isDefault: true,
      sortOrder: 1,
      imageUrl: '/images/formats/lab-default.png',
      availability: StockStatus.IN_STOCK,
    },
  });
}

// =====================================================
// PRODUCT DATA DEFINITIONS
// =====================================================

interface LabProduct {
  name: string;
  slug: string;
  shortDescription: string;
  price: number;
  sku: string;
  manufacturer: string;
  tags: string[];
  stock: number;
}

// ----- 1. PIPETTE TIPS (30 products) -----
const pipetteTips: LabProduct[] = [
  { name: 'Pointes de pipette 10 uL universelles', slug: 'pointes-pipette-10ul-universelles', shortDescription: 'Pointes universelles 10 uL, non steriles, sac de 1000.', price: 18.50, sku: 'PP-LAB-0001', manufacturer: 'Eppendorf', tags: ['pipette-tips', '10ul', 'universal'], stock: 400 },
  { name: 'Pointes de pipette 10 uL filtrees steriles', slug: 'pointes-pipette-10ul-filtrees-steriles', shortDescription: 'Pointes 10 uL avec filtre, steriles, rack de 96.', price: 42.00, sku: 'PP-LAB-0002', manufacturer: 'Sartorius', tags: ['pipette-tips', '10ul', 'filtered', 'sterile'], stock: 350 },
  { name: 'Pointes de pipette 20 uL universelles', slug: 'pointes-pipette-20ul-universelles', shortDescription: 'Pointes universelles 20 uL, non steriles, sac de 1000.', price: 19.00, sku: 'PP-LAB-0003', manufacturer: 'Corning', tags: ['pipette-tips', '20ul', 'universal'], stock: 400 },
  { name: 'Pointes de pipette 20 uL filtrees steriles', slug: 'pointes-pipette-20ul-filtrees-steriles', shortDescription: 'Pointes 20 uL avec filtre, steriles, rack de 96.', price: 44.00, sku: 'PP-LAB-0004', manufacturer: 'Eppendorf', tags: ['pipette-tips', '20ul', 'filtered', 'sterile'], stock: 300 },
  { name: 'Pointes de pipette 100 uL universelles', slug: 'pointes-pipette-100ul-universelles', shortDescription: 'Pointes universelles 100 uL, non steriles, sac de 1000.', price: 20.00, sku: 'PP-LAB-0005', manufacturer: 'Fisher Scientific', tags: ['pipette-tips', '100ul', 'universal'], stock: 450 },
  { name: 'Pointes de pipette 100 uL filtrees steriles', slug: 'pointes-pipette-100ul-filtrees-steriles', shortDescription: 'Pointes 100 uL avec filtre, steriles, rack de 96.', price: 46.00, sku: 'PP-LAB-0006', manufacturer: 'Sartorius', tags: ['pipette-tips', '100ul', 'filtered', 'sterile'], stock: 300 },
  { name: 'Pointes de pipette 200 uL universelles', slug: 'pointes-pipette-200ul-universelles', shortDescription: 'Pointes universelles 200 uL, non steriles, sac de 1000.', price: 21.00, sku: 'PP-LAB-0007', manufacturer: 'Corning', tags: ['pipette-tips', '200ul', 'universal'], stock: 400 },
  { name: 'Pointes de pipette 200 uL filtrees steriles', slug: 'pointes-pipette-200ul-filtrees-steriles', shortDescription: 'Pointes 200 uL avec filtre, steriles, rack de 96.', price: 48.00, sku: 'PP-LAB-0008', manufacturer: 'Eppendorf', tags: ['pipette-tips', '200ul', 'filtered', 'sterile'], stock: 350 },
  { name: 'Pointes de pipette 1000 uL universelles', slug: 'pointes-pipette-1000ul-universelles', shortDescription: 'Pointes universelles 1000 uL, non steriles, sac de 500.', price: 24.00, sku: 'PP-LAB-0009', manufacturer: 'Fisher Scientific', tags: ['pipette-tips', '1000ul', 'universal'], stock: 400 },
  { name: 'Pointes de pipette 1000 uL filtrees steriles', slug: 'pointes-pipette-1000ul-filtrees-steriles', shortDescription: 'Pointes 1000 uL avec filtre, steriles, rack de 96.', price: 52.00, sku: 'PP-LAB-0010', manufacturer: 'Sartorius', tags: ['pipette-tips', '1000ul', 'filtered', 'sterile'], stock: 300 },
  { name: 'Pointes de pipette 10 uL longues', slug: 'pointes-pipette-10ul-longues', shortDescription: 'Pointes 10 uL a tige allongee pour acces aux tubes etroits.', price: 28.00, sku: 'PP-LAB-0011', manufacturer: 'Eppendorf', tags: ['pipette-tips', '10ul', 'extended'], stock: 250 },
  { name: 'Pointes de pipette 200 uL basse retention', slug: 'pointes-pipette-200ul-basse-retention', shortDescription: 'Pointes 200 uL basse retention pour echantillons visqueux.', price: 55.00, sku: 'PP-LAB-0012', manufacturer: 'Thermo Fisher', tags: ['pipette-tips', '200ul', 'low-retention'], stock: 200 },
  { name: 'Pointes de pipette 1000 uL basse retention', slug: 'pointes-pipette-1000ul-basse-retention', shortDescription: 'Pointes 1000 uL basse retention, rack de 96.', price: 58.00, sku: 'PP-LAB-0013', manufacturer: 'Thermo Fisher', tags: ['pipette-tips', '1000ul', 'low-retention'], stock: 200 },
  { name: 'Pointes de pipette 10 uL en vrac', slug: 'pointes-pipette-10ul-vrac', shortDescription: 'Pointes 10 uL en vrac, sac de 5000 unites.', price: 65.00, sku: 'PP-LAB-0014', manufacturer: 'Corning', tags: ['pipette-tips', '10ul', 'bulk'], stock: 150 },
  { name: 'Pointes de pipette 200 uL en vrac', slug: 'pointes-pipette-200ul-vrac', shortDescription: 'Pointes 200 uL en vrac, sac de 5000 unites.', price: 72.00, sku: 'PP-LAB-0015', manufacturer: 'Fisher Scientific', tags: ['pipette-tips', '200ul', 'bulk'], stock: 150 },
  { name: 'Pointes de pipette 1000 uL en vrac', slug: 'pointes-pipette-1000ul-vrac', shortDescription: 'Pointes 1000 uL en vrac, sac de 2500 unites.', price: 78.00, sku: 'PP-LAB-0016', manufacturer: 'Corning', tags: ['pipette-tips', '1000ul', 'bulk'], stock: 150 },
  { name: 'Pointes de pipette 10 uL graduees', slug: 'pointes-pipette-10ul-graduees', shortDescription: 'Pointes 10 uL avec graduation, rack de 96.', price: 35.00, sku: 'PP-LAB-0017', manufacturer: 'Eppendorf', tags: ['pipette-tips', '10ul', 'graduated'], stock: 300 },
  { name: 'Pointes de pipette 100 uL basse retention steriles', slug: 'pointes-pipette-100ul-basse-retention-steriles', shortDescription: 'Pointes 100 uL basse retention steriles, rack de 96.', price: 62.00, sku: 'PP-LAB-0018', manufacturer: 'Thermo Fisher', tags: ['pipette-tips', '100ul', 'low-retention', 'sterile'], stock: 200 },
  { name: 'Pointes de pipette 5 mL macrovolume', slug: 'pointes-pipette-5ml-macrovolume', shortDescription: 'Pointes 5 mL pour pipettes macrovolume, sac de 100.', price: 32.00, sku: 'PP-LAB-0019', manufacturer: 'Sartorius', tags: ['pipette-tips', '5ml', 'macro'], stock: 250 },
  { name: 'Pointes de pipette 10 mL macrovolume', slug: 'pointes-pipette-10ml-macrovolume', shortDescription: 'Pointes 10 mL pour pipettes macrovolume, sac de 100.', price: 38.00, sku: 'PP-LAB-0020', manufacturer: 'Sartorius', tags: ['pipette-tips', '10ml', 'macro'], stock: 200 },
  { name: 'Pointes de pipette multicanal 200 uL', slug: 'pointes-pipette-multicanal-200ul', shortDescription: 'Pointes 200 uL compatibles pipettes multicanaux, rack de 96.', price: 34.00, sku: 'PP-LAB-0021', manufacturer: 'Eppendorf', tags: ['pipette-tips', '200ul', 'multichannel'], stock: 350 },
  { name: 'Pointes de pipette multicanal 300 uL filtrees', slug: 'pointes-pipette-multicanal-300ul-filtrees', shortDescription: 'Pointes 300 uL filtrees pour multicanaux, rack de 96.', price: 56.00, sku: 'PP-LAB-0022', manufacturer: 'Thermo Fisher', tags: ['pipette-tips', '300ul', 'multichannel', 'filtered'], stock: 250 },
  { name: 'Pointes de pipette robotique 50 uL', slug: 'pointes-pipette-robotique-50ul', shortDescription: 'Pointes 50 uL pour systemes automatises, rack de 96.', price: 75.00, sku: 'PP-LAB-0023', manufacturer: 'Hamilton', tags: ['pipette-tips', '50ul', 'robotic'], stock: 150 },
  { name: 'Pointes de pipette robotique 200 uL', slug: 'pointes-pipette-robotique-200ul', shortDescription: 'Pointes 200 uL pour systemes automatises, rack de 96.', price: 78.00, sku: 'PP-LAB-0024', manufacturer: 'Hamilton', tags: ['pipette-tips', '200ul', 'robotic'], stock: 150 },
  { name: 'Pointes de pipette robotique 1000 uL', slug: 'pointes-pipette-robotique-1000ul', shortDescription: 'Pointes 1000 uL pour systemes automatises, rack de 96.', price: 82.00, sku: 'PP-LAB-0025', manufacturer: 'Hamilton', tags: ['pipette-tips', '1000ul', 'robotic'], stock: 150 },
  { name: 'Pointes de pipette 200 uL couleur jaune', slug: 'pointes-pipette-200ul-jaune', shortDescription: 'Pointes 200 uL jaunes pour identification, sac de 1000.', price: 22.00, sku: 'PP-LAB-0026', manufacturer: 'Fisher Scientific', tags: ['pipette-tips', '200ul', 'colored'], stock: 400 },
  { name: 'Pointes de pipette 1000 uL couleur bleue', slug: 'pointes-pipette-1000ul-bleue', shortDescription: 'Pointes 1000 uL bleues pour identification, sac de 500.', price: 26.00, sku: 'PP-LAB-0027', manufacturer: 'Fisher Scientific', tags: ['pipette-tips', '1000ul', 'colored'], stock: 400 },
  { name: 'Rack de recharge pointes 200 uL', slug: 'rack-recharge-pointes-200ul', shortDescription: 'Rack de recharge 96 pointes 200 uL steriles.', price: 40.00, sku: 'PP-LAB-0028', manufacturer: 'Eppendorf', tags: ['pipette-tips', '200ul', 'refill-rack'], stock: 300 },
  { name: 'Rack de recharge pointes 1000 uL', slug: 'rack-recharge-pointes-1000ul', shortDescription: 'Rack de recharge 96 pointes 1000 uL steriles.', price: 45.00, sku: 'PP-LAB-0029', manufacturer: 'Eppendorf', tags: ['pipette-tips', '1000ul', 'refill-rack'], stock: 300 },
  { name: 'Pointes de pipette 20 uL ultrafines', slug: 'pointes-pipette-20ul-ultrafines', shortDescription: 'Pointes 20 uL ultrafines pour echantillons de precision.', price: 50.00, sku: 'PP-LAB-0030', manufacturer: 'Sartorius', tags: ['pipette-tips', '20ul', 'ultrafine'], stock: 250 },
];

// ----- 2. PETRI DISHES (25 products) -----
const petriDishes: LabProduct[] = [
  { name: 'Boites de Petri plastique 35 mm', slug: 'boites-petri-plastique-35mm', shortDescription: 'Boites de Petri en polystyrene 35 mm, steriles, lot de 20.', price: 12.00, sku: 'PP-LAB-0031', manufacturer: 'Corning', tags: ['petri-dish', '35mm', 'plastic', 'sterile'], stock: 500 },
  { name: 'Boites de Petri plastique 60 mm', slug: 'boites-petri-plastique-60mm', shortDescription: 'Boites de Petri en polystyrene 60 mm, steriles, lot de 20.', price: 14.00, sku: 'PP-LAB-0032', manufacturer: 'Corning', tags: ['petri-dish', '60mm', 'plastic', 'sterile'], stock: 500 },
  { name: 'Boites de Petri plastique 90 mm', slug: 'boites-petri-plastique-90mm', shortDescription: 'Boites de Petri en polystyrene 90 mm, steriles, lot de 20.', price: 16.00, sku: 'PP-LAB-0033', manufacturer: 'Fisher Scientific', tags: ['petri-dish', '90mm', 'plastic', 'sterile'], stock: 500 },
  { name: 'Boites de Petri plastique 100 mm', slug: 'boites-petri-plastique-100mm', shortDescription: 'Boites de Petri en polystyrene 100 mm, steriles, lot de 20.', price: 18.00, sku: 'PP-LAB-0034', manufacturer: 'Corning', tags: ['petri-dish', '100mm', 'plastic', 'sterile'], stock: 450 },
  { name: 'Boites de Petri plastique 150 mm', slug: 'boites-petri-plastique-150mm', shortDescription: 'Boites de Petri en polystyrene 150 mm, steriles, lot de 10.', price: 22.00, sku: 'PP-LAB-0035', manufacturer: 'Thermo Fisher', tags: ['petri-dish', '150mm', 'plastic', 'sterile'], stock: 350 },
  { name: 'Boites de Petri verre 60 mm', slug: 'boites-petri-verre-60mm', shortDescription: 'Boites de Petri en verre borosilicate 60 mm, reutilisables.', price: 8.50, sku: 'PP-LAB-0036', manufacturer: 'Pyrex', tags: ['petri-dish', '60mm', 'glass', 'reusable'], stock: 300 },
  { name: 'Boites de Petri verre 90 mm', slug: 'boites-petri-verre-90mm', shortDescription: 'Boites de Petri en verre borosilicate 90 mm, reutilisables.', price: 10.50, sku: 'PP-LAB-0037', manufacturer: 'Pyrex', tags: ['petri-dish', '90mm', 'glass', 'reusable'], stock: 300 },
  { name: 'Boites de Petri verre 100 mm', slug: 'boites-petri-verre-100mm', shortDescription: 'Boites de Petri en verre borosilicate 100 mm, reutilisables.', price: 12.50, sku: 'PP-LAB-0038', manufacturer: 'Pyrex', tags: ['petri-dish', '100mm', 'glass', 'reusable'], stock: 250 },
  { name: 'Boites de Petri verre 150 mm', slug: 'boites-petri-verre-150mm', shortDescription: 'Boites de Petri en verre borosilicate 150 mm, reutilisables.', price: 18.00, sku: 'PP-LAB-0039', manufacturer: 'Pyrex', tags: ['petri-dish', '150mm', 'glass', 'reusable'], stock: 200 },
  { name: 'Boites de Petri compartimentees 2 sections', slug: 'boites-petri-compartimentees-2-sections', shortDescription: 'Boites de Petri 90 mm, 2 compartiments, steriles, lot de 20.', price: 28.00, sku: 'PP-LAB-0040', manufacturer: 'Thermo Fisher', tags: ['petri-dish', '90mm', 'compartmented', '2-section'], stock: 250 },
  { name: 'Boites de Petri compartimentees 4 sections', slug: 'boites-petri-compartimentees-4-sections', shortDescription: 'Boites de Petri 90 mm, 4 compartiments, steriles, lot de 20.', price: 32.00, sku: 'PP-LAB-0041', manufacturer: 'Thermo Fisher', tags: ['petri-dish', '90mm', 'compartmented', '4-section'], stock: 250 },
  { name: 'Boites de Petri a fond quadrille', slug: 'boites-petri-fond-quadrille', shortDescription: 'Boites de Petri 90 mm a fond quadrille pour comptage, lot de 20.', price: 24.00, sku: 'PP-LAB-0042', manufacturer: 'Fisher Scientific', tags: ['petri-dish', '90mm', 'grid', 'counting'], stock: 300 },
  { name: 'Boites de Petri empilables 60 mm', slug: 'boites-petri-empilables-60mm', shortDescription: 'Boites de Petri empilables ventilees 60 mm, lot de 20.', price: 15.00, sku: 'PP-LAB-0043', manufacturer: 'Corning', tags: ['petri-dish', '60mm', 'stackable', 'vented'], stock: 400 },
  { name: 'Boites de Petri empilables 100 mm', slug: 'boites-petri-empilables-100mm', shortDescription: 'Boites de Petri empilables ventilees 100 mm, lot de 20.', price: 20.00, sku: 'PP-LAB-0044', manufacturer: 'Corning', tags: ['petri-dish', '100mm', 'stackable', 'vented'], stock: 400 },
  { name: 'Boites de Petri culture cellulaire 35 mm TC', slug: 'boites-petri-culture-cellulaire-35mm', shortDescription: 'Boites de Petri traitees culture cellulaire 35 mm, lot de 20.', price: 35.00, sku: 'PP-LAB-0045', manufacturer: 'Corning', tags: ['petri-dish', '35mm', 'cell-culture', 'TC-treated'], stock: 250 },
  { name: 'Boites de Petri culture cellulaire 60 mm TC', slug: 'boites-petri-culture-cellulaire-60mm', shortDescription: 'Boites de Petri traitees culture cellulaire 60 mm, lot de 20.', price: 38.00, sku: 'PP-LAB-0046', manufacturer: 'Corning', tags: ['petri-dish', '60mm', 'cell-culture', 'TC-treated'], stock: 250 },
  { name: 'Boites de Petri culture cellulaire 100 mm TC', slug: 'boites-petri-culture-cellulaire-100mm', shortDescription: 'Boites de Petri traitees culture cellulaire 100 mm, lot de 20.', price: 42.00, sku: 'PP-LAB-0047', manufacturer: 'Corning', tags: ['petri-dish', '100mm', 'cell-culture', 'TC-treated'], stock: 200 },
  { name: 'Boites de Petri en verre extra-plat 90 mm', slug: 'boites-petri-verre-extra-plat-90mm', shortDescription: 'Boites de Petri verre extra-plat pour microscopie, unitaire.', price: 15.00, sku: 'PP-LAB-0048', manufacturer: 'Pyrex', tags: ['petri-dish', '90mm', 'glass', 'flat-bottom', 'microscopy'], stock: 200 },
  { name: 'Boites de Petri plastique 55 mm avec bord sureleve', slug: 'boites-petri-plastique-55mm-bord-sureleve', shortDescription: 'Boites de Petri 55 mm a bord sureleve anti-condensation, lot de 20.', price: 16.50, sku: 'PP-LAB-0049', manufacturer: 'Thermo Fisher', tags: ['petri-dish', '55mm', 'raised-edge'], stock: 350 },
  { name: 'Boites de Petri plastique 90 mm non ventilees', slug: 'boites-petri-plastique-90mm-non-ventilees', shortDescription: 'Boites de Petri 90 mm etanches, steriles, lot de 20.', price: 17.00, sku: 'PP-LAB-0050', manufacturer: 'Fisher Scientific', tags: ['petri-dish', '90mm', 'tight-fit', 'sealed'], stock: 400 },
  { name: 'Boites de Petri carrees 120 mm', slug: 'boites-petri-carrees-120mm', shortDescription: 'Boites de Petri carrees 120 mm, steriles, lot de 10.', price: 30.00, sku: 'PP-LAB-0051', manufacturer: 'Thermo Fisher', tags: ['petri-dish', '120mm', 'square'], stock: 200 },
  { name: 'Boites de Petri plastique 60 mm avec grille', slug: 'boites-petri-plastique-60mm-grille', shortDescription: 'Boites de Petri 60 mm avec grille de contact, lot de 20.', price: 22.00, sku: 'PP-LAB-0052', manufacturer: 'Fisher Scientific', tags: ['petri-dish', '60mm', 'contact-grid'], stock: 300 },
  { name: 'Boites de Petri a fond noir 90 mm', slug: 'boites-petri-fond-noir-90mm', shortDescription: 'Boites de Petri 90 mm fond noir pour contraste, lot de 20.', price: 26.00, sku: 'PP-LAB-0053', manufacturer: 'Corning', tags: ['petri-dish', '90mm', 'black-bottom', 'contrast'], stock: 200 },
  { name: 'Boites de Petri biodegradables 90 mm', slug: 'boites-petri-biodegradables-90mm', shortDescription: 'Boites de Petri biodegradables PLA 90 mm, lot de 20.', price: 28.00, sku: 'PP-LAB-0054', manufacturer: 'Sartorius', tags: ['petri-dish', '90mm', 'biodegradable', 'eco'], stock: 250 },
  { name: 'Boites de Petri gelose pre-coulee TSA 90 mm', slug: 'boites-petri-gelose-tsa-90mm', shortDescription: 'Boites de Petri 90 mm pre-coulees gelose TSA, lot de 10.', price: 45.00, sku: 'PP-LAB-0055', manufacturer: 'Thermo Fisher', tags: ['petri-dish', '90mm', 'pre-poured', 'TSA', 'microbiology'], stock: 200 },
];

// ----- 3. BEAKERS & FLASKS (25 products) -----
const beakersFlasks: LabProduct[] = [
  { name: 'Becher en verre 50 mL', slug: 'becher-verre-50ml', shortDescription: 'Becher en verre borosilicate 50 mL, gradue.', price: 6.50, sku: 'PP-LAB-0056', manufacturer: 'Pyrex', tags: ['beaker', '50ml', 'glass', 'graduated'], stock: 400 },
  { name: 'Becher en verre 100 mL', slug: 'becher-verre-100ml', shortDescription: 'Becher en verre borosilicate 100 mL, gradue.', price: 7.00, sku: 'PP-LAB-0057', manufacturer: 'Pyrex', tags: ['beaker', '100ml', 'glass', 'graduated'], stock: 400 },
  { name: 'Becher en verre 250 mL', slug: 'becher-verre-250ml', shortDescription: 'Becher en verre borosilicate 250 mL, gradue.', price: 8.50, sku: 'PP-LAB-0058', manufacturer: 'Pyrex', tags: ['beaker', '250ml', 'glass', 'graduated'], stock: 400 },
  { name: 'Becher en verre 500 mL', slug: 'becher-verre-500ml', shortDescription: 'Becher en verre borosilicate 500 mL, gradue.', price: 10.00, sku: 'PP-LAB-0059', manufacturer: 'Pyrex', tags: ['beaker', '500ml', 'glass', 'graduated'], stock: 350 },
  { name: 'Becher en verre 1000 mL', slug: 'becher-verre-1000ml', shortDescription: 'Becher en verre borosilicate 1000 mL, gradue.', price: 14.00, sku: 'PP-LAB-0060', manufacturer: 'Pyrex', tags: ['beaker', '1000ml', 'glass', 'graduated'], stock: 300 },
  { name: 'Becher en verre 2000 mL', slug: 'becher-verre-2000ml', shortDescription: 'Becher en verre borosilicate 2000 mL, gradue.', price: 22.00, sku: 'PP-LAB-0061', manufacturer: 'Pyrex', tags: ['beaker', '2000ml', 'glass', 'graduated'], stock: 200 },
  { name: 'Becher en verre 5000 mL', slug: 'becher-verre-5000ml', shortDescription: 'Becher en verre borosilicate 5000 mL, gradue.', price: 45.00, sku: 'PP-LAB-0062', manufacturer: 'Pyrex', tags: ['beaker', '5000ml', 'glass', 'graduated'], stock: 100 },
  { name: 'Becher en plastique PP 250 mL', slug: 'becher-plastique-pp-250ml', shortDescription: 'Becher en polypropylene 250 mL, autoclavable.', price: 4.50, sku: 'PP-LAB-0063', manufacturer: 'Thermo Fisher', tags: ['beaker', '250ml', 'plastic', 'autoclavable'], stock: 400 },
  { name: 'Becher en plastique PP 1000 mL', slug: 'becher-plastique-pp-1000ml', shortDescription: 'Becher en polypropylene 1000 mL, autoclavable.', price: 8.00, sku: 'PP-LAB-0064', manufacturer: 'Thermo Fisher', tags: ['beaker', '1000ml', 'plastic', 'autoclavable'], stock: 350 },
  { name: 'Erlenmeyer en verre 100 mL', slug: 'erlenmeyer-verre-100ml', shortDescription: 'Fiole Erlenmeyer en verre borosilicate 100 mL, col etroit.', price: 9.00, sku: 'PP-LAB-0065', manufacturer: 'Pyrex', tags: ['flask', 'erlenmeyer', '100ml', 'glass'], stock: 350 },
  { name: 'Erlenmeyer en verre 250 mL', slug: 'erlenmeyer-verre-250ml', shortDescription: 'Fiole Erlenmeyer en verre borosilicate 250 mL, col etroit.', price: 11.00, sku: 'PP-LAB-0066', manufacturer: 'Pyrex', tags: ['flask', 'erlenmeyer', '250ml', 'glass'], stock: 350 },
  { name: 'Erlenmeyer en verre 500 mL', slug: 'erlenmeyer-verre-500ml', shortDescription: 'Fiole Erlenmeyer en verre borosilicate 500 mL, col etroit.', price: 14.00, sku: 'PP-LAB-0067', manufacturer: 'Pyrex', tags: ['flask', 'erlenmeyer', '500ml', 'glass'], stock: 300 },
  { name: 'Erlenmeyer en verre 1000 mL', slug: 'erlenmeyer-verre-1000ml', shortDescription: 'Fiole Erlenmeyer en verre borosilicate 1000 mL, col etroit.', price: 18.00, sku: 'PP-LAB-0068', manufacturer: 'Pyrex', tags: ['flask', 'erlenmeyer', '1000ml', 'glass'], stock: 250 },
  { name: 'Erlenmeyer en verre 2000 mL', slug: 'erlenmeyer-verre-2000ml', shortDescription: 'Fiole Erlenmeyer en verre borosilicate 2000 mL.', price: 28.00, sku: 'PP-LAB-0069', manufacturer: 'Pyrex', tags: ['flask', 'erlenmeyer', '2000ml', 'glass'], stock: 150 },
  { name: 'Fiole jaugee classe A 50 mL', slug: 'fiole-jaugee-classe-a-50ml', shortDescription: 'Fiole jaugee volumetrique classe A 50 mL, bouchon verre.', price: 25.00, sku: 'PP-LAB-0070', manufacturer: 'Fisher Scientific', tags: ['flask', 'volumetric', '50ml', 'class-A'], stock: 200 },
  { name: 'Fiole jaugee classe A 100 mL', slug: 'fiole-jaugee-classe-a-100ml', shortDescription: 'Fiole jaugee volumetrique classe A 100 mL, bouchon verre.', price: 28.00, sku: 'PP-LAB-0071', manufacturer: 'Fisher Scientific', tags: ['flask', 'volumetric', '100ml', 'class-A'], stock: 200 },
  { name: 'Fiole jaugee classe A 250 mL', slug: 'fiole-jaugee-classe-a-250ml', shortDescription: 'Fiole jaugee volumetrique classe A 250 mL, bouchon verre.', price: 32.00, sku: 'PP-LAB-0072', manufacturer: 'Fisher Scientific', tags: ['flask', 'volumetric', '250ml', 'class-A'], stock: 200 },
  { name: 'Fiole jaugee classe A 500 mL', slug: 'fiole-jaugee-classe-a-500ml', shortDescription: 'Fiole jaugee volumetrique classe A 500 mL, bouchon verre.', price: 38.00, sku: 'PP-LAB-0073', manufacturer: 'Fisher Scientific', tags: ['flask', 'volumetric', '500ml', 'class-A'], stock: 150 },
  { name: 'Fiole jaugee classe A 1000 mL', slug: 'fiole-jaugee-classe-a-1000ml', shortDescription: 'Fiole jaugee volumetrique classe A 1000 mL, bouchon verre.', price: 45.00, sku: 'PP-LAB-0074', manufacturer: 'Fisher Scientific', tags: ['flask', 'volumetric', '1000ml', 'class-A'], stock: 150 },
  { name: 'Erlenmeyer col large 500 mL', slug: 'erlenmeyer-col-large-500ml', shortDescription: 'Fiole Erlenmeyer col large 500 mL, bouchon a vis.', price: 16.00, sku: 'PP-LAB-0075', manufacturer: 'Pyrex', tags: ['flask', 'erlenmeyer', '500ml', 'wide-mouth'], stock: 250 },
  { name: 'Fiole a fond plat 250 mL', slug: 'fiole-fond-plat-250ml', shortDescription: 'Fiole a fond plat en verre borosilicate 250 mL.', price: 12.00, sku: 'PP-LAB-0076', manufacturer: 'Pyrex', tags: ['flask', 'flat-bottom', '250ml', 'glass'], stock: 250 },
  { name: 'Fiole a fond plat 500 mL', slug: 'fiole-fond-plat-500ml', shortDescription: 'Fiole a fond plat en verre borosilicate 500 mL.', price: 15.00, sku: 'PP-LAB-0077', manufacturer: 'Pyrex', tags: ['flask', 'flat-bottom', '500ml', 'glass'], stock: 200 },
  { name: 'Fiole a fond rond 250 mL', slug: 'fiole-fond-rond-250ml', shortDescription: 'Fiole a fond rond en verre borosilicate 250 mL, col rodee.', price: 18.00, sku: 'PP-LAB-0078', manufacturer: 'Pyrex', tags: ['flask', 'round-bottom', '250ml', 'glass'], stock: 200 },
  { name: 'Fiole a fond rond 500 mL', slug: 'fiole-fond-rond-500ml', shortDescription: 'Fiole a fond rond en verre borosilicate 500 mL, col rodee.', price: 22.00, sku: 'PP-LAB-0079', manufacturer: 'Pyrex', tags: ['flask', 'round-bottom', '500ml', 'glass'], stock: 200 },
  { name: 'Erlenmeyer Baffled 500 mL culture', slug: 'erlenmeyer-baffled-500ml-culture', shortDescription: 'Erlenmeyer baffled 500 mL pour culture cellulaire, sterile.', price: 35.00, sku: 'PP-LAB-0080', manufacturer: 'Corning', tags: ['flask', 'erlenmeyer', '500ml', 'baffled', 'cell-culture'], stock: 200 },
];

// ----- 4. TEST TUBES (25 products) -----
const testTubes: LabProduct[] = [
  { name: 'Tubes a essai en verre 13x100 mm', slug: 'tubes-essai-verre-13x100mm', shortDescription: 'Tubes a essai en verre borosilicate 13x100 mm, lot de 72.', price: 28.00, sku: 'PP-LAB-0081', manufacturer: 'Pyrex', tags: ['test-tube', '13x100mm', 'glass'], stock: 350 },
  { name: 'Tubes a essai en verre 16x150 mm', slug: 'tubes-essai-verre-16x150mm', shortDescription: 'Tubes a essai en verre borosilicate 16x150 mm, lot de 72.', price: 32.00, sku: 'PP-LAB-0082', manufacturer: 'Pyrex', tags: ['test-tube', '16x150mm', 'glass'], stock: 350 },
  { name: 'Tubes a essai en verre 20x150 mm', slug: 'tubes-essai-verre-20x150mm', shortDescription: 'Tubes a essai en verre borosilicate 20x150 mm, lot de 48.', price: 30.00, sku: 'PP-LAB-0083', manufacturer: 'Pyrex', tags: ['test-tube', '20x150mm', 'glass'], stock: 300 },
  { name: 'Tubes a essai en verre 25x200 mm', slug: 'tubes-essai-verre-25x200mm', shortDescription: 'Tubes a essai en verre borosilicate 25x200 mm, lot de 36.', price: 35.00, sku: 'PP-LAB-0084', manufacturer: 'Pyrex', tags: ['test-tube', '25x200mm', 'glass'], stock: 250 },
  { name: 'Tubes a essai avec bouchon a vis 16x125 mm', slug: 'tubes-essai-bouchon-vis-16x125mm', shortDescription: 'Tubes en verre avec bouchon a vis 16x125 mm, lot de 50.', price: 38.00, sku: 'PP-LAB-0085', manufacturer: 'Fisher Scientific', tags: ['test-tube', '16x125mm', 'screw-cap', 'glass'], stock: 300 },
  { name: 'Tubes Eppendorf 0.5 mL', slug: 'tubes-eppendorf-0-5ml', shortDescription: 'Microtubes Eppendorf Safe-Lock 0.5 mL, lot de 500.', price: 22.00, sku: 'PP-LAB-0086', manufacturer: 'Eppendorf', tags: ['microtube', '0.5ml', 'safe-lock'], stock: 450 },
  { name: 'Tubes Eppendorf 1.5 mL', slug: 'tubes-eppendorf-1-5ml', shortDescription: 'Microtubes Eppendorf Safe-Lock 1.5 mL, lot de 500.', price: 24.00, sku: 'PP-LAB-0087', manufacturer: 'Eppendorf', tags: ['microtube', '1.5ml', 'safe-lock'], stock: 500 },
  { name: 'Tubes Eppendorf 2.0 mL', slug: 'tubes-eppendorf-2-0ml', shortDescription: 'Microtubes Eppendorf Safe-Lock 2.0 mL, lot de 500.', price: 26.00, sku: 'PP-LAB-0088', manufacturer: 'Eppendorf', tags: ['microtube', '2.0ml', 'safe-lock'], stock: 450 },
  { name: 'Tubes Falcon 15 mL steriles', slug: 'tubes-falcon-15ml-steriles', shortDescription: 'Tubes Falcon coniques 15 mL, steriles, lot de 50.', price: 18.00, sku: 'PP-LAB-0089', manufacturer: 'Corning', tags: ['falcon-tube', '15ml', 'conical', 'sterile'], stock: 500 },
  { name: 'Tubes Falcon 50 mL steriles', slug: 'tubes-falcon-50ml-steriles', shortDescription: 'Tubes Falcon coniques 50 mL, steriles, lot de 25.', price: 16.00, sku: 'PP-LAB-0090', manufacturer: 'Corning', tags: ['falcon-tube', '50ml', 'conical', 'sterile'], stock: 500 },
  { name: 'Tubes PCR 0.2 mL individuels', slug: 'tubes-pcr-0-2ml-individuels', shortDescription: 'Tubes PCR 0.2 mL paroi fine, lot de 1000.', price: 35.00, sku: 'PP-LAB-0091', manufacturer: 'Eppendorf', tags: ['pcr-tube', '0.2ml', 'thin-wall'], stock: 400 },
  { name: 'Tubes PCR 0.2 mL en barrettes de 8', slug: 'tubes-pcr-0-2ml-barrettes-8', shortDescription: 'Barrettes de 8 tubes PCR 0.2 mL avec bouchons plats, lot de 125.', price: 42.00, sku: 'PP-LAB-0092', manufacturer: 'Thermo Fisher', tags: ['pcr-tube', '0.2ml', 'strip', '8-strip'], stock: 350 },
  { name: 'Tubes cryogeniques 1.0 mL', slug: 'tubes-cryogeniques-1-0ml', shortDescription: 'Tubes cryogeniques 1.0 mL, filetage interne, steriles, lot de 100.', price: 45.00, sku: 'PP-LAB-0093', manufacturer: 'Thermo Fisher', tags: ['cryotube', '1.0ml', 'sterile', 'internal-thread'], stock: 300 },
  { name: 'Tubes cryogeniques 2.0 mL', slug: 'tubes-cryogeniques-2-0ml', shortDescription: 'Tubes cryogeniques 2.0 mL, filetage interne, steriles, lot de 100.', price: 48.00, sku: 'PP-LAB-0094', manufacturer: 'Thermo Fisher', tags: ['cryotube', '2.0ml', 'sterile', 'internal-thread'], stock: 300 },
  { name: 'Tubes en plastique fond rond 12x75 mm', slug: 'tubes-plastique-fond-rond-12x75mm', shortDescription: 'Tubes en polypropylene fond rond 12x75 mm, lot de 250.', price: 15.00, sku: 'PP-LAB-0095', manufacturer: 'Fisher Scientific', tags: ['test-tube', '12x75mm', 'plastic', 'round-bottom'], stock: 400 },
  { name: 'Tubes en plastique fond rond 16x100 mm', slug: 'tubes-plastique-fond-rond-16x100mm', shortDescription: 'Tubes en polypropylene fond rond 16x100 mm, lot de 250.', price: 18.00, sku: 'PP-LAB-0096', manufacturer: 'Fisher Scientific', tags: ['test-tube', '16x100mm', 'plastic', 'round-bottom'], stock: 350 },
  { name: 'Tubes a centrifuger 10 mL', slug: 'tubes-centrifuger-10ml', shortDescription: 'Tubes a centrifuger coniques 10 mL en verre, lot de 50.', price: 40.00, sku: 'PP-LAB-0097', manufacturer: 'Pyrex', tags: ['centrifuge-tube', '10ml', 'glass', 'conical'], stock: 250 },
  { name: 'Tubes a centrifuger 50 mL plastique', slug: 'tubes-centrifuger-50ml-plastique', shortDescription: 'Tubes centrifuges 50 mL autoportants, steriles, lot de 25.', price: 14.00, sku: 'PP-LAB-0098', manufacturer: 'Corning', tags: ['centrifuge-tube', '50ml', 'plastic', 'self-standing'], stock: 450 },
  { name: 'Tubes a hemodialyse EDTA 4 mL', slug: 'tubes-edta-4ml', shortDescription: 'Tubes de prelevement EDTA K2 4 mL, bouchon violet, lot de 100.', price: 32.00, sku: 'PP-LAB-0099', manufacturer: 'BD Vacutainer', tags: ['collection-tube', '4ml', 'EDTA', 'purple-cap'], stock: 350 },
  { name: 'Tubes heparine lithium 4 mL', slug: 'tubes-heparine-lithium-4ml', shortDescription: 'Tubes de prelevement heparine lithium 4 mL, bouchon vert, lot de 100.', price: 34.00, sku: 'PP-LAB-0100', manufacturer: 'BD Vacutainer', tags: ['collection-tube', '4ml', 'heparin', 'green-cap'], stock: 350 },
  { name: 'Tubes serum gel 5 mL', slug: 'tubes-serum-gel-5ml', shortDescription: 'Tubes de prelevement serum gel separateur 5 mL, lot de 100.', price: 36.00, sku: 'PP-LAB-0101', manufacturer: 'BD Vacutainer', tags: ['collection-tube', '5ml', 'serum', 'gel-separator'], stock: 300 },
  { name: 'Tubes NMR 5 mm standard', slug: 'tubes-nmr-5mm-standard', shortDescription: 'Tubes NMR en verre 5 mm, 7 pouces, lot de 5.', price: 55.00, sku: 'PP-LAB-0102', manufacturer: 'Wilmad-LabGlass', tags: ['nmr-tube', '5mm', 'glass', 'spectroscopy'], stock: 150 },
  { name: 'Tubes Eppendorf 5.0 mL', slug: 'tubes-eppendorf-5-0ml', shortDescription: 'Microtubes Eppendorf 5.0 mL a couvercle snap, lot de 200.', price: 28.00, sku: 'PP-LAB-0103', manufacturer: 'Eppendorf', tags: ['microtube', '5.0ml', 'snap-cap'], stock: 350 },
  { name: 'Portoir pour tubes a essai bois 12 places', slug: 'portoir-tubes-essai-bois-12-places', shortDescription: 'Portoir en bois pour 12 tubes a essai, trous 20 mm.', price: 12.00, sku: 'PP-LAB-0104', manufacturer: 'Fisher Scientific', tags: ['tube-rack', '12-place', 'wood'], stock: 300 },
  { name: 'Portoir pour microtubes 80 places', slug: 'portoir-microtubes-80-places', shortDescription: 'Portoir en polypropylene pour 80 microtubes 1.5-2.0 mL.', price: 8.00, sku: 'PP-LAB-0105', manufacturer: 'Eppendorf', tags: ['tube-rack', '80-place', 'microtube', 'plastic'], stock: 400 },
];

// ----- 5. FILTERS & MEMBRANES (20 products) -----
const filtersMembranes: LabProduct[] = [
  { name: 'Filtres seringue PVDF 0.22 um 33 mm', slug: 'filtres-seringue-pvdf-0-22um-33mm', shortDescription: 'Filtres seringue PVDF 0.22 um, 33 mm, steriles, lot de 50.', price: 65.00, sku: 'PP-LAB-0106', manufacturer: 'Sartorius', tags: ['syringe-filter', '0.22um', 'PVDF', '33mm', 'sterile'], stock: 300 },
  { name: 'Filtres seringue PVDF 0.45 um 33 mm', slug: 'filtres-seringue-pvdf-0-45um-33mm', shortDescription: 'Filtres seringue PVDF 0.45 um, 33 mm, steriles, lot de 50.', price: 60.00, sku: 'PP-LAB-0107', manufacturer: 'Sartorius', tags: ['syringe-filter', '0.45um', 'PVDF', '33mm', 'sterile'], stock: 300 },
  { name: 'Filtres seringue PES 0.22 um 33 mm', slug: 'filtres-seringue-pes-0-22um-33mm', shortDescription: 'Filtres seringue PES 0.22 um, 33 mm, steriles, lot de 50.', price: 58.00, sku: 'PP-LAB-0108', manufacturer: 'Thermo Fisher', tags: ['syringe-filter', '0.22um', 'PES', '33mm', 'sterile'], stock: 300 },
  { name: 'Filtres seringue Nylon 0.22 um 25 mm', slug: 'filtres-seringue-nylon-0-22um-25mm', shortDescription: 'Filtres seringue nylon 0.22 um, 25 mm, non steriles, lot de 100.', price: 48.00, sku: 'PP-LAB-0109', manufacturer: 'Fisher Scientific', tags: ['syringe-filter', '0.22um', 'nylon', '25mm'], stock: 350 },
  { name: 'Filtres seringue PTFE 0.45 um 25 mm', slug: 'filtres-seringue-ptfe-0-45um-25mm', shortDescription: 'Filtres seringue PTFE 0.45 um, 25 mm, pour solvants organiques, lot de 100.', price: 55.00, sku: 'PP-LAB-0110', manufacturer: 'Sartorius', tags: ['syringe-filter', '0.45um', 'PTFE', '25mm', 'organic'], stock: 250 },
  { name: 'Filtres seringue MCE 0.22 um 13 mm', slug: 'filtres-seringue-mce-0-22um-13mm', shortDescription: 'Filtres seringue cellulose mixte 0.22 um, 13 mm, lot de 100.', price: 42.00, sku: 'PP-LAB-0111', manufacturer: 'Fisher Scientific', tags: ['syringe-filter', '0.22um', 'MCE', '13mm'], stock: 350 },
  { name: 'Membranes filtrantes nitrocellulose 0.45 um 47 mm', slug: 'membranes-nitrocellulose-0-45um-47mm', shortDescription: 'Membranes nitrocellulose 0.45 um, 47 mm, lot de 100.', price: 75.00, sku: 'PP-LAB-0112', manufacturer: 'Sartorius', tags: ['membrane', '0.45um', 'nitrocellulose', '47mm'], stock: 200 },
  { name: 'Membranes filtrantes PVDF 0.22 um 47 mm', slug: 'membranes-pvdf-0-22um-47mm', shortDescription: 'Membranes PVDF hydrophiles 0.22 um, 47 mm, lot de 100.', price: 82.00, sku: 'PP-LAB-0113', manufacturer: 'Sartorius', tags: ['membrane', '0.22um', 'PVDF', '47mm'], stock: 200 },
  { name: 'Membranes filtrantes nylon 0.22 um 90 mm', slug: 'membranes-nylon-0-22um-90mm', shortDescription: 'Membranes nylon 0.22 um, 90 mm, lot de 50.', price: 70.00, sku: 'PP-LAB-0114', manufacturer: 'Thermo Fisher', tags: ['membrane', '0.22um', 'nylon', '90mm'], stock: 200 },
  { name: 'Filtres a vide bouteille-top PES 0.22 um 500 mL', slug: 'filtres-vide-bouteille-top-pes-0-22um-500ml', shortDescription: 'Systeme de filtration sous vide bouteille-top PES 0.22 um, 500 mL, sterile.', price: 28.00, sku: 'PP-LAB-0115', manufacturer: 'Corning', tags: ['bottle-top-filter', '0.22um', 'PES', '500ml', 'sterile'], stock: 250 },
  { name: 'Filtres a vide bouteille-top PES 0.22 um 1000 mL', slug: 'filtres-vide-bouteille-top-pes-0-22um-1000ml', shortDescription: 'Systeme de filtration sous vide bouteille-top PES 0.22 um, 1000 mL, sterile.', price: 35.00, sku: 'PP-LAB-0116', manufacturer: 'Corning', tags: ['bottle-top-filter', '0.22um', 'PES', '1000ml', 'sterile'], stock: 200 },
  { name: 'Unite de filtration Stericup 250 mL', slug: 'unite-filtration-stericup-250ml', shortDescription: 'Unite Stericup filtration sous vide PVDF 0.22 um, 250 mL.', price: 22.00, sku: 'PP-LAB-0117', manufacturer: 'Millipore', tags: ['stericup', '0.22um', 'PVDF', '250ml', 'sterile'], stock: 250 },
  { name: 'Unite de filtration Stericup 500 mL', slug: 'unite-filtration-stericup-500ml', shortDescription: 'Unite Stericup filtration sous vide PVDF 0.22 um, 500 mL.', price: 28.00, sku: 'PP-LAB-0118', manufacturer: 'Millipore', tags: ['stericup', '0.22um', 'PVDF', '500ml', 'sterile'], stock: 250 },
  { name: 'Papier filtre qualitatif grade 1 11 cm', slug: 'papier-filtre-qualitatif-grade1-11cm', shortDescription: 'Papier filtre qualitatif grade 1, 11 cm, lot de 100.', price: 18.00, sku: 'PP-LAB-0119', manufacturer: 'Whatman', tags: ['filter-paper', 'grade-1', '11cm', 'qualitative'], stock: 400 },
  { name: 'Papier filtre qualitatif grade 1 15 cm', slug: 'papier-filtre-qualitatif-grade1-15cm', shortDescription: 'Papier filtre qualitatif grade 1, 15 cm, lot de 100.', price: 22.00, sku: 'PP-LAB-0120', manufacturer: 'Whatman', tags: ['filter-paper', 'grade-1', '15cm', 'qualitative'], stock: 350 },
  { name: 'Papier filtre quantitatif grade 42 11 cm', slug: 'papier-filtre-quantitatif-grade42-11cm', shortDescription: 'Papier filtre quantitatif grade 42, ashless, 11 cm, lot de 100.', price: 32.00, sku: 'PP-LAB-0121', manufacturer: 'Whatman', tags: ['filter-paper', 'grade-42', '11cm', 'quantitative', 'ashless'], stock: 250 },
  { name: 'Filtre a seringue GHP 0.2 um 25 mm', slug: 'filtre-seringue-ghp-0-2um-25mm', shortDescription: 'Filtre seringue GHP hydrophile 0.2 um, 25 mm, lot de 100.', price: 52.00, sku: 'PP-LAB-0122', manufacturer: 'Pall', tags: ['syringe-filter', '0.2um', 'GHP', '25mm'], stock: 250 },
  { name: 'Filtre a seringue RC 0.2 um 15 mm', slug: 'filtre-seringue-rc-0-2um-15mm', shortDescription: 'Filtre seringue cellulose regeneree 0.2 um, 15 mm, lot de 100.', price: 45.00, sku: 'PP-LAB-0123', manufacturer: 'Sartorius', tags: ['syringe-filter', '0.2um', 'RC', '15mm'], stock: 300 },
  { name: 'Membranes de dialyse MWCO 10 kDa', slug: 'membranes-dialyse-mwco-10kda', shortDescription: 'Membranes de dialyse seuil 10 kDa, cellulose regeneree, 5 m.', price: 85.00, sku: 'PP-LAB-0124', manufacturer: 'Thermo Fisher', tags: ['dialysis-membrane', '10kDa', 'cellulose', 'MWCO'], stock: 150 },
  { name: 'Membranes de transfert PVDF pour Western Blot', slug: 'membranes-transfert-pvdf-western-blot', shortDescription: 'Membranes PVDF 0.45 um pour transfert Western Blot, 20x20 cm, lot de 10.', price: 95.00, sku: 'PP-LAB-0125', manufacturer: 'Millipore', tags: ['transfer-membrane', 'PVDF', 'western-blot', '0.45um'], stock: 200 },
];

// ----- 6. PIPETTES & DISPENSERS (20 products) -----
const pipettesDispensers: LabProduct[] = [
  { name: 'Pipette monocanal variable 0.5-10 uL', slug: 'pipette-monocanal-0-5-10ul', shortDescription: 'Pipette monocanal a volume variable 0.5-10 uL, ergonomique.', price: 285.00, sku: 'PP-LAB-0126', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', '0.5-10ul', 'variable'], stock: 150 },
  { name: 'Pipette monocanal variable 2-20 uL', slug: 'pipette-monocanal-2-20ul', shortDescription: 'Pipette monocanal a volume variable 2-20 uL, ergonomique.', price: 285.00, sku: 'PP-LAB-0127', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', '2-20ul', 'variable'], stock: 150 },
  { name: 'Pipette monocanal variable 10-100 uL', slug: 'pipette-monocanal-10-100ul', shortDescription: 'Pipette monocanal a volume variable 10-100 uL, ergonomique.', price: 285.00, sku: 'PP-LAB-0128', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', '10-100ul', 'variable'], stock: 150 },
  { name: 'Pipette monocanal variable 20-200 uL', slug: 'pipette-monocanal-20-200ul', shortDescription: 'Pipette monocanal a volume variable 20-200 uL, ergonomique.', price: 285.00, sku: 'PP-LAB-0129', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', '20-200ul', 'variable'], stock: 150 },
  { name: 'Pipette monocanal variable 100-1000 uL', slug: 'pipette-monocanal-100-1000ul', shortDescription: 'Pipette monocanal a volume variable 100-1000 uL, ergonomique.', price: 285.00, sku: 'PP-LAB-0130', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', '100-1000ul', 'variable'], stock: 150 },
  { name: 'Pipette monocanal variable 1-5 mL', slug: 'pipette-monocanal-1-5ml', shortDescription: 'Pipette monocanal a volume variable 1-5 mL macrovolume.', price: 320.00, sku: 'PP-LAB-0131', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', '1-5ml', 'variable'], stock: 100 },
  { name: 'Pipette monocanal variable 0.5-5 mL', slug: 'pipette-monocanal-0-5-5ml', shortDescription: 'Pipette monocanal a volume variable 0.5-5 mL, grande capacite.', price: 340.00, sku: 'PP-LAB-0132', manufacturer: 'Sartorius', tags: ['pipette', 'single-channel', '0.5-5ml', 'variable'], stock: 100 },
  { name: 'Kit de 3 pipettes monocanal starter', slug: 'kit-3-pipettes-monocanal-starter', shortDescription: 'Kit starter 3 pipettes: 2-20 uL, 20-200 uL, 100-1000 uL + carrousel.', price: 750.00, sku: 'PP-LAB-0133', manufacturer: 'Eppendorf', tags: ['pipette', 'single-channel', 'starter-kit', '3-pack'], stock: 100 },
  { name: 'Pipette multicanal 8 canaux 5-50 uL', slug: 'pipette-multicanal-8-canaux-5-50ul', shortDescription: 'Pipette multicanal 8 canaux, 5-50 uL, volume variable.', price: 580.00, sku: 'PP-LAB-0134', manufacturer: 'Thermo Fisher', tags: ['pipette', 'multichannel', '8-channel', '5-50ul'], stock: 100 },
  { name: 'Pipette multicanal 8 canaux 30-300 uL', slug: 'pipette-multicanal-8-canaux-30-300ul', shortDescription: 'Pipette multicanal 8 canaux, 30-300 uL, volume variable.', price: 580.00, sku: 'PP-LAB-0135', manufacturer: 'Thermo Fisher', tags: ['pipette', 'multichannel', '8-channel', '30-300ul'], stock: 100 },
  { name: 'Pipette multicanal 12 canaux 5-50 uL', slug: 'pipette-multicanal-12-canaux-5-50ul', shortDescription: 'Pipette multicanal 12 canaux, 5-50 uL, volume variable.', price: 680.00, sku: 'PP-LAB-0136', manufacturer: 'Thermo Fisher', tags: ['pipette', 'multichannel', '12-channel', '5-50ul'], stock: 100 },
  { name: 'Pipette multicanal 12 canaux 30-300 uL', slug: 'pipette-multicanal-12-canaux-30-300ul', shortDescription: 'Pipette multicanal 12 canaux, 30-300 uL, volume variable.', price: 680.00, sku: 'PP-LAB-0137', manufacturer: 'Thermo Fisher', tags: ['pipette', 'multichannel', '12-channel', '30-300ul'], stock: 100 },
  { name: 'Pipette electronique monocanal 0.5-10 uL', slug: 'pipette-electronique-monocanal-0-5-10ul', shortDescription: 'Pipette electronique monocanal 0.5-10 uL avec ecran LCD.', price: 950.00, sku: 'PP-LAB-0138', manufacturer: 'Eppendorf', tags: ['pipette', 'electronic', 'single-channel', '0.5-10ul'], stock: 100 },
  { name: 'Pipette electronique monocanal 50-1000 uL', slug: 'pipette-electronique-monocanal-50-1000ul', shortDescription: 'Pipette electronique monocanal 50-1000 uL avec ecran LCD.', price: 950.00, sku: 'PP-LAB-0139', manufacturer: 'Eppendorf', tags: ['pipette', 'electronic', 'single-channel', '50-1000ul'], stock: 100 },
  { name: 'Pipette electronique multicanal 8 ch 10-200 uL', slug: 'pipette-electronique-multicanal-8ch-10-200ul', shortDescription: 'Pipette electronique 8 canaux 10-200 uL, programmable.', price: 1650.00, sku: 'PP-LAB-0140', manufacturer: 'Eppendorf', tags: ['pipette', 'electronic', 'multichannel', '8-channel'], stock: 100 },
  { name: 'Distributeur de repetition Repeater M4', slug: 'distributeur-repetition-repeater-m4', shortDescription: 'Distributeur de repetition manuel, compatible pointes Combitips.', price: 420.00, sku: 'PP-LAB-0141', manufacturer: 'Eppendorf', tags: ['dispenser', 'repeater', 'manual'], stock: 100 },
  { name: 'Distributeur de repetition Repeater E3x electronique', slug: 'distributeur-repetition-repeater-e3x', shortDescription: 'Distributeur de repetition electronique avec ecran tactile.', price: 1250.00, sku: 'PP-LAB-0142', manufacturer: 'Eppendorf', tags: ['dispenser', 'repeater', 'electronic'], stock: 100 },
  { name: 'Carrousel de pipettes 6 places', slug: 'carrousel-pipettes-6-places', shortDescription: 'Support carrousel rotatif pour 6 pipettes, pied stable.', price: 85.00, sku: 'PP-LAB-0143', manufacturer: 'Eppendorf', tags: ['pipette-stand', 'carousel', '6-place'], stock: 200 },
  { name: 'Pipeteur electrique pour pipettes serologiques', slug: 'pipeteur-electrique-serologiques', shortDescription: 'Pipeteur electrique rechargeable pour pipettes 1-100 mL.', price: 220.00, sku: 'PP-LAB-0144', manufacturer: 'Corning', tags: ['pipette-controller', 'electric', 'serological'], stock: 150 },
  { name: 'Pipettes serologiques steriles 10 mL', slug: 'pipettes-serologiques-steriles-10ml', shortDescription: 'Pipettes serologiques 10 mL, steriles, emballage individuel, lot de 200.', price: 65.00, sku: 'PP-LAB-0145', manufacturer: 'Corning', tags: ['serological-pipette', '10ml', 'sterile', 'individually-wrapped'], stock: 300 },
];

// ----- 7. GLOVES & PROTECTION (20 products) -----
const glovesProtection: LabProduct[] = [
  { name: 'Gants nitrile bleu taille S boite 100', slug: 'gants-nitrile-bleu-s-100', shortDescription: 'Gants nitrile sans poudre, bleu, taille S, boite de 100.', price: 14.00, sku: 'PP-LAB-0146', manufacturer: 'Kimberly-Clark', tags: ['gloves', 'nitrile', 'blue', 'small', 'powder-free'], stock: 500 },
  { name: 'Gants nitrile bleu taille M boite 100', slug: 'gants-nitrile-bleu-m-100', shortDescription: 'Gants nitrile sans poudre, bleu, taille M, boite de 100.', price: 14.00, sku: 'PP-LAB-0147', manufacturer: 'Kimberly-Clark', tags: ['gloves', 'nitrile', 'blue', 'medium', 'powder-free'], stock: 500 },
  { name: 'Gants nitrile bleu taille L boite 100', slug: 'gants-nitrile-bleu-l-100', shortDescription: 'Gants nitrile sans poudre, bleu, taille L, boite de 100.', price: 14.00, sku: 'PP-LAB-0148', manufacturer: 'Kimberly-Clark', tags: ['gloves', 'nitrile', 'blue', 'large', 'powder-free'], stock: 500 },
  { name: 'Gants nitrile bleu taille XL boite 100', slug: 'gants-nitrile-bleu-xl-100', shortDescription: 'Gants nitrile sans poudre, bleu, taille XL, boite de 100.', price: 15.00, sku: 'PP-LAB-0149', manufacturer: 'Kimberly-Clark', tags: ['gloves', 'nitrile', 'blue', 'xlarge', 'powder-free'], stock: 400 },
  { name: 'Gants nitrile noir taille M boite 100', slug: 'gants-nitrile-noir-m-100', shortDescription: 'Gants nitrile sans poudre, noir, taille M, boite de 100.', price: 16.00, sku: 'PP-LAB-0150', manufacturer: 'Kimberly-Clark', tags: ['gloves', 'nitrile', 'black', 'medium', 'powder-free'], stock: 400 },
  { name: 'Gants nitrile noir taille L boite 100', slug: 'gants-nitrile-noir-l-100', shortDescription: 'Gants nitrile sans poudre, noir, taille L, boite de 100.', price: 16.00, sku: 'PP-LAB-0151', manufacturer: 'Kimberly-Clark', tags: ['gloves', 'nitrile', 'black', 'large', 'powder-free'], stock: 400 },
  { name: 'Gants latex naturel taille S boite 100', slug: 'gants-latex-naturel-s-100', shortDescription: 'Gants latex naturel, taille S, poudres, boite de 100.', price: 10.00, sku: 'PP-LAB-0152', manufacturer: 'Ansell', tags: ['gloves', 'latex', 'natural', 'small', 'powdered'], stock: 400 },
  { name: 'Gants latex naturel taille M boite 100', slug: 'gants-latex-naturel-m-100', shortDescription: 'Gants latex naturel, taille M, poudres, boite de 100.', price: 10.00, sku: 'PP-LAB-0153', manufacturer: 'Ansell', tags: ['gloves', 'latex', 'natural', 'medium', 'powdered'], stock: 450 },
  { name: 'Gants latex naturel taille L boite 100', slug: 'gants-latex-naturel-l-100', shortDescription: 'Gants latex naturel, taille L, poudres, boite de 100.', price: 10.00, sku: 'PP-LAB-0154', manufacturer: 'Ansell', tags: ['gloves', 'latex', 'natural', 'large', 'powdered'], stock: 450 },
  { name: 'Gants vinyl taille M boite 100', slug: 'gants-vinyl-m-100', shortDescription: 'Gants vinyl sans poudre, taille M, boite de 100.', price: 8.00, sku: 'PP-LAB-0155', manufacturer: 'Fisher Scientific', tags: ['gloves', 'vinyl', 'medium', 'powder-free'], stock: 500 },
  { name: 'Gants vinyl taille L boite 100', slug: 'gants-vinyl-l-100', shortDescription: 'Gants vinyl sans poudre, taille L, boite de 100.', price: 8.00, sku: 'PP-LAB-0156', manufacturer: 'Fisher Scientific', tags: ['gloves', 'vinyl', 'large', 'powder-free'], stock: 500 },
  { name: 'Gants nitrile haute resistance chimique M', slug: 'gants-nitrile-haute-resistance-chimique-m', shortDescription: 'Gants nitrile epais haute resistance chimique, taille M, boite de 50.', price: 24.00, sku: 'PP-LAB-0157', manufacturer: 'Ansell', tags: ['gloves', 'nitrile', 'chemical-resistant', 'medium', 'heavy-duty'], stock: 300 },
  { name: 'Gants nitrile haute resistance chimique L', slug: 'gants-nitrile-haute-resistance-chimique-l', shortDescription: 'Gants nitrile epais haute resistance chimique, taille L, boite de 50.', price: 24.00, sku: 'PP-LAB-0158', manufacturer: 'Ansell', tags: ['gloves', 'nitrile', 'chemical-resistant', 'large', 'heavy-duty'], stock: 300 },
  { name: 'Gants cryogeniques taille M', slug: 'gants-cryogeniques-m', shortDescription: 'Gants de protection cryogenique -196C, taille M, paire.', price: 65.00, sku: 'PP-LAB-0159', manufacturer: 'Thermo Fisher', tags: ['gloves', 'cryogenic', 'medium', '-196C', 'protection'], stock: 150 },
  { name: 'Gants cryogeniques taille L', slug: 'gants-cryogeniques-l', shortDescription: 'Gants de protection cryogenique -196C, taille L, paire.', price: 65.00, sku: 'PP-LAB-0160', manufacturer: 'Thermo Fisher', tags: ['gloves', 'cryogenic', 'large', '-196C', 'protection'], stock: 150 },
  { name: 'Lunettes de protection anti-eclaboussures', slug: 'lunettes-protection-anti-eclaboussures', shortDescription: 'Lunettes de securite anti-eclaboussures avec ventilation indirecte.', price: 12.00, sku: 'PP-LAB-0161', manufacturer: '3M', tags: ['safety-glasses', 'splash-proof', 'indirect-vent'], stock: 300 },
  { name: 'Ecran facial de protection integral', slug: 'ecran-facial-protection-integral', shortDescription: 'Ecran facial complet anti-projections, ajustable.', price: 22.00, sku: 'PP-LAB-0162', manufacturer: '3M', tags: ['face-shield', 'full-face', 'adjustable'], stock: 200 },
  { name: 'Blouse de laboratoire taille M', slug: 'blouse-laboratoire-m', shortDescription: 'Blouse de laboratoire jetable, polypropylene, taille M, lot de 10.', price: 28.00, sku: 'PP-LAB-0163', manufacturer: 'Kimberly-Clark', tags: ['lab-coat', 'disposable', 'medium', 'PP'], stock: 300 },
  { name: 'Blouse de laboratoire taille L', slug: 'blouse-laboratoire-l', shortDescription: 'Blouse de laboratoire jetable, polypropylene, taille L, lot de 10.', price: 28.00, sku: 'PP-LAB-0164', manufacturer: 'Kimberly-Clark', tags: ['lab-coat', 'disposable', 'large', 'PP'], stock: 300 },
  { name: 'Masque FFP2 de protection lot de 20', slug: 'masque-ffp2-protection-lot-20', shortDescription: 'Masques de protection respiratoire FFP2, lot de 20.', price: 18.00, sku: 'PP-LAB-0165', manufacturer: '3M', tags: ['mask', 'FFP2', 'respiratory-protection', '20-pack'], stock: 400 },
];

// ----- 8. WEIGHING & MEASUREMENT (20 products) -----
const weighingMeasurement: LabProduct[] = [
  { name: 'Balance analytique 0.1 mg / 220 g', slug: 'balance-analytique-0-1mg-220g', shortDescription: 'Balance analytique haute precision 0.1 mg, capacite 220 g, pare-brise.', price: 2850.00, sku: 'PP-LAB-0166', manufacturer: 'Sartorius', tags: ['balance', 'analytical', '0.1mg', '220g'], stock: 100 },
  { name: 'Balance analytique 0.01 mg / 120 g', slug: 'balance-analytique-0-01mg-120g', shortDescription: 'Balance semi-micro 0.01 mg, capacite 120 g, pare-brise integre.', price: 5200.00, sku: 'PP-LAB-0167', manufacturer: 'Sartorius', tags: ['balance', 'semi-micro', '0.01mg', '120g'], stock: 100 },
  { name: 'Balance de precision 0.01 g / 2200 g', slug: 'balance-precision-0-01g-2200g', shortDescription: 'Balance de precision 0.01 g, capacite 2200 g, plateau inox.', price: 850.00, sku: 'PP-LAB-0168', manufacturer: 'Sartorius', tags: ['balance', 'precision', '0.01g', '2200g'], stock: 150 },
  { name: 'Balance de precision 0.001 g / 620 g', slug: 'balance-precision-0-001g-620g', shortDescription: 'Balance de precision 0.001 g, capacite 620 g, calibration interne.', price: 1450.00, sku: 'PP-LAB-0169', manufacturer: 'Sartorius', tags: ['balance', 'precision', '0.001g', '620g'], stock: 100 },
  { name: 'Balance compacte portative 0.1 g / 5000 g', slug: 'balance-compacte-portative-0-1g-5000g', shortDescription: 'Balance compacte portative 0.1 g, capacite 5 kg, alimentee par piles.', price: 350.00, sku: 'PP-LAB-0170', manufacturer: 'Ohaus', tags: ['balance', 'portable', '0.1g', '5000g'], stock: 200 },
  { name: 'Jeu de poids de calibration E2 1 mg - 200 g', slug: 'jeu-poids-calibration-e2-1mg-200g', shortDescription: 'Jeu de poids de calibration classe E2, 1 mg a 200 g, coffret bois.', price: 680.00, sku: 'PP-LAB-0171', manufacturer: 'Sartorius', tags: ['calibration-weights', 'E2-class', '1mg-200g'], stock: 100 },
  { name: 'Jeu de poids de calibration M1 1 g - 1 kg', slug: 'jeu-poids-calibration-m1-1g-1kg', shortDescription: 'Jeu de poids de calibration classe M1, 1 g a 1 kg, coffret plastique.', price: 180.00, sku: 'PP-LAB-0172', manufacturer: 'Ohaus', tags: ['calibration-weights', 'M1-class', '1g-1kg'], stock: 200 },
  { name: 'Nacelles de pesee anti-statiques lot de 500', slug: 'nacelles-pesee-anti-statiques-500', shortDescription: 'Nacelles de pesee en polystyrene anti-statique, diamant, lot de 500.', price: 45.00, sku: 'PP-LAB-0173', manufacturer: 'Fisher Scientific', tags: ['weighing-boat', 'anti-static', '500-pack', 'diamond'], stock: 350 },
  { name: 'Nacelles de pesee hexagonales lot de 500', slug: 'nacelles-pesee-hexagonales-500', shortDescription: 'Nacelles de pesee hexagonales en polystyrene blanc, lot de 500.', price: 38.00, sku: 'PP-LAB-0174', manufacturer: 'Fisher Scientific', tags: ['weighing-boat', 'hexagonal', '500-pack', 'white'], stock: 350 },
  { name: 'Papier de pesee non absorbant lot de 500', slug: 'papier-pesee-non-absorbant-500', shortDescription: 'Papier de pesee glace non absorbant 7.5x7.5 cm, lot de 500.', price: 15.00, sku: 'PP-LAB-0175', manufacturer: 'Fisher Scientific', tags: ['weighing-paper', 'non-absorbent', '500-pack'], stock: 400 },
  { name: 'Spatule de pesee micro en inox', slug: 'spatule-pesee-micro-inox', shortDescription: 'Spatule de pesee micro double extremite en acier inoxydable, 150 mm.', price: 12.00, sku: 'PP-LAB-0176', manufacturer: 'Fisher Scientific', tags: ['spatula', 'micro', 'stainless-steel', '150mm'], stock: 400 },
  { name: 'Spatule de pesee cuillere en inox', slug: 'spatule-pesee-cuillere-inox', shortDescription: 'Spatule-cuillere double extremite en acier inoxydable, 210 mm.', price: 14.00, sku: 'PP-LAB-0177', manufacturer: 'Fisher Scientific', tags: ['spatula', 'spoon', 'stainless-steel', '210mm'], stock: 350 },
  { name: 'Thermometre digital de laboratoire -50 a 300C', slug: 'thermometre-digital-laboratoire-50-300c', shortDescription: 'Thermometre digital a sonde inox, plage -50 a +300C, precision 0.5C.', price: 45.00, sku: 'PP-LAB-0178', manufacturer: 'Thermo Fisher', tags: ['thermometer', 'digital', '-50-300C', 'probe'], stock: 250 },
  { name: 'Thermometre infrarouge sans contact', slug: 'thermometre-infrarouge-sans-contact', shortDescription: 'Thermometre infrarouge sans contact -32 a +400C, laser de visee.', price: 85.00, sku: 'PP-LAB-0179', manufacturer: 'Fluke', tags: ['thermometer', 'infrared', 'non-contact', '-32-400C'], stock: 200 },
  { name: 'Chronometre digital de laboratoire', slug: 'chronometre-digital-laboratoire', shortDescription: 'Chronometre/minuteur digital de labo, 4 canaux, memoire 99h.', price: 28.00, sku: 'PP-LAB-0180', manufacturer: 'Fisher Scientific', tags: ['timer', 'digital', '4-channel', 'stopwatch'], stock: 300 },
  { name: 'Eprouvette graduee 100 mL classe A', slug: 'eprouvette-graduee-100ml-classe-a', shortDescription: 'Eprouvette graduee en verre 100 mL, classe A, pied hexagonal.', price: 18.00, sku: 'PP-LAB-0181', manufacturer: 'Pyrex', tags: ['graduated-cylinder', '100ml', 'class-A', 'glass'], stock: 300 },
  { name: 'Eprouvette graduee 250 mL classe A', slug: 'eprouvette-graduee-250ml-classe-a', shortDescription: 'Eprouvette graduee en verre 250 mL, classe A, pied hexagonal.', price: 24.00, sku: 'PP-LAB-0182', manufacturer: 'Pyrex', tags: ['graduated-cylinder', '250ml', 'class-A', 'glass'], stock: 250 },
  { name: 'Eprouvette graduee 500 mL classe A', slug: 'eprouvette-graduee-500ml-classe-a', shortDescription: 'Eprouvette graduee en verre 500 mL, classe A, pied hexagonal.', price: 32.00, sku: 'PP-LAB-0183', manufacturer: 'Pyrex', tags: ['graduated-cylinder', '500ml', 'class-A', 'glass'], stock: 200 },
  { name: 'Eprouvette graduee 1000 mL classe A', slug: 'eprouvette-graduee-1000ml-classe-a', shortDescription: 'Eprouvette graduee en verre 1000 mL, classe A, pied hexagonal.', price: 42.00, sku: 'PP-LAB-0184', manufacturer: 'Pyrex', tags: ['graduated-cylinder', '1000ml', 'class-A', 'glass'], stock: 150 },
  { name: 'Densimetre de precision 0.700-1.000', slug: 'densimetre-precision-0-700-1-000', shortDescription: 'Densimetre/hydrometrique de precision, plage 0.700-1.000, verre.', price: 55.00, sku: 'PP-LAB-0185', manufacturer: 'Fisher Scientific', tags: ['hydrometer', 'precision', '0.700-1.000', 'glass'], stock: 150 },
];

// ----- 9. STORAGE & CONTAINERS (20 products) -----
const storageContainers: LabProduct[] = [
  { name: 'Cryoboite 81 places pour tubes 1-2 mL', slug: 'cryoboite-81-places-tubes-1-2ml', shortDescription: 'Cryoboite en polycarbonate 81 places, grille 9x9, pour tubes 1-2 mL.', price: 18.00, sku: 'PP-LAB-0186', manufacturer: 'Thermo Fisher', tags: ['cryobox', '81-place', '1-2ml', 'polycarbonate'], stock: 300 },
  { name: 'Cryoboite 100 places pour tubes 1-2 mL', slug: 'cryoboite-100-places-tubes-1-2ml', shortDescription: 'Cryoboite en carton 100 places, grille 10x10, pour tubes 1-2 mL.', price: 6.00, sku: 'PP-LAB-0187', manufacturer: 'Fisher Scientific', tags: ['cryobox', '100-place', '1-2ml', 'cardboard'], stock: 500 },
  { name: 'Cryoboite 25 places pour tubes 5 mL', slug: 'cryoboite-25-places-tubes-5ml', shortDescription: 'Cryoboite en polycarbonate 25 places pour tubes 5 mL.', price: 15.00, sku: 'PP-LAB-0188', manufacturer: 'Thermo Fisher', tags: ['cryobox', '25-place', '5ml', 'polycarbonate'], stock: 250 },
  { name: 'Rack de congelation 4x6 pour microplaques', slug: 'rack-congelation-4x6-microplaques', shortDescription: 'Rack de congelation en acier inox pour 24 microplaques.', price: 120.00, sku: 'PP-LAB-0189', manufacturer: 'Thermo Fisher', tags: ['freezer-rack', '4x6', 'microplate', 'stainless-steel'], stock: 100 },
  { name: 'Rack de congelation 5x5 pour cryoboites', slug: 'rack-congelation-5x5-cryoboites', shortDescription: 'Rack de congelation en acier inox pour 25 cryoboites.', price: 95.00, sku: 'PP-LAB-0190', manufacturer: 'Thermo Fisher', tags: ['freezer-rack', '5x5', 'cryobox', 'stainless-steel'], stock: 100 },
  { name: 'Bouteille de stockage en verre 100 mL', slug: 'bouteille-stockage-verre-100ml', shortDescription: 'Bouteille de stockage en verre borosilicate 100 mL, bouchon a vis GL45.', price: 8.00, sku: 'PP-LAB-0191', manufacturer: 'Pyrex', tags: ['bottle', '100ml', 'glass', 'GL45', 'storage'], stock: 350 },
  { name: 'Bouteille de stockage en verre 250 mL', slug: 'bouteille-stockage-verre-250ml', shortDescription: 'Bouteille de stockage en verre borosilicate 250 mL, bouchon a vis GL45.', price: 10.00, sku: 'PP-LAB-0192', manufacturer: 'Pyrex', tags: ['bottle', '250ml', 'glass', 'GL45', 'storage'], stock: 350 },
  { name: 'Bouteille de stockage en verre 500 mL', slug: 'bouteille-stockage-verre-500ml', shortDescription: 'Bouteille de stockage en verre borosilicate 500 mL, bouchon a vis GL45.', price: 12.00, sku: 'PP-LAB-0193', manufacturer: 'Pyrex', tags: ['bottle', '500ml', 'glass', 'GL45', 'storage'], stock: 300 },
  { name: 'Bouteille de stockage en verre 1000 mL', slug: 'bouteille-stockage-verre-1000ml', shortDescription: 'Bouteille de stockage en verre borosilicate 1000 mL, bouchon a vis GL45.', price: 15.00, sku: 'PP-LAB-0194', manufacturer: 'Pyrex', tags: ['bottle', '1000ml', 'glass', 'GL45', 'storage'], stock: 300 },
  { name: 'Bouteille de stockage en verre 2000 mL', slug: 'bouteille-stockage-verre-2000ml', shortDescription: 'Bouteille de stockage en verre borosilicate 2000 mL, bouchon a vis GL45.', price: 22.00, sku: 'PP-LAB-0195', manufacturer: 'Pyrex', tags: ['bottle', '2000ml', 'glass', 'GL45', 'storage'], stock: 200 },
  { name: 'Flacon de stockage en plastique HDPE 500 mL', slug: 'flacon-stockage-plastique-hdpe-500ml', shortDescription: 'Flacon a col large en HDPE 500 mL, resistant aux produits chimiques.', price: 5.00, sku: 'PP-LAB-0196', manufacturer: 'Thermo Fisher', tags: ['bottle', '500ml', 'HDPE', 'wide-mouth', 'chemical-resistant'], stock: 400 },
  { name: 'Flacon de stockage en plastique HDPE 1000 mL', slug: 'flacon-stockage-plastique-hdpe-1000ml', shortDescription: 'Flacon a col large en HDPE 1000 mL, resistant aux produits chimiques.', price: 7.00, sku: 'PP-LAB-0197', manufacturer: 'Thermo Fisher', tags: ['bottle', '1000ml', 'HDPE', 'wide-mouth', 'chemical-resistant'], stock: 350 },
  { name: 'Pissette en plastique 500 mL eau distillee', slug: 'pissette-plastique-500ml-eau-distillee', shortDescription: 'Pissette en plastique LDPE 500 mL, etiquette eau distillee.', price: 5.50, sku: 'PP-LAB-0198', manufacturer: 'Fisher Scientific', tags: ['wash-bottle', '500ml', 'LDPE', 'distilled-water'], stock: 400 },
  { name: 'Pissette en plastique 500 mL ethanol', slug: 'pissette-plastique-500ml-ethanol', shortDescription: 'Pissette en plastique LDPE 500 mL, etiquette ethanol.', price: 5.50, sku: 'PP-LAB-0199', manufacturer: 'Fisher Scientific', tags: ['wash-bottle', '500ml', 'LDPE', 'ethanol'], stock: 400 },
  { name: 'Pissette en plastique 500 mL acetone', slug: 'pissette-plastique-500ml-acetone', shortDescription: 'Pissette en plastique LDPE 500 mL, etiquette acetone.', price: 5.50, sku: 'PP-LAB-0200', manufacturer: 'Fisher Scientific', tags: ['wash-bottle', '500ml', 'LDPE', 'acetone'], stock: 400 },
  { name: 'Boite de rangement pour lames de microscope 50 places', slug: 'boite-rangement-lames-microscope-50-places', shortDescription: 'Boite de rangement ABS pour 50 lames de microscope.', price: 12.00, sku: 'PP-LAB-0201', manufacturer: 'Fisher Scientific', tags: ['storage-box', 'microscope-slides', '50-place', 'ABS'], stock: 250 },
  { name: 'Boite de rangement pour lames de microscope 100 places', slug: 'boite-rangement-lames-microscope-100-places', shortDescription: 'Boite de rangement ABS pour 100 lames de microscope.', price: 18.00, sku: 'PP-LAB-0202', manufacturer: 'Fisher Scientific', tags: ['storage-box', 'microscope-slides', '100-place', 'ABS'], stock: 200 },
  { name: 'Conteneur a dechets tranchants 1 L', slug: 'conteneur-dechets-tranchants-1l', shortDescription: 'Conteneur a dechets tranchants/piquants 1 L, jaune, unitaire.', price: 4.50, sku: 'PP-LAB-0203', manufacturer: 'Fisher Scientific', tags: ['sharps-container', '1L', 'yellow', 'waste'], stock: 500 },
  { name: 'Conteneur a dechets tranchants 5 L', slug: 'conteneur-dechets-tranchants-5l', shortDescription: 'Conteneur a dechets tranchants/piquants 5 L, jaune, unitaire.', price: 9.00, sku: 'PP-LAB-0204', manufacturer: 'Fisher Scientific', tags: ['sharps-container', '5L', 'yellow', 'waste'], stock: 400 },
  { name: 'Parafilm M rouleau 10 cm x 38 m', slug: 'parafilm-m-rouleau-10cm-38m', shortDescription: 'Film de scellement Parafilm M, rouleau 10 cm x 38 m.', price: 35.00, sku: 'PP-LAB-0205', manufacturer: 'Bemis', tags: ['parafilm', 'sealing-film', '10cm', '38m'], stock: 300 },
];

// ----- 10. HEAVY EQUIPMENT (23 products) -----
const heavyEquipment: LabProduct[] = [
  { name: 'Lyophilisateur de paillasse 2.5 L', slug: 'lyophilisateur-paillasse-2-5l', shortDescription: 'Lyophilisateur (freeze-dryer) de paillasse, capacite 2.5 L, -55C.', price: 8500.00, sku: 'PP-LAB-0206', manufacturer: 'Labconco', tags: ['lyophilizer', 'freeze-dryer', '2.5L', 'benchtop', '-55C'], stock: 100 },
  { name: 'Lyophilisateur de paillasse 6 L', slug: 'lyophilisateur-paillasse-6l', shortDescription: 'Lyophilisateur (freeze-dryer) de paillasse, capacite 6 L, -84C.', price: 14500.00, sku: 'PP-LAB-0207', manufacturer: 'Labconco', tags: ['lyophilizer', 'freeze-dryer', '6L', 'benchtop', '-84C'], stock: 100 },
  { name: 'Autoclave vertical 50 L', slug: 'autoclave-vertical-50l', shortDescription: 'Autoclave vertical 50 L, 121-134C, programme automatique.', price: 4200.00, sku: 'PP-LAB-0208', manufacturer: 'Tuttnauer', tags: ['autoclave', 'vertical', '50L', '121-134C', 'automatic'], stock: 100 },
  { name: 'Autoclave de paillasse 23 L', slug: 'autoclave-paillasse-23l', shortDescription: 'Autoclave de paillasse 23 L, cycle rapide 20 min, ecran digital.', price: 2800.00, sku: 'PP-LAB-0209', manufacturer: 'Tuttnauer', tags: ['autoclave', 'benchtop', '23L', 'rapid-cycle'], stock: 100 },
  { name: 'Centrifugeuse de paillasse refrigeree 24x1.5 mL', slug: 'centrifugeuse-paillasse-refrigeree-24x1-5ml', shortDescription: 'Microcentrifugeuse refrigeree, 24 places 1.5 mL, 21000 g, -10 a +40C.', price: 5800.00, sku: 'PP-LAB-0210', manufacturer: 'Eppendorf', tags: ['centrifuge', 'refrigerated', 'microcentrifuge', '21000g', '24-place'], stock: 100 },
  { name: 'Centrifugeuse de paillasse 12x15 mL + 4x50 mL', slug: 'centrifugeuse-paillasse-12x15ml-4x50ml', shortDescription: 'Centrifugeuse de paillasse multi-rotors, 4700 g, pour tubes 15 et 50 mL.', price: 2200.00, sku: 'PP-LAB-0211', manufacturer: 'Eppendorf', tags: ['centrifuge', 'benchtop', 'multi-rotor', '4700g'], stock: 100 },
  { name: 'Centrifugeuse grande vitesse 6x250 mL', slug: 'centrifugeuse-grande-vitesse-6x250ml', shortDescription: 'Centrifugeuse grande vitesse refrigeree, 6 x 250 mL, 25000 g.', price: 9500.00, sku: 'PP-LAB-0212', manufacturer: 'Thermo Fisher', tags: ['centrifuge', 'high-speed', 'refrigerated', '25000g', '6x250ml'], stock: 100 },
  { name: 'Spectrophotometre UV-Vis de paillasse', slug: 'spectrophotometre-uv-vis-paillasse', shortDescription: 'Spectrophotometre UV-Vis double faisceau, 190-1100 nm, bande passante 2 nm.', price: 7200.00, sku: 'PP-LAB-0213', manufacturer: 'Thermo Fisher', tags: ['spectrophotometer', 'UV-Vis', 'double-beam', '190-1100nm'], stock: 100 },
  { name: 'Spectrophotometre micro-volume NanoDrop', slug: 'spectrophotometre-micro-volume-nanodrop', shortDescription: 'Spectrophotometre micro-volume type NanoDrop, 0.5-2 uL, ecran tactile.', price: 8500.00, sku: 'PP-LAB-0214', manufacturer: 'Thermo Fisher', tags: ['spectrophotometer', 'nanodrop', 'micro-volume', 'touchscreen'], stock: 100 },
  { name: 'pH-metre de paillasse avec electrode', slug: 'ph-metre-paillasse-electrode', shortDescription: 'pH-metre de paillasse, precision 0.01, electrode incluse, calibration auto.', price: 450.00, sku: 'PP-LAB-0215', manufacturer: 'Mettler Toledo', tags: ['pH-meter', 'benchtop', '0.01-precision', 'auto-calibration'], stock: 150 },
  { name: 'pH-metre portable de terrain', slug: 'ph-metre-portable-terrain', shortDescription: 'pH-metre portable etanche IP67, electrode remplacable, memoire 500 pts.', price: 280.00, sku: 'PP-LAB-0216', manufacturer: 'Hanna Instruments', tags: ['pH-meter', 'portable', 'IP67', 'waterproof'], stock: 150 },
  { name: 'Agitateur magnetique chauffant', slug: 'agitateur-magnetique-chauffant', shortDescription: 'Agitateur magnetique chauffant, plaque ceramique, 0-1500 rpm, 0-340C.', price: 450.00, sku: 'PP-LAB-0217', manufacturer: 'IKA', tags: ['magnetic-stirrer', 'hotplate', 'ceramic', '1500rpm', '340C'], stock: 200 },
  { name: 'Agitateur vortex variable', slug: 'agitateur-vortex-variable', shortDescription: 'Agitateur vortex a vitesse variable, 0-3000 rpm, mode continu et touch.', price: 220.00, sku: 'PP-LAB-0218', manufacturer: 'IKA', tags: ['vortex-mixer', 'variable-speed', '3000rpm'], stock: 200 },
  { name: 'Bain-marie thermostate 6 L', slug: 'bain-marie-thermostate-6l', shortDescription: 'Bain-marie thermostate 6 L, plage ambiante a 100C, precision 0.2C.', price: 380.00, sku: 'PP-LAB-0219', manufacturer: 'Thermo Fisher', tags: ['water-bath', '6L', 'thermostat', 'ambient-100C'], stock: 150 },
  { name: 'Bain-marie thermostate 12 L', slug: 'bain-marie-thermostate-12l', shortDescription: 'Bain-marie thermostate 12 L, plage ambiante a 100C, couvercle inclus.', price: 520.00, sku: 'PP-LAB-0220', manufacturer: 'Thermo Fisher', tags: ['water-bath', '12L', 'thermostat', 'with-lid'], stock: 150 },
  { name: 'Incubateur microbiologique 53 L', slug: 'incubateur-microbiologique-53l', shortDescription: 'Incubateur microbiologique 53 L, convection naturelle, 5-70C.', price: 1800.00, sku: 'PP-LAB-0221', manufacturer: 'Thermo Fisher', tags: ['incubator', 'microbiological', '53L', '5-70C', 'natural-convection'], stock: 100 },
  { name: 'Incubateur a CO2 170 L', slug: 'incubateur-co2-170l', shortDescription: 'Incubateur a CO2 170 L, 0-20% CO2, contamination control, HEPA.', price: 8500.00, sku: 'PP-LAB-0222', manufacturer: 'Thermo Fisher', tags: ['incubator', 'CO2', '170L', 'HEPA', 'cell-culture'], stock: 100 },
  { name: 'Hotte a flux laminaire verticale 1.2 m', slug: 'hotte-flux-laminaire-verticale-1-2m', shortDescription: 'Hotte a flux laminaire vertical classe II type A2, 1.2 m, filtre HEPA.', price: 6500.00, sku: 'PP-LAB-0223', manufacturer: 'Thermo Fisher', tags: ['biosafety-cabinet', 'class-II', 'type-A2', '1.2m', 'HEPA'], stock: 100 },
  { name: 'Congelateur -80C vertical 490 L', slug: 'congelateur-moins-80c-vertical-490l', shortDescription: 'Congelateur ultra-basse temperature -80C, 490 L, alarme integree.', price: 9800.00, sku: 'PP-LAB-0224', manufacturer: 'Thermo Fisher', tags: ['freezer', '-80C', '490L', 'vertical', 'ultra-low'], stock: 100 },
  { name: 'Congelateur -20C de laboratoire 360 L', slug: 'congelateur-moins-20c-laboratoire-360l', shortDescription: 'Congelateur de laboratoire -20C, 360 L, degivrage auto, alarme.', price: 2200.00, sku: 'PP-LAB-0225', manufacturer: 'Thermo Fisher', tags: ['freezer', '-20C', '360L', 'auto-defrost'], stock: 100 },
  { name: 'Thermocycleur PCR 96 puits', slug: 'thermocycleur-pcr-96-puits', shortDescription: 'Thermocycleur PCR 96 puits, gradient, couvercle chauffant, ecran tactile.', price: 4500.00, sku: 'PP-LAB-0226', manufacturer: 'Bio-Rad', tags: ['thermocycler', 'PCR', '96-well', 'gradient', 'touchscreen'], stock: 100 },
  { name: 'Systeme electrophorese SDS-PAGE Mini', slug: 'systeme-electrophorese-sds-page-mini', shortDescription: 'Systeme electrophorese mini-gel SDS-PAGE complet, cuve + alimentation.', price: 850.00, sku: 'PP-LAB-0227', manufacturer: 'Bio-Rad', tags: ['electrophoresis', 'SDS-PAGE', 'mini-gel', 'complete-system'], stock: 100 },
  { name: 'Bain ultrasonique de nettoyage 2.8 L', slug: 'bain-ultrasonique-nettoyage-2-8l', shortDescription: 'Bain ultrasonique de nettoyage 2.8 L, 40 kHz, minuteur digital, chauffant.', price: 320.00, sku: 'PP-LAB-0228', manufacturer: 'Fisher Scientific', tags: ['ultrasonic-bath', '2.8L', '40kHz', 'digital-timer', 'heated'], stock: 150 },
];


// =====================================================
// MAIN SEED FUNCTION
// =====================================================
async function main() {
  console.log('=== Seed Lab Products: Start ===');

  // ----- Use existing parent categories: Equipment and Accessories (under Laboratory Equipment) -----
  console.log('Looking up existing Equipment and Accessories categories...');

  const equipmentCategory = await prisma.category.upsert({
    where: { slug: 'lab-equipment' },
    update: {},
    create: {
      name: 'Equipment',
      slug: 'lab-equipment',
      description: 'Verrerie, instruments de mesure et equipements lourds de laboratoire.',
      imageUrl: '/images/categories/lab-equipment.jpg',
      sortOrder: 1,
      isActive: true,
    },
  });
  console.log(`  Equipment category found/created: ${equipmentCategory.id}`);

  const accessoriesCategory = await prisma.category.upsert({
    where: { slug: 'lab-accessories' },
    update: {},
    create: {
      name: 'Accessories',
      slug: 'lab-accessories',
      description: 'Consommables et accessoires de laboratoire: pointes, tubes, filtres, gants, pipettes.',
      imageUrl: '/images/categories/lab-accessories.jpg',
      sortOrder: 2,
      isActive: true,
    },
  });
  console.log(`  Accessories category found/created: ${accessoriesCategory.id}`);

  // ----- 10 subcategories split between Equipment and Accessories -----
  console.log('Creating 10 subcategories...');

  // Subcategories under ACCESSORIES (consumables + pipettes)
  const accessoriesSubcats = [
    { name: 'Pointes de Pipette', slug: 'pointes-pipette', description: 'Pointes de pipette universelles, filtrees, steriles et basse retention.', sortOrder: 1 },
    { name: 'Boites de Petri', slug: 'boites-petri', description: 'Boites de Petri en plastique et verre, compartimentees, pour culture cellulaire.', sortOrder: 2 },
    { name: 'Tubes a Essai', slug: 'tubes-essai', description: 'Tubes a essai, microtubes, tubes Falcon, PCR, cryogeniques et de prelevement.', sortOrder: 3 },
    { name: 'Filtres & Membranes', slug: 'filtres-membranes', description: 'Filtres seringue, membranes, papier filtre, unites de filtration sous vide.', sortOrder: 4 },
    { name: 'Pipettes & Dispenseurs', slug: 'pipettes-dispenseurs', description: 'Pipettes monocanal et multicanal, electroniques, dispenseurs de repetition.', sortOrder: 5 },
    { name: 'Gants & Protection', slug: 'gants-protection', description: 'Gants nitrile, latex, vinyl, gants cryogeniques, lunettes, blouses de labo.', sortOrder: 6 },
    { name: 'Stockage & Conteneurs', slug: 'stockage-conteneurs', description: 'Cryoboites, bouteilles de stockage, pissettes, conteneurs a dechets.', sortOrder: 7 },
  ];

  // Subcategories under EQUIPMENT (instruments + heavy)
  const equipmentSubcats = [
    { name: 'Bechers & Fioles', slug: 'bechers-fioles', description: 'Bechers, Erlenmeyers, fioles jaugees et a fond plat/rond en verre et plastique.', sortOrder: 1 },
    { name: 'Pesee & Mesure', slug: 'pesee-mesure', description: 'Balances analytiques et de precision, poids de calibration, eprouvettes.', sortOrder: 2 },
    { name: 'Equipement Lourd', slug: 'equipement-lourd', description: 'Lyophilisateurs, autoclaves, centrifugeuses, spectrophotometres, pH-metres, incubateurs.', sortOrder: 3 },
  ];

  const subcategories: Record<string, { id: string }> = {};

  for (const sc of accessoriesSubcats) {
    const cat = await prisma.category.upsert({
      where: { slug: sc.slug },
      update: { parentId: accessoriesCategory.id },
      create: {
        name: sc.name,
        slug: sc.slug,
        description: sc.description,
        imageUrl: `/images/categories/${sc.slug}.jpg`,
        sortOrder: sc.sortOrder,
        isActive: true,
        parentId: accessoriesCategory.id,
      },
    });
    subcategories[sc.slug] = cat;
    console.log(`  [Accessories] Subcategory: ${sc.name} (${cat.id})`);
  }

  for (const sc of equipmentSubcats) {
    const cat = await prisma.category.upsert({
      where: { slug: sc.slug },
      update: { parentId: equipmentCategory.id },
      create: {
        name: sc.name,
        slug: sc.slug,
        description: sc.description,
        imageUrl: `/images/categories/${sc.slug}.jpg`,
        sortOrder: sc.sortOrder,
        isActive: true,
        parentId: equipmentCategory.id,
      },
    });
    subcategories[sc.slug] = cat;
    console.log(`  [Equipment] Subcategory: ${sc.name} (${cat.id})`);
  }

  // ----- Create all products per category -----
  const categoryProductMap: { slug: string; products: LabProduct[] }[] = [
    { slug: 'pointes-pipette', products: pipetteTips },
    { slug: 'boites-petri', products: petriDishes },
    { slug: 'bechers-fioles', products: beakersFlasks },
    { slug: 'tubes-essai', products: testTubes },
    { slug: 'filtres-membranes', products: filtersMembranes },
    { slug: 'pipettes-dispenseurs', products: pipettesDispensers },
    { slug: 'gants-protection', products: glovesProtection },
    { slug: 'pesee-mesure', products: weighingMeasurement },
    { slug: 'stockage-conteneurs', products: storageContainers },
    { slug: 'equipement-lourd', products: heavyEquipment },
  ];

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const { slug, products } of categoryProductMap) {
    const categoryId = subcategories[slug].id;
    console.log(`\nSeeding ${products.length} products in "${slug}"...`);

    for (const p of products) {
      const existing = await prisma.product.findUnique({ where: { slug: p.slug } });

      const productData = {
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        productType: ProductType.LAB_SUPPLY,
        price: p.price,
        imageUrl: `/images/products/lab/${p.slug}.jpg`,
        categoryId,
        sku: p.sku,
        manufacturer: p.manufacturer,
        tags: JSON.stringify(p.tags),
        isActive: true,
        isFeatured: false,
        isNew: false,
        isBestseller: false,
        requiresShipping: true,
      };

      if (existing) {
        await prisma.product.update({
          where: { slug: p.slug },
          data: productData,
        });
        totalUpdated++;
      } else {
        const created = await prisma.product.create({ data: productData });

        // Create default ProductFormat for the new product
        await createLabFormat(created.id, p.sku, p.price, p.stock);
        totalCreated++;
      }
    }
  }

  console.log(`\n=== Seed Lab Products: Complete ===`);
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Total: ${totalCreated + totalUpdated}`);

  // Verify counts
  const labCount = await prisma.product.count({ where: { productType: ProductType.LAB_SUPPLY } });
  const formatCount = await prisma.productFormat.count();
  const accCatCount = await prisma.category.count({ where: { parentId: accessoriesCategory.id } });
  const eqCatCount = await prisma.category.count({ where: { parentId: equipmentCategory.id } });
  console.log(`  LAB_SUPPLY products in DB: ${labCount}`);
  console.log(`  Total ProductFormats in DB: ${formatCount}`);
  console.log(`  Subcategories under Accessories: ${accCatCount}`);
  console.log(`  Subcategories under Equipment: ${eqCatCount}`);
}

main()
  .catch((e) => {
    console.error('Seed Lab Products ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

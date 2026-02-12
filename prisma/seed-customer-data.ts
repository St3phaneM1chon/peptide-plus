/**
 * Seed Customer Data
 * Test customers, orders, invoices, subscriptions, loyalty transactions
 * For testing the customer dashboard pages
 */

import { PrismaClient, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: generate order number
function orderNumber(index: number): string {
  return `PP-2026-${String(index).padStart(6, '0')}`;
}

// Helper: generate invoice number
function invoiceNumber(index: number): string {
  return `FACT-2026-${String(index).padStart(4, '0')}`;
}

// Helper: date relative to now
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function seedCustomerData() {
  console.log('👥 Création des clients de test...');

  // =====================================================
  // CLEANUP PREVIOUS TEST DATA
  // =====================================================
  console.log('🗑️ Nettoyage des données client précédentes...');

  // Delete by test order numbers first (handles orphans from prior runs)
  const testOrderNumbers = Array.from({ length: 10 }, (_, i) => orderNumber(i + 1));
  const testInvoiceNumbers = Array.from({ length: 10 }, (_, i) => invoiceNumber(i + 1));

  // Clean up invoices by number
  await prisma.customerInvoiceItem.deleteMany({
    where: { invoice: { invoiceNumber: { in: testInvoiceNumbers } } },
  });
  await prisma.customerInvoice.deleteMany({
    where: { invoiceNumber: { in: testInvoiceNumbers } },
  });

  // Clean up orders by number
  await prisma.orderItem.deleteMany({
    where: { order: { orderNumber: { in: testOrderNumbers } } },
  });
  await prisma.order.deleteMany({
    where: { orderNumber: { in: testOrderNumbers } },
  });

  // Clean up user-linked data
  const testEmails = ['jean.dupont@test.com', 'sarah.smith@test.com', 'marc.leblanc@test.com'];
  const testUsers = await prisma.user.findMany({ where: { email: { in: testEmails } }, select: { id: true } });
  const testUserIds = testUsers.map(u => u.id);

  if (testUserIds.length > 0) {
    await prisma.loyaltyTransaction.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.subscription.deleteMany({ where: { userId: { in: testUserIds } } });
    await prisma.userAddress.deleteMany({ where: { userId: { in: testUserIds } } });
  }

  // =====================================================
  // TEST CUSTOMERS
  // =====================================================
  const customer1 = await prisma.user.upsert({
    where: { email: 'jean.dupont@test.com' },
    update: {},
    create: {
      email: 'jean.dupont@test.com',
      name: 'Jean Dupont',
      role: 'CUSTOMER',
      emailVerified: new Date(),
      locale: 'fr',
      phone: '+1-514-555-0101',
      loyaltyPoints: 1250,
      lifetimePoints: 2800,
      loyaltyTier: 'GOLD',
      referralCode: 'JEAN2026',
    },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'sarah.smith@test.com' },
    update: {},
    create: {
      email: 'sarah.smith@test.com',
      name: 'Sarah Smith',
      role: 'CUSTOMER',
      emailVerified: new Date(),
      locale: 'en',
      phone: '+1-416-555-0202',
      loyaltyPoints: 450,
      lifetimePoints: 900,
      loyaltyTier: 'SILVER',
      referralCode: 'SARAH2026',
    },
  });

  const customer3 = await prisma.user.upsert({
    where: { email: 'marc.leblanc@test.com' },
    update: {},
    create: {
      email: 'marc.leblanc@test.com',
      name: 'Marc Leblanc',
      role: 'CUSTOMER',
      emailVerified: new Date(),
      locale: 'fr',
      phone: '+1-438-555-0303',
      loyaltyPoints: 50,
      lifetimePoints: 50,
      loyaltyTier: 'BRONZE',
      referralCode: 'MARC2026',
    },
  });

  // =====================================================
  // LOOKUP PRODUCTS & FORMATS
  // =====================================================
  console.log('🔍 Recherche des produits existants...');

  const products = await prisma.product.findMany({
    include: { formats: true, category: true },
  });

  const productMap = new Map(products.map(p => [p.slug, p]));

  // Helper to get product + default format
  function getProduct(slug: string) {
    const p = productMap.get(slug);
    if (!p) throw new Error(`Product not found: ${slug}`);
    const defaultFormat = p.formats.find(f => f.isDefault) || p.formats[0];
    return { product: p, format: defaultFormat };
  }

  // Get CAD currency
  const cadCurrency = await prisma.currency.findUnique({ where: { code: 'CAD' } });
  if (!cadCurrency) throw new Error('CAD currency not found');

  // =====================================================
  // ORDERS FOR CUSTOMER 1 (Jean Dupont - frequent buyer)
  // =====================================================
  console.log('📦 Création des commandes - Jean Dupont...');

  const { product: bpc, format: bpcFormat } = getProduct('bpc-157');
  const { product: tb500, format: tb500Format } = getProduct('tb-500');
  const { product: sema, format: semaFormat } = getProduct('semaglutide');
  const { product: epit, format: epitFormat } = getProduct('epithalon');
  const { product: ghk, format: ghkFormat } = getProduct('ghk-cu');
  const { product: ipamorelin, format: ipamFormat } = getProduct('ipamorelin');
  const { product: bacWater, format: bacFormat } = getProduct('bacteriostatic-water');
  const { product: healBlend, format: healFormat } = getProduct('bpc-157-tb-500-blend');
  const { product: nad, format: nadFormat } = getProduct('nad-plus');
  const { product: pt141, format: pt141Format } = getProduct('pt-141');
  const { product: nmn, format: nmnFormat } = getProduct('nmn');
  const { product: selank, format: selankFormat } = getProduct('selank');

  // Order 1 - Delivered (60 days ago)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(1),
      userId: customer1.id,
      subtotal: 120.00,
      shippingCost: 15.00,
      tax: 17.46,
      taxTps: 6.75,
      taxTvq: 10.71,
      total: 152.46,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      shippingName: 'Jean Dupont',
      shippingAddress1: '123 Rue Sainte-Catherine',
      shippingCity: 'Montréal',
      shippingState: 'QC',
      shippingPostal: 'H2X 1L5',
      shippingCountry: 'CA',
      carrier: 'Postes Canada',
      trackingNumber: 'CA123456789',
      shippedAt: daysAgo(57),
      deliveredAt: daysAgo(54),
      createdAt: daysAgo(60),
      items: {
        create: [
          {
            productId: bpc.id,
            formatId: bpcFormat?.id,
            productName: 'BPC-157',
            formatName: bpcFormat?.name || '5mg Vial',
            sku: bpcFormat?.sku || 'PP-BPC157-5MG',
            quantity: 2,
            unitPrice: 40.00,
            total: 80.00,
          },
          {
            productId: bacWater.id,
            formatId: bacFormat?.id,
            productName: 'Eau Bactériostatique',
            formatName: bacFormat?.name || '10ml Vial',
            sku: bacFormat?.sku || 'PP-BAC-10ML',
            quantity: 2,
            unitPrice: 13.00,
            total: 26.00,
          },
          {
            productId: ipamorelin.id,
            formatId: ipamFormat?.id,
            productName: 'Ipamorelin',
            formatName: ipamFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 27.00,
            total: 27.00,
          },
        ],
      },
    },
  });

  // Order 2 - Delivered (35 days ago)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(2),
      userId: customer1.id,
      subtotal: 230.00,
      shippingCost: 0, // Free shipping > 200$
      tax: 34.39,
      taxTps: 11.50,
      taxTvq: 22.89,
      total: 264.39,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      shippingName: 'Jean Dupont',
      shippingAddress1: '123 Rue Sainte-Catherine',
      shippingCity: 'Montréal',
      shippingState: 'QC',
      shippingPostal: 'H2X 1L5',
      shippingCountry: 'CA',
      carrier: 'Postes Canada',
      trackingNumber: 'CA987654321',
      shippedAt: daysAgo(32),
      deliveredAt: daysAgo(30),
      createdAt: daysAgo(35),
      promoCode: 'PEPTIDE20',
      promoDiscount: 46.00,
      items: {
        create: [
          {
            productId: healBlend.id,
            formatId: healFormat?.id,
            productName: 'BPC-157 + TB-500 Blend',
            formatName: healFormat?.name || '5mg Vial',
            quantity: 2,
            unitPrice: 70.00,
            total: 140.00,
          },
          {
            productId: sema.id,
            formatId: semaFormat?.id,
            productName: 'Semaglutide',
            formatName: semaFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 50.00,
            total: 50.00,
          },
          {
            productId: bpc.id,
            formatId: bpcFormat?.id,
            productName: 'BPC-157',
            formatName: bpcFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 40.00,
            total: 40.00,
          },
        ],
      },
    },
  });

  // Order 3 - Shipped / In Transit (5 days ago)
  const order3 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(3),
      userId: customer1.id,
      subtotal: 163.00,
      shippingCost: 15.00,
      tax: 25.90,
      taxTps: 8.90,
      taxTvq: 17.00,
      total: 203.90,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.PAYPAL,
      paymentStatus: 'PAID',
      status: 'SHIPPED',
      shippingName: 'Jean Dupont',
      shippingAddress1: '123 Rue Sainte-Catherine',
      shippingCity: 'Montréal',
      shippingState: 'QC',
      shippingPostal: 'H2X 1L5',
      shippingCountry: 'CA',
      carrier: 'FedEx',
      trackingNumber: 'FX789012345',
      shippedAt: daysAgo(3),
      createdAt: daysAgo(5),
      items: {
        create: [
          {
            productId: epit.id,
            formatId: epitFormat?.id,
            productName: 'Epithalon',
            formatName: epitFormat?.name || '5mg Vial',
            quantity: 2,
            unitPrice: 28.00,
            total: 56.00,
          },
          {
            productId: ghk.id,
            formatId: ghkFormat?.id,
            productName: 'GHK-Cu',
            formatName: ghkFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 50.00,
            total: 50.00,
          },
          {
            productId: nad.id,
            formatId: nadFormat?.id,
            productName: 'NAD+',
            formatName: nadFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 38.00,
            total: 38.00,
          },
          {
            productId: bacWater.id,
            formatId: bacFormat?.id,
            productName: 'Eau Bactériostatique',
            formatName: bacFormat?.name || '10ml Vial',
            quantity: 1,
            unitPrice: 13.00,
            total: 13.00,
          },
        ],
      },
    },
  });

  // Order 4 - Processing (2 days ago)
  const order4 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(4),
      userId: customer1.id,
      subtotal: 90.00,
      shippingCost: 15.00,
      tax: 15.28,
      taxTps: 5.25,
      taxTvq: 10.03,
      total: 120.28,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      shippingName: 'Jean Dupont',
      shippingAddress1: '123 Rue Sainte-Catherine',
      shippingCity: 'Montréal',
      shippingState: 'QC',
      shippingPostal: 'H2X 1L5',
      shippingCountry: 'CA',
      createdAt: daysAgo(2),
      items: {
        create: [
          {
            productId: healBlend.id,
            formatId: healFormat?.id,
            productName: 'BPC-157 + TB-500 Blend',
            formatName: healFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 70.00,
            total: 70.00,
          },
          {
            productId: bacWater.id,
            formatId: bacFormat?.id,
            productName: 'Eau Bactériostatique',
            formatName: bacFormat?.name || '10ml Vial',
            quantity: 1,
            unitPrice: 13.00,
            total: 13.00,
          },
        ],
      },
    },
  });

  // Order 5 - Cancelled (45 days ago)
  await prisma.order.create({
    data: {
      orderNumber: orderNumber(5),
      userId: customer1.id,
      subtotal: 50.00,
      shippingCost: 15.00,
      tax: 9.45,
      taxTps: 3.25,
      taxTvq: 6.20,
      total: 74.45,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'REFUNDED',
      status: 'CANCELLED',
      shippingName: 'Jean Dupont',
      shippingAddress1: '123 Rue Sainte-Catherine',
      shippingCity: 'Montréal',
      shippingState: 'QC',
      shippingPostal: 'H2X 1L5',
      shippingCountry: 'CA',
      createdAt: daysAgo(45),
      adminNotes: 'Client a demandé annulation avant expédition',
      items: {
        create: [
          {
            productId: sema.id,
            formatId: semaFormat?.id,
            productName: 'Semaglutide',
            formatName: semaFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 50.00,
            total: 50.00,
          },
        ],
      },
    },
  });

  // =====================================================
  // ORDERS FOR CUSTOMER 2 (Sarah Smith - moderate buyer)
  // =====================================================
  console.log('📦 Création des commandes - Sarah Smith...');

  // Order 6 - Delivered (50 days ago)
  const order6 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(6),
      userId: customer2.id,
      subtotal: 118.00,
      shippingCost: 15.00,
      tax: 17.30,
      taxTps: 6.65,
      taxTvq: 10.65,
      total: 150.30,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      shippingName: 'Sarah Smith',
      shippingAddress1: '456 Queen Street',
      shippingCity: 'Toronto',
      shippingState: 'ON',
      shippingPostal: 'M5V 2A8',
      shippingCountry: 'CA',
      carrier: 'Postes Canada',
      trackingNumber: 'CA555666777',
      shippedAt: daysAgo(47),
      deliveredAt: daysAgo(45),
      createdAt: daysAgo(50),
      items: {
        create: [
          {
            productId: bpc.id,
            formatId: bpcFormat?.id,
            productName: 'BPC-157',
            formatName: bpcFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 40.00,
            total: 40.00,
          },
          {
            productId: tb500.id,
            formatId: tb500Format?.id,
            productName: 'TB-500',
            formatName: tb500Format?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 40.00,
            total: 40.00,
          },
          {
            productId: nad.id,
            formatId: nadFormat?.id,
            productName: 'NAD+',
            formatName: nadFormat?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 38.00,
            total: 38.00,
          },
        ],
      },
    },
  });

  // Order 7 - Delivered (20 days ago)
  const order7 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(7),
      userId: customer2.id,
      subtotal: 90.00,
      shippingCost: 15.00,
      tax: 13.65,
      taxTps: 5.25,
      taxTvq: 8.40,
      total: 118.65,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.PAYPAL,
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      shippingName: 'Sarah Smith',
      shippingAddress1: '456 Queen Street',
      shippingCity: 'Toronto',
      shippingState: 'ON',
      shippingPostal: 'M5V 2A8',
      shippingCountry: 'CA',
      carrier: 'FedEx',
      trackingNumber: 'FX111222333',
      shippedAt: daysAgo(17),
      deliveredAt: daysAgo(15),
      createdAt: daysAgo(20),
      items: {
        create: [
          {
            productId: selank.id,
            formatId: selankFormat?.id,
            productName: 'Selank',
            formatName: selankFormat?.name || '5mg Vial',
            quantity: 2,
            unitPrice: 22.00,
            total: 44.00,
          },
          {
            productId: pt141.id,
            formatId: pt141Format?.id,
            productName: 'PT-141',
            formatName: pt141Format?.name || '5mg Vial',
            quantity: 1,
            unitPrice: 42.00,
            total: 42.00,
          },
        ],
      },
    },
  });

  // Order 8 - Pending (today)
  await prisma.order.create({
    data: {
      orderNumber: orderNumber(8),
      userId: customer2.id,
      subtotal: 55.00,
      shippingCost: 15.00,
      tax: 9.10,
      taxTps: 3.50,
      taxTvq: 5.60,
      total: 79.10,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'PENDING',
      status: 'PENDING',
      shippingName: 'Sarah Smith',
      shippingAddress1: '456 Queen Street',
      shippingCity: 'Toronto',
      shippingState: 'ON',
      shippingPostal: 'M5V 2A8',
      shippingCountry: 'CA',
      createdAt: daysAgo(0),
      items: {
        create: [
          {
            productId: nmn.id,
            formatId: nmnFormat?.id,
            productName: 'NMN',
            formatName: nmnFormat?.name || '60 Capsules',
            quantity: 1,
            unitPrice: 55.00,
            total: 55.00,
          },
        ],
      },
    },
  });

  // =====================================================
  // ORDERS FOR CUSTOMER 3 (Marc Leblanc - new buyer)
  // =====================================================
  console.log('📦 Création des commandes - Marc Leblanc...');

  // Order 9 - Delivered (10 days ago)
  const order9 = await prisma.order.create({
    data: {
      orderNumber: orderNumber(9),
      userId: customer3.id,
      subtotal: 80.00,
      shippingCost: 15.00,
      tax: 13.83,
      taxTps: 4.75,
      taxTvq: 9.08,
      total: 108.83,
      currencyId: cadCurrency.id,
      paymentMethod: PaymentMethod.STRIPE_CARD,
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      shippingName: 'Marc Leblanc',
      shippingAddress1: '789 Boulevard René-Lévesque',
      shippingCity: 'Québec',
      shippingState: 'QC',
      shippingPostal: 'G1R 2L3',
      shippingCountry: 'CA',
      carrier: 'Postes Canada',
      trackingNumber: 'CA888999000',
      shippedAt: daysAgo(7),
      deliveredAt: daysAgo(5),
      createdAt: daysAgo(10),
      promoCode: 'WELCOME10',
      promoDiscount: 8.00,
      items: {
        create: [
          {
            productId: bpc.id,
            formatId: bpcFormat?.id,
            productName: 'BPC-157',
            formatName: bpcFormat?.name || '5mg Vial',
            quantity: 2,
            unitPrice: 40.00,
            total: 80.00,
          },
        ],
      },
    },
  });

  // =====================================================
  // CUSTOMER INVOICES
  // =====================================================
  console.log('📄 Création des factures client...');

  // Invoice 1 - Paid (Order 1)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(1),
      customerId: customer1.id,
      customerName: 'Jean Dupont',
      customerEmail: 'jean.dupont@test.com',
      customerAddress: '123 Rue Sainte-Catherine\nMontréal, QC H2X 1L5\nCanada',
      orderId: order1.id,
      subtotal: 120.00,
      shippingCost: 15.00,
      taxTps: 6.75,
      taxTvq: 10.71,
      total: 152.46,
      amountPaid: 152.46,
      balance: 0,
      invoiceDate: daysAgo(60),
      dueDate: daysAgo(30),
      paidAt: daysAgo(60),
      status: 'PAID',
      items: {
        create: [
          { description: 'BPC-157 - 5mg Vial', quantity: 2, unitPrice: 40.00, total: 80.00, productId: bpc.id },
          { description: 'Eau Bactériostatique - 10ml Vial', quantity: 2, unitPrice: 13.00, total: 26.00, productId: bacWater.id },
          { description: 'Ipamorelin - 5mg Vial', quantity: 1, unitPrice: 27.00, total: 27.00, productId: ipamorelin.id },
        ],
      },
    },
  });

  // Invoice 2 - Paid (Order 2)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(2),
      customerId: customer1.id,
      customerName: 'Jean Dupont',
      customerEmail: 'jean.dupont@test.com',
      customerAddress: '123 Rue Sainte-Catherine\nMontréal, QC H2X 1L5\nCanada',
      orderId: order2.id,
      subtotal: 230.00,
      discount: 46.00,
      taxTps: 11.50,
      taxTvq: 22.89,
      total: 264.39,
      amountPaid: 264.39,
      balance: 0,
      invoiceDate: daysAgo(35),
      dueDate: daysAgo(5),
      paidAt: daysAgo(35),
      status: 'PAID',
      items: {
        create: [
          { description: 'BPC-157 + TB-500 Blend - 5mg Vial', quantity: 2, unitPrice: 70.00, total: 140.00, productId: healBlend.id },
          { description: 'Semaglutide - 5mg Vial', quantity: 1, unitPrice: 50.00, total: 50.00, productId: sema.id },
          { description: 'BPC-157 - 5mg Vial', quantity: 1, unitPrice: 40.00, total: 40.00, productId: bpc.id },
        ],
      },
    },
  });

  // Invoice 3 - Sent (Order 3 - shipped but not yet paid invoice)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(3),
      customerId: customer1.id,
      customerName: 'Jean Dupont',
      customerEmail: 'jean.dupont@test.com',
      customerAddress: '123 Rue Sainte-Catherine\nMontréal, QC H2X 1L5\nCanada',
      orderId: order3.id,
      subtotal: 163.00,
      shippingCost: 15.00,
      taxTps: 8.90,
      taxTvq: 17.00,
      total: 203.90,
      amountPaid: 203.90,
      balance: 0,
      invoiceDate: daysAgo(5),
      dueDate: daysFromNow(25),
      paidAt: daysAgo(5),
      status: 'PAID',
      items: {
        create: [
          { description: 'Epithalon - 5mg Vial', quantity: 2, unitPrice: 28.00, total: 56.00, productId: epit.id },
          { description: 'GHK-Cu - 5mg Vial', quantity: 1, unitPrice: 50.00, total: 50.00, productId: ghk.id },
          { description: 'NAD+ - 5mg Vial', quantity: 1, unitPrice: 38.00, total: 38.00, productId: nad.id },
          { description: 'Eau Bactériostatique - 10ml Vial', quantity: 1, unitPrice: 13.00, total: 13.00, productId: bacWater.id },
        ],
      },
    },
  });

  // Invoice 4 - Draft (Order 4 - processing)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(4),
      customerId: customer1.id,
      customerName: 'Jean Dupont',
      customerEmail: 'jean.dupont@test.com',
      customerAddress: '123 Rue Sainte-Catherine\nMontréal, QC H2X 1L5\nCanada',
      orderId: order4.id,
      subtotal: 90.00,
      shippingCost: 15.00,
      taxTps: 5.25,
      taxTvq: 10.03,
      total: 120.28,
      amountPaid: 120.28,
      balance: 0,
      invoiceDate: daysAgo(2),
      dueDate: daysFromNow(28),
      paidAt: daysAgo(2),
      status: 'PAID',
      items: {
        create: [
          { description: 'BPC-157 + TB-500 Blend - 5mg Vial', quantity: 1, unitPrice: 70.00, total: 70.00, productId: healBlend.id },
          { description: 'Eau Bactériostatique - 10ml Vial', quantity: 1, unitPrice: 13.00, total: 13.00, productId: bacWater.id },
        ],
      },
    },
  });

  // Invoice 5 - Paid (Sarah - Order 6)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(5),
      customerId: customer2.id,
      customerName: 'Sarah Smith',
      customerEmail: 'sarah.smith@test.com',
      customerAddress: '456 Queen Street\nToronto, ON M5V 2A8\nCanada',
      orderId: order6.id,
      subtotal: 118.00,
      shippingCost: 15.00,
      taxTps: 6.65,
      taxTvq: 10.65,
      total: 150.30,
      amountPaid: 150.30,
      balance: 0,
      invoiceDate: daysAgo(50),
      dueDate: daysAgo(20),
      paidAt: daysAgo(50),
      status: 'PAID',
      items: {
        create: [
          { description: 'BPC-157 - 5mg Vial', quantity: 1, unitPrice: 40.00, total: 40.00, productId: bpc.id },
          { description: 'TB-500 - 5mg Vial', quantity: 1, unitPrice: 40.00, total: 40.00, productId: tb500.id },
          { description: 'NAD+ - 5mg Vial', quantity: 1, unitPrice: 38.00, total: 38.00, productId: nad.id },
        ],
      },
    },
  });

  // Invoice 6 - Paid (Sarah - Order 7)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(6),
      customerId: customer2.id,
      customerName: 'Sarah Smith',
      customerEmail: 'sarah.smith@test.com',
      customerAddress: '456 Queen Street\nToronto, ON M5V 2A8\nCanada',
      orderId: order7.id,
      subtotal: 90.00,
      shippingCost: 15.00,
      taxTps: 5.25,
      taxTvq: 8.40,
      total: 118.65,
      amountPaid: 118.65,
      balance: 0,
      invoiceDate: daysAgo(20),
      dueDate: daysFromNow(10),
      paidAt: daysAgo(20),
      status: 'PAID',
      items: {
        create: [
          { description: 'Selank - 5mg Vial', quantity: 2, unitPrice: 22.00, total: 44.00, productId: selank.id },
          { description: 'PT-141 - 5mg Vial', quantity: 1, unitPrice: 42.00, total: 42.00, productId: pt141.id },
        ],
      },
    },
  });

  // Invoice 7 - Paid (Marc - Order 9)
  await prisma.customerInvoice.create({
    data: {
      invoiceNumber: invoiceNumber(7),
      customerId: customer3.id,
      customerName: 'Marc Leblanc',
      customerEmail: 'marc.leblanc@test.com',
      customerAddress: '789 Boulevard René-Lévesque\nQuébec, QC G1R 2L3\nCanada',
      orderId: order9.id,
      subtotal: 80.00,
      shippingCost: 15.00,
      discount: 8.00,
      taxTps: 4.75,
      taxTvq: 9.08,
      total: 108.83,
      amountPaid: 108.83,
      balance: 0,
      invoiceDate: daysAgo(10),
      dueDate: daysFromNow(20),
      paidAt: daysAgo(10),
      status: 'PAID',
      items: {
        create: [
          { description: 'BPC-157 - 5mg Vial', quantity: 2, unitPrice: 40.00, total: 80.00, productId: bpc.id },
        ],
      },
    },
  });

  // =====================================================
  // SUBSCRIPTIONS
  // =====================================================
  console.log('🔄 Création des abonnements...');

  // Jean - Active monthly BPC-157
  await prisma.subscription.create({
    data: {
      userId: customer1.id,
      productId: bpc.id,
      formatId: bpcFormat?.id || null,
      productName: 'BPC-157',
      formatName: bpcFormat?.name || '5mg Vial',
      quantity: 2,
      frequency: 'MONTHLY',
      discountPercent: 10,
      unitPrice: 40.00,
      status: 'ACTIVE',
      nextDelivery: daysFromNow(5),
      lastDelivery: daysAgo(25),
      createdAt: daysAgo(55),
    },
  });

  // Jean - Active biweekly Healing Blend
  await prisma.subscription.create({
    data: {
      userId: customer1.id,
      productId: healBlend.id,
      formatId: healFormat?.id || null,
      productName: 'BPC-157 + TB-500 Blend',
      formatName: healFormat?.name || '5mg Vial',
      quantity: 1,
      frequency: 'BIWEEKLY',
      discountPercent: 15,
      unitPrice: 70.00,
      status: 'ACTIVE',
      nextDelivery: daysFromNow(10),
      lastDelivery: daysAgo(4),
      createdAt: daysAgo(32),
    },
  });

  // Jean - Paused Semaglutide subscription
  await prisma.subscription.create({
    data: {
      userId: customer1.id,
      productId: sema.id,
      formatId: semaFormat?.id || null,
      productName: 'Semaglutide',
      formatName: semaFormat?.name || '5mg Vial',
      quantity: 1,
      frequency: 'MONTHLY',
      discountPercent: 10,
      unitPrice: 50.00,
      status: 'PAUSED',
      nextDelivery: daysFromNow(30),
      lastDelivery: daysAgo(35),
      createdAt: daysAgo(65),
    },
  });

  // Sarah - Active monthly NAD+
  await prisma.subscription.create({
    data: {
      userId: customer2.id,
      productId: nad.id,
      formatId: nadFormat?.id || null,
      productName: 'NAD+',
      formatName: nadFormat?.name || '5mg Vial',
      quantity: 1,
      frequency: 'MONTHLY',
      discountPercent: 10,
      unitPrice: 38.00,
      status: 'ACTIVE',
      nextDelivery: daysFromNow(15),
      lastDelivery: daysAgo(15),
      createdAt: daysAgo(45),
    },
  });

  // Sarah - Cancelled BPC-157 subscription
  await prisma.subscription.create({
    data: {
      userId: customer2.id,
      productId: bpc.id,
      formatId: bpcFormat?.id || null,
      productName: 'BPC-157',
      formatName: bpcFormat?.name || '5mg Vial',
      quantity: 1,
      frequency: 'BIMONTHLY',
      discountPercent: 5,
      unitPrice: 40.00,
      status: 'CANCELLED',
      nextDelivery: daysAgo(10),
      lastDelivery: daysAgo(50),
      createdAt: daysAgo(90),
      cancelledAt: daysAgo(10),
    },
  });

  // =====================================================
  // LOYALTY TRANSACTIONS
  // =====================================================
  console.log('⭐ Création des transactions de fidélité...');

  // Jean Dupont - loyalty history
  const jeanTransactions = [
    { type: 'EARN_SIGNUP' as const, points: 100, desc: 'Bonus de bienvenue', date: daysAgo(60), balanceAfter: 100 },
    { type: 'EARN_PURCHASE' as const, points: 152, desc: 'Commande PP-2026-000001', date: daysAgo(60), balanceAfter: 252, orderId: order1.id },
    { type: 'EARN_PURCHASE' as const, points: 264, desc: 'Commande PP-2026-000002', date: daysAgo(35), balanceAfter: 516, orderId: order2.id },
    { type: 'REDEEM_DISCOUNT' as const, points: -200, desc: 'Réduction appliquée', date: daysAgo(20), balanceAfter: 316 },
    { type: 'EARN_PURCHASE' as const, points: 204, desc: 'Commande PP-2026-000003', date: daysAgo(5), balanceAfter: 520, orderId: order3.id },
    { type: 'EARN_REFERRAL' as const, points: 500, desc: 'Parrainage Marc Leblanc', date: daysAgo(10), balanceAfter: 1020, referralId: customer3.id },
    { type: 'EARN_PURCHASE' as const, points: 120, desc: 'Commande PP-2026-000004', date: daysAgo(2), balanceAfter: 1140, orderId: order4.id },
    { type: 'EARN_BONUS' as const, points: 110, desc: 'Bonus fidélité Gold', date: daysAgo(1), balanceAfter: 1250 },
  ];

  for (const t of jeanTransactions) {
    await prisma.loyaltyTransaction.create({
      data: {
        userId: customer1.id,
        type: t.type,
        points: t.points,
        description: t.desc,
        orderId: t.orderId,
        referralId: t.referralId,
        balanceAfter: t.balanceAfter,
        createdAt: t.date,
      },
    });
  }

  // Sarah Smith - loyalty history
  const sarahTransactions = [
    { type: 'EARN_SIGNUP' as const, points: 100, desc: 'Bonus de bienvenue', date: daysAgo(50), balanceAfter: 100 },
    { type: 'EARN_PURCHASE' as const, points: 150, desc: 'Commande PP-2026-000006', date: daysAgo(50), balanceAfter: 250, orderId: order6.id },
    { type: 'EARN_PURCHASE' as const, points: 119, desc: 'Commande PP-2026-000007', date: daysAgo(20), balanceAfter: 369, orderId: order7.id },
    { type: 'EARN_BONUS' as const, points: 81, desc: 'Bonus tier Silver atteint', date: daysAgo(15), balanceAfter: 450 },
  ];

  for (const t of sarahTransactions) {
    await prisma.loyaltyTransaction.create({
      data: {
        userId: customer2.id,
        type: t.type,
        points: t.points,
        description: t.desc,
        orderId: t.orderId,
        balanceAfter: t.balanceAfter,
        createdAt: t.date,
      },
    });
  }

  // Marc Leblanc - loyalty history
  await prisma.loyaltyTransaction.create({
    data: {
      userId: customer3.id,
      type: 'EARN_SIGNUP',
      points: 50,
      description: 'Bonus de bienvenue (code parrainage JEAN2026)',
      balanceAfter: 50,
      referralId: customer1.id,
      createdAt: daysAgo(10),
    },
  });

  // =====================================================
  // USER ADDRESSES
  // =====================================================
  console.log('🏠 Création des adresses...');

  await prisma.userAddress.createMany({
    data: [
      {
        userId: customer1.id,
        label: 'Maison',
        recipientName: 'Jean Dupont',
        addressLine1: '123 Rue Sainte-Catherine',
        city: 'Montréal',
        state: 'QC',
        postalCode: 'H2X 1L5',
        country: 'CA',
        phone: '+1-514-555-0101',
        isDefault: true,
      },
      {
        userId: customer1.id,
        label: 'Bureau',
        recipientName: 'Jean Dupont',
        addressLine1: '500 Place d\'Armes',
        addressLine2: 'Suite 1200',
        city: 'Montréal',
        state: 'QC',
        postalCode: 'H2Y 2W2',
        country: 'CA',
        phone: '+1-514-555-0102',
        isDefault: false,
      },
      {
        userId: customer2.id,
        label: 'Home',
        recipientName: 'Sarah Smith',
        addressLine1: '456 Queen Street',
        city: 'Toronto',
        state: 'ON',
        postalCode: 'M5V 2A8',
        country: 'CA',
        phone: '+1-416-555-0202',
        isDefault: true,
      },
      {
        userId: customer3.id,
        label: 'Maison',
        recipientName: 'Marc Leblanc',
        addressLine1: '789 Boulevard René-Lévesque',
        city: 'Québec',
        state: 'QC',
        postalCode: 'G1R 2L3',
        country: 'CA',
        phone: '+1-438-555-0303',
        isDefault: true,
      },
    ],
  });

  // =====================================================
  // SUMMARY
  // =====================================================
  const orderCount = await prisma.order.count();
  const invoiceCount = await prisma.customerInvoice.count();
  const subscriptionCount = await prisma.subscription.count();
  const loyaltyCount = await prisma.loyaltyTransaction.count();
  const customerCount = await prisma.user.count({ where: { role: 'CUSTOMER' } });

  console.log(`
📊 Données client de test:
- ${customerCount} clients
- ${orderCount} commandes
- ${invoiceCount} factures client
- ${subscriptionCount} abonnements
- ${loyaltyCount} transactions fidélité
  `);
}

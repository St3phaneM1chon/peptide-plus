/**
 * AureliaPay Simulator
 * Simulates payment flow WITHOUT Stripe, calling the SAME accounting pipeline
 */

import { prisma } from '@/lib/db';
import { TAX_RATES } from '@/lib/accounting/types';
import {
  createAccountingEntriesForOrder,
  createRefundAccountingEntries,
  createCreditNote,
  createInventoryLossEntry,
} from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory/inventory.service';
import type { UatScenario, UatScenarioItem } from './scenarios';

// =====================================================
// ADDRESS GENERATOR
// =====================================================

interface GeneratedAddress {
  name: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string;
}

const ADDRESS_BOOK: Record<string, GeneratedAddress> = {
  QC: { name: 'Jean Tremblay', street: '123 Rue Sainte-Catherine', city: 'Montreal', province: 'QC', postalCode: 'H2L 2J7', country: 'CA', phone: '514-555-0101' },
  ON: { name: 'Sarah Smith', street: '456 Yonge Street', city: 'Toronto', province: 'ON', postalCode: 'M4Y 1X9', country: 'CA', phone: '416-555-0102' },
  BC: { name: 'David Chen', street: '789 Robson Street', city: 'Vancouver', province: 'BC', postalCode: 'V6Z 1C2', country: 'CA', phone: '604-555-0103' },
  AB: { name: 'Mike Johnson', street: '321 Stephen Avenue', city: 'Calgary', province: 'AB', postalCode: 'T2P 1G8', country: 'CA', phone: '403-555-0104' },
  SK: { name: 'Amy Wilson', street: '100 Albert Street', city: 'Regina', province: 'SK', postalCode: 'S4R 2N4', country: 'CA', phone: '306-555-0105' },
  MB: { name: 'Paul Martin', street: '200 Portage Avenue', city: 'Winnipeg', province: 'MB', postalCode: 'R3C 0B8', country: 'CA', phone: '204-555-0106' },
  NS: { name: 'Claire MacDonald', street: '50 Spring Garden Road', city: 'Halifax', province: 'NS', postalCode: 'B3J 1G6', country: 'CA', phone: '902-555-0107' },
  NB: { name: 'Marc Leblanc', street: '75 King Street', city: 'Saint John', province: 'NB', postalCode: 'E2L 1G5', country: 'CA', phone: '506-555-0108' },
  NL: { name: 'Tom Walsh', street: '10 Water Street', city: "St. John's", province: 'NL', postalCode: 'A1C 1A4', country: 'CA', phone: '709-555-0109' },
  PE: { name: 'Anne Murphy', street: '25 Queen Street', city: 'Charlottetown', province: 'PE', postalCode: 'C1A 4A1', country: 'CA', phone: '902-555-0110' },
  NT: { name: 'Peter Nattiq', street: '15 Franklin Avenue', city: 'Yellowknife', province: 'NT', postalCode: 'X1A 2N2', country: 'CA', phone: '867-555-0111' },
  YT: { name: 'Lise Dubois', street: '30 Main Street', city: 'Whitehorse', province: 'YT', postalCode: 'Y1A 1B7', country: 'CA', phone: '867-555-0112' },
  NU: { name: 'James Iqaluk', street: '5 Federal Road', city: 'Iqaluit', province: 'NU', postalCode: 'X0A 0H0', country: 'CA', phone: '867-555-0113' },
  // International
  NY: { name: 'John Doe', street: '350 5th Avenue', city: 'New York', province: 'NY', postalCode: '10118', country: 'US', phone: '212-555-0114' },
  CA: { name: 'Jane Smith', street: '100 Hollywood Blvd', city: 'Los Angeles', province: 'CA', postalCode: '90028', country: 'US', phone: '323-555-0115' },
  TX: { name: 'Bob Williams', street: '500 Main Street', city: 'Houston', province: 'TX', postalCode: '77002', country: 'US', phone: '713-555-0116' },
  FL: { name: 'Maria Garcia', street: '200 Biscayne Blvd', city: 'Miami', province: 'FL', postalCode: '33131', country: 'US', phone: '305-555-0117' },
  OR: { name: 'Chris Brown', street: '100 SW Broadway', city: 'Portland', province: 'OR', postalCode: '97205', country: 'US', phone: '503-555-0118' },
  WA: { name: 'Pat Lee', street: '600 Pine Street', city: 'Seattle', province: 'WA', postalCode: '98101', country: 'US', phone: '206-555-0119' },
  MT: { name: 'Dan Cooper', street: '50 Last Chance Gulch', city: 'Helena', province: 'MT', postalCode: '59601', country: 'US', phone: '406-555-0120' },
  DE: { name: 'Erin Taylor', street: '100 Market Street', city: 'Wilmington', province: 'DE', postalCode: '19801', country: 'US', phone: '302-555-0121' },
  NH: { name: 'Ryan Davis', street: '75 Main Street', city: 'Concord', province: 'NH', postalCode: '03301', country: 'US', phone: '603-555-0122' },
  HI: { name: 'Kai Nakamura', street: '200 Kalakaua Ave', city: 'Honolulu', province: 'HI', postalCode: '96815', country: 'US', phone: '808-555-0123' },
  IL: { name: 'Kevin O\'Brien', street: '233 S Wacker Drive', city: 'Chicago', province: 'IL', postalCode: '60606', country: 'US', phone: '312-555-0129' },
  IDF: { name: 'Pierre Dupont', street: '10 Rue de Rivoli', city: 'Paris', province: 'IDF', postalCode: '75001', country: 'FR', phone: '+33-1-55-0124' },
  LDN: { name: 'William Clarke', street: '221B Baker Street', city: 'London', province: 'LDN', postalCode: 'NW1 6XE', country: 'GB', phone: '+44-20-555-0125' },
  BY: { name: 'Hans Mueller', street: '15 Maximilianstrasse', city: 'Munich', province: 'BY', postalCode: '80539', country: 'DE', phone: '+49-89-555-0130' },
  MQ: { name: 'Marie-Josee Celestin', street: '15 Rue de la Liberte', city: 'Fort-de-France', province: 'MQ', postalCode: '97200', country: 'MQ', phone: '+596-555-0126' },
  SP: { name: 'Carlos Silva', street: '500 Av. Paulista', city: 'Sao Paulo', province: 'SP', postalCode: '01310-100', country: 'BR', phone: '+55-11-555-0127' },
  CDMX: { name: 'Rosa Hernandez', street: '100 Paseo de la Reforma', city: 'Mexico City', province: 'CDMX', postalCode: '06600', country: 'MX', phone: '+52-55-555-0128' },
};

function generateAddress(scenario: UatScenario): GeneratedAddress {
  return ADDRESS_BOOK[scenario.province] || ADDRESS_BOOK['QC'];
}

// =====================================================
// PRODUCT SELECTOR
// =====================================================

interface SelectedProduct {
  productId: string;
  formatId: string;
  productName: string;
  formatName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  wac: number;
}

async function selectProducts(items: UatScenarioItem[]): Promise<SelectedProduct[]> {
  const selected: SelectedProduct[] = [];

  // Get all available formats with stock
  const formats = await prisma.productFormat.findMany({
    where: {
      isActive: true,
      stockQuantity: { gt: 0 },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { price: 'asc' },
  });

  if (formats.length === 0) {
    throw new Error('Aucun produit avec stock disponible pour le test UAT');
  }

  for (const item of items) {
    if (item.priceRange === 'all') {
      // Select ALL available products (1 of each)
      for (const f of formats) {
        const lastTx = await prisma.inventoryTransaction.findFirst({
          where: { productId: f.productId, formatId: f.id },
          orderBy: { createdAt: 'desc' },
          select: { runningWAC: true },
        });
        selected.push({
          productId: f.productId,
          formatId: f.id,
          productName: f.product.name,
          formatName: f.name,
          sku: f.sku || f.product.sku || 'N/A',
          unitPrice: Number(f.price),
          quantity: 1,
          wac: lastTx ? Number(lastTx.runningWAC) : 0,
        });
      }
      continue;
    }

    let target: typeof formats[number] | undefined;

    if (item.priceRange === 'exact' && item.exactPrice !== undefined) {
      // Find closest price
      target = formats.reduce((prev, curr) =>
        Math.abs(Number(curr.price) - item.exactPrice!) < Math.abs(Number(prev.price) - item.exactPrice!)
          ? curr : prev
      );
    } else if (item.priceRange === 'cheap') {
      // First quartile
      target = formats[0];
    } else if (item.priceRange === 'expensive') {
      // Last quartile
      target = formats[formats.length - 1];
    } else {
      // Mid-range
      target = formats[Math.floor(formats.length / 2)];
    }

    if (!target) {
      throw new Error(`Impossible de trouver un produit pour priceRange=${item.priceRange}`);
    }

    const lastTx = await prisma.inventoryTransaction.findFirst({
      where: { productId: target.productId, formatId: target.id },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });

    selected.push({
      productId: target.productId,
      formatId: target.id,
      productName: target.product.name,
      formatName: target.name,
      sku: target.sku || target.product.sku || 'N/A',
      unitPrice: Number(target.price),
      quantity: item.quantity,
      wac: lastTx ? Number(lastTx.runningWAC) : 0,
    });
  }

  return selected;
}

// =====================================================
// TAX CALCULATOR
// =====================================================

interface CalculatedTaxes {
  tps: number;
  tvq: number;
  tvh: number;
  pst: number;
  totalTax: number;
}

function calculateTaxes(taxableAmount: number, province: string, country: string): CalculatedTaxes {
  if (country !== 'CA') {
    return { tps: 0, tvq: 0, tvh: 0, pst: 0, totalTax: 0 };
  }

  const rates = TAX_RATES[province as keyof typeof TAX_RATES];
  if (!rates) {
    return { tps: 0, tvq: 0, tvh: 0, pst: 0, totalTax: 0 };
  }

  const tps = 'TPS' in rates ? Math.round(taxableAmount * rates.TPS * 100) / 100 : 0;
  const tvq = 'TVQ' in rates ? Math.round(taxableAmount * rates.TVQ * 100) / 100 : 0;
  const tvh = 'TVH' in rates ? Math.round(taxableAmount * rates.TVH * 100) / 100 : 0;
  const pst = 'PST' in rates ? Math.round(taxableAmount * rates.PST * 100) / 100 : 0;

  return {
    tps,
    tvq,
    tvh,
    pst,
    totalTax: Math.round((tps + tvq + tvh + pst) * 100) / 100,
  };
}

// =====================================================
// ORDER NUMBER GENERATOR
// =====================================================

async function generateOrderNumber(): Promise<string> {
  const now = Date.now();
  const suffix = String(now).slice(-6);
  const year = new Date().getFullYear();
  return `PP-${year}-${suffix}`;
}

// =====================================================
// MAIN SIMULATION FUNCTION
// =====================================================

export async function simulateAureliaPay(params: {
  scenario: UatScenario;
  testCaseId: string;
}): Promise<{ orderId: string; orderNumber: string; success: boolean; error?: string }> {
  const { scenario, testCaseId } = params;

  try {
    // 1. Get currency for this scenario
    const currencyCode = scenario.currency || 'CAD';
    let currency = await prisma.currency.findFirst({ where: { code: currencyCode } });
    if (!currency) {
      currency = await prisma.currency.findFirst({ where: { code: 'CAD' } });
      if (!currency) {
        currency = await prisma.currency.create({
          data: { code: 'CAD', name: 'Canadian Dollar', symbol: '$', exchangeRate: 1, isDefault: true },
        });
      }
    }
    const exchangeRate = Number(currency.exchangeRate); // CAD per 1 unit of foreign currency
    const isLocalCAD = currencyCode === 'CAD';

    // 2. Select real products from DB (prices are in CAD)
    const products = await selectProducts(scenario.items);

    // 3. Calculate amounts
    const subtotalCAD = products.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0);
    const subtotalCADRounded = Math.round(subtotalCAD * 100) / 100;
    const shippingCostCAD = scenario.shipping.required ? (scenario.shipping.amount || 15) : 0;

    // Convert to local currency if not CAD
    // exchangeRate = how many CAD per 1 unit of foreign currency
    // So local = CAD / exchangeRate
    const subtotalLocal = isLocalCAD ? subtotalCADRounded : Math.round((subtotalCADRounded / exchangeRate) * 100) / 100;
    const shippingLocal = isLocalCAD ? shippingCostCAD : Math.round((shippingCostCAD / exchangeRate) * 100) / 100;
    const taxableAmount = subtotalLocal + shippingLocal;

    // 4. Calculate taxes (Canadian taxes only for CA orders; 0 for international)
    const taxes = calculateTaxes(taxableAmount, scenario.province, scenario.country);
    const total = Math.round((subtotalLocal + shippingLocal + taxes.totalTax) * 100) / 100;

    // 5. Generate address
    const address = generateAddress(scenario);

    // 6. Get a test user
    const testUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!testUser) {
      throw new Error('Aucun utilisateur disponible pour le test UAT');
    }

    // 7. Generate order number
    const orderNumber = await generateOrderNumber();

    // 8. Create Order + OrderItems in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: testUser!.id,
          subtotal: subtotalLocal,
          shippingCost: shippingLocal,
          discount: 0,
          tax: taxes.totalTax,
          taxTps: taxes.tps,
          taxTvq: taxes.tvq,
          taxTvh: taxes.tvh,
          taxPst: taxes.pst,
          total,
          currencyId: currency!.id,
          exchangeRate: exchangeRate,
          paymentMethod: 'AURELIA_PAY',
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          orderType: 'STANDARD',
          shippingName: address.name,
          shippingAddress1: address.street,
          shippingCity: address.city,
          shippingState: address.province,
          shippingPostal: address.postalCode,
          shippingCountry: address.country,
          shippingPhone: address.phone,
          adminNotes: `[UAT] Test case: ${scenario.code} | ${currencyCode} @${exchangeRate} | testCaseId: ${testCaseId}`,
          items: {
            create: products.map((p) => {
              const localPrice = isLocalCAD ? p.unitPrice : Math.round((p.unitPrice / exchangeRate) * 100) / 100;
              return {
                productId: p.productId,
                formatId: p.formatId,
                productName: p.productName,
                formatName: p.formatName,
                sku: p.sku,
                quantity: p.quantity,
                unitPrice: localPrice,
                discount: 0,
                total: Math.round(localPrice * p.quantity * 100) / 100,
              };
            }),
          },
        },
        include: { items: true },
      });

      // 9. Consume inventory (decrement stock + create SALE transactions)
      for (const product of products) {
        // Decrement stock
        await tx.productFormat.update({
          where: { id: product.formatId },
          data: { stockQuantity: { decrement: product.quantity } },
        });

        // Create inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            productId: product.productId,
            formatId: product.formatId,
            type: 'SALE',
            quantity: -product.quantity,
            unitCost: product.wac,
            runningWAC: product.wac,
            orderId: createdOrder.id,
          },
        });
      }

      return createdOrder;
    });

    // 10. Call accounting pipeline (same as Stripe webhook)
    await createAccountingEntriesForOrder(order.id);

    // 11. Generate COGS entry
    await generateCOGSEntry(order.id);

    // 12. Update test case with order link
    await prisma.uatTestCase.update({
      where: { id: testCaseId },
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        expectedTaxes: {
          tps: taxes.tps,
          tvq: taxes.tvq,
          tvh: taxes.tvh,
          pst: taxes.pst,
          total: taxes.totalTax,
        },
        expectedTotal: total,
      },
    });

    return { orderId: order.id, orderNumber: order.orderNumber, success: true };
  } catch (error: unknown) {
    console.error('[AureliaPay] Simulation error:', error);
    // Log the error to the test case
    const err = error instanceof Error ? error : new Error('Erreur inconnue');
    await prisma.uatTestError.create({
      data: {
        testCaseId,
        category: 'SIMULATION_ERROR',
        severity: 'ERROR',
        message: err.message || 'Erreur inconnue lors de la simulation',
        stackTrace: err.stack,
        context: { scenarioCode: scenario.code, region: scenario.region },
      },
    });

    return {
      orderId: '',
      orderNumber: '',
      success: false,
      error: err.message,
    };
  }
}

/**
 * Execute post-actions (refund, reship) directly via service functions (no HTTP)
 */
export async function executePostActions(params: {
  orderId: string;
  actions: ('refund' | 'reship')[];
  testCaseId: string;
}): Promise<void> {
  const { orderId, actions, testCaseId } = params;

  for (const action of actions) {
    try {
      if (action === 'refund') {
        await executeRefund(orderId, testCaseId);
      } else if (action === 'reship') {
        await executeReship(orderId, testCaseId);
      }
    } catch (error: unknown) {
      console.error(`[AureliaPay] Post-action '${action}' failed for order ${orderId}:`, error);
      const err = error instanceof Error ? error : new Error(`Post-action ${action} echouee`);
      await prisma.uatTestError.create({
        data: {
          testCaseId,
          category: action === 'refund' ? 'REFUND_ERROR' : 'RESHIP_ERROR',
          severity: 'ERROR',
          message: err.message || `Post-action ${action} echouee`,
          stackTrace: err.stack,
          context: { orderId, action },
        },
      });
    }
  }
}

/**
 * Direct refund execution (same logic as admin API handler)
 */
async function executeRefund(orderId: string, _testCaseId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error(`Order not found: ${orderId}`);

  const amount = Number(order.total);
  const reason = `[UAT] Full refund test - ${order.orderNumber}`;

  // Proportional tax refund (full = 100%)
  const refundTps = Number(order.taxTps);
  const refundTvq = Number(order.taxTvq);
  const refundTvh = Number(order.taxTvh);
  const refundPst = Number((order as Record<string, unknown>).taxPst || 0);

  // 1. Create refund accounting entries
  const entryId = await createRefundAccountingEntries(
    order.id, amount, refundTps, refundTvq, refundTvh, reason, refundPst
  );

  // 2. Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'REFUNDED',
      status: 'CANCELLED',
      adminNotes: `${order.adminNotes || ''}\n[REFUND] ${new Date().toISOString()} - $${amount} - ${reason}`,
    },
  });

  // 3. Restore stock
  for (const item of order.items) {
    if (item.formatId) {
      await prisma.productFormat.update({
        where: { id: item.formatId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }

    const lastTx = await prisma.inventoryTransaction.findFirst({
      where: { productId: item.productId, formatId: item.formatId },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });
    const wac = lastTx ? Number(lastTx.runningWAC) : 0;

    await prisma.inventoryTransaction.create({
      data: {
        productId: item.productId,
        formatId: item.formatId,
        type: 'RETURN',
        quantity: item.quantity,
        unitCost: wac,
        runningWAC: wac,
        orderId: order.id,
        reason: `UAT refund: ${reason}`,
        createdBy: 'uat-system',
      },
    });
  }

  // 4. Create credit note
  const invoice = await prisma.customerInvoice.findFirst({
    where: { orderId: order.id },
    select: { id: true },
  });

  const netRefund = amount - refundTps - refundTvq - refundTvh - refundPst;
  await createCreditNote({
    orderId: order.id,
    invoiceId: invoice?.id,
    customerName: order.shippingName,
    subtotal: netRefund,
    taxTps: refundTps,
    taxTvq: refundTvq,
    taxTvh: refundTvh,
    taxPst: refundPst,
    total: amount,
    reason,
    journalEntryId: entryId,
    issuedBy: 'uat-system',
  });
}

/**
 * Direct reship execution (same logic as admin API handler)
 */
async function executeReship(orderId: string, _testCaseId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) throw new Error(`Order not found: ${orderId}`);

  // Reship requires SHIPPED or DELIVERED status — set it for test
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'SHIPPED', shippedAt: new Date() },
    });
  }

  const reason = '[UAT] Reship test - package lost';

  // Generate replacement order number
  const year = new Date().getFullYear();
  const now = Date.now();
  const suffix = String(now).slice(-6);
  const replacementOrderNumber = `PP-${year}-R${suffix}`;

  // Create replacement order at $0
  const replacementOrder = await prisma.order.create({
    data: {
      orderNumber: replacementOrderNumber,
      userId: order.userId,
      subtotal: 0,
      shippingCost: 0,
      discount: 0,
      tax: 0,
      taxTps: 0,
      taxTvq: 0,
      taxTvh: 0,
      taxPst: 0,
      total: 0,
      currencyId: order.currencyId,
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      shippingName: order.shippingName,
      shippingAddress1: order.shippingAddress1,
      shippingAddress2: order.shippingAddress2,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostal: order.shippingPostal,
      shippingCountry: order.shippingCountry,
      shippingPhone: order.shippingPhone,
      parentOrderId: order.id,
      replacementReason: reason,
      orderType: 'REPLACEMENT',
      adminNotes: `[RESHIP] Re-expedition de ${order.orderNumber} - ${reason}`,
      items: {
        create: order.items.map((item) => ({
          productId: item.productId,
          formatId: item.formatId,
          productName: item.productName,
          formatName: item.formatName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: 0,
          discount: 0,
          total: 0,
        })),
      },
    },
  });

  // Process inventory
  let totalLossAmount = 0;

  for (const item of order.items) {
    const lastTx = await prisma.inventoryTransaction.findFirst({
      where: { productId: item.productId, formatId: item.formatId },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });
    const wac = lastTx ? Number(lastTx.runningWAC) : 0;
    totalLossAmount += wac * item.quantity;

    // LOSS on original (lost package)
    await prisma.inventoryTransaction.create({
      data: {
        productId: item.productId,
        formatId: item.formatId,
        type: 'LOSS',
        quantity: -item.quantity,
        unitCost: wac,
        runningWAC: wac,
        orderId: order.id,
        reason: `Colis perdu: ${reason}`,
        createdBy: 'uat-system',
      },
    });

    // SALE on replacement
    await prisma.inventoryTransaction.create({
      data: {
        productId: item.productId,
        formatId: item.formatId,
        type: 'SALE',
        quantity: -item.quantity,
        unitCost: wac,
        runningWAC: wac,
        orderId: replacementOrder.id,
        reason: `Re-expedition ${replacementOrderNumber}`,
        createdBy: 'uat-system',
      },
    });

    // Decrement stock
    if (item.formatId) {
      await prisma.productFormat.update({
        where: { id: item.formatId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
    }
  }

  // Create inventory loss entry
  if (totalLossAmount > 0) {
    await createInventoryLossEntry(order.id, order.orderNumber, totalLossAmount, reason);
  }

  // Generate COGS for replacement
  try {
    await generateCOGSEntry(replacementOrder.id);
  } catch (error) {
    // Non-blocking — COGS may be 0 if WAC is 0
    console.error('[AureliaPay] COGS generation for replacement order failed:', error);
  }

  // Update original order
  await prisma.order.update({
    where: { id: orderId },
    data: {
      adminNotes: `${order.adminNotes || ''}\n[RESHIP] ${new Date().toISOString()} - Re-expedition ${replacementOrderNumber} - ${reason}`,
    },
  });
}

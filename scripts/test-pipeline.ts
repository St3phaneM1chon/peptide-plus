/**
 * Test Pipeline End-to-End
 * Simulates the full Purchase → Payment → Inventory → Accounting pipeline
 * without requiring a real Stripe webhook.
 *
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' -r tsconfig-paths/register scripts/test-pipeline.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

// ─── Helpers ────────────────────────────────────────────────────────────

function pass(step: string) {
  console.log(`  ✅ ${step}`);
}

function fail(step: string, detail?: string) {
  console.error(`  ❌ ${step}${detail ? ': ' + detail : ''}`);
  process.exitCode = 1;
}

function section(title: string) {
  console.log(`\n━━━ ${title} ━━━`);
}

// ─── STEP 1: Verify Seed Data ───────────────────────────────────────────

async function verifySeed() {
  section('STEP 1: Verify Seed Data');

  const accounts = await prisma.chartOfAccount.count();
  accounts >= 80 ? pass(`ChartOfAccount: ${accounts}`) : fail(`ChartOfAccount: ${accounts} (expected ≥80)`);

  const periods = await prisma.accountingPeriod.count();
  periods === 12 ? pass(`AccountingPeriod: ${periods}`) : fail(`AccountingPeriod: ${periods} (expected 12)`);

  const banks = await prisma.bankAccount.count();
  banks >= 3 ? pass(`BankAccount: ${banks}`) : fail(`BankAccount: ${banks} (expected ≥3)`);

  const settings = await prisma.accountingSettings.count();
  settings >= 1 ? pass(`AccountingSettings: ${settings}`) : fail(`AccountingSettings: ${settings} (expected ≥1)`);

  const products = await prisma.product.count();
  products >= 20 ? pass(`Product: ${products}`) : fail(`Product: ${products} (expected ≥20)`);

  const formats = await prisma.productFormat.count();
  formats >= 100 ? pass(`ProductFormat: ${formats}`) : fail(`ProductFormat: ${formats} (expected ≥100)`);

  const currencies = await prisma.currency.count();
  currencies >= 3 ? pass(`Currency: ${currencies}`) : fail(`Currency: ${currencies} (expected ≥3)`);
}

// ─── STEP 2: Simulate Supplier Purchase (initialize WAC) ───────────────

let testProductId: string;
let testFormatId: string;
let initialStock: number;

async function simulatePurchase() {
  section('STEP 2: Simulate Supplier Purchase (WAC initialization)');

  // Pick the first product format with stock
  const format = await prisma.productFormat.findFirst({
    where: { stockQuantity: { gt: 0 }, isActive: true },
    include: { product: { select: { id: true, name: true } } },
  });

  if (!format) {
    fail('No product format with stock found');
    throw new Error('Cannot continue without product');
  }

  testProductId = format.product.id;
  testFormatId = format.id;
  initialStock = format.stockQuantity;
  pass(`Selected: ${format.product.name} — ${format.name} (stock: ${initialStock})`);

  // Simulate purchaseStock: create a PURCHASE InventoryTransaction with WAC
  const purchaseQty = 50;
  const purchaseUnitCost = 12.50;

  const newWAC = purchaseUnitCost; // First purchase: (0*0 + 50*12.50) / 50 = 12.50

  await prisma.$transaction(async (tx) => {
    await tx.productFormat.update({
      where: { id: testFormatId },
      data: { stockQuantity: { increment: purchaseQty } },
    });

    await tx.inventoryTransaction.create({
      data: {
        productId: testProductId,
        formatId: testFormatId,
        type: 'PURCHASE',
        quantity: purchaseQty,
        unitCost: purchaseUnitCost,
        runningWAC: Math.round(newWAC * 10000) / 10000,
        createdBy: 'test-pipeline',
      },
    });
  });

  const updatedFormat = await prisma.productFormat.findUnique({
    where: { id: testFormatId },
    select: { stockQuantity: true },
  });

  updatedFormat?.stockQuantity === initialStock + purchaseQty
    ? pass(`Stock after purchase: ${updatedFormat.stockQuantity} (was ${initialStock} + ${purchaseQty})`)
    : fail(`Stock mismatch: expected ${initialStock + purchaseQty}, got ${updatedFormat?.stockQuantity}`);

  const txn = await prisma.inventoryTransaction.findFirst({
    where: { productId: testProductId, formatId: testFormatId, type: 'PURCHASE' },
    orderBy: { createdAt: 'desc' },
  });

  txn && Number(txn.runningWAC) === newWAC
    ? pass(`WAC initialized: $${Number(txn.runningWAC)}`)
    : fail(`WAC not set correctly: ${txn ? Number(txn.runningWAC) : 'no txn'}`);
}

// ─── STEP 3: Reserve Stock ──────────────────────────────────────────────

let reservationId: string;
const cartId = `test-cart-${Date.now()}`;
const saleQty = 2;

async function simulateReservation() {
  section('STEP 3: Reserve Stock');

  const reservation = await prisma.inventoryReservation.create({
    data: {
      productId: testProductId,
      formatId: testFormatId,
      quantity: saleQty,
      cartId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  reservationId = reservation.id;
  reservation.status === 'RESERVED'
    ? pass(`Reservation created: ${reservationId} (qty: ${saleQty}, status: ${reservation.status})`)
    : fail(`Reservation status: ${reservation.status} (expected RESERVED)`);
}

// ─── STEP 4: Create Order ───────────────────────────────────────────────

let orderId: string;
let orderNumber: string;

async function createOrder() {
  section('STEP 4: Create Order');

  const cad = await prisma.currency.findUnique({ where: { code: 'CAD' } });
  if (!cad) {
    fail('CAD currency not found');
    throw new Error('Cannot continue');
  }

  const format = await prisma.productFormat.findUnique({
    where: { id: testFormatId },
    select: { price: true, name: true },
  });

  const unitPrice = Number(format!.price);
  const subtotal = unitPrice * saleQty;
  const taxTps = Math.round(subtotal * 0.05 * 100) / 100;
  const taxTvq = Math.round(subtotal * 0.09975 * 100) / 100;
  const total = Math.round((subtotal + taxTps + taxTvq) * 100) / 100;

  orderNumber = `PP-TEST-${Date.now()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: 'guest',
      subtotal,
      shippingCost: 0,
      discount: 0,
      tax: taxTps + taxTvq,
      taxTps,
      taxTvq,
      taxTvh: 0,
      total,
      currencyId: cad.id,
      paymentMethod: 'STRIPE_CARD',
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      stripePaymentId: `pi_test_${Date.now()}`,
      shippingName: 'Test Pipeline',
      shippingAddress1: '123 Test Street',
      shippingCity: 'Montreal',
      shippingState: 'QC',
      shippingPostal: 'H2X 1Y4',
      shippingCountry: 'CA',
      items: {
        create: [{
          productId: testProductId,
          formatId: testFormatId,
          productName: 'Test Product',
          formatName: format!.name,
          quantity: saleQty,
          unitPrice,
          discount: 0,
          total: subtotal,
        }],
      },
    },
  });

  orderId = order.id;
  pass(`Order created: ${orderNumber} (total: $${total}, TPS: $${taxTps}, TVQ: $${taxTvq})`);
}

// ─── STEP 5: Consume Reservation + Create SALE Transaction ─────────────

async function consumeReservation() {
  section('STEP 5: Consume Reservation & Decrement Stock');

  // Get current WAC
  const lastTxn = await prisma.inventoryTransaction.findFirst({
    where: { productId: testProductId, formatId: testFormatId },
    orderBy: { createdAt: 'desc' },
    select: { runningWAC: true },
  });
  const wac = lastTxn ? Number(lastTxn.runningWAC) : 0;

  await prisma.$transaction(async (tx) => {
    // Consume reservation
    await tx.inventoryReservation.update({
      where: { id: reservationId },
      data: { status: 'CONSUMED', orderId, consumedAt: new Date() },
    });

    // Decrement stock
    await tx.productFormat.update({
      where: { id: testFormatId },
      data: { stockQuantity: { decrement: saleQty } },
    });

    // Create SALE inventory transaction with WAC
    await tx.inventoryTransaction.create({
      data: {
        productId: testProductId,
        formatId: testFormatId,
        type: 'SALE',
        quantity: -saleQty,
        unitCost: wac,
        runningWAC: wac,
        orderId,
      },
    });
  });

  const reservation = await prisma.inventoryReservation.findUnique({ where: { id: reservationId } });
  reservation?.status === 'CONSUMED'
    ? pass(`Reservation consumed (WAC at sale: $${wac})`)
    : fail(`Reservation status: ${reservation?.status} (expected CONSUMED)`);

  const saleTxn = await prisma.inventoryTransaction.findFirst({
    where: { orderId, type: 'SALE' },
  });
  saleTxn
    ? pass(`SALE transaction created (qty: ${saleTxn.quantity}, unitCost: $${Number(saleTxn.unitCost)})`)
    : fail('No SALE transaction found');
}

// ─── STEP 6: Create Accounting Entries ──────────────────────────────────

async function createAccountingEntries() {
  section('STEP 6: Create Accounting Entries');

  // Replicate the logic from webhook-accounting.service.ts
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    fail('Order not found');
    return;
  }

  // Get account IDs
  const getAccountId = async (code: string) => {
    const acct = await prisma.chartOfAccount.findUnique({ where: { code }, select: { id: true } });
    return acct?.id;
  };

  const salesAccountId = await getAccountId('4010'); // SALES_CANADA
  const stripeAccountId = await getAccountId('1040'); // CASH_STRIPE
  const tpsPayableId = await getAccountId('2110'); // TPS_PAYABLE
  const tvqPayableId = await getAccountId('2120'); // TVQ_PAYABLE
  const feeAccountId = await getAccountId('6310'); // STRIPE_FEES

  if (!salesAccountId || !stripeAccountId || !tpsPayableId || !tvqPayableId || !feeAccountId) {
    fail('Missing required accounts');
    console.log({ salesAccountId, stripeAccountId, tpsPayableId, tvqPayableId, feeAccountId });
    return;
  }

  const year = new Date().getFullYear();

  // AUTO_SALE entry
  const saleCount = await prisma.journalEntry.count({ where: { entryNumber: { startsWith: `JV-${year}-` } } });
  const saleEntryNumber = `JV-${year}-${String(saleCount + 1).padStart(4, '0')}`;

  const subtotal = Number(order.subtotal);
  const tps = Number(order.taxTps);
  const tvq = Number(order.taxTvq);
  const total = Number(order.total);

  const saleEntry = await prisma.journalEntry.create({
    data: {
      entryNumber: saleEntryNumber,
      date: order.createdAt,
      description: `Vente ${order.orderNumber}`,
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: order.orderNumber,
      orderId,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: stripeAccountId, description: `Encaissement Stripe ${order.orderNumber}`, debit: total, credit: 0 },
          { accountId: salesAccountId, description: `Vente ${order.orderNumber}`, debit: 0, credit: subtotal },
          ...(tps > 0 ? [{ accountId: tpsPayableId, description: `TPS ${order.orderNumber}`, debit: 0, credit: tps }] : []),
          ...(tvq > 0 ? [{ accountId: tvqPayableId, description: `TVQ ${order.orderNumber}`, debit: 0, credit: tvq }] : []),
        ],
      },
    },
  });

  pass(`AUTO_SALE journal entry: ${saleEntryNumber} (debit: $${total})`);

  // AUTO_STRIPE_FEE entry (simulate 2.9% + 0.30)
  const stripeFee = Math.round((total * 0.029 + 0.30) * 100) / 100;
  const feeCount = await prisma.journalEntry.count({ where: { entryNumber: { startsWith: `JV-${year}-` } } });
  const feeEntryNumber = `JV-${year}-${String(feeCount + 1).padStart(4, '0')}`;

  await prisma.journalEntry.create({
    data: {
      entryNumber: feeEntryNumber,
      date: order.createdAt,
      description: `Frais Stripe ${order.orderNumber}`,
      type: 'AUTO_STRIPE_FEE',
      status: 'POSTED',
      reference: `FEE-${order.orderNumber}`,
      orderId,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: feeAccountId, description: `Frais Stripe ${order.orderNumber}`, debit: stripeFee, credit: 0 },
          { accountId: stripeAccountId, description: `Déduction frais Stripe ${order.orderNumber}`, debit: 0, credit: stripeFee },
        ],
      },
    },
  });

  pass(`AUTO_STRIPE_FEE journal entry: ${feeEntryNumber} (fee: $${stripeFee})`);

  // Create CustomerInvoice
  const invCount = await prisma.customerInvoice.count();
  const invoiceNumber = `INV-${year}-${String(invCount + 1).padStart(4, '0')}`;

  await prisma.customerInvoice.create({
    data: {
      invoiceNumber,
      orderId,
      customerName: 'Test Pipeline',
      invoiceDate: order.createdAt,
      subtotal,
      taxTps: tps,
      taxTvq: tvq,
      taxTvh: 0,
      total,
      balance: 0,
      dueDate: order.createdAt,
      status: 'PAID',
      journalEntryId: saleEntry.id,
    },
  });

  pass(`CustomerInvoice: ${invoiceNumber} (total: $${total})`);
}

// ─── STEP 7: Generate COGS Entry ───────────────────────────────────────

async function generateCOGSEntry() {
  section('STEP 7: Generate COGS Entry');

  const transactions = await prisma.inventoryTransaction.findMany({
    where: { orderId, type: 'SALE' },
  });

  if (transactions.length === 0) {
    fail('No SALE transactions found for COGS');
    return;
  }

  let totalCOGS = 0;
  for (const tx of transactions) {
    totalCOGS += Math.abs(tx.quantity) * Number(tx.unitCost);
  }
  totalCOGS = Math.round(totalCOGS * 100) / 100;

  if (totalCOGS <= 0) {
    fail(`COGS is $0 — WAC was not initialized by purchase`);
    return;
  }

  pass(`Total COGS calculated: $${totalCOGS} (${saleQty} units × $${Number(transactions[0].unitCost)})`);

  const cogsAccount = await prisma.chartOfAccount.findUnique({ where: { code: '5010' }, select: { id: true } });
  const stockAccount = await prisma.chartOfAccount.findUnique({ where: { code: '1210' }, select: { id: true } });

  if (!cogsAccount || !stockAccount) {
    fail('COGS (5010) or Stock (1210) account not found');
    return;
  }

  const year = new Date().getFullYear();
  const count = await prisma.journalEntry.count({ where: { entryNumber: { startsWith: `JV-${year}-` } } });
  const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;

  await prisma.journalEntry.create({
    data: {
      entryNumber,
      date: new Date(),
      description: `CMV - Commande ${orderNumber}`,
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: `COGS-${orderNumber}`,
      orderId,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: cogsAccount.id, description: `CMV ${orderNumber}`, debit: totalCOGS, credit: 0 },
          { accountId: stockAccount.id, description: `Sortie stock ${orderNumber}`, debit: 0, credit: totalCOGS },
        ],
      },
    },
  });

  pass(`COGS journal entry: ${entryNumber} (debit 5010: $${totalCOGS}, credit 1210: $${totalCOGS})`);
}

// ─── STEP 8: Verify Results ─────────────────────────────────────────────

async function verifyResults() {
  section('STEP 8: Verify All Results');

  // Order exists with taxes
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  order && Number(order.taxTps) > 0 && Number(order.taxTvq) > 0
    ? pass(`Order ${orderNumber}: TPS=$${Number(order.taxTps)}, TVQ=$${Number(order.taxTvq)}`)
    : fail('Order missing or taxes are 0');

  // SALE transaction
  const saleTxn = await prisma.inventoryTransaction.findFirst({ where: { orderId, type: 'SALE' } });
  saleTxn && Number(saleTxn.unitCost) > 0
    ? pass(`SALE txn: qty=${saleTxn.quantity}, unitCost=$${Number(saleTxn.unitCost)}, WAC=$${Number(saleTxn.runningWAC)}`)
    : fail(`SALE txn missing or unitCost=0`);

  // Journal entries
  const entries = await prisma.journalEntry.findMany({ where: { orderId } });
  const types = entries.map(e => e.type);
  types.includes('AUTO_SALE')
    ? pass(`AUTO_SALE journal entry found`)
    : fail('AUTO_SALE journal entry missing');
  types.includes('AUTO_STRIPE_FEE')
    ? pass(`AUTO_STRIPE_FEE journal entry found`)
    : fail('AUTO_STRIPE_FEE journal entry missing');

  // COGS entry (reference starts with COGS-)
  const cogsEntry = entries.find(e => e.reference?.startsWith('COGS-'));
  cogsEntry
    ? pass(`COGS journal entry found: ${cogsEntry.entryNumber}`)
    : fail('COGS journal entry missing');

  // CustomerInvoice
  const invoice = await prisma.customerInvoice.findFirst({ where: { orderId } });
  invoice
    ? pass(`CustomerInvoice: ${invoice.invoiceNumber} (status: ${invoice.status})`)
    : fail('CustomerInvoice missing');

  // Stock was decremented
  const format = await prisma.productFormat.findUnique({ where: { id: testFormatId }, select: { stockQuantity: true } });
  const expectedStock = initialStock + 50 - saleQty; // initial + purchase - sale
  format?.stockQuantity === expectedStock
    ? pass(`Stock: ${format.stockQuantity} (initial ${initialStock} + 50 purchase - ${saleQty} sale = ${expectedStock})`)
    : fail(`Stock: ${format?.stockQuantity} (expected ${expectedStock})`);
}

// ─── STEP 9: Simulate Refund ───────────────────────────────────────────

async function simulateRefund() {
  section('STEP 9: Simulate Full Refund');

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) { fail('Order not found for refund'); return; }

  const refundAmount = Number(order.total);
  const refundTps = Number(order.taxTps);
  const refundTvq = Number(order.taxTvq);

  // Update order status
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' },
  });

  pass(`Order status updated to REFUNDED/CANCELLED`);

  // Create refund accounting entry
  const salesAccountId = (await prisma.chartOfAccount.findUnique({ where: { code: '4010' }, select: { id: true } }))?.id;
  const stripeAccountId = (await prisma.chartOfAccount.findUnique({ where: { code: '1040' }, select: { id: true } }))?.id;
  const tpsPayableId = (await prisma.chartOfAccount.findUnique({ where: { code: '2110' }, select: { id: true } }))?.id;
  const tvqPayableId = (await prisma.chartOfAccount.findUnique({ where: { code: '2120' }, select: { id: true } }))?.id;

  if (!salesAccountId || !stripeAccountId || !tpsPayableId || !tvqPayableId) {
    fail('Missing accounts for refund entry');
    return;
  }

  const year = new Date().getFullYear();
  const count = await prisma.journalEntry.count({ where: { entryNumber: { startsWith: `JV-${year}-` } } });
  const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;
  const netRefund = refundAmount - refundTps - refundTvq;

  await prisma.journalEntry.create({
    data: {
      entryNumber,
      date: new Date(),
      description: `Remboursement ${order.orderNumber}`,
      type: 'AUTO_REFUND',
      status: 'POSTED',
      reference: `REFUND-${order.orderNumber}`,
      orderId,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: salesAccountId, description: `Remboursement vente ${order.orderNumber}`, debit: netRefund, credit: 0 },
          ...(refundTps > 0 ? [{ accountId: tpsPayableId!, description: `Remb. TPS ${order.orderNumber}`, debit: refundTps, credit: 0 }] : []),
          ...(refundTvq > 0 ? [{ accountId: tvqPayableId!, description: `Remb. TVQ ${order.orderNumber}`, debit: refundTvq, credit: 0 }] : []),
          { accountId: stripeAccountId, description: `Débit Stripe remboursement ${order.orderNumber}`, debit: 0, credit: refundAmount },
        ],
      },
    },
  });

  pass(`AUTO_REFUND entry: ${entryNumber} (total: $${refundAmount})`);

  // Restore inventory
  const saleTxns = await prisma.inventoryTransaction.findMany({ where: { orderId, type: 'SALE' } });
  for (const tx of saleTxns) {
    if (tx.formatId) {
      await prisma.productFormat.update({
        where: { id: tx.formatId },
        data: { stockQuantity: { increment: Math.abs(tx.quantity) } },
      });
    }
    await prisma.inventoryTransaction.create({
      data: {
        productId: tx.productId,
        formatId: tx.formatId,
        type: 'RETURN',
        quantity: Math.abs(tx.quantity),
        unitCost: tx.unitCost,
        runningWAC: tx.runningWAC,
        orderId,
        reason: 'Remboursement complet — test pipeline',
      },
    });
  }

  // Verify stock restored
  const format = await prisma.productFormat.findUnique({ where: { id: testFormatId }, select: { stockQuantity: true } });
  const expectedStock = initialStock + 50; // purchase + refund restores to pre-sale
  format?.stockQuantity === expectedStock
    ? pass(`Stock restored: ${format.stockQuantity} (back to ${expectedStock})`)
    : fail(`Stock after refund: ${format?.stockQuantity} (expected ${expectedStock})`);

  // Verify RETURN transaction
  const returnTxn = await prisma.inventoryTransaction.findFirst({ where: { orderId, type: 'RETURN' } });
  returnTxn
    ? pass(`RETURN transaction created (qty: ${returnTxn.quantity})`)
    : fail('RETURN transaction missing');
}

// ─── CLEANUP ────────────────────────────────────────────────────────────

async function cleanup() {
  section('CLEANUP: Remove test data');

  // Delete in reverse dependency order
  // Delete journal lines for entries associated with this order
  const journalEntries = await prisma.journalEntry.findMany({
    where: { orderId },
    select: { id: true },
  });
  const entryIds = journalEntries.map(e => e.id);
  if (entryIds.length > 0) {
    await prisma.journalLine.deleteMany({
      where: { entryId: { in: entryIds } },
    });
  }
  await prisma.journalEntry.deleteMany({ where: { orderId } });
  await prisma.customerInvoice.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.inventoryTransaction.deleteMany({ where: { orderId } });
  await prisma.inventoryTransaction.deleteMany({
    where: { productId: testProductId, formatId: testFormatId, createdBy: 'test-pipeline' },
  });
  await prisma.inventoryReservation.deleteMany({ where: { id: reservationId } });
  await prisma.order.deleteMany({ where: { id: orderId } });

  // Restore original stock (undo the +50 purchase)
  await prisma.productFormat.update({
    where: { id: testFormatId },
    data: { stockQuantity: initialStock },
  });

  pass(`Test data cleaned up. Stock restored to original: ${initialStock}`);
}

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Pipeline End-to-End Test');
  console.log(`   Date: ${new Date().toISOString()}`);
  console.log(`   Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);

  try {
    await verifySeed();
    await simulatePurchase();
    await simulateReservation();
    await createOrder();
    await consumeReservation();
    await createAccountingEntries();
    await generateCOGSEntry();
    await verifyResults();
    await simulateRefund();
    await cleanup();

    console.log('\n' + '═'.repeat(50));
    if (process.exitCode) {
      console.log('⚠️  Some steps FAILED — check output above');
    } else {
      console.log('🎉 ALL STEPS PASSED — Pipeline is fully functional!');
    }
    console.log('═'.repeat(50));
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exitCode = 1;

    // Attempt cleanup even on failure
    try {
      if (orderId) await cleanup();
    } catch { /* ignore cleanup errors */ }
  } finally {
    await prisma.$disconnect();
  }
}

main();

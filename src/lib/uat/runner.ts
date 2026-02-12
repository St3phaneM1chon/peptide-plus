/**
 * UAT Runner — Orchestrator + Cleanup
 * Sequential execution to avoid inventory race conditions
 */

import { prisma } from '@/lib/db';
import { getScenarios } from './scenarios';
import { simulateAureliaPay, executePostActions } from './aurelia-pay';
import { verifyTestCase, generateTaxReport } from './verifier';

// =====================================================
// LAUNCH UAT RUN
// =====================================================

export async function launchUatRun(canadaOnly: boolean): Promise<string> {
  const scenarios = getScenarios(canadaOnly);

  // Create the run
  const run = await prisma.uatTestRun.create({
    data: {
      status: 'RUNNING',
      canadaOnly,
      totalScenarios: scenarios.length,
    },
  });

  // Run in background (non-blocking)
  executeRun(run.id, scenarios, canadaOnly).catch((err) => {
    console.error(`[UAT] Run ${run.id} crashed:`, err);
    prisma.uatTestRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', completedAt: new Date() },
    }).catch(() => {});
  });

  return run.id;
}

async function executeRun(
  runId: string,
  scenarios: ReturnType<typeof getScenarios>,
  _canadaOnly: boolean
): Promise<void> {
  const startTime = Date.now();
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const scenario of scenarios) {
    const caseStart = Date.now();

    // Create test case
    const testCase = await prisma.uatTestCase.create({
      data: {
        runId,
        scenarioCode: scenario.code,
        scenarioName: scenario.name,
        region: scenario.region,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      // Skip zero-price scenarios if no special product exists
      if (scenario.items.some(i => i.priceRange === 'exact' && (i.exactPrice === 0 || i.exactPrice === 0.01))) {
        // These edge cases may not have matching products — handle gracefully
      }

      // Simulate payment
      const result = await simulateAureliaPay({
        scenario,
        testCaseId: testCase.id,
      });

      if (!result.success) {
        failed++;
        await prisma.uatTestCase.update({
          where: { id: testCase.id },
          data: {
            status: 'FAILED',
            durationMs: Date.now() - caseStart,
            completedAt: new Date(),
          },
        });
        // Update run counters
        await prisma.uatTestRun.update({
          where: { id: runId },
          data: { failedCount: failed, passedCount: passed, skippedCount: skipped },
        });
        continue;
      }

      // Execute post-actions (refund, reship)
      if (scenario.postActions && scenario.postActions.length > 0) {
        await executePostActions({
          orderId: result.orderId,
          actions: scenario.postActions,
          testCaseId: testCase.id,
        });
      }

      // Verify the test case
      const verification = await verifyTestCase(testCase.id);

      if (verification.passed) {
        passed++;
        await prisma.uatTestCase.update({
          where: { id: testCase.id },
          data: {
            status: 'PASSED',
            durationMs: Date.now() - caseStart,
            completedAt: new Date(),
          },
        });
      } else {
        failed++;
        await prisma.uatTestCase.update({
          where: { id: testCase.id },
          data: {
            status: 'FAILED',
            durationMs: Date.now() - caseStart,
            completedAt: new Date(),
          },
        });
      }
    } catch (error: any) {
      failed++;
      // Collect error — don't stop
      await prisma.uatTestError.create({
        data: {
          testCaseId: testCase.id,
          category: 'RUNTIME_ERROR',
          severity: 'ERROR',
          message: error.message || 'Erreur inconnue',
          stackTrace: error.stack,
          context: { scenarioCode: scenario.code },
        },
      });
      await prisma.uatTestCase.update({
        where: { id: testCase.id },
        data: {
          status: 'FAILED',
          durationMs: Date.now() - caseStart,
          completedAt: new Date(),
        },
      });
    }

    // Update run counters periodically
    await prisma.uatTestRun.update({
      where: { id: runId },
      data: { passedCount: passed, failedCount: failed, skippedCount: skipped },
    });
  }

  // Complete the run
  const durationMs = Date.now() - startTime;
  await prisma.uatTestRun.update({
    where: { id: runId },
    data: {
      status: failed > 0 ? 'FAILED' : 'COMPLETED',
      passedCount: passed,
      failedCount: failed,
      skippedCount: skipped,
      durationMs,
      completedAt: new Date(),
    },
  });
}

// =====================================================
// GET RUN STATUS (for polling)
// =====================================================

export async function getRunStatus(runId: string) {
  const run = await prisma.uatTestRun.findUnique({
    where: { id: runId },
  });

  if (!run) return null;

  const currentCase = await prisma.uatTestCase.findFirst({
    where: { runId, status: 'RUNNING' },
    select: { scenarioCode: true, scenarioName: true },
  });

  return {
    ...run,
    currentScenario: currentCase?.scenarioCode || null,
    currentScenarioName: currentCase?.scenarioName || null,
    progress: run.totalScenarios > 0
      ? Math.round(((run.passedCount + run.failedCount + run.skippedCount) / run.totalScenarios) * 100)
      : 0,
  };
}

// =====================================================
// GET RUN DETAIL
// =====================================================

export async function getRunDetail(runId: string) {
  const run = await prisma.uatTestRun.findUnique({
    where: { id: runId },
  });

  if (!run) return null;

  const testCases = await prisma.uatTestCase.findMany({
    where: { runId },
    include: {
      errors: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const taxReport = await generateTaxReport(runId);

  return { run, testCases, taxReport };
}

// =====================================================
// CLEANUP UAT RUN
// =====================================================

export async function cleanupUatRun(runId: string): Promise<{ deleted: Record<string, number> }> {
  const deleted: Record<string, number> = {};

  // Get all order IDs from this run
  const testCases = await prisma.uatTestCase.findMany({
    where: { runId, orderId: { not: null } },
    select: { orderId: true },
  });

  const orderIds = testCases.map(tc => tc.orderId).filter(Boolean) as string[];

  if (orderIds.length > 0) {
    // 1. Delete JournalEntryLines → JournalEntries
    const entries = await prisma.journalEntry.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });
    const entryIds = entries.map(e => e.id);

    if (entryIds.length > 0) {
      const lineResult = await prisma.journalLine.deleteMany({
        where: { entryId: { in: entryIds } },
      });
      deleted.journalEntryLines = lineResult.count;

      const entryResult = await prisma.journalEntry.deleteMany({
        where: { id: { in: entryIds } },
      });
      deleted.journalEntries = entryResult.count;
    }

    // 2. Delete CustomerInvoiceItems → CustomerInvoices
    const invoices = await prisma.customerInvoice.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });
    const invoiceIds = invoices.map(i => i.id);

    if (invoiceIds.length > 0) {
      const invoiceItemResult = await prisma.customerInvoiceItem.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      deleted.customerInvoiceItems = invoiceItemResult.count;

      const invoiceResult = await prisma.customerInvoice.deleteMany({
        where: { id: { in: invoiceIds } },
      });
      deleted.customerInvoices = invoiceResult.count;
    }

    // 3. Delete CreditNotes
    const creditNoteResult = await prisma.creditNote.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    deleted.creditNotes = creditNoteResult.count;

    // 4. Restore inventory & delete InventoryTransactions
    const saleTxs = await prisma.inventoryTransaction.findMany({
      where: { orderId: { in: orderIds }, type: 'SALE' },
    });

    for (const tx of saleTxs) {
      if (tx.formatId) {
        await prisma.productFormat.update({
          where: { id: tx.formatId },
          data: { stockQuantity: { increment: Math.abs(tx.quantity) } },
        });
      }
    }

    const invTxResult = await prisma.inventoryTransaction.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    deleted.inventoryTransactions = invTxResult.count;
    deleted.stockRestored = saleTxs.length;

    // 5. Delete InventoryReservations
    const reservationResult = await prisma.inventoryReservation.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    deleted.inventoryReservations = reservationResult.count;

    // 6. Delete replacement orders first (children), then main orders
    const replacementOrders = await prisma.order.findMany({
      where: { parentOrderId: { in: orderIds } },
      select: { id: true },
    });
    const replacementIds = replacementOrders.map(o => o.id);

    if (replacementIds.length > 0) {
      // Delete their items first
      await prisma.orderItem.deleteMany({ where: { orderId: { in: replacementIds } } });
      // Delete associated journal entries/invoices
      const replEntries = await prisma.journalEntry.findMany({
        where: { orderId: { in: replacementIds } },
        select: { id: true },
      });
      if (replEntries.length > 0) {
        await prisma.journalLine.deleteMany({ where: { entryId: { in: replEntries.map(e => e.id) } } });
        await prisma.journalEntry.deleteMany({ where: { id: { in: replEntries.map(e => e.id) } } });
      }
      // Delete replacement inv transactions
      await prisma.inventoryTransaction.deleteMany({ where: { orderId: { in: replacementIds } } });
      // Delete replacement orders
      await prisma.order.deleteMany({ where: { id: { in: replacementIds } } });
      deleted.replacementOrders = replacementIds.length;
    }

    // 7. Delete OrderItems → Orders
    const orderItemResult = await prisma.orderItem.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    deleted.orderItems = orderItemResult.count;

    const orderResult = await prisma.order.deleteMany({
      where: { id: { in: orderIds } },
    });
    deleted.orders = orderResult.count;
  }

  // 8. Delete UAT data (cascade handles errors → cases)
  const errorResult = await prisma.uatTestError.deleteMany({
    where: { testCase: { runId } },
  });
  deleted.uatTestErrors = errorResult.count;

  const caseResult = await prisma.uatTestCase.deleteMany({
    where: { runId },
  });
  deleted.uatTestCases = caseResult.count;

  // Mark run as cleaned up (don't delete the run itself for history)
  await prisma.uatTestRun.update({
    where: { id: runId },
    data: { cleanedUp: true },
  });
  deleted.uatRunCleanedUp = 1;

  return { deleted };
}

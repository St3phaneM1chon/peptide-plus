/**
 * Script de test UAT direct — bypass auth
 * Usage: npx tsx scripts/test-uat.ts [--cleanup] [--global]
 *
 * Options:
 *   --global   Include international scenarios (default: Canada only)
 *   --cleanup  Cleanup after test
 */

import { prisma } from '../src/lib/db';
import { launchUatRun, getRunStatus, getRunDetail, cleanupUatRun } from '../src/lib/uat/runner';
import { getScenarioStats } from '../src/lib/uat/scenarios';

async function main() {
  const args = process.argv.slice(2);
  const isGlobal = args.includes('--global');
  const doCleanup = args.includes('--cleanup');
  const canadaOnly = !isGlobal;

  console.log('=== UAT AureliaPay — Test Direct ===\n');

  // Stats
  const stats = getScenarioStats(canadaOnly);
  console.log(`Mode: ${canadaOnly ? 'Canada seulement' : 'Global (CA + US + INTL)'}`);
  console.log(`Scenarios: ${stats.total} total | ${stats.under150} <150$ avec livraison | ${stats.over150} >150$ livraison gratuite`);
  console.log(`Regions: ${stats.regions} | Pays: ${stats.countries} | Refunds: ${stats.withRefund} | Reships: ${stats.withReship}`);
  console.log('');

  // Check prerequisites
  const formatCount = await prisma.productFormat.count({ where: { isActive: true } });
  const userCount = await prisma.user.count();
  const cadCount = await prisma.currency.count({ where: { code: 'CAD' } });
  const accountCount = await prisma.chartOfAccount.count();

  console.log(`Pre-requis:`);
  console.log(`  Formats actifs: ${formatCount}`);
  console.log(`  Users: ${userCount}`);
  console.log(`  Devise CAD: ${cadCount}`);
  console.log(`  Comptes comptables: ${accountCount}`);
  console.log('');

  if (formatCount === 0 || userCount === 0 || cadCount === 0 || accountCount === 0) {
    console.error('Pre-requis manquants!');
    process.exit(1);
  }

  // Reset inventory to 200 for all active product formats
  console.log('Remise de l\'inventaire a 200 pour tous les formats actifs...');
  const resetResult = await prisma.productFormat.updateMany({
    where: { isActive: true },
    data: { stockQuantity: 200 },
  });
  console.log(`  ${resetResult.count} formats mis a 200 unites\n`);

  // Launch run
  console.log(`Lancement du run UAT (${stats.total} scenarios)...`);
  const runId = await launchUatRun(canadaOnly);
  console.log(`Run ID: ${runId}\n`);

  // Poll for completion
  let status = await getRunStatus(runId);
  const startTime = Date.now();

  while (status && status.status === 'RUNNING') {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const progress = status.progress || 0;
    const current = status.currentScenario || '...';
    const done = status.passedCount + status.failedCount + status.skippedCount;
    process.stdout.write(`\r  [${elapsed}s] ${progress}% (${done}/${status.totalScenarios}) — ${current}  P:${status.passedCount} F:${status.failedCount}          `);

    await new Promise(resolve => setTimeout(resolve, 1000));
    status = await getRunStatus(runId);
  }

  console.log('\n');

  // Get detail
  const detail = await getRunDetail(runId);
  if (!detail) {
    console.error('Impossible de charger le detail du run');
    process.exit(1);
  }

  const { run, testCases, taxReport } = detail;

  // Summary
  console.log('=== RESULTATS ===');
  console.log(`Statut: ${run.status}`);
  console.log(`Duree: ${run.durationMs ? (run.durationMs / 1000).toFixed(1) + 's' : '-'}`);
  console.log(`Total: ${run.totalScenarios} | Passes: ${run.passedCount} | Echoues: ${run.failedCount} | Sautes: ${run.skippedCount}`);
  console.log('');

  // Failed cases
  const failed = testCases.filter(tc => tc.status === 'FAILED');
  if (failed.length > 0) {
    console.log(`=== CAS ECHOUES (${failed.length}) ===`);
    for (const tc of failed) {
      console.log(`  ${tc.scenarioCode} (${tc.region}) — ${tc.scenarioName}`);
      for (const err of tc.errors) {
        console.log(`    [${err.severity}] ${err.category}: ${err.message}`);
        if (err.expected) console.log(`      Attendu: ${err.expected} | Obtenu: ${err.actual}`);
      }
    }
    console.log('');
  }

  // Passed cases summary
  const passed = testCases.filter(tc => tc.status === 'PASSED');
  if (passed.length > 0) {
    console.log(`=== CAS PASSES (${passed.length}) ===`);
    for (const tc of passed) {
      const taxes = tc.expectedTaxes as Record<string, number> | null;
      const taxStr = taxes ? `TPS:${taxes.tps || 0} TVQ:${taxes.tvq || 0} TVH:${taxes.tvh || 0} PST:${taxes.pst || 0}` : '';
      console.log(`  ✓ ${tc.scenarioCode.padEnd(25)} ${tc.region.padEnd(6)} Total:${Number(tc.expectedTotal || 0).toFixed(2).padStart(10)}$ ${taxStr}`);
    }
    console.log('');
  }

  // Tax report
  console.log('=== RAPPORT DE TAXES PAR REGION ===');
  console.log('Region   | Ventes | Total ventes  | TPS       | TVQ       | TVH       | PST       | Total tax  | Ecart');
  console.log('---------|--------|--------------|-----------|-----------|-----------|-----------|------------|------');
  for (const row of taxReport.rows) {
    const pstCollected = (row as unknown as Record<string, unknown>).pstCollected as number || 0;
    console.log(
      `${row.region.padEnd(9)}| ${String(row.salesCount).padEnd(7)}| ${row.totalSales.toFixed(2).padStart(12)}$ | ${row.tpsCollected.toFixed(2).padStart(9)}$ | ${row.tvqCollected.toFixed(2).padStart(9)}$ | ${row.tvhCollected.toFixed(2).padStart(9)}$ | ${pstCollected.toFixed(2).padStart(9)}$ | ${row.totalTaxCollected.toFixed(2).padStart(10)}$ | ${(row.difference >= 0 ? '+' : '') + row.difference.toFixed(2)}$`
    );
  }
  console.log(`TOTAL    | ${taxReport.rows.reduce((s, r) => s + r.salesCount, 0).toString().padEnd(7)}| ${taxReport.totalSales.toFixed(2).padStart(12)}$ |           |           |           |           | ${taxReport.totalTaxCollected.toFixed(2).padStart(10)}$ | ${(taxReport.totalDifference >= 0 ? '+' : '') + taxReport.totalDifference.toFixed(2)}$`);
  console.log('');

  // Inventory check
  const lowStock = await prisma.productFormat.findMany({
    where: { isActive: true, stockQuantity: { lt: 50 } },
    include: { product: { select: { name: true } } },
    orderBy: { stockQuantity: 'asc' },
    take: 10,
  });
  if (lowStock.length > 0) {
    console.log('=== INVENTAIRE BAS (< 50 unites) ===');
    for (const f of lowStock) {
      console.log(`  ${f.product.name} — ${f.name}: ${f.stockQuantity} unites`);
    }
    console.log('');
  }

  // Cleanup
  if (doCleanup) {
    console.log('Nettoyage des donnees de test...');
    const result = await cleanupUatRun(runId);
    console.log('Supprime:', result.deleted);
  } else {
    console.log(`Pour nettoyer: npx tsx scripts/test-uat.ts --cleanup`);
    console.log(`Run ID: ${runId}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

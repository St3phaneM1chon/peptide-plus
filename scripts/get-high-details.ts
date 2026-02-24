import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const types = await p.auditType.findMany({ select: { id: true, code: true } });
  for (const type of types) {
    const latestRun = await p.auditRun.findFirst({ where: { auditTypeId: type.id }, orderBy: { startedAt: 'desc' }, select: { id: true } });
    if (!latestRun) continue;
    const findings = await p.auditFinding.findMany({ where: { auditRunId: latestRun.id, severity: 'HIGH' }, select: { checkId: true, title: true, filePath: true, description: true } });
    if (findings.length === 0) continue;
    // Group by checkId
    const byCheck: Record<string, typeof findings> = {};
    for (const f of findings) {
      byCheck[f.checkId] = byCheck[f.checkId] || [];
      byCheck[f.checkId].push(f);
    }
    console.log(`\n=== ${type.code} (${findings.length} HIGH) ===`);
    for (const [checkId, items] of Object.entries(byCheck)) {
      console.log(`  [${checkId}] ${items[0].title} (${items.length}x)`);
      for (const f of items.slice(0, 3)) {
        if (f.filePath) console.log(`    - ${f.filePath}`);
      }
      if (items.length > 3) console.log(`    ... and ${items.length - 3} more`);
    }
  }
  await p.$disconnect();
}
main().catch(e => console.error(e));

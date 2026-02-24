import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const codes = ['RACE-CONDITIONS', 'API-LEAKAGE', 'WEBHOOK-IDEMPOTENCY', 'INPUT-INJECTION', 'PAYMENT-PCI', 'ACCOUNTING-INTEGRITY'];

  for (const code of codes) {
    const type = await p.auditType.findFirst({ where: { code }, select: { id: true } });
    if (!type) continue;

    const latestRun = await p.auditRun.findFirst({
      where: { auditTypeId: type.id },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (!latestRun) continue;

    const findings = await p.auditFinding.findMany({
      where: { auditRunId: latestRun.id, severity: 'CRITICAL' },
      select: { checkId: true, title: true, description: true, filePath: true },
    });

    if (findings.length === 0) continue;

    console.log(`\n=== ${code} (${findings.length} CRITICAL) ===`);
    for (const f of findings) {
      console.log(`  [${f.checkId}] ${f.title}`);
      if (f.filePath) console.log(`    Files: ${f.filePath}`);
      console.log(`    ${(f.description || '').slice(0, 200)}`);
    }
  }

  await p.$disconnect();
}
main().catch(e => console.error(e));

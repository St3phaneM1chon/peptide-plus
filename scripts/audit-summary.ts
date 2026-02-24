import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const types = await p.auditType.findMany({ select: { id: true, code: true } });
  let totalFindings = 0;
  let totalCritical = 0;
  let totalHigh = 0;

  for (const type of types) {
    const latestRun = await p.auditRun.findFirst({
      where: { auditTypeId: type.id },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (!latestRun) continue;

    const findings = await p.auditFinding.findMany({
      where: { auditRunId: latestRun.id },
      select: { severity: true },
    });

    const c = findings.filter(f => f.severity === 'CRITICAL').length;
    const h = findings.filter(f => f.severity === 'HIGH').length;
    totalFindings += findings.length;
    totalCritical += c;
    totalHigh += h;

    if (findings.length > 0) {
      console.log(`${type.code}: ${findings.length} (${c}C/${h}H)`);
    }
  }

  console.log('---');
  console.log(`TOTAL: ${totalFindings} findings (${totalCritical} CRITICAL, ${totalHigh} HIGH)`);

  await p.$disconnect();
}
main().catch(e => console.error(e));

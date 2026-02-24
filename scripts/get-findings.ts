import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const runs = await p.auditRun.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    include: {
      auditType: { select: { code: true, severity: true } },
      findings: { select: { checkId: true, severity: true, title: true, filePath: true, recommendation: true } },
    },
    take: 50,
  });

  const latest: Record<string, typeof runs[0]> = {};
  for (const r of runs) {
    if (latest[r.auditType.code] === undefined) latest[r.auditType.code] = r;
  }

  const criticalCodes = ['AUTH-SESSION', 'AUTHZ-RBAC', 'INPUT-INJECTION', 'CSRF-RATELIMIT', 'SECRETS-ENV', 'PAYMENT-PCI', 'ACCOUNTING-INTEGRITY', 'DB-INTEGRITY'];

  for (const code of criticalCodes) {
    const run = latest[code];
    if (run === undefined || run.findings.length === 0) continue;
    console.log('\n=== ' + code + ' (' + run.findings.length + ' findings) ===');

    const grouped: Record<string, { title: string; severity: string; rec: string | null; files: string[] }> = {};
    for (const f of run.findings) {
      if (grouped[f.checkId] === undefined) {
        grouped[f.checkId] = { title: f.title, severity: f.severity, rec: f.recommendation, files: [] };
      }
      if (f.filePath) grouped[f.checkId].files.push(f.filePath);
    }

    for (const [checkId, g] of Object.entries(grouped)) {
      console.log('  [' + g.severity + '] ' + checkId + ': ' + g.title);
      if (g.files.length > 0) {
        const shown = g.files.slice(0, 5).join(', ');
        const more = g.files.length > 5 ? ' +' + (g.files.length - 5) + ' more' : '';
        console.log('    Files: ' + shown + more);
      }
      if (g.rec) console.log('    Fix: ' + g.rec.substring(0, 150));
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());

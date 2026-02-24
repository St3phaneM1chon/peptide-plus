/**
 * Show detailed findings from specific audits
 * Usage: npx tsx scripts/show-findings.ts [audit-code]
 */

import * as path from 'path';
import * as fs from 'fs';

const AUDITORS_DIR = path.join(__dirname, '..', 'src', 'lib', 'auditors');

async function main() {
  const filterCode = process.argv[2]; // optional audit code to filter

  const auditorFiles = fs.readdirSync(AUDITORS_DIR).filter(f => f.endsWith('.ts') && f !== 'base-auditor.ts');

  const allResults: any[] = [];

  for (const file of auditorFiles) {
    const mod = await import(path.join(AUDITORS_DIR, file));
    const AuditorClass = mod.default;
    if (!AuditorClass) continue;
    const auditor = new AuditorClass();
    if (filterCode && auditor.auditTypeCode !== filterCode) continue;
    try {
      const results = await auditor.run();
      allResults.push(...results);
    } catch (e) {
      // skip
    }
  }

  const findings = allResults.filter((f: any) => !f.passed);

  for (const f of findings) {
    console.log(`\n[${f.severity}] ${f.checkId}: ${f.title}`);
    console.log(`  Description: ${f.description}`);
    if (f.filePath) console.log(`  File: ${f.filePath}`);
    if (f.details?.filePath) console.log(`  File: ${f.details.filePath}`);
    if (f.lineNumber || f.details?.lineNumber) console.log(`  Line: ${f.lineNumber || f.details?.lineNumber}`);
    if (f.recommendation || f.details?.recommendation) console.log(`  Fix: ${f.recommendation || f.details?.recommendation}`);
  }

  console.log(`\nTotal findings: ${findings.length}`);
}

main().catch(console.error);

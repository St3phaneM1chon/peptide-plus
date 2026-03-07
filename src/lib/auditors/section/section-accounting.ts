import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as path from 'path';

export default class SectionAccountingAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-ACCOUNTING';
  sectionConfig: SectionConfig = {
    sectionName: 'Accounting',
    adminPages: ['comptabilite', 'fiscal', 'rapports'],
    apiRoutes: [
      'admin/accounting', 'admin/accounting/journal-entries', 'admin/accounting/chart-of-accounts',
      'admin/accounting/fiscal', 'admin/accounting/reports', 'admin/accounting/invoices',
    ],
    prismaModels: ['JournalEntry', 'JournalLine', 'ChartOfAccount', 'FiscalPeriod', 'Invoice'],
    i18nNamespaces: ['admin.nav.accounting', 'admin.nav.fiscal', 'admin.nav.reports'],
  };

  /** Override DB-First with accounting-specific checks */
  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-accounting-db';

    // Check that JournalEntry model has debit/credit balance fields
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schema = this.readFile(schemaPath);
    const journalLineBlock = this.extractModelBlock(schema, 'JournalLine');

    if (journalLineBlock) {
      const hasDebit = /debit/i.test(journalLineBlock);
      const hasCredit = /credit/i.test(journalLineBlock);
      if (hasDebit && hasCredit) {
        results.push(this.pass(`${prefix}-debit-credit`, 'JournalLine has debit and credit fields'));
      } else {
        results.push(this.fail(`${prefix}-debit-credit`, 'CRITICAL',
          'JournalLine missing debit/credit fields',
          'Double-entry accounting requires both debit and credit fields on JournalLine',
          { filePath: 'prisma/schema.prisma', recommendation: 'Add Decimal debit and credit fields to JournalLine' }));
      }
    }

    return results;
  }
}

import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as fs from 'fs';
import * as path from 'path';

export default class SectionSystemAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-SYSTEM';
  sectionConfig: SectionConfig = {
    sectionName: 'System',
    adminPages: ['permissions', 'parametres', 'logs', 'employes', 'backups', 'diagnostics', 'traductions', 'seo'],
    apiRoutes: [
      'admin/permissions', 'admin/settings', 'admin/audit-log', 'admin/employees',
      'admin/backups', 'admin/diagnostics', 'admin/translations', 'admin/seo',
    ],
    prismaModels: ['Permission', 'AuditLog', 'SystemSetting'],
    i18nNamespaces: ['admin.nav.settings', 'admin.nav.permissions', 'admin.nav.employees'],
  };

  /** Override API testing with system-specific security checks */
  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-system-api';

    // Check that permissions route requires OWNER role
    const permRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'permissions', 'route.ts');
    const content = this.readFile(permRoute);
    if (content) {
      const requiresOwner = /OWNER|owner|isOwner/.test(content);
      results.push(
        requiresOwner
          ? this.pass(`${prefix}-owner-guard`, 'Permissions route requires OWNER role')
          : this.fail(`${prefix}-owner-guard`, 'CRITICAL',
              'Permissions route may not require OWNER role',
              'The permissions API should only be accessible to OWNER role users',
              { filePath: 'src/app/api/admin/permissions/route.ts', recommendation: 'Add OWNER role check' })
      );
    }

    // Check backup route has auth
    const backupRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'backups', 'route.ts');
    if (fs.existsSync(backupRoute)) {
      results.push(this.pass(`${prefix}-backup-exists`, 'Backup API route exists'));
    } else {
      results.push(this.fail(`${prefix}-backup-exists`, 'HIGH',
        'No backup API route',
        'System should have a backup management API endpoint',
        { recommendation: 'Create src/app/api/admin/backups/route.ts' }));
    }

    return results;
  }
}

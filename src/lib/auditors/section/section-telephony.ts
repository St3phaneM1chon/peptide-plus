import * as path from 'path';
import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SectionTelephonyAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-TELEPHONY';
  sectionConfig: SectionConfig = {
    sectionName: 'Telephony',
    adminPages: ['telephonie'],
    apiRoutes: ['admin/voip', 'admin/voip/call-logs', 'admin/voip/extensions', 'admin/voip/ivr'],
    prismaModels: ['VoipExtension', 'VoipCallLog', 'VoipIVR'],
    i18nNamespaces: ['admin.nav.telephony'],
  };

  // ── Angle 1: DB-First (Telephony domain checks) ─────────────

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-telephony-db';
    // Schema path handled by readPrismaSchema()
    const schema = this.readPrismaSchema();

    // VoipCallLog must have essential call tracking fields
    const callLogBlock = this.extractModelBlock(schema, 'VoipCallLog');
    if (callLogBlock) {
      const hasCallerId = /callerId|callerNumber|fromNumber|caller/.test(callLogBlock);
      results.push(
        hasCallerId
          ? this.pass(`${prefix}-calllog-callerid`, 'VoipCallLog has caller identification field')
          : this.fail(`${prefix}-calllog-callerid`, 'HIGH', 'VoipCallLog missing caller ID field',
              'Call logs must identify the caller (callerId, callerNumber, or fromNumber)',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add callerId String field to VoipCallLog' })
      );

      const hasDuration = /duration/.test(callLogBlock);
      results.push(
        hasDuration
          ? this.pass(`${prefix}-calllog-duration`, 'VoipCallLog has duration field')
          : this.fail(`${prefix}-calllog-duration`, 'HIGH', 'VoipCallLog missing duration field',
              'Call logs must track call duration for analytics and billing',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add duration Int field (seconds) to VoipCallLog' })
      );

      const hasDirection = /direction/.test(callLogBlock);
      results.push(
        hasDirection
          ? this.pass(`${prefix}-calllog-direction`, 'VoipCallLog has direction field')
          : this.fail(`${prefix}-calllog-direction`, 'MEDIUM', 'VoipCallLog missing direction field',
              'Call logs should distinguish inbound vs outbound calls',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add direction String field (inbound/outbound) to VoipCallLog' })
      );

      const hasStatus = /status/.test(callLogBlock);
      results.push(
        hasStatus
          ? this.pass(`${prefix}-calllog-status`, 'VoipCallLog has status field')
          : this.fail(`${prefix}-calllog-status`, 'MEDIUM', 'VoipCallLog missing status field',
              'Call logs should track call outcome (answered, missed, voicemail, failed)',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add status String field to VoipCallLog' })
      );
    }

    // VoipExtension must have SIP credentials / number
    const extensionBlock = this.extractModelBlock(schema, 'VoipExtension');
    if (extensionBlock) {
      const hasSipOrNumber = /sipUser|sipUsername|number|extension/.test(extensionBlock);
      results.push(
        hasSipOrNumber
          ? this.pass(`${prefix}-ext-sip`, 'VoipExtension has SIP/number identification')
          : this.fail(`${prefix}-ext-sip`, 'HIGH', 'VoipExtension missing SIP user or number',
              'Extensions need a SIP username or extension number for telephony routing',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add sipUser String and/or number String to VoipExtension' })
      );
    }

    // VoipIVR must have menu/options configuration
    const ivrBlock = this.extractModelBlock(schema, 'VoipIVR');
    if (ivrBlock) {
      const hasMenuConfig = /menu|options|config|steps|nodes|greeting|prompt/.test(ivrBlock);
      results.push(
        hasMenuConfig
          ? this.pass(`${prefix}-ivr-menu`, 'VoipIVR has menu/options configuration')
          : this.fail(`${prefix}-ivr-menu`, 'HIGH', 'VoipIVR missing menu/options configuration',
              'IVR system needs menu options (Json field or relation) to define interactive voice response trees',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add options Json or menuItems relation to VoipIVR' })
      );
    }

    return results;
  }

  // ── Angle 3: API Testing (Telephony domain checks) ──────────

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-telephony-api';

    // Call-logs API: must support date range filtering
    const callLogsRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'voip', 'call-logs', 'route.ts');
    const callLogsContent = this.readFile(callLogsRoute);
    if (callLogsContent) {
      const hasDateFilter = /startDate|endDate|from|to|dateRange|createdAt|gte|lte/.test(callLogsContent);
      results.push(
        hasDateFilter
          ? this.pass(`${prefix}-calllogs-datefilter`, 'Call-logs API supports date range filtering')
          : this.fail(`${prefix}-calllogs-datefilter`, 'MEDIUM', 'Call-logs API missing date range filter',
              'Call log queries should support date range filtering (startDate/endDate) for reporting',
              { filePath: 'src/app/api/admin/voip/call-logs/route.ts', recommendation: 'Add startDate/endDate query params with Prisma gte/lte filters' })
      );
    }

    // Extensions API: must support full CRUD
    const extRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'voip', 'extensions', 'route.ts');
    const extIdRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'voip', 'extensions', '[id]', 'route.ts');
    const extContent = this.readFile(extRoute);
    const extIdContent = this.readFile(extIdRoute);
    if (extContent || extIdContent) {
      const hasCreate = /POST/.test(extContent);
      const hasUpdate = /PUT|PATCH/.test(extIdContent);
      const hasDelete = /DELETE/.test(extIdContent);
      const fullCrud = hasCreate && hasUpdate && hasDelete;
      results.push(
        fullCrud
          ? this.pass(`${prefix}-ext-crud`, 'Extensions API supports full CRUD')
          : this.fail(`${prefix}-ext-crud`, 'MEDIUM', 'Extensions API missing CRUD operations',
              `Extension management requires POST, PUT/PATCH, DELETE. Missing: ${[!hasCreate && 'POST', !hasUpdate && 'PUT/PATCH', !hasDelete && 'DELETE'].filter(Boolean).join(', ')}`,
              { recommendation: 'Implement full CRUD for VoIP extension management' })
      );
    }

    // IVR API: must support configuration updates
    const ivrRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'voip', 'ivr', 'route.ts');
    const ivrIdRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'voip', 'ivr', '[id]', 'route.ts');
    const ivrContent = this.readFile(ivrRoute) + this.readFile(ivrIdRoute);
    if (ivrContent) {
      const hasConfigUpdate = /PUT|PATCH/.test(ivrContent) && /menu|options|config|greeting|steps/.test(ivrContent);
      results.push(
        hasConfigUpdate
          ? this.pass(`${prefix}-ivr-config`, 'IVR API supports configuration updates')
          : this.fail(`${prefix}-ivr-config`, 'MEDIUM', 'IVR API missing configuration update support',
              'IVR configuration (menu options, greetings, routing) should be updatable via PUT/PATCH',
              { recommendation: 'Add PUT/PATCH handler for IVR menu/options configuration' })
      );
    }

    return results;
  }

  // ── Angle 5: State Testing (Telephony domain checks) ────────

  protected override async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle5_stateTesting();
    const prefix = 'section-telephony-state';

    const pagePath = path.join(this.srcDir, 'app', 'admin', 'telephonie', 'page.tsx');
    const content = this.readFile(pagePath);
    if (!content) return results;

    // Empty call log state (no calls recorded yet)
    const hasEmptyCallState = /no.*call|aucun.*appel|empty.*log|\.length\s*===?\s*0|emptyState|NoCalls/i.test(content);
    results.push(
      hasEmptyCallState
        ? this.pass(`${prefix}-empty-calls`, 'Telephony page handles empty call log state')
        : this.fail(`${prefix}-empty-calls`, 'MEDIUM', 'Telephony page missing empty call log state',
            'When no calls are recorded, the page should show an informative empty state instead of a blank table',
            { filePath: 'src/app/admin/telephonie/page.tsx', recommendation: 'Add empty state component when call log list is empty' })
    );

    // Real-time status indicators (online/offline/busy)
    const hasStatusIndicator = /online|offline|busy|available|status.*indicator|StatusBadge|presence|ring|ringing/i.test(content);
    results.push(
      hasStatusIndicator
        ? this.pass(`${prefix}-realtime-status`, 'Telephony page has real-time status indicators')
        : this.fail(`${prefix}-realtime-status`, 'LOW', 'Telephony page missing real-time status indicators',
            'Extensions should show real-time presence status (online, offline, busy, ringing) for call center monitoring',
            { filePath: 'src/app/admin/telephonie/page.tsx', recommendation: 'Add status badges showing extension presence (online/offline/busy)' })
    );

    return results;
  }
}

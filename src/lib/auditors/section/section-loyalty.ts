import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as fs from 'fs';
import * as path from 'path';

export default class SectionLoyaltyAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-LOYALTY';
  sectionConfig: SectionConfig = {
    sectionName: 'Loyalty',
    adminPages: ['fidelite', 'webinaires'],
    apiRoutes: ['admin/loyalty', 'admin/loyalty/members', 'admin/webinars'],
    prismaModels: ['LoyaltyTierConfig', 'LoyaltyTransaction', 'Webinar'],
    i18nNamespaces: ['admin.nav.loyalty'],
  };

  /** Override DB-First with loyalty-specific schema checks */
  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-loyalty-db';
    // Schema path handled by readPrismaSchema()
    const schema = this.readPrismaSchema();

    // User model serves as loyalty member — must have loyaltyPoints and loyaltyTier
    const userBlock = this.extractModelBlock(schema, 'User');
    if (userBlock) {
      const hasPoints = /loyaltyPoints|points|balance/i.test(userBlock);
      const hasTier = /loyaltyTier|tier/i.test(userBlock);

      if (hasPoints) {
        results.push(this.pass(`${prefix}-member-points`, 'User has loyaltyPoints field'));
      } else {
        results.push(this.fail(`${prefix}-member-points`, 'CRITICAL',
          'User missing loyaltyPoints field',
          'A loyalty program cannot function without a points or balance field to track member rewards.',
          { filePath: 'prisma/schema.prisma', recommendation: 'Add loyaltyPoints Int @default(0) to User model' }));
      }

      if (hasTier) {
        results.push(this.pass(`${prefix}-member-tier`, 'User has loyaltyTier field'));
      } else {
        results.push(this.fail(`${prefix}-member-tier`, 'MEDIUM',
          'User missing loyaltyTier field',
          'Without a tier field, tiered benefits (Bronze/Silver/Gold/Platinum) cannot be assigned to members.',
          { filePath: 'prisma/schema.prisma', recommendation: 'Add loyaltyTier String @default("BRONZE") to User model' }));
      }
    }

    // LoyaltyTransaction must have type (EARN/REDEEM) and amount
    const txBlock = this.extractModelBlock(schema, 'LoyaltyTransaction');
    if (txBlock) {
      const hasType = /type|EARN|REDEEM/i.test(txBlock);
      const hasAmount = /amount|points/i.test(txBlock);

      if (hasType && hasAmount) {
        results.push(this.pass(`${prefix}-tx-fields`, 'LoyaltyTransaction has type and amount fields'));
      } else {
        results.push(this.fail(`${prefix}-tx-fields`, 'HIGH',
          'LoyaltyTransaction missing type or amount fields',
          `Transactions need a type (EARN/REDEEM) and amount to form a proper ledger. Found: type=${hasType}, amount=${hasAmount}`,
          { filePath: 'prisma/schema.prisma', recommendation: 'Add type String (EARN/REDEEM) and amount Int fields to LoyaltyTransaction' }));
      }
    }

    // Check for tier thresholds configuration (in schema or config file)
    const hasTierConfig = /LoyaltyTierConfig|tierThreshold|tier_threshold|SILVER|GOLD|PLATINUM/i.test(schema);
    const configPath = path.join(this.srcDir, 'lib', 'loyalty-tiers.ts');
    const altConfigPath = path.join(this.srcDir, 'lib', 'loyalty', 'tiers.ts');
    const hasTierFile = fs.existsSync(configPath) || fs.existsSync(altConfigPath);

    if (hasTierConfig || hasTierFile) {
      results.push(this.pass(`${prefix}-tier-thresholds`, 'Tier thresholds configuration found'));
    } else {
      results.push(this.fail(`${prefix}-tier-thresholds`, 'MEDIUM',
        'No tier thresholds configuration found',
        'Tier upgrade/downgrade logic requires defined point thresholds (e.g., Silver=500, Gold=2000, Platinum=5000).',
        { recommendation: 'Create src/lib/loyalty-tiers.ts with tier threshold constants or add to schema as a TierConfig model' }));
    }

    return results;
  }

  /** Override API Testing with loyalty-specific endpoint checks */
  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-loyalty-api';

    // Check loyalty API supports manual point adjustments
    const loyaltyRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'loyalty', 'route.ts');
    const membersRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'loyalty', 'members', 'route.ts');
    const memberIdRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'loyalty', 'members', '[id]', 'route.ts');
    const loyaltyContent = this.readFile(loyaltyRoutePath) + this.readFile(membersRoutePath) + this.readFile(memberIdRoutePath);

    if (loyaltyContent) {
      const hasAdjustment = /adjust|add.*points|deduct|manual|bonus/i.test(loyaltyContent);
      if (hasAdjustment) {
        results.push(this.pass(`${prefix}-point-adjustment`, 'Loyalty API supports manual point adjustments'));
      } else {
        results.push(this.fail(`${prefix}-point-adjustment`, 'MEDIUM',
          'Loyalty API lacks manual point adjustment capability',
          'Admins need the ability to manually add or deduct points for corrections, bonuses, or customer service resolutions.',
          { recommendation: 'Add PATCH/POST endpoint for manual point adjustments on /api/admin/loyalty/members/[id]' }));
      }

      // Check for tier upgrade/downgrade support
      const hasTierChange = /tier|upgrade|downgrade|promote/i.test(loyaltyContent);
      if (hasTierChange) {
        results.push(this.pass(`${prefix}-tier-management`, 'Loyalty API supports tier management'));
      } else {
        results.push(this.fail(`${prefix}-tier-management`, 'MEDIUM',
          'Loyalty API lacks tier upgrade/downgrade support',
          'No tier management logic found. Members cannot be promoted or demoted between tiers.',
          { recommendation: 'Add tier field update support in member PATCH endpoint' }));
      }
    }

    // Check for transaction history endpoint with filtering
    const txRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'loyalty', 'transactions', 'route.ts');
    if (fs.existsSync(txRoutePath)) {
      const txContent = this.readFile(txRoutePath);
      const hasFiltering = /filter|type|dateFrom|dateTo|memberId|where/i.test(txContent);
      if (hasFiltering) {
        results.push(this.pass(`${prefix}-tx-filtering`, 'Transaction history endpoint supports filtering'));
      } else {
        results.push(this.fail(`${prefix}-tx-filtering`, 'LOW',
          'Transaction history endpoint lacks filtering',
          'Transaction history should be filterable by type (EARN/REDEEM), date range, and member.',
          { filePath: 'src/app/api/admin/loyalty/transactions/route.ts', recommendation: 'Add query params for type, dateFrom, dateTo, memberId filters' }));
      }
    } else {
      results.push(this.fail(`${prefix}-tx-endpoint`, 'MEDIUM',
        'Missing transaction history endpoint',
        'No /api/admin/loyalty/transactions route found. Admins cannot view or audit point transactions.',
        { recommendation: 'Create src/app/api/admin/loyalty/transactions/route.ts with GET handler' }));
    }

    return results;
  }

  /** Override State Testing with loyalty/webinaires-specific state checks */
  protected override async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle5_stateTesting();
    const prefix = 'section-loyalty-state';

    // Check fidelite page handles zero-members state
    const fidelitePagePath = path.join(this.srcDir, 'app', 'admin', 'fidelite', 'page.tsx');
    const fideliteContent = this.readFile(fidelitePagePath);
    if (fideliteContent) {
      const hasZeroState = /no.*member|aucun.*membre|empty|\.length\s*===?\s*0|pas encore/i.test(fideliteContent);
      if (hasZeroState) {
        results.push(this.pass(`${prefix}-zero-members`, 'Fidelite page handles zero-members state'));
      } else {
        results.push(this.fail(`${prefix}-zero-members`, 'MEDIUM',
          'Fidelite page does not handle zero-members state',
          'When no loyalty members exist, the page should show an empty state guiding admins to enroll the first member.',
          { filePath: 'src/app/admin/fidelite/page.tsx', recommendation: 'Add empty state UI when member list is empty' }));
      }

      // Check for points balance display
      const hasBalance = /points|balance|solde|reward/i.test(fideliteContent);
      if (hasBalance) {
        results.push(this.pass(`${prefix}-balance-display`, 'Fidelite page displays points/balance'));
      } else {
        results.push(this.fail(`${prefix}-balance-display`, 'MEDIUM',
          'Fidelite page does not display points balance',
          'The loyalty dashboard should show each member\'s current point balance for at-a-glance management.',
          { filePath: 'src/app/admin/fidelite/page.tsx', recommendation: 'Display points balance column in member list table' }));
      }
    }

    // Check webinaires page handles no-upcoming-events state
    const webinairesPagePath = path.join(this.srcDir, 'app', 'admin', 'webinaires', 'page.tsx');
    const webinairesContent = this.readFile(webinairesPagePath);
    if (webinairesContent) {
      const hasNoEventsState = /no.*webinar|aucun.*webinaire|no.*event|empty|\.length\s*===?\s*0|pas.*prévu/i.test(webinairesContent);
      if (hasNoEventsState) {
        results.push(this.pass(`${prefix}-no-events`, 'Webinaires page handles no-upcoming-events state'));
      } else {
        results.push(this.fail(`${prefix}-no-events`, 'MEDIUM',
          'Webinaires page does not handle no-upcoming-events state',
          'When no upcoming webinars are scheduled, the page should display an empty state prompting the admin to schedule one.',
          { filePath: 'src/app/admin/webinaires/page.tsx', recommendation: 'Add empty state UI when no upcoming webinars exist' }));
      }
    }

    return results;
  }
}

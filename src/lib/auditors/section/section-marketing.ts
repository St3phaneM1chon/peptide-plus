import * as path from 'path';
import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SectionMarketingAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-MARKETING';
  sectionConfig: SectionConfig = {
    sectionName: 'Marketing',
    adminPages: ['promo-codes', 'promotions', 'newsletter', 'bannieres', 'upsell'],
    apiRoutes: ['admin/promo-codes', 'admin/promotions', 'admin/newsletter', 'admin/banners', 'admin/upsell'],
    prismaModels: ['PromoCode', 'Promotion', 'NewsletterCampaign', 'Banner', 'UpsellRule'],
    i18nNamespaces: ['admin.nav.promoCodes', 'admin.nav.newsletter'],
  };

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-marketing-db';
    // Schema path handled by readPrismaSchema()
    const schema = this.readPrismaSchema();

    // PromoCode must have essential fields
    const promoBlock = this.extractModelBlock(schema, 'PromoCode');
    if (promoBlock) {
      for (const field of ['code', 'discountType', 'discountValue', 'expiresAt', 'usageLimit']) {
        const hasField = new RegExp(`\\b${field}\\b`).test(promoBlock);
        results.push(
          hasField
            ? this.pass(`${prefix}-promo-${field}`, `PromoCode has ${field} field`)
            : this.fail(`${prefix}-promo-${field}`, 'HIGH', `PromoCode lacks ${field}`,
                `Promo code functionality requires ${field} for proper discount management`,
                { filePath: 'prisma/schema.prisma', recommendation: `Add ${field} field to PromoCode model` })
        );
      }
    }

    // Banner must have scheduling fields
    const bannerBlock = this.extractModelBlock(schema, 'Banner');
    if (bannerBlock) {
      for (const field of ['startDate', 'endDate']) {
        const hasField = new RegExp(`\\b${field}\\b`).test(bannerBlock);
        results.push(
          hasField
            ? this.pass(`${prefix}-banner-${field}`, `Banner has ${field} field`)
            : this.fail(`${prefix}-banner-${field}`, 'MEDIUM', `Banner lacks ${field}`,
                `Banner scheduling requires ${field} to control display windows`,
                { filePath: 'prisma/schema.prisma', recommendation: `Add ${field} DateTime? to Banner model` })
        );
      }
    }

    return results;
  }

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-marketing-api';

    // Promo-codes API should validate code uniqueness
    const promoRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'promo-codes', 'route.ts');
    const promoContent = this.readFile(promoRoute);
    if (promoContent) {
      const hasUniqueness = /unique|findFirst.*code|findUnique.*code|already\s*exist|duplicate|conflict/.test(promoContent);
      results.push(
        hasUniqueness
          ? this.pass(`${prefix}-promo-unique`, 'Promo-codes API validates code uniqueness')
          : this.fail(`${prefix}-promo-unique`, 'HIGH', 'Promo-codes API may lack uniqueness check',
              'POST /api/admin/promo-codes should verify the code is unique before creation',
              { filePath: 'src/app/api/admin/promo-codes/route.ts', recommendation: 'Check for existing code before insert, return 409 on conflict' })
      );
    }

    // Newsletter API should have send/schedule capability
    const newsletterRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'newsletter', 'route.ts');
    const newsletterContent = this.readFile(newsletterRoute);
    if (newsletterContent) {
      const hasSend = /send|schedule|dispatch|queue|campaign/.test(newsletterContent);
      results.push(
        hasSend
          ? this.pass(`${prefix}-newsletter-send`, 'Newsletter API has send/schedule capability')
          : this.fail(`${prefix}-newsletter-send`, 'MEDIUM', 'Newsletter API lacks send/schedule',
              'Newsletter management should support sending or scheduling campaigns',
              { filePath: 'src/app/api/admin/newsletter/route.ts', recommendation: 'Add send/schedule endpoint for campaigns' })
      );
    }

    // Banners API should support active/inactive status
    const bannersRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'banners', 'route.ts');
    const bannersContent = this.readFile(bannersRoute);
    if (bannersContent) {
      const hasStatus = /active|inactive|isActive|status|enabled|visible/.test(bannersContent);
      results.push(
        hasStatus
          ? this.pass(`${prefix}-banner-status`, 'Banners API supports active/inactive status')
          : this.fail(`${prefix}-banner-status`, 'MEDIUM', 'Banners API lacks status management',
              'Banner API should support toggling active/inactive status for display control',
              { filePath: 'src/app/api/admin/banners/route.ts', recommendation: 'Add isActive field handling in GET and PATCH' })
      );
    }

    return results;
  }

  protected override async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle5_stateTesting();
    const prefix = 'section-marketing-state';

    // Promo-codes page should show expired vs active status
    const promoPage = path.join(this.srcDir, 'app', 'admin', 'promo-codes', 'page.tsx');
    const promoContent = this.readFile(promoPage);
    if (promoContent) {
      const hasExpiredStatus = /expir|active|inactive|valid|invalid|badge|status|isExpired/.test(promoContent);
      results.push(
        hasExpiredStatus
          ? this.pass(`${prefix}-promo-expiry`, 'Promo-codes page differentiates expired vs active')
          : this.fail(`${prefix}-promo-expiry`, 'MEDIUM', 'Promo-codes page lacks expiry status display',
              'Admin should clearly see which promo codes are expired vs still active',
              { filePath: 'src/app/admin/promo-codes/page.tsx', recommendation: 'Add status badge showing Active/Expired based on expiresAt' })
      );
    }

    // Newsletter page should handle no-subscribers state
    const newsletterPage = path.join(this.srcDir, 'app', 'admin', 'newsletter', 'page.tsx');
    const newsletterContent = this.readFile(newsletterPage);
    if (newsletterContent) {
      const hasNoSubscribers = /no.*subscri|aucun.*abonn|empty|\.length\s*===?\s*0|subscri.*0|no\s+recipients/.test(newsletterContent);
      results.push(
        hasNoSubscribers
          ? this.pass(`${prefix}-newsletter-empty`, 'Newsletter page handles no-subscribers state')
          : this.fail(`${prefix}-newsletter-empty`, 'LOW', 'Newsletter page lacks no-subscribers state',
              'Sending a campaign with zero subscribers should show a clear warning or empty state',
              { filePath: 'src/app/admin/newsletter/page.tsx', recommendation: 'Add empty state when subscriber list is empty' })
      );
    }

    return results;
  }
}

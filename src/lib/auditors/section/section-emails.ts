import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as fs from 'fs';
import * as path from 'path';

export default class SectionEmailsAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-EMAILS';
  sectionConfig: SectionConfig = {
    sectionName: 'Emails',
    adminPages: ['emails', 'newsletter'],
    apiRoutes: ['admin/emails', 'admin/newsletter', 'admin/newsletter/campaigns'],
    prismaModels: ['EmailTemplate', 'NewsletterCampaign', 'NewsletterSubscriber'],
    i18nNamespaces: ['admin.nav.emails', 'admin.nav.newsletter'],
  };

  /** Override DB-First with email/newsletter-specific schema checks */
  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-emails-db';
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schema = this.readFile(schemaPath);

    // EmailTemplate must have subject, body/htmlBody, and type/trigger
    const templateBlock = this.extractModelBlock(schema, 'EmailTemplate');
    if (templateBlock) {
      const hasSubject = /subject/i.test(templateBlock);
      const hasBody = /body|htmlBody/i.test(templateBlock);
      const hasTrigger = /type|trigger/i.test(templateBlock);

      if (hasSubject && hasBody) {
        results.push(this.pass(`${prefix}-template-fields`, 'EmailTemplate has subject and body fields'));
      } else {
        results.push(this.fail(`${prefix}-template-fields`, 'HIGH',
          'EmailTemplate missing subject or body fields',
          `EmailTemplate needs subject and body/htmlBody fields for sending emails. Found: subject=${hasSubject}, body=${hasBody}`,
          { filePath: 'prisma/schema.prisma', recommendation: 'Add subject String and htmlBody String fields to EmailTemplate' }));
      }

      if (hasTrigger) {
        results.push(this.pass(`${prefix}-template-trigger`, 'EmailTemplate has type/trigger field'));
      } else {
        results.push(this.fail(`${prefix}-template-trigger`, 'MEDIUM',
          'EmailTemplate missing type/trigger field',
          'Without a type or trigger field, templates cannot be mapped to transactional events (order confirmation, password reset, etc.)',
          { filePath: 'prisma/schema.prisma', recommendation: 'Add type String or trigger String field to EmailTemplate' }));
      }
    }

    // NewsletterSubscriber must have email, status, and unsubscribe token (CASL)
    const subscriberBlock = this.extractModelBlock(schema, 'NewsletterSubscriber');
    if (subscriberBlock) {
      const hasEmail = /email/i.test(subscriberBlock);
      const hasStatus = /status|ACTIVE|UNSUBSCRIBED/i.test(subscriberBlock);
      const hasUnsubToken = /unsubscribe|token/i.test(subscriberBlock);

      if (hasEmail && hasStatus) {
        results.push(this.pass(`${prefix}-subscriber-fields`, 'NewsletterSubscriber has email and status fields'));
      } else {
        results.push(this.fail(`${prefix}-subscriber-fields`, 'HIGH',
          'NewsletterSubscriber missing email or status fields',
          `Subscribers need email and status (ACTIVE/UNSUBSCRIBED) for list management. Found: email=${hasEmail}, status=${hasStatus}`,
          { filePath: 'prisma/schema.prisma', recommendation: 'Add email String @unique and status enum (ACTIVE/UNSUBSCRIBED) to NewsletterSubscriber' }));
      }

      if (hasUnsubToken) {
        results.push(this.pass(`${prefix}-casl-token`, 'NewsletterSubscriber has unsubscribe token (CASL compliance)'));
      } else {
        results.push(this.fail(`${prefix}-casl-token`, 'HIGH',
          'NewsletterSubscriber missing unsubscribe token',
          'CASL/CAN-SPAM compliance requires a unique unsubscribe token per subscriber for one-click unsubscribe links',
          { filePath: 'prisma/schema.prisma', recommendation: 'Add unsubscribeToken String @unique @default(uuid()) to NewsletterSubscriber' }));
      }
    }

    return results;
  }

  /** Override API Testing with email-specific endpoint checks */
  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-emails-api';

    // Check newsletter API has unsubscribe endpoint
    const unsubPath = path.join(this.srcDir, 'app', 'api', 'newsletter', 'unsubscribe', 'route.ts');
    const altUnsubPath = path.join(this.srcDir, 'app', 'api', 'admin', 'newsletter', 'unsubscribe', 'route.ts');
    if (fs.existsSync(unsubPath) || fs.existsSync(altUnsubPath)) {
      results.push(this.pass(`${prefix}-unsubscribe`, 'Newsletter unsubscribe endpoint exists'));
    } else {
      results.push(this.fail(`${prefix}-unsubscribe`, 'HIGH',
        'Missing newsletter unsubscribe endpoint',
        'No /api/newsletter/unsubscribe or /api/admin/newsletter/unsubscribe route found. CASL/CAN-SPAM requires a functional unsubscribe mechanism.',
        { recommendation: 'Create src/app/api/newsletter/unsubscribe/route.ts accepting GET with token param' }));
    }

    // Check email template API supports preview/test-send
    const emailRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'emails', 'route.ts');
    const emailContent = this.readFile(emailRoutePath);
    if (emailContent) {
      const hasPreview = /preview|test.?send|sendTest/i.test(emailContent);
      if (hasPreview) {
        results.push(this.pass(`${prefix}-preview`, 'Email template API supports preview/test-send'));
      } else {
        results.push(this.fail(`${prefix}-preview`, 'MEDIUM',
          'Email template API lacks preview/test-send',
          'No preview or test-send capability found in email API. Admins cannot preview templates before sending.',
          { filePath: 'src/app/api/admin/emails/route.ts', recommendation: 'Add a POST endpoint or query param for template preview/test-send' }));
      }
    }

    // Check campaign API validates recipient list before send
    const campaignRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'newsletter', 'campaigns', 'route.ts');
    const campaignContent = this.readFile(campaignRoutePath);
    if (campaignContent) {
      const validatesRecipients = /recipient|subscriber|count|validate.*list|list.*validate/i.test(campaignContent);
      if (validatesRecipients) {
        results.push(this.pass(`${prefix}-campaign-validation`, 'Campaign API validates recipient list'));
      } else {
        results.push(this.fail(`${prefix}-campaign-validation`, 'MEDIUM',
          'Campaign API does not validate recipient list before send',
          'No recipient/subscriber validation logic found. Campaigns could be sent to empty or invalid lists.',
          { filePath: 'src/app/api/admin/newsletter/campaigns/route.ts', recommendation: 'Validate subscriber count > 0 and list status before allowing campaign send' }));
      }
    }

    return results;
  }

  /** Override State Testing with email/newsletter-specific state checks */
  protected override async angle5_stateTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle5_stateTesting();
    const prefix = 'section-emails-state';

    // Check emails page handles no-templates state
    const emailsPagePath = path.join(this.srcDir, 'app', 'admin', 'emails', 'page.tsx');
    const emailsContent = this.readFile(emailsPagePath);
    if (emailsContent) {
      const hasNoTemplatesState = /no.*template|aucun.*template|empty|\.length\s*===?\s*0/i.test(emailsContent);
      if (hasNoTemplatesState) {
        results.push(this.pass(`${prefix}-no-templates`, 'Emails page handles no-templates state'));
      } else {
        results.push(this.fail(`${prefix}-no-templates`, 'MEDIUM',
          'Emails page does not handle no-templates state',
          'When no email templates exist, the page should display an empty state with a call-to-action to create the first template.',
          { filePath: 'src/app/admin/emails/page.tsx', recommendation: 'Add empty state UI when template list is empty' }));
      }
    }

    // Check newsletter page shows subscriber count and open/click rates
    const newsletterPagePath = path.join(this.srcDir, 'app', 'admin', 'newsletter', 'page.tsx');
    const newsletterContent = this.readFile(newsletterPagePath);
    if (newsletterContent) {
      const hasSubscriberCount = /subscriber.*count|total.*subscriber|subscriberCount|nombre.*abonn/i.test(newsletterContent);
      const hasRates = /open.*rate|click.*rate|openRate|clickRate|taux/i.test(newsletterContent);

      if (hasSubscriberCount) {
        results.push(this.pass(`${prefix}-subscriber-count`, 'Newsletter page shows subscriber count'));
      } else {
        results.push(this.fail(`${prefix}-subscriber-count`, 'LOW',
          'Newsletter page does not show subscriber count',
          'Displaying total subscriber count helps admins gauge audience size before sending campaigns.',
          { filePath: 'src/app/admin/newsletter/page.tsx', recommendation: 'Show total subscriber count on newsletter dashboard' }));
      }

      if (hasRates) {
        results.push(this.pass(`${prefix}-engagement-rates`, 'Newsletter page shows open/click rates'));
      } else {
        results.push(this.fail(`${prefix}-engagement-rates`, 'LOW',
          'Newsletter page does not show open/click rates',
          'Open and click rates are key metrics for evaluating campaign performance.',
          { filePath: 'src/app/admin/newsletter/page.tsx', recommendation: 'Display open rate and click rate metrics on campaign list or detail view' }));
      }
    }

    return results;
  }
}

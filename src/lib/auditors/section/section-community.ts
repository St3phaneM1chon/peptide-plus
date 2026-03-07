
import * as path from 'path';
import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SectionCommunityAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-COMMUNITY';
  sectionConfig: SectionConfig = {
    sectionName: 'Community',
    adminPages: ['avis', 'questions', 'chat', 'ambassadeurs'],
    apiRoutes: ['admin/reviews', 'admin/questions', 'admin/chat', 'admin/ambassadors'],
    prismaModels: ['Review', 'ProductQuestion', 'ChatMessage', 'Ambassador'],
    i18nNamespaces: ['admin.nav.reviews', 'admin.nav.ambassadors'],
  };

  // ── Angle 1: DB-First (domain-specific model field checks) ───────

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-community-db';
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schema = this.readFile(schemaPath);

    // Review model: rating, verified purchase, moderation status
    const reviewBlock = this.extractModelBlock(schema, 'Review');
    if (reviewBlock) {
      const hasRating = /rating\s+Int|rating\s+Float|rating\s+Decimal/.test(reviewBlock);
      results.push(
        hasRating
          ? this.pass(`${prefix}-review-rating`, 'Review model has numeric rating field')
          : this.fail(`${prefix}-review-rating`, 'HIGH', 'Review model missing rating field',
              'The Review model should have a numeric rating field (Int or Float) for star ratings',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `rating Int` or `rating Float` to the Review model' })
      );

      const hasVerified = /verifiedPurchase|verified_purchase|isVerified/.test(reviewBlock);
      results.push(
        hasVerified
          ? this.pass(`${prefix}-review-verified`, 'Review model has verified purchase flag')
          : this.fail(`${prefix}-review-verified`, 'MEDIUM', 'Review model missing verified purchase flag',
              'Reviews should indicate whether the reviewer made a verified purchase',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `verifiedPurchase Boolean @default(false)` to Review' })
      );

      const hasModeration = /status|moderationStatus|approved|moderated/.test(reviewBlock);
      results.push(
        hasModeration
          ? this.pass(`${prefix}-review-moderation`, 'Review model has moderation status')
          : this.fail(`${prefix}-review-moderation`, 'HIGH', 'Review model missing moderation status',
              'Reviews need a status field for moderation workflow (pending/approved/rejected)',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `status String @default("PENDING")` to Review' })
      );
    }

    // ProductQuestion model: answer field
    const questionBlock = this.extractModelBlock(schema, 'ProductQuestion');
    if (questionBlock) {
      const hasAnswer = /answer\s/.test(questionBlock);
      results.push(
        hasAnswer
          ? this.pass(`${prefix}-question-answer`, 'ProductQuestion model has answer field')
          : this.fail(`${prefix}-question-answer`, 'HIGH', 'ProductQuestion model missing answer field',
              'Questions need an answer field so staff can respond to customer inquiries',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `answer String?` to ProductQuestion' })
      );
    }

    // Ambassador model: referral code and commission
    const ambassadorBlock = this.extractModelBlock(schema, 'Ambassador');
    if (ambassadorBlock) {
      const hasReferralCode = /referralCode|referral_code|code\s+String/.test(ambassadorBlock);
      results.push(
        hasReferralCode
          ? this.pass(`${prefix}-ambassador-referral`, 'Ambassador model has referral code')
          : this.fail(`${prefix}-ambassador-referral`, 'HIGH', 'Ambassador model missing referral code',
              'Ambassadors need a unique referral code for tracking referred customers',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `referralCode String @unique` to Ambassador' })
      );

      const hasCommission = /commission|commissionRate|commission_rate/.test(ambassadorBlock);
      results.push(
        hasCommission
          ? this.pass(`${prefix}-ambassador-commission`, 'Ambassador model has commission field')
          : this.fail(`${prefix}-ambassador-commission`, 'MEDIUM', 'Ambassador model missing commission field',
              'Ambassadors need a commission rate or amount for their referral rewards',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add `commissionRate Decimal @default(0)` to Ambassador' })
      );
    }

    return results;
  }

  // ── Angle 3: API Testing (moderation, answering, referral tracking) ──

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-community-api';

    // Reviews API: moderation actions (approve/reject/flag)
    const reviewRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'reviews', 'route.ts');
    const reviewIdRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'reviews', '[id]', 'route.ts');
    const reviewContent = this.readFile(reviewRoutePath) + this.readFile(reviewIdRoutePath);
    if (reviewContent) {
      const hasModeration = /approve|reject|flag|moderate|status.*APPROVED|status.*REJECTED/.test(reviewContent);
      results.push(
        hasModeration
          ? this.pass(`${prefix}-reviews-moderation`, 'Reviews API supports moderation actions')
          : this.fail(`${prefix}-reviews-moderation`, 'HIGH', 'Reviews API missing moderation actions',
              'The reviews API should support approve, reject, and flag actions for content moderation',
              { recommendation: 'Add PATCH endpoint with status transitions (approve/reject/flag)' })
      );
    }

    // Questions API: answering
    const questionsRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'questions', 'route.ts');
    const questionsIdRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'questions', '[id]', 'route.ts');
    const questionsContent = this.readFile(questionsRoutePath) + this.readFile(questionsIdRoutePath);
    if (questionsContent) {
      const hasAnswering = /answer|reply|respond/.test(questionsContent);
      results.push(
        hasAnswering
          ? this.pass(`${prefix}-questions-answering`, 'Questions API supports answering')
          : this.fail(`${prefix}-questions-answering`, 'HIGH', 'Questions API missing answer capability',
              'The questions API should allow staff to submit answers to customer questions',
              { recommendation: 'Add answer field in PUT/PATCH handler for question responses' })
      );
    }

    // Ambassador API: referral tracking
    const ambassadorRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'ambassadors', 'route.ts');
    const ambassadorIdRoutePath = path.join(this.srcDir, 'app', 'api', 'admin', 'ambassadors', '[id]', 'route.ts');
    const ambassadorContent = this.readFile(ambassadorRoutePath) + this.readFile(ambassadorIdRoutePath);
    if (ambassadorContent) {
      const hasReferralTracking = /referral|commission|tracking|earnings/.test(ambassadorContent);
      results.push(
        hasReferralTracking
          ? this.pass(`${prefix}-ambassador-referrals`, 'Ambassador API has referral tracking')
          : this.fail(`${prefix}-ambassador-referrals`, 'MEDIUM', 'Ambassador API missing referral tracking',
              'The ambassador API should expose referral counts, commission earnings, or tracking data',
              { recommendation: 'Add referral stats and commission data to ambassador GET responses' })
      );
    }

    return results;
  }

  // ── Angle 6: Interaction Testing (bulk moderation, real-time, filtering) ──

  protected override async angle6_interactionTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle6_interactionTesting();
    const prefix = 'section-community-interact';

    // Avis page: bulk moderation actions
    const avisPagePath = path.join(this.srcDir, 'app', 'admin', 'avis', 'page.tsx');
    const avisContent = this.readFile(avisPagePath);
    if (avisContent) {
      const hasBulkActions = /bulk|selectAll|selectedIds|approveAll|rejectSelected|checkbox.*select/i.test(avisContent);
      results.push(
        hasBulkActions
          ? this.pass(`${prefix}-avis-bulk`, 'Avis page has bulk moderation actions')
          : this.fail(`${prefix}-avis-bulk`, 'MEDIUM', 'Avis page missing bulk moderation actions',
              'Moderators need bulk approve/reject to handle high review volumes efficiently',
              { filePath: 'src/app/admin/avis/page.tsx', recommendation: 'Add multi-select checkboxes with bulk approve/reject buttons' })
      );

      const hasFiltering = /filter|search|status.*filter|rating.*filter/i.test(avisContent);
      results.push(
        hasFiltering
          ? this.pass(`${prefix}-avis-filter`, 'Avis page has content filtering/search')
          : this.fail(`${prefix}-avis-filter`, 'LOW', 'Avis page missing content filtering',
              'Moderators should be able to filter reviews by status, rating, or search text',
              { filePath: 'src/app/admin/avis/page.tsx', recommendation: 'Add filter controls for status, rating, and free-text search' })
      );
    }

    // Chat page: real-time indicators
    const chatPagePath = path.join(this.srcDir, 'app', 'admin', 'chat', 'page.tsx');
    const chatContent = this.readFile(chatPagePath);
    if (chatContent) {
      const hasRealTime = /WebSocket|socket|polling|setInterval|SSE|EventSource|useEffect.*fetch|refetchInterval/i.test(chatContent);
      results.push(
        hasRealTime
          ? this.pass(`${prefix}-chat-realtime`, 'Chat page has real-time update mechanism')
          : this.fail(`${prefix}-chat-realtime`, 'HIGH', 'Chat page missing real-time updates',
              'Chat requires real-time message delivery via WebSocket, SSE, or polling',
              { filePath: 'src/app/admin/chat/page.tsx', recommendation: 'Implement WebSocket connection or polling with setInterval for live messages' })
      );
    }

    return results;
  }
}

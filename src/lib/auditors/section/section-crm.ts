
import * as path from 'path';
import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SectionCRMAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-CRM';
  sectionConfig: SectionConfig = {
    sectionName: 'CRM',
    adminPages: ['crm'],
    apiRoutes: ['admin/crm', 'admin/crm/deals', 'admin/crm/contacts', 'admin/crm/pipelines', 'admin/crm/playbooks'],
    prismaModels: ['CrmDeal', 'CrmLead', 'CrmPipeline', 'CrmPlaybook'],
    i18nNamespaces: ['admin.nav.crm'],
  };

  // ── Angle 1: DB-First (CRM domain checks) ───────────────────

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-crm-db';
    // Schema path handled by readPrismaSchema()
    const schema = this.readPrismaSchema();

    // CrmPipeline must have stages (relation or JSON field)
    const pipelineBlock = this.extractModelBlock(schema, 'CrmPipeline');
    if (pipelineBlock) {
      const hasStages = /stages|CrmPipelineStage/.test(pipelineBlock);
      results.push(
        hasStages
          ? this.pass(`${prefix}-pipeline-stages`, 'CrmPipeline has stages configuration')
          : this.fail(`${prefix}-pipeline-stages`, 'HIGH', 'CrmPipeline missing stages',
              'CrmPipeline should have a stages relation (CrmPipelineStage[]) or a JSON stages field for pipeline configuration',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add stages relation or Json stages field to CrmPipeline' })
      );
    }

    // CrmDeal must have value/amount and stage reference
    const dealBlock = this.extractModelBlock(schema, 'CrmDeal');
    if (dealBlock) {
      const hasValue = /value|amount|revenue/.test(dealBlock);
      results.push(
        hasValue
          ? this.pass(`${prefix}-deal-value`, 'CrmDeal has monetary value field')
          : this.fail(`${prefix}-deal-value`, 'HIGH', 'CrmDeal missing value/amount field',
              'CrmDeal should have a value or amount field to track deal worth',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add a Decimal value or Float amount field to CrmDeal' })
      );

      const hasStage = /stage|stageId|Stage/.test(dealBlock);
      results.push(
        hasStage
          ? this.pass(`${prefix}-deal-stage`, 'CrmDeal has stage reference')
          : this.fail(`${prefix}-deal-stage`, 'MEDIUM', 'CrmDeal missing stage field',
              'CrmDeal should reference a pipeline stage to support Kanban board views',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add stageId field and relation to CrmPipelineStage' })
      );
    }

    // CrmLead must have email and phone
    const leadBlock = this.extractModelBlock(schema, 'CrmLead');
    if (leadBlock) {
      const hasEmail = /email/.test(leadBlock);
      results.push(
        hasEmail
          ? this.pass(`${prefix}-lead-email`, 'CrmLead has email field')
          : this.fail(`${prefix}-lead-email`, 'HIGH', 'CrmLead missing email field',
              'CrmLead must have an email field for contact management',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add email String field to CrmLead' })
      );

      const hasPhone = /phone/.test(leadBlock);
      results.push(
        hasPhone
          ? this.pass(`${prefix}-lead-phone`, 'CrmLead has phone field')
          : this.fail(`${prefix}-lead-phone`, 'MEDIUM', 'CrmLead missing phone field',
              'CrmLead should have a phone field for complete contact information',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add phone String? field to CrmLead' })
      );
    }

    return results;
  }

  // ── Angle 3: API Testing (CRM domain checks) ────────────────

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-crm-api';

    // Deals API: must support moving deals between stages (PATCH with stageId)
    // Check main deals routes AND dedicated move endpoint
    const dealsRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'crm', 'deals', 'route.ts');
    const dealsIdRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'crm', 'deals', '[id]', 'route.ts');
    const dealsMoveRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'crm', 'deals', '[id]', 'move', 'route.ts');
    const dealsContent = (this.readFile(dealsRoute) || '') + (this.readFile(dealsIdRoute) || '');
    const dealsMoveContent = this.readFile(dealsMoveRoute) || '';
    if (dealsContent || dealsMoveContent) {
      const hasPatchStage = (/PATCH/.test(dealsContent) && /stageId|stage/.test(dealsContent)) ||
        (/PATCH|PUT|POST/.test(dealsMoveContent) && /stageId|stage|move/.test(dealsMoveContent));
      results.push(
        hasPatchStage
          ? this.pass(`${prefix}-deals-move-stage`, 'Deals API supports moving deals between stages')
          : this.fail(`${prefix}-deals-move-stage`, 'HIGH', 'Deals API cannot move deals between stages',
              'PATCH endpoint should accept stageId to move deals across pipeline stages (Kanban drag-and-drop)',
              { recommendation: 'Add PATCH handler accepting { stageId } to update deal stage' })
      );
    }

    // Pipelines API: must support full CRUD
    const pipelinesRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'crm', 'pipelines', 'route.ts');
    const pipelinesIdRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'crm', 'pipelines', '[id]', 'route.ts');
    const pipelinesContent = this.readFile(pipelinesRoute);
    const pipelinesIdContent = this.readFile(pipelinesIdRoute);
    if (pipelinesContent || pipelinesIdContent) {
      const hasCreate = /POST/.test(pipelinesContent);
      const hasUpdate = /PUT|PATCH/.test(pipelinesIdContent);
      const hasDelete = /DELETE/.test(pipelinesIdContent);
      const fullCrud = hasCreate && hasUpdate && hasDelete;
      results.push(
        fullCrud
          ? this.pass(`${prefix}-pipelines-crud`, 'Pipelines API supports full CRUD')
          : this.fail(`${prefix}-pipelines-crud`, 'MEDIUM', 'Pipelines API missing CRUD operations',
              `Pipeline management requires POST (create), PUT/PATCH (update), DELETE. Missing: ${[!hasCreate && 'POST', !hasUpdate && 'PUT/PATCH', !hasDelete && 'DELETE'].filter(Boolean).join(', ')}`,
              { recommendation: 'Implement full CRUD for pipeline configuration' })
      );
    }

    // Playbooks API: must exist with automation rules
    const playbooksRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'crm', 'playbooks', 'route.ts');
    const playbooksContent = this.readFile(playbooksRoute);
    if (playbooksContent) {
      const hasAutomation = /rule|trigger|action|condition|automat|workflow/.test(playbooksContent);
      results.push(
        hasAutomation
          ? this.pass(`${prefix}-playbooks-automation`, 'Playbooks API handles automation rules')
          : this.fail(`${prefix}-playbooks-automation`, 'LOW', 'Playbooks API lacks automation rule handling',
              'Playbooks should support automation rules with triggers, conditions, and actions',
              { filePath: 'src/app/api/admin/crm/playbooks/route.ts', recommendation: 'Add rule/trigger/action fields to playbook schema' })
      );
    }

    return results;
  }

  // ── Angle 6: Interaction Testing (CRM domain checks) ────────

  protected override async angle6_interactionTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle6_interactionTesting();
    const prefix = 'section-crm-interact';

    const crmPagePath = path.join(this.srcDir, 'app', 'admin', 'crm', 'page.tsx');
    // Also check deals sub-page and components directory
    const dealsPagePath = path.join(this.srcDir, 'app', 'admin', 'crm', 'deals', 'page.tsx');
    const content = this.getEffectivePageContent(crmPagePath) + this.getEffectivePageContent(dealsPagePath);

    if (content) {
      // Kanban / board view for deal pipeline visualization
      const hasKanban = /kanban|Kanban|Board|board|DragDrop|drag|onDragEnd|DndContext|Droppable|Draggable/i.test(content);
      results.push(
        hasKanban
          ? this.pass(`${prefix}-kanban`, 'CRM page has Kanban/board view for deals')
          : this.fail(`${prefix}-kanban`, 'HIGH', 'CRM page missing Kanban/board view',
              'CRM deals should be displayed in a Kanban board with drag-and-drop between pipeline stages',
              { recommendation: 'Implement Kanban board using @dnd-kit or react-beautiful-dnd for deal stage management' })
      );

      // Deal creation form with required fields
      const hasDealForm = /form|Form|onSubmit|handleSubmit/.test(content) && /deal|Deal/.test(content);
      results.push(
        hasDealForm
          ? this.pass(`${prefix}-deal-form`, 'CRM page has deal creation form')
          : this.fail(`${prefix}-deal-form`, 'MEDIUM', 'CRM page missing deal creation form',
              'Users need a form to create new deals with title, value, contact, and pipeline stage',
              { recommendation: 'Add a deal creation dialog/form with required fields (title, value, stage, contact)' })
      );

      // Pipeline configuration UI
      const hasPipelineConfig = /pipeline|Pipeline/.test(content) && /config|setting|edit|manage/i.test(content);
      results.push(
        hasPipelineConfig
          ? this.pass(`${prefix}-pipeline-config`, 'CRM page has pipeline configuration UI')
          : this.fail(`${prefix}-pipeline-config`, 'LOW', 'CRM page missing pipeline configuration UI',
              'Admins should be able to configure pipeline stages (add, rename, reorder, delete stages)',
              { recommendation: 'Add pipeline settings section or dedicated settings page for stage management' })
      );
    }

    return results;
  }
}

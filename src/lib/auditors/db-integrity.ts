/**
 * DB-INTEGRITY Auditor
 * Validates Prisma schema integrity: foreign key constraints, onDelete behavior,
 * orphan prevention, unique constraints, required fields, and indexes.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as path from 'path';

interface ParsedRelation {
  modelName: string;
  fieldName: string;
  relatedModel: string;
  hasFieldsReferences: boolean;
  onDelete: string | null;
  lineNumber: number;
  rawLine: string;
}

interface ParsedModel {
  name: string;
  body: string;
  startLine: number;
  hasUniqueConstraint: boolean;
  uniqueFields: string[];
  indexes: string[];
  relations: ParsedRelation[];
  requiredFields: string[];
  optionalFields: string[];
}

export default class DbIntegrityAuditor extends BaseAuditor {
  auditTypeCode = 'DB-INTEGRITY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schemaContent = this.readFile(schemaPath);

    if (!schemaContent) {
      results.push(
        this.fail(
          'db-01',
          'CRITICAL',
          'Cannot read prisma/schema.prisma',
          'The Prisma schema file could not be read. All DB integrity checks require the schema.',
          { recommendation: 'Ensure prisma/schema.prisma exists and is readable.' }
        )
      );
      return results;
    }

    const models = this.parseModels(schemaContent);

    results.push(...this.checkForeignKeyConstraints(models));
    results.push(...this.checkOnDeleteBehavior(models));
    results.push(...this.checkOrphanScenarios(models));
    results.push(...this.checkBusinessKeyUniqueness(models, schemaContent));
    results.push(...this.checkRequiredFields(models));
    results.push(...this.checkCommonIndexes(models, schemaContent));

    return results;
  }

  /**
   * Parse all models from the Prisma schema
   */
  private parseModels(schema: string): ParsedModel[] {
    const models: ParsedModel[] = [];
    const lines = schema.split('\n');

    let currentModel: string | null = null;
    let modelBody: string[] = [];
    let modelStartLine = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const modelMatch = line.match(/^model\s+(\w+)\s*\{/);

      if (modelMatch) {
        currentModel = modelMatch[1];
        modelBody = [];
        modelStartLine = i + 1;
        braceDepth = 1;
        continue;
      }

      if (currentModel) {
        if (line.includes('{')) braceDepth++;
        if (line.includes('}')) braceDepth--;

        if (braceDepth === 0) {
          const body = modelBody.join('\n');
          const relations = this.parseRelations(currentModel, body, modelStartLine);
          const uniqueFields = this.parseUniqueConstraints(body);
          const indexes = this.parseIndexes(body);
          const { required, optional } = this.parseFieldRequiredness(body);

          models.push({
            name: currentModel,
            body,
            startLine: modelStartLine,
            hasUniqueConstraint: uniqueFields.length > 0,
            uniqueFields,
            indexes,
            relations,
            requiredFields: required,
            optionalFields: optional,
          });

          currentModel = null;
          modelBody = [];
        } else {
          modelBody.push(line);
        }
      }
    }

    return models;
  }

  private parseRelations(modelName: string, body: string, startLine: number): ParsedRelation[] {
    const relations: ParsedRelation[] = [];
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const relationMatch = line.match(/^(\w+)\s+(\w+)(\[\])?\s+@relation\s*\((.*)\)/);

      if (relationMatch) {
        const fieldName = relationMatch[1];
        const relatedModel = relationMatch[2];
        const relationArgs = relationMatch[4];

        const hasFieldsReferences = /fields:\s*\[/.test(relationArgs) && /references:\s*\[/.test(relationArgs);
        const onDeleteMatch = relationArgs.match(/onDelete:\s*(\w+)/);

        relations.push({
          modelName,
          fieldName,
          relatedModel,
          hasFieldsReferences,
          onDelete: onDeleteMatch ? onDeleteMatch[1] : null,
          lineNumber: startLine + i,
          rawLine: line,
        });
      }
    }

    return relations;
  }

  private parseUniqueConstraints(body: string): string[] {
    const fields: string[] = [];

    // @@unique constraints
    const uniqueMatches = body.matchAll(/@@unique\(\[([^\]]+)\]\)/g);
    for (const match of uniqueMatches) {
      fields.push(match[1].trim());
    }

    // @unique on individual fields
    const lines = body.split('\n');
    for (const line of lines) {
      if (/@unique/.test(line) && !line.trim().startsWith('@@')) {
        const fieldMatch = line.trim().match(/^(\w+)/);
        if (fieldMatch) {
          fields.push(fieldMatch[1]);
        }
      }
    }

    return fields;
  }

  private parseIndexes(body: string): string[] {
    const indexes: string[] = [];
    const indexMatches = body.matchAll(/@@index\(\[([^\]]+)\]\)/g);
    for (const match of indexMatches) {
      indexes.push(match[1].trim());
    }
    return indexes;
  }

  private parseFieldRequiredness(body: string): { required: string[]; optional: string[] } {
    const required: string[] = [];
    const optional: string[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines, comments, @@directives, and relation arrays
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.includes('[]')) continue;

      const fieldMatch = trimmed.match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|Json|BigInt|Decimal|Bytes)(\?)?/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const isOptional = fieldMatch[3] === '?';
        if (isOptional) {
          optional.push(fieldName);
        } else {
          required.push(fieldName);
        }
      }
    }

    return { required, optional };
  }

  /**
   * db-01: All relations must have proper foreign key constraints (fields/references)
   */
  private checkForeignKeyConstraints(models: ParsedModel[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    let missingCount = 0;

    for (const model of models) {
      for (const relation of model.relations) {
        // Only scalar-side relations (not the array side) should have fields/references
        if (!relation.rawLine.includes('[]') && !relation.hasFieldsReferences) {
          missingCount++;
          results.push(
            this.fail(
              'db-01',
              'HIGH',
              `Relation ${model.name}.${relation.fieldName} missing fields/references`,
              `The relation from ${model.name}.${relation.fieldName} to ${relation.relatedModel} does not specify fields: and references: in the @relation annotation, which means no foreign key constraint in the database.`,
              {
                filePath: 'prisma/schema.prisma',
                lineNumber: relation.lineNumber,
                codeSnippet: relation.rawLine,
                recommendation: `Add fields: [foreignKeyField] and references: [id] to the @relation annotation on ${model.name}.${relation.fieldName}.`,
              }
            )
          );
        }
      }
    }

    if (missingCount === 0) {
      results.push(this.pass('db-01', 'All scalar relations have fields/references FK constraints'));
    }

    return results;
  }

  /**
   * db-02: Check onDelete behavior on relations
   *
   * Reports a single grouped finding instead of one per relation to reduce noise.
   * The default Prisma behavior (Restrict for required, SetNull for optional) is
   * usually safe, so this is informational rather than blocking.
   */
  private checkOnDeleteBehavior(models: ParsedModel[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const missingRelations: { model: string; field: string; target: string; isOptional: boolean }[] = [];

    for (const model of models) {
      for (const relation of model.relations) {
        if (!relation.rawLine.includes('[]') && relation.hasFieldsReferences) {
          if (!relation.onDelete) {
            const isOptional = relation.rawLine.includes('?');
            missingRelations.push({
              model: model.name,
              field: relation.fieldName,
              target: relation.relatedModel,
              isOptional,
            });
          }
        }
      }
    }

    if (missingRelations.length === 0) {
      results.push(this.pass('db-02', 'All relations have explicit onDelete behavior'));
    } else {
      // Group into a single summary finding with the full list in description
      const requiredRels = missingRelations.filter((r) => !r.isOptional);
      const optionalRels = missingRelations.filter((r) => r.isOptional);

      const detailLines: string[] = [];
      if (requiredRels.length > 0) {
        detailLines.push(`Required relations (default: Restrict - blocks parent deletion):`);
        for (const r of requiredRels) {
          detailLines.push(`  - ${r.model}.${r.field} -> ${r.target}`);
        }
      }
      if (optionalRels.length > 0) {
        detailLines.push(`Optional relations (default: SetNull - clears FK on parent deletion):`);
        for (const r of optionalRels) {
          detailLines.push(`  - ${r.model}.${r.field} -> ${r.target}`);
        }
      }

      results.push(
        this.fail(
          'db-02',
          'LOW',
          `${missingRelations.length} relations missing explicit onDelete policy`,
          `${missingRelations.length} relations rely on Prisma's default deletion behavior. ` +
            `Required relations default to Restrict (safe), optional to SetNull (usually fine). ` +
            `Adding explicit onDelete improves readability and documents intent.\n\n${detailLines.join('\n')}`,
          {
            filePath: 'prisma/schema.prisma',
            recommendation:
              'Review these relations and add explicit onDelete: Cascade (for owned children), ' +
              'SetNull (for optional references), or Restrict (for mandatory references) to document intent.',
          }
        )
      );
    }

    return results;
  }

  /**
   * db-03: Check for potential orphan scenarios (child relations without cascade)
   *
   * Reports a single grouped finding. Note that Prisma's default Restrict behavior
   * actually PREVENTS orphans by blocking parent deletion -- this is usually the
   * safest default. The finding is informational to prompt a review of intent.
   */
  private checkOrphanScenarios(models: ParsedModel[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const problematicRelations: ParsedRelation[] = [];

    for (const model of models) {
      for (const relation of model.relations) {
        if (!relation.rawLine.includes('[]') && relation.hasFieldsReferences) {
          // If the FK field is required (no ?) and onDelete is not Cascade or SetNull
          const isRequiredRelation = !relation.rawLine.includes('?');
          if (isRequiredRelation && relation.onDelete !== 'Cascade' && relation.onDelete !== 'SetNull') {
            problematicRelations.push(relation);
          }
        }
      }
    }

    if (problematicRelations.length === 0) {
      results.push(this.pass('db-03', 'No potential orphan scenarios detected in required relations'));
    } else {
      // Deduplicate
      const uniqueRelations = new Map<string, ParsedRelation>();
      for (const rel of problematicRelations) {
        const key = `${rel.modelName}.${rel.fieldName}`;
        if (!uniqueRelations.has(key)) {
          uniqueRelations.set(key, rel);
        }
      }

      // Build a grouped description with all relations listed
      const detailLines = Array.from(uniqueRelations.values()).map(
        (rel) =>
          `  - ${rel.modelName}.${rel.fieldName} -> ${rel.relatedModel} (onDelete: ${rel.onDelete || 'default Restrict'})`
      );

      results.push(
        this.fail(
          'db-03',
          'LOW',
          `${uniqueRelations.size} required relations use default Restrict (review for orphan prevention)`,
          `${uniqueRelations.size} required relations use onDelete: Restrict (the Prisma default). ` +
            `This prevents orphans by blocking parent deletion, which is usually safe. ` +
            `Review whether Cascade is more appropriate for owned child records.\n\n${detailLines.join('\n')}`,
          {
            filePath: 'prisma/schema.prisma',
            recommendation:
              'For each relation, decide: Cascade (auto-delete children with parent), ' +
              'or keep Restrict (block parent deletion if children exist). ' +
              'Add explicit onDelete to document the decision.',
          }
        )
      );
    }

    return results;
  }

  /**
   * db-04: Business key fields (email, slug, code) should have @@unique
   *
   * Only flags entity models where duplicates indicate a real data integrity issue.
   * Transactional, log, execution, and singleton models are excluded because
   * their email/sku/username fields legitimately allow duplicates.
   */
  private checkBusinessKeyUniqueness(models: ParsedModel[], schema: string): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const businessKeyFields = ['email', 'slug', 'code', 'sku', 'username', 'handle'];

    // Models where duplicate business keys are expected by design:
    // - Transactional/line-item models: OrderItem, PurchaseOrderItem (same SKU across orders)
    // - Log/event models: EmailBounce, EmailFlowExecution, AuditTrail (multiple entries per email/user)
    // - Consent/history models: ConsentRecord (multiple consent records over time)
    // - Contact models: SupplierContact (multiple contacts can share emails)
    // - Singleton/settings models: SiteSettings (only one row, unique is meaningless)
    // - Alert/notification models: StockAlert (same email for multiple product alerts)
    const transactionalModels = new Set([
      'OrderItem',
      'PurchaseOrderItem',
      'EmailBounce',
      'EmailFlowExecution',
      'EmailFlowLog',
      'AuditTrail',
      'ConsentRecord',
      'SupplierContact',
      'SiteSettings',
      'StockAlert',
      'EmailLog',
      'NotificationLog',
      'ActivityLog',
      'LoginHistory',
      'PasswordHistory',
    ]);

    // Per-model field exclusions for fields that look like business keys but aren't unique
    // Format: { ModelName: Set<fieldName> }
    const fieldExclusions: Record<string, Set<string>> = {
      // AuditTrail.userName is a cached display name, not a unique identifier
      AuditTrail: new Set(['userName', 'username']),
    };

    const missingUniques: { model: string; field: string }[] = [];

    for (const model of models) {
      // Skip transactional/log/singleton models entirely
      if (transactionalModels.has(model.name)) continue;

      const bodyLines = model.body.split('\n');
      const modelFieldExclusions = fieldExclusions[model.name];

      for (const line of bodyLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

        for (const keyField of businessKeyFields) {
          // Check per-model field exclusions
          if (modelFieldExclusions?.has(keyField)) continue;

          // Match field definitions like: email String @unique or email String?
          const fieldPattern = new RegExp(`^${keyField}\\s+String`, 'i');
          if (fieldPattern.test(trimmed)) {
            // Also extract the actual field name from the line (handles camelCase like userName)
            const actualFieldMatch = trimmed.match(/^(\w+)/);
            const actualFieldName = actualFieldMatch ? actualFieldMatch[1] : keyField;

            const hasUniqueOnField = /@unique/.test(trimmed);
            const hasUniqueInComposite = model.uniqueFields.some(
              (u) => u.includes(keyField) || u.includes(actualFieldName)
            );

            if (!hasUniqueOnField && !hasUniqueInComposite) {
              missingUniques.push({ model: model.name, field: actualFieldName });
            }
          }
        }
      }
    }

    if (missingUniques.length === 0) {
      results.push(this.pass('db-04', 'All business key fields (email, slug, code, sku) have unique constraints'));
    } else {
      for (const { model, field } of missingUniques) {
        // Find line number in full schema
        const searchStr = new RegExp(`model ${model}[\\s\\S]*?${field}\\s+String`);
        const match = schema.match(searchStr);
        const lineNum = match ? this.findLineNumber(schema, field) : 0;

        results.push(
          this.fail(
            'db-04',
            'HIGH',
            `${model}.${field} missing @unique constraint`,
            `The field ${field} in model ${model} is a business key but lacks a @unique or @@unique constraint. This allows duplicate values.`,
            {
              filePath: 'prisma/schema.prisma',
              lineNumber: lineNum,
              recommendation: `Add @unique to the ${field} field in model ${model}, or add @@unique([${field}]) if part of a composite key.`,
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * db-05: Verify required fields are appropriately set
   *
   * Note: User.name is intentionally NOT listed as required because OAuth/social
   * login providers (Google, GitHub, etc.) do not always return a display name.
   */
  private checkRequiredFields(models: ParsedModel[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Fields that should typically be required (not optional) in most models
    // User.name excluded: OAuth providers don't always return a name
    const shouldBeRequired: Record<string, string[]> = {
      User: ['email'],
      Product: ['name', 'price'],
      Order: ['status', 'userId'],
      Category: ['name'],
    };

    let issueCount = 0;

    for (const model of models) {
      const expectedRequired = shouldBeRequired[model.name];
      if (!expectedRequired) continue;

      for (const fieldName of expectedRequired) {
        if (model.optionalFields.includes(fieldName)) {
          issueCount++;
          results.push(
            this.fail(
              'db-05',
              'MEDIUM',
              `${model.name}.${fieldName} is optional but should likely be required`,
              `The field ${fieldName} in model ${model.name} is marked as optional (?) but is typically a required business field.`,
              {
                filePath: 'prisma/schema.prisma',
                recommendation: `Review if ${model.name}.${fieldName} should be required. If so, remove the ? and ensure existing data has values.`,
              }
            )
          );
        }
      }
    }

    if (issueCount === 0) {
      results.push(this.pass('db-05', 'Core business fields are properly marked as required'));
    }

    return results;
  }

  /**
   * db-06: Commonly filtered fields should have @@index
   *
   * Reports a single consolidated finding listing all models with missing indexes,
   * rather than one finding per model, to reduce noise from this LOW-severity check.
   */
  private checkCommonIndexes(models: ParsedModel[], _schema: string): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Fields that are commonly filtered/sorted and should have indexes
    const commonlyFiltered = ['status', 'createdAt', 'updatedAt', 'userId', 'email', 'slug', 'categoryId', 'orderId'];

    const missingIndexes: { model: string; field: string }[] = [];

    for (const model of models) {
      const bodyLines = model.body.split('\n');

      for (const line of bodyLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

        for (const field of commonlyFiltered) {
          const fieldPattern = new RegExp(`^${field}\\s+`, 'i');
          if (fieldPattern.test(trimmed)) {
            // Check if this field has an index
            const hasIndex = model.indexes.some((idx) => idx.includes(field));
            const hasUniqueIndex = /@unique/.test(trimmed) || model.uniqueFields.some((u) => u.includes(field));
            const isId = /@id/.test(trimmed);

            // Fields that are @id or @unique are already indexed
            if (!hasIndex && !hasUniqueIndex && !isId) {
              // Only report if the model has a significant number of potential records
              const isLargeModel = /User|Product|Order|Category|Payment|Invoice|JournalEntry|JournalLine|Translation/i.test(model.name);
              if (isLargeModel) {
                missingIndexes.push({ model: model.name, field });
              }
            }
          }
        }
      }
    }

    if (missingIndexes.length === 0) {
      results.push(this.pass('db-06', 'Commonly filtered fields in key models have indexes'));
    } else {
      // Group by model, then emit a SINGLE consolidated finding
      const byModel = new Map<string, string[]>();
      for (const { model, field } of missingIndexes) {
        if (!byModel.has(model)) byModel.set(model, []);
        byModel.get(model)!.push(field);
      }

      const detailLines: string[] = [];
      for (const [modelName, fields] of byModel) {
        detailLines.push(`  - ${modelName}: ${fields.join(', ')}`);
      }

      results.push(
        this.fail(
          'db-06',
          'LOW',
          `${byModel.size} models missing indexes on commonly filtered fields`,
          `${missingIndexes.length} fields across ${byModel.size} models lack @@index directives. ` +
            `These fields are commonly used in WHERE/ORDER BY clauses and would benefit from indexing ` +
            `as data grows.\n\n${detailLines.join('\n')}`,
          {
            filePath: 'prisma/schema.prisma',
            recommendation:
              'Add @@index([fieldName]) for each listed field in the respective models. ' +
              'Prioritize fields used in frequent queries (status, userId, createdAt).',
          }
        )
      );
    }

    return results;
  }
}

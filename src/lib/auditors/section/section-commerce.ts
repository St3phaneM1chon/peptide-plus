import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as fs from 'fs';
import * as path from 'path';

export default class SectionCommerceAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-COMMERCE';
  sectionConfig: SectionConfig = {
    sectionName: 'Commerce',
    adminPages: ['commandes', 'customers', 'clients', 'abonnements', 'inventaire', 'fournisseurs'],
    apiRoutes: ['admin/commandes', 'admin/customers', 'orders', 'admin/suppliers', 'admin/inventory'],
    prismaModels: ['Order', 'User', 'Company', 'Subscription', 'Product'],
    i18nNamespaces: ['admin.nav.orders', 'admin.nav.customers'],
  };

  /** Override DB-First with commerce-specific model checks */
  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-commerce-db';
    // Schema path handled by readPrismaSchema()
    const schema = this.readPrismaSchema();

    // Check Order model has status field with workflow states
    const orderBlock = this.extractModelBlock(schema, 'Order');
    if (orderBlock) {
      const hasStatus = /status/i.test(orderBlock);
      results.push(
        hasStatus
          ? this.pass(`${prefix}-order-status`, 'Order model has status field')
          : this.fail(`${prefix}-order-status`, 'CRITICAL',
              'Order model missing status field',
              'Orders need a status field to track workflow states (PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED)',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add an OrderStatus enum and status field to Order model' })
      );

      // Check for workflow enum values
      const statusEnum = schema.match(/enum\s+OrderStatus\s*\{([^}]+)\}/s);
      if (statusEnum) {
        const enumBody = statusEnum[1];
        const requiredStates = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        const missingStates = requiredStates.filter(s => !enumBody.includes(s));
        results.push(
          missingStates.length === 0
            ? this.pass(`${prefix}-order-workflow`, 'OrderStatus enum has all workflow states')
            : this.fail(`${prefix}-order-workflow`, 'HIGH',
                `OrderStatus enum missing states: ${missingStates.join(', ')}`,
                `A complete order workflow needs: ${requiredStates.join(', ')}`,
                { filePath: 'prisma/schema.prisma', recommendation: `Add missing states to OrderStatus enum: ${missingStates.join(', ')}` })
        );
      }
    }

    // Check Subscription model has recurring billing fields
    const subBlock = this.extractModelBlock(schema, 'Subscription');
    if (subBlock) {
      const hasInterval = /interval|frequency|period/i.test(subBlock);
      const hasNextBilling = /nextBilling|nextPayment|renewalDate|nextDate/i.test(subBlock);
      if (hasInterval && hasNextBilling) {
        results.push(this.pass(`${prefix}-sub-billing`, 'Subscription model has interval and next billing date'));
      } else {
        const missing = [];
        if (!hasInterval) missing.push('interval/frequency');
        if (!hasNextBilling) missing.push('nextBillingDate');
        results.push(this.fail(`${prefix}-sub-billing`, 'HIGH',
          `Subscription model missing billing fields: ${missing.join(', ')}`,
          'Recurring billing requires interval and next billing date fields for scheduled charges',
          { filePath: 'prisma/schema.prisma', recommendation: `Add ${missing.join(' and ')} fields to Subscription model` }));
      }
    }

    // Check Product model has inventory-related fields
    const productBlock = this.extractModelBlock(schema, 'Product');
    if (productBlock) {
      const hasStock = /stock|quantity|inventory/i.test(productBlock);
      results.push(
        hasStock
          ? this.pass(`${prefix}-product-stock`, 'Product model has stock/inventory field')
          : this.fail(`${prefix}-product-stock`, 'HIGH',
              'Product model missing stock tracking field',
              'E-commerce products should have stockQuantity or inventory tracking to prevent overselling',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add stockQuantity Int field to Product model' })
      );
    }

    return results;
  }

  /** Override API testing with order workflow and inventory route checks */
  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-commerce-api';

    // Check order routes support status transitions (PATCH with status)
    const orderRouteFiles = [
      path.join(this.srcDir, 'app', 'api', 'admin', 'orders', '[id]', 'route.ts'),
      path.join(this.srcDir, 'app', 'api', 'admin', 'commandes', '[id]', 'route.ts'),
    ];
    let foundStatusTransition = false;
    for (const routeFile of orderRouteFiles) {
      const content = this.readFile(routeFile);
      if (content && /PATCH|PUT/.test(content) && /status/.test(content)) {
        foundStatusTransition = true;
        break;
      }
    }
    results.push(
      foundStatusTransition
        ? this.pass(`${prefix}-status-transition`, 'Order API supports status transitions')
        : this.fail(`${prefix}-status-transition`, 'HIGH',
            'No order status transition API',
            'Admin should be able to update order status (e.g., PENDING -> CONFIRMED -> SHIPPED) via PATCH',
            { recommendation: 'Add PATCH handler with status field to admin/orders/[id]/route.ts' })
    );

    // Check inventory update route exists
    const inventoryRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'inventory', 'route.ts');
    results.push(
      fs.existsSync(inventoryRoute)
        ? this.pass(`${prefix}-inventory-route`, 'Inventory management API route exists')
        : this.fail(`${prefix}-inventory-route`, 'MEDIUM',
            'No inventory management API route',
            'Stock levels should be manageable through a dedicated inventory endpoint',
            { recommendation: 'Create src/app/api/admin/inventory/route.ts with GET/PATCH handlers' })
    );

    // Check order cancellation route exists
    const cancelPaths = [
      path.join(this.srcDir, 'app', 'api', 'admin', 'orders', '[id]', 'cancel', 'route.ts'),
      path.join(this.srcDir, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts'),
    ];
    const hasCancelRoute = cancelPaths.some(p => fs.existsSync(p));
    results.push(
      hasCancelRoute
        ? this.pass(`${prefix}-cancel-route`, 'Order cancellation route exists')
        : this.fail(`${prefix}-cancel-route`, 'MEDIUM',
            'No dedicated order cancellation route',
            'Order cancellation should have its own endpoint for audit trail and refund logic',
            { recommendation: 'Create src/app/api/orders/[id]/cancel/route.ts' })
    );

    return results;
  }

  /** Override interaction testing with commerce-specific UX checks */
  protected override async angle6_interactionTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle6_interactionTesting();
    const prefix = 'section-commerce-interact';

    // Check commandes page for bulk actions
    const commandesPage = path.join(this.srcDir, 'app', 'admin', 'commandes', 'page.tsx');
    const content = this.getEffectivePageContent(commandesPage);
    if (content) {
      const hasBulkActions = /selectAll|bulkAction|bulk|selectedIds|selectedRows|checkbox.*select/i.test(content);
      results.push(
        hasBulkActions
          ? this.pass(`${prefix}-bulk-actions`, 'Commandes page has bulk action support')
          : this.fail(`${prefix}-bulk-actions`, 'MEDIUM',
              'No bulk actions on commandes page',
              'Admin should be able to select multiple orders and apply bulk status updates',
              { filePath: 'src/app/admin/commandes/page.tsx', recommendation: 'Add checkbox selection and bulk action toolbar' })
      );

      // Check for export functionality (CSV/PDF)
      const hasExport = /export|csv|CSV|pdf|PDF|download|telecharger/i.test(content);
      results.push(
        hasExport
          ? this.pass(`${prefix}-export`, 'Commandes page has export functionality')
          : this.fail(`${prefix}-export`, 'LOW',
              'No export feature on commandes page',
              'Admin should be able to export order data to CSV or PDF for accounting',
              { filePath: 'src/app/admin/commandes/page.tsx', recommendation: 'Add CSV/PDF export button' })
      );

      // Check for order detail link or modal
      const hasDetailLink = /Link.*href|onClick.*detail|modal.*order|Dialog|\/commandes\/|\/orders\//i.test(content);
      results.push(
        hasDetailLink
          ? this.pass(`${prefix}-detail-link`, 'Commandes page links to order details')
          : this.fail(`${prefix}-detail-link`, 'MEDIUM',
              'No order detail link/modal on commandes page',
              'Each order row should link to a detail view or open a detail modal',
              { filePath: 'src/app/admin/commandes/page.tsx', recommendation: 'Add Link or modal to view full order details' })
      );
    }

    return results;
  }
}

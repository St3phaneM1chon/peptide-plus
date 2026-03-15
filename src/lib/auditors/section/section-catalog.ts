import * as path from 'path';
import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class SectionCatalogAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-CATALOG';
  sectionConfig: SectionConfig = {
    sectionName: 'Catalog',
    adminPages: ['produits', 'categories'],
    apiRoutes: ['admin/products', 'admin/categories', 'products', 'categories'],
    prismaModels: ['Product', 'Category', 'ProductTranslation', 'CategoryTranslation'],
    i18nNamespaces: ['admin.nav.products', 'admin.nav.categories'],
  };

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'section-catalog-db';
    // Schema path handled by readPrismaSchema()
    const schema = this.readPrismaSchema();

    // Category must support parent/child hierarchy via parentId
    const categoryBlock = this.extractModelBlock(schema, 'Category');
    if (categoryBlock) {
      const hasParentId = /parentId/.test(categoryBlock);
      results.push(
        hasParentId
          ? this.pass(`${prefix}-category-hierarchy`, 'Category model has parentId for hierarchy')
          : this.fail(`${prefix}-category-hierarchy`, 'HIGH', 'Category model lacks parentId',
              'Parent/child hierarchy requires a parentId self-relation on Category',
              { filePath: 'prisma/schema.prisma', recommendation: 'Add parentId Int? and parent/children self-relations to Category' })
      );
    }

    // Product must have essential e-commerce fields
    const productBlock = this.extractModelBlock(schema, 'Product');
    if (productBlock) {
      for (const field of ['price', 'sku', 'slug']) {
        const hasField = new RegExp(`\\b${field}\\b`).test(productBlock);
        results.push(
          hasField
            ? this.pass(`${prefix}-product-${field}`, `Product model has ${field} field`)
            : this.fail(`${prefix}-product-${field}`, 'HIGH', `Product model lacks ${field}`,
                `E-commerce products require a ${field} field for storefront functionality`,
                { filePath: 'prisma/schema.prisma', recommendation: `Add ${field} field to Product model` })
        );
      }
    }

    // ProductTranslation must have name and description
    const ptBlock = this.extractModelBlock(schema, 'ProductTranslation');
    if (ptBlock) {
      for (const field of ['name', 'description']) {
        const hasField = new RegExp(`\\b${field}\\b`).test(ptBlock);
        results.push(
          hasField
            ? this.pass(`${prefix}-pt-${field}`, `ProductTranslation has ${field} field`)
            : this.fail(`${prefix}-pt-${field}`, 'MEDIUM', `ProductTranslation lacks ${field}`,
                `Translated product content needs a ${field} field for multilingual display`,
                { filePath: 'prisma/schema.prisma', recommendation: `Add ${field} String to ProductTranslation` })
        );
      }
    }

    return results;
  }

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'section-catalog-api';

    // Products API should support filtering by category
    const productsRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'products', 'route.ts');
    const productsContent = this.readFile(productsRoute);
    if (productsContent) {
      const hasCategoryFilter = /categoryId|category/.test(productsContent);
      results.push(
        hasCategoryFilter
          ? this.pass(`${prefix}-filter-category`, 'Products API supports category filtering')
          : this.fail(`${prefix}-filter-category`, 'MEDIUM', 'Products API lacks category filtering',
              'GET /api/admin/products should accept a categoryId query parameter to filter by category',
              { filePath: 'src/app/api/admin/products/route.ts', recommendation: 'Add categoryId filter to GET handler' })
      );
    }

    // Categories API should support tree/hierarchy retrieval
    const categoriesRoute = path.join(this.srcDir, 'app', 'api', 'admin', 'categories', 'route.ts');
    const categoriesContent = this.readFile(categoriesRoute);
    if (categoriesContent) {
      const hasTree = /parent|children|tree|hierarchy|nested|include.*children/.test(categoriesContent);
      results.push(
        hasTree
          ? this.pass(`${prefix}-category-tree`, 'Categories API supports hierarchy retrieval')
          : this.fail(`${prefix}-category-tree`, 'MEDIUM', 'Categories API lacks tree retrieval',
              'GET /api/admin/categories should return nested parent/children structure',
              { filePath: 'src/app/api/admin/categories/route.ts', recommendation: 'Include parent and children relations in query' })
      );
    }

    // Product creation should validate required fields
    if (productsContent) {
      const hasPost = /export\s+async\s+function\s+POST/.test(productsContent);
      if (hasPost) {
        const validatesPriceSku = /price.*required|sku.*required|\.parse\(/.test(productsContent)
          || (/price/.test(productsContent) && /sku/.test(productsContent) && /z\.object/.test(productsContent));
        results.push(
          validatesPriceSku
            ? this.pass(`${prefix}-create-validation`, 'Product creation validates price and sku')
            : this.fail(`${prefix}-create-validation`, 'HIGH', 'Product creation may lack field validation',
                'POST /api/admin/products should validate that price and sku are provided',
                { filePath: 'src/app/api/admin/products/route.ts', recommendation: 'Add Zod schema with required price and sku fields' })
        );
      }
    }

    return results;
  }

  protected override async angle6_interactionTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle6_interactionTesting();
    const prefix = 'section-catalog-interact';

    // Produits page should have image upload capability
    const produitsPage = path.join(this.srcDir, 'app', 'admin', 'produits', 'page.tsx');
    const produitsContent = this.getEffectivePageContent(produitsPage);
    if (produitsContent) {
      const hasImageUpload = /upload|file.*input|type="file"|type='file'|dropzone|ImageUpload|UploadButton/.test(produitsContent);
      results.push(
        hasImageUpload
          ? this.pass(`${prefix}-image-upload`, 'Products page has image upload capability')
          : this.fail(`${prefix}-image-upload`, 'MEDIUM', 'Products page lacks image upload',
              'Product management should support image uploads for product photos',
              { filePath: 'src/app/admin/produits/page.tsx', recommendation: 'Add image upload component to product form' })
      );

      // Check for drag-and-drop or sort functionality
      const hasSorting = /drag|drop|sortable|DndContext|useSortable|reorder|sort/.test(produitsContent);
      results.push(
        hasSorting
          ? this.pass(`${prefix}-sorting`, 'Products page has drag/drop or sort functionality')
          : this.fail(`${prefix}-sorting`, 'LOW', 'Products page lacks sorting/drag-drop',
              'Product ordering via drag-and-drop improves admin UX for catalog management',
              { filePath: 'src/app/admin/produits/page.tsx', recommendation: 'Add sortable or drag-and-drop for product ordering' })
      );
    }

    // Categories page should have tree/nested view
    const categoriesPage = path.join(this.srcDir, 'app', 'admin', 'categories', 'page.tsx');
    const categoriesContent = this.getEffectivePageContent(categoriesPage);
    if (categoriesContent) {
      const hasTreeView = /tree|nested|children|parent|indent|level|collapse|expand|TreeView|Accordion/.test(categoriesContent);
      results.push(
        hasTreeView
          ? this.pass(`${prefix}-category-tree-ui`, 'Categories page has tree/nested view')
          : this.fail(`${prefix}-category-tree-ui`, 'MEDIUM', 'Categories page lacks tree view',
              'Category hierarchy should be displayed as a nested tree for intuitive navigation',
              { filePath: 'src/app/admin/categories/page.tsx', recommendation: 'Render categories as a collapsible tree structure' })
      );
    }

    return results;
  }
}

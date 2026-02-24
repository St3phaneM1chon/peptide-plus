/**
 * Populate Audit Function Catalog
 * Scans the entire codebase and catalogs every exported function/component.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/populate-audit-catalog.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const SRC_DIR = path.join(__dirname, '..', 'src');

interface FunctionEntry {
  name: string;
  filePath: string;
  type: string;
  exportType: string;
  description: string | null;
  relatedModels: string[];
  relatedAPIs: string[];
  linesOfCode: number;
}

// Known Prisma model names (extracted from schema)
const PRISMA_MODELS = [
  'Account', 'User', 'Session', 'VerificationToken', 'Product', 'ProductTranslation',
  'ProductImage', 'ProductFormat', 'Category', 'CategoryTranslation', 'Order', 'OrderItem',
  'Cart', 'CartItem', 'Address', 'Review', 'ReviewTranslation', 'Wishlist', 'WishlistItem',
  'Ambassador', 'AmbassadorTranslation', 'Coupon', 'CouponUsage', 'Promotion',
  'JournalEntry', 'JournalLine', 'ChartOfAccount', 'CustomerInvoice', 'CustomerInvoiceLine',
  'SupplierInvoice', 'SupplierInvoiceLine', 'Payment', 'Refund', 'Currency',
  'Company', 'Contact', 'Employee', 'EmployeeSchedule', 'PageContent', 'FAQ',
  'LoyaltyAccount', 'LoyaltyTransaction', 'Subscription', 'SubscriptionPlan',
  'ShippingZone', 'ShippingRate', 'TaxConfiguration', 'AuditTrail', 'Notification',
  'ChatConversation', 'ChatMessage', 'ProductBundle', 'ProductBundleItem',
  'HeroSlide', 'HeroSlideTranslation', 'WebinarSession', 'WebinarRegistration',
  'Collection', 'CollectionItem', 'RecurringEntryTemplate', 'Expense',
  'FiscalCalendarEvent', 'DocumentAttachment', 'BankRule', 'InboundEmail',
  'EmailConversation', 'OutboundReply', 'ConversationNote', 'CannedResponse',
  'EmailAutomationFlow', 'EmailCampaign', 'ConsentRecord', 'EmailSegment',
  'MailingListSubscriber', 'AccountingExport', 'OcrScan', 'Supplier',
  'AuditFunction', 'AuditType', 'AuditRun', 'AuditFinding',
  'CreditNote', 'CreditNoteLine', 'FixedAsset', 'FixedAssetDepreciation',
  'BankAccount', 'BankTransaction', 'BankReconciliation',
  'PermissionGroup', 'PermissionGroupUser', 'ResearchArticle', 'ResearchArticleTranslation',
  'ProductQuestion', 'ProductQuestionTranslation',
];

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(fullPath);
      } else if (pattern.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}

function getRelativePath(filePath: string): string {
  return path.relative(path.join(__dirname, '..'), filePath);
}

function countLines(content: string): number {
  return content.split('\n').length;
}

function findPrismaModels(content: string): string[] {
  const found = new Set<string>();
  for (const model of PRISMA_MODELS) {
    // Check for prisma.modelName or include: { modelName } patterns
    const lowerModel = model.charAt(0).toLowerCase() + model.slice(1);
    if (
      content.includes(`prisma.${lowerModel}`) ||
      content.includes(`"${model}"`) ||
      content.includes(`'${model}'`) ||
      content.includes(`${model}.`) ||
      new RegExp(`\\b${model}\\b`).test(content)
    ) {
      found.add(model);
    }
  }
  return Array.from(found);
}

function findAPIRoutes(content: string): string[] {
  const routes = new Set<string>();
  // Match fetch('/api/...') or fetch("/api/...") patterns
  const fetchPattern = /fetch\s*\(\s*[`'"](\/api\/[^`'"]+)[`'"]/g;
  let match;
  while ((match = fetchPattern.exec(content)) !== null) {
    routes.add(match[1]);
  }
  // Match /api/ string literals
  const apiPattern = /['"`](\/api\/[a-zA-Z0-9\-\/\[\]]+)['"`]/g;
  while ((match = apiPattern.exec(content)) !== null) {
    routes.add(match[1]);
  }
  return Array.from(routes);
}

function extractApiHandlers(filePath: string, content: string): FunctionEntry[] {
  const entries: FunctionEntry[] = [];
  const relPath = getRelativePath(filePath);
  const models = findPrismaModels(content);
  const lines = countLines(content);
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  for (const method of methods) {
    // Match: export async function GET, export const GET, export { GET }
    const patterns = [
      new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`),
      new RegExp(`export\\s+const\\s+${method}\\s*=`),
    ];
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        entries.push({
          name: method,
          filePath: relPath,
          type: 'api_handler',
          exportType: method,
          description: `${method} handler for ${relPath.replace('src/app/', '/').replace('/route.ts', '')}`,
          relatedModels: models,
          relatedAPIs: [],
          linesOfCode: lines,
        });
        break;
      }
    }
  }

  // If we found withAdminGuard wrapping
  if (content.includes('withAdminGuard')) {
    for (const entry of entries) {
      entry.description += ' [admin-guarded]';
    }
  }

  return entries;
}

function extractPageComponents(filePath: string, content: string): FunctionEntry[] {
  const relPath = getRelativePath(filePath);
  const models = findPrismaModels(content);
  const apis = findAPIRoutes(content);
  const lines = countLines(content);

  // Extract component name from export default
  let name = 'Page';
  const defaultExport = content.match(/export\s+default\s+(?:async\s+)?function\s+(\w+)/);
  if (defaultExport) {
    name = defaultExport[1];
  }

  return [{
    name,
    filePath: relPath,
    type: 'page',
    exportType: 'default',
    description: `Page component: ${relPath.replace('src/app/', '/').replace('/page.tsx', '')}`,
    relatedModels: models,
    relatedAPIs: apis,
    linesOfCode: lines,
  }];
}

function extractComponents(filePath: string, content: string): FunctionEntry[] {
  const entries: FunctionEntry[] = [];
  const relPath = getRelativePath(filePath);
  const models = findPrismaModels(content);
  const apis = findAPIRoutes(content);
  const lines = countLines(content);

  // Find default export
  const defaultExport = content.match(/export\s+default\s+(?:(?:async\s+)?function|const)\s+(\w+)/);
  if (defaultExport) {
    entries.push({
      name: defaultExport[1],
      filePath: relPath,
      type: 'component',
      exportType: 'default',
      description: null,
      relatedModels: models,
      relatedAPIs: apis,
      linesOfCode: lines,
    });
  }

  // Find named exports
  const namedExports = content.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g);
  for (const match of namedExports) {
    if (match[1] !== defaultExport?.[1]) {
      entries.push({
        name: match[1],
        filePath: relPath,
        type: 'component',
        exportType: 'named',
        description: null,
        relatedModels: models,
        relatedAPIs: apis,
        linesOfCode: lines,
      });
    }
  }

  return entries;
}

function extractHooks(filePath: string, content: string): FunctionEntry[] {
  const entries: FunctionEntry[] = [];
  const relPath = getRelativePath(filePath);
  const models = findPrismaModels(content);
  const apis = findAPIRoutes(content);
  const lines = countLines(content);

  // Find all exported hooks (useXxx)
  const hookExports = content.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(use\w+)/g);
  for (const match of hookExports) {
    entries.push({
      name: match[1],
      filePath: relPath,
      type: 'hook',
      exportType: 'named',
      description: null,
      relatedModels: models,
      relatedAPIs: apis,
      linesOfCode: lines,
    });
  }

  // Default exports
  const defaultHook = content.match(/export\s+default\s+(?:function|const)\s+(use\w+)/);
  if (defaultHook && !entries.find(e => e.name === defaultHook[1])) {
    entries.push({
      name: defaultHook[1],
      filePath: relPath,
      type: 'hook',
      exportType: 'default',
      description: null,
      relatedModels: models,
      relatedAPIs: apis,
      linesOfCode: lines,
    });
  }

  return entries;
}

function extractLibExports(filePath: string, content: string): FunctionEntry[] {
  const entries: FunctionEntry[] = [];
  const relPath = getRelativePath(filePath);
  const models = findPrismaModels(content);
  const apis = findAPIRoutes(content);
  const lines = countLines(content);

  // Find all exported functions/consts
  const exports = content.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g);
  for (const match of exports) {
    entries.push({
      name: match[1],
      filePath: relPath,
      type: 'lib',
      exportType: 'named',
      description: null,
      relatedModels: models,
      relatedAPIs: apis,
      linesOfCode: lines,
    });
  }

  // Default export
  const defaultExport = content.match(/export\s+default\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/);
  if (defaultExport && !entries.find(e => e.name === defaultExport[1])) {
    entries.push({
      name: defaultExport[1],
      filePath: relPath,
      type: 'lib',
      exportType: 'default',
      description: null,
      relatedModels: models,
      relatedAPIs: apis,
      linesOfCode: lines,
    });
  }

  return entries;
}

async function main() {
  console.log('Scanning codebase for function catalog...\n');

  const allEntries: FunctionEntry[] = [];

  // 1. API routes
  console.log('📡 Scanning API routes...');
  const apiFiles = findFiles(path.join(SRC_DIR, 'app', 'api'), /^route\.ts$/);
  for (const file of apiFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    allEntries.push(...extractApiHandlers(file, content));
  }
  console.log(`   Found ${allEntries.length} API handlers in ${apiFiles.length} files`);

  // 2. Pages
  console.log('📄 Scanning pages...');
  const pageCount = allEntries.length;
  const pageFiles = findFiles(path.join(SRC_DIR, 'app'), /^page\.tsx$/);
  for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    allEntries.push(...extractPageComponents(file, content));
  }
  console.log(`   Found ${allEntries.length - pageCount} pages in ${pageFiles.length} files`);

  // 3. Components
  console.log('🧩 Scanning components...');
  const compCount = allEntries.length;
  const componentFiles = findFiles(path.join(SRC_DIR, 'components'), /\.tsx$/);
  for (const file of componentFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    allEntries.push(...extractComponents(file, content));
  }
  console.log(`   Found ${allEntries.length - compCount} component exports in ${componentFiles.length} files`);

  // 4. Hooks
  console.log('🪝 Scanning hooks...');
  const hookCount = allEntries.length;
  const hookFiles = findFiles(path.join(SRC_DIR, 'hooks'), /\.ts$/);
  for (const file of hookFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    allEntries.push(...extractHooks(file, content));
  }
  console.log(`   Found ${allEntries.length - hookCount} hooks in ${hookFiles.length} files`);

  // 5. Lib files
  console.log('📚 Scanning lib files...');
  const libCount = allEntries.length;
  const libFiles = findFiles(path.join(SRC_DIR, 'lib'), /\.ts$/);
  for (const file of libFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    allEntries.push(...extractLibExports(file, content));
  }
  console.log(`   Found ${allEntries.length - libCount} lib exports in ${libFiles.length} files`);

  // 6. Middleware
  const middlewarePath = path.join(SRC_DIR, '..', 'middleware.ts');
  if (fs.existsSync(middlewarePath)) {
    const content = fs.readFileSync(middlewarePath, 'utf-8');
    allEntries.push({
      name: 'middleware',
      filePath: 'middleware.ts',
      type: 'middleware',
      exportType: 'default',
      description: 'Next.js middleware',
      relatedModels: findPrismaModels(content),
      relatedAPIs: [],
      linesOfCode: countLines(content),
    });
  }

  console.log(`\n📊 Total: ${allEntries.length} functions found\n`);
  console.log('💾 Saving to database...');

  let created = 0;
  let updated = 0;

  for (const entry of allEntries) {
    try {
      await prisma.auditFunction.upsert({
        where: {
          filePath_name: {
            filePath: entry.filePath,
            name: entry.name,
          },
        },
        update: {
          type: entry.type,
          exportType: entry.exportType,
          description: entry.description,
          relatedModels: JSON.stringify(entry.relatedModels),
          relatedAPIs: JSON.stringify(entry.relatedAPIs),
          linesOfCode: entry.linesOfCode,
          status: 'ACTIVE',
        },
        create: {
          name: entry.name,
          filePath: entry.filePath,
          type: entry.type,
          exportType: entry.exportType,
          description: entry.description,
          relatedModels: JSON.stringify(entry.relatedModels),
          relatedAPIs: JSON.stringify(entry.relatedAPIs),
          linesOfCode: entry.linesOfCode,
        },
      });
      created++;
    } catch (err) {
      // Skip duplicates or errors silently
      updated++;
    }
  }

  // Mark functions whose files no longer exist as REMOVED
  const allFunctions = await prisma.auditFunction.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, filePath: true },
  });

  let removed = 0;
  for (const fn of allFunctions) {
    const fullPath = path.join(__dirname, '..', fn.filePath);
    if (!fs.existsSync(fullPath)) {
      await prisma.auditFunction.update({
        where: { id: fn.id },
        data: { status: 'REMOVED' },
      });
      removed++;
    }
  }

  console.log(`\n✅ Done! Created/updated: ${created}, Skipped: ${updated}, Marked removed: ${removed}`);

  // Print summary by type
  const summary = await prisma.auditFunction.groupBy({
    by: ['type'],
    where: { status: 'ACTIVE' },
    _count: { type: true },
  });
  console.log('\n📊 Catalog Summary:');
  for (const s of summary) {
    console.log(`   ${s.type}: ${s._count.type}`);
  }
}

main()
  .catch((e) => {
    console.error('Error populating catalog:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

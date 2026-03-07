import { test, expect } from '../fixtures/admin-auth';
import { collectConsoleErrors, checkOverflow, waitForPageReady } from '../fixtures/helpers';

const pages = ['/admin/produits', '/admin/categories'];

for (const pagePath of pages) {
  test.describe(`Catalog: ${pagePath}`, () => {
    test('loads without console errors', async ({ adminPage }) => {
      const errors = await collectConsoleErrors(adminPage, async () => {
        await adminPage.goto(pagePath);
        await waitForPageReady(adminPage);
      });
      expect(errors).toHaveLength(0);
    });

    test('displays data table or grid', async ({ adminPage }) => {
      await adminPage.goto(pagePath);
      await waitForPageReady(adminPage);
      const dataElements = adminPage.locator('table, [class*="grid"], [class*="card"]');
      expect(await dataElements.count()).toBeGreaterThan(0);
    });

    test('no horizontal overflow', async ({ adminPage }) => {
      await adminPage.goto(pagePath);
      await waitForPageReady(adminPage);
      expect(await checkOverflow(adminPage)).toBe(false);
    });
  });
}

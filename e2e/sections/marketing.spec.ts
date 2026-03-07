import { test, expect } from '../fixtures/admin-auth';
import { collectConsoleErrors, checkOverflow, waitForPageReady } from '../fixtures/helpers';

const pages = ['/admin/promo-codes', '/admin/promotions', '/admin/newsletter', '/admin/bannieres', '/admin/upsell'];

for (const pagePath of pages) {
  test.describe(`Marketing: ${pagePath}`, () => {
    test('loads without console errors', async ({ adminPage }) => {
      const errors = await collectConsoleErrors(adminPage, async () => {
        await adminPage.goto(pagePath);
        await waitForPageReady(adminPage);
      });
      expect(errors).toHaveLength(0);
    });

    test('no horizontal overflow', async ({ adminPage }) => {
      await adminPage.goto(pagePath);
      await waitForPageReady(adminPage);
      expect(await checkOverflow(adminPage)).toBe(false);
    });
  });
}

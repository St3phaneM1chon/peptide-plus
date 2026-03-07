import { test, expect } from '../fixtures/admin-auth';
import { collectConsoleErrors, collectNetworkErrors, checkOverflow, waitForPageReady } from '../fixtures/helpers';

const pages = ['/admin/commandes', '/admin/customers', '/admin/clients', '/admin/abonnements', '/admin/inventaire', '/admin/fournisseurs'];

for (const pagePath of pages) {
  test.describe(`Commerce: ${pagePath}`, () => {
    test('loads without console errors', async ({ adminPage }) => {
      const errors = await collectConsoleErrors(adminPage, async () => {
        await adminPage.goto(pagePath);
        await waitForPageReady(adminPage);
      });
      expect(errors).toHaveLength(0);
    });

    test('loads without 5xx network errors', async ({ adminPage }) => {
      const errors = await collectNetworkErrors(adminPage, async () => {
        await adminPage.goto(pagePath);
        await waitForPageReady(adminPage);
      });
      expect(errors.filter(e => e.status >= 500)).toHaveLength(0);
    });

    test('no horizontal overflow', async ({ adminPage }) => {
      await adminPage.goto(pagePath);
      await waitForPageReady(adminPage);
      expect(await checkOverflow(adminPage)).toBe(false);
    });
  });
}

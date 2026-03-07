import { test, expect } from '../fixtures/admin-auth';
import { collectConsoleErrors, collectNetworkErrors, checkOverflow, waitForPageReady } from '../fixtures/helpers';

test.describe('Dashboard Section', () => {
  test('loads without console errors', async ({ adminPage }) => {
    const errors = await collectConsoleErrors(adminPage, async () => {
      await adminPage.goto('/admin/dashboard');
      await waitForPageReady(adminPage);
    });
    expect(errors).toHaveLength(0);
  });

  test('loads without network errors', async ({ adminPage }) => {
    const errors = await collectNetworkErrors(adminPage, async () => {
      await adminPage.goto('/admin/dashboard');
      await waitForPageReady(adminPage);
    });
    expect(errors.filter(e => e.status >= 500)).toHaveLength(0);
  });

  test('displays stats cards', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard');
    await waitForPageReady(adminPage);
    const cards = adminPage.locator('[class*="rounded"], [class*="card"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('no horizontal overflow', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard');
    await waitForPageReady(adminPage);
    expect(await checkOverflow(adminPage)).toBe(false);
  });
});

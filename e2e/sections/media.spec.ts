import { test, expect } from '../fixtures/admin-auth';
import { collectConsoleErrors, checkOverflow, waitForPageReady } from '../fixtures/helpers';

test.describe('Media Section', () => {
  test('loads without console errors', async ({ adminPage }) => {
    const errors = await collectConsoleErrors(adminPage, async () => {
      await adminPage.goto('/admin/media');
      await waitForPageReady(adminPage);
    });
    expect(errors).toHaveLength(0);
  });

  test('displays media grid or list', async ({ adminPage }) => {
    await adminPage.goto('/admin/media');
    await waitForPageReady(adminPage);
    const elements = adminPage.locator('img, video, [class*="grid"], [class*="card"]');
    expect(await elements.count()).toBeGreaterThan(0);
  });

  test('no horizontal overflow', async ({ adminPage }) => {
    await adminPage.goto('/admin/media');
    await waitForPageReady(adminPage);
    expect(await checkOverflow(adminPage)).toBe(false);
  });
});

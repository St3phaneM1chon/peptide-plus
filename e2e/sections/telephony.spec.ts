import { test, expect } from '../fixtures/admin-auth';
import { collectConsoleErrors, checkOverflow, waitForPageReady } from '../fixtures/helpers';

test.describe('Telephony Section', () => {
  test('loads without console errors', async ({ adminPage }) => {
    const errors = await collectConsoleErrors(adminPage, async () => {
      await adminPage.goto('/admin/telephonie');
      await waitForPageReady(adminPage);
    });
    expect(errors).toHaveLength(0);
  });

  test('no horizontal overflow', async ({ adminPage }) => {
    await adminPage.goto('/admin/telephonie');
    await waitForPageReady(adminPage);
    expect(await checkOverflow(adminPage)).toBe(false);
  });
});

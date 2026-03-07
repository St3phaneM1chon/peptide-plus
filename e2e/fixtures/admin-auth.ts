import { test as base, type Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@biocyclepeptides.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';

async function loginAsAdmin(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password|mot de passe/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|connexion|log in/i }).click();
  await page.waitForURL(/\/(admin|dashboard)/, { timeout: 15_000 });
}

export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';

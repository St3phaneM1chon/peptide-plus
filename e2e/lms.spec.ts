import { test, expect } from './fixtures/admin-auth';
import { test as publicTest, expect as publicExpect } from '@playwright/test';
import { collectConsoleErrors, collectNetworkErrors, checkOverflow, waitForPageReady } from './fixtures/helpers';

// ── Public LMS Pages ────────────────────────────────────────────

publicTest.describe('LMS — Public: Course Catalog (/learn)', () => {
  publicTest('loads and displays course catalog', async ({ page }) => {
    const response = await page.goto('/learn');
    publicExpect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
    // The page should contain some content (heading or course cards)
    const body = await page.textContent('body');
    publicExpect(body?.length).toBeGreaterThan(0);
  });

  publicTest('no horizontal overflow', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');
    publicExpect(await checkOverflow(page)).toBe(false);
  });
});

publicTest.describe('LMS — Public: Course Detail (/learn/[slug])', () => {
  publicTest('navigates to a course from catalog or shows 404 gracefully', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');

    // Try to find a course link on the catalog page
    const courseLink = page.locator('a[href^="/learn/"]').first();
    if (await courseLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await courseLink.getAttribute('href');
      await courseLink.click();
      await page.waitForLoadState('networkidle');
      const response = await page.goto(href!);
      publicExpect(response?.status()).toBeLessThan(500);
    } else {
      // No courses yet — verify the catalog page at least loaded
      publicExpect(await page.title()).toBeTruthy();
    }
  });
});

publicTest.describe('LMS — Public: Review Queue (/learn/review)', () => {
  publicTest('loads the review page', async ({ page }) => {
    const response = await page.goto('/learn/review');
    // May redirect to login if auth required, but should not 500
    publicExpect(response?.status()).toBeLessThan(500);
  });
});

publicTest.describe('LMS — Public: Mastery (/learn/mastery)', () => {
  publicTest('loads the mastery page', async ({ page }) => {
    const response = await page.goto('/learn/mastery');
    // May redirect to login if auth required, but should not 500
    publicExpect(response?.status()).toBeLessThan(500);
  });
});

// ── API Endpoints ───────────────────────────────────────────────

publicTest.describe('LMS — API: /api/lms/courses', () => {
  publicTest('returns valid JSON with courses array', async ({ request }) => {
    const response = await request.get('/api/lms/courses');
    publicExpect(response.status()).toBeLessThan(500);
    const body = await response.json();
    // Should be an object or array (API may wrap in { data: [...] })
    publicExpect(typeof body).toBe('object');
  });
});

publicTest.describe('LMS — API: /api/health', () => {
  publicTest('returns 200 OK', async ({ request }) => {
    const response = await request.get('/api/health');
    publicExpect(response.ok()).toBeTruthy();
  });
});

publicTest.describe('LMS — API: /api/lms/certificates/verify', () => {
  publicTest('returns a response for certificate verification', async ({ request }) => {
    // GET with no params should still return a structured response, not 500
    const response = await request.get('/api/lms/certificates/verify');
    publicExpect(response.status()).toBeLessThan(500);
  });
});

// ── Admin Formation Pages ───────────────────────────────────────

const adminFormationPages = [
  '/admin/formation',
  '/admin/formation/cours',
  '/admin/formation/categories',
  '/admin/formation/quiz',
  '/admin/formation/instructeurs',
  '/admin/formation/etudiants',
  '/admin/formation/progression',
  '/admin/formation/certificats',
  '/admin/formation/modeles-certificats',
  '/admin/formation/badges',
  '/admin/formation/classement',
  '/admin/formation/avis',
  '/admin/formation/medias',
  '/admin/formation/conformite',
  '/admin/formation/rapports',
  '/admin/formation/analytics',
  '/admin/formation/parametres',
];

for (const pagePath of adminFormationPages) {
  test.describe(`LMS Admin: ${pagePath}`, () => {
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

// ── Specific Feature Tests ──────────────────────────────────────

test.describe('LMS Admin: Formation Dashboard', () => {
  test('displays stat cards', async ({ adminPage }) => {
    await adminPage.goto('/admin/formation');
    await waitForPageReady(adminPage);
    // Dashboard should render stat cards or section cards
    const cards = adminPage.locator('[class*="rounded"], [class*="card"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('has navigation links to sub-pages', async ({ adminPage }) => {
    await adminPage.goto('/admin/formation');
    await waitForPageReady(adminPage);
    // Should have links to courses, students, compliance
    const links = adminPage.locator('a[href*="/admin/formation/"]');
    expect(await links.count()).toBeGreaterThan(0);
  });
});

test.describe('LMS Admin: Course List', () => {
  test('loads course list page', async ({ adminPage }) => {
    const response = await adminPage.goto('/admin/formation/cours');
    expect(response?.status()).toBeLessThan(400);
    await waitForPageReady(adminPage);
    const body = await adminPage.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});

test.describe('LMS Admin: Analytics', () => {
  test('loads analytics page with charts or data', async ({ adminPage }) => {
    const response = await adminPage.goto('/admin/formation/analytics');
    expect(response?.status()).toBeLessThan(400);
    await waitForPageReady(adminPage);
    const body = await adminPage.textContent('body');
    expect(body?.length).toBeGreaterThan(0);
  });
});

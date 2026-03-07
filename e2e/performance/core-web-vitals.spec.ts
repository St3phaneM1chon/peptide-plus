import { test, expect } from '@playwright/test';
import { measureLCP } from '../fixtures/helpers';

test.describe('Core Web Vitals', () => {
  test('homepage LCP < 4s', async ({ page }) => {
    const lcp = await measureLCP(page, '/');
    expect(lcp).toBeLessThan(4000);
  });

  test('product listing LCP < 4s', async ({ page }) => {
    const lcp = await measureLCP(page, '/products');
    expect(lcp).toBeLessThan(4000);
  });

  test('homepage has no layout shift from unoptimized images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check all images have width/height or use next/image
    const unsizedImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.filter(img => !img.width && !img.height && !img.getAttribute('data-nimg')).length;
    });
    expect(unsizedImages).toBe(0);
  });

  test('no blocking scripts in head', async ({ page }) => {
    await page.goto('/');
    const blockingScripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('head script'));
      return scripts.filter(s => !s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('src')).length;
    });
    expect(blockingScripts).toBe(0);
  });
});

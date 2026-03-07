import type { Page } from '@playwright/test';

export interface ConsoleError {
  type: string;
  text: string;
  url: string;
}

export interface NetworkError {
  url: string;
  status: number;
  method: string;
}

/** Collect console errors while a callback runs */
export async function collectConsoleErrors(page: Page, fn: () => Promise<void>): Promise<ConsoleError[]> {
  const errors: ConsoleError[] = [];
  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push({ type: msg.type(), text: msg.text(), url: page.url() });
    }
  };
  page.on('console', handler);
  await fn();
  page.off('console', handler);
  return errors;
}

/** Collect network errors (4xx/5xx) while a callback runs */
export async function collectNetworkErrors(page: Page, fn: () => Promise<void>): Promise<NetworkError[]> {
  const errors: NetworkError[] = [];
  const handler = (response: import('@playwright/test').Response) => {
    if (response.status() >= 400) {
      errors.push({ url: response.url(), status: response.status(), method: response.request().method() });
    }
  };
  page.on('response', handler);
  await fn();
  page.off('response', handler);
  return errors;
}

/** Measure LCP for a page navigation */
export async function measureLCP(page: Page, url: string): Promise<number> {
  await page.goto(url, { waitUntil: 'networkidle' });
  const lcp = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let lcpValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          lcpValue = entries[entries.length - 1].startTime;
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(lcpValue);
      }, 3000);
    });
  });
  return lcp;
}

/** Check for horizontal overflow on the current page */
export async function checkOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
}

/** Wait for page to be interactive (no loading spinners) */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for common loading indicators to disappear
  const spinner = page.locator('[class*="animate-spin"], [class*="animate-pulse"], [role="progressbar"]').first();
  if (await spinner.isVisible({ timeout: 1000 }).catch(() => false)) {
    await spinner.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }
}

/** Get all ARIA violations (basic check) */
export async function checkBasicA11y(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = [];
    // Images without alt
    document.querySelectorAll('img:not([alt])').forEach((el) => {
      issues.push(`Image missing alt: ${el.getAttribute('src')?.slice(0, 60)}`);
    });
    // Buttons without accessible name
    document.querySelectorAll('button').forEach((el) => {
      if (!el.textContent?.trim() && !el.getAttribute('aria-label') && !el.getAttribute('title')) {
        issues.push(`Button without accessible name`);
      }
    });
    // Links without accessible name
    document.querySelectorAll('a').forEach((el) => {
      if (!el.textContent?.trim() && !el.getAttribute('aria-label')) {
        issues.push(`Link without accessible name: ${el.getAttribute('href')?.slice(0, 40)}`);
      }
    });
    return issues;
  });
}

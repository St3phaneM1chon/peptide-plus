/**
 * User-Agent Rotator — Randomized UA strings for anti-detection scraping.
 *
 * Pool of 20+ real browser user agents across Chrome, Firefox, Safari.
 * Includes desktop and mobile variants.
 */

const USER_AGENTS = [
  // Chrome Desktop (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  // Chrome Desktop (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // Chrome Desktop (Linux)
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  // Firefox Desktop
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  // Safari Desktop
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  // Edge Desktop
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  // Chrome Mobile
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  // Safari Mobile
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  // Samsung Internet
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
];

/** Viewport sizes matching user agents */
const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 2560, height: 1440 },
];

const MOBILE_VIEWPORTS = [
  { width: 412, height: 915 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 360, height: 780 },
];

/** Get a random user agent string */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/** Get a random desktop user agent */
export function getRandomDesktopUA(): string {
  const desktopUAs = USER_AGENTS.filter(
    ua => !ua.includes('Mobile') && !ua.includes('iPhone') && !ua.includes('iPad') && !ua.includes('Android')
  );
  return desktopUAs[Math.floor(Math.random() * desktopUAs.length)];
}

/** Get a random viewport matching the UA type */
export function getRandomViewport(userAgent: string): { width: number; height: number } {
  const isMobile = /Mobile|iPhone|iPad|Android/i.test(userAgent);
  const viewports = isMobile ? MOBILE_VIEWPORTS : DESKTOP_VIEWPORTS;
  return viewports[Math.floor(Math.random() * viewports.length)];
}

/** Generate random delay with Gaussian distribution */
export function randomDelay(mean: number = 3000, stdDev: number = 1000): number {
  // Box-Muller transform for Gaussian distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const delay = mean + z0 * stdDev;
  // Clamp between 1500ms and 6000ms
  return Math.max(1500, Math.min(6000, Math.round(delay)));
}

/** Generate exponential backoff delay */
export function backoffDelay(attempt: number, baseMs: number = 5000): number {
  return baseMs * Math.pow(3, attempt - 1); // 5s, 15s, 45s
}

/** Get a complete browser context configuration */
export function getRandomBrowserConfig() {
  const userAgent = getRandomDesktopUA();
  const viewport = getRandomViewport(userAgent);
  const locales = ['fr-CA', 'en-CA', 'fr-FR', 'en-US'];
  const locale = locales[Math.floor(Math.random() * locales.length)];

  return {
    userAgent,
    viewport,
    locale,
    timezoneId: 'America/Montreal',
    geolocation: undefined,
    permissions: [] as string[],
  };
}

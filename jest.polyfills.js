/**
 * Jest Web API Polyfills
 *
 * Ensures that Request, Response, Headers, and fetch are available as globals
 * in all Jest test environments. Next.js API routes (NextRequest / NextResponse)
 * depend on these Web APIs being present at module-load time.
 *
 * This file is referenced in jest.config.js -> setupFiles (runs before each
 * test suite, before the test environment is fully initialised).
 */

// Only polyfill if the globals are missing (e.g. jest-environment-jsdom
// strips the Node.js built-in Web API globals).

if (typeof globalThis.Request === 'undefined') {
  // Node 18+ ships Web API globals (Request, Response, Headers, fetch) natively.
  // However, jest-environment-jsdom may shadow/remove them.
  // Try to restore from undici (Node 18-21 bundled module) or skip silently
  // for Node 22+ where they are native globals restored by the node environment.
  try {
    const undici = require('undici');
    globalThis.Request = undici.Request;
    globalThis.Response = undici.Response;
    globalThis.Headers = undici.Headers;
    globalThis.fetch = undici.fetch;
  } catch {
    // Node 22+ no longer exposes undici as a standalone require.
    // The Web API globals should already exist in the 'node' test environment.
    // This catch is expected for jsdom tests that don't need Request/Response.
  }
}

import { test, expect } from '@playwright/test';

test.describe('Security Headers', () => {
  test('homepage returns security headers', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();

    // X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // X-Frame-Options
    expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/i);

    // Referrer-Policy
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('API routes return security headers', async ({ request }) => {
    const res = await request.get('/api/health');
    const headers = res.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('no server header leak', async ({ request }) => {
    const res = await request.get('/');
    const server = res.headers()['server'];
    // Should not reveal internal server details
    if (server) {
      expect(server).not.toMatch(/express|next|node/i);
    }
  });

  test('admin routes redirect unauthenticated users', async ({ request }) => {
    const res = await request.get('/admin/dashboard', { maxRedirects: 0 });
    // Should redirect to login (302/307) or return 401
    expect([302, 307, 401, 403]).toContain(res.status());
  });

  test('API admin routes reject unauthenticated requests', async ({ request }) => {
    const res = await request.get('/api/admin/dashboard');
    expect([401, 403]).toContain(res.status());
  });
});

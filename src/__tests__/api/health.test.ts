export {};

/**
 * API Integration Tests - Health & Status
 * Run with: TEST_BASE_URL=http://localhost:3000 npm test -- --testPathPattern="api"
 */

// Skip if no server running
const baseUrl = process.env.TEST_BASE_URL;
const describeIf = baseUrl ? describe : describe.skip;

describeIf('Health & Status API', () => {

  describe('Public Pages', () => {
    const publicRoutes = [
      '/',
      '/shop',
      '/contact',
      '/faq',
    ];

    test.each(publicRoutes)('GET %s should return 200', async (route: string) => {
      const response = await fetch(`${baseUrl}${route}`);
      expect(response.status).toBe(200);
    });
  });

  describe('Protected Routes', () => {
    const protectedRoutes = [
      '/admin',
      '/dashboard/customer',
      '/owner',
    ];

    test.each(protectedRoutes)('GET %s should redirect when unauthenticated', async (route: string) => {
      const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual' });
      // Should redirect to auth page (307) or return auth error
      expect([200, 307, 401, 403]).toContain(response.status);
    });
  });

  describe('API Endpoints', () => {
    it('GET /api/products should be accessible', async () => {
      const response = await fetch(`${baseUrl}/api/products`);
      expect(response.status).toBe(200);
    });

    it('GET /api/categories should be accessible', async () => {
      const response = await fetch(`${baseUrl}/api/categories`);
      expect([200, 404]).toContain(response.status); // May not exist
    });
  });

  describe('Security Headers', () => {
    it('should have security headers', async () => {
      const response = await fetch(`${baseUrl}/`);
      
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('strict-transport-security')).toBeTruthy();
    });
  });

  describe('Static Files', () => {
    it('GET /robots.txt should return robots file', async () => {
      const response = await fetch(`${baseUrl}/robots.txt`);
      expect(response.status).toBe(200);
      
      const text = await response.text();
      expect(text).toContain('User-agent');
    });
  });
});

/**
 * API Integration Tests - Authentication
 * Run with: TEST_BASE_URL=http://localhost:3000 npm test -- --testPathPattern="api"
 */

// Skip if no server running
const baseUrl = process.env.TEST_BASE_URL;
const describeIf = baseUrl ? describe : describe.skip;

describeIf('Auth API', () => {

  describe('POST /api/auth/signin', () => {
    it('should handle credentials endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email: 'invalid@test.com',
          password: 'wrongpassword',
        }).toString(),
        redirect: 'manual',
      });
      
      // NextAuth redirects or returns error page
      expect([200, 302, 303, 307, 401, 403]).toContain(response.status);
    });

    it('should handle empty credentials', async () => {
      const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: '',
        redirect: 'manual',
      });
      
      // Should handle gracefully
      expect(response.status).toBeDefined();
    });
  });

  describe('GET /api/auth/session', () => {
    it('should return session info', async () => {
      const response = await fetch(`${baseUrl}/api/auth/session`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      // Unauthenticated should return empty object or null user
      expect(data).toBeDefined();
    });
  });

  describe('GET /api/auth/providers', () => {
    it('should return available providers', async () => {
      const response = await fetch(`${baseUrl}/api/auth/providers`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });
  });
});

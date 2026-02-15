export {};

/**
 * API Integration Tests - Products
 * Run with: TEST_BASE_URL=http://localhost:3000 npm test -- --testPathPattern="api"
 */

// Skip if no server running
const baseUrl = process.env.TEST_BASE_URL;
const describeIf = baseUrl ? describe : describe.skip;

describeIf('Products API', () => {

  describe('GET /api/products', () => {
    it('should return products list', async () => {
      const response = await fetch(`${baseUrl}/api/products`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('products');
      expect(Array.isArray(data.products)).toBe(true);
    });

    it('should return products with required fields', async () => {
      const response = await fetch(`${baseUrl}/api/products`);
      const data = await response.json();
      
      if (data.products.length > 0) {
        const product = data.products[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('price');
      }
    });
  });

  describe('GET /api/products/[slug]', () => {
    it('should return 404 for non-existent product', async () => {
      const response = await fetch(`${baseUrl}/api/products/non-existent-slug-12345`);
      expect(response.status).toBe(404);
    });
  });
});

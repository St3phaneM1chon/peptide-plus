/**
 * Tests for Product Data Utilities
 */

import {
  products as getAllProducts,
  getProductById,
  getProductBySlug,
  getFeaturedProducts,
  getProductsByType,
  getRelatedProducts,
} from '../data/products';

describe('Product Data Utilities', () => {
  describe('products array', () => {
    it('should contain products', () => {
      expect(Array.isArray(getAllProducts)).toBe(true);
      expect(getAllProducts.length).toBeGreaterThan(0);
    });

    it('should have products with required fields', () => {
      getAllProducts.forEach(product => {
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.slug).toBeDefined();
        expect(product.price).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getProductById', () => {
    it('should find product by ID', () => {
      if (getAllProducts.length > 0) {
        const firstProduct = getAllProducts[0];
        const found = getProductById(firstProduct.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(firstProduct.id);
      }
    });

    it('should return undefined for invalid ID', () => {
      const found = getProductById('invalid-id-12345');
      expect(found).toBeUndefined();
    });
  });

  describe('getProductBySlug', () => {
    it('should find product by slug', () => {
      if (getAllProducts.length > 0) {
        const firstProduct = getAllProducts[0];
        const found = getProductBySlug(firstProduct.slug);
        expect(found).toBeDefined();
        expect(found?.slug).toBe(firstProduct.slug);
      }
    });

    it('should return undefined for invalid slug', () => {
      const found = getProductBySlug('invalid-slug-12345');
      expect(found).toBeUndefined();
    });
  });

  describe('getFeaturedProducts', () => {
    it('should return featured products', () => {
      const featured = getFeaturedProducts();
      expect(Array.isArray(featured)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const featured = getFeaturedProducts(2);
      expect(featured.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getProductsByType', () => {
    it('should filter products by type', () => {
      const peptides = getProductsByType('PEPTIDE');
      expect(Array.isArray(peptides)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const prods = getProductsByType('PEPTIDE', 3);
      expect(prods.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getRelatedProducts', () => {
    it('should return related products array', () => {
      if (getAllProducts.length > 0) {
        const related = getRelatedProducts(getAllProducts[0]);
        expect(Array.isArray(related)).toBe(true);
      }
    });
  });
});

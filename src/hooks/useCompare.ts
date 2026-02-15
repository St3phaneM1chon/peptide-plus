'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'biocycle-compare-products';
const MAX_PRODUCTS = 4;

export function useCompare() {
  const [productSlugs, setProductSlugs] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setProductSlugs(parsed.slice(0, MAX_PRODUCTS));
          }
        } catch (e) {
          console.error('Failed to parse compare products:', e);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage and fire event
  const saveToStorage = useCallback((slugs: string[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
      // Fire custom event for other components to listen
      window.dispatchEvent(new CustomEvent('compareUpdated', { detail: slugs }));
    }
  }, []);

  // Add product to comparison
  const addToCompare = useCallback((slug: string): { success: boolean; message?: string } => {
    if (productSlugs.includes(slug)) {
      return { success: false, message: 'Product already in comparison' };
    }

    if (productSlugs.length >= MAX_PRODUCTS) {
      return { success: false, message: `Maximum ${MAX_PRODUCTS} products can be compared` };
    }

    const newSlugs = [...productSlugs, slug];
    setProductSlugs(newSlugs);
    saveToStorage(newSlugs);
    return { success: true };
  }, [productSlugs, saveToStorage]);

  // Remove product from comparison
  const removeFromCompare = useCallback((slug: string) => {
    const newSlugs = productSlugs.filter(s => s !== slug);
    setProductSlugs(newSlugs);
    saveToStorage(newSlugs);
  }, [productSlugs, saveToStorage]);

  // Clear all products
  const clearCompare = useCallback(() => {
    setProductSlugs([]);
    saveToStorage([]);
  }, [saveToStorage]);

  // Check if product is in comparison
  const isInCompare = useCallback((slug: string) => {
    return productSlugs.includes(slug);
  }, [productSlugs]);

  // Get comparison URL
  const getCompareUrl = useCallback(() => {
    if (productSlugs.length === 0) return null;
    return `/compare?products=${productSlugs.join(',')}&lang=${typeof window !== 'undefined' ? localStorage.getItem('locale') || 'en' : 'en'}`;
  }, [productSlugs]);

  return {
    productSlugs,
    count: productSlugs.length,
    maxProducts: MAX_PRODUCTS,
    isLoaded,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    getCompareUrl,
    canAddMore: productSlugs.length < MAX_PRODUCTS,
  };
}

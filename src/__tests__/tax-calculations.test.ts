/**
 * Tests for Tax Calculation Utilities
 */

import { calculateTaxes, getProvincesList, getCountriesList } from '../lib/canadianTaxes';

describe('Tax Calculations', () => {
  describe('calculateTaxes', () => {
    it('should calculate Quebec taxes correctly (GST + QST)', () => {
      const result = calculateTaxes(100, 'QC', 'CA');
      expect(result.gstAmount).toBe(5); // 5% GST
      expect(result.qstAmount).toBeCloseTo(9.975, 2); // 9.975% QST
      expect(result.totalTax).toBeCloseTo(14.975, 2);
    });

    it('should calculate Ontario taxes correctly (HST)', () => {
      const result = calculateTaxes(100, 'ON', 'CA');
      expect(result.hstAmount).toBe(13); // 13% HST
      expect(result.totalTax).toBe(13);
    });

    it('should calculate Alberta taxes correctly (GST only)', () => {
      const result = calculateTaxes(100, 'AB', 'CA');
      expect(result.gstAmount).toBe(5); // 5% GST only
      expect(result.totalTax).toBe(5);
    });

    it('should handle US orders correctly', () => {
      const result = calculateTaxes(100, 'NY', 'US');
      expect(result.isExport).toBe(true);
    });

    it('should handle international orders as exports', () => {
      const result = calculateTaxes(100, '', 'FR');
      expect(result.isExport).toBe(true);
    });

    it('should handle zero amount', () => {
      const result = calculateTaxes(0, 'QC', 'CA');
      expect(result.totalTax).toBe(0);
    });
  });

  describe('getProvincesList', () => {
    it('should return provinces in French', () => {
      const provinces = getProvincesList('fr');
      expect(provinces.length).toBeGreaterThan(0);
      const quebec = provinces.find(p => p.code === 'QC');
      expect(quebec).toBeDefined();
      expect(quebec?.name).toBe('Québec');
    });

    it('should return provinces in English', () => {
      const provinces = getProvincesList('en');
      const quebec = provinces.find(p => p.code === 'QC');
      expect(quebec?.name).toBe('Quebec');
    });
  });

  describe('getCountriesList', () => {
    it('should return countries list', () => {
      const countries = getCountriesList('en');
      expect(countries.length).toBeGreaterThan(0);
      const canada = countries.find(c => c.code === 'CA');
      expect(canada).toBeDefined();
    });

    it('should have Canada as first country', () => {
      const countries = getCountriesList('en');
      expect(countries[0].code).toBe('CA');
    });
  });
});

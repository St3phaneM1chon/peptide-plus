/**
 * @jest-environment node
 */

/**
 * Comprehensive Tax Calculation Tests
 *
 * Tests all Canadian provinces/territories:
 * - HST provinces: ON, NB, NS, NL, PE
 * - GST+PST provinces: BC, SK
 * - GST+RST: MB
 * - GST+QST: QC
 * - GST-only: AB, YT, NT, NU
 * - Exports: US states, international
 *
 * Edge cases:
 * - Zero amount
 * - Negative amount
 * - Very large amounts
 * - Unknown province codes
 */

import {
  calculateTaxes,
  getProvincesList,
  getCountriesList,
  CANADIAN_PROVINCES,
  TaxBreakdown,
} from '@/lib/canadianTaxes';

// =====================================================
// ALL PROVINCES
// =====================================================

describe('Tax Calculations - All Provinces', () => {
  const subtotal = 100;

  // -------------------------------------------------
  // HST Provinces
  // -------------------------------------------------
  describe('HST Provinces', () => {
    it('Ontario (ON) - HST 13%', () => {
      const result = calculateTaxes(subtotal, 'ON', 'CA');
      expect(result.hstAmount).toBe(13);
      expect(result.gstAmount).toBe(0);
      expect(result.pstAmount).toBe(0);
      expect(result.qstAmount).toBe(0);
      expect(result.totalTax).toBe(13);
      expect(result.isExport).toBe(false);
      expect(result.federalTaxLabel).toBe('HST');
    });

    it('New Brunswick (NB) - HST 15%', () => {
      const result = calculateTaxes(subtotal, 'NB', 'CA');
      expect(result.hstAmount).toBe(15);
      expect(result.totalTax).toBe(15);
    });

    it('Nova Scotia (NS) - HST 14%', () => {
      const result = calculateTaxes(subtotal, 'NS', 'CA');
      expect(result.hstAmount).toBeCloseTo(14, 2);
      expect(result.totalTax).toBeCloseTo(14, 2);
    });

    it('Newfoundland and Labrador (NL) - HST 15%', () => {
      const result = calculateTaxes(subtotal, 'NL', 'CA');
      expect(result.hstAmount).toBe(15);
      expect(result.totalTax).toBe(15);
    });

    it('Prince Edward Island (PE) - HST 15%', () => {
      const result = calculateTaxes(subtotal, 'PE', 'CA');
      expect(result.hstAmount).toBe(15);
      expect(result.totalTax).toBe(15);
    });
  });

  // -------------------------------------------------
  // GST + PST Provinces
  // -------------------------------------------------
  describe('GST + PST Provinces', () => {
    it('British Columbia (BC) - GST 5% + PST 7%', () => {
      const result = calculateTaxes(subtotal, 'BC', 'CA');
      expect(result.gstAmount).toBeCloseTo(5, 2);
      expect(result.pstAmount).toBeCloseTo(7, 2);
      expect(result.totalTax).toBeCloseTo(12, 2);
      expect(result.federalTaxLabel).toBe('GST');
      expect(result.provincialTaxLabel).toBe('PST');
    });

    it('Saskatchewan (SK) - GST 5% + PST 6%', () => {
      const result = calculateTaxes(subtotal, 'SK', 'CA');
      expect(result.gstAmount).toBe(5);
      expect(result.pstAmount).toBe(6);
      expect(result.totalTax).toBe(11);
    });
  });

  // -------------------------------------------------
  // GST + RST (Manitoba)
  // -------------------------------------------------
  describe('GST + RST Province', () => {
    it('Manitoba (MB) - GST 5% + RST 7%', () => {
      const result = calculateTaxes(subtotal, 'MB', 'CA');
      expect(result.gstAmount).toBeCloseTo(5, 2);
      expect(result.rstAmount).toBeCloseTo(7, 2);
      expect(result.totalTax).toBeCloseTo(12, 2);
      expect(result.provincialTaxLabel).toBe('RST');
    });
  });

  // -------------------------------------------------
  // GST + QST (Quebec)
  // -------------------------------------------------
  describe('GST + QST Province', () => {
    it('Quebec (QC) - GST 5% + QST 9.975%', () => {
      const result = calculateTaxes(subtotal, 'QC', 'CA');
      expect(result.gstAmount).toBe(5);
      expect(result.qstAmount).toBeCloseTo(9.975, 2);
      expect(result.totalTax).toBeCloseTo(14.975, 2);
      expect(result.federalTaxLabel).toBe('TPS/GST');
      expect(result.provincialTaxLabel).toBe('TVQ/QST');
    });
  });

  // -------------------------------------------------
  // GST Only Provinces/Territories
  // -------------------------------------------------
  describe('GST Only Provinces/Territories', () => {
    it('Alberta (AB) - GST 5% only', () => {
      const result = calculateTaxes(subtotal, 'AB', 'CA');
      expect(result.gstAmount).toBe(5);
      expect(result.hstAmount).toBe(0);
      expect(result.pstAmount).toBe(0);
      expect(result.qstAmount).toBe(0);
      expect(result.rstAmount).toBe(0);
      expect(result.totalTax).toBe(5);
      expect(result.provincialTaxLabel).toBeNull();
    });

    it('Yukon (YT) - GST 5% only', () => {
      const result = calculateTaxes(subtotal, 'YT', 'CA');
      expect(result.gstAmount).toBe(5);
      expect(result.totalTax).toBe(5);
    });

    it('Northwest Territories (NT) - GST 5% only', () => {
      const result = calculateTaxes(subtotal, 'NT', 'CA');
      expect(result.gstAmount).toBe(5);
      expect(result.totalTax).toBe(5);
    });

    it('Nunavut (NU) - GST 5% only', () => {
      const result = calculateTaxes(subtotal, 'NU', 'CA');
      expect(result.gstAmount).toBe(5);
      expect(result.totalTax).toBe(5);
    });
  });

  // -------------------------------------------------
  // Export / International (Zero-rated)
  // -------------------------------------------------
  describe('Exports (Zero-rated)', () => {
    it('US states should be zero-rated', () => {
      const result = calculateTaxes(subtotal, 'NY', 'US');
      expect(result.isExport).toBe(true);
      expect(result.totalTax).toBe(0);
      expect(result.gstAmount).toBe(0);
      expect(result.hstAmount).toBe(0);
    });

    it('France (EU/CETA) should be zero-rated', () => {
      const result = calculateTaxes(subtotal, 'FR', 'FR');
      expect(result.isExport).toBe(true);
      expect(result.totalTax).toBe(0);
    });

    it('Japan (CPTPP) should be zero-rated', () => {
      const result = calculateTaxes(subtotal, 'JP', 'JP');
      expect(result.isExport).toBe(true);
      expect(result.totalTax).toBe(0);
    });

    it('Unknown international destination should be zero-rated', () => {
      const result = calculateTaxes(subtotal, 'XX', 'XX');
      expect(result.isExport).toBe(true);
      expect(result.totalTax).toBe(0);
    });
  });

  // -------------------------------------------------
  // Grand Total
  // -------------------------------------------------
  describe('Grand Total calculation', () => {
    it('should compute grandTotal = subtotal + totalTax', () => {
      const result = calculateTaxes(100, 'ON', 'CA');
      expect(result.grandTotal).toBe(113);
    });

    it('should include USD conversion', () => {
      const result = calculateTaxes(100, 'QC', 'CA');
      expect(result.subtotalUSD).toBeGreaterThan(0);
      expect(result.subtotalUSD).toBeLessThan(100); // CAD > USD typically
      expect(result.grandTotalUSD).toBeGreaterThan(result.subtotalUSD);
    });
  });
});

// =====================================================
// EDGE CASES
// =====================================================

describe('Tax Calculations - Edge Cases', () => {
  it('should handle zero amount', () => {
    const result = calculateTaxes(0, 'QC', 'CA');
    expect(result.gstAmount).toBe(0);
    expect(result.qstAmount).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  it('should handle negative amounts (returns negative tax)', () => {
    // Negative amounts might represent refunds
    const result = calculateTaxes(-100, 'QC', 'CA');
    expect(result.gstAmount).toBe(-5);
    expect(result.qstAmount).toBeCloseTo(-9.975, 2);
    expect(result.totalTax).toBeCloseTo(-14.975, 2);
  });

  it('should handle very large amounts', () => {
    const result = calculateTaxes(1000000, 'ON', 'CA');
    expect(result.hstAmount).toBe(130000);
    expect(result.totalTax).toBe(130000);
    expect(result.grandTotal).toBe(1130000);
  });

  it('should handle fractional cents correctly', () => {
    const result = calculateTaxes(99.99, 'QC', 'CA');
    expect(result.gstAmount).toBeCloseTo(99.99 * 0.05, 2);
    expect(result.qstAmount).toBeCloseTo(99.99 * 0.09975, 2);
  });

  it('should handle very small amounts', () => {
    const result = calculateTaxes(0.01, 'ON', 'CA');
    expect(result.hstAmount).toBeCloseTo(0.01 * 0.13, 4);
    expect(result.totalTax).toBeCloseTo(0.01 * 0.13, 4);
  });

  it('should default to QC when province code is unknown for CA', () => {
    const result = calculateTaxes(100, 'XX', 'CA');
    const qcResult = calculateTaxes(100, 'QC', 'CA');
    expect(result.totalTax).toBe(qcResult.totalTax);
  });

  it('should handle lowercase province codes', () => {
    const upper = calculateTaxes(100, 'ON', 'CA');
    const lower = calculateTaxes(100, 'on', 'CA');
    expect(lower.totalTax).toBe(upper.totalTax);
  });
});

// =====================================================
// ALL 13 PROVINCES/TERRITORIES RATES
// =====================================================

describe('Tax Rates Integrity', () => {
  it('should have all 13 Canadian provinces/territories defined', () => {
    const expectedCodes = ['ON', 'NB', 'NS', 'NL', 'PE', 'BC', 'SK', 'MB', 'QC', 'AB', 'YT', 'NT', 'NU'];
    expectedCodes.forEach((code) => {
      expect(CANADIAN_PROVINCES[code]).toBeDefined();
      expect(CANADIAN_PROVINCES[code].code).toBe(code);
      expect(CANADIAN_PROVINCES[code].country).toBe('CA');
    });
  });

  it('should have consistent totalRate for each province', () => {
    Object.values(CANADIAN_PROVINCES).forEach((p) => {
      const computed =
        (p.gst || 0) + (p.hst || 0) + (p.pst || 0) + (p.qst || 0) + (p.rst || 0);
      expect(p.totalRate).toBeCloseTo(computed, 4);
    });
  });
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

describe('getProvincesList', () => {
  it('should return Canadian provinces in French', () => {
    const provinces = getProvincesList('fr', 'CA');
    expect(provinces.length).toBe(13);
    const quebec = provinces.find((p) => p.code === 'QC');
    expect(quebec).toBeDefined();
    expect(quebec?.name).toBe('Qu\u00e9bec');
  });

  it('should return Canadian provinces in English', () => {
    const provinces = getProvincesList('en', 'CA');
    const quebec = provinces.find((p) => p.code === 'QC');
    expect(quebec?.name).toBe('Quebec');
  });

  it('should return US states when country is US', () => {
    const states = getProvincesList('en', 'US');
    expect(states.length).toBeGreaterThan(0);
    const ny = states.find((s) => s.code === 'NY');
    expect(ny).toBeDefined();
    expect(ny?.country).toBe('US');
  });

  it('should return both CA and US when country is ALL', () => {
    const all = getProvincesList('en', 'ALL');
    const caCount = all.filter((p) => p.country === 'CA').length;
    const usCount = all.filter((p) => p.country === 'US').length;
    expect(caCount).toBe(13);
    expect(usCount).toBeGreaterThan(0);
  });
});

describe('getCountriesList', () => {
  it('should return countries list in English', () => {
    const countries = getCountriesList('en');
    expect(countries.length).toBeGreaterThan(0);
    const canada = countries.find((c) => c.code === 'CA');
    expect(canada).toBeDefined();
    expect(canada?.name).toBe('Canada');
  });

  it('should return countries list in French', () => {
    const countries = getCountriesList('fr');
    const us = countries.find((c) => c.code === 'US');
    expect(us?.name).toBe('\u00c9tats-Unis');
  });

  it('should have Canada as first country', () => {
    const countries = getCountriesList('en');
    expect(countries[0].code).toBe('CA');
  });

  it('should include FTA information', () => {
    const countries = getCountriesList('en');
    const us = countries.find((c) => c.code === 'US');
    expect(us?.hasFTA).toBe(true);
    expect(us?.ftaName).toBe('CUSMA');
  });

  it('should include EU CETA countries', () => {
    const countries = getCountriesList('en');
    const france = countries.find((c) => c.code === 'FR');
    expect(france).toBeDefined();
    expect(france?.hasFTA).toBe(true);
    expect(france?.ftaName).toBe('CETA');
  });
});

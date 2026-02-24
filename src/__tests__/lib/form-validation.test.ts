/**
 * @jest-environment node
 */

/**
 * Form Validation Tests
 *
 * Tests validation utilities used in checkout and account forms:
 * - Address validation (shipping/billing)
 * - Canadian postal code formats
 * - US ZIP code formats
 * - Email validation
 * - Phone validation
 * - Name validation
 * - Amount validation
 * - Promo code validation
 * - Generic schema validation
 */

import {
  isValidEmail,
  isValidPostalCode,
  formatPostalCode,
  isValidPhone,
  formatPhone,
  isValidName,
  isValidAmount,
  isValidUrl,
  isValidDate,
  isFutureDate,
  isPastDate,
  isValidPromoCode,
  validateShippingAddress,
  validateSchema,
  sanitizeString,
  escapeHtml,
  sanitizeObject,
  formatCurrency,
} from '@/lib/validation';

// =====================================================
// ADDRESS VALIDATION
// =====================================================

describe('Address Validation', () => {
  it('should accept a complete valid address', () => {
    const result = validateShippingAddress({
      name: 'Jean Dupont',
      address1: '123 Rue Principale',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('should reject missing name', () => {
    const result = validateShippingAddress({
      address1: '123 Rue Principale',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('should reject short address', () => {
    const result = validateShippingAddress({
      name: 'Test',
      address1: '123',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.address1).toBeDefined();
  });

  it('should reject missing city', () => {
    const result = validateShippingAddress({
      name: 'Test User',
      address1: '123 Main Street',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.city).toBeDefined();
  });

  it('should reject missing state/province', () => {
    const result = validateShippingAddress({
      name: 'Test User',
      address1: '123 Main Street',
      city: 'Montreal',
      postalCode: 'H2X 1Y4',
      country: 'CA',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.state).toBeDefined();
  });

  it('should reject invalid postal code for the country', () => {
    const result = validateShippingAddress({
      name: 'Test User',
      address1: '123 Main Street',
      city: 'Montreal',
      state: 'QC',
      postalCode: '12345', // US format in CA
      country: 'CA',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.postalCode).toBeDefined();
  });

  it('should reject country code that is not 2 characters', () => {
    const result = validateShippingAddress({
      name: 'Test User',
      address1: '123 Main Street',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CAN', // 3 chars
    });
    expect(result.valid).toBe(false);
    expect(result.errors.country).toBeDefined();
  });

  it('should accept valid phone number', () => {
    const result = validateShippingAddress({
      name: 'Test User',
      address1: '123 Main Street',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
      phone: '(514) 555-1234',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid phone number', () => {
    const result = validateShippingAddress({
      name: 'Test User',
      address1: '123 Main Street',
      city: 'Montreal',
      state: 'QC',
      postalCode: 'H2X 1Y4',
      country: 'CA',
      phone: 'abc',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toBeDefined();
  });
});

// =====================================================
// CANADIAN POSTAL CODES
// =====================================================

describe('Canadian Postal Code Validation', () => {
  describe('valid formats', () => {
    const validCodes = [
      'H2X 1Y4',
      'h2x 1y4',    // lowercase
      'H2X1Y4',     // no space
      'H2X-1Y4',    // hyphen separator
      'K1A 0B1',    // Ottawa
      'V6B 3K9',    // Vancouver
      'T2P 2G8',    // Calgary
      'M5V 3L9',    // Toronto
      'G1R 4S9',    // Quebec City
    ];

    test.each(validCodes)('should accept %s', (code) => {
      expect(isValidPostalCode(code, 'CA')).toBe(true);
    });
  });

  describe('invalid formats', () => {
    const invalidCodes = [
      '12345',        // US ZIP
      'ABCDEF',       // all letters
      '123456',       // all numbers
      'H2X',          // too short
      'H2X 1Y4 5',   // too long
      '',             // empty
      '22X 1Y4',     // starts with number instead of letter
    ];

    test.each(invalidCodes)('should reject %s', (code) => {
      expect(isValidPostalCode(code, 'CA')).toBe(false);
    });
  });

  describe('formatPostalCode', () => {
    it('should format 6-char code with space', () => {
      expect(formatPostalCode('h2x1y4', 'CA')).toBe('H2X 1Y4');
    });

    it('should uppercase existing formatted code', () => {
      expect(formatPostalCode('h2x 1y4', 'CA')).toBe('H2X 1Y4');
    });
  });
});

// =====================================================
// US ZIP CODES
// =====================================================

describe('US ZIP Code Validation', () => {
  describe('valid formats', () => {
    const validCodes = [
      '12345',
      '12345-6789',  // ZIP+4
      '90210',
      '10001',
      '00501',       // lowest ZIP
    ];

    test.each(validCodes)('should accept %s', (code) => {
      expect(isValidPostalCode(code, 'US')).toBe(true);
    });
  });

  describe('invalid formats', () => {
    const invalidCodes = [
      'ABCDE',       // letters
      '1234',        // 4 digits
      '123456',      // 6 digits
      '12345-67',    // invalid ZIP+4
      'H2X 1Y4',    // Canadian format
      '',            // empty
    ];

    test.each(invalidCodes)('should reject %s', (code) => {
      expect(isValidPostalCode(code, 'US')).toBe(false);
    });
  });
});

// =====================================================
// OTHER COUNTRY POSTAL CODES
// =====================================================

describe('Other Country Postal Codes', () => {
  it('should validate French postal codes (5 digits)', () => {
    expect(isValidPostalCode('75001', 'FR')).toBe(true);
    expect(isValidPostalCode('ABCDE', 'FR')).toBe(false);
  });

  it('should validate German postal codes (5 digits)', () => {
    expect(isValidPostalCode('10115', 'DE')).toBe(true);
    expect(isValidPostalCode('1011', 'DE')).toBe(false);
  });

  it('should validate UK postal codes', () => {
    expect(isValidPostalCode('SW1A 1AA', 'UK')).toBe(true);
    expect(isValidPostalCode('EC1A 1BB', 'UK')).toBe(true);
  });

  it('should accept any format for unsupported countries', () => {
    expect(isValidPostalCode('anything', 'JP')).toBe(true);
    expect(isValidPostalCode('123-4567', 'JP')).toBe(true);
  });
});

// =====================================================
// EMAIL VALIDATION
// =====================================================

describe('Email Validation', () => {
  describe('valid emails', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.com',
      'firstname.lastname@company.org',
      'email@subdomain.domain.com',
      'user123@example.com',
      'user-name@example.com',
      'user_name@example.com',
    ];

    test.each(validEmails)('should accept %s', (email) => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  describe('invalid emails', () => {
    const invalidEmails = [
      '',
      'invalid',
      'no@domain',
      '@nodomain.com',
      'spaces in@email.com',
      'missing@.com',
      'double@@example.com',
      'a'.repeat(246) + '@test.com', // > 254 chars (255 total)
    ];

    test.each(invalidEmails)('should reject "%s"', (email) => {
      expect(isValidEmail(email)).toBe(false);
    });
  });
});

// =====================================================
// PHONE VALIDATION
// =====================================================

describe('Phone Validation', () => {
  it('should accept empty phone (optional field)', () => {
    expect(isValidPhone('')).toBe(true);
  });

  it('should accept valid phone formats', () => {
    expect(isValidPhone('5145551234')).toBe(true);
    expect(isValidPhone('(514) 555-1234')).toBe(true);
    expect(isValidPhone('514-555-1234')).toBe(true);
    expect(isValidPhone('+15145551234')).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
  });

  describe('formatPhone', () => {
    it('should format 10-digit Canadian numbers', () => {
      expect(formatPhone('5145551234', 'CA')).toBe('(514) 555-1234');
    });

    it('should format 11-digit numbers with +1', () => {
      expect(formatPhone('15145551234', 'CA')).toBe('+1 (514) 555-1234');
    });
  });
});

// =====================================================
// NAME VALIDATION
// =====================================================

describe('Name Validation', () => {
  it('should accept valid names', () => {
    expect(isValidName('Jean')).toBe(true);
    expect(isValidName("O'Brien")).toBe(true);
    expect(isValidName('Jean-Pierre')).toBe(true);
    expect(isValidName('Marie Claire')).toBe(true);
  });

  it('should accept names with accents', () => {
    expect(isValidName('Rene')).toBe(true);
    expect(isValidName('Francois')).toBe(true);
  });

  it('should reject names that are too short', () => {
    expect(isValidName('A')).toBe(false);
    expect(isValidName('')).toBe(false);
  });

  it('should reject names with numbers or special chars', () => {
    expect(isValidName('User123')).toBe(false);
    expect(isValidName('Test@User')).toBe(false);
  });
});

// =====================================================
// AMOUNT VALIDATION
// =====================================================

describe('Amount Validation', () => {
  it('should accept valid amounts', () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(99.99)).toBe(true);
    expect(isValidAmount(1000000)).toBe(true);
    expect(isValidAmount('49.99')).toBe(true);
  });

  it('should reject invalid amounts', () => {
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(Infinity)).toBe(false);
    expect(isValidAmount('not-a-number')).toBe(false);
  });
});

// =====================================================
// URL VALIDATION
// =====================================================

describe('URL Validation', () => {
  it('should accept valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false); // only http/https
    expect(isValidUrl('')).toBe(false);
  });
});

// =====================================================
// DATE VALIDATION
// =====================================================

describe('Date Validation', () => {
  it('should accept valid dates', () => {
    expect(isValidDate('2025-01-15')).toBe(true);
    expect(isValidDate('2025-12-31T23:59:59Z')).toBe(true);
  });

  it('should reject invalid dates', () => {
    expect(isValidDate('not-a-date')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });

  it('should detect future dates', () => {
    expect(isFutureDate('2099-12-31')).toBe(true);
    expect(isFutureDate('2000-01-01')).toBe(false);
  });

  it('should detect past dates', () => {
    expect(isPastDate('2000-01-01')).toBe(true);
    expect(isPastDate('2099-12-31')).toBe(false);
  });
});

// =====================================================
// PROMO CODE VALIDATION
// =====================================================

describe('Promo Code Validation', () => {
  it('should accept valid promo codes', () => {
    expect(isValidPromoCode('SAVE10')).toBe(true);
    expect(isValidPromoCode('summer-2025')).toBe(true);
    expect(isValidPromoCode('CODE_123')).toBe(true);
    expect(isValidPromoCode('ABC')).toBe(true); // minimum 3 chars
  });

  it('should reject invalid promo codes', () => {
    expect(isValidPromoCode('')).toBe(false);
    expect(isValidPromoCode('AB')).toBe(false); // too short
    expect(isValidPromoCode('A'.repeat(21))).toBe(false); // too long
    expect(isValidPromoCode('INVALID CODE')).toBe(false); // spaces
    expect(isValidPromoCode('CODE@123')).toBe(false); // special chars
  });
});

// =====================================================
// SANITIZATION
// =====================================================

describe('Sanitization', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<script>');
      expect(sanitizeString('<div>text</div>')).not.toContain('<div>');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeString('javascript:alert(1)')).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      expect(sanitizeString('onclick=alert(1)')).not.toContain('onclick=');
    });

    it('should handle empty string', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("it's")).toBe("it&#039;s");
      expect(escapeHtml('&amp')).toBe('&amp;amp');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string values in an object', () => {
      const dirty = {
        name: '<script>alert("xss")</script>',
        age: 25,
        address: {
          city: '<b>Montreal</b>',
        },
      };
      const clean = sanitizeObject(dirty);
      expect(clean.name).not.toContain('<script>');
      expect(clean.age).toBe(25);
      expect((clean.address as Record<string, string>).city).not.toContain('<b>');
    });
  });
});

// =====================================================
// SCHEMA VALIDATION
// =====================================================

describe('Schema Validation', () => {
  it('should validate required fields', () => {
    const schema = {
      name: { required: true, type: 'string' as const },
      email: { required: true, type: 'email' as const },
    };
    const result = validateSchema({ name: 'Test', email: 'test@example.com' }, schema);
    expect(result.valid).toBe(true);
  });

  it('should reject missing required fields', () => {
    const schema = {
      name: { required: true, type: 'string' as const },
    };
    const result = validateSchema({}, schema);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('should validate min/max for strings', () => {
    const schema = {
      name: { required: true, type: 'string' as const, min: 2, max: 10 },
    };
    expect(validateSchema({ name: 'A' }, schema).valid).toBe(false);
    expect(validateSchema({ name: 'AB' }, schema).valid).toBe(true);
    expect(validateSchema({ name: 'A'.repeat(11) }, schema).valid).toBe(false);
  });

  it('should validate min/max for numbers', () => {
    const schema = {
      quantity: { required: true, type: 'number' as const, min: 1, max: 100 },
    };
    expect(validateSchema({ quantity: 0 }, schema).valid).toBe(false);
    expect(validateSchema({ quantity: 5 }, schema).valid).toBe(true);
    expect(validateSchema({ quantity: 101 }, schema).valid).toBe(false);
  });

  it('should validate custom rules', () => {
    const schema = {
      age: {
        required: true,
        custom: (val: unknown) => (typeof val === 'number' && val >= 18) || 'Must be 18+',
      },
    };
    expect(validateSchema({ age: 17 }, schema).valid).toBe(false);
    expect(validateSchema({ age: 18 }, schema).valid).toBe(true);
  });

  it('should validate email type', () => {
    const schema = {
      email: { required: true, type: 'email' as const },
    };
    expect(validateSchema({ email: 'valid@test.com' }, schema).valid).toBe(true);
    expect(validateSchema({ email: 'invalid' }, schema).valid).toBe(false);
  });

  it('should validate pattern', () => {
    const schema = {
      code: { required: true, type: 'string' as const, pattern: /^[A-Z]{3}$/ },
    };
    expect(validateSchema({ code: 'ABC' }, schema).valid).toBe(true);
    expect(validateSchema({ code: 'abc' }, schema).valid).toBe(false);
    expect(validateSchema({ code: 'ABCD' }, schema).valid).toBe(false);
  });
});

// =====================================================
// CURRENCY FORMATTING
// =====================================================

describe('Currency Formatting', () => {
  it('should format CAD amounts', () => {
    const formatted = formatCurrency(99.99, 'CAD');
    expect(formatted).toContain('99');
  });

  it('should format zero amount', () => {
    const formatted = formatCurrency(0, 'CAD');
    expect(formatted).toContain('0');
  });
});

/**
 * Tests for Validation Utilities
 */

import {
  isValidEmail,
  validatePassword,
  isValidPostalCode,
  sanitizeString,
  escapeHtml,
} from '../lib/validation';

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      expect(validatePassword('SecureP@ss123').valid).toBe(true);
      expect(validatePassword('MyStr0ng!Password').valid).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('short').valid).toBe(false);
      expect(validatePassword('nouppercase1!').valid).toBe(false);
      expect(validatePassword('NOLOWERCASE1!').valid).toBe(false);
      expect(validatePassword('NoNumbers!').valid).toBe(false);
    });

    it('should provide error messages', () => {
      const result = validatePassword('weak');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('isValidPostalCode', () => {
    it('should accept valid Canadian postal codes', () => {
      expect(isValidPostalCode('H2X 1Y4', 'CA')).toBe(true);
      expect(isValidPostalCode('h2x1y4', 'CA')).toBe(true);
      expect(isValidPostalCode('H2X-1Y4', 'CA')).toBe(true);
    });

    it('should accept valid US ZIP codes', () => {
      expect(isValidPostalCode('12345', 'US')).toBe(true);
      expect(isValidPostalCode('12345-6789', 'US')).toBe(true);
    });

    it('should reject invalid postal codes', () => {
      expect(isValidPostalCode('invalid', 'CA')).toBe(false);
      expect(isValidPostalCode('12345', 'CA')).toBe(false);
      expect(isValidPostalCode('ABCDEF', 'US')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<script>');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('');
    });
  });
});

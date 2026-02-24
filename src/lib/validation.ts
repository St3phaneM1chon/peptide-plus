/**
 * VALIDATION & SANITIZATION UTILITIES
 * Protection contre XSS, injection SQL, et validation des données
 */

import DOMPurify from 'isomorphic-dompurify';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';

// =====================================================
// HTML SANITIZATION (Server-side DOMPurify)
// =====================================================

/** Safe HTML tags allowed in rich-text content (blog, articles, product descriptions) */
const RICH_TEXT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'span', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'figure', 'figcaption',
    'hr', 'sup', 'sub',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'id',
    'src', 'alt', 'width', 'height', 'loading',
    'colspan', 'rowspan',
  ],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

/** Minimal tags for simple formatted text (comments, reviews, FAQ answers) */
const SIMPLE_TEXT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize rich HTML content (blog posts, articles, product descriptions).
 * Allows a safe subset of tags while stripping scripts, event handlers, etc.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG as Parameters<typeof DOMPurify.sanitize>[1]);
}

/**
 * Sanitize simple formatted text (reviews, comments, FAQ answers).
 * Only allows basic formatting tags.
 */
export function sanitizeSimpleHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, SIMPLE_TEXT_CONFIG as Parameters<typeof DOMPurify.sanitize>[1]);
}

/**
 * Strip ALL HTML tags, returning plain text only.
 * Use for fields that should never contain HTML (names, codes, etc.)
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
}

// =====================================================
// SANITIZATION
// =====================================================

/**
 * Échappe les caractères HTML dangereux
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Supprime les caractères potentiellement dangereux
 */
export function sanitizeString(str: string): string {
  if (!str) return '';
  return str
    .replace(/[<>'"]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Sanitize un objet complet récursivement
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  
  for (const key of Object.keys(result)) {
    const value = result[key];
    
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    }
  }
  
  return result;
}

// =====================================================
// VALIDATION - EMAIL
// =====================================================

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email.toLowerCase());
}

// =====================================================
// VALIDATION - PASSWORD
// =====================================================

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
  score: number;
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (!password) {
    return { valid: false, errors: ['Mot de passe requis'], strength: 'weak', score: 0 };
  }

  // Longueur minimum
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Minimum ${PASSWORD_MIN_LENGTH} caractères`);
  } else {
    score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
  }

  // Majuscules
  if (!/[A-Z]/.test(password)) {
    errors.push('Au moins une majuscule');
  } else {
    score += 15;
  }

  // Minuscules
  if (!/[a-z]/.test(password)) {
    errors.push('Au moins une minuscule');
  } else {
    score += 15;
  }

  // Chiffres
  if (!/\d/.test(password)) {
    errors.push('Au moins un chiffre');
  } else {
    score += 15;
  }

  // Caractères spéciaux
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Au moins un caractère spécial (!@#$%^&*...)');
  } else {
    score += 25;
  }

  // Patterns faibles
  const weakPatterns = [
    /^123456/,
    /^password/i,
    /^qwerty/i,
    /^abc123/i,
    /(.)\1{2,}/, // 3+ caractères répétés
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 20);
      errors.push('Évitez les patterns prévisibles');
      break;
    }
  }

  let strength: PasswordValidationResult['strength'];
  if (score < 30) strength = 'weak';
  else if (score < 50) strength = 'medium';
  else if (score < 75) strength = 'strong';
  else strength = 'very_strong';

  return {
    valid: errors.length === 0,
    errors,
    strength,
    score: Math.min(100, score),
  };
}

// =====================================================
// VALIDATION - PHONE
// =====================================================

// Formats acceptés: +1234567890, (123) 456-7890, 123-456-7890
const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;

export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Optionnel
  return PHONE_REGEX.test(phone.replace(/\s/g, ''));
}

export function formatPhone(phone: string, country: string = 'CA'): string {
  const digits = phone.replace(/\D/g, '');
  
  if (country === 'CA' || country === 'US') {
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
  }
  
  return phone;
}

// =====================================================
// VALIDATION - POSTAL CODES
// =====================================================

const POSTAL_PATTERNS: Record<string, RegExp> = {
  CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
  US: /^\d{5}(-\d{4})?$/,
  FR: /^\d{5}$/,
  UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
  DE: /^\d{5}$/,
};

export function isValidPostalCode(postalCode: string, country: string = 'CA'): boolean {
  if (!postalCode) return false;
  const pattern = POSTAL_PATTERNS[country.toUpperCase()];
  if (!pattern) return true; // Pas de validation pour les pays non supportés
  return pattern.test(postalCode.trim());
}

export function formatPostalCode(postalCode: string, country: string = 'CA'): string {
  const clean = postalCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (country === 'CA' && clean.length === 6) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  
  return postalCode.toUpperCase();
}

// =====================================================
// VALIDATION - NAMES
// =====================================================

export function isValidName(name: string, minLength: number = 2, maxLength: number = 100): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return false;
  // Permet lettres, espaces, apostrophes, tirets
  return /^[\p{L}\s'-]+$/u.test(trimmed);
}

// =====================================================
// VALIDATION - AMOUNTS
// =====================================================

export function isValidAmount(amount: number | string): boolean {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && isFinite(num) && num >= 0;
}

export function formatCurrency(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
  }).format(amount);
}

// =====================================================
// VALIDATION - URLS
// =====================================================

export function isValidUrl(url: string, allowedProtocols: string[] = ['http', 'https']): boolean {
  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol.replace(':', ''));
  } catch (error) {
    console.error('[Validation] Invalid URL format:', error);
    return false;
  }
}

// =====================================================
// VALIDATION - DATES
// =====================================================

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date > new Date();
}

export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date < new Date();
}

// =====================================================
// VALIDATION - CHECKOUT / ORDER
// =====================================================

export interface AddressValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateShippingAddress(address: {
  name?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}): AddressValidationResult {
  const errors: Record<string, string> = {};

  if (!address.name || !isValidName(address.name)) {
    errors.name = 'Nom requis (2-100 caractères)';
  }

  if (!address.address1 || address.address1.length < 5) {
    errors.address1 = 'Adresse requise (minimum 5 caractères)';
  }

  if (!address.city || address.city.length < 2) {
    errors.city = 'Ville requise';
  }

  if (!address.state || address.state.length < 2) {
    errors.state = 'Province/État requis';
  }

  if (!address.postalCode || !isValidPostalCode(address.postalCode, address.country || 'CA')) {
    errors.postalCode = 'Code postal invalide';
  }

  if (!address.country || address.country.length !== 2) {
    errors.country = 'Pays requis (code ISO)';
  }

  if (address.phone && !isValidPhone(address.phone)) {
    errors.phone = 'Numéro de téléphone invalide';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// =====================================================
// VALIDATION - PROMO CODES
// =====================================================

export function isValidPromoCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  // Alphanumérique, tirets, underscores, 3-20 caractères
  return /^[A-Za-z0-9_-]{3,20}$/.test(code);
}

// =====================================================
// FILE UPLOAD VALIDATION
// =====================================================

/** Default maximum file size: 10MB */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Default allowed MIME types for file uploads */
export const DEFAULT_ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export interface FileValidationOptions {
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Allowed MIME types (default: images + PDF) */
  allowedTypes?: string[];
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an uploaded file's type and size.
 * Should be called BEFORE any file processing or storage.
 */
export function validateUploadedFile(
  file: { type: string; size: number; name: string },
  options: FileValidationOptions = {}
): FileValidationResult {
  const maxSize = options.maxSize ?? DEFAULT_MAX_FILE_SIZE;
  const allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_FILE_TYPES;

  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File too large (max ${maxMB}MB)` };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

// =====================================================
// GENERIC SCHEMA VALIDATION
// =====================================================

export type ValidationRule = {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'url' | 'date';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | string;
};

export type ValidationSchema = Record<string, ValidationRule>;

export function validateSchema(
  data: Record<string, unknown>,
  schema: ValidationSchema
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} est requis`;
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type checks
    if (rules.type) {
      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') errors[field] = `${field} doit être du texte`;
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) errors[field] = `${field} doit être un nombre`;
          break;
        case 'boolean':
          if (typeof value !== 'boolean') errors[field] = `${field} doit être vrai/faux`;
          break;
        case 'email':
          if (!isValidEmail(String(value))) errors[field] = 'Email invalide';
          break;
        case 'phone':
          if (!isValidPhone(String(value))) errors[field] = 'Téléphone invalide';
          break;
        case 'url':
          if (!isValidUrl(String(value))) errors[field] = 'URL invalide';
          break;
        case 'date':
          if (!isValidDate(String(value))) errors[field] = 'Date invalide';
          break;
      }
    }

    // Min/Max for numbers and strings
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors[field] = `${field} doit être au minimum ${rules.min}`;
    }
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors[field] = `${field} doit être au maximum ${rules.max}`;
    }
    if (rules.min !== undefined && typeof value === 'string' && value.length < rules.min) {
      errors[field] = `${field} doit avoir au minimum ${rules.min} caractères`;
    }
    if (rules.max !== undefined && typeof value === 'string' && value.length > rules.max) {
      errors[field] = `${field} doit avoir au maximum ${rules.max} caractères`;
    }

    // Pattern
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors[field] = `${field} format invalide`;
    }

    // Custom validation
    if (rules.custom) {
      const result = rules.custom(value);
      if (result !== true) {
        errors[field] = typeof result === 'string' ? result : `${field} invalide`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

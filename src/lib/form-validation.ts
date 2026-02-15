/**
 * FORM VALIDATION SCHEMAS (Zod)
 * Client-side validation for forms across the store.
 */

import { z, type ZodSchema } from 'zod';

// ============================================================
// Address Schema
// ============================================================

const CANADIAN_POSTAL = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
const US_ZIP = /^\d{5}(-\d{4})?$/;

export const addressSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be at most 50 characters'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be at most 50 characters'),
  address1: z
    .string()
    .min(1, 'Address is required'),
  city: z
    .string()
    .min(1, 'City is required'),
  province: z
    .string()
    .length(2, 'Province/State must be a 2-character code'),
  postalCode: z
    .string()
    .min(1, 'Postal code is required'),
  country: z
    .enum(['CA', 'US'], { errorMap: () => ({ message: 'Country must be CA or US' }) }),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.replace(/\D/g, '').length >= 10,
      'Phone number must be at least 10 digits'
    ),
}).refine(
  (data) => {
    if (data.country === 'CA') return CANADIAN_POSTAL.test(data.postalCode);
    if (data.country === 'US') return US_ZIP.test(data.postalCode);
    return true;
  },
  {
    message: 'Invalid postal code format',
    path: ['postalCode'],
  }
);

export type AddressFormData = z.infer<typeof addressSchema>;

// ============================================================
// Checkout Shipping Schema (uses different field names)
// ============================================================

export const checkoutShippingSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be at most 50 characters'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be at most 50 characters'),
  address: z
    .string()
    .min(1, 'Address is required'),
  city: z
    .string()
    .min(1, 'City is required'),
  province: z
    .string()
    .min(1, 'Province/State is required'),
  postalCode: z
    .string(),
  country: z
    .string()
    .min(2, 'Country is required'),
});

export type CheckoutShippingData = z.infer<typeof checkoutShippingSchema>;

// ============================================================
// Contact Form Schema
// ============================================================

export const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string()
    .email('Please enter a valid email address'),
  subject: z
    .string()
    .min(1, 'Subject is required'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be at most 5000 characters'),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;

// ============================================================
// Profile Schema
// ============================================================

export const profileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.replace(/\D/g, '').length >= 10,
      'Phone number must be at least 10 digits'
    ),
  locale: z
    .enum(['en', 'fr', 'es', 'de', 'it', 'pt', 'zh', 'ar', 'hi', 'ko', 'ru', 'sv', 'vi', 'pl', 'pa', 'tl', 'ta', 'ht', 'gcr'], {
      errorMap: () => ({ message: 'Invalid locale code' }),
    })
    .optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// ============================================================
// Settings Profile Schema (for /account/settings profile tab)
// ============================================================

export const settingsProfileSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.replace(/\D/g, '').length >= 10,
      'Phone number must be at least 10 digits'
    ),
});

export type SettingsProfileData = z.infer<typeof settingsProfileSchema>;

// ============================================================
// Generic Form Validation Helper
// ============================================================

export function validateForm<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; errors?: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  return { success: false, errors };
}

/**
 * Contact Form Zod Validation Schemas (Backend Round 2 - Items 16, 20, 22, 23, 24, 25)
 */

import { z } from 'zod';
import { sanitizedString, emailSchema, phoneSchema } from './shared';

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

export const contactFormSchema = z.object({
  name: sanitizedString(1, 100),
  email: emailSchema,
  company: z.string().max(200).optional().nullable(),
  phone: phoneSchema,
  subject: sanitizedString(1, 200),
  message: sanitizedString(10, 10000),
}).strict(); // Item 25: reject unknown fields

export type ContactFormInput = z.infer<typeof contactFormSchema>;

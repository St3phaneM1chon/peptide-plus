/**
 * Employee Zod Validation Schemas
 */

import { z } from 'zod';
import { emailSchema } from './shared';

// ---------------------------------------------------------------------------
// Invite employee (POST /api/admin/employees)
// ---------------------------------------------------------------------------

export const inviteEmployeeSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required').max(200),
  role: z.enum(['EMPLOYEE', 'OWNER']).optional().default('EMPLOYEE'),
  permissions: z.array(z.string().max(100)).optional(),
});

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;

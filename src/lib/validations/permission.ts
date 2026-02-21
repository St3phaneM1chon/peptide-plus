/**
 * Permission Zod Validation Schemas
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Action enum for the permissions POST endpoint
// ---------------------------------------------------------------------------

// Action enum values are used via z.literal() in discriminated union below

// ---------------------------------------------------------------------------
// Seed action
// ---------------------------------------------------------------------------

const seedSchema = z.object({
  action: z.literal('seed'),
});

// ---------------------------------------------------------------------------
// Create group
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  action: z.literal('createGroup'),
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  permissionCodes: z.array(z.string().max(100)).optional(),
});

// ---------------------------------------------------------------------------
// Update group
// ---------------------------------------------------------------------------

const updateGroupSchema = z.object({
  action: z.literal('updateGroup'),
  groupId: z.string().min(1, 'Group ID is required'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  permissionCodes: z.array(z.string().max(100)).optional(),
});

// ---------------------------------------------------------------------------
// Delete group
// ---------------------------------------------------------------------------

const deleteGroupSchema = z.object({
  action: z.literal('deleteGroup'),
  groupId: z.string().min(1, 'Group ID is required'),
});

// ---------------------------------------------------------------------------
// Assign user to group
// ---------------------------------------------------------------------------

const assignGroupSchema = z.object({
  action: z.literal('assignGroup'),
  userId: z.string().min(1, 'User ID is required'),
  groupId: z.string().min(1, 'Group ID is required'),
});

// ---------------------------------------------------------------------------
// Remove user from group
// ---------------------------------------------------------------------------

const removeFromGroupSchema = z.object({
  action: z.literal('removeFromGroup'),
  userId: z.string().min(1, 'User ID is required'),
  groupId: z.string().min(1, 'Group ID is required'),
});

// ---------------------------------------------------------------------------
// Set permission override
// ---------------------------------------------------------------------------

const setOverrideSchema = z.object({
  action: z.literal('setOverride'),
  userId: z.string().min(1, 'User ID is required'),
  permissionCode: z.string().min(1, 'Permission code is required').max(100),
  granted: z.boolean(),
  reason: z.string().max(500).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Remove permission override
// ---------------------------------------------------------------------------

const removeOverrideSchema = z.object({
  action: z.literal('removeOverride'),
  userId: z.string().min(1, 'User ID is required'),
  permissionCode: z.string().min(1, 'Permission code is required').max(100),
});

// ---------------------------------------------------------------------------
// Update default permissions
// ---------------------------------------------------------------------------

const updateDefaultsSchema = z.object({
  action: z.literal('updateDefaults'),
  code: z.string().min(1, 'Permission code is required').max(100),
  defaultOwner: z.boolean().optional(),
  defaultEmployee: z.boolean().optional(),
  defaultClient: z.boolean().optional(),
  defaultCustomer: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Discriminated union on "action"
// ---------------------------------------------------------------------------

export const permissionPostSchema = z.discriminatedUnion('action', [
  seedSchema,
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
  assignGroupSchema,
  removeFromGroupSchema,
  setOverrideSchema,
  removeOverrideSchema,
  updateDefaultsSchema,
]);

export type PermissionPostInput = z.infer<typeof permissionPostSchema>;

/**
 * Product Zod Validation Schemas (Backend Round 2 - Items 16, 18, 19, 22, 24, 25)
 */

import { z } from 'zod';
import { priceSchema, sanitizedString, urlSchema } from './shared';

// ---------------------------------------------------------------------------
// Product image
// ---------------------------------------------------------------------------

const productImageSchema = z.object({
  url: urlSchema,
  alt: z.string().max(500).optional(),
  caption: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
  isPrimary: z.boolean().optional(),
}).strict(); // Item 25: reject unknown fields

// ---------------------------------------------------------------------------
// Product format
// ---------------------------------------------------------------------------

const productFormatSchema = z.object({
  id: z.string().uuid().optional(), // existing format ID for upsert
  formatType: z.string().max(50).optional(),
  name: sanitizedString(1, 200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional().nullable(),
  dosageMg: z.number().min(0).optional().nullable(),
  volumeMl: z.number().min(0).optional().nullable(),
  unitCount: z.number().int().min(0).optional().nullable(),
  costPrice: z.number().min(0).max(99999.99).optional().nullable(),
  price: priceSchema.optional(),
  comparePrice: z.number().min(0).max(99999.99).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  inStock: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).max(999999).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  availability: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
}); // not strict - formats have dynamic fields from admin

// ---------------------------------------------------------------------------
// Create product
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  name: sanitizedString(1, 200),
  subtitle: z.string().max(500).optional().nullable(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  shortDescription: z.string().max(1000).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  fullDetails: z.string().max(100000).optional().nullable(),
  specifications: z.string().max(10000).optional().nullable(),
  productType: z.string().max(50).optional(),
  price: priceSchema,
  compareAtPrice: z.number().min(0).max(99999.99).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  videoUrl: z.string().max(2000).optional().nullable(),
  certificateUrl: z.string().max(2000).optional().nullable(),
  certificateName: z.string().max(200).optional().nullable(),
  dataSheetUrl: z.string().max(2000).optional().nullable(),
  dataSheetName: z.string().max(200).optional().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  weight: z.number().min(0).optional().nullable(),
  dimensions: z.string().max(100).optional().nullable(),
  requiresShipping: z.boolean().optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  origin: z.string().max(100).optional().nullable(),
  supplierUrl: z.string().max(2000).optional().nullable(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  researchSays: z.string().max(50000).optional().nullable(),
  relatedResearch: z.string().max(50000).optional().nullable(),
  participateResearch: z.string().max(50000).optional().nullable(),
  customSections: z.unknown().optional().nullable(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  images: z.array(productImageSchema).max(50).optional(),
  formats: z.array(productFormatSchema).max(50).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ---------------------------------------------------------------------------
// Update product (all fields optional)
// ---------------------------------------------------------------------------

export const updateProductSchema = createProductSchema.partial();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

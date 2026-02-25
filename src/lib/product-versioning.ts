/**
 * Product Version History
 * Track changes to products with diff and rollback capability
 */

export interface ProductVersion {
  id: string;
  productId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changes: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  changedBy: string;
  changedAt: Date;
  reason?: string;
}

export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignoreFields: string[] = ['updatedAt', 'createdAt']
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (ignoreFields.includes(key)) continue;
    const oldVal = before[key];
    const newVal = after[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

export function formatDiffField(field: string): string {
  const labels: Record<string, string> = {
    name: 'Nom',
    price: 'Prix',
    description: 'Description',
    isActive: 'Actif',
    sku: 'SKU',
    categoryId: 'Cat\u00e9gorie',
    imageUrl: 'Image',
    weight: 'Poids',
    tags: 'Tags',
    metaTitle: 'Meta titre',
    metaDescription: 'Meta description',
    stockQuantity: 'Stock',
    reorderPoint: 'Point de r\u00e9appro',
    reorderQuantity: 'Qt\u00e9 r\u00e9appro',
  };
  return labels[field] || field;
}

export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '(vide)';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 100);
  return String(value);
}

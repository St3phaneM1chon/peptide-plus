/**
 * Image Usage Tracker
 * Track where each image is used, prevent deletion of in-use images
 */

export interface ImageUsage {
  imageId: string;
  imageUrl: string;
  usedIn: Array<{
    entityType: 'product' | 'category' | 'article' | 'hero_slide' | 'page' | 'email';
    entityId: string;
    entityName: string;
    field: string; // imageUrl, thumbnailUrl, etc.
  }>;
}

export function canDeleteImage(usage: ImageUsage): { canDelete: boolean; reason?: string } {
  if (usage.usedIn.length === 0) {
    return { canDelete: true };
  }

  const entities = usage.usedIn.map(u => `${u.entityType}: ${u.entityName}`);
  return {
    canDelete: false,
    reason: `Image utilisée dans ${usage.usedIn.length} endroit(s): ${entities.slice(0, 3).join(', ')}${entities.length > 3 ? ` et ${entities.length - 3} autre(s)` : ''}`,
  };
}

export function formatUsageSummary(usage: ImageUsage): string {
  if (usage.usedIn.length === 0) return 'Non utilisée';
  const byType = usage.usedIn.reduce<Record<string, number>>((acc, u) => {
    acc[u.entityType] = (acc[u.entityType] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(byType).map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`).join(', ');
}

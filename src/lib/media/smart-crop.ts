/**
 * Smart Image Cropping
 * Auto-generate crops for different contexts
 */

export interface CropPreset {
  id: string;
  name: string;
  nameFr: string;
  width: number;
  height: number;
  aspectRatio: string;
  usage: string;
}

export const CROP_PRESETS: CropPreset[] = [
  { id: 'square', name: 'Square', nameFr: 'Carré', width: 800, height: 800, aspectRatio: '1:1', usage: 'Product thumbnails, social media' },
  { id: 'landscape', name: 'Landscape', nameFr: 'Paysage', width: 1200, height: 630, aspectRatio: '1.91:1', usage: 'Open Graph, Facebook sharing' },
  { id: 'portrait', name: 'Portrait', nameFr: 'Portrait', width: 600, height: 900, aspectRatio: '2:3', usage: 'Pinterest, stories' },
  { id: 'thumbnail', name: 'Thumbnail', nameFr: 'Miniature', width: 200, height: 200, aspectRatio: '1:1', usage: 'Small previews, lists' },
  { id: 'hero', name: 'Hero Banner', nameFr: 'Bannière héro', width: 1920, height: 600, aspectRatio: '3.2:1', usage: 'Homepage hero, category headers' },
  { id: 'card', name: 'Card', nameFr: 'Carte', width: 400, height: 300, aspectRatio: '4:3', usage: 'Product cards, blog cards' },
];

export function getCropDimensions(
  originalWidth: number,
  originalHeight: number,
  targetWidth: number,
  targetHeight: number
): { x: number; y: number; width: number; height: number } {
  const targetRatio = targetWidth / targetHeight;
  const originalRatio = originalWidth / originalHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (originalRatio > targetRatio) {
    // Original is wider - crop sides
    cropHeight = originalHeight;
    cropWidth = Math.round(originalHeight * targetRatio);
  } else {
    // Original is taller - crop top/bottom
    cropWidth = originalWidth;
    cropHeight = Math.round(originalWidth / targetRatio);
  }

  // Center the crop
  const x = Math.round((originalWidth - cropWidth) / 2);
  const y = Math.round((originalHeight - cropHeight) / 2);

  return { x, y, width: cropWidth, height: cropHeight };
}

export function getRecommendedPresets(usage: string): CropPreset[] {
  const usageLower = usage.toLowerCase();
  if (usageLower.includes('product')) return CROP_PRESETS.filter(p => ['square', 'card', 'thumbnail'].includes(p.id));
  if (usageLower.includes('blog') || usageLower.includes('article')) return CROP_PRESETS.filter(p => ['landscape', 'card', 'thumbnail'].includes(p.id));
  if (usageLower.includes('hero') || usageLower.includes('banner')) return CROP_PRESETS.filter(p => ['hero', 'landscape'].includes(p.id));
  if (usageLower.includes('social')) return CROP_PRESETS.filter(p => ['square', 'landscape', 'portrait'].includes(p.id));
  return CROP_PRESETS;
}

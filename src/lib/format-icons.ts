/**
 * Shared format icon mapping for product formats.
 * Used by ProductCard, QuickViewModal, ProductPageClient, FormatSelector, etc.
 *
 * Single source of truth - do NOT duplicate this mapping in component files.
 */

/** Format icons using emoji representations (lowercase keys, matching DB format types) */
export const FORMAT_ICONS: Record<string, string> = {
  vial_2ml: '💉',
  vial_10ml: '🧪',
  cartridge_3ml: '💊',
  cartridge_kit_12: '📦',
  capsule: '💊',
  capsules_30: '💊',
  capsules_60: '💊',
  capsules_120: '💊',
  pack_2: '📦',
  pack_5: '📦',
  pack_10: '📦',
  box_50: '📦',
  box_100: '📦',
  syringe: '💉',
  accessory: '🔧',
  powder: '🥤',
  gummies: '🍬',
  kit: '🎁',
  bundle: '🎁',
  nasal_spray: '💨',
  cream: '🧴',
};

/** Default icon when format type is not found */
export const DEFAULT_FORMAT_ICON = '📦';

/**
 * Get the icon for a given format type string.
 * Handles case-insensitive lookup.
 */
export function getFormatIcon(formatType: string | undefined | null): string {
  if (!formatType) return DEFAULT_FORMAT_ICON;
  return FORMAT_ICONS[formatType.toLowerCase()] || DEFAULT_FORMAT_ICON;
}

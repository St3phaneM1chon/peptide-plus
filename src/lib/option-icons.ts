/**
 * Shared option icon mapping for product options.
 * Used by ProductCard, QuickViewModal, ProductPageClient, OptionSelector, etc.
 *
 * Single source of truth - do NOT duplicate this mapping in component files.
 */

/** Option icons using emoji representations (lowercase keys, matching DB option types) */
export const OPTION_ICONS: Record<string, string> = {
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

/** Default icon when option type is not found */
export const DEFAULT_OPTION_ICON = '📦';

/**
 * Get the icon for a given option type string.
 * Handles case-insensitive lookup.
 */
export function getOptionIcon(optionType: string | undefined | null): string {
  if (!optionType) return DEFAULT_OPTION_ICON;
  return OPTION_ICONS[optionType.toLowerCase()] || DEFAULT_OPTION_ICON;
}

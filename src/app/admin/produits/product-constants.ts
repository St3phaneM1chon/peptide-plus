type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function getFormatTypes(t: TranslateFn) {
  return [
    { value: 'VIAL_2ML', label: t('admin.productConstants.formatVial2ml'), icon: '💉' },
    { value: 'VIAL_10ML', label: t('admin.productConstants.formatVial10ml'), icon: '💉' },
    { value: 'CARTRIDGE_3ML', label: t('admin.productConstants.formatCartridge3ml'), icon: '🔫' },
    { value: 'KIT_12', label: t('admin.productConstants.formatKit12'), icon: '📦' },
    { value: 'CAPSULE_60', label: t('admin.productConstants.formatCapsule60'), icon: '💊' },
    { value: 'CAPSULE_120', label: t('admin.productConstants.formatCapsule120'), icon: '💊' },
    { value: 'PACK_5', label: t('admin.productConstants.formatPack5'), icon: '📦' },
    { value: 'PACK_10', label: t('admin.productConstants.formatPack10'), icon: '📦' },
    { value: 'BUNDLE', label: t('admin.productConstants.formatBundle'), icon: '🎁' },
    { value: 'ACCESSORY', label: t('admin.productConstants.formatAccessory'), icon: '🔧' },
    { value: 'NASAL_SPRAY', label: t('admin.productConstants.formatNasalSpray'), icon: '💨' },
    { value: 'CREAM', label: t('admin.productConstants.formatCream'), icon: '🧴' },
  ];
}

export function getProductTypes(t: TranslateFn) {
  return [
    { value: 'PEPTIDE', label: t('admin.productConstants.typePeptide') },
    { value: 'SUPPLEMENT', label: t('admin.productConstants.typeSupplement') },
    { value: 'ACCESSORY', label: t('admin.productConstants.typeAccessory') },
    { value: 'BUNDLE', label: t('admin.productConstants.typeBundle') },
    { value: 'CAPSULE', label: t('admin.productConstants.typeCapsule') },
  ];
}

export function getAvailabilityOptions(t: TranslateFn) {
  return [
    { value: 'IN_STOCK', label: t('admin.productConstants.availInStock'), color: 'green' },
    { value: 'OUT_OF_STOCK', label: t('admin.productConstants.availOutOfStock'), color: 'red' },
    { value: 'DISCONTINUED', label: t('admin.productConstants.availDiscontinued'), color: 'gray' },
    { value: 'COMING_SOON', label: t('admin.productConstants.availComingSoon'), color: 'blue' },
    { value: 'PRE_ORDER', label: t('admin.productConstants.availPreOrder'), color: 'purple' },
    { value: 'LIMITED', label: t('admin.productConstants.availLimited'), color: 'orange' },
  ];
}

export const VOLUME_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30, 50, 100, 200, 500];

export function getStockDisplay(qty: number, threshold: number, t: TranslateFn) {
  if (qty === 0) return { text: t('admin.productConstants.stockOutOfStock'), color: 'text-red-600', bg: 'bg-red-50' };
  if (qty <= threshold) return {
    text: qty > 1
      ? t('admin.productConstants.stockRemainingPlural', { count: qty })
      : t('admin.productConstants.stockRemaining', { count: qty }),
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  };
  return { text: t('admin.productConstants.stockAvailable'), color: 'text-green-600', bg: 'bg-green-50' };
}

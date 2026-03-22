/**
 * Shipping Calculator — Single source of truth for shipping rates
 * I-SHIPPING-5: Consolidated from inline calculations in create-checkout
 */

export interface ShippingRate {
  method: string;
  cost: number;
  estimatedDays: string;
  carrier: string;
  /** Whether PICKUP shipping method is available (Canada only) */
  pickupAvailable?: boolean;
}

export interface ShippingZone {
  code: string;
  name: string;
  freeThreshold: number;
  flatRate: number;
  estimatedDays: string;
}

// Shipping zones (flat-rate fallback)
const ZONES: Record<string, ShippingZone> = {
  CA: {
    code: 'CA',
    name: 'Canada',
    freeThreshold: 100,
    flatRate: 9.99,
    estimatedDays: '3-5 business days',
  },
  US: {
    code: 'US',
    name: 'United States',
    freeThreshold: 200,
    flatRate: 14.99,
    estimatedDays: '5-10 business days',
  },
  INTL: {
    code: 'INTL',
    name: 'International',
    freeThreshold: 500,
    flatRate: 24.99,
    estimatedDays: '10-20 business days',
  },
};

// Lab supplies have higher free-shipping threshold (heavier/bulkier)
const LAB_SUPPLY_FREE_THRESHOLD_CA = 300;

/**
 * Weight-based rate tiers.
 * CA domestic: free if subtotal >= $100 CAD, else $5.99 + $1.50/kg.
 * US: $9.99 + $3.00/kg.
 * International: $19.99 + $5.00/kg.
 */
const WEIGHT_RATES: Record<'CA' | 'US' | 'INTL', { baseRate: number; perKgRate: number }> = {
  CA:   { baseRate: 5.99,  perKgRate: 1.50 },
  US:   { baseRate: 9.99,  perKgRate: 3.00 },
  INTL: { baseRate: 19.99, perKgRate: 5.00 },
};

/** Free shipping threshold (CAD) for CA domestic weight-based path. */
const CA_WEIGHT_FREE_THRESHOLD = 100;

/**
 * Calculate shipping cost for an order.
 * This is the single source of truth — used by both checkout API and cart estimates.
 *
 * When `totalWeightGrams` is provided and > 0, weight-based rates apply:
 *   - CA: free if subtotal >= $100, else $5.99 base + $1.50/kg
 *   - US: $9.99 base + $3.00/kg
 *   - International: $19.99 base + $5.00/kg
 * When weight is absent or 0, flat-rate logic is used as fallback.
 */
export function calculateShipping(
  subtotal: number,
  country: string,
  productTypes?: string[],
  totalWeightGrams?: number,
): ShippingRate {
  const zone = ZONES[country] || ZONES.INTL;
  const weightRegion: 'CA' | 'US' | 'INTL' =
    country === 'CA' ? 'CA' : country === 'US' ? 'US' : 'INTL';
  const carrier = country === 'CA' ? 'Canada Post' : country === 'US' ? 'USPS' : 'DHL';

  // Weight-based path: use when caller provides a positive total weight.
  if (totalWeightGrams && totalWeightGrams > 0) {
    const weightKg = totalWeightGrams / 1000;
    const wr = WEIGHT_RATES[weightRegion];

    // Free domestic shipping for CA orders over $100 CAD
    if (weightRegion === 'CA' && subtotal >= CA_WEIGHT_FREE_THRESHOLD) {
      return {
        method: 'FREE',
        cost: 0,
        estimatedDays: zone.estimatedDays,
        carrier,
        pickupAvailable: country === 'CA' && subtotal > 0 ? true : undefined,
      };
    }

    const cost = Math.round((wr.baseRate + weightKg * wr.perKgRate) * 100) / 100;
    return {
      method: 'WEIGHT_BASED',
      cost,
      estimatedDays: zone.estimatedDays,
      carrier,
      pickupAvailable: country === 'CA' && subtotal > 0 ? true : undefined,
    };
  }

  // Flat-rate fallback (original logic — unchanged)
  const hasLabSupply = productTypes?.some(t => t === 'LAB_SUPPLY');
  const threshold = country === 'CA' && hasLabSupply
    ? LAB_SUPPLY_FREE_THRESHOLD_CA
    : zone.freeThreshold;

  const isFree = subtotal >= threshold;

  if (country === 'CA' && subtotal > 0) {
    return {
      method: isFree ? 'FREE' : 'FLAT_RATE',
      cost: isFree ? 0 : zone.flatRate,
      estimatedDays: zone.estimatedDays,
      carrier: 'Canada Post',
      pickupAvailable: true,
    };
  }

  return {
    method: isFree ? 'FREE' : 'FLAT_RATE',
    cost: isFree ? 0 : zone.flatRate,
    estimatedDays: zone.estimatedDays,
    carrier,
  };
}

/**
 * Get available shipping zones
 */
export function getShippingZones(): ShippingZone[] {
  return Object.values(ZONES);
}

/**
 * I-SHIPPING-8: Free shipping progress bar data
 */
export function getFreeShippingProgress(
  subtotal: number,
  country: string,
  productTypes?: string[]
): { threshold: number; remaining: number; percentage: number; isFree: boolean } {
  const zone = ZONES[country] || ZONES.INTL;
  const hasLabSupply = productTypes?.some(t => t === 'LAB_SUPPLY');
  const threshold = country === 'CA' && hasLabSupply
    ? LAB_SUPPLY_FREE_THRESHOLD_CA
    : zone.freeThreshold;

  const remaining = Math.max(0, threshold - subtotal);
  const percentage = Math.min(100, (subtotal / threshold) * 100);

  return { threshold, remaining, percentage, isFree: remaining === 0 };
}

/**
 * I-SHIPPING-6: Weight-based shipping estimate (for future API integration)
 */
export function estimateWeightBasedShipping(
  totalWeightGrams: number,
  country: string
): number {
  // Use same rates as calculateShipping for consistency
  const region: 'CA' | 'US' | 'INTL' = country === 'CA' ? 'CA' : country === 'US' ? 'US' : 'INTL';
  const wr = WEIGHT_RATES[region];
  const baseRate = wr.baseRate;
  const perKgRate = wr.perKgRate;
  const weightKg = totalWeightGrams / 1000;
  return Math.round((baseRate + weightKg * perKgRate) * 100) / 100;
}

// ---------------------------------------------------------------------------
// I-SHIPPING: Pickup location support
// ---------------------------------------------------------------------------

export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  hours: string;
  carrier: string;
}

/** Canada Post pickup points (static list — will be replaced by API lookup) */
const CANADA_PICKUP_LOCATIONS: PickupLocation[] = [
  {
    id: 'pickup-mtl-01',
    name: 'Bureau de poste Montréal Centre',
    address: '1250 rue Université',
    city: 'Montréal',
    province: 'QC',
    postalCode: 'H3B 3B0',
    hours: 'Lun-Ven 9h-17h',
    carrier: 'Canada Post',
  },
  {
    id: 'pickup-tor-01',
    name: 'Canada Post Toronto Downtown',
    address: '40 Bay Street',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5J 2X2',
    hours: 'Mon-Fri 9AM-5PM',
    carrier: 'Canada Post',
  },
  {
    id: 'pickup-van-01',
    name: 'Canada Post Vancouver Main',
    address: '349 W Georgia Street',
    city: 'Vancouver',
    province: 'BC',
    postalCode: 'V6B 3P4',
    hours: 'Mon-Fri 9AM-5PM',
    carrier: 'Canada Post',
  },
  {
    id: 'pickup-qc-01',
    name: 'Bureau de poste Québec Centre',
    address: '300 rue St-Paul',
    city: 'Québec',
    province: 'QC',
    postalCode: 'G1K 7R1',
    hours: 'Lun-Ven 8h30-17h30',
    carrier: 'Canada Post',
  },
];

/**
 * I-SHIPPING: Get available pickup locations for a given country.
 * Currently only Canada (CA) has pickup support via Canada Post.
 */
export function getPickupLocations(country: string): PickupLocation[] {
  if (country.toUpperCase() !== 'CA') {
    return [];
  }
  return CANADA_PICKUP_LOCATIONS;
}

// ---------------------------------------------------------------------------
// I-SHIPPING: Shipping label data generation
// ---------------------------------------------------------------------------

export interface ShippingLabelData {
  sender: {
    name: string;
    company: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  recipient: {
    name: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  parcel: {
    weightKg: number;
    dimensions: { lengthCm: number; widthCm: number; heightCm: number };
  };
  serviceType: string;
  orderNumber: string;
  generatedAt: string;
}

/** Sender information for shipping labels — reads from env, per-tenant in future */
const SENDER_INFO = {
  name: process.env.BUSINESS_NAME || process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP',
  company: process.env.BUSINESS_NAME || process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP',
  address: process.env.BUSINESS_ADDRESS || '123 Innovation Blvd',
  city: process.env.BUSINESS_CITY || 'Montréal',
  province: process.env.BUSINESS_PROVINCE || 'QC',
  postalCode: process.env.BUSINESS_POSTAL_CODE || 'H2X 1Y4',
  country: 'CA',
  phone: process.env.BUSINESS_PHONE || '+1-514-555-0100',
};

/**
 * I-SHIPPING: Generate structured label data for a shipment.
 * Prepares data for future Canada Post API integration.
 */
export function generateLabelData(order: {
  orderNumber: string;
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  items: Array<{ name: string; quantity: number }>;
  weight: number; // total weight in grams
}): ShippingLabelData {
  const country = order.shippingAddress.country.toUpperCase();
  const weightKg = order.weight / 1000;

  // Determine service type based on destination
  let serviceType = 'DOM.EP'; // Canada Post Expedited Parcel (domestic default)
  if (country === 'US') {
    serviceType = 'USA.EP'; // Expedited Parcel USA
  } else if (country !== 'CA') {
    serviceType = 'INT.IP.AIR'; // International Parcel Air
  }

  // Estimate box dimensions based on item count (simplified)
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const baseDimension = Math.max(15, Math.ceil(Math.sqrt(totalItems) * 10));

  return {
    sender: { ...SENDER_INFO },
    recipient: {
      name: order.shippingAddress.name,
      address: order.shippingAddress.address,
      city: order.shippingAddress.city,
      province: order.shippingAddress.province,
      postalCode: order.shippingAddress.postalCode,
      country,
    },
    parcel: {
      weightKg: Math.round(weightKg * 1000) / 1000,
      dimensions: {
        lengthCm: baseDimension + 10,
        widthCm: baseDimension,
        heightCm: Math.max(5, Math.ceil(totalItems * 2)),
      },
    },
    serviceType,
    orderNumber: order.orderNumber,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// I-SHIPPING: Canada Post rate estimation by postal code zone
// ---------------------------------------------------------------------------

/** Canada Post rate zones based on postal code prefix */
const CANADA_POST_ZONES: Record<string, { zone: string; name: string; baseSurcharge: number }> = {
  // Atlantic (NB, NS, NL, PE)
  A: { zone: 'ATLANTIC', name: 'Newfoundland & Labrador', baseSurcharge: 4.00 },
  B: { zone: 'ATLANTIC', name: 'Nova Scotia', baseSurcharge: 3.50 },
  C: { zone: 'ATLANTIC', name: 'Prince Edward Island', baseSurcharge: 3.50 },
  E: { zone: 'ATLANTIC', name: 'New Brunswick', baseSurcharge: 3.00 },
  // Quebec
  G: { zone: 'QUEBEC', name: 'Québec (Est)', baseSurcharge: 0.50 },
  H: { zone: 'QUEBEC', name: 'Montréal', baseSurcharge: 0 },
  J: { zone: 'QUEBEC', name: 'Québec (Ouest)', baseSurcharge: 0.50 },
  // Ontario
  K: { zone: 'ONTARIO', name: 'Ontario (Est)', baseSurcharge: 1.00 },
  L: { zone: 'ONTARIO', name: 'Ontario (Centre)', baseSurcharge: 1.50 },
  M: { zone: 'ONTARIO', name: 'Toronto', baseSurcharge: 1.50 },
  N: { zone: 'ONTARIO', name: 'Ontario (Sud-Ouest)', baseSurcharge: 2.00 },
  P: { zone: 'ONTARIO', name: 'Ontario (Nord)', baseSurcharge: 3.00 },
  // Prairies (MB, SK, AB)
  R: { zone: 'PRAIRIES', name: 'Manitoba', baseSurcharge: 3.50 },
  S: { zone: 'PRAIRIES', name: 'Saskatchewan', baseSurcharge: 4.00 },
  T: { zone: 'PRAIRIES', name: 'Alberta', baseSurcharge: 4.50 },
  // British Columbia
  V: { zone: 'BC', name: 'British Columbia', baseSurcharge: 5.00 },
  // North (NT, NU, YT)
  X: { zone: 'NORTH', name: 'Territoires du Nord-Ouest / Nunavut', baseSurcharge: 12.00 },
  Y: { zone: 'NORTH', name: 'Yukon', baseSurcharge: 10.00 },
};

export interface CanadaPostRateEstimate {
  zone: string;
  zoneName: string;
  baseRate: number;
  weightSurcharge: number;
  dimensionalSurcharge: number;
  fuelSurcharge: number;
  totalEstimate: number;
  currency: string;
  disclaimer: string;
}

/**
 * I-SHIPPING: Estimate Canada Post shipping rate based on postal code zone.
 * This is a local estimation — not a live API call to Canada Post.
 * Rates are approximations and may differ from actual Canada Post prices.
 */
export function estimateCanadaPostRate(
  postalCode: string,
  weightKg: number,
  dimensions?: { l: number; w: number; h: number }
): CanadaPostRateEstimate {
  const prefix = postalCode.trim().toUpperCase().charAt(0);
  const zoneInfo = CANADA_POST_ZONES[prefix] || { zone: 'UNKNOWN', name: 'Unknown', baseSurcharge: 5.00 };

  // Base rate (Expedited Parcel from Montreal)
  const baseRate = 9.99;

  // Weight surcharge: $2.50/kg above first 1kg
  const weightSurcharge = weightKg > 1
    ? Math.round((weightKg - 1) * 2.50 * 100) / 100
    : 0;

  // Dimensional weight surcharge (if provided)
  let dimensionalSurcharge = 0;
  if (dimensions) {
    const dimWeightKg = (dimensions.l * dimensions.w * dimensions.h) / 5000;
    if (dimWeightKg > weightKg) {
      dimensionalSurcharge = Math.round((dimWeightKg - weightKg) * 1.50 * 100) / 100;
    }
  }

  // Fuel surcharge (approximation: ~12.75% of base as of 2026)
  const subtotal = baseRate + zoneInfo.baseSurcharge + weightSurcharge + dimensionalSurcharge;
  const fuelSurcharge = Math.round(subtotal * 0.1275 * 100) / 100;

  const totalEstimate = Math.round((subtotal + fuelSurcharge) * 100) / 100;

  return {
    zone: zoneInfo.zone,
    zoneName: zoneInfo.name,
    baseRate: baseRate + zoneInfo.baseSurcharge,
    weightSurcharge,
    dimensionalSurcharge,
    fuelSurcharge,
    totalEstimate,
    currency: 'CAD',
    disclaimer: 'Estimate only. Actual rates may vary. Contact Canada Post for exact pricing.',
  };
}

// ---------------------------------------------------------------------------
// I-SHIPPING: International customs declarations
// ---------------------------------------------------------------------------

export interface CustomsItem {
  description: string;
  quantity: number;
  value: number;
  weightKg: number;
  hsCode: string;
  originCountry: string;
}

export interface CustomsDeclaration {
  declarationType: 'COMMERCIAL' | 'GIFT' | 'SAMPLE' | 'DOCUMENTS';
  items: CustomsItem[];
  totalValue: number;
  totalWeight: number;
  currency: string;
  numberOfItems: number;
  exporterInfo: {
    name: string;
    company: string;
    address: string;
    country: string;
  };
  generatedAt: string;
}

/** Default HS code for peptide research chemicals */
const DEFAULT_PEPTIDE_HS_CODE = '2933.99.00';

/**
 * I-SHIPPING: Generate customs declaration data for international shipments.
 * Required for all shipments leaving Canada.
 */
export function getCustomsDeclaration(
  items: Array<{ name: string; quantity: number; value: number; weight: number; hsCode?: string }>,
  currency: string
): CustomsDeclaration {
  const customsItems: CustomsItem[] = items.map(item => ({
    description: item.name.substring(0, 80), // Customs forms limit description length
    quantity: item.quantity,
    value: Math.round(item.value * 100) / 100,
    weightKg: Math.round((item.weight / 1000) * 1000) / 1000, // grams to kg
    hsCode: item.hsCode || DEFAULT_PEPTIDE_HS_CODE,
    originCountry: 'CA',
  }));

  const totalValue = Math.round(
    customsItems.reduce((sum, item) => sum + item.value * item.quantity, 0) * 100
  ) / 100;

  const totalWeight = Math.round(
    customsItems.reduce((sum, item) => sum + item.weightKg * item.quantity, 0) * 1000
  ) / 1000;

  return {
    declarationType: 'COMMERCIAL',
    items: customsItems,
    totalValue,
    totalWeight,
    currency: currency.toUpperCase(),
    numberOfItems: customsItems.reduce((sum, item) => sum + item.quantity, 0),
    exporterInfo: {
      name: SENDER_INFO.name,
      company: SENDER_INFO.company,
      address: `${SENDER_INFO.address}, ${SENDER_INFO.city}, ${SENDER_INFO.province} ${SENDER_INFO.postalCode}, Canada`,
      country: 'CA',
    },
    generatedAt: new Date().toISOString(),
  };
}

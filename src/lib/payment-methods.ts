/**
 * PAYMENT METHODS CONFIGURATION
 * Default payment method configurations by country
 */

export interface PaymentMethodDefinition {
  methodType: string;
  provider: string;
  sortOrder: number;
  minAmount?: number;
  maxAmount?: number;
}

export interface CountryPaymentMethods {
  countryCode: string;
  countryName: string;
  methods: PaymentMethodDefinition[];
}

/**
 * Default payment method configurations by country/region
 */
export const DEFAULT_PAYMENT_METHODS: CountryPaymentMethods[] = [
  // Canada
  {
    countryCode: 'CA',
    countryName: 'Canada',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'CREDIT_CARD_AMEX', provider: 'stripe', sortOrder: 3 },
      { methodType: 'DEBIT_CARD_INTERAC', provider: 'stripe', sortOrder: 4 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 6 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 7 },
    ],
  },

  // United States
  {
    countryCode: 'US',
    countryName: 'United States',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'CREDIT_CARD_AMEX', provider: 'stripe', sortOrder: 3 },
      { methodType: 'CREDIT_CARD_DISCOVER', provider: 'stripe', sortOrder: 4 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 6 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 7 },
    ],
  },

  // United Kingdom
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'CREDIT_CARD_AMEX', provider: 'stripe', sortOrder: 3 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 4 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // European Union - General (SEPA countries)
  {
    countryCode: 'EU',
    countryName: 'European Union',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'SEPA_DEBIT', provider: 'stripe', sortOrder: 3 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 4 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // Netherlands
  {
    countryCode: 'NL',
    countryName: 'Netherlands',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'IDEAL', provider: 'stripe', sortOrder: 3 },
      { methodType: 'SEPA_DEBIT', provider: 'stripe', sortOrder: 4 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // Belgium
  {
    countryCode: 'BE',
    countryName: 'Belgium',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'BANCONTACT', provider: 'stripe', sortOrder: 3 },
      { methodType: 'SEPA_DEBIT', provider: 'stripe', sortOrder: 4 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // Germany
  {
    countryCode: 'DE',
    countryName: 'Germany',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'SEPA_DEBIT', provider: 'stripe', sortOrder: 3 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 4 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // France
  {
    countryCode: 'FR',
    countryName: 'France',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'SEPA_DEBIT', provider: 'stripe', sortOrder: 3 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 4 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // Australia
  {
    countryCode: 'AU',
    countryName: 'Australia',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'CREDIT_CARD_AMEX', provider: 'stripe', sortOrder: 3 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 4 },
      { methodType: 'GOOGLE_PAY', provider: 'stripe', sortOrder: 5 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 6 },
    ],
  },

  // Default (rest of world)
  {
    countryCode: 'DEFAULT',
    countryName: 'International',
    methods: [
      { methodType: 'CREDIT_CARD_VISA', provider: 'stripe', sortOrder: 1 },
      { methodType: 'CREDIT_CARD_MASTERCARD', provider: 'stripe', sortOrder: 2 },
      { methodType: 'APPLE_PAY', provider: 'stripe', sortOrder: 3 },
      { methodType: 'PAYPAL', provider: 'paypal', sortOrder: 4 },
    ],
  },
];

/**
 * Get payment methods for a specific country
 * Falls back to DEFAULT if country not found
 */
export function getPaymentMethodsForCountry(countryCode: string): PaymentMethodDefinition[] {
  const config = DEFAULT_PAYMENT_METHODS.find(c => c.countryCode === countryCode);
  if (config) {
    return config.methods;
  }

  // Fallback to DEFAULT
  const defaultConfig = DEFAULT_PAYMENT_METHODS.find(c => c.countryCode === 'DEFAULT');
  return defaultConfig?.methods || [];
}

/**
 * Get human-readable display name for a payment method type
 */
export function getPaymentMethodDisplayName(methodType: string): string {
  const displayNames: Record<string, string> = {
    CREDIT_CARD_VISA: 'Visa',
    CREDIT_CARD_MASTERCARD: 'Mastercard',
    CREDIT_CARD_AMEX: 'American Express',
    CREDIT_CARD_DISCOVER: 'Discover',
    DEBIT_CARD_INTERAC: 'Interac Debit',
    APPLE_PAY: 'Apple Pay',
    GOOGLE_PAY: 'Google Pay',
    PAYPAL: 'PayPal',
    SEPA_DEBIT: 'SEPA Direct Debit',
    IDEAL: 'iDEAL',
    BANCONTACT: 'Bancontact',
  };

  return displayNames[methodType] || methodType;
}

/**
 * Get icon/logo identifier for a payment method type
 */
export function getPaymentMethodIcon(methodType: string): string {
  const icons: Record<string, string> = {
    CREDIT_CARD_VISA: 'visa',
    CREDIT_CARD_MASTERCARD: 'mastercard',
    CREDIT_CARD_AMEX: 'amex',
    CREDIT_CARD_DISCOVER: 'discover',
    DEBIT_CARD_INTERAC: 'interac',
    APPLE_PAY: 'apple-pay',
    GOOGLE_PAY: 'google-pay',
    PAYPAL: 'paypal',
    SEPA_DEBIT: 'sepa',
    IDEAL: 'ideal',
    BANCONTACT: 'bancontact',
  };

  return icons[methodType] || 'credit-card';
}

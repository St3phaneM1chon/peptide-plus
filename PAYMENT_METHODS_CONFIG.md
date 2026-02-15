# Payment Methods Configuration

## Overview

The payment methods configuration system allows different payment methods to be enabled/disabled per country. This ensures customers see only the payment methods available in their region.

## Database Model

```prisma
model PaymentMethodConfig {
  id          String   @id @default(cuid())
  countryCode String   // ISO 3166-1 alpha-2 (CA, US, GB, etc.)
  methodType  String   // CREDIT_CARD_VISA, DEBIT_CARD_INTERAC, IDEAL, etc.
  provider    String   // stripe, paypal
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  minAmount   Decimal? @db.Decimal(10,2)
  maxAmount   Decimal? @db.Decimal(10,2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([countryCode, methodType])
  @@index([countryCode, isActive])
}
```

## Default Configurations

The system includes pre-configured payment methods for:

- **Canada (CA)**: Visa, Mastercard, Amex, Interac Debit, Apple Pay, Google Pay, PayPal
- **United States (US)**: Visa, Mastercard, Amex, Discover, Apple Pay, Google Pay, PayPal
- **United Kingdom (GB)**: Visa, Mastercard, Amex, Apple Pay, Google Pay, PayPal
- **European Union (EU)**: Visa, Mastercard, SEPA Direct Debit, Apple Pay, Google Pay, PayPal
- **Netherlands (NL)**: Visa, Mastercard, iDEAL, SEPA Direct Debit, Apple Pay, PayPal
- **Belgium (BE)**: Visa, Mastercard, Bancontact, SEPA Direct Debit, Apple Pay, PayPal
- **Germany (DE)**: Visa, Mastercard, SEPA Direct Debit, Apple Pay, Google Pay, PayPal
- **France (FR)**: Visa, Mastercard, SEPA Direct Debit, Apple Pay, Google Pay, PayPal
- **Australia (AU)**: Visa, Mastercard, Amex, Apple Pay, Google Pay, PayPal
- **Default**: Visa, Mastercard, Apple Pay, PayPal (for all other countries)

## API Endpoints

### Public API

**GET `/api/payment-methods?country=CA`**

Returns available payment methods for the specified country.

Response:
```json
{
  "country": "CA",
  "methods": [
    {
      "methodType": "CREDIT_CARD_VISA",
      "provider": "stripe",
      "sortOrder": 1,
      "minAmount": null,
      "maxAmount": null
    },
    ...
  ]
}
```

### Admin API

**GET `/api/admin/payment-methods`** (OWNER role required)

Returns all payment method configurations.

**POST `/api/admin/payment-methods`** (OWNER role required)

Create or update a payment method configuration.

Request body:
```json
{
  "countryCode": "CA",
  "methodType": "CREDIT_CARD_VISA",
  "provider": "stripe",
  "isActive": true,
  "sortOrder": 1,
  "minAmount": 10.00,
  "maxAmount": 10000.00
}
```

**DELETE `/api/admin/payment-methods?id=<config_id>`** (OWNER role required)

Delete a payment method configuration.

## Helper Functions

Located in `/src/lib/payment-methods.ts`:

- **`getPaymentMethodsForCountry(countryCode: string)`**: Returns default payment methods for a country
- **`getPaymentMethodDisplayName(methodType: string)`**: Returns human-readable name (e.g., "Visa", "iDEAL")
- **`getPaymentMethodIcon(methodType: string)`**: Returns icon identifier for frontend

## Seeding the Database

To populate the database with default configurations:

```bash
npx tsx src/lib/seed-payment-methods.ts
```

This will:
- Create new configurations that don't exist
- Update existing configurations if they're inactive or have changed
- Skip configurations that are already active and correct

## Testing

Run the test script to verify the configuration:

```bash
npx tsx test-payment-methods.ts
```

This will query the database and show:
- Payment methods for Canada, US, and Netherlands
- Fallback behavior for unknown countries
- All configured countries and their method counts

## Integration with Checkout

The checkout page can use the API to fetch appropriate payment methods based on the shipping country:

```typescript
const response = await fetch(`/api/payment-methods?country=${shippingCountry}`);
const { methods } = await response.json();

// Filter and display only the available payment methods
```

## Method Types

Available method types include:

- `CREDIT_CARD_VISA`
- `CREDIT_CARD_MASTERCARD`
- `CREDIT_CARD_AMEX`
- `CREDIT_CARD_DISCOVER`
- `DEBIT_CARD_INTERAC`
- `APPLE_PAY`
- `GOOGLE_PAY`
- `PAYPAL`
- `SEPA_DEBIT`
- `IDEAL`
- `BANCONTACT`

## Future Enhancements

Potential improvements:
- Currency-based restrictions
- Time-based availability (special promotions)
- User-specific payment methods (based on history)
- A/B testing different payment method orderings
- Analytics on payment method selection rates

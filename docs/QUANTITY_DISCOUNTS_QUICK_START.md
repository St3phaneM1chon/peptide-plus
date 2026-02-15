# Quantity Discounts - Quick Start Guide

## For Developers

### Adding Discounts to a Product

```typescript
// Using the API
const response = await fetch('/api/admin/quantity-discounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'clx123...',
    tiers: [
      { minQty: 5, maxQty: 9, discount: 10 },    // 5-9 units: 10% off
      { minQty: 10, maxQty: 19, discount: 15 },  // 10-19 units: 15% off
      { minQty: 20, maxQty: null, discount: 20 } // 20+ units: 20% off
    ]
  })
});
```

### Using the Component

```tsx
import QuantityTiers from '@/components/shop/QuantityTiers';

<QuantityTiers
  tiers={product.quantityDiscounts}
  basePrice={selectedFormat.price}
  currentQuantity={quantity}
/>
```

### Database Query

```typescript
const product = await prisma.product.findUnique({
  where: { slug },
  include: {
    quantityDiscounts: {
      orderBy: { minQty: 'asc' }
    }
  }
});
```

## For Admins

### Creating Discount Tiers

**Endpoint**: `POST /api/admin/quantity-discounts`

**Example Request**:
```json
{
  "productId": "clx1234567890",
  "tiers": [
    {
      "minQty": 5,
      "maxQty": 9,
      "discount": 10
    },
    {
      "minQty": 10,
      "maxQty": null,
      "discount": 15
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "discounts": [
    {
      "id": "clx...",
      "productId": "clx1234567890",
      "minQty": 5,
      "maxQty": 9,
      "discount": 10,
      "createdAt": "2026-02-15T...",
      "updatedAt": "2026-02-15T..."
    }
  ]
}
```

### Listing Discounts

**Endpoint**: `GET /api/admin/quantity-discounts?productId={id}`

**Example**:
```bash
curl http://localhost:3000/api/admin/quantity-discounts?productId=clx1234567890
```

### Deleting a Discount Tier

**Endpoint**: `DELETE /api/admin/quantity-discounts?id={tierId}`

**Example**:
```bash
curl -X DELETE http://localhost:3000/api/admin/quantity-discounts?id=clx9876543210
```

## Common Patterns

### Standard Bulk Pricing (3 Tiers)
```json
{
  "tiers": [
    { "minQty": 5, "maxQty": 9, "discount": 10 },
    { "minQty": 10, "maxQty": 24, "discount": 15 },
    { "minQty": 25, "maxQty": null, "discount": 20 }
  ]
}
```

### Aggressive Bulk (Encourage Large Orders)
```json
{
  "tiers": [
    { "minQty": 3, "maxQty": 5, "discount": 5 },
    { "minQty": 6, "maxQty": 11, "discount": 12 },
    { "minQty": 12, "maxQty": null, "discount": 25 }
  ]
}
```

### Simple 2-Tier
```json
{
  "tiers": [
    { "minQty": 10, "maxQty": null, "discount": 15 }
  ]
}
```

## Validation Rules

✅ **Valid**:
- minQty must be >= 1
- maxQty must be >= minQty (or null for unlimited)
- discount must be between 0 and 100
- Multiple tiers can exist for a product
- Tiers are automatically sorted by minQty

❌ **Invalid**:
```json
{ "minQty": 0, ... }           // minQty must be >= 1
{ "minQty": 10, "maxQty": 5 }  // maxQty < minQty
{ "discount": 150 }            // discount > 100
{ "discount": -5 }             // discount < 0
```

## Price Calculation Examples

### Example 1: Simple Discount
- **Base Price**: $50.00
- **Quantity**: 7
- **Tier**: 5-9 units @ 10% off
- **Unit Price**: $50.00 × 0.90 = $45.00
- **Total**: $45.00 × 7 = $315.00
- **Savings**: $35.00

### Example 2: Higher Tier
- **Base Price**: $50.00
- **Quantity**: 15
- **Tier**: 10-19 units @ 20% off
- **Unit Price**: $50.00 × 0.80 = $40.00
- **Total**: $40.00 × 15 = $600.00
- **Savings**: $150.00

### Example 3: Unlimited Tier
- **Base Price**: $50.00
- **Quantity**: 100
- **Tier**: 25+ units @ 25% off
- **Unit Price**: $50.00 × 0.75 = $37.50
- **Total**: $37.50 × 100 = $3,750.00
- **Savings**: $1,250.00

## Tips & Best Practices

### 1. **Start Conservative**
Begin with modest discounts (5-10%) and increase based on data.

### 2. **Make Tiers Clear**
Avoid overlapping ranges. Use clear breakpoints (5, 10, 25, 50, 100).

### 3. **Highlight Best Value**
The component automatically marks the highest discount as "Best Value".

### 4. **Test with Real Products**
Before going live, test with actual product pricing to ensure margins are maintained.

### 5. **Monitor Performance**
Track which tiers drive the most sales and adjust accordingly.

### 6. **Seasonal Adjustments**
Update discounts for holidays or sales events using the POST endpoint (replaces all tiers).

## Troubleshooting

### Discounts Not Showing?
- Check if product has `quantityDiscounts` in the query
- Verify tiers are returned from API
- Check browser console for errors

### Wrong Price Calculated?
- Ensure `getEffectivePrice()` is called with correct quantity
- Verify tier ranges don't overlap
- Check discount values are percentages (not decimals)

### Auth Errors?
- Ensure user is logged in
- Verify user role is OWNER or EMPLOYEE
- Check auth token is valid

## API Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/admin/quantity-discounts?productId={id}` | Admin | List tiers for product |
| POST | `/api/admin/quantity-discounts` | Admin | Create/update all tiers |
| DELETE | `/api/admin/quantity-discounts?id={id}` | Admin | Delete specific tier |

## Component Props

### QuantityTiers

```typescript
interface QuantityTiersProps {
  tiers: QuantityTier[];      // Array of discount tiers
  basePrice: number;           // Base price per unit
  currentQuantity?: number;    // Currently selected quantity (optional)
}

interface QuantityTier {
  id: string;
  minQty: number;
  maxQty: number | null;       // null = unlimited
  discount: number;            // Percentage (0-100)
}
```

## Next Steps

1. **Build Admin UI**: Create a form to manage discount tiers in the admin panel
2. **Analytics**: Track which tiers convert best
3. **A/B Testing**: Test different discount structures
4. **Email Alerts**: Notify customers when items in their wishlist go on bulk discount
5. **Tier Recommendations**: AI-powered suggestions based on inventory and sales data

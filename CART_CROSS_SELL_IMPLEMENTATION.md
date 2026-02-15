# Cart Cross-Sell / "Customers Also Bought" Implementation

## Overview
This implementation adds intelligent product recommendations to the shopping cart, showing customers relevant products based on their current cart items. The feature is designed to increase average order value (AOV) through strategic cross-selling.

## Features

### 1. Smart Recommendation Engine
- **Primary Strategy**: Analyzes actual purchase history to find products frequently bought together
- **Fallback Strategy**: Shows same-category products for new stores with limited order data
- **Intelligent Filtering**:
  - Only shows products with available stock
  - Excludes products already in the cart
  - Ranks by purchase frequency

### 2. User Experience
- Clean, non-intrusive design that feels helpful, not pushy
- Horizontal scrollable layout (2 items on mobile, 4 on desktop)
- Loading skeleton during fetch
- Quick "Add to Cart" functionality with visual feedback
- Responsive design that works seamlessly across devices

### 3. Performance Optimizations
- Cache-friendly API with 5-minute cache (stale-while-revalidate: 10min)
- Efficient database queries using Prisma groupBy and aggregations
- Only fetches when cart has items
- Auto-hides when no recommendations available

## File Structure

```
/Volumes/AI_Project/peptide-plus/
├── src/
│   ├── app/
│   │   └── api/
│   │       └── products/
│   │           └── recommendations/
│   │               └── route.ts                 # API endpoint for recommendations
│   ├── components/
│   │   └── shop/
│   │       └── CartCrossSell.tsx               # Cross-sell component
│   └── i18n/
│       └── locales/
│           ├── en.json                          # English translations
│           └── fr.json                          # French translations
```

## API Endpoint

### `/api/products/recommendations`

**Method**: GET

**Query Parameters**:
- `productIds` (required): Comma-separated list of product IDs currently in cart
- `limit` (optional): Maximum number of recommendations to return (default: 4)

**Example Request**:
```
GET /api/products/recommendations?productIds=prod_123,prod_456&limit=4
```

**Response**:
```json
{
  "recommendations": [
    {
      "id": "prod_789",
      "name": "BPC-157",
      "slug": "bpc-157",
      "price": 89.99,
      "comparePrice": 99.99,
      "imageUrl": "/images/products/bpc-157.jpg",
      "category": {
        "id": "cat_123",
        "name": "Recovery",
        "slug": "recovery"
      },
      "purity": 99.5
    }
  ]
}
```

**Algorithm**:

1. **Find Related Orders**: Query OrderItems table for orders containing ANY cart product
2. **Filter Paid Orders**: Only consider completed purchases (paymentStatus: 'PAID')
3. **Group & Rank**: Group other products from same orders, rank by frequency
4. **Stock Check**: Only return products with available formats in stock
5. **Fallback**: If insufficient data, show same-category products
6. **Limit**: Return top N recommendations

## Component: CartCrossSell

### Props
```typescript
interface CartCrossSellProps {
  cartProductIds: string[];  // Array of unique product IDs in cart
}
```

### Features
- Automatic fetching based on cart product IDs
- Loading states with skeleton UI
- Error handling (fails silently, doesn't break cart)
- Responsive grid layout
- Quick add-to-cart with toast notifications
- Translatable strings (supports i18n)

### Integration Points

**CartDrawer** (`/src/components/shop/CartDrawer.tsx`):
```tsx
// Extract unique product IDs
const cartProductIds = useMemo(() => {
  return [...new Set(items.map(item => item.productId))];
}, [items]);

// Render in drawer before checkout footer
<CartCrossSell cartProductIds={cartProductIds} />
```

**Cart Page** (`/src/app/(shop)/checkout/cart/CartPageClient.tsx`):
```tsx
// Same integration pattern as CartDrawer
const cartProductIds = useMemo(() => {
  return [...new Set(items.map(item => item.productId))];
}, [items]);

<CartCrossSell cartProductIds={cartProductIds} />
```

## Database Schema Dependencies

### Required Tables
- `Order`: Customer orders with payment status
- `OrderItem`: Individual products in orders with productId
- `Product`: Product catalog with isActive flag
- `ProductFormat`: Product variants with stock information
- `ProductImage`: Product images with isPrimary flag
- `Category`: Product categories

### Key Relationships
```
Order (1) -> (N) OrderItem
OrderItem (N) -> (1) Product
Product (1) -> (N) ProductFormat
Product (1) -> (N) ProductImage
Product (N) -> (1) Category
```

## Translations

### English (`en.json`)
```json
{
  "cart": {
    "customersAlsoBought": "Customers Also Bought"
  },
  "shop": {
    "addedToCart": "added to cart",
    "addToCartError": "Failed to add to cart"
  }
}
```

### French (`fr.json`)
```json
{
  "cart": {
    "customersAlsoBought": "Les clients ont aussi acheté"
  },
  "shop": {
    "addedToCart": "ajouté au panier",
    "addToCartError": "Échec de l'ajout au panier"
  }
}
```

## Design Decisions

### Why This Approach?

1. **Purchase History First**: Real customer behavior is the best indicator of product affinity
2. **Graceful Fallback**: New stores need recommendations too - same-category products work well
3. **Non-Blocking**: Recommendations load asynchronously, don't slow down cart
4. **Performance**: Aggressive caching (5min) since recommendations don't need real-time accuracy
5. **Stock-Aware**: Only show what's available to prevent disappointment
6. **Clean UI**: Horizontal scroll prevents layout shift, feels like natural exploration

### Customization Options

**Change recommendation limit**:
```tsx
<CartCrossSell cartProductIds={cartProductIds} limit={6} />
```

**Modify cache duration** (in `route.ts`):
```typescript
headers: {
  'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200', // 10min cache
}
```

**Change minimum orders threshold**:
```typescript
if (orderIds.length >= 5) {  // Only use purchase history if we have 5+ matching orders
  // ... existing logic
} else {
  // Fall back to category-based recommendations
}
```

## Testing Recommendations

### Test Scenarios

1. **Empty Cart**: Component should not render
2. **New Store (no orders)**: Should show same-category products
3. **Mature Store**: Should show frequently co-purchased products
4. **Out of Stock Products**: Should be filtered out
5. **All Products Already in Cart**: Should hide gracefully

### Manual Testing Steps

1. Add 1-2 products to cart
2. Open cart drawer or cart page
3. Verify recommendations appear below cart items
4. Click "Add to Cart" on a recommendation
5. Verify toast notification appears
6. Verify product is added to cart
7. Verify that product disappears from recommendations

### Database Seeding for Testing

To test the purchase history logic, seed some orders:

```sql
-- Create a test order with multiple products
INSERT INTO "Order" (id, "orderNumber", "userId", subtotal, total, "currencyId", "paymentStatus")
VALUES ('test_order_1', 'PP-2024-001', 'user_123', 200.00, 230.00, 'cad', 'PAID');

-- Add order items
INSERT INTO "OrderItem" ("orderId", "productId", "formatId", "productName", quantity, "unitPrice", total)
VALUES
  ('test_order_1', 'prod_bpc157', 'fmt_5mg', 'BPC-157 5mg', 1, 89.99, 89.99),
  ('test_order_1', 'prod_tb500', 'fmt_5mg', 'TB-500 5mg', 1, 99.99, 99.99);
```

## Performance Metrics

### Expected Load Times
- API Response: < 200ms (with database indexes)
- Component Render: < 100ms
- Image Load: Lazy loaded with Next.js Image optimization

### Database Optimization
Ensure these indexes exist:
```sql
CREATE INDEX idx_orderitem_productid ON "OrderItem"("productId");
CREATE INDEX idx_orderitem_orderid ON "OrderItem"("orderId");
CREATE INDEX idx_order_paymentstatus ON "Order"("paymentStatus");
CREATE INDEX idx_product_categoryid ON "Product"("categoryId");
```

## Future Enhancements

1. **ML-Based Recommendations**: Integrate TensorFlow.js for personalized recommendations
2. **A/B Testing**: Test "Customers Also Bought" vs "You May Also Like"
3. **Discount Bundles**: Offer automatic discounts for recommended combos
4. **Recently Viewed**: Mix in recently viewed products
5. **Analytics**: Track recommendation click-through rate and conversion
6. **Personalization**: Use customer's purchase history for personal recommendations

## Troubleshooting

### No recommendations showing
- Check: Cart has items
- Check: Database has orders with `paymentStatus: 'PAID'`
- Check: Products have available formats (stockQuantity > 0)
- Check: Browser console for API errors

### Recommendations not updating
- Clear browser cache
- Check API cache headers
- Verify cart product IDs are updating correctly

### TypeScript errors
- Run `npm run build` to check for compilation errors
- Ensure Prisma types are generated: `npx prisma generate`

### Slow performance
- Add database indexes (see Performance Metrics section)
- Reduce recommendation limit
- Increase cache duration

## Changelog

**v1.0.0** (2025-02-15)
- Initial implementation
- Smart recommendation engine with purchase history analysis
- Fallback to category-based recommendations
- Integration with CartDrawer and Cart Page
- Full i18n support (EN/FR)
- Responsive design with loading states

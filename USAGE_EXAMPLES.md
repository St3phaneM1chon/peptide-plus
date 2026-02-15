# Usage Examples

## AddToWishlistButton Component

### Basic Usage (Icon Variant)

```tsx
import AddToWishlistButton from '@/components/shop/AddToWishlistButton';

// In your product card or product page:
<AddToWishlistButton productId={product.id} />
```

### Button Variant (Full Button)

```tsx
<AddToWishlistButton
  productId={product.id}
  variant="button"
  size="lg"
/>
```

### All Variants and Sizes

```tsx
// Icon variants
<AddToWishlistButton productId="123" variant="icon" size="sm" />
<AddToWishlistButton productId="123" variant="icon" size="md" />
<AddToWishlistButton productId="123" variant="icon" size="lg" />

// Button variants
<AddToWishlistButton productId="123" variant="button" size="sm" />
<AddToWishlistButton productId="123" variant="button" size="md" />
<AddToWishlistButton productId="123" variant="button" size="lg" />
```

### Example in Product Grid

```tsx
<div className="grid grid-cols-4 gap-6">
  {products.map((product) => (
    <div key={product.id} className="bg-white rounded-xl p-4">
      <Image src={product.imageUrl} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{formatPrice(product.price)}</p>

      <div className="flex gap-2 mt-4">
        <button className="flex-1 bg-orange-500 text-white">
          Add to Cart
        </button>
        <AddToWishlistButton productId={product.id} variant="icon" size="md" />
      </div>
    </div>
  ))}
</div>
```

### Example on Product Page

```tsx
export default function ProductPage({ product }) {
  return (
    <div className="container">
      <div className="grid grid-cols-2 gap-8">
        <div>
          <Image src={product.imageUrl} alt={product.name} />
        </div>
        <div>
          <h1>{product.name}</h1>
          <p className="text-2xl font-bold">{formatPrice(product.price)}</p>

          <div className="flex gap-3 mt-6">
            <button className="flex-1 bg-orange-500 text-white px-6 py-3 rounded-lg">
              Add to Cart
            </button>
            <AddToWishlistButton
              productId={product.id}
              variant="button"
              size="lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## MegaMenu Component

The MegaMenu is automatically integrated into the Header component. No manual usage required.

### How it works:
1. User hovers over "Shop" nav item
2. MegaMenu opens with categories, featured products, and quick links
3. User clicks anywhere to navigate
4. Menu auto-closes on mouse leave (300ms delay) or ESC key

### Customization:
To customize the MegaMenu content, edit `/src/components/shop/MegaMenu.tsx`:

```tsx
// Change featured products limit
fetch('/api/products?featured=true&limit=5')  // Show 5 instead of 3

// Customize promo banner
<div className="bg-gradient-to-br from-orange-500 to-orange-600">
  <h4>Your Custom Promo Text</h4>
</div>

// Add more quick links
<Link href="/your-custom-page">
  <span>🎯</span>
  Your Custom Link
</Link>
```

---

## API Usage Examples

### Get User's Wishlists

```tsx
const res = await fetch('/api/account/wishlists');
const data = await res.json();
// data.wishlists = [{ id, name, isDefault, _count: { items } }]
```

### Create New Wishlist

```tsx
const res = await fetch('/api/account/wishlists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Summer Favorites' })
});
const data = await res.json();
// data.wishlist = { id, name, isDefault, _count }
```

### Get Items in a Wishlist

```tsx
const res = await fetch(`/api/account/wishlists/items?collectionId=${collectionId}`);
const data = await res.json();
// data.items = [{ id, productId, collectionId, createdAt, product: {...} }]
```

### Add Product to Wishlist

```tsx
const res = await fetch('/api/account/wishlists/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    collectionId: 'clx123...',
    productId: 'clx456...'
  })
});
```

### Move Item Between Wishlists

```tsx
const res = await fetch('/api/account/wishlists/items', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    itemId: 'clx789...',
    newCollectionId: 'clx012...'
  })
});
```

### Rename Wishlist

```tsx
const res = await fetch('/api/account/wishlists', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'clx123...',
    name: 'New Name'
  })
});
```

### Delete Wishlist

```tsx
const res = await fetch(`/api/account/wishlists?id=${id}`, {
  method: 'DELETE'
});
// Items are automatically moved to default wishlist
```

---

## Migration Script

### Run Migration

```bash
# Migrate legacy Wishlist to WishlistCollection + WishlistItem
npx tsx scripts/migrate-wishlist-to-collections.ts
```

### What it does:
1. Finds all legacy `Wishlist` entries
2. Groups by `userId`
3. Creates a default `WishlistCollection` for each user
4. Migrates all items preserving `createdAt` dates
5. Prints summary:
   - Users migrated
   - Users skipped (already have collections)
   - Total items migrated

### After Migration:
1. Verify data in database
2. Test wishlists in UI
3. Optionally drop legacy `Wishlist` table:

```sql
-- CAUTION: Only run after verifying migration!
DROP TABLE "Wishlist";
```

---

## Common Patterns

### Get Default Wishlist for User

```tsx
const res = await fetch('/api/account/wishlists');
const data = await res.json();
const defaultWishlist = data.wishlists.find(w => w.isDefault);
```

### Check if Product is in Any Wishlist

```tsx
async function isProductInWishlist(productId: string) {
  const res = await fetch('/api/account/wishlists');
  const data = await res.json();

  for (const collection of data.wishlists) {
    const itemsRes = await fetch(`/api/account/wishlists/items?collectionId=${collection.id}`);
    const itemsData = await itemsRes.json();
    const found = itemsData.items.some(item => item.productId === productId);
    if (found) return true;
  }
  return false;
}
```

### Bulk Add to Cart from Wishlist

```tsx
async function addWishlistToCart(collectionId: string) {
  const res = await fetch(`/api/account/wishlists/items?collectionId=${collectionId}`);
  const data = await res.json();

  for (const item of data.items) {
    if (item.product.inStock) {
      await addToCart(item.productId, 1);
    }
  }

  toast.success(`Added ${data.items.filter(i => i.product.inStock).length} items to cart`);
}
```

---

## Troubleshooting

### Mega Menu not showing:
1. Check if you're on desktop (hover requires desktop)
2. Check browser console for API errors
3. Verify `/api/categories` and `/api/products` return data

### Wishlist not loading:
1. Check if user is authenticated
2. Check browser console for API errors
3. Verify database has `WishlistCollection` and `WishlistItem` tables
4. Run migration script if upgrading from legacy system

### AddToWishlistButton not working:
1. Check if `productId` prop is valid
2. Check if user is authenticated
3. Check browser console for API errors
4. Verify `AddToWishlistButton` is imported correctly

### Migration fails:
1. Check if Prisma schema is pushed (`npx prisma db push`)
2. Check if database connection is working
3. Check if legacy `Wishlist` table exists
4. Run with `--help` flag for options

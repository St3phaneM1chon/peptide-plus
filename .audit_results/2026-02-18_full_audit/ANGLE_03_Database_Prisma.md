
---

# DATABASE & PRISMA SCHEMA AUDIT REPORT

## Project: peptide-plus (BioCycle Peptides)
**Schema location**: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma`
**Database**: PostgreSQL 15 via Prisma 5.22
**Total Models**: 82 models, 29 enums

---

## 1. SCHEMA COMPLETENESS

### 1.1 Model Inventory (82 models)

| # | Model | @updatedAt | @default(now()) on createdAt | Notes |
|---|-------|-----------|------------------------------|-------|
| 1 | Account | NO | NO | Auth.js model |
| 2 | AccountingAlert | NO | YES | Missing @updatedAt |
| 3 | AccountingPeriod | NO | YES | Has updatedAt but no @updatedAt |
| 4 | AccountingSettings | NO | N/A | Singleton |
| 5 | Ambassador | NO | YES | Has updatedAt but no @updatedAt |
| 6 | AmbassadorCommission | NO | YES | No updatedAt at all |
| 7 | AmbassadorPayout | NO | YES | No updatedAt at all |
| 8 | Article | NO | YES | Has updatedAt but no @updatedAt |
| 9 | ArticleTranslation | NO | YES | Has updatedAt but no @updatedAt |
| 10-82 | (remaining) | See below | YES | Pattern continues |

### 1.2 CRITICAL: @updatedAt missing on nearly all models

**Severity: HIGH**

Only **3 models** out of 82 use `@updatedAt`:
- `User` (line 2199)
- `TranslationJob` (line 2480)
- `UpsellConfig` (line 2528)

The remaining **~75 models** that have an `updatedAt DateTime` field do NOT have `@updatedAt`. This means Prisma will **NOT auto-update** the `updatedAt` field on writes. Every `update()` call must manually set `updatedAt: new Date()` or the field stays stale.

**Affected critical models** (non-exhaustive):
- `Order` (line 1200) -- orders track "updatedAt" but it will NEVER auto-update
- `Product` (line 1432) -- product catalog
- `Cart`, `CartItem` -- shopping carts
- All 14 Translation models
- All accounting models (JournalEntry, ChartOfAccount, etc.)
- Ambassador, Company, Shipping, etc.

---

## 2. MISSING RELATIONS (Orphaned Foreign Keys)

**Severity: CRITICAL**

These models have `userId`, `productId`, or other FK-like String fields with **NO corresponding `@relation`**, meaning **no referential integrity** is enforced at the database level.

### 2.1 Order model -- Missing User relation
**File**: `/Volumes/AI_Project/peptide-plus/prisma/schema.prisma`, lines 1166-1231

The `Order` model has `userId String` (line 1169) but:
- NO `user User @relation(...)` field
- The `User` model has NO `orders Order[]` back-relation

This is the **single most critical schema issue**. Orders are the core business entity, yet there is no FK constraint to Users. A user can be deleted and their orders become orphans with invalid `userId` values. You also cannot use `prisma.order.findMany({ include: { user: true } })`.

### 2.2 OrderItem -- Missing Product relation
**File**: lines 1251-1269

`OrderItem` has `productId String` and `formatId String?` but NO `@relation` to Product or ProductFormat. Only `order Order` relation exists.

### 2.3 Subscription -- Missing ALL relations
**File**: lines 1990-2013

`Subscription` has:
- `userId String` -- NO relation to User
- `productId String` -- NO relation to Product
- `formatId String?` -- NO relation to ProductFormat

This model is completely disconnected from the rest of the schema.

### 2.4 Wishlist (old model) -- Missing ALL relations
**File**: lines 2430-2439

`Wishlist` has `userId String` and `productId String` but NO relations at all. (Note: `WishlistCollection`/`WishlistItem` do have proper relations, suggesting this is a legacy duplicate.)

### 2.5 Cart -- Missing User relation
**File**: lines 373-386

`Cart` has `userId String?` but NO `user User?` relation. Also `promoCodeId String?` with NO relation to PromoCode.

### 2.6 CartItem -- Missing Product relation
**File**: lines 388-402

`CartItem` has `productId String` and `formatId String?` but NO relations to Product or ProductFormat.

### 2.7 InventoryReservation -- Missing ALL relations
**File**: lines 935-952

Has `productId`, `formatId`, `orderId`, `cartId` -- NONE have `@relation`.

### 2.8 InventoryTransaction -- Missing ALL relations
**File**: lines 954-972

Has `productId`, `formatId`, `orderId`, `supplierInvoiceId`, `createdBy` -- NONE have `@relation`.

### 2.9 Discount -- Missing Product and Category relations
**File**: lines 720-740

Has `categoryId String?` and `productId String?` -- NO relations.

### 2.10 AuditLog -- Missing User relation
**File**: lines 197-212

Has `userId String?` but NO relation to User.

### 2.11 Additional orphaned FKs:
| Model | Orphaned Field(s) | Missing Relation To |
|-------|-------------------|---------------------|
| AccountingAlert | entityId | Dynamic (no FK possible) |
| BankAccount | chartAccountId | ChartOfAccount |
| BankTransaction | matchedEntryId | JournalEntry |
| CreditNote | orderId, journalEntryId | Order, JournalEntry |
| CustomerInvoice | customerId, orderId, journalEntryId | User, Order, JournalEntry |
| CustomerInvoiceItem | productId | Product |
| EmailLog | templateId | EmailTemplate |
| LoyaltyTransaction | orderId, referralId | Order, Referral |
| PurchaseOrder | supplierId, supplierInvoiceId | (no Supplier model) |
| PurchaseOrderItem | productId, formatId | Product, ProductFormat |
| SupplierInvoice | supplierId, journalEntryId | (no Supplier model), JournalEntry |
| UserPermissionGroup | userId | User |
| UserPermissionOverride | userId, grantedBy | User, User |
| WebhookEvent | orderId, journalEntryId | Order, JournalEntry |
| ChatConversation | userId | User (separate from Conversation) |
| User | referredById | User (self-referral) |

**Total orphaned FK fields**: approximately **40+** across 20+ models.

---

## 3. DATA TYPE ISSUES

### 3.1 String fields that should be enums

**Severity: MEDIUM**

| Model | Field | Current | Should Be |
|-------|-------|---------|-----------|
| Order | `status` | `String @default("PENDING")` | `OrderStatus` enum (PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED) |
| Order | `paymentStatus` | `String @default("PENDING")` | `PaymentStatus` enum (PENDING, PAID, FAILED, REFUNDED, PARTIAL_REFUND) |
| Order | `orderType` | `String @default("STANDARD")` | `OrderType` enum (STANDARD, REPLACEMENT) |
| Ambassador | `status` | `String @default("ACTIVE")` | `AmbassadorStatus` enum |
| Ambassador | `tier` | `String @default("BRONZE")` | `AmbassadorTier` enum |
| Subscription | `status` | `String @default("ACTIVE")` | `SubscriptionStatus` enum |
| Subscription | `frequency` | `String @default("MONTHLY")` | `Frequency` enum |
| PurchaseOrder | `status` | `String @default("DRAFT")` | Already has patterns like DRAFT, SUBMITTED, APPROVED |
| AccountingPeriod | `status` | `String @default("OPEN")` | `PeriodStatus` enum |
| ReturnRequest | `status` | `String @default("PENDING")` | `ReturnStatus` enum |
| Referral | `status` | `String @default("PENDING")` | `ReferralStatus` enum |
| UatTestCase | `status` | `String @default("PENDING")` | Enum |
| UatTestRun | `status` | `String @default("RUNNING")` | Enum |
| EmailLog | `status` | `String @default("sent")` | Enum |
| User | `loyaltyTier` | `String @default("BRONZE")` | `LoyaltyTier` enum |
| Account | `type` | `String` | Auth.js standard, acceptable |
| BankAccount | `type` | `String @default("CHECKING")` | `BankAccountType` enum |
| BudgetLine | `type` | `String @default("EXPENSE")` | Already has AccountType enum |
| NewsArticle | `type` | `String @default("news")` | `NewsType` enum |
| SiteSetting | `type` | `String @default("text")` | `SettingType` enum |

Using Strings instead of enums means:
- No compile-time validation
- Typos silently pass (e.g., `"PENING"` instead of `"PENDING"`)
- No auto-complete in IDE
- No DB-level constraint on allowed values

### 3.2 No Float issues
Good news: No `Float` fields exist. All monetary values correctly use `Decimal` with explicit `@db.Decimal(x, y)`.

### 3.3 Potential Int overflow
**Severity: LOW**

- `Media.size Int` -- file sizes in bytes can exceed 2^31 (2GB) for large uploads. Should be `BigInt` for safety.
- `Video.views Int` -- could overflow for viral content, but unlikely for this use case.

---

## 4. INDEX ANALYSIS

### 4.1 Missing Indexes

**Severity: MEDIUM-HIGH**

| Model | Field Used in WHERE | Has Index? | Impact |
|-------|---------------------|------------|--------|
| Order | `userId` | YES | OK |
| Order | `promoCode` | **NO** | Ambassador commission lookups scan full table |
| OrderItem | `productId` | YES | OK |
| OrderItem | `formatId` | YES | OK |
| CartItem | `productId` | YES | OK |
| Product | `isActive` | **NO** | Product listing filters miss index |
| Customer Invoice | `customerId` | YES | OK |
| Subscription | `userId` | YES | OK |
| PromoCodeUsage | `userId` | YES | OK |
| AccountingAlert | `readAt` | **NO** | Filtering unread alerts is unindexed |
| GuideTranslation | `locale` | **NO** | Unlike other translations, missing locale index |

### 4.2 Redundant/Unnecessary Indexes

**Severity: LOW**

- `Article.@@index([slug])` -- slug already has `@unique` which creates an index
- `Bundle.@@index([slug])` -- same
- `Category.@@index([slug])` -- same
- `Currency.@@index([code])` -- same
- `NewsletterSubscriber.@@index([email])` -- email has `@unique`
- `User.@@index([email])` -- email has `@unique`

These duplicate indexes waste storage and slow down writes without providing any benefit.

---

## 5. N+1 QUERY DETECTION

**Severity: HIGH**

### 5.1 Classic N+1 Patterns Found

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/users/route.ts` (lines 52-63)
```typescript
const usersWithSpent = await Promise.all(
  users.map(async (user) => {
    const orderTotal = await prisma.order.aggregate({  // 1 query per user!
      where: { userId: user.id, paymentStatus: 'PAID' },
      _sum: { total: true },
    });
```
For 1000 users, this fires 1001 queries (1 for users + 1000 aggregations).

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts` (lines 38-86)
```typescript
ambassadors.map(async (a) => {
  const orderTotal = await prisma.order.aggregate({...});      // Query 1
  const pendingCommissions = await prisma.ambassadorCommission.aggregate({...});  // Query 2
  const paidCommissions = await prisma.ambassadorCommission.aggregate({...});    // Query 3
  // Then potentially an update
  await prisma.ambassador.update({...});  // Query 4
```
**4 queries per ambassador** in the loop. For 50 ambassadors = 201 queries.

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/ambassadors/route.ts` (lines 106-153)
The `syncCommissionsForCodes` function is even worse:
```typescript
for (const amb of ambassadors) {          // Loop over ambassadors
  const orders = await prisma.order.findMany({...});  // 1 query
  for (const order of orders) {           // Nested loop over orders!
    const existing = await prisma.ambassadorCommission.findUnique({...}); // 1 query per order
    if (!existing) {
      await prisma.ambassadorCommission.create({...}); // 1 more query
    }
  }
}
```
This is an N*M+1 pattern. Worst case for 50 ambassadors x 100 orders = 5001+ queries.

**File**: `/Volumes/AI_Project/peptide-plus/src/lib/seed-payment-methods.ts` (lines 18-67)
Nested loop with findUnique + conditional create/update per iteration. Acceptable for seed scripts but would be problematic in production code.

**File**: `/Volumes/AI_Project/peptide-plus/src/lib/accounting/recurring-entries.service.ts` (line 285-288)
```typescript
lines: {
  create: await Promise.all(template.lines.map(async (line) => {
    const account = await prisma.chartOfAccount.findUnique({...});  // 1 query per line
```

### 5.2 Category Translation N+1
**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/route.ts` (lines 85-89)
**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/products/search/route.ts` (lines 122-125, 160-162)
```typescript
categoryIds.map(async (catId) => {
  const translated = await getTranslatedFields('Category', catId, locale);
```
One query per category. Could be batched with `findMany({ where: { id: { in: categoryIds } } })`.

---

## 6. TRANSACTION USAGE ANALYSIS

### 6.1 Well-Protected Operations (using $transaction)
- Webhook checkout completion (webhook/route.ts line 234) -- GOOD
- PayPal capture (paypal/capture/route.ts line 124) -- GOOD
- Order cancellation (account/orders/[id]/cancel/route.ts line 64) -- GOOD
- Review creation (reviews/route.ts line 146) -- GOOD
- Loyalty earn/redeem (loyalty/earn/route.ts, loyalty/redeem/route.ts) -- GOOD
- Ambassador payouts (ambassadors/payouts/route.ts line 112) -- GOOD
- Referral apply/qualify -- GOOD
- Inventory service operations -- GOOD
- Quantity discount bulk update -- GOOD

### 6.2 MISSING Transactions (Multi-Step Without Protection)

**Severity: CRITICAL**

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/orders/[id]/route.ts` -- `handleRefund` function (lines 299-559)

This refund handler performs 8+ sequential database operations WITHOUT a transaction:
1. Stripe/PayPal refund (external API call)
2. `createRefundAccountingEntries()` -- creates journal entries
3. `prisma.order.update()` -- updates payment status
4. Loop: `prisma.productFormat.update()` -- restores stock (per item)
5. Loop: `prisma.inventoryTransaction.findFirst()` + `create()` -- inventory records
6. `prisma.customerInvoice.findFirst()` -- finds invoice
7. `createCreditNote()` -- creates credit note
8. `prisma.order.update()` -- updates admin notes

If step 4 fails mid-loop, some items have restored stock and others have not. If step 7 fails, the refund is processed but no credit note exists.

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/orders/[id]/route.ts` -- `handleReship` function (lines 563-744)

Similar issue: creates replacement order, then loops through items creating inventory transactions and updating stock -- all without a transaction. A failure partway through leaves inconsistent inventory.

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/payments/webhook/route.ts` -- `handleRefund` function (lines 492-575)

The refund inventory restoration loop (lines 546-565) runs individual queries without a transaction:
```typescript
for (const tx of transactions) {
  await prisma.productFormat.update({...});    // Could fail here
  await prisma.inventoryTransaction.create({...});  // Leaving this un-executed
}
```

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/payments/webhook/route.ts` -- `handleCheckoutComplete` (lines 362-440)

Post-transaction operations (promo tracking, ambassador commission) are individual queries. While wrapped in try/catch, they can leave partial data (e.g., promoCode usage incremented but no PromoCodeUsage record created if the create fails after the update).

### 6.3 Race Condition: Order Number Generation

**Severity: HIGH**

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/payments/webhook/route.ts` (lines 191-194)
**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/payments/paypal/capture/route.ts` (lines 118-121)

```typescript
const orderCount = await prisma.order.count({
  where: { orderNumber: { startsWith: `PP-${year}-` } },
});
const orderNumber = `PP-${year}-${String(orderCount + 1).padStart(6, '0')}`;
```

This is a classic **TOCTOU (time-of-check-time-of-use) race condition**. If two webhooks arrive simultaneously:
1. Both read count as 42
2. Both generate order number `PP-2026-000043`
3. One succeeds, the other fails with unique constraint violation

The count is also done **outside** the $transaction block. The fix should use a database sequence or `autoincrement()`.

---

## 7. SOFT DELETE PATTERNS

**Severity: LOW-MEDIUM**

### 7.1 Inconsistent Approach

The codebase has **no consistent soft-delete pattern**. There are no `isDeleted` or `deletedAt` fields anywhere in the schema.

The only soft-delete behavior found is in **one file**:

**File**: `/Volumes/AI_Project/peptide-plus/src/app/api/admin/promo-codes/[id]/route.ts` (lines 350-355)
```typescript
if (existing._count.usages > 0) {
  await prisma.promoCode.update({
    where: { id },
    data: { isActive: false },  // Soft delete by deactivation
  });
}
```

PromoCode uses `isActive: false` as a pseudo-soft-delete when it has usage history. All other deletions are hard deletes via `onDelete: Cascade` or explicit `prisma.*.delete()`.

**Risk**: Hard-deleting entities that are referenced by orphaned FK fields (see Section 2) will create dangling references. For example, deleting a User would not cascade to Orders (no FK relation), leaving orphaned `userId` values in the Order table.

---

## 8. MIGRATION SAFETY

**Severity: HIGH**

### 8.1 No migrations directory exists

The `prisma/migrations/` directory does **NOT exist**. This means:
- The project uses `prisma db push` exclusively (development workflow)
- There is **no migration history** and no version-controlled schema evolution
- Production deployments likely use `prisma db push` as well, which is **not recommended for production**
- There is no way to rollback schema changes
- No way to verify what schema is actually deployed vs. what is in `schema.prisma`

### 8.2 Recommendations
- Run `npx prisma migrate dev --name init` to baseline the schema
- Use `prisma migrate deploy` for production deployments
- Never use `prisma db push` in production

---

## SEVERITY SUMMARY

| Severity | Count | Key Issues |
|----------|-------|------------|
| **CRITICAL** | 5 | Missing Order-User relation; 40+ orphaned FKs; Refund/Reship without transactions; Order number race condition; No migrations |
| **HIGH** | 4 | @updatedAt missing on ~75 models; N+1 queries in admin/ambassador APIs; 15+ String fields that should be enums; Refund inventory restoration not transactional |
| **MEDIUM** | 3 | Missing indexes on Order.promoCode and Product.isActive; Redundant indexes on unique fields; No soft-delete strategy |
| **LOW** | 2 | Potential Int overflow on Media.size; Seed script uses loops (acceptable) |

---

## TOP 5 RECOMMENDED FIXES (Priority Order)

1. **Add `user User @relation(...)` to Order model** and `orders Order[]` to User model. This is your core business relation. Without it, you cannot join Orders to Users, and deleting a User leaves orphaned orders.

2. **Wrap refund and reship handlers in `$transaction`**. A partial refund failure currently leaves inconsistent inventory/accounting data.

3. **Fix order number generation race condition**. Use a database sequence (`@default(autoincrement())` on a separate counter field) or UUID-based order numbers with a human-friendly prefix.

4. **Add `@updatedAt` to all models that have `updatedAt DateTime`**. Without this, `updatedAt` is permanently stuck at the initial value unless manually set in every single update call.


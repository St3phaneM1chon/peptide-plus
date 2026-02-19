# COMMERCE CORE AUDIT REPORT
## peptide-plus Admin Sections: Dashboard, Commandes, Produits, Categories, Inventaire, Clients/Customers
### Date: 2026-02-18

---

# SECTION 1: DASHBOARD
**Files**: `src/app/admin/dashboard/page.tsx`, `src/app/admin/dashboard/DashboardClient.tsx`

## MOCKUP DETECTION
**Verdict: REAL (DB-Connected)**
The dashboard is a genuine server component that fetches live data from PostgreSQL via Prisma. All statistics (totalOrders, pendingOrders, monthlyRevenue, totalClients, totalCustomers, totalProducts, lowStockFormats) come from real `prisma.order.count()`, `prisma.company.count()`, `prisma.user.count()`, `prisma.productFormat.count()`, and `prisma.order.findMany()` queries. Recent orders and recent users are fetched with `take: 10`. Data is serialized via `JSON.parse(JSON.stringify())` to handle Prisma Decimal types.

---

### 25 FAILLES (Dashboard)

#### SECURITY (5+)

**F1.1** [CRITICAL] [SECURITY] Dashboard data is fetched server-side without error boundaries -- if Prisma throws, the entire page crashes with a 500 and potentially exposes internal error details to the client.
-- File: `src/app/admin/dashboard/page.tsx:22-81` (getAdminData function has no try/catch)
-- Impact: Server error leaks stack traces or database connection info to admin users
-- Fix: Wrap `getAdminData()` in try/catch, return safe fallback data on error

**F1.2** [HIGH] [SECURITY] No CSRF protection on dashboard -- while this page is read-only, the server component pattern makes it susceptible to server-side timing attacks that could reveal business metrics.
-- File: `src/app/admin/dashboard/page.tsx:108-128`
-- Impact: Competitors or malicious actors could probe business metrics
-- Fix: Add rate limiting headers, ensure cache-control: private, no-store

**F1.3** [MEDIUM] [SECURITY] The `JSON.parse(JSON.stringify(recentOrders))` serialization passes full order objects to the client, potentially including sensitive fields (shippingAddress, phone, etc.) that are not displayed.
-- File: `src/app/admin/dashboard/page.tsx:124`
-- Impact: Sensitive PII exposed in page source/hydration data
-- Fix: Use explicit `select` clauses on `recentOrders` to only fetch displayed fields

**F1.4** [MEDIUM] [SECURITY] Recent users query fetches all fields by default (no `select`), exposing potentially sensitive user data in client hydration payload.
-- File: `src/app/admin/dashboard/page.tsx:76-80`
-- Impact: Email addresses, roles, images serialized to client unnecessarily
-- Fix: Add `select` clause to user query to limit to displayed fields only

**F1.5** [LOW] [SECURITY] The `force-dynamic` export prevents caching, which is good for fresh data but also means every page load hits the DB, making the dashboard a potential vector for DB load attacks if an attacker has admin credentials.
-- File: `src/app/admin/dashboard/page.tsx:1`
-- Impact: Repeated rapid refreshes can overload database
-- Fix: Add rate limiting middleware for admin routes

#### DATA INTEGRITY (5+)

**F1.6** [HIGH] [DATA INTEGRITY] Monthly revenue calculation sums `total` field including refunded orders -- orders with status CANCELLED or REFUNDED but paymentStatus still PAID are counted in revenue.
-- File: `src/app/admin/dashboard/page.tsx:42-48`
-- Impact: Revenue figure is inflated by cancelled/refunded orders
-- Fix: Add `status: { notIn: ['CANCELLED'] }` filter, or subtract refund amounts from CreditNote table

**F1.7** [MEDIUM] [DATA INTEGRITY] `lowStockFormats` uses hardcoded threshold `stockQuantity: { lte: 10 }` instead of using each format's actual `lowStockThreshold` field.
-- File: `src/app/admin/dashboard/page.tsx:60-66`
-- Impact: Formats with custom thresholds (e.g., 50) won't appear as low stock; formats with threshold 2 will falsely appear
-- Fix: Use raw SQL `WHERE stock_quantity <= low_stock_threshold` or Prisma `$queryRaw`

**F1.8** [MEDIUM] [DATA INTEGRITY] `totalClients` counts `prisma.company.count()` which counts ALL companies, including inactive/suspended ones.
-- File: `src/app/admin/dashboard/page.tsx:51`
-- Impact: Client count is inflated with inactive companies
-- Fix: Add `where: { isActive: true }` filter

**F1.9** [LOW] [DATA INTEGRITY] No timezone handling for `startOfMonth` -- uses server's local timezone which may differ from business timezone.
-- File: `src/app/admin/dashboard/page.tsx:19-20`
-- Impact: Monthly revenue could include/exclude orders near month boundaries depending on server timezone
-- Fix: Use a fixed timezone (e.g., America/Montreal) for business calculations

**F1.10** [LOW] [DATA INTEGRITY] `recentOrders` includes ALL orders regardless of status, including test/cancelled orders that may pollute the dashboard view.
-- File: `src/app/admin/dashboard/page.tsx:68-73`
-- Impact: Admin sees irrelevant cancelled/test orders in "recent" list
-- Fix: Filter out test orders, optionally allow status filtering

#### BACKEND LOGIC (5)

**F1.11** [HIGH] [BACKEND LOGIC] Nine parallel Prisma queries (`Promise.all`) could cause connection pool exhaustion under load, as each uses a separate connection from the pool.
-- File: `src/app/admin/dashboard/page.tsx:22-81`
-- Impact: Under concurrent admin access, connection pool (default 5) gets exhausted
-- Fix: Reduce parallel queries or use `prisma.$transaction()` to share connection

**F1.12** [MEDIUM] [BACKEND LOGIC] Monthly revenue fetches ALL paid orders for the month then sums in JS (`reduce`) -- for large order volumes, this loads unnecessary data into memory.
-- File: `src/app/admin/dashboard/page.tsx:42-48, 84-87`
-- Impact: Memory spike on months with thousands of orders
-- Fix: Use `prisma.order.aggregate({ _sum: { total: true } })` instead

**F1.13** [MEDIUM] [BACKEND LOGIC] `recentOrders` includes `items: true` which fetches ALL order items for all 10 orders, but only item count is used in the dashboard display.
-- File: `src/app/admin/dashboard/page.tsx:72-73`, `DashboardClient.tsx`
-- Impact: Unnecessary data fetch, increased query time and memory
-- Fix: Use `_count: { select: { items: true } }` instead of `include: { items: true }`

**F1.14** [LOW] [BACKEND LOGIC] The auth check redirects to `/dashboard` for non-admin users but does NOT distinguish between unauthenticated and unauthorized -- both paths could be clearer.
-- File: `src/app/admin/dashboard/page.tsx:111-117`
-- Impact: Users see a generic redirect instead of an access denied message
-- Fix: Show 403 page for authenticated non-admin users

**F1.15** [LOW] [BACKEND LOGIC] No caching layer for dashboard stats -- every page load runs 9 queries even if data hasn't changed in the last minute.
-- File: `src/app/admin/dashboard/page.tsx:22-81`
-- Impact: Unnecessary database load for frequently refreshed dashboards
-- Fix: Add short-lived cache (30-60 seconds) for dashboard stats

#### FRONTEND (5)

**F1.16** [HIGH] [FRONTEND] Currency is hardcoded to `'CAD'` in `formatCurrency()` -- orders in other currencies (EUR, USD) will display incorrect symbols and formatting.
-- File: `src/app/admin/dashboard/DashboardClient.tsx:74-79`
-- Impact: Multi-currency orders display wrong currency symbol
-- Fix: Use each order's `currency.code` or a system-wide default currency setting

**F1.17** [MEDIUM] [FRONTEND] Status dropdown in the orders list renders raw enum values (`PENDING`, `CONFIRMED`) instead of translated labels.
-- File: `src/app/admin/dashboard/DashboardClient.tsx:88-106` (only detail modal translates, list uses raw)
-- Impact: Admin sees technical enum strings instead of localized labels
-- Fix: Apply `getOrderStatusLabel()` to list view as well

**F1.18** [MEDIUM] [FRONTEND] No loading skeleton or spinner while dashboard data is being fetched server-side -- users see a blank page until server renders.
-- File: `src/app/admin/dashboard/page.tsx` (server component, no Suspense boundary)
-- Impact: Slow DB queries cause blank screen for several seconds
-- Fix: Add `loading.tsx` file in the dashboard directory for Suspense fallback

**F1.19** [LOW] [FRONTEND] Dashboard stat cards don't show trend indicators (e.g., +12% vs last month) -- metrics lack context for business decisions.
-- File: `src/app/admin/dashboard/DashboardClient.tsx`
-- Impact: Admins can't quickly assess if metrics are improving or declining
-- Fix: Add previous period comparison in getAdminData, display trends

**F1.20** [LOW] [FRONTEND] Quick action buttons in dashboard are hardcoded links without checking if user has permission for each action.
-- File: `src/app/admin/dashboard/DashboardClient.tsx`
-- Impact: Employee-level admins see links to owner-only sections
-- Fix: Conditionally render actions based on session.user.role

#### INTEGRATION (5)

**F1.21** [HIGH] [INTEGRATION] `recentOrders` passes `items` array to client but `DashboardClient` only uses `items.length` -- the full OrderItem type only has `{ id: string }`, losing all actual item data.
-- File: `src/app/admin/dashboard/DashboardClient.tsx:41-43`
-- Impact: Interface type mismatch -- items array is typed as `{id: string}[]` but receives full OrderItem objects; wastes bandwidth
-- Fix: Fix type to match actual data or use `_count` instead

**F1.22** [MEDIUM] [INTEGRATION] No error handling if `getAdminData()` throws -- the page will return a 500 error with no user-friendly message.
-- File: `src/app/admin/dashboard/page.tsx:119`
-- Impact: Database outage causes cryptic error page for admin
-- Fix: Wrap in try/catch, render error boundary component

**F1.23** [MEDIUM] [INTEGRATION] Dashboard does not display any information about payment errors, failed webhooks, or system health.
-- File: `src/app/admin/dashboard/DashboardClient.tsx`
-- Impact: Critical payment failures go unnoticed until customers complain
-- Fix: Add payment error count and alert banner to dashboard

**F1.24** [LOW] [INTEGRATION] The `recentUsers` query filters for `CUSTOMER` and `CLIENT` roles but the DashboardClient doesn't show role badges.
-- File: `src/app/admin/dashboard/page.tsx:78-79`, `DashboardClient.tsx`
-- Impact: Admin cannot distinguish B2B clients from B2C customers in recent signups
-- Fix: Display role badge next to each recent user

**F1.25** [LOW] [INTEGRATION] Dashboard has no auto-refresh -- admin must manually reload to see new orders.
-- File: `src/app/admin/dashboard/DashboardClient.tsx`
-- Impact: Real-time order awareness requires manual refresh
-- Fix: Add polling interval (e.g., every 60s) or WebSocket for live updates

---

### 25 AMELIORATIONS (Dashboard)

#### COMPLETENESS (5+)

**A1.1** [P1] [COMPLETENESS] Add revenue breakdown by payment method (Stripe, PayPal, manual) to help admins understand payment channel distribution.
-- Implementation: Add Prisma aggregate query grouped by `paymentMethod`, render as pie chart

**A1.2** [P1] [COMPLETENESS] Add order funnel metrics: cart abandonment rate, checkout completion rate, average order value.
-- Implementation: Query `Cart` table for abandoned carts, calculate AOV from `Order.aggregate`

**A1.3** [P2] [COMPLETENESS] Add geographic distribution widget showing orders by country/province.
-- Implementation: Group orders by `shippingCountry` + `shippingState`, render heat map or bar chart

**A1.4** [P2] [COMPLETENESS] Add top-selling products widget showing the 5 most ordered products this month.
-- Implementation: Aggregate `OrderItem` by `productId`, sort by quantity, take 5

**A1.5** [P3] [COMPLETENESS] Add system health indicators: queue length, failed emails, pending webhooks, DB connection status.
-- Implementation: Create `/api/admin/health` endpoint, display as traffic light indicators

#### PERFORMANCE (5+)

**A1.6** [P1] [PERFORMANCE] Replace `findMany` + JS reduce for monthly revenue with `prisma.order.aggregate({ _sum: { total: true } })`.
-- Implementation: Single aggregate query instead of fetching all order rows

**A1.7** [P1] [PERFORMANCE] Use `_count` instead of `include: { items: true }` for recent orders to reduce data transfer.
-- Implementation: Change to `_count: { select: { items: true } }` in Prisma query

**A1.8** [P2] [PERFORMANCE] Add in-memory cache (30-60s TTL) for dashboard stats to reduce database load.
-- Implementation: Use `unstable_cache` from Next.js or a simple memory cache with TTL

**A1.9** [P2] [PERFORMANCE] Batch the 9 parallel queries into fewer calls using `prisma.$transaction` to share DB connection.
-- Implementation: Group related counts into a single `$queryRaw` with multiple CTEs

**A1.10** [P3] [PERFORMANCE] Add Suspense boundaries around each dashboard section to enable streaming server rendering.
-- Implementation: Split into independent async components wrapped in `<Suspense>` with skeleton fallbacks

#### PRECISION (5)

**A1.11** [P1] [PRECISION] Fix monthly revenue to exclude cancelled and fully refunded orders, and subtract partial refund amounts.
-- Implementation: Join with CreditNote table, subtract refund totals from revenue

**A1.12** [P1] [PRECISION] Use each format's actual `lowStockThreshold` field instead of hardcoded `10`.
-- Implementation: `WHERE stock_quantity <= low_stock_threshold AND track_inventory = true`

**A1.13** [P2] [PRECISION] Add multi-currency support to revenue display, showing breakdown per currency.
-- Implementation: Group orders by `currencyId`, aggregate per currency, display totals

**A1.14** [P2] [PRECISION] Add timezone-aware date calculations using the business timezone (e.g., America/Montreal).
-- Implementation: Use `luxon` or `date-fns-tz` for timezone-aware startOfMonth

**A1.15** [P3] [PRECISION] Separate "active clients" (ordered in last 90 days) from "total clients" for more actionable metrics.
-- Implementation: Add conditional count with `lastOrderDate >= 90 days ago`

#### ROBUSTNESS (5)

**A1.16** [P1] [ROBUSTNESS] Add error boundary and fallback UI for the dashboard page.
-- Implementation: Create `error.tsx` in dashboard directory, show retry button

**A1.17** [P1] [ROBUSTNESS] Add `loading.tsx` Suspense fallback with skeleton cards.
-- Implementation: Create loading.tsx with pulsing placeholders matching stat card layout

**A1.18** [P2] [ROBUSTNESS] Handle Prisma connection failures gracefully instead of crashing the page.
-- Implementation: Catch PrismaClientKnownRequestError, show "Database unavailable" message

**A1.19** [P2] [ROBUSTNESS] Add request timeout for dashboard queries (e.g., 10s) to prevent hung requests.
-- Implementation: Use AbortController or Prisma transaction timeout option

**A1.20** [P3] [ROBUSTNESS] Add retry logic for transient database errors in dashboard data fetching.
-- Implementation: Wrap Prisma calls with exponential backoff retry (max 3 attempts)

#### UX (5)

**A1.21** [P1] [UX] Add auto-refresh with configurable interval (30s, 60s, 5min) so admins see live updates.
-- Implementation: Add client-side polling with `setInterval`, refresh button, and interval selector

**A1.22** [P2] [UX] Add date range selector to dashboard (today, this week, this month, custom) for flexible analytics.
-- Implementation: Add date range picker component, modify queries to accept date parameters

**A1.23** [P2] [UX] Add click-through from stat cards to filtered list pages (e.g., clicking "Pending Orders" goes to `/admin/commandes?status=PENDING`).
-- Implementation: Wrap stat cards in `<Link>` components with appropriate query params

**A1.24** [P3] [UX] Add dark mode support for dashboard, matching admin layout theme.
-- Implementation: Use Tailwind dark: variants, add theme toggle to admin header

**A1.25** [P3] [UX] Add keyboard shortcuts for common dashboard actions (R to refresh, O to go to orders, P to go to products).
-- Implementation: Add `useHotkeys` hook with keyboard shortcut overlay guide

---
---

# SECTION 2: COMMANDES (Orders)
**Files**: `src/app/admin/commandes/page.tsx`, `src/app/api/admin/orders/route.ts`, `src/app/api/admin/orders/[id]/route.ts`

## MOCKUP DETECTION
**Verdict: REAL (DB-Connected) with BROKEN integrations**
The orders page fetches live data from `/api/admin/orders` which queries PostgreSQL via Prisma. Order detail, refund, and reship operations use `/api/admin/orders/[id]`. However, there is a CRITICAL HTTP method mismatch: the frontend uses `PATCH` for status/tracking updates, but the API only exports `GET`, `PUT`, and `POST` -- meaning **status updates and tracking updates silently fail with 405 errors**. The Export CSV button and Send Email/Print buttons are non-functional placeholders.

---

### 25 FAILLES (Commandes)

#### SECURITY (5+)

**F2.1** [CRITICAL] [SECURITY] No CSRF token validation on any order mutation endpoint (PUT, POST for refund/reship). Only the users PATCH endpoint has CSRF protection.
-- File: `src/app/api/admin/orders/[id]/route.ts` (all mutation handlers)
-- Impact: Cross-site request forgery could trigger refunds, status changes, or reshipping
-- Fix: Add CSRF middleware to all POST/PUT/PATCH handlers in admin API

**F2.2** [HIGH] [SECURITY] Stripe secret key is accessed with `!` non-null assertion at module level -- if env var is missing, the entire module crashes on import.
-- File: `src/app/api/admin/orders/[id]/route.ts:22-24`
-- Impact: Missing STRIPE_SECRET_KEY crashes all order detail endpoints, not just refund
-- Fix: Lazy-initialize Stripe client inside refund handler, validate key presence

**F2.3** [HIGH] [SECURITY] Refund amount has no server-side maximum validation -- an admin could refund more than the order total (over-refund).
-- File: `src/app/api/admin/orders/[id]/route.ts` (refund POST handler)
-- Impact: Financial loss from over-refunds, accounting discrepancies
-- Fix: Validate `amount <= order.total - previousRefundsTotal`

**F2.4** [MEDIUM] [SECURITY] No audit trail for admin actions -- status changes, refunds, and reship actions are not logged with the admin user who performed them.
-- File: `src/app/api/admin/orders/[id]/route.ts` (all handlers)
-- Impact: No accountability for admin actions, no forensics capability
-- Fix: Create AdminAuditLog table, log every mutation with userId, action, timestamp

**F2.5** [MEDIUM] [SECURITY] The `orderId` in the main PUT route (`/api/admin/orders`) comes from the request body, not the URL -- allowing potential order ID injection.
-- File: `src/app/api/admin/orders/route.ts:114`
-- Impact: Admin could accidentally or maliciously update wrong order
-- Fix: Use URL parameter `[id]` routing pattern instead of body field

**F2.6** [MEDIUM] [SECURITY] No rate limiting on refund endpoint -- rapid-fire refund requests could process duplicate refunds before DB updates.
-- File: `src/app/api/admin/orders/[id]/route.ts` (POST refund action)
-- Impact: Race condition could cause double refunds on same order
-- Fix: Add idempotency key, check for existing pending refunds, use DB transaction with FOR UPDATE lock

#### DATA INTEGRITY (5+)

**F2.7** [CRITICAL] [DATA INTEGRITY] Reship action creates inventory LOSS + SALE transactions but does NOT verify sufficient stock exists before decrementing.
-- File: `src/app/api/admin/orders/[id]/route.ts` (reship POST handler)
-- Impact: Stock can go negative, creating phantom inventory
-- Fix: Check `stockQuantity >= item.quantity` before creating reship, abort if insufficient

**F2.8** [HIGH] [DATA INTEGRITY] Full refund restores stock using `format.stockQuantity + item.quantity` but doesn't account for concurrent stock changes between order and refund.
-- File: `src/app/api/admin/orders/[id]/route.ts` (refund handler stock restoration)
-- Impact: Stock quantity could be incorrect if other orders/adjustments happened
-- Fix: Use `increment` operation instead of read-then-write, wrap in transaction

**F2.9** [HIGH] [DATA INTEGRITY] Partial refunds do NOT restore any stock -- the logic only restores stock for `isFullRefund`, meaning returned items in partial refunds remain "sold" in inventory.
-- File: `src/app/api/admin/orders/[id]/route.ts` (refund handler)
-- Impact: Inventory becomes permanently understated for partial refunds with returns
-- Fix: Add option to select which items are being returned in partial refund

**F2.10** [MEDIUM] [DATA INTEGRITY] The frontend optimistically updates order status in local state without verifying the API response succeeded.
-- File: `src/app/admin/commandes/page.tsx:203-206`
-- Impact: UI shows updated status even when the API call fails (which it currently always does due to PATCH/PUT mismatch)
-- Fix: Only update local state after confirming `res.ok`, show error toast on failure

**F2.11** [MEDIUM] [DATA INTEGRITY] Credit note total calculation uses proportional tax for partial refunds, but doesn't account for item-specific tax rates or tax-exempt items.
-- File: `src/app/api/admin/orders/[id]/route.ts` (refund handler tax calculation)
-- Impact: Credit note tax amounts may be incorrect for mixed-tax orders
-- Fix: Calculate per-item tax based on actual tax rules, not proportional average

**F2.12** [MEDIUM] [DATA INTEGRITY] No validation that carrier name matches predefined values in the backend -- frontend has a fixed dropdown but API accepts any string.
-- File: `src/app/api/admin/orders/[id]/route.ts` (PUT handler accepts any carrier string)
-- Impact: Inconsistent carrier names in database (e.g., "fedex" vs "FedEx")
-- Fix: Add carrier enum validation in API, or use database enum

#### BACKEND LOGIC (5)

**F2.13** [CRITICAL] [BACKEND LOGIC] Frontend calls `method: 'PATCH'` on `/api/admin/orders/${orderId}` but the `[id]/route.ts` only exports `GET`, `PUT`, and `POST` -- NO PATCH handler exists. Every status update and tracking update silently fails with a 405 Method Not Allowed.
-- File: `src/app/admin/commandes/page.tsx:198-199,216-217` vs `src/app/api/admin/orders/[id]/route.ts`
-- Impact: BROKEN FUNCTIONALITY: Admins cannot change order status or update tracking from the UI
-- Fix: Either change frontend to use PUT, or add a PATCH export to the API route

**F2.14** [HIGH] [BACKEND LOGIC] The `fetchOrders` function doesn't pass any filter parameters to the API -- date filters, status filter, and search are only applied client-side via `filteredOrders` memo, wasting server resources fetching ALL orders.
-- File: `src/app/admin/commandes/page.tsx:142-152`
-- Impact: All orders loaded into browser memory; date filter UI exists but never queries server
-- Fix: Pass `filter.status`, `filter.search`, `filter.dateFrom`, `filter.dateTo` as query params to API

**F2.15** [HIGH] [BACKEND LOGIC] No pagination in the frontend -- all orders are fetched in a single request and filtered/displayed client-side.
-- File: `src/app/admin/commandes/page.tsx:142-152`
-- Impact: With 10,000+ orders, page load takes minutes and browser may crash
-- Fix: Implement server-side pagination using the API's existing `page`/`limit` params

**F2.16** [MEDIUM] [BACKEND LOGIC] PayPal refund creates access token for every refund request instead of caching it. Token endpoint is called synchronously in the refund flow.
-- File: `src/app/api/admin/orders/[id]/route.ts` (PayPal refund section)
-- Impact: Added latency, risk of rate limiting by PayPal
-- Fix: Cache PayPal access token with TTL based on `expires_in`

**F2.17** [MEDIUM] [BACKEND LOGIC] The status select dropdown in order detail uses `statusOptionValues` (raw strings) instead of translated `statusOptions`, showing raw enum values.
-- File: `src/app/admin/commandes/page.tsx:540-543`
-- Impact: Status dropdown shows "PENDING", "CONFIRMED" etc. instead of translated labels
-- Fix: Use `statusOptions` array with label/value pairs in the select

#### FRONTEND (5+)

**F2.18** [HIGH] [FRONTEND] Export CSV button has no `onClick` handler -- it renders as a button but clicking it does nothing.
-- File: `src/app/admin/commandes/page.tsx:440-443`
-- Impact: Admin expects CSV export but gets no response
-- Fix: Add onClick handler that calls `/api/admin/orders/export` or generates CSV client-side

**F2.19** [HIGH] [FRONTEND] "Send Confirmation Email" button has no onClick handler -- it's a decoration.
-- File: `src/app/admin/commandes/page.tsx:500-502`
-- Impact: Admin thinks email was sent but nothing happens
-- Fix: Connect to email sending API endpoint

**F2.20** [MEDIUM] [FRONTEND] "Print Delivery Slip" button has no onClick handler.
-- File: `src/app/admin/commandes/page.tsx:503-505`
-- Impact: Admins cannot print packing slips from order detail
-- Fix: Generate printable HTML/PDF and trigger browser print dialog

**F2.21** [MEDIUM] [FRONTEND] Price amounts are displayed with `toFixed(2) + " $"` hardcoded -- ignores currency symbol/position from order's currency.
-- File: `src/app/admin/commandes/page.tsx:623,624,637,641,647,651,655`
-- Impact: Non-CAD orders display with wrong currency symbol
-- Fix: Use `Intl.NumberFormat` with order's `currencyCode`

**F2.22** [MEDIUM] [FRONTEND] Admin notes textarea is rendered but there's no save mechanism for notes in the order detail modal.
-- File: `src/app/admin/commandes/page.tsx` (order detail section)
-- Impact: Admin types notes but they disappear on modal close
-- Fix: Add onBlur save or explicit "Save Notes" button connected to PUT API

**F2.23** [LOW] [FRONTEND] No confirmation dialog before changing order status -- a misclick on the dropdown immediately fires the (broken) update.
-- File: `src/app/admin/commandes/page.tsx:536`
-- Impact: Accidental status changes, especially to CANCELLED/DELIVERED which trigger lifecycle emails
-- Fix: Add confirmation modal for destructive status changes (CANCELLED, DELIVERED)

#### INTEGRATION (5)

**F2.24** [HIGH] [INTEGRATION] The `fetchOrderDetail` endpoint parses `PaymentError.metadata` as JSON, but the Prisma schema defines it as `String` -- parsing non-JSON strings will throw.
-- File: `src/app/api/admin/orders/[id]/route.ts` (GET handler, metadata parsing)
-- Impact: Malformed metadata crashes order detail loading
-- Fix: Wrap JSON.parse in try/catch with fallback to raw string display

**F2.25** [HIGH] [INTEGRATION] Lifecycle emails are sent on status change in the PUT handler, but since frontend uses PATCH (which doesn't exist), no lifecycle emails are ever sent from the admin UI.
-- File: `src/app/api/admin/orders/[id]/route.ts` (PUT handler email sending) vs frontend PATCH calls
-- Impact: Customers never receive status update emails when admin changes status
-- Fix: Fix the PATCH/PUT mismatch to enable email sending

---

### 25 AMELIORATIONS (Commandes)

#### COMPLETENESS (5+)

**A2.1** [P0] [COMPLETENESS] Fix the PATCH/PUT HTTP method mismatch to make order status and tracking updates functional.
-- Implementation: Change `method: 'PATCH'` to `method: 'PUT'` in `updateOrderStatus` and `updateTracking`, or export a PATCH handler in the API route

**A2.2** [P1] [COMPLETENESS] Implement the Export CSV onClick handler, connecting to `/api/admin/products/export` pattern.
-- Implementation: Create `/api/admin/orders/export` route, trigger download on button click

**A2.3** [P1] [COMPLETENESS] Implement Send Email functionality connected to `sendOrderLifecycleEmail`.
-- Implementation: Add POST `/api/admin/orders/[id]?action=email` handler, connect button

**A2.4** [P2] [COMPLETENESS] Implement Print Delivery Slip using a printable template.
-- Implementation: Create print-optimized HTML template, use `window.print()` with targeted content

**A2.5** [P2] [COMPLETENESS] Add admin notes save functionality with auto-save on blur.
-- Implementation: Add onBlur handler that calls PUT API with adminNotes field

#### PERFORMANCE (5)

**A2.6** [P1] [PERFORMANCE] Implement server-side pagination by passing page/limit/filters to API.
-- Implementation: Update `fetchOrders()` to include `?page=${page}&limit=20&status=${filter.status}&search=${filter.search}&from=${filter.dateFrom}&to=${filter.dateTo}`

**A2.7** [P1] [PERFORMANCE] Add debounced search input instead of filtering all orders in memory.
-- Implementation: Use `useDebouncedValue` hook (300ms), trigger API fetch on debounced value change

**A2.8** [P2] [PERFORMANCE] Cache PayPal access token to avoid requesting a new one for every refund.
-- Implementation: Store token + expiry in module-level variable, refresh when expired

**A2.9** [P2] [PERFORMANCE] Add optimistic UI updates with rollback on failure for status changes.
-- Implementation: Set local state immediately, revert if `res.ok` is false, show error toast

**A2.10** [P3] [PERFORMANCE] Lazy-load order detail data only when modal opens, instead of fetching on row click.
-- Implementation: Use React.lazy for modal content, fetch data inside modal component

#### PRECISION (5)

**A2.11** [P1] [PRECISION] Use translated status labels in the status dropdown inside order detail modal.
-- Implementation: Replace `statusOptionValues.map(s => <option value={s}>{s}</option>)` with `statusOptions.map(s => <option value={s.value}>{s.label}</option>)`

**A2.12** [P1] [PRECISION] Use order's actual currency for all price displays instead of hardcoded `$`.
-- Implementation: Create `formatOrderPrice(amount, currencyCode, locale)` utility, use throughout

**A2.13** [P2] [PRECISION] Add refund history display showing cumulative refund amount vs order total.
-- Implementation: Sum credit notes for order, show "Refunded: X / Y total" progress bar

**A2.14** [P2] [PRECISION] Validate refund amount against remaining refundable balance (total - previous refunds).
-- Implementation: Query CreditNote sum for order, validate `amount <= total - refundedSoFar`

**A2.15** [P3] [PRECISION] Add order timeline/activity log showing all status changes with timestamps and admin names.
-- Implementation: Create OrderActivity table, insert on each status change, display timeline in modal

#### ROBUSTNESS (5)

**A2.16** [P1] [ROBUSTNESS] Add error toast notifications for failed API calls instead of silent `console.error`.
-- Implementation: Replace `console.error` with `toast.error(t('admin.commandes.updateError'))` in catch blocks

**A2.17** [P1] [ROBUSTNESS] Add confirmation dialog before destructive actions (cancel order, refund).
-- Implementation: Use existing Modal component for "Are you sure?" confirmation before status changes to CANCELLED

**A2.18** [P2] [ROBUSTNESS] Add idempotency key to refund requests to prevent double refunds.
-- Implementation: Generate UUID on modal open, send as header, check for duplicate in API

**A2.19** [P2] [ROBUSTNESS] Handle 405 errors gracefully -- currently the frontend doesn't check response status from PATCH calls.
-- Implementation: Check `res.ok` after fetch, show specific error message for each HTTP status

**A2.20** [P3] [ROBUSTNESS] Add retry with exponential backoff for payment gateway refund failures.
-- Implementation: On Stripe/PayPal timeout, retry up to 3 times with 1s/2s/4s delays

#### UX (5)

**A2.21** [P1] [UX] Add success toast after status update, tracking update, refund, and reship operations.
-- Implementation: `toast.success(t('admin.commandes.statusUpdated'))` after each successful mutation

**A2.22** [P2] [UX] Add bulk actions: select multiple orders and batch-update status.
-- Implementation: Add checkbox column, "Select All" header, bulk action dropdown (Update Status, Export Selected)

**A2.23** [P2] [UX] Add order notes/comments visible in the order list (icon indicator for orders with notes).
-- Implementation: Add note icon badge to order row when `adminNotes` is not empty

**A2.24** [P3] [UX] Add keyboard navigation in order list (arrow keys to navigate, Enter to open detail).
-- Implementation: Add `onKeyDown` handler to DataTable rows, track focused row index

**A2.25** [P3] [UX] Add sound notification for new orders (opt-in setting).
-- Implementation: Poll for new orders, play notification sound when count increases

---
---

# SECTION 3: PRODUITS (Products)
**Files**: `src/app/admin/produits/page.tsx`, `src/app/admin/produits/ProductsListClient.tsx`, `src/app/admin/produits/[id]/page.tsx`, `src/app/admin/produits/[id]/ProductEditClient.tsx`, `src/app/admin/produits/product-constants.ts`, `src/app/api/admin/products/export/route.ts`, `src/app/api/admin/products/import/route.ts`

## MOCKUP DETECTION
**Verdict: REAL (DB-Connected)**
Products are fetched server-side via Prisma with full `include` of categories, formats, and images. Product editing and creation use live API calls. CSV export and import are functional. However, product delete and save operations call PUBLIC API routes (`/api/products/${id}`) instead of admin-specific routes, which is a security concern.

---

### 25 FAILLES (Produits)

#### SECURITY (5+)

**F3.1** [CRITICAL] [SECURITY] Product delete calls `/api/products/${id}` (public API route) instead of `/api/admin/products/${id}` -- the public route may have different or NO auth checks.
-- File: `src/app/admin/produits/ProductsListClient.tsx:237`
-- Impact: Public product deletion endpoint may be accessible without admin auth
-- Fix: Create `/api/admin/products/[id]/route.ts` with proper admin auth, update frontend

**F3.2** [CRITICAL] [SECURITY] Product save calls `/api/products/${product.id}` (public route) for updates -- same issue as delete.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx`
-- Impact: Product data could be modified through public API without admin role
-- Fix: Route admin product mutations through `/api/admin/products/[id]`

**F3.3** [HIGH] [SECURITY] CSV import is OWNER-only but doesn't validate file size -- a malicious CSV file could exhaust server memory.
-- File: `src/app/api/admin/products/import/route.ts`
-- Impact: Memory exhaustion DOS via large CSV upload
-- Fix: Add `Content-Length` check (max 10MB), stream-parse CSV instead of loading to memory

**F3.4** [HIGH] [SECURITY] CSV import parses file content without sanitizing field values -- potential for SQL injection via Prisma string fields if special characters are used.
-- File: `src/app/api/admin/products/import/route.ts` (custom CSV parser)
-- Impact: Malicious CSV data could contain XSS payloads stored in DB
-- Fix: Sanitize all string inputs, escape HTML entities before storing

**F3.5** [MEDIUM] [SECURITY] No audit log for product changes -- who modified what and when is not tracked.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx`
-- Impact: No accountability for product modifications
-- Fix: Add `lastModifiedBy`, `lastModifiedAt` fields to Product model

**F3.6** [MEDIUM] [SECURITY] Product image URLs are stored as strings without validation -- malicious URLs could be stored pointing to external malware.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx` (media tab)
-- Impact: Admin could unknowingly add malicious image URLs
-- Fix: Validate image URLs against allowed domains, verify they return image content-type

#### DATA INTEGRITY (5+)

**F3.7** [HIGH] [DATA INTEGRITY] Product list page fetches ALL products server-side without pagination -- with hundreds of products, this causes slow page loads and excessive memory use.
-- File: `src/app/admin/produits/page.tsx` (Prisma findMany without take/skip)
-- Impact: Page becomes unusable with large product catalogs
-- Fix: Add pagination or virtual scrolling, fetch page-by-page

**F3.8** [HIGH] [DATA INTEGRITY] CSV import uses `upsert` by slug -- if two products share a slug (due to manual editing), the import could overwrite the wrong product.
-- File: `src/app/api/admin/products/import/route.ts` (upsert by slug)
-- Impact: Data corruption if slugs are not unique
-- Fix: Add unique constraint on slug in schema, validate slug uniqueness before upsert

**F3.9** [MEDIUM] [DATA INTEGRITY] CSV import processes rows sequentially (not in a transaction) -- a failure mid-import leaves partial data.
-- File: `src/app/api/admin/products/import/route.ts` (row-by-row processing)
-- Impact: Partial import with inconsistent product catalog
-- Fix: Wrap entire import in `prisma.$transaction`, rollback on any row failure

**F3.10** [MEDIUM] [DATA INTEGRITY] Product delete is a hard delete (if the public API uses `delete`) -- no soft delete option to preserve order history references.
-- File: `src/app/admin/produits/ProductsListClient.tsx:237`
-- Impact: Deleting a product that has existing orders could break order detail pages
-- Fix: Use soft delete (set `isActive: false, deletedAt: new Date()`) instead

**F3.11** [MEDIUM] [DATA INTEGRITY] No validation of duplicate slugs when creating new products.
-- File: `src/app/admin/produits/nouveau/page.tsx`
-- Impact: Duplicate slugs cause URL conflicts and routing issues
-- Fix: Check slug uniqueness on save, auto-suffix if duplicate

**F3.12** [LOW] [DATA INTEGRITY] CSV export/import may lose data for fields with commas or newlines in the CSV escaping.
-- File: `src/app/api/admin/products/export/route.ts`, `import/route.ts`
-- Impact: Round-trip (export then import) could corrupt product descriptions
-- Fix: Verify CSV escaping handles all edge cases (commas, quotes, newlines)

#### BACKEND LOGIC (5)

**F3.13** [HIGH] [BACKEND LOGIC] CSV import custom CSV parser doesn't handle all edge cases: quoted fields with newlines, BOM markers, different line endings (CRLF vs LF).
-- File: `src/app/api/admin/products/import/route.ts` (custom CSV parser)
-- Impact: Import fails silently or produces garbled data for Excel-exported CSVs
-- Fix: Use a battle-tested CSV parsing library like `csv-parse` or `papaparse`

**F3.14** [MEDIUM] [BACKEND LOGIC] Format CRUD in ProductEditClient sends individual API calls for each format create/update/delete -- not batched.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx` (Formats tab)
-- Impact: Slow save process with many formats, risk of partial updates
-- Fix: Batch format changes into a single API call

**F3.15** [MEDIUM] [BACKEND LOGIC] Product search in ProductsListClient only searches `name` and `slug` fields -- doesn't search by SKU, description, or category name.
-- File: `src/app/admin/produits/ProductsListClient.tsx:198-204`
-- Impact: Admin can't find products by SKU or keyword
-- Fix: Extend search to include SKU (from formats), description, and category name

**F3.16** [LOW] [BACKEND LOGIC] Low stock threshold for filter is hardcoded to `10` in `ProductsListClient` instead of using format's `lowStockThreshold`.
-- File: `src/app/admin/produits/ProductsListClient.tsx:219`
-- Impact: Inconsistent with per-format threshold settings
-- Fix: Use `f.stockQuantity <= f.lowStockThreshold` comparison

**F3.17** [LOW] [BACKEND LOGIC] CSV import resolves categories by name match (case-sensitive) -- slightly different names will create duplicate categories.
-- File: `src/app/api/admin/products/import/route.ts`
-- Impact: "Peptides" vs "peptides" creates separate categories
-- Fix: Use case-insensitive comparison for category resolution

#### FRONTEND (5)

**F3.18** [HIGH] [FRONTEND] The ProductEditClient is 983 lines in a single component -- extremely difficult to maintain and test.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx`
-- Impact: High bug risk, poor developer experience, hard to review changes
-- Fix: Split into sub-components: ProductHeaderTab, ProductTextsTab, ProductFormatsTab

**F3.19** [MEDIUM] [FRONTEND] Translation status bar shows 22 locale flags but doesn't indicate which translations exist vs which are missing.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx`
-- Impact: Admin can't tell which translations need attention
-- Fix: Color-code flags (green=complete, red=missing, yellow=partial)

**F3.20** [MEDIUM] [FRONTEND] No unsaved changes warning -- navigating away while editing loses all changes without confirmation.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx`
-- Impact: Admin loses work accidentally
-- Fix: Add `beforeunload` event listener and router navigation guard

**F3.21** [LOW] [FRONTEND] Delete confirmation uses browser `confirm()` which is not translatable and breaks the design system.
-- File: `src/app/admin/produits/ProductsListClient.tsx:231`
-- Impact: Inconsistent UX, not translatable for i18n
-- Fix: Use a custom Modal component for delete confirmation

**F3.22** [LOW] [FRONTEND] No image preview or drag-and-drop for product media upload.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx` (media section)
-- Impact: Poor media management UX
-- Fix: Add image preview thumbnails and drag-to-reorder functionality

#### INTEGRATION (5)

**F3.23** [HIGH] [INTEGRATION] Admin product operations (delete, save) use public API routes (`/api/products/`) instead of admin API routes (`/api/admin/products/`) -- auth model mismatch.
-- File: `src/app/admin/produits/ProductsListClient.tsx:237`, `[id]/ProductEditClient.tsx`
-- Impact: Inconsistent auth patterns; if public routes require customer auth, admin operations fail
-- Fix: Create proper admin product CRUD routes under `/api/admin/products/`

**F3.24** [MEDIUM] [INTEGRATION] CSV import doesn't create/update product formats -- only the base product is imported, losing format-level data.
-- File: `src/app/api/admin/products/import/route.ts`
-- Impact: Import is incomplete; formats must be manually re-added
-- Fix: Include format columns in CSV and create/update formats during import

**F3.25** [MEDIUM] [INTEGRATION] No webhook or event after product changes -- inventory, search indexes, and cache are not invalidated.
-- File: `src/app/admin/produits/[id]/ProductEditClient.tsx`
-- Impact: Product changes may not reflect immediately on storefront
-- Fix: Add cache revalidation (`revalidatePath`) after product mutations

---

### 25 AMELIORATIONS (Produits)

#### COMPLETENESS (5+)

**A3.1** [P0] [COMPLETENESS] Create admin-specific product CRUD routes under `/api/admin/products/[id]` with proper EMPLOYEE/OWNER auth.
-- Implementation: New route file with GET/PUT/PATCH/DELETE handlers, migrate frontend calls

**A3.2** [P1] [COMPLETENESS] Add product duplication feature (clone product with "Copy of" prefix).
-- Implementation: "Duplicate" button in product list, POST to create with cloned data

**A3.3** [P1] [COMPLETENESS] Add bulk operations: bulk activate/deactivate, bulk category assignment, bulk delete.
-- Implementation: Checkbox selection, bulk action dropdown, batch API endpoint

**A3.4** [P2] [COMPLETENESS] Add product version history / changelog showing what changed and who changed it.
-- Implementation: Create ProductHistory table, insert diff record on each save

**A3.5** [P2] [COMPLETENESS] Add product preview link that shows how the product looks on the storefront.
-- Implementation: "Preview" button that opens product page in new tab with draft query param

#### PERFORMANCE (5)

**A3.6** [P1] [PERFORMANCE] Add server-side pagination for product list instead of fetching all products.
-- Implementation: Convert to client component with paginated API, or use server-side pagination with search params

**A3.7** [P1] [PERFORMANCE] Use a proper CSV parsing library (papaparse) for import instead of custom parser.
-- Implementation: `npm install papaparse`, replace custom parser with `Papa.parse()`

**A3.8** [P2] [PERFORMANCE] Batch format CRUD operations into a single API call.
-- Implementation: Send array of format changes in one PUT request, process in transaction

**A3.9** [P2] [PERFORMANCE] Add image optimization pipeline for product media uploads (resize, compress, WebP conversion).
-- Implementation: Process uploaded images with Sharp, store multiple sizes

**A3.10** [P3] [PERFORMANCE] Implement virtual scrolling for product list when catalog exceeds 100 items.
-- Implementation: Use `react-virtual` or `tanstack-virtual` for virtualized list rendering

#### PRECISION (5)

**A3.11** [P1] [PRECISION] Use format-specific `lowStockThreshold` for stock status indicators instead of hardcoded value.
-- Implementation: Compare `f.stockQuantity <= f.lowStockThreshold` in filter logic

**A3.12** [P1] [PRECISION] Add SKU uniqueness validation across all product formats.
-- Implementation: Check SKU uniqueness on format save, show error if duplicate

**A3.13** [P2] [PRECISION] Add SEO score indicator based on product title length, description completeness, and image presence.
-- Implementation: Calculate score from field completeness, display as progress bar

**A3.14** [P2] [PRECISION] Show revenue and order count per product to help prioritize catalog management.
-- Implementation: Aggregate OrderItem data per product, display in list and detail views

**A3.15** [P3] [PRECISION] Add translation completeness percentage per product across all 22 locales.
-- Implementation: Query ProductTranslation table, calculate percentage, show in list view

#### ROBUSTNESS (5)

**A3.16** [P1] [ROBUSTNESS] Add unsaved changes detection with browser navigation guard.
-- Implementation: Track dirty state, add `beforeunload` listener, use Next.js router events

**A3.17** [P1] [ROBUSTNESS] Wrap CSV import in a database transaction for atomicity.
-- Implementation: `prisma.$transaction(async (tx) => { /* import all rows */ })`

**A3.18** [P2] [ROBUSTNESS] Add retry logic for failed product saves with conflict resolution.
-- Implementation: Detect 409 Conflict, show diff dialog, let admin choose which version to keep

**A3.19** [P2] [ROBUSTNESS] Validate product data completeness before allowing activation.
-- Implementation: Check required fields (name, slug, price, category, at least one format), prevent `isActive: true` if incomplete

**A3.20** [P3] [ROBUSTNESS] Add import dry-run mode that validates CSV without writing to database.
-- Implementation: Add `?dryRun=true` query param, return validation results without persisting

#### UX (5)

**A3.21** [P1] [UX] Split ProductEditClient (983 lines) into smaller tab components for maintainability.
-- Implementation: Create ProductHeaderTab.tsx, ProductTextsTab.tsx, ProductFormatsTab.tsx

**A3.22** [P2] [UX] Add drag-and-drop product image reordering.
-- Implementation: Use `dnd-kit` library for draggable image thumbnails with sort handle

**A3.23** [P2] [UX] Replace browser `confirm()` with branded Modal component for delete confirmation.
-- Implementation: Use existing Modal component with danger styling

**A3.24** [P3] [UX] Add product comparison view (side-by-side) for similar products.
-- Implementation: Multi-select with "Compare" button, split-screen view

**A3.25** [P3] [UX] Add inline editing for quick property changes (price, stock, active status) directly in the product list.
-- Implementation: Click-to-edit cells with instant save on blur

---
---

# SECTION 4: CATEGORIES
**Files**: `src/app/admin/categories/page.tsx`, Public API: `/api/categories`

## MOCKUP DETECTION
**Verdict: REAL (DB-Connected) but uses PUBLIC API**
The categories admin page fetches data from `/api/categories?includeInactive=true` (the PUBLIC API route), not from a dedicated admin categories API. CRUD operations (create, update, delete) also use the public `/api/categories` and `/api/categories/${id}` routes. This is a security concern as the public API may not enforce admin-level authentication properly. The data is real (from PostgreSQL via Prisma), but the API routing is wrong.

---

### 25 FAILLES (Categories)

#### SECURITY (5+)

**F4.1** [CRITICAL] [SECURITY] All category CRUD operations use the PUBLIC `/api/categories` route instead of an admin-specific route -- the public route may not require admin authentication.
-- File: `src/app/admin/categories/page.tsx:50-80` (fetch, create, update, delete all use `/api/categories`)
-- Impact: Category modifications may be accessible to non-admin users or unauthenticated requests
-- Fix: Create `/api/admin/categories/route.ts` with EMPLOYEE/OWNER auth, migrate all admin calls

**F4.2** [HIGH] [SECURITY] No CSRF protection on category mutations (POST, PUT, DELETE) since they go through the public API.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Cross-site request forgery could delete or modify categories
-- Fix: Add CSRF token validation in admin category routes

**F4.3** [HIGH] [SECURITY] Category page is a client component (`'use client'`) with no server-side auth check -- it relies entirely on the admin layout for protection.
-- File: `src/app/admin/categories/page.tsx:1`
-- Impact: If layout auth check fails or is bypassed, categories page is accessible
-- Fix: Add server-side auth check via middleware or convert to server component wrapper

**F4.4** [MEDIUM] [SECURITY] Slug generation uses client-side logic that could be manipulated to create slugs that conflict with application routes.
-- File: `src/app/admin/categories/page.tsx:118-119` (generateSlug function)
-- Impact: Slugs like "api", "admin", "auth" could create route conflicts
-- Fix: Add reserved slug blacklist, validate on server side

**F4.5** [MEDIUM] [SECURITY] No input sanitization for category name or description -- potential XSS if rendered without escaping.
-- File: `src/app/admin/categories/page.tsx` (create/update handlers)
-- Impact: Stored XSS through category names displayed across the site
-- Fix: Sanitize input server-side, ensure React's default escaping is not bypassed

**F4.6** [LOW] [SECURITY] Category icon field accepts any string -- could be used to inject malicious values if icon names are used in dangerous contexts.
-- File: `src/app/admin/categories/page.tsx` (icon selection)
-- Impact: Low, but unexpected icon values could cause rendering issues
-- Fix: Validate icon against predefined list server-side

#### DATA INTEGRITY (5+)

**F4.7** [HIGH] [DATA INTEGRITY] Deleting a parent category does NOT check for child categories -- orphaned children could be created.
-- File: `src/app/admin/categories/page.tsx` (delete handler)
-- Impact: Child categories become orphaned with invalid parentId references
-- Fix: Either prevent deletion of parent with children, or cascade delete/re-parent children

**F4.8** [HIGH] [DATA INTEGRITY] Deleting a category doesn't check for associated products -- products linked to deleted category lose their category reference.
-- File: `src/app/admin/categories/page.tsx` (delete handler)
-- Impact: Products become uncategorized, storefront navigation breaks
-- Fix: Check for products before delete, show count, require reassignment or prevent deletion

**F4.9** [MEDIUM] [DATA INTEGRITY] No validation that `sortOrder` values are unique within the same parent -- duplicate sort orders cause unpredictable display.
-- File: `src/app/admin/categories/page.tsx` (create/update handlers)
-- Impact: Categories display in random order when sort values collide
-- Fix: Auto-assign next available sort order, or validate uniqueness

**F4.10** [MEDIUM] [DATA INTEGRITY] The `includeInactive=true` parameter is passed to the public API -- if the public API doesn't handle this parameter, inactive categories may be hidden.
-- File: `src/app/admin/categories/page.tsx:50`
-- Impact: Admin may not see all categories, unable to manage inactive ones
-- Fix: Verify public API respects this parameter, or create admin route that always returns all

**F4.11** [LOW] [DATA INTEGRITY] Orphan detection logic (`categories with parentId pointing to missing parent`) only runs in the UI tree builder, not as a data integrity check.
-- File: `src/app/admin/categories/page.tsx:107-112`
-- Impact: Orphaned categories are silently shown as root categories
-- Fix: Add visual indicator for orphaned categories, suggest reassignment

#### BACKEND LOGIC (5)

**F4.12** [HIGH] [BACKEND LOGIC] No dedicated admin categories API exists -- all operations go through the public route, mixing customer-facing and admin functionality.
-- File: Public `/api/categories/` route (used by both storefront and admin)
-- Impact: Auth logic must handle both public read and admin write in same route, increasing complexity and error risk
-- Fix: Create separate `/api/admin/categories` route for admin CRUD

**F4.13** [MEDIUM] [BACKEND LOGIC] Category tree building is done entirely client-side in a `useMemo` -- for large category trees, this could cause UI lag.
-- File: `src/app/admin/categories/page.tsx:80-115`
-- Impact: Slow rendering with hundreds of categories
-- Fix: Build tree server-side, or use virtualized tree component

**F4.14** [MEDIUM] [BACKEND LOGIC] Creating a category generates slug client-side then sends it to server -- there's no server-side slug validation or uniqueness check.
-- File: `src/app/admin/categories/page.tsx:118-119`
-- Impact: Duplicate slugs or invalid characters in slugs
-- Fix: Generate and validate slug server-side

**F4.15** [LOW] [BACKEND LOGIC] Category product count (`_count.products`) is fetched via public API which may not include product counts for inactive products.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Admin sees incomplete product counts
-- Fix: Include all product counts (active + inactive) in admin view

**F4.16** [LOW] [BACKEND LOGIC] No maximum nesting depth validation -- theoretically unlimited parent-child depth could cause stack overflow in tree rendering.
-- File: `src/app/admin/categories/page.tsx:80-115`
-- Impact: Deep nesting could break UI or cause performance issues
-- Fix: Limit nesting to 2-3 levels

#### FRONTEND (5)

**F4.17** [HIGH] [FRONTEND] No loading state shown while categories are being fetched -- page appears empty then suddenly populates.
-- File: `src/app/admin/categories/page.tsx` (no loading skeleton)
-- Impact: Poor UX, admin may think page is broken
-- Fix: Add loading state with skeleton tree component

**F4.18** [MEDIUM] [FRONTEND] No search/filter functionality for categories -- admin must scroll through entire list.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Difficult to find specific categories in large trees
-- Fix: Add search input that filters/highlights matching categories

**F4.19** [MEDIUM] [FRONTEND] No drag-and-drop reordering for categories -- sort order must be edited manually.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Tedious to reorder categories, especially with many items
-- Fix: Add drag-and-drop using `dnd-kit` with sort handle

**F4.20** [LOW] [FRONTEND] Category form modal doesn't show validation errors inline (e.g., required name, valid slug).
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Admin submits invalid data, gets generic error
-- Fix: Add form validation with inline error messages

**F4.21** [LOW] [FRONTEND] No visual indicator of category hierarchy depth in the tree view.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Hard to understand category structure at a glance
-- Fix: Add indentation lines/guides and expand/collapse controls

#### INTEGRATION (5)

**F4.22** [CRITICAL] [INTEGRATION] Admin category mutations use public API which may have different permissions, rate limits, and caching rules than expected by admin workflows.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Unpredictable behavior, possible permission mismatches
-- Fix: Isolate admin category API from public API

**F4.23** [MEDIUM] [INTEGRATION] Category changes don't trigger product page revalidation -- storefront may show stale category navigation.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Category renames/additions not reflected on storefront until rebuild
-- Fix: Call `revalidatePath('/products')` after category mutations

**F4.24** [MEDIUM] [INTEGRATION] Category translations are not manageable from this page -- admin must go to a separate translations section.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Incomplete category management workflow
-- Fix: Add translation tabs within category edit modal

**F4.25** [LOW] [INTEGRATION] No import/export functionality for categories -- migration between environments requires manual recreation.
-- File: `src/app/admin/categories/page.tsx`
-- Impact: Tedious environment setup, risk of inconsistency between dev/staging/prod
-- Fix: Add CSV/JSON import/export for category tree

---

### 25 AMELIORATIONS (Categories)

#### COMPLETENESS (5+)

**A4.1** [P0] [COMPLETENESS] Create dedicated `/api/admin/categories` route with EMPLOYEE/OWNER auth for all CRUD operations.
-- Implementation: New route file mirroring public route but with admin auth middleware

**A4.2** [P1] [COMPLETENESS] Add child category management: prevent deleting parent with children, show child count, expand/collapse.
-- Implementation: Before delete, check `children.length > 0`, show confirmation with child count

**A4.3** [P1] [COMPLETENESS] Add product count with link to filtered product list (click count to see products in category).
-- Implementation: Product count badge links to `/admin/produits?category=${slug}`

**A4.4** [P2] [COMPLETENESS] Add category image/banner management for storefront display.
-- Implementation: Add image upload field in category edit modal, store URL in DB

**A4.5** [P2] [COMPLETENESS] Add category translation management inline (edit translations per locale in modal tabs).
-- Implementation: Add locale tabs in category edit modal, save to CategoryTranslation table

#### PERFORMANCE (5)

**A4.6** [P1] [PERFORMANCE] Build category tree server-side to reduce client-side computation.
-- Implementation: Convert to server component wrapper that fetches and structures tree, pass to client component

**A4.7** [P2] [PERFORMANCE] Cache category tree with revalidation on mutations.
-- Implementation: Use `unstable_cache` with `revalidateTag('categories')`, call `revalidateTag` on create/update/delete

**A4.8** [P2] [PERFORMANCE] Add virtual tree rendering for large category hierarchies.
-- Implementation: Use `react-arborist` or similar virtual tree library

**A4.9** [P3] [PERFORMANCE] Lazy-load child categories on expand instead of loading entire tree.
-- Implementation: Fetch children on expand click, cache expanded state

**A4.10** [P3] [PERFORMANCE] Batch sort order updates into single API call when reordering.
-- Implementation: Collect all changed sortOrders, send as array in single PUT request

#### PRECISION (5)

**A4.11** [P1] [PRECISION] Validate slug uniqueness and format (lowercase, hyphens only) server-side.
-- Implementation: Check `await prisma.category.findFirst({ where: { slug } })` before create/update

**A4.12** [P1] [PRECISION] Validate parent-child relationships to prevent circular references.
-- Implementation: Check that new parentId is not a descendant of current category

**A4.13** [P2] [PRECISION] Show active vs total product counts separately.
-- Implementation: Two counts: `_count: { products: { where: { isActive: true } } }` and total

**A4.14** [P2] [PRECISION] Add SEO fields (meta title, meta description) to category management.
-- Implementation: Add metaTitle, metaDescription fields to Category model and edit form

**A4.15** [P3] [PRECISION] Show category URL preview based on slug hierarchy.
-- Implementation: Build full path like `/products/peptides/bpc-157` from parent chain

#### ROBUSTNESS (5)

**A4.16** [P1] [ROBUSTNESS] Add confirmation dialog for category deletion showing affected products count.
-- Implementation: Before delete, fetch product count, show "This category has X products" warning

**A4.17** [P1] [ROBUSTNESS] Add error handling with toast notifications for CRUD failures.
-- Implementation: Wrap API calls in try/catch, show `toast.error()` with specific messages

**A4.18** [P2] [ROBUSTNESS] Prevent deletion of categories that have products without reassignment.
-- Implementation: Require target category selection for product reassignment before allowing delete

**A4.19** [P2] [ROBUSTNESS] Add reserved slug blacklist (api, admin, auth, dashboard, etc.).
-- Implementation: Server-side validation against blacklist array

**A4.20** [P3] [ROBUSTNESS] Add undo/restore for recently deleted categories (soft delete with 30-day retention).
-- Implementation: Add `deletedAt` field, filter out in public queries, show in admin "trash"

#### UX (5)

**A4.21** [P1] [UX] Add search/filter input for category tree.
-- Implementation: Filter matching categories, highlight matches, auto-expand parent nodes

**A4.22** [P2] [UX] Add drag-and-drop reordering and reparenting.
-- Implementation: Use `dnd-kit` with tree adapter for visual drag-and-drop

**A4.23** [P2] [UX] Add expand/collapse all button for tree navigation.
-- Implementation: Track expanded state per node, add "Expand All" / "Collapse All" buttons

**A4.24** [P3] [UX] Add color/icon preview in category list.
-- Implementation: Show icon + color swatch next to category name in tree

**A4.25** [P3] [UX] Add keyboard navigation for tree (arrow keys to navigate, Enter to edit, Delete to remove).
-- Implementation: Add `onKeyDown` handler to tree nodes with focus management

---
---

# SECTION 5: INVENTAIRE (Inventory)
**Files**: `src/app/admin/inventaire/page.tsx`, `src/app/api/admin/inventory/route.ts`, `src/app/api/admin/inventory/export/route.ts`, `src/app/api/admin/inventory/history/route.ts`

## MOCKUP DETECTION
**Verdict: MIXED -- Main list is REAL, History modal is MOCKUP**
The inventory list fetches live data from `/api/admin/inventory` which queries `ProductFormat` with real stock quantities via Prisma. The export CSV is functional and connected to real data. **However, the History modal (lines 419-441) displays HARDCODED fake data** (+10, -2, -1, +50 with static text like "2 days ago", "30 days ago") instead of fetching from the existing `/api/admin/inventory/history` API endpoint. The stock update function calls a NON-EXISTENT endpoint (`PATCH /api/admin/inventory/${id}`) -- there is no `[id]` dynamic route or PATCH handler in the inventory API.

---

### 25 FAILLES (Inventaire)

#### SECURITY (5+)

**F5.1** [HIGH] [SECURITY] No CSRF protection on inventory mutations (POST for receiving stock, PUT for adjustments).
-- File: `src/app/api/admin/inventory/route.ts`
-- Impact: Cross-site request forgery could manipulate stock quantities
-- Fix: Add CSRF token validation to POST and PUT handlers

**F5.2** [MEDIUM] [SECURITY] Inventory adjustment `PUT` accepts any reason string without validation -- no predefined reason codes for auditing.
-- File: `src/app/api/admin/inventory/route.ts` (PUT handler)
-- Impact: Weak audit trail, no standardized reason categorization
-- Fix: Add predefined reason enum (ADJUSTMENT, DAMAGE, THEFT, COUNT_CORRECTION, etc.)

**F5.3** [MEDIUM] [SECURITY] No audit trail linking inventory changes to the admin user who made them.
-- File: `src/app/api/admin/inventory/route.ts`
-- Impact: No accountability for stock manipulations
-- Fix: Add `performedBy` field to InventoryTransaction, populate from session.user.id

**F5.4** [MEDIUM] [SECURITY] Raw SQL query in GET handler (`$queryRaw`) could be vulnerable if parameters are interpolated unsafely.
-- File: `src/app/api/admin/inventory/route.ts` (WAC query)
-- Impact: Potential SQL injection if query construction changes
-- Fix: Verify all parameters use Prisma tagged template literals, not string interpolation

**F5.5** [LOW] [SECURITY] Inventory export CSV has no access control beyond basic auth -- any EMPLOYEE can export full inventory data.
-- File: `src/app/api/admin/inventory/export/route.ts`
-- Impact: Sensitive cost/pricing data accessible to all admin-level users
-- Fix: Restrict export to OWNER role, or add granular permissions

#### DATA INTEGRITY (5+)

**F5.6** [CRITICAL] [DATA INTEGRITY] Stock update calls `PATCH /api/admin/inventory/${id}` but NO such endpoint exists -- the API only has GET, POST, and PUT on the collection route, with no `[id]` dynamic route. Every stock adjustment from the UI silently fails.
-- File: `src/app/admin/inventaire/page.tsx:123` vs `src/app/api/admin/inventory/route.ts`
-- Impact: BROKEN FUNCTIONALITY: Admin cannot adjust stock from inventory page
-- Fix: Either create `[id]/route.ts` with PATCH handler, or change frontend to use PUT on collection route

**F5.7** [HIGH] [DATA INTEGRITY] After a failed stock update, the UI optimistically updates local state (line 128-136), showing the new quantity even though the save failed.
-- File: `src/app/admin/inventaire/page.tsx:128-136`
-- Impact: Admin sees incorrect stock quantities, leading to wrong business decisions
-- Fix: Only update local state after confirming API success (check `res.ok`)

**F5.8** [HIGH] [DATA INTEGRITY] PUT handler for stock adjustment doesn't use a database transaction -- the stock update and inventory transaction record could become inconsistent.
-- File: `src/app/api/admin/inventory/route.ts` (PUT handler)
-- Impact: Stock quantity updated but transaction history missing, or vice versa
-- Fix: Wrap stock update + transaction creation in `prisma.$transaction`

**F5.9** [MEDIUM] [DATA INTEGRITY] No concurrent edit protection -- two admins could adjust the same format simultaneously, with last-write-wins overwriting the other's change.
-- File: `src/app/api/admin/inventory/route.ts`
-- Impact: Stock discrepancies from concurrent edits
-- Fix: Use optimistic locking (version field) or `increment/decrement` operations

**F5.10** [MEDIUM] [DATA INTEGRITY] No validation that stock cannot go negative -- admin could set stock to any value including negative.
-- File: `src/app/api/admin/inventory/route.ts` (PUT handler)
-- Impact: Negative stock quantities create accounting impossibilities
-- Fix: Add `if (newQuantity < 0) return error('Stock cannot be negative')`

**F5.11** [MEDIUM] [DATA INTEGRITY] WAC (Weighted Average Cost) calculation uses raw SQL DISTINCT ON which is PostgreSQL-specific -- could break if database changes.
-- File: `src/app/api/admin/inventory/route.ts` (GET handler WAC query)
-- Impact: Not portable to other databases, may fail silently if query returns unexpected results
-- Fix: Document PostgreSQL dependency, add fallback calculation

#### BACKEND LOGIC (5)

**F5.12** [CRITICAL] [BACKEND LOGIC] The frontend calls `PATCH` method but the API route only exports `GET`, `POST`, and `PUT` -- and furthermore, the frontend targets `/api/admin/inventory/${id}` (dynamic route) while the API is at `/api/admin/inventory/` (collection route). Double mismatch.
-- File: `src/app/admin/inventaire/page.tsx:123-124` vs `src/app/api/admin/inventory/route.ts`
-- Impact: 404 Not Found response for every stock adjustment attempt
-- Fix: Create `/api/admin/inventory/[id]/route.ts` with PATCH handler

**F5.13** [HIGH] [BACKEND LOGIC] Import CSV button has no onClick handler -- it renders but does nothing.
-- File: `src/app/admin/inventaire/page.tsx` (import button)
-- Impact: Admin cannot bulk import inventory data
-- Fix: Add file input handler connected to `/api/admin/inventory/import` endpoint

**F5.14** [MEDIUM] [BACKEND LOGIC] History modal shows hardcoded fake data instead of fetching from the existing `/api/admin/inventory/history` endpoint.
-- File: `src/app/admin/inventaire/page.tsx:419-441`
-- Impact: Admin sees false history data, cannot verify actual stock movements
-- Fix: Fetch from `/api/admin/inventory/history?formatId=${showHistory}` and render real data

**F5.15** [MEDIUM] [BACKEND LOGIC] No pagination in inventory list -- all formats are fetched in one request.
-- File: `src/app/api/admin/inventory/route.ts` (GET handler)
-- Impact: Slow response with thousands of product formats
-- Fix: Add page/limit query params to GET handler

**F5.16** [LOW] [BACKEND LOGIC] Stock receive (POST) doesn't update the format's `availability` field -- a format at 0 stock that receives new stock remains "OUT_OF_STOCK".
-- File: `src/app/api/admin/inventory/route.ts` (POST handler)
-- Impact: Format shows as out of stock on storefront even after restocking
-- Fix: Update availability to 'IN_STOCK' when stock goes above 0

#### FRONTEND (5)

**F5.17** [HIGH] [FRONTEND] The adjustment reason floating panel appears when editing but doesn't enforce the reason before save -- admin can save without entering a reason.
-- File: `src/app/admin/inventaire/page.tsx:400-411`
-- Impact: Inventory adjustments recorded without explanation, weak audit trail
-- Fix: Validate `adjustmentReason.trim() !== ''` before allowing save, disable save button

**F5.18** [MEDIUM] [FRONTEND] No error feedback to admin when stock update fails -- errors are only logged to console.
-- File: `src/app/admin/inventaire/page.tsx:138`
-- Impact: Admin thinks stock was updated but it wasn't
-- Fix: Add `toast.error()` in catch block

**F5.19** [MEDIUM] [FRONTEND] Stock quantity input allows typing any value without validation -- no min/max constraints.
-- File: `src/app/admin/inventaire/page.tsx` (inline editing)
-- Impact: Admin could enter negative numbers or extremely large values
-- Fix: Add `min={0}` to number input, validate before submit

**F5.20** [LOW] [FRONTEND] Low stock threshold filter comparison uses `item.lowStockThreshold` from API but this field may not be present on all items.
-- File: `src/app/admin/inventaire/page.tsx:157`
-- Impact: Filter may not work correctly for items without threshold
-- Fix: Add fallback: `item.lowStockThreshold || 10`

**F5.21** [LOW] [FRONTEND] No visual distinction between manual adjustments and system-generated transactions (sales, refunds) in the (fake) history.
-- File: `src/app/admin/inventaire/page.tsx:419-441`
-- Impact: Admin can't understand context of stock movements
-- Fix: Add transaction type icons/badges when real history is implemented

#### INTEGRATION (5)

**F5.22** [CRITICAL] [INTEGRATION] The history API endpoint exists (`/api/admin/inventory/history`) and works correctly, but the frontend completely ignores it and shows hardcoded data.
-- File: `src/app/admin/inventaire/page.tsx:419-441` vs `src/app/api/admin/inventory/history/route.ts`
-- Impact: Fully functional backend wasted; admin sees fake data
-- Fix: Replace hardcoded history with `fetch('/api/admin/inventory/history?formatId=${id}')` call

**F5.23** [HIGH] [INTEGRATION] Inventory page doesn't reflect changes from order processing, refunds, or reship -- it only shows the current stock snapshot without context.
-- File: `src/app/admin/inventaire/page.tsx`
-- Impact: Admin lacks understanding of why stock changed
-- Fix: Connect history modal to real data showing all transaction sources

**F5.24** [MEDIUM] [INTEGRATION] No real-time updates when stock changes from orders or other admin actions -- page shows stale data until manual refresh.
-- File: `src/app/admin/inventaire/page.tsx`
-- Impact: Multiple admins may make decisions based on stale stock data
-- Fix: Add auto-refresh every 30 seconds, or WebSocket for real-time updates

**F5.25** [MEDIUM] [INTEGRATION] Inventory export doesn't include WAC (Weighted Average Cost) data even though it's calculated in the GET endpoint.
-- File: `src/app/api/admin/inventory/export/route.ts`
-- Impact: Exported CSV lacks cost data needed for financial reporting
-- Fix: Include WAC column in CSV export

---

### 25 AMELIORATIONS (Inventaire)

#### COMPLETENESS (5+)

**A5.1** [P0] [COMPLETENESS] Create `/api/admin/inventory/[id]/route.ts` with PATCH handler for individual stock adjustments.
-- Implementation: New route file, extract formatId from params, validate, update stock + create transaction in $transaction

**A5.2** [P0] [COMPLETENESS] Connect history modal to real `/api/admin/inventory/history` API instead of hardcoded data.
-- Implementation: On modal open, `fetch('/api/admin/inventory/history?formatId=${id}')`, render response data

**A5.3** [P1] [COMPLETENESS] Implement Import CSV functionality with file upload, validation, and batch processing.
-- Implementation: Create `/api/admin/inventory/import` route, connect file input, process CSV rows in transaction

**A5.4** [P1] [COMPLETENESS] Add stock receive form (modal) with batch capabilities: multiple formats, unit cost, supplier reference.
-- Implementation: Modal with format selector, quantity/cost inputs, save via POST to inventory API

**A5.5** [P2] [COMPLETENESS] Add inventory count feature (physical count reconciliation with variance report).
-- Implementation: "Start Count" workflow: freeze expected, enter actual, calculate variance, apply adjustments

#### PERFORMANCE (5)

**A5.6** [P1] [PERFORMANCE] Add server-side pagination to inventory API and frontend.
-- Implementation: Add `page`/`limit` params to GET handler, update frontend with pagination controls

**A5.7** [P2] [PERFORMANCE] Cache WAC calculations with short TTL to avoid raw SQL query on every page load.
-- Implementation: Use in-memory cache or Redis for WAC values, invalidate on stock changes

**A5.8** [P2] [PERFORMANCE] Debounce search filter to reduce client-side filtering frequency.
-- Implementation: Add `useDebouncedValue(search, 300)` before filtering

**A5.9** [P3] [PERFORMANCE] Use virtual scrolling for large inventory lists.
-- Implementation: Replace standard list with `@tanstack/react-virtual` for virtualized rows

**A5.10** [P3] [PERFORMANCE] Implement incremental stock updates using `prisma.productFormat.update({ data: { stockQuantity: { increment: delta } } })` instead of absolute values.
-- Implementation: Calculate delta from old quantity, use Prisma increment operator

#### PRECISION (5)

**A5.11** [P1] [PRECISION] Add low stock alerts with configurable thresholds per format.
-- Implementation: Use `lowStockThreshold` from each format, highlight items below threshold with distinct color

**A5.12** [P1] [PRECISION] Calculate and display days of stock remaining based on recent sales velocity.
-- Implementation: Average daily sales from last 30 days, divide current stock by velocity

**A5.13** [P2] [PRECISION] Add stock valuation summary (total inventory value at WAC).
-- Implementation: Sum `stockQuantity * WAC` across all formats, display as stat card

**A5.14** [P2] [PRECISION] Show stock movement trends (chart of stock in/out over last 30 days).
-- Implementation: Aggregate InventoryTransaction by day, render as line/bar chart

**A5.15** [P3] [PRECISION] Add reorder point calculation and automated purchase order suggestions.
-- Implementation: When stock approaches `lowStockThreshold`, suggest reorder quantity based on lead time and velocity

#### ROBUSTNESS (5)

**A5.16** [P1] [ROBUSTNESS] Enforce adjustment reason before allowing stock changes.
-- Implementation: Disable save button when `adjustmentReason.trim() === ''`, show validation message

**A5.17** [P1] [ROBUSTNESS] Add error toasts for failed API calls instead of silent console.error.
-- Implementation: `toast.error(t('admin.inventory.updateError'))` in catch blocks

**A5.18** [P2] [ROBUSTNESS] Add optimistic locking to prevent concurrent edit conflicts.
-- Implementation: Add `version` field to ProductFormat, send version with update, reject if mismatch

**A5.19** [P2] [ROBUSTNESS] Validate stock quantity bounds (min 0, max 99999) on both client and server.
-- Implementation: Client-side `min={0} max={99999}` on input, server-side validation in API

**A5.20** [P3] [ROBUSTNESS] Add undo capability for recent stock adjustments (within 5 minutes).
-- Implementation: Show "Undo" toast after adjustment, reverse adjustment on click

#### UX (5)

**A5.21** [P1] [UX] Add batch stock receive mode: scan barcode / enter SKU, auto-populate format, enter quantity.
-- Implementation: Scanner-friendly input that resolves SKU to format, auto-advances to next

**A5.22** [P2] [UX] Add stock alerts dashboard section showing items needing attention (low stock, out of stock, negative).
-- Implementation: Filter and sort formats by urgency, display as priority list with action buttons

**A5.23** [P2] [UX] Add sparkline charts showing stock level trends in the inventory table.
-- Implementation: Mini line chart per row showing last 30 days of stock levels

**A5.24** [P3] [UX] Add keyboard shortcuts for quick stock adjustments (+ and - keys for increment/decrement).
-- Implementation: When row is focused, +/- keys adjust quantity by 1, Shift+/- by 10

**A5.25** [P3] [UX] Add color-coded stock status indicators (green=OK, yellow=low, red=out, gray=discontinued).
-- Implementation: Status dot/badge based on threshold comparison, animate low stock

---
---

# SECTION 6: CLIENTS / CUSTOMERS
**Files**: `src/app/admin/clients/page.tsx`, `src/app/admin/clients/[id]/page.tsx`, `src/app/admin/customers/page.tsx`, `src/app/admin/customers/[id]/page.tsx`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/admin/users/[id]/points/route.ts`

## MOCKUP DETECTION
**Verdict: REAL (DB-Connected) with Non-Functional Action Buttons**
Both client and customer pages fetch live user data from `/api/admin/users` with role filtering. The user detail pages fetch comprehensive 360-degree data (orders, addresses, cards, loyalty, subscriptions, reviews, conversations). The loyalty points adjustment is functional via the points API. **However, the following buttons are non-functional placeholders**: Export CSV (no onClick), Send Email (no onClick), Reset Password (no onClick), Suspend/Block User (no onClick). Additionally, `customers/[id]/page.tsx` and `clients/[id]/page.tsx` are **near-identical duplicates** (1278 lines each), differing only in redirect URLs.

---

### 25 FAILLES (Clients/Customers)

#### SECURITY (5+)

**F6.1** [HIGH] [SECURITY] Users API returns 401 (Unauthorized) instead of 403 (Forbidden) for authenticated non-admin users, and returns hardcoded French error message "Non autorise".
-- File: `src/app/api/admin/users/route.ts:11`
-- Impact: Incorrect HTTP status code; untranslated error message
-- Fix: Return 403 with English error `{ error: 'Forbidden' }` consistent with other admin routes

**F6.2** [HIGH] [SECURITY] Error response in users API returns empty `{ users: [] }` instead of error status -- clients may not know their request failed.
-- File: `src/app/api/admin/users/route.ts:68`
-- Impact: API errors silently return empty data instead of error codes
-- Fix: Return `{ error: 'Internal server error' }` with status 500

**F6.3** [MEDIUM] [SECURITY] No CSRF validation on loyalty points adjustment endpoint (POST).
-- File: `src/app/api/admin/users/[id]/points/route.ts`
-- Impact: Cross-site request forgery could award/remove loyalty points
-- Fix: Add CSRF middleware to POST handler

**F6.4** [MEDIUM] [SECURITY] Users PATCH endpoint has CSRF validation but GET does not validate referer -- information disclosure via CSRF.
-- File: `src/app/api/admin/users/[id]/route.ts`
-- Impact: User data could be exfiltrated via cross-site GET requests
-- Fix: Validate referer/origin on all admin API endpoints

**F6.5** [MEDIUM] [SECURITY] User detail API exposes sensitive data including payment card details (last4, brand, expMonth, expYear) and full address.
-- File: `src/app/api/admin/users/[id]/route.ts` (GET handler includes cards and addresses)
-- Impact: PII exposure to any admin user regardless of role granularity
-- Fix: Add field-level access control, restrict card/address access to OWNER only

**F6.6** [LOW] [SECURITY] Points adjustment has no maximum cap -- admin could award millions of loyalty points.
-- File: `src/app/api/admin/users/[id]/points/route.ts`
-- Impact: Point abuse could have financial implications for loyalty rewards
-- Fix: Add reasonable per-adjustment limit (e.g., max 10000 points) and daily cap

#### DATA INTEGRITY (5+)

**F6.7** [CRITICAL] [DATA INTEGRITY] Users API has N+1 query problem: fetches ALL users then runs individual `prisma.order.aggregate` for EACH user to calculate `totalSpent`. With 10,000 users, this means 10,001 database queries.
-- File: `src/app/api/admin/users/route.ts:52-63`
-- Impact: Extreme performance degradation, potential timeout with large user base
-- Fix: Use a single subquery or JOIN to calculate totalSpent, or add `totalSpent` as a cached field on User model

**F6.8** [HIGH] [DATA INTEGRITY] No pagination in users API -- all users are fetched in a single request regardless of count.
-- File: `src/app/api/admin/users/route.ts:29` (no `take`/`skip`)
-- Impact: Memory exhaustion and timeout with thousands of users
-- Fix: Add `page`/`limit` query params with default limit of 50

**F6.9** [HIGH] [DATA INTEGRITY] `customers/[id]/page.tsx` and `clients/[id]/page.tsx` are near-identical 1278-line duplicates -- code divergence over time will create inconsistent behavior.
-- File: `src/app/admin/customers/[id]/page.tsx` vs `src/app/admin/clients/[id]/page.tsx`
-- Impact: Bug fixes applied to one copy but not the other; maintenance nightmare
-- Fix: Extract shared UserDetailPage component, use it from both routes with config prop

**F6.10** [MEDIUM] [DATA INTEGRITY] Loyalty points adjustment doesn't validate that the admin is adjusting points for a user of the expected role (CLIENT vs CUSTOMER).
-- File: `src/app/api/admin/users/[id]/points/route.ts`
-- Impact: Admin on clients page could accidentally adjust a CUSTOMER's points
-- Fix: Validate user role matches expected context, or make points route role-agnostic (it already is)

**F6.11** [MEDIUM] [DATA INTEGRITY] User detail API wraps optional table queries (conversations, subscriptions, reviews) in individual try/catch blocks, returning empty arrays on failure -- errors are silently swallowed.
-- File: `src/app/api/admin/users/[id]/route.ts` (multiple try/catch blocks)
-- Impact: Missing data goes unnoticed; admin sees empty sections when data exists but query fails
-- Fix: Log errors with detail level, show "Error loading section" indicator on frontend

**F6.12** [LOW] [DATA INTEGRITY] The `_count.purchases` field name in the API response differs from the Prisma relation name `purchases` which is actually `Order[]` -- naming could be confusing.
-- File: `src/app/api/admin/users/route.ts:45`
-- Impact: Minor naming inconsistency between API and schema
-- Fix: Rename to `_count: { orders: true }` for clarity

#### BACKEND LOGIC (5)

**F6.13** [HIGH] [BACKEND LOGIC] The clients page stats calculate employees and other roles even though it filters by `role=CLIENT` -- the stats show total users of all roles, not just clients.
-- File: `src/app/admin/clients/page.tsx` (stats calculation from all fetched users)
-- Impact: Misleading statistics showing employee counts on clients page
-- Fix: Filter stats calculation to match page role, or fetch role-specific stats from API

**F6.14** [HIGH] [BACKEND LOGIC] User search in API uses `OR` with `name` and `email` contains but doesn't search by phone number, company, or loyalty ID.
-- File: `src/app/api/admin/users/route.ts:22-26`
-- Impact: Admin can't find users by phone or company name
-- Fix: Extend OR clause to include phone, company name

**F6.15** [MEDIUM] [BACKEND LOGIC] Currency symbol `$` is hardcoded in the clients list for `totalSpent` display.
-- File: `src/app/admin/clients/page.tsx:208`
-- Impact: Wrong currency display for non-CAD users
-- Fix: Use user's preferred currency or system default with Intl.NumberFormat

**F6.16** [MEDIUM] [BACKEND LOGIC] The user detail page (7 tabs, 1278 lines) fetches ALL tab data upfront even though only one tab is visible at a time.
-- File: `src/app/admin/clients/[id]/page.tsx`
-- Impact: Large API response and slow page load for data that may never be viewed
-- Fix: Lazy-load tab content on tab switch

**F6.17** [LOW] [BACKEND LOGIC] The PATCH handler whitelists update fields but doesn't validate field values -- e.g., `loyaltyTier` could be set to any string.
-- File: `src/app/api/admin/users/[id]/route.ts` (PATCH handler)
-- Impact: Invalid tier values could break loyalty logic
-- Fix: Validate loyaltyTier against enum values (BRONZE, SILVER, GOLD, PLATINUM, DIAMOND)

#### FRONTEND (5+)

**F6.18** [HIGH] [FRONTEND] Export button has no onClick handler -- renders but clicking does nothing.
-- File: `src/app/admin/clients/page.tsx:248-250`
-- Impact: Admin cannot export client/customer list
-- Fix: Create export endpoint and connect button

**F6.19** [HIGH] [FRONTEND] "Send Email", "Reset Password", and "Suspend User" buttons in the client detail modal have no onClick handlers.
-- File: `src/app/admin/clients/page.tsx` (action buttons in user management section)
-- Impact: Critical admin functions are non-functional placeholders
-- Fix: Implement each action with proper API endpoints

**F6.20** [MEDIUM] [FRONTEND] Block/Unblock user button on user detail page has no functionality.
-- File: `src/app/admin/clients/[id]/page.tsx`
-- Impact: Admin cannot block abusive users
-- Fix: Add user blocking API (set `isBlocked: true`), update login flow to check

**F6.21** [MEDIUM] [FRONTEND] The clients page (424 lines) and customers page (240 lines) share 90% of the same logic but are separate files.
-- File: `src/app/admin/clients/page.tsx` vs `src/app/admin/customers/page.tsx`
-- Impact: Code duplication, divergent behavior over time
-- Fix: Create shared UserListPage component with role prop

**F6.22** [LOW] [FRONTEND] Date formatting uses `toLocaleDateString(locale)` but i18n locale codes (e.g., `ar-dz`) may not be valid Intl locale identifiers.
-- File: `src/app/admin/clients/page.tsx:218`
-- Impact: Date formatting could fail or show incorrect format for some locales
-- Fix: Map i18n locale codes to valid Intl locale identifiers

#### INTEGRATION (5)

**F6.23** [HIGH] [INTEGRATION] The N+1 totalSpent query runs for EVERY page load, even when the page hasn't changed -- no caching or optimization.
-- File: `src/app/api/admin/users/route.ts:52-63`
-- Impact: DB load scales linearly with user count on every page view
-- Fix: Cache totalSpent on User model, update on order payment, or use SQL subquery

**F6.24** [MEDIUM] [INTEGRATION] User detail tabs (subscriptions, reviews, wishlist) fetch data from tables that may not have been migrated -- individual try/catch blocks suggest schema uncertainty.
-- File: `src/app/api/admin/users/[id]/route.ts` (multiple try/catch)
-- Impact: Fragile integration; tables may exist in some environments but not others
-- Fix: Verify all tables exist in schema, remove try/catch for confirmed tables

**F6.25** [MEDIUM] [INTEGRATION] No integration between user management and email system -- "Send Email" button exists but no email sending infrastructure is connected.
-- File: `src/app/admin/clients/page.tsx` (Send Email button)
-- Impact: Key communication channel is non-functional
-- Fix: Integrate with email service (sendOrderLifecycleEmail or generic send function)

---

### 25 AMELIORATIONS (Clients/Customers)

#### COMPLETENESS (5+)

**A6.1** [P0] [COMPLETENESS] Extract shared UserDetailPage component to eliminate 1278-line duplication between clients/[id] and customers/[id].
-- Implementation: Create `src/app/admin/_shared/UserDetailPage.tsx`, import from both routes with `role` and `backUrl` props

**A6.2** [P0] [COMPLETENESS] Extract shared UserListPage component to eliminate duplication between clients and customers list pages.
-- Implementation: Create `src/app/admin/_shared/UserListPage.tsx` with `role` prop

**A6.3** [P1] [COMPLETENESS] Implement Export CSV functionality for user lists.
-- Implementation: Create `/api/admin/users/export?role=CLIENT` endpoint, generate CSV, trigger download

**A6.4** [P1] [COMPLETENESS] Implement Send Email action with template selection.
-- Implementation: Create `/api/admin/users/[id]/email` POST endpoint, connect to email service

**A6.5** [P1] [COMPLETENESS] Implement Block/Suspend user functionality.
-- Implementation: Add `isBlocked` field to User model, PATCH endpoint to set it, login check

#### PERFORMANCE (5+)

**A6.6** [P0] [PERFORMANCE] Fix N+1 query: replace individual `order.aggregate` per user with a single SQL subquery or pre-computed `totalSpent` field.
-- Implementation: Option A: Use `$queryRaw` with subquery. Option B: Add `totalSpent` as computed/cached field on User model, update on payment webhook

**A6.7** [P1] [PERFORMANCE] Add server-side pagination to users API with `page`/`limit` params.
-- Implementation: Add `take: limit, skip: (page - 1) * limit` to findMany, return `{ users, pagination: { page, limit, total, totalPages } }`

**A6.8** [P2] [PERFORMANCE] Lazy-load user detail tabs -- only fetch tab data when tab is selected.
-- Implementation: Split API into `/api/admin/users/[id]/orders`, `/api/admin/users/[id]/loyalty`, etc., fetch on tab click

**A6.9** [P2] [PERFORMANCE] Add debounced search with server-side filtering instead of client-side.
-- Implementation: Pass search param to API, use `useDebouncedValue(search, 300)`

**A6.10** [P3] [PERFORMANCE] Add search indexing for user full-text search (phone, company, order number).
-- Implementation: Add PostgreSQL full-text search index on user name, email, phone fields

#### PRECISION (5)

**A6.11** [P1] [PRECISION] Fix role-specific stats to only show relevant metrics per page (clients page shows client stats, customers page shows customer stats).
-- Implementation: Filter stats calculation by fetched users' roles, remove cross-role metrics

**A6.12** [P1] [PRECISION] Use proper currency formatting based on user's currency preference.
-- Implementation: Use `Intl.NumberFormat(locale, { style: 'currency', currency: user.currency || 'CAD' })`

**A6.13** [P2] [PRECISION] Add customer lifetime value (CLV) calculation based on purchase history and frequency.
-- Implementation: Calculate average purchase value x purchase frequency x customer lifespan

**A6.14** [P2] [PRECISION] Add activity timeline showing user's interactions (orders, reviews, support tickets, logins).
-- Implementation: Aggregate events from multiple tables, sort by date, display as timeline

**A6.15** [P3] [PRECISION] Add loyalty tier progression indicator showing points needed for next tier.
-- Implementation: Calculate `pointsToNextTier = tierThreshold - currentLifetimePoints`, show as progress bar

#### ROBUSTNESS (5)

**A6.16** [P1] [ROBUSTNESS] Add proper error responses (500 with error object) instead of returning empty `{ users: [] }` on failure.
-- Implementation: Change catch block to `return NextResponse.json({ error: 'Internal server error' }, { status: 500 })`

**A6.17** [P1] [ROBUSTNESS] Add tier value validation in PATCH handler to prevent invalid loyalty tier assignments.
-- Implementation: Validate against enum: `['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']`

**A6.18** [P2] [ROBUSTNESS] Add confirmation dialog before destructive actions (block, suspend, delete user).
-- Implementation: Use Modal component with warning text, require confirmation

**A6.19** [P2] [ROBUSTNESS] Handle i18n locale mapping to Intl locale codes for date formatting.
-- Implementation: Create locale mapping object: `{ 'ar-dz': 'ar-DZ', 'ar-lb': 'ar-LB', ... }`

**A6.20** [P3] [ROBUSTNESS] Add request timeout and abort for user detail API calls.
-- Implementation: Use AbortController with 10s timeout, show "Request timed out" message

#### UX (5)

**A6.21** [P1] [UX] Add inline user quick-view on hover/click without navigating to detail page.
-- Implementation: Popover card showing key user info (name, email, tier, last order) on hover

**A6.22** [P2] [UX] Add bulk actions: bulk email, bulk tier change, bulk export selected.
-- Implementation: Checkbox selection, bulk action dropdown, batch API endpoints

**A6.23** [P2] [UX] Add user activity indicators (active in last 7 days, last 30 days, inactive).
-- Implementation: Calculate from lastLoginAt or lastOrderDate, show as colored dot

**A6.24** [P3] [UX] Add customer notes/tags system for CRM-like functionality.
-- Implementation: Add `adminNotes` and `tags` fields to User model, display in detail view

**A6.25** [P3] [UX] Add user impersonation for debugging (login as user to see their experience).
-- Implementation: OWNER-only "Login As" button that creates a temporary session with user's perspective

---
---

# CROSS-CUTTING SUMMARY

## Critical Issues Across All Sections (Fix Immediately)

| # | Issue | Impact | Sections |
|---|-------|--------|----------|
| 1 | **PATCH/PUT HTTP method mismatch** -- frontend calls PATCH but API only has PUT/POST | Status updates and tracking updates silently fail (405) | Commandes, Inventaire |
| 2 | **N+1 query on users totalSpent** -- individual aggregate per user | Performance degrades linearly with user count | Clients/Customers |
| 3 | **Admin operations use public API routes** -- product CRUD and category CRUD go through public endpoints | Potential auth bypass, inconsistent security model | Produits, Categories |
| 4 | **Inventory history shows HARDCODED fake data** -- despite functional history API existing | Admins see false information, cannot audit stock movements | Inventaire |
| 5 | **Inventory stock update targets non-existent endpoint** -- `PATCH /api/admin/inventory/${id}` returns 404 | Stock adjustments from admin UI are completely broken | Inventaire |
| 6 | **No CSRF protection** on most admin mutation endpoints | Cross-site forgery could trigger refunds, stock changes, user modifications | All sections |
| 7 | **No pagination** on users API and products server fetch | Memory/performance issues with large datasets | Produits, Clients/Customers |
| 8 | **1278-line code duplication** between clients/[id] and customers/[id] | Maintenance nightmare, inconsistent bug fixes | Clients/Customers |
| 9 | **Non-functional buttons** (Export CSV, Send Email, Print, Reset Password, Block User) | Admin features are placeholders that deceive users | Commandes, Clients/Customers |
| 10 | **Revenue calculation includes cancelled/refunded orders** | Financial reporting is inaccurate | Dashboard |

## Mockup Detection Summary

| Section | Verdict | Details |
|---------|---------|---------|
| Dashboard | **REAL** | All data from Prisma, no mocks |
| Commandes | **REAL but BROKEN** | Data is real, status/tracking updates fail due to PATCH/PUT mismatch |
| Produits | **REAL** | Data is real, uses public API routes (security concern) |
| Categories | **REAL** | Data is real, uses public API routes (security concern) |
| Inventaire | **MIXED** | List is real, history modal is HARDCODED MOCKUP, stock update is BROKEN |
| Clients/Customers | **REAL** | Data is real, several action buttons are non-functional placeholders |

## Total Findings

- **150 FAILLES** identified (25 per section x 6 sections)
- **150 AMELIORATIONS** proposed (25 per section x 6 sections)
- **3 CRITICAL broken integrations** (orders PATCH, inventory PATCH, inventory history mockup)
- **6 non-functional UI elements** identified across sections
- **2 major code duplication issues** (clients/customers pages)

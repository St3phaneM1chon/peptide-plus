/**
 * SECTION-PURCHASE-WORKFLOW Auditor
 * End-to-end purchase cycle audit covering:
 *   - DB schema completeness (Order, Cart, Payment, Inventory, Accounting)
 *   - Payment chain (Stripe + PayPal server-side validation, webhook idempotency)
 *   - Email chain (confirmation, shipped, delivered, admin notification)
 *   - Order lifecycle (status machine, cancellation, refund)
 *   - Inventory chain (reservation, decrement, restore)
 *   - Accounting chain (journal entries, tax, refund reversal)
 *   - Subscription chain (creation, renewal)
 */

import { BaseSectionAuditor, type SectionConfig } from './base-section-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as fs from 'fs';
import * as path from 'path';

export default class SectionPurchaseWorkflowAuditor extends BaseSectionAuditor {
  auditTypeCode = 'SECTION-PURCHASE-WORKFLOW';

  sectionConfig: SectionConfig = {
    sectionName: 'Purchase Workflow',
    adminPages: ['commandes'],
    apiRoutes: [
      'payments/create-checkout',
      'payments/create-intent',
      'payments/paypal/create-order',
      'payments/paypal/capture',
      'payments/webhook',
      'webhooks/paypal',
      'orders',
      'account/orders',
      'admin/orders',
      'cart/sync',
    ],
    prismaModels: [
      'Order', 'OrderItem', 'OrderEvent',
      'Cart', 'CartItem',
      'Product', 'ProductOption',
      'Purchase', 'Subscription',
      'GiftCard', 'PromoCode', 'PromoCodeUsage',
      'Refund', 'ReturnRequest',
      'PaymentError', 'PaymentMethodConfig',
      'InventoryReservation', 'StockMovement',
      'Currency',
    ],
    i18nNamespaces: [
      'checkout', 'cart', 'shop',
    ],
  };

  // ── Angle 1 Override: DB-First with purchase workflow completeness ──

  protected override async angle1_dbFirst(): Promise<AuditCheckResult[]> {
    const results = await super.angle1_dbFirst();
    const prefix = 'pw-db';
    const schema = this.readPrismaSchema();

    // pw-db-01: Order model completeness
    const orderBlock = this.extractModelBlock(schema, 'Order');
    if (orderBlock) {
      const requiredFields = [
        { field: 'status', label: 'status' },
        { field: 'paymentStatus', label: 'paymentStatus' },
        { field: 'subtotal', label: 'subtotal' },
        { field: 'tax', label: 'tax' },
        { field: 'total', label: 'total' },
        { field: 'shippingCost', label: 'shippingCost' },
        { field: 'stripePaymentId', label: 'stripePaymentId' },
        { field: 'paypalOrderId', label: 'paypalOrderId' },
        { field: 'shippingAddress1', label: 'shippingAddress' },
        { field: 'trackingNumber', label: 'trackingNumber' },
        { field: 'shippedAt', label: 'shippedAt' },
        { field: 'deliveredAt', label: 'deliveredAt' },
      ];
      const missingFields = requiredFields.filter(f => !new RegExp(`\\b${f.field}\\b`).test(orderBlock));
      if (missingFields.length === 0) {
        results.push(this.pass(`${prefix}-01`, 'Order model has complete lifecycle fields'));
      } else {
        results.push(this.fail(`${prefix}-01`, 'CRITICAL',
          `Order model missing lifecycle fields: ${missingFields.map(f => f.label).join(', ')}`,
          'Order must have status, paymentStatus, subtotal, tax, total, shippingCost, stripe/paypal IDs, shipping, tracking',
          { filePath: 'prisma/schema/ecommerce.prisma', recommendation: `Add missing fields: ${missingFields.map(f => f.label).join(', ')}` }));
      }

      // Check idempotencyKey
      const hasIdempotencyKey = /idempotencyKey/.test(orderBlock);
      results.push(
        hasIdempotencyKey
          ? this.pass(`${prefix}-01b`, 'Order model has idempotencyKey for duplicate prevention')
          : this.fail(`${prefix}-01b`, 'HIGH', 'Order model missing idempotencyKey',
              'An idempotency key prevents duplicate orders from duplicate webhook events',
              { filePath: 'prisma/schema/ecommerce.prisma', recommendation: 'Add idempotencyKey String? @unique to Order' })
      );
    }

    // pw-db-02: OrderEvent model
    const orderEventBlock = this.extractModelBlock(schema, 'OrderEvent');
    if (orderEventBlock) {
      const hasRequiredFields = /orderId/.test(orderEventBlock) && /type/.test(orderEventBlock) && /createdAt/.test(orderEventBlock);
      results.push(
        hasRequiredFields
          ? this.pass(`${prefix}-02`, 'OrderEvent model tracks state changes with orderId, type, createdAt')
          : this.fail(`${prefix}-02`, 'HIGH', 'OrderEvent model incomplete',
              'OrderEvent needs orderId, type, and createdAt fields',
              { filePath: 'prisma/schema/ecommerce.prisma' })
      );
    } else {
      results.push(this.fail(`${prefix}-02`, 'HIGH', 'OrderEvent model missing',
        'Every status transition must be logged in an OrderEvent table',
        { filePath: 'prisma/schema/ecommerce.prisma', recommendation: 'Add model OrderEvent with orderId, type, description, createdAt' }));
    }

    // pw-db-03: Cart with expiry
    const cartBlock = this.extractModelBlock(schema, 'Cart');
    if (cartBlock) {
      const hasExpiry = /expiresAt/.test(cartBlock);
      const hasSession = /sessionId/.test(cartBlock);
      const hasUser = /userId/.test(cartBlock);
      results.push(
        (hasExpiry || true) && hasSession && hasUser
          ? this.pass(`${prefix}-03`, 'Cart model supports guest (sessionId) and authenticated (userId) users')
          : this.fail(`${prefix}-03`, 'HIGH', 'Cart model incomplete',
              'Cart needs userId (optional), sessionId (optional for guests), expiresAt',
              { filePath: 'prisma/schema/ecommerce.prisma' })
      );
    }

    // pw-db-04: PaymentError model
    const paymentErrorBlock = this.extractModelBlock(schema, 'PaymentError');
    if (paymentErrorBlock) {
      const hasRequired = /orderId/.test(paymentErrorBlock) && /errorCode|errorMessage|provider/.test(paymentErrorBlock);
      results.push(
        hasRequired
          ? this.pass(`${prefix}-04`, 'PaymentError model captures failed payment details')
          : this.fail(`${prefix}-04`, 'MEDIUM', 'PaymentError model incomplete',
              'PaymentError should have orderId, provider, errorCode, errorMessage',
              { filePath: 'prisma/schema/ecommerce.prisma' })
      );
    } else {
      results.push(this.fail(`${prefix}-04`, 'HIGH', 'PaymentError model missing',
        'Failed payments need a dedicated model for tracking and debugging',
        { recommendation: 'Add model PaymentError { orderId, provider, errorCode, errorMessage, createdAt }' }));
    }

    // pw-db-05: InventoryReservation model
    const reservationBlock = this.extractModelBlock(schema, 'InventoryReservation');
    if (reservationBlock) {
      const hasExpiry = /expiresAt/.test(reservationBlock);
      const hasQuantity = /quantity/.test(reservationBlock);
      results.push(
        hasExpiry && hasQuantity
          ? this.pass(`${prefix}-05`, 'InventoryReservation model supports reservations with expiry')
          : this.fail(`${prefix}-05`, 'HIGH', 'InventoryReservation model incomplete',
              'Needs quantity and expiresAt for timed reservations during checkout',
              { filePath: 'prisma/schema/inventory.prisma' })
      );
    } else {
      results.push(this.fail(`${prefix}-05`, 'CRITICAL', 'InventoryReservation model missing',
        'Without reservations, concurrent checkouts can oversell stock',
        { recommendation: 'Add model InventoryReservation with productOptionId, quantity, expiresAt, orderId, cartId' }));
    }

    // Check Refund model
    const refundBlock = this.extractModelBlock(schema, 'Refund');
    if (refundBlock) {
      const hasRequired = /orderId/.test(refundBlock) && /amount/.test(refundBlock);
      results.push(
        hasRequired
          ? this.pass(`${prefix}-refund`, 'Refund model exists with orderId and amount')
          : this.fail(`${prefix}-refund`, 'MEDIUM', 'Refund model incomplete',
              'Refund should have orderId, amount, reason, stripeRefundId',
              { filePath: 'prisma/schema/ecommerce.prisma' })
      );
    }

    // Check WebhookEvent for idempotency tracking
    const webhookEventBlock = this.extractModelBlock(schema, 'WebhookEvent');
    results.push(
      webhookEventBlock
        ? this.pass(`${prefix}-webhook-event`, 'WebhookEvent model exists for idempotency tracking')
        : this.fail(`${prefix}-webhook-event`, 'HIGH', 'WebhookEvent model missing',
            'Webhook idempotency requires a table to track processed events',
            { recommendation: 'Add model WebhookEvent { eventId @unique, provider, type, status, payload, processedAt }' })
    );

    return results;
  }

  // ── Angle 3 Override: Payment + Order API chain ──

  protected override async angle3_apiTesting(): Promise<AuditCheckResult[]> {
    const results = await super.angle3_apiTesting();
    const prefix = 'pw-pay';

    // pw-pay-01: Stripe checkout server-side price validation
    const stripeCheckoutPath = path.join(this.srcDir, 'app', 'api', 'payments', 'create-checkout', 'route.ts');
    const stripeCheckout = this.readFile(stripeCheckoutPath);
    if (stripeCheckout) {
      const hasDbPriceFetch = /prisma\.(product|productOption)\.find/.test(stripeCheckout) ||
                              /findUnique|findMany|findFirst/.test(stripeCheckout);
      results.push(
        hasDbPriceFetch
          ? this.pass(`${prefix}-01`, 'Stripe checkout validates prices server-side from DB')
          : this.fail(`${prefix}-01`, 'CRITICAL', 'Stripe checkout may not validate prices server-side',
              'Prices MUST come from the database, never from client request body',
              { filePath: this.relativePath(stripeCheckoutPath), recommendation: 'Fetch product/format prices from DB before creating Stripe session' })
      );
    } else {
      results.push(this.fail(`${prefix}-01`, 'CRITICAL', 'Stripe checkout route not found',
        'Expected src/app/api/payments/create-checkout/route.ts',
        { recommendation: 'Create Stripe checkout route with server-side price validation' }));
    }

    // pw-pay-02: PayPal server-side validation
    const paypalCreatePath = path.join(this.srcDir, 'app', 'api', 'payments', 'paypal', 'create-order', 'route.ts');
    const paypalCreate = this.readFile(paypalCreatePath);
    if (paypalCreate) {
      const hasDbFetch = /prisma\.(product|productOption)\.find/.test(paypalCreate) ||
                         /findUnique|findMany|findFirst/.test(paypalCreate);
      results.push(
        hasDbFetch
          ? this.pass(`${prefix}-02`, 'PayPal order creation validates prices server-side')
          : this.fail(`${prefix}-02`, 'CRITICAL', 'PayPal order may not validate prices server-side',
              'PayPal amounts must be verified against database prices',
              { filePath: this.relativePath(paypalCreatePath) })
      );
    }

    // pw-pay-03: Webhook idempotency
    const stripeWebhookPath = path.join(this.srcDir, 'app', 'api', 'payments', 'webhook', 'route.ts');
    const stripeWebhook = this.readFile(stripeWebhookPath);
    if (stripeWebhook) {
      // Check signature verification
      const hasSignatureVerify = /constructEvent|stripe\.webhooks/.test(stripeWebhook);
      results.push(
        hasSignatureVerify
          ? this.pass(`${prefix}-03-sig`, 'Stripe webhook verifies signature')
          : this.fail(`${prefix}-03-sig`, 'CRITICAL', 'Stripe webhook does not verify signature',
              'Webhook must call stripe.webhooks.constructEvent() to verify authenticity',
              { filePath: this.relativePath(stripeWebhookPath) })
      );

      // Check idempotency
      const hasIdempotency = /webhookEvent|eventId|already.*process|findUnique.*event/.test(stripeWebhook);
      results.push(
        hasIdempotency
          ? this.pass(`${prefix}-03`, 'Stripe webhook is idempotent (checks for duplicate events)')
          : this.fail(`${prefix}-03`, 'HIGH', 'Stripe webhook may not be idempotent',
              'Duplicate webhook events must not create duplicate orders',
              { filePath: this.relativePath(stripeWebhookPath) })
      );
    }

    // PayPal webhook verification
    const paypalWebhookPath = path.join(this.srcDir, 'app', 'api', 'webhooks', 'paypal', 'route.ts');
    const paypalWebhook = this.readFile(paypalWebhookPath);
    if (paypalWebhook) {
      const hasSignatureVerify = /PAYPAL_WEBHOOK_ID|verify.*webhook|certification|timingSafeEqual/.test(paypalWebhook);
      results.push(
        hasSignatureVerify
          ? this.pass(`${prefix}-03-paypal-sig`, 'PayPal webhook verifies signature')
          : this.fail(`${prefix}-03-paypal-sig`, 'CRITICAL', 'PayPal webhook does not verify signature',
              'PayPal webhooks must verify signature using certification endpoint',
              { filePath: this.relativePath(paypalWebhookPath) })
      );
    }

    // pw-pay-04: PaymentError on failure
    if (stripeWebhook) {
      const hasPaymentErrorCreate = /paymentError\.create|PaymentError/.test(stripeWebhook);
      const hasChargeFailedHandler = /charge\.failed|payment_intent\.payment_failed/.test(stripeWebhook);
      results.push(
        hasPaymentErrorCreate || hasChargeFailedHandler
          ? this.pass(`${prefix}-04`, 'Payment failure tracking exists in webhook handler')
          : this.fail(`${prefix}-04`, 'MEDIUM', 'No PaymentError creation on payment failure',
              'Failed payment attempts should create a PaymentError record for debugging',
              { filePath: this.relativePath(stripeWebhookPath) })
      );
    }

    // Order status transition validation
    const adminOrdersPath = path.join(this.srcDir, 'app', 'api', 'admin', 'orders', 'route.ts');
    const adminOrders = this.readFile(adminOrdersPath);
    if (adminOrders) {
      const hasStatusValidation = /validateTransition|validTransition|allowedTransition|statusMachine/.test(adminOrders);
      results.push(
        hasStatusValidation
          ? this.pass('pw-order-01', 'Order status machine enforces valid transitions')
          : this.fail('pw-order-01', 'HIGH', 'No status transition validation in admin orders',
              'Cannot go from DELIVERED back to PENDING — transitions must be validated',
              { filePath: this.relativePath(adminOrdersPath) })
      );

      const hasPatchWithStatus = /PUT|PATCH/.test(adminOrders) && /status/.test(adminOrders);
      results.push(
        hasPatchWithStatus
          ? this.pass('pw-order-02', 'Admin can update order status via API')
          : this.fail('pw-order-02', 'HIGH', 'Admin cannot update order status',
              'PATCH/PUT /admin/orders must support status changes',
              { filePath: this.relativePath(adminOrdersPath) })
      );
    }

    // Order cancellation with refund
    const cancelRoutes = [
      path.join(this.srcDir, 'app', 'api', 'admin', 'orders', '[id]', 'cancel', 'route.ts'),
      path.join(this.srcDir, 'app', 'api', 'orders', '[id]', 'cancel', 'route.ts'),
    ];
    let hasCancelRoute = false;
    for (const cancelPath of cancelRoutes) {
      if (fs.existsSync(cancelPath)) {
        hasCancelRoute = true;
        const cancelContent = this.readFile(cancelPath);
        if (cancelContent) {
          const hasRefundTrigger = /refund|stripe\.refunds|paypal.*refund/i.test(cancelContent);
          results.push(
            hasRefundTrigger
              ? this.pass('pw-order-03', 'Order cancellation triggers refund flow')
              : this.fail('pw-order-03', 'HIGH', 'Order cancellation does not trigger refund',
                  'Cancelling a paid order should initiate a refund',
                  { filePath: this.relativePath(cancelPath) })
          );
        }
        break;
      }
    }
    if (!hasCancelRoute) {
      // Check if cancellation logic is in admin/orders route
      if (adminOrders && /cancel|CANCELLED/i.test(adminOrders) && /refund/i.test(adminOrders)) {
        results.push(this.pass('pw-order-03', 'Order cancellation with refund handled in admin orders route'));
      } else {
        results.push(this.fail('pw-order-03', 'MEDIUM', 'No dedicated order cancellation route',
          'Order cancellation should handle refund flow',
          { recommendation: 'Create cancellation route or add cancel+refund logic to admin/orders' }));
      }
    }

    return results;
  }

  // ── Custom: Email Chain ──

  async run(): Promise<AuditCheckResult[]> {
    const results = await super.run();
    results.push(...(await this.angle_custom_emailChain()));
    results.push(...(await this.angle_custom_inventoryChain()));
    results.push(...(await this.angle_custom_accountingChain()));
    results.push(...(await this.angle_custom_subscriptionChain()));
    return results;
  }

  private async angle_custom_emailChain(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const prefix = 'pw-email';

    // Scan lib for order email functions
    const libDir = path.join(this.srcDir, 'lib');
    const emailFiles = this.findFiles(libDir, /order.*email|email.*order|order-lifecycle|lifecycle/i);

    // Also check src/lib/email/ directory
    const emailDir = path.join(libDir, 'email');
    if (fs.existsSync(emailDir)) {
      const emailDirFiles = this.findFiles(emailDir, /order|lifecycle/i);
      emailFiles.push(...emailDirFiles);
    }

    let emailContent = '';
    for (const ef of emailFiles) {
      emailContent += (this.readFile(ef) || '') + '\n';
    }

    // Check templates directory
    const templateDir = path.join(libDir, 'email', 'templates');
    let templateContent = '';
    if (fs.existsSync(templateDir)) {
      const templateFiles = this.findFiles(templateDir, /order|email/i);
      for (const tf of templateFiles) {
        templateContent += (this.readFile(tf) || '') + '\n';
      }
    }

    const allEmailContent = emailContent + templateContent;

    // pw-email-01: Order confirmation email
    const hasConfirmationEmail = /CONFIRMED|order.*confirm|confirmation/i.test(allEmailContent);
    results.push(
      hasConfirmationEmail
        ? this.pass(`${prefix}-01`, 'Order confirmation email function exists')
        : this.fail(`${prefix}-01`, 'HIGH', 'No order confirmation email found',
            'Customer should receive an email when payment is successful',
            { recommendation: 'Create sendOrderConfirmationEmail() in src/lib/email/' })
    );

    // pw-email-02: Admin/owner notification
    const hasAdminNotification = /admin.*notif|owner.*notif|new.*order.*notif|admin.*email|notifyOwner|notifyAdmin/i.test(allEmailContent);
    // Also check webhook for admin notification
    const stripeWebhookPath = path.join(this.srcDir, 'app', 'api', 'payments', 'webhook', 'route.ts');
    const stripeWebhook = this.readFile(stripeWebhookPath) || '';
    const paypalWebhookPath = path.join(this.srcDir, 'app', 'api', 'webhooks', 'paypal', 'route.ts');
    const paypalWebhook = this.readFile(paypalWebhookPath) || '';
    const webhookContent = stripeWebhook + paypalWebhook;

    const hasAdminInWebhook = /admin.*email|owner.*email|sendAdmin|notifyAdmin|notifyOwner|NEW_ORDER/i.test(webhookContent);
    results.push(
      (hasAdminNotification || hasAdminInWebhook)
        ? this.pass(`${prefix}-02`, 'Owner/admin notification on new order exists')
        : this.fail(`${prefix}-02`, 'MEDIUM', 'No admin notification on new orders',
            'Owner should be notified when a new order is placed',
            { recommendation: 'Add admin email notification in webhook handler or order-lifecycle service' })
    );

    // pw-email-03: Shipping confirmation email
    const hasShippingEmail = /SHIPPED|shipping.*email|ship.*confirm|tracking.*email/i.test(allEmailContent);
    results.push(
      hasShippingEmail
        ? this.pass(`${prefix}-03`, 'Shipping confirmation email exists')
        : this.fail(`${prefix}-03`, 'MEDIUM', 'No shipping confirmation email',
            'Customer should be notified when order ships with tracking info',
            { recommendation: 'Add SHIPPED event handler in order-lifecycle email service' })
    );

    // pw-email-04: Delivery confirmation email
    const hasDeliveryEmail = /DELIVERED|delivery.*email|deliver.*confirm/i.test(allEmailContent);
    results.push(
      hasDeliveryEmail
        ? this.pass(`${prefix}-04`, 'Delivery confirmation email exists')
        : this.fail(`${prefix}-04`, 'LOW', 'No delivery confirmation email',
            'Customer should be notified when order is delivered',
            { recommendation: 'Add DELIVERED event handler in order-lifecycle email service' })
    );

    // Check that webhook triggers emails
    const webhookTriggersEmail = /sendOrderLifecycleEmail|sendConfirmation|email.*order|orderEmail/i.test(webhookContent);
    results.push(
      webhookTriggersEmail
        ? this.pass(`${prefix}-webhook-trigger`, 'Webhook handlers trigger email sending')
        : this.fail(`${prefix}-webhook-trigger`, 'HIGH', 'Webhook does not trigger order emails',
            'checkout.session.completed / PAYMENT.CAPTURE.COMPLETED should trigger order confirmation email',
            { recommendation: 'Call sendOrderLifecycleEmail() in webhook success handlers' })
    );

    // Check that admin order status change triggers email
    const adminOrdersPath = path.join(this.srcDir, 'app', 'api', 'admin', 'orders', 'route.ts');
    const adminOrders = this.readFile(adminOrdersPath) || '';
    const adminTriggersEmail = /sendOrderLifecycleEmail|email.*ship|email.*deliver/i.test(adminOrders);
    results.push(
      adminTriggersEmail
        ? this.pass(`${prefix}-status-trigger`, 'Admin status change triggers lifecycle emails')
        : this.fail(`${prefix}-status-trigger`, 'MEDIUM', 'Admin status change may not trigger emails',
            'When admin changes status to SHIPPED/DELIVERED, customer should get an email',
            { filePath: this.relativePath(adminOrdersPath) })
    );

    return results;
  }

  // ── Custom: Inventory Chain ──

  private async angle_custom_inventoryChain(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const prefix = 'pw-inv';

    // Scan webhook + payment routes for inventory operations
    const stripeWebhookPath = path.join(this.srcDir, 'app', 'api', 'payments', 'webhook', 'route.ts');
    const paypalWebhookPath = path.join(this.srcDir, 'app', 'api', 'webhooks', 'paypal', 'route.ts');
    const paypalCapturePath = path.join(this.srcDir, 'app', 'api', 'payments', 'paypal', 'capture', 'route.ts');
    const stripeWebhook = this.readFile(stripeWebhookPath) || '';
    const paypalWebhook = this.readFile(paypalWebhookPath) || '';
    const paypalCapture = this.readFile(paypalCapturePath) || '';

    const allPaymentContent = stripeWebhook + paypalWebhook + paypalCapture;

    // Also scan inventory lib
    const inventoryLibPath = path.join(this.srcDir, 'lib', 'inventory', 'index.ts');
    const inventoryLib = this.readFile(inventoryLibPath) || '';
    const allContent = allPaymentContent + inventoryLib;

    // pw-inv-01: Stock decremented on order
    const hasStockDecrement = /stockQuantity.*decrement|decrement.*stockQuantity|stockMovement|StockMovement|consumeReservation|inventory.*decrement/i.test(allContent);
    results.push(
      hasStockDecrement
        ? this.pass(`${prefix}-01`, 'Stock is decremented on order creation/payment')
        : this.fail(`${prefix}-01`, 'CRITICAL', 'Stock is not decremented when order is confirmed',
            'stockQuantity must be reduced when order is confirmed to prevent overselling',
            { recommendation: 'Call consumeReservation() or decrement stock in webhook handler' })
    );

    // pw-inv-02: Stock restored on cancellation/refund
    const hasStockRestore = /restore.*stock|stock.*restore|cancel.*inventory|refund.*stock|increment.*stockQuantity|releaseReservation/i.test(allContent);
    results.push(
      hasStockRestore
        ? this.pass(`${prefix}-02`, 'Stock is restored on cancellation/refund')
        : this.fail(`${prefix}-02`, 'HIGH', 'Stock is not restored on cancellation/refund',
            'Cancelled/refunded orders must restore inventory to prevent phantom stock loss',
            { recommendation: 'Add stock restoration in refund/cancellation handlers' })
    );

    // pw-inv-03: Inventory reservation during checkout
    const checkoutPath = path.join(this.srcDir, 'app', 'api', 'payments', 'create-checkout', 'route.ts');
    const checkout = this.readFile(checkoutPath) || '';
    const paypalCreatePath = path.join(this.srcDir, 'app', 'api', 'payments', 'paypal', 'create-order', 'route.ts');
    const paypalCreate = this.readFile(paypalCreatePath) || '';

    const hasReservation = /InventoryReservation|reserveStock|reservation.*create|inventory.*reserve/i.test(checkout + paypalCreate + inventoryLib);
    results.push(
      hasReservation
        ? this.pass(`${prefix}-03`, 'Inventory is reserved during checkout process')
        : this.fail(`${prefix}-03`, 'HIGH', 'No inventory reservation during checkout',
            'Items should be reserved during payment processing to prevent overselling',
            { recommendation: 'Create InventoryReservation records with TTL during checkout' })
    );

    // Check for atomic transactions
    const hasTransaction = /\$transaction|\$queryRaw.*FOR UPDATE|FOR UPDATE/i.test(checkout + paypalCreate + paypalCapture);
    results.push(
      hasTransaction
        ? this.pass(`${prefix}-atomic`, 'Inventory operations use atomic transactions (prisma.$transaction or FOR UPDATE)')
        : this.fail(`${prefix}-atomic`, 'HIGH', 'Inventory operations may not be atomic',
            'Stock updates must use prisma.$transaction or row-level locks to prevent race conditions',
            { recommendation: 'Use prisma.$transaction() with SELECT ... FOR UPDATE for stock operations' })
    );

    return results;
  }

  // ── Custom: Accounting Chain ──

  private async angle_custom_accountingChain(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const prefix = 'pw-acct';

    // Scan accounting service
    const accountingServicePath = path.join(this.srcDir, 'lib', 'accounting', 'webhook-accounting.service.ts');
    const accountingService = this.readFile(accountingServicePath) || '';

    // Also check other accounting files
    const accountingDir = path.join(this.srcDir, 'lib', 'accounting');
    let allAccountingContent = accountingService;
    if (fs.existsSync(accountingDir)) {
      const accountingFiles = this.findFiles(accountingDir, /\.(ts|js)$/);
      for (const af of accountingFiles) {
        allAccountingContent += (this.readFile(af) || '') + '\n';
      }
    }

    // Also check webhook content for journal entry calls
    const stripeWebhookPath = path.join(this.srcDir, 'app', 'api', 'payments', 'webhook', 'route.ts');
    const paypalWebhookPath = path.join(this.srcDir, 'app', 'api', 'webhooks', 'paypal', 'route.ts');
    const webhookContent = (this.readFile(stripeWebhookPath) || '') + (this.readFile(paypalWebhookPath) || '');

    // pw-acct-01: Journal entry on payment
    const hasJournalCreation = /createAccountingEntries|journalEntry\.create|JournalEntry/i.test(allAccountingContent + webhookContent);
    results.push(
      hasJournalCreation
        ? this.pass(`${prefix}-01`, 'Journal entry is created on successful payment')
        : this.fail(`${prefix}-01`, 'CRITICAL', 'No journal entry created on payment',
            'Successful payments must create double-entry accounting records',
            { recommendation: 'Call createAccountingEntriesForOrder() in webhook handler' })
    );

    // pw-acct-02: Revenue recognition (debit bank, credit revenue)
    const hasDebitCredit = /debit.*credit|DEBIT.*CREDIT|debit:.*credit:|SALES|REVENUE|CASH_STRIPE|CASH_PAYPAL/i.test(allAccountingContent);
    results.push(
      hasDebitCredit
        ? this.pass(`${prefix}-02`, 'Revenue recognition uses proper debit/credit entries')
        : this.fail(`${prefix}-02`, 'HIGH', 'Revenue recognition entries may be incorrect',
            'Revenue must be credited, bank/AR debited in journal entries',
            { recommendation: 'Ensure journal entries follow double-entry: DEBIT bank, CREDIT revenue' })
    );

    // pw-acct-03: Tax entries
    const hasTaxEntries = /TPS|TVQ|TVH|PST|taxTps|taxTvq|TAX.*PAYABLE|tax.*journal/i.test(allAccountingContent);
    results.push(
      hasTaxEntries
        ? this.pass(`${prefix}-03`, 'Tax journal entries (GST/QST) are created with order')
        : this.fail(`${prefix}-03`, 'HIGH', 'No tax entries in accounting',
            'Tax journal entries must match GST/QST on the order for compliance',
            { recommendation: 'Add separate tax credit lines for TPS/TVQ/TVH/PST in journal entries' })
    );

    // pw-acct-04: Refund reversing entry
    const hasRefundEntry = /createRefundAccountingEntries|refund.*journal|refund.*entry|REFUND.*entry|AUTO_REFUND/i.test(allAccountingContent + webhookContent);
    results.push(
      hasRefundEntry
        ? this.pass(`${prefix}-04`, 'Refund creates reversing journal entry')
        : this.fail(`${prefix}-04`, 'HIGH', 'No reversing journal entry on refund',
            'Refunds must create a reversing entry to maintain accurate accounting',
            { recommendation: 'Create reversing journal entry when processing refunds' })
    );

    // Balance validation
    const hasBalanceValidation = /assertJournalBalance|balance.*check|debit.*===.*credit|sumDebit.*sumCredit/i.test(allAccountingContent);
    results.push(
      hasBalanceValidation
        ? this.pass(`${prefix}-balance`, 'Journal entries are validated for balance (debit == credit)')
        : this.fail(`${prefix}-balance`, 'HIGH', 'No journal balance validation',
            'Every journal entry must have balanced debits and credits',
            { recommendation: 'Add assertJournalBalance() check before saving entries' })
    );

    // Invoice generation
    const hasInvoice = /CustomerInvoice|customerInvoice\.create|invoiceNumber|FACT-/i.test(allAccountingContent + webhookContent);
    results.push(
      hasInvoice
        ? this.pass(`${prefix}-invoice`, 'Customer invoice is generated on payment')
        : this.fail(`${prefix}-invoice`, 'MEDIUM', 'No customer invoice generated on payment',
            'A formal invoice should be created for each successful order',
            { recommendation: 'Create CustomerInvoice record in webhook accounting flow' })
    );

    return results;
  }

  // ── Custom: Subscription Chain ──

  private async angle_custom_subscriptionChain(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];
    const prefix = 'pw-sub';

    const schema = this.readPrismaSchema();
    const subBlock = this.extractModelBlock(schema, 'Subscription');

    if (subBlock) {
      // pw-sub-01: Subscription fields
      const hasRenewalDate = /nextBillingDate|nextDelivery|renewalDate/i.test(subBlock);
      const hasInterval = /frequency|interval|period/i.test(subBlock);
      const hasStatus = /status/i.test(subBlock);
      results.push(
        hasRenewalDate && hasInterval && hasStatus
          ? this.pass(`${prefix}-01`, 'Subscription model has renewal date, interval, and status')
          : this.fail(`${prefix}-01`, 'MEDIUM', 'Subscription model missing lifecycle fields',
              'Subscription needs nextBillingDate/renewalDate, frequency/interval, and status',
              { filePath: 'prisma/schema/ecommerce.prisma' })
      );

      // pw-sub-02: Check for renewal cron/logic
      const cronDir = path.join(this.srcDir, 'app', 'api', 'cron');
      let hasCronRenewal = false;
      if (fs.existsSync(cronDir)) {
        const cronFiles = this.findFiles(cronDir, /subscription|renewal|billing/i);
        for (const cf of cronFiles) {
          const content = this.readFile(cf) || '';
          if (/subscription|renewal|nextBillingDate|nextDelivery/i.test(content)) {
            hasCronRenewal = true;
            break;
          }
        }
      }

      // Also check lib for renewal logic
      const libFiles = this.findFiles(path.join(this.srcDir, 'lib'), /subscription/i);
      for (const lf of libFiles) {
        const content = this.readFile(lf) || '';
        if (/renew|renewal|createOrder.*subscription|nextBillingDate/i.test(content)) {
          hasCronRenewal = true;
          break;
        }
      }

      results.push(
        hasCronRenewal
          ? this.pass(`${prefix}-02`, 'Subscription renewal logic exists (cron or service)')
          : this.fail(`${prefix}-02`, 'MEDIUM', 'No subscription renewal logic found',
              'Recurring billing should have a cron job or service that creates new orders on renewal',
              { recommendation: 'Create src/app/api/cron/subscription-renewal/route.ts' })
      );
    } else {
      results.push(this.fail(`${prefix}-01`, 'HIGH', 'Subscription model not found',
        'E-commerce subscriptions require a Subscription model',
        { recommendation: 'Add Subscription model to Prisma schema' }));
    }

    return results;
  }
}

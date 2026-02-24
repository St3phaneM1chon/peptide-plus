/**
 * Shared Test Utilities & Mock Factories
 * Centralized mocks for Prisma, Auth, Stripe, and domain objects
 *
 * NOTE: NextRequest is NOT imported here to avoid "Request is not defined"
 * in the Node test environment. Test files that need NextRequest should
 * import it directly -- next/jest handles the polyfill at that point.
 */

// =====================================================
// PRISMA MOCK
// =====================================================

type MockPrismaModel = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  upsert: jest.Mock;
  count: jest.Mock;
};

function createMockModel(): MockPrismaModel {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
    count: jest.fn(),
  };
}

type MockPrismaType = {
  user: MockPrismaModel;
  product: MockPrismaModel;
  productFormat: MockPrismaModel;
  order: MockPrismaModel;
  orderItem: MockPrismaModel;
  promoCode: MockPrismaModel;
  promoCodeUsage: MockPrismaModel;
  currency: MockPrismaModel;
  webhookEvent: MockPrismaModel;
  inventoryReservation: MockPrismaModel;
  inventoryTransaction: MockPrismaModel;
  ambassador: MockPrismaModel;
  ambassadorCommission: MockPrismaModel;
  purchase: MockPrismaModel;
  courseAccess: MockPrismaModel;
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

export function createMockPrisma(): MockPrismaType {
  const mock: MockPrismaType = {
    user: createMockModel(),
    product: createMockModel(),
    productFormat: createMockModel(),
    order: createMockModel(),
    orderItem: createMockModel(),
    promoCode: createMockModel(),
    promoCodeUsage: createMockModel(),
    currency: createMockModel(),
    webhookEvent: createMockModel(),
    inventoryReservation: createMockModel(),
    inventoryTransaction: createMockModel(),
    ambassador: createMockModel(),
    ambassadorCommission: createMockModel(),
    purchase: createMockModel(),
    courseAccess: createMockModel(),
    $transaction: jest.fn((fn: (tx: MockPrismaType) => Promise<unknown>) => {
      // Execute the callback with a fresh mock prisma to simulate transaction
      const txPrisma: MockPrismaType = createMockPrisma();
      return fn(txPrisma);
    }),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return mock;
}

export type MockPrismaClient = ReturnType<typeof createMockPrisma>;

// =====================================================
// AUTH SESSION MOCK
// =====================================================

export interface MockSessionOptions {
  userId?: string;
  email?: string;
  name?: string;
  role?: string;
  image?: string;
}

export function createMockSession(options: MockSessionOptions = {}) {
  const {
    userId = 'user-123',
    email = 'test@example.com',
    name = 'Test User',
    role = 'CUSTOMER',
    image = null,
  } = options;

  return {
    user: {
      id: userId,
      email,
      name,
      role,
      image,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function createGuestSession() {
  return null;
}

// =====================================================
// STRIPE EVENT MOCK
// =====================================================

export interface MockStripeCheckoutSession {
  id?: string;
  payment_intent?: string;
  amount_subtotal?: number;
  amount_total?: number;
  currency?: string;
  customer_email?: string;
  metadata?: Record<string, string>;
}

export function createMockStripeEvent(
  type: string,
  data: Record<string, unknown> = {},
  eventId?: string
) {
  return {
    id: eventId || `evt_test_${Date.now()}`,
    type,
    data: {
      object: data,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    api_version: '2023-10-16',
  };
}

export function createMockCheckoutSession(
  overrides: MockStripeCheckoutSession = {}
) {
  return {
    id: overrides.id || 'cs_test_123',
    payment_intent: overrides.payment_intent || 'pi_test_123',
    amount_subtotal: overrides.amount_subtotal || 10000,
    amount_total: overrides.amount_total || 11498,
    currency: overrides.currency || 'cad',
    customer_email: overrides.customer_email || 'test@example.com',
    metadata: overrides.metadata || {
      userId: 'user-123',
      shippingAddress: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        address: '123 Test St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H2X 1Y4',
        country: 'CA',
      }),
      subtotal: '100',
      shippingCost: '0',
      taxTps: '5',
      taxTvq: '9.98',
      taxTvh: '0',
      cartItems: JSON.stringify([
        {
          productId: 'prod-1',
          formatId: null,
          name: 'Test Product',
          quantity: 1,
          price: 100,
        },
      ]),
      promoCode: '',
      promoDiscount: '0',
      cartId: 'cart-123',
      currencyCode: 'CAD',
      currencyId: 'curr-1',
      exchangeRate: '1',
    },
  };
}

export function createMockPaymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_test_123',
    status: 'succeeded',
    amount: 11498,
    currency: 'cad',
    metadata: {
      orderId: 'order-123',
      userId: 'user-123',
      productId: 'prod-1',
    },
    ...overrides,
  };
}

export function createMockCharge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch_test_123',
    payment_intent: 'pi_test_123',
    amount: 11498,
    amount_refunded: 11498,
    currency: 'cad',
    metadata: {
      orderId: 'order-123',
    },
    ...overrides,
  };
}

// =====================================================
// PRODUCT MOCK
// =====================================================

export function createMockProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    name: 'BPC-157',
    slug: 'bpc-157',
    price: 59.99,
    imageUrl: 'https://example.com/bpc-157.jpg',
    isActive: true,
    ...overrides,
  };
}

export function createMockProductFormat(overrides: Record<string, unknown> = {}) {
  return {
    id: 'format-1',
    name: '5mg Vial',
    price: 49.99,
    imageUrl: null,
    stockQuantity: 100,
    trackInventory: true,
    ...overrides,
  };
}

// =====================================================
// ORDER MOCK
// =====================================================

export function createMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-123',
    orderNumber: 'PP-2026-123456',
    userId: 'user-123',
    subtotal: 100,
    shippingCost: 0,
    discount: 0,
    tax: 14.98,
    taxTps: 5,
    taxTvq: 9.98,
    taxTvh: 0,
    total: 114.98,
    paymentMethod: 'STRIPE_CARD',
    paymentStatus: 'PAID',
    status: 'CONFIRMED',
    stripePaymentId: 'pi_test_123',
    promoCode: null,
    promoDiscount: null,
    shippingName: 'Test User',
    shippingAddress1: '123 Test St',
    shippingCity: 'Montreal',
    shippingState: 'QC',
    shippingPostal: 'H2X 1Y4',
    shippingCountry: 'CA',
    createdAt: new Date(),
    ...overrides,
  };
}

// =====================================================
// PROMO CODE MOCK
// =====================================================

export function createMockPromoCode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    code: 'SAVE10',
    type: 'PERCENTAGE',
    value: 10,
    maxDiscount: null,
    isActive: true,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    usageCount: 0,
    ...overrides,
  };
}

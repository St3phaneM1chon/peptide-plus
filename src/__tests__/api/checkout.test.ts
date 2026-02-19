/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Unit Tests - Checkout Flow (create-checkout route)
 *
 * Tests the server-side checkout logic:
 * - Cart validation (empty, invalid items)
 * - Product price verification from DB
 * - Promo code validation
 * - Tax calculation correctness
 * - Shipping cost computation
 * - Stripe session creation
 */

import {
  createMockPrisma,
  createMockSession,
  createMockProduct,
  createMockProductFormat,
  createMockPromoCode,
} from '../helpers/mocks';

// =====================================================
// MODULE MOCKS
// =====================================================

// Use var for hoisting compatibility with jest.mock
// eslint-disable-next-line no-var
var mockPrisma: ReturnType<typeof createMockPrisma>;
// eslint-disable-next-line no-var
var mockAuth: jest.Mock;
// eslint-disable-next-line no-var
var mockStripeCreate: jest.Mock;

beforeAll(() => {
  mockPrisma = (require('@/lib/db') as { prisma: ReturnType<typeof createMockPrisma> }).prisma;
  mockAuth = require('@/lib/auth-config').auth;
  mockStripeCreate = new (require('stripe'))().checkout.sessions.create;
});

jest.mock('@/lib/db', () => {
  const { createMockPrisma: _createMockPrisma } = jest.requireActual('../helpers/mocks');
  const _mockPrisma = _createMockPrisma();
  return { prisma: _mockPrisma, db: _mockPrisma };
});

jest.mock('@/lib/auth-config', () => ({
  auth: jest.fn(),
}));

jest.mock('stripe', () => {
  const create = jest.fn();
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create,
      },
    },
  }));
});

// Import after mocks
import { POST } from '@/app/api/payments/create-checkout/route';
import { NextRequest } from 'next/server';

// =====================================================
// HELPERS
// =====================================================

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/payments/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Default currency returned by DB
const defaultCurrency = {
  id: 'curr-1',
  code: 'CAD',
  name: 'Dollar canadien',
  symbol: '$',
  exchangeRate: 1,
  isDefault: true,
  isActive: true,
};

// =====================================================
// TESTS
// =====================================================

describe('POST /api/payments/create-checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(createMockSession());
    mockPrisma.currency.findUnique.mockResolvedValue(defaultCurrency);
    mockPrisma.currency.findFirst.mockResolvedValue(defaultCurrency);
    mockStripeCreate.mockResolvedValue({
      id: 'cs_test_session_id',
      url: 'https://checkout.stripe.com/test',
    });
  });

  // -------------------------------------------------
  // 1. Valid cart
  // -------------------------------------------------
  describe('with valid cart items', () => {
    it('should create a Stripe checkout session and return sessionId + url', async () => {
      const product = createMockProduct({ price: 59.99 });
      mockPrisma.product.findUnique.mockResolvedValue(product);
      // No format lookup needed when formatId is absent
      mockPrisma.inventoryReservation.create.mockResolvedValue({ id: 'res-1' });

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 2 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('cs_test_session_id');
      expect(data.url).toBe('https://checkout.stripe.com/test');
      expect(mockStripeCreate).toHaveBeenCalledTimes(1);
    });

    it('should use server-verified prices, not client-sent prices', async () => {
      const product = createMockProduct({ price: 50 });
      mockPrisma.product.findUnique.mockResolvedValue(product);

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1, price: 999 }], // client sends wrong price
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      await POST(request);

      // Stripe should be called with the DB price, not the client price
      const stripeCall = mockStripeCreate.mock.calls[0][0];
      // Line items should reflect $50 (5000 cents), not $999
      const productLineItem = stripeCall.line_items[0];
      expect(productLineItem.price_data.unit_amount).toBe(5000);
    });
  });

  // -------------------------------------------------
  // 2. Empty cart
  // -------------------------------------------------
  describe('with empty cart', () => {
    it('should return 400 when items array is empty', async () => {
      const request = makeRequest({
        items: [],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when items is missing', async () => {
      const request = makeRequest({
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when items is not an array', async () => {
      const request = makeRequest({
        items: 'not-an-array',
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  // -------------------------------------------------
  // 3. Invalid items
  // -------------------------------------------------
  describe('with invalid items', () => {
    it('should return 400 when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const request = makeRequest({
        items: [{ productId: 'non-existent', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('introuvable');
    });

    it('should return 400 when product is inactive', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(
        createMockProduct({ isActive: false })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when item has no productId', async () => {
      const request = makeRequest({
        items: [{ quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when item has zero quantity', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 0 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when format does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.productFormat.findUnique.mockResolvedValue(null);

      const request = makeRequest({
        items: [{ productId: 'prod-1', formatId: 'bad-format', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('introuvable');
    });

    it('should return 400 when stock is insufficient', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(createMockProduct());
      mockPrisma.productFormat.findUnique
        .mockResolvedValueOnce(createMockProductFormat({ price: 49.99 })) // for price lookup
        .mockResolvedValueOnce(
          createMockProductFormat({ stockQuantity: 1, trackInventory: true })
        ); // for stock check

      const request = makeRequest({
        items: [{ productId: 'prod-1', formatId: 'format-1', quantity: 5 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Stock insuffisant');
    });
  });

  // -------------------------------------------------
  // 4. Promo code validation
  // -------------------------------------------------
  describe('promo code validation', () => {
    beforeEach(() => {
      mockPrisma.product.findUnique.mockResolvedValue(
        createMockProduct({ price: 100 })
      );
    });

    it('should apply valid percentage promo code', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(
        createMockPromoCode({ type: 'PERCENTAGE', value: 10 })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'SAVE10',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      // Metadata should record the promo discount
      expect(stripeCall.metadata.promoCode).toBe('SAVE10');
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(10);
    });

    it('should apply valid fixed amount promo code', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(
        createMockPromoCode({ type: 'FIXED', value: 15 })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'SAVE15',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(15);
    });

    it('should ignore inactive promo code', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(
        createMockPromoCode({ isActive: false })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'EXPIRED',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(stripeCall.metadata.promoCode).toBe('');
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(0);
    });

    it('should ignore expired promo code', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(
        createMockPromoCode({
          isActive: true,
          endsAt: new Date('2020-01-01'),
        })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'EXPIRED',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(0);
    });

    it('should ignore promo code that exceeded usage limit', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(
        createMockPromoCode({
          isActive: true,
          usageLimit: 5,
          usageCount: 5,
        })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'MAXED',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(0);
    });

    it('should cap discount at maxDiscount when set', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(
        createMockPromoCode({
          type: 'PERCENTAGE',
          value: 50, // 50% of 100 = 50
          maxDiscount: 20,
        })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'BIG50',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(20);
    });

    it('should ignore non-existent promo code', async () => {
      mockPrisma.promoCode.findUnique.mockResolvedValue(null);

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
        promoCode: 'FAKE',
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.promoDiscount)).toBe(0);
    });
  });

  // -------------------------------------------------
  // 5. Tax calculation correctness
  // -------------------------------------------------
  describe('tax calculation', () => {
    beforeEach(() => {
      mockPrisma.product.findUnique.mockResolvedValue(
        createMockProduct({ price: 100 })
      );
    });

    it('should calculate Quebec taxes correctly (GST 5% + QST 9.975%)', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.taxTps)).toBe(5);
      expect(parseFloat(stripeCall.metadata.taxTvq)).toBe(9.98); // rounded
      expect(parseFloat(stripeCall.metadata.taxTvh)).toBe(0);
    });

    it('should calculate Ontario taxes correctly (HST 13%)', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'ON', country: 'CA' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.taxTps)).toBe(0);
      expect(parseFloat(stripeCall.metadata.taxTvq)).toBe(0);
      expect(parseFloat(stripeCall.metadata.taxTvh)).toBe(13);
    });

    it('should calculate Alberta taxes correctly (GST 5% only)', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'AB', country: 'CA' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.taxTps)).toBe(5);
      expect(parseFloat(stripeCall.metadata.taxTvq)).toBe(0);
      expect(parseFloat(stripeCall.metadata.taxTvh)).toBe(0);
    });

    it('should calculate New Brunswick taxes correctly (HST 15%)', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'NB', country: 'CA' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.taxTvh)).toBe(15);
    });
  });

  // -------------------------------------------------
  // 6. Shipping cost
  // -------------------------------------------------
  describe('shipping calculation', () => {
    beforeEach(() => {
      mockPrisma.product.findUnique.mockResolvedValue(
        createMockProduct({ price: 50 })
      );
    });

    it('should charge $9.99 shipping for Canadian orders under $100', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.shippingCost)).toBe(9.99);
    });

    it('should provide free shipping for Canadian orders >= $100', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(
        createMockProduct({ price: 100 })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'QC', country: 'CA' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.shippingCost)).toBe(0);
    });

    it('should charge $14.99 shipping for US orders', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: 'NY', country: 'US' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.shippingCost)).toBe(14.99);
    });

    it('should charge $24.99 shipping for international orders', async () => {
      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: { province: '', country: 'FR' },
      });

      await POST(request);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(parseFloat(stripeCall.metadata.shippingCost)).toBe(24.99);
    });
  });

  // -------------------------------------------------
  // 7. Guest checkout
  // -------------------------------------------------
  describe('guest checkout', () => {
    it('should allow checkout without authenticated session', async () => {
      mockAuth.mockResolvedValue(null);
      mockPrisma.product.findUnique.mockResolvedValue(
        createMockProduct({ price: 50 })
      );

      const request = makeRequest({
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingInfo: {
          province: 'QC',
          country: 'CA',
          email: 'guest@example.com',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const stripeCall = mockStripeCreate.mock.calls[0][0];
      expect(stripeCall.metadata.userId).toBe('guest');
      expect(stripeCall.customer_email).toBe('guest@example.com');
    });
  });
});

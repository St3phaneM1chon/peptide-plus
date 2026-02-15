/**
 * @jest-environment node
 */

/**
 * Unit Tests - Stripe Webhook Handler
 *
 * Tests the webhook at /api/payments/webhook:
 * - Signature verification
 * - checkout.session.completed handling (order creation)
 * - Duplicate event handling (idempotence)
 * - payment_intent.payment_failed handling
 * - payment_intent.succeeded handling
 */

import {
  createMockPrisma,
  createMockCheckoutSession,
  createMockPaymentIntent,
  createMockOrder,
} from '../helpers/mocks';

// =====================================================
// MODULE MOCKS
// =====================================================

jest.mock('@/lib/db', () => {
  const { createMockPrisma: _createMockPrisma } = jest.requireActual('../helpers/mocks');
  const _mockPrisma = _createMockPrisma();
  return { prisma: _mockPrisma, db: _mockPrisma };
});

// Mock email module
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  orderConfirmationEmail: jest.fn().mockReturnValue({
    subject: 'Confirmation',
    html: '<p>Confirmed</p>',
  }),
}));

// Mock accounting
jest.mock('@/lib/accounting/webhook-accounting.service', () => ({
  createAccountingEntriesForOrder: jest.fn().mockResolvedValue({
    saleEntryId: 'journal-1',
    feeEntryId: 'journal-2',
    invoiceId: 'inv-1',
  }),
}));

// Mock inventory
jest.mock('@/lib/inventory', () => ({
  generateCOGSEntry: jest.fn().mockResolvedValue(undefined),
}));

// Mock Stripe
jest.mock('stripe', () => {
  const constructEvent = jest.fn();
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent,
    },
  }));
});

// Import after mocks
import { POST } from '@/app/api/payments/webhook/route';
import { NextRequest } from 'next/server';

// Resolved mock references
let mockPrisma: ReturnType<typeof createMockPrisma>;
let mockConstructEvent: jest.Mock;

beforeAll(() => {
  mockPrisma = (require('@/lib/db') as { prisma: ReturnType<typeof createMockPrisma> }).prisma;
  mockConstructEvent = new (require('stripe'))().webhooks.constructEvent;
});

// =====================================================
// HELPERS
// =====================================================

function makeWebhookRequest(body: string = '{}', signature: string = 'valid-sig') {
  return new NextRequest('http://localhost:3000/api/payments/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });
}

// =====================================================
// TESTS
// =====================================================

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: event not yet processed (no idempotence hit)
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.webhookEvent.upsert.mockResolvedValue({ id: 'wh-1' });
    mockPrisma.webhookEvent.update.mockResolvedValue({ id: 'wh-1' });
  });

  // -------------------------------------------------
  // 1. Signature verification
  // -------------------------------------------------
  describe('signature verification', () => {
    it('should return 400 when signature is invalid', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const request = makeWebhookRequest('{}', 'bad-signature');
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('signature');
    });

    it('should accept valid signatures', async () => {
      const checkoutSession = createMockCheckoutSession();
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_1',
        type: 'checkout.session.completed',
        data: { object: checkoutSession },
      });

      // Set up transaction mock for order creation
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = createMockPrisma();
        txMock.order.create.mockResolvedValue(createMockOrder());
        txMock.inventoryReservation.findMany.mockResolvedValue([]);
        return fn(txMock);
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.currency.findUnique.mockResolvedValue({
        id: 'curr-1',
        code: 'CAD',
        name: 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      });
      mockPrisma.currency.findFirst.mockResolvedValue(null);

      const request = makeWebhookRequest('valid-body', 'valid-sig');
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  // -------------------------------------------------
  // 2. checkout.session.completed
  // -------------------------------------------------
  describe('checkout.session.completed', () => {
    it('should create an order from checkout session metadata', async () => {
      const checkoutSession = createMockCheckoutSession();
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_checkout',
        type: 'checkout.session.completed',
        data: { object: checkoutSession },
      });

      const createdOrder = createMockOrder();
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = createMockPrisma();
        txMock.order.create.mockResolvedValue(createdOrder);
        txMock.inventoryReservation.findMany.mockResolvedValue([]);
        return fn(txMock);
      });
      mockPrisma.currency.findUnique.mockResolvedValue({
        id: 'curr-1',
        code: 'CAD',
        name: 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        locale: 'fr',
      });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);
    });

    it('should record the webhook event for tracking', async () => {
      const checkoutSession = createMockCheckoutSession();
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_record',
        type: 'checkout.session.completed',
        data: { object: checkoutSession },
      });

      const createdOrder = createMockOrder();
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txMock = createMockPrisma();
        txMock.order.create.mockResolvedValue(createdOrder);
        txMock.inventoryReservation.findMany.mockResolvedValue([]);
        return fn(txMock);
      });
      mockPrisma.currency.findUnique.mockResolvedValue({
        id: 'curr-1',
        code: 'CAD',
        name: 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = makeWebhookRequest('body', 'sig');
      await POST(request);

      // Should have recorded the webhook event
      expect(mockPrisma.webhookEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: 'evt_test_record' },
          update: { status: 'PROCESSING' },
          create: expect.objectContaining({
            eventId: 'evt_test_record',
            eventType: 'checkout.session.completed',
            status: 'PROCESSING',
          }),
        })
      );
    });
  });

  // -------------------------------------------------
  // 3. Idempotence (duplicate events)
  // -------------------------------------------------
  describe('idempotence / duplicate handling', () => {
    it('should return 200 and skip processing for already-completed events', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_already_processed',
        type: 'checkout.session.completed',
        data: { object: createMockCheckoutSession() },
      });

      // Simulate the event already being marked as COMPLETED
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        eventId: 'evt_already_processed',
        status: 'COMPLETED',
        processedAt: new Date(),
      });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.duplicate).toBe(true);

      // Should NOT have tried to record or process the event again
      expect(mockPrisma.webhookEvent.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should process events that are in PROCESSING state (retry scenario)', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_retried',
        type: 'payment_intent.succeeded',
        data: { object: createMockPaymentIntent() },
      });

      // Event exists but status is PROCESSING (previous attempt may have crashed)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        eventId: 'evt_retried',
        status: 'PROCESSING',
      });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);

      expect(response.status).toBe(200);
      // Should have processed the event since it was not COMPLETED
      expect(mockPrisma.webhookEvent.upsert).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------
  // 4. payment_intent.payment_failed
  // -------------------------------------------------
  describe('payment_intent.payment_failed', () => {
    it('should mark order as FAILED and CANCELLED', async () => {
      const paymentIntent = createMockPaymentIntent({
        id: 'pi_failed_123',
        status: 'requires_payment_method',
      });

      mockConstructEvent.mockReturnValue({
        id: 'evt_test_fail',
        type: 'payment_intent.payment_failed',
        data: { object: paymentIntent },
      });

      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.findFirst.mockResolvedValue(
        createMockOrder({ stripePaymentId: 'pi_failed_123' })
      );
      mockPrisma.inventoryReservation.updateMany.mockResolvedValue({ count: 0 });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentId: 'pi_failed_123' },
        data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
      });
    });

    it('should release inventory reservations on payment failure', async () => {
      const paymentIntent = createMockPaymentIntent({
        id: 'pi_failed_inv',
      });

      mockConstructEvent.mockReturnValue({
        id: 'evt_test_fail_inv',
        type: 'payment_intent.payment_failed',
        data: { object: paymentIntent },
      });

      const order = createMockOrder({ id: 'order-inv', stripePaymentId: 'pi_failed_inv' });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.findFirst.mockResolvedValue(order);
      mockPrisma.inventoryReservation.updateMany.mockResolvedValue({ count: 2 });

      const request = makeWebhookRequest('body', 'sig');
      await POST(request);

      expect(mockPrisma.inventoryReservation.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'order-inv', status: 'RESERVED' },
        data: expect.objectContaining({
          status: 'RELEASED',
        }),
      });
    });
  });

  // -------------------------------------------------
  // 5. payment_intent.succeeded
  // -------------------------------------------------
  describe('payment_intent.succeeded', () => {
    it('should mark order as PAID', async () => {
      const paymentIntent = createMockPaymentIntent({
        id: 'pi_success_123',
      });

      mockConstructEvent.mockReturnValue({
        id: 'evt_test_success',
        type: 'payment_intent.succeeded',
        data: { object: paymentIntent },
      });

      mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentId: 'pi_success_123' },
        data: { paymentStatus: 'PAID' },
      });
    });
  });

  // -------------------------------------------------
  // 6. Unhandled event types
  // -------------------------------------------------
  describe('unhandled event types', () => {
    it('should return 200 for unhandled event types', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_unhandled',
        type: 'customer.subscription.created',
        data: { object: {} },
      });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);
    });
  });

  // -------------------------------------------------
  // 7. Error handling
  // -------------------------------------------------
  describe('error handling', () => {
    it('should mark webhook event as FAILED on processing error', async () => {
      mockConstructEvent.mockReturnValue({
        id: 'evt_test_error',
        type: 'checkout.session.completed',
        data: { object: createMockCheckoutSession() },
      });

      // Simulate a DB error during transaction
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection lost'));
      mockPrisma.currency.findUnique.mockResolvedValue({
        id: 'curr-1',
        code: 'CAD',
        name: 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      });

      const request = makeWebhookRequest('body', 'sig');
      const response = await POST(request);

      expect(response.status).toBe(500);
      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: 'evt_test_error' },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Database connection lost',
          }),
        })
      );
    });
  });
});

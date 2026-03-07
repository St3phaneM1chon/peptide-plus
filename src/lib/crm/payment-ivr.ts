/**
 * PCI DSS PAYMENT IVR
 * Secure payment collection via IVR (Interactive Voice Response).
 * Handles DTMF input for card details with masked logging.
 *
 * SECURITY: NEVER log raw card numbers, CVV, or full expiry.
 * All card data is masked before any logging occurs.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentSession {
  sessionId: string;
  callId: string;
  amount: number;
  currency: string;
  status: 'collecting_card' | 'collecting_expiry' | 'collecting_cvv' | 'ready' | 'processing' | 'completed' | 'failed';
  cardNumber: string;
  expiry: string;
  cvv: string;
  createdAt: number;
  expiresAt: number;
}

interface PaymentIvrConfig {
  enabled: boolean;
  maxAmount: number;
  supportedCurrencies: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes max per payment session
const MAX_AMOUNT = 50_000;
const SUPPORTED_CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'];

// Card field lengths
const CARD_NUMBER_LENGTH = 16;
const EXPIRY_LENGTH = 4; // MMYY
const CVV_MIN_LENGTH = 3;
const CVV_MAX_LENGTH = 4;

// ---------------------------------------------------------------------------
// In-memory session store (short-lived, never persisted)
// In production, use a PCI-compliant tokenization vault.
// ---------------------------------------------------------------------------

const sessions = new Map<string, PaymentSession>();

// Cleanup expired sessions every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      // Securely clear sensitive data before deletion
      session.cardNumber = '';
      session.expiry = '';
      session.cvv = '';
      sessions.delete(id);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Masking utilities (PCI DSS compliance)
// ---------------------------------------------------------------------------

/**
 * Mask a card number to show only the last 4 digits.
 * NEVER log the full card number.
 */
function maskCardNumber(cardNumber: string): string {
  if (cardNumber.length < 4) return '****';
  return '*'.repeat(cardNumber.length - 4) + cardNumber.slice(-4);
}

/**
 * Mask expiry to show only format indicator.
 */
function maskExpiry(expiry: string): string {
  if (!expiry) return '****';
  return '**/**';
}

/**
 * CVV is ALWAYS fully masked. Never reveal any CVV digits.
 */
function maskCvv(): string {
  return '***';
}

// ---------------------------------------------------------------------------
// Luhn check for card number validation
// ---------------------------------------------------------------------------

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Validate expiry is not in the past and is a valid month.
 */
function validateExpiry(expiry: string): boolean {
  if (expiry.length !== EXPIRY_LENGTH) return false;

  const month = parseInt(expiry.slice(0, 2), 10);
  const year = parseInt(expiry.slice(2, 4), 10) + 2000;

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const expiryDate = new Date(year, month, 0); // Last day of expiry month

  return expiryDate >= now;
}

// ---------------------------------------------------------------------------
// Lazy Stripe loader
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stripeInstance: any = null;
let stripeLoadAttempted = false;

function getStripe() {
  if (stripeLoadAttempted) return stripeInstance;
  stripeLoadAttempted = true;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    logger.warn('STRIPE_SECRET_KEY not configured. Payment IVR will use mock processing.');
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    stripeInstance = new Stripe(key);
    logger.info('Stripe initialized for Payment IVR');
  } catch {
    logger.warn('stripe package not available. Payment IVR will use mock processing.');
  }

  return stripeInstance;
}

// ---------------------------------------------------------------------------
// Initiate Payment IVR
// ---------------------------------------------------------------------------

/**
 * Start a secure payment collection session for a call.
 * Creates a new session and begins collecting card number via DTMF.
 *
 * @param callId - The active call identifier
 * @param amount - Amount to charge (in major currency units, e.g., 99.99)
 * @param currency - ISO 4217 currency code
 */
export async function initiatePaymentIvr(
  callId: string,
  amount: number,
  currency: string
): Promise<{ sessionId: string; status: string }> {
  // Validate amount
  if (amount <= 0 || amount > MAX_AMOUNT) {
    logger.warn('Payment IVR: invalid amount', { callId, amount });
    return { sessionId: '', status: 'error_invalid_amount' };
  }

  // Validate currency
  const upperCurrency = currency.toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(upperCurrency)) {
    logger.warn('Payment IVR: unsupported currency', { callId, currency });
    return { sessionId: '', status: 'error_unsupported_currency' };
  }

  const sessionId = `piv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();

  const session: PaymentSession = {
    sessionId,
    callId,
    amount,
    currency: upperCurrency,
    status: 'collecting_card',
    cardNumber: '',
    expiry: '',
    cvv: '',
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessions.set(sessionId, session);

  // Log without sensitive data
  logger.info('Payment IVR session initiated', {
    sessionId,
    callId,
    amount,
    currency: upperCurrency,
    status: 'collecting_card',
  });

  return { sessionId, status: 'collecting_card' };
}

// ---------------------------------------------------------------------------
// Process DTMF Input
// ---------------------------------------------------------------------------

/**
 * Process DTMF digit input during a payment IVR session.
 * Sequentially collects: card number (16 digits) -> expiry (4 digits MMYY) -> CVV (3-4 digits).
 *
 * SECURITY: Input is NEVER logged in clear text. Only masked values appear in logs.
 *
 * @param sessionId - Active payment session ID
 * @param digits - DTMF digits received (may be partial or complete)
 * @returns { complete: boolean, field: string } - current field being collected
 */
export async function processPaymentDtmf(
  sessionId: string,
  digits: string
): Promise<{ complete: boolean; field: string }> {
  const session = sessions.get(sessionId);

  if (!session) {
    logger.warn('Payment IVR: session not found', { sessionId });
    return { complete: false, field: 'error_session_not_found' };
  }

  // Check session expiry
  if (Date.now() > session.expiresAt) {
    // Clear sensitive data
    session.cardNumber = '';
    session.expiry = '';
    session.cvv = '';
    sessions.delete(sessionId);

    logger.warn('Payment IVR: session expired', { sessionId });
    return { complete: false, field: 'error_session_expired' };
  }

  // Sanitize input: only digits
  const cleanDigits = digits.replace(/\D/g, '');

  switch (session.status) {
    case 'collecting_card': {
      session.cardNumber += cleanDigits;

      if (session.cardNumber.length >= CARD_NUMBER_LENGTH) {
        session.cardNumber = session.cardNumber.slice(0, CARD_NUMBER_LENGTH);

        // Validate with Luhn
        if (!luhnCheck(session.cardNumber)) {
          logger.info('Payment IVR: card number failed Luhn check', {
            sessionId,
            lastFour: session.cardNumber.slice(-4),
          });
          session.cardNumber = '';
          return { complete: false, field: 'card_number_invalid' };
        }

        session.status = 'collecting_expiry';
        logger.info('Payment IVR: card number collected', {
          sessionId,
          masked: maskCardNumber(session.cardNumber),
        });
        return { complete: false, field: 'expiry' };
      }

      return { complete: false, field: 'card_number' };
    }

    case 'collecting_expiry': {
      session.expiry += cleanDigits;

      if (session.expiry.length >= EXPIRY_LENGTH) {
        session.expiry = session.expiry.slice(0, EXPIRY_LENGTH);

        if (!validateExpiry(session.expiry)) {
          logger.info('Payment IVR: invalid expiry', {
            sessionId,
            masked: maskExpiry(session.expiry),
          });
          session.expiry = '';
          return { complete: false, field: 'expiry_invalid' };
        }

        session.status = 'collecting_cvv';
        logger.info('Payment IVR: expiry collected', {
          sessionId,
          masked: maskExpiry(session.expiry),
        });
        return { complete: false, field: 'cvv' };
      }

      return { complete: false, field: 'expiry' };
    }

    case 'collecting_cvv': {
      session.cvv += cleanDigits;

      if (session.cvv.length >= CVV_MIN_LENGTH) {
        if (session.cvv.length > CVV_MAX_LENGTH) {
          session.cvv = session.cvv.slice(0, CVV_MAX_LENGTH);
        }

        session.status = 'ready';
        logger.info('Payment IVR: CVV collected, ready for payment', {
          sessionId,
          masked: maskCvv(),
        });
        return { complete: true, field: 'complete' };
      }

      return { complete: false, field: 'cvv' };
    }

    default: {
      logger.warn('Payment IVR: unexpected DTMF in status', {
        sessionId,
        status: session.status,
      });
      return { complete: false, field: session.status };
    }
  }
}

// ---------------------------------------------------------------------------
// Complete Payment
// ---------------------------------------------------------------------------

/**
 * Finalize the payment using collected card details.
 * Creates a Stripe payment intent (or mock if Stripe unavailable).
 *
 * SECURITY: Card data is cleared from memory immediately after processing,
 * regardless of success or failure. Data is NEVER logged in clear text.
 */
export async function completePayment(
  sessionId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const session = sessions.get(sessionId);

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (session.status === 'completed') {
    return { success: false, error: 'Payment already completed for this session' };
  }

  if (session.status !== 'ready') {
    return { success: false, error: `Payment not ready. Current status: ${session.status}` };
  }

  if (Date.now() > session.expiresAt) {
    session.cardNumber = '';
    session.expiry = '';
    session.cvv = '';
    sessions.delete(sessionId);
    return { success: false, error: 'Session expired' };
  }

  session.status = 'processing';

  try {
    const stripe = getStripe();
    let transactionId: string;

    if (stripe) {
      // Create a payment method and charge via Stripe
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: session.cardNumber,
          exp_month: parseInt(session.expiry.slice(0, 2), 10),
          exp_year: parseInt(session.expiry.slice(2, 4), 10) + 2000,
          cvc: session.cvv,
        },
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(session.amount * 100), // Stripe uses cents
        currency: session.currency.toLowerCase(),
        payment_method: paymentMethod.id,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          callId: session.callId,
          channel: 'ivr',
        },
      }, {
        idempotencyKey: `ivr_${session.sessionId}`,
      });

      transactionId = paymentIntent.id;

      logger.info('Payment IVR: payment completed via Stripe', {
        sessionId,
        transactionId,
        amount: session.amount,
        currency: session.currency,
        cardLast4: session.cardNumber.slice(-4),
      });
    } else {
      // Mock payment for development/testing
      transactionId = `mock_pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      logger.info('Payment IVR: mock payment completed', {
        sessionId,
        transactionId,
        amount: session.amount,
        currency: session.currency,
        cardLast4: session.cardNumber.slice(-4),
      });
    }

    session.status = 'completed';

    return { success: true, transactionId };
  } catch (error) {
    session.status = 'failed';

    logger.error('Payment IVR: payment failed', {
      sessionId,
      amount: session.amount,
      currency: session.currency,
      cardLast4: session.cardNumber.slice(-4),
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed',
    };
  } finally {
    // CRITICAL: Clear all sensitive card data from memory immediately
    session.cardNumber = '';
    session.expiry = '';
    session.cvv = '';

    // Remove session from store after a brief delay (allow response to complete)
    setTimeout(() => {
      sessions.delete(sessionId);
    }, 5_000);
  }
}

// ---------------------------------------------------------------------------
// Payment IVR Configuration
// ---------------------------------------------------------------------------

/**
 * Get the current payment IVR configuration.
 */
export function getPaymentIvrConfig(): PaymentIvrConfig {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const ivrEnabled = process.env.PAYMENT_IVR_ENABLED !== 'false';

  return {
    enabled: ivrEnabled && !!stripeKey,
    maxAmount: MAX_AMOUNT,
    supportedCurrencies: [...SUPPORTED_CURRENCIES],
  };
}

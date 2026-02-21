/**
 * SMS Service - Twilio
 * Sends SMS notifications for order events
 *
 * Improvement #85: Replaced console.log/error with structured logger
 * Improvement #91: Removed hardcoded phone number fallback
 */

import { logger } from '@/lib/logger';

interface SendSmsParams {
  to: string;
  body: string;
}

/**
 * Send an SMS via Twilio
 * Requires environment variables:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_PHONE_NUMBER (sender)
 */
export async function sendSms({ to, body }: SendSmsParams): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger.warn('SMS: Twilio credentials not configured, skipping SMS', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFromNumber: !!fromNumber,
    });
    return false;
  }

  try {
    // Format Canadian phone number
    const formattedTo = formatPhoneNumber(to);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: fromNumber,
          Body: body,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      logger.error('SMS send failed', {
        to: formattedTo,
        status: response.status,
        twilioError: error?.message || error?.code,
      });
      return false;
    }

    logger.info('SMS sent successfully', {
      to: formattedTo,
      bodyPreview: body.substring(0, 50),
    });
    return true;
  } catch (error) {
    logger.error('SMS service error', {
      error: error instanceof Error ? error.message : String(error),
      to,
    });
    return false;
  }
}

/**
 * Format phone number to E.164 format
 * Handles Canadian numbers (e.g., 514-555-1234 -> +15145551234)
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If already starts with country code
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }

  // Assume Canadian/US number
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Return as-is with + prefix
  return `+${digits}`;
}

/**
 * Get the admin phone number from environment.
 * Throws in production if not configured.
 */
function getAdminPhone(adminPhoneOverride?: string): string | null {
  const phone = adminPhoneOverride || process.env.ADMIN_SMS_PHONE;

  if (!phone) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('ADMIN_SMS_PHONE is not configured in production');
      throw new Error('ADMIN_SMS_PHONE environment variable is required in production');
    }
    logger.warn('ADMIN_SMS_PHONE not configured, skipping admin SMS notification');
    return null;
  }

  return phone;
}

/**
 * Send order notification SMS to admin
 */
export async function sendOrderNotificationSms(
  orderTotal: number,
  orderNumber: string,
  adminPhone?: string,
  currency: string = 'CAD'
): Promise<boolean> {
  const phone = getAdminPhone(adminPhone);
  if (!phone) return false;

  const formattedTotal = new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
  }).format(orderTotal);

  return sendSms({
    to: phone,
    body: `Une commande vient d'arriver au montant de ${formattedTotal} (Commande #${orderNumber})`,
  });
}

/**
 * Send payment failure alert SMS to admin
 */
export async function sendPaymentFailureAlertSms(
  errorType: string,
  amount: number,
  customerEmail?: string,
  adminPhone?: string,
  currency: string = 'CAD'
): Promise<boolean> {
  const phone = getAdminPhone(adminPhone);
  if (!phone) return false;

  const formattedAmount = new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
  }).format(amount);

  const customerInfo = customerEmail ? ` - Client: ${customerEmail}` : '';

  return sendSms({
    to: phone,
    body: `ALERTE: Echec de paiement ${formattedAmount}. Raison: ${errorType}${customerInfo}`,
  });
}

/**
 * SMS Service - Twilio
 * Sends SMS notifications for order events
 */

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
    console.warn('SMS: Twilio credentials not configured, skipping SMS');
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
      console.error('SMS send failed:', error);
      return false;
    }

    console.log(`SMS sent to ${formattedTo}: ${body.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error('SMS service error:', error);
    return false;
  }
}

/**
 * Format phone number to E.164 format
 * Handles Canadian numbers (450-847-4741 -> +14508474741)
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
 * Send order notification SMS to admin
 */
export async function sendOrderNotificationSms(
  orderTotal: number,
  orderNumber: string,
  adminPhone?: string
): Promise<boolean> {
  // Use admin phone from param, or fall back to env var, or hardcoded default
  const phone = adminPhone
    || process.env.ADMIN_SMS_PHONE
    || '450-847-4741';

  const formattedTotal = new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
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
  adminPhone?: string
): Promise<boolean> {
  const phone = adminPhone
    || process.env.ADMIN_SMS_PHONE
    || '450-847-4741';

  const formattedAmount = new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);

  const customerInfo = customerEmail ? ` - Client: ${customerEmail}` : '';

  return sendSms({
    to: phone,
    body: `ALERTE: Échec de paiement ${formattedAmount}. Raison: ${errorType}${customerInfo}`,
  });
}

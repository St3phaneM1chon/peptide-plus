/**
 * SMS Engine — Bidirectional SMS via Telnyx Messaging API
 *
 * Features:
 * - Send SMS (single + bulk)
 * - Receive SMS (webhook handler)
 * - Link to InboxConversation (CRM unified inbox)
 * - Opt-out handling (STOP/ARRET) via SmsOptOut model
 * - E-commerce notifications (order confirmed, shipped, delivered)
 * - CrmActivity logging for outbound & inbound messages
 *
 * Prisma models used:
 *   InboxConversation  — channel: InboxChannel (SMS), status: InboxStatus
 *   InboxMessage       — direction: MessageDirection (INBOUND/OUTBOUND)
 *   CrmActivity        — type: CrmActivityType (SMS)
 *   SmsOptOut           — phone-level opt-out list
 *   User               — contact lookup by phone
 *   CrmLead            — lead lookup by phone
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendPushToStaff } from '@/lib/apns';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || '';
const DEFAULT_FROM = process.env.TELNYX_DEFAULT_CALLER_ID || '+14388030370';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendSMSOptions {
  to: string;
  from?: string;
  text: string;
  /** Link to a User (contact) in CRM */
  contactId?: string;
  /** Link to a CrmLead */
  leadId?: string;
  /** Link to a CrmDeal */
  dealId?: string;
  /** transactional = order updates, marketing = promos (checked against opt-out) */
  type?: 'transactional' | 'marketing';
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkSMSOptions {
  recipients: Array<{ to: string; contactId?: string; leadId?: string }>;
  text: string;
  from?: string;
  type?: 'transactional' | 'marketing';
}

export interface BulkSMSResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results: Array<SendSMSResult & { to: string }>;
}

export interface IncomingSMSPayload {
  from: string;
  to: string;
  text: string;
  messageId?: string;
}

// ---------------------------------------------------------------------------
// Send SMS
// ---------------------------------------------------------------------------

/**
 * Send a single SMS via Telnyx Messaging API v2.
 *
 * - Marketing messages are checked against SmsOptOut before sending.
 * - A CrmActivity record is created when contactId or leadId is provided.
 * - The message is logged to the InboxConversation for the contact/lead.
 */
export async function sendSMS(options: SendSMSOptions): Promise<SendSMSResult> {
  const {
    to,
    from = DEFAULT_FROM,
    text,
    contactId,
    leadId,
    dealId,
    type = 'transactional',
  } = options;

  if (!TELNYX_API_KEY) {
    logger.warn('[SMS Engine] No TELNYX_API_KEY configured — cannot send');
    return { success: false, error: 'SMS not configured' };
  }

  // Opt-out check for marketing messages
  if (type === 'marketing') {
    const optedOut = await isOptedOut(to);
    if (optedOut) {
      logger.info('[SMS Engine] Recipient opted out, skipping', { to: maskPhone(to) });
      return { success: false, error: 'Recipient opted out' };
    }
  }

  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        text,
        type: 'SMS',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Telnyx ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const messageId: string | undefined = data?.data?.id;

    // Log to CRM activity (fire-and-forget)
    logCrmActivity({
      direction: 'outbound',
      phone: to,
      text,
      messageId,
      contactId,
      leadId,
      dealId,
    }).catch((err) =>
      logger.warn('[SMS Engine] CRM activity log failed', { error: String(err) }),
    );

    // Add to InboxConversation (fire-and-forget)
    upsertInboxMessage({
      direction: 'OUTBOUND',
      phone: to,
      text,
      messageId,
      contactId,
      leadId,
      senderName: 'Attitudes VIP',
    }).catch((err) =>
      logger.warn('[SMS Engine] Inbox message log failed', { error: String(err) }),
    );

    logger.info('[SMS Engine] Sent successfully', { to: maskPhone(to), messageId });
    return { success: true, messageId };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('[SMS Engine] Send failed', { to: maskPhone(to), error: errMsg });
    return { success: false, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// Bulk Send
// ---------------------------------------------------------------------------

/**
 * Send SMS to multiple recipients sequentially (respects Telnyx rate limits).
 * Returns aggregate results.
 */
export async function sendBulkSMS(options: BulkSMSOptions): Promise<BulkSMSResult> {
  const { recipients, text, from, type = 'transactional' } = options;
  const results: BulkSMSResult['results'] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const result = await sendSMS({
      to: recipient.to,
      from,
      text,
      contactId: recipient.contactId,
      leadId: recipient.leadId,
      type,
    });

    if (result.success) {
      sent++;
    } else if (result.error === 'Recipient opted out') {
      skipped++;
    } else {
      failed++;
    }

    results.push({ ...result, to: recipient.to });
  }

  logger.info('[SMS Engine] Bulk send complete', {
    total: recipients.length,
    sent,
    failed,
    skipped,
  });

  return { total: recipients.length, sent, failed, skipped, results };
}

// ---------------------------------------------------------------------------
// Handle Incoming SMS
// ---------------------------------------------------------------------------

/**
 * Process an incoming SMS from the Telnyx webhook.
 *
 * 1. Checks for opt-out keywords (STOP, ARRET, etc.) — auto-replies confirmation.
 * 2. Checks for opt-in keywords (START, OUI) — removes from SmsOptOut.
 * 3. Finds or creates an InboxConversation (channel=SMS).
 * 4. Adds InboxMessage with direction=INBOUND.
 * 5. Creates CrmActivity for the matched contact/lead.
 * 6. Sends push notification to staff.
 */
export async function handleIncomingSMS(payload: IncomingSMSPayload): Promise<void> {
  const { from, to, text, messageId } = payload;
  const trimmedText = text.trim().toLowerCase();

  logger.info('[SMS Engine] Incoming', { from: maskPhone(from), textLength: text.length });

  // ── Opt-out handling ──
  const optOutKeywords = ['stop', 'arret', 'arrêt', 'unsubscribe', 'désabonner', 'desabonner'];
  if (optOutKeywords.includes(trimmedText)) {
    await handleOptOut(from);
    // Auto-reply confirmation
    await sendSMS({
      to: from,
      from: to,
      text: 'Vous avez été désabonné des messages SMS. Répondez START pour vous réabonner.',
    });
    logger.info('[SMS Engine] Opt-out processed', { from: maskPhone(from) });
    return;
  }

  // ── Opt-in handling ──
  if (trimmedText === 'start' || trimmedText === 'oui') {
    await handleOptIn(from);
    await sendSMS({
      to: from,
      from: to,
      text: "Vous êtes maintenant réabonné aux messages SMS d'Attitudes VIP.",
    });
    logger.info('[SMS Engine] Opt-in processed', { from: maskPhone(from) });
    return;
  }

  // ── Lookup contact or lead by phone ──
  const { user, lead } = await lookupByPhone(from);

  // ── Upsert InboxConversation + InboxMessage ──
  const conversationId = await upsertInboxMessage({
    direction: 'INBOUND',
    phone: from,
    text,
    messageId,
    contactId: user?.id,
    leadId: lead?.id,
    senderName: user?.name || lead?.contactName || from,
    senderPhone: from,
  });

  // ── CRM Activity ──
  logCrmActivity({
    direction: 'inbound',
    phone: from,
    text,
    messageId,
    contactId: user?.id,
    leadId: lead?.id,
  }).catch((err) =>
    logger.warn('[SMS Engine] CRM activity log failed', { error: String(err) }),
  );

  // ── Push notification to staff ──
  sendPushToStaff({
    title: `SMS de ${user?.name || lead?.contactName || from}`,
    body: text.slice(0, 200) || 'Nouveau message',
    category: 'SMS',
    sound: 'SMS.caf',
    data: { from, type: 'sms', conversationId },
  }).catch(() => {});

  logger.info('[SMS Engine] Incoming processed', {
    from: maskPhone(from),
    conversationId,
    hasUser: !!user,
    hasLead: !!lead,
  });
}

// ---------------------------------------------------------------------------
// Opt-out Management (SmsOptOut model)
// ---------------------------------------------------------------------------

/**
 * Check if a phone number is in the SmsOptOut list.
 */
export async function isOptedOut(phoneNumber: string): Promise<boolean> {
  const normalized = normalizePhone(phoneNumber);
  const record = await prisma.smsOptOut.findUnique({
    where: { phone: normalized },
  });
  return !!record;
}

/**
 * Add a phone number to the opt-out list.
 */
async function handleOptOut(phoneNumber: string): Promise<void> {
  const normalized = normalizePhone(phoneNumber);
  await prisma.smsOptOut.upsert({
    where: { phone: normalized },
    update: { reason: 'STOP keyword received' },
    create: { phone: normalized, reason: 'STOP keyword received' },
  });

  // Also create a CrmConsentRecord for audit trail
  try {
    await prisma.crmConsentRecord.create({
      data: {
        phone: normalized,
        channel: 'SMS',
        type: 'opt_out',
        source: 'sms_keyword',
        notes: 'STOP keyword received via SMS',
      },
    });
  } catch (err) {
    logger.warn('[SMS Engine] CrmConsentRecord creation failed', { error: String(err) });
  }

  logger.info('[SMS Engine] Opt-out recorded', { phone: maskPhone(normalized) });
}

/**
 * Remove a phone number from the opt-out list (re-subscribe).
 */
async function handleOptIn(phoneNumber: string): Promise<void> {
  const normalized = normalizePhone(phoneNumber);
  await prisma.smsOptOut.delete({
    where: { phone: normalized },
  }).catch(() => {
    // Not found — already opted in, no-op
  });

  // Audit trail
  try {
    await prisma.crmConsentRecord.create({
      data: {
        phone: normalized,
        channel: 'SMS',
        type: 'opt_in',
        source: 'sms_keyword',
        notes: 'START keyword received via SMS',
      },
    });
  } catch (err) {
    logger.warn('[SMS Engine] CrmConsentRecord creation failed', { error: String(err) });
  }

  logger.info('[SMS Engine] Opt-in recorded', { phone: maskPhone(normalized) });
}

// ---------------------------------------------------------------------------
// Inbox Conversation Management
// ---------------------------------------------------------------------------

/**
 * Find or create an InboxConversation (channel=SMS) and add an InboxMessage.
 * Returns the conversationId.
 */
async function upsertInboxMessage(params: {
  direction: 'INBOUND' | 'OUTBOUND';
  phone: string;
  text: string;
  messageId?: string;
  contactId?: string;
  leadId?: string;
  senderName?: string;
  senderPhone?: string;
}): Promise<string> {
  const { direction, phone, text, messageId, contactId, leadId, senderName, senderPhone } = params;

  // Find existing open/pending conversation for this contact/lead on SMS channel
  let conversation = await prisma.inboxConversation.findFirst({
    where: {
      channel: 'SMS',
      status: { in: ['OPEN', 'PENDING'] },
      ...(contactId ? { contactId } : leadId ? { leadId } : {}),
    },
    select: { id: true },
    orderBy: { lastMessageAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.inboxConversation.create({
      data: {
        channel: 'SMS',
        status: 'OPEN',
        subject: `SMS — ${senderName || phone}`,
        contactId: contactId || undefined,
        leadId: leadId || undefined,
        lastMessageAt: new Date(),
      },
      select: { id: true },
    });
  }

  // Add message
  await prisma.inboxMessage.create({
    data: {
      conversationId: conversation.id,
      direction,
      content: text,
      senderName: senderName || undefined,
      senderPhone: senderPhone || undefined,
      metadata: { messageId, channel: 'sms', phone },
    },
  });

  // Update lastMessageAt on the conversation
  await prisma.inboxConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  }).catch(() => {});

  return conversation.id;
}

// ---------------------------------------------------------------------------
// CRM Activity Logging
// ---------------------------------------------------------------------------

/**
 * Create a CrmActivity record for an SMS interaction.
 */
async function logCrmActivity(params: {
  direction: 'inbound' | 'outbound';
  phone: string;
  text: string;
  messageId?: string;
  contactId?: string;
  leadId?: string;
  dealId?: string;
}): Promise<void> {
  const { direction, phone, text, messageId, contactId, leadId, dealId } = params;

  const title =
    direction === 'outbound'
      ? `SMS envoyé à ${maskPhone(phone)}`
      : `SMS reçu de ${maskPhone(phone)}`;

  await prisma.crmActivity.create({
    data: {
      type: 'SMS',
      title,
      description: text.substring(0, 500),
      contactId: contactId || undefined,
      leadId: leadId || undefined,
      dealId: dealId || undefined,
      metadata: { messageId, direction, phone },
    },
  });
}

// ---------------------------------------------------------------------------
// E-Commerce Notification Templates
// ---------------------------------------------------------------------------

export const SMS_TEMPLATES = {
  orderConfirmed: (orderNumber: string) =>
    `Merci pour votre commande #${orderNumber} chez Attitudes VIP! Vous recevrez un email de confirmation sous peu.`,

  orderShipped: (orderNumber: string, trackingUrl?: string) =>
    `Votre commande #${orderNumber} a été expédiée!${trackingUrl ? ` Suivez votre colis: ${trackingUrl}` : ''} — Attitudes VIP`,

  orderDelivered: (orderNumber: string) =>
    `Votre commande #${orderNumber} a été livrée! Nous espérons que vous en êtes satisfait. — Attitudes VIP`,

  orderRefunded: (orderNumber: string) =>
    `Votre remboursement pour la commande #${orderNumber} a été traité. Le montant sera crédité sous 5-10 jours ouvrables. — Attitudes VIP`,

  cartAbandoned: (firstName: string) =>
    `Bonjour ${firstName}, vous avez des articles dans votre panier chez Attitudes VIP. Complétez votre commande avant qu'ils ne soient en rupture!`,

  backInStock: (productName: string) =>
    `Bonne nouvelle! ${productName} est de retour en stock chez Attitudes VIP. Commandez maintenant avant rupture!`,

  appointmentReminder: (date: string, time: string) =>
    `Rappel: Vous avez un rendez-vous le ${date} à ${time} avec Attitudes VIP. Répondez OUI pour confirmer.`,

  missedCall: (companyPhone: string) =>
    `Nous avons manqué votre appel chez Attitudes VIP. Rappelons-nous? Répondez OUI ou appelez le ${companyPhone}. Merci!`,

  welcomeNew: (firstName: string) =>
    `Bienvenue chez Attitudes VIP, ${firstName}! Découvrez nos peptides premium. Besoin d'aide? Répondez à ce SMS.`,
} as const;

type TemplateKey = keyof typeof SMS_TEMPLATES;

// Type-safe template argument mapping
interface TemplateArgs {
  orderConfirmed: [orderNumber: string];
  orderShipped: [orderNumber: string, trackingUrl?: string];
  orderDelivered: [orderNumber: string];
  orderRefunded: [orderNumber: string];
  cartAbandoned: [firstName: string];
  backInStock: [productName: string];
  appointmentReminder: [date: string, time: string];
  missedCall: [companyPhone: string];
  welcomeNew: [firstName: string];
}

/**
 * Send an e-commerce notification SMS using a predefined template.
 *
 * @example
 * await sendEcommerceNotification('orderShipped', '+15145551234', 'clx123', 'ORD-2026-001', 'https://track.me/abc');
 */
export async function sendEcommerceNotification<T extends TemplateKey>(
  template: T,
  to: string,
  contactId: string,
  ...args: TemplateArgs[T]
): Promise<SendSMSResult> {
  const templateFn = SMS_TEMPLATES[template] as (...a: TemplateArgs[T]) => string;
  const text = templateFn(...args);

  return sendSMS({
    to,
    text,
    contactId,
    type: 'transactional',
  });
}

/**
 * Send order status notification — convenience wrapper that looks up
 * the customer phone from the Order model.
 */
export async function notifyOrderStatus(
  orderId: string,
  status: 'confirmed' | 'shipped' | 'delivered' | 'refunded',
  trackingUrl?: string,
): Promise<SendSMSResult | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        user: { select: { id: true, phone: true, name: true } },
      },
    });

    if (!order || !order.user?.phone) {
      logger.info('[SMS Engine] Order notification skipped — no phone', { orderId, status });
      return null;
    }

    const orderNumber = order.orderNumber || orderId.slice(-8).toUpperCase();

    switch (status) {
      case 'confirmed':
        return sendEcommerceNotification('orderConfirmed', order.user.phone, order.user.id, orderNumber);
      case 'shipped':
        return sendEcommerceNotification('orderShipped', order.user.phone, order.user.id, orderNumber, trackingUrl);
      case 'delivered':
        return sendEcommerceNotification('orderDelivered', order.user.phone, order.user.id, orderNumber);
      case 'refunded':
        return sendEcommerceNotification('orderRefunded', order.user.phone, order.user.id, orderNumber);
      default:
        return null;
    }
  } catch (error) {
    logger.error('[SMS Engine] Order notification failed', {
      orderId,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Order notification failed' };
  }
}

// ---------------------------------------------------------------------------
// Contact / Lead Lookup
// ---------------------------------------------------------------------------

/**
 * Find a User or CrmLead by phone number.
 * Normalizes the number and tries substring matching for the last 10 digits.
 */
async function lookupByPhone(
  phoneNumber: string,
): Promise<{ user: { id: string; name: string | null } | null; lead: { id: string; contactName: string } | null }> {
  const last10 = phoneNumber.replace(/\D/g, '').slice(-10);

  // Try User first
  const user = await prisma.user.findFirst({
    where: { phone: { contains: last10 } },
    select: { id: true, name: true },
  });

  // Try CrmLead if no User found
  let lead: { id: string; contactName: string } | null = null;
  if (!user) {
    lead = await prisma.crmLead.findFirst({
      where: { phone: { contains: last10 } },
      select: { id: true, contactName: true },
    });
  }

  return { user, lead };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a phone number to E.164-ish format (digits only, with +1 prefix).
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Mask a phone number for logging (show only last 4 digits).
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) return `***${digits.slice(-4)}`;
  return '****';
}

/**
 * EMAIL SERVICE
 * Service d'envoi d'emails avec traduction automatique
 */

import { type Locale, defaultLocale, isValidLocale } from '@/i18n/config';
import { logger } from './logger';
import { prisma } from './db';
import {
  orderConfirmationEmail,
  orderCancellationEmail,
  welcomeEmail,
  passwordResetEmail,
  shippingUpdateEmail,
  receiptEmail,
  emailConfig,
} from './email-templates';

// Interface pour les providers d'email
interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<boolean>;
}

// FIX: FLAW-076 - Cache the dynamically imported email module after first use
let _cachedSendEmail: typeof import('@/lib/email/email-service').sendEmail | null = null;

const emailProviderImpl: EmailProvider = {
  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!_cachedSendEmail) {
      const mod = await import('@/lib/email/email-service');
      _cachedSendEmail = mod.sendEmail;
    }
    const result = await _cachedSendEmail({
      to: { email: to },
      subject,
      html,
    });
    return result.success;
  },
};

let emailProvider: EmailProvider = emailProviderImpl;

/**
 * Configure le provider d'email (override)
 */
export function setEmailProvider(provider: EmailProvider) {
  emailProvider = provider;
}

/**
 * Récupère la locale d'un utilisateur depuis la DB
 */
async function getUserLocale(userId: string): Promise<Locale> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    
    if (user?.locale && isValidLocale(user.locale)) {
      return user.locale as Locale;
    }
  } catch (error) {
    logger.error('Error fetching user locale', { userId, error: error instanceof Error ? error.message : String(error) });
  }
  
  return defaultLocale;
}

/**
 * Envoie un email de confirmation de commande
 */
export async function sendOrderConfirmation(
  userId: string,
  email: string,
  data: {
    customerName: string;
    orderNumber: string;
    productName: string;
    amount: number;
    isDigital: boolean;
    accessUrl?: string;
    trackingUrl?: string;
  }
) {
  const locale = await getUserLocale(userId);
  const { subject, html } = orderConfirmationEmail(data, locale);
  
  const sent = await emailProvider.send(email, subject, html);

  // FIX: FLAW-075 - Log to EmailLog for consistency (not just AuditLog)
  await prisma.emailLog.create({
    data: {
      templateId: 'order-confirmation',
      to: email,
      subject,
      status: sent ? 'sent' : 'failed',
    },
  }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? err.message : String(err) }));

  // Also log to AuditLog for audit trail
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'ORDER_CONFIRMATION', orderNumber: data.orderNumber, locale, sent }),
    },
  }).catch((err: unknown) => logger.error('Failed to create audit log', { error: err instanceof Error ? err.message : String(err) }));

  return sent;
}

/**
 * Envoie un email de bienvenue
 */
export async function sendWelcomeEmail(
  userId: string,
  email: string,
  data: {
    userName: string;
    verificationUrl?: string;
  }
) {
  const locale = await getUserLocale(userId);
  const { subject, html } = welcomeEmail(data, locale);

  const sent = await emailProvider.send(email, subject, html);

  // FIX: FLAW-075 - Log to EmailLog for consistency
  await prisma.emailLog.create({
    data: { templateId: 'welcome', to: email, subject, status: sent ? 'sent' : 'failed' },
  }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? err.message : String(err) }));

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'WELCOME', locale, sent }),
    },
  }).catch((err: unknown) => logger.error('Failed to create audit log', { error: err instanceof Error ? err.message : String(err) }));

  return sent;
}

/**
 * Envoie un email de réinitialisation de mot de passe
 */
export async function sendPasswordResetEmail(
  userId: string,
  email: string,
  data: {
    userName: string;
    resetUrl: string;
    expiresIn: string;
  }
) {
  const locale = await getUserLocale(userId);
  const { subject, html } = passwordResetEmail(data, locale);

  const sent = await emailProvider.send(email, subject, html);

  // FIX: FLAW-075 - Log to EmailLog for consistency
  await prisma.emailLog.create({
    data: { templateId: 'password-reset', to: email, subject, status: sent ? 'sent' : 'failed' },
  }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? err.message : String(err) }));

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'PASSWORD_RESET', locale, sent }),
    },
  }).catch((err: unknown) => logger.error('Failed to create audit log', { error: err instanceof Error ? err.message : String(err) }));

  return sent;
}

/**
 * Envoie une mise à jour d'expédition
 */
export async function sendShippingUpdate(
  userId: string,
  email: string,
  data: {
    customerName: string;
    orderNumber: string;
    productName: string;
    status: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: Date;
  }
) {
  const locale = await getUserLocale(userId);
  const { subject, html } = shippingUpdateEmail(data, locale);

  const sent = await emailProvider.send(email, subject, html);

  // FIX: FLAW-075 - Log to EmailLog for consistency
  await prisma.emailLog.create({
    data: { templateId: 'shipping-update', to: email, subject, status: sent ? 'sent' : 'failed' },
  }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? err.message : String(err) }));

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'SHIPPING_UPDATE', orderNumber: data.orderNumber, status: data.status, locale, sent }),
    },
  }).catch((err: unknown) => logger.error('Failed to create audit log', { error: err instanceof Error ? err.message : String(err) }));

  return sent;
}

/**
 * Envoie un reçu par email
 */
export async function sendReceiptEmail(
  userId: string,
  email: string,
  data: {
    customerName: string;
    orderNumber: string;
    items: { name: string; price: number }[];
    subtotal: number;
    taxes: { name: string; amount: number }[];
    total: number;
    paymentMethod: string;
    receiptUrl: string;
  }
) {
  const locale = await getUserLocale(userId);
  const { subject, html } = receiptEmail(data, locale);

  const sent = await emailProvider.send(email, subject, html);

  // FIX: FLAW-075 - Log to EmailLog for consistency
  await prisma.emailLog.create({
    data: { templateId: 'receipt', to: email, subject, status: sent ? 'sent' : 'failed' },
  }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? err.message : String(err) }));

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'RECEIPT', orderNumber: data.orderNumber, locale, sent }),
    },
  }).catch((err: unknown) => logger.error('Failed to create audit log', { error: err instanceof Error ? err.message : String(err) }));

  return sent;
}

/**
 * Envoie un email de confirmation d'annulation de commande
 */
export async function sendOrderCancellation(
  userId: string,
  email: string,
  data: {
    customerName: string;
    orderNumber: string;
    total: number;
    currency?: string;
    items: { name: string; quantity: number }[];
    refundAmount?: number;
    refundMethod?: string;
  }
) {
  const locale = await getUserLocale(userId);
  const { subject, html } = orderCancellationEmail(data, locale);

  const sent = await emailProvider.send(email, subject, html);

  // FIX: FLAW-075 - Log to EmailLog for consistency
  await prisma.emailLog.create({
    data: { templateId: 'order-cancellation', to: email, subject, status: sent ? 'sent' : 'failed' },
  }).catch((err: unknown) => logger.error('Failed to create email log', { error: err instanceof Error ? err.message : String(err) }));

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'ORDER_CANCELLATION', orderNumber: data.orderNumber, locale, sent }),
    },
  }).catch((err: unknown) => logger.error('Failed to create audit log', { error: err instanceof Error ? err.message : String(err) }));

  return sent;
}

export { emailConfig };

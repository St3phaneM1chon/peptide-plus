/**
 * EMAIL SERVICE
 * Service d'envoi d'emails avec traduction automatique
 */

import { type Locale, defaultLocale, isValidLocale } from '@/i18n/config';
import { prisma } from './db';
import {
  orderConfirmationEmail,
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

// Provider qui délègue à lib/email/email-service.ts (Resend, SendGrid, ou SMTP)
const emailProviderImpl: EmailProvider = {
  async send(to: string, subject: string, html: string): Promise<boolean> {
    const { sendEmail } = await import('@/lib/email/email-service');
    const result = await sendEmail({
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
    console.error('Error fetching user locale:', error);
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
  
  // Log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'ORDER_CONFIRMATION', orderNumber: data.orderNumber, locale, sent }),
    },
  }).catch(console.error);
  
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
  
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'WELCOME', locale, sent }),
    },
  }).catch(console.error);
  
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
  
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'PASSWORD_RESET', locale, sent }),
    },
  }).catch(console.error);
  
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
  
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'SHIPPING_UPDATE', orderNumber: data.orderNumber, status: data.status, locale, sent }),
    },
  }).catch(console.error);
  
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
  
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'EMAIL_SENT',
      entityType: 'Email',
      details: JSON.stringify({ type: 'RECEIPT', orderNumber: data.orderNumber, locale, sent }),
    },
  }).catch(console.error);
  
  return sent;
}

export { emailConfig };

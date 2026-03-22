/**
 * EMAIL TEMPLATES
 * Templates d'emails internationalisés (i18n)
 *
 * Pattern d'internationalisation:
 * - Chaque fonction accepte un paramètre `locale` (défaut: 'fr')
 * - createServerTranslator(locale) fournit la fonction t()
 * - Les clés sont dans l'espace de noms `email.*` dans les fichiers de locale
 * - En cas d'échec i18n, t() retourne la clé comme fallback (pas de crash)
 *
 * Pour ajouter i18n à d'autres templates (backInStockEmail, orderCancellationEmail, etc.):
 * 1. Remplacer les ternaires `locale === 'fr' ? '...' : '...'` par `t('email.SECTION.key')`
 * 2. Ajouter les clés dans src/i18n/locales/*.json pour les 22 locales
 * 3. Suivre le pattern établi dans orderConfirmationEmail, welcomeEmail,
 *    passwordResetEmail et shippingUpdateEmail ci-dessous.
 */

import { type Locale } from '@/i18n/config';
import { createServerTranslator, formatCurrencyServer, formatDateServer } from '@/i18n/server';

// Types
interface OrderEmailData {
  customerName: string;
  orderNumber: string;
  productName: string;
  amount: number;
  currency?: string;
  isDigital: boolean;
  accessUrl?: string;
  trackingUrl?: string;
}

interface WelcomeEmailData {
  userName: string;
  verificationUrl?: string;
}

interface PasswordResetData {
  userName: string;
  resetUrl: string;
  expiresIn: string;
}

interface ShippingUpdateData {
  customerName: string;
  orderNumber: string;
  productName: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
}

interface BackInStockData {
  productName: string;
  productSlug: string;
  optionName?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
}

// Configuration email de base
const emailConfig = {
  companyName: process.env.BUSINESS_NAME || 'Formations Pro',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com',
  logoUrl: process.env.LOGO_URL || '',
  primaryColor: '#333333',
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://attitudes.vip',
};

/**
 * Template de base pour tous les emails
 */
function baseTemplate(content: string, locale: Locale = 'fr', unsubscribeUrl?: string): string {
  const t = createServerTranslator(locale);

  return `
<!DOCTYPE html>
<html lang="${locale}" dir="${['ar', 'ar-dz', 'ar-lb', 'ar-ma'].includes(locale) || locale.startsWith('ar') ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailConfig.companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: ${emailConfig.primaryColor};
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: ${emailConfig.primaryColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .footer {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #666666;
      border-top: 1px solid #eeeeee;
    }
    .order-box {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eeeeee;
    }
    .order-row:last-child {
      border-bottom: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emailConfig.companyName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${t('footer.allRightsReserved')} © ${new Date().getFullYear()} ${emailConfig.companyName}</p>
      <p>
        <a href="${emailConfig.baseUrl}/mentions-legales/conditions">${t('footer.terms')}</a> |
        <a href="${emailConfig.baseUrl}/mentions-legales/confidentialite">${t('footer.privacy')}</a>
        ${unsubscribeUrl ? ` | <a href="${unsubscribeUrl}" style="color: #666666;">${t('email.unsubscribe')}</a>` : ''}
      </p>
      <p>${emailConfig.supportEmail}</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Email de confirmation de commande
 */
export function orderConfirmationEmail(data: OrderEmailData, locale: Locale = 'fr'): { subject: string; html: string } {
  const t = createServerTranslator(locale);
  const formattedAmount = formatCurrencyServer(data.amount, locale, data.currency);

  const content = `
    <h2 style="margin-top: 0;">${t('email.order.confirmed')} 🎉</h2>
    <p>${t('email.greeting', { name: data.customerName })}</p>
    <p>${t('email.order.thankYou')}</p>

    <div class="order-box">
      <div class="order-row">
        <span>${t('order.number')}</span>
        <span><strong>${data.orderNumber}</strong></span>
      </div>
      <div class="order-row">
        <span>${t('products.description')}</span>
        <span>${data.productName}</span>
      </div>
      <div class="order-row">
        <span>${t('cart.total')}</span>
        <span><strong>${formattedAmount}</strong></span>
      </div>
    </div>

    ${data.isDigital ? `
      <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #2e7d32;">
          <strong>📱 ${t('order.digitalDelivery.instantAccess')}</strong>
        </p>
        <p style="margin: 8px 0 0 0; color: #388e3c;">
          ${t('order.digitalDelivery.ready')}
        </p>
      </div>
      <p style="text-align: center;">
        <a href="${data.accessUrl || emailConfig.baseUrl + '/dashboard/customer'}" class="button">
          ${t('order.digitalDelivery.accessCourse')}
        </a>
      </p>
    ` : `
      <div style="background-color: #e3f2fd; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #1565c0;">
          <strong>📦 ${t('order.tracking.preparing')}</strong>
        </p>
        <p style="margin: 8px 0 0 0; color: #1976d2;">
          ${t('email.order.trackingInfo')}
        </p>
      </div>
      ${data.trackingUrl ? `
        <p style="text-align: center;">
          <a href="${data.trackingUrl}" class="button">
            ${t('order.physicalDelivery.trackPackage')}
          </a>
        </p>
      ` : ''}
    `}

    <p style="color: #666; font-size: 14px;">
      ${t('email.order.questions')}
    </p>
  `;

  return {
    subject: `${t('email.order.confirmed')} #${data.orderNumber}`,
    html: baseTemplate(content, locale),
  };
}

/**
 * Email de bienvenue
 */
export function welcomeEmail(data: WelcomeEmailData, locale: Locale = 'fr'): { subject: string; html: string } {
  const t = createServerTranslator(locale);

  const content = `
    <h2 style="margin-top: 0;">${t('email.greeting', { name: data.userName })} 👋</h2>
    <p>
      ${t('email.welcome.accountCreated', { company: emailConfig.companyName })}
    </p>

    ${data.verificationUrl ? `
      <p>
        ${t('email.welcome.verifyPrompt')}
      </p>
      <p style="text-align: center;">
        <a href="${data.verificationUrl}" class="button">
          ${t('email.welcome.verifyButton')}
        </a>
      </p>
    ` : ''}

    <h3>${t('email.welcome.nextSteps')}</h3>
    <ul>
      <li>${t('email.welcome.step1')}</li>
      <li>${t('email.welcome.step2')}</li>
      <li>${t('email.welcome.step3')}</li>
    </ul>

    <p style="text-align: center;">
      <a href="${emailConfig.baseUrl}/shop" class="button">
        ${t('products.catalog')}
      </a>
    </p>
  `;

  return {
    subject: t('email.welcome.subject', { company: emailConfig.companyName }),
    html: baseTemplate(content, locale),
  };
}

/**
 * Email de réinitialisation de mot de passe
 */
export function passwordResetEmail(data: PasswordResetData, locale: Locale = 'fr'): { subject: string; html: string } {
  const t = createServerTranslator(locale);

  const content = `
    <h2 style="margin-top: 0;">${t('auth.resetPassword')}</h2>
    <p>${t('email.greeting', { name: data.userName })}</p>
    <p>
      ${t('email.passwordReset.requested')}
    </p>

    <p style="text-align: center;">
      <a href="${data.resetUrl}" class="button">
        ${t('auth.resetPassword')}
      </a>
    </p>

    <p style="color: #666; font-size: 14px;">
      ${t('email.passwordReset.expiry', { duration: data.expiresIn })}
    </p>

    <p style="color: #666; font-size: 14px;">
      ${t('email.passwordReset.notRequested')}
    </p>
  `;

  return {
    subject: t('email.passwordReset.subject'),
    html: baseTemplate(content, locale),
  };
}

/**
 * Email de mise à jour d'expédition
 */
export function shippingUpdateEmail(data: ShippingUpdateData, locale: Locale = 'fr'): { subject: string; html: string } {
  const t = createServerTranslator(locale);

  const statusLabels: Record<string, Partial<Record<Locale, string>>> = {
    PROCESSING: { fr: 'En préparation', en: 'Processing', es: 'En preparación', de: 'In Bearbeitung', it: 'In elaborazione', pt: 'Em processamento', zh: '处理中', ar: 'قيد المعالجة' },
    SHIPPED: { fr: 'Expédiée', en: 'Shipped', es: 'Enviado', de: 'Versendet', it: 'Spedito', pt: 'Enviado', zh: '已发货', ar: 'تم الشحن' },
    IN_TRANSIT: { fr: 'En transit', en: 'In Transit', es: 'En tránsito', de: 'Unterwegs', it: 'In transito', pt: 'Em trânsito', zh: '运输中', ar: 'في الطريق' },
    OUT_FOR_DELIVERY: { fr: 'En livraison', en: 'Out for Delivery', es: 'En camino', de: 'Zur Zustellung', it: 'In consegna', pt: 'Saiu para entrega', zh: '正在派送', ar: 'قيد التوصيل' },
    DELIVERED: { fr: 'Livrée', en: 'Delivered', es: 'Entregado', de: 'Zugestellt', it: 'Consegnato', pt: 'Entregue', zh: '已送达', ar: 'تم التسليم' },
  };

  const statusLabel = statusLabels[data.status]?.[locale] || data.status;
  const estimatedDate = data.estimatedDelivery ? formatDateServer(data.estimatedDelivery, locale) : null;

  const content = `
    <h2 style="margin-top: 0;">📦 ${t('email.shipping.orderUpdate')}</h2>
    <p>${t('email.greeting', { name: data.customerName })}</p>

    <div class="order-box">
      <div class="order-row">
        <span>${t('order.number')}</span>
        <span><strong>${data.orderNumber}</strong></span>
      </div>
      <div class="order-row">
        <span>${t('products.description')}</span>
        <span>${data.productName}</span>
      </div>
      <div class="order-row">
        <span>${t('order.status')}</span>
        <span style="color: #1976d2; font-weight: 600;">${statusLabel}</span>
      </div>
      ${data.trackingNumber ? `
        <div class="order-row">
          <span>${t('order.physicalDelivery.trackingNumber')}</span>
          <span><code>${data.trackingNumber}</code></span>
        </div>
      ` : ''}
      ${estimatedDate ? `
        <div class="order-row">
          <span>${t('order.physicalDelivery.estimatedDelivery')}</span>
          <span>${estimatedDate}</span>
        </div>
      ` : ''}
    </div>

    ${data.trackingUrl ? `
      <p style="text-align: center;">
        <a href="${data.trackingUrl}" class="button">
          ${t('order.physicalDelivery.trackPackage')}
        </a>
      </p>
    ` : ''}
  `;

  return {
    subject: `📦 ${t('email.shipping.subjectPrefix')} #${data.orderNumber} - ${statusLabel}`,
    html: baseTemplate(content, locale),
  };
}

/**
 * Email de facture/reçu
 */
export function receiptEmail(
  data: {
    customerName: string;
    orderNumber: string;
    items: { name: string; price: number }[];
    subtotal: number;
    taxes: { name: string; amount: number }[];
    total: number;
    paymentMethod: string;
    receiptUrl: string;
  },
  locale: Locale = 'fr'
): { subject: string; html: string } {
  const t = createServerTranslator(locale);

  const itemsHtml = data.items.map(item => `
    <div class="order-row">
      <span>${item.name}</span>
      <span>${formatCurrencyServer(item.price, locale)}</span>
    </div>
  `).join('');

  const taxesHtml = data.taxes.map(tax => `
    <div class="order-row">
      <span>${tax.name}</span>
      <span>${formatCurrencyServer(tax.amount, locale)}</span>
    </div>
  `).join('');

  const content = `
    <h2 style="margin-top: 0;">${t('order.receipt.title')} 🧾</h2>
    <p>${t('email.greeting', { name: data.customerName })}</p>
    <p>
      ${t('email.order.receipt')}
    </p>

    <div class="order-box">
      <div class="order-row">
        <span>${t('order.number')}</span>
        <span><strong>${data.orderNumber}</strong></span>
      </div>
      ${itemsHtml}
      <div class="order-row">
        <span>${t('cart.subtotal')}</span>
        <span>${formatCurrencyServer(data.subtotal, locale)}</span>
      </div>
      ${taxesHtml}
      <div class="order-row" style="font-size: 18px;">
        <span>${t('cart.total')}</span>
        <span><strong>${formatCurrencyServer(data.total, locale)}</strong></span>
      </div>
    </div>

    <p style="text-align: center;">
      <a href="${data.receiptUrl}" class="button">
        ${t('order.receipt.download')}
      </a>
    </p>
  `;

  return {
    subject: `${t('order.receipt.title')} #${data.orderNumber}`,
    html: baseTemplate(content, locale),
  };
}

/**
 * Email de retour en stock
 */
export function backInStockEmail(data: BackInStockData, locale: Locale = 'fr', unsubscribeUrl?: string): { subject: string; html: string } {
  const t = createServerTranslator(locale);
  const formattedPrice = formatCurrencyServer(data.price, locale, data.currency);
  const productUrl = `${emailConfig.baseUrl}/product/${data.productSlug}`;

  const content = `
    <h2 style="margin-top: 0;">✨ ${t('email.backInStock.goodNews')}</h2>

    <p>
      ${t('email.backInStock.available')}
    </p>

    <div class="order-box" style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${data.imageUrl ? `
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="${data.imageUrl}" alt="${data.productName}" style="max-width: 200px; height: auto; border-radius: 8px;" />
        </div>
      ` : ''}

      <h3 style="margin: 0 0 8px 0; color: #333; font-size: 20px;">
        ${data.productName}${data.optionName ? ` - ${data.optionName}` : ''}
      </h3>

      <p style="margin: 0; font-size: 24px; color: #ff6b35; font-weight: bold;">
        ${formattedPrice}
      </p>
    </div>

    <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32; font-weight: 600;">
        🎉 ${t('email.backInStock.urgency')}
      </p>
    </div>

    <p style="text-align: center;">
      <a href="${productUrl}" class="button" style="display: inline-block; padding: 14px 28px; background-color: ${emailConfig.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
        ${t('email.backInStock.viewProduct')}
      </a>
    </p>

    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      ${t('email.backInStock.reason')}
    </p>
  `;

  return {
    subject: `🔔 ${t('email.backInStock.subject', { product: data.productName })}`,
    html: baseTemplate(content, locale, unsubscribeUrl),
  };
}

/**
 * Email de confirmation d'annulation de commande
 */
export function orderCancellationEmail(
  data: {
    customerName: string;
    orderNumber: string;
    total: number;
    currency?: string;
    items: { name: string; quantity: number }[];
    refundAmount?: number;
    refundMethod?: string;
  },
  locale: Locale = 'fr'
): { subject: string; html: string } {
  const t = createServerTranslator(locale);
  const formattedTotal = formatCurrencyServer(data.total, locale, data.currency);
  const formattedRefund = data.refundAmount ? formatCurrencyServer(data.refundAmount, locale, data.currency) : null;

  const itemsList = data.items.map(item => `
    <li>${item.name} (${t('email.order.quantity')}: ${item.quantity})</li>
  `).join('');

  const content = `
    <h2 style="margin-top: 0;">${t('email.order.cancelledTitle')}</h2>
    <p>${t('email.greeting', { name: data.customerName })}</p>
    <p>
      ${t('email.order.cancelledSuccess')}
    </p>

    <div class="order-box">
      <div class="order-row">
        <span>${t('order.number')}</span>
        <span><strong>${data.orderNumber}</strong></span>
      </div>
      <div class="order-row">
        <span>${t('email.order.status')}</span>
        <span style="color: #d32f2f; font-weight: 600;">${t('email.order.cancelledStatus')}</span>
      </div>
      <div class="order-row">
        <span>${t('cart.total')}</span>
        <span><strong>${formattedTotal}</strong></span>
      </div>
    </div>

    <h3 style="margin-top: 24px;">${t('email.order.cancelledItems')}</h3>
    <ul style="color: #666;">
      ${itemsList}
    </ul>

    ${data.refundAmount && data.refundAmount > 0 ? `
      <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #2e7d32;">
          <strong>💰 ${t('email.order.refund')}</strong>
        </p>
        <p style="margin: 8px 0 0 0; color: #388e3c;">
          ${t('email.order.refundInfo', {
            amount: formattedRefund ?? '',
            method: data.refundMethod || t('email.order.refundMethod'),
          })}
        </p>
      </div>
    ` : ''}

    <p style="color: #666; font-size: 14px;">
      ${t('email.order.cancelledQuestions')}
    </p>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${emailConfig.baseUrl}/shop" class="button">
        ${t('email.order.continueShopping')}
      </a>
    </p>
  `;

  return {
    subject: `${t('email.order.cancelledTitle')} #${data.orderNumber}`,
    html: baseTemplate(content, locale),
  };
}

export { emailConfig };

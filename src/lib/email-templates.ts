/**
 * EMAIL TEMPLATES
 * Templates d'emails traduits dans toutes les langues
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
  formatName?: string;
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
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com',
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
        ${unsubscribeUrl ? ` | <a href="${unsubscribeUrl}" style="color: #666666;">${locale === 'fr' ? 'Se désabonner' : locale === 'en' ? 'Unsubscribe' : 'Cancelar suscripción'}</a>` : ''}
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
    <h2 style="margin-top: 0;">${t('order.tracking.title')} 🎉</h2>
    <p>${t('dashboard.welcome', { name: data.customerName })},</p>
    <p>${locale === 'fr' ? 'Merci pour votre commande!' : locale === 'en' ? 'Thank you for your order!' : '¡Gracias por su pedido!'}</p>
    
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
          ${locale === 'fr' ? 'Vous recevrez un email avec le numéro de suivi dès l\'expédition.' : 
            locale === 'en' ? 'You will receive an email with tracking information once shipped.' :
            'Recibirá un correo electrónico con información de seguimiento una vez enviado.'}
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
      ${locale === 'fr' ? 'Si vous avez des questions, n\'hésitez pas à nous contacter.' :
        locale === 'en' ? 'If you have any questions, please don\'t hesitate to contact us.' :
        'Si tiene alguna pregunta, no dude en contactarnos.'}
    </p>
  `;

  return {
    subject: `${t('order.tracking.title')} #${data.orderNumber}`,
    html: baseTemplate(content, locale),
  };
}

/**
 * Email de bienvenue
 */
export function welcomeEmail(data: WelcomeEmailData, locale: Locale = 'fr'): { subject: string; html: string } {
  const t = createServerTranslator(locale);

  const content = `
    <h2 style="margin-top: 0;">${t('dashboard.welcome', { name: data.userName })} 👋</h2>
    <p>
      ${locale === 'fr' ? `Bienvenue chez ${emailConfig.companyName}! Votre compte a été créé avec succès.` :
        locale === 'en' ? `Welcome to ${emailConfig.companyName}! Your account has been created successfully.` :
        `¡Bienvenido a ${emailConfig.companyName}! Su cuenta ha sido creada con éxito.`}
    </p>
    
    ${data.verificationUrl ? `
      <p>
        ${locale === 'fr' ? 'Veuillez vérifier votre adresse courriel en cliquant sur le bouton ci-dessous:' :
          locale === 'en' ? 'Please verify your email address by clicking the button below:' :
          'Por favor verifique su dirección de correo electrónico haciendo clic en el botón de abajo:'}
      </p>
      <p style="text-align: center;">
        <a href="${data.verificationUrl}" class="button">
          ${locale === 'fr' ? 'Vérifier mon courriel' : locale === 'en' ? 'Verify my email' : 'Verificar mi correo'}
        </a>
      </p>
    ` : ''}
    
    <h3>${locale === 'fr' ? 'Prochaines étapes' : locale === 'en' ? 'Next steps' : 'Próximos pasos'}</h3>
    <ul>
      <li>${locale === 'fr' ? 'Explorez notre catalogue de formations' : locale === 'en' ? 'Explore our course catalog' : 'Explore nuestro catálogo de cursos'}</li>
      <li>${locale === 'fr' ? 'Complétez votre profil' : locale === 'en' ? 'Complete your profile' : 'Complete su perfil'}</li>
      <li>${locale === 'fr' ? 'Activez l\'authentification à deux facteurs' : locale === 'en' ? 'Enable two-factor authentication' : 'Active la autenticación de dos factores'}</li>
    </ul>
    
    <p style="text-align: center;">
      <a href="${emailConfig.baseUrl}/shop" class="button">
        ${t('products.catalog')}
      </a>
    </p>
  `;

  return {
    subject: `${t('dashboard.welcome', { name: '' }).trim()} ${emailConfig.companyName}!`,
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
    <p>${t('dashboard.welcome', { name: data.userName })},</p>
    <p>
      ${locale === 'fr' ? 'Vous avez demandé la réinitialisation de votre mot de passe.' :
        locale === 'en' ? 'You requested a password reset.' :
        'Ha solicitado restablecer su contraseña.'}
    </p>
    
    <p style="text-align: center;">
      <a href="${data.resetUrl}" class="button">
        ${t('auth.resetPassword')}
      </a>
    </p>
    
    <p style="color: #666; font-size: 14px;">
      ${locale === 'fr' ? `Ce lien expirera dans ${data.expiresIn}.` :
        locale === 'en' ? `This link will expire in ${data.expiresIn}.` :
        `Este enlace expirará en ${data.expiresIn}.`}
    </p>
    
    <p style="color: #666; font-size: 14px;">
      ${locale === 'fr' ? 'Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email.' :
        locale === 'en' ? 'If you didn\'t request this reset, please ignore this email.' :
        'Si no solicitó este restablecimiento, ignore este correo electrónico.'}
    </p>
  `;

  return {
    subject: t('auth.resetPassword'),
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
    <h2 style="margin-top: 0;">📦 ${locale === 'fr' ? 'Mise à jour de votre commande' : locale === 'en' ? 'Order Update' : 'Actualización de su pedido'}</h2>
    <p>${t('dashboard.welcome', { name: data.customerName })},</p>
    
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
    subject: `📦 ${locale === 'fr' ? 'Votre commande' : locale === 'en' ? 'Your order' : 'Su pedido'} #${data.orderNumber} - ${statusLabel}`,
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
    <p>${t('dashboard.welcome', { name: data.customerName })},</p>
    <p>
      ${locale === 'fr' ? 'Voici le reçu de votre commande.' :
        locale === 'en' ? 'Here is the receipt for your order.' :
        'Aquí está el recibo de su pedido.'}
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
  // const t = createServerTranslator(locale); // TODO: Use t() for email i18n
  const formattedPrice = formatCurrencyServer(data.price, locale, data.currency);
  const productUrl = `${emailConfig.baseUrl}/product/${data.productSlug}`;

  const content = `
    <h2 style="margin-top: 0;">✨ ${locale === 'fr' ? 'Bonne nouvelle!' : locale === 'en' ? 'Good news!' : '¡Buenas noticias!'}</h2>

    <p>
      ${locale === 'fr' ? 'Le produit que vous attendiez est de nouveau disponible!' :
        locale === 'en' ? 'The product you were waiting for is back in stock!' :
        '¡El producto que esperaba está de nuevo en stock!'}
    </p>

    <div class="order-box" style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${data.imageUrl ? `
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="${data.imageUrl}" alt="${data.productName}" style="max-width: 200px; height: auto; border-radius: 8px;" />
        </div>
      ` : ''}

      <h3 style="margin: 0 0 8px 0; color: #333; font-size: 20px;">
        ${data.productName}${data.formatName ? ` - ${data.formatName}` : ''}
      </h3>

      <p style="margin: 0; font-size: 24px; color: #ff6b35; font-weight: bold;">
        ${formattedPrice}
      </p>
    </div>

    <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32; font-weight: 600;">
        🎉 ${locale === 'fr' ? 'Disponible maintenant - Commandez avant qu\'il ne soit à nouveau en rupture!' :
              locale === 'en' ? 'Available now - Order before it sells out again!' :
              '¡Disponible ahora - Ordene antes de que se agote nuevamente!'}
      </p>
    </div>

    <p style="text-align: center;">
      <a href="${productUrl}" class="button" style="display: inline-block; padding: 14px 28px; background-color: ${emailConfig.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
        ${locale === 'fr' ? 'Voir le produit' : locale === 'en' ? 'View Product' : 'Ver producto'}
      </a>
    </p>

    <p style="color: #666; font-size: 14px; margin-top: 24px;">
      ${locale === 'fr' ? 'Vous recevez cet email car vous avez demandé à être notifié lorsque ce produit serait de nouveau disponible.' :
        locale === 'en' ? 'You are receiving this email because you requested to be notified when this product is back in stock.' :
        'Está recibiendo este correo electrónico porque solicitó ser notificado cuando este producto esté nuevamente en stock.'}
    </p>
  `;

  return {
    subject: `🔔 ${data.productName} ${locale === 'fr' ? 'est de nouveau disponible!' : locale === 'en' ? 'is back in stock!' : '¡está de nuevo en stock!'}`,
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
    <li>${item.name} (${locale === 'fr' ? 'Quantité' : locale === 'en' ? 'Quantity' : 'Cantidad'}: ${item.quantity})</li>
  `).join('');

  const content = `
    <h2 style="margin-top: 0;">${locale === 'fr' ? 'Commande annulée' : locale === 'en' ? 'Order Cancelled' : 'Pedido cancelado'}</h2>
    <p>${t('dashboard.welcome', { name: data.customerName })},</p>
    <p>
      ${locale === 'fr' ? 'Votre commande a été annulée avec succès.' :
        locale === 'en' ? 'Your order has been successfully cancelled.' :
        'Su pedido ha sido cancelado con éxito.'}
    </p>

    <div class="order-box">
      <div class="order-row">
        <span>${t('order.number')}</span>
        <span><strong>${data.orderNumber}</strong></span>
      </div>
      <div class="order-row">
        <span>${locale === 'fr' ? 'Statut' : locale === 'en' ? 'Status' : 'Estado'}</span>
        <span style="color: #d32f2f; font-weight: 600;">${locale === 'fr' ? 'Annulée' : locale === 'en' ? 'Cancelled' : 'Cancelado'}</span>
      </div>
      <div class="order-row">
        <span>${t('cart.total')}</span>
        <span><strong>${formattedTotal}</strong></span>
      </div>
    </div>

    <h3 style="margin-top: 24px;">${locale === 'fr' ? 'Articles annulés' : locale === 'en' ? 'Cancelled Items' : 'Artículos cancelados'}</h3>
    <ul style="color: #666;">
      ${itemsList}
    </ul>

    ${data.refundAmount && data.refundAmount > 0 ? `
      <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #2e7d32;">
          <strong>💰 ${locale === 'fr' ? 'Remboursement' : locale === 'en' ? 'Refund' : 'Reembolso'}</strong>
        </p>
        <p style="margin: 8px 0 0 0; color: #388e3c;">
          ${locale === 'fr' ? `Un remboursement de ${formattedRefund} sera traité sur votre ${data.refundMethod || 'mode de paiement original'} dans les 5-10 jours ouvrables.` :
            locale === 'en' ? `A refund of ${formattedRefund} will be processed to your ${data.refundMethod || 'original payment method'} within 5-10 business days.` :
            `Un reembolso de ${formattedRefund} se procesará en su ${data.refundMethod || 'método de pago original'} dentro de 5-10 días hábiles.`}
        </p>
      </div>
    ` : ''}

    <p style="color: #666; font-size: 14px;">
      ${locale === 'fr' ? 'Si vous avez des questions concernant cette annulation, n\'hésitez pas à nous contacter.' :
        locale === 'en' ? 'If you have any questions about this cancellation, please don\'t hesitate to contact us.' :
        'Si tiene alguna pregunta sobre esta cancelación, no dude en contactarnos.'}
    </p>

    <p style="text-align: center; margin-top: 24px;">
      <a href="${emailConfig.baseUrl}/shop" class="button">
        ${locale === 'fr' ? 'Continuer mes achats' : locale === 'en' ? 'Continue Shopping' : 'Seguir comprando'}
      </a>
    </p>
  `;

  return {
    subject: `${locale === 'fr' ? 'Commande annulée' : locale === 'en' ? 'Order Cancelled' : 'Pedido cancelado'} #${data.orderNumber}`,
    html: baseTemplate(content, locale),
  };
}

export { emailConfig };

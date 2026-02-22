/**
 * Templates d'emails pour les commandes - BioCycle Peptides
 */

import { baseTemplate, emailComponents, escapeHtml } from './base-template';

// Types
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  sku?: string;
  imageUrl?: string;
}

export interface OrderData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount?: number;
  total: number;
  currency?: string;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  estimatedDelivery?: string;
  locale?: 'fr' | 'en';
  cancellationReason?: string;
  refundAmount?: number;
  refundIsPartial?: boolean;
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

// Helpers
function formatPrice(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(date: Date | string, locale: string = 'fr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================
// 1. EMAIL DE CONFIRMATION DE COMMANDE
// ============================================
export function orderConfirmationEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const currency = data.currency || 'CAD';

  const subject = isFr
    ? `✅ Commande confirmée #${data.orderNumber}`
    : `✅ Order confirmed #${data.orderNumber}`;

  const itemsHtml = data.items.map(item => 
    emailComponents.orderItem(item.name, item.quantity, formatPrice(item.price, currency), item.imageUrl)
  ).join('');

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px;">
      ${isFr ? '🎉 Merci pour votre commande!' : '🎉 Thank you for your order!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr
        ? `Bonjour ${escapeHtml(data.customerName)}, nous avons bien reçu votre commande et nous la préparons avec soin.`
        : `Hello ${escapeHtml(data.customerName)}, we've received your order and are preparing it with care.`}
    </p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Numéro de commande' : 'Order number'}</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: #1f2937;">${data.orderNumber}</p>
          </td>
          <td align="right">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Date' : 'Date'}</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; color: #1f2937;">${formatDate(new Date(), data.locale)}</p>
          </td>
        </tr>
      </table>
    </div>

    <h2 style="font-size: 18px; margin-top: 32px;">${isFr ? 'Résumé de la commande' : 'Order summary'}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
      ${itemsHtml}
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
      <tr>
        <td style="padding: 8px 16px;">
          <span style="color: #6b7280;">${isFr ? 'Sous-total' : 'Subtotal'}</span>
        </td>
        <td align="right" style="padding: 8px 16px;">
          <span style="color: #1f2937;">${formatPrice(data.subtotal, currency)}</span>
        </td>
      </tr>
      ${data.discount ? `
      <tr>
        <td style="padding: 8px 16px;">
          <span style="color: #059669;">${isFr ? 'Réduction' : 'Discount'}</span>
        </td>
        <td align="right" style="padding: 8px 16px;">
          <span style="color: #059669;">-${formatPrice(data.discount, currency)}</span>
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 8px 16px;">
          <span style="color: #6b7280;">${isFr ? 'Livraison' : 'Shipping'}</span>
        </td>
        <td align="right" style="padding: 8px 16px;">
          <span style="color: #1f2937;">${data.shipping === 0 ? (isFr ? 'GRATUIT' : 'FREE') : formatPrice(data.shipping, currency)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 16px;">
          <span style="color: #6b7280;">${isFr ? 'Taxes' : 'Tax'}</span>
        </td>
        <td align="right" style="padding: 8px 16px;">
          <span style="color: #1f2937;">${formatPrice(data.tax, currency)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border-top: 2px solid #e5e7eb;">
          <span style="font-weight: bold; font-size: 18px; color: #1f2937;">${isFr ? 'Total' : 'Total'}</span>
        </td>
        <td align="right" style="padding: 12px 16px; border-top: 2px solid #e5e7eb;">
          <span style="font-weight: bold; font-size: 18px; color: #CC5500;">${formatPrice(data.total, currency)}</span>
        </td>
      </tr>
    </table>

    <h2 style="font-size: 18px; margin-top: 32px;">${isFr ? 'Adresse de livraison' : 'Shipping address'}</h2>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
      <p style="margin: 0; color: #1f2937;">
        <strong>${data.shippingAddress.name}</strong><br>
        ${data.shippingAddress.address1}<br>
        ${data.shippingAddress.address2 ? data.shippingAddress.address2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postalCode}<br>
        ${data.shippingAddress.country}
      </p>
    </div>

    ${emailComponents.infoBox(`
      <p style="margin: 0; color: #166534;">
        <strong>📦 ${isFr ? 'Prochaine étape' : 'Next step'}:</strong><br>
        ${isFr 
          ? 'Vous recevrez un email avec votre numéro de suivi dès que votre commande sera expédiée.'
          : 'You will receive an email with your tracking number as soon as your order ships.'}
      </p>
    `)}

    ${emailComponents.button(
      isFr ? 'Voir ma commande' : 'View my order',
      `https://biocyclepeptides.com/account/orders`
    )}

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr 
        ? 'Des questions? Contactez-nous à support@biocyclepeptides.com'
        : 'Questions? Contact us at support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Commande #${data.orderNumber} confirmée - Merci pour votre achat!`
        : `Order #${data.orderNumber} confirmed - Thank you for your purchase!`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 2. EMAIL DE COMMANDE EN TRAITEMENT
// ============================================
export function orderProcessingEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `⚙️ Votre commande #${data.orderNumber} est en préparation`
    : `⚙️ Your order #${data.orderNumber} is being prepared`;

  const content = `
    <h1 style="color: #3b82f6; margin-bottom: 8px;">
      ${isFr ? '⚙️ Commande en préparation' : '⚙️ Order being prepared'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr 
        ? `Bonjour ${escapeHtml(data.customerName)}, bonne nouvelle! Votre commande est en cours de préparation dans notre laboratoire.`
        : `Hello ${escapeHtml(data.customerName)}, great news! Your order is being prepared in our laboratory.`}
    </p>

    <div style="background-color: #eff6ff; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #3b82f6;">${isFr ? 'Numéro de commande' : 'Order number'}</p>
      <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e40af;">${data.orderNumber}</p>
    </div>

    <h2 style="font-size: 18px;">${isFr ? 'Que se passe-t-il maintenant?' : 'What happens now?'}</h2>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align: top; padding-right: 16px;">
                <div style="width: 32px; height: 32px; background-color: #059669; border-radius: 50%; text-align: center; line-height: 32px; color: white; font-weight: bold;">✓</div>
              </td>
              <td>
                <p style="margin: 0; font-weight: 600; color: #059669;">${isFr ? 'Commande reçue' : 'Order received'}</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">${isFr ? 'Votre paiement a été confirmé' : 'Your payment has been confirmed'}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align: top; padding-right: 16px;">
                <div style="width: 32px; height: 32px; background-color: #3b82f6; border-radius: 50%; text-align: center; line-height: 32px; color: white; font-weight: bold;">2</div>
              </td>
              <td>
                <p style="margin: 0; font-weight: 600; color: #3b82f6;">${isFr ? 'En préparation' : 'Being prepared'} ← ${isFr ? 'Vous êtes ici' : 'You are here'}</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">${isFr ? 'Nos techniciens préparent vos produits avec soin' : 'Our technicians are carefully preparing your products'}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align: top; padding-right: 16px;">
                <div style="width: 32px; height: 32px; background-color: #d1d5db; border-radius: 50%; text-align: center; line-height: 32px; color: white; font-weight: bold;">3</div>
              </td>
              <td>
                <p style="margin: 0; font-weight: 600; color: #9ca3af;">${isFr ? 'Expédition' : 'Shipping'}</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">${isFr ? 'Vous recevrez un email avec le suivi' : 'You will receive a tracking email'}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${emailComponents.infoBox(`
      <p style="margin: 0; color: #166534;">
        <strong>🧊 ${isFr ? 'Emballage avec soin' : 'Careful packaging'}:</strong><br>
        ${isFr 
          ? 'Vos peptides seront emballés avec des packs réfrigérants pour maintenir leur intégrité pendant le transport.'
          : 'Your peptides will be packed with cold packs to maintain their integrity during shipping.'}
      </p>
    `)}

    ${emailComponents.button(
      isFr ? 'Voir le statut de ma commande' : 'View order status',
      `https://biocyclepeptides.com/account/orders`
    )}
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Votre commande #${data.orderNumber} est en cours de préparation`
        : `Your order #${data.orderNumber} is being prepared`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 3. EMAIL DE COMMANDE EXPÉDIÉE
// ============================================
export function orderShippedEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `🚚 Votre commande #${data.orderNumber} est en route!`
    : `🚚 Your order #${data.orderNumber} is on its way!`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px;">
      ${isFr ? '🚚 Votre commande est en route!' : '🚚 Your order is on its way!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr 
        ? `Bonjour ${escapeHtml(data.customerName)}, excellente nouvelle! Votre commande a été expédiée et est en route vers vous.`
        : `Hello ${escapeHtml(data.customerName)}, excellent news! Your order has been shipped and is on its way to you.`}
    </p>

    ${data.trackingNumber && data.trackingUrl && data.carrier 
      ? emailComponents.trackingInfo(data.carrier, data.trackingNumber, data.trackingUrl, isFr)
      : ''}

    ${data.estimatedDelivery ? `
    <div style="text-align: center; margin: 24px 0;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Livraison estimée' : 'Estimated delivery'}</p>
      <p style="margin: 8px 0 0 0; font-size: 20px; font-weight: bold; color: #1f2937;">${data.estimatedDelivery}</p>
    </div>
    ` : ''}

    <h2 style="font-size: 18px; margin-top: 32px;">${isFr ? 'Adresse de livraison' : 'Delivery address'}</h2>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
      <p style="margin: 0; color: #1f2937;">
        <strong>${data.shippingAddress.name}</strong><br>
        ${data.shippingAddress.address1}<br>
        ${data.shippingAddress.address2 ? data.shippingAddress.address2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postalCode}<br>
        ${data.shippingAddress.country}
      </p>
    </div>

    ${emailComponents.warningBox(`
      <p style="margin: 0; color: #92400e;">
        <strong>🧊 ${isFr ? 'Important - Conservation' : 'Important - Storage'}:</strong><br>
        ${isFr 
          ? 'Dès réception, veuillez stocker vos peptides au réfrigérateur (2-8°C) ou au congélateur selon les instructions sur l\'emballage.'
          : 'Upon receipt, please store your peptides in the refrigerator (2-8°C) or freezer according to the packaging instructions.'}
      </p>
    `)}

    <h2 style="font-size: 18px; margin-top: 32px;">${isFr ? 'Liens de suivi par transporteur' : 'Carrier tracking links'}</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
      <a href="https://www.canadapost-postescanada.ca/track-reperage/fr#/search?searchFor=${data.trackingNumber || ''}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">📮 Postes Canada</a>
      <a href="https://www.fedex.com/fedextrack/?trknbr=${data.trackingNumber || ''}" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">📦 FedEx</a>
      <a href="https://www.ups.com/track?tracknum=${data.trackingNumber || ''}" style="display: inline-block; padding: 10px 20px; background-color: #78350f; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">📦 UPS</a>
    </div>

    <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 32px;">
      ${isFr 
        ? 'Des questions sur votre livraison? Contactez-nous à support@biocyclepeptides.com'
        : 'Questions about your delivery? Contact us at support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Votre commande #${data.orderNumber} est en route - Suivez votre colis!`
        : `Your order #${data.orderNumber} is on its way - Track your package!`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 4. EMAIL DE COMMANDE LIVRÉE
// ============================================
export function orderDeliveredEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `✅ Votre commande #${data.orderNumber} a été livrée!`
    : `✅ Your order #${data.orderNumber} has been delivered!`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px;">
      ${isFr ? '✅ Commande livrée!' : '✅ Order delivered!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr 
        ? `Bonjour ${escapeHtml(data.customerName)}, votre commande #${data.orderNumber} a été livrée avec succès!`
        : `Hello ${escapeHtml(data.customerName)}, your order #${data.orderNumber} has been successfully delivered!`}
    </p>

    <div style="background-color: #d1fae5; border-radius: 12px; padding: 32px; margin: 24px 0; text-align: center;">
      <span style="font-size: 48px;">📦✓</span>
      <p style="margin: 16px 0 0 0; font-size: 18px; font-weight: bold; color: #065f46;">
        ${isFr ? 'Livraison confirmée' : 'Delivery confirmed'}
      </p>
    </div>

    ${emailComponents.warningBox(`
      <p style="margin: 0; color: #92400e;">
        <strong>🧊 ${isFr ? 'Rappel important' : 'Important reminder'}:</strong><br>
        ${isFr 
          ? 'N\'oubliez pas de stocker vos peptides immédiatement au réfrigérateur (2-8°C) ou au congélateur selon les instructions pour préserver leur intégrité.'
          : 'Don\'t forget to store your peptides immediately in the refrigerator (2-8°C) or freezer according to instructions to preserve their integrity.'}
      </p>
    `)}

    <h2 style="font-size: 18px; margin-top: 32px; text-align: center;">
      ${isFr ? '⭐ Comment s\'est passée votre expérience?' : '⭐ How was your experience?'}
    </h2>
    <p style="text-align: center; color: #6b7280;">
      ${isFr 
        ? 'Votre avis nous aide à nous améliorer et aide d\'autres chercheurs à faire leur choix.'
        : 'Your feedback helps us improve and helps other researchers make their choice.'}
    </p>

    ${emailComponents.button(
      isFr ? '⭐ Donner mon avis (+50 points)' : '⭐ Leave a review (+50 points)',
      `https://biocyclepeptides.com/account/orders?review=${data.orderNumber}`
    )}

    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>🎁 ${isFr ? 'Gagnez 50 points de fidélité' : 'Earn 50 loyalty points'}</strong><br>
        ${isFr 
          ? 'En laissant un avis sur vos produits!'
          : 'By leaving a review on your products!'}
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <h2 style="font-size: 18px; text-align: center;">
      ${isFr ? '🔄 Besoin de recommander?' : '🔄 Need to reorder?'}
    </h2>
    <p style="text-align: center; color: #6b7280; margin-bottom: 20px;">
      ${isFr 
        ? 'Retrouvez facilement vos produits préférés dans votre historique de commandes.'
        : 'Easily find your favorite products in your order history.'}
    </p>

    ${emailComponents.button(
      isFr ? 'Commander à nouveau' : 'Reorder',
      `https://biocyclepeptides.com/account/orders`
    )}

    <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 32px;">
      ${isFr 
        ? 'Un problème avec votre commande? Contactez-nous à support@biocyclepeptides.com'
        : 'Issue with your order? Contact us at support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Votre commande #${data.orderNumber} est arrivée - Donnez-nous votre avis!`
        : `Your order #${data.orderNumber} has arrived - Give us your feedback!`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 5. EMAIL DE DEMANDE DE SATISFACTION
// ============================================
export function satisfactionSurveyEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `⭐ ${escapeHtml(data.customerName)}, comment s'est passée votre commande?`
    : `⭐ ${escapeHtml(data.customerName)}, how was your order?`;

  const content = `
    <h1 style="color: #CC5500; margin-bottom: 8px; text-align: center;">
      ${isFr ? '⭐ Votre avis compte!' : '⭐ Your opinion matters!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr 
        ? `Bonjour ${escapeHtml(data.customerName)}, nous espérons que vous êtes satisfait de votre récente commande #${data.orderNumber}.`
        : `Hello ${escapeHtml(data.customerName)}, we hope you're satisfied with your recent order #${data.orderNumber}.`}
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <p style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">
        ${isFr ? 'Comment évaluez-vous votre expérience?' : 'How would you rate your experience?'}
      </p>
      <table role="presentation" cellspacing="0" cellpadding="0" align="center">
        <tr>
          <td style="padding: 0 4px;">
            <a href="https://biocyclepeptides.com/feedback?order=${data.orderNumber}&rating=1" style="text-decoration: none; font-size: 32px;">😞</a>
          </td>
          <td style="padding: 0 4px;">
            <a href="https://biocyclepeptides.com/feedback?order=${data.orderNumber}&rating=2" style="text-decoration: none; font-size: 32px;">😐</a>
          </td>
          <td style="padding: 0 4px;">
            <a href="https://biocyclepeptides.com/feedback?order=${data.orderNumber}&rating=3" style="text-decoration: none; font-size: 32px;">🙂</a>
          </td>
          <td style="padding: 0 4px;">
            <a href="https://biocyclepeptides.com/feedback?order=${data.orderNumber}&rating=4" style="text-decoration: none; font-size: 32px;">😊</a>
          </td>
          <td style="padding: 0 4px;">
            <a href="https://biocyclepeptides.com/feedback?order=${data.orderNumber}&rating=5" style="text-decoration: none; font-size: 32px;">🤩</a>
          </td>
        </tr>
      </table>
    </div>

    <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; color: #92400e;">
        <strong>🎁 ${isFr ? 'Gagnez 50 points bonus!' : 'Earn 50 bonus points!'}</strong><br>
        ${isFr 
          ? 'Laissez un avis détaillé et recevez 50 points de fidélité sur votre compte.'
          : 'Leave a detailed review and receive 50 loyalty points on your account.'}
      </p>
    </div>

    ${emailComponents.button(
      isFr ? 'Laisser un avis détaillé' : 'Leave a detailed review',
      `https://biocyclepeptides.com/account/orders?review=${data.orderNumber}`
    )}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr 
        ? 'Votre avis nous aide à améliorer nos produits et services. Merci de prendre quelques minutes pour partager votre expérience!'
        : 'Your feedback helps us improve our products and services. Thank you for taking a few minutes to share your experience!'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Donnez votre avis et gagnez 50 points de fidélité!`
        : `Give your feedback and earn 50 loyalty points!`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 6. EMAIL DE COMMANDE ANNULÉE
// ============================================
export function orderCancelledEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const currency = data.currency || 'CAD';

  const subject = isFr
    ? `❌ Commande #${data.orderNumber} annulée`
    : `❌ Order #${data.orderNumber} cancelled`;

  const itemsHtml = data.items.map(item =>
    emailComponents.orderItem(item.name, item.quantity, formatPrice(item.price, currency), item.imageUrl)
  ).join('');

  const content = `
    <h1 style="color: #dc2626; margin-bottom: 8px;">
      ${isFr ? '❌ Commande annulée' : '❌ Order cancelled'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr
        ? `Bonjour ${escapeHtml(data.customerName)}, nous vous confirmons que votre commande #${data.orderNumber} a été annulée.`
        : `Hello ${escapeHtml(data.customerName)}, we confirm that your order #${data.orderNumber} has been cancelled.`}
    </p>

    ${data.cancellationReason ? `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: #991b1b;">
        <strong>${isFr ? 'Raison de l\'annulation' : 'Cancellation reason'}:</strong><br>
        ${data.cancellationReason}
      </p>
    </div>
    ` : ''}

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Numéro de commande' : 'Order number'}</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: #1f2937;">${data.orderNumber}</p>
          </td>
          <td align="right">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Statut' : 'Status'}</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #dc2626;">${isFr ? 'Annulée' : 'Cancelled'}</p>
          </td>
        </tr>
      </table>
    </div>

    <h2 style="font-size: 18px; margin-top: 32px;">${isFr ? 'Articles de la commande' : 'Order items'}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
      ${itemsHtml}
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
      <tr>
        <td style="padding: 8px 16px;">
          <span style="color: #6b7280;">${isFr ? 'Total de la commande' : 'Order total'}</span>
        </td>
        <td align="right" style="padding: 8px 16px;">
          <span style="font-weight: bold; color: #1f2937; text-decoration: line-through;">${formatPrice(data.total, currency)}</span>
        </td>
      </tr>
    </table>

    ${emailComponents.infoBox(`
      <p style="margin: 0; color: #166534;">
        <strong>${isFr ? 'Remboursement' : 'Refund'}:</strong><br>
        ${isFr
          ? 'Si un paiement avait été effectué, un remboursement sera traité automatiquement. Vous recevrez un email de confirmation du remboursement séparément.'
          : 'If a payment was made, a refund will be processed automatically. You will receive a separate refund confirmation email.'}
      </p>
    `)}

    ${emailComponents.button(
      isFr ? 'Parcourir nos produits' : 'Browse our products',
      'https://biocyclepeptides.com/shop'
    )}

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr
        ? 'Des questions? Contactez-nous à support@biocyclepeptides.com'
        : 'Questions? Contact us at support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Votre commande #${data.orderNumber} a été annulée`
        : `Your order #${data.orderNumber} has been cancelled`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 7. EMAIL DE REMBOURSEMENT TRAITÉ
// ============================================
export function orderRefundEmail(data: OrderData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const currency = data.currency || 'CAD';
  const refundAmount = data.refundAmount ?? data.total;
  const isPartial = data.refundIsPartial ?? (refundAmount < data.total);

  const subject = isFr
    ? `💰 Remboursement ${isPartial ? 'partiel ' : ''}traité - Commande #${data.orderNumber}`
    : `💰 ${isPartial ? 'Partial r' : 'R'}efund processed - Order #${data.orderNumber}`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px;">
      ${isFr ? '💰 Remboursement traité' : '💰 Refund processed'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr
        ? `Bonjour ${escapeHtml(data.customerName)}, nous vous confirmons qu'un remboursement ${isPartial ? 'partiel ' : ''}a été traité pour votre commande #${data.orderNumber}.`
        : `Hello ${escapeHtml(data.customerName)}, we confirm that a ${isPartial ? 'partial ' : ''}refund has been processed for your order #${data.orderNumber}.`}
    </p>

    <div style="background-color: #d1fae5; border-radius: 12px; padding: 32px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #065f46;">
        ${isFr ? 'Montant remboursé' : 'Refund amount'}
      </p>
      <p style="margin: 0; font-size: 36px; font-weight: bold; color: #059669;">
        ${formatPrice(refundAmount, currency)}
      </p>
      ${isPartial ? `
      <p style="margin: 12px 0 0 0; font-size: 14px; color: #065f46;">
        ${isFr ? '(Remboursement partiel)' : '(Partial refund)'}
      </p>
      ` : ''}
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 8px 0;">
            <span style="color: #6b7280;">${isFr ? 'Numéro de commande' : 'Order number'}</span>
          </td>
          <td align="right" style="padding: 8px 0;">
            <span style="font-weight: bold; color: #1f2937;">${data.orderNumber}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
            <span style="color: #6b7280;">${isFr ? 'Total original' : 'Original total'}</span>
          </td>
          <td align="right" style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
            <span style="color: #1f2937;">${formatPrice(data.total, currency)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
            <span style="color: #6b7280;">${isFr ? 'Montant remboursé' : 'Amount refunded'}</span>
          </td>
          <td align="right" style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
            <span style="font-weight: bold; color: #059669;">${formatPrice(refundAmount, currency)}</span>
          </td>
        </tr>
        ${isPartial ? `
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
            <span style="color: #6b7280;">${isFr ? 'Solde restant' : 'Remaining balance'}</span>
          </td>
          <td align="right" style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
            <span style="font-weight: bold; color: #1f2937;">${formatPrice(data.total - refundAmount, currency)}</span>
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${emailComponents.infoBox(`
      <p style="margin: 0; color: #166534;">
        <strong>${isFr ? 'Quand recevrai-je mon remboursement?' : 'When will I receive my refund?'}:</strong><br>
        ${isFr
          ? 'Le remboursement sera crédité sur votre moyen de paiement original dans un délai de 5 à 10 jours ouvrables, selon votre institution financière.'
          : 'The refund will be credited to your original payment method within 5 to 10 business days, depending on your financial institution.'}
      </p>
    `)}

    ${emailComponents.button(
      isFr ? 'Voir mes commandes' : 'View my orders',
      'https://biocyclepeptides.com/account/orders'
    )}

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr
        ? 'Des questions sur votre remboursement? Contactez-nous à support@biocyclepeptides.com'
        : 'Questions about your refund? Contact us at support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `Votre remboursement de ${formatPrice(refundAmount, currency)} a été traité`
        : `Your refund of ${formatPrice(refundAmount, currency)} has been processed`,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

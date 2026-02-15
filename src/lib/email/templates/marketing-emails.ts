/**
 * Templates d'emails marketing - BioCycle Peptides
 * Anniversaire, bienvenue, réactivation, etc.
 */

import { baseTemplate, emailComponents } from './base-template';

// ============================================
// 1. EMAIL D'ANNIVERSAIRE AVEC CADEAU
// ============================================
export interface BirthdayEmailData {
  customerName: string;
  customerEmail: string;
  discountCode: string;
  discountValue: number;
  discountType: 'percentage' | 'fixed';
  bonusPoints: number;
  expiresAt: Date;
  locale?: 'fr' | 'en';
}

export function birthdayEmail(data: BirthdayEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const discountText = data.discountType === 'percentage' 
    ? `${data.discountValue}%` 
    : `$${data.discountValue}`;

  const subject = isFr
    ? `🎂 Joyeux anniversaire ${data.customerName}! Un cadeau vous attend`
    : `🎂 Happy birthday ${data.customerName}! A gift awaits you`;

  const expiryDate = data.expiresAt.toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 64px;">🎂🎉🎁</span>
    </div>

    <h1 style="color: #CC5500; margin-bottom: 8px; text-align: center;">
      ${isFr ? 'Joyeux anniversaire!' : 'Happy birthday!'}
    </h1>
    <p style="font-size: 18px; color: #4b5563; text-align: center;">
      ${isFr 
        ? `${data.customerName}, toute l'équipe BioCycle Peptides vous souhaite un merveilleux anniversaire! 🎈`
        : `${data.customerName}, the entire BioCycle Peptides team wishes you a wonderful birthday! 🎈`}
    </p>

    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 32px; margin: 32px 0; text-align: center; border: 2px dashed #f59e0b;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 2px;">
        ${isFr ? 'Votre cadeau d\'anniversaire' : 'Your birthday gift'}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 42px; font-weight: bold; color: #CC5500;">
        ${discountText} ${isFr ? 'DE RABAIS' : 'OFF'}
      </p>
      <div style="background-color: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${isFr ? 'Votre code' : 'Your code'}</p>
        <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1f2937; letter-spacing: 4px; font-family: monospace;">
          ${data.discountCode}
        </p>
      </div>
      <p style="margin: 16px 0 0 0; font-size: 13px; color: #92400e;">
        ${isFr ? `Valide jusqu'au ${expiryDate}` : `Valid until ${expiryDate}`}
      </p>
    </div>

    ${data.bonusPoints > 0 ? `
    <div style="background-color: #d1fae5; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; font-size: 16px; color: #065f46;">
        <strong>🎁 ${isFr ? 'BONUS' : 'BONUS'}:</strong> 
        ${isFr 
          ? `${data.bonusPoints} points de fidélité ont été ajoutés à votre compte!`
          : `${data.bonusPoints} loyalty points have been added to your account!`}
      </p>
    </div>
    ` : ''}

    ${emailComponents.button(
      isFr ? '🛒 Utiliser mon cadeau' : '🛒 Use my gift',
      `https://biocyclepeptides.com/shop?promo=${data.discountCode}`
    )}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr 
        ? 'Passez une excellente journée remplie de joie! 🎈'
        : 'Have an excellent day filled with joy! 🎈'}
    </p>
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      ${isFr 
        ? 'L\'équipe BioCycle Peptides'
        : 'The BioCycle Peptides Team'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr 
        ? `🎁 ${discountText} de rabais pour votre anniversaire + ${data.bonusPoints} points bonus!`
        : `🎁 ${discountText} off for your birthday + ${data.bonusPoints} bonus points!`,
      content,
      locale: data.locale,
    }),
  };
}

// ============================================
// 2. EMAIL DE BIENVENUE
// ============================================
export interface WelcomeEmailData {
  customerName: string;
  customerEmail: string;
  welcomePoints: number;
  referralCode: string;
  locale?: 'fr' | 'en';
}

export function welcomeEmail(data: WelcomeEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `🎉 Bienvenue chez BioCycle Peptides, ${data.customerName}!`
    : `🎉 Welcome to BioCycle Peptides, ${data.customerName}!`;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 80px; height: 80px; background-color: #CC5500; border-radius: 50%; line-height: 80px;">
        <span style="font-size: 40px;">🎉</span>
      </div>
    </div>

    <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
      ${isFr ? 'Bienvenue dans la famille!' : 'Welcome to the family!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr 
        ? `Bonjour ${data.customerName}, nous sommes ravis de vous compter parmi nos chercheurs!`
        : `Hello ${data.customerName}, we're thrilled to have you among our researchers!`}
    </p>

    ${data.welcomePoints > 0 ? `
    <div style="background-color: #d1fae5; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #065f46;">
        ${isFr ? '🎁 Cadeau de bienvenue' : '🎁 Welcome gift'}
      </p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #059669;">
        +${data.welcomePoints} ${isFr ? 'points' : 'points'}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #065f46;">
        ${isFr ? 'ont été ajoutés à votre compte!' : 'have been added to your account!'}
      </p>
    </div>
    ` : ''}

    <h2 style="font-size: 18px; margin-top: 32px;">
      ${isFr ? '🚀 Découvrez ce que nous offrons' : '🚀 Discover what we offer'}
    </h2>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align: top; padding-right: 16px;">
                <span style="font-size: 24px;">🔬</span>
              </td>
              <td>
                <p style="margin: 0; font-weight: 600; color: #1f2937;">
                  ${isFr ? 'Peptides de haute pureté' : 'High purity peptides'}
                </p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">
                  ${isFr ? '99%+ de pureté garantie avec COA' : '99%+ purity guaranteed with COA'}
                </p>
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
                <span style="font-size: 24px;">🚚</span>
              </td>
              <td>
                <p style="margin: 0; font-weight: 600; color: #1f2937;">
                  ${isFr ? 'Livraison rapide' : 'Fast shipping'}
                </p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">
                  ${isFr ? 'Expédition sous 24-48h avec cold packs' : 'Ships within 24-48h with cold packs'}
                </p>
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
                <span style="font-size: 24px;">🎁</span>
              </td>
              <td>
                <p style="margin: 0; font-weight: 600; color: #1f2937;">
                  ${isFr ? 'Programme de fidélité' : 'Loyalty program'}
                </p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">
                  ${isFr ? 'Gagnez des points à chaque achat' : 'Earn points on every purchase'}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${emailComponents.button(
      isFr ? 'Explorer nos produits' : 'Explore our products',
      'https://biocyclepeptides.com/shop'
    )}

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
        ${isFr ? '👥 Parrainez vos collègues et gagnez 500 points!' : '👥 Refer colleagues and earn 500 points!'}
      </p>
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af;">
        ${isFr ? 'Votre code de parrainage' : 'Your referral code'}
      </p>
      <p style="margin: 0; font-size: 20px; font-weight: bold; color: #CC5500; letter-spacing: 2px; font-family: monospace;">
        ${data.referralCode}
      </p>
    </div>

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr 
        ? 'Des questions? Notre équipe est là pour vous aider: support@biocyclepeptides.com'
        : 'Questions? Our team is here to help: support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr 
        ? `Bienvenue! ${data.welcomePoints} points bonus vous attendent 🎁`
        : `Welcome! ${data.welcomePoints} bonus points await you 🎁`,
      content,
      locale: data.locale,
    }),
  };
}

// ============================================
// 3. EMAIL PANIER ABANDONNÉ
// ============================================
export interface AbandonedCartEmailData {
  customerName: string;
  customerEmail: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
  }>;
  cartTotal: number;
  discountCode?: string;
  discountValue?: number;
  locale?: 'fr' | 'en';
}

export function abandonedCartEmail(data: AbandonedCartEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `🛒 Vous avez oublié quelque chose, ${data.customerName}?`
    : `🛒 Did you forget something, ${data.customerName}?`;

  const itemsHtml = data.items.slice(0, 3).map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            ${item.imageUrl ? `<td width="60" style="padding-right: 12px;"><img src="${item.imageUrl}" alt="${item.name}" width="60" height="60" style="border-radius: 8px;"></td>` : ''}
            <td>
              <p style="margin: 0; font-weight: 600; color: #1f2937;">${item.name}</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Qty: ${item.quantity}</p>
            </td>
            <td align="right" style="font-weight: 600; color: #CC5500;">$${item.price.toFixed(2)}</td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const content = `
    <h1 style="color: #1f2937; margin-bottom: 8px;">
      ${isFr ? '🛒 Votre panier vous attend!' : '🛒 Your cart is waiting!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563;">
      ${isFr 
        ? `Bonjour ${data.customerName}, il semble que vous avez laissé des articles dans votre panier.`
        : `Hello ${data.customerName}, it looks like you left some items in your cart.`}
    </p>

    <h2 style="font-size: 18px; margin-top: 24px;">${isFr ? 'Dans votre panier' : 'In your cart'}</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${itemsHtml}
    </table>

    ${data.items.length > 3 ? `
    <p style="text-align: center; font-size: 14px; color: #6b7280; margin-top: 12px;">
      ${isFr ? `+ ${data.items.length - 3} autre(s) article(s)` : `+ ${data.items.length - 3} more item(s)`}
    </p>
    ` : ''}

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Total du panier' : 'Cart total'}</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold; color: #CC5500;">$${data.cartTotal.toFixed(2)}</p>
    </div>

    ${data.discountCode && data.discountValue ? `
    <div style="background-color: #fef3c7; border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">
        ${isFr ? '🎁 Offre spéciale pour vous!' : '🎁 Special offer for you!'}
      </p>
      <p style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; color: #CC5500;">
        ${data.discountValue}% ${isFr ? 'DE RABAIS' : 'OFF'}
      </p>
      <p style="margin: 0; font-size: 12px; color: #6b7280;">
        ${isFr ? 'Code' : 'Code'}: <strong>${data.discountCode}</strong>
      </p>
    </div>
    ` : ''}

    ${emailComponents.button(
      isFr ? 'Finaliser ma commande' : 'Complete my order',
      'https://biocyclepeptides.com/checkout'
    )}

    <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 24px;">
      ${isFr 
        ? 'Des questions? Contactez-nous à support@biocyclepeptides.com'
        : 'Questions? Contact us at support@biocyclepeptides.com'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr 
        ? `Vos articles vous attendent! ${data.discountCode ? `+ ${data.discountValue}% de rabais` : ''}`
        : `Your items are waiting! ${data.discountCode ? `+ ${data.discountValue}% off` : ''}`,
      content,
      locale: data.locale,
    }),
  };
}

// ============================================
// 4. EMAIL RÉAPPROVISIONNEMENT (BACK IN STOCK)
// ============================================
export interface BackInStockEmailData {
  customerName: string;
  customerEmail: string;
  productName: string;
  productPrice: number;
  productUrl: string;
  productImageUrl?: string;
  locale?: 'fr' | 'en';
}

export function backInStockEmail(data: BackInStockEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `🔔 ${data.productName} est de retour en stock!`
    : `🔔 ${data.productName} is back in stock!`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px; text-align: center;">
      ${isFr ? '🔔 De retour en stock!' : '🔔 Back in stock!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr 
        ? `Bonjour ${data.customerName}, le produit que vous attendiez est de nouveau disponible!`
        : `Hello ${data.customerName}, the product you were waiting for is available again!`}
    </p>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      ${data.productImageUrl ? `
      <img src="${data.productImageUrl}" alt="${data.productName}" width="150" height="150" style="border-radius: 8px; margin-bottom: 16px;">
      ` : ''}
      <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #1f2937;">${data.productName}</h2>
      <p style="margin: 0; font-size: 24px; font-weight: bold; color: #CC5500;">$${data.productPrice.toFixed(2)}</p>
    </div>

    ${emailComponents.warningBox(`
      <p style="margin: 0; color: #92400e; text-align: center;">
        <strong>⚡ ${isFr ? 'Stock limité!' : 'Limited stock!'}</strong><br>
        ${isFr 
          ? 'Commandez rapidement avant rupture de stock.'
          : 'Order quickly before it sells out again.'}
      </p>
    `)}

    ${emailComponents.button(
      isFr ? 'Commander maintenant' : 'Order now',
      data.productUrl
    )}
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr 
        ? `${data.productName} est de retour! Stock limité.`
        : `${data.productName} is back! Limited stock.`,
      content,
      locale: data.locale,
    }),
  };
}

// ============================================
// 5. EMAIL POINTS QUI EXPIRENT
// ============================================
export interface PointsExpiringEmailData {
  customerName: string;
  customerEmail: string;
  expiringPoints: number;
  currentPoints: number;
  expiryDate: Date;
  locale?: 'fr' | 'en';
}

export function pointsExpiringEmail(data: PointsExpiringEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const expiryDateStr = data.expiryDate.toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = isFr
    ? `⚠️ ${data.expiringPoints} points expirent bientôt!`
    : `⚠️ ${data.expiringPoints} points expiring soon!`;

  const content = `
    <h1 style="color: #dc2626; margin-bottom: 8px; text-align: center;">
      ${isFr ? '⚠️ Points en expiration!' : '⚠️ Points expiring!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr 
        ? `Bonjour ${data.customerName}, certains de vos points de fidélité vont expirer bientôt!`
        : `Hello ${data.customerName}, some of your loyalty points are about to expire!`}
    </p>

    <div style="background-color: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #dc2626;">
        ${isFr ? 'Points qui expirent le' : 'Points expiring on'} ${expiryDateStr}
      </p>
      <p style="margin: 0; font-size: 42px; font-weight: bold; color: #dc2626;">
        ${data.expiringPoints}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #991b1b;">
        ${isFr ? 'points' : 'points'}
      </p>
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">${isFr ? 'Votre solde total actuel' : 'Your current total balance'}</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold; color: #CC5500;">${data.currentPoints} ${isFr ? 'points' : 'points'}</p>
    </div>

    <h2 style="font-size: 18px; text-align: center;">
      ${isFr ? '💡 Comment utiliser vos points?' : '💡 How to use your points?'}
    </h2>
    <ul style="color: #4b5563; padding-left: 20px;">
      <li style="margin-bottom: 8px;">${isFr ? 'Échangez-les contre des réductions sur votre prochaine commande' : 'Exchange them for discounts on your next order'}</li>
      <li style="margin-bottom: 8px;">${isFr ? 'Obtenez la livraison gratuite (300 points)' : 'Get free shipping (300 points)'}</li>
      <li style="margin-bottom: 8px;">${isFr ? 'Convertissez-les en crédit boutique' : 'Convert them to store credit'}</li>
    </ul>

    ${emailComponents.button(
      isFr ? 'Utiliser mes points' : 'Use my points',
      'https://biocyclepeptides.com/rewards'
    )}
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `${data.expiringPoints} points expirent le ${expiryDateStr} - Utilisez-les!`
        : `${data.expiringPoints} points expire on ${expiryDateStr} - Use them!`,
      content,
      locale: data.locale,
    }),
  };
}

// ============================================
// 6. EMAIL BAISSE DE PRIX
// ============================================
export interface PriceDropEmailData {
  customerName: string;
  customerEmail: string;
  productName: string;
  productSlug: string;
  productImageUrl?: string;
  originalPrice: number;
  currentPrice: number;
  priceDrop: number;
  priceDropPercent: number;
  targetPrice?: number;
  locale?: 'fr' | 'en';
}

export function priceDropEmail(data: PriceDropEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';

  const subject = isFr
    ? `💰 ${data.productName} - Prix réduit de ${data.priceDropPercent.toFixed(0)}%!`
    : `💰 ${data.productName} - Price dropped ${data.priceDropPercent.toFixed(0)}%!`;

  const productUrl = `https://biocyclepeptides.com/product/${data.productSlug}`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px; text-align: center;">
      ${isFr ? '💰 Le prix a baissé!' : '💰 Price dropped!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr
        ? `Bonjour ${data.customerName}, le produit que vous suivez est maintenant en solde!`
        : `Hello ${data.customerName}, the product you're watching is now on sale!`}
    </p>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      ${data.productImageUrl ? `
      <img src="${data.productImageUrl}" alt="${data.productName}" width="150" height="150" style="border-radius: 8px; margin-bottom: 16px;">
      ` : ''}
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1f2937;">${data.productName}</h2>

      <div style="display: inline-block; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #065f46; text-transform: uppercase; letter-spacing: 1px;">
          ${isFr ? 'Prix réduit de' : 'Price reduced by'}
        </p>
        <p style="margin: 0; font-size: 36px; font-weight: bold; color: #059669;">
          ${data.priceDropPercent.toFixed(0)}%
        </p>
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 16px;">
        <div>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #9ca3af; text-decoration: line-through;">
            ${isFr ? 'Avant' : 'Before'}: $${data.originalPrice.toFixed(2)}
          </p>
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #CC5500;">
            $${data.currentPrice.toFixed(2)}
          </p>
        </div>
      </div>

      <p style="margin: 16px 0 0 0; font-size: 14px; color: #059669; font-weight: 600;">
        ${isFr ? 'Vous économisez' : 'You save'} $${data.priceDrop.toFixed(2)}!
      </p>
    </div>

    ${data.targetPrice && data.currentPrice <= data.targetPrice ? emailComponents.warningBox(`
      <p style="margin: 0; color: #065f46; text-align: center;">
        <strong>🎯 ${isFr ? 'Prix cible atteint!' : 'Target price reached!'}</strong><br>
        ${isFr
          ? `Le prix est maintenant de $${data.currentPrice.toFixed(2)} (votre cible: $${data.targetPrice.toFixed(2)})`
          : `Price is now $${data.currentPrice.toFixed(2)} (your target: $${data.targetPrice.toFixed(2)})`}
      </p>
    `) : ''}

    <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; color: #92400e; font-weight: 600;">
        ⚡ ${isFr ? 'Profitez-en maintenant!' : 'Take advantage now!'}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 13px; color: #92400e;">
        ${isFr
          ? 'Les prix peuvent changer à tout moment'
          : 'Prices may change at any time'}
      </p>
    </div>

    ${emailComponents.button(
      isFr ? 'Voir le produit' : 'View product',
      productUrl
    )}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      ${isFr
        ? 'Vous recevez cet email car vous suivez ce produit.'
        : 'You\'re receiving this email because you\'re watching this product.'}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader: isFr
        ? `${data.productName} - Maintenant $${data.currentPrice.toFixed(2)} (économisez $${data.priceDrop.toFixed(2)})`
        : `${data.productName} - Now $${data.currentPrice.toFixed(2)} (save $${data.priceDrop.toFixed(2)})`,
      content,
      locale: data.locale,
    }),
  };
}

/**
 * Templates d'emails marketing - BioCycle Peptides
 * Anniversaire, bienvenue, réactivation, etc.
 *
 * NOTE: FLAW-083 - Templates support fr/en only. Full i18n for email templates deferred;
 * fr/en covers >90% of current user base. Additional locales to be added via EmailTemplate DB model.
 *
 * Templates:
 * 1. birthdayEmail          - Birthday with gift code + bonus points
 * 2. welcomeEmail           - Welcome with referral code + welcome points
 * 3. abandonedCartEmail     - Cart recovery with items list + optional discount
 * 4. backInStockEmail       - Product back in stock notification
 * 5. pointsExpiringEmail    - Loyalty points expiration warning
 * 6. priceDropEmail         - Price drop alert for watched products
 * 7. browseAbandonmentEmail - Browse abandonment (3 variants: interest, similar, incentive)
 * 8. replenishmentReminderEmail - Replenishment reminder (3 variants: running low, last chance, incentive)
 * 9. crossSellEmail         - Cross-sell complementary + upgrade products
 * 10. sunsetEmail           - Sunset/list cleanup (3 variants: miss you, last chance, goodbye)
 * 11. vipTierUpEmail        - VIP loyalty tier upgrade celebration
 */

import { baseTemplate, emailComponents, escapeHtml } from './base-template';
import { logger } from '@/lib/logger';

const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || 'https://biocyclepeptides.com';

// FLAW-096 FIX: Sanitize customer names for email subjects (strip control chars, limit length)
function safeSubjectName(name: string): string {
  return name.replace(/[\x00-\x1F\x7F<>]/g, '').substring(0, 60);
}

/**
 * #28 Security: Validate URLs before embedding in email templates.
 * Only allows http: and https: protocols to prevent javascript:, data:,
 * or other dangerous URI schemes from being injected via user-supplied data.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    logger.error('[MarketingEmails] Invalid URL validation', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

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
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

export function birthdayEmail(data: BirthdayEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);
  const discountText = data.discountType === 'percentage' 
    ? `${data.discountValue}%` 
    : `$${data.discountValue}`;

  const subject = isFr
    ? `🎂 Joyeux anniversaire ${safeSubjectName(data.customerName)}! Un cadeau vous attend`
    : `🎂 Happy birthday ${safeSubjectName(data.customerName)}! A gift awaits you`;

  // FLAW-100 FIX: Use explicit timezone for consistent dates across server environments
  const expiryDate = data.expiresAt.toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
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
        ? `${safeName}, toute l'équipe BioCycle Peptides vous souhaite un merveilleux anniversaire! 🎈`
        : `${safeName}, the entire BioCycle Peptides team wishes you a wonderful birthday! 🎈`}
    </p>

    <div style="background: #fef3c7; border-radius: 16px; padding: 32px; margin: 32px 0; text-align: center; border: 2px dashed #f59e0b;">
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
      `${SHOP_URL}/shop?promo=${data.discountCode}`
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
      unsubscribeUrl: data.unsubscribeUrl,
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
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

export function welcomeEmail(data: WelcomeEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);

  const subject = isFr
    ? `🎉 Bienvenue chez BioCycle Peptides, ${safeSubjectName(data.customerName)}!`
    : `🎉 Welcome to BioCycle Peptides, ${safeSubjectName(data.customerName)}!`;

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
        ? `Bonjour ${safeName}, nous sommes ravis de vous compter parmi nos chercheurs!`
        : `Hello ${safeName}, we're thrilled to have you among our researchers!`}
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
      `${SHOP_URL}/shop`
    )}

    ${emailComponents.divider()}

    <h2 style="font-size: 18px; margin-top: 24px;">
      ${isFr ? '📬 Ce que vous recevrez' : '📬 What to expect'}
    </h2>
    <ul style="color: #4b5563; padding-left: 20px; line-height: 1.8;">
      <li>${isFr ? 'Newsletter mensuelle avec les nouveaux produits et promotions' : 'Monthly newsletter with new products and promotions'}</li>
      <li>${isFr ? 'Alertes de prix sur vos produits suivis' : 'Price alerts on your watched products'}</li>
      <li>${isFr ? 'Articles de recherche et guides scientifiques' : 'Research articles and scientific guides'}</li>
    </ul>

    <h2 style="font-size: 18px; margin-top: 24px;">
      ${isFr ? '🔬 Categories populaires' : '🔬 Popular categories'}
    </h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="padding: 8px 4px; text-align: center;">
          <a href="${SHOP_URL}/shop?category=peptides" style="display: inline-block; background-color: #f3f4f6; border-radius: 8px; padding: 12px 16px; text-decoration: none; color: #1f2937; font-weight: 600; font-size: 14px;">
            ${isFr ? 'Peptides' : 'Peptides'}
          </a>
        </td>
        <td style="padding: 8px 4px; text-align: center;">
          <a href="${SHOP_URL}/shop?category=lab-supplies" style="display: inline-block; background-color: #f3f4f6; border-radius: 8px; padding: 12px 16px; text-decoration: none; color: #1f2937; font-weight: 600; font-size: 14px;">
            ${isFr ? 'Materiel de labo' : 'Lab supplies'}
          </a>
        </td>
        <td style="padding: 8px 4px; text-align: center;">
          <a href="${SHOP_URL}/shop?category=bundles" style="display: inline-block; background-color: #f3f4f6; border-radius: 8px; padding: 12px 16px; text-decoration: none; color: #1f2937; font-weight: 600; font-size: 14px;">
            ${isFr ? 'Ensembles' : 'Bundles'}
          </a>
        </td>
      </tr>
    </table>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center;">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280;">
        ${isFr ? '👥 Parrainez vos collegues et gagnez 500 points!' : '👥 Refer colleagues and earn 500 points!'}
      </p>
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af;">
        ${isFr ? 'Votre code de parrainage' : 'Your referral code'}
      </p>
      <p style="margin: 0; font-size: 20px; font-weight: bold; color: #CC5500; letter-spacing: 2px; font-family: monospace;">
        ${data.referralCode}
      </p>
    </div>

    ${emailComponents.divider()}

    <h2 style="font-size: 16px; text-align: center; margin-top: 24px;">
      ${isFr ? '💬 Besoin d\'aide?' : '💬 Need help?'}
    </h2>
    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr
        ? 'Notre equipe est disponible du lundi au vendredi, 9h-17h EST.'
        : 'Our team is available Monday to Friday, 9am-5pm EST.'}
      <br>
      <a href="mailto:support@biocyclepeptides.com" style="color: #CC5500;">support@biocyclepeptides.com</a>
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
      unsubscribeUrl: data.unsubscribeUrl,
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
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

export function abandonedCartEmail(data: AbandonedCartEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);

  const subject = isFr
    ? `🛒 Vous avez oublié quelque chose, ${safeSubjectName(data.customerName)}?`
    : `🛒 Did you forget something, ${safeSubjectName(data.customerName)}?`;

  // #26/#28 Security fix: escape item names and validate image URLs
  const itemsHtml = data.items.slice(0, 3).map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            ${item.imageUrl && isSafeUrl(item.imageUrl) ? `<td width="60" style="padding-right: 12px;"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" width="60" height="60" style="border-radius: 8px;"></td>` : ''}
            <td>
              <p style="margin: 0; font-weight: 600; color: #1f2937;">${escapeHtml(item.name)}</p>
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
        ? `Bonjour ${safeName}, il semble que vous avez laissé des articles dans votre panier.`
        : `Hello ${safeName}, it looks like you left some items in your cart.`}
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
      `${SHOP_URL}/checkout`
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
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 4. EMAIL RÉAPPROVISIONNEMENT (BACK IN STOCK)
// FIX: FLAW-097 - TODO: Consolidate with backInStockEmail in src/lib/email-templates.ts
// Two different implementations exist with different parameter signatures.
// ============================================
export interface BackInStockEmailData {
  customerName: string;
  customerEmail: string;
  productName: string;
  productPrice: number;
  productUrl: string;
  productImageUrl?: string;
  locale?: 'fr' | 'en';
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

export function backInStockEmail(data: BackInStockEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);

  const subject = isFr
    ? `🔔 ${data.productName} est de retour en stock!`
    : `🔔 ${data.productName} is back in stock!`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px; text-align: center;">
      ${isFr ? '🔔 De retour en stock!' : '🔔 Back in stock!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr
        ? `Bonjour ${safeName}, le produit que vous attendiez est de nouveau disponible!`
        : `Hello ${safeName}, the product you were waiting for is available again!`}
    </p>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      ${data.productImageUrl && isSafeUrl(data.productImageUrl) ? `
      <img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.productName)}" width="150" height="150" style="border-radius: 8px; margin-bottom: 16px;">
      ` : ''}
      <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #1f2937;">${escapeHtml(data.productName)}</h2>
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
      isSafeUrl(data.productUrl) ? data.productUrl : '#'
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
      unsubscribeUrl: data.unsubscribeUrl,
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
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

export function pointsExpiringEmail(data: PointsExpiringEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);

  // FLAW-100 FIX: Use explicit timezone for consistent dates across server environments
  const expiryDateStr = data.expiryDate.toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
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
        ? `Bonjour ${safeName}, certains de vos points de fidélité vont expirer bientôt!`
        : `Hello ${safeName}, some of your loyalty points are about to expire!`}
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
      `${SHOP_URL}/rewards`
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
      unsubscribeUrl: data.unsubscribeUrl,
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
  /** CAN-SPAM / RGPD / LCAP: unsubscribe URL (required for compliance) */
  unsubscribeUrl?: string;
}

export function priceDropEmail(data: PriceDropEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);

  const subject = isFr
    ? `💰 ${data.productName} - Prix réduit de ${data.priceDropPercent.toFixed(0)}%!`
    : `💰 ${data.productName} - Price dropped ${data.priceDropPercent.toFixed(0)}%!`;

  const productUrl = `${SHOP_URL}/product/${data.productSlug}`;

  const content = `
    <h1 style="color: #059669; margin-bottom: 8px; text-align: center;">
      ${isFr ? '💰 Le prix a baissé!' : '💰 Price dropped!'}
    </h1>
    <p style="font-size: 16px; color: #4b5563; text-align: center;">
      ${isFr
        ? `Bonjour ${safeName}, le produit que vous suivez est maintenant en solde!`
        : `Hello ${safeName}, the product you're watching is now on sale!`}
    </p>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      ${data.productImageUrl && isSafeUrl(data.productImageUrl) ? `
      <img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.productName)}" width="150" height="150" style="border-radius: 8px; margin-bottom: 16px;">
      ` : ''}
      <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1f2937;">${escapeHtml(data.productName)}</h2>

      <div style="display: inline-block; background: #d1fae5; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
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
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 7. EMAIL ABANDON DE NAVIGATION (BROWSE ABANDONMENT)
// 3 variants: interest, similar products, incentive
// ============================================
export interface BrowseAbandonmentEmailData {
  customerName: string;
  customerEmail: string;
  product: {
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
  };
  /** Step 2: similar/complementary products */
  similarProducts?: Array<{
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
  }>;
  /** Step 3: discount code for high-value prospects */
  discountCode?: string;
  discountPercent?: number;
  /** Which step of the flow: 1 = interest, 2 = similar, 3 = incentive */
  step: 1 | 2 | 3;
  locale?: 'fr' | 'en';
  unsubscribeUrl?: string;
}

export function browseAbandonmentEmail(data: BrowseAbandonmentEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);
  const safeProductName = escapeHtml(data.product.name);
  const productUrl = `${SHOP_URL}/product/${data.product.slug}`;

  let subject: string;
  let content: string;
  let preheader: string;

  switch (data.step) {
    // -- Step 1: "Still interested?" with product image and CTA ----------------
    case 1: {
      subject = isFr
        ? `Toujours intéressé(e) par ${safeSubjectName(data.product.name)}?`
        : `Still interested in ${safeSubjectName(data.product.name)}?`;

      preheader = isFr
        ? `${data.product.name} vous attend - Ne passez pas à côté!`
        : `${data.product.name} is waiting for you - Don't miss out!`;

      content = `
        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? '👀 Ce produit a attiré votre attention' : '👀 This product caught your eye'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `Bonjour ${safeName}, nous avons remarqué que vous avez consulté ce produit récemment.`
            : `Hello ${safeName}, we noticed you've been checking out this product recently.`}
        </p>

        <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          ${data.product.imageUrl && isSafeUrl(data.product.imageUrl) ? `
          <img src="${escapeHtml(data.product.imageUrl)}" alt="${safeProductName}" width="200" height="200" style="border-radius: 8px; margin-bottom: 16px; object-fit: cover;">
          ` : ''}
          <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #1f2937;">${safeProductName}</h2>
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #CC5500;">$${data.product.price.toFixed(2)}</p>
        </div>

        ${emailComponents.button(
          isFr ? 'Voir le produit' : 'View product',
          isSafeUrl(productUrl) ? productUrl : '#'
        )}

        <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 24px;">
          ${isFr
            ? 'Besoin d\'aide pour choisir? Notre équipe est là pour vous.'
            : 'Need help choosing? Our team is here for you.'}
        </p>
      `;
      break;
    }

    // -- Step 2: Show similar/complementary products ----------------------------
    case 2: {
      subject = isFr
        ? `Des produits similaires qui pourraient vous plaire`
        : `Similar products you might love`;

      preheader = isFr
        ? `Basé sur votre intérêt pour ${data.product.name} - Découvrez plus`
        : `Based on your interest in ${data.product.name} - Discover more`;

      const similarHtml = (data.similarProducts || []).slice(0, 3).map(p => `
        <td style="padding: 8px; text-align: center; width: 33%;">
          ${p.imageUrl && isSafeUrl(p.imageUrl) ? `
          <a href="${SHOP_URL}/product/${p.slug}" style="text-decoration: none;">
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="120" height="120" style="border-radius: 8px; margin-bottom: 8px; object-fit: cover;">
          </a>
          ` : ''}
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #1f2937; font-size: 14px;">
            <a href="${SHOP_URL}/product/${p.slug}" style="color: #1f2937; text-decoration: none;">${escapeHtml(p.name)}</a>
          </p>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #CC5500;">$${p.price.toFixed(2)}</p>
        </td>
      `).join('');

      content = `
        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? '🔬 D\'autres produits pour votre recherche' : '🔬 More products for your research'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, basé sur votre intérêt pour <strong>${safeProductName}</strong>, voici d'autres produits populaires.`
            : `${safeName}, based on your interest in <strong>${safeProductName}</strong>, here are other popular products.`}
        </p>

        ${(data.similarProducts?.length ?? 0) > 0 ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
          <tr>
            ${similarHtml}
          </tr>
        </table>
        ` : ''}

        ${emailComponents.button(
          isFr ? 'Explorer tous les produits' : 'Explore all products',
          `${SHOP_URL}/shop`
        )}
      `;
      break;
    }

    // -- Step 3: Limited-time incentive (5% off if cart value > $100) -----------
    case 3: {
      subject = isFr
        ? `${data.discountPercent || 5}% de rabais sur votre prochain achat!`
        : `${data.discountPercent || 5}% off your next purchase!`;

      preheader = isFr
        ? `Offre limitée! ${data.discountPercent || 5}% de rabais - Ne manquez pas cette occasion`
        : `Limited offer! ${data.discountPercent || 5}% off - Don't miss this opportunity`;

      content = `
        <h1 style="color: #CC5500; margin-bottom: 8px; text-align: center;">
          ${isFr ? '🎁 Une offre spéciale pour vous!' : '🎁 A special offer for you!'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, nous avons vu que <strong>${safeProductName}</strong> vous intéresse. Voici un petit coup de pouce!`
            : `${safeName}, we saw that <strong>${safeProductName}</strong> caught your eye. Here's a little nudge!`}
        </p>

        ${data.discountCode ? `
        <div style="background: #fef3c7; border-radius: 16px; padding: 32px; margin: 24px 0; text-align: center; border: 2px dashed #f59e0b;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 2px;">
            ${isFr ? 'Offre limitée' : 'Limited offer'}
          </p>
          <p style="margin: 0 0 16px 0; font-size: 42px; font-weight: bold; color: #CC5500;">
            ${data.discountPercent || 5}% ${isFr ? 'DE RABAIS' : 'OFF'}
          </p>
          <div style="background-color: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${isFr ? 'Votre code' : 'Your code'}</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1f2937; letter-spacing: 4px; font-family: monospace;">
              ${data.discountCode}
            </p>
          </div>
          <p style="margin: 16px 0 0 0; font-size: 13px; color: #92400e;">
            ${isFr ? 'Valide 48 heures seulement' : 'Valid for 48 hours only'}
          </p>
        </div>
        ` : ''}

        <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          ${data.product.imageUrl && isSafeUrl(data.product.imageUrl) ? `
          <img src="${escapeHtml(data.product.imageUrl)}" alt="${safeProductName}" width="150" height="150" style="border-radius: 8px; margin-bottom: 16px; object-fit: cover;">
          ` : ''}
          <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #1f2937;">${safeProductName}</h2>
          <p style="margin: 0; font-size: 24px; font-weight: bold; color: #CC5500;">$${data.product.price.toFixed(2)}</p>
        </div>

        ${emailComponents.button(
          isFr ? 'Profiter de l\'offre' : 'Claim this offer',
          `${SHOP_URL}/product/${data.product.slug}${data.discountCode ? `?promo=${data.discountCode}` : ''}`
        )}
      `;
      break;
    }
  }

  return {
    subject,
    html: baseTemplate({
      preheader,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 8. EMAIL RAPPEL DE RÉAPPROVISIONNEMENT (REPLENISHMENT REMINDER)
// 3 variants: running low, last chance, incentive
// ============================================
export interface ReplenishmentReminderEmailData {
  customerName: string;
  customerEmail: string;
  product: {
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
  };
  orderDate: Date;
  /** Days since delivery (used in messaging) */
  daysSinceDelivery: number;
  /** Which step: 1 = running low (25d), 2 = last chance (30d), 3 = incentive (35d) */
  step: 1 | 2 | 3;
  discountCode?: string;
  discountPercent?: number;
  locale?: 'fr' | 'en';
  unsubscribeUrl?: string;
}

export function replenishmentReminderEmail(data: ReplenishmentReminderEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);
  const safeProductName = escapeHtml(data.product.name);
  const productUrl = `${SHOP_URL}/product/${data.product.slug}`;

  // FLAW-100 FIX: Use explicit timezone for consistent dates across server environments
  const orderDateStr = data.orderDate.toLocaleDateString(isFr ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
  });

  let subject: string;
  let content: string;
  let preheader: string;

  switch (data.step) {
    // -- Step 1 (25 days): "Running low? Reorder now" --------------------------
    case 1: {
      subject = isFr
        ? `Bientôt à court de ${safeSubjectName(data.product.name)}? Recommandez maintenant`
        : `Running low on ${safeSubjectName(data.product.name)}? Reorder now`;

      preheader = isFr
        ? `Il est peut-être temps de recommander votre ${data.product.name}`
        : `It might be time to reorder your ${data.product.name}`;

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">🔄</span>
        </div>

        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'Temps de renouveler?' : 'Time to reorder?'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `Bonjour ${safeName}, votre commande de <strong>${safeProductName}</strong> du ${orderDateStr} approche de la fin de son cycle.`
            : `Hello ${safeName}, your order of <strong>${safeProductName}</strong> from ${orderDateStr} is nearing the end of its cycle.`}
        </p>

        <div style="background-color: #eff6ff; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          ${data.product.imageUrl && isSafeUrl(data.product.imageUrl) ? `
          <img src="${escapeHtml(data.product.imageUrl)}" alt="${safeProductName}" width="150" height="150" style="border-radius: 8px; margin-bottom: 16px; object-fit: cover;">
          ` : ''}
          <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #1f2937;">${safeProductName}</h2>
          <p style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; color: #CC5500;">$${data.product.price.toFixed(2)}</p>
          <p style="margin: 0; font-size: 14px; color: #6b7280;">
            ${isFr
              ? `Commandé il y a ${data.daysSinceDelivery} jours`
              : `Ordered ${data.daysSinceDelivery} days ago`}
          </p>
        </div>

        ${emailComponents.button(
          isFr ? '🔄 Recommander maintenant' : '🔄 Reorder now',
          isSafeUrl(productUrl) ? productUrl : '#'
        )}

        <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 24px;">
          ${isFr
            ? 'Commandez maintenant pour une livraison sans interruption de votre recherche.'
            : 'Order now for uninterrupted delivery for your research.'}
        </p>
      `;
      break;
    }

    // -- Step 2 (30 days): "Don't run out! Last chance to reorder" -------------
    case 2: {
      subject = isFr
        ? `Ne tombez pas en rupture de ${safeSubjectName(data.product.name)}!`
        : `Don't run out of ${safeSubjectName(data.product.name)}!`;

      preheader = isFr
        ? `Dernière chance de recommander avant la rupture`
        : `Last chance to reorder before you run out`;

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">⚠️</span>
        </div>

        <h1 style="color: #dc2626; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'Ne tombez pas en rupture!' : 'Don\'t run out!'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, il y a ${data.daysSinceDelivery} jours que vous avez reçu votre <strong>${safeProductName}</strong>. Votre stock doit être presque épuisé!`
            : `${safeName}, it's been ${data.daysSinceDelivery} days since you received your <strong>${safeProductName}</strong>. Your supply must be almost gone!`}
        </p>

        ${emailComponents.warningBox(`
          <p style="margin: 0; color: #92400e; text-align: center;">
            <strong>⏰ ${isFr ? 'Dernière chance!' : 'Last chance!'}</strong><br>
            ${isFr
              ? 'Recommandez maintenant pour éviter toute interruption de votre recherche.'
              : 'Reorder now to avoid any interruption in your research.'}
          </p>
        `)}

        <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          ${data.product.imageUrl && isSafeUrl(data.product.imageUrl) ? `
          <img src="${escapeHtml(data.product.imageUrl)}" alt="${safeProductName}" width="120" height="120" style="border-radius: 8px; margin-bottom: 12px; object-fit: cover;">
          ` : ''}
          <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1f2937;">${safeProductName}</h2>
          <p style="margin: 0; font-size: 22px; font-weight: bold; color: #CC5500;">$${data.product.price.toFixed(2)}</p>
        </div>

        ${emailComponents.button(
          isFr ? '⚡ Commander maintenant' : '⚡ Order now',
          isSafeUrl(productUrl) ? productUrl : '#'
        )}
      `;
      break;
    }

    // -- Step 3 (35 days): "Miss your product? Here's 10% off" ----------------
    case 3: {
      const discount = data.discountPercent || 10;
      subject = isFr
        ? `Votre ${safeSubjectName(data.product.name)} vous manque? ${discount}% de rabais`
        : `Miss your ${safeSubjectName(data.product.name)}? ${discount}% off`;

      preheader = isFr
        ? `${discount}% de rabais sur votre prochaine commande de ${data.product.name}`
        : `${discount}% off your next order of ${data.product.name}`;

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">💊</span>
        </div>

        <h1 style="color: #CC5500; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'Votre produit vous manque?' : 'Missing your product?'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, nous avons remarqué que vous n'avez pas recommandé votre <strong>${safeProductName}</strong>. Voici une offre spéciale pour reprendre votre recherche!`
            : `${safeName}, we noticed you haven't reordered your <strong>${safeProductName}</strong>. Here's a special offer to resume your research!`}
        </p>

        ${data.discountCode ? `
        <div style="background: #d1fae5; border-radius: 16px; padding: 32px; margin: 24px 0; text-align: center; border: 2px dashed #10b981;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #065f46; text-transform: uppercase; letter-spacing: 2px;">
            ${isFr ? 'Offre de retour' : 'Come-back offer'}
          </p>
          <p style="margin: 0 0 16px 0; font-size: 42px; font-weight: bold; color: #059669;">
            ${discount}% ${isFr ? 'DE RABAIS' : 'OFF'}
          </p>
          <div style="background-color: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${isFr ? 'Votre code' : 'Your code'}</p>
            <p style="margin: 0; font-size: 28px; font-weight: bold; color: #1f2937; letter-spacing: 4px; font-family: monospace;">
              ${data.discountCode}
            </p>
          </div>
        </div>
        ` : ''}

        ${emailComponents.button(
          isFr ? '🔄 Recommander avec rabais' : '🔄 Reorder with discount',
          `${SHOP_URL}/product/${data.product.slug}${data.discountCode ? `?promo=${data.discountCode}` : ''}`
        )}

        ${emailComponents.divider()}

        <p style="font-size: 14px; color: #6b7280; text-align: center;">
          ${isFr
            ? 'La continuité est essentielle pour des résultats de recherche optimaux.'
            : 'Consistency is key for optimal research results.'}
        </p>
      `;
      break;
    }
  }

  return {
    subject,
    html: baseTemplate({
      preheader,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 9. EMAIL VENTE CROISÉE / MONTÉE EN GAMME (CROSS-SELL)
// ============================================
export interface CrossSellEmailData {
  customerName: string;
  customerEmail: string;
  originalProduct: {
    name: string;
    slug: string;
  };
  recommendations: Array<{
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
    reason?: string; // e.g. "Popular combo", "Higher potency", "Essential supply"
  }>;
  /** Step 1 = complementary products, Step 2 = upgrade / bundle options */
  step: 1 | 2;
  locale?: 'fr' | 'en';
  unsubscribeUrl?: string;
}

/**
 * Peptide-specific cross-sell product mappings.
 * Used by cron jobs and flow logic to determine recommendations.
 */
export const PEPTIDE_CROSS_SELL_MAP: Record<string, { complementary: string[]; upgrades: string[] }> = {
  'bpc-157': {
    complementary: ['tb-500', 'bpc-157-tb-500-blend'],
    upgrades: ['bpc-157-tb-500-blend'],
  },
  'tb-500': {
    complementary: ['bpc-157', 'bpc-157-tb-500-blend'],
    upgrades: ['bpc-157-tb-500-blend'],
  },
  'cjc-1295': {
    complementary: ['ipamorelin', 'cjc-1295-ipamorelin-blend'],
    upgrades: ['cjc-1295-ipamorelin-blend'],
  },
  'ipamorelin': {
    complementary: ['cjc-1295', 'cjc-1295-ipamorelin-blend'],
    upgrades: ['cjc-1295-ipamorelin-blend'],
  },
  // Any peptide maps to lab equipment
  '_default': {
    complementary: ['bacteriostatic-water', 'syringes'],
    upgrades: [],
  },
};

export function crossSellEmail(data: CrossSellEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);
  const safeOriginalName = escapeHtml(data.originalProduct.name);

  let subject: string;
  let content: string;
  let preheader: string;

  switch (data.step) {
    // -- Step 1 (7 days): "Customers who bought X also love..." ----------------
    case 1: {
      subject = isFr
        ? `Les clients qui ont acheté ${safeSubjectName(data.originalProduct.name)} adorent aussi...`
        : `Customers who bought ${safeSubjectName(data.originalProduct.name)} also love...`;

      preheader = isFr
        ? `Complétez votre protocole de recherche avec des produits complémentaires`
        : `Complete your research protocol with complementary products`;

      const recsHtml = data.recommendations.slice(0, 3).map(p => `
        <tr>
          <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                ${p.imageUrl && isSafeUrl(p.imageUrl) ? `
                <td width="80" style="padding-right: 16px;">
                  <a href="${SHOP_URL}/product/${p.slug}" style="text-decoration: none;">
                    <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="80" height="80" style="border-radius: 8px; object-fit: cover;">
                  </a>
                </td>
                ` : ''}
                <td>
                  <p style="margin: 0 0 4px 0; font-weight: 600; color: #1f2937;">
                    <a href="${SHOP_URL}/product/${p.slug}" style="color: #1f2937; text-decoration: none;">${escapeHtml(p.name)}</a>
                  </p>
                  ${p.reason ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">${escapeHtml(p.reason)}</p>` : ''}
                  <p style="margin: 0; font-size: 18px; font-weight: bold; color: #CC5500;">$${p.price.toFixed(2)}</p>
                </td>
                <td width="120" align="right">
                  <a href="${SHOP_URL}/product/${p.slug}" style="display: inline-block; background-color: #CC5500; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">
                    ${isFr ? 'Voir' : 'View'}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `).join('');

      content = `
        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? '🔬 Complétez votre protocole' : '🔬 Complete your protocol'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, les chercheurs qui utilisent <strong>${safeOriginalName}</strong> obtiennent de meilleurs résultats avec ces produits complémentaires:`
            : `${safeName}, researchers using <strong>${safeOriginalName}</strong> get better results with these complementary products:`}
        </p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
          ${recsHtml}
        </table>

        ${emailComponents.button(
          isFr ? 'Explorer nos produits' : 'Explore our products',
          `${SHOP_URL}/shop`
        )}
      `;
      break;
    }

    // -- Step 2 (14 days): "Level up your protocol" ----------------------------
    case 2: {
      subject = isFr
        ? `Passez au niveau supérieur avec votre protocole de recherche`
        : `Level up your research protocol`;

      preheader = isFr
        ? `Découvrez des options premium et des ensembles pour votre recherche`
        : `Discover premium options and bundles for your research`;

      const upgradeHtml = data.recommendations.slice(0, 3).map(p => `
        <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin: 12px 0; text-align: center;">
          ${p.imageUrl && isSafeUrl(p.imageUrl) ? `
          <a href="${SHOP_URL}/product/${p.slug}" style="text-decoration: none;">
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="120" height="120" style="border-radius: 8px; margin-bottom: 12px; object-fit: cover;">
          </a>
          ` : ''}
          <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #1f2937;">
            <a href="${SHOP_URL}/product/${p.slug}" style="color: #1f2937; text-decoration: none;">${escapeHtml(p.name)}</a>
          </h3>
          ${p.reason ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #059669; font-weight: 600;">${escapeHtml(p.reason)}</p>` : ''}
          <p style="margin: 0 0 12px 0; font-size: 20px; font-weight: bold; color: #CC5500;">$${p.price.toFixed(2)}</p>
          <a href="${SHOP_URL}/product/${p.slug}" style="display: inline-block; background-color: #CC5500; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
            ${isFr ? 'Découvrir' : 'Discover'}
          </a>
        </div>
      `).join('');

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">🚀</span>
        </div>

        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'Passez au niveau supérieur' : 'Level up your protocol'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, améliorez vos résultats de recherche avec ces options avancées basées sur votre achat de <strong>${safeOriginalName}</strong>.`
            : `${safeName}, enhance your research results with these advanced options based on your purchase of <strong>${safeOriginalName}</strong>.`}
        </p>

        ${upgradeHtml}

        ${emailComponents.divider()}

        <p style="font-size: 14px; color: #6b7280; text-align: center;">
          ${isFr
            ? 'Besoin de conseils sur les combinaisons optimales? Contactez notre équipe.'
            : 'Need advice on optimal combinations? Contact our team.'}
        </p>
      `;
      break;
    }
  }

  return {
    subject,
    html: baseTemplate({
      preheader,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 10. EMAIL SUNSET / NETTOYAGE DE LISTE
// 3 variants: miss you, last chance, goodbye
// ============================================
export interface SunsetEmailData {
  customerName: string;
  customerEmail: string;
  /** Which step: 1 = "We miss you", 2 = "Last chance", 3 = "Goodbye" */
  step: 1 | 2 | 3;
  /** Latest products to showcase (step 1) */
  latestProducts?: Array<{
    name: string;
    slug: string;
    price: number;
    imageUrl?: string;
  }>;
  /** Re-engagement incentive (step 2) */
  discountCode?: string;
  discountPercent?: number;
  /** Preference center URL for step 2/3 */
  preferenceCenterUrl?: string;
  locale?: 'fr' | 'en';
  unsubscribeUrl?: string;
}

export function sunsetEmail(data: SunsetEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);

  let subject: string;
  let content: string;
  let preheader: string;

  switch (data.step) {
    // -- Step 1: "We miss you! Here's what's new" ----------------------------
    case 1: {
      subject = isFr
        ? `Vous nous manquez! Voici les nouveautés`
        : `We miss you! Here's what's new`;

      preheader = isFr
        ? `Cela fait un moment - découvrez ce que vous avez manqué`
        : `It's been a while - discover what you've missed`;

      const productsHtml = (data.latestProducts || []).slice(0, 3).map(p => `
        <td style="padding: 8px; text-align: center; width: 33%;">
          ${p.imageUrl && isSafeUrl(p.imageUrl) ? `
          <a href="${SHOP_URL}/product/${p.slug}" style="text-decoration: none;">
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="120" height="120" style="border-radius: 8px; margin-bottom: 8px; object-fit: cover;">
          </a>
          ` : ''}
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #1f2937; font-size: 13px;">
            <a href="${SHOP_URL}/product/${p.slug}" style="color: #1f2937; text-decoration: none;">${escapeHtml(p.name)}</a>
          </p>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #CC5500;">$${p.price.toFixed(2)}</p>
        </td>
      `).join('');

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">👋</span>
        </div>

        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'Vous nous manquez!' : 'We miss you!'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `Bonjour ${safeName}, cela fait un moment que nous n'avons pas eu de vos nouvelles. Voici ce que vous avez manqué!`
            : `Hello ${safeName}, it's been a while since we've heard from you. Here's what you've missed!`}
        </p>

        ${(data.latestProducts?.length ?? 0) > 0 ? `
        <h2 style="font-size: 18px; text-align: center; margin-top: 24px;">
          ${isFr ? '🆕 Nouveaux produits' : '🆕 New products'}
        </h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 16px 0;">
          <tr>
            ${productsHtml}
          </tr>
        </table>
        ` : ''}

        ${emailComponents.button(
          isFr ? 'Voir toutes les nouveautés' : 'See all new products',
          `${SHOP_URL}/shop?sort=newest`
        )}

        ${emailComponents.divider()}

        <p style="font-size: 14px; color: #6b7280; text-align: center;">
          ${isFr
            ? 'Si vous ne souhaitez plus recevoir nos emails, vous pouvez mettre à jour vos préférences ci-dessous.'
            : 'If you no longer wish to receive our emails, you can update your preferences below.'}
        </p>
      `;
      break;
    }

    // -- Step 2 (7 days): "Last chance to stay in touch" ----------------------
    case 2: {
      subject = isFr
        ? `Dernière chance de rester en contact`
        : `Last chance to stay in touch`;

      preheader = isFr
        ? `Nous voulons vous garder - Confirmez votre intérêt`
        : `We want to keep you - Confirm your interest`;

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">✉️</span>
        </div>

        <h1 style="color: #dc2626; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'On vous perd?' : 'Are we losing you?'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, nous avons remarqué que vous n'avez pas ouvert nos derniers emails. Nous ne voulons pas encombrer votre boîte de réception si vous n'êtes plus intéressé(e).`
            : `${safeName}, we've noticed you haven't opened our recent emails. We don't want to clutter your inbox if you're no longer interested.`}
        </p>

        ${data.discountCode ? `
        <div style="background: #fef3c7; border-radius: 16px; padding: 32px; margin: 24px 0; text-align: center; border: 2px dashed #f59e0b;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e;">
            ${isFr ? '🎁 Un petit cadeau de retrouvailles' : '🎁 A little reunion gift'}
          </p>
          <p style="margin: 0 0 16px 0; font-size: 36px; font-weight: bold; color: #CC5500;">
            ${data.discountPercent || 10}% ${isFr ? 'DE RABAIS' : 'OFF'}
          </p>
          <div style="background-color: white; border-radius: 8px; padding: 12px;">
            <p style="margin: 0; font-size: 20px; font-weight: bold; color: #1f2937; letter-spacing: 3px; font-family: monospace;">
              ${data.discountCode}
            </p>
          </div>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 24px 0;">
          ${emailComponents.button(
            isFr ? '✅ Je veux rester!' : '✅ I want to stay!',
            `${SHOP_URL}/shop`
          )}
        </div>

        ${data.preferenceCenterUrl ? `
        <p style="font-size: 14px; color: #6b7280; text-align: center;">
          ${isFr
            ? `Ou <a href="${data.preferenceCenterUrl}" style="color: #CC5500;">modifiez vos préférences email</a> pour recevoir uniquement ce qui vous intéresse.`
            : `Or <a href="${data.preferenceCenterUrl}" style="color: #CC5500;">update your email preferences</a> to only receive what interests you.`}
        </p>
        ` : ''}

        ${emailComponents.divider()}

        <p style="font-size: 13px; color: #9ca3af; text-align: center;">
          ${isFr
            ? '⚠️ Sans réponse de votre part dans les 7 prochains jours, nous cesserons de vous envoyer des emails marketing.'
            : '⚠️ Without a response within the next 7 days, we will stop sending you marketing emails.'}
        </p>
      `;
      break;
    }

    // -- Step 3 (14 days): "Goodbye for now" - auto-unsubscribe ---------------
    case 3: {
      subject = isFr
        ? `Au revoir pour le moment`
        : `Goodbye for now`;

      preheader = isFr
        ? `Nous vous avons retiré de notre liste - Revenez quand vous voulez`
        : `We've removed you from our list - Come back anytime`;

      content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 64px;">🫡</span>
        </div>

        <h1 style="color: #1f2937; margin-bottom: 8px; text-align: center;">
          ${isFr ? 'Au revoir pour le moment' : 'Goodbye for now'}
        </h1>
        <p style="font-size: 16px; color: #4b5563; text-align: center;">
          ${isFr
            ? `${safeName}, comme nous n'avons pas eu de réponse, nous vous avons retiré de notre liste d'envoi marketing. C'est notre façon de respecter votre boîte de réception.`
            : `${safeName}, since we haven't heard back, we've removed you from our marketing mailing list. It's our way of respecting your inbox.`}
        </p>

        <div style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #065f46;">
            ${isFr ? '💚 Vous pouvez toujours revenir!' : '💚 You can always come back!'}
          </p>
          <p style="margin: 0; font-size: 14px; color: #065f46;">
            ${isFr
              ? 'Si vous changez d\'avis, vous pourrez vous réinscrire à tout moment depuis votre compte ou notre site.'
              : 'If you change your mind, you can resubscribe anytime from your account or our website.'}
          </p>
        </div>

        ${emailComponents.button(
          isFr ? 'Se réinscrire' : 'Resubscribe',
          `${SHOP_URL}/newsletter`
        )}

        <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 24px;">
          ${isFr
            ? 'Vous recevrez toujours les emails transactionnels (commandes, livraisons, etc.).'
            : 'You will still receive transactional emails (orders, shipping, etc.).'}
        </p>
      `;
      break;
    }
  }

  return {
    subject,
    html: baseTemplate({
      preheader,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

// ============================================
// 11. EMAIL NIVEAU VIP / FIDÉLITÉ (VIP TIER UP)
// ============================================

/** Loyalty tier definitions with perks */
export const LOYALTY_TIERS: Record<string, {
  name: { fr: string; en: string };
  color: string;
  icon: string;
  perks: { fr: string[]; en: string[] };
  minPoints: number;
}> = {
  SILVER: {
    name: { fr: 'Argent', en: 'Silver' },
    color: '#94a3b8',
    icon: '🥈',
    perks: {
      fr: [
        '5% de rabais permanent sur toutes les commandes',
        'Accès anticipé aux nouveaux produits (24h)',
        'Points de fidélité x1.5 sur chaque achat',
        'Livraison gratuite sur les commandes de 150$+',
      ],
      en: [
        '5% permanent discount on all orders',
        'Early access to new products (24h)',
        'Loyalty points x1.5 on every purchase',
        'Free shipping on orders over $150',
      ],
    },
    minPoints: 500,
  },
  GOLD: {
    name: { fr: 'Or', en: 'Gold' },
    color: '#f59e0b',
    icon: '🥇',
    perks: {
      fr: [
        '10% de rabais permanent sur toutes les commandes',
        'Accès anticipé aux nouveaux produits (48h)',
        'Points de fidélité x2 sur chaque achat',
        'Livraison gratuite sur toutes les commandes',
        'Support prioritaire par email',
      ],
      en: [
        '10% permanent discount on all orders',
        'Early access to new products (48h)',
        'Loyalty points x2 on every purchase',
        'Free shipping on all orders',
        'Priority email support',
      ],
    },
    minPoints: 1500,
  },
  PLATINUM: {
    name: { fr: 'Platine', en: 'Platinum' },
    color: '#818cf8',
    icon: '💎',
    perks: {
      fr: [
        '15% de rabais permanent sur toutes les commandes',
        'Accès anticipé aux nouveaux produits (72h)',
        'Points de fidélité x3 sur chaque achat',
        'Livraison gratuite + prioritaire sur toutes les commandes',
        'Support VIP dédié par téléphone et email',
        'Cadeaux exclusifs et échantillons gratuits',
        'Invitations aux événements privés BioCycle',
      ],
      en: [
        '15% permanent discount on all orders',
        'Early access to new products (72h)',
        'Loyalty points x3 on every purchase',
        'Free + priority shipping on all orders',
        'Dedicated VIP support by phone and email',
        'Exclusive gifts and free samples',
        'Invitations to private BioCycle events',
      ],
    },
    minPoints: 5000,
  },
};

export interface VipTierUpEmailData {
  customerName: string;
  customerEmail: string;
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  lifetimePoints: number;
  locale?: 'fr' | 'en';
  unsubscribeUrl?: string;
}

export function vipTierUpEmail(data: VipTierUpEmailData): { subject: string; html: string } {
  const isFr = data.locale !== 'en';
  const safeName = escapeHtml(data.customerName);
  const tierDef = LOYALTY_TIERS[data.tier];

  if (!tierDef) {
    // Fallback for unknown tier
    return {
      subject: isFr ? 'Félicitations pour votre nouveau niveau!' : 'Congratulations on your new tier!',
      html: baseTemplate({
        preheader: isFr ? 'Vous avez atteint un nouveau niveau de fidélité' : 'You\'ve reached a new loyalty tier',
        content: `<p>${isFr ? 'Merci pour votre fidélité!' : 'Thank you for your loyalty!'}</p>`,
        locale: data.locale,
        unsubscribeUrl: data.unsubscribeUrl,
      }),
    };
  }

  const tierName = isFr ? tierDef.name.fr : tierDef.name.en;
  const perks = isFr ? tierDef.perks.fr : tierDef.perks.en;

  const subject = isFr
    ? `${tierDef.icon} Félicitations! Vous êtes maintenant ${tierName}!`
    : `${tierDef.icon} Congratulations! You're now ${tierName}!`;

  const preheader = isFr
    ? `Vous avez atteint le niveau ${tierName} avec ${data.lifetimePoints} points`
    : `You've reached ${tierName} tier with ${data.lifetimePoints} points`;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 80px;">${tierDef.icon}</span>
    </div>

    <h1 style="color: ${tierDef.color}; margin-bottom: 8px; text-align: center; font-size: 28px;">
      ${isFr ? 'Félicitations!' : 'Congratulations!'}
    </h1>
    <p style="font-size: 18px; color: #4b5563; text-align: center;">
      ${isFr
        ? `${safeName}, vous avez atteint le niveau`
        : `${safeName}, you've reached the`}
    </p>

    <div style="background: ${tierDef.color}15; border: 2px solid ${tierDef.color}; border-radius: 16px; padding: 32px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 48px; font-weight: bold; color: ${tierDef.color};">
        ${tierName}
      </p>
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        ${isFr
          ? `${data.lifetimePoints.toLocaleString('fr-CA')} points de fidélité accumulés`
          : `${data.lifetimePoints.toLocaleString('en-CA')} loyalty points accumulated`}
      </p>
    </div>

    <h2 style="font-size: 20px; text-align: center; margin-top: 32px;">
      ${isFr ? '🎁 Vos avantages exclusifs' : '🎁 Your exclusive perks'}
    </h2>

    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 16px 0;">
      <ul style="list-style: none; padding: 0; margin: 0;">
        ${perks.map(perk => `
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center;">
          <span style="font-size: 18px; margin-right: 12px;">✅</span>
          <span style="font-size: 15px; color: #1f2937;">${escapeHtml(perk)}</span>
        </li>
        `).join('')}
      </ul>
    </div>

    ${emailComponents.button(
      isFr ? 'Profiter de mes avantages' : 'Enjoy my perks',
      `${SHOP_URL}/shop`
    )}

    ${emailComponents.divider()}

    <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #1e40af;">
        ${isFr
          ? '💡 Vos avantages s\'appliquent automatiquement à chaque commande!'
          : '💡 Your perks are automatically applied to every order!'}
      </p>
    </div>

    <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-top: 24px;">
      ${isFr
        ? `Merci pour votre fidélité, ${safeName}. Vous faites partie de notre famille de chercheurs!`
        : `Thank you for your loyalty, ${safeName}. You're part of our researcher family!`}
    </p>
  `;

  return {
    subject,
    html: baseTemplate({
      preheader,
      content,
      locale: data.locale,
      unsubscribeUrl: data.unsubscribeUrl,
    }),
  };
}

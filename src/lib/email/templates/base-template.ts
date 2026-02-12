/**
 * Template de base pour tous les emails BioCycle Peptides
 */

export interface BaseTemplateData {
  preheader?: string;
  content: string;
  footerText?: string;
  unsubscribeUrl?: string;
  locale?: 'fr' | 'en';
}

// const LOGO_URL = 'https://biocyclepeptides.com/images/logo-email.png'; // For future use
const BRAND_COLOR = '#CC5500'; // Orange
const DARK_COLOR = '#1f2937';

export function baseTemplate(data: BaseTemplateData): string {
  const { preheader = '', content, footerText, unsubscribeUrl, locale = 'fr' } = data;

  const isFr = locale === 'fr';
  
  const defaultFooter = isFr 
    ? 'Cet email a été envoyé par BioCycle Peptides. Tous les produits sont destinés uniquement à la recherche scientifique.'
    : 'This email was sent by BioCycle Peptides. All products are intended for scientific research only.';

  const contactText = isFr ? 'Contactez-nous' : 'Contact us';
  const viewOnlineText = isFr ? 'Voir en ligne' : 'View online';

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>BioCycle Peptides</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .button { padding: 12px 24px !important; }
  </style>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background-color: ${DARK_COLOR}; padding: 24px; text-align: center; }
    .logo { height: 40px; }
    .content { background-color: #ffffff; padding: 32px; }
    .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; }
    .button { display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .button:hover { background-color: #AD4700; }
    .divider { border-top: 1px solid #e5e7eb; margin: 24px 0; }
    h1, h2, h3 { color: ${DARK_COLOR}; margin-top: 0; }
    p { color: #4b5563; line-height: 1.6; }
    a { color: ${BRAND_COLOR}; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
    @media only screen and (max-width: 600px) {
      .content { padding: 20px !important; }
      .button { display: block !important; text-align: center; }
    }
  </style>
</head>
<body>
  <!-- Preheader -->
  <div class="preheader">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td class="header" style="background-color: ${DARK_COLOR}; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-flex; align-items: center; gap: 12px;">
                      <div style="width: 40px; height: 40px; background-color: ${BRAND_COLOR}; border-radius: 10px; display: inline-block; text-align: center; line-height: 40px;">
                        <span style="color: white; font-weight: bold; font-size: 16px;">BC</span>
                      </div>
                      <span style="color: white; font-size: 20px; font-weight: bold;">BioCycle Peptides</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content" style="background-color: #ffffff; padding: 32px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer" style="background-color: #f9fafb; padding: 24px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #6b7280;">
                ${footerText || defaultFooter}
              </p>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #9ca3af;">
                <a href="https://biocyclepeptides.com/contact" style="color: #6b7280; text-decoration: underline;">${contactText}</a>
                &nbsp;|&nbsp;
                <a href="https://biocyclepeptides.com" style="color: #6b7280; text-decoration: underline;">${viewOnlineText}</a>
                ${unsubscribeUrl ? `&nbsp;|&nbsp;<a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">${isFr ? 'Se désabonner' : 'Unsubscribe'}</a>` : ''}
              </p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                © ${new Date().getFullYear()} BioCycle Peptides Inc. Montréal, Québec, Canada
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Composants réutilisables
export const emailComponents = {
  button: (text: string, url: string) => `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${url}" class="button" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">${text}</a>
        </td>
      </tr>
    </table>
  `,
  
  divider: () => `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">`,
  
  infoBox: (content: string, color: string = '#f0fdf4', borderColor: string = '#86efac') => `
    <div style="background-color: ${color}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 16px; margin: 16px 0;">
      ${content}
    </div>
  `,
  
  warningBox: (content: string) => `
    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0;">
      ${content}
    </div>
  `,
  
  orderItem: (name: string, quantity: number, price: string, imageUrl?: string) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            ${imageUrl ? `<td width="60" style="padding-right: 12px;"><img src="${imageUrl}" alt="${name}" width="60" height="60" style="border-radius: 8px; object-fit: cover;"></td>` : ''}
            <td>
              <p style="margin: 0; font-weight: 600; color: #1f2937;">${name}</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Qty: ${quantity}</p>
            </td>
            <td align="right" style="font-weight: 600; color: #1f2937;">${price}</td>
          </tr>
        </table>
      </td>
    </tr>
  `,
  
  trackingInfo: (carrier: string, trackingNumber: string, trackingUrl: string, isFr: boolean = true) => `
    <div style="background-color: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e40af;">
        <strong>${isFr ? 'Transporteur' : 'Carrier'}:</strong> ${carrier}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; color: #1e40af; letter-spacing: 2px;">
        ${trackingNumber}
      </p>
      <a href="${trackingUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
        📦 ${isFr ? 'Suivre ma commande' : 'Track my order'}
      </a>
    </div>
  `,
};

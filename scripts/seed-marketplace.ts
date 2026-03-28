/**
 * Seed script to populate the App Marketplace with 20 third-party app listings.
 * Run with: npx tsx scripts/seed-marketplace.ts
 *
 * Categories covered:
 *   - shipping (3): Postes Canada, Purolator, FedEx
 *   - payments (2): Interac, PayPal Express
 *   - marketing (3): Google Analytics, Meta Pixel, Mailchimp
 *   - seo (2): SEO Pro, Schema Markup
 *   - social (2): Instagram Feed, TikTok Shop
 *   - productivity (2): Zapier, Make.com
 *   - accounting (2): QuickBooks Sync, Wave
 *   - communication (2): WhatsApp Business, Zendesk
 *   - ai (2): ChatGPT Assistant, Midjourney Images
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APP_LISTINGS = [
  // ── Shipping ────────────────────────────────────────────────────
  {
    slug: 'postes-canada',
    name: 'Postes Canada',
    tagline: 'Expédition automatisée avec Postes Canada',
    description:
      'Intégrez Postes Canada directement dans votre boutique. Calcul de tarifs en temps réel, génération d\'étiquettes, suivi des colis et notifications automatiques. Supporte Xpresspost, Colis accélérés, Colis réguliers et Priorité.',
    category: 'shipping',
    icon: '/images/marketplace/postes-canada.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://www.canadapost-postescanada.ca',
    documentationUrl: 'https://www.canadapost-postescanada.ca/info/mc/business/developer-centre.jsf',
    pricing: 'free',
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['orders.read', 'shipping.write', 'settings.read']),
  },
  {
    slug: 'purolator',
    name: 'Purolator',
    tagline: 'Livraison rapide avec Purolator Express',
    description:
      'Connectez Purolator pour des livraisons express à travers le Canada. Tarifs négociés, étiquettes automatiques, suivi en temps réel et retours simplifiés. Express, Ground et International.',
    category: 'shipping',
    icon: '/images/marketplace/purolator.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://www.purolator.com',
    documentationUrl: 'https://www.purolator.com/en/shipping/technology-solutions/e-ship-api',
    pricing: 'free',
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['orders.read', 'shipping.write', 'settings.read']),
  },
  {
    slug: 'fedex',
    name: 'FedEx',
    tagline: 'Expédition mondiale avec FedEx',
    description:
      'Offrez FedEx à vos clients pour des livraisons internationales fiables. Tarifs en temps réel, suivi avancé, étiquettes automatiques, FedEx Ground, Express Saver, International Priority et plus.',
    category: 'shipping',
    icon: '/images/marketplace/fedex.png',
    developerName: 'ShipConnect Inc.',
    developerUrl: 'https://shipconnect.io',
    websiteUrl: 'https://www.fedex.com',
    documentationUrl: 'https://developer.fedex.com',
    pricing: 'freemium',
    monthlyPrice: 9.99,
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['orders.read', 'shipping.write', 'customers.read']),
  },

  // ── Payments ────────────────────────────────────────────────────
  {
    slug: 'interac',
    name: 'Interac e-Transfer',
    tagline: 'Paiements Interac pour le marché canadien',
    description:
      'Acceptez les paiements par Interac e-Transfer et Interac Débit. Idéal pour le marché canadien, frais réduits, confirmations instantanées. Compatible avec toutes les banques canadiennes.',
    category: 'payments',
    icon: '/images/marketplace/interac.png',
    developerName: 'CanPay Solutions',
    developerUrl: 'https://canpay.ca',
    websiteUrl: 'https://www.interac.ca',
    documentationUrl: 'https://developer.interac.ca',
    pricing: 'free',
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['orders.read', 'payments.write', 'customers.read']),
  },
  {
    slug: 'paypal-express',
    name: 'PayPal Express Checkout',
    tagline: 'Checkout rapide avec PayPal',
    description:
      'Ajoutez PayPal Express Checkout à votre boutique. Paiements par PayPal, cartes de crédit et débit via PayPal. Bouton PayPal sur la page produit et au checkout. Gestion des remboursements intégrée.',
    category: 'payments',
    icon: '/images/marketplace/paypal.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://www.paypal.com',
    documentationUrl: 'https://developer.paypal.com/docs/checkout/',
    pricing: 'free',
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['orders.read', 'orders.write', 'payments.write']),
  },

  // ── Marketing ───────────────────────────────────────────────────
  {
    slug: 'google-analytics',
    name: 'Google Analytics 4',
    tagline: 'Suivi analytique avancé avec GA4',
    description:
      'Installez Google Analytics 4 en un clic. Suivi e-commerce amélioré, événements automatiques (view_item, add_to_cart, purchase), rapports de conversion, audiences personnalisées et intégration Google Ads.',
    category: 'marketing',
    icon: '/images/marketplace/google-analytics.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://analytics.google.com',
    documentationUrl: 'https://developers.google.com/analytics',
    pricing: 'free',
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['analytics.write', 'orders.read', 'products.read']),
  },
  {
    slug: 'meta-pixel',
    name: 'Meta Pixel (Facebook/Instagram)',
    tagline: 'Pixel de conversion Meta pour FB & IG',
    description:
      'Installez le Meta Pixel et l\'API Conversions pour un suivi précis. Événements standard (ViewContent, AddToCart, Purchase), audiences personnalisées, retargeting dynamique et optimisation des campagnes Meta Ads.',
    category: 'marketing',
    icon: '/images/marketplace/meta-pixel.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://business.facebook.com',
    documentationUrl: 'https://developers.facebook.com/docs/meta-pixel',
    pricing: 'free',
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['analytics.write', 'orders.read', 'products.read', 'customers.read']),
  },
  {
    slug: 'mailchimp',
    name: 'Mailchimp',
    tagline: 'Email marketing automatisé avec Mailchimp',
    description:
      'Synchronisez vos clients avec Mailchimp pour des campagnes email ciblées. Segmentation automatique, emails transactionnels, workflows d\'automatisation, A/B testing et rapports détaillés.',
    category: 'marketing',
    icon: '/images/marketplace/mailchimp.png',
    developerName: 'MailSync Pro',
    developerUrl: 'https://mailsync.pro',
    websiteUrl: 'https://mailchimp.com',
    documentationUrl: 'https://mailchimp.com/developer/',
    pricing: 'freemium',
    monthlyPrice: 14.99,
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['customers.read', 'orders.read', 'marketing.write']),
  },

  // ── SEO ─────────────────────────────────────────────────────────
  {
    slug: 'seo-pro',
    name: 'SEO Pro',
    tagline: 'Optimisation SEO avancée pour votre boutique',
    description:
      'Outil SEO complet inspiré de Yoast. Analyse de contenu en temps réel, meta tags automatiques, sitemap XML, fil d\'Ariane (breadcrumbs), Open Graph, redirections 301, score SEO par page et suggestions d\'amélioration.',
    category: 'seo',
    icon: '/images/marketplace/seo-pro.png',
    developerName: 'SearchBoost',
    developerUrl: 'https://searchboost.io',
    websiteUrl: 'https://searchboost.io/seo-pro',
    documentationUrl: 'https://docs.searchboost.io',
    pricing: 'paid',
    monthlyPrice: 19.99,
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['content.read', 'content.write', 'products.read', 'seo.write']),
  },
  {
    slug: 'schema-markup',
    name: 'Schema Markup Generator',
    tagline: 'Données structurées JSON-LD automatiques',
    description:
      'Génère automatiquement les données structurées Schema.org (JSON-LD) pour vos produits, articles, FAQ, avis et entreprise. Améliore les rich snippets Google, les étoiles dans les résultats de recherche et le CTR organique.',
    category: 'seo',
    icon: '/images/marketplace/schema-markup.png',
    developerName: 'StructuredData Co.',
    developerUrl: 'https://structureddata.co',
    websiteUrl: 'https://structureddata.co/schema-markup',
    documentationUrl: 'https://docs.structureddata.co',
    pricing: 'freemium',
    monthlyPrice: 7.99,
    isVerified: false,
    isFeatured: false,
    permissions: JSON.stringify(['products.read', 'content.read', 'seo.write']),
  },

  // ── Social ──────────────────────────────────────────────────────
  {
    slug: 'instagram-feed',
    name: 'Instagram Feed',
    tagline: 'Affichez votre feed Instagram sur votre boutique',
    description:
      'Intégrez votre feed Instagram directement sur votre page d\'accueil ou vos pages produits. Galerie responsive, shoppable tags, stories highlights, reels et synchronisation automatique.',
    category: 'social',
    icon: '/images/marketplace/instagram.png',
    developerName: 'SocialWidget',
    developerUrl: 'https://socialwidget.io',
    websiteUrl: 'https://socialwidget.io/instagram',
    documentationUrl: 'https://docs.socialwidget.io',
    pricing: 'freemium',
    monthlyPrice: 9.99,
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['content.write', 'media.read']),
  },
  {
    slug: 'tiktok-shop',
    name: 'TikTok Shop',
    tagline: 'Vendez directement sur TikTok',
    description:
      'Connectez votre catalogue à TikTok Shop. Synchronisation des produits, gestion des commandes TikTok, pixel TikTok intégré, live shopping et analytics unifiés.',
    category: 'social',
    icon: '/images/marketplace/tiktok.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://shop.tiktok.com',
    documentationUrl: 'https://developers.tiktok.com/doc/tiktok-shop-overview',
    pricing: 'free',
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['products.read', 'orders.write', 'inventory.read', 'analytics.write']),
  },

  // ── Productivity ────────────────────────────────────────────────
  {
    slug: 'zapier',
    name: 'Zapier',
    tagline: 'Connectez Koraline à 6000+ apps',
    description:
      'Automatisez vos flux de travail avec Zapier. Connectez Koraline à Slack, Google Sheets, Airtable, HubSpot, Notion et 6000+ autres applications. Triggers: nouvelle commande, nouveau client, stock bas. Actions: créer tâche, envoyer notification, mettre à jour CRM.',
    category: 'productivity',
    icon: '/images/marketplace/zapier.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://zapier.com',
    documentationUrl: 'https://zapier.com/apps/koraline/integrations',
    pricing: 'free',
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['orders.read', 'customers.read', 'products.read', 'webhooks.write']),
  },
  {
    slug: 'make-com',
    name: 'Make (ex-Integromat)',
    tagline: 'Automatisation visuelle avancée',
    description:
      'Créez des scénarios d\'automatisation complexes avec Make. Interface visuelle drag & drop, branches conditionnelles, gestion d\'erreurs, itérateurs et agrégateurs. Plus flexible que Zapier pour les workflows avancés.',
    category: 'productivity',
    icon: '/images/marketplace/make.png',
    developerName: 'AutoFlow Solutions',
    developerUrl: 'https://autoflow.solutions',
    websiteUrl: 'https://make.com',
    documentationUrl: 'https://www.make.com/en/api-documentation',
    pricing: 'free',
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['orders.read', 'customers.read', 'products.read', 'webhooks.write']),
  },

  // ── Accounting ──────────────────────────────────────────────────
  {
    slug: 'quickbooks-sync',
    name: 'QuickBooks Sync',
    tagline: 'Synchronisation bidirectionnelle avec QuickBooks',
    description:
      'Synchronisez automatiquement vos ventes, dépenses, clients et factures avec QuickBooks Online. Mapping des comptes personnalisable, gestion multi-devises, réconciliation automatique et rapports fiscaux canadiens (TPS/TVQ).',
    category: 'accounting',
    icon: '/images/marketplace/quickbooks.png',
    developerName: 'AccountSync',
    developerUrl: 'https://accountsync.ca',
    websiteUrl: 'https://quickbooks.intuit.com/ca/',
    documentationUrl: 'https://developer.intuit.com/app/developer/qbo/docs/develop',
    pricing: 'paid',
    monthlyPrice: 24.99,
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['orders.read', 'customers.read', 'accounting.write', 'settings.read']),
  },
  {
    slug: 'wave-accounting',
    name: 'Wave Accounting',
    tagline: 'Comptabilité gratuite pour petites entreprises',
    description:
      'Connectez Wave pour une comptabilité simplifiée. Export automatique des ventes, catégorisation des transactions, rapports financiers et préparation fiscale. Idéal pour les petites entreprises canadiennes.',
    category: 'accounting',
    icon: '/images/marketplace/wave.png',
    developerName: 'WaveConnect',
    developerUrl: 'https://waveconnect.io',
    websiteUrl: 'https://www.waveapps.com',
    documentationUrl: 'https://developer.waveapps.com/hc/en-us',
    pricing: 'freemium',
    monthlyPrice: 4.99,
    isVerified: false,
    isFeatured: false,
    permissions: JSON.stringify(['orders.read', 'customers.read', 'accounting.write']),
  },

  // ── Communication ───────────────────────────────────────────────
  {
    slug: 'whatsapp-business',
    name: 'WhatsApp Business',
    tagline: 'Support client et notifications via WhatsApp',
    description:
      'Envoyez des notifications de commande, confirmations de livraison et offres promotionnelles via WhatsApp Business API. Chat en direct avec vos clients, messages automatisés, catalogue produits WhatsApp et boutons interactifs.',
    category: 'communication',
    icon: '/images/marketplace/whatsapp.png',
    developerName: 'Koraline Labs',
    developerUrl: 'https://attitudes.vip',
    websiteUrl: 'https://business.whatsapp.com',
    documentationUrl: 'https://developers.facebook.com/docs/whatsapp',
    pricing: 'freemium',
    monthlyPrice: 29.99,
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['customers.read', 'orders.read', 'messaging.write']),
  },
  {
    slug: 'zendesk',
    name: 'Zendesk',
    tagline: 'Support client omnicanal professionnel',
    description:
      'Intégrez Zendesk pour un support client de qualité entreprise. Tickets automatiques depuis les commandes, widget de chat, base de connaissances, SLA, macros et rapports de satisfaction. Synchronisation bidirectionnelle des données client.',
    category: 'communication',
    icon: '/images/marketplace/zendesk.png',
    developerName: 'SupportBridge',
    developerUrl: 'https://supportbridge.io',
    websiteUrl: 'https://www.zendesk.com',
    documentationUrl: 'https://developer.zendesk.com',
    pricing: 'paid',
    monthlyPrice: 19.99,
    isVerified: true,
    isFeatured: false,
    permissions: JSON.stringify(['customers.read', 'orders.read', 'tickets.write']),
  },

  // ── AI ──────────────────────────────────────────────────────────
  {
    slug: 'chatgpt-assistant',
    name: 'ChatGPT Assistant',
    tagline: 'Assistant IA pour votre boutique',
    description:
      'Ajoutez un assistant conversationnel alimenté par GPT-4 à votre boutique. Répond aux questions des clients, recommande des produits, aide au checkout, rédige des descriptions produits et analyse les avis. Personnalisable avec votre ton de marque.',
    category: 'ai',
    icon: '/images/marketplace/chatgpt.png',
    developerName: 'AICommerce',
    developerUrl: 'https://aicommerce.io',
    websiteUrl: 'https://openai.com/chatgpt',
    documentationUrl: 'https://platform.openai.com/docs',
    pricing: 'paid',
    monthlyPrice: 29.99,
    isVerified: true,
    isFeatured: true,
    permissions: JSON.stringify(['products.read', 'customers.read', 'orders.read', 'content.write', 'chat.write']),
  },
  {
    slug: 'midjourney-images',
    name: 'Midjourney Images',
    tagline: 'Génération d\'images IA pour vos produits',
    description:
      'Générez des images produits, bannières et visuels marketing avec Midjourney. Styles prédéfinis (lifestyle, studio, minimaliste), génération en masse, intégration directe dans la médiathèque et A/B testing visuel.',
    category: 'ai',
    icon: '/images/marketplace/midjourney.png',
    developerName: 'VisualAI Studio',
    developerUrl: 'https://visualai.studio',
    websiteUrl: 'https://www.midjourney.com',
    documentationUrl: 'https://docs.midjourney.com',
    pricing: 'paid',
    monthlyPrice: 19.99,
    isVerified: false,
    isFeatured: false,
    permissions: JSON.stringify(['media.write', 'products.read']),
  },
];

async function main() {
  console.log('Seeding App Marketplace (20 listings)...');

  for (const app of APP_LISTINGS) {
    await prisma.appListing.upsert({
      where: { slug: app.slug },
      update: {
        name: app.name,
        tagline: app.tagline,
        description: app.description,
        category: app.category,
        icon: app.icon,
        developerName: app.developerName,
        developerUrl: app.developerUrl,
        websiteUrl: app.websiteUrl,
        documentationUrl: app.documentationUrl,
        pricing: app.pricing,
        monthlyPrice: app.monthlyPrice ?? null,
        isVerified: app.isVerified,
        isFeatured: app.isFeatured,
        permissions: app.permissions,
      },
      create: {
        slug: app.slug,
        name: app.name,
        tagline: app.tagline,
        description: app.description,
        category: app.category,
        icon: app.icon,
        developerName: app.developerName,
        developerUrl: app.developerUrl,
        websiteUrl: app.websiteUrl,
        documentationUrl: app.documentationUrl,
        pricing: app.pricing,
        monthlyPrice: app.monthlyPrice ?? null,
        isVerified: app.isVerified,
        isFeatured: app.isFeatured,
        permissions: app.permissions,
      },
    });
    console.log(`  [OK] ${app.name}`);
  }

  const count = await prisma.appListing.count();
  console.log(`\nDone! ${count} app listings in database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Koraline Module Data — Marketing Pages
 *
 * Complete data for all 11 Koraline modules used on feature/marketing pages.
 * Pricing sourced from stripe-constants.ts, features from outlook-nav.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleFeature {
  title: string;
  description: string;
  icon: string;
}

export interface ModuleStat {
  value: string;
  label: string;
}

export interface ModuleData {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  gradient: string;
  features: ModuleFeature[];
  stats: ModuleStat[];
  integrations: string[];
  includedIn: string[];
  addonPrice: number | null;
}

// ---------------------------------------------------------------------------
// Module Data
// ---------------------------------------------------------------------------

export const MODULE_DATA: Record<string, ModuleData> = {
  commerce: {
    slug: 'commerce',
    name: 'Commerce',
    tagline: 'Votre boutique en ligne, sans compromis',
    description:
      'Catalogue produits, commandes, inventaire, paiements Stripe, livraison multi-zones, bundles et abonnements. Tout ce qu\'il faut pour vendre en ligne avec une expérience client premium.',
    icon: '🛒',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
    features: [
      {
        title: 'Catalogue intelligent',
        description:
          'Produits, variantes, catégories hiérarchiques, filtres avancés et recherche instantanée.',
        icon: '📦',
      },
      {
        title: 'Commandes & expéditions',
        description:
          'Cycle de vie complet de la commande, suivi de livraison, zones d\'expédition personnalisées.',
        icon: '🚚',
      },
      {
        title: 'Gestion d\'inventaire',
        description:
          'Stock en temps réel, alertes seuil bas, mouvements de stock, fournisseurs intégrés.',
        icon: '📊',
      },
      {
        title: 'Paiements Stripe',
        description:
          'Cartes, virements, Apple Pay, Google Pay. Remboursements et litiges gérés nativement.',
        icon: '💳',
      },
      {
        title: 'Bundles & kits',
        description:
          'Créez des lots de produits avec tarification dynamique et gestion de stock synchronisée.',
        icon: '🎁',
      },
      {
        title: 'Abonnements récurrents',
        description:
          'Box mensuelles, produits récurrents, gestion des cycles de facturation automatisée.',
        icon: '🔄',
      },
      {
        title: 'Avis & questions clients',
        description:
          'Avis vérifiés, notes étoilées, Q&A produits pour renforcer la confiance.',
        icon: '⭐',
      },
    ],
    stats: [
      { value: '0%', label: 'Commission sur les ventes' },
      { value: '15+', label: 'Méthodes de paiement' },
      { value: '∞', label: 'Produits illimités' },
      { value: '22', label: 'Langues supportées' },
    ],
    integrations: ['comptabilite', 'marketing', 'crm', 'emails', 'fidelite'],
    includedIn: ['Koraline Essentiel', 'Koraline Pro', 'Koraline Enterprise'],
    addonPrice: null,
  },

  crm: {
    slug: 'crm',
    name: 'CRM',
    tagline: 'Chaque opportunité mérite un suivi exemplaire',
    description:
      'Pipeline visuel, gestion des leads et deals, segmentation avancée, automatisations, quotas de vente et analytics complets. Un CRM conçu pour les équipes de vente ambitieuses.',
    icon: '🤝',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 50%, #3b82f6 100%)',
    features: [
      {
        title: 'Pipeline visuel',
        description:
          'Drag & drop Kanban multi-pipelines avec probabilités pondérées et prévisions.',
        icon: '📊',
      },
      {
        title: 'Leads & contacts',
        description:
          'Import, scoring IA, déduplication, listes segmentées et enrichissement automatique.',
        icon: '👥',
      },
      {
        title: 'Deals & devis',
        description:
          'Suivi des opportunités, génération de devis PDF, approbation hiérarchique, contrats.',
        icon: '📝',
      },
      {
        title: 'Automatisations workflow',
        description:
          'Workflows visuels : relances, assignation, notifications, changements de statut automatiques.',
        icon: '⚡',
      },
      {
        title: 'Quotas & leaderboard',
        description:
          'Objectifs par rep, prévisions revenue récurrent, classement gamifié.',
        icon: '🏆',
      },
      {
        title: 'Analytics & rapports',
        description:
          'Funnel analysis, cohortes, heatmaps, attribution, CLV et dashboard builder.',
        icon: '📈',
      },
      {
        title: 'Inbox omnicanal',
        description:
          'Email, SMS, chat et téléphonie unifiés dans une seule boîte de réception.',
        icon: '📨',
      },
      {
        title: 'Knowledge base',
        description:
          'Base de connaissances interne, snippets, playbooks et formulaires web.',
        icon: '📖',
      },
    ],
    stats: [
      { value: '360°', label: 'Vue client unifiée' },
      { value: '12+', label: 'Types de rapports' },
      { value: '50+', label: 'Automatisations prêtes' },
      { value: '∞', label: 'Contacts illimités' },
    ],
    integrations: ['commerce', 'telephonie', 'emails', 'marketing', 'ia'],
    includedIn: ['Koraline Pro', 'Koraline Enterprise'],
    addonPrice: 14900,
  },

  comptabilite: {
    slug: 'comptabilite',
    name: 'Comptabilité',
    tagline: 'La comptabilité qui travaille pendant que vous dormez',
    description:
      'Journal d\'écritures, plan comptable, états financiers, TPS/TVQ, rapprochement bancaire, paie et conformité fiscale canadienne. Conçu pour les PME québécoises et canadiennes.',
    icon: '📒',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)',
    features: [
      {
        title: 'Saisie rapide & OCR',
        description:
          'Saisie assistée par IA, scan de factures OCR, écritures récurrentes automatisées.',
        icon: '⚡',
      },
      {
        title: 'Plan comptable complet',
        description:
          'Grand livre, balance de vérification, journal des écritures, multi-entités.',
        icon: '📋',
      },
      {
        title: 'États financiers',
        description:
          'Bilan, résultats, flux de trésorerie, budget, prévisions et rapports personnalisés.',
        icon: '📊',
      },
      {
        title: 'TPS/TVQ & conformité',
        description:
          'Déclarations fiscales, calendrier fiscal, RS&DE, immobilisations, conformité CPA.',
        icon: '🏛️',
      },
      {
        title: 'Rapprochement bancaire',
        description:
          'Import OFX/CSV, règles de catégorisation automatique, réconciliation Stripe.',
        icon: '🏦',
      },
      {
        title: 'Facturation & dépenses',
        description:
          'Factures clients et fournisseurs, notes de crédit, suivi du temps, bons de commande.',
        icon: '🧾',
      },
      {
        title: 'Paie & RH',
        description:
          'Calcul de paie, coûts par projet, intégration avec les modules commerce et CRM.',
        icon: '💰',
      },
    ],
    stats: [
      { value: '100%', label: 'Conformité TPS/TVQ' },
      { value: '90%', label: 'Saisie automatisée' },
      { value: '13', label: 'Provinces supportées' },
      { value: '24/7', label: 'Rapports en temps réel' },
    ],
    integrations: ['commerce', 'crm', 'formation', 'emails'],
    includedIn: ['Koraline Essentiel', 'Koraline Pro', 'Koraline Enterprise'],
    addonPrice: 9900,
  },

  marketing: {
    slug: 'marketing',
    name: 'Marketing',
    tagline: 'Attirez, convertissez, fidélisez',
    description:
      'Codes promo, SEO intégré, bannières dynamiques, programme ambassadeurs, promotions automatisées et upsell intelligent. Tout pour maximiser chaque visite.',
    icon: '📣',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)',
    features: [
      {
        title: 'Codes promo & promotions',
        description:
          'Codes usage unique ou multiple, réductions pourcentage ou montant, conditions avancées.',
        icon: '🏷️',
      },
      {
        title: 'SEO intégré',
        description:
          'Meta tags, sitemap, balises structurées, optimisation des images et audit SEO.',
        icon: '🔍',
      },
      {
        title: 'Bannières dynamiques',
        description:
          'Bannières contextuelles, ciblage par segment, programmation horaire et A/B testing.',
        icon: '🖼️',
      },
      {
        title: 'Programme ambassadeurs',
        description:
          'Liens d\'affiliation, commissions automatiques, tableau de bord parrain et filleul.',
        icon: '🤝',
      },
      {
        title: 'Upsell & cross-sell',
        description:
          'Recommandations produits, offres complémentaires, bundles suggérés au checkout.',
        icon: '📈',
      },
      {
        title: 'Programme fidélité',
        description:
          'Points par achat, paliers de récompenses, cartes-cadeaux et offres personnalisées.',
        icon: '🎯',
      },
    ],
    stats: [
      { value: '+35%', label: 'Panier moyen avec upsell' },
      { value: '∞', label: 'Codes promo' },
      { value: '22', label: 'Langues SEO' },
      { value: '3x', label: 'Taux de rétention' },
    ],
    integrations: ['commerce', 'emails', 'crm', 'fidelite', 'ia'],
    includedIn: ['Koraline Essentiel', 'Koraline Pro', 'Koraline Enterprise'],
    addonPrice: null,
  },

  telephonie: {
    slug: 'telephonie',
    name: 'Téléphonie',
    tagline: 'Un centre d\'appels dans votre navigateur',
    description:
      'VoIP Telnyx intégré, IVR visuel, enregistrement des appels, wallboard temps réel, coaching et file d\'attente intelligente. Votre équipe de vente mérite un outil à sa hauteur.',
    icon: '📞',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)',
    features: [
      {
        title: 'Softphone intégré',
        description:
          'Appels entrants et sortants directement dans le navigateur, WebRTC natif.',
        icon: '📱',
      },
      {
        title: 'IVR visuel builder',
        description:
          'Construisez vos menus vocaux en drag & drop, multi-niveaux, horaires personnalisés.',
        icon: '🔀',
      },
      {
        title: 'Enregistrement & transcription',
        description:
          'Enregistrement automatique, transcription IA, recherche dans les conversations.',
        icon: '🎙️',
      },
      {
        title: 'Wallboard temps réel',
        description:
          'Statistiques live : agents connectés, appels en cours, temps d\'attente, SLA.',
        icon: '📊',
      },
      {
        title: 'Coaching & écoute',
        description:
          'Écoute discrète, chuchotement, intervention. Formez vos agents en temps réel.',
        icon: '🎧',
      },
      {
        title: 'Analytics appels',
        description:
          'Durée, volume, sentiment, performance agents, queues et speech analytics.',
        icon: '📈',
      },
      {
        title: 'Campagnes sortantes',
        description:
          'Power dialer, progressive dialer, campagnes SMS, sondages post-appel.',
        icon: '📤',
      },
    ],
    stats: [
      { value: '99.9%', label: 'Disponibilité Telnyx' },
      { value: '<1s', label: 'Latence WebRTC' },
      { value: '∞', label: 'Minutes illimitées (CA)' },
      { value: '24/7', label: 'Monitoring temps réel' },
    ],
    integrations: ['crm', 'emails', 'ia', 'communaute'],
    includedIn: [],
    addonPrice: null,
  },

  formation: {
    slug: 'formation',
    name: 'Formation',
    tagline: 'Le LMS qui transforme l\'apprentissage en résultats',
    description:
      'Cours structurés, quiz interactifs, certification, conformité PQAP et Aurelia IA tutrice. Un système de formation continue pensé pour les professionnels réglementés.',
    icon: '🎓',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #ef4444 100%)',
    features: [
      {
        title: 'Cours & leçons',
        description:
          'Éditeur de contenu riche, vidéos, documents, progression séquentielle ou libre.',
        icon: '📚',
      },
      {
        title: 'Quiz & évaluations',
        description:
          'QCM, vrai/faux, réponse ouverte, banques de questions, correction automatique.',
        icon: '✍️',
      },
      {
        title: 'Certification & badges',
        description:
          'Certificats PDF personnalisés, badges de compétence, suivi des crédits UFC.',
        icon: '🏅',
      },
      {
        title: 'Conformité PQAP',
        description:
          'Forfaits par manuel (F-111, F-311, F-312, F-313), glossaire réglementaire, parcours obligatoires.',
        icon: '📋',
      },
      {
        title: 'Aurelia IA tutrice',
        description:
          'Tuteur IA socratique, révision espacée FSRS, diagnostic adaptatif, anti-hallucination.',
        icon: '🤖',
      },
      {
        title: 'Cohortes & entreprises',
        description:
          'Inscriptions en groupe, parcours par rôle, comptes corporatifs, reporting RH.',
        icon: '🏢',
      },
      {
        title: 'Sessions en direct',
        description:
          'Webinaires intégrés, Zoom/Teams/Meet, enregistrements et replay automatiques.',
        icon: '🎥',
      },
      {
        title: 'Analytics & rapports',
        description:
          'Progression, temps passé, taux de réussite, prédictions d\'abandon, exports.',
        icon: '📊',
      },
    ],
    stats: [
      { value: '12', label: 'Habiletés IA tutrice' },
      { value: '51', label: 'Modèles de données LMS' },
      { value: '100%', label: 'Conformité UFC/PQAP' },
      { value: '30+', label: 'Badges & récompenses' },
    ],
    integrations: ['ia', 'media', 'emails', 'comptabilite'],
    includedIn: [],
    addonPrice: 4900,
  },

  emails: {
    slug: 'emails',
    name: 'Emails',
    tagline: 'Chaque email est une opportunité de connexion',
    description:
      'Boîte de réception unifiée, campagnes marketing, flows automatisés, templates éditables, analytics détaillés et segmentation avancée. La communication email professionnelle, simplifiée.',
    icon: '✉️',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
    features: [
      {
        title: 'Inbox Outlook-style',
        description:
          'Boîte de réception avec dossiers, recherche, brouillons, archivage et notes.',
        icon: '📥',
      },
      {
        title: 'Campagnes marketing',
        description:
          'Éditeur drag & drop, segmentation, programmation, A/B testing et tracking.',
        icon: '📧',
      },
      {
        title: 'Flows automatisés',
        description:
          'Bienvenue, abandon panier, post-achat, anniversaire : parcours email automatiques.',
        icon: '⚡',
      },
      {
        title: 'Templates professionnels',
        description:
          'Bibliothèque de modèles responsive, personnalisation marque, variables dynamiques.',
        icon: '🎨',
      },
      {
        title: 'Analytics & délivrabilité',
        description:
          'Taux d\'ouverture, clics, bounces, désabonnements, score de délivrabilité.',
        icon: '📊',
      },
      {
        title: 'Segmentation avancée',
        description:
          'Listes dynamiques par comportement, achats, engagement, localisation.',
        icon: '🎯',
      },
    ],
    stats: [
      { value: '99.5%', label: 'Taux de délivrabilité' },
      { value: '∞', label: 'Emails par mois' },
      { value: '50+', label: 'Templates inclus' },
      { value: '8', label: 'Dossiers email' },
    ],
    integrations: ['crm', 'commerce', 'marketing', 'formation', 'ia'],
    includedIn: ['Koraline Essentiel', 'Koraline Pro', 'Koraline Enterprise'],
    addonPrice: 4900,
  },

  media: {
    slug: 'media',
    name: 'Médias',
    tagline: 'Votre présence digitale, orchestrée',
    description:
      'Gestion de vidéos, webinaires multi-plateformes, planification social media, brand kit et publicités sur 6 réseaux. Le hub média complet pour les entreprises modernes.',
    icon: '🎬',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #be123c 100%)',
    features: [
      {
        title: 'Bibliothèque média',
        description:
          'Vidéos, images, documents organisés. Catégories, tags, recherche et streaming.',
        icon: '📁',
      },
      {
        title: 'Webinaires intégrés',
        description:
          'Zoom, Teams, Webex, Google Meet et WhatsApp lancés directement depuis Koraline.',
        icon: '🎥',
      },
      {
        title: 'Blog & content marketing',
        description:
          'Éditeur d\'articles, catégories, SEO intégré, analytics de contenu.',
        icon: '✏️',
      },
      {
        title: 'Social media scheduler',
        description:
          'Planifiez et publiez sur YouTube, X, TikTok, LinkedIn, Meta simultanément.',
        icon: '📅',
      },
      {
        title: 'Brand kit',
        description:
          'Logo, couleurs, typographies, guidelines visuelles centralisées pour votre équipe.',
        icon: '🎨',
      },
      {
        title: 'Publicité multi-plateformes',
        description:
          'Google Ads, Meta Ads, LinkedIn Ads, YouTube, TikTok, X : gestion centralisée.',
        icon: '📢',
      },
      {
        title: 'Consentements & conformité',
        description:
          'Templates de consentement, tracking des permissions, conformité Loi 25.',
        icon: '🔒',
      },
    ],
    stats: [
      { value: '6', label: 'Plateformes publicitaires' },
      { value: '5', label: 'Plateformes webinaires' },
      { value: '∞', label: 'Stockage média' },
      { value: '12', label: 'API connectées' },
    ],
    integrations: ['commerce', 'marketing', 'formation', 'emails'],
    includedIn: ['Koraline Enterprise'],
    addonPrice: null,
  },

  fidelite: {
    slug: 'fidelite',
    name: 'Fidélité',
    tagline: 'Transformez vos clients en ambassadeurs',
    description:
      'Programme de points, paliers de récompenses, cartes-cadeaux et offres personnalisées. Fidélisez vos clients les plus précieux avec un programme qui leur ressemble.',
    icon: '🏆',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #eab308 50%, #ca8a04 100%)',
    features: [
      {
        title: 'Points par achat',
        description:
          'Attribution automatique de points sur chaque commande, bonus événementiels.',
        icon: '⭐',
      },
      {
        title: 'Paliers de fidélité',
        description:
          'Bronze, Argent, Or, Platine : avantages croissants par niveau d\'engagement.',
        icon: '🥇',
      },
      {
        title: 'Récompenses',
        description:
          'Échangez les points contre des réductions, produits gratuits ou expériences.',
        icon: '🎁',
      },
      {
        title: 'Cartes-cadeaux',
        description:
          'Cartes-cadeaux digitales, montants personnalisés, envoi par email.',
        icon: '💳',
      },
      {
        title: 'Offres personnalisées',
        description:
          'Promotions ciblées basées sur le comportement d\'achat et le palier.',
        icon: '🎯',
      },
    ],
    stats: [
      { value: '+40%', label: 'Rétention client' },
      { value: '4', label: 'Paliers de fidélité' },
      { value: '+25%', label: 'Panier moyen' },
      { value: '∞', label: 'Récompenses configurables' },
    ],
    integrations: ['commerce', 'marketing', 'emails', 'crm'],
    includedIn: ['Koraline Enterprise'],
    addonPrice: 3900,
  },

  communaute: {
    slug: 'communaute',
    name: 'Communauté',
    tagline: 'Le support client qui fidélise',
    description:
      'Chat en direct, système de tickets, forum communautaire et base de connaissances. Offrez un support client exceptionnel tout en réduisant la charge sur votre équipe.',
    icon: '💬',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
    features: [
      {
        title: 'Chat en direct',
        description:
          'Widget de chat intégré, réponses rapides, transfert agent, historique persistant.',
        icon: '💬',
      },
      {
        title: 'Ticketing',
        description:
          'Création, assignation, priorité, SLA, escalade et suivi des tickets support.',
        icon: '🎫',
      },
      {
        title: 'Base de connaissances',
        description:
          'Articles d\'aide, catégories, recherche, suggestions IA. Réduisez les tickets.',
        icon: '📖',
      },
      {
        title: 'Forum communautaire',
        description:
          'Discussions, catégories, votes, modération et mise en avant des solutions.',
        icon: '🗣️',
      },
      {
        title: 'Snippets & réponses types',
        description:
          'Bibliothèque de réponses prédéfinies pour accélérer le support.',
        icon: '⚡',
      },
    ],
    stats: [
      { value: '<30s', label: 'Temps de réponse chat' },
      { value: '70%', label: 'Tickets auto-résolus' },
      { value: '∞', label: 'Articles de base' },
      { value: '24/7', label: 'Chat disponible' },
    ],
    integrations: ['crm', 'emails', 'telephonie', 'ia'],
    includedIn: ['Koraline Pro', 'Koraline Enterprise'],
    addonPrice: 4900,
  },

  ia: {
    slug: 'ia',
    name: 'IA Aurelia',
    tagline: 'Votre copilote intelligent, partout dans Koraline',
    description:
      'Aurelia est l\'IA intégrée à Koraline : copilote administratif, insights prédictifs, automatisation intelligente, rédaction assistée et tuteur pédagogique. Elle apprend de votre entreprise.',
    icon: '🧠',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f43f5e 100%)',
    features: [
      {
        title: 'Copilote administratif',
        description:
          'Suggestions contextuelles, résumés de données, raccourcis d\'actions dans chaque module.',
        icon: '🤖',
      },
      {
        title: 'Insights prédictifs',
        description:
          'Prévisions de ventes, détection d\'anomalies, scoring de leads, alertes proactives.',
        icon: '🔮',
      },
      {
        title: 'Automatisation IA',
        description:
          'Catégorisation automatique, réponses email suggérées, workflows déclenchés par l\'IA.',
        icon: '⚡',
      },
      {
        title: 'Rédaction assistée',
        description:
          'Descriptions produits, emails marketing, articles de blog, réponses support.',
        icon: '✍️',
      },
      {
        title: 'Tuteur pédagogique',
        description:
          'Méthode socratique, révision espacée, diagnostic adaptatif, 12 habiletés.',
        icon: '🎓',
      },
      {
        title: 'Assistant comptable',
        description:
          'Catégorisation des écritures, prédiction de comptes, détection d\'erreurs.',
        icon: '📒',
      },
    ],
    stats: [
      { value: '12', label: 'Habiletés pédagogiques' },
      { value: '11', label: 'Modules intégrés' },
      { value: '24/7', label: 'Disponible en continu' },
      { value: '22', label: 'Langues supportées' },
    ],
    integrations: ['commerce', 'crm', 'comptabilite', 'formation', 'emails', 'telephonie', 'marketing'],
    includedIn: [],
    addonPrice: null,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getModuleBySlug(slug: string): ModuleData | undefined {
  return MODULE_DATA[slug];
}

export function getAllModules(): ModuleData[] {
  return Object.values(MODULE_DATA);
}

export function getModuleSlugs(): string[] {
  return Object.keys(MODULE_DATA);
}

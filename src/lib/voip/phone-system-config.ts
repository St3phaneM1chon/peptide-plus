/**
 * Phone System Configuration — Central config for all DIDs, routing, and IVR
 *
 * This module defines the complete phone system configuration for Attitudes VIP.
 * It is used by the setup script to seed the database and configure Telnyx.
 *
 * Numbers:
 *   +14388030370 — Montreal (Main, FR)
 *   +18735860370 — Gatineau (Forward to main)
 *   +14378880370 — Toronto (EN primary)
 *   +18443040370 — Toll-Free (Bilingual)
 *
 * Future (slots reserved, not purchased):
 *   US number — TBD
 *   EU number — TBD
 */

// ─── Phone Number Definitions ────────────────────────────────────────────────

export interface PhoneNumberConfig {
  number: string;
  displayName: string;
  country: string;
  type: 'LOCAL' | 'TOLL_FREE' | 'MOBILE';
  region: string;
  language: string; // Primary language for this number
  forwardTo?: string; // If set, forward all calls to this number
  routeToIvr?: string; // IVR menu name (resolved to ID at setup)
  monthlyCost: number;
}

export const PHONE_NUMBERS: PhoneNumberConfig[] = [
  {
    number: '+14388030370',
    displayName: 'Attitudes VIP - Montréal',
    country: 'CA',
    type: 'LOCAL',
    region: 'Montreal',
    language: 'fr-CA',
    routeToIvr: 'Main Menu FR',
    monthlyCost: 1.00,
  },
  {
    number: '+18735860370',
    displayName: 'Attitudes VIP - Gatineau',
    country: 'CA',
    type: 'LOCAL',
    region: 'Gatineau',
    language: 'fr-CA',
    forwardTo: '+14388030370', // Alias → forward to main
    monthlyCost: 1.00,
  },
  {
    number: '+14378880370',
    displayName: 'Attitudes VIP - Toronto',
    country: 'CA',
    type: 'LOCAL',
    region: 'Toronto',
    language: 'en-CA',
    routeToIvr: 'Main Menu EN',
    monthlyCost: 1.00,
  },
  {
    number: '+18443040370',
    displayName: 'Attitudes VIP - Toll Free',
    country: 'CA',
    type: 'TOLL_FREE',
    region: 'Toll-Free',
    language: 'fr-CA', // Bilingual greeting, but default to FR
    routeToIvr: 'Main Menu Bilingual',
    monthlyCost: 2.00,
  },
];

// ─── Future Numbers (reserved slots, not purchased yet) ─────────────────────
// Uncomment and configure when ready to purchase:
//
// US Number:
// {
//   number: '+1XXXXXXXXXX',
//   displayName: 'Attitudes VIP - USA',
//   country: 'US',
//   type: 'LOCAL',
//   region: 'New York',
//   language: 'en-US',
//   routeToIvr: 'Main Menu EN',
//   monthlyCost: 1.00,
// },
//
// EU Number:
// {
//   number: '+33XXXXXXXXX',
//   displayName: 'Attitudes VIP - Europe',
//   country: 'FR',
//   type: 'LOCAL',
//   region: 'Paris',
//   language: 'fr-FR',
//   routeToIvr: 'Main Menu FR',
//   monthlyCost: 2.00,
// },

// ─── IVR Menu Definitions ────────────────────────────────────────────────────

export interface IvrMenuConfig {
  name: string;
  description: string;
  language: string;
  timezone: string;
  greetingText: string;
  businessHoursStart: string;
  businessHoursEnd: string;
  afterHoursMenuName?: string; // Resolved to ID at setup
  timeoutAction: 'replay' | 'operator' | 'voicemail';
  timeoutTarget?: string;
  options: Array<{
    digit: string;
    label: string;
    action: string;
    target: string;
    announcement?: string;
  }>;
}

export const IVR_MENUS: IvrMenuConfig[] = [
  // ── Main Menu FR (Montreal/Gatineau) ──
  {
    name: 'Main Menu FR',
    description: 'Menu principal francophone - heures d\'affaires',
    language: 'fr-CA',
    timezone: 'America/Toronto',
    greetingText:
      'Bienvenue chez Attitudes VIP. ' +
      'Cet appel peut être enregistré à des fins de qualité. ' +
      'Pour la réception, appuyez sur 0. ' +
      'Pour les ventes, appuyez sur 1. ' +
      'Pour le service à la clientèle, appuyez sur 2. ' +
      'Pour la facturation, appuyez sur 3. ' +
      'Pour le soutien technique, appuyez sur 4. ' +
      'Pour laisser un message, appuyez sur 9.',
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    afterHoursMenuName: 'After Hours FR',
    timeoutAction: 'voicemail',
    timeoutTarget: '1001', // Stephane's extension
    options: [
      { digit: '0', label: 'Réception', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transfert à la réception. Veuillez patienter.' },
      { digit: '1', label: 'Ventes', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transfert au département des ventes. Veuillez patienter.' },
      { digit: '2', label: 'Service à la clientèle', action: 'transfer_queue', target: 'caroline-queue', announcement: 'Transfert au service à la clientèle. Veuillez patienter.' },
      { digit: '3', label: 'Facturation', action: 'transfer_queue', target: 'caroline-queue', announcement: 'Transfert à la facturation. Veuillez patienter.' },
      { digit: '4', label: 'Soutien technique', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transfert au soutien technique. Veuillez patienter.' },
      { digit: '9', label: 'Messagerie', action: 'voicemail', target: '1001' },
    ],
  },

  // ── After Hours FR ──
  {
    name: 'After Hours FR',
    description: 'Message hors heures - francophone',
    language: 'fr-CA',
    timezone: 'America/Toronto',
    greetingText:
      'Merci d\'avoir appelé Attitudes VIP. ' +
      'Nos bureaux sont présentement fermés. Nos heures d\'ouverture sont du lundi au vendredi, de 9h à 17h, heure de l\'Est. ' +
      'Pour laisser un message vocal, appuyez sur 1. ' +
      'Pour nous envoyer un courriel, visitez attitudes.vip. ' +
      'Merci et à bientôt.',
    businessHoursStart: '00:00',
    businessHoursEnd: '23:59',
    timeoutAction: 'voicemail',
    timeoutTarget: '1001',
    options: [
      { digit: '1', label: 'Messagerie', action: 'voicemail', target: '1001' },
      { digit: '0', label: 'Urgence', action: 'external', target: '+14508474741' }, // Stephane mobile
    ],
  },

  // ── Main Menu EN (Toronto) ──
  {
    name: 'Main Menu EN',
    description: 'English main menu - business hours',
    language: 'en-US',
    timezone: 'America/Toronto',
    greetingText:
      'Welcome to Attitudes VIP. ' +
      'This call may be recorded for quality purposes. ' +
      'For reception, press 0. ' +
      'For sales, press 1. ' +
      'For customer service, press 2. ' +
      'For billing, press 3. ' +
      'For technical support, press 4. ' +
      'To leave a message, press 9.',
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    afterHoursMenuName: 'After Hours EN',
    timeoutAction: 'voicemail',
    timeoutTarget: '1001',
    options: [
      { digit: '0', label: 'Reception', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transferring to reception. Please hold.' },
      { digit: '1', label: 'Sales', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transferring to sales. Please hold.' },
      { digit: '2', label: 'Customer Service', action: 'transfer_queue', target: 'caroline-queue', announcement: 'Transferring to customer service. Please hold.' },
      { digit: '3', label: 'Billing', action: 'transfer_queue', target: 'caroline-queue', announcement: 'Transferring to billing. Please hold.' },
      { digit: '4', label: 'Technical Support', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transferring to technical support. Please hold.' },
      { digit: '9', label: 'Voicemail', action: 'voicemail', target: '1001' },
    ],
  },

  // ── After Hours EN ──
  {
    name: 'After Hours EN',
    description: 'After hours message - English',
    language: 'en-US',
    timezone: 'America/Toronto',
    greetingText:
      'Thank you for calling Attitudes VIP. ' +
      'Our offices are currently closed. Business hours are Monday to Friday, 9 AM to 5 PM Eastern. ' +
      'To leave a voicemail, press 1. ' +
      'To reach us by email, visit attitudes.vip. ' +
      'Thank you and have a great day.',
    businessHoursStart: '00:00',
    businessHoursEnd: '23:59',
    timeoutAction: 'voicemail',
    timeoutTarget: '1001',
    options: [
      { digit: '1', label: 'Voicemail', action: 'voicemail', target: '1001' },
      { digit: '0', label: 'Emergency', action: 'external', target: '+14508474741' },
    ],
  },

  // ── Main Menu Bilingual (Toll-Free) ──
  {
    name: 'Main Menu Bilingual',
    description: 'Menu bilingue pour le numéro sans frais',
    language: 'fr-CA',
    timezone: 'America/Toronto',
    greetingText:
      'Bienvenue chez Attitudes VIP. Welcome to Attitudes VIP. ' +
      'Pour le service en français, appuyez sur 1. ' +
      'For service in English, press 2.',
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    afterHoursMenuName: 'After Hours Bilingual',
    timeoutAction: 'replay',
    options: [
      { digit: '1', label: 'Français', action: 'sub_menu', target: 'Main Menu FR', announcement: 'Service en français.' },
      { digit: '2', label: 'English', action: 'sub_menu', target: 'Main Menu EN', announcement: 'Service in English.' },
      { digit: '0', label: 'Agent', action: 'transfer_queue', target: 'stephane-queue', announcement: 'Transfert à un agent. Transferring to an agent.' },
    ],
  },

  // ── After Hours Bilingual ──
  {
    name: 'After Hours Bilingual',
    description: 'After hours bilingual message',
    language: 'fr-CA',
    timezone: 'America/Toronto',
    greetingText:
      'Merci d\'avoir appelé Attitudes VIP. Nos bureaux sont fermés. ' +
      'Thank you for calling Attitudes VIP. Our offices are closed. ' +
      'Pour laisser un message, appuyez sur 1. To leave a message, press 1.',
    businessHoursStart: '00:00',
    businessHoursEnd: '23:59',
    timeoutAction: 'voicemail',
    timeoutTarget: '1001',
    options: [
      { digit: '1', label: 'Message', action: 'voicemail', target: '1001' },
    ],
  },
];

// ─── Business Hours Schedule ─────────────────────────────────────────────────

export const BUSINESS_HOURS = {
  timezone: 'America/Toronto',
  weekdays: { start: '09:00', end: '17:00' },
  evenings: { start: '17:00', end: '21:00', staffOnCall: 'stephane' },
  weekendAndNight: { voicemailOnly: true },
};

// ─── Feature Flags ──────────────────────────────────────────────────────────
export const FEATURE_FLAGS = {
  /** Enable GPT-powered conversational IVR (instead of DTMF-only) */
  useConversationalIvr: false, // Set to true to activate
  /** Enable VIP priority routing based on loyalty tier */
  useVipRouting: true,
  /** Enable automatic follow-up SMS for missed calls */
  useMissedCallSms: true,
  /** Enable post-call AI summary generation */
  useAutoSummary: true,
  /** Enable smart routing to last agent based on call history */
  useSmartRouting: true,

  // ── Voice AI (Phase 1) ──
  /** Enable Voice AI engine (STT→LLM→TTS pipeline instead of DTMF IVR) */
  useVoiceAI: false, // Set to true to activate Voice AI
  /** Enable Knowledge Base RAG for Voice AI (product/FAQ/Aurelia KB lookup) */
  useVoiceAIKnowledgeBase: true,
  /** Fallback to DTMF IVR if Voice AI is unavailable (API keys missing) */
  voiceAIFallbackToDTMF: true,
};

// ─── Voice AI Configuration ─────────────────────────────────────────────────
export const VOICE_AI_CONFIG = {
  /** LLM model for voice conversations */
  llmModel: 'gpt-4o',
  /** Max tokens per LLM response (keep short for natural speech) */
  maxTokens: 150,
  /** LLM temperature (lower = more factual, less creative) */
  temperature: 0.3,
  /** Max conversation turns before suggesting transfer to agent */
  maxTurns: 15,
  /** Deepgram STT model */
  sttModel: 'nova-2',
  /** ElevenLabs TTS model */
  ttsModel: 'eleven_turbo_v2_5',
  /** Language detection: auto-detect from speech vs from dialed number */
  autoDetectLanguage: true,
  /** Language mapping by dialed number (pre-detection hint) */
  languageByNumber: {
    '+14388030370': 'fr-CA',  // Montreal
    '+18735860370': 'fr-CA',  // Gatineau
    '+14378880370': 'en-CA',  // Toronto
    '+18443040370': '',        // Toll-Free: auto-detect
  } as Record<string, string>,
};

// ─── Staff Configuration ─────────────────────────────────────────────────────

export const STAFF = {
  stephane: {
    name: 'Stéphane',
    extension: '1001',
    mobile: '+14508474741',
    email: 'stephane.michon@attitudes.vip',
  },
  caroline: {
    name: 'Caroline',
    extension: '1002',
    mobile: undefined, // To be configured
    email: undefined,
  },
};

// ─── Queue Ring Strategy ─────────────────────────────────────────────────────

export const QUEUE_CONFIG = {
  'stephane-queue': {
    name: 'Stéphane',
    strategy: 'ring_all',
    agents: ['1001'], // Stéphane only
    ringTimeout: 20, // seconds before voicemail
    overflowVoicemail: '1001', // voicemail Stéphane
    holdMusic: 'default',
  },
  'caroline-queue': {
    name: 'Caroline',
    strategy: 'ring_all',
    agents: ['1002'], // Caroline only
    ringTimeout: 20,
    overflowVoicemail: '1002', // voicemail Caroline
    holdMusic: 'default',
  },
};

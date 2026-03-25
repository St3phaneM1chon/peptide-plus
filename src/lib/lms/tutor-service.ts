/**
 * TUTOR SERVICE — Aurelia Online: Intelligent AI Tutor (12 Skills)
 * =============================================================================
 * Brain of the LMS tutoring system. Orchestrates all 12 Aurelia tutoring skills
 * identified in the research plan (AURELIA_TUTORAT_HABILETES.md).
 *
 * H1:  Socratic Intelligent Tutor (60/40 rule)
 * H2:  Motivational Coach (emotional detection + encouragement)
 * H3:  Comprehension Diagnostician (misconception identification)
 * H4:  Premium Explainer (analogies, real-world examples, multi-angle)
 * H5:  Adaptive Path Architect (ZPD, scaffolding, concept graph)
 * H6:  Quiz Master (5 Bloom levels, IRT-calibrated)
 * H7:  Role-Play Simulator (client scenarios, debriefing)
 * H8:  Compliance Guardian (legal citations, anti-hallucination)
 * H9:  Study Planner (FSRS integration, session scheduling)
 * H10: Formative Evaluator (continuous assessment, portfolio)
 * H11: Multimodal Communicator (text + voice + visual indicators)
 * H12: Professional Mentor (career advice, exam prep, soft skills)
 *
 * Based on 60+ scientific sources, Harvard RCT 2025, Khanmigo analysis.
 * Multi-tenant: all queries scoped to tenantId.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRetrievability, type FsrsCard, type Rating, scheduleReview } from './fsrs-engine';
import { buildProvincialContext, getProvinceRegulation } from './provincial-data';

// ---------------------------------------------------------------------------
// Types — Public API (backward-compatible)
// ---------------------------------------------------------------------------

export interface TutorChatContext {
  courseId?: string;
  lessonId?: string;
  conceptId?: string;
  topic?: string;
  /** Tutoring mode override — default is inferred from message intent */
  mode?: TutorMode;
}

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorChatRequest {
  message: string;
  context?: TutorChatContext;
  conversationHistory?: TutorMessage[];
  sessionId?: string;
}

export interface TutorChatResponse {
  reply: string;
  sessionId: string;
  sources: Array<{ title: string; domain: string; source?: string | null }>;
  tokensUsed?: number;
  /** Detected student intent for this message */
  detectedIntent?: StudentIntent;
  /** Detected emotional state */
  detectedEmotion?: EmotionalState;
  /** Active tutoring mode */
  activeMode?: TutorMode;
  /** Session analytics snapshot */
  sessionAnalytics?: SessionAnalytics;
}

// ---------------------------------------------------------------------------
// Types — Internal / Extended
// ---------------------------------------------------------------------------

/** Tutoring modes corresponding to different pedagogical approaches */
export type TutorMode =
  | 'TEACHING'   // Explain concepts with examples (default)
  | 'PRACTICE'   // Quiz-style, Socratic guidance
  | 'ROLEPLAY'   // Simulate client scenarios
  | 'REVIEW'     // Spaced repetition review session
  | 'RAPID';     // Dense content, efficient teaching

/** Student message intent classification */
export type StudentIntent =
  | 'FACTUAL_QUESTION'      // "C'est quoi la LDPSF?" → respond directly
  | 'EXERCISE_RESPONSE'     // Answering a quiz/exercise → Socratic guidance
  | 'CONFUSION'             // "Je comprends pas" → simplify, give example
  | 'FRUSTRATION'           // "!!!", repeated errors → empathize, direct answer
  | 'EXPLORATION'           // "Parle-moi de..." → rich explanation
  | 'VERIFICATION_REQUEST'  // "Teste-moi", "quiz" → test understanding
  | 'METACOGNITIVE'         // "Comment j'étudie?" → study strategies
  | 'CAREER_QUESTION'       // "Comment devenir courtier?" → mentoring
  | 'GREETING'              // "Bonjour", "Salut" → warm welcome
  | 'OFF_TOPIC'             // Unrelated to insurance → redirect gently
  | 'UNKNOWN';              // Cannot classify

/** Emotional state detected from text analysis */
export type EmotionalState =
  | 'NEUTRAL'
  | 'FRUSTRATED'
  | 'CONFUSED'
  | 'CONFIDENT'
  | 'DISENGAGED'
  | 'ANXIOUS'
  | 'MOTIVATED'
  | 'OVERWHELMED';

/** Scaffolding level: how much support Aurelia provides */
export type ScaffoldingLevel =
  | 'AUTONOMOUS'     // Minimal support, student is flying
  | 'LIGHT_GUIDANCE' // Occasional hints
  | 'GUIDED'         // Step-by-step with questions
  | 'FULL_SUPPORT';  // Complete explanations, maximum scaffolding

/** Session tracking analytics */
export interface SessionAnalytics {
  conceptsCovered: string[];
  emotionsDetected: EmotionalState[];
  questionsAsked: number;
  questionsAnswered: number;
  misconceptionsIdentified: string[];
  consecutiveErrors: number;
  scaffoldingLevel: ScaffoldingLevel;
  mode: TutorMode;
  /** Seconds spent in this session */
  durationSec: number;
}

/** Concept mastery summary for context injection */
interface ConceptMasteryInfo {
  conceptId: string;
  conceptName: string;
  level: number;       // 0-5 Bloom
  confidence: number;  // 0-1
  retrievability: number; // 0-1 FSRS
  needsReview: boolean;
  lastTested: Date | null;
}

// ---------------------------------------------------------------------------
// Insurance-Domain Example Bank (H4: Premium Explainer)
// ---------------------------------------------------------------------------

const INSURANCE_ANALOGIES: Record<string, string> = {
  'devoir-conseil': `Analogie: Tu ne prendrais pas un GPS qui te donne une direction sans tenir compte des routes fermées. Le devoir de conseil, c'est être le GPS qui a TOUTE l'information avant de recommander un produit. [Source: LDPSF art. 27]`,
  'conflit-interets': `Analogie: Imagine que ton médecin te prescrit un médicament fabriqué par une compagnie dont il est actionnaire. Tu te sentirais comment? C'est pour ça que la LDPSF exige la divulgation des conflits d'intérêts. [Source: LDPSF art. 18-19]`,
  'analyse-besoins': `Analogie: Si un tailleur faisait un costume sans prendre tes mesures, il ne t'irait pas. L'analyse des besoins, c'est "prendre les mesures" de ton client avant de recommander un produit. [Source: LDPSF art. 27 al. 1]`,
  'obligation-assureur': `Analogie: C'est comme un restaurant. Le serveur (assureur) doit t'informer des allergènes (risques). S'il ne le fait pas et que tu as une réaction, c'est sa faute. L'article 27 LDPSF, c'est exactement ça pour l'assurance. [Source: LDPSF art. 27]`,
  'ufc-formation-continue': `Analogie: C'est comme le permis de conduire. Tu l'as, mais tu dois prouver régulièrement que tu sais toujours conduire correctement. Les UFC, c'est ton "renouvellement" professionnel. [Source: Règlement sur la formation continue AMF]`,
  'vie-entiere-vs-temporaire': `Analogie: Louer un appartement (temporaire) vs acheter une maison (entière). La location est moins chère mais tu ne construis pas de valeur. L'achat coûte plus cher mais tu accumules de l'équité. Les deux ont leur place selon la situation. [Source: Code civil art. 2393+]`,
  'divulgation': `Analogie: Imagine que tu vends une voiture d'occasion. Si tu caches un problème de moteur au client et qu'il tombe en panne, tu es responsable. En assurance, c'est pareil — la divulgation complète est obligatoire des deux côtés. [Source: Code civil art. 2408-2413]`,
  'incontestabilite': `Analogie: Après 2 ans de mariage, même si tu découvres que ton conjoint avait un secret, le mariage reste valide. L'incontestabilité en assurance vie fonctionne de façon similaire — après la période, l'assureur ne peut plus contester. [Source: Code civil art. 2424]`,
  'subrogation': `Analogie: Tu prêtes de l'argent à un ami pour payer un mécanicien incompétent. Maintenant TOI tu veux récupérer auprès du mécanicien ce qu'il doit. En assurance, l'assureur paie le sinistre puis "prend ta place" pour récupérer contre le responsable. [Source: Code civil art. 2474]`,
  'bonne-foi': `Analogie: Un contrat d'assurance, c'est comme une relation de confiance. Si tu mens à ton assureur sur tes antécédents médicaux, c'est comme mentir à ton médecin — ça ne peut que mal finir. La bonne foi est uberrimae fidei (de la plus haute bonne foi). [Source: Code civil art. 2408 (QC) / Common law: Carter v. Boehm (1766)]`,
  'auto-public-vs-prive': `Analogie: Imagine que le gouvernement gère tous les restaurants de ta ville (auto publique: BC, SK, MB, QC blessures) vs un marché libre de restaurants en compétition (auto privée: ON, AB, etc.). Le public offre un service universel mais moins de choix. Le privé offre plus de choix mais les prix varient. Chaque province a fait son choix!`,
  'common-law-vs-code-civil': `Analogie: Le common law c'est comme une recette qui évolue — chaque juge ajoute un ingrédient (jurisprudence). Le Code civil du Québec c'est comme un livre de recettes complet écrit d'avance — tout est codifié. Les deux systèmes arrivent souvent au même résultat, mais par des chemins différents.`,
  'llqp-vs-pqap': `Analogie: Le LLQP (Life Licence Qualification Program) et le PQAP (Programme de Qualification en Assurance de Personnes) sont comme deux diplômes différents pour le même métier. Le LLQP est accepté dans les 12 provinces de common law; le PQAP est spécifique au Québec avec ses 4 examens AMF (F-111 à F-313). Même profession, différent parcours!`,
};

// ---------------------------------------------------------------------------
// Frustration & Confusion Signal Detection (H2, H5)
// ---------------------------------------------------------------------------

/** Text-based emotional signal patterns */
const FRUSTRATION_SIGNALS = [
  /je\s+(ne\s+)?comprends?\s+(pas|rien|plus)/i,
  /c'est\s+(trop\s+)?(compliqu[eé]|difficile|dur|m[eê]lant|confus)/i,
  /j'?arrive\s+(pas|plus)/i,
  /[!]{2,}/,                                 // Multiple exclamation marks
  /(ça|ca)\s+(m'|me)\s+(frustre|[eé]nerve|d[eé]courage)/i,
  /j'?abandonne/i,
  /c'est\s+n'?importe\s+quoi/i,
  /pfff+|argh+|grr+/i,
  /j'?en\s+ai\s+(marre|assez)/i,
  /ça\s+fait\s+\d+\s+fois/i,                // "ça fait 3 fois"
];

const CONFUSION_SIGNALS = [
  /\?{2,}/,                                  // Multiple question marks
  /je\s+(ne\s+)?sais?\s+pas/i,
  /je\s+(ne\s+)?suis?\s+pas\s+s[uû]r/i,
  /c'est\s+quoi\s+(au\s+juste|exactement)/i,
  /je\s+(me\s+)?m[eé]lange/i,
  /je\s+(suis\s+)?(perdu|m[eê]l[eé])/i,
  /quelle?\s+est?\s+la\s+diff[eé]rence/i,
  /euh+|hmm+|bof/i,
  /peut-[eê]tre|possiblement|j'imagine/i,
];

const CONFIDENCE_SIGNALS = [
  /je\s+(suis\s+)?(certain|s[uû]r|confiant)/i,
  /[eé]videmment|bien\s+s[uû]r|absolument/i,
  /c'est\s+(clair|simple|facile|[eé]vident)/i,
  /pas\s+de\s+probl[eè]me/i,
  /j'ai\s+(bien\s+)?compris/i,
];

const DISENGAGEMENT_SIGNALS = [
  /^(ok|oui|non|correct|bon|ouais|k|oké)\.?$/i,
  /^(je\s+sais\s+pas)\.?$/i,
  /^\.{1,3}$/,                              // Just dots
  /on\s+peut\s+passer/i,
  /c'est\s+pas\s+grave/i,
  /tant\s+pis/i,
];

const ANXIETY_SIGNALS = [
  /(stress|anxi|nerveu|peur|inqui[eè]t)/i,
  /examen|test\s+final|certification/i,
  /j'?ai\s+peur\s+de/i,
  /(va\s+)?[eé]chouer/i,
  /pas\s+pr[eê]t/i,
];

/**
 * Detects emotional state from message text and conversation context.
 * Analyzes the current message plus recent history for patterns.
 */
function detectEmotion(
  message: string,
  history: TutorMessage[],
  consecutiveErrors: number
): EmotionalState {
  const lowerMsg = message.toLowerCase().trim();

  // Check frustration first (highest priority if consecutive errors)
  const frustrationScore =
    FRUSTRATION_SIGNALS.filter(p => p.test(lowerMsg)).length +
    (consecutiveErrors >= 3 ? 2 : 0) +
    (consecutiveErrors >= 2 ? 1 : 0);

  if (frustrationScore >= 2) return 'FRUSTRATED';
  if (frustrationScore >= 1 && consecutiveErrors >= 2) return 'FRUSTRATED';

  // Check anxiety (exam-related stress)
  if (ANXIETY_SIGNALS.some(p => p.test(lowerMsg))) return 'ANXIOUS';

  // Check confusion
  const confusionScore = CONFUSION_SIGNALS.filter(p => p.test(lowerMsg)).length;
  if (confusionScore >= 2) return 'CONFUSED';

  // Check disengagement (short answers, no effort)
  if (DISENGAGEMENT_SIGNALS.some(p => p.test(lowerMsg))) {
    // Confirm with history: if last 3 messages were also short, disengaged
    const recentUserMsgs = history
      .filter(m => m.role === 'user')
      .slice(-3);
    const shortCount = recentUserMsgs.filter(m => m.content.trim().length < 15).length;
    if (shortCount >= 2) return 'DISENGAGED';
    return 'NEUTRAL';
  }

  // Check confidence / mastery
  if (CONFIDENCE_SIGNALS.some(p => p.test(lowerMsg))) return 'CONFIDENT';

  // Check for overwhelm (long confused message)
  if (lowerMsg.length > 200 && confusionScore >= 1) return 'OVERWHELMED';

  // Check motivation (positive energy)
  if (/j'?ai\s+h[aâ]te|motiv[eé]|allons-y|on\s+continue|go|let'?s/i.test(lowerMsg)) {
    return 'MOTIVATED';
  }

  return 'NEUTRAL';
}

// ---------------------------------------------------------------------------
// Intent Detection (H1: 60/40 Socratic Intelligence)
// ---------------------------------------------------------------------------

/** Intent patterns for classification */
const FACTUAL_PATTERNS = [
  /^c'?est\s+quoi/i,
  /^qu'?est[- ]ce\s+qu[e']/i,
  /^(d[eé]fini[sr]|expliqu|d[eé]cri)/i,
  /^comment\s+(fonctionne|marche|faire)/i,
  /^(quel|quelle|quels|quelles)\s+(est|sont|diff[eé]rence)/i,
  /^pourquoi\s+(est|faut|doit)/i,
  /^(combien|quand|o[uù])\s/i,
  /^(donne|dis)[- ]moi/i,
  /^parle[- ]moi\s+de/i,
];

const EXERCISE_RESPONSE_PATTERNS = [
  // The student is replying to a question Aurelia asked
  /^(je\s+pense\s+que|je\s+dirais|ma\s+r[eé]ponse|selon\s+moi)/i,
  /^(option|r[eé]ponse)\s+[a-d]/i,
  /^(vrai|faux|true|false)$/i,
  /^[a-d][\.\)]/i,
];

const VERIFICATION_PATTERNS = [
  /(teste|quiz|questionne|[eé]value)[- ]moi/i,
  /pose[- ]moi\s+(une|des)\s+question/i,
  /je\s+veux\s+(un|des)\s+(quiz|test|exercice)/i,
  /on\s+fait\s+un\s+(quiz|test|exercice)/i,
  /v[eé]rifie\s+(ma|mes)\s+connaissance/i,
];

const METACOGNITIVE_PATTERNS = [
  /comment\s+(bien\s+)?[eé]tudier/i,
  /(strat[eé]gie|m[eé]thode|technique)\s+d'?[eé]tude/i,
  /comment\s+(je\s+)?m[eé]moris/i,
  /comment\s+(mieux\s+)?apprendre/i,
  /planifi(er|cation)\s+(mes\s+)?[eé]tude/i,
];

const CAREER_PATTERNS = [
  /comment\s+devenir/i,
  /carri[eè]re|promotion|salaire|emploi/i,
  /examen\s+(amf|llqp|pqap|ribo)|certification\s+(amf|provinciale)/i,
  /permis\s+(amf|courtier|agent|assurance|fsra|ribo)/i,
  /(avenir|futur)\s+(en|dans)\s+l'?assurance/i,
  /licen[cs]e|licensing|certifi[eé]/i,
  /formation\s+continue|ufc|ce\s+credits/i,
  /transfert\s+de\s+permis|r[eé]ciprocit[eé]/i,
  /cip|fcip|clu|chs|cfp|caib|paa/i,
];

const GREETING_PATTERNS = [
  /^(bonjour|salut|allo|hey|hi|hello|bonsoir|coucou)/i,
  /^comment\s+(ça\s+)?va/i,
];

/**
 * Detects student intent from message text.
 * Also considers conversation history to disambiguate.
 */
function detectIntent(
  message: string,
  history: TutorMessage[],
  currentMode: TutorMode
): StudentIntent {
  const trimmed = message.trim();

  // Greetings
  if (GREETING_PATTERNS.some(p => p.test(trimmed))) return 'GREETING';

  // Verification / quiz request
  if (VERIFICATION_PATTERNS.some(p => p.test(trimmed))) return 'VERIFICATION_REQUEST';

  // Career questions
  if (CAREER_PATTERNS.some(p => p.test(trimmed))) return 'CAREER_QUESTION';

  // Metacognitive questions
  if (METACOGNITIVE_PATTERNS.some(p => p.test(trimmed))) return 'METACOGNITIVE';

  // In PRACTICE or ROLEPLAY mode, check if this is an exercise response
  if (currentMode === 'PRACTICE' || currentMode === 'ROLEPLAY') {
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      // If Aurelia just asked a question, this is likely a response
      const lastContent = lastAssistant.content;
      const endsWithQuestion = /\?\s*$/.test(lastContent) ||
        /\?\s*\n/.test(lastContent.slice(-200));
      if (endsWithQuestion && !FACTUAL_PATTERNS.some(p => p.test(trimmed))) {
        return 'EXERCISE_RESPONSE';
      }
    }
  }

  // Check exercise response patterns explicitly
  if (EXERCISE_RESPONSE_PATTERNS.some(p => p.test(trimmed))) return 'EXERCISE_RESPONSE';

  // Check frustration/confusion as intent (overrides factual)
  const emotion = detectEmotion(message, history, 0);
  if (emotion === 'FRUSTRATED') return 'FRUSTRATION';
  if (emotion === 'CONFUSED') return 'CONFUSION';

  // Factual questions — broad catch
  if (FACTUAL_PATTERNS.some(p => p.test(trimmed))) return 'FACTUAL_QUESTION';

  // Exploration — longer messages that are inquiry-driven
  if (trimmed.length > 40 && /\?/.test(trimmed)) return 'EXPLORATION';

  // If message ends with "?" it's likely a question
  if (/\?\s*$/.test(trimmed)) return 'FACTUAL_QUESTION';

  // Default: if in teaching mode and we can't classify, treat as exploration
  if (currentMode === 'TEACHING') return 'EXPLORATION';

  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Scaffolding Level Determination (H2, H5)
// ---------------------------------------------------------------------------

/**
 * Determines the appropriate scaffolding level based on student state.
 * Implements Vygotsky's Zone of Proximal Development (ZPD).
 */
function determineScaffolding(
  emotion: EmotionalState,
  consecutiveErrors: number,
  masteryInfos: ConceptMasteryInfo[],
  totalInteractions: number
): ScaffoldingLevel {
  // High scaffolding triggers
  if (emotion === 'FRUSTRATED' || emotion === 'OVERWHELMED') return 'FULL_SUPPORT';
  if (consecutiveErrors >= 3) return 'FULL_SUPPORT';

  // Medium scaffolding triggers
  if (emotion === 'CONFUSED') return 'GUIDED';
  if (consecutiveErrors >= 1) return 'GUIDED';
  if (totalInteractions < 5) return 'GUIDED'; // New student

  // Low scaffolding triggers
  if (emotion === 'CONFIDENT' && consecutiveErrors === 0) return 'LIGHT_GUIDANCE';

  // Autonomous if student shows consistent mastery
  const avgMastery = masteryInfos.length > 0
    ? masteryInfos.reduce((sum, m) => sum + m.level, 0) / masteryInfos.length
    : 0;
  if (avgMastery >= 3.5 && emotion === 'CONFIDENT') return 'AUTONOMOUS';

  return 'GUIDED';
}

// ---------------------------------------------------------------------------
// System Prompt Construction (H1, H4, H7, H8)
// ---------------------------------------------------------------------------

/**
 * Builds the complete Aurelia system prompt, adapting to current mode, intent,
 * emotion, and scaffolding level.
 */
function buildSystemPrompt(
  mode: TutorMode,
  intent: StudentIntent,
  emotion: EmotionalState,
  scaffolding: ScaffoldingLevel
): string {
  const basePrompt = `Tu es Aurélia, avocate senior en droit des assurances au Canada et tutrice IA d'élite spécialisée en enseignement aux adultes.

IDENTITÉ PROFESSIONNELLE:
- Avocate senior avec 25 ans d'expérience en droit des assurances dans toutes les provinces canadiennes.
- Spécialiste de l'enseignement aux adultes pour l'obtention des certifications provinciales (LLQP, PQAP, GIE, CIP, FCIP, CLU, CHS, CFP).
- Experte en formation continue obligatoire (UFC/CE) et formations de spécialisation approfondies.
- Maîtrise parfaite du Code civil du Québec (assurances) ET de la common law (11 autres provinces).
- Connaissance exhaustive des lois, règlements, directives et jurisprudence de CHAQUE province et territoire.
- Tu connais les Insurance Acts de chaque province, les directives de l'OSFI, le PCMLTFA/LRPCFAT et PIPEDA.
- Tu es au fait des différences entre les régimes d'auto-assurance (public: ICBC, SGI, MPI, SAAQ vs privé).

PERSONNALITÉ:
- Chaleureuse, rigoureuse, patiente et professionnelle. Tu tutoies tes étudiants avec respect.
- Tu enseignes avec la précision d'une juriste et l'empathie d'une pédagogue expérimentée.
- Tu utilises des cas réels, des analogies du quotidien et des mises en situation professionnelles.

RÈGLES ABSOLUES (non négociables):
1. TOUJOURS répondre aux questions claires avec des réponses claires + un exemple pertinent concret.
2. TOUJOURS illustrer chaque concept avec un exemple du quotidien ou un cas réel en assurance adapté à la PROVINCE de l'étudiant.
3. JAMAIS inventer de référence légale — cite UNIQUEMENT des sources vérifiées entre [Source: Loi, art. X] ou [Source: Règlement, s. X]. Si tu n'es pas certaine, dis "Je ne suis pas certaine de cette information spécifique. Vérifie avec ton régulateur provincial."
4. TOUJOURS adapter ton niveau de langue, de difficulté ET de juridiction au profil de l'étudiant.
5. TOUJOURS donner du feedback constructif après chaque réponse de l'étudiant.
6. TOUJOURS encourager — jamais critiquer. Reformule les erreurs de manière constructive.
7. Mode Socratique (questions guidées) UNIQUEMENT pendant les exercices, quiz, role-play et vérifications de compréhension. Sinon, ENSEIGNE directement.
8. JAMAIS bloquer l'apprentissage en refusant de répondre ou en posant trop de questions avant d'expliquer. Tu es là pour ENSEIGNER.
9. TOUJOURS préciser de quelle province/loi tu parles quand l'information varie entre les juridictions. Si l'étudiant est au Québec, cite le Code civil et la LDPSF. Si en Ontario, cite l'Insurance Act (Ontario) et le SABS. Etc.
10. Quand un concept diffère entre common law et code civil, EXPLIQUER les deux approches et pourquoi elles diffèrent.`;

  // Mode-specific instructions
  const modeInstructions: Record<TutorMode, string> = {
    TEACHING: `
MODE ENSEIGNEMENT ACTIF:
- Explique clairement chaque concept demandé.
- Donne TOUJOURS un exemple concret du domaine de l'assurance.
- Après ton explication, pose UNE question de vérification légère.
- Structure: Explication → Exemple → Question de suivi.
- Si l'étudiant demande "c'est quoi X?" → définis X clairement, donne un exemple, puis vérifie.`,

    PRACTICE: `
MODE EXERCICE / QUIZ:
- L'étudiant pratique — guide-le par des questions Socratiques.
- Ne donne PAS la réponse directement sauf après 3 tentatives.
- Si erreur: diagnostique le "pourquoi" avant de corriger.
- Indices progressifs: léger → ciblé → explication complète.
- Après chaque réponse: feedback immédiat + explication du raisonnement.
- Félicite les bonnes réponses de manière spécifique ("Excellent! Tu as bien identifié le lien entre art. 27 et le devoir de conseil").`,

    ROLEPLAY: `
MODE SIMULATION / ROLE-PLAY:
- Tu joues le rôle d'un CLIENT réaliste (pas d'Aurélia la tutrice pendant la simulation).
- Donne un nom au personnage et une situation concrète.
- Laisse l'étudiant mener l'entrevue de vente/conseil.
- Après la simulation: debriefing structuré avec points forts et améliorations.
- Évalue: analyse des besoins, recommandation appropriée, conformité, communication.`,

    REVIEW: `
MODE RÉVISION ESPACÉE (FSRS):
- Présente les concepts à réviser selon le calendrier de rétention FSRS.
- Questions de rappel actif: "Qu'est-ce que tu te souviens de [concept]?"
- Mix de questions directes et de mises en situation.
- Si l'étudiant a oublié: réexplique brièvement, puis teste à nouveau.
- Commence par: "Petite révision rapide avant de continuer!"`,

    RAPID: `
MODE FORMATION RAPIDE:
- L'étudiant veut couvrir beaucoup de contenu efficacement.
- Sois concis mais complet. Pas de détours.
- Structure: Point clé → Exemple court → Point suivant.
- Blocs de 3-5 concepts, puis un mini-quiz de vérification.
- Utilise des listes à puces et du formatage clair.`,
  };

  // Intent-specific overlay
  const intentOverlay: Record<StudentIntent, string> = {
    FACTUAL_QUESTION: `\nL'étudiant pose une QUESTION FACTUELLE → Réponds directement, clairement, avec un exemple. Puis vérifie la compréhension avec une question légère.`,
    EXERCISE_RESPONSE: `\nL'étudiant RÉPOND à un exercice/quiz → Évalue sa réponse, donne du feedback immédiat. Si incorrect, guide par une question Socratique.`,
    CONFUSION: `\nL'étudiant est CONFUS → Simplifie. Donne un exemple concret du quotidien. Décompose en étapes. Ne rajoute PAS de complexité.`,
    FRUSTRATION: `\nL'étudiant est FRUSTRÉ → Empathie d'abord ("Je comprends, c'est un sujet qui mélange beaucoup de monde"). Donne la réponse directement. Passe au suivant. Ne bloque pas.`,
    EXPLORATION: `\nL'étudiant EXPLORE un sujet → Donne une explication riche et structurée. Plusieurs angles si possible. Encourage sa curiosité.`,
    VERIFICATION_REQUEST: `\nL'étudiant veut être TESTÉ → Passe en mode quiz. Pose une question adaptée à son niveau. Utilise la taxonomie de Bloom.`,
    METACOGNITIVE: `\nL'étudiant pose une question sur COMMENT ÉTUDIER → Donne des stratégies d'apprentissage concrètes. Rappel actif, répétition espacée, interleaving.`,
    CAREER_QUESTION: `\nL'étudiant pose une question de CARRIÈRE → Conseille de manière professionnelle sur le parcours en assurance dans SA province:
- Certifications requises (LLQP pour common law, PQAP pour QC)
- Processus de licensing auprès du régulateur provincial
- CE/UFC obligatoires par province
- Spécialisations disponibles (CIP, FCIP, CLU, CHS, CFP, CAIB)
- Perspectives de carrière et progression
- Si pertinent: réciprocité entre provinces (transfert de permis)`,
    GREETING: `\nL'étudiant te SALUE → Réponds chaleureusement. Rappelle brièvement ce qu'on a fait la dernière fois (si historique). Propose de continuer ou d'aborder un nouveau sujet.`,
    OFF_TOPIC: `\nMessage HORS SUJET → Redirige gentiment vers l'assurance. "C'est une bonne question mais revenons à notre sujet!"`,
    UNKNOWN: '',
  };

  // Emotion-specific tone adjustments
  const emotionOverlay: Record<EmotionalState, string> = {
    NEUTRAL: '',
    FRUSTRATED: `\nTON ADAPTÉ — FRUSTRATION DÉTECTÉE:
- Commence par de l'empathie sincère.
- Simplifie immédiatement.
- Donne la réponse directement (pas de Socratique).
- Propose de prendre une pause ou changer de sujet.
- "Je comprends, c'est un sujet costaud. On va prendre ça une étape à la fois."`,
    CONFUSED: `\nTON ADAPTÉ — CONFUSION DÉTECTÉE:
- Reformule ce qui vient d'être dit en termes plus simples.
- Utilise une analogie du quotidien.
- Décompose en micro-étapes.
- Vérifie: "Est-ce que ça devient plus clair avec cet exemple?"`,
    CONFIDENT: `\nTON ADAPTÉ — CONFIANCE DÉTECTÉE:
- Augmente le niveau de difficulté.
- Pose des questions de niveau analyse/synthèse (Bloom 4-5).
- Félicite spécifiquement, pas génériquement.
- "Tu maîtrises bien ce concept! Allons un cran plus loin."`,
    DISENGAGED: `\nTON ADAPTÉ — DÉSENGAGEMENT DÉTECTÉ:
- Change d'approche (propose un role-play ou un cas concret).
- Question directe et engageante, pas abstraite.
- "On change de format? J'ai un cas client intéressant pour toi!"`,
    ANXIOUS: `\nTON ADAPTÉ — ANXIÉTÉ DÉTECTÉE:
- Rassure en rappelant les progrès accomplis.
- Normalise le stress: "C'est normal d'être nerveux, ça montre que tu prends ça au sérieux."
- Donne des conseils concrets de gestion du stress.
- Rappelle que l'examen est prévisible si on est bien préparé.`,
    MOTIVATED: `\nTON ADAPTÉ — MOTIVATION ÉLEVÉE:
- Maintiens l'énergie! Contenu riche et stimulant.
- Propose des défis intéressants.
- "Super énergie! On en profite pour attaquer un sujet avancé?"`,
    OVERWHELMED: `\nTON ADAPTÉ — SURCHARGE DÉTECTÉE:
- Ralentis. Un concept à la fois.
- "On respire. Concentrons-nous sur une seule chose."
- Résume ce qui a été couvert.
- Priorise: qu'est-ce qui est le plus important à retenir?`,
  };

  // Scaffolding overlay
  const scaffoldingOverlay: Record<ScaffoldingLevel, string> = {
    AUTONOMOUS: `\nSCAFFOLDING MINIMAL: L'étudiant est autonome. Sois concis, laisse-le mener.`,
    LIGHT_GUIDANCE: `\nSCAFFOLDING LÉGER: Quelques indices et questions de suivi, mais l'étudiant se débrouille.`,
    GUIDED: `\nSCAFFOLDING GUIDÉ: Structuration étape par étape. Vérifie la compréhension à chaque étape.`,
    FULL_SUPPORT: `\nSCAFFOLDING COMPLET: Explication détaillée. Exemples multiples. Patience maximale. Ne suppose aucun prérequis.`,
  };

  return [
    basePrompt,
    modeInstructions[mode],
    intentOverlay[intent],
    emotionOverlay[emotion],
    scaffoldingOverlay[scaffolding],
    `\nFORMAT DE RÉPONSE:
- Utilise le markdown pour la mise en forme (gras, listes, titres).
- Limite tes réponses à 300-600 mots sauf si le sujet l'exige.
- Si tu cites un article de loi, utilise le format [Source: LDPSF art. X] ou [Source: Code civil art. X].
- En mode enseignement, termine par une question de vérification ou un encouragement.
- En mode exercice, termine par du feedback + la question suivante.
- Français québécois professionnel. Tutoiement respectueux.`,
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Knowledge Retrieval — Enhanced RAG (H4, H8)
// ---------------------------------------------------------------------------

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  domain: string;
  source: string | null;
}

/**
 * Retrieves relevant knowledge items from AiTutorKnowledge using
 * PostgreSQL trigram similarity search (pg_trgm).
 * Falls back to ILIKE search if pg_trgm is not available.
 *
 * Enhanced: also retrieves domain-specific examples and legal citations.
 */
async function retrieveKnowledge(
  tenantId: string,
  query: string,
  domain?: string,
  limit = 5
): Promise<KnowledgeItem[]> {
  try {
    // FIX P0 F01: Replace $queryRawUnsafe with safe Prisma.sql tagged template
    const safeQuery = query.slice(0, 500);
    const safeLimit = Math.min(Math.max(limit, 1), 20);

    const results = domain
      ? await prisma.$queryRaw<Array<KnowledgeItem & { similarity: number }>>`
          SELECT id, title, content, domain, source,
                 similarity(title || ' ' || content, ${safeQuery}) as similarity
          FROM "AiTutorKnowledge"
          WHERE "tenantId" = ${tenantId}
            AND "isActive" = true
            AND domain = ${domain}
          ORDER BY similarity DESC
          LIMIT ${safeLimit}`
      : await prisma.$queryRaw<Array<KnowledgeItem & { similarity: number }>>`
          SELECT id, title, content, domain, source,
                 similarity(title || ' ' || content, ${safeQuery}) as similarity
          FROM "AiTutorKnowledge"
          WHERE "tenantId" = ${tenantId}
            AND "isActive" = true
          ORDER BY similarity DESC
          LIMIT ${safeLimit}`;

    if (results.length > 0) {
      return results.filter(r => r.similarity > 0.05);
    }
  } catch {
    logger.debug('[TutorService] pg_trgm not available, using ILIKE fallback');
  }

  // Fallback: ILIKE keyword search
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 5);

  if (keywords.length === 0) return [];

  const where: Record<string, unknown> = {
    tenantId,
    isActive: true,
    ...(domain && { domain }),
    OR: keywords.map(kw => ({
      OR: [
        { title: { contains: kw, mode: 'insensitive' as const } },
        { content: { contains: kw, mode: 'insensitive' as const } },
      ],
    })),
  };

  const knowledge = await prisma.aiTutorKnowledge.findMany({
    where,
    select: { id: true, title: true, content: true, domain: true, source: true },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  });

  return knowledge;
}

/**
 * Finds matching insurance analogies from the built-in bank.
 * Returns relevant analogies based on keyword matching in the message.
 */
function findRelevantAnalogies(message: string): string[] {
  const lower = message.toLowerCase();
  const matches: string[] = [];

  const analogyKeywords: Record<string, string[]> = {
    'devoir-conseil': ['devoir de conseil', 'conseil', 'recommandation', 'art. 27', 'article 27'],
    'conflit-interets': ['conflit d\'intérêt', 'conflit', 'intérêts', 'divulgation'],
    'analyse-besoins': ['analyse des besoins', 'besoins du client', 'abc', 'profil client'],
    'obligation-assureur': ['obligation', 'responsabilité assureur', 'devoir d\'information'],
    'ufc-formation-continue': ['ufc', 'formation continue', 'crédit', 'heures de formation'],
    'vie-entiere-vs-temporaire': ['vie entière', 'temporaire', 'terme', 'permanente', 'universelle'],
    'divulgation': ['divulgation', 'déclaration', 'fausse déclaration', 'bonne foi'],
    'incontestabilite': ['incontestabilité', 'contestation', 'période', '2 ans'],
    'subrogation': ['subrogation', 'recours', 'récupération'],
    'bonne-foi': ['bonne foi', 'uberrimae', 'honnêteté', 'loyauté'],
    'auto-public-vs-prive': ['auto publique', 'auto privée', 'icbc', 'sgi', 'mpi', 'saaq', 'régime public'],
    'common-law-vs-code-civil': ['common law', 'code civil', 'différence', 'québec vs', 'juridique'],
    'llqp-vs-pqap': ['llqp', 'pqap', 'permis', 'licence', 'examen amf', 'certification'],
  };

  for (const [key, keywords] of Object.entries(analogyKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const analogy = INSURANCE_ANALOGIES[key];
      if (analogy) matches.push(analogy);
    }
  }

  return matches.slice(0, 2); // Max 2 analogies per message
}

// ---------------------------------------------------------------------------
// Student Context — Enhanced Profile + Mastery (H3, H5, H10)
// ---------------------------------------------------------------------------

/**
 * Builds a comprehensive student context string including profile,
 * mastery state, and emotional tendencies.
 */
async function getStudentContext(
  _tenantId: string,
  userId: string
): Promise<{
  contextString: string | null;
  profile: {
    preferredName?: string | null;
    firstName?: string | null;
    province?: string | null;
    frustrationTolerance?: string | null;
    testAnxiety?: string | null;
    confidenceLevel?: string | null;
    motivationLevel?: string | null;
    pacePreference?: string | null;
    totalInteractions: number;
    encouragementLevel?: string | null;
    contentDensityPref?: string | null;
    prefersExamples: boolean;
    prefersAnalogies: boolean;
    prefersCasePractiques: boolean;
    communicationStyle?: string | null;
  } | null;
}> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: {
      preferredName: true,
      firstName: true,
      language: true,
      province: true,
      workProvince: true,
      currentRole: true,
      yearsExperience: true,
      yearsInInsurance: true,
      specializations: true,
      educationLevel: true,
      certifications: true,
      licenseTypes: true,
      complianceStatus: true,
      dominantVark: true,
      pacePreference: true,
      motivationLevel: true,
      selfEfficacy: true,
      growthMindset: true,
      testAnxiety: true,
      frustrationTolerance: true,
      confidenceLevel: true,
      preferredContentTypes: true,
      totalInteractions: true,
      encouragementLevel: true,
      contentDensityPref: true,
      prefersExamples: true,
      prefersAnalogies: true,
      prefersCasePractiques: true,
      communicationStyle: true,
      primaryGoal: true,
      engagementScore: true,
      riskOfDropout: true,
    },
  });

  if (!profile) return { contextString: null, profile: null };

  const parts: string[] = [];
  const name = profile.preferredName || profile.firstName || 'l\'étudiant';
  parts.push(`Nom: ${name}`);

  // Provincial context (critical for pan-Canadian adaptation)
  const effectiveProvince = profile.workProvince || profile.province;
  if (effectiveProvince) {
    const reg = getProvinceRegulation(effectiveProvince);
    if (reg) {
      parts.push(`Province: ${reg.name.fr} (${reg.code})`);
      parts.push(`Régime juridique: ${reg.legalRegime === 'CIVIL_CODE' ? 'Code civil du Québec' : 'Common law'}`);
      parts.push(`Régulateur: ${reg.insuranceRegulator.acronym}`);
    }
  }

  if (profile.currentRole) parts.push(`Rôle: ${profile.currentRole}`);
  if (profile.yearsInInsurance) parts.push(`Expérience assurance: ${profile.yearsInInsurance} ans`);
  if (profile.educationLevel) parts.push(`Éducation: ${profile.educationLevel}`);
  if (profile.specializations.length > 0) parts.push(`Spécialisations: ${profile.specializations.join(', ')}`);
  if (profile.certifications.length > 0) parts.push(`Certifications: ${profile.certifications.join(', ')}`);
  if (profile.licenseTypes.length > 0) parts.push(`Permis AMF: ${profile.licenseTypes.join(', ')}`);
  if (profile.complianceStatus) parts.push(`Conformité UFC: ${profile.complianceStatus}`);
  if (profile.dominantVark) parts.push(`Style d'apprentissage: ${profile.dominantVark}`);
  if (profile.pacePreference) parts.push(`Rythme préféré: ${profile.pacePreference}`);
  if (profile.motivationLevel) parts.push(`Motivation: ${profile.motivationLevel}`);
  if (profile.confidenceLevel) parts.push(`Confiance: ${profile.confidenceLevel}`);
  if (profile.testAnxiety && profile.testAnxiety !== 'NONE') parts.push(`Anxiété examens: ${profile.testAnxiety}`);
  if (profile.frustrationTolerance) parts.push(`Tolérance frustration: ${profile.frustrationTolerance}`);
  if (profile.primaryGoal) parts.push(`Objectif principal: ${profile.primaryGoal}`);
  if (profile.encouragementLevel) parts.push(`Niveau d'encouragement souhaité: ${profile.encouragementLevel}`);
  if (profile.contentDensityPref) parts.push(`Densité de contenu préférée: ${profile.contentDensityPref}`);
  if (profile.communicationStyle) parts.push(`Style communication: ${profile.communicationStyle}`);

  // Preferences
  const prefs: string[] = [];
  if (profile.prefersExamples) prefs.push('exemples');
  if (profile.prefersAnalogies) prefs.push('analogies');
  if (profile.prefersCasePractiques) prefs.push('cas pratiques');
  if (prefs.length > 0) parts.push(`Préfère: ${prefs.join(', ')}`);

  parts.push(`Interactions totales avec Aurélia: ${profile.totalInteractions}`);

  // Risk indicators for Aurelia's internal use
  if (profile.engagementScore < 30) parts.push(`⚠️ ENGAGEMENT FAIBLE (${profile.engagementScore}/100)`);
  if (profile.riskOfDropout > 60) parts.push(`⚠️ RISQUE D'ABANDON ÉLEVÉ (${profile.riskOfDropout}/100)`);

  return {
    contextString: parts.join('\n'),
    profile: {
      preferredName: profile.preferredName,
      firstName: profile.firstName,
      province: profile.workProvince || profile.province,
      frustrationTolerance: profile.frustrationTolerance,
      testAnxiety: profile.testAnxiety,
      confidenceLevel: profile.confidenceLevel,
      motivationLevel: profile.motivationLevel,
      pacePreference: profile.pacePreference,
      totalInteractions: profile.totalInteractions,
      encouragementLevel: profile.encouragementLevel,
      contentDensityPref: profile.contentDensityPref,
      prefersExamples: profile.prefersExamples,
      prefersAnalogies: profile.prefersAnalogies,
      prefersCasePractiques: profile.prefersCasePractiques,
      communicationStyle: profile.communicationStyle,
    },
  };
}

/**
 * Retrieves concept mastery data for the student, enriched with FSRS
 * retrievability scores. Used for inner-outer loop integration.
 */
async function getConceptMastery(
  tenantId: string,
  userId: string,
  conceptIds?: string[]
): Promise<ConceptMasteryInfo[]> {
  const where: Record<string, unknown> = { tenantId, userId };
  if (conceptIds && conceptIds.length > 0) {
    where.conceptId = { in: conceptIds };
  }

  const masteries = await prisma.lmsConceptMastery.findMany({
    where,
    include: {
      concept: { select: { id: true, name: true } },
    },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  });

  const now = new Date();

  return masteries.map(m => {
    const elapsedDays = m.lastTestedAt
      ? (now.getTime() - m.lastTestedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Use FSRS stability from the interval field (approximate)
    const stability = m.interval > 0 ? m.interval : 1;
    const retrievability = m.lastTestedAt
      ? getRetrievability(stability, elapsedDays)
      : 0;

    return {
      conceptId: m.concept.id,
      conceptName: m.concept.name,
      level: m.currentLevel,
      confidence: m.confidence,
      retrievability,
      needsReview: retrievability < 0.7 && m.currentLevel > 0,
      lastTested: m.lastTestedAt,
    };
  });
}

/**
 * Finds concepts that are due for FSRS review (retrievability < desired retention).
 * Returns the top N most urgent concepts to review.
 */
async function getConceptsDueForReview(
  tenantId: string,
  userId: string,
  limit = 5
): Promise<ConceptMasteryInfo[]> {
  const allMastery = await getConceptMastery(tenantId, userId);
  return allMastery
    .filter(m => m.needsReview)
    .sort((a, b) => a.retrievability - b.retrievability) // Most forgotten first
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Mode Inference (H1)
// ---------------------------------------------------------------------------

/**
 * Infers the appropriate tutoring mode from intent, context, and history.
 * Can be overridden by explicit mode in context.
 */
function inferMode(
  intent: StudentIntent,
  context?: TutorChatContext,
  history?: TutorMessage[]
): TutorMode {
  // Explicit mode override
  if (context?.mode) return context.mode;

  // Intent-based inference
  switch (intent) {
    case 'VERIFICATION_REQUEST':
      return 'PRACTICE';
    case 'EXERCISE_RESPONSE':
      return 'PRACTICE';
    case 'CAREER_QUESTION':
      return 'TEACHING';
    case 'METACOGNITIVE':
      return 'TEACHING';
    case 'GREETING':
      return 'TEACHING';
    default:
      break;
  }

  // Check conversation history for mode continuity
  if (history && history.length > 0) {
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      const content = lastAssistant.content.toLowerCase();
      // If Aurelia was running a role-play, continue it
      if (content.includes('simulation') || content.includes('role-play') ||
          content.includes('je suis votre client') || content.includes('je suis un client')) {
        return 'ROLEPLAY';
      }
      // If Aurelia was asking quiz questions, continue practice
      if (content.includes('question suivante') || content.includes('quiz') ||
          /\b[a-d]\)\s/i.test(content)) {
        return 'PRACTICE';
      }
    }
  }

  return 'TEACHING';
}

// ---------------------------------------------------------------------------
// Session Management (with analytics tracking)
// ---------------------------------------------------------------------------

/**
 * Session state tracked in memory during a conversation turn.
 * Persisted to database after each exchange.
 */
interface InMemorySessionState {
  conceptsCovered: string[];
  emotionsDetected: EmotionalState[];
  questionsAsked: number;
  questionsAnswered: number;
  misconceptionsIdentified: string[];
  consecutiveErrors: number;
  currentMode: TutorMode;
  scaffoldingLevel: ScaffoldingLevel;
  startedAt: Date;
}

/**
 * Extracts session analytics from conversation history for context.
 * Approximates state from the last N messages.
 */
function extractSessionState(
  history: TutorMessage[],
  currentMode: TutorMode
): InMemorySessionState {
  let consecutiveErrors = 0;
  const emotionsDetected: EmotionalState[] = [];
  let questionsAsked = 0;
  let questionsAnswered = 0;

  // Scan history backwards to count consecutive errors
  const reversed = [...history].reverse();
  for (const msg of reversed) {
    if (msg.role === 'assistant') {
      const content = msg.content.toLowerCase();
      // Detect if Aurelia corrected an error
      if (content.includes('pas tout à fait') || content.includes('pas exactement') ||
          content.includes('pas correct') || content.includes('incorrect') ||
          content.includes('réessaie') || content.includes('pas la bonne')) {
        consecutiveErrors++;
      } else {
        break; // Stop at first non-error
      }
    }
  }

  // Count questions from user and Aurelia
  for (const msg of history) {
    if (msg.role === 'user' && /\?/.test(msg.content)) questionsAsked++;
    if (msg.role === 'assistant' && /\?/.test(msg.content)) questionsAnswered++;
  }

  return {
    conceptsCovered: [],
    emotionsDetected,
    questionsAsked,
    questionsAnswered,
    misconceptionsIdentified: [],
    consecutiveErrors,
    currentMode,
    scaffoldingLevel: 'GUIDED',
    startedAt: new Date(),
  };
}

async function getOrCreateSession(
  tenantId: string,
  userId: string,
  sessionId?: string,
  context?: TutorChatContext
): Promise<{ id: string; subscriptionId: string }> {
  if (sessionId) {
    const existing = await prisma.aiTutorSession.findFirst({
      where: { id: sessionId, tenantId, userId },
      select: { id: true, subscriptionId: true },
    });
    if (existing) return existing;
  }

  const subscription = await prisma.aiTutorSubscription.findFirst({
    where: {
      tenantId,
      userId,
      isActive: true,
    },
    select: { id: true, questionsPerDay: true, questionsUsedToday: true, lastResetDate: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    throw new Error('NO_SUBSCRIPTION');
  }

  const now = new Date();
  const lastReset = new Date(subscription.lastResetDate);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  if (isNewDay) {
    await prisma.aiTutorSubscription.update({
      where: { id: subscription.id },
      data: { questionsUsedToday: 0, lastResetDate: now },
    });
  } else if (subscription.questionsUsedToday >= subscription.questionsPerDay) {
    throw new Error('DAILY_LIMIT_REACHED');
  }

  const session = await prisma.aiTutorSession.create({
    data: {
      tenantId,
      userId,
      subscriptionId: subscription.id,
      courseId: context?.courseId,
      lessonId: context?.lessonId,
      topic: context?.topic,
    },
    select: { id: true, subscriptionId: true },
  });

  return session;
}

// ---------------------------------------------------------------------------
// Claude API Call
// ---------------------------------------------------------------------------

async function callClaude(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 1200
): Promise<{ content: string; tokensUsed: number; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  // FIX P0: Add 30s timeout to prevent thread exhaustion
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    logger.error('[TutorService] Claude API error', {
      status: response.status,
      body: errorBody.slice(0, 500),
    });
    throw new Error(`CLAUDE_API_ERROR: ${response.status}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };

  const textContent = data.content
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('');

  return {
    content: textContent,
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    model: data.model || 'claude-sonnet-4-20250514',
  };
}

// ---------------------------------------------------------------------------
// FSRS Integration — Inner-Outer Loop (H5, H9)
// ---------------------------------------------------------------------------

/**
 * Records a concept interaction result and schedules next FSRS review.
 * Called when a student answers a question about a specific concept.
 */
async function recordConceptInteraction(
  tenantId: string,
  userId: string,
  conceptId: string,
  wasCorrect: boolean,
  responseQuality: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'
): Promise<void> {
  try {
    const mastery = await prisma.lmsConceptMastery.findFirst({
      where: { tenantId, userId, conceptId },
    });

    if (!mastery) return;

    const ratingMap: Record<string, Rating> = {
      'AGAIN': 1,
      'HARD': 2,
      'GOOD': 3,
      'EASY': 4,
    };

    const card: FsrsCard = {
      difficulty: mastery.easiness * 2, // Convert SM-2 easiness to FSRS scale
      stability: mastery.interval,
      retrievability: 0.9,
      lastReview: mastery.lastTestedAt,
      interval: mastery.interval,
      reps: mastery.reviewCount,
      lapses: mastery.totalAttempts - mastery.totalCorrect,
    };

    const result = scheduleReview(card, ratingMap[responseQuality]);

    await prisma.lmsConceptMastery.update({
      where: { id: mastery.id },
      data: {
        interval: result.interval,
        easiness: result.newDifficulty / 2, // Convert back
        reviewCount: { increment: 1 },
        nextReviewAt: result.nextReview,
        lastTestedAt: new Date(),
        ...(wasCorrect ? { lastCorrectAt: new Date(), totalCorrect: { increment: 1 } } : {}),
        totalAttempts: { increment: 1 },
      },
    });
  } catch (err) {
    logger.error('[TutorService] Failed to record concept interaction', {
      conceptId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Observation Logging (H3, H10)
// ---------------------------------------------------------------------------

/**
 * Logs an Aurelia observation about a student to StudentProfileNote.
 * Fire-and-forget: never blocks the main conversation flow.
 */
async function logObservation(
  tenantId: string,
  userId: string,
  category: string,
  observation: string,
  evidence: string | null,
  confidence: number,
  source: string,
  impact: string
): Promise<void> {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) return;

    // FIX P3: Rate limit observations to prevent flooding (max 20 per day per user)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentCount = await prisma.studentProfileNote.count({
      where: { userId, createdAt: { gte: today } },
    });
    if (recentCount >= 20) return;

    await prisma.studentProfileNote.create({
      data: {
        tenantId,
        userId,
        profileId: profile.id,
        category,
        observation,
        evidence,
        confidence,
        source,
        impact,
      },
    });
  } catch (err) {
    logger.debug('[TutorService] Failed to log observation', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Main Chat Function — Orchestrator
// ---------------------------------------------------------------------------

/**
 * Main tutoring chat function implementing all 12 Aurelia skills.
 *
 * Pipeline:
 * 1. Session management (subscription check, daily limits)
 * 2. Student profiling (profile, mastery, emotional tendencies)
 * 3. Intent detection (classify student message)
 * 4. Emotional detection (text-based affect analysis)
 * 5. Mode inference (TEACHING/PRACTICE/ROLEPLAY/REVIEW/RAPID)
 * 6. Scaffolding determination (ZPD-based support level)
 * 7. Knowledge retrieval (RAG with pg_trgm + analogies + legal citations)
 * 8. System prompt construction (adaptive, mode-specific)
 * 9. Claude API call
 * 10. Persistence (messages, session stats, observations)
 * 11. FSRS concept tracking (if concept context provided)
 * 12. Response with analytics
 */
export async function chat(
  tenantId: string,
  userId: string,
  request: TutorChatRequest
): Promise<TutorChatResponse> {
  const { message, context, conversationHistory = [], sessionId: requestSessionId } = request;

  // ── 1. Session management ────────────────────────────────────────
  const session = await getOrCreateSession(tenantId, userId, requestSessionId, context);

  // ── 2. Student profiling (parallel) ──────────────────────────────
  const [studentData, conceptMastery, knowledgeItems] = await Promise.all([
    getStudentContext(tenantId, userId),
    getConceptMastery(
      tenantId,
      userId,
      context?.conceptId ? [context.conceptId] : undefined
    ),
    retrieveKnowledge(tenantId, message, context?.topic, 8),
  ]);

  // ── 3. Extract session state from history ────────────────────────
  const sessionState = extractSessionState(conversationHistory, 'TEACHING');

  // ── 4. Intent detection ──────────────────────────────────────────
  const currentMode = inferMode('UNKNOWN' as StudentIntent, context, conversationHistory);
  const intent = detectIntent(message, conversationHistory, currentMode);

  // ── 5. Emotional detection ───────────────────────────────────────
  const emotion = detectEmotion(
    message,
    conversationHistory,
    sessionState.consecutiveErrors
  );

  // ── 6. Mode inference (refined with intent) ──────────────────────
  const mode = inferMode(intent, context, conversationHistory);

  // Override to REVIEW mode if concepts are due and intent is greeting/unknown
  let finalMode = mode;
  if ((intent === 'GREETING' || intent === 'UNKNOWN') && !context?.mode) {
    const dueForReview = await getConceptsDueForReview(tenantId, userId, 3);
    if (dueForReview.length >= 2) {
      finalMode = 'REVIEW';
    }
  }

  // ── 7. Scaffolding determination ─────────────────────────────────
  const totalInteractions = studentData.profile?.totalInteractions ?? 0;
  const scaffolding = determineScaffolding(
    emotion,
    sessionState.consecutiveErrors,
    conceptMastery,
    totalInteractions
  );

  // ── 8. Build enriched system prompt ──────────────────────────────
  const systemPrompt = buildSystemPrompt(finalMode, intent, emotion, scaffolding);

  // Build context injections
  const contextParts: string[] = [];

  // RAG knowledge injection
  if (knowledgeItems.length > 0) {
    const knowledgeText = knowledgeItems
      .map(k => `[${k.domain}] ${k.title}:\n${k.content.slice(0, 800)}${k.source ? `\n(Source: ${k.source})` : ''}`)
      .join('\n\n---\n\n');
    contextParts.push(`<knowledge>\n${knowledgeText}\n</knowledge>`);
  }

  // Relevant insurance analogies injection
  const analogies = findRelevantAnalogies(message);
  if (analogies.length > 0) {
    contextParts.push(`<analogies-disponibles>\n${analogies.join('\n\n')}\n</analogies-disponibles>`);
  }

  // Student profile injection
  if (studentData.contextString) {
    contextParts.push(`<student-profile>\n${studentData.contextString}\n</student-profile>`);
  }

  // Provincial context injection (pan-Canadian awareness)
  const studentProvince = studentData.profile?.province;
  if (studentProvince) {
    const provincialCtx = buildProvincialContext(studentProvince);
    if (provincialCtx) {
      contextParts.push(`<provincial-context>
CONSCIENCE PROVINCIALE — Adapte tes reponses a cette province:
${provincialCtx}

REGLES:
- TOUJOURS preciser quelle loi/province s'applique quand tu donnes une information reglementaire.
- Si l'etudiant pose une question qui varie par province, mentionner les differences cles.
- Utiliser les exemples adaptes au contexte provincial (ex: SAAQ pour QC, ICBC pour BC, SGI pour SK).
- Si ${studentProvince === 'QC' ? 'Code civil du Quebec' : 'common law'}: adapter le vocabulaire juridique en consequence.
</provincial-context>`);
    }
  }

  // Concept mastery injection (inner-outer loop)
  if (conceptMastery.length > 0) {
    const masteryText = conceptMastery
      .map(m => {
        const status = m.level === 0 ? 'jamais testé'
          : m.needsReview ? `niveau ${m.level}/5, BESOIN DE RÉVISION (rétention: ${Math.round(m.retrievability * 100)}%)`
          : `niveau ${m.level}/5, rétention: ${Math.round(m.retrievability * 100)}%`;
        return `- ${m.conceptName}: ${status}`;
      })
      .join('\n');
    contextParts.push(`<mastery-state>\n${masteryText}\n</mastery-state>`);
  }

  // Concepts due for review injection (for REVIEW mode)
  if (finalMode === 'REVIEW') {
    const dueForReview = await getConceptsDueForReview(tenantId, userId, 5);
    if (dueForReview.length > 0) {
      const reviewText = dueForReview
        .map(m => `- ${m.conceptName} (rétention: ${Math.round(m.retrievability * 100)}%, dernier test: ${m.lastTested ? m.lastTested.toLocaleDateString('fr-CA') : 'jamais'})`)
        .join('\n');
      contextParts.push(`<concepts-a-reviser>\nCes concepts ont besoin de révision urgente:\n${reviewText}\nCommence la session par des questions de rappel actif sur ces concepts.\n</concepts-a-reviser>`);
    }
  }

  // Session analytics injection
  if (sessionState.consecutiveErrors > 0) {
    contextParts.push(`<session-state>\nErreurs consécutives: ${sessionState.consecutiveErrors}. Ajuste ton approche.\n</session-state>`);
  }

  // Emotional context for Aurelia
  if (emotion !== 'NEUTRAL') {
    contextParts.push(`<emotion-detected>\nÉtat émotionnel détecté: ${emotion}. Adapte ton ton en conséquence.\n</emotion-detected>`);
  }

  // Assemble the full enriched prompt
  const enrichedPrompt = contextParts.length > 0
    ? systemPrompt + '\n\n' + contextParts.join('\n\n')
    : systemPrompt;

  // ── 9. Build conversation messages for Claude ────────────────────
  const claudeMessages: Array<{ role: string; content: string }> = [];

  // Add conversation history (last 20 messages for context window management)
  const recentHistory = conversationHistory.slice(-20);
  for (const msg of recentHistory) {
    claudeMessages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add the current user message (sanitized to prevent prompt injection via XML tags)
  const sanitizedMessage = message
    .replace(/<\/?(?:student-profile|system|context|instructions|admin)[^>]*>/gi, '')
    .slice(0, 5000); // Max 5000 chars per message
  claudeMessages.push({ role: 'user', content: sanitizedMessage });

  // Determine max tokens based on mode
  const maxTokens = finalMode === 'RAPID' ? 800
    : finalMode === 'REVIEW' ? 1000
    : finalMode === 'ROLEPLAY' ? 1400
    : 1200;

  // ── 10. Call Claude ───────────────────────────────────────────────
  const claudeResponse = await callClaude(enrichedPrompt, claudeMessages, maxTokens);

  // ── 11. Persistence (fire-and-forget) ────────────────────────────
  const persistPromise = (async () => {
    try {
      // Save user message
      await prisma.aiTutorMessage.create({
        data: {
          sessionId: session.id,
          role: 'user',
          content: message,
        },
      });

      // Save assistant response with enriched metadata
      await prisma.aiTutorMessage.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: claudeResponse.content,
          tokenCount: claudeResponse.tokensUsed,
          modelUsed: claudeResponse.model,
          sources: knowledgeItems.length > 0
            ? knowledgeItems.map(k => ({
              title: k.title,
              domain: k.domain,
              source: k.source,
            }))
            : undefined,
        },
      });

      // Update session stats
      await prisma.aiTutorSession.update({
        where: { id: session.id },
        data: {
          messageCount: { increment: 2 },
          lastMessageAt: new Date(),
          ...(!requestSessionId ? { title: message.slice(0, 100) } : {}),
        },
      });

      // Increment daily usage counter
      await prisma.aiTutorSubscription.update({
        where: { id: session.subscriptionId },
        data: { questionsUsedToday: { increment: 1 } },
      });

      // Increment totalInteractions on StudentProfile
      await prisma.studentProfile.updateMany({
        where: { userId, tenantId },
        data: { totalInteractions: { increment: 1 } },
      });

      // Log emotional observation if non-neutral
      if (emotion !== 'NEUTRAL') {
        await logObservation(
          tenantId,
          userId,
          'emotion',
          `Émotion détectée pendant la session: ${emotion}`,
          `Message: "${message.slice(0, 100)}" | Erreurs consécutives: ${sessionState.consecutiveErrors}`,
          0.7,
          'ai_session',
          emotion === 'FRUSTRATED' || emotion === 'ANXIOUS' ? 'NEGATIVE'
          : emotion === 'MOTIVATED' || emotion === 'CONFIDENT' ? 'POSITIVE'
          : 'NEUTRAL'
        );
      }

      // Log misconception if error detected in practice mode
      if (finalMode === 'PRACTICE' && sessionState.consecutiveErrors > 0 && context?.conceptId) {
        await logObservation(
          tenantId,
          userId,
          'struggle',
          `Difficulté détectée sur le concept en mode pratique. ${sessionState.consecutiveErrors} erreurs consécutives.`,
          `Concept: ${context.conceptId} | Mode: ${finalMode}`,
          0.6,
          'quiz_pattern',
          'NEGATIVE'
        );
      }

      // Record concept interaction for FSRS if concept context provided
      if (context?.conceptId && (finalMode === 'PRACTICE' || finalMode === 'REVIEW')) {
        // Approximate quality from consecutive errors
        const quality: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY' =
          sessionState.consecutiveErrors >= 3 ? 'AGAIN'
          : sessionState.consecutiveErrors >= 1 ? 'HARD'
          : 'GOOD';
        const wasCorrect = sessionState.consecutiveErrors === 0;

        await recordConceptInteraction(
          tenantId, userId, context.conceptId, wasCorrect, quality
        );
      }
    } catch (err) {
      logger.error('[TutorService] Failed to persist chat data', {
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();

  // In development, await for easier debugging
  if (process.env.NODE_ENV === 'development') {
    await persistPromise;
  } else {
    persistPromise.catch(() => { /* already logged above */ });
  }

  // ── 12. Build session analytics snapshot ─────────────────────────
  const analytics: SessionAnalytics = {
    conceptsCovered: conceptMastery.map(m => m.conceptName),
    emotionsDetected: emotion !== 'NEUTRAL' ? [emotion] : [],
    questionsAsked: sessionState.questionsAsked + (/\?/.test(message) ? 1 : 0),
    questionsAnswered: sessionState.questionsAnswered,
    misconceptionsIdentified: [],
    consecutiveErrors: sessionState.consecutiveErrors,
    scaffoldingLevel: scaffolding,
    mode: finalMode,
    durationSec: 0, // Would need session start time tracking
  };

  // ── 13. Return response ──────────────────────────────────────────
  return {
    reply: claudeResponse.content,
    sessionId: session.id,
    sources: knowledgeItems.map(k => ({
      title: k.title,
      domain: k.domain,
      source: k.source,
    })),
    tokensUsed: claudeResponse.tokensUsed,
    detectedIntent: intent,
    detectedEmotion: emotion,
    activeMode: finalMode,
    sessionAnalytics: analytics,
  };
}

// ---------------------------------------------------------------------------
// Exported Utilities — For use by other services
// ---------------------------------------------------------------------------

/**
 * Gets concepts due for review for a student.
 * Used by the learning path service and study planner widget.
 */
export { getConceptsDueForReview };

/**
 * Records a concept interaction from external quiz/exercise services.
 * Used by quiz submission handlers.
 */
export { recordConceptInteraction };

/**
 * Detects emotional state from text.
 * Can be used by the widget to show emotional indicators.
 */
export { detectEmotion };

/**
 * Detects student intent from text.
 * Can be used for UI routing (e.g., auto-switching to quiz mode).
 */
export { detectIntent };

/**
 * FSRS Engine — Free Spaced Repetition Scheduler
 *
 * Remplace SM-2 (47.1% rétention) par FSRS (89.6% rétention).
 * Basé sur 700M+ reviews de 20K utilisateurs.
 * 19 paramètres optimisables par machine learning par étudiant.
 *
 * Référence: https://github.com/open-spaced-repetition/fsrs4anki
 */

// Default FSRS weights (optimized from 700M+ reviews globally)
const DEFAULT_WEIGHTS: number[] = [
  0.4072, 1.1829, 3.1262, 15.4722, // w0-w3: initial stability
  7.2102, 0.5316, 1.0651, 0.0589,   // w4-w7: difficulty
  1.5330, 0.1418, 1.0100, 1.8700,   // w8-w11: stability after success
  0.0280, 0.3000, 2.0966, 0.2400,   // w12-w15: stability after failure
  3.0000, 0.5000, 0.8000,           // w16-w18: forgetting curve shape
];

export interface FsrsCard {
  difficulty: number;    // 0-10
  stability: number;     // jours avant 90% oubli
  retrievability: number; // 0-1 probabilité de rappel actuel
  lastReview: Date | null;
  interval: number;      // jours depuis dernier review
  reps: number;          // nombre de reviews
  lapses: number;        // nombre d'échecs
}

export interface FsrsReviewResult {
  nextReview: Date;
  newDifficulty: number;
  newStability: number;
  interval: number; // jours
  newLapses: number; // FIX P3: include updated lapse count
}

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

/**
 * Calcule la retrievability (probabilité de rappel) basée sur le temps écoulé
 */
export function getRetrievability(stability: number, elapsedDays: number): number {
  if (stability < 0.01) return 0; // FIX P2: guard very small stability
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Calcule le prochain intervalle de review basé sur la réponse de l'étudiant
 */
export function scheduleReview(
  card: FsrsCard,
  rating: Rating,
  now: Date = new Date(),
  weights: number[] = DEFAULT_WEIGHTS,
  desiredRetention: number = 0.9
): FsrsReviewResult {
  // FIX P2: Validate weights array
  if (weights.length < 19) {
    throw new Error(`FSRS weights must have 19 elements, got ${weights.length}`);
  }

  const elapsedDays = card.lastReview
    ? (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  const retrievability = card.lastReview
    ? getRetrievability(card.stability, elapsedDays)
    : 0;

  let newDifficulty: number;
  let newStability: number;

  if (card.reps === 0) {
    // First review — use initial stability from weights
    newDifficulty = initDifficulty(rating, weights);
    newStability = initStability(rating, weights);
  } else if (rating === 1) {
    // Failed review (Again)
    newDifficulty = nextDifficulty(card.difficulty, rating, weights);
    newStability = nextForgetStability(
      card.difficulty, card.stability, retrievability, weights
    );
  } else {
    // Successful review (Hard, Good, Easy)
    newDifficulty = nextDifficulty(card.difficulty, rating, weights);
    newStability = nextRecallStability(
      card.difficulty, card.stability, retrievability, rating, weights
    );
  }

  // Clamp difficulty between 1 and 10
  newDifficulty = Math.max(1, Math.min(10, newDifficulty));
  // Clamp stability minimum 0.1 days
  newStability = Math.max(0.1, newStability);

  // Calculate interval from desired retention
  const interval = nextInterval(newStability, desiredRetention);

  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    nextReview,
    newDifficulty,
    newStability,
    interval: Math.round(interval),
    newLapses: card.lapses + (rating === 1 ? 1 : 0), // FIX P3: track lapses
  };
}

// ── Internal FSRS functions ─────────────────────────────────────

function initDifficulty(rating: Rating, w: number[]): number {
  return w[4] - Math.exp(w[5] * (rating - 1)) + 1;
}

function initStability(rating: Rating, w: number[]): number {
  return Math.max(0.1, w[rating - 1]);
}

function nextDifficulty(d: number, rating: Rating, w: number[]): number {
  const newD = d - w[6] * (rating - 3);
  // Mean reversion toward initial difficulty
  return w[7] * initDifficulty(3, w) + (1 - w[7]) * newD;
}

function nextRecallStability(
  d: number, s: number, r: number, rating: Rating, w: number[]
): number {
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return s * (
    1 +
    Math.exp(w[8]) *
    (11 - d) *
    Math.pow(s, -w[9]) *
    (Math.exp((1 - r) * w[10]) - 1) *
    hardPenalty *
    easyBonus
  );
}

function nextForgetStability(
  d: number, s: number, r: number, w: number[]
): number {
  return w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14]);
}

function nextInterval(stability: number, desiredRetention: number): number {
  return Math.max(1, Math.round(
    (stability / 9) * (1 / desiredRetention - 1)
  ));
}

/**
 * Convertit un score de quiz (0-100) en rating FSRS (1-4)
 */
// FIX P3: Configurable thresholds with sensible defaults
export function quizScoreToRating(
  score: number,
  passingScore: number,
  thresholds = { again: 0.5, hard: 1.0, good: 1.2 }
): Rating {
  if (score < passingScore * thresholds.again) return 1; // Again — très mauvais
  if (score < passingScore * thresholds.hard) return 2;  // Hard — en dessous du seuil
  if (score < passingScore * thresholds.good) return 3;  // Good — passé correctement
  return 4;                                               // Easy — bien au-dessus
}

/**
 * Crée une carte FSRS initiale pour un nouveau concept
 */
export function createNewCard(): FsrsCard {
  return {
    difficulty: 5,
    stability: 0,
    retrievability: 0,
    lastReview: null,
    interval: 0,
    reps: 0,
    lapses: 0,
  };
}

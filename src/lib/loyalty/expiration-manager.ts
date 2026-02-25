/**
 * Points Expiration Manager
 * Configurable expiry (12-month), reminder emails, admin override
 */

export interface ExpirationConfig {
  expirationMonths: number;
  reminderDaysBefore: number[];
  graceperiodDays: number;
}

export const DEFAULT_EXPIRATION: ExpirationConfig = {
  expirationMonths: 12,
  reminderDaysBefore: [90, 30, 7],
  graceperiodDays: 14,
};

export interface PointsBatch {
  id: string;
  userId: string;
  points: number;
  earnedAt: Date;
  expiresAt: Date;
  expired: boolean;
  source: string;
}

export function calculateExpirationDate(earnedAt: Date, months: number = 12): Date {
  const expires = new Date(earnedAt);
  expires.setMonth(expires.getMonth() + months);
  return expires;
}

export function getExpiringPoints(
  batches: PointsBatch[],
  daysAhead: number
): { total: number; batches: PointsBatch[] } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const expiring = batches.filter(
    (b) => !b.expired && b.expiresAt <= cutoff && b.expiresAt > new Date()
  );

  return {
    total: expiring.reduce((sum, b) => sum + b.points, 0),
    batches: expiring,
  };
}

export function processExpirations(batches: PointsBatch[]): {
  expired: PointsBatch[];
  totalExpired: number;
} {
  const now = new Date();
  const expired = batches.filter((b) => !b.expired && b.expiresAt <= now);
  return {
    expired,
    totalExpired: expired.reduce((sum, b) => sum + b.points, 0),
  };
}

export function getReminderSchedule(expiresAt: Date, config: ExpirationConfig = DEFAULT_EXPIRATION): Date[] {
  return config.reminderDaysBefore.map((days) => {
    const date = new Date(expiresAt);
    date.setDate(date.getDate() - days);
    return date;
  }).filter((d) => d > new Date());
}

/**
 * CEU (Continuing Education Units) Tracking Service (stub)
 * TODO: Full implementation
 */

export interface CeuRecord {
  userId: string;
  courseId: string;
  credits: number;
  earnedAt: Date;
  expiresAt?: Date;
}

export async function getUserCeuCredits(_userId: string): Promise<{ total: number; records: CeuRecord[] }> {
  return { total: 0, records: [] };
}

export async function awardCeuCredits(
  _userId: string,
  _courseId: string,
  _credits: number
): Promise<CeuRecord | null> {
  return null;
}

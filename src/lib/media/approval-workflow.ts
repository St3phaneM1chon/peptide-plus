/**
 * Content Approval Workflow
 * C-19: Draft → Review → Approved → Published state machine.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// ContentStatus enum from Prisma: DRAFT, REVIEW, APPROVED, PUBLISHED, ARCHIVED
type WorkflowStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

interface TransitionResult {
  success: boolean;
  newStatus?: WorkflowStatus;
  error?: string;
}

// ---------------------------------------------------------------------------
// State machine: valid transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT:     ['REVIEW', 'ARCHIVED'],
  REVIEW:    ['DRAFT', 'APPROVED', 'ARCHIVED'],    // Can send back to draft
  APPROVED:  ['PUBLISHED', 'REVIEW', 'ARCHIVED'],  // Can send back to review
  PUBLISHED: ['ARCHIVED', 'DRAFT'],                 // Can unpublish
  ARCHIVED:  ['DRAFT'],                             // Can restore
};

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Transition a video to a new workflow status.
 */
export async function transitionVideoStatus(
  videoId: string,
  targetStatus: WorkflowStatus,
  userId: string,
): Promise<TransitionResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, title: true },
  });

  if (!video) {
    return { success: false, error: 'Video not found' };
  }

  const currentStatus = video.status as WorkflowStatus;
  const allowed = VALID_TRANSITIONS[currentStatus];

  if (!allowed || !allowed.includes(targetStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}. Allowed: ${allowed?.join(', ') || 'none'}`,
    };
  }

  // Apply transition
  const updateData: Record<string, unknown> = {
    status: targetStatus,
  };

  // Side effects based on target status
  if (targetStatus === 'PUBLISHED') {
    updateData.isPublished = true;
  } else if (targetStatus === 'DRAFT' || targetStatus === 'ARCHIVED') {
    updateData.isPublished = false;
  }

  await prisma.video.update({
    where: { id: videoId },
    data: updateData,
  });

  logger.info(`[Workflow] Video ${videoId} transitioned: ${currentStatus} → ${targetStatus} by ${userId}`);

  return { success: true, newStatus: targetStatus };
}

/**
 * Get available transitions for a video's current status.
 */
export function getAvailableTransitions(currentStatus: string): WorkflowStatus[] {
  return VALID_TRANSITIONS[currentStatus as WorkflowStatus] || [];
}

/**
 * Submit a video for review (shorthand).
 */
export async function submitForReview(videoId: string, userId: string): Promise<TransitionResult> {
  return transitionVideoStatus(videoId, 'REVIEW', userId);
}

/**
 * Approve a video (shorthand).
 */
export async function approveVideo(videoId: string, userId: string): Promise<TransitionResult> {
  return transitionVideoStatus(videoId, 'APPROVED', userId);
}

/**
 * Publish a video (shorthand).
 */
export async function publishVideo(videoId: string, userId: string): Promise<TransitionResult> {
  return transitionVideoStatus(videoId, 'PUBLISHED', userId);
}

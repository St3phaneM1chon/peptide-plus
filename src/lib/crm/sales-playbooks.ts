/**
 * CRM Sales Playbooks (B16)
 *
 * - getPlaybook: Get a playbook by ID
 * - getPlaybooksForPipeline: List playbooks for a specific pipeline
 * - getStageGuidance: Get guidance for a specific stage within a playbook
 * - installDefaultPlaybooks: Install starter playbooks with default stages
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageGuidance {
  stageId: string;
  guidance: string;
  checklist: string[];
  resources: { title: string; url: string }[];
}

export interface PlaybookData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  stages: StageGuidance[];
  targetPipeline: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Get Playbook by ID
// ---------------------------------------------------------------------------

/**
 * Retrieve a single playbook by its ID.
 */
export async function getPlaybook(id: string): Promise<PlaybookData | null> {
  const playbook = await prisma.crmPlaybook.findUnique({
    where: { id },
  });

  if (!playbook) return null;

  return {
    ...playbook,
    stages: (playbook.stages as unknown as StageGuidance[]) || [],
  };
}

// ---------------------------------------------------------------------------
// Get Playbooks for Pipeline
// ---------------------------------------------------------------------------

/**
 * List all active playbooks assigned to a specific pipeline.
 */
export async function getPlaybooksForPipeline(pipelineId: string): Promise<PlaybookData[]> {
  const playbooks = await prisma.crmPlaybook.findMany({
    where: {
      OR: [
        { targetPipeline: pipelineId },
        { targetPipeline: null }, // Universal playbooks
      ],
      status: 'ACTIVE',
    },
    orderBy: { name: 'asc' },
  });

  return playbooks.map((pb) => ({
    ...pb,
    stages: (pb.stages as unknown as StageGuidance[]) || [],
  }));
}

// ---------------------------------------------------------------------------
// Get Stage Guidance
// ---------------------------------------------------------------------------

/**
 * Get guidance for a specific stage within a playbook.
 */
export async function getStageGuidance(
  playbookId: string,
  stageId: string
): Promise<StageGuidance | null> {
  const playbook = await prisma.crmPlaybook.findUnique({
    where: { id: playbookId },
    select: { stages: true },
  });

  if (!playbook) return null;

  const stages = (playbook.stages as unknown as StageGuidance[]) || [];
  return stages.find((s) => s.stageId === stageId) || null;
}

// ---------------------------------------------------------------------------
// Install Default Playbooks
// ---------------------------------------------------------------------------

/**
 * Install default starter playbooks. Skips if playbooks already exist.
 */
export async function installDefaultPlaybooks(): Promise<{ installed: number }> {
  const existingCount = await prisma.crmPlaybook.count();
  if (existingCount > 0) {
    logger.info('[sales-playbooks] Playbooks already exist, skipping install', { existingCount });
    return { installed: 0 };
  }

  const defaultPlaybooks = [
    {
      name: 'Standard Sales Process',
      description: 'Default B2B sales playbook covering the full sales cycle',
      status: 'ACTIVE' as const,
      stages: [
        {
          stageId: 'qualification',
          guidance: 'Verify the lead meets ICP criteria. Confirm budget, authority, need, and timeline (BANT).',
          checklist: ['Confirm decision maker', 'Identify budget range', 'Understand timeline', 'Document pain points'],
          resources: [{ title: 'BANT Framework Guide', url: '/docs/bant-guide' }],
        },
        {
          stageId: 'discovery',
          guidance: 'Conduct a thorough discovery call. Understand the prospect\'s current situation, challenges, and desired outcomes.',
          checklist: ['Schedule discovery call', 'Prepare discovery questions', 'Send meeting agenda', 'Document findings'],
          resources: [{ title: 'Discovery Call Template', url: '/docs/discovery-template' }],
        },
        {
          stageId: 'proposal',
          guidance: 'Create a tailored proposal addressing the prospect\'s specific needs and ROI projections.',
          checklist: ['Draft proposal', 'Include ROI analysis', 'Get internal approval', 'Send to prospect'],
          resources: [{ title: 'Proposal Template', url: '/docs/proposal-template' }],
        },
        {
          stageId: 'negotiation',
          guidance: 'Handle objections, negotiate terms, and work toward mutual agreement.',
          checklist: ['Address objections', 'Finalize pricing', 'Review contract terms', 'Get legal approval if needed'],
          resources: [{ title: 'Objection Handling Guide', url: '/docs/objections' }],
        },
        {
          stageId: 'closing',
          guidance: 'Finalize the deal. Send contract for signature and ensure smooth handoff to onboarding.',
          checklist: ['Send final contract', 'Obtain signature', 'Schedule onboarding', 'Update CRM'],
          resources: [{ title: 'Closing Checklist', url: '/docs/closing-checklist' }],
        },
      ],
    },
    {
      name: 'Inbound Lead Nurturing',
      description: 'Playbook for converting inbound marketing leads',
      status: 'ACTIVE' as const,
      stages: [
        {
          stageId: 'initial-contact',
          guidance: 'Respond to the inbound lead within 5 minutes. Acknowledge their interest and schedule a call.',
          checklist: ['Send welcome email', 'Schedule introductory call', 'Research the company'],
          resources: [{ title: 'Speed-to-Lead Best Practices', url: '/docs/speed-to-lead' }],
        },
        {
          stageId: 'nurturing',
          guidance: 'Share relevant content and build trust. Qualify the lead for sales readiness.',
          checklist: ['Send relevant case study', 'Share product demo video', 'Check engagement metrics'],
          resources: [{ title: 'Nurturing Email Sequences', url: '/docs/nurturing' }],
        },
      ],
    },
  ];

  // N+1 FIX: Use createMany to batch-insert all playbooks in a single query
  // instead of sequential individual creates (was 1 query per playbook, now 1 query total)
  const result = await prisma.crmPlaybook.createMany({
    data: defaultPlaybooks.map((pb) => ({
      name: pb.name,
      description: pb.description,
      status: pb.status,
      stages: pb.stages as unknown as Prisma.InputJsonValue,
    })),
  });

  const installed = result.count;
  logger.info('[sales-playbooks] Default playbooks installed', { installed });
  return { installed };
}

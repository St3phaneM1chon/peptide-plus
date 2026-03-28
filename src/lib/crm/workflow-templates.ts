/**
 * CRM Workflow Templates Library (I15)
 *
 * Pre-built, installable workflow templates for common automation patterns.
 * Each template includes trigger configuration and step definitions that
 * can be installed as a new CrmWorkflow + CrmWorkflowStep records.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'onboarding' | 'nurture' | 'follow-up' | 'notification' | 'retention' | 'lifecycle';
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  steps: Array<{
    actionType: string;
    config: Record<string, unknown>;
    delayMinutes: number;
  }>;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'welcome-sequence',
    name: 'Welcome Sequence',
    description: 'Send a series of welcome emails when a new lead is created. Includes an immediate welcome, a follow-up after 1 day, and a product introduction after 3 days.',
    category: 'onboarding',
    triggerType: 'NEW_LEAD',
    triggerConfig: {},
    steps: [
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Bienvenue!', body: 'Thank you for your interest. We are excited to have you.' },
        delayMinutes: 0,
      },
      {
        actionType: 'ADD_TAG',
        config: { tag: 'welcome-sent' },
        delayMinutes: 0,
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Getting started with peptides', body: 'Here are some resources to help you get started with our products.' },
        delayMinutes: 1440, // 1 day
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Our top products for you', body: 'Based on your profile, we recommend these peptide products.' },
        delayMinutes: 4320, // 3 days
      },
    ],
  },
  {
    id: 'lead-nurture',
    name: 'Lead Nurture Drip',
    description: 'Automated nurture sequence for new leads. Assigns to an agent, sends educational content, and creates a follow-up task.',
    category: 'nurture',
    triggerType: 'NEW_LEAD',
    triggerConfig: {},
    steps: [
      {
        actionType: 'ASSIGN_TO',
        config: { assignRoundRobin: true },
        delayMinutes: 0,
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Learn about our research', body: 'Discover the latest peptide research and how it can benefit you.' },
        delayMinutes: 60,
      },
      {
        actionType: 'CREATE_TASK',
        config: { taskTitle: 'Follow up with new lead', taskType: 'FOLLOW_UP', taskPriority: 'MEDIUM', taskDueDays: 2 },
        delayMinutes: 1440,
      },
      {
        actionType: 'NOTIFY_AGENT',
        config: { notificationMessage: 'Lead has been in nurture for 3 days. Time for a personal touch.' },
        delayMinutes: 4320,
      },
    ],
  },
  {
    id: 'deal-follow-up',
    name: 'Deal Follow-up',
    description: 'When a deal moves to a new stage, notify the assigned agent and create a follow-up task to keep momentum.',
    category: 'follow-up',
    triggerType: 'DEAL_STAGE_CHANGE',
    triggerConfig: {},
    steps: [
      {
        actionType: 'NOTIFY_AGENT',
        config: { notificationMessage: 'Deal has moved to a new stage. Review and take action.' },
        delayMinutes: 0,
      },
      {
        actionType: 'CREATE_TASK',
        config: { taskTitle: 'Review deal progress', taskType: 'FOLLOW_UP', taskPriority: 'HIGH', taskDueDays: 1 },
        delayMinutes: 0,
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'We are making progress!', body: 'Thank you for your continued interest. Here is what comes next.' },
        delayMinutes: 60,
      },
    ],
  },
  {
    id: 'win-notification',
    name: 'Win Notification',
    description: 'Celebrate when a deal is won! Notify the team, tag the deal, and send a thank-you email to the customer.',
    category: 'notification',
    triggerType: 'DEAL_STAGE_CHANGE',
    triggerConfig: { toStatus: 'WON' },
    steps: [
      {
        actionType: 'ADD_TAG',
        config: { tag: 'won' },
        delayMinutes: 0,
      },
      {
        actionType: 'NOTIFY_AGENT',
        config: { notificationMessage: 'Congratulations! A deal has been won!' },
        delayMinutes: 0,
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Thank you for your order!', body: 'We appreciate your business. Your order is being processed.' },
        delayMinutes: 5,
      },
      {
        actionType: 'WEBHOOK',
        config: { webhookUrl: '', webhookMethod: 'POST', webhookBody: { event: 'deal_won' } },
        delayMinutes: 0,
      },
    ],
  },
  {
    id: 'lost-recovery',
    name: 'Lost Deal Recovery',
    description: 'When a deal is lost, wait a period then re-engage with a recovery email and create a follow-up task.',
    category: 'retention',
    triggerType: 'DEAL_STAGE_CHANGE',
    triggerConfig: { toStatus: 'LOST' },
    steps: [
      {
        actionType: 'ADD_TAG',
        config: { tag: 'lost-recovery' },
        delayMinutes: 0,
      },
      {
        actionType: 'WAIT',
        config: { waitMinutes: 10080 },
        delayMinutes: 10080, // 7 days
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'We would love to win you back', body: 'It has been a week since we last spoke. Is there anything we can do to earn your business?' },
        delayMinutes: 0,
      },
      {
        actionType: 'CREATE_TASK',
        config: { taskTitle: 'Lost deal recovery follow-up', taskType: 'CALL', taskPriority: 'MEDIUM', taskDueDays: 3 },
        delayMinutes: 0,
      },
    ],
  },
  {
    id: 'inactive-reengagement',
    name: 'Inactive Lead Re-engagement',
    description: 'Re-engage leads that have gone cold. Triggered by lead status change to inactive, sends a re-engagement sequence.',
    category: 'retention',
    triggerType: 'LEAD_STATUS_CHANGE',
    triggerConfig: { toStatus: 'INACTIVE' },
    steps: [
      {
        actionType: 'ADD_TAG',
        config: { tag: 're-engagement' },
        delayMinutes: 0,
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'We miss you!', body: 'It has been a while since we connected. Here is what is new in our peptide catalog.' },
        delayMinutes: 1440, // 1 day
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Special offer just for you', body: 'As a valued contact, we would like to offer you an exclusive discount on your next order.' },
        delayMinutes: 4320, // 3 days later
      },
      {
        actionType: 'CREATE_TASK',
        config: { taskTitle: 'Call inactive lead', taskType: 'CALL', taskPriority: 'MEDIUM', taskDueDays: 7 },
        delayMinutes: 0,
      },
    ],
  },
  {
    id: 'birthday-greeting',
    name: 'Birthday Greeting',
    description: 'Send a personalized birthday greeting email. Requires a scheduled/time-based trigger matching the contact birthday.',
    category: 'lifecycle',
    triggerType: 'TIME_BASED',
    triggerConfig: { cronExpression: '0 9 * * *' }, // Daily check at 9 AM
    steps: [
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Happy Birthday!', body: 'Wishing you a wonderful birthday! Enjoy a special 10% discount as our gift to you.' },
        delayMinutes: 0,
      },
      {
        actionType: 'ADD_TAG',
        config: { tag: 'birthday-greeting-sent' },
        delayMinutes: 0,
      },
    ],
  },
  {
    id: 'renewal-reminder',
    name: 'Renewal Reminder',
    description: 'Remind customers about upcoming subscription renewals. Sends reminders at 30 days, 7 days, and 1 day before expiry.',
    category: 'lifecycle',
    triggerType: 'TIME_BASED',
    triggerConfig: { cronExpression: '0 10 * * *' }, // Daily check at 10 AM
    steps: [
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Your subscription renews soon', body: 'Your subscription will renew in 30 days. Review your plan and make any changes.' },
        delayMinutes: 0,
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Renewal in 7 days', body: 'Just a reminder that your subscription renews in 7 days.' },
        delayMinutes: 33120, // 23 days later
      },
      {
        actionType: 'SEND_EMAIL',
        config: { subject: 'Last chance to review your subscription', body: 'Your subscription renews tomorrow. Make any last-minute changes now.' },
        delayMinutes: 8640, // 6 days later
      },
      {
        actionType: 'NOTIFY_AGENT',
        config: { notificationMessage: 'Customer subscription is renewing today. Confirm everything is in order.' },
        delayMinutes: 1440,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all available workflow templates.
 */
export function getAvailableTemplates(): WorkflowTemplate[] {
  return TEMPLATES.map(t => ({ ...t }));
}

/**
 * Preview a specific template without installing it.
 */
export function previewTemplate(templateId: string): WorkflowTemplate | null {
  const template = TEMPLATES.find(t => t.id === templateId);
  return template ? { ...template } : null;
}

/**
 * Install a workflow template as a new CrmWorkflow with CrmWorkflowStep records.
 * Returns the created workflow ID.
 */
export async function installTemplate(
  templateId: string,
  userId: string
): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return { success: false, error: `Template not found: ${templateId}` };
  }

  try {
    const workflow = await prisma.crmWorkflow.create({
      data: {
        name: template.name,
        description: template.description,
        triggerType: template.triggerType as Prisma.CrmWorkflowCreateInput['triggerType'],
        triggerConfig: template.triggerConfig as Prisma.InputJsonValue,
        createdById: userId,
        status: 'DRAFT', // Templates always start as draft
        steps: {
          create: template.steps.map((step, idx) => ({
            position: idx,
            actionType: step.actionType as Prisma.CrmWorkflowStepCreateWithoutWorkflowInput['actionType'],
            config: step.config as Prisma.InputJsonValue,
            delayMinutes: step.delayMinutes,
          })),
        },
      },
      include: {
        steps: { orderBy: { position: 'asc' } },
      },
    });

    logger.info('[WorkflowTemplates] Template installed', {
      templateId,
      workflowId: workflow.id,
      userId,
      stepCount: template.steps.length,
    });

    return { success: true, workflowId: workflow.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[WorkflowTemplates] Failed to install template', {
      templateId,
      userId,
      error: msg,
    });
    return { success: false, error: msg };
  }
}

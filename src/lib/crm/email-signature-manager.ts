/**
 * CRM Email Signature Manager (H13)
 *
 * Centralized email signature management for the team.
 * - getSignatureTemplate: Get signature HTML template by ID
 * - renderSignature: Render template with agent's data (name, title, phone, photo)
 * - assignSignature: Assign a template to one or more agents
 * - getTeamSignatures: List all templates with assigned agents
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignatureTemplate {
  id: string;
  name: string;
  html: string;
  isDefault: boolean;
  assignedAgentIds: string[];
}

export interface AgentData {
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  photo?: string;
  company?: string;
  website?: string;
}

// ---------------------------------------------------------------------------
// Settings key prefix
// ---------------------------------------------------------------------------

const SIGNATURE_PREFIX = 'email_signature_';
const ASSIGNMENT_PREFIX = 'sig_assignment_';

// ---------------------------------------------------------------------------
// Get Signature Template
// ---------------------------------------------------------------------------

/**
 * Get a signature HTML template by its ID.
 */
export async function getSignatureTemplate(templateId: string): Promise<SignatureTemplate | null> {
  const setting = await prisma.siteSetting.findFirst({
    where: { key: `${SIGNATURE_PREFIX}${templateId}` },
  });

  if (!setting?.value) return null;

  try {
    const data = JSON.parse(setting.value) as {
      name: string;
      html: string;
      isDefault: boolean;
    };

    // Get assigned agents
    const assignments = await prisma.siteSetting.findMany({
      where: {
        key: { startsWith: ASSIGNMENT_PREFIX },
        value: templateId,
      },
    });

    const assignedAgentIds = assignments.map((a) => {
      const parts = a.key.split(ASSIGNMENT_PREFIX);
      return parts[1] || '';
    }).filter(Boolean);

    return {
      id: templateId,
      name: data.name,
      html: data.html,
      isDefault: data.isDefault,
      assignedAgentIds,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render Signature
// ---------------------------------------------------------------------------

/**
 * Render a signature template with agent-specific data.
 * Replaces merge fields: {{name}}, {{title}}, {{phone}}, {{email}}, {{photo}}, {{company}}, {{website}}
 */
export async function renderSignature(templateId: string, agentData: AgentData): Promise<string> {
  const template = await getSignatureTemplate(templateId);

  if (!template) {
    throw new Error(`Signature template ${templateId} not found`);
  }

  let html = template.html;

  // Replace merge fields
  html = html.replace(/\{\{name\}\}/g, agentData.name || '');
  html = html.replace(/\{\{title\}\}/g, agentData.title || '');
  html = html.replace(/\{\{phone\}\}/g, agentData.phone || '');
  html = html.replace(/\{\{email\}\}/g, agentData.email || '');
  html = html.replace(/\{\{photo\}\}/g, agentData.photo || '');
  html = html.replace(/\{\{company\}\}/g, agentData.company || 'BioCycle Peptides');
  html = html.replace(/\{\{website\}\}/g, agentData.website || 'https://biocyclepeptides.com');

  return html;
}

// ---------------------------------------------------------------------------
// Assign Signature
// ---------------------------------------------------------------------------

/**
 * Assign a signature template to one or more agents.
 */
export async function assignSignature(templateId: string, agentIds: string[]): Promise<void> {
  // Verify template exists
  const template = await getSignatureTemplate(templateId);
  if (!template) {
    throw new Error(`Signature template ${templateId} not found`);
  }

  // N+1 FIX: Batch all upserts in a single $transaction instead of
  // sequential individual upserts (was 1 query per agent, now 1 transaction)
  await prisma.$transaction(
    agentIds.map((agentId) =>
      prisma.siteSetting.upsert({
        where: { key: `${ASSIGNMENT_PREFIX}${agentId}` },
        create: {
          key: `${ASSIGNMENT_PREFIX}${agentId}`,
          value: templateId,
        },
        update: {
          value: templateId,
        },
      })
    )
  );

  logger.info('[email-signatures] Signature assigned to agents', {
    event: 'signature_assigned',
    templateId,
    agentIds,
    agentCount: agentIds.length,
  });
}

// ---------------------------------------------------------------------------
// Get Team Signatures
// ---------------------------------------------------------------------------

/**
 * List all signature templates with their assigned agents.
 */
export async function getTeamSignatures(): Promise<SignatureTemplate[]> {
  // Batch: fetch both signature templates and all assignments in parallel
  const [settings, allAssignments] = await Promise.all([
    prisma.siteSetting.findMany({
      where: { key: { startsWith: SIGNATURE_PREFIX } },
    }),
    prisma.siteSetting.findMany({
      where: { key: { startsWith: ASSIGNMENT_PREFIX } },
    }),
  ]);

  // Group assignments by template ID (the value field)
  const assignmentsByTemplateId = new Map<string, string[]>();
  for (const a of allAssignments) {
    const agentId = a.key.split(ASSIGNMENT_PREFIX)[1] || '';
    if (!agentId || !a.value) continue;
    if (!assignmentsByTemplateId.has(a.value)) assignmentsByTemplateId.set(a.value, []);
    assignmentsByTemplateId.get(a.value)!.push(agentId);
  }

  const templates: SignatureTemplate[] = [];

  for (const setting of settings) {
    const templateId = setting.key.replace(SIGNATURE_PREFIX, '');

    try {
      const data = JSON.parse(setting.value || '{}') as {
        name: string;
        html: string;
        isDefault: boolean;
      };

      const assignedAgentIds = assignmentsByTemplateId.get(templateId) || [];

      templates.push({
        id: templateId,
        name: data.name,
        html: data.html,
        isDefault: data.isDefault || false,
        assignedAgentIds,
      });
    } catch {
      // Skip malformed entries
    }
  }

  return templates;
}

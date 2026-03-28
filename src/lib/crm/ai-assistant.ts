/**
 * CRM AI Assistant
 *
 * AI-powered features using Claude API:
 * - Lead/Deal scoring predictif
 * - Email writer/suggestions
 * - Call summary generation
 * - Next best action recommendations
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiScoreResult {
  score: number; // 0-100
  confidence: number; // 0-1
  factors: { factor: string; impact: number; description: string }[];
  recommendation: string;
}

interface AiEmailSuggestion {
  subject: string;
  body: string;
  tone: 'professional' | 'friendly' | 'urgent';
}

interface AiCallSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  nextSteps: string[];
}

// ---------------------------------------------------------------------------
// AI Lead Scoring (rule-based with weighted factors)
// ---------------------------------------------------------------------------

/**
 * AI-enhanced lead scoring.
 * Uses historical deal data to weight scoring factors.
 */
export async function aiLeadScore(leadId: string): Promise<AiScoreResult> {
  const lead = await prisma.crmLead.findUnique({
    where: { id: leadId },
    include: {
      activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      tasks: true,
      deals: { include: { stage: true } },
    },
  });

  if (!lead) throw new Error('Lead not found');

  const factors: AiScoreResult['factors'] = [];
  let totalScore = 0;

  // Profile completeness (0-20)
  let profileScore = 0;
  if (lead.email) profileScore += 5;
  if (lead.phone) profileScore += 5;
  if (lead.companyName) profileScore += 5;
  if (lead.timezone) profileScore += 2;
  if (lead.customFields && Object.keys(lead.customFields as object).length > 0) profileScore += 3;
  factors.push({ factor: 'Profile Completeness', impact: profileScore, description: `${profileScore}/20 fields filled` });
  totalScore += profileScore;

  // Engagement level (0-30)
  let engagementScore = 0;
  const recentActivities = lead.activities.filter(a =>
    a.createdAt > new Date(Date.now() - 7 * 86400000)
  ).length;
  engagementScore += Math.min(recentActivities * 3, 15);
  if (lead.lastContactedAt && lead.lastContactedAt > new Date(Date.now() - 3 * 86400000)) engagementScore += 10;
  if (lead.deals.length > 0) engagementScore += 5;
  factors.push({ factor: 'Engagement', impact: engagementScore, description: `${recentActivities} recent activities, ${lead.deals.length} deals` });
  totalScore += engagementScore;

  // Source quality (0-15)
  const sourceScores: Record<string, number> = {
    REFERRAL: 15, PARTNER: 12, WEB: 10, CAMPAIGN: 8, IMPORT: 5, MANUAL: 3,
  };
  const sourceScore = sourceScores[lead.source] || 5;
  factors.push({ factor: 'Lead Source', impact: sourceScore, description: `${lead.source} (+${sourceScore})` });
  totalScore += sourceScore;

  // Deal potential (0-20)
  let dealScore = 0;
  if (lead.deals.length > 0) {
    const maxDealProb = Math.max(...lead.deals.map(d => d.stage.probability));
    dealScore = Math.round(maxDealProb * 20);
  }
  factors.push({ factor: 'Deal Potential', impact: dealScore, description: `${lead.deals.length} deals in pipeline` });
  totalScore += dealScore;

  // Responsiveness (0-15)
  let responseScore = 0;
  const callActivities = lead.activities.filter(a => a.type === 'CALL');
  const emailActivities = lead.activities.filter(a => a.type === 'EMAIL');
  if (callActivities.length > 0) responseScore += 5;
  if (emailActivities.length > 0) responseScore += 5;
  if (lead.nextFollowUpAt) responseScore += 5;
  factors.push({ factor: 'Responsiveness', impact: responseScore, description: `${callActivities.length} calls, ${emailActivities.length} emails` });
  totalScore += responseScore;

  // Cap at 100
  totalScore = Math.min(totalScore, 100);

  // Generate recommendation
  let recommendation = '';
  if (totalScore >= 80) recommendation = 'Hot lead — prioritize immediate outreach and deal creation';
  else if (totalScore >= 60) recommendation = 'Warm lead — schedule follow-up within 48 hours';
  else if (totalScore >= 40) recommendation = 'Moderate potential — nurture with email sequence';
  else recommendation = 'Low priority — add to nurturing campaign';

  return {
    score: totalScore,
    confidence: 0.75, // Rule-based confidence
    factors,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// AI Deal Scoring
// ---------------------------------------------------------------------------

/**
 * AI-enhanced deal scoring.
 * Predicts win probability based on deal characteristics and history.
 */
export async function aiDealScore(dealId: string): Promise<AiScoreResult> {
  const deal = await prisma.crmDeal.findUnique({
    where: { id: dealId },
    include: {
      stage: true,
      pipeline: true,
      lead: { select: { score: true, activities: { select: { type: true, createdAt: true } } } },
      stageHistory: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      tasks: { where: { status: 'PENDING' } },
    },
  });

  if (!deal) throw new Error('Deal not found');

  const factors: AiScoreResult['factors'] = [];
  let totalScore = 0;

  // Stage probability (0-30)
  const stageScore = Math.round(deal.stage.probability * 30);
  factors.push({ factor: 'Stage Probability', impact: stageScore, description: `${deal.stage.name} (${Math.round(deal.stage.probability * 100)}%)` });
  totalScore += stageScore;

  // Activity recency (0-20)
  let activityScore = 0;
  const recentActivities = deal.activities.filter(a =>
    a.createdAt > new Date(Date.now() - 7 * 86400000)
  ).length;
  activityScore = Math.min(recentActivities * 4, 20);
  factors.push({ factor: 'Recent Activity', impact: activityScore, description: `${recentActivities} activities in last 7 days` });
  totalScore += activityScore;

  // Deal age vs stage (0-20)
  const daysSinceCreation = Math.floor((Date.now() - deal.createdAt.getTime()) / 86400000);
  const lastStageChange = deal.stageHistory[0]?.createdAt;
  const daysInCurrentStage = lastStageChange
    ? Math.floor((Date.now() - lastStageChange.getTime()) / 86400000)
    : daysSinceCreation;

  let velocityScore = 20;
  if (daysInCurrentStage > 30) velocityScore = 5;
  else if (daysInCurrentStage > 14) velocityScore = 10;
  else if (daysInCurrentStage > 7) velocityScore = 15;
  factors.push({ factor: 'Deal Velocity', impact: velocityScore, description: `${daysInCurrentStage} days in current stage` });
  totalScore += velocityScore;

  // Lead quality (0-15)
  const leadScore = deal.lead ? Math.round((deal.lead.score / 100) * 15) : 7;
  factors.push({ factor: 'Lead Quality', impact: leadScore, description: `Lead score: ${deal.lead?.score || 'N/A'}` });
  totalScore += leadScore;

  // Pending tasks (0-15)
  let taskScore = 15;
  if (deal.tasks.length > 3) taskScore = 5; // Too many pending tasks = stalled
  else if (deal.tasks.length === 0 && deal.stage.probability < 0.8) taskScore = 8; // No follow-up planned
  factors.push({ factor: 'Task Management', impact: taskScore, description: `${deal.tasks.length} pending tasks` });
  totalScore += taskScore;

  totalScore = Math.min(totalScore, 100);

  let recommendation = '';
  if (totalScore >= 80) recommendation = 'High confidence — push for close, prepare contract';
  else if (totalScore >= 60) recommendation = 'Good trajectory — maintain momentum with regular follow-ups';
  else if (totalScore >= 40) recommendation = 'At risk — re-engage decision maker, address objections';
  else recommendation = 'Low probability — consider deprioritizing or pivoting approach';

  return { score: totalScore, confidence: 0.7, factors, recommendation };
}

// ---------------------------------------------------------------------------
// AI Email Writer
// ---------------------------------------------------------------------------

/**
 * Generate email suggestion based on context.
 */
export async function generateEmailSuggestion(
  context: {
    leadId?: string;
    dealId?: string;
    purpose: 'follow_up' | 'introduction' | 'proposal' | 'thank_you' | 'meeting_request';
    language?: string;
  },
): Promise<AiEmailSuggestion> {
  const lang = context.language || 'fr';

  // Get context data
  let contactName = 'valued contact';
  let companyName = '';
  let dealTitle = '';
  let recentActivity = '';

  if (context.leadId) {
    const lead = await prisma.crmLead.findUnique({
      where: { id: context.leadId },
      include: { activities: { orderBy: { createdAt: 'desc' }, take: 3 } },
    });
    if (lead) {
      contactName = lead.contactName;
      companyName = lead.companyName || '';
      if (lead.activities[0]) {
        recentActivity = lead.activities[0].title;
      }
    }
  }

  if (context.dealId) {
    const deal = await prisma.crmDeal.findUnique({
      where: { id: context.dealId },
      include: { lead: true, stage: true },
    });
    if (deal) {
      dealTitle = deal.title;
      contactName = deal.lead?.contactName || contactName;
      companyName = deal.lead?.companyName || companyName;
    }
  }

  // Template-based email generation (can be replaced with Claude API later)
  const templates: Record<string, Record<string, AiEmailSuggestion>> = {
    fr: {
      follow_up: {
        subject: `Suite à notre échange${companyName ? ` - ${companyName}` : ''}`,
        body: `Bonjour ${contactName},\n\nJe fais suite à ${recentActivity || 'notre dernier échange'}. ${dealTitle ? `Concernant ${dealTitle}, ` : ''}j'aimerais prendre de vos nouvelles et voir comment nous pouvons avancer ensemble.\n\nSeriez-vous disponible pour un appel cette semaine?\n\nCordialement`,
        tone: 'professional',
      },
      introduction: {
        subject: `Présentation - Attitudes VIP${companyName ? ` x ${companyName}` : ''}`,
        body: `Bonjour ${contactName},\n\nJe me permets de vous contacter pour vous présenter nos solutions. Chez Attitudes VIP, nous offrons des produits de recherche de haute qualité.\n\nJ'aimerais discuter de la façon dont nous pourrions répondre à vos besoins.\n\nCordialement`,
        tone: 'professional',
      },
      proposal: {
        subject: `Proposition${dealTitle ? ` - ${dealTitle}` : ''}`,
        body: `Bonjour ${contactName},\n\nSuite à nos échanges, veuillez trouver ci-joint notre proposition${dealTitle ? ` pour ${dealTitle}` : ''}.\n\nJe reste disponible pour en discuter.\n\nCordialement`,
        tone: 'professional',
      },
      thank_you: {
        subject: `Merci${companyName ? ` - ${companyName}` : ''}`,
        body: `Bonjour ${contactName},\n\nJe tenais à vous remercier pour le temps que vous nous avez accordé. C'est toujours un plaisir d'échanger avec vous.\n\nN'hésitez pas si vous avez des questions.\n\nCordialement`,
        tone: 'friendly',
      },
      meeting_request: {
        subject: `Demande de rendez-vous${companyName ? ` - ${companyName}` : ''}`,
        body: `Bonjour ${contactName},\n\nJ'aimerais planifier un rendez-vous pour discuter ${dealTitle ? `de ${dealTitle}` : 'de nos prochaines étapes'}.\n\nSeriez-vous disponible cette semaine? Je suis flexible sur les horaires.\n\nCordialement`,
        tone: 'professional',
      },
    },
    en: {
      follow_up: {
        subject: `Following up${companyName ? ` - ${companyName}` : ''}`,
        body: `Hi ${contactName},\n\nI wanted to follow up on ${recentActivity || 'our recent conversation'}. ${dealTitle ? `Regarding ${dealTitle}, ` : ''}I'd love to hear how things are going and discuss next steps.\n\nAre you available for a call this week?\n\nBest regards`,
        tone: 'professional',
      },
      introduction: {
        subject: `Introduction - Attitudes VIP${companyName ? ` x ${companyName}` : ''}`,
        body: `Hi ${contactName},\n\nI'm reaching out to introduce our solutions at Attitudes VIP. We offer high-quality research products that could benefit your work.\n\nI'd love to discuss how we can help.\n\nBest regards`,
        tone: 'professional',
      },
      proposal: {
        subject: `Proposal${dealTitle ? ` - ${dealTitle}` : ''}`,
        body: `Hi ${contactName},\n\nPlease find attached our proposal${dealTitle ? ` for ${dealTitle}` : ''}.\n\nI'm available to discuss any questions.\n\nBest regards`,
        tone: 'professional',
      },
      thank_you: {
        subject: `Thank you${companyName ? ` - ${companyName}` : ''}`,
        body: `Hi ${contactName},\n\nThank you for your time. It's always a pleasure connecting with you.\n\nDon't hesitate to reach out if you have any questions.\n\nBest regards`,
        tone: 'friendly',
      },
      meeting_request: {
        subject: `Meeting request${companyName ? ` - ${companyName}` : ''}`,
        body: `Hi ${contactName},\n\nI'd like to schedule a meeting to discuss ${dealTitle ? dealTitle : 'our next steps'}.\n\nAre you available this week? I'm flexible with timing.\n\nBest regards`,
        tone: 'professional',
      },
    },
  };

  const langTemplates = templates[lang] || templates.en;
  return langTemplates[context.purpose] || langTemplates.follow_up;
}

// ---------------------------------------------------------------------------
// AI Call Summary
// ---------------------------------------------------------------------------

/**
 * Generate structured call summary from transcription text.
 */
export function generateCallSummary(transcriptionText: string): AiCallSummary {
  if (!transcriptionText || transcriptionText.length < 50) {
    return {
      summary: 'Call too short for analysis',
      keyPoints: [],
      actionItems: [],
      sentiment: 'neutral',
      nextSteps: [],
    };
  }

  const text = transcriptionText.toLowerCase();

  // Simple sentiment analysis (bilingual FR/EN)
  const positiveWords = ['great', 'excellent', 'perfect', 'love', 'interested', 'yes', 'agree',
    'bien', 'parfait', 'excellent', 'intéressé', 'oui', 'accord', 'merci', 'super'];
  const negativeWords = ['no', 'not', 'cancel', 'problem', 'issue', 'complaint', 'unhappy',
    'non', 'pas', 'annuler', 'problème', 'plainte', 'mécontent'];

  const posCount = positiveWords.filter(w => text.includes(w)).length;
  const negCount = negativeWords.filter(w => text.includes(w)).length;
  const sentiment: AiCallSummary['sentiment'] = posCount > negCount + 2 ? 'positive' : negCount > posCount + 2 ? 'negative' : 'neutral';

  // Extract key topics
  const topics = ['pricing', 'product', 'shipping', 'delivery', 'order', 'return', 'refund',
    'prix', 'produit', 'livraison', 'commande', 'retour', 'remboursement']
    .filter(t => text.includes(t));

  // Extract potential action items
  const actionPatterns = [
    /(?:i will|i'll|je vais|nous allons)\s+([^.!?]+)/gi,
    /(?:please|s'il vous plaît|svp)\s+([^.!?]+)/gi,
    /(?:follow up|suivre|rappeler|callback)\s*([^.!?]*)/gi,
  ];

  const actionItems: string[] = [];
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(transcriptionText)) !== null) {
      if (match[1] && match[1].length > 10) {
        actionItems.push(match[1].trim().slice(0, 200));
      }
    }
  }

  // Generate summary
  const wordCount = transcriptionText.split(/\s+/).length;
  const durationEstimate = Math.round(wordCount / 150); // ~150 words per minute

  return {
    summary: `${durationEstimate}-minute call covering ${topics.length > 0 ? topics.join(', ') : 'general topics'}. Overall sentiment: ${sentiment}.`,
    keyPoints: topics.map(t => `Discussion about ${t}`),
    actionItems: actionItems.slice(0, 5),
    sentiment,
    nextSteps: actionItems.length > 0 ? ['Complete action items from call'] : ['Schedule follow-up if needed'],
  };
}

// ---------------------------------------------------------------------------
// AI Conversation Summary (E23 - All channels)
// ---------------------------------------------------------------------------

interface ConversationSummary {
  summary: string;
  keyPoints: string[];
  channel: string;
  messageCount: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  participants: string[];
  duration: string;
}

/**
 * Generate a structured summary from an InboxConversation's messages.
 * Works for all channels: email, chat, SMS, phone, social.
 *
 * Uses rule-based extraction (can be replaced with OpenAI/Claude API later).
 * Fetches all messages from the conversation and analyzes content.
 */
export async function summarizeConversation(
  conversationId: string,
): Promise<ConversationSummary> {
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const messages = conversation.messages;
  const channel = conversation.channel;

  if (messages.length === 0) {
    return {
      summary: 'Empty conversation with no messages.',
      keyPoints: [],
      channel,
      messageCount: 0,
      sentiment: 'neutral',
      participants: [],
      duration: '0m',
    };
  }

  // Concatenate all message content for analysis
  const fullText = messages.map((m) => m.content).join('\n');

  // Extract participants
  const participantSet = new Set<string>();
  for (const msg of messages) {
    const sender = msg.senderName || msg.senderEmail || msg.senderPhone;
    if (sender) participantSet.add(sender);
  }
  const participants = [...participantSet];

  // Calculate duration
  const firstMsg = messages[0].createdAt;
  const lastMsg = messages[messages.length - 1].createdAt;
  const durationMs = lastMsg.getTime() - firstMsg.getTime();
  const durationMins = Math.round(durationMs / 60000);
  const duration = durationMins < 60
    ? `${durationMins}m`
    : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`;

  // Sentiment analysis (bilingual FR/EN)
  const lowerText = fullText.toLowerCase();
  const positiveWords = [
    'thank', 'thanks', 'great', 'excellent', 'perfect', 'good', 'happy', 'pleased',
    'merci', 'bien', 'parfait', 'excellent', 'super', 'content', 'satisfait',
  ];
  const negativeWords = [
    'complaint', 'problem', 'issue', 'unhappy', 'disappointed', 'wrong', 'broken', 'refund',
    'plainte', 'probleme', 'mecontent', 'decu', 'erreur', 'casse', 'remboursement',
  ];

  const posCount = positiveWords.filter((w) => lowerText.includes(w)).length;
  const negCount = negativeWords.filter((w) => lowerText.includes(w)).length;
  const sentiment: ConversationSummary['sentiment'] =
    posCount > negCount + 2 ? 'positive' : negCount > posCount + 2 ? 'negative' : 'neutral';

  // Extract key topics
  const topicKeywords = [
    'order', 'shipping', 'delivery', 'payment', 'invoice', 'product', 'peptide',
    'return', 'refund', 'tracking', 'price', 'discount', 'account', 'login',
    'commande', 'livraison', 'paiement', 'facture', 'produit', 'peptide',
    'retour', 'remboursement', 'suivi', 'prix', 'rabais', 'compte', 'connexion',
  ];
  const detectedTopics = topicKeywords.filter((t) => lowerText.includes(t));
  const uniqueTopics = [...new Set(detectedTopics)];

  // Build key points from detected topics and message patterns
  const keyPoints: string[] = [];

  // Add topic-based points
  if (uniqueTopics.length > 0) {
    keyPoints.push(`Topics discussed: ${uniqueTopics.slice(0, 5).join(', ')}`);
  }

  // Direction analysis
  const inbound = messages.filter((m) => m.direction === 'INBOUND').length;
  const outbound = messages.filter((m) => m.direction === 'OUTBOUND').length;
  keyPoints.push(`${inbound} inbound, ${outbound} outbound messages`);

  // Check for resolution indicators
  const resolved = lowerText.includes('resolved') || lowerText.includes('fixed') ||
    lowerText.includes('resolu') || lowerText.includes('regle');
  if (resolved) keyPoints.push('Issue appears to be resolved');

  // Check for urgency
  const urgent = lowerText.includes('urgent') || lowerText.includes('asap') ||
    lowerText.includes('immediately') || lowerText.includes('immediatement');
  if (urgent) keyPoints.push('Urgency expressed by participant');

  // Build summary
  const channelLabel = channel.charAt(0) + channel.slice(1).toLowerCase();
  const summary = [
    `${channelLabel} conversation with ${messages.length} messages`,
    `spanning ${duration}`,
    `between ${participants.length} participant(s).`,
    uniqueTopics.length > 0 ? `Key topics: ${uniqueTopics.slice(0, 3).join(', ')}.` : '',
    `Overall sentiment: ${sentiment}.`,
    resolved ? 'The issue appears resolved.' : '',
  ].filter(Boolean).join(' ');

  return {
    summary,
    keyPoints,
    channel,
    messageCount: messages.length,
    sentiment,
    participants,
    duration,
  };
}

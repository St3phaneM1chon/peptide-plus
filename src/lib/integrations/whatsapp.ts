/**
 * WhatsApp Business API Integration - BioCycle Peptides
 * Used for: order notifications, customer support, marketing messages
 */

import { prisma } from '@/lib/db';

export interface WhatsAppConfig {
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  apiVersion: string;
}

let _config: WhatsAppConfig | null = null;

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  if (_config) return _config;

  const settings = await prisma.siteSetting.findMany({
    where: { module: 'integrations', key: { startsWith: 'whatsapp.' } },
  });

  const get = (key: string) => settings.find(s => s.key === `whatsapp.${key}`)?.value || '';

  _config = {
    enabled: get('enabled') === 'true',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || get('phone_number_id'),
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || get('business_account_id'),
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    apiVersion: 'v21.0',
  };
  return _config;
}

export function clearWhatsAppConfigCache() {
  _config = null;
}

async function callWhatsAppAPI(endpoint: string, method = 'GET', body?: unknown) {
  const config = await getWhatsAppConfig();
  if (!config.accessToken) throw new Error('WhatsApp access token not configured');

  const url = `https://graph.facebook.com/${config.apiVersion}/${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`WhatsApp API error: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function testWhatsAppConnection(): Promise<{ success: boolean; phone?: string; error?: string }> {
  try {
    const config = await getWhatsAppConfig();
    if (!config.phoneNumberId) return { success: false, error: 'Phone Number ID not configured' };

    const data = await callWhatsAppAPI(`${config.phoneNumberId}`);
    return { success: true, phone: data.display_phone_number || data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendTextMessage(to: string, message: string) {
  const config = await getWhatsAppConfig();
  return callWhatsAppAPI(`${config.phoneNumberId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  });
}

export async function sendTemplateMessage(to: string, templateName: string, languageCode = 'en', components?: unknown[]) {
  const config = await getWhatsAppConfig();
  return callWhatsAppAPI(`${config.phoneNumberId}/messages`, 'POST', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components ? { components } : {}),
    },
  });
}

export async function listTemplates() {
  const config = await getWhatsAppConfig();
  if (!config.businessAccountId) throw new Error('Business Account ID not configured');
  return callWhatsAppAPI(`${config.businessAccountId}/message_templates?limit=20`);
}

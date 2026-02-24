/**
 * AZURE KEY VAULT - Gestion des Secrets
 * Conforme Chubb - Ne jamais stocker de secrets dans le code
 */

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { logger } from '@/lib/logger';

// Singleton pour le client Key Vault
let secretClient: SecretClient | null = null;

/**
 * Initialise le client Azure Key Vault
 */
function getSecretClient(): SecretClient {
  if (secretClient) {
    return secretClient;
  }

  const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL;
  
  if (!keyVaultUrl) {
    throw new Error('AZURE_KEY_VAULT_URL not configured');
  }

  // DefaultAzureCredential essaie plusieurs méthodes d'authentification:
  // 1. Variables d'environnement (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)
  // 2. Managed Identity (en production sur Azure)
  // 3. Azure CLI (en développement)
  // 4. Visual Studio Code credentials
  const credential = new DefaultAzureCredential();
  
  secretClient = new SecretClient(keyVaultUrl, credential);
  
  return secretClient;
}

/**
 * Récupère un secret depuis Azure Key Vault
 */
export async function getSecret(secretName: string): Promise<string> {
  try {
    const client = getSecretClient();
    const secret = await client.getSecret(secretName);
    
    if (!secret.value) {
      throw new Error(`Secret '${secretName}' is empty`);
    }
    
    return secret.value;
  } catch (error) {
    logger.error('Error retrieving secret', { secretName, error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to retrieve secret: ${secretName}`);
  }
}

/**
 * Stocke un secret dans Azure Key Vault
 */
export async function setSecret(
  secretName: string,
  secretValue: string,
  options?: {
    expiresOn?: Date;
    contentType?: string;
    tags?: Record<string, string>;
  }
): Promise<void> {
  try {
    const client = getSecretClient();
    
    await client.setSecret(secretName, secretValue, {
      expiresOn: options?.expiresOn,
      contentType: options?.contentType || 'text/plain',
      tags: options?.tags,
    });
    
    logger.info('Secret stored successfully', { secretName });
  } catch (error) {
    logger.error('Error storing secret', { secretName, error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to store secret: ${secretName}`);
  }
}

/**
 * Supprime un secret (soft delete)
 */
export async function deleteSecret(secretName: string): Promise<void> {
  try {
    const client = getSecretClient();
    const poller = await client.beginDeleteSecret(secretName);
    await poller.pollUntilDone();
    
    logger.info('Secret deleted successfully', { secretName });
  } catch (error) {
    logger.error('Error deleting secret', { secretName, error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to delete secret: ${secretName}`);
  }
}

/**
 * Liste tous les secrets (noms uniquement, pas les valeurs)
 */
export async function listSecrets(): Promise<string[]> {
  try {
    const client = getSecretClient();
    const secrets: string[] = [];
    
    for await (const secretProperties of client.listPropertiesOfSecrets()) {
      if (secretProperties.name) {
        secrets.push(secretProperties.name);
      }
    }
    
    return secrets;
  } catch (error) {
    logger.error('Error listing secrets', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to list secrets');
  }
}

/**
 * Cache local pour les secrets (évite les appels répétés)
 */
const secretCache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère un secret avec cache local
 */
export async function getSecretCached(secretName: string): Promise<string> {
  const cached = secretCache.get(secretName);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }
  
  const value = await getSecret(secretName);
  
  secretCache.set(secretName, {
    value,
    expiry: Date.now() + CACHE_TTL,
  });
  
  return value;
}

/**
 * Invalide le cache pour un secret
 */
export function invalidateSecretCache(secretName: string): void {
  secretCache.delete(secretName);
}

/**
 * Invalide tout le cache
 */
export function invalidateAllSecretCache(): void {
  secretCache.clear();
}

// ============================================
// HELPER POUR CONFIGURATION
// ============================================

/**
 * Charge la configuration depuis Key Vault
 * Utile pour initialiser l'application avec des secrets
 */
export async function loadConfigFromKeyVault(secretNames: string[]): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  
  await Promise.all(
    secretNames.map(async (name) => {
      try {
        config[name] = await getSecretCached(name);
      } catch (error) {
        logger.warn('Failed to load secret, using fallback', { secretName: name });
      }
    })
  );
  
  return config;
}

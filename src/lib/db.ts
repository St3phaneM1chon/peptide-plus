/**
 * DATABASE CLIENT - Prisma
 * Singleton pattern pour éviter les connexions multiples
 * Connection pool configured for production performance
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Build the datasource URL with connection pool parameters.
 * Uses DATABASE_URL from env, appending pool settings if not already present.
 * - connection_limit: Max connections in the pool (default 10)
 * - pool_timeout: Seconds to wait for a connection before erroring (default 30)
 */
function getDatasourceUrl(): string | undefined {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) return undefined;

  // Don't append if pool params are already configured in the URL
  if (baseUrl.includes('connection_limit') || baseUrl.includes('pool_timeout')) {
    return baseUrl;
  }

  const separator = baseUrl.includes('?') ? '&' : '?';
  const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT || '10';
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT || '30';

  return `${baseUrl}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: getDatasourceUrl(),
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** @deprecated Use 'prisma' instead. This alias is kept for backward compatibility. */
export const db = prisma;

export default prisma;

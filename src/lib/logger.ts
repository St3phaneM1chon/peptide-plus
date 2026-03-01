/**
 * STRUCTURED LOGGER - Winston
 * Provides JSON logging in production, colorized output in development.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Something happened', { userId: '123', action: 'login' });
 *   logger.error('Payment failed', { orderId, error: err.message });
 *
 * Log levels (npm convention):
 *   error (0) > warn (1) > info (2) > http (3) > debug (4)
 */

import winston from 'winston';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/**
 * Human-readable format for development console output.
 */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${ts} ${level}: ${message}${metaStr}${stackStr}`;
  }),
);

/**
 * Structured JSON format for production (machine-parseable).
 */
const prodFormat = combine(
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  errors({ stack: true }),
  json(),
);

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const isProduction = process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
  // Console: always active
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
  }),
];

// File transport for errors in production
// NOTE: With WEBSITE_RUN_FROM_PACKAGE=1 on Azure, wwwroot is read-only.
// Default to /tmp/logs which is always writable, or /home/LogFiles/app if available.
if (isProduction) {
  const logDir = process.env.LOG_DIR || '/tmp/logs';
  try {
    fs.mkdirSync(logDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: prodFormat,
        maxsize: 10 * 1024 * 1024, // 10 MB
        maxFiles: 5,
        tailable: true,
      }),
    );
  } catch {
    // If directory creation fails (read-only FS), skip file transport.
    // Console transport will still capture all logs.
  }
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  levels: winston.config.npm.levels,
  defaultMeta: {
    service: 'peptide-plus',
    env: process.env.NODE_ENV || 'development',
  },
  transports,
  // Do not exit on uncaught exceptions; let the process handler deal with it
  exitOnError: false,
});

// ---------------------------------------------------------------------------
// Request logger middleware for API routes
// ---------------------------------------------------------------------------

type ApiHandler = (
  request: NextRequest,
  context?: unknown,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js API route handler to log incoming requests and responses.
 *
 * Usage:
 *   import { requestLogger } from '@/lib/logger';
 *
 *   async function handler(req: NextRequest) { ... }
 *   export const GET = requestLogger(handler);
 *
 * TODO (P1-13): This middleware is defined but not yet applied to any route.
 * To enable request/response logging globally, wrap individual route handlers
 * with requestLogger(), or integrate it into the Next.js middleware at
 * src/middleware.ts for blanket coverage on all /api/* routes.
 */
export function requestLogger(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: unknown) => {
    const start = Date.now();
    const method = request.method;
    const url = request.nextUrl.pathname;

    logger.http('Incoming request', {
      method,
      url,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    try {
      const response = await handler(request, context);
      const duration = Date.now() - start;

      logger.http('Request completed', {
        method,
        url,
        status: response.status,
        durationMs: duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      logger.error('Request failed with unhandled error', {
        method,
        url,
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  };
}

export default logger;

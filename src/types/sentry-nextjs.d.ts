declare module '@sentry/nextjs' {
  export function init(options: Record<string, unknown>): void;
  export function captureException(error: unknown, context?: Record<string, unknown>): string;
  export function captureMessage(message: string, level?: string): string;
  export function setUser(user: { id?: string; email?: string } | null): void;
  export function setTag(key: string, value: string): void;
  export function setContext(name: string, context: Record<string, unknown> | null): void;
  export function startSpan<T>(options: Record<string, unknown>, callback: () => T): T;
  export function withScope(callback: (scope: unknown) => void): void;
  export function addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  export function prismaIntegration(): unknown;
  export const Integrations: Record<string, unknown>;
}

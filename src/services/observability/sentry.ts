import * as Sentry from '@sentry/react-native';

import type { AppEnv } from '@/config/env';

import { scrubEvent, scrubValue } from './scrub';

let initialized = false;

export interface ObservabilityOptions {
  /** Defaults to false for development builds; preview/production report when a DSN is set. */
  enableInDevelopment?: boolean;
}

export function shouldEnableObservability(
  env: AppEnv,
  options: ObservabilityOptions = {},
): boolean {
  if (!env.sentryDsn) return false;
  if (process.env.JEST_WORKER_ID !== undefined) return false;
  if (env.appVariant === 'development') return options.enableInDevelopment === true;
  return true;
}

/** Environment-aware Sentry initialisation. Safe to call more than once. */
export function initObservability(env: AppEnv, options: ObservabilityOptions = {}): void {
  if (initialized || !shouldEnableObservability(env, options)) return;

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appVariant,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: env.appVariant === 'production' ? 0.1 : 1.0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubValue(breadcrumb) as typeof breadcrumb,
  });
  initialized = true;
}

export function isObservabilityEnabled(): boolean {
  return initialized;
}

export type ErrorContext = Record<string, string | number | boolean>;

/** Report a handled error. Never pass user content (messages, bios, emails) in context. */
export function captureError(error: unknown, context?: ErrorContext): void {
  if (!initialized) {
    if (__DEV__ && process.env.JEST_WORKER_ID === undefined) {
      console.error('[observability]', error, context ?? '');
    }
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Root component wrapper (touch/performance instrumentation). No-op cost when not initialised. */
export const wrapRootComponent = Sentry.wrap;

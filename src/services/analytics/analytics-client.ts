import type { AnalyticsEventMapBase, AnalyticsProperties } from './events';

/** Minimal transport contract, implemented by PostHog in production and fakes in tests. */
export interface AnalyticsTransport {
  capture(event: string, properties?: AnalyticsProperties): void;
  identify(distinctId: string): void;
  reset(): void;
}

export interface AnalyticsClient<TEvents extends AnalyticsEventMapBase> {
  readonly enabled: boolean;
  track<TName extends keyof TEvents & string>(name: TName, properties: TEvents[TName]): void;
  /** Identify with the opaque Supabase user UUID only — never an email or phone number. */
  identify(userId: string): void;
  reset(): void;
}

const EMAIL_LIKE = /@|%40/;
const PHONE_LIKE = /^\+?[0-9\s\-()]{7,}$/;

export class AnalyticsIdentityError extends Error {
  constructor() {
    super('Analytics identity must be an opaque user id, not an email address or phone number.');
    this.name = 'AnalyticsIdentityError';
  }
}

export function assertOpaqueIdentity(userId: string): void {
  if (!userId.trim() || EMAIL_LIKE.test(userId) || PHONE_LIKE.test(userId)) {
    throw new AnalyticsIdentityError();
  }
}

export function createAnalyticsClient<TEvents extends AnalyticsEventMapBase>(
  transport: AnalyticsTransport | null,
): AnalyticsClient<TEvents> {
  return {
    enabled: transport !== null,
    track(name, properties) {
      transport?.capture(name, properties);
    },
    identify(userId) {
      assertOpaqueIdentity(userId);
      transport?.identify(userId);
    },
    reset() {
      transport?.reset();
    },
  };
}

/**
 * Typed analytics event catalogue.
 *
 * Phase 0M intentionally defines no product events. Add events here (Phase 7M per roadmap) as
 * `event_name: { prop: type }`, e.g. `trip_created: { market_id: string }`.
 * Never include message text, bios, emails, phone numbers, exact locations or photos.
 */
export type AnalyticsPropertyValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;
export type AnalyticsEventMapBase = Record<string, AnalyticsProperties>;

/** Deliberately empty until product events are defined. */
export type AnalyticsEventMap = Record<never, AnalyticsProperties>;

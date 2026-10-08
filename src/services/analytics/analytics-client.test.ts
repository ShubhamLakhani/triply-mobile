import {
  AnalyticsIdentityError,
  createAnalyticsClient,
  type AnalyticsTransport,
} from './analytics-client';

type TestEvents = {
  test_event: { count: number; source: string };
};

function fakeTransport() {
  const calls: { method: string; args: unknown[] }[] = [];
  const transport: AnalyticsTransport = {
    capture: (...args) => calls.push({ method: 'capture', args }),
    identify: (...args) => calls.push({ method: 'identify', args }),
    reset: () => calls.push({ method: 'reset', args: [] }),
  };
  return { transport, calls };
}

describe('analytics client', () => {
  it('forwards typed events to the transport', () => {
    const { transport, calls } = fakeTransport();
    const analytics = createAnalyticsClient<TestEvents>(transport);
    analytics.track('test_event', { count: 2, source: 'unit' });
    expect(analytics.enabled).toBe(true);
    expect(calls).toEqual([
      { method: 'capture', args: ['test_event', { count: 2, source: 'unit' }] },
    ]);
  });

  it('is a safe no-op when analytics is disabled', () => {
    const analytics = createAnalyticsClient<TestEvents>(null);
    expect(analytics.enabled).toBe(false);
    expect(() => analytics.track('test_event', { count: 1, source: 'unit' })).not.toThrow();
  });

  it('refuses email or phone numbers as analytics identity', () => {
    const { transport, calls } = fakeTransport();
    const analytics = createAnalyticsClient<TestEvents>(transport);
    expect(() => analytics.identify('traveler@example.com')).toThrow(AnalyticsIdentityError);
    expect(() => analytics.identify('+44 7700 900123')).toThrow(AnalyticsIdentityError);
    analytics.identify('5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c');
    expect(calls).toEqual([{ method: 'identify', args: ['5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c'] }]);
  });
});

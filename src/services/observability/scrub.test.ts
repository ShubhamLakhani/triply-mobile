import { scrubEvent, scrubString } from './scrub';

describe('observability scrubbing', () => {
  it('redacts emails, bearer tokens, JWTs and Supabase keys', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';
    const input = `user traveler@example.com auth Bearer abc.def key sb_publishable_xyz jwt ${jwt}`;
    const output = scrubString(input);
    expect(output).not.toContain('traveler@example.com');
    expect(output).not.toContain('abc.def');
    expect(output).not.toContain('sb_publishable_xyz');
    expect(output).not.toContain(jwt);
  });

  it('keeps the query parameter name but redacts token values in URLs', () => {
    expect(scrubString('triply://auth/callback?code=secret123&next=/discover')).toBe(
      'triply://auth/callback?code=[redacted]&next=/discover',
    );
  });

  it('strips user fields except the opaque id and drops request data', () => {
    const event = scrubEvent({
      message: 'Failed for traveler@example.com',
      user: { id: 'f3b0c6d2', email: 'traveler@example.com', ip_address: '1.2.3.4' },
      request: { headers: { Authorization: 'Bearer abc' } },
      extra: { token: 'abc', screen: 'discover' },
    });
    expect(event.user).toEqual({ id: 'f3b0c6d2' });
    expect(event.request).toBeUndefined();
    expect(event.message).toBe('Failed for [redacted]');
    expect(event.extra).toEqual({ token: '[redacted]', screen: 'discover' });
  });
});

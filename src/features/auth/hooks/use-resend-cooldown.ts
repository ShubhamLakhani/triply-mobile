import { useEffect, useState } from 'react';

/** Seconds between code emails (Supabase Auth `max_frequency`: 60 s locally and hosted). */
export const CODE_RESEND_COOLDOWN_S = 60;

/** Whole seconds until another code may be requested after one was sent at `sentAt`. */
export function cooldownSecondsLeft(sentAt: number | null, now = Date.now()): number {
  if (sentAt === null) return 0;
  const left = Math.ceil((sentAt + CODE_RESEND_COOLDOWN_S * 1000 - now) / 1000);
  return Math.min(CODE_RESEND_COOLDOWN_S, Math.max(0, left));
}

/** Live countdown: re-renders once a second until another code may be requested. */
export function useResendCooldown(sentAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (sentAt === null) return undefined;
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (cooldownSecondsLeft(sentAt, tick) === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);

  // A send newer than the last tick reads as the full cooldown until the next tick.
  return cooldownSecondsLeft(sentAt, Math.max(now, sentAt ?? now));
}

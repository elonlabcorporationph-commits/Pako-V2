/** Checkout limits per visitor: at most 3 orders in 10 minutes and 10 per day. */
export const PAY_LIMITS = [{ windowMs: 10 * 60_000, max: 3 }, { windowMs: 24 * 60 * 60_000, max: 10 }] as const;
export function isRateLimited(recentCreatedAt: number[], now = Date.now()) {
  return PAY_LIMITS.some(({ windowMs, max }) => recentCreatedAt.filter((t) => now - t < windowMs).length >= max);
}

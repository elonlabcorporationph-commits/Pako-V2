export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_ORDER_PRICES = { basic: 99, premium: 149 } as const;

export function canGenerateOrder(status: string, verifiedAt: string | null) {
  return Boolean(verifiedAt) && ["payment_verified", "processing", "failed"].includes(status);
}

export function orderExpiryDate(now = Date.now(), days = DEFAULT_RETENTION_DAYS) {
  const safeDays = Math.min(365, Math.max(1, Math.trunc(days)));
  return new Date(now + safeDays * 86_400_000);
}
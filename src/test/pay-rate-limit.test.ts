import { describe, expect, it } from "vitest";
import { isRateLimited } from "@/lib/pay-rate-limit";
const now = 1_000_000_000_000;
describe("checkout rate limit", () => {
  it("allows the 3rd order within 10 minutes", () => { expect(isRateLimited([now - 60_000, now - 120_000], now)).toBe(false); });
  it("blocks a 4th order within 10 minutes", () => { expect(isRateLimited([now - 1, now - 2, now - 3], now)).toBe(true); });
  it("allows again after 10 minutes pass", () => { expect(isRateLimited([now - 11 * 60_000, now - 12 * 60_000, now - 13 * 60_000], now)).toBe(false); });
  it("blocks the 11th order in a day", () => { expect(isRateLimited(Array.from({ length: 10 }, (_, i) => now - (i + 1) * 3_600_000), now)).toBe(true); });
});

import { describe, expect, it } from "vitest";
import { canGenerateOrder, DEFAULT_ORDER_PRICES, DEFAULT_RETENTION_DAYS, orderExpiryDate } from "@/lib/order-policy";
import { filmstripLayout, SLIDESHOW_WIDTH, SLIDESHOW_HEIGHT, SLIDESHOW_PHOTO_SECONDS, SLIDESHOW_DURATION_SECONDS } from "@/lib/slideshow-video";

describe("Pasko order rules", () => {
  it("assembles five photos into a 9:16 portrait video", () => {
    expect(SLIDESHOW_WIDTH).toBe(720);
    expect(SLIDESHOW_HEIGHT).toBe(1280);
    expect(SLIDESHOW_WIDTH / SLIDESHOW_HEIGHT).toBe(9 / 16);
    expect(SLIDESHOW_PHOTO_SECONDS).toBe(6);
    expect(SLIDESHOW_DURATION_SECONDS).toBe(30);
  });
  it("uses 9:16 portrait photo frames", () => {
    const frame = filmstripLayout(0, 5);
    expect(frame.photoWidth / frame.photoHeight).toBe(9 / 16);
  });
  it("scrolls horizontally through five photos and loops after 30 seconds", () => {
    const start = filmstripLayout(0, 5);
    const next = filmstripLayout(6, 5);
    expect(next.offsetX).toBe(-start.pitch);
    expect(next.photoY).toBe(start.photoY);
    expect(filmstripLayout(30, 5).offsetX).toBe(0);
  });
  it("keeps the original Basic and music package prices", () => {
    expect(DEFAULT_ORDER_PRICES).toEqual({ basic: 99, premium: 149 });
  });

  it("keeps the default photo retention period at 30 days", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(30);
    expect(orderExpiryDate(Date.UTC(2026, 0, 1)).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("requires verified payment before a photo can be generated", () => {
    expect(canGenerateOrder("pending_payment", null)).toBe(false);
    expect(canGenerateOrder("processing", null)).toBe(false);
    expect(canGenerateOrder("payment_verified", "2026-01-01T00:00:00.000Z")).toBe(true);
  });

  it("blocks photo creation while payment awaits verification or was rejected", () => {
    expect(canGenerateOrder("pending_verification", null)).toBe(false);
    expect(canGenerateOrder("rejected", null)).toBe(false);
  });
});
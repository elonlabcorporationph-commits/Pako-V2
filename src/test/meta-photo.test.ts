import { describe, expect, it, vi, afterEach } from "vitest";
import { META_STYLE_IDS, META_STYLE_INDEX, metaPhotoPrompt } from "@/lib/meta-photo-styles";
import { generateMetaPhoto, renderMetaOnce } from "@/server/ai.server";
import { renderWithFallback } from "@/lib/render-outcome";
import { canGenerateOrder } from "@/lib/order-policy";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Meta Muse Christmas edits", () => {
  for (const style of META_STYLE_IDS) it(`preserves identity for ${style}`, () => {
    expect(metaPhotoPrompt(style)).toContain("keep the exact same person's face, identity, hairstyle and smile, photorealistic");
  });
  it("maps Snow to the existing order slot", () => { expect(META_STYLE_INDEX.snow).toBe(2); });
  it("requires verification before paid generation", () => { expect(canGenerateOrder("pending_verification", null)).toBe(false); expect(canGenerateOrder("payment_verified", "2026-11-12T04:36:00Z")).toBe(true); });
  it("sends the uploaded image with Muse PNG edit parameters", async () => {
    vi.stubEnv("MODEL_API_KEY", "test-only-key");
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] })));
    vi.stubGlobal("fetch", request);
    expect(await generateMetaPhoto("data:image/jpeg;base64,aGVsbG8=", "snow", 0)).toBe("aGVsbG8=");
    const [url, options] = request.mock.calls[0] ?? [];
    expect(url).toBe("https://api.meta.ai/v1/images/edits");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("muse-image-1.0"); expect(body.output_format).toBe("png"); expect(body.n).toBe(1);
    expect(body.images).toEqual([{ image_url: "data:image/jpeg;base64,aGVsbG8=" }]);
  });
  const fail = (status: number) => new Response("sensitive upstream body", { status });
  it("maps 404 to the endpoint/access message", async () => {
    vi.stubEnv("MODEL_API_KEY", "k"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(404)));
    expect(await renderMetaOnce("data:image/png;base64,aGVsbG8=", "snow")).toMatchObject({ ok: false, retryable: true, message: "Image service not found. Check Muse Image endpoint / access." });
  });
  it("maps 401 and 403 to the key/access message without retry", async () => {
    vi.stubEnv("MODEL_API_KEY", "k");
    for (const status of [401, 403]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(status)));
      expect(await renderMetaOnce("data:image/png;base64,aGVsbG8=", "snow")).toMatchObject({ ok: false, retryable: false, message: "Image API key invalid or no access." });
    }
  });
  it("maps 429 to the wait-30-seconds message", async () => {
    vi.stubEnv("MODEL_API_KEY", "k"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(429)));
    expect(await renderMetaOnce("data:image/png;base64,aGVsbG8=", "snow")).toMatchObject({ ok: false, retryable: false, message: "Too many requests, please wait 30 seconds." });
  });
  it("maps 500 to the generic retry message", async () => {
    vi.stubEnv("MODEL_API_KEY", "k"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fail(500)));
    expect(await renderMetaOnce("data:image/png;base64,aGVsbG8=", "snow")).toMatchObject({ ok: false, retryable: true, message: "Generation failed, please try again." });
  });
  it("reports a missing MODEL_API_KEY clearly", async () => {
    vi.stubEnv("MODEL_API_KEY", "");
    expect(await renderMetaOnce("data:image/png;base64,aGVsbG8=", "snow")).toMatchObject({ ok: false, message: "MODEL_API_KEY is missing in Cloud Secrets." });
  });
  it("retries Meta once after a 404, then uses the fallback provider", async () => {
    vi.stubEnv("MODEL_API_KEY", "k"); vi.stubEnv("LOVABLE_API_KEY", "g");
    const request = vi.fn()
      .mockResolvedValueOnce(fail(404)).mockResolvedValueOnce(fail(404))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ b64_json: "ZmFsbGJhY2s=" }] })));
    vi.stubGlobal("fetch", request);
    expect(await generateMetaPhoto("data:image/png;base64,aGVsbG8=", "snow", 0)).toBe("ZmFsbGJhY2s=");
    expect(request.mock.calls.map(([url]) => url)).toEqual(["https://api.meta.ai/v1/images/edits", "https://api.meta.ai/v1/images/edits", "https://ai.gateway.lovable.dev/v1/images/edits"]);
  });
  it("does not fall back on 401", async () => {
    vi.stubEnv("MODEL_API_KEY", "k"); vi.stubEnv("LOVABLE_API_KEY", "g");
    const request = vi.fn().mockResolvedValue(fail(401)); vi.stubGlobal("fetch", request);
    await expect(generateMetaPhoto("data:image/png;base64,aGVsbG8=", "snow", 0)).rejects.toThrow("Image API key invalid or no access.");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("reports Retrying and Using fallback stages in order", async () => {
    const stages: string[] = [];
    const attempt = vi.fn()
      .mockResolvedValueOnce({ ok: false, retryable: true, status: 404, message: "x" })
      .mockResolvedValueOnce({ ok: false, retryable: true, status: 404, message: "x" })
      .mockResolvedValueOnce({ ok: true, image: "img", provider: "fallback" });
    expect(await renderWithFallback(attempt, s => stages.push(s), 0)).toEqual({ image: "img", provider: "fallback" });
    expect(stages).toEqual(["generating", "retrying", "fallback", "done"]);
    expect(attempt.mock.calls.map(([p]) => p)).toEqual(["meta", "meta", "fallback"]);
  });
});

import { META_STYLE_POSES as POSES } from "@/lib/meta-photo-styles";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("style poses", () => {
  i2("every style asks for a different pose", () => {
    const poses = Object.values(POSES);
    e2(poses).toHaveLength(5);
    e2(new Set(poses).size).toBe(5);
  });
});

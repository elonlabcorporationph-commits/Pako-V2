import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), upload: vi.fn(), updates: [] as Record<string, unknown>[], claim: true }));
vi.mock("@/server/ai.server", () => ({ generateChristmasPhoto: mocks.generate }));
vi.mock("@/server/storage.server", () => ({ ORDER_BUCKET: "pasko-orders" }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
 storage: { from: () => ({ download: async () => ({ data: new Blob(["portrait"]), error: null }), upload: mocks.upload }) },
 from: () => ({ update: (value: Record<string, unknown>) => { mocks.updates.push(value); return { eq: () => ({ in: () => ({ select: async () => ({ data: mocks.claim ? [{ id: "order" }] : [], error: null }) }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) }) }; } }),
} }));
import { renderPaidPhotoBatch } from "@/server/paid-photos.server";
const order = { id: "order", reference: "XM-TEST", original_path: "original.jpg", result_paths: [] as string[] };
beforeEach(() => { mocks.updates.length = 0; mocks.claim = true; mocks.generate.mockReset().mockResolvedValue(new Uint8Array([1])); mocks.upload.mockReset().mockResolvedValue({ error: null }); });
describe("paid five-photo batches", () => {
 it("renders all five concurrently and saves all slots together", async () => {
  let active = 0; let peak = 0;
  mocks.generate.mockImplementation(async () => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 10)); active--; return new Uint8Array([1]); });
  await renderPaidPhotoBatch(order, [0, 1, 2, 3, 4]);
  expect(peak).toBe(5); expect(mocks.upload).toHaveBeenCalledTimes(5);
  expect(mocks.updates[1]?.['status']).toBe("completed");
  expect(mocks.updates[1]?.['result_paths']).toEqual(["results/XM-TEST/1-santa.png", "results/XM-TEST/2-family.png", "results/XM-TEST/3-winter.png", "results/XM-TEST/4-lights.png", "results/XM-TEST/5-fashion.png"]);
 });
 it("retains four successes when one style fails", async () => {
  mocks.generate.mockImplementation(async (_: Blob, index: number) => { if (index === 2) throw new Error("Snow failed"); return new Uint8Array([1]); });
  const result = await renderPaidPhotoBatch(order, [0, 1, 2, 3, 4]);
  expect(result.errors[2]).toBe("Snow failed"); expect(mocks.upload).toHaveBeenCalledTimes(4);
  expect(mocks.updates[1]?.['status']).toBe("failed"); expect((mocks.updates[1]?.['result_paths'] as string[])[2]).toBe("");
 });
 it("retries only the missing style without losing existing photos", async () => {
  await renderPaidPhotoBatch({ ...order, result_paths: ["a", "b", "", "d", "e"] }, [2]);
  expect(mocks.generate).toHaveBeenCalledTimes(1);
  expect(mocks.updates[1]?.['result_paths']).toEqual(["a", "b", "results/XM-TEST/3-winter.png", "d", "e"]);
 });
 it("does not render when another batch already claimed the order", async () => {
  mocks.claim = false; await renderPaidPhotoBatch(order, [0, 1, 2, 3, 4]); expect(mocks.generate).not.toHaveBeenCalled();
 });
});

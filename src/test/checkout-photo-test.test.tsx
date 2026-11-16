import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.run }));
vi.mock("@/lib/photo-test.functions", () => ({ testCheckoutPhoto: () => {} }));
vi.mock("@/components/test-photo-slideshow", () => ({ TestPhotoSlideshow: () => null }));
vi.mock("@/components/LocalDownloadControls", () => ({ LocalPackageDownload: () => null }));
import { CheckoutPhotoTest } from "@/components/checkout-photo-test";
afterEach(() => { cleanup(); mocks.run.mockReset(); });
describe("checkout test generation", () => {
  it("starts all five styles without waiting for the first render to finish", async () => {
    type R = { ok: true; image: string; provider: "meta" };
    let finish: ((result: R) => void) | undefined;
    const pending = new Promise<R>(resolve => { finish = resolve; });
    mocks.run.mockReturnValue(pending);
    render(<CheckoutPhotoTest photo="data:image/png;base64,aGVsbG8=" template="winter" />);
    fireEvent.click(screen.getByRole("button", { name: /TEST PHOTO/ }));
    fireEvent.click(screen.getByRole("button", { name: "Generate 5 Test Photos" }));
    expect(mocks.run).toHaveBeenCalledTimes(5);
    expect(mocks.run.mock.calls.map(([request]) => request.data.index)).toEqual([2, 0, 1, 3, 4]);
    finish?.({ ok: true, image: "data:image/png;base64,aGVsbG8=", provider: "meta" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Test again" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Test again" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(10));
  });
});
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocalPackageDownload } from "@/components/LocalDownloadControls";

describe("Download all ZIP button", () => {
  it("saves a real ZIP directly, without the phone share sheet", async () => {
    const share = vi.fn();
    Object.assign(navigator, { share, canShare: () => true });
    let saved: { name: string; href: string } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { saved = { name: this.download, href: this.href }; });
    URL.createObjectURL = vi.fn(() => "blob:zip");
    URL.revokeObjectURL = vi.fn();
    const photos = Array.from({ length: 5 }, (_, i) => ({ blob: new Blob(["img" + i], { type: "image/png" }), name: `p${i}.png` }));
    const video = { blob: new Blob(["vid"], { type: "video/mp4" }), name: "show.mp4" };
    render(<LocalPackageDownload photos={photos} video={video} name="pack" />);
    const btn = await waitFor(() => screen.getByRole("button", { name: /Download 5 photos \+ slideshow/ }));
    fireEvent.click(btn);
    expect(share).not.toHaveBeenCalled();
    expect(saved).toEqual({ name: "pack.zip", href: "blob:zip" });
    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(0);
  });
});

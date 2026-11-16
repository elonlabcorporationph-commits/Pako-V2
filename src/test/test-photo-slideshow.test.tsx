import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestPhotoSlideshow } from "@/components/test-photo-slideshow";
import { SLIDESHOW_TRACKS, pickSlideshowTrack } from "@/lib/slideshow-music";

const captured = vi.hoisted(() => ({ props: [] as { images: string[]; musicUrl: string }[] }));
vi.mock("@/components/order/Slideshow", () => ({ Slideshow: (props: { images: string[]; musicUrl: string }) => { captured.props.push(props); return null; } }));
afterEach(() => { cleanup(); captured.props = []; });
const photo = "data:image/png;base64,aGVsbG8=";

describe("Public test slideshow results", () => {
  it("accepts one available result without requiring five successes", () => {
    render(<TestPhotoSlideshow images={[null, null, photo, null, null]} />);
    expect(captured.props[0]?.images).toEqual([photo]);
    expect(SLIDESHOW_TRACKS.map(t => t.url)).toContain(captured.props.at(-1)?.musicUrl);
  });
  it("passes all five successful results to the music video player", () => {
    render(<TestPhotoSlideshow images={Array(5).fill(photo)} />);
    expect(captured.props[0]?.images).toHaveLength(5);
  });
  it("shuffles across all 30s tracks", () => {
    expect(pickSlideshowTrack(() => 0)).toBe(SLIDESHOW_TRACKS[0]);
    expect(pickSlideshowTrack(() => 0.99)).toBe(SLIDESHOW_TRACKS[SLIDESHOW_TRACKS.length - 1]);
  });
  it("does not impose a quota on repeated test result sets", () => {
    const view = render(<TestPhotoSlideshow images={[]} />);
    for (let attempt = 0; attempt < 20; attempt += 1) view.rerender(<TestPhotoSlideshow images={[photo]} />);
    expect(captured.props.at(-1)?.images).toEqual([photo]);
  });
});
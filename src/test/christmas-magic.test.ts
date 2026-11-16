import { afterEach, expect, it, vi } from "vitest";
import { ChristmasSound, santaVolume, SANTA_AUDIO_SECONDS } from "@/lib/christmas-magic";

afterEach(() => vi.unstubAllGlobals());

it("limits the uploaded recording to the first 10 seconds", async () => {
  const audio = { loop: false, volume: 1, currentTime: 0, paused: false,
    ontimeupdate: null as (() => void) | null, play: vi.fn(async () => {}), pause: vi.fn() };
  vi.stubGlobal("Audio", class { constructor() { return audio; } });
  const sound = new ChristmasSound();
  expect(await sound.start()).toBe(true);
  expect(SANTA_AUDIO_SECONDS).toBe(10);
  audio.currentTime = 10;
  audio.ontimeupdate?.();
  expect(audio.currentTime).toBe(0);
  sound.stop();
  expect(audio.pause).toHaveBeenCalledTimes(1);
});

it("makes distant Santa quieter than nearby Santa", () => {
  expect(santaVolume(1)).toBeCloseTo(0.04);
  expect(santaVolume(0)).toBeCloseTo(0.65);
  expect(santaVolume(0.5)).toBeGreaterThan(santaVolume(1));
  expect(santaVolume(0.5)).toBeLessThan(santaVolume(0));
});
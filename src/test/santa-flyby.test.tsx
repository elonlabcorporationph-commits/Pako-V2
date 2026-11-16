import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SantaFlyby } from "@/components/santa-flyby";

const audio = vi.hoisted(() => ({ start: vi.fn(async () => true), stop: vi.fn(), setDistance: vi.fn() }));
vi.mock("@/lib/christmas-magic", () => ({ ChristmasSound: class {
  start = audio.start;
  stop = audio.stop;
  setDistance = audio.setDistance;
} }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("starts audio on the first screen click and preserves a later mute", async () => {
  render(<SantaFlyby />);
  expect(audio.start).not.toHaveBeenCalled();
  fireEvent.click(document.body);
  await waitFor(() => expect(screen.getByRole("button", { name: "Mute Christmas sounds" })).toBeInTheDocument());
  expect(audio.start).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Mute Christmas sounds" }));
  fireEvent.click(document.body);
  expect(audio.stop).toHaveBeenCalledTimes(1);
  expect(audio.start).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Play Christmas sounds" })).toBeInTheDocument();
});

it("starts audio only once when the speaker is the first click", async () => {
  render(<SantaFlyby />);
  fireEvent.click(screen.getByRole("button", { name: "Play Christmas sounds" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Mute Christmas sounds" })).toBeInTheDocument());
  expect(audio.start).toHaveBeenCalledTimes(1);
});
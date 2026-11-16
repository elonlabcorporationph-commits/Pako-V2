import SantaAudio from "@/assets/santa-bells-first-10s.mp3.asset.json";

export const SANTA_AUDIO_SECONDS = 10;

// Distance is normalized: zero at the screen center, one at or beyond an edge.
export function santaVolume(distance: number) {
  const proximity = 1 - Math.min(1, Math.max(0, distance));
  return 0.04 + 0.61 * proximity * proximity;
}

export class ChristmasSound {
  private audio: HTMLAudioElement | null = null;
  private generation = 0;

  async start() {
    this.stop();
    const generation = this.generation;
    const audio = new Audio(SantaAudio.url);
    this.audio = audio;
    audio.loop = true;
    audio.volume = santaVolume(1);
    // Also enforce the limit in playback, independently of the trimmed file.
    audio.ontimeupdate = () => {
      if (audio.currentTime >= SANTA_AUDIO_SECONDS) audio.currentTime = 0;
    };
    await audio.play();
    return this.generation === generation && !audio.paused;
  }

  setDistance(distance: number) {
    if (this.audio) this.audio.volume = santaVolume(distance);
  }

  stop() {
    this.generation += 1;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.ontimeupdate = null;
    this.audio = null;
  }
}
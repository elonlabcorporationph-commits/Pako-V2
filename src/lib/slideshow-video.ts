// Records Christmas photos and music locally; never uploads customer media.
export const SLIDESHOW_WIDTH = 720;
export const SLIDESHOW_HEIGHT = 1280;
// Keep the existing music source; the film completes one cycle in 30 seconds.
export const SLIDESHOW_DURATION_SECONDS = 30;
export const SLIDESHOW_PHOTO_SECONDS = 6; // Each of the 5 photos is featured on top for 6 seconds (5 x 6 = 30s).
const W = SLIDESHOW_WIDTH;
const H = SLIDESHOW_HEIGHT;
export const SLIDESHOW_TRANSITION_SECONDS = 0.3;

export function filmstripLayout(t: number, count: number) {
  const photoHeight = 1024;
  const photoWidth = photoHeight * 9 / 16;
  const pitch = photoWidth + 48;
  const progress = Math.max(0, t) % SLIDESHOW_DURATION_SECONDS / SLIDESHOW_DURATION_SECONDS;
  return { photoWidth, photoHeight, pitch, offsetX: progress === 0 ? 0 : -progress * count * pitch, photoY: (H - photoHeight) / 2, startX: (W - photoWidth) / 2 };
}

const VIDEO_TYPES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"];

export function pickVideoType(): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  // Generic video/mp4 can silently select VP9 + Opus, which iPhone Photos cannot play.
  for (const mime of VIDEO_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  }
  return null;
}

export function createSlideshowRecorder(stream: MediaStream): MediaRecorder {
  if (typeof MediaRecorder !== "undefined") {
    for (const mimeType of VIDEO_TYPES) {
      if (!MediaRecorder.isTypeSupported(mimeType)) continue;
      // Some phones advertise a codec but cannot initialize its encoder.
      for (const options of [{ mimeType, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 }, { mimeType }]) {
        try { return new MediaRecorder(stream, options); } catch { /* Try safer options, then the next codec. */ }
      }
    }
  }
  throw new Error("This browser can't create a playable video. Please open the page in Safari or Chrome.");
}

export async function wakeSlideshowAudio(ctx: AudioContext) {
  const isRunning = () => ctx.state === "running";
  if (isRunning()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ctx.resume(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Tap Create slideshow video to enable the music, and keep this page open.")), 1500); }),
    ]);
    if (!isRunning()) throw new Error("Tap Create slideshow video to enable the music, and keep this page open.");
  } finally {
    clearTimeout(timer);
  }
}

function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, alpha: number, zoom: number, x = 0, y = 0, w = W, h = H) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

export function christmasTitleMotion(t: number) {
  const progress = Math.max(0, Math.min(t / 0.45, 1));
  const scale = progress === 1 ? 1 : 1 + 2.70158 * Math.pow(progress - 1, 3) + 1.70158 * Math.pow(progress - 1, 2);
  return { scale, opacity: t <= 4 ? 1 : Math.max(0, 1 - (t - 4) / 2) };
}

export function makeGrain(): HTMLCanvasElement {
  const g = document.createElement("canvas");
  g.width = 256; g.height = 256;
  const gctx = g.getContext("2d");
  if (gctx) {
    const data = gctx.createImageData(256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.random() * 255;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 10;
    }
    gctx.putImageData(data, 0, 0);
  }
  return g;
}

export async function loadFilmPhoto(photo: Blob): Promise<ImageBitmap> {
  const original = await createImageBitmap(photo);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, H / Math.max(original.width, original.height));
    canvas.width = Math.round(original.width * scale);
    canvas.height = Math.round(original.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Photo rendering is unavailable.");
    ctx.filter = "sepia(0.12) saturate(1.08) contrast(1.02) brightness(1.02)";
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
    return await createImageBitmap(canvas);
  } finally { original.close(); }
}

// "Merry Christmas" magically appears at 1s and dissolves away by 5s.
export function merryChristmasReveal(t: number) {
  if (t < 1 || t > 5) return { opacity: 0, scale: 0.9, blur: 8 };
  const inP = Math.min(1, (t - 1) / 0.9);
  const outP = t > 4 ? (t - 4) : 0;
  const ease = 1 - Math.pow(1 - inP, 3);
  return { opacity: ease * (1 - outP), scale: 0.88 + 0.12 * ease + 0.06 * outP, blur: (1 - ease) * 8 + outP * 10 };
}

// Some phone browsers can't parse oklch() on canvas (gradients then throw and the
// video stays black), so theme tokens are resolved to canvas-safe colors once.
const FALLBACK: Record<string, string> = { background: "#0b0b0b", clear: "rgba(0,0,0,0)", shadow: "rgba(4,10,6,0.75)", edge: "#4a463f", gold: "#e0a92e", text: "#fdfbf5", light: "#f6d77a", snow: "#fdfbf5" };
const colorCache = new Map<string, string>();
function filmColor(name: string): string {
  const hit = colorCache.get(name);
  if (hit) return hit;
  const fallback = FALLBACK[name] ?? "#000000";
  let resolved = fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(`--film-${name}`).trim();
    const probe = document.createElement("canvas").getContext("2d");
    if (raw && probe) {
      probe.fillStyle = "#010203";
      probe.fillStyle = raw;
      const parsed = String(probe.fillStyle);
      if (parsed !== "#010203" && !parsed.includes("oklch")) {
        probe.createLinearGradient(0, 0, 1, 1).addColorStop(0, parsed);
        resolved = parsed;
      }
    }
  } catch { resolved = fallback; }
  colorCache.set(name, resolved);
  return resolved;
}

// The same layout is drawn in playback and the downloaded video:
// a large cross-fading focal photo on top and a scrolling rounded filmstrip below.
export function drawFilmFrame(ctx: CanvasRenderingContext2D, bitmaps: ImageBitmap[], t: number, grain: HTMLCanvasElement) {
  if (!bitmaps.length) return;
  const color = filmColor;
  const photos = bitmaps.slice(0, 5);
  const n = photos.length;
  ctx.save();
  ctx.filter = "none";
  ctx.fillStyle = color("background");
  ctx.fillRect(0, 0, W, H);

  // Focal photo: Ken Burns zoom with a 1s cross-fade between photos.
  const topH = Math.round(H * 0.7);
  const per = SLIDESHOW_PHOTO_SECONDS;
  const local = Math.max(0, t) % SLIDESHOW_DURATION_SECONDS;
  const idx = Math.floor(local / per) % n;
  const within = local - Math.floor(local / per) * per;
  const fade = local < per ? 1 : Math.min(1, within / 1);
  const prev = (idx - 1 + n) % n;
  if (fade < 1) drawCover(ctx, photos[prev]!, 1, 1.12, 0, 0, W, topH);
  drawCover(ctx, photos[idx]!, fade, 1.02 + 0.1 * (within / per), 0, 0, W, topH);
  const shade = ctx.createLinearGradient(0, topH * 0.55, 0, topH);
  shade.addColorStop(0, color("clear"));
  shade.addColorStop(1, color("background"));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, topH);
  const topShade = ctx.createLinearGradient(0, 0, 0, 260);
  topShade.addColorStop(0, color("shadow"));
  topShade.addColorStop(1, color("clear"));
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, 260);

  // Bottom filmstrip of rounded portrait cards scrolling right to left.
  const cardH = 300, cardW = Math.round(cardH * 9 / 16) + 30, gap = 22;
  const pitch = cardW + gap;
  const cardY = topH + (H - topH - cardH) / 2 + 10;
  const offset = -(local / SLIDESHOW_DURATION_SECONDS) * n * pitch * 2;
  const shift = ((offset % (n * pitch)) + n * pitch) % (n * pitch);
  for (let k = -n; k < n * 2; k++) {
    const x = k * pitch + shift - n * pitch + 20;
    if (x + cardW < 0 || x > W) continue;
    const photo = photos[((k % n) + n) % n]!;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 18);
    ctx.clip();
    drawCover(ctx, photo, 1, 1, x, cardY, cardW, cardH);
    ctx.restore();
    ctx.strokeStyle = color("edge");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardW, cardH, 18);
    ctx.stroke();
  }

  // Magical "Merry Christmas" title near the top, visible 1s-5s.
  const r = merryChristmasReveal(local);
  if (r.opacity > 0) {
    ctx.save();
    ctx.globalAlpha = r.opacity;
    ctx.translate(W / 2, 170);
    ctx.scale(r.scale, r.scale);
    ctx.filter = r.blur > 0.3 ? `blur(${r.blur.toFixed(1)}px)` : "none";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color("gold");
    ctx.shadowBlur = 30;
    ctx.fillStyle = color("text");
    ctx.font = "700 40px Outfit, sans-serif";
    ctx.fillText("M E R R Y", 0, -50);
    ctx.font = "104px 'Great Vibes', cursive";
    ctx.fillStyle = color("light");
    ctx.fillText("Christmas", 0, 40);
    ctx.restore();
    // Sparkles drifting around the title.
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996 + local * 0.8;
      const rad = 120 + (i * 37) % 200;
      const sx = W / 2 + Math.cos(a) * rad;
      const sy = 170 + Math.sin(a) * rad * 0.35 - (local - 1) * 12;
      const tw = 0.5 + 0.5 * Math.sin(local * 6 + i);
      ctx.globalAlpha = r.opacity * tw;
      ctx.fillStyle = color(i % 3 ? "light" : "snow");
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Soft vintage grain.
  ctx.globalAlpha = 0.4;
  ctx.translate(-Math.random() * 128, -Math.random() * 128);
  ctx.fillStyle = ctx.createPattern(grain, "repeat") ?? color("clear");
  ctx.fillRect(0, 0, W + 128, H + 128);
  ctx.restore();
}

export async function recordSlideshow(photos: Blob[], music: Blob | null, onProgress: (p: number) => void, preparedAudio?: AudioContext, signal?: AbortSignal): Promise<{ blob: Blob; ext: string }> {
  const type = pickVideoType();
  if (!type) throw new Error("This browser can't create a playable video. Please open the page in Safari or Chrome.");
  if (!photos.length) throw new Error("Your photos are not ready yet.");
  let bitmaps: ImageBitmap[] = [];
  let audioCtx: AudioContext | null = preparedAudio ?? null;
  let source: AudioBufferSourceNode | null = null;
  let stream: MediaStream | null = null;
  let rec: MediaRecorder | null = null;
  let frame = 0;
  let wakeLock: { release(): Promise<void> } | null = null;
  try {
    signal?.throwIfAborted();
    if (music) {
      audioCtx ??= new AudioContext();
      await wakeSlideshowAudio(audioCtx);
    }
    await Promise.all(["46px 'Great Vibes'", "900 62px Outfit"].map(f => document.fonts?.load(f).catch(() => {})));
    for (const photo of photos) bitmaps.push(await loadFilmPhoto(photo));
    signal?.throwIfAborted();
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.captureStream) throw new Error("Video recording is unavailable here. Please open this page in Safari or Chrome.");
    stream = canvas.captureStream(30);
    // Ensure the encoder is given a real bitrate so videos are full quality, not tiny files.
    const total = SLIDESHOW_DURATION_SECONDS;
    if (music && audioCtx) {
      const buf = await audioCtx.decodeAudioData(await music.arrayBuffer());
      const dest = audioCtx.createMediaStreamDestination();
      const gain = audioCtx.createGain();
      source = audioCtx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      source.connect(gain).connect(dest);
      gain.gain.setValueAtTime(1, audioCtx.currentTime);
      gain.gain.setValueAtTime(1, audioCtx.currentTime + total - 2);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + total);
      dest.stream.getAudioTracks().forEach(t => stream?.addTrack(t));
    }
    // Keep the phone screen awake; a sleeping screen freezes recording and cuts the video short.
    try { wakeLock = await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { wakeLock = null; }
    rec = createSlideshowRecorder(stream);
    const chunks: Blob[] = [];
    let recordedMs = total * 1000;
    const recorder = rec;
    const grain = makeGrain();
    const draw = (t: number) => drawFilmFrame(ctx, bitmaps, t, grain);
    await new Promise<void>((resolve, reject) => {
      let stopped = false;
      let timer = 0;
      const cleanup = () => {
        stopped = true;
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", visibility);
        signal?.removeEventListener("abort", abort);
      };
      const fail = (error: Error) => {
        cleanup();
        reject(error);
        if (recorder.state !== "inactive") recorder.stop();
      };
      const abort = () => fail(new DOMException("Slideshow cancelled", "AbortError"));
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => { cleanup(); resolve(); };
      recorder.onerror = () => fail(new Error("Video recording failed. Please try again in Safari or Chrome."));
      const visibility = () => {
        if (!document.hidden) return;
        fail(new Error("Recording was interrupted. Keep this page open and tap Create slideshow video again."));
      };
      document.addEventListener("visibilitychange", visibility);
      signal?.addEventListener("abort", abort, { once: true });
      const animate = () => {
        if (stopped) return;
        source?.start();
        const start = performance.now();
        // A timer (not animation frames) keeps 30fps even in embedded/background views,
        // so the file always has a full 30 seconds of frames.
        const track = stream?.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
        const tick = () => {
          if (stopped) return;
          const t = (performance.now() - start) / 1000;
          try {
            if (t >= total) { draw(total); track?.requestFrame?.(); recordedMs = total * 1000; recorder.stop(); return; }
            draw(t);
          } catch { fail(new Error("Could not draw the slideshow. Please try again in Safari or Chrome.")); return; }
          track?.requestFrame?.();
          onProgress(t / total);
          timer = window.setTimeout(tick, 1000 / 30);
        };
        tick();
      };
      try {
        signal?.throwIfAborted();
        draw(0);
        recorder.start(250);
        animate();
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Could not start video recording."));
        return;
      }
    });
    const mime = recorder.mimeType || type.mime;
    let blob = new Blob(chunks, { type: mime.split(";")[0] ?? type.mime });
    if (blob.size < 1024) throw new Error("The video recording was empty. Please try again.");
    if (mime.startsWith("video/webm")) {
      const { default: fixWebmDuration } = await import("fix-webm-duration");
      blob = await fixWebmDuration(blob, recordedMs, { logger: false });
    }
    onProgress(1);
    return { blob, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  } finally {
    cancelAnimationFrame(frame);
    void wakeLock?.release().catch(() => {});
    if (rec && rec.state !== "inactive") rec.stop();
    try { source?.stop(); } catch { /* A source can fail before it has started. */ }
    stream?.getTracks().forEach(t => t.stop());
    if (audioCtx && audioCtx.state !== "closed") await audioCtx.close().catch(() => {});
    bitmaps.forEach(b => b.close());
  }
}

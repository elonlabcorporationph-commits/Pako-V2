import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Sparkles, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChristmasSound } from "@/lib/christmas-magic";
import Santa from "@/assets/santa-flyby.png.asset.json";
import Poster from "@/assets/maligayang-pasko-banner.png";

const flakes = Array.from({ length: 18 }, (_, i) => ({ left: (i * 53) % 100, size: 6 + ((i * 7) % 10), duration: 9 + ((i * 3) % 9), delay: -((i * 1.7) % 12) }));

// Santa's sleigh flies across the screen every so often, towing a poster,
// with gentle snowfall and distance-aware playback of the uploaded recording.
export function SantaFlyby() {
  const rippleId = useId().replace(/:/g, "");
  const flight = useRef<HTMLDivElement>(null);
  const sound = useRef<ChristmasSound | null>(null);
  const interacted = useRef(false);
  const starting = useRef(false);
  const [show, setShow] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let animation: Animation | undefined;
    const fly = () => {
      const el = flight.current;
      if (el && !document.hidden) {
        animation?.cancel();
        const reverse = Math.random() > 0.5;
        const fromY = 10 + Math.random() * 55;
        const toY = 10 + Math.random() * 55;
        const duration = 4200 + Math.random() * 1200;
        el.dataset["direction"] = reverse ? "left" : "right";
        const t = (x: number, y: number) => `translate(${x}vw, ${y}svh) rotate(${(toY - fromY) * (reverse ? -0.3 : 0.3)}deg)`;
        animation = el.animate([
          { transform: t(reverse ? 115 : -40, fromY), opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { opacity: 1, offset: 0.85 },
          { transform: t(reverse ? -40 : 115, toY), opacity: 0 },
        ], { duration, easing: "ease-in-out" });
      }
    };
    const pass = () => { fly(); timer = setTimeout(pass, 10000 + Math.random() * 12000); };
    // Test buttons dispatch this event to send Santa across right now.
    const flyNow = () => { clearTimeout(timer); fly(); timer = setTimeout(pass, 10000 + Math.random() * 12000); };
    window.addEventListener("santa:fly", flyNow);
    timer = setTimeout(pass, 2500);
    return () => { clearTimeout(timer); animation?.cancel(); window.removeEventListener("santa:fly", flyNow); };
  }, [show]);

  useEffect(() => {
    if (!enabled) return;
    let frame: number;
    const updateVolume = () => {
      const el = flight.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const visible = Number.parseFloat(getComputedStyle(el).opacity) > 0.05
          && getComputedStyle(el.parentElement ?? el).display !== "none";
        const distance = visible
          ? Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) / (window.innerWidth / 2)
          : 1;
        sound.current?.setDistance(distance);
      }
      frame = requestAnimationFrame(updateVolume);
    };
    frame = requestAnimationFrame(updateVolume);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) { sound.current?.stop(); setEnabled(false); }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      sound.current?.stop();
    };
  }, []);

  const startSound = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    sound.current ??= new ChristmasSound();
    try {
      const running = await sound.current.start();
      setEnabled(running);
      if (!running) sound.current = null;
    } catch {
      sound.current?.stop();
      sound.current = null;
      setEnabled(false);
    } finally {
      starting.current = false;
    }
  }, []);

  useEffect(() => {
    const firstClick = (event: MouseEvent) => {
      if (interacted.current) return;
      interacted.current = true;
      // Let the speaker button handle its own click without starting twice.
      if (event.target instanceof Element && event.target.closest(".santa-sound-toggle")) return;
      void startSound();
    };
    document.addEventListener("click", firstClick, { capture: true });
    return () => document.removeEventListener("click", firstClick, { capture: true });
  }, [startSound]);

  async function toggle() {
    interacted.current = true;
    if (enabled || starting.current) {
      sound.current?.stop();
      setEnabled(false);
      return;
    }
    await startSound();
  }

  if (!show) return null;
  return (
    <>
      <div className="santa-layer" aria-hidden="true">
        {flakes.map((f, i) => <span key={i} className="santa-snow" style={{ left: `${f.left}%`, fontSize: f.size, animationDuration: `${f.duration}s`, animationDelay: `${f.delay}s` }}>❄</span>)}
        <div ref={flight} className="santa-flyby" data-direction="right">
          <div className="santa-tow">
            <svg className="santa-rope" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10 Q50 36 100 50 Q50 65 0 90" /><circle cx="98" cy="50" r="3" /></svg>
            <svg className="santa-poster" viewBox="-12 -12 1112 840" role="presentation">
              <defs>
                <filter id={rippleId} x="-5%" y="-8%" width="110%" height="116%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency="0.008 0.025" numOctaves="1" seed="5" result="wind">
                    <animate attributeName="baseFrequency" values="0.008 0.025;0.012 0.035;0.008 0.025" dur="1.6s" repeatCount="indefinite" />
                  </feTurbulence>
                  <feDisplacementMap in="SourceGraphic" in2="wind" scale="12" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <image href={Poster} width="1088" height="816" filter={`url(#${rippleId})`} />
            </svg>
          </div>
          <img className="santa-sleigh" src={Santa.url} width={1152} height={576} alt="" />
          <div className="santa-trail">{Array.from({ length: 16 }, (_, i) => <span key={i} style={{ left: `${i * 6}%`, top: `${(i * 37) % 80}%`, animationDelay: `${-i * 0.09}s` }}>✦</span>)}</div>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="santa-fly-test"
        onClick={() => window.dispatchEvent(new Event("santa:fly"))}
        aria-label="Test Santa flyby"
        title="Test Santa flyby"
      >
        <Sparkles size={20} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="santa-sound-toggle"
        onClick={() => void toggle()}
        aria-pressed={enabled}
        aria-label={enabled ? "Mute Christmas sounds" : "Play Christmas sounds"}
        title={enabled ? "Mute Christmas sounds" : "Play Christmas sounds"}
      >
        {enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </Button>
    </>
  );
}

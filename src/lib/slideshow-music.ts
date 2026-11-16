import ChristmasInOurHearts from "@/assets/christmas-in-our-hearts-30s.mp3.asset.json";
import DiwaNgPasko from "@/assets/diwa-ng-pasko-30s.mp3.asset.json";
import NgayongPasko from "@/assets/ngayong-pasko-magkasama-tayo-30s.mp3.asset.json";
import PaskoNaNaman from "@/assets/pasko-na-naman-30s.mp3.asset.json";
import SinoKayaSiSanta from "@/assets/sino-kaya-si-santa-30s.mp3.asset.json";
import TunayNaDiwa from "@/assets/tunay-na-diwa-ng-pasko-30s.mp3.asset.json";
import { useEffect, useState } from "react";

/** 30-second slideshow tracks; add new songs here and they join the shuffle. */
export const SLIDESHOW_TRACKS = [
  { url: ChristmasInOurHearts.url, title: "Christmas in Our Hearts" },
  { url: DiwaNgPasko.url, title: "Diwa ng Pasko" },
  { url: NgayongPasko.url, title: "Ngayong Pasko Magkasama Tayo" },
  { url: PaskoNaNaman.url, title: "Pasko na Naman" },
  { url: SinoKayaSiSanta.url, title: "Sino Kaya Si Santa" },
  { url: TunayNaDiwa.url, title: "Tunay na Diwa ng Pasko" },
];

export function pickSlideshowTrack(random: () => number = Math.random) {
  return SLIDESHOW_TRACKS[Math.floor(random() * SLIDESHOW_TRACKS.length) % SLIDESHOW_TRACKS.length]!;
}

/** Picks a random track after mount (avoids SSR mismatch); re-picks when `key` changes. */
export function useRandomSlideshowTrack(key?: unknown) {
  const [track, setTrack] = useState<(typeof SLIDESHOW_TRACKS)[number] | null>(null);
  useEffect(() => { setTrack(pickSlideshowTrack()); }, [key]);
  return track;
}

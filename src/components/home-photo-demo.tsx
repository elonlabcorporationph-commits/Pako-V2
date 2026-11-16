import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, ImagePlus, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generatePaskoPhotos } from "@/lib/pasko-photo.functions";
import { META_STYLE_IDS, META_STYLE_INDEX } from "@/lib/meta-photo-styles";
import { dataUrlToBlob, deliverFile } from "@/lib/download";
import { RENDER_STATUS_LABEL, renderWithFallback, type RenderOutcome, type RenderStatus } from "@/lib/render-outcome";
import { PaskoPhotoGallery } from "@/components/pasko-photo-gallery";
import { TestPhotoSlideshow } from "@/components/test-photo-slideshow";
import Sample from "@/assets/style-original.jpg.asset.json";

export function HomePhotoDemo() {
  const run = useServerFn(generatePaskoPhotos);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState("");
  const [images, setImages] = useState<(string | null)[]>(Array(5).fill(null));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number[]>([]);
  const [all, setAll] = useState(false);
  const [status, setStatus] = useState<Record<number, RenderStatus>>({});
  const picker = useRef<HTMLInputElement>(null);
  async function generate(indices: number[]) {
    if (busy.length) return;
    setBusy(indices); setErrors({});
    try {
      const source = photo || await fetch(Sample.url).then(r => { if (!r.ok) throw new Error("Sample photo could not load."); return r.blob(); }).then(blob => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Photo could not load.")); reader.onerror = reject; reader.readAsDataURL(blob); }));
      await Promise.allSettled(indices.map(async index => {
        const style = META_STYLE_IDS.find(id => META_STYLE_INDEX[id] === index);
        if (!style) return;
        try { const result = await renderWithFallback(provider => run({ data: { imageBase64: source, style, provider } }) as Promise<RenderOutcome>, s => setStatus(p => ({ ...p, [index]: s }))); setImages(p => p.map((u, i) => i === index ? `data:image/png;base64,${result.image}` : u)); }
        catch (e) { setErrors(p => ({ ...p, [index]: e instanceof Error ? e.message : "Photo creation failed." })); }
      }));
    } catch (e) { setErrors({ [indices[0] ?? 2]: e instanceof Error ? e.message : "Photo creation failed." }); }
    finally { setBusy([]); }
  }
  return <div className="page-action"><Button type="button" size="lg" onClick={() => { setOpen(true); void generate([2]); }} disabled={busy.length > 0}>{busy.length ? <LoaderCircle className="animate-spin" /> : <Sparkles />}Try Test Magic ✨</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy.length) setOpen(v); }}><DialogContent className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>Try Test Magic ✨</DialogTitle></DialogHeader>
      <img src={photo || Sample.url} alt={photo ? "Your uploaded portrait" : "Sample portrait"} className="mx-auto max-h-48 object-contain" />
      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload demo portrait" onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 10 * 1024 * 1024) { setErrors({ 2: "Choose a photo up to 10 MB." }); return; } const r = new FileReader(); r.onload = () => { if (typeof r.result === "string") { setPhoto(r.result); setImages(Array(5).fill(null)); setErrors({}); setAll(false); } }; r.readAsDataURL(f); }} />
      <Button type="button" variant="outline" disabled={busy.length > 0} onClick={() => picker.current?.click()}><ImagePlus />Choose photo</Button>
      {!all && <><Button type="button" disabled={busy.length > 0} onClick={() => void generate([2])}>{busy.length ? <LoaderCircle className="animate-spin" /> : <Sparkles />}Generate Snow</Button>{busy.includes(2) && status[2] && <p role="status" className="text-sm text-muted-foreground">{RENDER_STATUS_LABEL[status[2]]}</p>}{errors[2] && <p role="alert" className="text-destructive">{errors[2]}</p>}{images[2] && <><img src={images[2]} alt="Generated snow portrait" className="w-full rounded-lg" /><Button type="button" variant="outline" onClick={() => { const u = images[2]; if (u) void deliverFile(dataUrlToBlob(u), "pasko-snow.png"); }}><Download />Download</Button><Button type="button" disabled={busy.length > 0} onClick={() => { setAll(true); void generate([0, 1, 3, 4]); }}><Sparkles />Generate All 5 Styles</Button></>}</>}
      {all && <PaskoPhotoGallery images={images} errors={errors} busy={busy} status={status} retry={i => void generate([i])} />}
      {!busy.length && <TestPhotoSlideshow images={images} />}
    </DialogContent></Dialog></div>;
}

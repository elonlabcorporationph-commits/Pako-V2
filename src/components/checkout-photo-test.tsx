import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, FlaskConical, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { testCheckoutPhoto } from "@/lib/photo-test.functions";
import { photoStyles, STYLES } from "@/lib/pasko-content";
import { dataUrlToBlob, deliverFile } from "@/lib/download";
import { LocalPackageDownload } from "@/components/LocalDownloadControls";
import { TestPhotoSlideshow } from "@/components/test-photo-slideshow";
import { RENDER_STATUS_LABEL, renderWithFallback, type RenderOutcome, type RenderStatus } from "@/lib/render-outcome";

type Slot = { image: string; error: string; status: RenderStatus; fallback: boolean };
const emptySlots = (): Slot[] => photoStyles.map(() => ({ image: "", error: "", status: "idle", fallback: false }));
const working = (s: RenderStatus) => s === "generating" || s === "retrying" || s === "fallback";

// Test Mode: no payment, order or charge is ever created here.
export function CheckoutPhotoTest({ photo, template, pkg = "basic" }: { photo: string; template: string; pkg?: "basic" | "premium" }) {
  const run = useServerFn(testCheckoutPhoto);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<Slot[]>(emptySlots);
  const [quick, setQuick] = useState<"" | "ok" | "fail">("");
  const premium = pkg === "premium";
  const found = photoStyles.findIndex((s) => s.key === template);
  const first = found < 0 ? 0 : found;
  const order = [first, ...photoStyles.map((_, i) => i).filter((i) => i !== first)];
  const simbangIndex = Math.max(0, photoStyles.findIndex(s => /simbang/i.test(s.name)));
  const busy = slots.some(s => working(s.status));
  const patch = (index: number, value: Partial<Slot>) => setSlots(p => p.map((s, i) => (i === index ? { ...s, ...value } : s)));

  async function renderSlot(index: number) {
    patch(index, { image: "", error: "", fallback: false });
    try {
      const renderIndex = STYLES.findIndex(style => style.key === photoStyles[index]?.key);
      const r = await renderWithFallback(provider => run({ data: { photo, index: renderIndex, provider } }) as Promise<RenderOutcome>, status => patch(index, { status }));
      patch(index, { image: r.image, fallback: r.provider === "fallback", status: "done" });
      return true;
    } catch (e) {
      patch(index, { error: e instanceof Error ? e.message : "Generation failed, please try again.", status: "error" });
      return false;
    }
  }
  async function generate(indices: number[]) {
    if (busy) return;
    setQuick("");
    await Promise.allSettled(indices.map(renderSlot));
  }
  async function quickTest() {
    if (busy) return;
    setQuick("");
    setQuick(await renderSlot(simbangIndex) ? "ok" : "fail");
  }

  const done = slots.some((s) => s.image || s.error);
  const images = order.map((i) => slots[i]?.image).filter((x): x is string => !!x);
  const key = images.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blobs = useMemo(() => Object.fromEntries(images.map((u) => [u, dataUrlToBlob(u)])), [key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localPhotos = useMemo(() => images.map((u, i) => ({ blob: blobs[u] as Blob, name: `pasko-test-${i + 1}.png` })), [blobs]);

  return <>
    <Button type="button" size="lg" className="mt-4 min-h-16 w-full whitespace-normal py-3 text-lg font-bold shadow-lg" onClick={() => { setOpen(true); setSlots(emptySlots()); setQuick(""); }}>
      <FlaskConical className="size-6 shrink-0" />{premium ? "TEST ₱149 — 5 photos + slideshow & music" : "TEST PHOTO — 5 styles + slideshow & music"}
    </Button>
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{premium ? "Test ₱149 Magic with Music" : "Test Christmas Photos"}</DialogTitle>
          <DialogDescription><span className="font-semibold">Test Mode is on</span> — no payment, order, or charge is created.</DialogDescription>
        </DialogHeader>
        {!done && <img src={photo} alt="Your uploaded photo" className="mx-auto max-h-60 w-full object-contain" />}
        <Button type="button" variant="outline" disabled={busy} onClick={quickTest}>
          {working(slots[simbangIndex]?.status ?? "idle") ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}Quick check: Simbang Gabi only
        </Button>
        {quick === "ok" && <p role="status" className="text-sm font-semibold text-primary">Success — the image service is working.</p>}
        {quick === "fail" && <p role="alert" className="text-sm text-destructive">The quick check failed. See the Simbang Gabi card below.</p>}
        <div className="grid grid-cols-2 gap-3">
          {photoStyles.map((style, index) => {
            const slot = slots[index] ?? { image: "", error: "", status: "idle", fallback: false };
            return <div key={style.key} className="space-y-1">
              <p className="text-xs font-semibold">{style.name}{index === first ? " (selected)" : ""}</p>
              {slot.image
                ? <img src={slot.image} alt={`${style.name} test photo`} className="w-full rounded-xl object-contain" />
                : <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-xl bg-muted p-2 text-center text-xs text-muted-foreground">
                    {working(slot.status) && <LoaderCircle className="animate-spin" />}
                    {slot.error ? <span role="alert" className="break-words text-destructive">{slot.error}</span> : <span>{RENDER_STATUS_LABEL[slot.status]}</span>}
                  </div>}
              {slot.image && <p className="text-xs text-muted-foreground">Done{slot.fallback ? " (fallback service)" : ""}</p>}
              {slot.image && <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void deliverFile(dataUrlToBlob(slot.image), `pasko-test-${style.key}.png`)}><Download />Save photo</Button>}
              {slot.error && <Button type="button" variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => void generate([index])}><RotateCcw />Retry this style</Button>}
            </div>;
          })}
        </div>
        {!busy && images.length === 5 && <LocalPackageDownload photos={localPhotos} name="pasko-test-photos" />}
        {!busy && <TestPhotoSlideshow images={images} />}
        <Button type="button" disabled={busy} onClick={() => void generate(order)}>
          {busy ? <LoaderCircle className="animate-spin" /> : <FlaskConical />}
          {busy ? "Generating…" : done ? "Test again" : "Generate 5 Test Photos"}
        </Button>
      </DialogContent>
    </Dialog>
  </>;
}

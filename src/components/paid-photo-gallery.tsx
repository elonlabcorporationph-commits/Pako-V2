import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { generatePaidPaskoPhotos } from "@/lib/pasko-photo.functions";
import { PaskoPhotoGallery } from "@/components/pasko-photo-gallery";

export function PaidPhotoGallery({ reference, token, status, images, error, onBusy }: { reference: string; token: string; status: string; images: (string | null)[]; error: string | null; onBusy: (v: boolean) => void }) {
  const run = useServerFn(generatePaidPaskoPhotos);
  const router = useRouter();
  const started = useRef(false);
  const [busy, setBusy] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  async function generate(indices: number[]) {
    setBusy(indices); onBusy(true);
    try { const r = await run({ data: { reference, token, indices } }); setErrors(r.errors); await router.invalidate(); }
    catch (e) { setErrors(Object.fromEntries(indices.map(i => [i, e instanceof Error ? e.message : "Photo creation failed."]))); }
    finally { setBusy([]); onBusy(false); }
  }
  useEffect(() => {
    if (status === "payment_verified" && !started.current) { started.current = true; void generate([0, 1, 2, 3, 4]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const shownErrors = { ...Object.fromEntries(images.flatMap((u, i) => !u && error ? [[i, error]] : [])), ...errors };
  return <PaskoPhotoGallery images={images} errors={shownErrors} busy={busy.length ? busy : status === "processing" ? [0, 1, 2, 3, 4] : []} retry={i => void generate([i])} />;
}

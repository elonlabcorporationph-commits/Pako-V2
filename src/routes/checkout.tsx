import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, Eye, EyeOff, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageFrame } from "@/components/pasko-pages";
import { peso } from "@/lib/pasko-content";
import { createPayOrder, listPayMethods, scanReceiptReference, PAY_PACKAGES } from "@/lib/pay.functions";
import { DEFAULT_QR, readFileAsDataUrl } from "@/lib/pay-qr";

const methodsQuery = queryOptions({ queryKey: ["pay-methods"], queryFn: () => listPayMethods() });

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({ pkg: search["pkg"] === "premium" ? "premium" as const : "basic" as const }),
  head: () => ({ meta: [
    { title: "Checkout | Pasko Photo Magic" },
    { name: "description", content: "Pay for your Christmas photo package with GCash, Maya or bank transfer." },
    { property: "og:title", content: "Checkout | Pasko Photo Magic" },
    { property: "og:description", content: "Choose a package, scan the QR and upload your receipt." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(methodsQuery),
  component: Checkout,
});

function isIos() {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function saveQr(src: string, filename: string) {
  const done = "QR saved! Open your bank app and scan from gallery.";
  if (isIos()) {
    window.open(src, "_blank", "noopener");
    toast.success(done, { description: "Long-press the image in the new tab, then tap Save to Photos." });
    return;
  }
  try {
    const blob = await (await fetch(src)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    toast.success(done);
  } catch {
    window.open(src, "_blank", "noopener");
    toast.success(done, { description: "Long-press the image in the new tab to save it." });
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  toast.success("Copied ✓");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Copy ${label}`} onClick={() => void copyText(text)}><Copy className="h-4 w-4" /></Button>;
}

const STEPS = ["Package", "Pay", "Send Proof", "Delivered"] as const;

function Stepper({ current }: { current: number }) {
  return <ol className="mb-6 flex items-center gap-1 sm:gap-2" aria-label="Checkout progress">
    {STEPS.map((label, i) => {
      const n = i + 1;
      const done = n < current, active = n === current;
      return <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <span className={`text-[11px] sm:text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
        {n < STEPS.length && <span className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
      </li>;
    })}
  </ol>;
}

function Checkout() {
  const { data: methods } = useSuspenseQuery(methodsQuery);
  const create = useServerFn(createPayOrder);
  const scan = useServerFn(scanReceiptReference);
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  const [pkgId, setPkgId] = useState<"basic" | "premium">(Route.useSearch().pkg);
  const [methodId, setMethodId] = useState(methods[0]?.method ?? "");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ code: string; token: string } | null>(null);
  const doneCode = done?.code ?? null;
  const [portrait, setPortrait] = useState<{ photo: string; template: string } | null | undefined>(undefined);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("pasko-checkout") ?? "null");
      setPortrait(saved?.photo ? { photo: saved.photo, template: saved.template ?? "santa" } : null);
    } catch { setPortrait(null); }
  }, []);
  const pkg = PAY_PACKAGES.find((p) => p.id === pkgId)!;
  const method = methods.find((m) => m.method === methodId);
  const qr = method ? method.qr_url ?? DEFAULT_QR[method.method] ?? null : null;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("image/")) { toast.error("Receipt must be an image."); continue; }
      if (f.size > 5 * 1024 * 1024) { toast.error("Each receipt must be up to 5 MB."); continue; }
      if (next.length >= 4) { toast.error("Up to 4 receipt images."); break; }
      next.push(f);
    }
    setFiles(next);
    const first = next[0];
    if (first && next.length !== files.length && !reference) void autoRead(first);
  }

  async function autoRead(file: File) {
    setScanning(true); setDetected(null);
    try {
      const image = await readFileAsDataUrl(file);
      const r = await scan({ data: { image } });
      if (r.reference) { setReference(r.reference); setDetected(r.reference); toast.success("Reference number detected!"); }
      else toast.info(r.error ?? "We couldn't find the reference number. Please type it.");
    } catch { toast.info("We couldn't read the receipt. Please type the reference number."); }
    finally { setScanning(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!method || !qr) return;
    if (!portrait) { toast.error("Please upload your portrait first."); return; }
    if (!/^[0-9]{8,20}$/.test(reference.trim())) { toast.error("Reference number must be 8 to 20 digits."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Please enter a valid email address."); return; }
    if (files.length === 0) { toast.error("Please attach your receipt."); return; }
    setBusy(true);
    try {
      const proofs = await Promise.all(files.map(readFileAsDataUrl));
      const { code, token } = await create({ data: { packageId: pkgId, method: method.method, name, contact: mobile.trim(), email: email.trim() || undefined, reference: reference.trim(), proofs, photo: portrait.photo, template: portrait.template } });
      try { sessionStorage.removeItem("pasko-checkout"); } catch { /* ignore */ }
      setDone({ code, token });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Your order could not be sent."); }
    finally { setBusy(false); }
  }

  if (doneCode) {
    return <PageFrame><section className="content-section" style={{ maxWidth: 640, margin: "0 auto" }}>
      <Stepper current={4} />
      <div className="rounded-lg border bg-card p-6 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-7 w-7" /></span>
        <h1 className="section-heading">We received your proof!</h1>
        <p className="mt-2">Your order reference is</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold tracking-wide">{doneCode}<CopyButton text={doneCode} label="order reference" /></p>
        <p className="mt-4 text-sm text-muted-foreground">We'll verify your payment within 15 minutes during business hours and email you a confirmation. Keep your receipt until your photos are delivered.</p>
        <Button asChild className="mt-6 w-full"><Link to="/status/$code" params={{ code: doneCode }} search={{ t: done?.token }}>Open my order page</Link></Button>
        <p className="mt-2 text-xs text-muted-foreground">Bookmark that page — your finished photos appear there after approval.</p>
      </div>
    </section></PageFrame>;
  }

  return <PageFrame><section className="content-section" style={{ maxWidth: 640, margin: "0 auto" }}>
    <p className="page-eyebrow">Checkout</p><h1 className="section-heading">Pay for your photos</h1>
    <Stepper current={paying ? 2 : 1} />
    {portrait === null && <div className="mb-4 rounded-lg border bg-card p-4 text-center">
      <p className="font-semibold">First, upload your portrait and pick a style.</p>
      <Button asChild className="mt-3 w-full"><Link to="/create" search={{ pkg: pkgId }}>Upload my photo</Link></Button>
    </div>}
    {portrait && <div className="mb-4 flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      <img src={portrait.photo} alt="Your portrait" className="h-14 w-14 rounded object-cover" />
      <div className="flex-1">Portrait ready · Style: <strong className="capitalize">{portrait.template.replace(/-/g, " ")}</strong></div>
      <Link to="/create" search={{ pkg: pkgId }} className="text-xs underline">Change</Link>
    </div>}
    <p className="mb-4 rounded-lg border bg-card p-3 text-center text-sm">Package: <strong>{pkg.name}</strong> — <strong>{peso(pkg.amount)}</strong></p>

    {!paying && <>
    <h2 className="step-heading">1. Choose a package</h2>
    <div className="grid gap-3 sm:grid-cols-2">{PAY_PACKAGES.map((p) => { const on = p.id === pkgId; const feats = p.id === "premium" ? ["5 Christmas portraits", "30-second slideshow video", "Christmas music, random each time", "Download photos + video"] : ["5 Christmas portraits", "All 5 festive styles", "High-quality downloads", "No background music"]; return <button key={p.id} type="button" aria-pressed={on} onClick={() => setPkgId(p.id)} className={`relative rounded-lg border-2 bg-card p-4 text-left transition ${on ? "border-primary shadow-md" : "border-border"}`}>
      {p.id === "premium" && <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">MOST POPULAR</span>}
      <div className="flex items-baseline justify-between gap-2"><strong>{p.name}</strong><span className="text-xl font-bold">{peso(p.amount)}</span></div>
      <ul className="mt-2 grid gap-1 text-sm">{feats.map((f) => <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
    </button>; })}</div>


    <h2 className="step-heading mt-6">Payment method</h2>
    {methods.length === 0 ? <p>No payment methods are available right now.</p> :
      <div className="grid grid-cols-3 gap-3">{methods.map((m) => <Button key={m.method} type="button" variant={m.method === methodId ? "default" : "outline"} onClick={() => setMethodId(m.method)}>{m.label}</Button>)}</div>}
    </>}

    {!paying && <form className="mt-6 grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      if (!portrait) { toast.error("Please upload your portrait first."); return; }
      if (!method) { toast.error("Choose a payment method."); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("Please enter a valid email address."); return; }
      setPaying(true); window.scrollTo({ top: 0, behavior: "smooth" });
    }}>
      <h2 className="step-heading">Your details</h2>
        <div><Label htmlFor="pay-name">Your name</Label><Input id="pay-name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="pay-mobile">Mobile Number</Label><Input id="pay-mobile" required minLength={7} maxLength={20} inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
        <div><Label htmlFor="pay-email">Email Address</Label><Input id="pay-email" type="email" maxLength={120} placeholder="Optional — for your confirmation" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={!method || !portrait}>Proceed to Payment ({peso(pkg.amount)})</Button>
    </form>}

    {paying && method && <>
      <Button type="button" variant="ghost" className="mt-4" onClick={() => setPaying(false)}>← Edit order details</Button>
      <h2 className="step-heading mt-2">2. Pay exactly {peso(pkg.amount)}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {methods.map((m) => { const src = m.qr_url ?? DEFAULT_QR[m.method]; if (!src) return null; return (
          <div key={m.method} className={`rounded-lg border-2 bg-card p-3 text-center ${m.method === methodId ? "border-primary" : "border-border"}`}>
            <p className="mb-2 font-bold">{m.label}</p>
            <img src={src} alt={`${m.label} QR code`} className="mx-auto w-full max-w-[240px] rounded" />
            <Button type="button" className="mt-3 w-full" onClick={() => { setMethodId(m.method); void saveQr(src, `pasko-${m.method}-qr.png`); }}>
              <Download className="mr-2 h-4 w-4" /> Save {m.label} QR
            </Button>
          </div>); })}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Send from the same wallet — cross-wallet transfers may incur fees.</p>
      <div className="mt-3 rounded-lg border bg-card p-4 text-center">
        <p className="font-semibold">Paying with {method.label}</p>
        {method.account_name && <p className="mt-3 flex items-center justify-center gap-1"><strong>{method.account_name}</strong><CopyButton text={method.account_name} label="account name" /></p>}
        {method.account_number && <p className="flex items-center justify-center gap-1">
          <span>{reveal ? method.account_number : method.account_number.replace(/[0-9]/g, "•")}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={reveal ? "Hide number" : "Reveal number"} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
          {reveal && <CopyButton text={method.account_number} label="account number" />}
        </p>}
        <p className="mt-1 flex items-center justify-center gap-1 text-sm">Amount: <strong>{peso(pkg.amount)}</strong><CopyButton text={String(pkg.amount)} label="amount" /></p>
      </div>

      <h2 className="step-heading mt-6">3. Send your proof</h2>
      <p className="mb-3 text-sm text-muted-foreground">We'll verify your payment within 15 minutes during business hours and email you a confirmation. Keep your receipt until your photos are delivered.</p>
      <form className="grid gap-3" onSubmit={submit}>
        <div>
          <Label htmlFor="pay-ref">Reference number (8–20 digits)</Label>
          <Input id="pay-ref" required inputMode="numeric" pattern="[0-9]{8,20}" maxLength={20} value={reference} onChange={(e) => setReference(e.target.value.replace(/\D/g, ""))} />
          <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{scanning ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Reading your receipt…</span> : detected && detected === reference ? "✨ Detected from your receipt — check it matches" : "Upload your receipt below and we'll fill this in"}</span><span>{reference.length}/20</span></p>
        </div>
        <div>
          <Label htmlFor="pay-proof">Receipt screenshot{files.length > 1 ? "s" : ""}</Label>
          <Input id="pay-proof" type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {files.length > 0 && <div className="mt-2 grid grid-cols-4 gap-2">
            {files.map((f, i) => <div key={`${f.name}-${i}`} className="relative">
              <img src={URL.createObjectURL(f)} alt={`Receipt ${i + 1}`} className="h-20 w-full rounded border object-cover" />
              <Button type="button" variant="destructive" size="icon" className="absolute -right-1 -top-1 h-5 w-5" aria-label={`Remove receipt ${i + 1}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
            </div>)}
          </div>}
        </div>
        <div className="max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:border-t max-sm:bg-background max-sm:px-4 max-sm:py-3">
          <Button type="submit" className="w-full" disabled={busy || !qr}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : `Submit payment of ${peso(pkg.amount)}`}
          </Button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm">
        <a href="https://m.me/xmasmagicph" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"><MessageCircle className="h-4 w-4" /> Having trouble paying?</a>
      </p>
    </>}
  </section></PageFrame>;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, LockKeyhole, Music, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { DEFAULT_PRICES, packages, photoStyles, peso, type PackageId } from "@/lib/pasko-content";
import { getSiteData } from "@/lib/orders.functions";

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>) => ({ pkg: search["pkg"] === "premium" ? "premium" as const : "basic" as const }),
  loader: () => getSiteData(),
  head: () => ({ meta: [
    { title: "Create Christmas Photos | Pasko Photo Magic" },
    { name: "description", content: "Upload one photo, select a package and receive five Christmas portraits in the styles you choose." },
    { property: "og:title", content: "Create Christmas Photos | Pasko Photo Magic" },
    { property: "og:description", content: "One photo becomes five Christmas portraits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CreatePage,
});

type PhotoChoice = { dataUrl: string; preview: string; name: string; size: number };

async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WEBP photo.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Your photo must be 10 MB or smaller.");
  if (file.size < 10 * 1024) throw new Error("This photo is too small. Please choose a clearer image.");
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this photo."));
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("This file is not a valid image."));
    element.src = raw;
  });
  if (image.width < 256 || image.height < 256) throw new Error("Choose a photo at least 256 × 256 pixels.");
  const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This photo could not be prepared.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  return { dataUrl, preview: URL.createObjectURL(file), name: file.name, size: file.size };
}

function CreatePage() {
  const { pkg: initialPackage } = Route.useSearch();
  const [pkg, setPkg] = useState<PackageId>(initialPackage);
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState<PhotoChoice | null>(null);
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const site = Route.useLoaderData();
  const pricing = site.pricing;
  const amount = pricing[pkg];
  const selectedIndex = photoStyles.findIndex((style) => style.key === styleKey);
  const chosenStyle = photoStyles[selectedIndex >= 0 ? selectedIndex : 0];

  useEffect(() => () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); }, [photo]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    try {
      setFileError("");
      setPhoto(await preparePhoto(file));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "This photo could not be opened.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void choosePhoto(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void choosePhoto(event.dataTransfer.files[0]);
  }

  async function continueOrSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      if (!photo) { toast.error("Choose one photo to continue."); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (pkg === "basic" && !styleKey) { toast.error("Choose your first template."); return; }
      setStep(3);
      return;
    }
    if (!photo) { toast.error("Choose one photo to continue."); return; }
    try {
      sessionStorage.setItem("pasko-checkout", JSON.stringify({ photo: photo.dataUrl, template: chosenStyle?.key ?? "santa", pkg }));
    } catch {
      toast.error("Your photo is too large for this browser. Please choose a smaller photo.");
      return;
    }
    setBusy(true);
    navigate({ to: "/checkout", search: { pkg } });
  }

  const stepLabels = ["Upload photo", "Choose a style", "Review"];
  return <div className="create-page">
    <SiteHeader />
    <main className="create-main">
      <form className="create-layout" onSubmit={continueOrSubmit}>
        <section aria-live="polite">
          <h1 className="create-title">Create your Christmas magic</h1>
          <p className="create-subtitle">One photo. Five joyful portraits.</p>
          <ol className="steps-progress" aria-label={`Step ${step} of 3`}>{stepLabels.map((label, index) => <li key={label} className={step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : ""}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>{label}</li>)}</ol>

          {step === 1 && <section>
            <h2 className="step-heading"><span className="step-number">1</span> Upload your photo</h2>
            <div className={`upload-zone${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <input ref={picker} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} aria-label="Choose one photo" />
              <input ref={camera} className="file-input" type="file" accept="image/*" capture="environment" onChange={onFileChange} aria-label="Take a photo" />
              {photo ? <div className="upload-content">
                <img className="photo-preview" src={photo.preview} alt="Your selected photo" />
                <strong>{photo.name}</strong><p>{(photo.size / 1024 / 1024).toFixed(1)} MB · One photo selected</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setPhoto(null)}><X /> Remove photo</Button>
              </div> : <div className="upload-content">
                <span className="upload-icon"><Camera size={30} /></span><strong>Upload ONE photo</strong>
                <p>Drag &amp; drop here, or choose below. JPG, PNG or WEBP · up to 10 MB</p>
                <div className="upload-actions"><Button type="button" onClick={() => picker.current?.click()}><ImagePlus /> Choose photo</Button><Button type="button" variant="outline" onClick={() => camera.current?.click()}><Camera /> Take a photo</Button></div>
              </div>}
            </div>
            {fileError && <p className="upload-error" role="alert">{fileError}</p>}
            <p className="upload-tip">A clear, front-facing photo helps keep every face true to the original.</p>
            <div className="step-buttons"><span /><Button type="submit">Continue <ArrowRight /></Button></div>
          </section>}

          {step === 2 && <section>
            <h2 className="step-heading"><span className="step-number">2</span>{pkg === "premium" ? "Your five Christmas styles" : "Choose your first template"}</h2>
            <p className="section-lede">{pkg === "premium" ? "All five styles are included in Magic with Music." : "All five photos are included. Pick which style you would like first."}</p>
            <div className="template-grid">{photoStyles.map((style) => <Button key={style.key} type="button" variant="outline" aria-pressed={pkg === "premium" || styleKey === style.key} className="template-option" onClick={() => setStyleKey(style.key)}>
              <img src={style.image} alt="" /><span className="template-name">{style.name}</span><span>{style.detail}</span>{(pkg === "premium" || styleKey === style.key) && <Check className="template-check" size={18} />}
            </Button>)}</div>
            <div className="step-buttons"><Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft /> Back</Button><Button type="button" onClick={() => { if (pkg === "basic" && !styleKey) toast.error("Choose a template to continue."); else setStep(3); }}>Continue <ArrowRight /></Button></div>
          </section>}

          {step === 3 && <section>
            <h2 className="step-heading"><span className="step-number">3</span> Review and checkout</h2>
            <div className="preview-note">Next, you'll enter your details and see the payment QR. Your photos are made after the studio confirms your payment.</div>
            <div className="step-buttons"><Button type="button" variant="outline" disabled={busy} onClick={() => setStep(2)}><ArrowLeft /> Back</Button><Button type="submit" disabled={busy}>{busy ? "Opening checkout…" : "Proceed to Checkout"}<ArrowRight /></Button></div>
          </section>}
        </section>

        <aside className="order-summary" aria-label="Order summary">
          <p className="summary-label">Order summary</p>
          <div className="summary-item"><span className="summary-icon">{pkg === "premium" ? <Music /> : <Camera />}</span><div><strong>{packages[pkg].name}</strong><span>{packages[pkg].details}</span><span>{pkg === "premium" ? "All five styles" : chosenStyle?.name ?? "First template not selected"}</span></div></div>
          <div className="summary-total"><span>Total</span><strong>{peso(amount)}</strong></div>
          <div className="package-switch"><Button type="button" variant="outline" size="sm" aria-pressed={pkg === "basic"} onClick={() => setPkg("basic")}>Basic · {peso(pricing.basic)}</Button><Button type="button" variant="outline" size="sm" aria-pressed={pkg === "premium"} onClick={() => setPkg("premium")}>With music · {peso(pricing.premium)}</Button></div>
          <p className="summary-privacy"><LockKeyhole size={12} className="inline-block align-middle" /> Private upload · Deleted after 30 days</p>
        </aside>
      </form>
    </main>
    <SiteFooter />
  </div>;
}
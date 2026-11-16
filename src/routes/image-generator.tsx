import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { staffGenerateMetaImage } from "@/lib/meta-model.functions";

export const Route = createFileRoute("/image-generator")({
  head: () => ({ meta: [
    { title: "Image Generator | Pasko Photo Magic" },
    { name: "description", content: "Staff tool to create images from a text description." },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: "Image Generator | Pasko Photo Magic" },
    { property: "og:description", content: "Create images from a text description." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ImageGeneratorPage,
});

const SIZES = [
  { value: "1024x1024", label: "Square 1024x1024" },
  { value: "1024x1536", label: "Portrait 1024x1536" },
  { value: "1536x1024", label: "Landscape 1536x1024" },
] as const;

function ImageGeneratorPage() {
  const generate = useServerFn(staffGenerateMetaImage);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]["value"]>("1024x1024");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ image: string; prompt: string } | null>(null);

  useEffect(() => { setToken(window.sessionStorage.getItem("pasko-staff-token")); setReady(true); }, []);

  async function run() {
    if (!token) return;
    if (!prompt.trim()) { setError("Please describe your image."); return; }
    setBusy(true); setError("");
    try {
      const { image } = await generate({ data: { token, prompt, size } });
      setResult({ image, prompt });
    } catch (err) { setError(err instanceof Error ? err.message : "Generation failed."); }
    finally { setBusy(false); }
  }

  const src = result ? `data:image/png;base64,${result.image}` : "";
  return <div className="create-page"><SiteHeader /><main className="content-page"><section className="content-section">
    <p className="page-eyebrow">Staff tool</p><h1 className="section-heading">Image Generator</h1>
    {!ready ? null : !token ? <p className="section-lede">Please <Link to="/staff" className="underline">sign in with the studio PIN</Link> first.</p> : <div className="details-fields">
      <div><Label htmlFor="img-prompt">Prompt</Label><Textarea id="img-prompt" rows={4} placeholder="Describe your image..." value={prompt} onChange={(e) => setPrompt(e.target.value)} /></div>
      <div><Label htmlFor="img-size">Size</Label><select id="img-size" className="w-full rounded-md border border-input bg-background px-3 py-2" value={size} onChange={(e) => setSize(e.target.value as typeof size)}>{SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
      <Button type="button" onClick={() => void run()} disabled={busy}>{busy ? <><Loader2 className="animate-spin" /> Generating…</> : <><Sparkles /> Generate</>}</Button>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {result && <div className="space-y-3"><img src={src} alt={result.prompt} className="w-full rounded-xl" />
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={src} download="generated-image.png"><Download /> Download</a></Button>
        <Button type="button" variant="outline" onClick={() => setPrompt(result.prompt)}><RotateCcw /> Use as inspiration</Button></div></div>}
    </div>}
  </section></main><SiteFooter /></div>;
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Clock3, Copy, Download, ExternalLink, Image, LockKeyhole, Send, XCircle } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { packages, peso, STATUS_LABEL } from "@/lib/pasko-content";
import { PaidPhotoGallery } from "@/components/paid-photo-gallery";
import { useRandomSlideshowTrack } from "@/lib/slideshow-music";
import { Slideshow } from "@/components/order/Slideshow";
import { getCustomerOrder, submitPaymentProof } from "@/lib/orders.functions";
import MayaQr from "@/assets/maya-qr.jpeg.asset.json";
import GotymeQr from "@/assets/gotyme-qr.jpeg.asset.json";
import GcashQr from "@/assets/gcash-qr.jpeg.asset.json";

export const Route = createFileRoute("/order/$reference")({
  validateSearch: (search: Record<string, unknown>) => ({ t: typeof search["t"] === "string" ? search["t"] : "" }),
  loaderDeps: ({ search }) => ({ token: search.t }),
  loader: ({ params, deps }) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deps.token)
    ? getCustomerOrder({ data: { reference: params.reference, token: deps.token } })
    : null,
  head: () => ({ meta: [
    { title: "Your Order | Pasko Photo Magic" }, { name: "description", content: "View your secure Pasko Photo Magic order and payment instructions." },
    { name: "robots", content: "noindex" }, { property: "og:title", content: "Your Order | Pasko Photo Magic" },
    { property: "og:description", content: "Your Christmas portrait order." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: OrderPage,
});

const QR_OPTIONS = [
  { key: "gcash", name: "GCash", image: GcashQr.url },
  { key: "maya", name: "Maya", image: MayaQr.url },
  { key: "gotyme", name: "GoTyme Bank", image: GotymeQr.url },
] as const;

function OrderPage() {
  const slideshowTrack = useRandomSlideshowTrack();
  const { reference } = Route.useParams();
  const { t } = Route.useSearch();
  const order = Route.useLoaderData();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const submitPayment = useServerFn(submitPaymentProof);
  const [paymentReference, setPaymentReference] = useState(order?.paymentReference ?? "");
  const [screenshot, setScreenshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!order || creating || order.status === "completed" || order.status === "rejected") return undefined;
    const interval = window.setInterval(() => void router.invalidate(), 15_000);
    return () => window.clearInterval(interval);
  }, [order, creating, router]);

  async function selectScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      toast.error("Choose a JPG, PNG or WEBP screenshot up to 8 MB.");
      event.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setScreenshot(reader.result);
    reader.readAsDataURL(file);
  }

  async function sendPayment(referenceValue: string) {
    if (!t || referenceValue.trim().length < 4) { toast.error("Enter the payment reference number."); return; }
    setSaving(true);
    try {
      await submitPayment({ data: { reference, token: t, paymentReference: referenceValue.trim(), screenshot: screenshot || undefined } });
      toast.success("Payment sent for verification.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The payment could not be saved.");
    } finally { setSaving(false); }
  }

  async function saveReference(event: FormEvent) {
    event.preventDefault();
    await sendPayment(paymentReference);
  }

  async function copyOrderReference() {
    try { await navigator.clipboard.writeText(reference); setCopied(true); toast.success("Order number copied."); }
    catch { toast.error("Select and copy the order number instead."); }
  }

  if (!order) return <div className="create-page"><SiteHeader /><main className="content-page"><section className="content-section"><h1 className="section-heading">Order not found</h1><p className="section-lede">This private order link is invalid. Use your order number and mobile number to find the order.</p><Button asChild><Link to="/track">Find my order</Link></Button></section></main><SiteFooter /></div>;

  const status = STATUS_LABEL[order.status] ?? "Order received";
  const awaitingPayment = order.status === "pending_payment" || order.status === "rejected";
  return <div className="create-page"><SiteHeader /><main className="content-page order-page">
    <Link to="/track" className="back-link"><ArrowLeft size={16} /> Track another order</Link>
    <div className="order-page-heading"><span className="status-icon"><CheckCircle2 /></span><div><p className="summary-label">Order status</p><h1>{status}</h1></div></div>
    <section className="order-detail-band">
      <div><span>Order number</span><strong>{order.reference}</strong></div>
      <Button type="button" size="icon" variant="ghost" aria-label={copied ? "Order number copied" : "Copy order number"} onClick={() => void copyOrderReference()}><Copy /></Button>
    </section>
    <div className="order-page-grid">
      <section>
        <h2 className="step-heading">Your package</h2>
        <div className="order-package-line"><span>{packages[order.pkg].name}</span><strong>{peso(order.amount)}</strong></div>
        <p className="upload-tip">{packages[order.pkg].details} · {order.fullName}</p>

        {awaitingPayment && <>
          <h2 className="step-heading">Pay {peso(order.amount)} with GCash, Maya or GoTyme</h2>
          {order.status === "rejected" && <div className="status-message status-rejected"><XCircle size={20} /><div><strong>Your payment was not verified</strong><p>{order.paymentReference ? `Reference submitted: ${order.paymentReference}. ` : ""}Please check the amount and reference number, then submit again.</p></div></div>}
          <div className="preview-note"><LockKeyhole size={16} /> Scan one QR code and send the exact amount of <strong>{peso(order.amount)}</strong>. Then enter your reference number below.</div>
          <div className="qr-grid">
            {QR_OPTIONS.map((option) => <figure key={option.key} className="qr-card">
              <img src={option.image} alt={`${option.name} QR code`} loading="lazy" />
              <figcaption><strong>{option.name}</strong><span>{peso(order.amount)}</span><small>Scan this QR, then enter your Reference Number below.</small></figcaption>
            </figure>)}
          </div>
          <form className="payment-reference-form" onSubmit={saveReference}>
            <label htmlFor="payment-reference">Payment reference number</label>
            <div className="reference-input-row"><Input id="payment-reference" minLength={4} maxLength={60} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Enter your transfer reference" required /></div>
            <label htmlFor="payment-screenshot">Screenshot of payment (optional)</label>
            <div className="reference-input-row"><Input id="payment-screenshot" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectScreenshot(event)} /></div>
            {screenshot && <img className="proof-preview" src={screenshot} alt="Payment screenshot preview" />}
            <Button type="submit" className="w-full" disabled={saving}>{saving ? "Sending…" : "I have paid – Submit Reference"}<Send /></Button>
          </form>
        </>}

        {order.status === "pending_verification" && <div className="status-message"><Clock3 size={20} /><div><strong>Waiting for verification</strong><p>Order {order.reference} · Reference {order.paymentReference}. The studio usually reviews payments within a few hours. This page updates automatically.</p></div></div>}

        {!awaitingPayment && order.status !== "pending_verification" && <div className="status-message"><Clock3 size={20} /><div><strong>{status}</strong><p>{order.paymentReference ? `Payment reference: ${order.paymentReference}` : "We'll update this page after your payment is reviewed."}</p></div></div>}
      </section>
      <aside className="order-photo-aside">
        <h2 className="step-heading"><Image size={19} /> Your photos</h2>
        {["payment_verified", "processing", "failed", "completed"].includes(order.status) ? <PaidPhotoGallery reference={reference} token={t} status={order.status} images={order.resultSlots} error={order.generationError} onBusy={setCreating} /> : <div className="result-placeholder"><span className="upload-icon"><Clock3 /></span><strong>Your photos will appear here</strong><p>Five Christmas portraits are created after payment is confirmed.</p></div>}
        {order.pkg === "premium" && order.results.length === 5 && slideshowTrack && <Slideshow images={order.results} musicUrl={slideshowTrack?.url ?? ""} musicTitle={slideshowTrack?.title ?? ""} fileName={`${reference}-slideshow`} autoStart />}
        {order.originalUrl && <details className="original-photo-details"><summary>View uploaded photo</summary><a href={order.originalUrl} target="_blank" rel="noreferrer"><img src={order.originalUrl} alt="Uploaded original photo" /><span>Open original <ExternalLink size={14} /></span></a></details>}
        <p className="summary-privacy"><LockKeyhole size={12} className="inline-block align-middle" /> Private link · Photos deleted after 30 days</p>
      </aside>
    </div>
    <p className="order-help">Need help? <Link to="/contact">Contact the studio</Link> and share your order number.</p>
  </main><SiteFooter /></div>;
}

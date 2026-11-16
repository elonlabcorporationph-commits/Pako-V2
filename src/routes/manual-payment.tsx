import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Landmark, QrCode } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageFrame } from "@/components/pasko-pages";
import { DEFAULT_PRICES, packages, peso, type PackageId } from "@/lib/pasko-content";
import { getSiteData } from "@/lib/orders.functions";
import { submitManualPayment } from "@/lib/payments.functions";

export const Route = createFileRoute("/manual-payment")({
  loader: () => getSiteData(),
  head: () => ({ meta: [
    { title: "Submit Payment Proof | Pasko Photo Magic" }, { name: "description", content: "Submit payment proof for a Pasko Photo Magic package." },
    { property: "og:title", content: "Submit Payment Proof | Pasko Photo Magic" }, { property: "og:description", content: "Send your payment reference and proof for studio review." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ManualPaymentPage,
});

function ManualPaymentPage() {
  const data = Route.useLoaderData();
  const submit = useServerFn(submitManualPayment);
  const [pkg, setPkg] = useState<PackageId | null>(null);
  const [method, setMethod] = useState<"bank" | "gcash_qr" | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const prices = data.pricing ?? DEFAULT_PRICES;
  const instruction = method ? data.payment[method === "bank" ? "bank" : "gcash"] : "";

  async function selectProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      toast.error("Choose a JPG or PNG screenshot up to 8 MB.");
      event.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && setProof(reader.result);
    reader.readAsDataURL(file);
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault();
    if (!pkg || !method || !proof) { toast.error("Choose a package, payment method, and screenshot."); return; }
    setBusy(true);
    try {
      await submit({ data: { customerName, phone, email, packageId: pkg, paymentMethod: method, referenceNumber, amount: Number(amount), senderName, proof } });
      setComplete(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Your payment could not be submitted."); }
    finally { setBusy(false); }
  }

  if (complete) return <PageFrame><section className="content-section payment-success"><CheckCircle2 size={46} /><p className="page-eyebrow">Payment submitted</p><h1 className="section-heading">Your payment is being reviewed</h1><p className="section-lede">The studio received your payment proof and will review it shortly.</p></section></PageFrame>;

  return <PageFrame><form className="content-section manual-payment-form" onSubmit={submitForm}><p className="page-eyebrow">Secure payment review</p><h1 className="section-heading">Submit payment proof</h1>
    <section className="manual-payment-section"><h2>1. Choose a package</h2><div className="package-choice-row">{(Object.keys(packages) as PackageId[]).map((id) => <Button key={id} type="button" variant="outline" aria-pressed={pkg === id} className="manual-package-choice" onClick={() => { setPkg(id); setAmount(String(prices[id])); }}><strong>{packages[id].name}</strong><span>{peso(prices[id])}</span></Button>)}</div></section>
    {pkg && <section className="manual-payment-section"><h2>2. Your details</h2><div className="manual-fields"><div><Label htmlFor="manual-name">Full name</Label><Input id="manual-name" required maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div><div><Label htmlFor="manual-phone">Phone number</Label><Input id="manual-phone" required maxLength={24} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div><Label htmlFor="manual-email">Email address</Label><Input id="manual-email" type="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} /></div></div></section>}
    {pkg && <section className="manual-payment-section"><h2>3. Payment method</h2><div className="package-choice-row"><Button type="button" variant="outline" aria-pressed={method === "bank"} onClick={() => setMethod("bank")}><Landmark /> Bank transfer</Button><Button type="button" variant="outline" aria-pressed={method === "gcash_qr"} onClick={() => setMethod("gcash_qr")}><QrCode /> GCash QR</Button></div>
      {method && <div className="payment-instructions">{instruction ? <p>{instruction}</p> : <p>Payment instructions for this method have not been confirmed yet. Please contact the studio before sending payment.</p>}<strong>Amount expected: {peso(prices[pkg])}</strong></div>}
    </section>}
    {pkg && method && <section className="manual-payment-section"><h2>4. Upload proof of payment</h2><div className="manual-fields"><div><Label htmlFor="proof-file">Screenshot (JPG or PNG)</Label><Input id="proof-file" type="file" accept="image/jpeg,image/png" required onChange={(event) => void selectProof(event)} /></div><div><Label htmlFor="manual-reference">Reference number</Label><Input id="manual-reference" required minLength={4} maxLength={60} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} /></div><div><Label htmlFor="manual-amount">Amount paid</Label><Input id="manual-amount" required type="number" min={1} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div><Label htmlFor="sender-name">Sender name</Label><Input id="sender-name" required minLength={2} maxLength={100} value={senderName} onChange={(event) => setSenderName(event.target.value)} /></div></div>{proof && <img className="proof-preview" src={proof} alt="Payment proof preview" />}<Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</Button></section>}
  </form></PageFrame>;
}
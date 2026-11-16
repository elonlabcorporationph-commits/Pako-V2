import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/pasko-pages";
import { peso } from "@/lib/pasko-content";
import { getPayOrderStatus, renderPayOrder } from "@/lib/pay.functions";
import { PAY_STATUS_LABEL } from "@/lib/pay-qr";

export const Route = createFileRoute("/status/$code")({
  validateSearch: (search: Record<string, unknown>) => ({ t: typeof search["t"] === "string" ? search["t"] : undefined }),
  head: () => ({ meta: [
    { title: "Order Status | Pasko Photo Magic" }, { name: "description", content: "Check whether your payment has been verified." },
    { name: "robots", content: "noindex" }, { property: "og:title", content: "Order Status | Pasko Photo Magic" },
    { property: "og:description", content: "Your payment verification status." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: StatusPage,
});

const TARGET_MS = 30 * 60_000;

function StatusPage() {
  const { code } = Route.useParams();
  const { t } = Route.useSearch();
  const fetchStatus = useServerFn(getPayOrderStatus);
  const render = useServerFn(renderPayOrder);
  const qc = useQueryClient();
  const { data: order, isLoading, error } = useQuery({ queryKey: ["pay-status", code, t], queryFn: () => fetchStatus({ data: { code, token: t } }), refetchInterval: 10_000 });
  const [rendering, setRendering] = useState(false);
  const shouldRender = Boolean(t && order?.owner && order.status === "verified" && (order.render_status === "queued" || order.render_status === "failed"));
  useEffect(() => {
    if (!shouldRender || rendering || !t || order?.render_status !== "queued" || true) return; // rendering now runs on the server when staff verifies
    setRendering(true);
    render({ data: { code, token: t } }).catch(() => undefined).finally(() => { setRendering(false); void qc.invalidateQueries({ queryKey: ["pay-status", code, t] }); });
  }, [shouldRender]); // eslint-disable-line react-hooks/exhaustive-deps
  function retry() {
    if (!t) return;
    setRendering(true);
    render({ data: { code, token: t } }).catch(() => undefined).finally(() => { setRendering(false); void qc.invalidateQueries({ queryKey: ["pay-status", code, t] }); });
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (isLoading) return <PageFrame><section className="content-section"><p>Loading your order…</p></section></PageFrame>;
  if (error) return <PageFrame><section className="content-section"><p>We couldn't load your order. Please refresh.</p></section></PageFrame>;
  if (!order) return <PageFrame><section className="content-section"><h1 className="section-heading">Order not found</h1><p>Check the code and try again on the <Link to="/track" className="underline">tracking page</Link>.</p></section></PageFrame>;
  const left = new Date(order.created_at).getTime() + TARGET_MS - now;
  const tone = order.status === "verified" ? "bg-primary text-primary-foreground" : order.status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground";
  return <PageFrame><section className="content-section" style={{ maxWidth: 560, margin: "0 auto" }}>
    <p className="page-eyebrow">Your order code</p><h1 className="section-heading">{order.code}</h1>
    <p>Save this code to check your order later.</p>
    <p className="mt-4">{order.package_name} · {peso(order.amount)}</p>
    <span className={`mt-3 inline-block rounded-full px-4 py-1 font-semibold ${tone}`}>{PAY_STATUS_LABEL[order.status]}</span>
    {order.status === "rejected" && order.note && <p className="mt-3">Reason: {order.note}</p>}
    {order.status === "pending" && <p className="mt-3 text-muted-foreground">{left > 0 ? `We usually verify within ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` : "Taking a bit longer… we'll verify it soon."}</p>}
    {order.status === "verified" && order.owner && <div className="mt-6">
      {(rendering || order.render_status === "processing" || order.render_status === "queued") && <p className="font-semibold">✨ Making your 5 Christmas photos… this takes about a minute. You can close this page — they will be here when you come back.</p>}
      {order.render_status === "failed" && !rendering && <div><p>Some photos could not be made yet.</p><Button type="button" className="mt-2" onClick={retry}>Try again</Button></div>}
      {order.photos.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{order.photos.map((url, i) =>
        <a key={url} href={url} target="_blank" rel="noopener" download={`pasko-photo-${i + 1}.png`}><img src={url} alt={`Christmas photo ${i + 1}`} className="w-full rounded border" /><span className="text-xs underline">Save photo {i + 1}</span></a>)}</div>}
    </div>}
    {order.status === "verified" && !order.owner && <p className="mt-4 text-sm text-muted-foreground">Open the private order link from checkout to see your photos.</p>}
    <p className="mt-6 text-sm text-muted-foreground">This page updates automatically.</p>
  </section></PageFrame>;
}

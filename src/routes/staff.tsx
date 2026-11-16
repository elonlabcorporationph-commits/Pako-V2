import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Download, ImageIcon, KeyRound, LogOut, RefreshCw, RotateCcw, Sparkles, Wallet, X, AlertTriangle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { peso } from "@/lib/pasko-content";
import { staffPinLogin } from "@/lib/staff.functions";
import { staffListPayMethods, staffPayOrderDetail, staffPayOrders, staffReopenPayOrder, staffReviewPayOrder, staffSavePayMethod, staffPaySummary, staffRerenderPayOrder } from "@/lib/pay.functions";
import { DEFAULT_QR, PAY_STATUS_LABEL, readFileAsDataUrl } from "@/lib/pay-qr";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [
    { title: "Staff Dashboard | Pasko Photo Magic" }, { name: "description", content: "Verify customer payments for Pasko Photo Magic." },
    { name: "robots", content: "noindex" }, { property: "og:title", content: "Staff Dashboard | Pasko Photo Magic" },
    { property: "og:description", content: "Payment verification dashboard." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: StaffPage,
});

const TOKEN_KEY = "pasko-staff-token";
type Status = "pending" | "verified" | "rejected" | "all";

function StaffPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(window.sessionStorage.getItem(TOKEN_KEY)); }, []);
  const signOut = () => { window.sessionStorage.removeItem(TOKEN_KEY); setToken(null); };
  return <><SiteHeader /><main className="content-section" style={{ maxWidth: 1200, margin: "0 auto" }}>
    {token ? <Dashboard token={token} onSignOut={signOut} /> : <PinGate onLogin={(t) => { window.sessionStorage.setItem(TOKEN_KEY, t); setToken(t); }} />}
  </main><SiteFooter /></>;
}

function PinGate({ onLogin }: { onLogin: (t: string) => void }) {
  const login = useServerFn(staffPinLogin);
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { onLogin((await login({ data: { pin } })).token); } catch (err) { toast.error(err instanceof Error ? err.message : "Wrong PIN."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mx-auto grid max-w-xs gap-3"><h1 className="section-heading">Staff sign in</h1>
    <Label htmlFor="pin">PIN</Label><Input id="pin" type="password" inputMode="numeric" autoComplete="off" required value={pin} onChange={(e) => setPin(e.target.value)} />
    <Button disabled={busy}>{busy ? "Checking…" : "Enter"}<KeyRound /></Button></form>;
}

function useStaffCall<T>(fn: T, onSignOut: () => void) {
  return { fn, fail: (err: unknown) => { const msg = err instanceof Error ? err.message : "Something went wrong."; toast.error(msg); if (/session|PIN/i.test(msg)) onSignOut(); } };
}

function Dashboard({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [tab, setTab] = useState<"queue" | "all" | "methods">("queue");
  return <>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h1 className="section-heading mr-auto">Payments</h1>
      {(["queue", "all", "methods"] as const).map((t) => <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>{t === "queue" ? "Review queue" : t === "all" ? "All orders" : "Payment methods"}</Button>)}
      <Button variant="ghost" size="sm" onClick={onSignOut}><LogOut />Sign out</Button>
    </div>
    <Summary token={token} onSignOut={onSignOut} />
    {tab === "methods" ? <Methods token={token} onSignOut={onSignOut} /> : <Orders key={tab} token={token} onSignOut={onSignOut} queue={tab === "queue"} />}
  </>;
}

// Alerts staff (toast, chime, phone notification) when a new payment arrives in the queue.
function usePaymentAlerts(ids: string[] | null, count: number) {
  const [seen, setSeen] = useState<Set<string> | null>(null);
  useEffect(() => { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); }, []);
  useEffect(() => {
    if (!ids) return;
    if (seen === null) { setSeen(new Set(ids)); return; }
    const fresh = ids.filter((id) => !seen.has(id));
    if (fresh.length) {
      const msg = fresh.length === 1 ? "New payment received!" : `${fresh.length} new payments received!`;
      toast.success(msg, { description: "Check the receipt and approve." });
      try { const ctx = new AudioContext(); [880, 1320].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f; g.gain.value = 0.15; o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.15); }); } catch { /* ignore */ }
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Pasko Photo Magic", { body: msg, icon: "/icon-192.png" }); } catch { /* ignore */ }
      setSeen(new Set([...seen, ...ids]));
    }
    document.title = count ? `(${count}) Staff | Pasko Photo Magic` : "Staff | Pasko Photo Magic";
  }, [ids?.join(","), count]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Summary({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const fn = useServerFn(staffPaySummary); const { fail } = useStaffCall(null, onSignOut);
  const q = useQuery({ queryKey: ["pay-summary"], queryFn: () => fn({ data: { token } }), refetchInterval: 15_000, retry: false });
  useEffect(() => { if (q.error) fail(q.error); }, [q.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = q.data;
  const cards = [
    { icon: Wallet, label: "Income today", value: d ? peso(d.todayIncome) : "…", sub: d ? `${d.todayOrders} orders today` : "" },
    { icon: Sparkles, label: "Total income", value: d ? peso(d.totalIncome) : "…", sub: d ? `${d.totalOrders} orders total` : "" },
    { icon: Clock, label: "Waiting review", value: d ? String(d.pending) : "…", sub: "payments to check", alert: Boolean(d?.pending) },
    { icon: ImageIcon, label: "Photos", value: d ? `${d.done} done` : "…", sub: d ? `${d.rendering} making · ${d.renderFailed} failed` : "", alert: Boolean(d?.renderFailed) },
  ];
  return <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map((c) => <div key={c.label} className={`rounded-xl border bg-card p-4 shadow-sm ${c.alert ? "border-primary" : ""}`}>
    <div className="flex items-center gap-2 text-sm text-muted-foreground"><c.icon className="size-4" />{c.label}</div>
    <div className="mt-1 text-2xl font-bold">{c.value}</div><div className="text-xs text-muted-foreground">{c.sub}</div>
  </div>)}</div>;
}

const RENDER_LABEL: Record<string, string> = { done: "Photos ready", failed: "Photos failed", processing: "Making photos", queued: "Photos queued" };
function StatusBadge({ status, render }: { status: string; render?: string | null }) {
  const label = status === "verified" && render ? RENDER_LABEL[render] ?? PAY_STATUS_LABEL[status as "verified"] : PAY_STATUS_LABEL[status as "pending"];
  const tone = status === "rejected" || render === "failed" ? "bg-destructive/15 text-destructive" : status === "pending" ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{render === "failed" && <AlertTriangle className="size-3" />}{label}</span>;
}

function waited(created: string) { return Math.floor((Date.now() - new Date(created).getTime()) / 60000); }

function Orders({ token, onSignOut, queue }: { token: string; onSignOut: () => void; queue: boolean }) {
  const list = useServerFn(staffPayOrders);
  const { fail } = useStaffCall(null, onSignOut);
  const [status, setStatus] = useState<Status>(queue ? "pending" : "all");
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["pay-orders", status, search], queryFn: () => list({ data: { token, status, search } }), refetchInterval: 15_000, refetchIntervalInBackground: true, retry: false });
  useEffect(() => { if (q.error) fail(q.error); }, [q.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const orders = q.data ?? [];
  usePaymentAlerts(queue ? orders.map((o) => o.id) : null, orders.length);
  useEffect(() => { if (queue && orders.length && (!selected || !orders.some((o) => o.id === selected))) setSelected(orders[0]!.id); }, [orders.map((o) => o.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || !orders.length) return;
      const i = orders.findIndex((o) => o.id === selected);
      if (e.key === "j" || e.key === "ArrowDown") { setSelected(orders[Math.min(orders.length - 1, i + 1)]!.id); e.preventDefault(); }
      if (e.key === "k" || e.key === "ArrowUp") { setSelected(orders[Math.max(0, i - 1)]!.id); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [orders, selected]);
  function exportCsv() {
    const cols = ["code", "created_at", "customer_name", "contact", "package_name", "amount", "method", "reference", "status", "note"] as const;
    const csv = [cols.join(","), ...orders.map((o) => cols.map((c) => `"${String(o[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "pasko-orders.csv"; a.click();
  }
  return <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div>
      {!queue && <div className="mb-3 flex flex-wrap gap-2">
        <Input placeholder="Search code, name or reference" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select className="rounded-md border bg-background px-2" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {(["all", "pending", "verified", "rejected"] as const).map((s) => <option key={s} value={s}>{s === "all" ? "All" : PAY_STATUS_LABEL[s]}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!orders.length}><Download />CSV</Button>
      </div>}
      <div className="mb-2 flex items-center gap-2"><Button variant="ghost" size="sm" onClick={() => void q.refetch()}><RefreshCw />Refresh</Button><span className="hidden text-xs text-muted-foreground md:inline">Keys: J/K move · V verify · Enter note to reject</span></div>
      {q.isLoading ? <p>Loading orders…</p> : q.error ? <p>Orders could not be loaded.</p> : !orders.length ? <p className="text-muted-foreground">{queue ? "No payments waiting. 🎄" : "No orders found."}</p> :
        <ul className="grid gap-2">{orders.map((o) => { const m = waited(o.created_at); return <li key={o.id}>
          <button type="button" onClick={() => setSelected(o.id)} className={`w-full rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/60 ${selected === o.id ? "border-primary ring-2 ring-primary/30" : ""}`}>
            <div className="flex justify-between gap-2"><strong>{o.code}</strong><span className="font-semibold">{peso(o.amount)} <span className="text-xs uppercase text-muted-foreground">{o.method}</span></span></div>
            <div className="text-sm">{o.customer_name} · {o.contact}</div>
            <div className="text-sm text-muted-foreground">{o.package_name} · Ref {o.reference}</div>
            <div className="mt-1 flex items-center gap-2"><StatusBadge status={o.status} render={o.render_status} />{o.status === "pending" && <span className={`text-xs ${m >= 30 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>Waiting {m} min</span>}</div>
          </button></li>; })}</ul>}
    </div>
    <div className="lg:sticky lg:top-4 lg:self-start">{selected ? <Detail key={selected} id={selected} token={token} onSignOut={onSignOut} /> : <p className="text-muted-foreground">Select an order to review.</p>}</div>
  </div>;
}

function Detail({ id, token, onSignOut }: { id: string; token: string; onSignOut: () => void }) {
  const rerender = useServerFn(staffRerenderPayOrder);
  const detail = useServerFn(staffPayOrderDetail); const review = useServerFn(staffReviewPayOrder); const reopen = useServerFn(staffReopenPayOrder);
  const { fail } = useStaffCall(null, onSignOut); const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pay-detail", id], queryFn: () => detail({ data: { token, id } }), retry: false });
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  async function act(run: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await run(); toast.success(done); setNote(""); await qc.invalidateQueries({ queryKey: ["pay-orders"] }); await qc.invalidateQueries({ queryKey: ["pay-summary"] }); await q.refetch(); } catch (err) { fail(err); } finally { setBusy(false); }
  }
  const pendingNow = q.data?.order.status === "pending";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName !== "INPUT" && e.key === "v" && pendingNow && !busy) void act(() => review({ data: { token, id, status: "verified", note } }), "Payment verified — photos rendered on server"); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }); 
  if (q.isLoading) return <p>Loading…</p>;
  if (!q.data) return <p>Order could not be loaded.</p>;
  const { order, events, method, proofUrls, qrUrl, similar } = q.data;
  return <div className="rounded-xl border bg-card p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{order.code} · {peso(order.amount)}</h2><StatusBadge status={order.status} render={order.render_status} /></div>
    <p className="text-sm text-muted-foreground">{order.package_name} · {new Date(order.created_at).toLocaleString()}</p>
    <p>{order.customer_name} · {order.contact}</p><p className="text-sm">{method?.label ?? order.method} · Ref <strong>{order.reference}</strong></p>
    {similar.length > 0 && <p className="mt-2 rounded bg-destructive/10 p-2 text-sm text-destructive">Careful: {similar.join(", ")} paid the same amount within 5 minutes.</p>}
    <div className="mt-3 grid grid-cols-2 gap-3">
      <figure><figcaption className="text-sm">Expected QR</figcaption><img src={qrUrl ?? DEFAULT_QR[order.method]} alt="Payment QR" className="rounded" /></figure>
      <figure><figcaption className="text-sm">Customer receipt{proofUrls.length > 1 ? `s (${proofUrls.length})` : ""}</figcaption>{proofUrls.length ? <div className="grid gap-2">{proofUrls.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Receipt ${i + 1}`} className="max-h-[480px] w-full rounded border object-contain" /></a>)}</div> : <p>No receipt</p>}</figure>
    </div>
    {order.status === "verified" && order.render_status !== "done" && <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-2 text-sm">
      <span className="mr-auto">{busy ? "Making the 5 photos on the server…" : RENDER_LABEL[order.render_status] ?? "Photos not made"}</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() => rerender({ data: { token, id } }), "Photos re-rendered")}><Sparkles />Re-render</Button>
    </div>}
    <p className="mt-3"><strong>{PAY_STATUS_LABEL[order.status]}</strong>{order.note ? ` — ${order.note}` : ""}</p>
    <Input className="mt-2" placeholder={order.status === "pending" ? "Note (required to reject)" : "Reason for reopening"} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && order.status === "pending" && note.trim() && !busy) void act(() => review({ data: { token, id, status: "rejected", note } }), "Payment rejected"); }} maxLength={300} />
    <div className="mt-2 flex gap-2">
      {order.status === "pending" ? <>
        <Button disabled={busy} onClick={() => void act(() => review({ data: { token, id, status: "verified", note } }), "Payment verified — photos rendered on server")}>{busy ? <><RefreshCw className="animate-spin" />Rendering…</> : <><Check />Verify</>}</Button>
        <Button variant="destructive" disabled={busy || !note.trim()} onClick={() => void act(() => review({ data: { token, id, status: "rejected", note } }), "Payment rejected")}><X />Reject</Button>
      </> : <Button variant="outline" disabled={busy} onClick={() => void act(() => reopen({ data: { token, id, note } }), "Order reopened")}><RotateCcw />Reopen</Button>}
    </div>
    <h3 className="mt-4 font-semibold">History</h3>
    {events.length ? <ul className="text-sm">{events.map((ev) => <li key={ev.id}>{new Date(ev.created_at).toLocaleString()} · {ev.actor}: {ev.from_status} → {ev.to_status}{ev.note ? ` (${ev.note})` : ""}</li>)}</ul> : <p className="text-sm text-muted-foreground">No changes yet.</p>}
  </div>;
}

function Methods({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const list = useServerFn(staffListPayMethods);
  const q = useQuery({ queryKey: ["staff-methods"], queryFn: () => list({ data: { token } }), retry: false });
  if (q.isLoading) return <p>Loading…</p>;
  if (!q.data) return <p>Payment methods could not be loaded.</p>;
  return <div className="grid gap-4 md:grid-cols-3">{q.data.map((m) => <MethodCard key={m.method} m={m} token={token} onSignOut={onSignOut} onSaved={() => void q.refetch()} />)}</div>;
}

function MethodCard({ m, token, onSignOut, onSaved }: { m: { method: string; label: string; account_name: string | null; account_number: string | null; active: boolean; qr_url: string | null }; token: string; onSignOut: () => void; onSaved: () => void }) {
  const save = useServerFn(staffSavePayMethod); const { fail } = useStaffCall(null, onSignOut);
  const [name, setName] = useState(m.account_name ?? ""); const [num, setNum] = useState(m.account_number ?? ""); const [active, setActive] = useState(m.active);
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await save({ data: { token, method: m.method, account_name: name, account_number: num, active, qr: file ? await readFileAsDataUrl(file) : undefined } }); toast.success(`${m.label} saved`); onSaved(); }
    catch (err) { fail(err); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-2 rounded-lg border bg-card p-4">
    <h3 className="font-bold">{m.label}</h3>
    <img src={m.qr_url ?? DEFAULT_QR[m.method]} alt={`${m.label} QR`} className="max-h-48 rounded object-contain" />
    <Label>New QR image</Label><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    <Label>Account name</Label><Input value={name} onChange={(e) => setName(e.target.value)} />
    <Label>Account number</Label><Input value={num} onChange={(e) => setNum(e.target.value)} />
    <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Show to customers</label>
    <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
  </form>;
}

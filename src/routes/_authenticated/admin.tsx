import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, LogOut, RefreshCw, Save, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { AdminPhotoTest } from "@/components/admin-photo-test";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, generateOrderPhoto, getAdminSettings, listManualPayments, listOrders, reviewManualPayment, saveAdminSettings, updateOrderPayment } from "@/lib/admin.functions";
import { DEFAULT_PRICES, STATUS_LABEL, peso } from "@/lib/pasko-content";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Studio Orders | Pasko Photo Magic" }, { name: "description", content: "Review orders and payment submissions for Pasko Photo Magic." },
    { name: "robots", content: "noindex" }, { property: "og:title", content: "Studio Orders | Pasko Photo Magic" },
    { property: "og:description", content: "Staff order and payment management." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AdminPage,
});

const statusFilter = ["all", "pending_payment", "payment_verified", "processing", "completed", "failed"] as const;

function AdminPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const checkAdmin = useServerFn(checkIsAdmin);
  const fetchOrders = useServerFn(listOrders);
  const updatePayment = useServerFn(updateOrderPayment);
  const generatePhoto = useServerFn(generateOrderPhoto);
  const fetchPayments = useServerFn(listManualPayments);
  const fetchSettings = useServerFn(getAdminSettings);
  const saveSettingsFn = useServerFn(saveAdminSettings);
  const reviewPayment = useServerFn(reviewManualPayment);
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<(typeof statusFilter)[number]>("all");
  const [workingId, setWorkingId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prices, setPrices] = useState<{ basic: number; premium: number }>({ ...DEFAULT_PRICES });
  const [accounts, setAccounts] = useState({ gcash: "", maya: "", bank: "" });
  const [retentionDays, setRetentionDays] = useState(30);
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const { data: ordersData, refetch, isLoading } = useQuery({ queryKey: ["admin-orders", searchText, status], queryFn: () => fetchOrders({ data: { search: searchText.trim() || undefined, status } }), enabled: isStaff === true });
  const { data: payments, refetch: refreshPayments } = useQuery({ queryKey: ["admin-payments"], queryFn: () => fetchPayments(), enabled: isStaff === true });

  useEffect(() => {
    let current = true;
    checkAdmin().then(({ isAdmin: admin }) => { if (current) setIsStaff(admin); }).catch(() => { if (current) setIsStaff(false); });
    return () => { current = false; };
  }, [checkAdmin]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.navigate({ to: "/auth", replace: true });
  }

  async function loadSettings() {
    try {
      const data = await fetchSettings();
      setPrices({ basic: data.pricing.basic ?? 99, premium: data.pricing.premium ?? 149 });
      setAccounts({ gcash: data.payment.gcash ?? "", maya: data.payment.maya ?? "", bank: data.payment.bank ?? "" });
      setRetentionDays(data.retentionDays);
      setSettingsOpen(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Settings unavailable."); }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      await saveSettingsFn({ data: { pricing: prices, payment: accounts, retentionDays } });
      toast.success("Studio settings saved.");
      setSettingsOpen(false);
      await queryClient.invalidateQueries();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Settings could not be saved."); }
  }

  async function doWork(orderId: string, action: () => Promise<unknown>, success: string) {
    setWorkingId(orderId);
    try { await action(); toast.success(success); await refetch(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Action could not be completed."); }
    finally { setWorkingId(""); }
  }

  async function reviewManual(id: string, approved: boolean) {
    setWorkingId(id);
    try { await reviewPayment({ data: { id, approved } }); toast.success(approved ? "Payment marked approved." : "Payment marked rejected."); await refreshPayments(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setWorkingId(""); }
  }

  if (isStaff === null) return <div className="create-page"><SiteHeader /><main className="content-page"><h1>Checking staff access…</h1></main><SiteFooter /></div>;
  if (!isStaff) return <div className="create-page"><SiteHeader /><main className="content-page auth-page"><section className="auth-form-section"><ShieldCheck /><h1>Staff access only</h1><p>This account is not authorized to open the studio dashboard.</p><Button asChild><Link to="/">Back to the studio</Link></Button><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></section></main><SiteFooter /></div>;

  const stats = ordersData?.stats ?? { total: 0, paid: 0, waiting: 0, completed: 0 };
  return <div className="create-page"><SiteHeader /><main className="admin-page">
    <div className="admin-topline"><div><p className="page-eyebrow">Private studio</p><h1>Orders &amp; payments</h1></div><div className="admin-actions"><AdminPhotoTest /><Button type="button" variant="outline" onClick={() => window.dispatchEvent(new Event("santa:fly"))}>🎅 Test Santa</Button><Button type="button" variant="outline" onClick={() => void loadSettings()}><Save /> Settings</Button><Button type="button" variant="ghost" size="icon" aria-label="Refresh orders" onClick={() => { void refetch(); void refreshPayments(); }}><RefreshCw /></Button><Button type="button" variant="outline" onClick={() => void signOut()}><LogOut /> Sign out</Button></div></div>
    <section className="admin-stats" aria-label="Order totals"><article><span>Total orders</span><strong>{stats.total}</strong></article><article><span>Orders awaiting payment</span><strong>{stats.waiting}</strong></article><article><span>Verified sales</span><strong>{peso(stats.paid)}</strong></article><article><span>Completed orders</span><strong>{stats.completed}</strong></article></section>
    <section className="admin-section"><div className="admin-section-heading"><div><h2>Photo orders</h2><p>Review payment references and prepare the five portraits.</p></div><div className="admin-filters"><label className="admin-search"><Search size={16} /><Input aria-label="Search orders" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Name, number, or order" /></label><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as (typeof statusFilter)[number])}>{statusFilter.map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : STATUS_LABEL[value]}</option>)}</select></div></div>
      {isLoading ? <p className="admin-empty">Loading orders…</p> : ordersData?.orders.length ? <div className="admin-order-list">{ordersData.orders.map((order) => <article className="admin-order" key={order.id}>
        <div className="admin-order-main"><div className="admin-order-heading"><strong>{order.reference}</strong><span className={`status-pill status-${order.status}`}>{STATUS_LABEL[order.status] ?? order.status}</span></div><h3>{order.full_name}</h3><p>{order.mobile}{order.email ? ` · ${order.email}` : ""}</p><p>{order.package === "premium" ? "Magic with Music" : "Basic Magic"} · {peso(order.amount)} · {order.payment_method === "bank" ? "Bank transfer" : order.payment_method.toUpperCase()}</p><p>Payment reference: <strong>{order.payment_reference ?? "Not submitted"}</strong></p></div>
        <div className="admin-order-actions">{order.status === "pending_payment" && <Button type="button" size="sm" onClick={() => void doWork(order.id, () => updatePayment({ data: { id: order.id, verified: true } }), "Payment verified.")} disabled={workingId === order.id}><Check /> Verify payment</Button>}{order.status === "payment_verified" || order.status === "processing" || order.status === "failed" ? <div className="generation-buttons">{[0, 1, 2, 3, 4].map((index) => <Button type="button" key={index} size="sm" variant={order.result_paths[index] ? "secondary" : "outline"} aria-label={`${order.result_paths[index] ? "Regenerate" : "Create"} portrait ${index + 1} for ${order.reference}`} onClick={() => void doWork(order.id, () => generatePhoto({ data: { id: order.id, index } }), `Portrait ${index + 1} created.`)} disabled={workingId === order.id || !order.payment_verified_at}>{order.result_paths[index] ? <Check /> : <Sparkles />}{index + 1}</Button>)}</div> : null}<p><Clock3 size={13} /> Expires {new Date(order.expires_at).toLocaleDateString()}</p></div>
      </article>)}</div> : <p className="admin-empty">No orders match this view.</p>}
    </section>
    <section className="admin-section"><div className="admin-section-heading"><div><h2>Manual payment submissions</h2><p>Private proof images are visible only to staff.</p></div></div>{payments?.length ? <div className="admin-payment-list">{payments.map((payment) => <article className="admin-payment" key={payment.id}><div><strong>{payment.customer_name}</strong><p>{payment.package_name} · {peso(Number(payment.amount))} · {payment.payment_method === "bank" ? "Bank transfer" : "GCash QR"}</p><p>Ref: {payment.reference_number} · Sender: {payment.sender_name}</p><p>{payment.email} · {payment.phone}</p><span className="status-pill">{payment.status}</span></div>{payment.proof_url && <a className="payment-proof-link" href={payment.proof_url} target="_blank" rel="noreferrer"><img src={payment.proof_url} alt="Payment proof" />View proof</a>}<div className="admin-order-actions"><Button type="button" size="sm" onClick={() => void reviewManual(payment.id, true)} disabled={workingId === payment.id}><Check /> Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => void reviewManual(payment.id, false)} disabled={workingId === payment.id}><X /> Reject</Button></div></article>)}</div> : <p className="admin-empty">No manual payment submissions yet.</p>}</section>
  </main><SiteFooter />
    {settingsOpen && <div className="settings-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="settings-heading"><h2 id="settings-title">Studio settings</h2><Button type="button" variant="ghost" size="icon" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X /></Button></div><form className="details-fields" onSubmit={saveSettings}><div className="settings-columns"><div><Label htmlFor="basic-price">Basic Magic price (₱)</Label><Input id="basic-price" type="number" min={1} value={prices.basic} onChange={(event) => setPrices({ ...prices, basic: Number(event.target.value) })} required /></div><div><Label htmlFor="premium-price">Magic with Music price (₱)</Label><Input id="premium-price" type="number" min={1} value={prices.premium} onChange={(event) => setPrices({ ...prices, premium: Number(event.target.value) })} required /></div></div><div><Label htmlFor="gcash-details">GCash instructions</Label><Input id="gcash-details" maxLength={200} value={accounts.gcash} onChange={(event) => setAccounts({ ...accounts, gcash: event.target.value })} placeholder="Add verified account details" /></div><div><Label htmlFor="maya-details">Maya instructions</Label><Input id="maya-details" maxLength={200} value={accounts.maya} onChange={(event) => setAccounts({ ...accounts, maya: event.target.value })} placeholder="Add verified account details" /></div><div><Label htmlFor="bank-details">Bank transfer instructions</Label><Input id="bank-details" maxLength={200} value={accounts.bank} onChange={(event) => setAccounts({ ...accounts, bank: event.target.value })} placeholder="Add verified account details" /></div><div><Label htmlFor="photo-retention">Photo retention (days)</Label><Input id="photo-retention" type="number" min={1} max={365} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} required /></div><Button type="submit"><Save /> Save settings</Button></form></section></div>}
  </div>;
}
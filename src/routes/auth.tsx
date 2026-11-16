import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter, SiteHeader } from "@/components/pasko-layout";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Staff Sign In | Pasko Photo Magic" }, { name: "description", content: "Secure staff access to the Pasko Photo Magic studio." },
    { name: "robots", content: "noindex" }, { property: "og:title", content: "Staff Sign In | Pasko Photo Magic" },
    { property: "og:description", content: "Secure access for authorized studio staff." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const isAdmin = useServerFn(checkIsAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      try { if ((await isAdmin()).isAdmin) await navigate({ to: "/admin" }); }
      catch { /* signed-in non-staff can still sign out below */ }
    });
    return () => { active = false; };
  }, [isAdmin, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = recovery ? await supabase.auth.resetPasswordForEmail(email) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (recovery) toast.success("Check your email for a password reset link.");
      else {
        const response = await isAdmin();
        if (response.isAdmin) await navigate({ to: "/admin" });
        else { await supabase.auth.signOut(); toast.error("This account does not have studio staff access."); }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Sign in could not be completed."); }
    finally { setBusy(false); }
  }

  return <div className="create-page"><SiteHeader /><main className="content-page auth-page"><Link to="/" className="back-link"><ArrowLeft size={16} /> Back to the studio</Link>
    <section className="auth-form-section"><span className="auth-icon"><LockKeyhole /></span><p className="page-eyebrow">Staff only</p><h1>{recovery ? "Reset your password" : "Studio sign in"}</h1><p>Use an authorized studio account to manage orders and verify payments.</p>
      <form className="details-fields" onSubmit={submit}><div><Label htmlFor="staff-email">Email address</Label><Input id="staff-email" type="email" autoComplete="email" maxLength={255} required value={email} onChange={(event) => setEmail(event.target.value)} /></div>{!recovery && <div><Label htmlFor="staff-password">Password</Label><Input id="staff-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>}<Button type="submit" disabled={busy}>{busy ? "Please wait…" : recovery ? "Send reset link" : "Sign in"}</Button></form>
      <Button variant="link" type="button" onClick={() => setRecovery(!recovery)}>{recovery ? "Return to sign in" : "Forgot password?"}</Button>
    </section>
  </main><SiteFooter /></div>;
}
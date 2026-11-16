import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageFrame } from "@/components/pasko-pages";

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [
    { title: "Track Your Order | Pasko Photo Magic" },
    { name: "description", content: "Check your Pasko Photo Magic payment status with your order code." },
    { property: "og:title", content: "Track Your Order | Pasko Photo Magic" },
    { property: "og:description", content: "Check the status of your Christmas photo order." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: TrackPage,
});

function TrackPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  function submit(e: FormEvent) { e.preventDefault(); void navigate({ to: "/status/$code", params: { code: code.trim().toUpperCase() }, search: { t: undefined } }); }
  return <PageFrame><section className="content-section track-page"><p className="page-eyebrow">Your memories, just a moment away</p><h1 className="section-heading">Track your order</h1>
    <p className="section-lede">Enter the order code you got after paying.</p>
    <form className="track-form" onSubmit={submit}><div><Label htmlFor="order-code">Order code</Label><Input id="order-code" autoCapitalize="characters" required minLength={4} maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} placeholder="PPM-ABC123" /></div><Button type="submit">Check status<Search /></Button></form>
  </section></PageFrame>;
}

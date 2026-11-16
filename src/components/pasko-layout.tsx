import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BrandLockup({ footer = false }: { footer?: boolean }) {
  return (
    <Link to="/" className={`brand-lockup${footer ? " footer-brand" : ""}`} aria-label="Pasko Photo Magic home">
      <span className="brand-mark" aria-hidden="true">🎄</span>
      <span>Pasko <span className="brand-color">Photo</span> <span className="brand-gold">Magic</span></span>
    </Link>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const isCheckout = useRouterState({ select: (s) => s.location.pathname === "/checkout" });
  const mobileLinks = [
    { label: "Home", to: "/" },
    { label: "How It Works", to: "/how-it-works" },
    { label: "Sample Photos", to: "/samples" },
    { label: "Pricing", to: "/pricing" },
    { label: "FAQ", to: "/faq" },
    { label: "Track Order", to: "/track" },
  ] as const;
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandLockup />
        <nav className="site-nav" aria-label="Main navigation">
          <Link to="/">⌂ Home</Link>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/samples">Sample Photos</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/track">Track Order</Link>
        </nav>
        {!isCheckout && <span className="language-label">EN · FIL</span>}
        <Button size="sm" asChild><Link to="/create" search={{ pkg: "basic" }}>Create</Link></Button>
        <Button className="mobile-menu-trigger" variant="ghost" size="icon" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</Button>
      </div>
      {menuOpen && <nav className="mobile-site-nav" aria-label="Mobile navigation">{mobileLinks.map(({ label, to }) => <Link key={to} to={to} onClick={() => setMenuOpen(false)}>{label}</Link>)}</nav>}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer" id="track-order">
      <div className="site-footer-inner">
        <div className="footer-top">
          <div>
            <BrandLockup footer />
            <p className="mt-3 text-sm">Capture · Create · Share the Christmas Joy!</p>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation">
            <Link to="/">Home</Link>
            <Link to="/how-it-works">How It Works</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/samples">Sample Photos</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/track">Track Order</Link>
            <Link to="/manual-payment">Studio Payment</Link>
            <a href="mailto:hello@paskophotomagic.com">Contact Us <ArrowUpRight size={12} className="inline-block" /></a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/auth">Staff sign in</Link>
          </nav>
        </div>
        <p className="footer-note">Made with ❤️ in the Philippines 🇵🇭 · © 2026 Pasko Photo Magic</p>
        <p className="footer-note">Pasko Photo Magic by Elon Lab Corporation · Quezon City, Philippines</p>
      </div>
    </footer>
  );
}
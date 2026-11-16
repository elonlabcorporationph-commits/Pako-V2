import { useEffect, useState } from "react";
import { externalBrowserUrl, isInAppBrowser } from "@/lib/download";

const KEY = "pasko-inapp-escape-tried";

/** Bounces Messenger/Facebook/Instagram visitors to Chrome (Android) or shows Safari steps (iPhone). */
export function InAppBrowserEscape() {
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (!isInAppBrowser(ua)) return;
    const android = /Android/i.test(ua);
    setMode(android ? "android" : "ios");
    if (android && !sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      window.location.href = externalBrowserUrl(location.href.split("#")[0], ua);
    }
  }, []);

  if (mode === "none") return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* ignore */ }
  };

  return (
    <div role="dialog" aria-label="Open in your browser" className="fixed inset-x-0 top-0 z-[100] border-b border-border bg-card p-3 text-card-foreground shadow-lg" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
      <div className="mx-auto flex max-w-xl flex-col gap-2 text-sm">
        {mode === "ios" ? (
          <p><strong>You're inside Messenger/Facebook.</strong> Tap <strong>⋯</strong> (top right) → <strong>Open in Safari / external browser</strong> to save your photos and video.</p>
        ) : (
          <p><strong>Open in Chrome</strong> so you can save your photos and video.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {mode === "android" && (
            <a className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground" href={externalBrowserUrl(location.href.split("#")[0])}>Open in Chrome</a>
          )}
          <button type="button" onClick={copy} className="rounded-md border border-border px-3 py-2 font-semibold">{copied ? "Link copied ✓" : "Copy link"}</button>
          <button type="button" onClick={() => setMode("none")} className="rounded-md px-3 py-2 text-muted-foreground">Dismiss</button>
        </div>
      </div>
    </div>
  );
}

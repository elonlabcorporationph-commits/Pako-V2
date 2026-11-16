import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pasko-install-dismissed-at";
// Aggressive: remind again after a short while instead of never.
const REMIND_AFTER_MS = 30 * 60 * 1000; // 30 minutes

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Pushes visitors to install the app: native prompt on Android/Chrome, Share steps on iPhone. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const snoozed = Date.now() - dismissedAt < REMIND_AFTER_MS;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      if (!snoozed) setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iPhone has no beforeinstallprompt — show the manual steps after a short delay.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos() && !snoozed) {
      timer = setTimeout(() => setVisible(true), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (installed || !visible) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setInstalled(true);
    }
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install Pasko Photo Magic"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-border bg-card p-4 text-card-foreground shadow-2xl"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p>
            <strong>Install Pasko Photo Magic</strong> on your phone for faster ordering and one-tap
            access from your home screen.
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Not now"
            className="shrink-0 rounded-md p-1 text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {deferred ? (
          <Button onClick={() => void install()} className="w-full">
            <Download size={16} /> Install app
          </Button>
        ) : (
          <p className="rounded-md border border-border bg-muted p-2 text-muted-foreground">
            Tap <Share size={14} className="inline" aria-label="Share" /> <strong>Share</strong>,
            then <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Share, X } from "lucide-react";

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone() {
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isIOSSafari()) return;
    const dismissed = sessionStorage.getItem("ios-install-dismissed");
    if (dismissed) return;
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem("ios-install-dismissed", "1");
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] md:hidden animate-slide-in-bottom">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg flex gap-3 items-start">
        <div className="flex-shrink-0 mt-0.5">
          <Share size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
            Instalar Lamoniê CRM
          </p>
          <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-body)" }}>
            Toque em <Share size={12} className="inline -mt-0.5" /> e depois em{" "}
            <strong>"Adicionar à Tela de Início"</strong>
          </p>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

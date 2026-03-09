import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu, Bell, BellOff, BellRing } from "lucide-react";
import { useNotificationPermission } from "@/hooks/useContractNotifications";

const PAGE_TITLES: Record<string, string> = {
  "/": "Lamoniê CRM",
  "/clients": "Clientes",
  "/contracts": "Contratos",
  "/financial": "Financeiro",
  "/agenda": "Agenda",
  "/reports": "Relatórios",
  "/visits": "Visitas",
  "/leads": "Leads WhatsApp",
  "/settings": "Configurações",
};

interface Props {
  onMenuOpen: () => void;
}

export default function MobileTopBar({ onMenuOpen }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = PAGE_TITLES[pathname] || "Lamoniê CRM";
  const isHome = pathname === "/";
  const isMainTab = ["/visits", "/contracts", "/clients"].includes(pathname);
  const { permission, subscribeToPush } = useNotificationPermission();

  const notifSupported = "Notification" in window;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 md:hidden border-b border-border bg-card/95 backdrop-blur-lg"
      style={{
        paddingTop: "var(--safe-top)",
        height: "calc(var(--safe-top) + var(--mobile-header-h))",
      }}
    >
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: "var(--mobile-header-h)" }}
      >
        {isHome ? (
          <button
            onClick={onMenuOpen}
            className="flex items-center justify-center w-10 h-10 -ml-1 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu size={22} />
          </button>
        ) : isMainTab ? (
          <img src="/images/logo-lamonie.png" alt="Lamoniê" className="w-8 h-8 object-contain -ml-1" />
        ) : (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 -ml-1 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <h1
          className="text-base font-semibold tracking-tight truncate flex-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>

        {/* Notification permission button */}
        {notifSupported && (
          <button
            onClick={async () => {
              if (permission !== "granted") {
                await subscribeToPush();
              }
            }}
            className={`flex items-center justify-center w-10 h-10 -mr-1 rounded-xl transition-colors ${
              permission === "granted"
                ? "text-emerald-600"
                : permission === "denied"
                ? "text-red-400"
                : "text-amber-500 animate-pulse"
            }`}
            title={
              permission === "granted"
                ? "Notificações ativas"
                : permission === "denied"
                ? "Notificações bloqueadas"
                : "Ativar notificações"
            }
          >
            {permission === "granted" ? (
              <BellRing size={20} />
            ) : permission === "denied" ? (
              <BellOff size={20} />
            ) : (
              <Bell size={20} />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

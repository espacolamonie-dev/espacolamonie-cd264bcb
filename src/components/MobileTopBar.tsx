import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";

const PAGE_TITLES: Record<string, string> = {
  "/": "Lamoniê CRM",
  "/clients": "Clientes",
  "/contracts": "Contratos",
  "/financial": "Financeiro",
  "/agenda": "Agenda",
  "/reports": "Relatórios",
  "/visits": "Visitas",
  "/settings": "Configurações",
  "/budgets": "Orçamentos",
  "/marketing": "Marketing",
};

export default function MobileTopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = PAGE_TITLES[pathname] || "Lamoniê CRM";
  const isHome = pathname === "/";
  const isMainTab = ["/visits", "/contracts", "/clients"].includes(pathname);

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
        {isHome || isMainTab ? (
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

        {/* Notification center */}
        <NotificationCenter />
      </div>
    </header>
  );
}

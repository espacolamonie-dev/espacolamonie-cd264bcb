import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clientes",
  "/contracts": "Contratos",
  "/financial": "Financeiro",
  "/agenda": "Agenda",
  "/reports": "Relatórios",
  "/visits": "Agendar Visita",
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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center gap-3 border-b border-border bg-card/95 backdrop-blur-lg px-4 safe-area-top" style={{ height: 56 }}>
      {isHome ? (
        <button
          onClick={onMenuOpen}
          className="flex items-center justify-center w-10 h-10 -ml-1 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu size={22} />
        </button>
      ) : (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 -ml-1 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <h1
        className="text-base font-semibold tracking-tight truncate"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h1>
    </header>
  );
}

import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  CalendarDays,
  BarChart3,
  Menu,
  X,
  LogOut,
  Settings,
  ClipboardCheck,
  
  Calculator,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useContractNotifications } from "@/hooks/useContractNotifications";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileBottomNav from "@/components/MobileBottomNav";
import MobileTopBar from "@/components/MobileTopBar";
import IOSInstallBanner from "@/components/IOSInstallBanner";

const navGroups = [
  {
    label: "Gestão",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/clients", label: "Clientes", icon: Users },
      { to: "/contracts", label: "Contratos", icon: FileText },
      { to: "/budgets", label: "Orçamentos", icon: Calculator },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/financial", label: "Financeiro", icon: CreditCard },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/visits", label: "Visitas", icon: ClipboardCheck },
      { to: "/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const isMobile = useIsMobile();
  useContractNotifications();

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, sticky on desktop */}
      <aside
        className={`sidebar-gradient z-50 flex w-[260px] shrink-0 flex-col md:sticky md:top-0 md:h-screen ${
          isMobile
            ? `fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`
            : ""
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-6 pt-7 pb-8 relative shrink-0">
          <img
            src={logo}
            alt="Lamoniê"
            className="h-16 w-auto object-contain"
          />
          <button
            className="absolute right-4 text-white/30 hover:text-white transition-colors md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 min-h-0 px-4 overflow-y-auto space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/25" style={{ fontFamily: "var(--font-body)" }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 ${
                        active
                          ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
                          : "text-white/45 hover:text-white/80 hover:bg-white/5"
                      }`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      <item.icon size={18} strokeWidth={active ? 2 : 1.5} className="shrink-0" />
                      <span>{item.label}</span>
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-4 pb-6 pt-4 mt-auto">
          <div className="border-t border-white/8 mb-3" />
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 ${
              location.pathname === "/settings"
                ? "bg-white/15 text-white"
                : "text-white/30 hover:text-white/60 hover:bg-white/5"
            }`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            <Settings size={18} strokeWidth={1.5} />
            Configurações
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-wide text-white/30 hover:text-white/60 hover:bg-white/5 transition-all duration-200 mt-0.5"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <LogOut size={18} strokeWidth={1.5} />
            Sair
          </button>
          <p className="text-[9px] text-white/12 tracking-[0.15em] uppercase mt-4 px-4" style={{ fontFamily: "var(--font-body)" }}>
            Espaço Lamoniê © 2025
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Desktop top bar */}
        <header className="hidden md:flex items-center gap-4 border-b border-border bg-card/60 backdrop-blur-md px-6 py-3.5 md:px-10 sticky top-0 z-30">
          <div className="flex-1" />
        </header>

        {/* Mobile header */}
        {isMobile && <MobileTopBar onMenuOpen={() => setMobileOpen(true)} />}

        <div className={`page-enter max-w-[1440px] ${isMobile ? "px-4 pt-[calc(var(--safe-top)+var(--mobile-header-h)+8px)] pb-[calc(var(--safe-bottom)+var(--mobile-bottom-h)+16px)]" : "p-6 md:p-10"}`}>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
      {isMobile && <IOSInstallBanner />}
    </div>
  );
}

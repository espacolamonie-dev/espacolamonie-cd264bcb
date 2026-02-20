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
} from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";

const navGroups = [
  {
    label: "Gestão",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/clients", label: "Clientes", icon: Users },
      { to: "/contracts", label: "Contratos", icon: FileText },
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
      { to: "/visits", label: "Agendar Visita", icon: ClipboardCheck },
      { to: "/reports", label: "Relatórios", icon: BarChart3 },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-gradient fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0 animate-slide-in-left" : "-translate-x-full"
        }`}
      >
        {/* Logo — compact & elegant */}
        <div className="flex items-center justify-center px-6 pt-7 pb-8 relative">
          <img
            src={logo}
            alt="Lamoniê"
            className="h-10 w-auto object-contain"
          />
          <button
            className="absolute right-4 text-white/30 hover:text-white transition-colors md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>



        {/* Nav groups */}
        <nav className="flex-1 px-4 overflow-y-auto space-y-6">
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
        <div className="px-4 pb-6 pt-4">
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
        {/* Top bar — minimal */}
        <header className="flex items-center gap-4 border-b border-border bg-card/60 backdrop-blur-md px-6 py-3.5 md:px-10 sticky top-0 z-30">
          <button
            className="text-muted-foreground hover:text-foreground transition-colors md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
        </header>

        <div className="p-6 md:p-10 max-w-[1440px] page-enter">{children}</div>
      </main>
    </div>
  );
}

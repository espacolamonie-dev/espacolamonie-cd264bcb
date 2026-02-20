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

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/financial", label: "Financeiro", icon: CreditCard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/visits", label: "Agendar Visita", icon: ClipboardCheck },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/settings", label: "Configurações", icon: Settings },
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
        className={`sidebar-gradient fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3.5 px-7 pt-8 pb-10">
          <img
            src={logo}
            alt="Lamoniê"
            className="h-10 w-10 rounded-xl object-cover ring-2 ring-white/10"
          />
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-semibold tracking-tight text-white leading-tight">
              Espaço Lamoniê
            </h1>
            <p className="text-[10px] text-white/35 tracking-[0.16em] uppercase mt-0.5 font-medium">
              Gestão de Eventos
            </p>
          </div>
          <button
            className="ml-auto text-white/30 hover:text-white transition-colors md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-3.5 rounded-xl px-4 py-3 text-[13.5px] font-medium tracking-wide transition-all duration-200 ${
                  active
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80 hover:bg-white/5"
                }`}
              >
                <item.icon size={20} strokeWidth={active ? 2 : 1.5} className="shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-6 pt-4">
          <div className="border-t border-white/8 mb-4" />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-[13.5px] font-medium tracking-wide text-white/30 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
          >
            <LogOut size={20} strokeWidth={1.5} />
            Sair
          </button>
          <p className="text-[9px] text-white/15 tracking-[0.15em] uppercase mt-4 px-4">
            Espaço Lamoniê © 2025
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4 md:px-10 sticky top-0 z-30">
          <button
            className="text-muted-foreground hover:text-foreground transition-colors md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
        </header>

        <div className="p-6 md:p-10 max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
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
  {
    label: "Sistema",
    items: [
      { to: "/settings", label: "Configurações", icon: Settings },
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
        className={`sidebar-gradient fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3.5 px-6 py-8">
          <img
            src={logo}
            alt="Lamoniê"
            className="h-10 w-10 rounded-full object-cover ring-2 ring-sidebar-foreground/10"
          />
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-semibold tracking-tight text-sidebar-foreground leading-tight">
              Espaço Lamoniê
            </h1>
            <p className="font-[Poppins] text-[9px] text-sidebar-foreground/35 tracking-[0.18em] uppercase mt-0.5 font-medium">
              Gestão de Eventos
            </p>
          </div>
          <button
            className="ml-auto text-sidebar-foreground/30 hover:text-sidebar-foreground transition-colors md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-2 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? "mt-6" : ""}>
              <p className="font-[Poppins] text-[9px] font-medium tracking-[0.2em] uppercase text-sidebar-foreground/25 px-3 mb-2">
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
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 font-[Poppins] text-[13px] tracking-wide transition-all duration-200 ${
                        active
                          ? "bg-sidebar-foreground/10 text-sidebar-foreground font-medium"
                          : "text-sidebar-foreground/45 hover:text-sidebar-foreground/80 hover:bg-sidebar-foreground/5"
                      }`}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-gold" />
                      )}
                      <item.icon size={16} strokeWidth={active ? 1.8 : 1.4} className="shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-6 pt-2">
          <div className="border-t border-sidebar-foreground/8 mb-4" />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-[Poppins] text-[13px] tracking-wide text-sidebar-foreground/30 hover:text-sidebar-foreground/60 hover:bg-sidebar-foreground/5 transition-all duration-200"
          >
            <LogOut size={16} strokeWidth={1.4} />
            Sair
          </button>
          <p className="font-[Poppins] text-[9px] text-sidebar-foreground/15 tracking-[0.15em] uppercase mt-4 px-3">
            Espaço Lamoniê © 2025
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b border-border px-5 py-3.5 md:px-8">
          <button
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
        </header>

        <div className="p-5 md:p-8 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}

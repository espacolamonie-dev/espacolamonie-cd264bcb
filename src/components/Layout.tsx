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
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
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
        className={`sidebar-gradient fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-7">
          <img
            src={logo}
            alt="Lamoniê"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-sidebar-border/50"
          />
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground leading-tight">
              Espaço Lamoniê
            </h1>
            <p className="text-[10px] text-sidebar-foreground/40 tracking-widest uppercase mt-0.5">Gestão de Eventos</p>
          </div>
          <button
            className="ml-auto text-sidebar-foreground/40 hover:text-sidebar-foreground md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-sidebar-border/30" />

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-6">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                }`}
              >
                <item.icon size={17} strokeWidth={active ? 2 : 1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-5 space-y-3">
          <div className="border-t border-sidebar-border/30 mb-3" />
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all duration-200"
          >
            <LogOut size={17} strokeWidth={1.5} />
            Sair
          </button>
          <p className="text-[10px] text-sidebar-foreground/20 tracking-widest uppercase">
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

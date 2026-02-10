import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/financial", label: "Financeiro", icon: CreditCard },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-gradient fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <img src={logo} alt="Lamoniê" className="h-12 w-12 rounded-full object-cover bg-card/10" />
          <div>
            <h1 className="font-display text-lg font-semibold text-sidebar-foreground">
              Espaço Lamoniê
            </h1>
            <p className="text-xs text-sidebar-foreground/60">CRM</p>
          </div>
          <button
            className="ml-auto text-sidebar-foreground/60 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-sidebar-primary" />
            <span className="text-xs text-sidebar-foreground/60">Saldo do Espaço</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b px-4 py-3 md:px-6">
          <button
            className="text-muted-foreground md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
        </header>

        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}

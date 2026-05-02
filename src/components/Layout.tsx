import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  CalendarDays,
  BarChart3,
  LogOut,
  Settings,
  ClipboardCheck,
  Calculator,
  Megaphone,
  Brain,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useContractNotifications } from "@/hooks/useContractNotifications";
import logo from "@/assets/logo.png";
import NotificationCenter from "@/components/NotificationCenter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileBottomNav from "@/components/MobileBottomNav";
import MobileTopBar from "@/components/MobileTopBar";
import IOSInstallBanner from "@/components/IOSInstallBanner";
import { supabase } from "@/integrations/supabase/client";
import GlobalSearch from "@/components/GlobalSearch";
import QuickActions from "@/components/QuickActions";

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
      { to: "/financial-ai", label: "Financeiro IA", icon: Brain },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/visits", label: "Visitas", icon: ClipboardCheck },
      { to: "/marketing", label: "Marketing", icon: Megaphone },
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

  const [companyName, setCompanyName] = useState("Espaço Lamoniê");

  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("company_settings")
          .select("company_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.company_name) setCompanyName(data.company_name);
      } catch {}
    };
    loadCompanyName();
  }, []);

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
        className={`sidebar-gradient z-50 flex w-[260px] shrink-0 flex-col md:sticky md:top-0 md:h-screen ${
          isMobile
            ? `fixed inset-y-0 left-0 transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`
            : ""
        }`}
      >
        {/* Logo + Company Name */}
        <div className="flex items-center gap-3.5 px-6 py-8 shrink-0 border-b border-white/10">
          <div className="relative shrink-0">
            <img
              src={logo}
              alt={companyName}
              className="h-11 w-11 rounded-full object-cover ring-2 ring-gold/40 shadow-lg shadow-black/20"
            />
          </div>
          <p
            className="text-white text-xl font-semibold tracking-tight truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {companyName}
          </p>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 min-h-0 px-4 overflow-y-auto space-y-6 pt-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-4 mb-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30" style={{ fontFamily: "var(--font-body)" }}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={`group relative flex items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? "bg-white/[0.08] text-white shadow-inner"
                          : "text-white/55 hover:text-white hover:bg-white/[0.04]"
                      }`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {/* Gold left indicator (only when active) */}
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full transition-all duration-300 ${
                          active ? "bg-gold opacity-100" : "bg-gold opacity-0 group-hover:opacity-30"
                        }`}
                      />
                      <item.icon
                        size={18}
                        strokeWidth={active ? 2.2 : 1.6}
                        className={`shrink-0 transition-colors ${active ? "text-gold-light" : "text-current"}`}
                      />
                      <span className="tracking-wide">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-4 pb-6 pt-4 mt-auto">
          <div className="h-px mb-3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200 ${
              location.pathname === "/settings"
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white hover:bg-white/[0.04]"
            }`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            <Settings size={18} strokeWidth={1.6} />
            Configurações
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-wide text-white/40 hover:text-white hover:bg-white/[0.04] transition-all duration-200 mt-0.5"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <LogOut size={18} strokeWidth={1.6} />
            Sair
          </button>
          <p className="text-[9px] text-white/20 tracking-[0.18em] uppercase mt-5 px-4" style={{ fontFamily: "var(--font-body)" }}>
            {companyName} © {new Date().getFullYear()}
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Desktop top bar — glassmorphism */}
        <header className="hidden md:flex items-center gap-4 border-b border-border/60 bg-white/75 backdrop-blur-xl px-8 py-3.5 sticky top-0 z-30 shadow-soft">
          <h2 className="text-[13px] font-semibold text-slate-700 shrink-0 tracking-tight" style={{ fontFamily: "var(--font-body)" }}>
            {navGroups.flatMap(g => g.items).find(i => i.to === location.pathname)?.label || ""}
          </h2>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="flex-1 flex justify-center px-4">
            <GlobalSearch />
          </div>
          <NotificationCenter />
        </header>

        {/* Mobile header */}
        {isMobile && <MobileTopBar />}

        <div
          key={location.pathname}
          className={`page-enter max-w-[1440px] ${isMobile ? "px-4 pt-[calc(var(--safe-top)+var(--mobile-header-h)+8px)] pb-[calc(var(--safe-bottom)+var(--mobile-bottom-h)+16px)]" : "p-6 md:p-10"}`}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <MobileBottomNav />}
      {isMobile && <IOSInstallBanner />}

      {/* Quick Actions (FAB + Cmd+J palette) */}
      <QuickActions />
    </div>
  );
}

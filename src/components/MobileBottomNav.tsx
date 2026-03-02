import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Users,
  CreditCard,
  ClipboardCheck,
} from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/visits", label: "Visita", icon: ClipboardCheck },
  { to: "/financial", label: "Financeiro", icon: CreditCard },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-lg" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-150 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
              style={{ fontFamily: "var(--font-body)", minHeight: 64 }}
            >
              <item.icon size={22} strokeWidth={active ? 2.2 : 1.6} />
              <span>{item.label}</span>
              {active && (
                <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

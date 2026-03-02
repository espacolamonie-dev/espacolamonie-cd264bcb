import { Link, useLocation } from "react-router-dom";
import {
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";

const items = [
  { to: "/visits", label: "Visitas", icon: ClipboardCheck },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/clients", label: "Clientes", icon: Users },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 backdrop-blur-lg"
      style={{
        height: "calc(var(--safe-bottom) + var(--mobile-bottom-h))",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <div className="flex items-stretch justify-around" style={{ height: "var(--mobile-bottom-h)" }}>
        {items.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors duration-150 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
              style={{ fontFamily: "var(--font-body)" }}
            >
              <item.icon size={24} strokeWidth={active ? 2.2 : 1.6} />
              <span>{item.label}</span>
              {active && (
                <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

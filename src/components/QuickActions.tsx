import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, X, Search,
  UserPlus, CalendarPlus, FilePlus,
  CalendarDays, FileText, Users,
  CreditCard, Settings as SettingsIcon, BarChart3,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Action = {
  id: string;
  label: string;
  description?: string;
  group: "Criar" | "Navegar" | "Financeiro" | "Admin";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Tailwind classes for the icon tile (bg + text) */
  tone: string;
  keywords: string[];
  run: (navigate: ReturnType<typeof useNavigate>) => void;
};

const ACTIONS: Action[] = [
  // Criar
  {
    id: "new-visit",
    label: "Nova Visita",
    description: "Agendar uma visita ao espaço",
    group: "Criar",
    icon: CalendarPlus,
    tone: "bg-emerald-500/10 text-emerald-600",
    keywords: ["nova", "visita", "agendar", "criar", "create visit"],
    run: (n) => n("/visits?new=1"),
  },
  {
    id: "new-client",
    label: "Novo Cliente",
    description: "Cadastrar novo cliente",
    group: "Criar",
    icon: UserPlus,
    tone: "bg-blue-500/10 text-blue-600",
    keywords: ["novo", "cliente", "cadastrar", "criar", "create client"],
    run: (n) => n("/clients?new=1"),
  },
  {
    id: "new-contract",
    label: "Novo Contrato",
    description: "Criar contrato para um cliente",
    group: "Criar",
    icon: FilePlus,
    tone: "bg-amber-500/10 text-amber-600",
    keywords: ["novo", "contrato", "criar", "create contract"],
    run: (n) => n("/contracts?new=1"),
  },

  // Navegar
  {
    id: "go-agenda",
    label: "Ver Agenda",
    group: "Navegar",
    icon: CalendarDays,
    tone: "bg-emerald-500/10 text-emerald-600",
    keywords: ["agenda", "calendario", "calendar"],
    run: (n) => n("/agenda"),
  },
  {
    id: "go-contracts",
    label: "Ver Contratos",
    group: "Navegar",
    icon: FileText,
    tone: "bg-amber-500/10 text-amber-600",
    keywords: ["contratos", "contracts"],
    run: (n) => n("/contracts"),
  },
  {
    id: "go-clients",
    label: "Ver Clientes",
    group: "Navegar",
    icon: Users,
    tone: "bg-blue-500/10 text-blue-600",
    keywords: ["clientes", "clients"],
    run: (n) => n("/clients"),
  },

  // Financeiro
  {
    id: "go-financial",
    label: "Ver Financeiro",
    group: "Financeiro",
    icon: CreditCard,
    tone: "bg-violet-500/10 text-violet-600",
    keywords: ["financeiro", "financial", "dinheiro"],
    run: (n) => n("/financial"),
  },

  // Admin
  {
    id: "go-reports",
    label: "Relatórios",
    group: "Admin",
    icon: BarChart3,
    tone: "bg-slate-500/10 text-slate-700",
    keywords: ["relatorios", "reports", "metricas"],
    run: (n) => n("/reports"),
  },
  {
    id: "go-settings",
    label: "Configurações",
    group: "Admin",
    icon: SettingsIcon,
    tone: "bg-slate-500/10 text-slate-700",
    keywords: ["configuracoes", "settings", "ajustes"],
    run: (n) => n("/settings"),
  },
];

const RECENTS_KEY = "lamonie:quickactions:recents";

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 4) : [];
  } catch { return []; }
}
function pushRecent(id: string) {
  try {
    const cur = loadRecents().filter((x) => x !== id);
    const next = [id, ...cur].slice(0, 4);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {}
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function QuickActions() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+J shortcut (avoids conflict with GlobalSearch's Cmd+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Lock scroll + autofocus
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    setTimeout(() => inputRef.current?.focus(), 60);
    setRecents(loadRecents());
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const run = (a: Action) => {
    pushRecent(a.id);
    setOpen(false);
    setQuery("");
    a.run(navigate);
  };

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) =>
      normalize(a.label).includes(q) ||
      a.keywords.some((k) => normalize(k).includes(q))
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Action[]>();
    for (const a of filtered) {
      const arr = map.get(a.group) || [];
      arr.push(a);
      map.set(a.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const recentActions = recents
    .map((id) => ACTIONS.find((a) => a.id === id))
    .filter((x): x is Action => !!x);

  // ===== FAB (mobile-only — desktop has plenty of space; FAB also visible on desktop bottom-right) =====
  const fab = (
    <button
      onClick={() => setOpen(true)}
      aria-label="Ações rápidas"
      className={`fixed z-40 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 ${
        isMobile
          ? "right-4 w-14 h-14"
          : "bottom-6 right-6 w-14 h-14"
      }`}
      style={
        isMobile
          ? { bottom: `calc(var(--safe-bottom) + var(--mobile-bottom-h) + 16px)` }
          : undefined
      }
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  );

  return (
    <>
      {fab}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex animate-fade-in"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />

          {/* Panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              isMobile
                ? "relative mt-auto w-full bg-card rounded-t-3xl shadow-2xl border-t border-border max-h-[85vh] flex flex-col animate-fade-in"
                : "relative m-auto w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border max-h-[80vh] flex flex-col animate-scale-in"
            }
            style={
              isMobile
                ? { paddingBottom: "var(--safe-bottom)" }
                : undefined
            }
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div className="pt-2 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-3 border-b border-border shrink-0">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite uma ação ou atalho..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
                style={{ fontFamily: "var(--font-body)" }}
              />
              {!isMobile && (
                <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
              {/* Recents */}
              {!query && recentActions.length > 0 && (
                <Section title="Recentes">
                  <Grid actions={recentActions} onRun={run} isMobile={isMobile} />
                </Section>
              )}

              {grouped.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma ação encontrada.
                </div>
              )}

              {grouped.map(([group, actions]) => (
                <Section key={group} title={group}>
                  <Grid actions={actions} onRun={run} isMobile={isMobile} />
                </Section>
              ))}
            </div>

            {/* Footer */}
            {!isMobile && (
              <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
                <span>Dica: ⌘J abre as ações rápidas</span>
                <span>Enter para executar</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

function Grid({
  actions, onRun, isMobile,
}: { actions: Action[]; onRun: (a: Action) => void; isMobile: boolean }) {
  return (
    <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => onRun(a)}
          className="group flex items-start gap-3 text-left p-3 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-primary/30 hover:shadow-sm active:scale-[0.98] transition-all"
        >
          <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${a.tone} group-hover:scale-110 transition-transform`}>
            <a.icon size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium truncate" style={{ fontFamily: "var(--font-body)" }}>
              {a.label}
            </span>
            {a.description && (
              <span className="block text-[11px] text-muted-foreground truncate">
                {a.description}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

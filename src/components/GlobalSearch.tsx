import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, FileText, Calculator, X } from "lucide-react";
import { getClients, getContracts } from "@/data/store";
import { getBudgets } from "@/data/budgetStore";

interface SearchResult {
  id: string;
  type: "client" | "contract" | "budget";
  title: string;
  subtitle?: string;
  to: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut Ctrl/Cmd + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Run search (debounced)
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [clients, contracts, budgets] = await Promise.all([
          getClients().catch(() => []),
          getContracts().catch(() => []),
          getBudgets().catch(() => []),
        ]);
        if (cancelled) return;
        const q = query.toLowerCase();
        const out: SearchResult[] = [];

        const clientMap: Record<string, any> = {};
        (clients || []).forEach((c: any) => { clientMap[c.id] = c; });

        (clients || [])
          .filter((c: any) =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.cpf || "").includes(q) ||
            (c.phone || "").includes(q)
          )
          .slice(0, 5)
          .forEach((c: any) => out.push({
            id: c.id,
            type: "client",
            title: c.name,
            subtitle: c.phone || c.cpf || "",
            to: `/clients?highlight=${c.id}`,
          }));

        (contracts || [])
          .filter((c: any) => {
            const client = clientMap[c.clientId];
            return (client?.name || "").toLowerCase().includes(q) ||
              (c.eventType || "").toLowerCase().includes(q);
          })
          .slice(0, 5)
          .forEach((c: any) => {
            const client = clientMap[c.clientId];
            out.push({
              id: c.id,
              type: "contract",
              title: client?.name || "Contrato",
              subtitle: `${c.eventType} • ${c.eventDate}`,
              to: `/contracts?highlight=${c.id}`,
            });
          });

        (budgets || [])
          .filter((b: any) =>
            (b.client_name || b.clientName || "").toLowerCase().includes(q) ||
            (b.event_type || b.eventType || "").toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((b: any) => out.push({
            id: b.id,
            type: "budget",
            title: b.client_name || b.clientName || "Orçamento",
            subtitle: b.event_type || b.eventType || "",
            to: `/budgets?highlight=${b.id}`,
          }));

        setResults(out);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const goTo = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(r.to);
  };

  const iconFor = (t: SearchResult["type"]) => {
    if (t === "client") return <Users size={14} />;
    if (t === "contract") return <FileText size={14} />;
    return <Calculator size={14} />;
  };

  const labelFor = (t: SearchResult["type"]) =>
    t === "client" ? "Cliente" : t === "contract" ? "Contrato" : "Orçamento";

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar clientes, contratos, orçamentos..."
          className="w-full h-9 pl-9 pr-16 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          style={{ fontFamily: "var(--font-body)" }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar"
          >
            <X size={14} />
          </button>
        )}
        <kbd className="hidden md:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Buscando...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Nenhum resultado encontrado.</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => goTo(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
            >
              <span className="text-muted-foreground">{iconFor(r.type)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{r.title}</span>
                {r.subtitle && (
                  <span className="block text-[11px] text-muted-foreground truncate">{r.subtitle}</span>
                )}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 shrink-0">
                {labelFor(r.type)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

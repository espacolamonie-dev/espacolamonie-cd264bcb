import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowLeft } from "lucide-react";
import { getClients, getContracts } from "@/data/store";
import { getBudgets } from "@/data/budgetStore";
import { getVisits } from "@/data/visitStore";
import { useIsMobile } from "@/hooks/use-mobile";
import SearchResults, { type SearchResult } from "@/components/SearchResults";

interface GlobalSearchProps {
  variant?: "inline" | "icon";
}

export default function GlobalSearch({ variant = "inline" }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalize = (s: any) =>
    String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Close on outside click (only for inline desktop dropdown)
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMobile]);

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

  // Lock body scroll when mobile fullscreen open
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 80);
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, open]);

  // Load real data once; search never depends on empty query-triggered fetches.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getClients().catch((e) => { console.warn("[GlobalSearch] getClients failed", e); return []; }),
      getContracts().catch((e) => { console.warn("[GlobalSearch] getContracts failed", e); return []; }),
      getBudgets().catch((e) => { console.warn("[GlobalSearch] getBudgets failed", e); return []; }),
      getVisits().catch((e) => { console.warn("[GlobalSearch] getVisits failed", e); return []; }),
    ]).then(([loadedClients, loadedContracts, loadedBudgets, loadedVisits]) => {
      if (cancelled) return;
      setClients(loadedClients || []);
      setContracts(loadedContracts || []);
      setBudgets(loadedBudgets || []);
      setVisits(loadedVisits || []);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Filter loaded real data immediately while typing.
  useEffect(() => {
    const raw = query.trim();
    if (raw.length < 2) {
      setResults([]);
      return;
    }

    const q = normalize(raw);
    const digits = raw.replace(/\D/g, "");
    const out: SearchResult[] = [];
    const clientMap: Record<string, any> = {};
    clients.forEach((client: any) => { clientMap[client.id] = client; });

    clients
      .filter((client: any) =>
        normalize(client.name || client.nome).includes(q) ||
        (digits && String(client.cpf || "").replace(/\D/g, "").includes(digits)) ||
        (digits && String(client.phone || client.telefone || "").replace(/\D/g, "").includes(digits)) ||
        normalize(client.email).includes(q)
      )
      .slice(0, 6)
      .forEach((client: any) => out.push({
        id: client.id,
        type: "client",
        title: client.name || client.nome || "Cliente",
        subtitle: client.phone || client.telefone || client.cpf || client.email || "",
        to: `/clients?highlight=${client.id}`,
      }));

    contracts
      .filter((contract: any) => {
        const client = clientMap[contract.clientId] || clientMap[contract.client_id];
        return normalize(client?.name || client?.nome).includes(q) || normalize(contract.eventType || contract.event_type).includes(q);
      })
      .slice(0, 5)
      .forEach((contract: any) => {
        const client = clientMap[contract.clientId] || clientMap[contract.client_id];
        const statusLabel = contract.status === "signed" || contract.status === "confirmed" ? "Assinado" : "Pendente";
        out.push({
          id: contract.id,
          type: "contract",
          title: client?.name || client?.nome || "Contrato",
          subtitle: `${contract.eventType || contract.event_type || ""} • ${statusLabel}`,
          to: `/contracts?highlight=${contract.id}`,
        });
      });

    visits
      .filter((visit: any) =>
        normalize(visit.clientName || visit.client_name).includes(q) ||
        (digits && String(visit.clientPhone || visit.client_phone || "").replace(/\D/g, "").includes(digits)) ||
        normalize(visit.eventTypeDesired || visit.event_type_desired).includes(q)
      )
      .slice(0, 5)
      .forEach((visit: any) => out.push({
        id: visit.id,
        type: "visit",
        title: visit.clientName || visit.client_name || "Visita",
        subtitle: `${visit.visitDate || visit.visit_date || ""}${visit.visitTime || visit.visit_time ? " • " + (visit.visitTime || visit.visit_time) : ""}`,
        to: `/visits?highlight=${visit.id}`,
      }));

    budgets
      .filter((budget: any) =>
        normalize(budget.clientName || budget.client_name).includes(q) || normalize(budget.eventType || budget.event_type).includes(q)
      )
      .slice(0, 5)
      .forEach((budget: any) => out.push({
        id: budget.id,
        type: "budget",
        title: budget.clientName || budget.client_name || "Orçamento",
        subtitle: budget.eventType || budget.event_type || "",
        to: `/budgets?highlight=${budget.id}`,
      }));

    setResults(out);
  }, [query, clients, contracts, visits, budgets]);

  const goTo = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(r.to);
  };

  const resultsList = (
    <SearchResults
      query={query}
      results={results}
      loading={loading && query.trim().length >= 2}
      onSelect={goTo}
      className="border-0 rounded-none shadow-none max-h-none"
    />
  );

  // ===== Mobile: icon trigger + fullscreen modal =====
  if (isMobile) {
    return (
      <>
        {variant === "icon" && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Buscar"
          >
            <Search size={20} />
          </button>
        )}
        {variant === "inline" && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 w-full h-9 px-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground/70"
          >
            <Search size={15} />
            <span className="truncate">Buscar...</span>
          </button>
        )}
        {open && (
          <div
            className="fixed inset-0 z-[100] bg-background flex flex-col"
            style={{ paddingTop: "var(--safe-top)" }}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <button
                onClick={() => { setOpen(false); setQuery(""); setResults([]); }}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground"
                aria-label="Fechar"
              >
                <ArrowLeft size={22} />
              </button>
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar clientes, contratos, visitas..."
                  className="w-full h-10 pl-9 pr-9 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                  style={{ fontFamily: "var(--font-body)" }}
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label="Limpar"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {query.trim().length < 2 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground/70 text-center">
                  Digite ao menos 2 caracteres para buscar.
                </div>
              ) : (
                resultsList
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ===== Desktop: inline input with dropdown =====
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
        <SearchResults
          query={query}
          results={results}
          loading={loading}
          onSelect={goTo}
          className="absolute top-full left-0 right-0 mt-1 z-[9999]"
          style={{ position: "absolute" }}
        />
      )}
    </div>
  );
}

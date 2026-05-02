import type { CSSProperties } from "react";
import { CalendarCheck, Calculator, FileText, Users } from "lucide-react";

export interface SearchResult {
  id: string;
  type: "client" | "contract" | "budget" | "visit";
  title: string;
  subtitle?: string;
  to: string;
}

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  loading?: boolean;
  onSelect: (result: SearchResult) => void;
  className?: string;
  style?: CSSProperties;
}

const iconFor = (type: SearchResult["type"]) => {
  if (type === "client") return <Users size={14} />;
  if (type === "contract") return <FileText size={14} />;
  if (type === "visit") return <CalendarCheck size={14} />;
  return <Calculator size={14} />;
};

const labelFor = (type: SearchResult["type"]) =>
  type === "client" ? "Cliente" : type === "contract" ? "Contrato" : type === "visit" ? "Visita" : "Orçamento";

export default function SearchResults({ query, results, loading, onSelect, className = "", style }: SearchResultsProps) {
  const hasQuery = query.trim().length >= 2;

  return (
    <div
      className={`rounded-xl border border-border bg-card shadow-xl overflow-hidden max-h-[300px] overflow-y-auto overscroll-contain ${className}`}
      style={style}
    >
      {loading && (
        <div className="px-4 py-3 text-xs text-muted-foreground">Carregando dados...</div>
      )}

      {!loading && hasQuery && results.length === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground">Nenhum resultado encontrado.</div>
      )}

      {!loading && results.map((result) => (
        <button
          key={`${result.type}-${result.id}`}
          onClick={() => onSelect(result)}
          className="w-full text-left px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors flex items-center gap-3 border-b border-border/50 last:border-0"
        >
          <span className="text-muted-foreground shrink-0">{iconFor(result.type)}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium truncate text-foreground">{result.title}</span>
            {result.subtitle && (
              <span className="block text-[11px] text-muted-foreground truncate">{result.subtitle}</span>
            )}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 shrink-0">
            {labelFor(result.type)}
          </span>
        </button>
      ))}
    </div>
  );
}
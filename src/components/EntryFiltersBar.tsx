import { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ManualEntryCategory, PaymentMethod } from "@/types";

const ENTRY_CATEGORIES: ManualEntryCategory[] = ["Aluguel extra", "Taxa adicional", "Serviço avulso", "Outro"];
const PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Dinheiro", "Cartão", "Transferência"];

export interface EntryFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  origin: "all" | "contract" | "manual";
  category: string;
  paymentMethod: string;
  minValue: string;
  maxValue: string;
}

export const defaultEntryFilters: EntryFilters = {
  search: "", dateFrom: "", dateTo: "", origin: "all", category: "all",
  paymentMethod: "all", minValue: "", maxValue: "",
};

export function hasActiveEntryFilters(f: EntryFilters) {
  return f.search || f.dateFrom || f.dateTo || f.origin !== "all" || f.category !== "all" || f.paymentMethod !== "all" || f.minValue || f.maxValue;
}

interface Props {
  filters: EntryFilters;
  onChange: (f: EntryFilters) => void;
}

export default function EntryFiltersBar({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const set = (field: keyof EntryFilters, value: string) => onChange({ ...filters, [field]: value });
  const clear = () => onChange(defaultEntryFilters);
  const active = hasActiveEntryFilters(filters);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição"
            className="pl-9 h-9 text-sm"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
        <Button
          variant={open ? "secondary" : "outline"}
          size="sm"
          className="gap-2 h-9 text-xs"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {active && <span className="rounded-full bg-primary w-1.5 h-1.5" />}
        </Button>
        {active && (
          <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-xs text-muted-foreground" onClick={clear}>
            <X size={13} /> Limpar filtros
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-lg border border-border/60 bg-card p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Período inicial</label>
            <Input type="date" className="h-8 text-sm" value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Período final</label>
            <Input type="date" className="h-8 text-sm" value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tipo de entrada</label>
            <Select value={filters.origin} onValueChange={(v) => set("origin", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="contract">Contrato</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Categoria</label>
            <Select value={filters.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {ENTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Forma de recebimento</label>
            <Select value={filters.paymentMethod} onValueChange={(v) => set("paymentMethod", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Valor mínimo</label>
            <Input type="number" className="h-8 text-sm" placeholder="R$ 0" value={filters.minValue} onChange={(e) => set("minValue", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Valor máximo</label>
            <Input type="number" className="h-8 text-sm" placeholder="Sem limite" value={filters.maxValue} onChange={(e) => set("maxValue", e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

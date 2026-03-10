import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Eye, Edit2, Copy, FileDown, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  getBudgets, deleteBudget, duplicateBudget,
  Budget, BudgetStatus, BUDGET_STATUS_LABELS, BUDGET_STATUS_COLORS,
} from "@/data/budgetStore";
import BudgetFormModal from "@/components/BudgetFormModal";
import BudgetDetailModal from "@/components/BudgetDetailModal";
import { generateBudgetPdf } from "@/lib/budgetPdf";
import { getBudgetItems } from "@/data/budgetStore";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function Budgets() {
  const isMobile = useIsMobile();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setBudgets(await getBudgets()); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = budgets;
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.clientName.toLowerCase().includes(q));
    }
    return list;
  }, [budgets, statusFilter, search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    try { await deleteBudget(id); toast.success("Excluído"); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handleDuplicate = async (id: string) => {
    try { await duplicateBudget(id); toast.success("Orçamento duplicado"); load(); } catch (e: any) { toast.error(e.message); }
  };

  const handlePdf = async (b: Budget) => {
    try {
      const items = await getBudgetItems(b.id);
      generateBudgetPdf(b, items);
      toast.success("PDF gerado");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus orçamentos e propostas comerciais</p>
        </div>
        <Button onClick={() => { setEditId(null); setFormOpen(true); }} className="gap-2">
          <Plus size={16} /> Novo orçamento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter size={14} className="mr-2" />
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(BUDGET_STATUS_LABELS) as BudgetStatus[]).map(s => (
              <SelectItem key={s} value={s}>{BUDGET_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">Nenhum orçamento encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => { setEditId(null); setFormOpen(true); }}>
            <Plus size={16} className="mr-2" /> Criar primeiro orçamento
          </Button>
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map(b => (
            <Card key={b.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{b.clientName}</p>
                  <p className="text-xs text-muted-foreground">{b.eventType} • {fmtDate(b.eventDate)}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${BUDGET_STATUS_COLORS[b.status]}`}>
                  {BUDGET_STATUS_LABELS[b.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-primary">{fmt(b.finalTotal)}</p>
                <p className="text-[10px] text-muted-foreground">{b.guestCount} pessoas</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setDetailId(b.id)}>
                  <Eye size={14} className="mr-1" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => { setEditId(b.id); setFormOpen(true); }}>
                  <Edit2 size={14} className="mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => handlePdf(b)}>
                  <FileDown size={14} />
                </Button>
                <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => handleDelete(b.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Evento</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{b.clientName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.eventType || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(b.eventDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{fmt(b.finalTotal)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-[10px] ${BUDGET_STATUS_COLORS[b.status]}`}>
                      {BUDGET_STATUS_LABELS[b.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailId(b.id)} title="Ver"><Eye size={15} /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditId(b.id); setFormOpen(true); }} title="Editar"><Edit2 size={15} /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDuplicate(b.id)} title="Duplicar"><Copy size={15} /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handlePdf(b)} title="PDF"><FileDown size={15} /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(b.id)} title="Excluir"><Trash2 size={15} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <BudgetFormModal
          budgetId={editId}
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditId(null); }}
          onSaved={() => { setFormOpen(false); setEditId(null); load(); }}
        />
      )}
      {detailId && (
        <BudgetDetailModal
          budgetId={detailId}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

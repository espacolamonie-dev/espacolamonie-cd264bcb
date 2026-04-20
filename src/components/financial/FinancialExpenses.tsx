import { useState, useMemo } from "react";
import { todayLocalStr } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CircleArrowDown as ArrowDownCircle, Plus, Trash2, Search, X, Upload, Receipt, Pencil,
} from "lucide-react";
import ImportStatementModal from "@/components/ImportStatementModal";
import ImportReceiptModal from "@/components/ImportReceiptModal";
import { addExpense, deleteExpense, updateExpense } from "@/data/store";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import type { FinancialData, FinancialTransaction } from "./types";
import type { ExpenseCategory } from "@/types";

const EXPENSE_CATEGORIES: string[] = [
  "Energia (CEMIG)", "Água (COPASA)", "Internet", "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Aluguel", "Outros",
];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  data: FinancialData;
  onReload: () => void;
}

export default function FinancialExpenses({ data, onReload }: Props) {
  const { allSaidas, monthLabel } = data;
  const [expOpen, setExpOpen] = useState(false);
  const [importExpOpen, setImportExpOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [expenseFilter, setExpenseFilter] = useState("all");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expForm, setExpForm] = useState({
    description: "", category: "Outros" as ExpenseCategory, amount: 0, date: todayLocalStr(),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    description: "", category: "Outros" as string, amount: 0, date: todayLocalStr(),
  });

  const filtered = useMemo(() => {
    let list = allSaidas;
    if (expenseFilter !== "all") list = list.filter(i => i.category === expenseFilter);
    if (expenseSearch) list = list.filter(i => i.description.toLowerCase().includes(expenseSearch.toLowerCase()));
    return list;
  }, [allSaidas, expenseFilter, expenseSearch]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedExpenses);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedExpenses(next);
  };

  const handleAddExpense = async () => {
    if (!expForm.description.trim() || expForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    try {
      await addExpense(expForm);
      toast.success("Despesa registrada");
      setExpOpen(false);
      setExpForm({ description: "", category: "Outros", amount: 0, date: todayLocalStr() });
      onReload();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleDeleteSelected = async () => {
    try {
      for (const id of selectedExpenses) await deleteExpense(id);
      toast.success(`${selectedExpenses.size} despesa(s) excluída(s)`);
      setSelectedExpenses(new Set());
      onReload();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleDeleteSingle = async (id: string) => {
    try { await deleteExpense(id); toast.success("Despesa removida"); onReload(); }
    catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-danger" /> Despesas
            </h2>
            <p className="text-xs text-muted-foreground">Despesas de {monthLabel}</p>
          </div>
          <div className="flex gap-2">
            {selectedExpenses.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1.5 h-8 text-xs rounded-lg">
                    <Trash2 size={12} /> ({selectedExpenses.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Excluir {selectedExpenses.size} despesa(s)?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={() => setReceiptOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
              <Receipt size={12} /> Comprovante
            </Button>
            <Button onClick={() => setImportExpOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
              <Upload size={12} /> Importar
            </Button>
            <Button onClick={() => setExpOpen(true)} size="sm" className="gap-1.5 h-8 text-xs rounded-lg">
              <Plus size={12} /> Despesa
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={expenseSearch} onChange={(e) => setExpenseSearch(e.target.value)} />
          </div>
          <Select value={expenseFilter} onValueChange={setExpenseFilter}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(expenseFilter !== "all" || expenseSearch) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setExpenseFilter("all"); setExpenseSearch(""); }}>
              <X size={12} />
            </Button>
          )}
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma despesa encontrada</div>
          ) : filtered.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Checkbox checked={selectedExpenses.has(item.id)} onCheckedChange={() => toggleSelection(item.id)} className="shrink-0" />
                <div className="rounded-full p-2 shrink-0 bg-danger/10">
                  <ArrowDownCircle size={16} className="text-danger" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="font-bold text-sm text-danger">- {fmt(item.amount)}</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Excluir despesa?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteSingle(item.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-medium">Total ({filtered.length})</span>
          <span className="font-display font-bold text-danger">{fmt(filtered.reduce((s, i) => s + i.amount, 0))}</span>
        </div>
      </Card>

      {/* Expense Modal */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-xl">Adicionar Despesa</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Descrição *</Label>
              <Input value={expForm.description} onChange={(e) => setExpForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Conta de luz" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => setExpForm(f => ({ ...f, category: v as ExpenseCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Valor *</Label>
                <CurrencyInput value={expForm.amount} onChange={(v) => setExpForm(f => ({ ...f, amount: v }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input type="date" value={expForm.date} onChange={(e) => setExpForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <Button onClick={handleAddExpense} className="mt-2">Registrar Despesa</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportStatementModal open={importExpOpen} onOpenChange={setImportExpOpen} onImported={onReload} />
      <ImportReceiptModal open={receiptOpen} onOpenChange={setReceiptOpen} mode="expense" onImported={onReload} />
    </div>
  );
}

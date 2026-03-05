import { useEffect, useState, useMemo } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, FileText, HandCoins, CreditCard, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getPayments, getExpenses, addExpense, deleteExpense,
  getManualEntries, addManualEntry, deleteManualEntry,
  getTotalEntries, getTotalExpenses, getBalance, getContracts, getClients,
} from "@/data/store";
import type { Payment, Expense, ExpenseCategory, ManualEntry, ManualEntryCategory, PaymentMethod, Contract, Client } from "@/types";
import EntryFiltersBar, { type EntryFilters, defaultEntryFilters, hasActiveEntryFilters } from "@/components/EntryFiltersBar";
import ExpenseFiltersBar, { type ExpenseFilters, defaultExpenseFilters, hasActiveExpenseFilters } from "@/components/ExpenseFiltersBar";
import ImportStatementModal from "@/components/ImportStatementModal";
import ImportBankEntryModal from "@/components/ImportBankEntryModal";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Outros",
];
const ENTRY_CATEGORIES: ManualEntryCategory[] = ["Aluguel extra", "Taxa adicional", "Serviço avulso", "Outro"];
const PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Dinheiro", "Cartão", "Transferência"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type CombinedEntry = {
  id: string; date: string; description: string; amount: number;
  origin: "contract" | "manual"; originLabel: string;
  category?: string; paymentMethod?: string;
};

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [globalTotalIn, setGlobalTotalIn] = useState(0);
  const [globalTotalOut, setGlobalTotalOut] = useState(0);
  const [globalBalance, setGlobalBalance] = useState(0);
  const [expOpen, setExpOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryFilters, setEntryFilters] = useState<EntryFilters>(defaultEntryFilters);
  const [expenseFilters, setExpenseFilters] = useState<ExpenseFilters>(defaultExpenseFilters);
  const [importOpen, setImportOpen] = useState(false);
  const [importEntryOpen, setImportEntryOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    description: "", category: "Outros" as ExpenseCategory, amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const [entryForm, setEntryForm] = useState({
    description: "", category: "Outro" as ManualEntryCategory, amount: 0,
    date: new Date().toISOString().split("T")[0], paymentMethod: "Pix" as PaymentMethod, notes: "",
  });

  // Bulk selection state
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [confirmDeleteEntries, setConfirmDeleteEntries] = useState(false);
  const [confirmDeleteExpenses, setConfirmDeleteExpenses] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = async () => {
    try {
      const [p, m, e, totalIn, totalOut, bal, c, cl] = await Promise.all([
        getPayments(), getManualEntries(), getExpenses(),
        getTotalEntries(), getTotalExpenses(), getBalance(),
        getContracts(), getClients(),
      ]);
      setPayments(p); setManualEntries(m); setExpenses(e);
      setGlobalTotalIn(totalIn); setGlobalTotalOut(totalOut); setGlobalBalance(bal);
      setContracts(c); setClients(cl);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const handleAddExpense = async () => {
    if (!expForm.description.trim() || expForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    try {
      await addExpense(expForm); toast.success("Despesa registrada com sucesso");
      setExpOpen(false);
      setExpForm({ description: "", category: "Outros", amount: 0, date: new Date().toISOString().split("T")[0] });
      await load();
    } catch (e: any) { toast.error(e.message); }
  };
  const handleAddEntry = async () => {
    if (!entryForm.description.trim() || entryForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    try {
      await addManualEntry(entryForm); toast.success("Entrada registrada com sucesso");
      setEntryOpen(false);
      setEntryForm({ description: "", category: "Outro", amount: 0, date: new Date().toISOString().split("T")[0], paymentMethod: "Pix", notes: "" });
      await load();
    } catch (e: any) { toast.error(e.message); }
  };
  const handleDeleteExpense = async (id: string) => {
    try { await deleteExpense(id); toast.success("Despesa removida"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const handleDeleteManualEntry = async (id: string) => {
    try { await deleteManualEntry(id); toast.success("Entrada removida"); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const setExp = (field: string, value: any) => setExpForm((p) => ({ ...p, [field]: value }));
  const setEntry = (field: string, value: any) => setEntryForm((p) => ({ ...p, [field]: value }));

  const cancelledContractIds = new Set(
    contracts.filter((c) => c.status === "cancelled").map((c) => c.id)
  );
  const contractClientMap = Object.fromEntries(
    contracts.map((c) => [c.id, clients.find((cl) => cl.id === c.clientId)?.name || "—"])
  );

  const activePayments = payments.filter((p) => !cancelledContractIds.has(p.contractId));

  const allEntries: CombinedEntry[] = useMemo(() => [
    ...activePayments.map((p): CombinedEntry => ({
      id: p.id, date: p.date, description: p.description || contractClientMap[p.contractId] || "Pagamento",
      amount: p.amount, origin: "contract", originLabel: contractClientMap[p.contractId] || "Contrato",
    })),
    ...manualEntries.map((e): CombinedEntry => ({
      id: e.id, date: e.date, description: e.description,
      amount: e.amount, origin: "manual", originLabel: e.category,
      category: e.category, paymentMethod: e.paymentMethod,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [activePayments, manualEntries, contractClientMap]);

  const filteredEntries = useMemo(() => {
    const f = entryFilters;
    return allEntries.filter((e) => {
      if (f.search && !e.description.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.dateFrom && e.date < f.dateFrom) return false;
      if (f.dateTo && e.date > f.dateTo) return false;
      if (f.origin !== "all" && e.origin !== f.origin) return false;
      if (f.category !== "all" && e.origin === "manual" && e.category !== f.category) return false;
      if (f.category !== "all" && e.origin === "contract") return false;
      if (f.paymentMethod !== "all" && e.origin === "manual" && e.paymentMethod !== f.paymentMethod) return false;
      if (f.paymentMethod !== "all" && e.origin === "contract") return false;
      if (f.minValue && e.amount < Number(f.minValue)) return false;
      if (f.maxValue && e.amount > Number(f.maxValue)) return false;
      return true;
    });
  }, [allEntries, entryFilters]);

  const filteredExpenses = useMemo(() => {
    const f = expenseFilters;
    return expenses.filter((e) => {
      if (f.search && !e.description.toLowerCase().includes(f.search.toLowerCase())) return false;
      if (f.dateFrom && e.date < f.dateFrom) return false;
      if (f.dateTo && e.date > f.dateTo) return false;
      if (f.category !== "all" && e.category !== f.category) return false;
      if (f.minValue && e.amount < Number(f.minValue)) return false;
      if (f.maxValue && e.amount > Number(f.maxValue)) return false;
      return true;
    });
  }, [expenses, expenseFilters]);

  const entryFiltersActive = hasActiveEntryFilters(entryFilters);
  const expenseFiltersActive = hasActiveExpenseFilters(expenseFilters);
  const filteredTotalIn = entryFiltersActive ? filteredEntries.reduce((s, e) => s + e.amount, 0) : globalTotalIn;
  const filteredTotalOut = expenseFiltersActive ? filteredExpenses.reduce((s, e) => s + e.amount, 0) : globalTotalOut;
  const displayBalance = entryFiltersActive || expenseFiltersActive ? filteredTotalIn - filteredTotalOut : globalBalance;

  // Bulk selection helpers — Entries (only manual entries can be deleted)
  const selectableEntryIds = filteredEntries.filter(e => e.origin === "manual").map(e => e.id);
  const allSelectableEntriesSelected = selectableEntryIds.length > 0 && selectableEntryIds.every(id => selectedEntries.has(id));

  const toggleEntrySelection = (id: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllEntries = () => {
    if (allSelectableEntriesSelected) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(selectableEntryIds));
    }
  };

  // Bulk selection helpers — Expenses
  const allExpensesSelected = filteredExpenses.length > 0 && filteredExpenses.every(e => selectedExpenses.has(e.id));

  const toggleExpenseSelection = (id: string) => {
    setSelectedExpenses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllExpenses = () => {
    if (allExpensesSelected) {
      setSelectedExpenses(new Set());
    } else {
      setSelectedExpenses(new Set(filteredExpenses.map(e => e.id)));
    }
  };

  const handleBulkDeleteEntries = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedEntries).map(id => deleteManualEntry(id)));
      toast.success(`${selectedEntries.size} entrada(s) removida(s)`);
      setSelectedEntries(new Set());
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkDeleting(false); setConfirmDeleteEntries(false); }
  };

  const handleBulkDeleteExpenses = async () => {
    setBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedExpenses).map(id => deleteExpense(id)));
      toast.success(`${selectedExpenses.size} despesa(s) removida(s)`);
      setSelectedExpenses(new Set());
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkDeleting(false); setConfirmDeleteExpenses(false); }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle financeiro do Espaço Lamoniê</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card !border-success/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-success/10 p-2">
              <TrendingUp size={14} className="text-success" />
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Entradas</p>
          </div>
          <p className="text-2xl font-display font-bold text-success tracking-tight">{fmt(filteredTotalIn)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {entryFiltersActive ? `${filteredEntries.length} registros filtrados` : "Valores recebidos"}
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-danger/10 p-2">
              <TrendingDown size={14} className="text-danger" />
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Saídas</p>
          </div>
          <p className="text-2xl font-display font-bold text-danger tracking-tight">{fmt(filteredTotalOut)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {expenseFiltersActive ? `${filteredExpenses.length} registros filtrados` : "Despesas registradas"}
          </p>
        </div>
        <div className="stat-card !border-primary/25">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Wallet size={14} className="text-primary" />
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Saldo atual</p>
          </div>
          <p className={`text-2xl font-display font-bold tracking-tight ${displayBalance >= 0 ? "text-primary" : "text-danger"}`}>{fmt(displayBalance)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Saldo disponível do espaço</p>
        </div>
      </div>

      {/* Receivables Summary */}
      {(() => {
        const activeContracts = contracts.filter(c => c.status !== "cancelled");
        const depositPaid = activeContracts.filter(c => c.paymentStatus === "deposit_paid");
        const pending = activeContracts.filter(c => c.paymentStatus === "pending");
        const remainingFromDeposit = depositPaid.reduce((s, c) => s + c.remainingValue, 0);
        const pendingDepositTotal = pending.reduce((s, c) => s + (c.totalValue * c.depositPercent / 100), 0);
        const totalReceivable = activeContracts.reduce((s, c) => s + c.remainingValue, 0);
        return (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="stat-card !border-warning/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-warning/10 p-2">
                  <HandCoins size={14} className="text-warning" />
                </div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Restante (sinal pago)</p>
              </div>
              <p className="text-2xl font-display font-bold text-warning tracking-tight">{fmt(remainingFromDeposit)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{depositPaid.length} contrato(s) com sinal pago</p>
            </div>
            <div className="stat-card !border-danger/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-danger/10 p-2">
                  <CreditCard size={14} className="text-danger" />
                </div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Sinal pendente</p>
              </div>
              <p className="text-2xl font-display font-bold text-danger tracking-tight">{fmt(pendingDepositTotal)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{pending.length} contrato(s) sem pagamento</p>
            </div>
            <div className="stat-card !border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Landmark size={14} className="text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Total a receber</p>
              </div>
              <p className="text-2xl font-display font-bold text-primary tracking-tight">{fmt(totalReceivable)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">De todos os contratos ativos</p>
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList className="rounded-lg">
          <TabsTrigger value="entries" className="rounded-md">Entradas</TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-md">Saídas</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold">Entradas financeiras</h2>
              <p className="text-xs text-muted-foreground">Valores recebidos pelo espaço</p>
            </div>
            <div className="flex gap-2">
              {selectedEntries.size > 0 && (
                <Button variant="destructive" size="sm" className="gap-2 h-9 rounded-lg" onClick={() => setConfirmDeleteEntries(true)}>
                  <Trash2 size={15} /> Excluir {selectedEntries.size} selecionado(s)
                </Button>
              )}
              <Button onClick={() => setEntryOpen(true)} size="sm" className="gap-2 h-9 rounded-lg">
                <Plus size={15} /> Adicionar entrada
              </Button>
              <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg" onClick={() => setImportEntryOpen(true)}>
                <Landmark size={15} /> Importar extrato
              </Button>
            </div>
          </div>

          <EntryFiltersBar filters={entryFilters} onChange={setEntryFilters} />

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox
                      checked={selectableEntryIds.length > 0 && allSelectableEntriesSelected ? true : (selectedEntries.size > 0 ? "indeterminate" : false)}
                      onCheckedChange={toggleAllEntries}
                      aria-label="Selecionar todos"
                      disabled={selectableEntryIds.length === 0}
                    />
                  </th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th className="hidden sm:table-cell">Origem</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={6} className="!py-12 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className={selectedEntries.has(entry.id) ? "bg-primary/5" : ""}>
                      <td>
                        <Checkbox
                          checked={selectedEntries.has(entry.id)}
                          onCheckedChange={() => toggleEntrySelection(entry.id)}
                          aria-label={`Selecionar ${entry.description}`}
                          disabled={entry.origin === "contract"}
                        />
                      </td>
                      <td className="text-muted-foreground tabular-nums">{new Date(entry.date).toLocaleDateString("pt-BR")}</td>
                      <td className="font-medium">{entry.description}</td>
                      <td className="hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                          entry.origin === "contract" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
                        }`}>
                          {entry.origin === "contract" ? <FileText size={10} /> : <HandCoins size={10} />}
                          {entry.origin === "contract" ? "Contrato" : "Manual"}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-success tabular-nums">{fmt(entry.amount)}</td>
                      <td className="text-right">
                        {entry.origin === "manual" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDeleteManualEntry(entry.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {entryFiltersActive && (
            <p className="text-xs text-muted-foreground text-right">
              Exibindo {filteredEntries.length} de {allEntries.length} entradas • Total filtrado: <span className="font-semibold text-success">{fmt(filteredTotalIn)}</span>
            </p>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold">Despesas</h2>
              <p className="text-xs text-muted-foreground">Gastos operacionais do espaço</p>
            </div>
            <div className="flex gap-2">
              {selectedExpenses.size > 0 && (
                <Button variant="destructive" size="sm" className="gap-2 h-9 rounded-lg" onClick={() => setConfirmDeleteExpenses(true)}>
                  <Trash2 size={15} /> Excluir {selectedExpenses.size} selecionado(s)
                </Button>
              )}
              <Button onClick={() => setExpOpen(true)} size="sm" className="gap-2 h-9 rounded-lg">
                <Plus size={15} /> Adicionar despesa
              </Button>
              <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg" onClick={() => setImportOpen(true)}>
                <CreditCard size={15} /> Importar extrato
              </Button>
            </div>
          </div>

          <ExpenseFiltersBar filters={expenseFilters} onChange={setExpenseFilters} />

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="w-10">
                    <Checkbox
                      checked={filteredExpenses.length > 0 && allExpensesSelected ? true : (selectedExpenses.size > 0 ? "indeterminate" : false)}
                      onCheckedChange={toggleAllExpenses}
                      aria-label="Selecionar todos"
                      disabled={filteredExpenses.length === 0}
                    />
                  </th>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th className="hidden sm:table-cell">Categoria</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={6} className="!py-12 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.id} className={selectedExpenses.has(e.id) ? "bg-primary/5" : ""}>
                      <td>
                        <Checkbox
                          checked={selectedExpenses.has(e.id)}
                          onCheckedChange={() => toggleExpenseSelection(e.id)}
                          aria-label={`Selecionar ${e.description}`}
                        />
                      </td>
                      <td className="text-muted-foreground tabular-nums">{new Date(e.date).toLocaleDateString("pt-BR")}</td>
                      <td className="font-medium">{e.description}</td>
                      <td className="hidden sm:table-cell">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.category}</span>
                      </td>
                      <td className="text-right font-semibold text-danger tabular-nums">{fmt(e.amount)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => handleDeleteExpense(e.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {expenseFiltersActive && (
            <p className="text-xs text-muted-foreground text-right">
              Exibindo {filteredExpenses.length} de {expenses.length} despesas • Total filtrado: <span className="font-semibold text-danger">{fmt(filteredTotalOut)}</span>
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* New Expense Dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adicionar despesa</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Registre uma nova despesa do espaço</p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Descrição *</Label>
              <Input value={expForm.description} onChange={(e) => setExp("description", e.target.value)} className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => setExp("category", v)}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor (R$)</Label>
                <CurrencyInput value={expForm.amount} onChange={(v) => setExp("amount", v)} placeholder="R$ 0,00" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data</Label>
              <Input type="date" value={expForm.date} onChange={(e) => setExp("date", e.target.value)} className="rounded-lg" />
            </div>
            <Button onClick={handleAddExpense} className="mt-2 rounded-lg h-10">Registrar despesa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adicionar entrada</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Registre um novo recebimento avulso</p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Descrição *</Label>
              <Input value={entryForm.description} onChange={(e) => setEntry("description", e.target.value)} placeholder="Ex: Aluguel de cadeiras extra" className="rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                <Select value={entryForm.category} onValueChange={(v) => setEntry("category", v)}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor (R$) *</Label>
                <CurrencyInput value={entryForm.amount} onChange={(v) => setEntry("amount", v)} placeholder="R$ 0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data</Label>
                <Input type="date" value={entryForm.date} onChange={(e) => setEntry("date", e.target.value)} className="rounded-lg" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Forma de recebimento</Label>
                <Select value={entryForm.paymentMethod} onValueChange={(v) => setEntry("paymentMethod", v)}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
              <Textarea value={entryForm.notes} onChange={(e) => setEntry("notes", e.target.value)} rows={2} placeholder="Informações adicionais (opcional)" className="rounded-lg" />
            </div>
            <Button onClick={handleAddEntry} className="mt-2 rounded-lg h-10">Registrar entrada</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportStatementModal open={importOpen} onOpenChange={setImportOpen} onImported={load} />
      <ImportBankEntryModal open={importEntryOpen} onOpenChange={setImportEntryOpen} onImported={load} />

      {/* Bulk delete confirmation — Entries */}
      <AlertDialog open={confirmDeleteEntries} onOpenChange={setConfirmDeleteEntries}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedEntries.size} entrada(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Os registros selecionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteEntries} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation — Expenses */}
      <AlertDialog open={confirmDeleteExpenses} onOpenChange={setConfirmDeleteExpenses}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedExpenses.size} despesa(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Os registros selecionados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteExpenses} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

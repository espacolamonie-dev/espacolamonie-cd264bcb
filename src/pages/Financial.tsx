import { useEffect, useState, useMemo } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, FileText, HandCoins, Calendar, DollarSign, CircleArrowDown as ArrowDownCircle, CircleArrowUp as ArrowUpCircle, Upload, CheckSquare, UserRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ImportStatementModal from "@/components/ImportStatementModal";
import ImportBankEntryModal from "@/components/ImportBankEntryModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getPayments, getExpenses, addExpense, deleteExpense,
  getManualEntries, addManualEntry, deleteManualEntry,
  getContracts, getClients,
} from "@/data/store";
import type { Payment, Expense, ExpenseCategory, ManualEntry, ManualEntryCategory, PaymentMethod, Contract, Client } from "@/types";

const EXPENSE_CATEGORIES: string[] = [
  "Energia (CEMIG)", "Água (COPASA)", "Internet", "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Outros",
];
const ENTRY_CATEGORIES: ManualEntryCategory[] = ["Aluguel extra", "Taxa adicional", "Serviço avulso", "Outro"];
const PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Dinheiro", "Cartão", "Transferência"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type FinancialTransaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "entrada" | "saida";
  source: "payment" | "manual_entry" | "expense";
};

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expOpen, setExpOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [importExpOpen, setImportExpOpen] = useState(false);
  const [importEntryOpen, setImportEntryOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [funcModalOpen, setFuncModalOpen] = useState(false);
  const [funcValorPago, setFuncValorPago] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [expForm, setExpForm] = useState({
    description: "", category: "Outros" as ExpenseCategory, amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const [entryForm, setEntryForm] = useState({
    description: "", category: "Outro" as ManualEntryCategory, amount: 0,
    date: new Date().toISOString().split("T")[0], paymentMethod: "Pix" as PaymentMethod, notes: "",
  });

  const load = async () => {
    try {
      const [p, m, e, c, cl] = await Promise.all([
        getPayments(), getManualEntries(), getExpenses(),
        getContracts(), getClients(),
      ]);
      setPayments(p);
      setManualEntries(m);
      setExpenses(e);
      setContracts(c);
      setClients(cl);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  // Load func valor pago from localStorage
  useEffect(() => {
    const key = `func_pago_${selectedMonth}`;
    const saved = localStorage.getItem(key);
    setFuncValorPago(saved ? Number(saved) : 0);
  }, [selectedMonth]);

  const handleFuncValorPagoChange = (val: number) => {
    setFuncValorPago(val);
    localStorage.setItem(`func_pago_${selectedMonth}`, String(val));
  };

  // Auto-refresh when page gains focus (e.g. after editing contracts)
  useEffect(() => {
    const handleFocus = () => { load(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") load();
    });
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  const handleAddExpense = async () => {
    if (!expForm.description.trim() || expForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    try {
      await addExpense(expForm);
      toast.success("Despesa registrada");
      setExpOpen(false);
      setExpForm({ description: "", category: "Outros", amount: 0, date: new Date().toISOString().split("T")[0] });
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddEntry = async () => {
    if (!entryForm.description.trim() || entryForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    try {
      await addManualEntry(entryForm);
      toast.success("Entrada registrada");
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

  const toggleSelection = (set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  };

  const handleDeleteSelectedEntries = async () => {
    try {
      for (const id of selectedEntries) {
        await deleteManualEntry(id);
      }
      toast.success(`${selectedEntries.size} entrada(s) excluída(s)`);
      setSelectedEntries(new Set());
      await load();
    } catch (e: any) { toast.error(e.message || "Erro ao excluir"); }
  };

  const handleDeleteSelectedExpenses = async () => {
    try {
      for (const id of selectedExpenses) {
        await deleteExpense(id);
      }
      toast.success(`${selectedExpenses.size} despesa(s) excluída(s)`);
      setSelectedExpenses(new Set());
      await load();
    } catch (e: any) { toast.error(e.message || "Erro ao excluir"); }
  };

  const handleDeleteSingleEntry = async (item: FinancialTransaction) => {
    try {
      if (item.source === "manual_entry") await deleteManualEntry(item.id);
      else if (item.source === "expense") await deleteExpense(item.id);
      toast.success("Item excluído");
      await load();
    } catch (e: any) { toast.error(e.message || "Erro ao excluir"); }
  };

  const cancelledContractIds = new Set(
    contracts.filter((c) => c.status === "cancelled").map((c) => c.id)
  );
  const contractClientMap = Object.fromEntries(
    contracts.map((c) => [c.id, clients.find((cl) => cl.id === c.clientId)?.name || "—"])
  );

  const activePayments = payments.filter((p) => !cancelledContractIds.has(p.contractId));
  const activeContracts = contracts.filter(c => c.status !== "cancelled");

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);
  const nextMonthStart = new Date(year, month, 1);
  const nextMonthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const monthContracts = activeContracts.filter(c => {
    const d = new Date(c.eventDate);
    return d >= monthStart && d <= monthEnd;
  });

  const nextMonthContracts = activeContracts.filter(c => {
    const d = new Date(c.eventDate);
    return d >= nextMonthStart && d <= nextMonthEnd;
  });

  const aReceberMesAtual = monthContracts.reduce((sum, c) => {
    if (c.paymentStatus === "pending") return sum + c.totalValue;
    if (c.paymentStatus === "deposit_paid") return sum + c.remainingValue;
    return sum;
  }, 0);

  const aReceberProximoMes = nextMonthContracts.reduce((sum, c) => {
    if (c.paymentStatus === "pending") return sum + c.remainingValue;
    if (c.paymentStatus === "deposit_paid") return sum + c.remainingValue;
    return sum;
  }, 0);

  const recebidoNoMes = useMemo(() => {
    // Sinais dos contratos criados no mês selecionado (que tenham sinal pago ou pago total)
    const contractsCreatedThisMonth = activeContracts.filter(c => {
      const d = new Date(c.createdAt);
      return d >= monthStart && d <= monthEnd;
    });
    const sinaisRecebidos = contractsCreatedThisMonth.reduce((sum, c) => {
      if (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full") {
        return sum + c.depositValue;
      }
      return sum;
    }, 0);

    // Entradas manuais do mês
    const monthManualEntries = manualEntries.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });

    return sinaisRecebidos + monthManualEntries.reduce((s, e) => s + e.amount, 0);
  }, [activeContracts, manualEntries, monthStart, monthEnd]);

  const despesasDoMes = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, e) => s + e.amount, 0);
  }, [expenses, monthStart, monthEnd]);

  const VALOR_POR_CONTRATO_FUNCIONARIO = 70;
  const contratosFechadosNoMes = activeContracts.filter(c => {
    const d = new Date(c.createdAt);
    return d >= monthStart && d <= monthEnd;
  });
  const pagamentoFuncionario = contratosFechadosNoMes.length * VALOR_POR_CONTRATO_FUNCIONARIO;
  const funcFalta = Math.max(0, pagamentoFuncionario - funcValorPago);

  const lucroDoMes = recebidoNoMes - despesasDoMes;

  const extrato = useMemo((): FinancialTransaction[] => {
    const monthPayments = activePayments.filter(p => {
      const d = new Date(p.date);
      return d >= monthStart && d <= monthEnd;
    });
    const monthManualEntries = manualEntries.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });

    const entries: FinancialTransaction[] = [
      ...monthPayments.map(p => ({
        id: p.id,
        date: p.date,
        description: p.description || contractClientMap[p.contractId] || "Pagamento",
        category: "Contrato",
        amount: p.amount,
        type: "entrada" as const,
        source: "payment" as const,
      })),
      ...monthManualEntries.map(e => ({
        id: e.id,
        date: e.date,
        description: e.description,
        category: e.category,
        amount: e.amount,
        type: "entrada" as const,
        source: "manual_entry" as const,
      })),
      ...monthExpenses.map(e => ({
        id: e.id,
        date: e.date,
        description: e.description,
        category: e.category,
        amount: e.amount,
        type: "saida" as const,
        source: "expense" as const,
      })),
    ];

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activePayments, manualEntries, expenses, contractClientMap, monthStart, monthEnd]);

  const mediasGastos = useMemo(() => {
    const categorias = ["Energia (CEMIG)", "Água (COPASA)", "Internet"];
    const result: Record<string, number> = {};

    const last6Months: Date[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(year, month - 1 - i, 1);
      last6Months.push(d);
    }

    categorias.forEach(cat => {
      const values: number[] = [];
      last6Months.forEach(monthDate => {
        const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
        const total = expenses
          .filter(e => e.category === cat && new Date(e.date) >= start && new Date(e.date) <= end)
          .reduce((s, e) => s + e.amount, 0);
        if (total > 0) values.push(total);
      });
      result[cat] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    const allExpensesLast6: number[] = [];
    last6Months.forEach(monthDate => {
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      const total = expenses
        .filter(e => new Date(e.date) >= start && new Date(e.date) <= end)
        .reduce((s, e) => s + e.amount, 0);
      if (total > 0) allExpensesLast6.push(total);
    });
    result["Média Geral"] = allExpensesLast6.length > 0 ? allExpensesLast6.reduce((a, b) => a + b, 0) / allExpensesLast6.length : 0;

    return result;
  }, [expenses, year, month]);

  return (
    <div className="animate-fade-in space-y-6 pb-20 lg:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Controle completo das finanças do espaço</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground hidden sm:block">Mês:</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40 h-9 rounded-lg"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="p-4 border-warning/30 bg-gradient-to-br from-warning/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-warning/15 p-2">
              <Calendar size={16} className="text-warning" />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">A Receber (Mês Atual)</p>
          </div>
          <p className="text-2xl lg:text-3xl font-display font-bold text-warning tracking-tight">{fmt(aReceberMesAtual)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{monthContracts.length} evento(s) neste mês</p>
        </Card>

        <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-primary/15 p-2">
              <Calendar size={16} className="text-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">A Receber (Próximo Mês)</p>
          </div>
          <p className="text-2xl lg:text-3xl font-display font-bold text-primary tracking-tight">{fmt(aReceberProximoMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{nextMonthContracts.length} evento(s) no próximo mês</p>
        </Card>

        <Card className="p-4 border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-success/15 p-2">
              <TrendingUp size={16} className="text-success" />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Recebido no Mês</p>
          </div>
          <p className="text-2xl lg:text-3xl font-display font-bold text-success tracking-tight">{fmt(recebidoNoMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Valores já recebidos</p>
        </Card>

        <Card className="p-4 border-danger/30 bg-gradient-to-br from-danger/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-danger/15 p-2">
              <TrendingDown size={16} className="text-danger" />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Despesas do Mês</p>
          </div>
          <p className="text-2xl lg:text-3xl font-display font-bold text-danger tracking-tight">{fmt(despesasDoMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Gastos operacionais</p>
        </Card>

        <Card className={`p-4 ${lucroDoMes >= 0 ? 'border-success/30 bg-gradient-to-br from-success/5' : 'border-danger/30 bg-gradient-to-br from-danger/5'} to-transparent`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-full ${lucroDoMes >= 0 ? 'bg-success/15' : 'bg-danger/15'} p-2`}>
              <DollarSign size={16} className={lucroDoMes >= 0 ? 'text-success' : 'text-danger'} />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Lucro do Mês</p>
          </div>
          <p className={`text-2xl lg:text-3xl font-display font-bold tracking-tight ${lucroDoMes >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmt(lucroDoMes)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Recebido - Despesas</p>
        </Card>

        <Card className="p-4 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFuncModalOpen(true)}>
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-violet-500/15 p-2">
              <UserRound size={16} className="text-violet-500" />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Funcionário (Mês)</p>
          </div>
          <p className="text-2xl lg:text-3xl font-display font-bold text-violet-600 dark:text-violet-400 tracking-tight">{fmt(pagamentoFuncionario)}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted-foreground">{contratosFechadosNoMes.length} contrato(s) × R$70</p>
            <p className="text-[10px] text-success font-medium">Pago: {fmt(funcValorPago)}</p>
          </div>
        </Card>
      </div>

      <Dialog open={funcModalOpen} onOpenChange={setFuncModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound size={20} className="text-violet-500" /> Pagamento Funcionário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total a pagar</p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{fmt(pagamentoFuncionario)}</p>
                <p className="text-[10px] text-muted-foreground">{contratosFechadosNoMes.length} × R$70</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Já pago</p>
                <p className="text-lg font-bold text-success">{fmt(funcValorPago)}</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Falta pagar</p>
                <p className="text-lg font-bold text-warning">{fmt(funcFalta)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Valor já pago ao funcionário neste mês</Label>
              <CurrencyInput value={funcValorPago} onChange={handleFuncValorPagoChange} />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Contratos do mês:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {contratosFechadosNoMes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum contrato fechado neste mês</p>
                )}
                {contratosFechadosNoMes.map(c => {
                  const clientName = clients.find(cl => cl.id === c.clientId)?.name || "—";
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{clientName}</p>
                        <p className="text-[10px] text-muted-foreground">{c.eventType} — {new Date(c.eventDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground">{fmt(VALOR_POR_CONTRATO_FUNCIONARIO)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(mediasGastos).map(([cat, val]) => (
          <Card key={cat} className="p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground font-medium mb-1">{cat}</p>
            <p className="text-xl font-display font-bold">{fmt(val)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Média últimos 6 meses</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                <ArrowUpCircle size={20} className="text-success" /> Entradas
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recebimentos do mês</p>
            </div>
            <div className="flex gap-2">
              {selectedEntries.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5 h-9 rounded-lg">
                      <Trash2 size={14} /> Excluir ({selectedEntries.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {selectedEntries.size} entrada(s)?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelectedEntries} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button onClick={() => setImportEntryOpen(true)} size="sm" variant="outline" className="gap-2 h-9 rounded-lg">
                <Upload size={14} /> Importar
              </Button>
              <Button onClick={() => setEntryOpen(true)} size="sm" variant="outline" className="gap-2 h-9 rounded-lg">
                <Plus size={14} /> Entrada
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {extrato.filter(i => i.type === "entrada").length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma entrada neste mês
              </div>
            ) : (
              extrato.filter(i => i.type === "entrada").map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    {item.source === "manual_entry" && (
                      <Checkbox
                        checked={selectedEntries.has(item.id)}
                        onCheckedChange={() => toggleSelection(selectedEntries, setSelectedEntries, item.id)}
                        className="shrink-0"
                      />
                    )}
                    <div className="rounded-full p-2 bg-success/10">
                      <ArrowUpCircle size={16} className="text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR")}</p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{item.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base text-success shrink-0">+ {fmt(item.amount)}</p>
                    {item.source === "manual_entry" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
                            <AlertDialogDescription>"{item.description}" será removida permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSingleEntry(item)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">Total entradas</span>
            <span className="font-display font-bold text-success">{fmt(extrato.filter(i => i.type === "entrada").reduce((s, i) => s + i.amount, 0))}</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                <ArrowDownCircle size={20} className="text-danger" /> Saídas
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Despesas do mês</p>
            </div>
            <div className="flex gap-2">
              {selectedExpenses.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5 h-9 rounded-lg">
                      <Trash2 size={14} /> Excluir ({selectedExpenses.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {selectedExpenses.size} despesa(s)?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelectedExpenses} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button onClick={() => setImportExpOpen(true)} size="sm" variant="outline" className="gap-2 h-9 rounded-lg">
                <Upload size={14} /> Importar
              </Button>
              <Button onClick={() => setExpOpen(true)} size="sm" className="gap-2 h-9 rounded-lg">
                <Plus size={14} /> Despesa
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {extrato.filter(i => i.type === "saida").length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma despesa neste mês
              </div>
            ) : (
              extrato.filter(i => i.type === "saida").map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedExpenses.has(item.id)}
                      onCheckedChange={() => toggleSelection(selectedExpenses, setSelectedExpenses, item.id)}
                      className="shrink-0"
                    />
                    <div className="rounded-full p-2 bg-danger/10">
                      <ArrowDownCircle size={16} className="text-danger" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR")}</p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{item.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base text-danger shrink-0">- {fmt(item.amount)}</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                          <AlertDialogDescription>"{item.description}" será removida permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteSingleEntry(item)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-medium">Total saídas</span>
            <span className="font-display font-bold text-danger">{fmt(extrato.filter(i => i.type === "saida").reduce((s, i) => s + i.amount, 0))}</span>
          </div>
        </Card>
      </div>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adicionar Despesa</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Registre uma nova despesa do espaço</p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Descrição *</Label>
              <Input
                value={expForm.description}
                onChange={(e) => setExp("description", e.target.value)}
                placeholder="Ex: Conta de luz março/2026"
                className="rounded-lg h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => setExp("category", v)}>
                  <SelectTrigger className="rounded-lg h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Valor *</Label>
                <CurrencyInput value={expForm.amount} onChange={(v) => setExp("amount", v)} placeholder="R$ 0,00" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Data</Label>
              <Input type="date" value={expForm.date} onChange={(e) => setExp("date", e.target.value)} className="rounded-lg h-11" />
            </div>
            <Button onClick={handleAddExpense} className="mt-2 rounded-lg h-11 text-base">Registrar Despesa</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adicionar Entrada</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Registre um recebimento avulso</p>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Descrição *</Label>
              <Input
                value={entryForm.description}
                onChange={(e) => setEntry("description", e.target.value)}
                placeholder="Ex: Aluguel de cadeiras extras"
                className="rounded-lg h-11"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Categoria</Label>
                <Select value={entryForm.category} onValueChange={(v) => setEntry("category", v)}>
                  <SelectTrigger className="rounded-lg h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Valor *</Label>
                <CurrencyInput value={entryForm.amount} onChange={(v) => setEntry("amount", v)} placeholder="R$ 0,00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Data</Label>
                <Input type="date" value={entryForm.date} onChange={(e) => setEntry("date", e.target.value)} className="rounded-lg h-11" />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Forma de pagamento</Label>
                <Select value={entryForm.paymentMethod} onValueChange={(v) => setEntry("paymentMethod", v)}>
                  <SelectTrigger className="rounded-lg h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAddEntry} className="mt-2 rounded-lg h-11 text-base">Registrar Entrada</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportStatementModal open={importExpOpen} onOpenChange={setImportExpOpen} onImported={load} />
      <ImportBankEntryModal open={importEntryOpen} onOpenChange={setImportEntryOpen} onImported={load} />
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, FileText, HandCoins, Calendar, DollarSign, CircleArrowDown as ArrowDownCircle, CircleArrowUp as ArrowUpCircle, Upload } from "lucide-react";
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
};

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expOpen, setExpOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
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
    if (c.paymentStatus === "pending") return sum + c.totalValue;
    if (c.paymentStatus === "deposit_paid") return sum + c.remainingValue;
    return sum;
  }, 0);

  const recebidoNoMes = useMemo(() => {
    const monthPayments = activePayments.filter(p => {
      const d = new Date(p.date);
      return d >= monthStart && d <= monthEnd;
    });
    const monthManualEntries = manualEntries.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });
    return monthPayments.reduce((s, p) => s + p.amount, 0) + monthManualEntries.reduce((s, e) => s + e.amount, 0);
  }, [activePayments, manualEntries, monthStart, monthEnd]);

  const despesasDoMes = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, e) => s + e.amount, 0);
  }, [expenses, monthStart, monthEnd]);

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
      })),
      ...monthManualEntries.map(e => ({
        id: e.id,
        date: e.date,
        description: e.description,
        category: e.category,
        amount: e.amount,
        type: "entrada" as const,
      })),
      ...monthExpenses.map(e => ({
        id: e.id,
        date: e.date,
        description: e.description,
        category: e.category,
        amount: e.amount,
        type: "saida" as const,
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(mediasGastos).map(([cat, val]) => (
          <Card key={cat} className="p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground font-medium mb-1">{cat}</p>
            <p className="text-xl font-display font-bold">{fmt(val)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Média últimos 6 meses</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-semibold">Extrato do Mês</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Todas as entradas e saídas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setEntryOpen(true)} size="sm" variant="outline" className="gap-2 h-9 rounded-lg">
              <Plus size={14} /> Entrada
            </Button>
            <Button onClick={() => setExpOpen(true)} size="sm" className="gap-2 h-9 rounded-lg">
              <Plus size={14} /> Despesa
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {extrato.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Nenhuma movimentação neste mês
            </div>
          ) : (
            extrato.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${item.type === "entrada" ? 'bg-success/10' : 'bg-danger/10'}`}>
                    {item.type === "entrada" ? (
                      <ArrowUpCircle size={16} className="text-success" />
                    ) : (
                      <ArrowDownCircle size={16} className="text-danger" />
                    )}
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
                <div className="text-right">
                  <p className={`font-bold text-base ${item.type === "entrada" ? 'text-success' : 'text-danger'}`}>
                    {item.type === "entrada" ? '+' : '-'} {fmt(item.amount)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

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
    </div>
  );
}

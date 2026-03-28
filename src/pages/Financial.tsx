import { useEffect, useState, useMemo } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Plus, TrendingUp, TrendingDown, Wallet, Trash2, FileText, HandCoins,
  Calendar, DollarSign, CircleArrowDown as ArrowDownCircle,
  CircleArrowUp as ArrowUpCircle, Upload, CheckSquare, UserRound,
  PiggyBank, Target, BarChart3, Filter, Search, X, SlidersHorizontal,
  ArrowUpDown, Megaphone, Wrench, Eye, EyeOff
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import ImportStatementModal from "@/components/ImportStatementModal";
import ImportBankEntryModal from "@/components/ImportBankEntryModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  getPayments, getExpenses, addExpense, deleteExpense,
  getManualEntries, addManualEntry, deleteManualEntry,
  getContracts, getClients,
} from "@/data/store";
import type { Payment, Expense, ExpenseCategory, ManualEntry, ManualEntryCategory, PaymentMethod, Contract, Client } from "@/types";

const EXPENSE_CATEGORIES: string[] = [
  "Energia (CEMIG)", "Água (COPASA)", "Internet", "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Aluguel", "Outros",
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

type ReserveType = "melhoria" | "marketing";

interface Reserve {
  type: ReserveType;
  goal: number;
  saved: number;
}

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
  const [activeTab, setActiveTab] = useState("resumo");

  // Filters
  const [entryFilter, setEntryFilter] = useState<string>("all");
  const [expenseFilter, setExpenseFilter] = useState<string>("all");
  const [entrySearch, setEntrySearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<string>("all");

  // Reserves
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [reserveType, setReserveType] = useState<ReserveType>("melhoria");
  const [melhoriaAddAmount, setMelhoriaAddAmount] = useState(0);
  const [marketingAddAmount, setMarketingAddAmount] = useState(0);
  const [reserveGoalEdit, setReserveGoalEdit] = useState(0);

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

  // Reserves from localStorage
  const getReserves = (): Record<ReserveType, Reserve> => {
    const key = `reserves_${selectedMonth}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return {
      melhoria: { type: "melhoria", goal: 0, saved: 0 },
      marketing: { type: "marketing", goal: 0, saved: 0 },
    };
  };
  const [reserves, setReserves] = useState<Record<ReserveType, Reserve>>(getReserves);

  useEffect(() => {
    setReserves(getReserves());
  }, [selectedMonth]);

  const saveReserves = (r: Record<ReserveType, Reserve>) => {
    setReserves(r);
    localStorage.setItem(`reserves_${selectedMonth}`, JSON.stringify(r));
  };

  const load = async () => {
    try {
      const [p, m, e, c, cl] = await Promise.all([
        getPayments(), getManualEntries(), getExpenses(),
        getContracts(), getClients(),
      ]);
      setPayments(p); setManualEntries(m); setExpenses(e); setContracts(c); setClients(cl);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const key = `func_pago_${selectedMonth}`;
    const saved = localStorage.getItem(key);
    setFuncValorPago(saved ? Number(saved) : 0);
  }, [selectedMonth]);

  const handleFuncValorPagoChange = (val: number) => {
    setFuncValorPago(val);
    localStorage.setItem(`func_pago_${selectedMonth}`, String(val));
  };

  useEffect(() => {
    const handleFocus = () => { load(); };
    const handleVisibility = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(load, 5000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
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
      for (const id of selectedEntries) await deleteManualEntry(id);
      toast.success(`${selectedEntries.size} entrada(s) excluída(s)`);
      setSelectedEntries(new Set());
      await load();
    } catch (e: any) { toast.error(e.message || "Erro ao excluir"); }
  };

  const handleDeleteSelectedExpenses = async () => {
    try {
      for (const id of selectedExpenses) await deleteExpense(id);
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

  const cancelledContractIds = new Set(contracts.filter((c) => c.status === "cancelled").map((c) => c.id));
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
    const d = new Date(c.eventDate); return d >= monthStart && d <= monthEnd;
  });
  const nextMonthContracts = activeContracts.filter(c => {
    const d = new Date(c.eventDate); return d >= nextMonthStart && d <= nextMonthEnd;
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
    const contractsCreatedThisMonth = activeContracts.filter(c => {
      const d = new Date(c.createdAt); return d >= monthStart && d <= monthEnd;
    });
    const sinaisRecebidos = contractsCreatedThisMonth.reduce((sum, c) => {
      if (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full") return sum + c.depositValue;
      return sum;
    }, 0);
    const monthManualEntries = manualEntries.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    });
    return sinaisRecebidos + monthManualEntries.reduce((s, e) => s + e.amount, 0);
  }, [activeContracts, manualEntries, monthStart, monthEnd]);

  const despesasDoMes = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    }).reduce((s, e) => s + e.amount, 0);
  }, [expenses, monthStart, monthEnd]);

  const VALOR_POR_CONTRATO_FUNCIONARIO = 70;
  const contratosFechadosNoMes = activeContracts.filter(c => {
    const d = new Date(c.createdAt); return d >= monthStart && d <= monthEnd;
  });
  const pagamentoFuncionario = contratosFechadosNoMes.length * VALOR_POR_CONTRATO_FUNCIONARIO;
  const funcFalta = Math.max(0, pagamentoFuncionario - funcValorPago);

  const totalReservas = reserves.melhoria.saved + reserves.marketing.saved;
  const lucroDoMes = recebidoNoMes - despesasDoMes - funcValorPago - totalReservas;

  // Build full extrato
  const extrato = useMemo((): FinancialTransaction[] => {
    const monthPayments = activePayments.filter(p => {
      const d = new Date(p.date); return d >= monthStart && d <= monthEnd;
    });
    const monthManualEntries = manualEntries.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    });
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    });
    const entries: FinancialTransaction[] = [
      ...monthPayments.map(p => ({
        id: p.id, date: p.date,
        description: p.description || contractClientMap[p.contractId] || "Pagamento",
        category: "Contrato", amount: p.amount, type: "entrada" as const, source: "payment" as const,
      })),
      ...monthManualEntries.map(e => ({
        id: e.id, date: e.date, description: e.description, category: e.category,
        amount: e.amount, type: "entrada" as const, source: "manual_entry" as const,
      })),
      ...monthExpenses.map(e => ({
        id: e.id, date: e.date, description: e.description, category: e.category,
        amount: e.amount, type: "saida" as const, source: "expense" as const,
      })),
    ];
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activePayments, manualEntries, expenses, contractClientMap, monthStart, monthEnd]);

  // Filtered entries and expenses
  const allEntradas = extrato.filter(i => i.type === "entrada");
  const allSaidas = extrato.filter(i => i.type === "saida");

  const filteredEntradas = useMemo(() => {
    let list = allEntradas;
    if (entryFilter !== "all") list = list.filter(i => i.source === entryFilter || i.category === entryFilter);
    if (entrySearch) list = list.filter(i => i.description.toLowerCase().includes(entrySearch.toLowerCase()));
    return list;
  }, [allEntradas, entryFilter, entrySearch]);

  const filteredSaidas = useMemo(() => {
    let list = allSaidas;
    if (expenseFilter !== "all") list = list.filter(i => i.category === expenseFilter);
    if (expenseSearch) list = list.filter(i => i.description.toLowerCase().includes(expenseSearch.toLowerCase()));
    return list;
  }, [allSaidas, expenseFilter, expenseSearch]);

  // Card filter for "Resumo" tab extrato
  const filteredExtrato = useMemo(() => {
    if (cardFilter === "entradas") return extrato.filter(i => i.type === "entrada");
    if (cardFilter === "despesas") return extrato.filter(i => i.type === "saida");
    if (cardFilter === "contrato") return extrato.filter(i => i.source === "payment");
    if (cardFilter === "manual") return extrato.filter(i => i.source === "manual_entry");
    return extrato;
  }, [extrato, cardFilter]);

  // Averages
  const mediasGastos = useMemo(() => {
    const categorias = ["Energia (CEMIG)", "Água (COPASA)", "Internet"];
    const result: Record<string, number> = {};
    const last6Months: Date[] = [];
    for (let i = 0; i < 6; i++) last6Months.push(new Date(year, month - 1 - i, 1));
    categorias.forEach(cat => {
      const values: number[] = [];
      last6Months.forEach(monthDate => {
        const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
        const total = expenses.filter(e => e.category === cat && new Date(e.date) >= start && new Date(e.date) <= end).reduce((s, e) => s + e.amount, 0);
        if (total > 0) values.push(total);
      });
      result[cat] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });
    const allExpensesLast6: number[] = [];
    last6Months.forEach(monthDate => {
      const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      const total = expenses.filter(e => new Date(e.date) >= start && new Date(e.date) <= end).reduce((s, e) => s + e.amount, 0);
      if (total > 0) allExpensesLast6.push(total);
    });
    result["Média Geral"] = allExpensesLast6.length > 0 ? allExpensesLast6.reduce((a, b) => a + b, 0) / allExpensesLast6.length : 0;
    return result;
  }, [expenses, year, month]);

  // Expense categories breakdown
  const expensesByCategory = useMemo(() => {
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    });
    const grouped: Record<string, number> = {};
    monthExpenses.forEach(e => {
      grouped[e.category] = (grouped[e.category] || 0) + e.amount;
    });
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [expenses, monthStart, monthEnd]);

  // Revenue by source
  const entradasBySource = useMemo(() => {
    const contratos = allEntradas.filter(i => i.source === "payment").reduce((s, i) => s + i.amount, 0);
    const manuais = allEntradas.filter(i => i.source === "manual_entry").reduce((s, i) => s + i.amount, 0);
    return { contratos, manuais };
  }, [allEntradas]);

  const handleAddReserve = (type: ReserveType) => {
    const amount = type === "melhoria" ? melhoriaAddAmount : marketingAddAmount;
    if (amount <= 0) { toast.error("Informe um valor"); return; }
    saveReserves({
      ...reserves,
      [type]: {
        ...reserves[type],
        saved: reserves[type].saved + amount,
      },
    });
    if (type === "melhoria") setMelhoriaAddAmount(0);
    else setMarketingAddAmount(0);
    toast.success("Reserva adicionada");
  };

  const handleSetGoal = () => {
    const updated = { ...reserves };
    updated[reserveType] = { ...updated[reserveType], goal: reserveGoalEdit };
    saveReserves(updated);
    toast.success("Meta atualizada");
  };

  const handleResetReserve = (type: ReserveType) => {
    const updated = { ...reserves };
    updated[type] = { ...updated[type], saved: 0 };
    saveReserves(updated);
    toast.success("Reserva zerada");
  };

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const renderCardFilter = (filterKey: string, label: string, icon: React.ReactNode, value: number, colorClass: string, borderClass: string, bgClass: string, subtitle: string) => (
    <Card
      className={`p-4 cursor-pointer hover:shadow-md transition-all ${cardFilter === filterKey ? `ring-2 ${borderClass} shadow-md` : ""} ${borderClass} ${bgClass}`}
      onClick={() => setCardFilter(cardFilter === filterKey ? "all" : filterKey)}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-full p-2 ${bgClass.replace("bg-gradient-to-br from-", "bg-").replace("/5 to-transparent", "/15")}`}>
          {icon}
        </div>
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight">{label}</p>
      </div>
      <p className={`text-xl lg:text-2xl font-display font-bold tracking-tight ${colorClass}`}>{fmt(value)}</p>
      <p className="text-[10px] text-muted-foreground mt-1">
        {subtitle}
        {cardFilter === filterKey && <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0">Filtrado</Badge>}
      </p>
    </Card>
  );

  // Render transaction item
  const renderTransaction = (item: FinancialTransaction, showCheckbox: boolean, selectedSet?: Set<string>, setSelectedFn?: React.Dispatch<React.SetStateAction<Set<string>>>) => (
    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {showCheckbox && item.source !== "payment" && selectedSet && setSelectedFn && (
          <Checkbox
            checked={selectedSet.has(item.id)}
            onCheckedChange={() => toggleSelection(selectedSet, setSelectedFn, item.id)}
            className="shrink-0"
          />
        )}
        <div className={`rounded-full p-2 shrink-0 ${item.type === "entrada" ? "bg-success/10" : "bg-danger/10"}`}>
          {item.type === "entrada" ? <ArrowUpCircle size={16} className="text-success" /> : <ArrowDownCircle size={16} className="text-danger" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR")}</p>
            <span className="text-xs text-muted-foreground">•</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
            {item.source === "payment" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success">Contrato</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={`font-bold text-sm ${item.type === "entrada" ? "text-success" : "text-danger"}`}>
          {item.type === "entrada" ? "+" : "-"} {fmt(item.amount)}
        </p>
        {item.source !== "payment" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {item.type === "entrada" ? "entrada" : "despesa"}?</AlertDialogTitle>
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
  );

  return (
    <div className="animate-fade-in space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Fluxo de caixa completo do espaço</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="resumo" className="gap-2"><BarChart3 size={14} /> Resumo</TabsTrigger>
          <TabsTrigger value="fluxo" className="gap-2"><ArrowUpDown size={14} /> Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="reservas" className="gap-2"><PiggyBank size={14} /> Reservas</TabsTrigger>
        </TabsList>

        {/* ====== TAB RESUMO ====== */}
        <TabsContent value="resumo" className="space-y-6 mt-4">
          {/* KPI Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            {renderCardFilter("a_receber", "A Receber (Mês Atual)", <Calendar size={14} className="text-warning" />, aReceberMesAtual, "text-warning", "border-warning/30", "bg-gradient-to-br from-warning/5 to-transparent", `${monthContracts.length} evento(s) neste mês`)}
            {renderCardFilter("a_receber_proximo", "A Receber (Próximo)", <Calendar size={14} className="text-primary" />, aReceberProximoMes, "text-primary", "border-primary/30", "bg-gradient-to-br from-primary/5 to-transparent", `${nextMonthContracts.length} evento(s)`)}
            {renderCardFilter("entradas", "Recebido no Mês", <TrendingUp size={14} className="text-success" />, recebidoNoMes, "text-success", "border-success/30", "bg-gradient-to-br from-success/5 to-transparent", "Valores já recebidos")}
            {renderCardFilter("despesas", "Despesas do Mês", <TrendingDown size={14} className="text-danger" />, despesasDoMes, "text-danger", "border-danger/30", "bg-gradient-to-br from-danger/5 to-transparent", "Gastos operacionais")}

            <Card className={`p-4 ${lucroDoMes >= 0 ? 'border-success/30 bg-gradient-to-br from-success/5' : 'border-danger/30 bg-gradient-to-br from-danger/5'} to-transparent`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`rounded-full p-2 ${lucroDoMes >= 0 ? 'bg-success/15' : 'bg-danger/15'}`}>
                  <DollarSign size={14} className={lucroDoMes >= 0 ? 'text-success' : 'text-danger'} />
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight">Lucro Líquido</p>
              </div>
              <p className={`text-xl lg:text-2xl font-display font-bold tracking-tight ${lucroDoMes >= 0 ? 'text-success' : 'text-danger'}`}>{fmt(lucroDoMes)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Recebido - Despesas - Func. - Reservas</p>
            </Card>

            <Card className="p-4 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFuncModalOpen(true)}>
              <div className="flex items-center gap-2 mb-2">
                <div className="rounded-full bg-violet-500/15 p-2">
                  <UserRound size={14} className="text-violet-500" />
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider leading-tight">Funcionário</p>
              </div>
              <p className="text-xl lg:text-2xl font-display font-bold text-violet-600 dark:text-violet-400 tracking-tight">{fmt(pagamentoFuncionario)}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-muted-foreground">{contratosFechadosNoMes.length}× R$70</p>
                <p className="text-[10px] text-success font-medium">Pago: {fmt(funcValorPago)}</p>
              </div>
            </Card>
          </div>

          {/* Averages */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {Object.entries(mediasGastos).map(([cat, val]) => (
              <Card key={cat} className="p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground font-medium mb-1">{cat}</p>
                <p className="text-lg font-display font-bold">{fmt(val)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Média últimos 6 meses</p>
              </Card>
            ))}
          </div>

          {/* Revenue breakdown + Expense breakdown */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
                <ArrowUpCircle size={18} className="text-success" /> Entradas por Origem
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-success/5 border border-success/20">
                  <span className="text-sm font-medium">Contratos</span>
                  <span className="font-bold text-success">{fmt(entradasBySource.contratos)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-sm font-medium">Entradas Manuais</span>
                  <span className="font-bold text-primary">{fmt(entradasBySource.manuais)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg border border-border">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-bold text-foreground">{fmt(entradasBySource.contratos + entradasBySource.manuais)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-display font-semibold text-base mb-3 flex items-center gap-2">
                <ArrowDownCircle size={18} className="text-danger" /> Despesas por Categoria
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {expensesByCategory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa neste mês</p>
                ) : (
                  expensesByCategory.map(([cat, val]) => {
                    const percent = despesasDoMes > 0 ? (val / despesasDoMes) * 100 : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium truncate">{cat}</span>
                            <span className="text-sm font-bold text-danger shrink-0">{fmt(val)}</span>
                          </div>
                          <Progress value={percent} className="h-1.5" />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-10 text-right">{percent.toFixed(0)}%</span>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Extrato Consolidado */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base flex items-center gap-2">
                <FileText size={18} /> Extrato Consolidado
                {cardFilter !== "all" && (
                  <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => setCardFilter("all")}>
                    <X size={10} className="mr-1" /> Limpar filtro
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">{filteredExtrato.length} movimentação(ões)</p>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {filteredExtrato.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma movimentação</div>
              ) : filteredExtrato.map(item => renderTransaction(item, false))}
            </div>
            <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Entradas</p>
                <p className="font-display font-bold text-success">{fmt(allEntradas.reduce((s, i) => s + i.amount, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Saídas</p>
                <p className="font-display font-bold text-danger">{fmt(allSaidas.reduce((s, i) => s + i.amount, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Saldo</p>
                <p className={`font-display font-bold ${allEntradas.reduce((s, i) => s + i.amount, 0) - allSaidas.reduce((s, i) => s + i.amount, 0) >= 0 ? "text-success" : "text-danger"}`}>
                  {fmt(allEntradas.reduce((s, i) => s + i.amount, 0) - allSaidas.reduce((s, i) => s + i.amount, 0))}
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ====== TAB FLUXO DE CAIXA ====== */}
        <TabsContent value="fluxo" className="space-y-6 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Entradas */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                    <ArrowUpCircle size={18} className="text-success" /> Entradas
                  </h2>
                  <p className="text-xs text-muted-foreground">Recebimentos de {monthLabel}</p>
                </div>
                <div className="flex gap-2">
                  {selectedEntries.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="gap-1.5 h-8 text-xs rounded-lg">
                          <Trash2 size={12} /> ({selectedEntries.size})
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
                  <Button onClick={() => setImportEntryOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
                    <Upload size={12} /> Importar
                  </Button>
                  <Button onClick={() => setEntryOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
                    <Plus size={12} /> Entrada
                  </Button>
                </div>
              </div>

              {/* Entry Filters */}
              <div className="flex gap-2 mb-3 flex-wrap">
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={entrySearch} onChange={(e) => setEntrySearch(e.target.value)} />
                </div>
                <Select value={entryFilter} onValueChange={setEntryFilter}>
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Filtrar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="payment">Contratos</SelectItem>
                    <SelectItem value="manual_entry">Manuais</SelectItem>
                    {ENTRY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(entryFilter !== "all" || entrySearch) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setEntryFilter("all"); setEntrySearch(""); }}>
                    <X size={12} />
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {filteredEntradas.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma entrada encontrada</div>
                ) : filteredEntradas.map(item => renderTransaction(item, true, selectedEntries, setSelectedEntries))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Total ({filteredEntradas.length})</span>
                <span className="font-display font-bold text-success">{fmt(filteredEntradas.reduce((s, i) => s + i.amount, 0))}</span>
              </div>
            </Card>

            {/* Saídas */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                    <ArrowDownCircle size={18} className="text-danger" /> Saídas
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
                  <Button onClick={() => setImportExpOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
                    <Upload size={12} /> Importar
                  </Button>
                  <Button onClick={() => setExpOpen(true)} size="sm" className="gap-1.5 h-8 text-xs rounded-lg">
                    <Plus size={12} /> Despesa
                  </Button>
                </div>
              </div>

              {/* Expense Filters */}
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
                {filteredSaidas.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma despesa encontrada</div>
                ) : filteredSaidas.map(item => renderTransaction(item, true, selectedExpenses, setSelectedExpenses))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Total ({filteredSaidas.length})</span>
                <span className="font-display font-bold text-danger">{fmt(filteredSaidas.reduce((s, i) => s + i.amount, 0))}</span>
              </div>
            </Card>
          </div>

          {/* Bottom summary bar */}
          <Card className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Entradas</p>
                <p className="text-lg font-display font-bold text-success">{fmt(allEntradas.reduce((s, i) => s + i.amount, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Saídas</p>
                <p className="text-lg font-display font-bold text-danger">{fmt(allSaidas.reduce((s, i) => s + i.amount, 0))}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Funcionário</p>
                <p className="text-lg font-display font-bold text-violet-600 dark:text-violet-400">{fmt(funcValorPago)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Reservas</p>
                <p className="text-lg font-display font-bold text-amber-600 dark:text-amber-400">{fmt(totalReservas)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lucro Líquido</p>
                <p className={`text-lg font-display font-bold ${lucroDoMes >= 0 ? "text-success" : "text-danger"}`}>{fmt(lucroDoMes)}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ====== TAB RESERVAS ====== */}
        <TabsContent value="reservas" className="space-y-6 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Melhoria */}
            <Card className="p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-500/15 p-3">
                    <Wrench size={20} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">Fundo de Melhorias</h3>
                    <p className="text-xs text-muted-foreground">Reserva para reformas e equipamentos</p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Zerar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zerar reserva de melhorias?</AlertDialogTitle>
                      <AlertDialogDescription>O valor acumulado será zerado.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleResetReserve("melhoria")}>Zerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Acumulado</p>
                    <p className="text-2xl font-display font-bold text-amber-600 dark:text-amber-400">{fmt(reserves.melhoria.saved)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Meta</p>
                    <p className="text-2xl font-display font-bold">{reserves.melhoria.goal > 0 ? fmt(reserves.melhoria.goal) : "—"}</p>
                  </div>
                </div>

                {reserves.melhoria.goal > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso</span>
                      <span>{Math.min(100, (reserves.melhoria.saved / reserves.melhoria.goal * 100)).toFixed(0)}%</span>
                    </div>
                    <Progress value={Math.min(100, (reserves.melhoria.saved / reserves.melhoria.goal * 100))} className="h-2.5" />
                  </div>
                )}

                <div className="flex gap-2">
                  <CurrencyInput value={melhoriaAddAmount} onChange={setMelhoriaAddAmount} placeholder="Valor" className="flex-1" />
                  <Button size="sm" className="h-10" onClick={() => handleAddReserve("melhoria")}>
                    <Plus size={14} className="mr-1" /> Adicionar
                  </Button>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Definir meta</Label>
                    <CurrencyInput value={reserveGoalEdit} onChange={setReserveGoalEdit} placeholder="R$ 0,00" />
                  </div>
                  <Button size="sm" variant="outline" className="h-10" onClick={() => { setReserveType("melhoria"); handleSetGoal(); }}>
                    <Target size={14} className="mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            </Card>

            {/* Marketing / Tráfego Pago */}
            <Card className="p-5 border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-500/15 p-3">
                    <Megaphone size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">Fundo de Marketing</h3>
                    <p className="text-xs text-muted-foreground">Reserva para tráfego pago e anúncios</p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Zerar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zerar reserva de marketing?</AlertDialogTitle>
                      <AlertDialogDescription>O valor acumulado será zerado.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleResetReserve("marketing")}>Zerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Acumulado</p>
                    <p className="text-2xl font-display font-bold text-blue-600 dark:text-blue-400">{fmt(reserves.marketing.saved)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Meta</p>
                    <p className="text-2xl font-display font-bold">{reserves.marketing.goal > 0 ? fmt(reserves.marketing.goal) : "—"}</p>
                  </div>
                </div>

                {reserves.marketing.goal > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso</span>
                      <span>{Math.min(100, (reserves.marketing.saved / reserves.marketing.goal * 100)).toFixed(0)}%</span>
                    </div>
                    <Progress value={Math.min(100, (reserves.marketing.saved / reserves.marketing.goal * 100))} className="h-2.5" />
                  </div>
                )}

                <div className="flex gap-2">
                  <CurrencyInput value={marketingAddAmount} onChange={setMarketingAddAmount} placeholder="Valor" className="flex-1" />
                  <Button size="sm" className="h-10" onClick={() => handleAddReserve("marketing")}>
                    <Plus size={14} className="mr-1" /> Adicionar
                  </Button>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Definir meta</Label>
                    <CurrencyInput value={reserveGoalEdit} onChange={setReserveGoalEdit} placeholder="R$ 0,00" />
                  </div>
                  <Button size="sm" variant="outline" className="h-10" onClick={() => { setReserveType("marketing"); handleSetGoal(); }}>
                    <Target size={14} className="mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Summary */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
              <PiggyBank size={18} /> Resumo das Reservas — {monthLabel}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Melhorias</p>
                <p className="text-xl font-display font-bold text-amber-600 dark:text-amber-400">{fmt(reserves.melhoria.saved)}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Marketing</p>
                <p className="text-xl font-display font-bold text-blue-600 dark:text-blue-400">{fmt(reserves.marketing.saved)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Reservado</p>
                <p className="text-xl font-display font-bold">{fmt(totalReservas)}</p>
              </div>
              <div className={`p-3 rounded-lg border text-center ${lucroDoMes >= 0 ? "bg-success/10 border-success/20" : "bg-danger/10 border-danger/20"}`}>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lucro após Reservas</p>
                <p className={`text-xl font-display font-bold ${lucroDoMes >= 0 ? "text-success" : "text-danger"}`}>{fmt(lucroDoMes)}</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Func Modal */}
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
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{fmt(pagamentoFuncionario)}</p>
                <p className="text-[10px] text-muted-foreground">{contratosFechadosNoMes.length} × R$70</p>
              </div>
              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Pago</p>
                <p className="text-lg font-bold text-success">{fmt(funcValorPago)}</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Falta</p>
                <p className="text-lg font-bold text-warning">{fmt(funcFalta)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Valor já pago</Label>
              <CurrencyInput value={funcValorPago} onChange={handleFuncValorPagoChange} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Contratos do mês:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {contratosFechadosNoMes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum contrato</p>}
                {contratosFechadosNoMes.map(c => {
                  const clientName = clients.find(cl => cl.id === c.clientId)?.name || "—";
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{clientName}</p>
                        <p className="text-[10px] text-muted-foreground">{c.eventType} — {new Date(c.eventDate).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <p className="text-sm font-bold">{fmt(VALOR_POR_CONTRATO_FUNCIONARIO)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adicionar Despesa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Descrição *</Label>
              <Input value={expForm.description} onChange={(e) => setExp("description", e.target.value)} placeholder="Ex: Conta de luz" className="rounded-lg h-11" />
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

      {/* Entry Modal */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adicionar Entrada</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Descrição *</Label>
              <Input value={entryForm.description} onChange={(e) => setEntry("description", e.target.value)} placeholder="Ex: Aluguel extra" className="rounded-lg h-11" />
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

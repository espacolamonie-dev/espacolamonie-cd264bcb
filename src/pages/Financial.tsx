import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3, ArrowUpDown, UserRound, PiggyBank,
  CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle,
  Landmark, DollarSign,
} from "lucide-react";
import {
  getPayments, getExpenses, getManualEntries, getContracts, getClients,
  deleteManualEntry, deleteExpense,
} from "@/data/store";
import type { Payment, Expense, ManualEntry, Contract, Client } from "@/types";
import type { FinancialData, FinancialTransaction } from "@/components/financial/types";

import FinancialSummary from "@/components/financial/FinancialSummary";
import FinancialCashFlow from "@/components/financial/FinancialCashFlow";
import FinancialRevenue from "@/components/financial/FinancialRevenue";
import FinancialExpenses from "@/components/financial/FinancialExpenses";
import EmployeesTab from "@/components/EmployeesTab";
import FinancialReserves from "@/components/financial/FinancialReserves";
import FinancialImport from "@/components/financial/FinancialImport";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [empTotalDue, setEmpTotalDue] = useState(0);
  const [empTotalPaid, setEmpTotalPaid] = useState(0);
  const [activeTab, setActiveTab] = useState("resumo");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = async () => {
    try {
      const [p, m, e, c, cl] = await Promise.all([
        getPayments(), getManualEntries(), getExpenses(), getContracts(), getClients(),
      ]);
      setPayments(p); setManualEntries(m); setExpenses(e); setContracts(c); setClients(cl);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handleFocus = () => load();
    const handleVisibility = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(load, 10000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Employee totals
  const loadEmployeeData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [year, month] = selectedMonth.split("-").map(Number);
    const mStart = new Date(year, month - 1, 1);
    const mEnd = new Date(year, month, 0, 23, 59, 59);

    const { data: empData } = await (supabase.from("employees" as any) as any)
      .select("*").eq("user_id", user.id).eq("is_active", true);
    const { data: payData } = await (supabase.from("employee_payments" as any) as any)
      .select("*").eq("user_id", user.id);

    const employees = empData || [];
    const empPayments = payData || [];
    const ac = contracts.filter(c => c.status !== "cancelled");
    const monthContracts = ac.filter(c => {
      const d = new Date(c.createdAt); return d >= mStart && d <= mEnd;
    }).filter(c => c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full");

    const getUnits = (c: any) => (c.eventDateEnd && c.eventDateEnd !== c.eventDate) ? 2 : 1;
    const units = monthContracts.reduce((s, c) => s + getUnits(c), 0);

    let totalDue = 0;
    let totalPaid = 0;
    for (const emp of employees) {
      if (emp.payment_type === "por_contrato") totalDue += units * Number(emp.payment_value);
      else if (emp.payment_type === "fixo_mensal") totalDue += Number(emp.payment_value);
      totalPaid += empPayments
        .filter((p: any) => p.employee_id === emp.id && new Date(p.date) >= mStart && new Date(p.date) <= mEnd)
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
    }
    setEmpTotalDue(totalDue);
    setEmpTotalPaid(totalPaid);
  }, [selectedMonth, contracts]);

  useEffect(() => { loadEmployeeData(); }, [loadEmployeeData]);

  // Computed data
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);
  const nextMonthStart = new Date(year, month, 1);
  const nextMonthEnd = new Date(year, month + 1, 0, 23, 59, 59);

  const cancelledContractIds = new Set(contracts.filter(c => c.status === "cancelled").map(c => c.id));
  const activeContracts = contracts.filter(c => c.status !== "cancelled");
  const activePayments = payments.filter(p => !cancelledContractIds.has(p.contractId));

  const contractClientMap = Object.fromEntries(
    contracts.map(c => [c.id, clients.find(cl => cl.id === c.clientId)?.name || "—"])
  );

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
    const contractsCreated = activeContracts.filter(c => {
      const d = new Date(c.createdAt); return d >= monthStart && d <= monthEnd;
    });
    const sinais = contractsCreated.reduce((sum, c) => {
      if (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full") return sum + c.depositValue;
      return sum;
    }, 0);
    const monthEntries = manualEntries.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    });
    return sinais + monthEntries.reduce((s, e) => s + e.amount, 0);
  }, [activeContracts, manualEntries, monthStart, monthEnd]);

  const despesasDoMes = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    }).reduce((s, e) => s + e.amount, 0);
  }, [expenses, monthStart, monthEnd]);

  const lucroDoMes = recebidoNoMes - despesasDoMes - empTotalPaid;

  // Build extrato
  const extrato = useMemo((): FinancialTransaction[] => {
    const mp = activePayments.filter(p => { const d = new Date(p.date); return d >= monthStart && d <= monthEnd; });
    const me = manualEntries.filter(e => { const d = new Date(e.date); return d >= monthStart && d <= monthEnd; });
    const mx = expenses.filter(e => { const d = new Date(e.date); return d >= monthStart && d <= monthEnd; });
    const entries: FinancialTransaction[] = [
      ...mp.map(p => ({ id: p.id, date: p.date, description: p.description || contractClientMap[p.contractId] || "Pagamento", category: "Contrato", amount: p.amount, type: "entrada" as const, source: "payment" as const })),
      ...me.map(e => ({ id: e.id, date: e.date, description: e.description, category: e.category, amount: e.amount, type: "entrada" as const, source: "manual_entry" as const })),
      ...mx.map(e => ({ id: e.id, date: e.date, description: e.description, category: e.category, amount: e.amount, type: "saida" as const, source: "expense" as const })),
    ];
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activePayments, manualEntries, expenses, contractClientMap, monthStart, monthEnd]);

  const allEntradas = extrato.filter(i => i.type === "entrada");
  const allSaidas = extrato.filter(i => i.type === "saida");

  const monthLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const financialData: FinancialData = {
    payments, manualEntries, expenses, contracts, clients,
    activeContracts, activePayments,
    recebidoNoMes, despesasDoMes, lucroDoMes,
    empTotalDue, empTotalPaid,
    monthStart, monthEnd, year, month, selectedMonth, monthLabel,
    allEntradas, allSaidas, extrato,
    monthContracts, nextMonthContracts,
    aReceberMesAtual, aReceberProximoMes,
    contractClientMap,
  };

  const handleDeleteEntry = async (item: FinancialTransaction) => {
    try {
      if (item.source === "manual_entry") await deleteManualEntry(item.id);
      else if (item.source === "expense") await deleteExpense(item.id);
      toast.success("Item excluído");
      await load();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão financeira completa do espaço</p>
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
        <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <TabsList className="inline-flex w-auto min-w-full lg:min-w-0">
            <TabsTrigger value="resumo" className="gap-1.5 text-xs"><BarChart3 size={13} /> Resumo</TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1.5 text-xs"><ArrowUpDown size={13} /> Fluxo</TabsTrigger>
            <TabsTrigger value="receitas" className="gap-1.5 text-xs"><ArrowUpCircle size={13} /> Receitas</TabsTrigger>
            <TabsTrigger value="despesas" className="gap-1.5 text-xs"><ArrowDownCircle size={13} /> Despesas</TabsTrigger>
            <TabsTrigger value="funcionarios" className="gap-1.5 text-xs"><UserRound size={13} /> Funcionários</TabsTrigger>
            <TabsTrigger value="reservas" className="gap-1.5 text-xs"><PiggyBank size={13} /> Reservas</TabsTrigger>
            <TabsTrigger value="importar" className="gap-1.5 text-xs"><Landmark size={13} /> Importar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumo" className="mt-4">
          <FinancialSummary data={financialData} onTabChange={setActiveTab} />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4">
          <FinancialCashFlow data={financialData} onDeleteEntry={handleDeleteEntry} />
        </TabsContent>

        <TabsContent value="receitas" className="mt-4">
          <FinancialRevenue data={financialData} onReload={load} />
        </TabsContent>

        <TabsContent value="despesas" className="mt-4">
          <FinancialExpenses data={financialData} onReload={load} />
        </TabsContent>

        <TabsContent value="funcionarios" className="mt-4">
          <EmployeesTab selectedMonth={selectedMonth} contracts={contracts} clients={clients} />
        </TabsContent>

        <TabsContent value="reservas" className="mt-4">
          <FinancialReserves selectedMonth={selectedMonth} lucroDoMes={lucroDoMes} />
        </TabsContent>

        <TabsContent value="importar" className="mt-4">
          <FinancialImport
            contracts={contracts}
            clients={clients}
            payments={payments}
            manualEntries={manualEntries}
            expenses={expenses}
            onReload={load}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

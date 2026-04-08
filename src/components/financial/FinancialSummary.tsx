import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, DollarSign, Calendar, UserRound,
  CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle,
  BarChart3, Target,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { FinancialData } from "./types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  data: FinancialData;
  onTabChange: (tab: string) => void;
}

export default function FinancialSummary({ data, onTabChange }: Props) {
  const {
    recebidoNoMes, despesasDoMes, lucroDoMes, empTotalDue, empTotalPaid,
    activeContracts, expenses, manualEntries, payments,
    monthStart, monthEnd, year, month, allEntradas, allSaidas,
    monthContracts, nextMonthContracts, aReceberMesAtual, aReceberProximoMes,
  } = data;

  // Contracts with deposit paid this month
  const contractsPaidThisMonth = activeContracts.filter(c => {
    const d = new Date(c.createdAt);
    return d >= monthStart && d <= monthEnd && (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full");
  });

  const ticketMedio = contractsPaidThisMonth.length > 0
    ? contractsPaidThisMonth.reduce((s, c) => s + c.totalValue, 0) / contractsPaidThisMonth.length
    : 0;

  // Expense breakdown by category
  const expensesByCategory = useMemo(() => {
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date); return d >= monthStart && d <= monthEnd;
    });
    const grouped: Record<string, number> = {};
    monthExpenses.forEach(e => { grouped[e.category] = (grouped[e.category] || 0) + e.amount; });
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [expenses, monthStart, monthEnd]);

  // Revenue by source
  const entradasBySource = useMemo(() => {
    const contratos = allEntradas.filter(i => i.source === "payment").reduce((s, i) => s + i.amount, 0);
    const manuais = allEntradas.filter(i => i.source === "manual_entry").reduce((s, i) => s + i.amount, 0);
    return { contratos, manuais };
  }, [allEntradas]);

  // Chart: monthly evolution (last 6 months)
  const evolutionData = useMemo(() => {
    const months: { label: string; receita: number; despesa: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString("pt-BR", { month: "short" });

      const monthPayments = payments.filter(p => {
        const pd = new Date(p.date); return pd >= mStart && pd <= mEnd;
      });
      const monthEntries = manualEntries.filter(e => {
        const ed = new Date(e.date); return ed >= mStart && ed <= mEnd;
      });
      const monthExpenses = expenses.filter(e => {
        const ed = new Date(e.date); return ed >= mStart && ed <= mEnd;
      });
      const receita = monthPayments.reduce((s, p) => s + p.amount, 0) + monthEntries.reduce((s, e) => s + e.amount, 0);
      const despesa = monthExpenses.reduce((s, e) => s + e.amount, 0);
      months.push({ label, receita, despesa, lucro: receita - despesa });
    }
    return months;
  }, [payments, manualEntries, expenses, year, month]);

  // Cash flow cumulative
  const cashFlowData = useMemo(() => {
    const allItems = [
      ...allEntradas.map(i => ({ ...i, value: i.amount })),
      ...allSaidas.map(i => ({ ...i, value: -i.amount })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let cumulative = 0;
    const dailyMap: Record<string, { entradas: number; saidas: number; saldo: number }> = {};
    for (const item of allItems) {
      cumulative += item.value;
      if (!dailyMap[item.date]) dailyMap[item.date] = { entradas: 0, saidas: 0, saldo: 0 };
      if (item.value > 0) dailyMap[item.date].entradas += item.value;
      else dailyMap[item.date].saidas += Math.abs(item.value);
      dailyMap[item.date].saldo = cumulative;
    }
    return Object.entries(dailyMap).map(([date, vals]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...vals,
    }));
  }, [allEntradas, allSaidas]);

  const funcFalta = Math.max(0, empTotalDue - empTotalPaid);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-success/15 p-2"><TrendingUp size={14} className="text-success" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Receita do Mês</p>
          </div>
          <p className="text-xl lg:text-2xl font-display font-bold text-success tracking-tight">{fmt(recebidoNoMes)}</p>
        </Card>

        <Card className="p-4 border-danger/30 bg-gradient-to-br from-danger/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-danger/15 p-2"><TrendingDown size={14} className="text-danger" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Despesas do Mês</p>
          </div>
          <p className="text-xl lg:text-2xl font-display font-bold text-danger tracking-tight">{fmt(despesasDoMes)}</p>
        </Card>

        <Card className={`p-4 ${lucroDoMes >= 0 ? "border-success/30 bg-gradient-to-br from-success/5" : "border-danger/30 bg-gradient-to-br from-danger/5"} to-transparent`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-full p-2 ${lucroDoMes >= 0 ? "bg-success/15" : "bg-danger/15"}`}>
              <DollarSign size={14} className={lucroDoMes >= 0 ? "text-success" : "text-danger"} />
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Lucro Líquido</p>
          </div>
          <p className={`text-xl lg:text-2xl font-display font-bold tracking-tight ${lucroDoMes >= 0 ? "text-success" : "text-danger"}`}>{fmt(lucroDoMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Recebido - Despesas - Func.</p>
        </Card>

        <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-primary/15 p-2"><Target size={14} className="text-primary" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Ticket Médio</p>
          </div>
          <p className="text-xl lg:text-2xl font-display font-bold text-primary tracking-tight">{fmt(ticketMedio)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{contractsPaidThisMonth.length} contrato(s) pago(s)</p>
        </Card>
      </div>

      {/* Second row KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-warning/30 bg-gradient-to-br from-warning/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-warning/15 p-2"><Calendar size={14} className="text-warning" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">A Receber (Mês)</p>
          </div>
          <p className="text-xl font-display font-bold text-warning tracking-tight">{fmt(aReceberMesAtual)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{monthContracts.length} evento(s)</p>
        </Card>

        <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-primary/15 p-2"><Calendar size={14} className="text-primary" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">A Receber (Próximo)</p>
          </div>
          <p className="text-xl font-display font-bold text-primary tracking-tight">{fmt(aReceberProximoMes)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{nextMonthContracts.length} evento(s)</p>
        </Card>

        <Card className="p-4 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => onTabChange("funcionarios")}>
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-violet-500/15 p-2"><UserRound size={14} className="text-violet-500" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Comissões a Pagar</p>
          </div>
          <p className="text-xl font-display font-bold text-violet-600 dark:text-violet-400 tracking-tight">{fmt(funcFalta)}</p>
          <p className="text-[10px] text-success font-medium mt-1">Já pago: {fmt(empTotalPaid)}</p>
        </Card>

        <Card className="p-4 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-violet-500/15 p-2"><DollarSign size={14} className="text-violet-500" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Pago em Comissões</p>
          </div>
          <p className="text-xl font-display font-bold text-violet-600 dark:text-violet-400 tracking-tight">{fmt(empTotalPaid)}</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue vs Expense bar chart */}
        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
            <BarChart3 size={18} /> Receita vs Despesa (6 meses)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly evolution line chart */}
        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
            <TrendingUp size={18} /> Evolução do Lucro
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(var(--success))" strokeWidth={1.5} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Cash flow area chart */}
      {cashFlowData.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
            <DollarSign size={18} /> Fluxo de Caixa do Mês
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Revenue + Expense breakdown */}
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
              <span className="font-bold">{fmt(entradasBySource.contratos + entradasBySource.manuais)}</span>
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
    </div>
  );
}

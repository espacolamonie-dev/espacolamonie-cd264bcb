import { useEffect, useState, useMemo } from "react";
import { formatDateBR } from "@/lib/dateUtils";
import { CalendarDays, DollarSign, Users, TrendingUp, Target, Percent, Globe, ArrowUpRight, ArrowDownRight, Minus, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getContracts, getClients, getActivePayments, getManualEntries, getExpenses } from "@/data/store";
import { getVisits, type Visit } from "@/data/visitStore";
import type { Contract } from "@/types";
import { CampaignAttribution } from "@/components/CampaignAttribution";
import OriginReports from "@/components/OriginReports";
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
  LineChart, Line, Area, AreaChart,
} from "recharts";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

function GrowthBadge({ value }: { value: number }) {
  if (value > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary"><ArrowUpRight size={12} />+{value}%</span>;
  if (value < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-destructive"><ArrowDownRight size={12} />{value}%</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground"><Minus size={12} />0%</span>;
}

function EvolutionTab({ contracts, payments, visits, allExpenses }: {
  contracts: Contract[];
  payments: { amount: number; date: string }[];
  visits: any[];
  allExpenses: { amount: number; date: string }[];
  clientMap: Record<string, string>;
}) {
  const evolution = useMemo(() => {
    const months: {
      key: string; label: string;
      contracts: number; revenue: number; expenses: number; profit: number;
      visits: number; converted: number; conversionRate: number;
      avgTicket: number; totalContractValue: number;
    }[] = [];

    for (let i = 11; i >= 0; i--) {
      const ms = startOfMonth(subMonths(new Date(), i));
      const me = endOfMonth(ms);
      const key = format(ms, "yyyy-MM");
      const label = format(ms, "MMM yy", { locale: ptBR });

      const active = contracts.filter((c) => c.status !== "cancelled" && c.status !== "expired");

      const monthContracts = active.filter((c) => {
        const d = new Date(c.createdAt);
        return !isBefore(d, ms) && !isAfter(d, me);
      });

      const monthVisits = visits.filter((v: any) => {
        const d = new Date(v.visitDate + "T12:00:00");
        return !isBefore(d, ms) && !isAfter(d, me);
      });

      const activeVisitIds = new Set(active.filter((c) => c.visitId).map((c) => c.visitId));
      const confirmedVisits = monthVisits.filter((v: any) => v.status === "Confirmada" || v.status === "Convertida em contrato");
      const convertedCount = confirmedVisits.filter((v: any) => activeVisitIds.has(v.id) || v.status === "Convertida em contrato").length;

      const sinais = monthContracts.reduce((sum, c) => {
        if (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full") return sum + c.depositValue;
        return sum;
      }, 0);
      const manualEntries = payments.filter((p) => { const d = parseISO(p.date); return !isBefore(d, ms) && !isAfter(d, me); }).reduce((s, p) => s + p.amount, 0);
      const revenue = sinais + manualEntries;

      const expensesTotal = allExpenses.filter((e) => { const d = parseISO(e.date); return !isBefore(d, ms) && !isAfter(d, me); }).reduce((s, e) => s + e.amount, 0);

      const totalContractValue = monthContracts.reduce((s, c) => s + c.totalValue, 0);

      months.push({
        key, label,
        contracts: monthContracts.length,
        revenue, expenses: expensesTotal,
        profit: revenue - expensesTotal,
        visits: monthVisits.length,
        converted: convertedCount,
        conversionRate: confirmedVisits.length > 0 ? Math.round((convertedCount / confirmedVisits.length) * 100) : 0,
        avgTicket: monthContracts.length > 0 ? totalContractValue / monthContracts.length : 0,
        totalContractValue,
      });
    }

    const curr = months[months.length - 1];
    const prev = months[months.length - 2];
    const bestRevenue = [...months].sort((a, b) => b.revenue - a.revenue)[0];
    const bestContracts = [...months].sort((a, b) => b.contracts - a.contracts)[0];

    const eventTypeCounts: Record<string, number> = {};
    const active = contracts.filter((c) => c.status !== "cancelled" && c.status !== "expired");
    active.forEach((c) => { eventTypeCounts[c.eventType] = (eventTypeCounts[c.eventType] || 0) + 1; });
    const eventTypeData = Object.entries(eventTypeCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { months, curr, prev, bestRevenue, bestContracts, eventTypeData };
  }, [contracts, payments, visits, allExpenses]);

  const COLORS_EVO = ["hsl(153 42% 26%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(42 45% 56%)", "hsl(220 9% 46%)", "hsl(280 60% 50%)", "hsl(200 80% 50%)"];
  const { curr, prev, months } = evolution;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Contratos", val: curr.contracts, prevVal: prev.contracts, isCurrency: false },
          { label: "Faturamento", val: curr.revenue, prevVal: prev.revenue, isCurrency: true, color: "text-primary" },
          { label: "Lucro", val: curr.profit, prevVal: prev.profit, isCurrency: true, color: curr.profit >= 0 ? "text-primary" : "text-destructive" },
          { label: "Ticket médio", val: curr.avgTicket, prevVal: prev.avgTicket, isCurrency: true },
        ].map((kpi) => (
          <div key={kpi.label} className="stat-card">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">{kpi.label}</p>
            <p className={`text-2xl font-display font-bold ${kpi.color || ""}`}>{kpi.isCurrency ? fmt(kpi.val) : kpi.val}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">vs {kpi.isCurrency ? fmt(kpi.prevVal) : kpi.prevVal}</span>
              <GrowthBadge value={pct(kpi.val, kpi.prevVal)} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="card-premium p-5">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Conversão este mês</p>
          <p className="text-4xl font-display font-bold text-primary">{curr.conversionRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">{curr.converted} contratos de {curr.visits} visitas</p>
          <div className="mt-2"><GrowthBadge value={pct(curr.conversionRate, prev.conversionRate)} /></div>
        </div>
        <div className="card-premium p-5">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">🏆 Melhor mês (receita)</p>
          <p className="text-2xl font-display font-bold">{fmt(evolution.bestRevenue.revenue)}</p>
          <p className="text-xs text-muted-foreground capitalize">{evolution.bestRevenue.label}</p>
        </div>
        <div className="card-premium p-5">
          <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">🏆 Melhor mês (contratos)</p>
          <p className="text-2xl font-display font-bold">{evolution.bestContracts.contracts} contratos</p>
          <p className="text-xs text-muted-foreground capitalize">{evolution.bestContracts.label}</p>
        </div>
      </div>

      <div className="card-premium p-6">
        <h2 className="font-display text-lg font-semibold mb-1">Receita vs Despesas (12 meses)</h2>
        <p className="text-xs text-muted-foreground mb-6">Evolução financeira mensal</p>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={months} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
              <Area type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--primary))" fill="url(#gradRevenue)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Despesas" stroke="hsl(var(--destructive))" fill="url(#gradExpense)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Contratos por mês</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                <Bar dataKey="contracts" name="Contratos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Taxa de conversão</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                <Line type="monotone" dataKey="conversionRate" name="Conversão" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Lucro líquido mensal</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                <Bar dataKey="profit" name="Lucro" radius={[6, 6, 0, 0]} barSize={22}>
                  {months.map((m, i) => (
                    <Cell key={i} fill={m.profit >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Distribuição de eventos</h2>
          <p className="text-xs text-muted-foreground mb-6">Por tipo (todos os períodos)</p>
          <div className="h-[280px]">
            {evolution.eventTypeData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={evolution.eventTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={{ stroke: "hsl(var(--muted-foreground))" }} style={{ fontSize: "10px" }}>
                    {evolution.eventTypeData.map((_, i) => (
                      <Cell key={i} fill={COLORS_EVO[i % COLORS_EVO.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} evento${v > 1 ? "s" : ""}`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="px-6 py-4">
          <h2 className="font-display text-lg font-semibold">Resumo mensal (12 meses)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Mês</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Contratos</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Visitas</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Conversão</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Receita</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Despesas</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Lucro</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {months.slice().reverse().map((m, i) => (
                <tr key={m.key} className={`border-b border-border/50 ${i === 0 ? "bg-primary/5 font-medium" : "hover:bg-muted/20"}`}>
                  <td className="px-4 py-2.5 capitalize">{m.label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.contracts}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.visits}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.conversionRate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-primary">{fmt(m.revenue)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-destructive">{fmt(m.expenses)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${m.profit >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(m.profit)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(m.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clientMap, setClientMap] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<{ amount: number; date: string }[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<{ amount: number; date: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const loadData = async () => {
    try {
      const [c, cl, ap, me, v, exp] = await Promise.all([
        getContracts(), getClients(), getActivePayments(), getManualEntries(), getVisits(), getExpenses(),
      ]);
      setContracts(c);
      setClientMap(Object.fromEntries(cl.map((x) => [x.id, x.name])));
      setPayments([
        ...ap.map((p) => ({ amount: p.amount, date: p.date })),
        ...me.map((e) => ({ amount: e.amount, date: e.date })),
      ]);
      setVisits(v);
      setAllExpenses(exp.map((e: any) => ({ amount: e.amount, date: e.date })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Auto-refresh when page gains focus
  useEffect(() => {
    const handleFocus = () => { loadData(); };
    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => { if (document.visibilityState === "visible") loadData(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      opts.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return opts;
  }, []);

  const stats = useMemo(() => {
    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);

    const active = contracts.filter((c) => c.status !== "cancelled");

    // Contratos com evento no mês selecionado
    const monthContracts = active.filter((c) => {
      const d = parseISO(c.eventDate);
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
    });

    // Visitas no mês selecionado
    const monthVisits = visits.filter((v) => {
      const d = new Date(v.visitDate + "T12:00:00");
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
    });

    // Conversão: visitas do mês que viraram contrato (via visit_id no contrato)
    const activeVisitIds = new Set(
      active.filter((c) => c.visitId).map((c) => c.visitId)
    );
    const monthVisitsConfirmed = monthVisits.filter(
      (v) => v.status === "Confirmada" || v.status === "Convertida em contrato"
    );
    const converted = monthVisitsConfirmed.filter(
      (v) => activeVisitIds.has(v.id) || v.status === "Convertida em contrato"
    ).length;
    const conversionBase = monthVisitsConfirmed.length;
    const conversionRate = conversionBase > 0
      ? Math.round((converted / conversionBase) * 100)
      : 0;

    const totalEvents = monthContracts.length;

    // Faturamento = todos os pagamentos recebidos no mês (sinais + entradas manuais)
    const allPaymentsInMonth = payments
      .filter((p) => {
        const d = parseISO(p.date);
        return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
      })
      .reduce((s, p) => s + p.amount, 0);

    // Sinais de contratos criados no mês com pagamento confirmado
    const contractsCreatedThisMonth = active.filter((c) => {
      const d = new Date(c.createdAt);
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
    });
    const sinaisRecebidos = contractsCreatedThisMonth.reduce((sum, c) => {
      if (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full") {
        return sum + c.depositValue;
      }
      return sum;
    }, 0);

    const totalRevenue = sinaisRecebidos + allPaymentsInMonth;

    // Ticket médio baseado no valor TOTAL dos contratos do mês
    const avgTicket = totalEvents > 0
      ? monthContracts.reduce((s, c) => s + c.totalValue, 0) / totalEvents
      : 0;

    const eventTypeCount: Record<string, number> = {};
    monthContracts.forEach((c) => {
      eventTypeCount[c.eventType] = (eventTypeCount[c.eventType] || 0) + 1;
    });
    const eventTypes = Object.entries(eventTypeCount)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const dayCount: Record<number, number> = {};
    monthContracts.forEach((c) => {
      const day = parseISO(c.eventDate).getDay();
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const topDays = Object.entries(dayCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([d, count]) => ({ day: dayNames[Number(d)], count }));

    return {
      totalEvents, totalRevenue, avgTicket, topDays, monthContracts,
      monthVisits: monthVisits.length, conversionRate, confirmedVisits: conversionBase,
      converted, eventTypes,
    };
  }, [selectedMonth, contracts, payments, visits]);

  const chartData = useMemo(() => {
    const now = new Date();
    const data: { label: string; receita: number; contratos: number; visitas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ms = startOfMonth(subMonths(now, i));
      const me = endOfMonth(ms);
      const label = format(ms, "MMM yy", { locale: ptBR });

      // Sinais dos contratos criados nesse mês
      const contractsCreated = contracts.filter((c) => {
        const d = new Date(c.createdAt);
        return !isBefore(d, ms) && !isAfter(d, me) && c.status !== "cancelled";
      });
      const sinais = contractsCreated.reduce((sum, c) => {
        if (c.paymentStatus === "deposit_paid" || c.paymentStatus === "paid_full") {
          return sum + c.depositValue;
        }
        return sum;
      }, 0);
      const manualEntries = payments
        .filter((p) => { const d = parseISO(p.date); return !isBefore(d, ms) && !isAfter(d, me); })
        .reduce((s, p) => s + p.amount, 0);
      const receita = sinais + manualEntries;

      const contratos = contracts.filter((c) => {
        const d = parseISO(c.eventDate);
        return !isBefore(d, ms) && !isAfter(d, me) && c.status !== "cancelled";
      }).length;

      const visitas = visits.filter((v) => {
        const d = new Date(v.visitDate + "T12:00:00");
        return !isBefore(d, ms) && !isAfter(d, me);
      }).length;

      data.push({ label, receita, contratos, visitas });
    }
    return data;
  }, [payments, contracts, visits]);

  const COLORS = [
    "hsl(153 42% 26%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)",
    "hsl(0 84% 60%)", "hsl(42 45% 56%)", "hsl(220 9% 46%)",
  ];

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Indicadores de desempenho do espaço</p>
        </div>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5"><TrendingUp size={14} /> Evolução</TabsTrigger>
          <TabsTrigger value="origem" className="gap-1.5"><Globe size={14} /> Origem</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
        </TabsList>

        {/* ══════ ABA GERAL ══════ */}
        <TabsContent value="geral" className="space-y-6">
          <div className="flex justify-end">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px] h-9 text-sm rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-fade-in">
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-primary/10 p-2"><CalendarDays size={14} className="text-primary" /></div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Visitas no mês</p>
              </div>
              <p className="text-3xl font-display font-bold tracking-tight">{stats.monthVisits}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-success/10 p-2"><Percent size={14} className="text-success" /></div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Conversão</p>
              </div>
              <p className="text-3xl font-display font-bold text-success tracking-tight">{stats.conversionRate}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">{stats.converted} de {stats.confirmedVisits} visitas</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-success/10 p-2"><DollarSign size={14} className="text-success" /></div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Faturamento</p>
              </div>
              <p className="text-2xl font-display font-bold text-success tracking-tight">{fmt(stats.totalRevenue)}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="rounded-full bg-accent p-2"><TrendingUp size={14} className="text-foreground" /></div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Ticket médio</p>
              </div>
              <p className="text-2xl font-display font-bold tracking-tight">{fmt(stats.avgTicket)}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card-premium p-6">
              <h2 className="font-display text-lg font-semibold mb-1">Receita mensal</h2>
              <p className="text-xs text-muted-foreground mb-6">Últimos 6 meses</p>
              <div className="h-[280px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                )}
              </div>
            </div>

            <div className="card-premium p-6">
              <h2 className="font-display text-lg font-semibold mb-1">Visitas vs Contratos</h2>
              <p className="text-xs text-muted-foreground mb-6">Últimos 6 meses</p>
              <div className="h-[280px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
                      <Bar dataKey="visitas" name="Visitas" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={20} />
                      <Bar dataKey="contratos" name="Contratos" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                )}
              </div>
            </div>
          </div>

          {/* Events by type + Top days */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card-premium p-6">
              <h2 className="font-display text-lg font-semibold mb-5">Eventos por tipo</h2>
              {stats.eventTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento neste mês</p>
              ) : (
                <div className="space-y-3">
                  {stats.eventTypes.map((et, i) => (
                    <div key={et.type} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{et.type}</span>
                          <span className="text-xs text-muted-foreground">{et.count} evento{et.count > 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, (et.count / stats.totalEvents) * 100)}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-premium p-6">
              <h2 className="font-display text-lg font-semibold mb-5">Dias mais utilizados</h2>
              {stats.topDays.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento neste mês</p>
              ) : (
                <div className="space-y-4">
                  {stats.topDays.map((d) => (
                    <div key={d.day} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{d.day}</span>
                          <span className="text-xs text-muted-foreground">{d.count} evento{d.count > 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.min(100, (d.count / stats.totalEvents) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Events list */}
          <div className="card-premium">
            <div className="px-6 py-4">
              <h2 className="font-display text-lg font-semibold">Eventos do mês</h2>
            </div>
            <div className="border-t border-border">
              {stats.monthContracts.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nenhum evento agendado neste mês</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {stats.monthContracts.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{clientMap[c.clientId] || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.eventType}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular-nums">{formatDateBR(c.eventDate)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{fmt(c.totalValue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ══════ ABA EVOLUÇÃO ══════ */}
        <TabsContent value="evolucao" className="space-y-6">
          <EvolutionTab contracts={contracts} payments={payments} visits={visits} allExpenses={allExpenses} clientMap={clientMap} />
        </TabsContent>

        {/* ══════ ABA ORIGEM ══════ */}
        <TabsContent value="origem">
          <OriginReports visits={visits as Visit[]} contracts={contracts} />
        </TabsContent>

        {/* ══════ ABA CAMPANHAS ══════ */}
        <TabsContent value="campanhas">
          <CampaignAttribution visits={visits} contracts={contracts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
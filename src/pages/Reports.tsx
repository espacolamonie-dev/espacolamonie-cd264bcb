import { useEffect, useState, useMemo } from "react";
import { formatDateBR } from "@/lib/dateUtils";
import { CalendarDays, DollarSign, Users, TrendingUp, Target, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getContracts, getClients, getActivePayments, getManualEntries, getExpenses } from "@/data/store";
import { getVisits } from "@/data/visitStore";
import type { Contract } from "@/types";
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

    const monthContracts = active.filter((c) => {
      const d = parseISO(c.eventDate);
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
    });

    const monthVisits = visits.filter((v) => {
      const d = new Date(v.visitDate + "T12:00:00");
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
    });

    const confirmedVisits = visits.filter((v) => v.status === "Confirmada");
    const normalize = (s: string) => s.replace(/\D/g, "");
    const contractPhones = new Set(
      active.map((c) => {
        const cl = Object.entries(clientMap).find(([id]) => id === c.clientId);
        return cl ? cl[1] : "";
      }).filter(Boolean)
    );
    const converted = confirmedVisits.filter((v) => {
      const vPhone = normalize(v.clientPhone || "");
      const vName = (v.clientName || "").trim().toLowerCase();
      return active.some((c) => {
        const cName = (clientMap[c.clientId] || "").trim().toLowerCase();
        return cName === vName;
      });
    }).length;
    const conversionRate = confirmedVisits.length > 0
      ? Math.round((converted / confirmedVisits.length) * 100)
      : 0;

    const totalEvents = monthContracts.length;
    // Revenue = sinais dos contratos criados no mês + entradas manuais
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
    const manualEntriesRevenue = payments
      .filter((p) => {
        const d = parseISO(p.date);
        return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
      })
      .reduce((s, p) => s + p.amount, 0);
    const totalRevenue = sinaisRecebidos + manualEntriesRevenue;
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
      monthVisits: monthVisits.length, conversionRate, confirmedVisits: confirmedVisits.length,
      converted, eventTypes,
    };
  }, [selectedMonth, contracts, payments, visits, clientMap]);

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
        {/* Revenue chart */}
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

        {/* Visitas & Contratos chart */}
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
        {/* Events by type */}
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

        {/* Top days */}
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
    </div>
  );
}
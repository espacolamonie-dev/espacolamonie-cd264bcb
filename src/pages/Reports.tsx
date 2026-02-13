import { useEffect, useState, useMemo } from "react";
import { CalendarDays, DollarSign, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getContracts, getClients, getActivePayments, getManualEntries } from "@/data/store";
import type { Contract } from "@/types";
import { format, parseISO, startOfMonth, endOfMonth, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clientMap, setClientMap] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<{ amount: number; date: string }[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  useEffect(() => {
    (async () => {
      try {
        const [c, cl, ap, me] = await Promise.all([
          getContracts(), getClients(), getActivePayments(), getManualEntries(),
        ]);
        setContracts(c);
        setClientMap(Object.fromEntries(cl.map((x) => [x.id, x.name])));
        setPayments([
          ...ap.map((p) => ({ amount: p.amount, date: p.date })),
          ...me.map((e) => ({ amount: e.amount, date: e.date })),
        ]);
      } finally {
        setLoading(false);
      }
    })();
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

    const monthContracts = contracts.filter((c) => {
      const d = parseISO(c.eventDate);
      return !isBefore(d, monthStart) && !isAfter(d, monthEnd) && c.status !== "cancelled";
    });

    const totalEvents = monthContracts.length;
    const totalRevenue = payments
      .filter((p) => {
        const d = parseISO(p.date);
        return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
      })
      .reduce((s, p) => s + p.amount, 0);
    const avgTicket = totalEvents > 0
      ? monthContracts.reduce((s, c) => s + c.totalValue, 0) / totalEvents
      : 0;

    // Most used dates (day of week)
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

    return { totalEvents, totalRevenue, avgTicket, topDays, monthContracts };
  }, [selectedMonth, contracts, payments]);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Relatório Mensal</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo rápido do mês</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={14} className="text-primary" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de eventos</p>
          </div>
          <p className="text-3xl font-bold tracking-tight">{stats.totalEvents}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-success" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total faturado</p>
          </div>
          <p className="text-2xl font-bold text-success tracking-tight">{fmt(stats.totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-accent-foreground" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ticket médio</p>
          </div>
          <p className="text-2xl font-bold tracking-tight">{fmt(stats.avgTicket)}</p>
        </div>
      </div>

      {/* Top days */}
      <div className="rounded-lg border border-border/60 bg-card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">Dias mais utilizados</h2>
        {stats.topDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento neste mês</p>
        ) : (
          <div className="space-y-3">
            {stats.topDays.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{d.day}</span>
                    <span className="text-xs text-muted-foreground">{d.count} evento{d.count > 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, (d.count / stats.totalEvents) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Events list */}
      <div className="rounded-lg border border-border/60 bg-card">
        <div className="px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Eventos do mês</h2>
        </div>
        <div className="border-t border-border/40">
          {stats.monthContracts.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum evento neste mês</p>
          ) : (
            <div className="divide-y divide-border/40">
              {stats.monthContracts.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{clientMap[c.clientId] || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.eventType}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium tabular-nums">{new Date(c.eventDate).toLocaleDateString("pt-BR")}</p>
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

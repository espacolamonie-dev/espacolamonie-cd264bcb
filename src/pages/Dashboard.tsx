import { useEffect, useState } from "react";
import {
  FileText, CheckCircle, Clock, CalendarDays, TrendingUp, TrendingDown, Wallet,
  Plus, FileOutput, DollarSign, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getContracts, getClients, getTotalEntries, getTotalExpenses, getBalance, getActivePayments, getManualEntries, getExpenses } from "@/data/store";
import type { Contract } from "@/types";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface MonthlyData {
  month: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [upcoming, setUpcoming] = useState<(Contract & { clientName: string })[]>([]);
  const [pendingPayments, setPendingPayments] = useState<(Contract & { clientName: string })[]>([]);
  const [financialSummary, setFinancialSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [confirmed, setConfirmed] = useState(0);
  const [awaiting, setAwaiting] = useState(0);
  const [futureCount, setFutureCount] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [alerts, setAlerts] = useState<{ unsignedCount: number; urgentPayments: number }>({ unsignedCount: 0, urgentPayments: 0 });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allContracts, clients, totalIn, totalOut, balance, activePayments, manualEntries, expenses] = await Promise.all([
          getContracts(), getClients(), getTotalEntries(), getTotalExpenses(), getBalance(),
          getActivePayments(), getManualEntries(), getExpenses(),
        ]);

        const active = allContracts.filter((c) => c.status !== "cancelled");
        const conf = active.filter((c) => c.status === "confirmed").length;
        const awaitPay = active.filter(
          (c) => c.paymentStatus === "pending" || c.paymentStatus === "deposit_paid"
        ).length;
        const future = active.filter(
          (c) => new Date(c.eventDate) >= new Date()
        );

        // Alerts
        const unsignedCount = active.filter(
          (c) => c.status === "awaiting_signature" || c.status === "awaiting_documents"
        ).length;
        const sevenDaysFromNow = addDays(new Date(), 7);
        const urgentPayments = active.filter(
          (c) => c.paymentStatus !== "paid_full" && new Date(c.eventDate) <= sevenDaysFromNow && new Date(c.eventDate) >= new Date()
        ).length;
        setAlerts({ unsignedCount, urgentPayments });

        setContracts(active);
        setConfirmed(conf);
        setAwaiting(awaitPay);
        setFutureCount(future.length);
        setFinancialSummary({ totalIn, totalOut, balance });

        const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

        setUpcoming(
          future
            .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
            .slice(0, 5)
            .map((c) => ({ ...c, clientName: clientMap[c.clientId] || "—" }))
        );

        setPendingPayments(
          active
            .filter((c) => c.paymentStatus !== "paid_full")
            .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
            .slice(0, 5)
            .map((c) => ({ ...c, clientName: clientMap[c.clientId] || "—" }))
        );

        // Build monthly data (last 6 months)
        const now = new Date();
        const months: MonthlyData[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthStart = startOfMonth(subMonths(now, i));
          const monthEnd = startOfMonth(subMonths(now, i - 1));
          const label = format(monthStart, "MMM yy", { locale: ptBR });

          const monthEntries = activePayments.filter((p) => {
            const d = parseISO(p.date);
            return !isBefore(d, monthStart) && isBefore(d, monthEnd);
          }).reduce((s, p) => s + p.amount, 0);

          const monthManual = manualEntries.filter((e) => {
            const d = parseISO(e.date);
            return !isBefore(d, monthStart) && isBefore(d, monthEnd);
          }).reduce((s, e) => s + e.amount, 0);

          const monthExp = expenses.filter((e) => {
            const d = parseISO(e.date);
            return !isBefore(d, monthStart) && isBefore(d, monthEnd);
          }).reduce((s, e) => s + e.amount, 0);

          const entradas = monthEntries + monthManual;
          months.push({
            month: format(monthStart, "yyyy-MM"),
            label,
            entradas,
            saidas: monthExp,
            saldo: entradas - monthExp,
          });
        }
        setMonthlyData(months);
      } catch {} finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const tooltipFormatter = (value: number) => fmt(value);

  if (loading) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral do Espaço Lamoniê</p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/contracts")} className="gap-1.5 h-8 text-xs">
            <Plus size={13} /> Novo contrato
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/financial")} className="gap-1.5 h-8 text-xs">
            <DollarSign size={13} /> Registrar pagamento
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/agenda")} className="gap-1.5 h-8 text-xs">
            <CalendarDays size={13} /> Abrir agenda
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(alerts.unsignedCount > 0 || alerts.urgentPayments > 0) && (
        <div className="flex flex-wrap gap-3">
          {alerts.unsignedCount > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/8 px-4 py-2.5 text-sm">
              <AlertTriangle size={15} className="text-warning shrink-0" />
              <span className="text-warning font-medium">{alerts.unsignedCount} contrato{alerts.unsignedCount > 1 ? "s" : ""} sem assinatura</span>
            </div>
          )}
          {alerts.urgentPayments > 0 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-danger/30 bg-danger/8 px-4 py-2.5 text-sm">
              <AlertTriangle size={15} className="text-danger shrink-0" />
              <span className="text-danger font-medium">{alerts.urgentPayments} pagamento{alerts.urgentPayments > 1 ? "s" : ""} pendente{alerts.urgentPayments > 1 ? "s" : ""} nos próximos 7 dias</span>
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de contratos</p>
            <FileText size={16} className="text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{contracts.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Contratos ativos</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Confirmados</p>
            <CheckCircle size={16} className="text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{confirmed}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Eventos confirmados</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Aguardando pagamento</p>
            <Clock size={16} className="text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{awaiting}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Contratos com valores pendentes</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Eventos futuros</p>
            <CalendarDays size={16} className="text-muted-foreground/50" />
          </div>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{futureCount}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Próximos eventos agendados</p>
        </div>
      </div>

      {/* Financial summary – highlighted */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card !border-success/25 !bg-success/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-success/15 p-1.5">
              <TrendingUp size={14} className="text-success" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Entradas</p>
          </div>
          <p className="text-2xl font-semibold text-success tracking-tight">{fmt(financialSummary.totalIn)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Valores recebidos</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-danger" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saídas</p>
          </div>
          <p className="text-xl font-semibold text-danger tracking-tight">{fmt(financialSummary.totalOut)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Despesas registradas</p>
        </div>
        <div className="stat-card !border-primary/30 !bg-primary/5 ring-1 ring-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-full bg-primary/15 p-1.5">
              <Wallet size={14} className="text-primary" />
            </div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Saldo atual</p>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${financialSummary.balance >= 0 ? "text-primary" : "text-danger"}`}>
            {fmt(financialSummary.balance)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Saldo disponível do espaço</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold mb-4">Entradas vs Saídas</h2>
          <div className="h-[260px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados para exibir</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card p-5">
          <h2 className="font-display text-lg font-semibold mb-4">Evolução do Saldo</h2>
          <div className="h-[260px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="url(#saldoGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados para exibir</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming events */}
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Próximos eventos</h2>
            <CalendarDays size={15} className="text-muted-foreground/40" />
          </div>
          <div className="border-t border-border/40">
            {upcoming.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum evento futuro cadastrado</p>
            ) : (
              <div className="divide-y divide-border/40">
                {upcoming.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/8">
                      <CalendarDays size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.clientName}</p>
                      <p className="text-xs text-muted-foreground">{ev.eventType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums">{new Date(ev.eventDate).toLocaleDateString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">{ev.eventTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending payments */}
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Pagamentos pendentes</h2>
            <Clock size={15} className="text-muted-foreground/40" />
          </div>
          <div className="border-t border-border/40">
            {pendingPayments.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Todos os pagamentos estão em dia</p>
            ) : (
              <div className="divide-y divide-border/40">
                {pendingPayments.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.clientName}</p>
                      <p className="text-xs text-muted-foreground">{c.eventType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums">{fmt(c.remainingValue)}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${PAYMENT_STATUS_COLORS[c.paymentStatus]}`}>
                        {PAYMENT_STATUS_LABELS[c.paymentStatus]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

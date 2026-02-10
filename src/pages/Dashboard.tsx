import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { getContracts, getClients, getPayments, getTotalEntries, getTotalExpenses, getBalance } from "@/data/store";
import type { Contract } from "@/types";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  highlight?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Dashboard() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [upcoming, setUpcoming] = useState<(Contract & { clientName: string })[]>([]);
  const [pendingPayments, setPendingPayments] = useState<(Contract & { clientName: string })[]>([]);
  const [financialSummary, setFinancialSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0 });

  useEffect(() => {
    const contracts = getContracts();
    const clients = getClients();
    const confirmed = contracts.filter((c) => c.status === "confirmed").length;
    const awaiting = contracts.filter(
      (c) => c.paymentStatus === "pending" || c.paymentStatus === "deposit_paid"
    ).length;
    const future = contracts.filter(
      (c) => new Date(c.eventDate) >= new Date() && c.status !== "cancelled"
    );
    const totalIn = getTotalEntries();
    const totalOut = getTotalExpenses();
    const balance = getBalance();

    setFinancialSummary({ totalIn, totalOut, balance });

    setStats([
      { label: "Contratos", value: contracts.length, icon: FileText },
      { label: "Confirmados", value: confirmed, icon: CheckCircle },
      { label: "Aguardando Pgto", value: awaiting, icon: Clock },
      { label: "Próximos Eventos", value: future.length, icon: CalendarDays },
    ]);

    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

    setUpcoming(
      future
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
        .slice(0, 5)
        .map((c) => ({ ...c, clientName: clientMap[c.clientId] || "—" }))
    );

    setPendingPayments(
      contracts
        .filter((c) => c.paymentStatus !== "paid_full" && c.status !== "cancelled")
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
        .slice(0, 5)
        .map((c) => ({ ...c, clientName: clientMap[c.clientId] || "—" }))
    );
  }, []);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do Espaço Lamoniê</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{s.label}</p>
              <s.icon size={16} className="text-muted-foreground/50" />
            </div>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-success" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Entradas</p>
          </div>
          <p className="text-xl font-semibold text-success tracking-tight">{fmt(financialSummary.totalIn)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-danger" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saídas</p>
          </div>
          <p className="text-xl font-semibold text-danger tracking-tight">{fmt(financialSummary.totalOut)}</p>
        </div>
        <div className="stat-card !border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-primary" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo</p>
          </div>
          <p className={`text-xl font-semibold tracking-tight ${financialSummary.balance >= 0 ? "text-primary" : "text-danger"}`}>
            {fmt(financialSummary.balance)}
          </p>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming events */}
        <div className="rounded-lg border border-border/60 bg-card">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Próximos Eventos</h2>
            <CalendarDays size={15} className="text-muted-foreground/40" />
          </div>
          <div className="border-t border-border/40">
            {upcoming.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhum evento futuro
              </p>
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
                      <p className="text-sm font-medium tabular-nums">
                        {new Date(ev.eventDate).toLocaleDateString("pt-BR")}
                      </p>
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
            <h2 className="font-display text-lg font-semibold">Pagamentos Pendentes</h2>
            <Clock size={15} className="text-muted-foreground/40" />
          </div>
          <div className="border-t border-border/40">
            {pendingPayments.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Todos os pagamentos em dia
              </p>
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

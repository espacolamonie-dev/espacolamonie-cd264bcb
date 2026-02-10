import { useEffect, useState } from "react";
import {
  FileText,
  Users,
  CheckCircle,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { getContracts, getClients, getPayments, getTotalEntries, getTotalExpenses, getBalance } from "@/data/store";
import type { Contract } from "@/types";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  variant: "primary" | "success" | "warning" | "accent" | "muted";
}

const variantClasses: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  accent: "bg-accent/10 text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
};

const iconBg: Record<string, string> = {
  primary: "bg-primary/15",
  success: "bg-success/15",
  warning: "bg-warning/15",
  accent: "bg-accent/15",
  muted: "bg-muted",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Dashboard() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [upcoming, setUpcoming] = useState<(Contract & { clientName: string })[]>([]);

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

    setStats([
      { label: "Total de Contratos", value: contracts.length, icon: FileText, variant: "primary" },
      { label: "Confirmados", value: confirmed, icon: CheckCircle, variant: "success" },
      { label: "Aguardando Pagamento", value: awaiting, icon: Clock, variant: "warning" },
      { label: "Eventos Futuros", value: future.length, icon: CalendarDays, variant: "accent" },
      { label: "Recebido no Mês", value: fmt(totalIn), icon: TrendingUp, variant: "success" },
      { label: "Gasto no Mês", value: fmt(totalOut), icon: TrendingDown, variant: "warning" },
      { label: "Saldo Atual", value: fmt(balance), icon: Wallet, variant: balance >= 0 ? "primary" : "warning" },
    ]);

    setUpcoming(
      future
        .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
        .slice(0, 5)
        .map((c) => ({
          ...c,
          clientName: clients.find((cl) => cl.id === c.clientId)?.name || "—",
        }))
    );
  }, []);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do Espaço Lamoniê</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${iconBg[s.variant]}`}>
                <s.icon size={20} className={variantClasses[s.variant].split(" ").pop()} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold truncate">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming events */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h2 className="font-display font-semibold">Próximos Eventos</h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhum evento futuro cadastrado
          </p>
        ) : (
          <div className="divide-y">
            {upcoming.map((ev) => (
              <div key={ev.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ev.clientName}</p>
                  <p className="text-xs text-muted-foreground">{ev.eventType}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
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
  );
}

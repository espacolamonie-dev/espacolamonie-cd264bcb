import { useEffect, useState, useMemo } from "react";
import { parseLocalDate, formatDateBR } from "@/lib/dateUtils";
import {
  FileText, CheckCircle, Clock, CalendarDays, TrendingUp, TrendingDown, Wallet,
  Plus, DollarSign, AlertTriangle, ArrowRight, Receipt, Users, MessageCircle, Save, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getContracts, getClients, getTotalEntries, getTotalExpenses, getBalance, getActivePayments, getManualEntries, getExpenses } from "@/data/store";
import { getVisits } from "@/data/visitStore";
import type { Contract } from "@/types";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import { format, parseISO, startOfMonth, subMonths, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [ticketMedio, setTicketMedio] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [alerts, setAlerts] = useState<{ unsignedCount: number; urgentPayments: number }>({ unsignedCount: 0, urgentPayments: 0 });

  const [visitToContractRate, setVisitToContractRate] = useState<number | null>(null);
  const [visitToContractDetail, setVisitToContractDetail] = useState({ visits: 0, converted: 0 });
  const [whatsappToVisitRate, setWhatsappToVisitRate] = useState<number | null>(null);
  const [whatsappToVisitDetail, setWhatsappToVisitDetail] = useState({ whatsapp: 0, visits: 0 });

  const [waDate, setWaDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [waCount, setWaCount] = useState("");
  const [waSaving, setWaSaving] = useState(false);
  const [funcDateFrom, setFuncDateFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [funcDateTo, setFuncDateTo] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  });
  const [empTotalDue, setEmpTotalDue] = useState(0);
  const [empTotalPaid, setEmpTotalPaid] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allContracts, clients, totalIn, totalOut, balance, activePayments, manualEntries, expenses, visits] = await Promise.all([
          getContracts(), getClients(), getTotalEntries(), getTotalExpenses(), getBalance(),
          getActivePayments(), getManualEntries(), getExpenses(), getVisits(),
        ]);

        const active = allContracts.filter((c) => c.status !== "cancelled");
        const conf = active.filter((c) => c.status === "confirmed").length;
        const awaitPay = active.filter(
          (c) => c.paymentStatus === "pending" || c.paymentStatus === "deposit_paid"
        ).length;
        const future = active.filter(
          (c) => parseLocalDate(c.eventDate) >= new Date()
        );

        const unsignedCount = active.filter(
          (c) => c.status === "awaiting_signature" || c.status === "awaiting_documents"
        ).length;
        const sevenDaysFromNow = addDays(new Date(), 7);
        const urgentPayments = active.filter(
          (c) => c.paymentStatus !== "paid_full" && parseLocalDate(c.eventDate) <= sevenDaysFromNow && parseLocalDate(c.eventDate) >= new Date()
        ).length;
        setAlerts({ unsignedCount, urgentPayments });

        setContracts(active);
        setConfirmed(conf);
        setAwaiting(awaitPay);
        setFutureCount(future.length);
        setFinancialSummary({ totalIn, totalOut, balance });
        setTicketMedio(active.length > 0 ? active.reduce((s, c) => s + c.totalValue, 0) / active.length : 0);

        const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

        setUpcoming(
          future
            .sort((a, b) => parseLocalDate(a.eventDate).getTime() - parseLocalDate(b.eventDate).getTime())
            .slice(0, 5)
            .map((c) => ({ ...c, clientName: clientMap[c.clientId] || "—" }))
        );

        setPendingPayments(
          active
            .filter((c) => c.paymentStatus !== "paid_full")
            .sort((a, b) => parseLocalDate(a.eventDate).getTime() - parseLocalDate(b.eventDate).getTime())
            .slice(0, 5)
            .map((c) => ({ ...c, clientName: clientMap[c.clientId] || "—" }))
        );

        // Conversão via visit_id (mais confiável)
        const allVisits = visits.filter((v) => v.status === "Confirmada" || v.status === "Convertida em contrato");
        const activeVisitIds = new Set(
          active.filter((c) => c.visitId).map((c) => c.visitId)
        );
        const convertedVisits = allVisits.filter((v) =>
          activeVisitIds.has(v.id) || v.status === "Convertida em contrato"
        ).length;

        if (allVisits.length > 0) {
          setVisitToContractRate(Math.round((convertedVisits / allVisits.length) * 100));
          setVisitToContractDetail({ visits: allVisits.length, converted: convertedVisits });
        }

        await loadWhatsAppConversion(waDate, visits);

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

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const onFocus = () => forceUpdate(n => n + 1);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const loadWhatsAppConversion = async (date: string, visitsData?: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await (supabase.from("daily_whatsapp_contacts" as any) as any)
        .select("contact_count")
        .eq("user_id", user.id)
        .eq("contact_date", date)
        .maybeSingle();

      const contactCount = data?.contact_count || 0;

      let dayVisits: any[];
      if (visitsData) {
        dayVisits = visitsData;
      } else {
        dayVisits = await getVisits();
      }
      const visitsOnDate = dayVisits.filter((v) => {
        const created = new Date(v.createdAt);
        const createdStr = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
        return createdStr === date;
      }).length;

      if (contactCount > 0) {
        setWhatsappToVisitRate(Math.round((visitsOnDate / contactCount) * 100));
      } else {
        setWhatsappToVisitRate(null);
      }
      setWhatsappToVisitDetail({ whatsapp: contactCount, visits: visitsOnDate });

      if (contactCount > 0) {
        setWaCount(String(contactCount));
      } else {
        setWaCount("");
      }
    } catch {}
  };

  const handleSaveWhatsAppCount = async () => {
    if (!waDate || !waCount) { toast.error("Preencha a data e a quantidade"); return; }
    setWaSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: existing } = await (supabase.from("daily_whatsapp_contacts" as any) as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("contact_date", waDate)
        .maybeSingle();

      if (existing) {
        await (supabase.from("daily_whatsapp_contacts" as any) as any)
          .update({ contact_count: parseInt(waCount) })
          .eq("id", existing.id);
      } else {
        await (supabase.from("daily_whatsapp_contacts" as any) as any)
          .insert({ user_id: user.id, contact_date: waDate, contact_count: parseInt(waCount) });
      }

      toast.success("Contatos WhatsApp salvos!");
      await loadWhatsAppConversion(waDate);
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setWaSaving(false);
    }
  };

  const handleWaDateChange = async (newDate: string) => {
    setWaDate(newDate);
    await loadWhatsAppConversion(newDate);
  };

  const tooltipFormatter = (value: number) => fmt(value);



  if (loading) {
    return (
      <div className="animate-fade-in space-y-8">
        <div>
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 mt-2 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Contratos", value: contracts.length, sub: "Ativos no total", icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary", onClick: () => navigate("/contracts") },
    { label: "Confirmados", value: confirmed, sub: "Eventos confirmados", icon: CheckCircle, iconBg: "bg-success/10", iconColor: "text-success", onClick: () => navigate("/contracts") },
    { label: "Aguardando", value: awaiting, sub: "Pagamento pendente", icon: Clock, iconBg: "bg-warning/10", iconColor: "text-warning", onClick: () => navigate("/financial") },
    { label: "Próximos", value: futureCount, sub: "Eventos futuros", icon: CalendarDays, iconBg: "bg-primary/10", iconColor: "text-primary", onClick: () => navigate("/agenda") },
  ];

  const funcStart = new Date(funcDateFrom + "T00:00:00");
  const funcEnd = new Date(funcDateTo + "T23:59:59");
  const contratosFechadosDash = contracts.filter(c => {
    const d = new Date(c.createdAt);
    return d >= funcStart && d <= funcEnd;
  });

  const [empTotalDue, setEmpTotalDue] = useState(0);
  const [empTotalPaid, setEmpTotalPaid] = useState(0);

  useEffect(() => {
    const loadEmpData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: empData } = await (supabase.from("employees" as any) as any)
        .select("*").eq("user_id", user.id).eq("is_active", true);
      const { data: payData } = await (supabase.from("employee_payments" as any) as any)
        .select("*").eq("user_id", user.id);

      const employees = empData || [];
      const empPayments = payData || [];

      let totalDue = 0;
      let totalPaid = 0;
      for (const emp of employees) {
        if (emp.payment_type === "por_contrato") {
          totalDue += contratosFechadosDash.length * Number(emp.payment_value);
        } else if (emp.payment_type === "fixo_mensal") {
          totalDue += Number(emp.payment_value);
        }
        totalPaid += empPayments
          .filter((p: any) => p.employee_id === emp.id && new Date(p.date) >= funcStart && new Date(p.date) <= funcEnd)
          .reduce((s: number, p: any) => s + Number(p.amount), 0);
      }
      setEmpTotalDue(totalDue);
      setEmpTotalPaid(totalPaid);
    };
    loadEmpData();
  }, [funcDateFrom, funcDateTo, contracts]);

  const funcFaltaDash = Math.max(0, empTotalDue - empTotalPaid);

  const now2 = new Date();
  const currentMonthKeyFin = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;

  const finCards = [
    { label: "Receita", value: fmt(financialSummary.totalIn), icon: TrendingUp, iconBg: "bg-success/10", iconColor: "text-success", valueColor: "text-success" },
    { label: "Despesas", value: fmt(financialSummary.totalOut), icon: TrendingDown, iconBg: "bg-danger/10", iconColor: "text-danger", valueColor: "text-danger" },
    { label: "Lucro líquido", value: fmt(financialSummary.balance - empTotalPaid), icon: Wallet, iconBg: "bg-primary/10", iconColor: "text-primary", valueColor: (financialSummary.balance - empTotalPaid) >= 0 ? "text-primary" : "text-danger" },
    { label: "Ticket médio", value: fmt(ticketMedio), icon: Receipt, iconBg: "bg-gold/10", iconColor: "text-gold-dark", valueColor: "text-foreground" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: "var(--font-body)" }}>
            Visão geral do seu espaço
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate("/contracts")} className="gap-1.5 h-9 rounded-xl text-xs">
            <Plus size={14} /> Novo contrato
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/financial")} className="gap-1.5 h-9 rounded-xl text-xs">
            <DollarSign size={14} /> Pagamento
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/agenda")} className="gap-1.5 h-9 rounded-xl text-xs">
            <CalendarDays size={14} /> Agenda
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(alerts.unsignedCount > 0 || alerts.urgentPayments > 0) && (
        <div className="flex flex-wrap gap-2.5">
          {alerts.unsignedCount > 0 && (
            <button
              onClick={() => navigate("/contracts")}
              className="flex items-center gap-2.5 rounded-xl border border-warning/20 bg-warning/5 px-4 py-2.5 text-xs hover:bg-warning/10 transition-all duration-200 group"
            >
              <AlertTriangle size={14} className="text-warning" />
              <span className="text-warning font-medium">{alerts.unsignedCount} aguardando assinatura</span>
              <ArrowRight size={12} className="text-warning/40 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
          {alerts.urgentPayments > 0 && (
            <button
              onClick={() => navigate("/contracts?payment=pending_urgent")}
              className="flex items-center gap-2.5 rounded-xl border border-danger/20 bg-danger/5 px-4 py-2.5 text-xs hover:bg-danger/10 transition-all duration-200 group"
            >
              <AlertTriangle size={14} className="text-danger" />
              <span className="text-danger font-medium">{alerts.urgentPayments} pagamento{alerts.urgentPayments > 1 ? "s" : ""} urgente{alerts.urgentPayments > 1 ? "s" : ""}</span>
              <ArrowRight size={12} className="text-danger/40 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-fade-in">
        {statCards.map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            className="group rounded-2xl border border-border bg-card p-5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`rounded-xl ${card.iconBg} p-2`}>
                <card.icon size={16} className={card.iconColor} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-display font-bold tracking-tight">{card.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-body)" }}>{card.sub}</p>
          </button>
        ))}
      </div>

      {/* Financial cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 stagger-fade-in">
        {finCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className={`rounded-xl ${card.iconBg} p-2`}>
                <card.icon size={16} className={card.iconColor} />
              </div>
            </div>
            <p className={`text-lg md:text-xl font-display font-bold tracking-tight ${card.valueColor}`}>{card.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-body)" }}>{card.label}</p>
          </div>
        ))}
        {/* Employee card with date range selector */}
        <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <div className="rounded-xl bg-violet-500/10 p-2">
              <UserRound size={16} className="text-violet-500" />
            </div>
          </div>
          <p className="text-lg md:text-xl font-display font-bold tracking-tight text-violet-600 dark:text-violet-400">{fmt(empTotalDue)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "var(--font-body)" }}>Funcionários ({contratosFechadosDash.length} contratos)</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Pago: {fmt(empTotalPaid)} · Falta: {fmt(funcFaltaDash)}</p>
          <div className="flex items-center gap-1.5 mt-3">
            <input
              type="date"
              value={funcDateFrom}
              onChange={(e) => setFuncDateFrom(e.target.value)}
              className="text-[10px] bg-transparent border border-border rounded-md px-1.5 py-1 text-muted-foreground w-[105px]"
            />
            <span className="text-[10px] text-muted-foreground">até</span>
            <input
              type="date"
              value={funcDateTo}
              onChange={(e) => setFuncDateTo(e.target.value)}
              className="text-[10px] bg-transparent border border-border rounded-md px-1.5 py-1 text-muted-foreground w-[105px]"
            />
          </div>
        </div>
      </div>

      {/* Conversion metrics */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Visit → Contract */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-primary/10 p-2">
              <Users size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">Visita → Contrato</h2>
              <p className="text-[11px] text-muted-foreground">Taxa de conversão</p>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-3xl font-display font-bold tracking-tight text-primary">
                {visitToContractRate !== null ? `${visitToContractRate}%` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {visitToContractDetail.converted} de {visitToContractDetail.visits} visitas
              </p>
            </div>
            {visitToContractRate !== null && (
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(visitToContractRate, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp → Visit */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-success/10 p-2">
              <MessageCircle size={16} className="text-success" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">WhatsApp → Visita</h2>
              <p className="text-[11px] text-muted-foreground">Contatos vs agendamentos</p>
            </div>
          </div>

          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-3xl font-display font-bold tracking-tight text-success">
                {whatsappToVisitRate !== null ? `${whatsappToVisitRate}%` : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {whatsappToVisitDetail.visits} de {whatsappToVisitDetail.whatsapp} contatos
              </p>
            </div>
            {whatsappToVisitRate !== null && (
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${Math.min(whatsappToVisitRate, 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">Registrar contatos</p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={waDate}
                onChange={(e) => handleWaDateChange(e.target.value)}
                className="w-36 h-8 text-xs"
              />
              <Input
                type="number"
                min="0"
                placeholder="Qtd"
                value={waCount}
                onChange={(e) => setWaCount(e.target.value)}
                className="w-24 h-8 text-xs"
              />
              <Button size="sm" onClick={handleSaveWhatsAppCount} disabled={waSaving} className="h-8 gap-1 text-xs px-3 rounded-xl">
                <Save size={12} />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold mb-0.5">Receita vs Despesas</h2>
          <p className="text-[11px] text-muted-foreground mb-5">Últimos 6 meses</p>
          <div className="h-[260px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--danger))" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold mb-0.5">Evolução Mensal</h2>
          <p className="text-[11px] text-muted-foreground mb-5">Saldo acumulado</p>
          <div className="h-[260px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "11px", boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="url(#saldoGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sem dados</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom lists */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Upcoming events */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold">Próximos eventos</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Agenda dos próximos dias</p>
            </div>
            <button onClick={() => navigate("/agenda")} className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5">
              Ver agenda <ArrowRight size={10} />
            </button>
          </div>
          <div className="border-t border-border">
            {upcoming.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-muted-foreground">Nenhum evento agendado</p>
            ) : (
              <div className="divide-y divide-border/50">
                {upcoming.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/agenda")}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8">
                      <CalendarDays size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.clientName}</p>
                      <p className="text-[11px] text-muted-foreground">{ev.eventType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium tabular-nums">{formatDateBR(ev.eventDate)}</p>
                      <p className="text-[11px] text-muted-foreground">{ev.eventTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending payments */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold">Pagamentos pendentes</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Aguardando confirmação</p>
            </div>
            <button onClick={() => navigate("/financial")} className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5">
              Financeiro <ArrowRight size={10} />
            </button>
          </div>
          <div className="border-t border-border">
            {pendingPayments.length === 0 ? (
              <p className="px-5 py-10 text-center text-xs text-muted-foreground">Pagamentos em dia</p>
            ) : (
              <div className="divide-y divide-border/50">
                {pendingPayments.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/financial")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.clientName}</p>
                      <p className="text-[11px] text-muted-foreground">{c.eventType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{fmt(c.remainingValue)}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium border ${PAYMENT_STATUS_COLORS[c.paymentStatus]}`}>
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

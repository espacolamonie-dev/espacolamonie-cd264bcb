import { useEffect, useState } from "react";
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

  // Conversion metrics
  const [visitToContractRate, setVisitToContractRate] = useState<number | null>(null);
  const [visitToContractDetail, setVisitToContractDetail] = useState({ visits: 0, converted: 0 });
  const [whatsappToVisitRate, setWhatsappToVisitRate] = useState<number | null>(null);
  const [whatsappToVisitDetail, setWhatsappToVisitDetail] = useState({ whatsapp: 0, visits: 0 });

  // Manual WhatsApp input
  const [waDate, setWaDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [waCount, setWaCount] = useState("");
  const [waSaving, setWaSaving] = useState(false);

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

        // --- Conversion: Visit → Contract ---
        const allVisits = visits.filter((v) => v.status === "Confirmada");
        const normalize = (s: string) => s.replace(/\D/g, "");
        const getFirstName = (name: string) => name.trim().split(/\s+/)[0].toLowerCase();
        const normalizeFullName = (name: string) => name.trim().toLowerCase();

        // Build contract lookup sets from clients
        const contractClients = active.map((c) => {
          const cl = clients.find((cl) => cl.id === c.clientId);
          return {
            phone: normalize(cl?.phone || ""),
            firstName: getFirstName(cl?.name || ""),
            fullName: normalizeFullName(cl?.name || ""),
            eventDate: c.eventDate,
          };
        });

        const contractPhones = new Set(contractClients.map((c) => c.phone).filter(Boolean));
        const contractFullNames = new Set(contractClients.map((c) => c.fullName).filter(Boolean));
        const contractEventDates = new Set(contractClients.map((c) => c.eventDate).filter(Boolean));

        const convertedVisits = allVisits.filter((v) => {
          const vPhone = normalize(v.clientPhone || "");
          const vFirstName = getFirstName(v.clientName || "");
          const vFullName = normalizeFullName(v.clientName || "");
          const vInterestDate = v.interestEventDate || "";

          // Match by phone number
          const phoneMatch = vPhone && contractPhones.has(vPhone);
          // Match by full name
          const fullNameMatch = vFullName && contractFullNames.has(vFullName);
          // Match by first name + interest date matching contract event date
          const firstNameDateMatch = vFirstName && vInterestDate &&
            contractClients.some((cc) => cc.firstName === vFirstName && cc.eventDate === vInterestDate);

          return phoneMatch || fullNameMatch || firstNameDateMatch;
        }).length;

        if (allVisits.length > 0) {
          setVisitToContractRate(Math.round((convertedVisits / allVisits.length) * 100));
          setVisitToContractDetail({ visits: allVisits.length, converted: convertedVisits });
        }

        // --- Conversion: WhatsApp → Visit (today by default) ---
        await loadWhatsAppConversion(waDate, visits);

        // Monthly chart data
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

      // Count visits scheduled for this date
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
          <Skeleton className="h-10 w-56 rounded-xl" />
          <Skeleton className="h-4 w-72 mt-3 rounded-lg" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total de contratos", value: contracts.length, sub: "Contratos ativos", icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary", onClick: () => navigate("/contracts") },
    { label: "Confirmados", value: confirmed, sub: "Eventos confirmados", icon: CheckCircle, iconBg: "bg-success/10", iconColor: "text-success", onClick: () => navigate("/contracts") },
    { label: "Aguardando pagamento", value: awaiting, sub: "Pendentes", icon: Clock, iconBg: "bg-warning/10", iconColor: "text-warning", onClick: () => navigate("/financial") },
    { label: "Eventos futuros", value: futureCount, sub: "Próximos agendados", icon: CalendarDays, iconBg: "bg-primary/10", iconColor: "text-primary", onClick: () => navigate("/agenda") },
  ];

  // Funcionário calculation
  const VALOR_POR_CONTRATO_FUNCIONARIO = 70;
  const now2 = new Date();
  const currentMonthKey = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;
  const msStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
  const msEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 0, 23, 59, 59);
  const contratosFechadosDash = contracts.filter(c => {
    const d = new Date(c.createdAt);
    return d >= msStart && d <= msEnd;
  });
  const pagamentoFuncTotal = contratosFechadosDash.length * VALOR_POR_CONTRATO_FUNCIONARIO;
  const funcPagoDash = Number(localStorage.getItem(`func_pago_${currentMonthKey}`) || "0");
  const funcFaltaDash = Math.max(0, pagamentoFuncTotal - funcPagoDash);

  const finCards = [
    { label: "Receita do mês", value: fmt(financialSummary.totalIn), icon: TrendingUp, iconBg: "bg-success/10", iconColor: "text-success", valueColor: "text-success" },
    { label: "Despesas", value: fmt(financialSummary.totalOut), icon: TrendingDown, iconBg: "bg-danger/10", iconColor: "text-danger", valueColor: "text-danger" },
    { label: "Lucro líquido", value: fmt(financialSummary.balance), icon: Wallet, iconBg: "bg-primary/10", iconColor: "text-primary", valueColor: financialSummary.balance >= 0 ? "text-primary" : "text-danger" },
    { label: "Ticket médio", value: fmt(ticketMedio), icon: Receipt, iconBg: "bg-gold/10", iconColor: "text-gold-dark", valueColor: "text-foreground" },
    { label: "Funcionário", value: fmt(pagamentoFuncTotal), icon: UserRound, iconBg: "bg-violet-500/10", iconColor: "text-violet-500", valueColor: "text-violet-600 dark:text-violet-400", sub: `Pago: ${fmt(funcPagoDash)} · Falta: ${fmt(funcFaltaDash)}` },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1.5">Bem-vindo ao painel do Espaço Lamoniê</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => navigate("/contracts")} className="gap-2">
            <Plus size={16} /> Novo contrato
          </Button>
          <Button variant="outline" onClick={() => navigate("/financial")} className="gap-2">
            <DollarSign size={16} /> Registrar pagamento
          </Button>
          <Button variant="outline" onClick={() => navigate("/agenda")} className="gap-2">
            <CalendarDays size={16} /> Abrir agenda
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(alerts.unsignedCount > 0 || alerts.urgentPayments > 0) && (
        <div className="flex flex-wrap gap-3">
          {alerts.unsignedCount > 0 && (
            <button
              onClick={() => navigate("/contracts")}
              className="flex items-center gap-3 rounded-2xl border border-warning/25 bg-warning/8 px-5 py-3.5 text-sm hover:bg-warning/12 transition-all duration-200 group"
            >
              <div className="rounded-xl bg-warning/15 p-2">
                <AlertTriangle size={16} className="text-warning" />
              </div>
              <span className="text-warning font-medium">{alerts.unsignedCount} contrato{alerts.unsignedCount > 1 ? "s" : ""} aguardando assinatura</span>
              <ArrowRight size={14} className="text-warning/50 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
          {alerts.urgentPayments > 0 && (
            <button
              onClick={() => navigate("/contracts?payment=pending_urgent")}
              className="flex items-center gap-3 rounded-2xl border border-danger/25 bg-danger/8 px-5 py-3.5 text-sm hover:bg-danger/12 transition-all duration-200 group"
            >
              <div className="rounded-xl bg-danger/15 p-2">
                <AlertTriangle size={16} className="text-danger" />
              </div>
              <span className="text-danger font-medium">{alerts.urgentPayments} pagamento{alerts.urgentPayments > 1 ? "s" : ""} pendente{alerts.urgentPayments > 1 ? "s" : ""} nos próximos 7 dias</span>
              <ArrowRight size={14} className="text-danger/50 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      )}

      {/* Stat cards - Row 1 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-fade-in">
        {statCards.map((card) => (
          <button key={card.label} onClick={card.onClick} className="stat-card text-left group">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
              <div className={`rounded-xl ${card.iconBg} p-2.5`}>
                <card.icon size={20} className={card.iconColor} />
              </div>
            </div>
            <p className="text-3xl font-display font-bold mt-3 tracking-tight">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </button>
        ))}
      </div>

      {/* Financial cards - Row 2 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-fade-in">
        {finCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{card.label}</p>
              <div className={`rounded-xl ${card.iconBg} p-2.5`}>
                <card.icon size={20} className={card.iconColor} />
              </div>
            </div>
            <p className={`text-2xl font-display font-bold mt-3 tracking-tight ${card.valueColor}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion metrics - Row 3 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visit → Contract */}
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Visita → Contrato</h2>
              <p className="text-xs text-muted-foreground">Taxa de conversão por primeiro nome</p>
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-4xl font-display font-bold tracking-tight text-primary">
                {visitToContractRate !== null ? `${visitToContractRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {visitToContractDetail.converted} de {visitToContractDetail.visits} visitas geraram contrato
              </p>
            </div>
            {visitToContractRate !== null && (
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(visitToContractRate, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* WhatsApp → Visit */}
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-success/10 p-2.5">
              <MessageCircle size={20} className="text-success" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">WhatsApp → Visita</h2>
              <p className="text-xs text-muted-foreground">Contatos do dia vs agendamentos</p>
            </div>
          </div>

          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-4xl font-display font-bold tracking-tight text-success">
                {whatsappToVisitRate !== null ? `${whatsappToVisitRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {whatsappToVisitDetail.visits} agendamento{whatsappToVisitDetail.visits !== 1 ? "s" : ""} de {whatsappToVisitDetail.whatsapp} contato{whatsappToVisitDetail.whatsapp !== 1 ? "s" : ""}
              </p>
            </div>
            {whatsappToVisitRate !== null && (
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${Math.min(whatsappToVisitRate, 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground font-medium mb-2.5 uppercase tracking-wider">Registrar contatos do dia</p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={waDate}
                onChange={(e) => handleWaDateChange(e.target.value)}
                className="w-40 h-9 text-sm"
              />
              <Input
                type="number"
                min="0"
                placeholder="Qtd contatos"
                value={waCount}
                onChange={(e) => setWaCount(e.target.value)}
                className="w-32 h-9 text-sm"
              />
              <Button size="sm" onClick={handleSaveWhatsAppCount} disabled={waSaving} className="h-9 gap-1.5">
                <Save size={14} />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Charts - Row 4 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Receita vs Despesas</h2>
          <p className="text-xs text-muted-foreground mb-6">Últimos 6 meses</p>
          <div className="h-[280px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "16px", fontSize: "12px", boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }} />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} barSize={24} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--danger))" radius={[8, 8, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados para exibir</div>
            )}
          </div>
        </div>

        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Evolução Mensal</h2>
          <p className="text-xs text-muted-foreground mb-6">Saldo acumulado</p>
          <div className="h-[280px]">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "16px", fontSize: "12px", boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="url(#saldoGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados para exibir</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom grid - Row 5 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming events */}
        <div className="card-premium">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <h2 className="font-display text-lg font-semibold">Próximos eventos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Agenda dos próximos dias</p>
            </div>
            <button onClick={() => navigate("/agenda")} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 rounded-xl px-3.5 py-2">
              Ver agenda <ArrowRight size={12} />
            </button>
          </div>
          <div className="border-t border-border">
            {upcoming.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-muted-foreground">Nenhum evento agendado no momento</p>
            ) : (
              <div className="divide-y divide-border/50">
                {upcoming.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/agenda")}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8">
                      <CalendarDays size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.clientName}</p>
                      <p className="text-xs text-muted-foreground">{ev.eventType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium tabular-nums">{formatDateBR(ev.eventDate)}</p>
                      <p className="text-xs text-muted-foreground">{ev.eventTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending payments */}
        <div className="card-premium">
          <div className="flex items-center justify-between px-6 py-5">
            <div>
              <h2 className="font-display text-lg font-semibold">Pagamentos pendentes</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Valores aguardando confirmação</p>
            </div>
            <button onClick={() => navigate("/financial")} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 rounded-xl px-3.5 py-2">
              Ver financeiro <ArrowRight size={12} />
            </button>
          </div>
          <div className="border-t border-border">
            {pendingPayments.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-muted-foreground">Todos os pagamentos estão em dia</p>
            ) : (
              <div className="divide-y divide-border/50">
                {pendingPayments.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate("/financial")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.clientName}</p>
                      <p className="text-xs text-muted-foreground">{c.eventType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{fmt(c.remainingValue)}</p>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${PAYMENT_STATUS_COLORS[c.paymentStatus]}`}>
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

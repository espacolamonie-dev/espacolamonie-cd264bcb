import { useEffect, useState, useMemo } from "react";
import { BarChart3, Users, FileText, DollarSign, TrendingUp, ArrowDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface VisitRow { id: string; client_name: string; client_phone: string; lead_source: string; visit_date: string; status: string; client_id: string | null; created_at: string; }
interface ContractRow { id: string; client_id: string; source: string; status: string; total_value: number; deposit_value: number; payment_status: string; event_date: string; created_at: string; }
interface ClientRow { id: string; name: string; utm_source: string; }

function normalizeOrigin(src: string): "Orgânico" | "Tráfego Pago" {
  if (!src) return "Orgânico";
  const l = src.toLowerCase().trim();
  if (["tráfego pago", "trafego pago", "facebook", "instagram ads", "facebook ads", "google ads", "paid", "cpc", "meta"].some(k => l.includes(k))) return "Tráfego Pago";
  return "Orgânico";
}

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function getDateRange(period: string, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  if (period === "custom" && customFrom && customTo) return { from: customFrom, to: customTo };
  if (period === "today") { const t = toStr(now); return { from: t, to: t }; }
  if (period === "7d") { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: toStr(d), to: toStr(now) }; }
  if (period === "90d") { const d = new Date(now); d.setDate(d.getDate() - 90); return { from: toStr(d), to: toStr(now) }; }
  // 30d default
  const d = new Date(now); d.setDate(d.getDate() - 30); return { from: toStr(d), to: toStr(now) };
}

export default function Marketing() {
  const isMobile = useIsMobile();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [period, setPeriod] = useState("30d");
  const [originFilter, setOriginFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [adSpend, setAdSpend] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [v, c, cl] = await Promise.all([
        supabase.from("visits").select("id, client_name, client_phone, lead_source, visit_date, status, client_id, created_at").order("visit_date"),
        supabase.from("contracts").select("id, client_id, source, status, total_value, deposit_value, payment_status, event_date, created_at"),
        supabase.from("clients").select("id, name, utm_source"),
      ]);
      setVisits((v.data as any[]) || []);
      setContracts((c.data as any[]) || []);
      setClients((cl.data as any[]) || []);
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const { from, to } = useMemo(() => getDateRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const filteredVisits = useMemo(() => {
    let list = visits.filter(v => v.visit_date >= from && v.visit_date <= to && v.status !== "Cancelada");
    if (originFilter !== "all") list = list.filter(v => normalizeOrigin(v.lead_source) === originFilter);
    return list;
  }, [visits, from, to, originFilter]);

  const filteredContracts = useMemo(() => {
    let list = contracts.filter(c => {
      const d = (c.created_at || c.event_date || "").slice(0, 10);
      return d >= from && d <= to && c.status !== "cancelled";
    });
    if (originFilter !== "all") list = list.filter(c => normalizeOrigin(c.source) === originFilter);
    return list;
  }, [contracts, from, to, originFilter]);

  const paidContracts = useMemo(() => filteredContracts.filter(c => c.payment_status === "deposit_paid" || c.payment_status === "paid_full"), [filteredContracts]);

  // KPIs
  const totalLeads = filteredVisits.length;
  const totalContracts = filteredContracts.length;
  const totalRevenue = paidContracts.reduce((s, c) => s + Number(c.deposit_value), 0);
  const conversionRate = totalLeads > 0 ? Math.round((totalContracts / totalLeads) * 100) : 0;

  // By origin
  const byOrigin = useMemo(() => {
    const map: Record<string, { leads: number; contracts: number; revenue: number; paid: number }> = {
      "Orgânico": { leads: 0, contracts: 0, revenue: 0, paid: 0 },
      "Tráfego Pago": { leads: 0, contracts: 0, revenue: 0, paid: 0 },
    };
    filteredVisits.forEach(v => { map[normalizeOrigin(v.lead_source)].leads++; });
    filteredContracts.forEach(c => { map[normalizeOrigin(c.source)].contracts++; });
    paidContracts.forEach(c => { map[normalizeOrigin(c.source)].revenue += Number(c.deposit_value); map[normalizeOrigin(c.source)].paid++; });
    return map;
  }, [filteredVisits, filteredContracts, paidContracts]);

  // Chart data: monthly
  const chartData = useMemo(() => {
    const months: Record<string, { month: string; Orgânico: number; "Tráfego Pago": number }> = {};
    paidContracts.forEach(c => {
      const m = (c.created_at || c.event_date || "").slice(0, 7);
      if (!months[m]) months[m] = { month: m, "Orgânico": 0, "Tráfego Pago": 0 };
      months[m][normalizeOrigin(c.source)] += Number(c.deposit_value);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      month: m.month.split("-").reverse().join("/"),
    }));
  }, [paidContracts]);

  // Funnel
  const funnel = useMemo(() => {
    const uniqueClients = new Set(filteredVisits.map(v => v.client_id).filter(Boolean));
    const clientsWithContract = new Set(filteredContracts.map(c => c.client_id));
    const paidClientsCount = paidContracts.length;
    return {
      visits: totalLeads,
      clients: uniqueClients.size,
      contracts: totalContracts,
      paid: paidClientsCount,
      visitToClient: totalLeads > 0 ? Math.round((uniqueClients.size / totalLeads) * 100) : 0,
      clientToContract: uniqueClients.size > 0 ? Math.round((totalContracts / uniqueClients.size) * 100) : 0,
      contractToPaid: totalContracts > 0 ? Math.round((paidClientsCount / totalContracts) * 100) : 0,
    };
  }, [filteredVisits, filteredContracts, paidContracts, totalLeads, totalContracts]);

  // Table data
  const tableData = useMemo(() => {
    const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
    return filteredVisits.map(v => {
      const contract = contracts.find(c => c.client_id === v.client_id && c.status !== "cancelled");
      const client = v.client_id ? clientMap[v.client_id] : null;
      return {
        name: v.client_name,
        origin: normalizeOrigin(v.lead_source),
        visitDate: v.visit_date,
        hasContract: !!contract,
        paid: contract ? (contract.payment_status === "deposit_paid" || contract.payment_status === "paid_full") : false,
        value: contract ? Number(contract.deposit_value) : 0,
      };
    });
  }, [filteredVisits, contracts, clients]);

  // ROI
  const paidRevenue = byOrigin["Tráfego Pago"].revenue;
  const roi = adSpend > 0 ? (((paidRevenue - adSpend) / adSpend) * 100).toFixed(0) : null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!isMobile && (
            <>
              <h1 className="text-3xl font-display font-semibold tracking-tight">Marketing & Origem</h1>
              <p className="text-sm text-muted-foreground mt-1">Análise de desempenho por canal de aquisição</p>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px] h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div className="grid gap-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">De</Label>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 w-[150px] rounded-lg text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Até</Label>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 w-[150px] rounded-lg text-sm" />
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Origem</Label>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[150px] h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Orgânico">Orgânico</SelectItem>
              <SelectItem value="Tráfego Pago">Tráfego Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Leads", value: totalLeads, icon: Users, color: "text-primary" },
          { label: "Contratos Fechados", value: totalContracts, icon: FileText, color: "text-success" },
          { label: "Faturamento (Sinal)", value: fmt(totalRevenue), icon: DollarSign, color: "text-warning" },
          { label: "Conversão", value: `${conversionRate}%`, icon: TrendingUp, color: "text-accent-foreground" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-8 w-8 rounded-lg bg-secondary flex items-center justify-center ${card.color}`}>
                <card.icon size={16} />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{card.label}</span>
            </div>
            <p className="text-2xl font-display font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Origin comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        {(["Orgânico", "Tráfego Pago"] as const).map((origin) => {
          const d = byOrigin[origin];
          const conv = d.leads > 0 ? Math.round((d.contracts / d.leads) * 100) : 0;
          const isOrganic = origin === "Orgânico";
          return (
            <div key={origin} className={`rounded-xl border-2 p-5 space-y-4 ${isOrganic ? "border-success/30 bg-success/5" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isOrganic ? "bg-success" : "bg-primary"}`} />
                <h3 className="font-display font-semibold text-lg">{origin}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-card border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Leads</p>
                  <p className="text-xl font-bold mt-1">{d.leads}</p>
                </div>
                <div className="rounded-lg bg-card border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Contratos</p>
                  <p className="text-xl font-bold mt-1">{d.contracts}</p>
                </div>
                <div className="rounded-lg bg-card border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Faturamento</p>
                  <p className="text-lg font-bold mt-1">{fmt(d.revenue)}</p>
                </div>
                <div className="rounded-lg bg-card border border-border p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Conversão</p>
                  <p className="text-xl font-bold mt-1">{conv}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold text-lg mb-4">Funil de Conversão</h3>
        <div className="flex flex-col items-center gap-1">
          {[
            { label: "Visitas", count: funnel.visits, rate: null, color: "bg-primary" },
            { label: "Clientes", count: funnel.clients, rate: funnel.visitToClient, color: "bg-accent" },
            { label: "Contratos", count: funnel.contracts, rate: funnel.clientToContract, color: "bg-success" },
            { label: "Pagamentos", count: funnel.paid, rate: funnel.contractToPaid, color: "bg-warning" },
          ].map((step, i) => {
            const maxWidth = 100 - i * 15;
            return (
              <div key={step.label} className="w-full flex flex-col items-center">
                {step.rate !== null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground my-1">
                    <ArrowDown size={12} /> {step.rate}%
                  </div>
                )}
                <div
                  className={`${step.color} rounded-lg py-3 text-center transition-all`}
                  style={{ width: `${Math.max(maxWidth, 30)}%` }}
                >
                  <span className="text-sm font-semibold text-white drop-shadow-sm">{step.label}: {step.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold text-lg mb-4">Faturamento por Origem</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 13 }} />
              <Legend />
              <Bar dataKey="Orgânico" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Tráfego Pago" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ROI Calculator */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display font-semibold text-lg mb-4">Cálculo de ROI — Tráfego Pago</h3>
        <div className="grid sm:grid-cols-3 gap-4 items-end">
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Investimento em Ads (R$)</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={adSpend || ""}
              onChange={e => setAdSpend(Number(e.target.value) || 0)}
              placeholder="Ex: 2000"
              className="rounded-lg h-10"
            />
          </div>
          <div className="rounded-lg bg-secondary/50 border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Retorno Tráfego Pago</p>
            <p className="text-lg font-bold mt-1">{fmt(paidRevenue)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">ROI</p>
            <p className={`text-xl font-bold mt-1 ${roi && Number(roi) > 0 ? "text-success" : roi && Number(roi) < 0 ? "text-destructive" : ""}`}>
              {roi !== null ? `${roi}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="p-4 border-b border-border">
          <h3 className="font-display font-semibold text-lg">Detalhamento por Lead</h3>
        </div>
        <table className="table-premium">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Origem</th>
              <th className="hidden sm:table-cell">Data da Visita</th>
              <th>Contrato?</th>
              <th>Pagou?</th>
              <th className="text-right hidden md:table-cell">Valor</th>
            </tr>
          </thead>
          <tbody>
            {tableData.length === 0 ? (
              <tr><td colSpan={6} className="!py-12 text-center text-muted-foreground">Nenhum lead encontrado no período</td></tr>
            ) : (
              tableData.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  <td className="font-medium text-sm">{row.name}</td>
                  <td>
                    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${row.origin === "Tráfego Pago" ? "bg-primary/15 text-primary" : "bg-success/15 text-success"}`}>
                      {row.origin}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell text-muted-foreground text-sm tabular-nums">{row.visitDate.split("-").reverse().join("/")}</td>
                  <td>
                    <Badge variant={row.hasContract ? "default" : "secondary"} className="text-[11px]">
                      {row.hasContract ? "Sim" : "Não"}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={row.paid ? "default" : "secondary"} className={`text-[11px] ${row.paid ? "bg-success text-success-foreground" : ""}`}>
                      {row.paid ? "Sim" : "Não"}
                    </Badge>
                  </td>
                  <td className="text-right hidden md:table-cell font-semibold tabular-nums text-sm">{row.value > 0 ? fmt(row.value) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

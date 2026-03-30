import { useMemo, useState } from "react";
import { Instagram, Facebook, Search, Globe, Users, Megaphone, Smartphone, DollarSign, TrendingUp, CalendarDays, FileText, Percent, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { Contract } from "@/types";
import type { Visit } from "@/data/visitStore";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ORIGIN_COLORS: Record<string, string> = {
  Instagram: "hsl(330 80% 55%)",
  Facebook: "hsl(214 89% 52%)",
  Google: "hsl(142 71% 45%)",
  "Tráfego Pago": "hsl(25 95% 53%)",
  "Tráfego pago": "hsl(25 95% 53%)",
  Indicação: "hsl(263 70% 58%)",
  Orgânico: "hsl(173 58% 39%)",
  Outro: "hsl(220 9% 46%)",
  "Não identificado": "hsl(220 9% 60%)",
};

const ORIGIN_ICONS: Record<string, React.ElementType> = {
  Instagram: Instagram,
  Facebook: Facebook,
  Google: Search,
  "Tráfego Pago": Megaphone,
  "Tráfego pago": Megaphone,
  Indicação: Users,
  Orgânico: Globe,
  Outro: Smartphone,
  "Não identificado": Globe,
};

function getOrigin(item: { leadSource?: string; source?: string; utmSource?: string }): string {
  return item.leadSource || item.source || item.utmSource || "Não identificado";
}

function normalizeOrigin(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === "instagram") return "Instagram";
  if (lower === "facebook") return "Facebook";
  if (lower === "google") return "Google";
  if (lower === "tráfego pago" || lower === "trafego pago") return "Tráfego Pago";
  if (lower === "indicação" || lower === "indicacao") return "Indicação";
  if (lower === "orgânico" || lower === "organico") return "Orgânico";
  if (lower === "outro") return "Outro";
  if (!raw || lower === "não identificado") return "Não identificado";
  return raw;
}

interface OriginData {
  origin: string;
  visits: number;
  contracts: number;
  totalValue: number;
  depositValue: number;
  conversionRate: number;
}

interface Props {
  visits: Visit[];
  contracts: Contract[];
}

export default function OriginReports({ visits, contracts }: Props) {
  const [period, setPeriod] = useState<string>("all");

  const filterByPeriod = <T extends { visitDate?: string; createdAt?: string; eventDate?: string }>(items: T[]): T[] => {
    if (period === "all") return items;
    const now = new Date();
    const cutoff = new Date();
    if (period === "7d") cutoff.setDate(now.getDate() - 7);
    else if (period === "30d") cutoff.setDate(now.getDate() - 30);
    else if (period === "90d") cutoff.setDate(now.getDate() - 90);
    return items.filter(item => {
      const dateStr = (item as any).visitDate || (item as any).createdAt || (item as any).eventDate || "";
      const d = new Date(dateStr);
      return d >= cutoff;
    });
  };

  const data = useMemo(() => {
    const filteredVisits = filterByPeriod(visits).filter(v => v.status !== "Cancelada");
    const filteredContracts = filterByPeriod(contracts).filter(c => c.status !== "cancelled");

    const map = new Map<string, OriginData>();

    filteredVisits.forEach(v => {
      const origin = normalizeOrigin(getOrigin(v as any));
      if (!map.has(origin)) {
        map.set(origin, { origin, visits: 0, contracts: 0, totalValue: 0, depositValue: 0, conversionRate: 0 });
      }
      map.get(origin)!.visits++;
    });

    filteredContracts.forEach(c => {
      const origin = normalizeOrigin(getOrigin(c as any));
      if (!map.has(origin)) {
        map.set(origin, { origin, visits: 0, contracts: 0, totalValue: 0, depositValue: 0, conversionRate: 0 });
      }
      const entry = map.get(origin)!;
      entry.contracts++;
      entry.totalValue += c.totalValue;
      entry.depositValue += c.depositValue;
    });

    map.forEach(entry => {
      entry.conversionRate = entry.visits > 0 ? Math.round((entry.contracts / entry.visits) * 100) : 0;
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [visits, contracts, period]);

  const totals = useMemo(() => {
    const totalVisits = data.reduce((s, d) => s + d.visits, 0);
    const totalContracts = data.reduce((s, d) => s + d.contracts, 0);
    const totalValue = data.reduce((s, d) => s + d.totalValue, 0);
    const bestOrigin = data[0];
    const bestConversion = [...data].filter(d => d.visits >= 2).sort((a, b) => b.conversionRate - a.conversionRate)[0];
    return { totalVisits, totalContracts, totalValue, bestOrigin, bestConversion };
  }, [data]);

  const pieData = useMemo(() => {
    return data.filter(d => d.visits > 0).map(d => ({
      name: d.origin,
      value: d.visits,
      fill: ORIGIN_COLORS[d.origin] || "hsl(220 9% 46%)",
    }));
  }, [data]);

  const revenueChartData = useMemo(() => {
    return data.filter(d => d.totalValue > 0).map(d => ({
      origin: d.origin,
      faturamento: d.totalValue,
      sinal: d.depositValue,
      fill: ORIGIN_COLORS[d.origin] || "hsl(220 9% 46%)",
    }));
  }, [data]);

  const conversionChartData = useMemo(() => {
    return data.filter(d => d.visits > 0).map(d => ({
      origin: d.origin,
      taxa: d.conversionRate,
      fill: ORIGIN_COLORS[d.origin] || "hsl(220 9% 46%)",
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="card-premium p-6 text-center">
        <Globe size={32} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum dado de origem encontrado. Comece adicionando visitas com a origem definida.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px] h-9 text-sm rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 stagger-fade-in">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-primary/10 p-2"><CalendarDays size={14} className="text-primary" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total visitas</p>
          </div>
          <p className="text-3xl font-display font-bold tracking-tight">{totals.totalVisits}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{data.length} origens identificadas</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-success/10 p-2"><FileText size={14} className="text-success" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total contratos</p>
          </div>
          <p className="text-3xl font-display font-bold text-success tracking-tight">{totals.totalContracts}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-success/10 p-2"><DollarSign size={14} className="text-success" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Faturamento total</p>
          </div>
          <p className="text-2xl font-display font-bold text-success tracking-tight">{fmt(totals.totalValue)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-accent p-2"><TrendingUp size={14} className="text-foreground" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Melhor origem</p>
          </div>
          <p className="text-sm font-display font-bold tracking-tight">{totals.bestOrigin?.origin || "—"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{fmt(totals.bestOrigin?.totalValue || 0)}</p>
        </div>
      </div>

      {/* Origin breakdown cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {data.map((d) => {
          const Icon = ORIGIN_ICONS[d.origin] || Globe;
          const color = ORIGIN_COLORS[d.origin] || "hsl(220 9% 46%)";
          return (
            <div key={d.origin} className="card-premium p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1.5" style={{ backgroundColor: `${color}15` }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <span className="text-sm font-semibold">{d.origin}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">Visitas</span>
                <span className="font-medium text-right">{d.visits}</span>
                <span className="text-muted-foreground">Contratos</span>
                <span className="font-medium text-right">{d.contracts}</span>
                <span className="text-muted-foreground">Conversão</span>
                <span className="font-medium text-right" style={{ color: d.conversionRate >= 30 ? "hsl(var(--success))" : undefined }}>{d.conversionRate}%</span>
                <span className="text-muted-foreground">Faturamento</span>
                <span className="font-medium text-right">{fmt(d.totalValue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by origin */}
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Faturamento por origem</h2>
          <p className="text-xs text-muted-foreground mb-6">Valor total de contratos ativos</p>
          <div className="h-[280px]">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="origin" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="faturamento" name="Faturamento" radius={[8, 8, 0, 0]} barSize={32}>
                    {revenueChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            )}
          </div>
        </div>

        {/* Conversion by origin */}
        <div className="card-premium p-6">
          <h2 className="font-display text-lg font-semibold mb-1">Conversão por origem</h2>
          <p className="text-xs text-muted-foreground mb-6">Taxa de visita → contrato</p>
          <div className="h-[280px]">
            {conversionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversionChartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="origin" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                  <Bar dataKey="taxa" name="Conversão" radius={[8, 8, 0, 0]} barSize={32}>
                    {conversionChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            )}
          </div>
        </div>
      </div>

      {/* Pie chart — lead distribution */}
      <div className="card-premium p-6">
        <h2 className="font-display text-lg font-semibold mb-1">Distribuição de leads</h2>
        <p className="text-xs text-muted-foreground mb-6">De onde vêm seus clientes</p>
        <div className="h-[300px]">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value} visitas`} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados</div>
          )}
        </div>
      </div>

      {/* Detailed table */}
      <div className="card-premium">
        <div className="px-6 py-4 flex items-center gap-2">
          <Globe size={18} className="text-primary" />
          <h2 className="font-display text-lg font-semibold">Desempenho por origem</h2>
        </div>
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-6 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Origem</th>
                <th className="text-center px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Visitas</th>
                <th className="text-center px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Contratos</th>
                <th className="text-center px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Conversão</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Sinal</th>
                <th className="text-right px-6 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Valor total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.map((d) => {
                const Icon = ORIGIN_ICONS[d.origin] || Globe;
                const color = ORIGIN_COLORS[d.origin] || "hsl(220 9% 46%)";
                return (
                  <tr key={d.origin} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Icon size={14} style={{ color }} />
                        <span className="font-medium">{d.origin}</span>
                      </div>
                    </td>
                    <td className="text-center px-4 py-3 tabular-nums">{d.visits}</td>
                    <td className="text-center px-4 py-3 tabular-nums">{d.contracts}</td>
                    <td className="text-center px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] ${d.conversionRate >= 30 ? "bg-success/10 text-success border-success/20" : ""}`}>
                        {d.conversionRate}%
                      </Badge>
                    </td>
                    <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{fmt(d.depositValue)}</td>
                    <td className="text-right px-6 py-3 tabular-nums font-medium">{fmt(d.totalValue)}</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="bg-secondary/20 font-semibold">
                <td className="px-6 py-3">Total</td>
                <td className="text-center px-4 py-3 tabular-nums">{totals.totalVisits}</td>
                <td className="text-center px-4 py-3 tabular-nums">{totals.totalContracts}</td>
                <td className="text-center px-4 py-3">
                  <Badge variant="outline" className="text-[10px]">
                    {totals.totalVisits > 0 ? Math.round((totals.totalContracts / totals.totalVisits) * 100) : 0}%
                  </Badge>
                </td>
                <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{fmt(data.reduce((s, d) => s + d.depositValue, 0))}</td>
                <td className="text-right px-6 py-3 tabular-nums">{fmt(totals.totalValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Megaphone, Users, CalendarDays, FileText, DollarSign, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getSourceLabel } from "@/lib/utmTracker";

interface CampaignData {
  campaign: string;
  source: string;
  visits: number;
  contracts: number;
  totalValue: number;
  depositValue: number;
  conversionRate: number;
}

interface Props {
  visits: Array<{ utmSource?: string; utmCampaign?: string; utmMedium?: string; status?: string }>;
  contracts: Array<{ utmSource?: string; utmCampaign?: string; utmMedium?: string; totalValue: number; depositValue: number; status: string }>;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CampaignAttribution({ visits, contracts }: Props) {
  const campaigns = useMemo(() => {
    const map = new Map<string, CampaignData>();

    const activeContracts = contracts.filter(c => c.status !== "cancelled");

    // Count visits per campaign
    visits.forEach(v => {
      const key = (v as any).utmCampaign || (v as any).utmSource || "";
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { campaign: key, source: (v as any).utmSource || "", visits: 0, contracts: 0, totalValue: 0, depositValue: 0, conversionRate: 0 });
      }
      map.get(key)!.visits++;
    });

    // Count contracts per campaign
    activeContracts.forEach(c => {
      const key = (c as any).utmCampaign || (c as any).utmSource || "";
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { campaign: key, source: (c as any).utmSource || "", visits: 0, contracts: 0, totalValue: 0, depositValue: 0, conversionRate: 0 });
      }
      const entry = map.get(key)!;
      entry.contracts++;
      entry.totalValue += c.totalValue;
      entry.depositValue += c.depositValue;
    });

    // Calculate conversion rates
    map.forEach(entry => {
      entry.conversionRate = entry.visits > 0 ? Math.round((entry.contracts / entry.visits) * 100) : 0;
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [visits, contracts]);

  const totals = useMemo(() => {
    const trackedVisits = visits.filter(v => (v as any).utmSource || (v as any).utmCampaign).length;
    const trackedContracts = contracts.filter(c => c.status !== "cancelled" && ((c as any).utmSource || (c as any).utmCampaign)).length;
    const trackedValue = contracts.filter(c => c.status !== "cancelled" && ((c as any).utmSource || (c as any).utmCampaign)).reduce((s, c) => s + c.totalValue, 0);
    const trackedDeposit = contracts.filter(c => c.status !== "cancelled" && ((c as any).utmSource || (c as any).utmCampaign)).reduce((s, c) => s + c.depositValue, 0);
    const topCampaign = campaigns[0];
    return { trackedVisits, trackedContracts, trackedValue, trackedDeposit, topCampaign };
  }, [visits, contracts, campaigns]);

  if (campaigns.length === 0) {
    return (
      <div className="card-premium p-6">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone size={18} className="text-primary" />
          <h2 className="font-display text-lg font-semibold">Atribuição de Campanhas</h2>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma campanha rastreada ainda. Adicione parâmetros UTM nos seus links de anúncio para começar a rastrear.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-primary/10 p-2"><CalendarDays size={14} className="text-primary" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Visitas rastreadas</p>
          </div>
          <p className="text-3xl font-display font-bold tracking-tight">{totals.trackedVisits}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-success/10 p-2"><FileText size={14} className="text-success" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Contratos rastreados</p>
          </div>
          <p className="text-3xl font-display font-bold text-success tracking-tight">{totals.trackedContracts}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-success/10 p-2"><DollarSign size={14} className="text-success" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Valor gerado</p>
          </div>
          <p className="text-2xl font-display font-bold text-success tracking-tight">{fmt(totals.trackedValue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Sinal: {fmt(totals.trackedDeposit)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-accent p-2"><TrendingUp size={14} className="text-foreground" /></div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Melhor campanha</p>
          </div>
          <p className="text-sm font-display font-bold tracking-tight truncate">{totals.topCampaign?.campaign || "—"}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{fmt(totals.topCampaign?.totalValue || 0)}</p>
        </div>
      </div>

      {/* Campaign Table */}
      <div className="card-premium">
        <div className="px-6 py-4 flex items-center gap-2">
          <Megaphone size={18} className="text-primary" />
          <h2 className="font-display text-lg font-semibold">Desempenho por Campanha</h2>
        </div>
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-6 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Campanha</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Origem</th>
                <th className="text-center px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Visitas</th>
                <th className="text-center px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Contratos</th>
                <th className="text-center px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Conversão</th>
                <th className="text-right px-4 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Sinal</th>
                <th className="text-right px-6 py-3 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Valor total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {campaigns.map((c) => (
                <tr key={c.campaign} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-6 py-3 font-medium truncate max-w-[200px]">{c.campaign}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">{getSourceLabel(c.source)}</Badge>
                  </td>
                  <td className="text-center px-4 py-3 tabular-nums">{c.visits}</td>
                  <td className="text-center px-4 py-3 tabular-nums">{c.contracts}</td>
                  <td className="text-center px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] ${c.conversionRate >= 30 ? "bg-success/10 text-success border-success/20" : ""}`}>
                      {c.conversionRate}%
                    </Badge>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums text-muted-foreground">{fmt(c.depositValue)}</td>
                  <td className="text-right px-6 py-3 tabular-nums font-medium">{fmt(c.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle,
  FileText, X, Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { FinancialData, FinancialTransaction } from "./types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  data: FinancialData;
  onDeleteEntry: (item: FinancialTransaction) => void;
}

export default function FinancialCashFlow({ data, onDeleteEntry }: Props) {
  const { extrato, allEntradas, allSaidas, monthLabel } = data;

  // Cash flow chart data
  const cashFlowData = useMemo(() => {
    const all = [...extrato].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulative = 0;
    const dailyMap: Record<string, { entradas: number; saidas: number; saldo: number }> = {};
    for (const item of all) {
      const val = item.type === "entrada" ? item.amount : -item.amount;
      cumulative += val;
      if (!dailyMap[item.date]) dailyMap[item.date] = { entradas: 0, saidas: 0, saldo: 0 };
      if (val > 0) dailyMap[item.date].entradas += val;
      else dailyMap[item.date].saidas += Math.abs(val);
      dailyMap[item.date].saldo = cumulative;
    }
    return Object.entries(dailyMap).map(([date, vals]) => ({
      date: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ...vals,
    }));
  }, [extrato]);

  const totalEntradas = allEntradas.reduce((s, i) => s + i.amount, 0);
  const totalSaidas = allSaidas.reduce((s, i) => s + i.amount, 0);
  const saldo = totalEntradas - totalSaidas;

  const renderTransaction = (item: FinancialTransaction) => (
    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`rounded-full p-2 shrink-0 ${item.type === "entrada" ? "bg-success/10" : "bg-danger/10"}`}>
          {item.type === "entrada" ? <ArrowUpCircle size={16} className="text-success" /> : <ArrowDownCircle size={16} className="text-danger" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.description}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-muted-foreground">{new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
            <span className="text-xs text-muted-foreground">•</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
            {item.source === "payment" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success">Contrato</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className={`font-bold text-sm ${item.type === "entrada" ? "text-success" : "text-danger"}`}>
          {item.type === "entrada" ? "+" : "-"} {fmt(item.amount)}
        </p>
        {item.source !== "payment" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {item.type === "entrada" ? "entrada" : "despesa"}?</AlertDialogTitle>
                <AlertDialogDescription>"{item.description}" será removida permanentemente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDeleteEntry(item)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="p-4 border-success/30 bg-gradient-to-br from-success/5 to-transparent text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Entradas</p>
          <p className="text-xl font-display font-bold text-success">{fmt(totalEntradas)}</p>
        </Card>
        <Card className="p-4 border-danger/30 bg-gradient-to-br from-danger/5 to-transparent text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Saídas</p>
          <p className="text-xl font-display font-bold text-danger">{fmt(totalSaidas)}</p>
        </Card>
        <Card className={`p-4 text-center ${saldo >= 0 ? "border-success/30 bg-gradient-to-br from-success/5" : "border-danger/30 bg-gradient-to-br from-danger/5"} to-transparent`}>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Saldo</p>
          <p className={`text-xl font-display font-bold ${saldo >= 0 ? "text-success" : "text-danger"}`}>{fmt(saldo)}</p>
        </Card>
      </div>

      {/* Chart */}
      {cashFlowData.length > 0 && (
        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-4">Saldo Acumulado</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Full extrato */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-base flex items-center gap-2">
            <FileText size={18} /> Extrato Consolidado — {monthLabel}
          </h3>
          <p className="text-xs text-muted-foreground">{extrato.length} movimentação(ões)</p>
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {extrato.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma movimentação</div>
          ) : extrato.map(item => renderTransaction(item))}
        </div>
      </Card>
    </div>
  );
}

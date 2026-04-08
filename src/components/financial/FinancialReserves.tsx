import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Target, Wrench, Megaphone, PiggyBank, Landmark, Settings } from "lucide-react";
import { toast } from "sonner";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ReserveType = "melhoria" | "marketing" | "investimento" | "manutencao";

interface Reserve {
  type: ReserveType;
  goal: number;
  saved: number;
}

const RESERVE_CONFIG: Record<ReserveType, { label: string; description: string; icon: typeof Wrench; colorClass: string; borderClass: string; bgClass: string }> = {
  melhoria: { label: "Fundo de Melhorias", description: "Reserva para reformas e equipamentos", icon: Wrench, colorClass: "text-amber-600 dark:text-amber-400", borderClass: "border-amber-500/30", bgClass: "from-amber-500/5" },
  marketing: { label: "Fundo de Marketing", description: "Reserva para tráfego pago e anúncios", icon: Megaphone, colorClass: "text-blue-600 dark:text-blue-400", borderClass: "border-blue-500/30", bgClass: "from-blue-500/5" },
  investimento: { label: "Investimento", description: "Reserva para investimentos futuros", icon: Landmark, colorClass: "text-emerald-600 dark:text-emerald-400", borderClass: "border-emerald-500/30", bgClass: "from-emerald-500/5" },
  manutencao: { label: "Manutenção", description: "Reserva para manutenção do espaço", icon: Settings, colorClass: "text-violet-600 dark:text-violet-400", borderClass: "border-violet-500/30", bgClass: "from-violet-500/5" },
};

interface Props {
  selectedMonth: string;
  lucroDoMes: number;
}

export default function FinancialReserves({ selectedMonth, lucroDoMes }: Props) {
  const getReserves = (): Record<ReserveType, Reserve> => {
    const saved = localStorage.getItem(`reserves_v2_${selectedMonth}`);
    if (saved) return JSON.parse(saved);
    // Migrate from old format
    const old = localStorage.getItem(`reserves_${selectedMonth}`);
    if (old) {
      const parsed = JSON.parse(old);
      return {
        melhoria: parsed.melhoria || { type: "melhoria", goal: 0, saved: 0 },
        marketing: parsed.marketing || { type: "marketing", goal: 0, saved: 0 },
        investimento: { type: "investimento", goal: 0, saved: 0 },
        manutencao: { type: "manutencao", goal: 0, saved: 0 },
      };
    }
    return {
      melhoria: { type: "melhoria", goal: 0, saved: 0 },
      marketing: { type: "marketing", goal: 0, saved: 0 },
      investimento: { type: "investimento", goal: 0, saved: 0 },
      manutencao: { type: "manutencao", goal: 0, saved: 0 },
    };
  };

  const [reserves, setReserves] = useState<Record<ReserveType, Reserve>>(getReserves);
  const [addAmounts, setAddAmounts] = useState<Record<ReserveType, number>>({ melhoria: 0, marketing: 0, investimento: 0, manutencao: 0 });
  const [goalEdits, setGoalEdits] = useState<Record<ReserveType, number>>({ melhoria: 0, marketing: 0, investimento: 0, manutencao: 0 });

  useEffect(() => { setReserves(getReserves()); }, [selectedMonth]);

  const saveReserves = (r: Record<ReserveType, Reserve>) => {
    setReserves(r);
    localStorage.setItem(`reserves_v2_${selectedMonth}`, JSON.stringify(r));
  };

  const handleAdd = (type: ReserveType) => {
    if (addAmounts[type] <= 0) { toast.error("Informe um valor"); return; }
    saveReserves({ ...reserves, [type]: { ...reserves[type], saved: reserves[type].saved + addAmounts[type] } });
    setAddAmounts(a => ({ ...a, [type]: 0 }));
    toast.success("Reserva adicionada");
  };

  const handleSetGoal = (type: ReserveType) => {
    saveReserves({ ...reserves, [type]: { ...reserves[type], goal: goalEdits[type] } });
    toast.success("Meta atualizada");
  };

  const handleReset = (type: ReserveType) => {
    saveReserves({ ...reserves, [type]: { ...reserves[type], saved: 0 } });
    toast.success("Reserva zerada");
  };

  const totalReservas = Object.values(reserves).reduce((s, r) => s + r.saved, 0);
  const monthLabel = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(RESERVE_CONFIG) as ReserveType[]).map(type => {
          const config = RESERVE_CONFIG[type];
          const Icon = config.icon;
          const reserve = reserves[type];
          const progress = reserve.goal > 0 ? Math.min(100, (reserve.saved / reserve.goal) * 100) : 0;

          return (
            <Card key={type} className={`p-5 ${config.borderClass} bg-gradient-to-br ${config.bgClass} to-transparent`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-muted/50 p-3"><Icon size={20} className={config.colorClass} /></div>
                  <div>
                    <h3 className="font-display font-semibold text-lg">{config.label}</h3>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">Zerar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Zerar reserva?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleReset(type)}>Zerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Acumulado</p>
                    <p className={`text-2xl font-display font-bold ${config.colorClass}`}>{fmt(reserve.saved)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Meta</p>
                    <p className="text-2xl font-display font-bold">{reserve.goal > 0 ? fmt(reserve.goal) : "—"}</p>
                  </div>
                </div>

                {reserve.goal > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progresso</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={progress} className="h-2.5" />
                  </div>
                )}

                <div className="flex gap-2">
                  <CurrencyInput value={addAmounts[type]} onChange={(v) => setAddAmounts(a => ({ ...a, [type]: v }))} placeholder="Valor" className="flex-1" />
                  <Button size="sm" className="h-10" onClick={() => handleAdd(type)}>
                    <Plus size={14} className="mr-1" /> Adicionar
                  </Button>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Definir meta</Label>
                    <CurrencyInput value={goalEdits[type]} onChange={(v) => setGoalEdits(g => ({ ...g, [type]: v }))} />
                  </div>
                  <Button size="sm" variant="outline" className="h-10" onClick={() => handleSetGoal(type)}>
                    <Target size={14} className="mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <Card className="p-5">
        <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
          <PiggyBank size={18} /> Resumo das Reservas — {monthLabel}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(RESERVE_CONFIG) as ReserveType[]).map(type => {
            const config = RESERVE_CONFIG[type];
            return (
              <div key={type} className="p-3 rounded-lg bg-muted/30 border text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">{config.label}</p>
                <p className={`text-xl font-display font-bold ${config.colorClass}`}>{fmt(reserves[type].saved)}</p>
              </div>
            );
          })}
          <div className="p-3 rounded-lg bg-muted/50 border text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total Reservado</p>
            <p className="text-xl font-display font-bold">{fmt(totalReservas)}</p>
          </div>
          <div className={`p-3 rounded-lg border text-center ${lucroDoMes >= 0 ? "bg-success/10 border-success/20" : "bg-danger/10 border-danger/20"}`}>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lucro após Reservas</p>
            <p className={`text-xl font-display font-bold ${lucroDoMes >= 0 ? "text-success" : "text-danger"}`}>{fmt(lucroDoMes - totalReservas)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

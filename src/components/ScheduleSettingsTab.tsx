import { useEffect, useState } from "react";
import { Clock, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ALL_HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9..20

const DAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

interface ScheduleSettings {
  allowed_days: number[];
  start_hour: number;
  end_hour: number;
  blocked_hours: number[];
}

const defaults: ScheduleSettings = {
  allowed_days: [2, 4],
  start_hour: 9,
  end_hour: 20,
  blocked_hours: [],
};

export default function ScheduleSettingsTab() {
  const [settings, setSettings] = useState<ScheduleSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("booking_schedule_settings" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        allowed_days: (data as any).allowed_days || [2, 4],
        start_hour: (data as any).start_hour ?? 9,
        end_hour: (data as any).end_hour ?? 20,
        blocked_hours: (data as any).blocked_hours || [],
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: existing } = await supabase
        .from("booking_schedule_settings" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = {
        ...settings,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from("booking_schedule_settings" as any)
          .update(payload as any)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("booking_schedule_settings" as any)
          .insert({ user_id: user.id, ...payload } as any);
        if (error) throw error;
      }

      toast({ title: "✅ Horários salvos com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      allowed_days: prev.allowed_days.includes(day)
        ? prev.allowed_days.filter(d => d !== day)
        : [...prev.allowed_days, day].sort(),
    }));
  };

  const toggleBlockedHour = (hour: number) => {
    setSettings(prev => ({
      ...prev,
      blocked_hours: prev.blocked_hours.includes(hour)
        ? prev.blocked_hours.filter(h => h !== hour)
        : [...prev.blocked_hours, hour].sort((a, b) => a - b),
    }));
  };

  const availableHours = ALL_HOURS.filter(
    h => h >= settings.start_hour && h <= settings.end_hour
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Dias permitidos */}
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Clock size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Dias de atendimento</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Selecione os dias da semana disponíveis para visitas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 0].map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`
                  rounded-xl border px-4 py-3 text-sm font-medium transition-all
                  ${settings.allowed_days.includes(day)
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                  }
                `}
              >
                {DAY_LABELS[day]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Horários bloqueados */}
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <Clock size={20} className="text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Horários bloqueados</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Toque nos horários que você <strong>NÃO</strong> pode atender (ex: almoço)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableHours.map(hour => {
              const isBlocked = settings.blocked_hours.includes(hour);
              const timeLabel = `${hour.toString().padStart(2, "0")}:00`;
              return (
                <button
                  key={hour}
                  onClick={() => toggleBlockedHour(hour)}
                  className={`
                    rounded-xl border px-3 py-3 text-sm font-medium transition-all
                    ${isBlocked
                      ? "bg-destructive/15 text-destructive border-destructive/30 line-through"
                      : "bg-success/8 text-success border-success/20 hover:border-success/40"
                    }
                  `}
                >
                  {timeLabel}
                  <span className="block text-[10px] mt-0.5 font-normal">
                    {isBlocked ? "Bloqueado" : "Disponível"}
                  </span>
                </button>
              );
            })}
          </div>
          {settings.blocked_hours.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {settings.blocked_hours.length} horário(s) bloqueado(s) — não aparecerão no agendamento online
            </p>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? "Salvando..." : "Salvar configuração de horários"}
      </Button>
    </div>
  );
}

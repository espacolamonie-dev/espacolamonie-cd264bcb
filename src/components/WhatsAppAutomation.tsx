import { useEffect, useState } from "react";
import { Zap, Save, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { type PipelineStage, getPipelineStages } from "@/data/pipelineStore";
import { type AutomationRule, getAutomationRules, upsertAutomationRule } from "@/data/whatsappStore";
import { TEMPLATE_KEYS } from "@/data/leadsStore";

export default function WhatsAppAutomation() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Local edits keyed by stage_id
  const [edits, setEdits] = useState<Record<string, Partial<AutomationRule>>>({});

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([getPipelineStages(), getAutomationRules()]);
      setStages(s.filter((st) => st.is_active));
      setRules(r);

      // Initialize edits from existing rules
      const map: Record<string, Partial<AutomationRule>> = {};
      s.forEach((st) => {
        const existing = r.find((rule) => rule.stage_id === st.id);
        map[st.id] = existing || {
          stage_id: st.id,
          auto_message_template_key: null,
          auto_send: false,
          followup_after_hours: null,
          followup_template_key: null,
          enabled: true,
        };
      });
      setEdits(map);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (stageId: string) => {
    const edit = edits[stageId];
    if (!edit) return;
    setSaving(stageId);
    try {
      await upsertAutomationRule({ ...edit, stage_id: stageId } as any);
      toast.success("Automação salva!");
      await loadAll();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(null);
    }
  };

  const updateEdit = (stageId: string, field: string, value: any) => {
    setEdits((prev) => ({
      ...prev,
      [stageId]: { ...prev[stageId], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Zap size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Automações por Etapa</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configure mensagens automáticas e follow-ups ao mover leads entre etapas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {stages.map((stage) => {
          const edit = edits[stage.id] || {};
          return (
            <Card key={stage.id} className="card-premium">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${stage.color}`}>
                    {stage.label}
                  </Badge>
                  <Switch
                    checked={edit.enabled !== false}
                    onCheckedChange={(v) => updateEdit(stage.id, "enabled", v)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Mensagem ao entrar na etapa</Label>
                  <Select
                    value={edit.auto_message_template_key || "none"}
                    onValueChange={(v) => updateEdit(stage.id, "auto_message_template_key", v === "none" ? null : v)}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {TEMPLATE_KEYS.map(({ key, label }) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={edit.auto_send || false}
                    onCheckedChange={(v) => updateEdit(stage.id, "auto_send", v)}
                  />
                  <Label className="text-xs">Enviar automaticamente (sem confirmação)</Label>
                </div>

                <div className="border-t border-border pt-3">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Clock size={12} /> Follow-up automático
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={edit.followup_after_hours || ""}
                      onChange={(e) => updateEdit(stage.id, "followup_after_hours", e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="Horas"
                      className="w-20 h-9 text-sm"
                    />
                    <Select
                      value={edit.followup_template_key || "none"}
                      onValueChange={(v) => updateEdit(stage.id, "followup_template_key", v === "none" ? null : v)}
                    >
                      <SelectTrigger className="flex-1 h-9 text-sm">
                        <SelectValue placeholder="Template follow-up" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {TEMPLATE_KEYS.map(({ key, label }) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSave(stage.id)}
                  disabled={saving === stage.id}
                  className="gap-1.5 text-xs w-full"
                >
                  <Save size={12} /> {saving === stage.id ? "Salvando..." : "Salvar"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

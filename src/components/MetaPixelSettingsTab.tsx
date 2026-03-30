import { useEffect, useState } from "react";
import {
  Save, Loader2, TestTube, CheckCircle2, XCircle, AlertCircle,
  Activity, BarChart3, Eye, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MetaSettings {
  pixel_enabled: boolean;
  capi_enabled: boolean;
  pixel_id: string;
  access_token: string;
  conversion_event: string;
  send_value: boolean;
  value_source: string;
  whatsapp_number: string;
}

const defaults: MetaSettings = {
  pixel_enabled: false,
  capi_enabled: false,
  pixel_id: "",
  access_token: "",
  conversion_event: "Lead",
  send_value: false,
  value_source: "total",
  whatsapp_number: "",
};

interface EventStats {
  leads: number;
  visits: number;
  contracts: number;
  totalValue: number;
  errors: number;
}

function SectionCard({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <Card className="card-premium">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Icon size={20} className="text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-display">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function MetaPixelSettingsTab() {
  const [settings, setSettings] = useState<MetaSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [stats, setStats] = useState<EventStats>({ leads: 0, visits: 0, contracts: 0, totalValue: 0, errors: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("meta_pixel_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setSettings({
          pixel_enabled: d.pixel_enabled ?? false,
          capi_enabled: d.capi_enabled ?? false,
          pixel_id: d.pixel_id ?? "",
          access_token: d.access_token ?? "",
          conversion_event: d.conversion_event ?? "Lead",
          send_value: d.send_value ?? false,
          value_source: d.value_source ?? "total",
          whatsapp_number: d.whatsapp_number ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from("meta_event_logs" as any)
        .select("*")
        .eq("user_id", user.id);

      if (!logs) return;
      const arr = (logs as any[]).filter(l => !l.payload?.custom_data?.test);
      const sentArr = arr.filter(l => l.status === "sent");
      const errorCount = arr.filter(l => l.status === "error").length;
      
      const leads = sentArr.filter(l => l.event_name === "Lead").length;
      const visits = sentArr.filter(l => l.event_name === "Schedule").length;
      const contracts = sentArr.filter(l => ["InitiateCheckout", "Purchase", "CompleteRegistration"].includes(l.event_name)).length;
      const totalValue = sentArr
        .filter(l => l.event_name === "Purchase")
        .reduce((sum: number, l: any) => {
          const v = l.payload?.custom_data?.value ?? l.payload?.value ?? 0;
          return sum + Number(v);
        }, 0);

      setStats({ leads, visits, contracts, totalValue, errors: errorCount });
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: existing } = await supabase
        .from("meta_pixel_settings" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = { ...settings, updated_at: new Date().toISOString() };

      if (existing) {
        await supabase
          .from("meta_pixel_settings" as any)
          .update(payload as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("meta_pixel_settings" as any)
          .insert({ user_id: user.id, ...payload } as any);
      }

      toast({ title: "✅ Configurações do Meta Pixel salvas!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-conversion`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            event_name: "Lead",
            event_id: `test-${Date.now()}`,
            user_data: { email: "test@test.com" },
            custom_data: { test: true },
          }),
        }
      );

      if (res.ok) {
        setTestResult("success");
        toast({ title: "✅ Evento de teste enviado com sucesso!" });
      } else {
        const err = await res.text();
        setTestResult("error");
        toast({ title: "Erro no teste", description: err, variant: "destructive" });
      }
    } catch (e: any) {
      setTestResult("error");
      toast({ title: "Erro no teste", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const update = (field: keyof MetaSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const getStatusBadge = () => {
    if (!settings.pixel_enabled && !settings.capi_enabled) {
      return <Badge variant="outline" className="gap-1 text-xs border-destructive/30 text-destructive"><XCircle size={11} /> Não conectado</Badge>;
    }
    if (settings.pixel_enabled && settings.pixel_id && settings.capi_enabled && settings.access_token) {
      return <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><CheckCircle2 size={11} /> Conectado</Badge>;
    }
    return <Badge variant="outline" className="gap-1 text-xs border-yellow-500/30 text-yellow-600"><AlertCircle size={11} /> Configuração incompleta</Badge>;
  };

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 stagger-fade-in">
      {/* Integration toggles */}
      <SectionCard icon={Zap} title="Integração Meta Ads" description="Ative o Pixel e a Conversions API">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium">Status</span>
          {getStatusBadge()}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Ativar Meta Pixel</p>
              <p className="text-xs text-muted-foreground">Rastreamento no frontend</p>
            </div>
            <Switch checked={settings.pixel_enabled} onCheckedChange={v => update("pixel_enabled", v)} />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Ativar Conversions API</p>
              <p className="text-xs text-muted-foreground">Envio server-side para melhor atribuição</p>
            </div>
            <Switch checked={settings.capi_enabled} onCheckedChange={v => update("capi_enabled", v)} />
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <Label className="text-xs">Pixel ID</Label>
            <Input
              value={settings.pixel_id}
              onChange={e => update("pixel_id", e.target.value)}
              placeholder="Ex: 123456789012345"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Access Token da Meta</Label>
            <Input
              type="password"
              value={settings.access_token}
              onChange={e => update("access_token", e.target.value)}
              placeholder="Token de acesso da Conversions API"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2 flex-1">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !settings.capi_enabled || !settings.access_token}
            className="gap-2"
          >
            {testing ? <Loader2 size={15} className="animate-spin" /> : <TestTube size={15} />}
            Testar
          </Button>
        </div>

        {testResult && (
          <div className={`rounded-xl p-3 border text-sm flex items-center gap-2 ${
            testResult === "success"
              ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600"
              : "bg-destructive/5 border-destructive/20 text-destructive"
          }`}>
            {testResult === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {testResult === "success" ? "Evento de teste enviado com sucesso!" : "Falha ao enviar evento de teste"}
          </div>
        )}
      </SectionCard>

      {/* Conversion settings */}
      <SectionCard icon={Activity} title="Configurações de Conversão" description="Defina qual evento enviar e quando">
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Evento principal de conversão</Label>
            <Select value={settings.conversion_event} onValueChange={v => update("conversion_event", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Schedule">Visita agendada</SelectItem>
                <SelectItem value="Purchase">Contrato assinado</SelectItem>
                <SelectItem value="DepositPaid">Sinal pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Enviar valor</p>
              <p className="text-xs text-muted-foreground">Incluir valor monetário no evento</p>
            </div>
            <Switch checked={settings.send_value} onCheckedChange={v => update("send_value", v)} />
          </div>

          {settings.send_value && (
            <div>
              <Label className="text-xs">Usar valor de</Label>
              <Select value={settings.value_source} onValueChange={v => update("value_source", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Contrato total</SelectItem>
                  <SelectItem value="deposit">Valor do sinal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div>
              <Label className="text-xs">WhatsApp vinculado ao anúncio (opcional)</Label>
              <Input
                value={settings.whatsapp_number}
                onChange={e => update("whatsapp_number", e.target.value)}
                placeholder="(00) 00000-0000"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Preparado para integração futura</p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2 w-full mt-2">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </SectionCard>

      {/* Dashboard stats */}
      <div className="lg:col-span-2">
        <SectionCard icon={BarChart3} title="Painel de Eventos" description="Resumo dos eventos enviados para o Meta">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Leads enviados", value: stats.leads, color: "text-blue-600 bg-blue-500/10" },
              { label: "Visitas enviadas", value: stats.visits, color: "text-purple-600 bg-purple-500/10" },
              { label: "Contratos enviados", value: stats.contracts, color: "text-emerald-600 bg-emerald-500/10" },
              {
                label: "Valor total enviado",
                value: stats.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                color: "text-amber-600 bg-amber-500/10",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border p-4 text-center">
                <div className={`inline-flex rounded-lg p-2 ${item.color} mb-2`}>
                  <Eye size={16} />
                </div>
                <p className="text-2xl font-bold font-display">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

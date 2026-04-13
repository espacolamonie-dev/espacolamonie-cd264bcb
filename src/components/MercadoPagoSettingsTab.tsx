import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, CheckCircle2, XCircle, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MpSettings {
  access_token: string;
  public_key: string;
  webhook_secret: string;
  success_url: string;
  failure_url: string;
  pending_url: string;
  webhook_url: string;
  is_active: boolean;
}

const defaultMpSettings: MpSettings = {
  access_token: "",
  public_key: "",
  webhook_secret: "",
  success_url: "",
  failure_url: "",
  pending_url: "",
  webhook_url: "",
  is_active: false,
};

export default function MercadoPagoSettingsTab() {
  const [settings, setSettings] = useState<MpSettings>(defaultMpSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("mercado_pago_settings" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setSettings({
          access_token: (data as any).access_token || "",
          public_key: (data as any).public_key || "",
          webhook_secret: (data as any).webhook_secret || "",
          success_url: (data as any).success_url || "",
          failure_url: (data as any).failure_url || "",
          pending_url: (data as any).pending_url || "",
          webhook_url: (data as any).webhook_url || "",
          is_active: (data as any).is_active || false,
        });
      } else {
        // Auto-fill webhook URL
        const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-webhook`;
        setSettings(prev => ({ ...prev, webhook_url: webhookUrl }));
      }
    } catch (e) {
      console.error("Error loading MP settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: existing } = await supabase
        .from("mercado_pago_settings" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = {
        ...settings,
        updated_at: new Date().toISOString(),
      } as any;

      if (existing) {
        const { error } = await supabase
          .from("mercado_pago_settings" as any)
          .update(payload)
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mercado_pago_settings" as any)
          .insert({ user_id: user.id, ...payload });
        if (error) throw error;
      }

      toast({ title: "✅ Configurações do Mercado Pago salvas!" });
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
      if (!settings.access_token) {
        throw new Error("Access Token não configurado");
      }

      const res = await fetch("https://api.mercadopago.com/v1/payment_methods", {
        headers: { Authorization: `Bearer ${settings.access_token}` },
      });

      if (res.ok) {
        setTestResult("success");
        toast({ title: "✅ Conexão com Mercado Pago estabelecida!" });
      } else {
        throw new Error("Token inválido ou sem permissão");
      }
    } catch (e: any) {
      setTestResult("error");
      toast({ title: "❌ Falha na conexão", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const update = (field: keyof MpSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <CreditCard size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-display">Mercado Pago</CardTitle>
              <CardDescription className="text-xs mt-0.5">Integração para pagamentos com cartão de crédito</CardDescription>
            </div>
            <Badge variant={settings.is_active ? "default" : "secondary"} className={settings.is_active ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : ""}>
              {settings.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary border">
            <div>
              <p className="text-sm font-medium">Ativar integração</p>
              <p className="text-xs text-muted-foreground">Habilitar pagamentos via Mercado Pago</p>
            </div>
            <Switch checked={settings.is_active} onCheckedChange={(v) => update("is_active", v)} />
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Access Token *</Label>
              <Input
                type="password"
                value={settings.access_token}
                onChange={(e) => update("access_token", e.target.value)}
                placeholder="APP_USR-..."
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Encontre em: Mercado Pago → Seu negócio → Configurações → Gestão e administração → Credenciais
              </p>
            </div>

            <div>
              <Label className="text-xs">Public Key</Label>
              <Input
                value={settings.public_key}
                onChange={(e) => update("public_key", e.target.value)}
                placeholder="APP_USR-..."
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Assinatura Secreta do Webhook (Secret)</Label>
              <Input
                type="password"
                value={settings.webhook_secret}
                onChange={(e) => update("webhook_secret", e.target.value)}
                placeholder="Cole aqui a assinatura secreta..."
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Encontre em: Mercado Pago → Suas integrações → Webhooks → Assinatura secreta
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">URLs de retorno</p>
            <div>
              <Label className="text-xs">URL de Sucesso</Label>
              <Input
                value={settings.success_url}
                onChange={(e) => update("success_url", e.target.value)}
                placeholder="https://seusite.com/pagamento/sucesso"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">URL de Falha</Label>
              <Input
                value={settings.failure_url}
                onChange={(e) => update("failure_url", e.target.value)}
                placeholder="https://seusite.com/pagamento/falha"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">URL Pendente</Label>
              <Input
                value={settings.pending_url}
                onChange={(e) => update("pending_url", e.target.value)}
                placeholder="https://seusite.com/pagamento/pendente"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Webhook</p>
            <div>
              <Label className="text-xs">URL do Webhook (notificações)</Label>
              <Input
                value={settings.webhook_url}
                onChange={(e) => update("webhook_url", e.target.value)}
                placeholder="https://..."
                className="mt-1 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Configure esta URL nas notificações do Mercado Pago para receber atualizações automáticas de pagamento.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleTest} variant="outline" disabled={testing || !settings.access_token} className="gap-2">
              {testing ? <Loader2 size={15} className="animate-spin" /> : testResult === "success" ? <CheckCircle2 size={15} className="text-emerald-600" /> : testResult === "error" ? <XCircle size={15} className="text-red-500" /> : <ExternalLink size={15} />}
              Testar conexão
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "Salvando..." : "Salvar configurações"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, RefreshCw, Calendar, ExternalLink,
  AlertCircle, Loader2, Building2, CreditCard, Bell, Shield,
  Save, Upload, GitBranch, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleCalendar, GoogleCalendarItem, GoogleSettings } from "@/hooks/useGoogleCalendar";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import PipelineSettingsTab from "@/components/PipelineSettingsTab";
import CatalogSettingsTab from "@/components/CatalogSettingsTab";
import ScheduleSettingsTab from "@/components/ScheduleSettingsTab";
import { supabase } from "@/integrations/supabase/client";

// ─── Masks ───
function cnpjMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function phoneMask(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Company Settings Store ───
interface CompanySettings {
  company_name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  default_bank: string;
  default_pix_key: string;
  default_entry_category: string;
  default_expense_category: string;
  auto_receipt: boolean;
  auto_confirm_payment: boolean;
}

const defaultSettings: CompanySettings = {
  company_name: "",
  cnpj: "",
  phone: "",
  email: "",
  address: "",
  default_bank: "",
  default_pix_key: "",
  default_entry_category: "Aluguel extra",
  default_expense_category: "Outros",
  auto_receipt: false,
  auto_confirm_payment: false,
};

async function loadCompanySettings(): Promise<CompanySettings> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return defaultSettings;

  const { data } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return defaultSettings;
  return {
    company_name: (data as any).company_name || "",
    cnpj: (data as any).cnpj || "",
    phone: (data as any).phone || "",
    email: (data as any).email || "",
    address: (data as any).address || "",
    default_bank: (data as any).default_bank || "",
    default_pix_key: (data as any).default_pix_key || "",
    default_entry_category: (data as any).default_entry_category || "Aluguel extra",
    default_expense_category: (data as any).default_expense_category || "Outros",
    auto_receipt: (data as any).auto_receipt || false,
    auto_confirm_payment: (data as any).auto_confirm_payment || false,
  };
}

async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: existing } = await supabase
    .from("company_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const payload = { ...settings, updated_at: new Date().toISOString() } as any;

  if (existing) {
    const { error } = await supabase
      .from("company_settings")
      .update(payload)
      .eq("id", (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("company_settings")
      .insert({ user_id: user.id, ...payload });
    if (error) throw error;
  }
}

// ─── UI Helpers ───
function SectionCard({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
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

function SettingRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, loading, fetchSettings, getAuthUrl, disconnect, getCalendars, setCalendar, getSyncLogs } = useGoogleCalendar();
  const [pageLoading, setPageLoading] = useState(true);
  const [calendars, setCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const { toast } = useToast();

  // Company settings state
  const [cs, setCs] = useState<CompanySettings>(defaultSettings);
  const [csLoading, setCsLoading] = useState(true);
  const [csSaving, setCsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setPageLoading(true);
      setCsLoading(true);
      const [s, companyData] = await Promise.all([fetchSettings(), loadCompanySettings()]);
      setCs(companyData);
      setCsLoading(false);
      if (s?.is_connected) {
        loadCalendars();
        loadLogs();
      }
      setPageLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") {
      toast({ title: "✅ Google Agenda conectado com sucesso!" });
      setSearchParams({});
      fetchSettings().then((s) => {
        if (s?.is_connected) {
          loadCalendars();
          loadLogs();
        }
        setPageLoading(false);
      });
    } else if (googleParam === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast({ title: "Erro ao conectar Google Agenda", description: `Motivo: ${reason}`, variant: "destructive" });
      setSearchParams({});
    }
  }, [searchParams]);

  const loadCalendars = async () => {
    setCalendarLoading(true);
    try {
      const list = await getCalendars();
      setCalendars(list);
    } catch {} finally {
      setCalendarLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const l = await getSyncLogs();
      setLogs(l);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnectLoading(true);
    try {
      const url = await getAuthUrl();
      window.location.href = url;
    } catch {
      toast({ title: "Erro ao iniciar conexão", variant: "destructive" });
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setCalendars([]);
    setLogs([]);
  };

  const handleSaveCalendar = async () => {
    if (!selectedCalendar) return;
    const cal = calendars.find((c) => c.id === selectedCalendar);
    await setCalendar(selectedCalendar, cal?.summary || selectedCalendar);
    await fetchSettings();
  };

  const handleSyncAll = async () => {
    setSyncAllLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "sync-all-contracts" }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      toast({ title: `✅ ${json.synced}/${json.total} contratos sincronizados` });
      loadLogs();
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    } finally {
      setSyncAllLoading(false);
    }
  };

  const handleSaveCompany = async () => {
    setCsSaving(true);
    try {
      await saveCompanySettings(cs);
      toast({ title: "✅ Configurações salvas com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setCsSaving(false);
    }
  };

  const updateCs = (field: keyof CompanySettings, value: any) => {
    setCs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="animate-fade-in space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1.5">Gerencie integrações e preferências do sistema</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Building2 size={14} /> Geral
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1.5 text-xs">
            <GitBranch size={14} /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1.5 text-xs">
            <Package size={14} /> Catálogo
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5 text-xs">
            <Calendar size={14} /> Horários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-6 lg:grid-cols-2 stagger-fade-in">
            {/* Company Data */}
            <SectionCard icon={Building2} title="Dados da Empresa" description="Informações cadastrais do espaço">
              {csLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome da empresa</Label>
                      <Input
                        value={cs.company_name}
                        onChange={(e) => updateCs("company_name", e.target.value)}
                        placeholder="Espaço Lamoniê"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CNPJ</Label>
                      <Input
                        value={cs.cnpj}
                        onChange={(e) => updateCs("cnpj", cnpjMask(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={cs.phone}
                        onChange={(e) => updateCs("phone", phoneMask(e.target.value))}
                        placeholder="(00) 00000-0000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={cs.email}
                        onChange={(e) => updateCs("email", e.target.value)}
                        placeholder="contato@lamonie.com.br"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Endereço</Label>
                      <Input
                        value={cs.address}
                        onChange={(e) => updateCs("address", e.target.value)}
                        placeholder="Rua, número, bairro, cidade"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveCompany} disabled={csSaving} className="gap-2 w-full sm:w-auto mt-2">
                    {csSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {csSaving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </>
              )}
            </SectionCard>

            {/* Financial */}
            <SectionCard icon={CreditCard} title="Financeiro" description="Preferências de pagamento e recibos">
              {csLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Banco padrão</Label>
                      <Input
                        value={cs.default_bank}
                        onChange={(e) => updateCs("default_bank", e.target.value)}
                        placeholder="Ex: Banco do Brasil"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Chave Pix</Label>
                      <Input
                        value={cs.default_pix_key}
                        onChange={(e) => updateCs("default_pix_key", e.target.value)}
                        placeholder="CPF, email ou chave aleatória"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Categoria padrão (entrada)</Label>
                        <Input
                          value={cs.default_entry_category}
                          onChange={(e) => updateCs("default_entry_category", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Categoria padrão (saída)</Label>
                        <Input
                          value={cs.default_expense_category}
                          onChange={(e) => updateCs("default_expense_category", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 mt-2 space-y-3">
                    <SettingRow label="Gerar recibo automático" description="Ao confirmar pagamento">
                      <Switch
                        checked={cs.auto_receipt}
                        onCheckedChange={(v) => updateCs("auto_receipt", v)}
                      />
                    </SettingRow>
                    <SettingRow label="Confirmar pagamento automático" description="Quando sinal é registrado">
                      <Switch
                        checked={cs.auto_confirm_payment}
                        onCheckedChange={(v) => updateCs("auto_confirm_payment", v)}
                      />
                    </SettingRow>
                  </div>
                  <Button onClick={handleSaveCompany} disabled={csSaving} className="gap-2 w-full sm:w-auto mt-2">
                    {csSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {csSaving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </>
              )}
            </SectionCard>

            {/* Google Calendar Integration */}
            <SectionCard icon={Calendar} title="Google Agenda" description="Sincronize eventos automaticamente">
              {pageLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : settings?.is_connected ? (
                <>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-success/8 border border-success/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-success/15 text-success border-success/30">
                          <CheckCircle2 size={11} className="mr-1" /> Conectado
                        </Badge>
                      </div>
                      {settings.connected_email && (
                        <p className="text-xs text-muted-foreground mt-1">{settings.connected_email}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="h-8 text-xs text-danger hover:text-danger border-danger/30 hover:bg-danger/5"
                    >
                      Desconectar
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Calendário padrão</Label>
                    {calendarLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <div className="flex gap-2">
                        <Select
                          value={selectedCalendar || settings.calendar_id || "primary"}
                          onValueChange={setSelectedCalendar}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecionar calendário..." />
                          </SelectTrigger>
                          <SelectContent>
                            {calendars.map((cal) => (
                              <SelectItem key={cal.id} value={cal.id}>
                                {cal.summary} {cal.primary && "(principal)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={handleSaveCalendar}
                          disabled={!selectedCalendar}
                          className="h-10"
                        >
                          Salvar
                        </Button>
                      </div>
                    )}
                    {settings.calendar_name && !selectedCalendar && (
                      <p className="text-xs text-muted-foreground">
                        Atual: <span className="font-medium">{settings.calendar_name}</span>
                      </p>
                    )}
                  </div>

                  <div className="border-t border-border pt-4 space-y-3">
                    <SettingRow label="Criar evento ao assinar contrato">
                      <Switch defaultChecked />
                    </SettingRow>
                    <SettingRow label="Atualizar ao pagar sinal">
                      <Switch defaultChecked />
                    </SettingRow>
                    <SettingRow label="Remover ao cancelar contrato">
                      <Switch defaultChecked />
                    </SettingRow>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncAll}
                      disabled={syncAllLoading}
                      className="gap-2 w-full mt-2"
                    >
                      {syncAllLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sincronizar todos os contratos
                    </Button>
                  </div>

                  {/* Sync logs */}
                  <div className="space-y-2 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Histórico de sincronização</p>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={loadLogs} disabled={logsLoading}>
                        <RefreshCw size={11} className={logsLoading ? "animate-spin" : ""} /> Atualizar
                      </Button>
                    </div>
                    {logsLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum log ainda.</p>
                    ) : (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <div className="divide-y divide-border max-h-40 overflow-y-auto">
                          {logs.map((log) => (
                            <div key={String(log.id)} className="flex items-start gap-3 px-3 py-2 text-xs">
                              {log.status === "success" ? (
                                <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" />
                              ) : (
                                <XCircle size={12} className="text-danger mt-0.5 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{String(log.action)}</p>
                                <p className="text-muted-foreground truncate">{String(log.message || "")}</p>
                              </div>
                              <span className="text-muted-foreground/60 shrink-0">
                                {new Date(String(log.created_at)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Conecte sua conta Google para sincronizar contratos e visitas automaticamente.
                  </p>
                  <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wide">O que será sincronizado</p>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2"><CheckCircle2 size={11} className="text-success" /> Contratos assinados → eventos no Google Agenda</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={11} className="text-success" /> Mudanças de status → atualização automática</li>
                      <li className="flex items-center gap-2"><CheckCircle2 size={11} className="text-success" /> Eventos do Google → bloqueios visíveis no CRM</li>
                    </ul>
                  </div>
                  <Button onClick={handleConnect} disabled={connectLoading} className="gap-2 w-full sm:w-auto">
                    {connectLoading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                    Conectar com Google Agenda
                  </Button>
                </div>
              )}
            </SectionCard>

            {/* Notifications */}
            <SectionCard icon={Bell} title="Notificações" description="Alertas e avisos do sistema">
              <div className="space-y-3">
                <SettingRow label="Novo contrato assinado" description="Receber alerta quando um contrato for assinado">
                  <Switch defaultChecked />
                </SettingRow>
                <SettingRow label="Pagamento recebido" description="Notificar ao registrar pagamento">
                  <Switch defaultChecked />
                </SettingRow>
                <SettingRow label="Pagamento pendente" description="Lembrete de pagamentos próximos">
                  <Switch defaultChecked />
                </SettingRow>
                <SettingRow label="Visita agendada" description="Alerta ao agendar nova visita">
                  <Switch defaultChecked />
                </SettingRow>
                <SettingRow label="Cancelamento" description="Notificar cancelamentos de contratos/visitas">
                  <Switch defaultChecked />
                </SettingRow>
              </div>
            </SectionCard>

            {/* Security — full width */}
            <div className="lg:col-span-2">
              <SectionCard icon={Shield} title="Segurança" description="Autenticação e logs do sistema">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Email de login</Label>
                      <Input disabled placeholder="usuario@email.com" className="mt-1 bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">Alterar senha</Label>
                      <Input type="password" placeholder="Nova senha" className="mt-1" />
                    </div>
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                      <Shield size={15} /> Atualizar senha
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <SettingRow label="Encerrar sessões ativas" description="Desconectar todos os dispositivos">
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        Encerrar
                      </Button>
                    </SettingRow>
                    <SettingRow label="Log jurídico" description="Visualizar assinaturas e auditorias">
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        Visualizar
                      </Button>
                    </SettingRow>
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pipeline">
          <PipelineSettingsTab />
        </TabsContent>

        <TabsContent value="catalog">
          <CatalogSettingsTab />
        </TabsContent>

        <TabsContent value="schedule">
          <ScheduleSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

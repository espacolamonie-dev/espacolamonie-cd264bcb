import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Calendar, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoogleCalendar, GoogleCalendarItem, GoogleSettings } from "@/hooks/useGoogleCalendar";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, loading, fetchSettings, getAuthUrl, disconnect, getCalendars, setCalendar, getSyncLogs } = useGoogleCalendar();
  const [pageLoading, setPageLoading] = useState(true);
  const [calendars, setCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>("");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setPageLoading(true);
      const s = await fetchSettings();
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
    } catch {
      // not connected yet
    } finally {
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

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Integrações e preferências do sistema</p>
      </div>

      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Calendar size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Google Agenda</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Sincronize contratos assinados automaticamente com seu Google Agenda
              </CardDescription>
            </div>
            <div className="ml-auto">
              {pageLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : settings?.is_connected ? (
                <Badge className="bg-success/15 text-success border-success/30">
                  <CheckCircle2 size={11} className="mr-1" /> Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <XCircle size={11} className="mr-1" /> Desconectado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {pageLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settings?.is_connected ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-success/8 border border-success/20">
                <div>
                  <p className="text-sm font-medium text-success">Conta conectada</p>
                  {settings.connected_email && (
                    <p className="text-xs text-muted-foreground mt-0.5">{settings.connected_email}</p>
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

              {/* Calendar selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Calendário padrão</p>
                <p className="text-xs text-muted-foreground">
                  Eventos de contratos serão criados neste calendário.
                </p>
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

              {/* Sync rules info */}
              <div className="rounded-xl border border-border p-4 space-y-2.5 bg-muted/30">
                <p className="text-sm font-medium text-foreground">Regras de sincronização</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" /> Eventos são criados no Google somente quando o contrato for <strong>assinado</strong></li>
                  <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" /> Alterações no status de pagamento atualizam cor e descrição do evento</li>
                  <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" /> Contratos cancelados ficam marcados como [CANCELADO] no Google</li>
                  <li className="flex items-start gap-2"><AlertCircle size={12} className="text-warning mt-0.5 shrink-0" /> Eventos externos criados no Google aparecem como bloqueios no CRM (somente leitura)</li>
                </ul>
              </div>

              {/* Sync logs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Histórico de sincronização</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={loadLogs} disabled={logsLoading}>
                    <RefreshCw size={11} className={logsLoading ? "animate-spin" : ""} /> Atualizar
                  </Button>
                </div>
                {logsLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum log de sincronização ainda.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="divide-y divide-border max-h-48 overflow-y-auto">
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
                Conecte sua conta Google para sincronizar contratos assinados automaticamente com o Google Agenda.
              </p>
              <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">O que será sincronizado</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2"><CheckCircle2 size={11} className="text-success" /> Contratos assinados → eventos automáticos no Google Agenda</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={11} className="text-success" /> Mudanças de status → atualização de cor e descrição</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={11} className="text-success" /> Eventos externos do Google → bloqueios visíveis no CRM</li>
                </ul>
              </div>
              <Button
                onClick={handleConnect}
                disabled={connectLoading}
                className="gap-2 w-full sm:w-auto"
              >
                {connectLoading ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                Conectar com Google Agenda
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

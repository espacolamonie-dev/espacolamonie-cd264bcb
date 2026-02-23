import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type WhatsAppLog, getLogs } from "@/data/whatsappStore";

const EVENT_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={14} className="text-green-500" />,
  error: <XCircle size={14} className="text-red-500" />,
  warning: <AlertTriangle size={14} className="text-amber-500" />,
  info: <Info size={14} className="text-blue-500" />,
};

const EVENT_BADGE: Record<string, string> = {
  connection: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  disconnection: "bg-red-500/15 text-red-600 border-red-500/30",
  message_sent: "bg-green-500/15 text-green-600 border-green-500/30",
  message_received: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  error: "bg-red-500/15 text-red-600 border-red-500/30",
  reconnection: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  info: "bg-muted text-muted-foreground border-border",
};

export default function WhatsAppLogs() {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getLogs();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  return (
    <Card className="card-premium">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Logs do WhatsApp</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Eventos de conexão, mensagens e erros
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Info size={32} className="mx-auto opacity-20 mb-3" />
            <p className="text-sm">Nenhum log registrado</p>
            <p className="text-xs mt-1">Os logs aparecerão quando o WhatsApp for conectado via WAHA</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 shrink-0">
                    {EVENT_ICONS[log.event_type] || EVENT_ICONS.info}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] px-1.5 py-0 border rounded-full ${EVENT_BADGE[log.event_type] || EVENT_BADGE.info}`}>
                        {log.event_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" })}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

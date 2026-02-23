import { useEffect, useState } from "react";
import { Wifi, WifiOff, QrCode, Save, Loader2, RefreshCw, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  type WhatsAppConnection,
  getConnection, upsertConnection,
  checkWahaStatus, getWahaQR, startWahaSession,
} from "@/data/whatsappStore";

export default function WhatsAppConnectionSettings() {
  const [conn, setConn] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [wahaUrl, setWahaUrl] = useState("");
  const [wahaApiKey, setWahaApiKey] = useState("");
  const [sessionName, setSessionName] = useState("default");

  useEffect(() => {
    loadConnection();
  }, []);

  const loadConnection = async () => {
    setLoading(true);
    try {
      const data = await getConnection();
      if (data) {
        setConn(data);
        setWahaUrl(data.waha_url);
        setWahaApiKey(data.waha_api_key);
        setSessionName(data.session_name);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!wahaUrl.trim()) {
      toast.error("URL do WAHA é obrigatória");
      return;
    }
    setSaving(true);
    try {
      await upsertConnection({
        waha_url: wahaUrl.trim().replace(/\/$/, ""),
        waha_api_key: wahaApiKey.trim(),
        session_name: sessionName.trim() || "default",
      });
      toast.success("Configurações WAHA salvas!");
      await loadConnection();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!wahaUrl) return;
    setChecking(true);
    try {
      const result = await checkWahaStatus(wahaUrl, wahaApiKey, sessionName);
      await upsertConnection({
        status: result.status,
        connected_phone: result.phone || null,
        ...(result.status === "connected" ? { connected_at: new Date().toISOString() } : {}),
        ...(result.status === "disconnected" ? { disconnected_at: new Date().toISOString() } : {}),
      });
      await loadConnection();
      toast.success(`Status: ${result.status}`);
    } catch {
      toast.error("Erro ao verificar status");
    } finally {
      setChecking(false);
    }
  };

  const handleGetQR = async () => {
    if (!wahaUrl) return;
    setQrLoading(true);
    setQrCode(null);
    try {
      // First start session with webhook
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      await startWahaSession(wahaUrl, wahaApiKey, sessionName, webhookUrl);

      // Then get QR
      const qr = await getWahaQR(wahaUrl, wahaApiKey, sessionName);
      if (qr) {
        setQrCode(qr);
      } else {
        toast.info("QR Code não disponível — a sessão pode já estar conectada.");
      }
    } catch {
      toast.error("Erro ao obter QR Code");
    } finally {
      setQrLoading(false);
    }
  };

  const statusColor = conn?.status === "connected"
    ? "bg-green-500/15 text-green-600 border-green-500/30"
    : conn?.status === "error"
    ? "bg-red-500/15 text-red-600 border-red-500/30"
    : "bg-amber-500/15 text-amber-600 border-amber-500/30";

  const StatusIcon = conn?.status === "connected" ? Wifi : WifiOff;

  return (
    <Card className="card-premium">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Phone size={20} className="text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-display">Conexão WhatsApp (WAHA)</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Configure a URL do seu servidor WAHA para conectar via QR Code
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
          <div className="flex items-center gap-2">
            <StatusIcon size={16} className={conn?.status === "connected" ? "text-green-500" : "text-amber-500"} />
            <div>
              <Badge className={`text-[10px] border rounded-full px-2 py-0.5 ${statusColor}`}>
                {conn?.status === "connected" ? "Conectado" : conn?.status === "error" ? "Erro" : "Desconectado"}
              </Badge>
              {conn?.connected_phone && (
                <p className="text-xs text-muted-foreground mt-0.5">📱 +{conn.connected_phone}</p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checking || !wahaUrl} className="h-8 text-xs gap-1.5">
            <RefreshCw size={12} className={checking ? "animate-spin" : ""} /> Verificar
          </Button>
        </div>

        {/* WAHA Config */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL do WAHA</Label>
            <Input
              value={wahaUrl}
              onChange={(e) => setWahaUrl(e.target.value)}
              placeholder="https://seu-waha.railway.app"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">API Key (opcional)</Label>
            <Input
              value={wahaApiKey}
              onChange={(e) => setWahaApiKey(e.target.value)}
              placeholder="Chave de API do WAHA"
              type="password"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Nome da Sessão</Label>
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="default"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 flex-1">
            <Save size={14} /> {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
          <Button variant="outline" onClick={handleGetQR} disabled={qrLoading || !wahaUrl} className="gap-1.5">
            {qrLoading ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
            QR Code
          </Button>
        </div>

        {/* QR Code Display */}
        {qrCode && (
          <div className="border border-border rounded-xl p-4 text-center bg-white">
            <p className="text-xs text-muted-foreground mb-3">Escaneie o QR Code com o WhatsApp</p>
            <img
              src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp"
              className="mx-auto max-w-[250px]"
            />
            <p className="text-[10px] text-muted-foreground mt-3">
              Abra WhatsApp → Configurações → Dispositivos Conectados → Conectar Dispositivo
            </p>
          </div>
        )}

        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[10px] text-muted-foreground">
            <strong>ℹ️ Modo teste:</strong> A conexão via QR Code usa WAHA (WhatsApp HTTP API) rodando em servidor externo.
            Configure seu servidor WAHA no Railway, Render ou VPS e insira a URL acima.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
